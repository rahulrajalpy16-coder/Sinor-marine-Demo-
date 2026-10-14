import { MATERIALS, SOLID_KEYS, BASE_OPACITY, SPLIT } from './materials';
import { MODE_STYLES } from './modes';
import type { VisualMode } from '../equipment/types';

/**
 * Push a mode's style into the shared structure materials.
 * `reveal` in [0, 1] drives the intro sweep (0 = fully holographic, 1 = steady state).
 */
export function applyModeToMaterials(mode: VisualMode, reveal = 1) {
  const st = MODE_STYLES[mode];
  const intro = reveal < 1;
  const hullKind = intro ? 'split' : st.hull;
  const lineKind = intro ? 'forward' : st.lines;

  const splitZ = intro ? -46 + (SPLIT.hybridZ + 46) * easeInOut(reveal) : SPLIT.hybridZ;
  SPLIT.set(splitZ);

  for (const k of SOLID_KEYS) {
    const m = MATERIALS[k];
    m.clippingPlanes = hullKind === 'split' ? [SPLIT.solidPlane] : [];
    m.visible = hullKind !== 'hidden';
    const ghost = hullKind === 'ghost';
    m.transparent = ghost || k === 'glass';
    m.opacity = ghost ? Math.min(BASE_OPACITY[k], st.hullOpacity) : BASE_OPACITY[k];
    m.depthWrite = !ghost && k !== 'glass';
    m.needsUpdate = true;
  }

  MATERIALS.lines.visible = lineKind !== 'none';
  MATERIALS.lines.clippingPlanes = lineKind === 'forward' ? [SPLIT.holoPlane] : [];
  MATERIALS.lines.opacity = intro ? 1 : st.lineOpacity;
  MATERIALS.lines.needsUpdate = true;

  const fill = intro ? 0.12 : st.holoFill;
  MATERIALS.holoFill.visible = fill > 0;
  MATERIALS.holoFill.opacity = fill;
  MATERIALS.holoFill.clippingPlanes = lineKind === 'forward' ? [SPLIT.holoPlane] : [];
  MATERIALS.holoFill.needsUpdate = true;
}

export function easeInOut(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
