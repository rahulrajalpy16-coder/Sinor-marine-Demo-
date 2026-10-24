import { runScenario, type ScenarioOptions } from './vesselCore';

/**
 * Reference scenario for the online/offline consistency check (test H): DP on station in a gusty beam wind,
 * G1 trips at 60 s and its breaker is reset at 200 s, with a wind sensor failure at 120 s. Every build runs this
 * same input through the same core; the summaries must agree within the declared tolerance.
 */
export const CONSISTENCY_SCENARIO: ScenarioOptions = {
  seconds: 300,
  seed: 4242,
  dpClass: 2,
  arrangement: 'two-per-bus',
  wind: { speedKn: 28, fromDeg: 80 },
  current: { speedKn: 1.2, toDeg: 200 },
  gustPct: 15,
  sampleEvery: 5,
  events: [
    { t: 60, power: { type: 'gen-trip', id: 'G1' } },
    { t: 120, wind: { type: 'sensor-fault', id: 'WS2', fault: 'fail' } },
    { t: 200, power: { type: 'gen-reset', id: 'G1' } },
  ],
};

/** Declared tolerance for comparing builds: absolute, per sampled value. */
export const CONSISTENCY_TOLERANCE = 1e-6;

export function consistencyRun() {
  const r = runScenario(CONSISTENCY_SCENARIO);
  return {
    samples: r.samples,
    events: r.final.power.events.map((e) => `${e.t.toFixed(2)} ${e.sev} ${e.text}`),
    dpAlarms: r.final.dp.alarms,
    gens: r.final.power.gens.map((g) => `${g.id}:${g.state}`),
  };
}
