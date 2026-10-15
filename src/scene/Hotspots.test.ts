import { describe, expect, it } from 'vitest';
import { LABEL_FAR, LABEL_NEAR, labelProximity, layoutMarkers, type ScreenMarker } from './Hotspots';

const m = (id: string, x: number, y: number, dist: number, over: Partial<ScreenMarker> = {}): ScreenMarker => ({
  id,
  x,
  y,
  dist,
  onScreen: true,
  occluded: false,
  wantLabel: labelProximity(dist) > 0.02,
  forced: false,
  labelWidth: 60,
  ...over,
});

describe('equipment indicators', () => {
  it('labels are hidden far away and fully shown up close', () => {
    expect(labelProximity(LABEL_FAR + 10)).toBe(0);
    expect(labelProximity(LABEL_NEAR - 5)).toBe(1);
    expect(labelProximity((LABEL_NEAR + LABEL_FAR) / 2)).toBeCloseTo(0.5, 5);
  });

  it('overview: rings only, no names', () => {
    const out = layoutMarkers([m('a', 100, 100, 150), m('b', 300, 120, 160)]);
    expect(out.get('a')).toEqual({ ring: true, label: false });
    expect(out.get('b')).toEqual({ ring: true, label: false });
  });

  it('merges rings that sit on top of each other, keeping the nearer one', () => {
    const out = layoutMarkers([m('far', 100, 100, 60), m('near', 105, 104, 40)]);
    expect(out.get('near')!.ring).toBe(true);
    expect(out.get('far')!.ring).toBe(false);
  });

  it('drops a label that would collide with a nearer one, and never labels hidden indicators', () => {
    const out = layoutMarkers([m('a', 100, 100, 20), m('b', 140, 105, 25), m('c', 100, 300, 20, { occluded: true })]);
    expect(out.get('a')!.label).toBe(true);
    expect(out.get('b')).toEqual({ ring: true, label: false });
    expect(out.get('c')).toEqual({ ring: true, label: false });
  });

  it('a hovered indicator always shows its name', () => {
    const out = layoutMarkers([m('a', 100, 100, 20), m('b', 140, 105, 200, { forced: true, occluded: true })]);
    expect(out.get('b')).toEqual({ ring: true, label: true });
    expect(out.get('a')!.label).toBe(false);
  });
});
