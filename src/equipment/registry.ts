import registryJson from '../data/equipment-registry.json';
import vesselJson from '../data/vessel-config.json';
import designJson from '../data/design-config.json';
import { parseDesignConfig, parseEquipmentRegistry, parseVesselConfig } from './schema';
import type { Equipment, EquipmentPlacement } from './types';

export const registry = parseEquipmentRegistry(registryJson);
export const vessel = parseVesselConfig(vesselJson, new Set(registry.equipment.map((e) => e.id)));
export const design = parseDesignConfig(designJson);

/**
 * Where each system sits on the procedural vessel. Positions are representative,
 * chosen for legibility on an 80 m concept hull; they are not engineering drawings.
 */
export const PLACEMENTS: Record<string, EquipmentPlacement> = {
  'dp-console-001': {
    target: [0, 10, 21.6],
    camera: [2.6, 11.4, 15.2],
    underwater: false,
    explodable: false,
    implemented: true,
    summary:
      'Operator station for the dynamic positioning system on the forward bridge. It is where position and heading set-points are entered and thruster allocation is monitored.',
    specs: [
      { label: 'Location', value: 'Bridge, forward centreline' },
      { label: 'Role', value: 'Position & heading set-points' },
      { label: 'Redundancy class', value: 'Illustrative DP2 layout' },
      { label: 'Simulation', value: '3-DOF educational model (Phase 3)' },
    ],
  },
  'hpr-001': {
    target: [0, -6.4, 12],
    camera: [15, -9, 27],
    underwater: true,
    explodable: false,
    implemented: true,
    summary:
      'Hull-mounted hydroacoustic position reference transducer on a retractable pole below the keel. It measures range and bearing to seabed transponders.',
    specs: [
      { label: 'Location', value: 'Under hull, frame ~ +12 m' },
      { label: 'Measurement', value: 'Two-way acoustic range (illustrative)' },
      { label: 'Range model', value: 'r = c · t_round / 2' },
      { label: 'Simulation', value: 'Acoustic ranging (Phase 3)' },
    ],
  },
  'bow-thruster-001': {
    target: [0, -2.4, 31],
    camera: [19, 1.5, 43],
    underwater: true,
    explodable: true,
    implemented: true,
    summary:
      'P2 standard bow thruster: a fixed transverse tunnel with a controllable-pitch propeller driven by a constant-speed electric motor. Blade pitch, set from the Z-Thrust CPP control system, decides how hard and to which side it pushes the bow. It has no azimuth steering.',
    specs: [
      { label: 'Location', value: 'Bow, frame ~ +31 m' },
      { label: 'Type', value: 'Tunnel, controllable pitch (CPP)' },
      { label: 'Drive', value: '800 kW electric motor, constant speed' },
      { label: 'Tunnel / blades', value: 'Ø2.1 m, 4 blades' },
      { label: 'Propeller speed', value: '300 rpm (fixed)' },
      { label: 'Max thrust (illustrative)', value: '105 kN' },
      { label: 'Control system', value: 'Z-Thrust CPP control (FU / NFU, DP interface)' },
    ],
  },
  'deployment-001': {
    target: [0, -5, -6],
    camera: [16, -6, 8],
    underwater: true,
    explodable: false,
    implemented: false,
    summary: 'Retractable sensor deployment mechanism. Planned for Phase 4 with a validated state machine.',
    specs: [{ label: 'Status', value: 'Planned (Phase 4)' }],
  },
};

export const equipment: Equipment[] = registry.equipment.map((rec) => {
  const placement = PLACEMENTS[rec.id];
  if (!placement) throw new Error(`No placement for equipment ${rec.id}`);
  return { ...rec, placement };
});

export const equipmentById = new Map(equipment.map((e) => [e.id, e]));

export function getEquipment(id: string): Equipment | undefined {
  return equipmentById.get(id);
}

export const CATEGORY_LABELS: Record<string, string> = {
  'dynamic-positioning': 'Dynamic Positioning',
  'position-reference': 'Position Reference',
  propulsion: 'Propulsion',
  mechanical: 'Mechanical Systems',
};
