import {
  allocate,
  applyDPCommand,
  canHold,
  environmentForces,
  initialDPState,
  InvalidDPInputError,
  positionError,
  stepDP,
  wrapPi,
  type DPClass,
  type DPCommand,
  type DPState,
} from './dp';

/** Run the DP model with an ideal BT1 that follows its command with a 2 s lag. */
function run(s: DPState, seconds: number, bt1 = true) {
  let f = 0;
  const dt = 0.05;
  for (let t = 0; t < seconds; t += dt) {
    const out = stepDP(s, dt, { bt1: { available: bt1, forceN: f } });
    s = out.state;
    f += (out.bt1CmdN - f) * (dt / 2);
  }
  return s;
}
const cmds = (s: DPState, ...c: DPCommand[]) => c.reduce(applyDPCommand, s);
const started = (cls: DPClass = 2, ...c: DPCommand[]) => cmds(initialDPState(cls), ...c, { type: 'start' });
const headingErrDeg = (s: DPState) => Math.abs(wrapPi(s.eta[2] - s.setpoint[2])) * (180 / Math.PI);

describe('DP environment and allocation', () => {
  it('wind on the starboard beam pushes the vessel to port', () => {
    const f = environmentForces({ eta: [0, 0, 0], nu: [0, 0, 0], wind: { speedKn: 30, fromDeg: 90 }, current: { speedKn: 0, toDeg: 0 } });
    expect(f[1]).toBeLessThan(-50e3);
    expect(Math.abs(f[0])).toBeLessThan(1e3);
  });
  it('a current setting east pushes the vessel to starboard at heading north', () => {
    const f = environmentForces({ eta: [0, 0, 0], nu: [0, 0, 0], wind: { speedKn: 0, fromDeg: 0 }, current: { speedKn: 1, toDeg: 90 } });
    expect(f[1]).toBeGreaterThan(20e3);
  });
  it('allocates a pure sway force exactly with all thrusters and without BT1', () => {
    const all = { BT1: true, BT2: true, AZ1: true, AZ2: true };
    for (const avail of [all, { ...all, BT1: false }]) {
      const a = allocate([0, 150e3, 0], avail);
      expect(a.achieved[0]).toBeCloseTo(0, -2);
      expect(a.achieved[1]).toBeCloseTo(150e3, -2);
      expect(a.achieved[2]).toBeCloseTo(0, -3);
    }
  });
  it('saturates and reports when the demand exceeds capability', () => {
    const all = { BT1: true, BT2: true, AZ1: true, AZ2: true };
    const a = allocate([0, 2e6, 0], all);
    expect(a.saturated).toBe(true);
    expect(canHold([0, 2e6, 0], all)).toBe(false);
    expect(canHold([0, 100e3, 0], all)).toBe(true);
    // Stern azimuths alone cannot make pure sway: the yaw moment needs a bow thruster.
    expect(canHold([0, 150e3, 0], { BT1: false, BT2: false, AZ1: true, AZ2: true })).toBe(false);
  });
});

describe('DP station keeping', () => {
  it('drifts without DP control', () => {
    const s = run(cmds(started(), { type: 'set-mode', mode: 'STANDBY' }), 300);
    expect(positionError(s)).toBeGreaterThan(20);
  });

  it('holds position and heading in wind and current (DP2, auto position)', () => {
    const s = run(started(2), 900);
    expect(s.mode).toBe('AUTO_POSITION');
    expect(positionError(s)).toBeLessThan(2);
    expect(headingErrDeg(s)).toBeLessThan(2);
    expect(s.alarms).not.toContain('DP_LOST');
  });

  it('moves to a new setpoint and heading', () => {
    let s = run(started(2), 200);
    s = run(applyDPCommand(s, { type: 'set-setpoint', north: 10, east: -5, headingDeg: 20 }), 900);
    expect(Math.hypot(s.eta[0] - 10, s.eta[1] + 5)).toBeLessThan(2);
    expect(Math.abs(wrapPi(s.eta[2] - (20 * Math.PI) / 180)) * (180 / Math.PI)).toBeLessThan(2.5);
  });

  it('joystick mode moves the vessel ahead', () => {
    const s = run(cmds(started(2), { type: 'set-mode', mode: 'JOYSTICK' }, { type: 'set-joystick', surge: 0.6 }), 120);
    expect(s.eta[0]).toBeGreaterThan(10);
  });

  it('holds without BT1 but raises an alarm', () => {
    const s = run(started(2), 900, false);
    expect(s.alarms).toContain('BT1_NOT_AVAILABLE');
    expect(positionError(s)).toBeLessThan(3);
  });
});

