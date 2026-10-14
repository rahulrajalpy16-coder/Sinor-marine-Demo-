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
  'ibs-001': {
    target: [0, 10.2, 21.4],
    camera: [1.4, 11.1, 17.6],
    underwater: false,
    interior: true,
    explodable: false,
    implemented: true,
    summary:
      'Integrated bridge system on a dual redundant network. The forward console carries five multi-function workstations (X-band radar, ECDIS, conning, ECDIS, S-band radar); any application can run on any workstation. Overhead displays, steering stand with the Z-Thrust BT1 panel, navigator chairs and chart table complete the layout.',
    specs: [
      { label: 'Workstations', value: '5 × MFW, 26" displays' },
      { label: 'Applications', value: 'ARPA radar, ECDIS, conning, ICAS, DP, cameras, thruster control' },
      { label: 'Network', value: 'Dual redundant Ethernet' },
      { label: 'Radar', value: 'X-band (port) and S-band (stbd)' },
      { label: 'Bridge type', value: 'One-man bridge operation (illustrative)' },
      { label: 'Reference', value: 'Bridge Mate IBS datasheet layout' },
    ],
  },
  'dp-console-001': {
    target: [0, 10.1, 12.95],
    camera: [0.7, 11.25, 16.3],
    underwater: false,
    interior: true,
    explodable: true,
    implemented: true,
    summary:
      'Aft-facing DP station on the bridge, overlooking the working deck. 26-inch pedestal operator stations hold the DP panel (joystick, trackball, mode keys), the display and a 19-inch rack with the DP control and operator computers. Class 2 has three voting controllers, two stations and a dual network; class 3 adds a backup station in a separate A60 room.',
    specs: [
      { label: 'Location', value: 'Bridge, aft-facing station' },
      { label: 'Console', value: '26" pedestal, 654 × 1206 mm (drawing 5000-501092)' },
      { label: 'Rack', value: 'MT computer, DP control + operator computers, PoE switch' },
      { label: 'Class options', value: 'DP1 · DP2 (default) · DP3' },
      { label: 'Thrusters', value: 'BT1 + BT2 (bow, P2 CPP), AZ1 + AZ2 (stern)' },
      { label: 'References', value: 'GNSS1, GNSS2, HPR' },
      { label: 'Simulation', value: '3-DOF educational model, not certified' },
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
  navigation: 'Bridge & Navigation',
  'dynamic-positioning': 'Dynamic Positioning',
  'position-reference': 'Position Reference',
  propulsion: 'Propulsion',
  mechanical: 'Mechanical Systems',
};
