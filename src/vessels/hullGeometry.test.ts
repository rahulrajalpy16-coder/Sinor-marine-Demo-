import { buildHullGeometry, buildDeckGeometry, buildHullLines, buildTransomGeometry, halfBreadth, hullHalfWidthAt, HULL, sectionPoint } from './hullGeometry';

describe('procedural hull', () => {
  it('fits the configured dimensions (80 x 18 m, +Z bow)', () => {
    const g = buildHullGeometry();
    const bb = g.boundingBox!;
    expect(bb.max.z).toBeCloseTo(40, 1);
    expect(bb.min.z).toBeCloseTo(-40, 1);
    expect(bb.max.x).toBeLessThanOrEqual(HULL.halfBeam + 1e-6);
    expect(bb.min.x).toBeGreaterThanOrEqual(-HULL.halfBeam - 1e-6);
    expect(bb.min.y).toBeCloseTo(-HULL.draft, 1);
  });
  it('produces finite geometry', () => {
    for (const g of [buildHullGeometry(), buildDeckGeometry(), buildHullLines(), buildTransomGeometry()]) {
      const arr = g.getAttribute('position').array as Float32Array;
      expect(arr.length).toBeGreaterThan(0);
      expect(Array.from(arr).every(Number.isFinite)).toBe(true);
    }
  });
  it('is symmetric and narrows to the stem', () => {
    expect(halfBreadth(0, 0.5)).toBe(HULL.halfBeam);
    expect(halfBreadth(40, 1)).toBeLessThan(0.5);
    const [x, y] = sectionPoint(0, 1);
    expect(x).toBeCloseTo(HULL.halfBeam);
    expect(y).toBeCloseTo(3);
  });
  it('leaves room for the bow thruster tunnel', () => {
    const w = hullHalfWidthAt(31, -2.4);
    expect(w).toBeGreaterThan(1.5);
    expect(w).toBeLessThan(HULL.halfBeam);
  });
});
