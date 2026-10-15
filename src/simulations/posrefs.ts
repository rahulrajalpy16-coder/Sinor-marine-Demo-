/**
 * Operating states of the position reference sensors that need operator action before DP can use them:
 * RadaScan View and CyScan AS (start, lock on to the responder / target), the SMT Taut Wire 2.0
 * (lower the 400 kg depressor weight to the seabed, hold constant tension) and SPRINT-Nav DP (swing the Type 8097 pole
 * over the side, engage the hydraulic lock, power up and align the INS, DVL bottom lock).
 *
 * Datasheet limits (ranges, 500 m taut wire depth, ±30° taut wire range, 100 m SPRINT-Nav depth rating, DVL altitude, 5 kn
 * pole speed) come from posrefData.ts. Timings, speeds and angle limits are illustrative and labelled
 * as such in the HMI. Pure functions: the controller holds the state.
 */
import {
  CYSCAN,
  CYSCAN_PEDESTAL,
  CYSCAN_POS,
  POLE_8097,
  POLE_PIVOT,
  RADASCAN,
  RADASCAN_POS,
  REFLECTOR_WORLD,
  RESPONDER_WORLD,
  SCENE_SEABED_Y,
  SMT_TW,
  SPRINTNAV,
  TAUTWIRE_TIP,
} from '../equipment/posrefData';

export type ScanPhase = 'off' | 'acquiring' | 'tracking';
export type TautWirePhase = 'stowed' | 'lowering' | 'on-bottom' | 'hoisting' | 'stopped';
export type PolePhase = 'stowed' | 'deploying' | 'locking' | 'deployed' | 'recovering' | 'stopped';
export type PosRefAlarm = 'TW_ANGLE_WARN' | 'TW_ANGLE_LIMIT' | 'POLE_OVERSPEED' | 'CYSCAN_NO_TARGET' | 'RADASCAN_NO_TARGET';

export const POSREF_ALARM_TEXT: Record<PosRefAlarm, string> = {
  TW_ANGLE_WARN: 'Taut wire angle above warning limit',
  TW_ANGLE_LIMIT: 'Taut wire angle above limit: reference rejected',
  POLE_OVERSPEED: 'Vessel speed above 5 kn with the pole deployed',
  CYSCAN_NO_TARGET: 'CyScan: no reflector return',
  RADASCAN_NO_TARGET: 'RadaScan: responder out of range',
};

export interface PosRefState {
  radascan: { phase: ScanPhase; timer: number };
  cyscan: { phase: ScanPhase; timer: number };
  /** Fog or heavy rain: shortens laser range (CyScan); microwave radar (RadaScan) is unaffected. */
  fog: boolean;
  tautwire: {
    phase: TautWirePhase;
    /** Wire paid out below the gimbal head, m. */
    payout: number;
    /** Where the weight landed on the seabed, scene frame [north, east]; null while not on the bottom. */
    anchor: [number, number] | null;
  };
  pole: {
    phase: PolePhase;
    /** 0 = stowed horizontal (pointing aft), 90 = vertical, deployed. */
    angleDeg: number;
    locked: boolean;
    lockTimer: number;
  };
  sprintnav: { power: boolean; align: number };
  alarms: PosRefAlarm[];
  time: number;
}

export type PosRefCommand =
  | { type: 'radascan'; on: boolean }
  | { type: 'cyscan'; on: boolean }
  | { type: 'set-fog'; on: boolean }
  | { type: 'tw-deploy' }
  | { type: 'tw-recover' }
  | { type: 'tw-stop' }
  | { type: 'pole-deploy' }
  | { type: 'pole-recover' }
  | { type: 'pole-stop' }
  | { type: 'sprintnav-power'; on: boolean }
  | { type: 'reset' };

/** Vessel pose from DP: [north, east, heading rad], plus speed over ground in m/s. */
export interface VesselPose {
  eta: [number, number, number];
  speed: number;
}

export class PosRefInterlockError extends Error {}

export const KNOT = 0.514444;

