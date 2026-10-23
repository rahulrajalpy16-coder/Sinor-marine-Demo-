import { runScenario, type ScenarioResult } from './vesselCore';

const at = (r: ScenarioResult, t: number) => r.samples.find((s) => s.t >= t)!;
const maxErr = (r: ScenarioResult, t0: number, t1: number) => Math.max(...r.samples.filter((s) => s.t >= t0 && s.t <= t1).map((s) => s.posErr));

describe('integrated generator failure during DP', () => {
  it('manageable: G1 trips with two sets per bus; G2 takes the load, position is held, recovery obeys interlocks', () => {
    const r = runScenario({
      seconds: 420,
      arrangement: 'two-per-bus',
      wind: { speedKn: 25, fromDeg: 45 },
      current: { speedKn: 1, toDeg: 270 },
      events: [
        { t: 240, power: { type: 'gen-trip', id: 'G1' } },
        { t: 300, power: { type: 'gen-reset', id: 'G1' } },
        { t: 301, power: { type: 'gen-start', id: 'G1' } },
        { t: 312, power: { type: 'gen-sync-close', id: 'G1' } },
      ],
    });
    expect(maxErr(r, 120, 240)).toBeLessThan(3);
    const p = r.final.power;
    // Recalculated generation and reserve right after the trip.
    expect(at(r, 241).reserveKW).toBeLessThan(at(r, 239).reserveKW);
    expect(maxErr(r, 240, 420)).toBeLessThan(3);
    // Event order: trip → (no blackout on section A) → G1 back by synchronised closing.
    const texts = p.events.map((e) => e.text);
    expect(texts.some((t) => /Blackout/.test(t))).toBe(false);
    const iTrip = texts.findIndex((t) => /G1 tripped/.test(t));
    const iSync = texts.findIndex((t) => /G1 breaker closed \(synchronised\)/.test(t));
    expect(iTrip).toBeGreaterThanOrEqual(0);
    expect(iSync).toBeGreaterThan(iTrip);
    expect(p.gens.find((g) => g.id === 'G1')!.state).toBe('online');
    // Same state seen by DP: all thrusters available again.
    expect(r.final.dp.thrusters.every((t) => t.powered)).toBe(true);
  });

  it('one set per bus: the trip blacks out section A, group A thrusters drop, DP holds on group B, then recovers', () => {
    const r = runScenario({ seconds: 360, wind: { speedKn: 20, fromDeg: 45 }, current: { speedKn: 1, toDeg: 270 }, events: [{ t: 200, power: { type: 'gen-trip', id: 'G1' } }] });
    const s = r.final;
    const blackout = s.power.events.find((e) => /Blackout: Main switchboard A/.test(e.text))!;
    expect(blackout.t).toBeGreaterThan(200);
    expect(blackout.t).toBeLessThan(202);
    const restored = s.power.events.find((e) => /recovery complete on MSB_A/.test(e.text))!;
    expect(restored.t - blackout.t).toBeLessThan(60);
    expect(maxErr(r, 200, 360)).toBeLessThan(6);
    expect(s.dp.thrusters.find((t) => t.id === 'AZ1')!.powered).toBe(true);
    expect(s.power.gens.find((g) => g.id === 'G2')!.state).toBe('online');
  });

  it('insufficient capability: losing switchboard A in a strong beam wind and current, the vessel drifts off', () => {
    const base = { seconds: 600, wind: { speedKn: 35, fromDeg: 90 }, current: { speedKn: 1.5, toDeg: 270 } } as const;
    const ok = runScenario(base);
    expect(maxErr(ok, 200, 600)).toBeLessThan(5);
    // Bus fault: section A locked out, no recovery possible; G2 cannot close on to a faulted bus.
    const r = runScenario({ ...base, events: [{ t: 200, power: { type: 'bus-fault', bus: 'MSB_A' } }] });
    expect(r.final.dp.alarms).toContain('THRUSTER_NO_POWER');
    expect(at(r, 590).posErr).toBeGreaterThan(20);
    // The error keeps growing: the vessel is not artificially held.
    expect(at(r, 590).posErr).toBeGreaterThan(at(r, 400).posErr);
    // Before the failure the simplified worst-case check had already warned.
    expect(ok.final.dp.consequence.groupOk).toBe(false);
  });
});

