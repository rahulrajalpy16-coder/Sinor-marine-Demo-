import { apparentWind, applyWindCommand, initialWindState, stepWind, trueFromApparent, type WindState, type WindStepInput } from './wind';
import { environmentForces, windForceRel } from './dp';

const KN = 0.514444;
const input = (over: Partial<WindStepInput> = {}): WindStepInput => ({
  mean: { speedKn: 20, fromDeg: 90 },
  psi: 0,
  psiMeas: 0,
  nu: [0, 0, 0],
  powered: { WS1: true, WS2: true },
  ...over,
});
const run = (s: WindState, seconds: number, inp: WindStepInput = input()) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.05) s = stepWind(s, 0.05, inp);
  return s;
};
const calm = () => applyWindCommand(initialWindState(), { type: 'set-gust', pct: 0 });

describe('wind frames and conventions', () => {
  it('gives the expected relative direction for known heading cases', () => {
    // Stationary, heading north, wind from the east: from 90° relative (starboard beam).
    expect(apparentWind(20, 90, 0, [0, 0]).relFromDeg).toBeCloseTo(90, 9);
    // Heading east into a wind from the east: on the bow.
    expect(apparentWind(20, 90, Math.PI / 2, [0, 0]).relFromDeg).toBeCloseTo(0, 9);
    // Heading south, wind from the north: from astern.
    expect(apparentWind(20, 0, Math.PI, [0, 0]).relFromDeg).toBeCloseTo(180, 9);
    // No wind, vessel moving ahead at 5 m/s: 9.72 kn apparent wind from dead ahead.
    const a = apparentWind(0, 0, 0.3, [5, 0]);
    expect(a.speedKn).toBeCloseTo(5 / KN, 9);
    expect(a.relFromDeg).toBeCloseTo(0, 9);
  });
  it('true wind is recovered exactly from apparent wind, heading and velocity', () => {
    for (const [sp, from, psi, u, v] of [
      [25, 30, 1.2, 1.5, -0.4],
      [8, 270, -2.0, 0, 0.8],
      [40, 180, 0, -2, 0],
    ]) {
      const a = apparentWind(sp, from, psi, [u, v]);
      const t = trueFromApparent(a.speedKn, a.relFromDeg, psi, [u, v]);
      expect(t.speedKn).toBeCloseTo(sp, 9);
      expect(((t.fromDeg - from + 540) % 360) - 180).toBeCloseTo(0, 9);
    }
  });
  it('wind force: a beam wind from starboard pushes to port, a head wind pushes astern', () => {
    expect(windForceRel(30, 90)[1]).toBeLessThan(0);
    expect(Math.abs(windForceRel(30, 90)[0])).toBeLessThan(1);
    expect(windForceRel(30, 0)[0]).toBeLessThan(0);
    // q = ½ρV²: doubling the speed quadruples the force.
    expect(windForceRel(40, 60)[1] / windForceRel(20, 60)[1]).toBeCloseTo(4, 9);
  });
});

describe('gusts', () => {
  it('are reproducible with a fixed seed and differ with another seed', () => {
    const a = run(initialWindState(7), 120);
    const b = run(initialWindState(7), 120);
    const c = run(initialWindState(8), 120);
    expect(a.actual).toEqual(b.actual);
    expect(a.actual.speedKn).not.toBe(c.actual.speedKn);
  });
  it('have the configured intensity (1σ, % of the mean) over a long run', () => {
    let s = applyWindCommand(initialWindState(3), { type: 'set-gust', pct: 15 });
    const v: number[] = [];
    for (let i = 0; i < 4000; i++) {
      s = run(s, 1);
      v.push(s.actual.speedKn);
    }
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    expect(mean).toBeGreaterThan(18);
    expect(mean).toBeLessThan(22);
    expect(sd / 20).toBeGreaterThan(0.1);
    expect(sd / 20).toBeLessThan(0.2);
  });
  it('do not depend on sensor faults (separate random streams)', () => {
    const a = run(initialWindState(5), 60);
    const b = run(applyWindCommand(initialWindState(5), { type: 'sensor-fault', id: 'WS1', fault: 'fail' }), 60);
    expect(b.actual).toEqual(a.actual);
  });
});