export const initialPosRefState = (): PosRefState => ({
  radascan: { phase: 'off', timer: 0 },
  cyscan: { phase: 'off', timer: 0 },
  fog: false,
  tautwire: { phase: 'stowed', payout: 0, anchor: null },
  pole: { phase: 'stowed', angleDeg: 0, locked: false, lockTimer: 0 },
  sprintnav: { power: false, align: 0 },
  alarms: [],
  time: 0,
});

/** Vessel-frame point to scene frame (X east, Y up, Z north), same as the 3D vessel transform. */
export function toWorld(p: readonly [number, number, number], eta: readonly [number, number, number]): [number, number, number] {
  const [n, e, psi] = eta;
  const c = Math.cos(psi);
  const s = Math.sin(psi);
  return [e + p[0] * c + p[2] * s, p[1], n - p[0] * s + p[2] * c];
}

/** Range (m) and bearing relative to the bow (deg, clockwise) from a vessel-frame sensor to a scene point. */
export function rangeBearing(sensor: readonly [number, number, number], target: readonly [number, number, number], eta: readonly [number, number, number]) {
  const w = toWorld(sensor, eta);
  const dx = target[0] - w[0];
  const dz = target[2] - w[2];
  const range = Math.hypot(dx, dz, target[1] - w[1]);
  const trueBrg = Math.atan2(dx, dz);
  let rel = ((trueBrg - eta[2]) * 180) / Math.PI;
  rel = ((rel % 360) + 360) % 360;
  return { range, bearing: rel };
}

/** Wire run from the gimbal head to the seabed, m (vertical). */
export const TW_VERTICAL = TAUTWIRE_TIP[1] - (SCENE_SEABED_Y + SMT_TW.weightHeight.value);
export const WATER_DEPTH = -SCENE_SEABED_Y;

/** Taut wire angle from vertical (deg) and its horizontal offset (m), when the weight is on the bottom. */
export function tautWireAngle(s: PosRefState, eta: readonly [number, number, number]) {
  if (!s.tautwire.anchor) return { angleDeg: 0, offset: 0 };
  const tip = toWorld(TAUTWIRE_TIP, eta);
  const [an, ae] = s.tautwire.anchor;
  const offset = Math.hypot(tip[0] - ae, tip[2] - an);
  return { angleDeg: (Math.atan2(offset, TW_VERTICAL) * 180) / Math.PI, offset };
}

/**
 * Taut wire angles as the SMT gimbal head reports them (installation manual PJ 0044-13, $PCPTW):
 * across-ship positive when the weight is outboard, along-ship positive when the weight is to the
 * right looking outboard (aft, for this starboard unit).
 */
export function tautWireAxes(s: PosRefState, eta: readonly [number, number, number]) {
  if (!s.tautwire.anchor) return { across: 0, along: 0 };
  const tip = toWorld(TAUTWIRE_TIP, eta);
  const [an, ae] = s.tautwire.anchor;
  const dx = ae - tip[0];
  const dz = an - tip[2];
  const c = Math.cos(eta[2]);
  const sn = Math.sin(eta[2]);
  const x = dx * c - dz * sn; // starboard (outboard for this unit)
  const z = dx * sn + dz * c; // forward
  const deg = (v: number) => (Math.atan2(v, TW_VERTICAL) * 180) / Math.PI;
  return { across: deg(x), along: deg(-z) };
}

