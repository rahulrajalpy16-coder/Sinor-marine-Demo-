/**
 * Physical wind and the vessel's wind sensors: an engineering demonstration model.
 *
 * Two separate things are modelled and never mixed:
 *  - PHYSICAL WIND (truth): the operator's mean wind plus seeded gusts. It acts on the hull through the DP model's
 *    wind force whatever the sensors say. A failed sensor never removes it.
 *  - MEASURED WIND: what each anemometer reports (apparent wind at the sensor, with mast shadow, exhaust
 *    turbulence, noise, faults, update rate and time stamps). DP uses only this for wind feed-forward.
 *
 * Conventions: speeds in knots; directions in degrees. "fromDeg" is the direction the wind comes FROM (meteorological
 * convention), true (earth) directions clockwise from north; relative directions clockwise from the bow
 * (0 = on the bow, 90 = from starboard). Vessel body frame: x forward, y starboard. Apparent (relative) wind is the
 * air velocity seen on board = true wind − vessel velocity. True wind can only be derived when a valid heading and
 * vessel velocity are available; otherwise it is flagged unavailable.
 *
 * Gusts: first-order Gauss–Markov process per speed and direction, discretised exactly so the statistics do not
 * depend on the step size; mulberry32 seeded random numbers make every run reproducible.
 * Sensor characteristics are GENERIC (2-axis ultrasonic anemometer class, NMEA 0183 MWV at 1 Hz); the vessel's
 * actual wind sensor make and model were not supplied.
 */

import { LEVEL, MAST } from '../vessels/vesselLayout';

/** Wind sensor cross-arm near the mast top (the yardarm ends carry the GNSS antennas). */
export const WIND_ARM = { y: LEVEL.mastTop - 0.7, half: 1.0 } as const;

export type WindSensorId = 'WS1' | 'WS2';
export type WindFault = null | 'fail' | 'comms' | 'frozen' | 'bias';
export type WindSelection = 'AUTO' | WindSensorId;

const KN = 0.514444;
const DEG = Math.PI / 180;
const norm360 = (d: number) => ((d % 360) + 360) % 360;
/** Smallest signed angle a − b, degrees (−180…180]. */
export const angDiff = (a: number, b: number) => {
  const d = norm360(a - b);
  return d > 180 ? d - 360 : d;
};
const inRange = (rel: number, [lo, hi]: [number, number]) => {
  const r = norm360(rel);
  return lo <= hi ? r >= lo && r <= hi : r >= lo || r <= hi;
};

export const WIND_CONFIG = {
  sensors: [
    // Port and starboard ends of a cross-arm near the mast top: one of the two always sees undisturbed flow.
    { id: 'WS1' as WindSensorId, label: 'Wind sensor 1 · port mast arm', pos: [-WIND_ARM.half + 0.05, WIND_ARM.y + 0.4, MAST.z] as [number, number, number], shadowRel: [40, 140] as [number, number] },
    { id: 'WS2' as WindSensorId, label: 'Wind sensor 2 · stbd mast arm', pos: [WIND_ARM.half - 0.05, WIND_ARM.y + 0.4, MAST.z] as [number, number, number], shadowRel: [220, 320] as [number, number] },
  ],
  /** Mast wake on the leeward sensor: speed deficit and direction error (demonstration values). */
  shadowSpeedFactor: 0.8,
  shadowDirErrDeg: 8,
  /** Wind from astern carries the exhaust plume from the uptakes aft of the mast over the sensors. */
  exhaustRel: [160, 200] as [number, number],
  exhaustNoiseKn: 2,
  noiseKn: 0.3,
  noiseDeg: 2,
  rateHz: 1,
  staleS: 3,
  frozenSamples: 10,
  disagreeKn: 3,
  disagreePct: 20,
  disagreeDeg: 20,
  disagreeS: 5,
  gustTauS: 20,
  dirGustDegPer10Pct: 4,
  biasDeg: 40,
  maxKn: 117,
};

export interface WindSensor {
  id: WindSensorId;
  fault: WindFault;
  powered: boolean;
  /** Simulated time of the last message received (null = never). */
  lastMsgT: number | null;
  relSpeedKn: number;
  relFromDeg: number;
  history: number[];
  shadowed: boolean;
  exhaust: boolean;
  valid: boolean;
  status: 'OK' | 'NO POWER' | 'NO DATA' | 'STALE' | 'FROZEN';
}

