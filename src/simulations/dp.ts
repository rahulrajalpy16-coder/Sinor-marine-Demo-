/**
 * Dynamic positioning: illustrative, non-certified educational 3-DOF model.
 *
 * Coordinates: NED plane. eta = [north m, east m, heading rad (clockwise from north)],
 * nu = [surge m/s, sway m/s (+ starboard), yaw rate rad/s]. Scene mapping: X = east, Z = north,
 * rotation.y = heading, inside the reflected world group (see scene/vesselTransform.ts).
 *   eta_dot = R(psi) nu
 *   M nu_dot + D_lin nu_r + D_quad(nu_r) = tau_thrusters + tau_wind      (nu_r = nu - current)
 * Control: PID on the body-frame position/heading error with wind feed-forward, then weighted
 * least-squares thrust allocation over two P2 bow tunnel thrusters (BT1 is the modelled CPP unit with
 * its own Z-Thrust control; BT2 is a DP-only twin) and two stern azimuths, with saturation.
 * Redundancy follows the DP class architecture (DP1: 1 controller, 1 network; DP2: 3 controllers
 * with majority voting, dual network; DP3: as DP2 plus a backup station in an A60 room).
 * This is a teaching model; it does not imitate any proprietary DP algorithm.
 */

import { AZIMUTHS, BOW_THRUSTERS } from '../vessels/vesselLayout';
import { HPT5000_REPEATABILITY } from '../equipment/hprData';
import { CYSCAN, RADASCAN, SEASTAR, SMT_TW, SPRINTNAV } from '../equipment/posrefData';
import { HPR_NOMINAL_SLANT_M } from './acoustic';

export type DPClass = 1 | 2 | 3;
export type DPMode = 'STANDBY' | 'JOYSTICK' | 'AUTO_HEADING' | 'AUTO_POSITION';
export type DPStatus = 'stopped' | 'running' | 'paused';
export type ThrusterId = 'BT1' | 'BT2' | 'AZ1' | 'AZ2';
export type RefId = 'GNSS1' | 'GNSS2' | 'HPR' | 'RADASCAN' | 'CYSCAN' | 'TAUTWIRE' | 'SPRINTNAV';
/** Core references follow the DP class architecture; the others are fitted on every class and
 *  are selected into DP by the operator once the sensor is running (deployed, tracking, aligned). */
export const CORE_REFS: RefId[] = ['GNSS1', 'GNSS2', 'HPR'];
export const OPERATOR_REFS: RefId[] = ['RADASCAN', 'CYSCAN', 'TAUTWIRE', 'SPRINTNAV'];
export const REF_LABEL: Record<RefId, string> = {
  GNSS1: 'DGPS 1',
  GNSS2: 'DGPS 2',
  HPR: 'HPR',
  RADASCAN: 'RadaScan',
  CYSCAN: 'CyScan',
  TAUTWIRE: 'Taut wire',
  SPRINTNAV: 'SPRINT-Nav',
};
export type RefFault = 'lost' | 'drift';
export type ControllerId = 'A' | 'B' | 'C';
export type NetworkId = 'A' | 'B';
export type DPAlarm =
  | 'DP_LOST'
  | 'CONTROLLER_FAIL'
  | 'NO_REDUNDANCY'
  | 'NETWORK_FAIL'
  | 'REF_REJECTED'
  | 'REF_DEVIATION'
  | 'DEAD_RECKONING'
  | 'THRUSTER_FAIL'
  | 'BT1_NOT_AVAILABLE'
  | 'CONSEQUENCE'
  | 'POSITION_WARNING'
  | 'HEADING_WARNING'
  | 'BACKUP_IN_COMMAND'
  | 'HPR_NOT_DEPLOYED'
  | 'REF_NOT_READY';

export const DP_ALARM_TEXT: Record<DPAlarm, string> = {
  DP_LOST: 'DP lost: thrusters zeroed, vessel drifting',
  CONTROLLER_FAIL: 'DP controller failure',
  NO_REDUNDANCY: 'Single controller left: no redundancy',
  NETWORK_FAIL: 'DP network failure',
  REF_REJECTED: 'Position reference rejected',
  REF_DEVIATION: 'Position references disagree',
  DEAD_RECKONING: 'No position reference: dead reckoning',
  THRUSTER_FAIL: 'Thruster failure',
  BT1_NOT_AVAILABLE: 'BT1 not in DP command',
  CONSEQUENCE: 'Consequence analysis: worst single failure exceeds capability',
  POSITION_WARNING: 'Position error above warning limit',
  HEADING_WARNING: 'Heading error above warning limit',
  BACKUP_IN_COMMAND: 'Backup DP (A60 room) in command',
  HPR_NOT_DEPLOYED: 'HPR transceiver not deployed: reference unavailable',
  REF_NOT_READY: 'Selected position reference not ready (not deployed, tracking or aligned)',
};

export interface ThrusterGeom {
  id: ThrusterId;
  /** Body position: x forward, y starboard, metres. */
  x: number;
  y: number;
  maxN: number;
  azimuth: boolean;
}