describe('DP redundancy by class', () => {
  it('DP1 loses position when its single controller fails', () => {
    let s = run(started(1), 300);
    s = run(applyDPCommand(s, { type: 'fail-controller', id: 'A', failed: true }), 300);
    expect(s.dpLost).toBe(true);
    expect(s.alarms).toContain('DP_LOST');
    expect(positionError(s)).toBeGreaterThan(10);
  });

  it('DP2 majority voting keeps position after one controller fails', () => {
    let s = run(started(2), 300);
    s = run(applyDPCommand(s, { type: 'fail-controller', id: 'A', failed: true }), 300);
    expect(s.dpLost).toBe(false);
    expect(s.alarms).toContain('CONTROLLER_FAIL');
    expect(s.alarms).not.toContain('NO_REDUNDANCY');
    expect(positionError(s)).toBeLessThan(2);
  });

  it('DP2 survives a network failure on its dual network; DP1 does not', () => {
    const two = run(applyDPCommand(run(started(2), 200), { type: 'fail-network', id: 'A', failed: true }), 200);
    expect(two.dpLost).toBe(false);
    const one = run(applyDPCommand(run(started(1), 200), { type: 'fail-network', id: 'A', failed: true }), 200);
    expect(one.dpLost).toBe(true);
  });

  it('DP2 rejects a drifting reference by voting; DP1 follows it off station', () => {
    const drift: DPCommand = { type: 'ref-fault', id: 'GNSS1', fault: 'drift' };
    const two = run(applyDPCommand(run(started(2), 300), drift), 400);
    expect(two.refs.find((r) => r.id === 'GNSS1')!.rejected).toBe(true);
    expect(positionError(two)).toBeLessThan(2.5);
    const one = run(applyDPCommand(run(started(1), 300), drift), 400);
    expect(one.alarms).toContain('REF_DEVIATION');
    expect(positionError(one)).toBeGreaterThan(5);
  });

  it('falls back to dead reckoning when every reference is lost', () => {
    let s = run(started(2), 200);
    s = cmds(s, ...(['GNSS1', 'GNSS2', 'HPR'] as const).map((id) => ({ type: 'ref-fault', id, fault: 'lost' }) as DPCommand));
    s = run(s, 60);
    expect(s.alarms).toContain('DEAD_RECKONING');
  });

  it('only DP3 keeps DP when the bridge compartment is lost (backup in A60 room)', () => {
    const fire: DPCommand = { type: 'bridge-compartment', lost: true };
    const three = run(applyDPCommand(run(started(3), 300), fire), 300);
    expect(three.dpLost).toBe(false);
    expect(three.alarms).toContain('BACKUP_IN_COMMAND');
    expect(positionError(three)).toBeLessThan(2);
    const two = run(applyDPCommand(run(started(2), 300), fire), 300);
    expect(two.dpLost).toBe(true);
  });

  it('consequence analysis flags a worst-case failure in heavy weather', () => {
    let s = cmds(started(2), { type: 'set-wind', speedKn: 50, fromDeg: 90 }, { type: 'set-current', speedKn: 2.5, toDeg: 270 });
    s = run(s, 30);
    expect(s.consequence.ok).toBe(false);
    expect(s.alarms).toContain('CONSEQUENCE');
    const calm = run(cmds(started(2), { type: 'set-wind', speedKn: 10 }, { type: 'set-current', speedKn: 0.3 }), 30);
    expect(calm.consequence.ok).toBe(true);
  });
});

describe('DP commands', () => {
  it('validates and clamps inputs', () => {
    const s = initialDPState();
    expect(() => applyDPCommand(s, { type: 'set-wind', speedKn: 'abc' })).toThrow(InvalidDPInputError);
    expect(() => applyDPCommand(s, { type: 'set-setpoint', north: NaN })).toThrow(InvalidDPInputError);
    expect(applyDPCommand(s, { type: 'set-wind', speedKn: 500 }).wind.speedKn).toBe(60);
    expect(applyDPCommand(s, { type: 'set-wind', fromDeg: -90 }).wind.fromDeg).toBe(270);
    expect(applyDPCommand(s, { type: 'set-joystick', sway: 3 }).joystick[1]).toBe(1);
    expect(() => applyDPCommand(s, { type: 'set-class', value: 4 as DPClass })).toThrow(InvalidDPInputError);
  });
  it('class layout follows the datasheet architecture', () => {
    const c = (k: DPClass) => initialDPState(k);
    expect(c(1).controllers.filter((x) => x.installed)).toHaveLength(1);
    expect(c(2).controllers.filter((x) => x.installed)).toHaveLength(3);
    expect(c(1).networks.filter((x) => x.installed)).toHaveLength(1);
    expect(c(2).networks.filter((x) => x.installed)).toHaveLength(2);
    expect(c(1).refs.filter((x) => x.installed && x.enabled).map((r) => r.id)).toEqual(['GNSS1', 'HPR']);
    expect(c(2).refs.filter((x) => x.installed && x.enabled).map((r) => r.id)).toEqual(['GNSS1', 'GNSS2', 'HPR']);
    // RadaScan, CyScan, taut wire and SPRINT-Nav are fitted on every class but start deselected and not ready.
    expect(c(1).refs.filter((x) => !x.enabled).map((r) => [r.id, r.installed, r.ready])).toEqual([
      ['GNSS2', false, true],
      ['RADASCAN', true, false],
      ['CYSCAN', true, false],
      ['TAUTWIRE', true, false],
      ['SPRINTNAV', true, false],
    ]);
  });
  it('pause freezes, reset returns to start keeping the environment', () => {
    let s = run(started(2), 50);
    const p = applyDPCommand(s, { type: 'pause' });
    expect(run(p, 20)).toEqual(p);
    s = applyDPCommand(cmds(s, { type: 'set-wind', speedKn: 33 }), { type: 'reset' });
    expect(s.status).toBe('stopped');
    expect(s.eta).toEqual([0, 0, 0]);
    expect(s.wind.speedKn).toBe(33);
  });
});
