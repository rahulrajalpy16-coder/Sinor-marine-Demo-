import { describe, expect, it } from 'vitest';
import { QUALITY_PROFILES, vrCapped } from '../rendering/quality';
import { isTooSmall } from './SmallFeatureCulling';

describe('VR quality caps', () => {
  it('never raises a preset, and turns off post-processing and supersampling', () => {
    for (const p of Object.values(QUALITY_PROFILES)) {
      const v = vrCapped(p);
      expect(v.postprocessing).toBe(false);
      expect(v.dpr).toEqual([1, 1]);
      expect(v.oceanSegments).toBeLessThanOrEqual(p.oceanSegments);
      expect(v.screenHz).toBeLessThanOrEqual(p.screenHz);
      expect(v.radialSegments).toBeLessThanOrEqual(p.radialSegments);
    }
  });
});

describe('small-feature culling', () => {
  it('skips a 2 cm bolt 10 m away but keeps it at arm length', () => {
    expect(isTooSmall(0.02, 10)).toBe(true);
    expect(isTooSmall(0.02, 0.6)).toBe(false);
  });
  it('keeps a 1 m console across the bridge', () => {
    expect(isTooSmall(1, 12)).toBe(false);
  });
});