export interface DPParams {
  /** Rigid body + added mass, kg / kg·m². */
  m: [number, number, number];
  dLin: [number, number, number];
  lengthM: number;
  windAreaFront: number;
  windAreaLateral: number;
  currentAreaFront: number;
  currentAreaLateral: number;
  thrusters: ThrusterGeom[];
  azimuthRateRadS: number;
  thrustTimeConstantS: number;
  /** Desired closed-loop natural frequency and damping. */
  omega: number;
  zeta: number;
  posWarnM: number;
  headWarnRad: number;
}

export const DEFAULT_DP_PARAMS: DPParams = {
  m: [7.4e6, 1.2e7, 4.0e9],
  dLin: [2e4, 6e4, 3e7],
  lengthM: 80,
  windAreaFront: 240,
  windAreaLateral: 700,
  currentAreaFront: 117,
  currentAreaLateral: 520,
  thrusters: [
    { id: 'BT1', x: BOW_THRUSTERS.bt1Z, y: 0, maxN: 105e3, azimuth: false },
    { id: 'BT2', x: BOW_THRUSTERS.bt2Z, y: 0, maxN: 105e3, azimuth: false },
    { id: 'AZ1', x: AZIMUTHS.z, y: -AZIMUTHS.x, maxN: 250e3, azimuth: true },
    { id: 'AZ2', x: AZIMUTHS.z, y: AZIMUTHS.x, maxN: 250e3, azimuth: true },
  ],
  azimuthRateRadS: (12 * Math.PI) / 180,
  thrustTimeConstantS: 2,
  omega: 0.05,
  zeta: 0.9,
  posWarnM: 3,
  headWarnRad: (3 * Math.PI) / 180,
};

const RHO_AIR = 1.225;
const RHO_WATER = 1025;
const KN = 0.514444;
const DEG = Math.PI / 180;
export const TRACK_POINTS = 120;

export interface ThrusterState {
  id: ThrusterId;
  failed: boolean;
  /** Can DP use it right now (healthy and, for BT1, in DP command and running). */
  available: boolean;
  /** Allocated force command, N (magnitude for azimuths, signed lateral for BT1). */
  cmdN: number;
  /** Delivered force, N. */
  forceN: number;
  /** Azimuth angle, rad (0 = thrust ahead, +90° = thrust to starboard). BT1 is fixed at +90°. */
  angle: number;
  cmdAngle: number;
}

export interface RefState {
  id: RefId;
  installed: boolean;
  enabled: boolean;
  fault: RefFault | null;
  /** Accumulated drift for a drifting reference, metres (north, east). */
  drift: [number, number];
  rejected: boolean;
  /** Physically able to measure (HPR: transceiver deployed through an open gate valve). */
  ready: boolean;
  /** Last measured position (north, east). */
  meas: [number, number];
}

export interface DPState {
  status: DPStatus;
  dpClass: DPClass;
  mode: DPMode;
  time: number;
  timeScale: number;
  eta: [number, number, number];
  nu: [number, number, number];
  /** Estimated position used by the controller (north, east). */
  est: [number, number];
  setpoint: [number, number, number];
  joystick: [number, number, number];
  wind: { speedKn: number; fromDeg: number };
  current: { speedKn: number; toDeg: number };
  integral: [number, number, number];
  thrusters: ThrusterState[];
  refs: RefState[];
  controllers: { id: ControllerId; installed: boolean; failed: boolean }[];
  networks: { id: NetworkId; installed: boolean; failed: boolean }[];
  /** DP3 only: fire / flooding in the bridge compartment. */
  bridgeCompartmentLost: boolean;
  dpLost: boolean;
  tauCmd: [number, number, number];
  tauAchieved: [number, number, number];
  tauEnv: [number, number, number];
  consequence: { worst: ThrusterId | null; ok: boolean };
  alarms: DPAlarm[];
  acknowledged: DPAlarm[];
  track: [number, number][];
  /** Deterministic noise generator state. */
  seed: number;
}

/** Hardware fitted per class, after the datasheet architecture. */
export function classLayout(c: DPClass) {
  return {
    controllers: c === 1 ? 1 : 3,
    operatorStations: c === 1 ? 1 : c === 2 ? 2 : 3,
    networks: c === 1 ? 1 : 2,
    refs: (c === 1 ? ['GNSS1', 'HPR'] : ['GNSS1', 'GNSS2', 'HPR']) as RefId[],
    backupStation: c === 3,
  };
}