/** NMEA 0183 sentence from the SMT taut wire: $PCPTW,across,along,status,alarm,rope*hh. */
export function tautWireNmea(s: PosRefState, eta: readonly [number, number, number]) {
  const { across, along } = tautWireAxes(s, eta);
  const ok = s.tautwire.phase === 'on-bottom' && Math.abs(across) < SMT_TW.angleLimitDeg.value && Math.abs(along) < SMT_TW.angleLimitDeg.value;
  const f = (v: number) => (v < 0 ? '-' : '') + Math.abs(v).toFixed(2).padStart(6, '0');
  const alarm = s.alarms.includes('TW_ANGLE_LIMIT') ? '02' : s.alarms.includes('TW_ANGLE_WARN') ? '01' : '00';
  const body = `PCPTW,${f(across)},${f(along)},${ok ? 'A' : 'V'},${alarm},${s.tautwire.payout.toFixed(1).padStart(5, '0')}`;
  let cs = 0;
  for (const ch of body) cs ^= ch.charCodeAt(0);
  return `$${body}*${cs.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** SPRINT-Nav position (vessel frame) at a given pole angle. */
export function sprintNavPos(angleDeg: number): [number, number, number] {
  const a = (angleDeg * Math.PI) / 180;
  const L = POLE_8097.length.value;
  return [POLE_PIVOT[0], POLE_PIVOT[1] - L * Math.sin(a), POLE_PIVOT[2] - L * Math.cos(a)];
}

/** DVL altitude above the seabed when deployed (bottom of the unit to the seabed). */
export function sprintNavAltitude(angleDeg: number) {
  const p = sprintNavPos(angleDeg);
  return p[1] - SPRINTNAV.height.value - SCENE_SEABED_Y;
}
export const sprintNavDepth = (angleDeg: number) => -(sprintNavPos(angleDeg)[1] - SPRINTNAV.height.value);

/** CyScan AS laser window: centre of the rotating head above the base. */
export const CYSCAN_WINDOW: [number, number, number] = [
  CYSCAN_POS[0],
  CYSCAN_POS[1] + CYSCAN_PEDESTAL + CYSCAN.baseHeight.value + (CYSCAN.headHeight.value - CYSCAN.baseHeight.value) / 2,
  CYSCAN_POS[2],
];

export function radascanRange(eta: readonly [number, number, number]) {
  return rangeBearing([RADASCAN_POS[0], RADASCAN_POS[1] + RADASCAN.pedestalHeight.value + RADASCAN.height.value / 2, RADASCAN_POS[2]], RESPONDER_WORLD, eta);
}
export function cyscanRange(eta: readonly [number, number, number]) {
  return rangeBearing(CYSCAN_WINDOW, REFLECTOR_WORLD, eta);
}

/** The scene's CyScan AS target is the 1.9 m cylindrical target (about 300 m per the installer’s guide); prisms reach 2,500 m. */
export const cyscanMaxRange = (s: Pick<PosRefState, 'fog'>) => (s.fog ? CYSCAN.fogRangeM.value : CYSCAN.cylinderRange.value);
const radascanInRange = (eta: readonly [number, number, number]) => radascanRange(eta).range <= RADASCAN.maxRange.value;
function cyscanInRange(s: PosRefState, eta: readonly [number, number, number]) {
  const r = cyscanRange(eta).range;
  return r >= CYSCAN.minRange.value && r <= cyscanMaxRange(s);
}

export interface PosRefReadiness {
  RADASCAN: boolean;
  CYSCAN: boolean;
  TAUTWIRE: boolean;
  SPRINTNAV: boolean;
}

/** Which references can measure right now; DP only uses a reference that is ready. */
export function posRefReadiness(s: PosRefState, pose: VesselPose): PosRefReadiness {
  const tw = tautWireAngle(s, pose.eta);
  const alt = sprintNavAltitude(s.pole.angleDeg);
  return {
    RADASCAN: s.radascan.phase === 'tracking' && radascanInRange(pose.eta),
    CYSCAN: s.cyscan.phase === 'tracking' && cyscanInRange(s, pose.eta),
    TAUTWIRE: s.tautwire.phase === 'on-bottom' && tw.angleDeg < SMT_TW.angleLimitDeg.value,
    SPRINTNAV:
      s.pole.phase === 'deployed' &&
      s.pole.locked &&
      s.sprintnav.power &&
      s.sprintnav.align >= 1 &&
      alt >= SPRINTNAV.altitudeMin.value &&
      alt <= SPRINTNAV.altitudeMax.value &&
      sprintNavDepth(s.pole.angleDeg) <= SPRINTNAV.depthRating.value &&
      pose.speed < POLE_8097.maxSpeedKn.value * KNOT,
  };
}

export function tautWireStatus(s: PosRefState, eta: readonly [number, number, number]) {
  const t = s.tautwire;
  if (t.phase === 'on-bottom') return tautWireAngle(s, eta).angleDeg >= SMT_TW.angleLimitDeg.value ? 'ANGLE LIMIT' : 'ON BOTTOM · TENSIONED';
  return { stowed: 'STOWED', lowering: 'LOWERING', hoisting: 'HOISTING', stopped: 'STOPPED' }[t.phase];
}

export function poleStatus(s: PosRefState) {
  return { stowed: 'STOWED', deploying: 'SWINGING OUT', locking: 'LOCKING', deployed: 'DEPLOYED · LOCKED', recovering: 'RECOVERING', stopped: 'STOPPED' }[s.pole.phase];
}

/** Apply an operator command. Throws PosRefInterlockError (state unchanged) when an interlock blocks it. */
export function applyPosRefCommand(s: PosRefState, cmd: PosRefCommand, pose: VesselPose): PosRefState {
  const block = (why: string): never => {
    throw new PosRefInterlockError(why);
  };
  switch (cmd.type) {
    case 'radascan':
      return { ...s, radascan: { phase: cmd.on ? (s.radascan.phase === 'off' ? 'acquiring' : s.radascan.phase) : 'off', timer: 0 } };
    case 'cyscan':
      return { ...s, cyscan: { phase: cmd.on ? (s.cyscan.phase === 'off' ? 'acquiring' : s.cyscan.phase) : 'off', timer: 0 } };
    case 'set-fog':
      return { ...s, fog: cmd.on };
    case 'tw-deploy':
      if (WATER_DEPTH > SMT_TW.waterDepth.value) block(`Water depth exceeds the ${SMT_TW.waterDepth.value} m rating`);
      if (s.tautwire.phase === 'on-bottom' || s.tautwire.phase === 'lowering') return s;
      return { ...s, tautwire: { ...s.tautwire, phase: 'lowering', anchor: null } };
    case 'tw-recover':
      if (s.tautwire.phase === 'stowed' || s.tautwire.phase === 'hoisting') return s;
      return { ...s, tautwire: { ...s.tautwire, phase: 'hoisting', anchor: null } };
    case 'tw-stop':
      if (s.tautwire.phase !== 'lowering' && s.tautwire.phase !== 'hoisting') return s;
      return { ...s, tautwire: { ...s.tautwire, phase: 'stopped' } };
    case 'pole-deploy':
      if (pose.speed >= POLE_8097.maxSpeedKn.value * KNOT) block('Vessel speed must be below 5 kn to deploy the pole');
      if (s.pole.phase === 'deployed' || s.pole.phase === 'deploying' || s.pole.phase === 'locking') return s;
      return { ...s, pole: { ...s.pole, phase: 'deploying', locked: false, lockTimer: 0 } };
    case 'pole-recover':
      if (s.pole.phase === 'stowed' || s.pole.phase === 'recovering') return s;
      return { ...s, pole: { ...s.pole, phase: 'recovering', locked: false, lockTimer: 0 } };
    case 'pole-stop':
      if (s.pole.phase !== 'deploying' && s.pole.phase !== 'recovering') return s;
      return { ...s, pole: { ...s.pole, phase: 'stopped' } };
    case 'sprintnav-power':
      return { ...s, sprintnav: { power: cmd.on, align: cmd.on ? s.sprintnav.align : 0 } };
    case 'reset':
      return initialPosRefState();
  }
}

function setAlarm(list: PosRefAlarm[], a: PosRefAlarm, on: boolean) {
  const has = list.includes(a);
  if (on && !has) return [...list, a];
  if (!on && has) return list.filter((x) => x !== a);
  return list;
}

/** Advance by dt seconds. Pure. */
export function stepPosRefs(prev: PosRefState, dt: number, pose: VesselPose): PosRefState {
  if (!(dt > 0)) return prev;
  const s: PosRefState = { ...prev, time: prev.time + dt };

  // RadaScan / CyScan: lock on to the target after an acquisition time, if it is in range.
  const scan = (cur: PosRefState['radascan'], inRange: boolean, acquire: number) => {
    if (cur.phase === 'off') return cur;
    if (!inRange) return cur.phase === 'acquiring' && cur.timer === 0 ? cur : { phase: 'acquiring' as const, timer: 0 };
    if (cur.phase === 'tracking') return cur;
    const timer = cur.timer + dt;
    return timer >= acquire ? { phase: 'tracking' as const, timer: 0 } : { phase: 'acquiring' as const, timer };
  };
  s.radascan = scan(prev.radascan, radascanInRange(pose.eta), RADASCAN.acquireSeconds.value);
  s.cyscan = scan(prev.cyscan, cyscanInRange(prev, pose.eta), CYSCAN.acquireSeconds.value);

  // Taut wire: constant-speed winch; on landing, the weight's seabed position is fixed.
  const tw = { ...prev.tautwire };
  const v = SMT_TW.winchSpeed.value;
  if (tw.phase === 'lowering') {
    tw.payout = Math.min(TW_VERTICAL, tw.payout + v * dt);
    if (tw.payout >= TW_VERTICAL) {
      const tip = toWorld(TAUTWIRE_TIP, pose.eta);
      tw.phase = 'on-bottom';
      tw.anchor = [tip[2], tip[0]];
    }
  } else if (tw.phase === 'hoisting') {
    tw.payout = Math.max(0, tw.payout - v * dt);
    if (tw.payout <= 0) tw.phase = 'stowed';
  }
  s.tautwire = tw;

  // Over-the-side pole: swing, then the hydraulic lock engages.
  const pole = { ...prev.pole };
  const rate = 90 / POLE_8097.swingSeconds.value;
  if (pole.phase === 'deploying') {
    pole.angleDeg = Math.min(90, pole.angleDeg + rate * dt);
    if (pole.angleDeg >= 90) {
      pole.phase = 'locking';
      pole.lockTimer = 0;
    }
  } else if (pole.phase === 'locking') {
    pole.lockTimer += dt;
    if (pole.lockTimer >= POLE_8097.lockSeconds.value) {
      pole.phase = 'deployed';
      pole.locked = true;
    }
  } else if (pole.phase === 'recovering') {
    pole.angleDeg = Math.max(0, pole.angleDeg - rate * dt);
    if (pole.angleDeg <= 0) pole.phase = 'stowed';
  }
  s.pole = pole;

  // SPRINT-Nav INS alignment while powered.
  s.sprintnav = prev.sprintnav.power ? { power: true, align: Math.min(1, prev.sprintnav.align + dt / SPRINTNAV.alignSeconds.value) } : prev.sprintnav;

  const angle = tautWireAngle(s, pose.eta).angleDeg;
  let alarms = prev.alarms;
  alarms = setAlarm(alarms, 'TW_ANGLE_WARN', tw.phase === 'on-bottom' && angle >= SMT_TW.angleWarnDeg.value && angle < SMT_TW.angleLimitDeg.value);
  alarms = setAlarm(alarms, 'TW_ANGLE_LIMIT', tw.phase === 'on-bottom' && angle >= SMT_TW.angleLimitDeg.value);
  alarms = setAlarm(alarms, 'POLE_OVERSPEED', pole.phase !== 'stowed' && pose.speed >= POLE_8097.maxSpeedKn.value * KNOT);
  alarms = setAlarm(alarms, 'CYSCAN_NO_TARGET', s.cyscan.phase !== 'off' && !cyscanInRange(s, pose.eta));
  alarms = setAlarm(alarms, 'RADASCAN_NO_TARGET', s.radascan.phase !== 'off' && !radascanInRange(pose.eta));
  s.alarms = alarms;
  return s;
}