export interface WindOutput {
  valid: boolean;
  source: 'WS1' | 'WS2' | 'AVG' | null;
  relSpeedKn: number;
  relFromDeg: number;
  trueAvailable: boolean;
  trueSpeedKn: number | null;
  trueFromDeg: number | null;
  disagreement: boolean;
}

export interface WindState {
  time: number;
  gustPct: number;
  gust: { speed: number; dir: number };
  /** Random streams: gusts and sensor noise are separate, so sensor faults never change the physical wind. */
  seed: number;
  sensorSeed: number;
  /** Physical (true) wind acting on the vessel now. */
  actual: { speedKn: number; fromDeg: number };
  /** Apparent wind at the vessel (truth, for display and checks). */
  apparent: { speedKn: number; relFromDeg: number };
  sensors: WindSensor[];
  selection: WindSelection;
  disagreeS: number;
  output: WindOutput;
  alarms: string[];
  acknowledged: string[];
}

export function initialWindState(seed = 20261023): WindState {
  return {
    time: 0,
    gustPct: 10,
    gust: { speed: 0, dir: 0 },
    seed,
    sensorSeed: seed ^ 0x5a5a5a5a,
    actual: { speedKn: 0, fromDeg: 0 },
    apparent: { speedKn: 0, relFromDeg: 0 },
    sensors: WIND_CONFIG.sensors.map((c) => ({
      id: c.id,
      fault: null,
      powered: true,
      lastMsgT: null,
      relSpeedKn: 0,
      relFromDeg: 0,
      history: [],
      shadowed: false,
      exhaust: false,
      valid: false,
      status: 'NO DATA',
    })),
    selection: 'AUTO',
    disagreeS: 0,
    output: { valid: false, source: null, relSpeedKn: 0, relFromDeg: 0, trueAvailable: false, trueSpeedKn: null, trueFromDeg: null, disagreement: false },
    alarms: [],
    acknowledged: [],
  };
}