describe('wind sensors', () => {
  it('measure the apparent wind, with the leeward sensor in the mast wake', () => {
    const s = run(calm(), 5);
    const [ws1, ws2] = s.sensors;
    // Wind from starboard: WS1 on the port yardarm is leeward of the mast.
    expect(ws1.shadowed).toBe(true);
    expect(ws2.shadowed).toBe(false);
    expect(ws2.relSpeedKn).toBeGreaterThan(19);
    expect(ws1.relSpeedKn).toBeLessThan(17.5);
    expect(s.output.valid).toBe(true);
  });
  it('time-stamps messages: a communication failure goes stale, then no data, and is not used', () => {
    let s = run(calm(), 3);
    s = applyWindCommand(s, { type: 'sensor-fault', id: 'WS2', fault: 'comms' });
    s = run(s, 4);
    expect(s.sensors[1].status).toBe('STALE');
    expect(s.sensors[1].valid).toBe(false);
    expect(s.output.source).toBe('WS1');
    s = run(s, 8);
    expect(s.sensors[1].status).toBe('NO DATA');
  });
  it('rejects a frozen output after ten identical samples', () => {
    let s = run(calm(), 3);
    s = applyWindCommand(s, { type: 'sensor-fault', id: 'WS2', fault: 'frozen' });
    s = run(s, 12);
    expect(s.sensors[1].status).toBe('FROZEN');
    expect(s.alarms).toContain('WIND_FROZEN:WS2');
  });
  it('flags disagreement and uses the windward sensor', () => {
    let s = run(calm(), 3, input({ mean: { speedKn: 20, fromDeg: 270 } }));
    // Wind from port: WS2 (starboard) is leeward; give the windward WS1 a direction bias instead.
    s = applyWindCommand(s, { type: 'sensor-fault', id: 'WS2', fault: 'bias' });
    s = run(s, 7, input({ mean: { speedKn: 20, fromDeg: 270 } }));
    expect(s.output.disagreement).toBe(true);
    expect(s.alarms).toContain('WIND_DISAGREE');
    expect(s.output.source).toBe('WS1');
  });
  it('an unpowered sensor reports no power; with none valid the output is invalid', () => {
    let s = run(calm(), 3, input({ powered: { WS1: false, WS2: true } }));
    expect(s.sensors[0].status).toBe('NO POWER');
    s = run(s, 1, input({ powered: { WS1: false, WS2: false } }));
    expect(s.output.valid).toBe(false);
    expect(s.alarms).toContain('WIND_ALL_FAIL');
  });
  it('true wind needs a valid heading', () => {
    const s = run(calm(), 3, input({ psiMeas: null }));
    expect(s.output.trueAvailable).toBe(false);
    expect(s.output.trueSpeedKn).toBeNull();
    const t = run(calm(), 3, input({ psi: 0.4, psiMeas: 0.4, mean: { speedKn: 20, fromDeg: 120 } }));
    expect(t.output.trueFromDeg!).toBeGreaterThan(110);
    expect(t.output.trueFromDeg!).toBeLessThan(130);
  });
  it('honours an operator selection and falls back when the selected sensor is invalid', () => {
    let s = applyWindCommand(calm(), { type: 'select', selection: 'WS1' });
    s = run(s, 3);
    expect(s.output.source).toBe('WS1');
    s = applyWindCommand(s, { type: 'sensor-fault', id: 'WS1', fault: 'fail' });
    s = run(s, 12);
    expect(s.output.source).toBe('WS2');
    expect(s.alarms).toContain('WIND_SELECTED_INVALID:WS1');
  });
});

describe('physical wind vs measurement in the DP force model', () => {
  it('environment force uses the apparent wind (vessel speed matters)', () => {
    const still = environmentForces({ eta: [0, 0, 0], nu: [0, 0, 0], wind: { speedKn: 20, fromDeg: 0 }, current: { speedKn: 0, toDeg: 0 } });
    const ahead = environmentForces({ eta: [0, 0, 0], nu: [2, 0, 0], wind: { speedKn: 20, fromDeg: 0 }, current: { speedKn: 0, toDeg: 0 } });
    expect(ahead[0]).toBeLessThan(still[0] * 1.2 - 1); // more head wind when steaming into it
  });
});
