import { HELIDECK, LEVEL, WHEELHOUSE_FRONT_Z } from '../vessels/vesselLayout';

type Vec3 = [number, number, number];

/**
 * Places the VR visitor can jump to from the menu or the guided tour, in vessel coordinates (+Y up, waterline
 * y = 0, +Z bow, +X starboard). `floor` is where the feet go; `look` is the point the visitor faces on arrival.
 * The aft deck, bridge and helideck stops lie on the walkable decks (see vrDecks.test.ts); the HPR trunk and the
 * bow thruster space are below decks and can only be reached this way.
 */
export interface VRPlace {
  id: string;
  label: string;
  floor: Vec3;
  look: Vec3;
  /** The system shown at this place, if any. */
  equipmentId?: string;
}

export const VR_PLACES: VRPlace[] = [
  { id: 'aft-deck', label: 'Aft working deck', floor: [0, LEVEL.main, -26], look: [0, 8, 10] },
  { id: 'dp-console', label: 'Bridge · DP console', floor: [0.7, LEVEL.bridge, 10.6], look: [0, 14, 7.45], equipmentId: 'dp-console-001' },
  { id: 'bridge-front', label: 'Bridge · forward console', floor: [1.2, LEVEL.bridge, WHEELHOUSE_FRONT_Z - 5], look: [0, 14.1, 22.7], equipmentId: 'ibs-001' },
  { id: 'hpr-room', label: 'HPR trunk (below decks)', floor: [2.2, -4.6, 14.6], look: [0, -1.9, 11.6], equipmentId: 'deployment-001' },
  { id: 'bow-thruster', label: 'Bow thruster space', floor: [2.6, -2.3, 31.2], look: [0, -3.5, 28.4], equipmentId: 'bow-thruster-001' },
  { id: 'helideck', label: 'Helideck', floor: [0, LEVEL.helideck, HELIDECK.z - 4], look: [0, LEVEL.helideck + 1.5, 70] },
];

export const placeById = (id: string) => VR_PLACES.find((p) => p.id === id);

/** The place that shows a system, if there is one. */
export const placeForEquipment = (equipmentId: string) => VR_PLACES.find((p) => p.equipmentId === equipmentId);

/**
 * Pose of the XR origin for a place, in the unreflected follower frame the VR player lives in (vessel x negated,
 * see VRPlayer). Yaw turns the origin so the headset's forward (−Z) points at `look`.
 */
export function placePose(p: VRPlace): { position: Vec3; yaw: number } {
  const [x, y, z] = p.floor;
  const dx = -p.look[0] - -x;
  const dz = p.look[2] - z;
  return { position: [-x, y, z], yaw: Math.atan2(-dx, -dz) };
}
