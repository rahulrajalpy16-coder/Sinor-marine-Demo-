/** Typed contracts for the content registry. All content is illustrative, not OEM-verified. */

export type EquipmentAction =
  | 'inspect'
  | 'simulate'
  | 'reset'
  | 'show-signals'
  | 'set-thrust'
  | 'stop'
  | 'deploy'
  | 'retract'
  | 'pause';

export interface EquipmentRecord {
  id: string;
  name: string;
  category: string;
  location: string;
  model: string | null;
  simulation: string | null;
  actions: EquipmentAction[];
  manufacturer: string | null;
}

export interface EquipmentRegistry {
  version: string;
  note: string;
  equipment: EquipmentRecord[];
}

export interface VesselConfig {
  id: string;
  name: string;
  type: string;
  certified: boolean;
  dimensionsMeters: { length: number; beam: number; depth: number };
  coordinates: { up: '+Y'; bow: '+Z'; starboard: '+X'; unit: 'meter' };
  compartments: { id: string; interior: boolean }[];
  equipmentIds: string[];
}

export const VISUAL_MODES = ['hybrid', 'realistic', 'blueprint', 'xray', 'isolation', 'exploded'] as const;
export type VisualMode = (typeof VISUAL_MODES)[number];

export const QUALITY_PRESETS = ['low', 'medium', 'high'] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

export interface DesignConfig {
  project: string;
  direction: string;
  reference: string;
  colors: { background: string; ocean: string; cyan: string; cyanLight: string; text: string };
  defaultMode: VisualMode;
  modes: VisualMode[];
  features: Record<string, boolean>;
  qualityPresets: QualityPreset[];
}

/** Scene-side metadata the JSON does not carry: where each system lives on the procedural vessel. */
export interface EquipmentPlacement {
  /** Short system name for the scene indicators (e.g. "Taut Wire"). */
  short: string;
  /** Point the camera looks at when focusing (scene metres, +Y up, +Z bow, +X starboard). */
  target: [number, number, number];
  /** Camera position for the focus anchor. */
  camera: [number, number, number];
  /** True when the equipment sits below the waterline (ocean is made see-through on focus). */
  underwater: boolean;
  /** Inside a compartment (bridge): the camera orbits close, inside the room. */
  interior?: boolean;
  /** Override the interior orbit's maximum distance (tall spaces such as the 6.1 m HPR trunk). */
  interiorMaxDistance?: number;
  /** Assembly supports the exploded visual mode. */
  explodable: boolean;
  /** Phase-1 slice: the system is modelled and selectable in the scene. */
  implemented: boolean;
  summary: string;
  specs: { label: string; value: string }[];
}

export interface Equipment extends EquipmentRecord {
  placement: EquipmentPlacement;
}
