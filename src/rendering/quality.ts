import type { QualityPreset } from '../equipment/types';
import { useAppStore } from '../store/useAppStore';
import { detectCapabilities, recommendQuality } from '../responsive/device';
import { useDevice } from '../responsive/useDevice';
import { useVRActive } from '../xr/vrState';

/**
 * Everything the renderer and equipment may scale by quality, in one place.
 * New equipment reads `useQualityProfile()` instead of switching on the preset name.
 */
export interface QualityProfile {
  /** Device pixel ratio range; the performance monitor moves within it. */
  dpr: [number, number];
  /** Bloom and vignette pass. */
  postprocessing: boolean;
  bloomIntensity: number;
  multisampling: number;
  /** Ocean plane subdivisions per side. */
  oceanSegments: number;
  /** Refresh rate for live canvas displays (radar, ECDIS, DP and HMI screens). */
  screenHz: number;
  /** Curve segments for procedural round parts (cylinders, tori) in new equipment. */
  radialSegments: number;
  /** Seconds between occlusion checks for the scene's equipment indicators. */
  indicatorOcclusionS: number;
}

export const QUALITY_PROFILES: Record<QualityPreset, QualityProfile> = {
  low: { dpr: [0.75, 1], postprocessing: false, bloomIntensity: 0, multisampling: 0, oceanSegments: 96, screenHz: 2, radialSegments: 12, indicatorOcclusionS: 0.5 },
  medium: { dpr: [1, 1.5], postprocessing: true, bloomIntensity: 0.6, multisampling: 0, oceanSegments: 192, screenHz: 5, radialSegments: 24, indicatorOcclusionS: 0.3 },
  high: { dpr: [1, 2], postprocessing: true, bloomIntensity: 0.9, multisampling: 4, oceanSegments: 288, screenHz: 8, radialSegments: 40, indicatorOcclusionS: 0.2 },
};

export const qualityProfile = (q: QualityPreset) => QUALITY_PROFILES[q];

/**
 * Caps applied on top of the chosen preset during a VR session. A standalone headset (Quest 3 / 3S) renders
 * every frame twice at 72–90 Hz, and the post-processing composer cannot draw into the WebXR framebuffer.
 */
export function vrCapped(p: QualityProfile): QualityProfile {
  return {
    ...p,
    dpr: [1, 1],
    postprocessing: false,
    bloomIntensity: 0,
    multisampling: 0,
    oceanSegments: Math.min(p.oceanSegments, 96),
    screenHz: Math.min(p.screenHz, 2),
    radialSegments: Math.min(p.radialSegments, 16),
  };
}

/** The profile in effect now: the preset, capped while in VR. For code outside React render. */
export function activeQualityProfile(): QualityProfile {
  const p = QUALITY_PROFILES[useAppStore.getState().quality];
  return useVRActive.getState() ? vrCapped(p) : p;
}

export function useQualityProfile(): QualityProfile {
  const p = QUALITY_PROFILES[useAppStore((s) => s.quality)];
  return useVRActive() ? vrCapped(p) : p;
}

const STORAGE_KEY = 'sinor.quality';
const isPreset = (v: unknown): v is QualityPreset => v === 'low' || v === 'medium' || v === 'high';

/** The user's own choice, kept per browser. Storage may be unavailable (private mode). */
export function rememberQuality(q: QualityPreset) {
  try {
    window.localStorage.setItem(STORAGE_KEY, q);
  } catch {
    /* storage unavailable; the choice lasts for this visit only */
  }
}

function storedQuality(): QualityPreset | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isPreset(v) ? v : null;
  } catch {
    return null;
  }
}

/** Starting quality: ?quality= in the URL, then the user's saved choice, then the device recommendation. */
export function initialQuality(search: string): { quality: QualityPreset; source: 'url' | 'saved' | 'auto' } {
  const q = new URLSearchParams(search).get('quality');
  if (isPreset(q)) return { quality: q, source: 'url' };
  const saved = storedQuality();
  if (saved) return { quality: saved, source: 'saved' };
  return { quality: recommendQuality(detectCapabilities(), useDevice.getState().layout), source: 'auto' };
}
