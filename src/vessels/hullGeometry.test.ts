import { buildForecastleGeometry, buildHullGeometry, buildDeckGeometry, buildHullLines, buildTransomGeometry, halfBreadth, hullHalfWidthAt, HULL, sectionPoint } from './hullGeometry';

describe('procedural hull', () => {
  it('fits the GA main dimensions (78 x 20 m, draught 4.8, depth 6.5, +Z bow)', () => {
    const g = buildHullGeometry();
    const bb = g.boundingBox!;
    expect(bb.max.z).toBeCloseTo(39, 1);
    expect(bb.min.z).toBeCloseTo(-39, 1);
    expect(HULL.halfBeam * 2).toBe(20);
    expect(bb.max.x).toBeLessThanOrEqual(HULL.halfBeam + 1e-6);
    expect(bb.min.x).toBeGreaterThanOrEqual(-HULL.halfBeam - 1e-6);
    expect(bb.min.y).toBeCloseTo(-HULL.draft, 1);
  });
  it('produces finite geometry', () => {
    for (const g of [buildHullGeometry(), buildDeckGeometry(), buildHullLines(), buildTransomGeometry(), buildForecastleGeometry()]) {
      const arr = g.getAttribute('position').array as Float32Array;
      expect(arr.length).toBeGreaterThan(0);
      expect(Array.from(arr).every(Number.isFinite)).toBe(true);
    }
  });
  it('is symmetric and narrows to the stem', () => {
    expect(halfBreadth(0, 0.5)).toBe(HULL.halfBeam);
    expect(halfBreadth(39, 1)).toBeLessThan(0.5);
    const [x, y] = sectionPoint(0, 1);
    expect(x).toBeCloseTo(HULL.halfBeam);
    expect(y).toBeCloseTo(1.7);
  });
  it('leaves room for the bow thruster tunnel', () => {
    const w = hullHalfWidthAt(28.4, -3.5);
    expect(w).toBeGreaterThan(1.5);
    expect(w).toBeLessThan(HULL.halfBeam);
  });
});
