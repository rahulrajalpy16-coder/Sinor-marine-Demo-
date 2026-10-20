import { describe, expect, it } from 'vitest';
import { DP_PEDESTAL, PROFILE } from './DPConsole';

describe('DP pedestal follows drawing 5000-501092', () => {
  it('has the drawing overall dimensions', () => {
    expect(DP_PEDESTAL.width * 1000).toBeCloseTo(653.5, 1);
    expect(DP_PEDESTAL.depth * 1000).toBeCloseTo(685.9, 1);
    expect(DP_PEDESTAL.height * 1000).toBeCloseTo(1204.25, 2);
    expect(DP_PEDESTAL.cabinet * 1000).toBe(676);
  });
  it('side profile spans the full depth and height, with the desk front near 767 mm', () => {
    const xs = PROFILE.map((p) => p[0]);
    const ys = PROFILE.map((p) => p[1]);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBeCloseTo(685.9, 1);
    expect(Math.max(...ys)).toBeCloseTo(1204.25, 2);
    expect(Math.min(...ys)).toBe(676);
    const noseTop = Math.max(...PROFILE.filter(([x]) => x > 640).map(([, y]) => y));
    expect(Math.abs(noseTop - DP_PEDESTAL.deskFront * 1000)).toBeLessThan(6);
  });
});
