/**
 * Illustrative two-way acoustic ranging (not a proprietary HPR implementation).
 * Measurement type: two-way travel time to a seabed transponder, converted with an assumed sound speed.
 */
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