export function initialDPState(dpClass: DPClass = 2): DPState {
  const lay = classLayout(dpClass);
  return {
    status: 'stopped',
    dpClass,
    mode: 'STANDBY',
    time: 0,
    timeScale: 5,
    eta: [0, 0, 0],
    nu: [0, 0, 0],
    est: [0, 0],
    setpoint: [0, 0, 0],
    joystick: [0, 0, 0],
    wind: { speedKn: 20, fromDeg: 45 },
    current: { speedKn: 1, toDeg: 270 },
    integral: [0, 0, 0],
    thrusters: DEFAULT_DP_PARAMS.thrusters.map((t) => ({
      id: t.id,
      failed: false,
      available: t.id !== 'BT1',
      cmdN: 0,
      forceN: 0,
      angle: t.azimuth ? 0 : Math.PI / 2,
      cmdAngle: t.azimuth ? 0 : Math.PI / 2,
    })),
    refs: [...CORE_REFS, ...OPERATOR_REFS].map((id) => {
      const op = OPERATOR_REFS.includes(id);
      return {
        id,
        installed: op || lay.refs.includes(id),
        enabled: !op && lay.refs.includes(id),
        fault: null,
        drift: [0, 0] as [number, number],
        rejected: false,
        ready: !op,
        meas: [0, 0] as [number, number],
      };
    }),
    controllers: (['A', 'B', 'C'] as ControllerId[]).map((id, i) => ({ id, installed: i < lay.controllers, failed: false })),
    networks: (['A', 'B'] as NetworkId[]).map((id, i) => ({ id, installed: i < lay.networks, failed: false })),
    bridgeCompartmentLost: false,
    dpLost: false,
    tauCmd: [0, 0, 0],
    tauAchieved: [0, 0, 0],
    tauEnv: [0, 0, 0],
    consequence: { worst: null, ok: true },
    alarms: [],
    acknowledged: [],
    track: [],
    seed: 12345,
  };
}

export class InvalidDPInputError extends Error {}

export const wrapPi = (a: number) => {
  let x = (a + Math.PI) % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x - Math.PI;
};

function finite(v: unknown, name: string): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new InvalidDPInputError(`${name} must be a finite number`);
  return n;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Environmental forces in the body frame (N, N, N·m). */
export function environmentForces(s: Pick<DPState, 'eta' | 'nu' | 'wind' | 'current'>, p: DPParams = DEFAULT_DP_PARAMS): [number, number, number] {
  const psi = s.eta[2];
  // Wind: gamma = direction the wind comes from, relative to the bow.
  const vw = s.wind.speedKn * KN;
  const g = wrapPi(s.wind.fromDeg * DEG - psi);
  const q = 0.5 * RHO_AIR * vw * vw;
  const Xw = -q * p.windAreaFront * 0.7 * Math.cos(g);
  const Yw = -q * p.windAreaLateral * 0.9 * Math.sin(g);
  const Nw = -q * p.windAreaLateral * p.lengthM * 0.05 * Math.sin(2 * g);
  // Current as quadratic drag on the relative velocity.
  const [uc, vc] = currentBody(s);
  const ur = s.nu[0] - uc;
  const vr = s.nu[1] - vc;
  const Xc = -0.5 * RHO_WATER * 0.6 * p.currentAreaFront * ur * Math.abs(ur);
  const Yc = -0.5 * RHO_WATER * 0.7 * p.currentAreaLateral * vr * Math.abs(vr);
  const gc = Math.atan2(vr, ur);
  const Vr2 = ur * ur + vr * vr;
  const Nc = -0.5 * RHO_WATER * p.currentAreaLateral * p.lengthM * 0.04 * Vr2 * Math.sin(2 * gc);
  return [Xw + Xc, Yw + Yc, Nw + Nc];
}

export function currentBody(s: Pick<DPState, 'eta' | 'current'>): [number, number] {
  const vc = s.current.speedKn * KN;
  const a = s.current.toDeg * DEG;
  const n = vc * Math.cos(a);
  const e = vc * Math.sin(a);
  const psi = s.eta[2];
  return [n * Math.cos(psi) + e * Math.sin(psi), -n * Math.sin(psi) + e * Math.cos(psi)];
}

/** Allocation matrix column for each force component: [BT1y, AZ1x, AZ1y, AZ2x, AZ2y]. */
function allocationColumns(p: DPParams) {
  const cols: { thr: number; comp: 'x' | 'y'; b: [number, number, number] }[] = [];
  p.thrusters.forEach((t, i) => {
    if (t.azimuth) cols.push({ thr: i, comp: 'x', b: [1, 0, -t.y] });
    cols.push({ thr: i, comp: 'y', b: [0, 1, t.x] });
  });
  return cols;
}

function solve3(A: number[][], b: number[]): number[] {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let k = c; k < 4; k++) M[c][k] /= d;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r) => r[3]);
}

export interface Allocation {
  /** Per thruster: force vector in body frame (fx, fy), after saturation. */
  forces: { id: ThrusterId; fx: number; fy: number }[];
  achieved: [number, number, number];
  saturated: boolean;
}

/**
 * Weighted least-squares allocation f = W⁻¹Bᵀ(BW⁻¹Bᵀ + εI)⁻¹τ, weights scaled by each thruster's
 * capacity so strong thrusters take more; unavailable thrusters get zero weight. Then saturate.
 */
