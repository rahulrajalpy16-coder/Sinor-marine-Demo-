/**
 * Illustrative two-way acoustic ranging (not a proprietary HPR implementation).
 * Measurement type: two-way travel time to a seabed transponder, converted with an assumed sound speed.
 */
import { PRINCIPAL } from '../vessels/vesselLayout';
import { STROKE, T7950, transceiverY } from '../equipment/hprData';

export const ASSUMED_SOUND_SPEED = 1500; // m/s, nominal sea water

export type Vec3 = [number, number, number];

export function slantRange(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function roundTripTime(range: number, c = ASSUMED_SOUND_SPEED): number {
  if (!(range >= 0) || !(c > 0)) throw new RangeError('range must be >= 0 and sound speed > 0');
  return (2 * range) / c;
}

/** range = c * t_round / 2 */
export function rangeFromRoundTrip(t: number, c = ASSUMED_SOUND_SPEED): number {
  if (!(t >= 0) || !(c > 0)) throw new RangeError('time must be >= 0 and sound speed > 0');
  return (c * t) / 2;
}

/** Position of the ping along the path for a normalized cycle phase in [0,1): out on [0,0.5), back on [0.5,1). */
export function pingProgress(phase: number): { leg: 'outbound' | 'return'; along: number } {
  const p = ((phase % 1) + 1) % 1;
  return p < 0.5 ? { leg: 'outbound', along: p * 2 } : { leg: 'return', along: 2 - p * 2 };
}

export const SEABED_Y = -42;
export const TRANSPONDER: Vec3 = [9, SEABED_Y + 1.2, 2];

/**
 * Where the Type 7950 sits on this vessel (scene metres): pole axis on the centreline at frame +12 m,
 * standing on the bottom plating (keel at the 4.8 m design draught there). Datum = top of the 150 mm hull penetrator.
 */
export const HPR_AXIS = { x: 0, z: 12 };
export const HULL_BOTTOM_Y = -PRINCIPAL.draft;
export const HPR_DATUM_Y = HULL_BOTTOM_Y + T7950.penetratorHeight.value;

/** Scene position of the transceiver face for a given pole travel. */
export function transceiverFace(travel: number): Vec3 {
  return [HPR_AXIS.x, HPR_DATUM_Y + transceiverY(travel).face, HPR_AXIS.z];
}

/** Slant range from the fully deployed transceiver to the seabed transponder (illustrative scene). */
export const HPR_NOMINAL_SLANT_M = slantRange(transceiverFace(STROKE), TRANSPONDER);
