import {
  applyThrusterCommand,
  clampCommand,
  initialThrusterState,
  InvalidCommandError,
  stepThruster,
  thrustFromRpm,
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

describe('thruster dynamics', () => {
  it('does not spin while stopped, even with a command', () => {
    let s = applyThrusterCommand(initialThrusterState(), { type: 'set-command', value: 1 });
    s = run(s, 2);
    expect(s.rpm).toBe(0);
    expect(s.thrustKN).toBe(0);
  });

  it('approaches commanded rpm and signed thrust (starboard positive)', () => {
    let s = applyThrusterCommand(initialThrusterState(), { type: 'set-command', value: 1 });
    s = applyThrusterCommand(s, { type: 'start' });
    s = run(s, 10);
    expect(s.rpm).toBeCloseTo(P.maxRpm, 0);
    expect(s.thrustKN).toBeCloseTo(P.maxThrustKN, 0);
    s = applyThrusterCommand(s, { type: 'set-command', value: -0.5 });
    s = run(s, 10);
    expect(s.rpm).toBeCloseTo(-0.5 * P.maxRpm, 0);
    expect(s.thrustKN).toBeCloseTo(-0.25 * P.maxThrustKN, 0);
  });

  it('thrust scales with rpm squared and keeps sign', () => {
    expect(thrustFromRpm(P.maxRpm / 2)).toBeCloseTo(P.maxThrustKN / 4);
    expect(thrustFromRpm(-P.maxRpm)).toBeCloseTo(-P.maxThrustKN);
  });

  it('pause freezes state; resume continues', () => {
    let s = applyThrusterCommand(applyThrusterCommand(initialThrusterState(), { type: 'set-command', value: 0.8 }), { type: 'start' });
    s = run(s, 1);
    const paused = applyThrusterCommand(s, { type: 'pause' });
    expect(run(paused, 3)).toEqual(paused);
    const resumed = run(applyThrusterCommand(paused, { type: 'resume' }), 1);
    expect(Math.abs(resumed.rpm)).toBeGreaterThan(Math.abs(paused.rpm));
  });

  it('stop zeroes the command and spins down to a full stop', () => {
    let s = applyThrusterCommand(applyThrusterCommand(initialThrusterState(), { type: 'set-command', value: 1 }), { type: 'start' });
    s = run(s, 5);
    s = applyThrusterCommand(s, { type: 'stop' });
    expect(s.status).toBe('stopping');
    expect(s.command).toBe(0);
    s = run(s, 15);
    expect(s.status).toBe('stopped');
    expect(s.rpm).toBe(0);
    expect(s.thrustKN).toBe(0);
  });

  it('reset returns to the initial state immediately', () => {
    let s = applyThrusterCommand(applyThrusterCommand(initialThrusterState(), { type: 'set-command', value: 1 }), { type: 'start' });
    s = run(s, 2);
    expect(applyThrusterCommand(s, { type: 'reset' })).toEqual(initialThrusterState());
  });

  it('ignores invalid transitions', () => {
    const s = initialThrusterState();
    expect(applyThrusterCommand(s, { type: 'pause' })).toBe(s);
    expect(applyThrusterCommand(s, { type: 'resume' })).toBe(s);
  });

  it('is stable for a large timestep', () => {
    let s = applyThrusterCommand(applyThrusterCommand(initialThrusterState(), { type: 'set-command', value: 1 }), { type: 'start' });
    s = stepThruster(s, 50);
    expect(s.rpm).toBeLessThanOrEqual(P.maxRpm);
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
    expect(seen).toContain('running');
    expect(c.listenerCount()).toBe(1);
    off();
    expect(c.listenerCount()).toBe(0);
  });
});
