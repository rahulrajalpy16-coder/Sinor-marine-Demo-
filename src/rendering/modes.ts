import type { VisualMode } from '../equipment/types';

/**
 * Pure description of what each visual mode does. Renderers read this; tests assert on it.
 * Mode changes never touch the camera or the selection.
 */
export interface ModeStyle {
  label: string;
  /** Solid PBR hull: 'full' | 'split' (aft solid, forward holographic) | 'ghost' | 'hidden'. */
  hull: 'full' | 'split' | 'ghost' | 'hidden';
  hullOpacity: number;
  /** Cyan engineering linework over the hull. */
  lines: 'none' | 'forward' | 'all' | 'faint';
  lineOpacity: number;
  /** Faint cyan holographic fill where the hull is drawn as linework. */
  holoFill: number;
  oceanOpacity: number;
  gridStrength: number;
  /** Non-selected equipment is ghosted. */
  isolateSelection: boolean;
  /** Assemblies that support it are pulled apart. */
  explode: boolean;
  /** Mode only makes sense when an explodable assembly is selected. */
  requiresExplodable: boolean;
  description: string;
}

export const MODE_STYLES: Record<VisualMode, ModeStyle> = {
  hybrid: {
    label: 'Hybrid',
    hull: 'split',
    hullOpacity: 1,
    lines: 'forward',
    lineOpacity: 0.95,
    holoFill: 0.1,
    oceanOpacity: 0.9,
    gridStrength: 0.35,
    isolateSelection: false,
    explode: false,
    requiresExplodable: false,
    description: 'Realistic aft hull with a holographic engineering section forward.',
  },
  realistic: {
    label: 'Realistic',
    hull: 'full',
    hullOpacity: 1,
    lines: 'none',
    lineOpacity: 0,
    holoFill: 0,
    oceanOpacity: 0.94,
    gridStrength: 0.08,
    isolateSelection: false,
    explode: false,
    requiresExplodable: false,
    description: 'Physically based materials only.',
  },
  blueprint: {
    label: 'Blueprint',
    hull: 'hidden',
    hullOpacity: 0,
    lines: 'all',
    lineOpacity: 1,
    holoFill: 0.08,
    oceanOpacity: 0.82,
    gridStrength: 0.9,
    isolateSelection: false,
    explode: false,
    requiresExplodable: false,
    description: 'Full cyan engineering linework over a technical grid.',
  },
  xray: {
    label: 'X-ray',
    hull: 'ghost',
    hullOpacity: 0.14,
    lines: 'faint',
    lineOpacity: 0.35,
    holoFill: 0,
    oceanOpacity: 0.45,
    gridStrength: 0.25,
    isolateSelection: false,
    explode: false,
    requiresExplodable: false,
    description: 'Translucent hull and sea surface reveal internal and underwater systems.',
  },
  isolation: {
    label: 'Isolate',
    hull: 'ghost',
    hullOpacity: 0.06,
    lines: 'faint',
    lineOpacity: 0.18,
    holoFill: 0,
    oceanOpacity: 0.4,
    gridStrength: 0.15,
    isolateSelection: true,
    explode: false,
    requiresExplodable: false,
    description: 'Only the selected system is shown at full strength.',
  },
  exploded: {
    label: 'Exploded',
    hull: 'ghost',
    hullOpacity: 0.06,
    lines: 'faint',
    lineOpacity: 0.18,
    holoFill: 0,
    oceanOpacity: 0.4,
    gridStrength: 0.15,
    isolateSelection: true,
    explode: true,
    requiresExplodable: true,
    description: 'The selected assembly is pulled apart along its axis.',
  },
};

export function isModeAvailable(mode: VisualMode, selectedExplodable: boolean): boolean {
  return !MODE_STYLES[mode].requiresExplodable || selectedExplodable;
}
