import { HELIDECK, LEVEL, PRINCIPAL, WHEELHOUSE_AFT_Z, WHEELHOUSE_FRONT_Z } from '../vessels/vesselLayout';

/**
 * Walkable areas for VR teleport, in vessel coordinates (+Y up, waterline y = 0, +Z bow, +X starboard).
 * Rectangles are [x half-width, z aft, z forward] at a deck height; the helideck is a disc.
 * Kept inside rails and bulkheads so a teleport never lands the visitor in a wall or outboard.
 */
export interface DeckRect {
  id: string;
  label: string;
  y: number;
  half: number;
  z0: number;
  z1: number;
}

export const VR_DECKS: DeckRect[] = [
  // Aft working deck, inside the crash barrier, from the stern rail to the accommodation front.
  { id: 'aft-deck', label: 'Aft working deck', y: LEVEL.main, half: PRINCIPAL.beam / 2 - 1, z0: -38, z1: 2.5 },
  // Wheelhouse floor, between the aft windows and the forward console.
  { id: 'bridge', label: 'Bridge', y: LEVEL.bridge, half: 5.5, z0: WHEELHOUSE_AFT_Z + 2.5, z1: WHEELHOUSE_FRONT_Z - 2 },
];

export const VR_HELIDECK = { id: 'helideck', label: 'Helideck', y: LEVEL.helideck, z: HELIDECK.z, radius: HELIDECK.across / 2 - 1 };

/** Where the visitor stands on entering VR: aft working deck, centreline, looking forward at the superstructure. */
export const VR_SPAWN = { position: [0, LEVEL.main, -26] as [number, number, number], yaw: Math.PI };

/** True when a vessel-space point lies on a walkable area (within 5 cm of its deck height). */
export function isWalkable([x, y, z]: [number, number, number]): boolean {
  const onRect = VR_DECKS.some((d) => Math.abs(y - d.y) < 0.05 && Math.abs(x) <= d.half && z >= d.z0 && z <= d.z1);
  const h = VR_HELIDECK;
  const onHeli = Math.abs(y - h.y) < 0.05 && Math.hypot(x, z - h.z) <= h.radius;
  return onRect || onHeli;
}