describe('UPS consequences for DP', () => {
  it('UPS A depletion with input and bypass dead removes controller A, DGPS 1, gyro 1 and the group A thrusters', () => {
    const r = runScenario({
      seconds: 900,
      wind: { speedKn: 15, fromDeg: 30 },
      events: [
        { t: 10, power: { type: 'ups-soh', id: 'UPS_A', value: 0.1 } },
        { t: 20, power: { type: 'ups-selector', id: 'UPS_A', selector: 'EMERG' } },
        { t: 21, power: { type: 'tie-trip', id: 'ESB_FEED' } },
        { t: 21, power: { type: 'gen-mode', id: 'EG', mode: 'MANUAL' } },
      ],
    });
    const { dp, power } = r.final;
    expect(power.ups[0].mode).toBe('off');
    expect(dp.controllers.find((c) => c.id === 'A')!.powered).toBe(false);
    expect(dp.controllers.find((c) => c.id === 'C')!.powered).toBe(true);
    expect(dp.refs.find((x) => x.id === 'GNSS1')!.powered).toBe(false);
    expect(dp.sensors.find((x) => x.id === 'GYRO1')!.powered).toBe(false);
    expect(dp.thrusters.find((t) => t.id === 'AZ1')!.powered).toBe(false);
    expect(dp.thrusters.find((t) => t.id === 'AZ2')!.powered).toBe(true);
    expect(dp.alarms).toContain('THRUSTER_NO_POWER');
    // Still on DP with group B, two controllers and two gyros.
    expect(dp.dpLost).toBe(false);
    expect(maxErr(r, 600, 900)).toBeLessThan(5);
  });
});

describe('wind and sensors in the coupled core', () => {
  it('failing both wind sensors removes feed-forward but not the wind force', () => {
    const base = { seconds: 300, wind: { speedKn: 30, fromDeg: 60 }, gustPct: 10, seed: 11 } as const;
    const a = runScenario(base);
    const b = runScenario({ ...base, events: [{ t: 100, wind: { type: 'sensor-fault', id: 'WS1', fault: 'fail' } }, { t: 100, wind: { type: 'sensor-fault', id: 'WS2', fault: 'fail' } }] });
    expect(b.final.wind.actual).toEqual(a.final.wind.actual);
    expect(Math.abs(b.final.dp.tauEnv[1])).toBeGreaterThan(20e3);
    expect(b.final.dp.windFF.valid).toBe(false);
    expect(b.final.dp.alarms).toContain('WIND_FF_OFF');
    // Feedback alone still holds position in this moderate case, a little less tightly.
    expect(maxErr(b, 150, 300)).toBeLessThan(5);
  });

  it('wind changes never move the heading setpoint', () => {
    const r = runScenario({ seconds: 300, events: [{ t: 60, dp: { type: 'set-wind', speedKn: 40, fromDeg: 200 } }] });
    expect(r.final.dp.setpoint[2]).toBe(0);
    expect(Math.abs(r.final.dp.eta[2] * 57.3)).toBeLessThan(3);
  });

  it('a drifting gyro is voted out by the other two', () => {
    const r = runScenario({ seconds: 400, events: [{ t: 30, dp: { type: 'sensor-fault', id: 'GYRO2', fault: 'drift' } }] });
    expect(r.final.dp.sensors.find((x) => x.id === 'GYRO2')!.rejected).toBe(true);
    expect(r.final.dp.alarms).toContain('GYRO_REJECTED');
    expect(Math.abs(r.final.dp.eta[2] * 57.3)).toBeLessThan(1.5);
  });

  it('all gyros lost: automatic DP is lost', () => {
    const r = runScenario({
      seconds: 60,
      events: (['GYRO1', 'GYRO2', 'GYRO3'] as const).map((id) => ({ t: 20, dp: { type: 'sensor-fault' as const, id, fault: 'fail' as const } })),
    });
    expect(r.final.dp.dpLost).toBe(true);
    expect(r.final.dp.alarms).toContain('NO_HEADING_REF');
  });
});

describe('determinism', () => {
  it('identical inputs and seed give identical histories', () => {
    const o = { seconds: 200, seed: 99, gustPct: 20, wind: { speedKn: 30, fromDeg: 120 }, events: [{ t: 100, power: { type: 'gen-trip' as const, id: 'G3' as const } }] };
    expect(runScenario(o).samples).toEqual(runScenario(o).samples);
  });
});
