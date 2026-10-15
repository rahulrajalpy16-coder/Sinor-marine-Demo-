/**
 * Generic DP2 offshore support vessel layout, in scene metres (+Y up, waterline y = 0, +Z bow, +X starboard).
 *
 * Proportions, deck levels and the arrangement are taken from a supplied general arrangement plan, used
 * strictly as a structural reference: no name, number, owner, yard or drawing identification is reproduced.
 * Values marked "scaled" were measured off the plan (1:175, 0.6 m frame spacing); they are approximate.
 *
 * Longitudinal: z = (metres forward of the aft perpendicular) − 35.5, so the hull runs z −39 … +39.
 */
export const PRINCIPAL = {
  loa: 78, // plan: length overall
  beam: 20, // plan: moulded breadth
  depth: 6.5, // plan: moulded depth to the main deck
  draft: 4.8, // plan: design draught
} as const;

/** Deck heights above the waterline (plan heights above base line − draught). Scaled except the main deck. */
export const LEVEL = {
  main: PRINCIPAL.depth - PRINCIPAL.draft, // 1.7, open aft working deck
  forecastle: 4.5,
  upper: 7.3, // top of the hull side forward of the accommodation
  officers: 10.1,
  bridge: 12.9,
  roof: 15.8, // compass deck
  helideck: 19.6,
  mastTop: 26,
} as const;

/** Aft end of the raised hull side (forecastle) and the accommodation block. Scaled. */
export const FORECASTLE_Z = 3;

/** Superstructure tiers [x half-width, z aft, z forward]. Scaled off the plan views. */
export const HOUSE = {
  upper: { half: 8, z0: 4.5, z1: 28 }, // upper deck → officers deck
  officers: { half: 7, z0: 5.5, z1: 25.5 }, // officers deck → bridge deck
} as const;

/**
 * Wheelhouse outline on the bridge deck (x ≥ 0 half, mirrored), from aft to forward. Scaled off the bridge
 * deck plan: narrow aft part with the aft windows over the working deck, wide middle, forward part with the
 * main console, chamfered front.
 */
export const WHEELHOUSE: [number, number][] = [
  [3.5, 6.5],
  [3.5, 8.5],
  [7.2, 8.5],
  [7.2, 16],
  [6, 17],
  [6, 23.4],
  [4, 24.4],
];
export const WHEELHOUSE_AFT_Z = 6.5;
export const WHEELHOUSE_FRONT_Z = 24.4;
/** Open bridge-deck platform (wings) around the wheelhouse, same convention. Scaled. */
export const BRIDGE_DECK: [number, number][] = [
  [5.5, 5.8],
  [9, 10],
  [9, 24.6],
];

/** Mast on the compass deck. Scaled: about 53 m from the stern. */
export const MAST = { z: 14, yard: LEVEL.roof + 5.4, yardHalf: 3.2 } as const;

/** Octagonal helideck on a truss forward of the bridge, overhanging the bow. Scaled: about 22 m across. */
export const HELIDECK = { z: 33.4, across: 22 } as const;

/** Bow tunnel thrusters (BT1 forward, BT2 aft), 1.3 m above the base line. Scaled. */
export const BOW_THRUSTERS = { bt1Z: 28.4, bt2Z: 25.4, y: 1.3 - PRINCIPAL.draft } as const;

/** Stern azimuth units, about 5 m from the stern. Scaled. */
export const AZIMUTHS = { z: -34, x: 4.8, y: -3.1 } as const;

/** Aft working deck: knuckle-boom crane (starboard, about 19 m from the stern) and a smaller crane near the accommodation. */
export const CRANES = { main: { x: 7.2, z: -20.5 }, aux: { x: -7.6, z: 0.5 } } as const;

/** Rescue boat at upper deck level on the starboard side. Scaled. */
export const RESCUE_BOAT = { x: 9.1, y: LEVEL.upper + 0.4, z0: 6, z1: 13 } as const;

/** Crash barrier rail around the aft working deck, above the main deck. Scaled. */
export const CRASH_RAIL_H = 2.9;
