import type { DesignConfig, EquipmentAction, EquipmentRecord, EquipmentRegistry, VesselConfig, VisualMode } from './types';
import { QUALITY_PRESETS, VISUAL_MODES } from './types';

const ACTIONS: readonly EquipmentAction[] = [
  'inspect', 'simulate', 'reset', 'show-signals', 'set-thrust', 'stop', 'deploy', 'retract', 'pause',
];

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaError';
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(o: Record<string, unknown>, key: string, path: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v.length === 0) throw new SchemaError(`${path}.${key} must be a non-empty string`);
  return v;
}

function nullableStr(o: Record<string, unknown>, key: string, path: string): string | null {
  const v = o[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new SchemaError(`${path}.${key} must be a string or null`);
  return v;
}

function num(o: Record<string, unknown>, key: string, path: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new SchemaError(`${path}.${key} must be a positive number`);
  return v;
}

export function parseEquipmentRegistry(input: unknown): EquipmentRegistry {
  if (!isObj(input)) throw new SchemaError('registry must be an object');
  const list = input.equipment;
  if (!Array.isArray(list)) throw new SchemaError('registry.equipment must be an array');
  const seen = new Set<string>();
  const equipment: EquipmentRecord[] = list.map((raw, i) => {
    const path = `equipment[${i}]`;
    if (!isObj(raw)) throw new SchemaError(`${path} must be an object`);
    const id = str(raw, 'id', path);
    if (!/^[a-z0-9-]+$/.test(id)) throw new SchemaError(`${path}.id "${id}" must be lowercase kebab-case`);
    if (seen.has(id)) throw new SchemaError(`duplicate equipment id "${id}"`);
    seen.add(id);
    const actions = raw.actions;
    if (!Array.isArray(actions) || actions.some((a) => !ACTIONS.includes(a as EquipmentAction))) {
      throw new SchemaError(`${path}.actions contains an unknown action`);
    }
    return {
      id,
      name: str(raw, 'name', path),
      category: str(raw, 'category', path),
      location: str(raw, 'location', path),
      model: nullableStr(raw, 'model', path),
      simulation: nullableStr(raw, 'simulation', path),
      actions: actions as EquipmentAction[],
      manufacturer: nullableStr(raw, 'manufacturer', path),
    };
  });
  return { version: str(input, 'version', 'registry'), note: str(input, 'note', 'registry'), equipment };
}

export function parseVesselConfig(input: unknown, knownEquipment?: Set<string>): VesselConfig {
  if (!isObj(input)) throw new SchemaError('vessel must be an object');
  const dims = input.dimensionsMeters;
  if (!isObj(dims)) throw new SchemaError('vessel.dimensionsMeters must be an object');
  const coords = input.coordinates;
  if (!isObj(coords) || coords.up !== '+Y' || coords.bow !== '+Z' || coords.starboard !== '+X' || coords.unit !== 'meter') {
    throw new SchemaError('vessel.coordinates must be +Y up, +Z bow, +X starboard, metres');
  }
  if (input.certified !== false) throw new SchemaError('representative vessel must declare certified: false');
  const ids = input.equipmentIds;
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) throw new SchemaError('vessel.equipmentIds must be strings');
  if (new Set(ids).size !== ids.length) throw new SchemaError('vessel.equipmentIds must be unique');
  if (knownEquipment) {
    const missing = (ids as string[]).filter((x) => !knownEquipment.has(x));
    if (missing.length) throw new SchemaError(`vessel references unknown equipment: ${missing.join(', ')}`);
  }
  const comps = input.compartments;
  if (!Array.isArray(comps)) throw new SchemaError('vessel.compartments must be an array');
  return {
    id: str(input, 'id', 'vessel'),
    name: str(input, 'name', 'vessel'),
    type: str(input, 'type', 'vessel'),
    certified: false,
    dimensionsMeters: {
      length: num(dims, 'length', 'vessel.dimensionsMeters'),
      beam: num(dims, 'beam', 'vessel.dimensionsMeters'),
      depth: num(dims, 'depth', 'vessel.dimensionsMeters'),
    },
    coordinates: { up: '+Y', bow: '+Z', starboard: '+X', unit: 'meter' },
    compartments: comps.map((c, i) => {
      if (!isObj(c)) throw new SchemaError(`compartments[${i}] must be an object`);
      return { id: str(c, 'id', `compartments[${i}]`), interior: c.interior === true };
    }),
    equipmentIds: ids as string[],
  };
}

export function parseDesignConfig(input: unknown): DesignConfig {
  if (!isObj(input)) throw new SchemaError('design must be an object');
  const modes = input.modes;
  if (!Array.isArray(modes) || modes.some((m) => !VISUAL_MODES.includes(m as VisualMode))) {
    throw new SchemaError('design.modes contains an unknown mode');
  }
  const def = input.defaultMode;
  if (!modes.includes(def)) throw new SchemaError('design.defaultMode must be one of design.modes');
  const q = input.qualityPresets;
  if (!Array.isArray(q) || q.some((x) => !(QUALITY_PRESETS as readonly unknown[]).includes(x))) {
    throw new SchemaError('design.qualityPresets contains an unknown preset');
  }
  const colors = input.colors;
  if (!isObj(colors)) throw new SchemaError('design.colors must be an object');
  for (const k of ['background', 'ocean', 'cyan', 'cyanLight', 'text']) {
    if (typeof colors[k] !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(colors[k] as string)) {
      throw new SchemaError(`design.colors.${k} must be a #RRGGBB colour`);
    }
  }
  return input as unknown as DesignConfig;
}