export function allocate(tau: [number, number, number], available: Record<ThrusterId, boolean>, p: DPParams = DEFAULT_DP_PARAMS): Allocation {
  const cols = allocationColumns(p);
  const w = cols.map((c) => (available[p.thrusters[c.thr].id] ? p.thrusters[c.thr].maxN ** 2 : 0));
  // Scale moment row to forces so the regulariser treats rows evenly.
  const S = [1, 1, 1 / p.lengthM];
  const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => cols.reduce((acc, c, k) => acc + c.b[i] * S[i] * w[k] * c.b[j] * S[j], 0)));
  const scale = Math.max(1, ...w);
  for (let i = 0; i < 3; i++) A[i][i] += 1e-6 * scale;
  const y = solve3(A, tau.map((t, i) => t * S[i]));
  const f = cols.map((c, k) => w[k] * (c.b[0] * S[0] * y[0] + c.b[1] * S[1] * y[1] + c.b[2] * S[2] * y[2]));
  let saturated = false;
  const forces = p.thrusters.map((t, i) => {
    let fx = 0;
    let fy = 0;
    cols.forEach((c, k) => {
      if (c.thr !== i) return;
      if (c.comp === 'x') fx = f[k];
      else fy = f[k];
    });
    const mag = Math.hypot(fx, fy);
    if (mag > t.maxN) {
      saturated = true;
      fx *= t.maxN / mag;
      fy *= t.maxN / mag;
    }
    return { id: t.id, fx, fy };
  });
  const achieved: [number, number, number] = [0, 0, 0];
  forces.forEach((fr, i) => {
    const t = p.thrusters[i];
    achieved[0] += fr.fx;
    achieved[1] += fr.fy;
    achieved[2] += t.x * fr.fy - t.y * fr.fx;
  });
  return { forces, achieved, saturated };
}

/** Can the given thrusters hold against tau within 5 % on each axis? */
export function canHold(tau: [number, number, number], available: Record<ThrusterId, boolean>, p: DPParams = DEFAULT_DP_PARAMS) {
  const a = allocate(tau, available, p);
  const tolF = 5e3;
  return (
    Math.abs(a.achieved[0] - tau[0]) <= Math.max(tolF, 0.05 * Math.abs(tau[0])) &&
    Math.abs(a.achieved[1] - tau[1]) <= Math.max(tolF, 0.05 * Math.abs(tau[1])) &&
    Math.abs(a.achieved[2] - tau[2]) <= Math.max(tolF * p.lengthM, 0.05 * Math.abs(tau[2]))
  );
}

/** Worst-case single thruster failure against the current environment (+25 % margin). */
export function consequenceAnalysis(s: DPState, p: DPParams = DEFAULT_DP_PARAMS): DPState['consequence'] {
  const need: [number, number, number] = [-1.25 * s.tauEnv[0], -1.25 * s.tauEnv[1], -1.25 * s.tauEnv[2]];
  const avail = availability(s);
  for (const t of s.thrusters) {
    if (!avail[t.id]) continue;
    if (!canHold(need, { ...avail, [t.id]: false }, p)) return { worst: t.id, ok: false };
  }
  return { worst: null, ok: true };
}

export function availability(s: DPState): Record<ThrusterId, boolean> {
  return Object.fromEntries(s.thrusters.map((t) => [t.id, t.available && !t.failed])) as Record<ThrusterId, boolean>;
}

/** Is the DP control system itself able to run (controllers, networks, compartment)? */
export function controlIntegrity(s: DPState): { ok: boolean; healthyControllers: number; backup: boolean } {
  const ctrl = s.controllers.filter((c) => c.installed && !c.failed).length;
  const net = s.networks.filter((n) => n.installed && !n.failed).length;
  if (s.bridgeCompartmentLost) {
    // Only DP3 has an independent backup controller and station in a separate A60 compartment.
    return { ok: s.dpClass === 3, healthyControllers: s.dpClass === 3 ? 1 : 0, backup: s.dpClass === 3 };
  }
  return { ok: ctrl >= 1 && net >= 1, healthyControllers: ctrl, backup: false };
}