function rng(s: { seed: number }) {
  let t = (s.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(s: { seed: number }) {
  const u = Math.max(1e-12, rng(s));
  const v = rng(s);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Apparent wind seen on board from the true wind, heading psi (rad) and body velocity nu (m/s). */
export function apparentWind(trueSpeedKn: number, trueFromDeg: number, psi: number, nu: [number, number, number] | [number, number]) {
  const V = trueSpeedKn * KN;
  const f = trueFromDeg * DEG;
  const n = -V * Math.cos(f);
  const e = -V * Math.sin(f);
  const bx = Math.cos(psi) * n + Math.sin(psi) * e - nu[0];
  const by = -Math.sin(psi) * n + Math.cos(psi) * e - nu[1];
  return { speedKn: Math.hypot(bx, by) / KN, relFromDeg: norm360(Math.atan2(-by, -bx) / DEG) };
}

/** True wind from the apparent wind, heading and body velocity (exact inverse of apparentWind). */
export function trueFromApparent(relSpeedKn: number, relFromDeg: number, psi: number, nu: [number, number, number] | [number, number]) {
  const S = relSpeedKn * KN;
  const g = relFromDeg * DEG;
  const bx = -S * Math.cos(g) + nu[0];
  const by = -S * Math.sin(g) + nu[1];
  const n = Math.cos(psi) * bx - Math.sin(psi) * by;
  const e = Math.sin(psi) * bx + Math.cos(psi) * by;
  return { speedKn: Math.hypot(n, e) / KN, fromDeg: norm360(Math.atan2(-e, -n) / DEG) };
}

export interface WindStepInput {
  mean: { speedKn: number; fromDeg: number };
  /** True heading, rad (physics). */
  psi: number;
  /** Measured heading used to derive true wind, rad, or null when no valid heading reference. */
  psiMeas: number | null;
  nu: [number, number, number];
  powered: Partial<Record<WindSensorId, boolean>>;
}

function setAlarm(s: WindState, code: string, on: boolean) {
  const has = s.alarms.includes(code);
  if (on && !has) s.alarms = [...s.alarms, code];
  if (!on && has) {
    s.alarms = s.alarms.filter((a) => a !== code);
    s.acknowledged = s.acknowledged.filter((a) => a !== code);
  }
}

export const WIND_ALARM_TEXT = (code: string) => {
  const [k, o] = code.split(':');
  return (
    {
      WIND_NO_DATA: `${o}: no data (sensor or communication failure)`,
      WIND_STALE: `${o}: data stale`,
      WIND_FROZEN: `${o}: output frozen, rejected`,
      WIND_NO_POWER: `${o}: no power`,
      WIND_DISAGREE: 'Wind sensors disagree: windward sensor used',
      WIND_ALL_FAIL: 'No valid wind sensor: DP wind feed-forward OFF (physical wind still acts)',
      WIND_SELECTED_INVALID: `Selected ${o} invalid: using the other sensor`,
      TRUE_WIND_UNAVAILABLE: 'True wind unavailable: no valid heading',
    } as Record<string, string>
  )[k] ?? code;
};

/** Advance gusts and the sensors by dt seconds. Pure. */
export function stepWind(prev: WindState, dt: number, input: WindStepInput): WindState {
  if (!(dt > 0)) return prev;
  const s: WindState = { ...prev, sensors: prev.sensors.map((x) => ({ ...x, history: [...x.history] })), time: prev.time + dt };
  const C = WIND_CONFIG;
  const r = { seed: s.seed };
  // Gusts (exact discretisation of a first-order Gauss–Markov process).
  const a = Math.exp(-dt / C.gustTauS);
  const b = Math.sqrt(1 - a * a);
  const sig = s.gustPct / 100;
  const sigDir = (s.gustPct / 10) * C.dirGustDegPer10Pct;
  s.gust = { speed: s.gust.speed * a + sig * b * gauss(r), dir: s.gust.dir * a + sigDir * b * gauss(r) };
  const speed = Math.max(0, Math.min(C.maxKn, input.mean.speedKn * (1 + s.gust.speed)));
  s.actual = { speedKn: speed, fromDeg: norm360(input.mean.fromDeg + s.gust.dir) };
  s.apparent = (({ speedKn, relFromDeg }) => ({ speedKn, relFromDeg }))(apparentWind(speed, s.actual.fromDeg, input.psi, input.nu));

  s.seed = r.seed;
  const rs = { seed: s.sensorSeed };
  // Sensors sample at their output rate.
  const sample = Math.floor(s.time * C.rateHz) !== Math.floor(prev.time * C.rateHz);
  s.sensors = s.sensors.map((sen, i) => {
    const cfg = C.sensors[i];
    const x = { ...sen, powered: input.powered[sen.id] ?? true };
    x.shadowed = inRange(s.apparent.relFromDeg, cfg.shadowRel);
    x.exhaust = inRange(s.apparent.relFromDeg, C.exhaustRel);
    const transmitting = x.powered && x.fault !== 'fail' && x.fault !== 'comms';
    if (sample && transmitting) {
      if (x.fault !== 'frozen' || x.lastMsgT === null) {
        let sp = s.apparent.speedKn * (x.shadowed ? C.shadowSpeedFactor : 1);
        let dir = s.apparent.relFromDeg + (x.shadowed ? C.shadowDirErrDeg : 0) + (x.fault === 'bias' ? C.biasDeg : 0);
        sp += C.noiseKn * gauss(rs) + (x.exhaust ? C.exhaustNoiseKn * gauss(rs) : 0);
        dir += C.noiseDeg * gauss(rs) + (x.exhaust ? 6 * gauss(rs) : 0);
        x.relSpeedKn = Math.max(0, Math.round(sp * 10) / 10);
        x.relFromDeg = norm360(Math.round(dir));
      }
      x.lastMsgT = s.time;
      x.history = [...x.history.slice(-(C.frozenSamples - 1)), x.relSpeedKn * 1000 + x.relFromDeg];
    }
    const age = x.lastMsgT === null ? Infinity : s.time - x.lastMsgT;
    const frozen = x.history.length >= C.frozenSamples && x.history.every((h) => h === x.history[0]);
    x.status = !x.powered ? 'NO POWER' : x.lastMsgT === null || age > C.staleS * 3 ? 'NO DATA' : age > C.staleS ? 'STALE' : frozen ? 'FROZEN' : 'OK';
    x.valid = x.status === 'OK';
    return x;
  });
  s.sensorSeed = rs.seed;
  s.sensors.forEach((x) => {
    setAlarm(s, `WIND_NO_POWER:${x.id}`, x.status === 'NO POWER');
    setAlarm(s, `WIND_NO_DATA:${x.id}`, x.status === 'NO DATA');
    setAlarm(s, `WIND_STALE:${x.id}`, x.status === 'STALE');
    setAlarm(s, `WIND_FROZEN:${x.id}`, x.status === 'FROZEN');
  });

  // Comparison and selection.
  const valid = s.sensors.filter((x) => x.valid);
  let disagree = false;
  if (valid.length === 2) {
    const [p, q] = valid;
    const meanSp = (p.relSpeedKn + q.relSpeedKn) / 2;
    disagree =
      Math.abs(p.relSpeedKn - q.relSpeedKn) > Math.max(C.disagreeKn, (C.disagreePct / 100) * meanSp) ||
      (meanSp > 3 && Math.abs(angDiff(p.relFromDeg, q.relFromDeg)) > C.disagreeDeg);
  }
  s.disagreeS = disagree ? s.disagreeS + dt : 0;
  const disagreement = s.disagreeS >= C.disagreeS;
  setAlarm(s, 'WIND_DISAGREE', disagreement);
  let chosen: WindSensor[] = [];
  let source: WindOutput['source'] = null;
  const selected = s.selection !== 'AUTO' ? s.sensors.find((x) => x.id === s.selection)! : null;
  setAlarm(s, `WIND_SELECTED_INVALID:${s.selection}`, !!selected && !selected.valid && valid.length > 0);
  s.alarms
    .filter((x) => x.startsWith('WIND_SELECTED_INVALID:') && x !== `WIND_SELECTED_INVALID:${s.selection}`)
    .forEach((x) => setAlarm(s, x, false));
  if (selected && selected.valid) {
    chosen = [selected];
    source = selected.id;
  } else if (valid.length === 2 && !disagreement && s.selection === 'AUTO') {
    chosen = valid;
    source = 'AVG';
  } else if (valid.length === 2) {
    // Disagreement: the windward sensor (outside the mast wake) is trusted.
    const ww = valid.find((x) => !x.shadowed) ?? valid[0];
    chosen = [ww];
    source = ww.id;
  } else if (valid.length === 1) {
    chosen = valid;
    source = valid[0].id;
  }
  setAlarm(s, 'WIND_ALL_FAIL', chosen.length === 0);
  let relSpeedKn = 0;
  let relFromDeg = 0;
  if (chosen.length) {
    // Vector average of the chosen sensors.
    const vx = chosen.reduce((acc, x) => acc + x.relSpeedKn * Math.cos(x.relFromDeg * DEG), 0) / chosen.length;
    const vy = chosen.reduce((acc, x) => acc + x.relSpeedKn * Math.sin(x.relFromDeg * DEG), 0) / chosen.length;
    relSpeedKn = Math.hypot(vx, vy);
    relFromDeg = norm360(Math.atan2(vy, vx) / DEG);
  }
  const trueAvailable = chosen.length > 0 && input.psiMeas !== null;
  setAlarm(s, 'TRUE_WIND_UNAVAILABLE', chosen.length > 0 && input.psiMeas === null);
  const tw = trueAvailable ? trueFromApparent(relSpeedKn, relFromDeg, input.psiMeas!, input.nu) : null;
  s.output = {
    valid: chosen.length > 0,
    source,
    relSpeedKn,
    relFromDeg,
    trueAvailable,
    trueSpeedKn: tw ? tw.speedKn : null,
    trueFromDeg: tw ? tw.fromDeg : null,
    disagreement,
  };
  s.acknowledged = s.acknowledged.filter((x) => s.alarms.includes(x));
  return s;
}

export type WindCommand =
  | { type: 'set-gust'; pct: unknown }
  | { type: 'sensor-fault'; id: WindSensorId; fault: WindFault }
  | { type: 'select'; selection: WindSelection }
  | { type: 'acknowledge' }
  | { type: 'reset' };

export function applyWindCommand(s: WindState, cmd: WindCommand): WindState {
  switch (cmd.type) {
    case 'set-gust': {
      const v = Number(cmd.pct);
      if (!Number.isFinite(v)) throw new Error('Gust intensity must be a number');
      return { ...s, gustPct: Math.max(0, Math.min(40, v)) };
    }
    case 'sensor-fault':
      return { ...s, sensors: s.sensors.map((x) => (x.id === cmd.id ? { ...x, fault: cmd.fault, history: [] } : x)) };
    case 'select':
      return { ...s, selection: cmd.selection };
    case 'acknowledge':
      return { ...s, acknowledged: [...s.alarms] };
    case 'reset':
      return { ...initialWindState(), gustPct: s.gustPct };
    default:
      return s;
  }
}
