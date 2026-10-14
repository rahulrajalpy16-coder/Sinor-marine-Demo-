/**
 * Device and viewport classification (pure; no React, no Three.js).
 * One application adapts its shell to three layout classes; nothing here forks the app.
 */
import type { QualityPreset } from '../equipment/types';

export type LayoutClass = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

/** CSS-pixel breakpoints. Tailwind's `sm` (640) and `lg` (1024) match these. */
export const BREAKPOINTS = { tablet: 640, desktop: 1024 } as const;

export interface ViewportInfo {
  width: number;
  height: number;
  layout: LayoutClass;
  orientation: Orientation;
  /** Primary pointer is a finger (phones, tablets). */
  coarse: boolean;
}

/**
 * Phones (including a phone held in landscape, where the short side is under 500 px) get the
 * compact layout; touch-first screens up to tablet size and narrow windows get the tablet layout.
 */
export function layoutFor(width: number, height: number, coarse: boolean): LayoutClass {
  const short = Math.min(width, height);
  if (width < BREAKPOINTS.tablet || (coarse && short < 500)) return 'mobile';
  if (width < BREAKPOINTS.desktop || coarse) return 'tablet';
  return 'desktop';
}

export function viewportInfo(width: number, height: number, coarse: boolean): ViewportInfo {
  return {
    width,
    height,
    coarse,
    layout: layoutFor(width, height, coarse),
    orientation: width >= height ? 'landscape' : 'portrait',
  };
}

export interface DeviceCapabilities {
  coarse: boolean;
  touch: boolean;
  devicePixelRatio: number;
  /** navigator.deviceMemory in GB where the browser exposes it (Chromium only). */
  memoryGB: number | null;
  cores: number | null;
  webgl2: boolean;
  /** GPU renderer string when exposed; used to spot software rendering. */
  renderer: string | null;
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render/i;

/**
 * Starting quality for a device the user has not chosen for. The runtime monitor can still lower
 * the pixel ratio further if frames drop; the user can always override in the HUD.
 */
export function recommendQuality(caps: DeviceCapabilities, layout: LayoutClass): QualityPreset {
  if (!caps.webgl2) return 'low';
  if (caps.renderer && SOFTWARE_GPU.test(caps.renderer)) return 'low';
  if ((caps.memoryGB !== null && caps.memoryGB <= 2) || (caps.cores !== null && caps.cores <= 2)) return 'low';
  if (layout === 'mobile') return 'medium';
  if (layout === 'tablet' || caps.coarse) return 'medium';
  if ((caps.memoryGB === null || caps.memoryGB >= 8) && (caps.cores === null || caps.cores >= 8)) return 'high';
  return 'medium';
}

/** Read what the browser exposes. Safe in tests and without WebGL. */
export function detectCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return { coarse: false, touch: false, devicePixelRatio: 1, memoryGB: null, cores: null, webgl2: true, renderer: null };
  }
  const mm = (q: string) => (typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false);
  const nav = navigator as Navigator & { deviceMemory?: number };
  let webgl2 = false;
  let renderer: string | null = null;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    webgl2 = !!gl;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webgl2 = false;
  }
  return {
    coarse: mm('(pointer: coarse)'),
    touch: 'ontouchstart' in window || (nav.maxTouchPoints ?? 0) > 0,
    devicePixelRatio: window.devicePixelRatio || 1,
    memoryGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    webgl2,
    renderer,
  };
}