function rand(s: { seed: number }) {
  // Mulberry32: deterministic, so tests and replays are repeatable.
  let t = (s.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
}

// Measurement noise (1σ, m). DGPS: Fugro Seastar G4, 10 cm. HPR: HPT 5000 repeatability, 0.1 % of slant
// range (1 Drms, UM-8142 §12.1.3), at the scene's nominal slant range. The rest are illustrative (posrefData.ts).
export const REF_NOISE: Record<RefId, number> = {
  GNSS1: SEASTAR.accuracy.value,
  GNSS2: SEASTAR.accuracy.value,
  HPR: HPT5000_REPEATABILITY * HPR_NOMINAL_SLANT_M,
  RADASCAN: RADASCAN.accuracy.value,
  CYSCAN: CYSCAN.accuracy.value,
  TAUTWIRE: SMT_TW.accuracy.value,
  SPRINTNAV: SPRINTNAV.noise.value,
};
// SPRINT-Nav DP is DVL-aided inertial: its error grows slowly. Datasheet: < 3.2 m over 12 h (1DRMS).
const SPRINTNAV_DRIFT_RATE = SPRINTNAV.stationKeeping.value / (12 * 3600);
const DRIFT_RATE = 0.08; // m/s for a drifting reference
const REJECT_M = 3;

/** Measure, vote and blend position references. Returns updated refs and the blended fix (or null). */
export function processReferences(
  s: DPState,
  dt: number,
  readiness: Partial<Record<RefId, boolean>> | boolean = {},
): { refs: RefState[]; fix: [number, number] | null; deviation: boolean } {
  const ready: Partial<Record<RefId, boolean>> = typeof readiness === 'boolean' ? { HPR: readiness } : readiness;
  const noiseState = { seed: s.seed };
  const refs = s.refs.map((r) => {
    const rd = ready[r.id];
    if (rd !== undefined && r.ready !== rd) r = { ...r, ready: rd };
    if (!r.installed) return r;
    let drift: [number, number] = r.fault === 'drift' ? [r.drift[0] + DRIFT_RATE * dt * 0.8, r.drift[1] + DRIFT_RATE * dt * 0.6] : r.drift;
    if (r.id === 'SPRINTNAV' && r.ready) drift = [drift[0] + SPRINTNAV_DRIFT_RATE * dt * 0.6, drift[1] - SPRINTNAV_DRIFT_RATE * dt * 0.8];
    const n = REF_NOISE[r.id];
    const meas: [number, number] = [s.eta[0] + drift[0] + n * rand(noiseState), s.eta[1] + drift[1] + n * rand(noiseState)];
    return { ...r, drift, meas };
  });
  s.seed = noiseState.seed;
  const usable = refs.filter((r) => r.installed && r.enabled && r.ready && r.fault !== 'lost');
  const rejected = new Set<RefId>();
  let deviation = false;
  if (usable.length >= 3) {
    // Median voting: reject any reference far from the median of all.
    const med = (k: 0 | 1) => [...usable.map((r) => r.meas[k])].sort((a, b) => a - b)[Math.floor(usable.length / 2)];
    const m: [number, number] = [med(0), med(1)];
    usable.forEach((r) => {
      if (Math.hypot(r.meas[0] - m[0], r.meas[1] - m[1]) > REJECT_M) rejected.add(r.id);
    });
  } else if (usable.length === 2) {
    // Two references cannot tell which one is wrong: warn and average.
    deviation = Math.hypot(usable[0].meas[0] - usable[1].meas[0], usable[0].meas[1] - usable[1].meas[1]) > REJECT_M;
  }
  const accepted = usable.filter((r) => !rejected.has(r.id));
  const out = refs.map((r) => ({ ...r, rejected: rejected.has(r.id) || (r.installed && r.enabled && r.fault === 'lost') }));
  if (!accepted.length) return { refs: out, fix: null, deviation };
  const fix: [number, number] = [
    accepted.reduce((a, r) => a + r.meas[0], 0) / accepted.length,
    accepted.reduce((a, r) => a + r.meas[1], 0) / accepted.length,
  ];
  return { refs: out, fix, deviation };
}

export interface DPStepInput {
  /** Bow thruster as seen by DP: available when in DP command and running; force in N (+ starboard). */
  bt1: { available: boolean; forceN: number };
  /** HPR transceiver deployed and able to measure (Type 7950 state). Defaults to ready. */
  hpr?: { ready: boolean };
  /** Readiness of the other references (RadaScan, CyScan, taut wire, SPRINT-Nav). Unlisted keep their state. */
  ready?: Partial<Record<RefId, boolean>>;
}

export interface DPStepOutput {
  state: DPState;
  /** Lateral force DP asks BT1 for, N (0 when DP does not command it). */
  bt1CmdN: number;
}

function setAlarm(alarms: DPAlarm[], code: DPAlarm, on: boolean) {
  const has = alarms.includes(code);
  if (on && !has) alarms.push(code);
  if (!on && has) alarms.splice(alarms.indexOf(code), 1);
}

/** Advance the model by dt seconds of simulated time. Pure apart from the returned state. */
export function stepDP(prev: DPState, dt: number, input: DPStepInput, p: DPParams = DEFAULT_DP_PARAMS): DPStepOutput {
  if (!(dt > 0) || prev.status !== 'running') return { state: prev, bt1CmdN: 0 };
  const s: DPState = { ...prev, alarms: [...prev.alarms], thrusters: prev.thrusters.map((t) => ({ ...t })) };
  const [n, e, psi] = s.eta;
  const c = Math.cos(psi);
  const sn = Math.sin(psi);

  // Thruster availability (BT1 depends on the bow thruster's own control station and run state).
  s.thrusters.forEach((t) => {
    t.available = !t.failed && (t.id !== 'BT1' || input.bt1.available);
  });
  const integrity = controlIntegrity(s);
  s.dpLost = s.mode !== 'STANDBY' && s.mode !== 'JOYSTICK' && !integrity.ok;
  const joystickLost = s.mode === 'JOYSTICK' && !integrity.ok;

  // Position references and estimate.
  const refsOut = processReferences(s, dt, { HPR: input.hpr?.ready ?? true, ...input.ready });
  s.refs = refsOut.refs;
  if (refsOut.fix) {
    const k = Math.min(1, dt / 4);
    s.est = [s.est[0] + c * s.nu[0] * dt - sn * s.nu[1] * dt, s.est[1] + sn * s.nu[0] * dt + c * s.nu[1] * dt];
    s.est = [s.est[0] + (refsOut.fix[0] - s.est[0]) * k, s.est[1] + (refsOut.fix[1] - s.est[1]) * k];
  } else {
    // Dead reckoning: integrate the measured velocities; a small unmodelled bias makes the estimate drift.
    s.est = [s.est[0] + (c * s.nu[0] - sn * s.nu[1] + 0.03) * dt, s.est[1] + (sn * s.nu[0] + c * s.nu[1] + 0.02) * dt];
  }

  // Control law.
  const [m1, m2, m3] = p.m;
  const kp = [m1, m2, m3].map((m) => m * p.omega * p.omega);
  const kd = [m1, m2, m3].map((m, i) => Math.max(0, 2 * p.zeta * p.omega * m - p.dLin[i]));
  const ki = kp.map((k) => (k * p.omega) / 8);
  const tauEnv = environmentForces(s, p);
  s.tauEnv = tauEnv;
  // Wind feed-forward uses the wind sensor (wind part only, at zero vessel speed).
  const windOnly = environmentForces({ eta: s.eta, nu: [0, 0, 0], wind: s.wind, current: { speedKn: 0, toDeg: 0 } }, p);
  let tau: [number, number, number] = [0, 0, 0];
  const dn = s.est[0] - s.setpoint[0];
  const de = s.est[1] - s.setpoint[1];
  const ex = c * dn + sn * de;
  const ey = -sn * dn + c * de;
  const epsi = wrapPi(psi - s.setpoint[2]);
  const maxTau: [number, number, number] = [500e3, 500e3, 18e6];
  const autoPos = s.mode === 'AUTO_POSITION';
  const autoHead = s.mode === 'AUTO_POSITION' || s.mode === 'AUTO_HEADING';
  if (!s.dpLost && !joystickLost && s.mode !== 'STANDBY') {
    const err = [ex, ey, epsi];
    for (let i = 0; i < 3; i++) {
      const auto = i === 2 ? autoHead : autoPos;
      if (auto) {
        const integ = clamp(s.integral[i] + err[i] * dt, -maxTau[i] / Math.max(ki[i], 1e-9) / 2, maxTau[i] / Math.max(ki[i], 1e-9) / 2);
        s.integral = Object.assign([...s.integral], { [i]: integ }) as [number, number, number];
        tau[i] = -kp[i] * err[i] - kd[i] * s.nu[i] - ki[i] * integ - windOnly[i];
      } else {
        tau[i] = s.joystick[i] * maxTau[i];
      }
    }
    tau = tau.map((t, i) => clamp(t, -maxTau[i], maxTau[i])) as [number, number, number];
  } else {
    s.integral = [0, 0, 0];
  }
  s.tauCmd = tau;

  // Allocation (BT1 is excluded when it is not under DP command) and actuator dynamics.
  const avail = availability(s);
  const alloc = allocate(tau, avail, p);
  let bt1CmdN = 0;
  const kT = 1 - Math.exp(-dt / p.thrustTimeConstantS);
  s.thrusters.forEach((t, i) => {
    const g = p.thrusters[i];
    const f = alloc.forces[i];
    if (!g.azimuth) {
      t.cmdN = avail[t.id] ? f.fy : 0;
      if (t.id === 'BT1') {
        bt1CmdN = t.cmdN;
        t.forceN = input.bt1.available ? input.bt1.forceN : 0;
      } else {
        t.forceN += (t.cmdN - t.forceN) * kT;
      }
      return;
    }
    const mag = avail[t.id] ? Math.hypot(f.fx, f.fy) : 0;
    if (mag > 1e3) t.cmdAngle = Math.atan2(f.fy, f.fx);
    t.cmdN = mag;
    const dA = wrapPi(t.cmdAngle - t.angle);
    const maxStep = p.azimuthRateRadS * dt;
    t.angle = wrapPi(t.angle + clamp(dA, -maxStep, maxStep));
    // Thrust is held back while the unit is still slewing far from its commanded angle.
    const target = t.failed ? 0 : mag * Math.max(0, Math.cos(dA));
    t.forceN += (target - t.forceN) * kT;
  });

  // Delivered thrust in the body frame.
  const tauThr: [number, number, number] = [0, 0, 0];
  s.thrusters.forEach((t, i) => {
    const g = p.thrusters[i];
    const fx = t.forceN * Math.cos(t.angle);
    const fy = t.forceN * Math.sin(t.angle);
    tauThr[0] += fx;
    tauThr[1] += fy;
    tauThr[2] += g.x * fy - g.y * fx;
  });
  s.tauAchieved = tauThr;

  // Rigid-body integration (semi-implicit Euler, small fixed step from the stepper).
  const nu: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const acc = (tauThr[i] + tauEnv[i] - p.dLin[i] * (i === 2 ? s.nu[2] : s.nu[i] - currentBody(s)[i])) / p.m[i];
    nu[i] = s.nu[i] + acc * dt;
  }
  s.nu = nu;
  const c2 = Math.cos(psi);
  const s2 = Math.sin(psi);
  s.eta = [n + (c2 * nu[0] - s2 * nu[1]) * dt, e + (s2 * nu[0] + c2 * nu[1]) * dt, wrapPi(psi + nu[2] * dt)];
  s.time = prev.time + dt;

  // Track for the position plot, sampled about once a second.
  if (!s.track.length || Math.floor(s.time) !== Math.floor(prev.time)) {
    s.track = [...s.track.slice(-(TRACK_POINTS - 1)), [s.eta[0], s.eta[1]]];
  }

  // Alarms.
  const ctrlFailed = s.controllers.some((c) => c.installed && c.failed);
  setAlarm(s.alarms, 'DP_LOST', s.dpLost || joystickLost);
  setAlarm(s.alarms, 'CONTROLLER_FAIL', ctrlFailed);
  setAlarm(s.alarms, 'NO_REDUNDANCY', integrity.ok && !integrity.backup && s.dpClass > 1 && integrity.healthyControllers === 1);
  setAlarm(s.alarms, 'NETWORK_FAIL', s.networks.some((nw) => nw.installed && nw.failed));
  setAlarm(s.alarms, 'REF_REJECTED', s.refs.some((r) => r.rejected));
  setAlarm(s.alarms, 'REF_DEVIATION', refsOut.deviation);
  setAlarm(s.alarms, 'HPR_NOT_DEPLOYED', s.mode !== 'STANDBY' && s.refs.some((r) => r.id === 'HPR' && r.installed && r.enabled && !r.ready));
  setAlarm(s.alarms, 'REF_NOT_READY', s.mode !== 'STANDBY' && s.refs.some((r) => r.id !== 'HPR' && r.installed && r.enabled && !r.ready));
  setAlarm(s.alarms, 'DEAD_RECKONING', s.mode === 'AUTO_POSITION' && !refsOut.fix);
  setAlarm(s.alarms, 'THRUSTER_FAIL', s.thrusters.some((t) => t.failed));
  setAlarm(s.alarms, 'BT1_NOT_AVAILABLE', s.mode !== 'STANDBY' && !input.bt1.available && !s.thrusters[0].failed);
  setAlarm(s.alarms, 'BACKUP_IN_COMMAND', integrity.backup);
  const posErr = Math.hypot(s.eta[0] - s.setpoint[0], s.eta[1] - s.setpoint[1]);
  setAlarm(s.alarms, 'POSITION_WARNING', autoPos && posErr > p.posWarnM);
  setAlarm(s.alarms, 'HEADING_WARNING', autoHead && Math.abs(wrapPi(s.eta[2] - s.setpoint[2])) > p.headWarnRad);
  if (Math.floor(s.time) !== Math.floor(prev.time)) s.consequence = consequenceAnalysis(s, p);
  setAlarm(s.alarms, 'CONSEQUENCE', s.mode === 'AUTO_POSITION' && s.dpClass > 1 && !s.consequence.ok);
  s.acknowledged = s.acknowledged.filter((a) => s.alarms.includes(a));
  return { state: s, bt1CmdN };
}

