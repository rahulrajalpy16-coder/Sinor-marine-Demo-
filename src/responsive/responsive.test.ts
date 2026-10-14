// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { layoutFor, recommendQuality, viewportInfo, type DeviceCapabilities } from './device';
import { QUALITY_PROFILES, initialQuality, rememberQuality } from '../rendering/quality';
import { isEditableTarget, isTap, keyAction, orbitStep } from '../interactions/input';
import { nearestSnap } from '../components/shell/BottomSheet';
import { orbitLimitsFor } from '../camera/cameraMachine';

const caps = (o: Partial<DeviceCapabilities> = {}): DeviceCapabilities => ({
  coarse: false,
  touch: false,
  devicePixelRatio: 1,
  memoryGB: 8,
  cores: 8,
  webgl2: true,
  renderer: 'ANGLE (NVIDIA)',
  ...o,
});

describe('layout classes', () => {
  it('maps real devices to one of three layouts', () => {
    expect(layoutFor(1440, 900, false)).toBe('desktop'); // laptop
    expect(layoutFor(1920, 1080, false)).toBe('desktop');
    expect(layoutFor(390, 844, true)).toBe('mobile'); // iPhone portrait
    expect(layoutFor(844, 390, true)).toBe('mobile'); // iPhone landscape
    expect(layoutFor(412, 915, true)).toBe('mobile'); // Android
    expect(layoutFor(820, 1180, true)).toBe('tablet'); // iPad portrait
    expect(layoutFor(1180, 820, true)).toBe('tablet'); // iPad landscape: touch first
    expect(layoutFor(900, 700, false)).toBe('tablet'); // narrow desktop window
    expect(layoutFor(600, 800, false)).toBe('mobile');
  });
  it('reports orientation', () => {
    expect(viewportInfo(390, 844, true).orientation).toBe('portrait');
    expect(viewportInfo(844, 390, true).orientation).toBe('landscape');
  });
});

describe('adaptive quality', () => {
  it('recommends by capability and layout', () => {
    expect(recommendQuality(caps(), 'desktop')).toBe('high');
    expect(recommendQuality(caps({ cores: 4, memoryGB: 4 }), 'desktop')).toBe('medium');
    expect(recommendQuality(caps({ coarse: true }), 'mobile')).toBe('medium');
    expect(recommendQuality(caps({ memoryGB: 2 }), 'mobile')).toBe('low');
    expect(recommendQuality(caps({ webgl2: false }), 'desktop')).toBe('low');
    expect(recommendQuality(caps({ renderer: 'Google SwiftShader' }), 'desktop')).toBe('low');
  });
  it('profiles scale monotonically from low to high', () => {
    const { low, medium, high } = QUALITY_PROFILES;
    for (const k of ['oceanSegments', 'screenHz', 'radialSegments', 'bloomIntensity'] as const) {
      expect(low[k]).toBeLessThanOrEqual(medium[k]);
      expect(medium[k]).toBeLessThanOrEqual(high[k]);
    }
    expect(low.postprocessing).toBe(false);
    expect(high.dpr[1]).toBeGreaterThan(low.dpr[1]);
  });
  describe('starting quality', () => {
    beforeEach(() => window.localStorage.clear());
    it('URL beats the saved choice, which beats the recommendation', () => {
      rememberQuality('low');
      expect(initialQuality('?quality=high')).toEqual({ quality: 'high', source: 'url' });
      expect(initialQuality('')).toEqual({ quality: 'low', source: 'saved' });
      window.localStorage.clear();
      expect(initialQuality('?quality=ultra').source).toBe('auto');
    });
  });
});

describe('shared input', () => {
  it('only a short movement counts as a tap, with more slack for fingers', () => {
    expect(isTap(3, 'mouse')).toBe(true);
    expect(isTap(9, 'mouse')).toBe(false);
    expect(isTap(9, 'touch')).toBe(true);
    expect(isTap(30, 'touch')).toBe(false);
    expect(isTap(2, undefined)).toBe(true);
  });
  it('maps camera keys', () => {
    expect(keyAction('ArrowLeft')).toMatchObject({ kind: 'orbit' });
    expect(keyAction('+')).toMatchObject({ kind: 'zoom' });
    expect(keyAction('Home')).toEqual({ kind: 'overview' });
    expect(keyAction('f')).toEqual({ kind: 'focus' });
    expect(keyAction('a')).toBeNull();
    const a = keyAction('ArrowRight', true);
    const b = keyAction('ArrowRight');
    expect(a && a.kind === 'orbit' && b && b.kind === 'orbit' && a.azimuth).toBeCloseTo(2 * (b as { azimuth: number }).azimuth);
  });
  it('keeps keys typed into form controls away from the camera', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('select'))).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
  it('keyboard orbit and zoom respect orbit limits', () => {
    const lim = orbitLimitsFor('overview', false);
    const pose = { position: [0, 30, 40] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    const r = (p: number[]) => Math.hypot(p[0], p[1], p[2]);
    const turned = orbitStep(pose, { azimuth: Math.PI / 2 }, lim);
    expect(turned.position[0]).toBeCloseTo(40, 4);
    expect(turned.position[1]).toBeCloseTo(30, 4);
    expect(r(turned.position)).toBeCloseTo(50, 4);
    expect(r(orbitStep(pose, { zoom: 100 }, lim).position)).toBeCloseTo(lim.maxDistance, 4);
    expect(r(orbitStep(pose, { zoom: 0.01 }, lim).position)).toBeCloseTo(lim.minDistance, 4);
    // Never below the polar limit (camera stays above the sea in overview).
    const low = orbitStep(pose, { polar: Math.PI }, lim);
    expect(Math.acos(low.position[1] / r(low.position))).toBeLessThanOrEqual(lim.maxPolarAngle + 1e-6);
  });
  it('bottom sheet snaps to the nearest height', () => {
    expect(nearestSnap(0.3)).toBe('peek');
    expect(nearestSnap(0.6)).toBe('half');
    expect(nearestSnap(0.85)).toBe('full');
  });
});
