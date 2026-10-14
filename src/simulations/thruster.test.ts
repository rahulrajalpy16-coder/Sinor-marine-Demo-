import {
  applyThrusterCommand,
  clampCommand,
  initialThrusterState,
  InvalidCommandError,
  stepThruster,
  thrustFrom,
  powerFrom,
  maxPitchForLimit,
  unacknowledged,
  DEFAULT_THRUSTER_PARAMS as P,
  type ThrusterState,
} from './thruster';
import { FixedStepper } from './fixedStep';
import { ThrusterController } from './controller';

const run = (s: ThrusterState, seconds: number, dt = 1 / 120) => {
  for (let t = 0; t < seconds; t += dt) s = stepThruster(s, dt);
  return s;
};

describe('thruster command validation', () => {
  it('clamps to [-1, 1]', () => {
    expect(clampCommand(2)).toBe(1);
    expect(clampCommand(-7)).toBe(-1);
    expect(clampCommand(0.25)).toBe(0.25);
    expect(clampCommand('0.5')).toBe(0.5);
  });
  it('rejects non-finite input', () => {
    for (const v of [NaN, Infinity, 'abc', '', undefined, null, {}]) expect(() => clampCommand(v)).toThrow(InvalidCommandError);
  });
});

const started = (cmd = 0) => {
  let s = applyThrusterCommand(initialThrusterState(), { type: 'start' });
  s = run(s, P.startRampS + 0.5);
  return applyThrusterCommand(s, { type: 'set-command', value: cmd });
};

