import { rangeFromRoundTrip, roundTripTime, slantRange, pingProgress, ASSUMED_SOUND_SPEED } from './acoustic';

describe('illustrative acoustic ranging', () => {
  it('range = c * t / 2 round-trips', () => {
    const r = slantRange([0, 0, 0], [30, -40, 0]);
    expect(r).toBe(50);
    const t = roundTripTime(r);
    expect(t).toBeCloseTo((2 * 50) / ASSUMED_SOUND_SPEED);
    expect(rangeFromRoundTrip(t)).toBeCloseTo(50);
  });
  it('rejects invalid inputs', () => {
    expect(() => roundTripTime(-1)).toThrow(RangeError);
    expect(() => rangeFromRoundTrip(1, 0)).toThrow(RangeError);
  });
  it('ping goes out then back', () => {
    expect(pingProgress(0.25)).toEqual({ leg: 'outbound', along: 0.5 });
    expect(pingProgress(0.75)).toEqual({ leg: 'return', along: 0.5 });
  });
});