export type DPCommand =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | { type: 'acknowledge' }
  | { type: 'set-class'; value: DPClass }
  | { type: 'set-mode'; mode: DPMode }
  | { type: 'set-setpoint'; north?: unknown; east?: unknown; headingDeg?: unknown }
  | { type: 'setpoint-here' }
  | { type: 'set-joystick'; surge?: unknown; sway?: unknown; yaw?: unknown }
  | { type: 'set-wind'; speedKn?: unknown; fromDeg?: unknown }
  | { type: 'set-current'; speedKn?: unknown; toDeg?: unknown }
  | { type: 'set-time-scale'; value: unknown }
  | { type: 'fail-thruster'; id: ThrusterId; failed: boolean }
  | { type: 'ref-fault'; id: RefId; fault: RefFault | null }
  | { type: 'ref-enable'; id: RefId; enabled: boolean }
  | { type: 'fail-controller'; id: ControllerId; failed: boolean }
  | { type: 'fail-network'; id: NetworkId; failed: boolean }
  | { type: 'bridge-compartment'; lost: boolean };

const norm360 = (d: number) => ((d % 360) + 360) % 360;

/** Operator commands. Out-of-range values are clamped; non-numbers throw InvalidDPInputError. */
export function applyDPCommand(s: DPState, cmd: DPCommand): DPState {
  switch (cmd.type) {
    case 'start':
      return s.status === 'stopped' ? { ...s, status: 'running', mode: s.mode === 'STANDBY' ? 'AUTO_POSITION' : s.mode } : s;
    case 'pause':
      return s.status === 'running' ? { ...s, status: 'paused' } : s;
    case 'resume':
      return s.status === 'paused' ? { ...s, status: 'running' } : s;
    case 'reset': {
      const fresh = initialDPState(s.dpClass);
      return { ...fresh, wind: s.wind, current: s.current, timeScale: s.timeScale };
    }
    case 'acknowledge':
      return { ...s, acknowledged: [...s.alarms] };
    case 'set-class': {
      if (![1, 2, 3].includes(cmd.value)) throw new InvalidDPInputError('DP class must be 1, 2 or 3');
      const fresh = initialDPState(cmd.value);
      return { ...fresh, wind: s.wind, current: s.current, timeScale: s.timeScale };
    }
    case 'set-mode': {
      // Entering an auto mode takes the present position/heading as the setpoint (bumpless transfer).
      let sp = s.setpoint;
      if (cmd.mode === 'AUTO_POSITION' && s.mode !== 'AUTO_POSITION') sp = [s.est[0], s.est[1], s.mode === 'AUTO_HEADING' ? s.setpoint[2] : s.eta[2]];
      if (cmd.mode === 'AUTO_HEADING' && s.mode !== 'AUTO_HEADING') sp = [s.setpoint[0], s.setpoint[1], s.eta[2]];
      return { ...s, mode: cmd.mode, setpoint: sp, integral: [0, 0, 0], joystick: [0, 0, 0] };
    }
    case 'set-setpoint': {
      const north = cmd.north === undefined ? s.setpoint[0] : clamp(finite(cmd.north, 'North'), -200, 200);
      const east = cmd.east === undefined ? s.setpoint[1] : clamp(finite(cmd.east, 'East'), -200, 200);
      const hd = cmd.headingDeg === undefined ? s.setpoint[2] : norm360(finite(cmd.headingDeg, 'Heading')) * DEG;
      return { ...s, setpoint: [north, east, wrapPi(hd)] };
    }
    case 'setpoint-here':
      return { ...s, setpoint: [s.est[0], s.est[1], s.eta[2]], integral: [0, 0, 0] };
    case 'set-joystick': {
      const j = [...s.joystick] as [number, number, number];
      if (cmd.surge !== undefined) j[0] = clamp(finite(cmd.surge, 'Surge'), -1, 1);
      if (cmd.sway !== undefined) j[1] = clamp(finite(cmd.sway, 'Sway'), -1, 1);
      if (cmd.yaw !== undefined) j[2] = clamp(finite(cmd.yaw, 'Yaw'), -1, 1);
      return { ...s, joystick: j };
    }
    case 'set-wind': {
      const speedKn = cmd.speedKn === undefined ? s.wind.speedKn : clamp(finite(cmd.speedKn, 'Wind speed'), 0, 60);
      const fromDeg = cmd.fromDeg === undefined ? s.wind.fromDeg : norm360(finite(cmd.fromDeg, 'Wind direction'));
      return { ...s, wind: { speedKn, fromDeg } };
    }
    case 'set-current': {
      const speedKn = cmd.speedKn === undefined ? s.current.speedKn : clamp(finite(cmd.speedKn, 'Current speed'), 0, 4);
      const toDeg = cmd.toDeg === undefined ? s.current.toDeg : norm360(finite(cmd.toDeg, 'Current direction'));
      return { ...s, current: { speedKn, toDeg } };
    }
    case 'set-time-scale': {
      const v = clamp(finite(cmd.value, 'Time scale'), 1, 20);
      return { ...s, timeScale: v };
    }
    case 'fail-thruster':
      return { ...s, thrusters: s.thrusters.map((t) => (t.id === cmd.id ? { ...t, failed: cmd.failed } : t)) };
    case 'ref-fault':
      return {
        ...s,
        refs: s.refs.map((r) => (r.id === cmd.id && r.installed ? { ...r, fault: cmd.fault, drift: cmd.fault === 'drift' ? r.drift : [0, 0] } : r)),
      };
    case 'ref-enable':
      return { ...s, refs: s.refs.map((r) => (r.id === cmd.id && r.installed ? { ...r, enabled: cmd.enabled } : r)) };
    case 'fail-controller':
      return { ...s, controllers: s.controllers.map((c) => (c.id === cmd.id && c.installed ? { ...c, failed: cmd.failed } : c)) };
    case 'fail-network':
      return { ...s, networks: s.networks.map((n) => (n.id === cmd.id && n.installed ? { ...n, failed: cmd.failed } : n)) };
    case 'bridge-compartment':
      return { ...s, bridgeCompartmentLost: cmd.lost };
  }
}

export const unacknowledgedDP = (s: DPState) => s.alarms.filter((a) => !s.acknowledged.includes(a));
export const positionError = (s: DPState) => Math.hypot(s.eta[0] - s.setpoint[0], s.eta[1] - s.setpoint[1]);
export const headingDeg = (rad: number) => {
  const d = norm360(rad / DEG);
  return d >= 359.95 ? 0 : d;
};