describe('CPP thruster dynamics', () => {
  it('does not turn or push while stopped', () => {
    const s = run(applyThrusterCommand(initialThrusterState(), { type: 'set-command', value: 1 }), 2);
    expect(s.rpm).toBe(0);
    expect(s.thrustKN).toBe(0);
  });

  it('blocks a start with the lever off zero and raises an alarm', () => {
    const s = applyThrusterCommand(applyThrusterCommand(initialThrusterState(), { type: 'set-command', value: 0.6 }), { type: 'start' });
    expect(s.status).toBe('stopped');
    expect(s.alarms).toContain('LEVER_NOT_ZERO');
    const zeroed = applyThrusterCommand(s, { type: 'set-command', value: 0 });
    expect(zeroed.alarms).not.toContain('LEVER_NOT_ZERO');
    expect(applyThrusterCommand(zeroed, { type: 'start' }).status).toBe('starting');
  });

  it('soft-starts to constant rated speed at zero pitch with only idle load', () => {
    let s = applyThrusterCommand(initialThrusterState(), { type: 'start' });
    s = run(s, P.startRampS / 2);
    expect(s.status).toBe('starting');
    s = run(s, P.startRampS);
    expect(s.status).toBe('running');
    expect(s.rpm).toBe(P.ratedRpm);
    expect(s.thrustKN).toBe(0);
    expect(s.powerKW).toBeCloseTo(P.zeroPitchLoad * P.ratedPowerKW);
  });

  it('pitch follows the lever at the servo rate and sets signed thrust', () => {
    let s = started(1);
    s = run(s, 1);
    expect(s.pitch).toBeCloseTo(P.pitchRatePerS, 1);
    s = run(s, 10);
    expect(s.pitch).toBeCloseTo(1);
    expect(s.thrustKN).toBeCloseTo(P.maxThrustKN);
    expect(s.powerKW).toBeCloseTo(P.ratedPowerKW);
    s = run(applyThrusterCommand(s, { type: 'set-command', value: -0.5 }), 10);
    expect(s.rpm).toBe(P.ratedRpm); // speed never reverses on a CPP
    expect(s.thrustKN).toBeCloseTo(-P.maxThrustKN * 0.5 ** 1.5);
  });

  it('thrust and power formulas', () => {
    expect(thrustFrom(1, P.ratedRpm)).toBeCloseTo(P.maxThrustKN);
    expect(thrustFrom(-1, P.ratedRpm)).toBeCloseTo(-P.maxThrustKN);
    expect(thrustFrom(1, 0)).toBe(0);
    expect(powerFrom(0, P.ratedRpm)).toBeCloseTo(P.zeroPitchLoad * P.ratedPowerKW);
  });

  it('load clipping keeps power within the limit', () => {
    let s = applyThrusterCommand(started(1), { type: 'set-power-limit', value: 0.5 });
    s = run(s, 10);
    expect(s.loadClipping).toBe(true);
    expect(s.alarms).toContain('LOAD_CLIPPING');
    expect(s.powerKW).toBeLessThanOrEqual(0.5 * P.ratedPowerKW + 1e-6);
    expect(s.pitch).toBeCloseTo(maxPitchForLimit(0.5));
    s = run(applyThrusterCommand(s, { type: 'set-power-limit', value: 1 }), 10);
    expect(s.loadClipping).toBe(false);
    expect(s.alarms).not.toContain('LOAD_CLIPPING');
  });

  it('NFU nudges the setpoint and DP command locks the bridge lever', () => {
    let s = applyThrusterCommand(initialThrusterState(), { type: 'nudge', delta: 0.1 });
    expect(s.command).toBeCloseTo(0.1);
    s = applyThrusterCommand(s, { type: 'set-station', station: 'DP' });
    expect(s.command).toBe(0);
    expect(s.alarms).toContain('NOT_IN_COMMAND');
    expect(() => applyThrusterCommand(s, { type: 'set-command', value: 0.5 })).toThrow(InvalidCommandError);
  });

  it('pause freezes state; resume continues', () => {
    let s = run(started(0.8), 1);
    const paused = applyThrusterCommand(s, { type: 'pause' });
    expect(run(paused, 3)).toEqual(paused);
    const resumed = run(applyThrusterCommand(paused, { type: 'resume' }), 1);
    expect(resumed.status).toBe('running');
    expect(Math.abs(resumed.pitch)).toBeGreaterThan(Math.abs(paused.pitch));
  });

  it('stop de-pitches first, then runs the motor down', () => {
    let s = run(started(1), 6);
    s = applyThrusterCommand(s, { type: 'stop' });
    expect(s.status).toBe('stopping');
    expect(s.command).toBe(0);
    s = run(s, 1);
    expect(s.rpm).toBe(P.ratedRpm); // still de-pitching under power
    s = run(s, 20);
    expect(s.status).toBe('stopped');
    expect(s.rpm).toBe(0);
    expect(s.pitch).toBe(0);
    expect(s.thrustKN).toBe(0);
  });

  it('emergency stop trips the motor and latches until reset', () => {
    let s = run(started(1), 6);
    s = applyThrusterCommand(s, { type: 'emergency-stop' });
    expect(s.status).toBe('shutdown');
    s = run(s, 20);
    expect(s.rpm).toBe(0);
    expect(s.status).toBe('shutdown');
    expect(applyThrusterCommand(s, { type: 'start' })).toBe(s);
    expect(unacknowledged(s)).toEqual(['EMERGENCY_STOP']);
    expect(unacknowledged(applyThrusterCommand(s, { type: 'acknowledge' }))).toEqual([]);
    expect(applyThrusterCommand(s, { type: 'reset' })).toEqual(initialThrusterState());
  });

  it('ignores invalid transitions', () => {
    const s = initialThrusterState();
    expect(applyThrusterCommand(s, { type: 'pause' })).toBe(s);
    expect(applyThrusterCommand(s, { type: 'resume' })).toBe(s);
    expect(applyThrusterCommand(s, { type: 'emergency-stop' })).toBe(s);
  });

  it('is stable for a large timestep', () => {
    let s = applyThrusterCommand(initialThrusterState(), { type: 'start' });
    s = stepThruster(s, 50);
    expect(s.rpm).toBeLessThanOrEqual(P.ratedRpm);
    expect(Number.isFinite(s.angle)).toBe(true);
    expect(s.angle).toBeGreaterThanOrEqual(0);
    expect(s.angle).toBeLessThan(Math.PI * 2);
  });
});

describe('fixed stepper', () => {
  it('produces frame-rate independent step counts', () => {
    const a = new FixedStepper(1 / 120);
    const b = new FixedStepper(1 / 120);
    let na = 0;
    let nb = 0;
    for (let i = 0; i < 60; i++) na += a.advance(1 / 60);
    for (let i = 0; i < 144; i++) nb += b.advance(1 / 144);
    expect(na).toBe(120);
    expect(Math.abs(nb - 120)).toBeLessThanOrEqual(1);
  });
  it('drops huge gaps instead of replaying them', () => {
    const s = new FixedStepper(1 / 120, 24);
    expect(s.advance(10)).toBe(24);
    expect(s.advance(-1)).toBe(0);
  });
});

describe('thruster controller', () => {
  it('reports validation errors without throwing and keeps state', () => {
    const c = new ThrusterController();
    c.dispatch({ type: 'set-command', value: 0.3 });
    c.dispatch({ type: 'set-command', value: 'nonsense' });
    expect(c.lastError).toMatch(/finite/);
    expect(c.getState().command).toBe(0.3);
  });
  it('notifies subscribers and unsubscribes cleanly', () => {
    const c = new ThrusterController();
    const seen: string[] = [];
    const off = c.subscribe((s) => seen.push(s.status));
    c.dispatch({ type: 'start' });
    expect(seen).toContain('starting');
    expect(c.listenerCount()).toBe(1);
    off();
    expect(c.listenerCount()).toBe(0);
  });
});
