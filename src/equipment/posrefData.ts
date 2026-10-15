/**
 * DP position reference systems added alongside the HPR, matched to the documents Rahul supplied
 * on 2026-10-14 (see SOURCES): Guidance Marine RadaScan View and CyScan AS, Fugro Seastar 9410-AUT
 * DGNSS receivers, SMT Taut Wire 2.0 (Z Range Mk2), and Sonardyne SPRINT-Nav DP on a Sonardyne
 * Type 8097 modular over-the-side pole. No SPRINT-Nav document was supplied, so it stays on the
 * public Sonardyne datasheet.
 *
 * Every value is tagged:
 *  - 'datasheet' stated in the document named in `doc`
 *  - 'derived'   calculated or scaled from that document (the note says how)
 *  - 'assumed'   not in any supplied document; needed to draw or simulate, shown as unverified in the UI
 * Values are never mixed across models: nothing here comes from the original RadaScan, the older
 * CyScan or the SMT TW-1.0.
 *
 * Vessel frame: metres, +Y up (waterline at 0), +Z bow, +X starboard.
 */

export type RefSource = 'datasheet' | 'derived' | 'assumed';
export interface RefValue<T> {
  value: T;
  source: RefSource;
  /** Key into SOURCES for 'datasheet' and 'derived' values. */
  doc?: keyof typeof SOURCES;
  note?: string;
}
const ds = <T,>(value: T, doc: keyof typeof SOURCES, note?: string): RefValue<T> => ({ value, source: 'datasheet', doc, note });
const der = <T,>(value: T, doc: keyof typeof SOURCES, note: string): RefValue<T> => ({ value, source: 'derived', doc, note });
const asm = <T,>(value: T, note?: string): RefValue<T> => ({ value, source: 'assumed', note });

import { LEVEL, MAST, PRINCIPAL } from '../vessels/vesselLayout';

export const SOURCES = {
  radascan: 'Guidance Marine RadaScan View brochure (971055613-radascanView.pdf)',
  radascanGuide: 'Guidance Marine RadaScan View Installer’s Guide 94-0492-4-A',
  cyscan: 'Guidance Marine CyScan AS leaflet, 2025 (Leaflets_CyScan AS.pdf)',
  cyscanGuide: 'Guidance Marine CyScan AS Installer’s Guide 94-0559-C',
  ga830: 'Trimble GA830 GNSS antenna datasheet, PN 44830-00 (public; Rahul confirmed the GA830 is fitted)',
  seastar: 'Fugro Seastar 9410-AUT GNSS receiver datasheet, EUAF/MAI/092023',
  smt: 'SMT Taut Wire Z Range Mk2 system specification AD 0004-10 (SMT Z Mk2.pdf)',
  smtManual: 'SMT Taut Wire 2.0 Installation Manual PJ 0044-13, drawings SMT-TW-MD-20/21/28',
  sprintnav: 'Sonardyne SPRINT-Nav DP datasheet 8388, 09/2026 (supplied)',
  pole8097: 'Sonardyne Deployment Pole modular over-the-side datasheet, Type 8097, 03/2023',
} as const;

/** Guidance Marine RadaScan View: combined position reference sensor and navigation radar. */
export const RADASCAN = {
  system: ds('Combined position reference sensor and navigation radar; responders, sensor and Dashboard software', 'radascan'),
  measures: ds('Range and bearing to one or more uniquely coded responders', 'radascan'),
  maxRange: der(500, 'radascan', 'The brochure calls it "radar suitable for the 500 m zone"; no maximum range is stated, so 500 m is used as the working range'),
  environment: ds('Operates through rain, snow, fog, steam and dust, −25 °C to +55 °C', 'radascan'),
  responder: ds('Uniquely coded responders; CSA and ATEX certified, intrinsically safe; multi-vessel use', 'radascan'),
  diameter: ds(0.5, 'radascanGuide', 'Sensor Ø500 mm'),
  height: ds(0.41, 'radascanGuide', 'Sensor height 410 mm'),
  mountHoles: ds(0.24, 'radascanGuide', 'Mounting holes 240 × 240 mm, 4 × M8; plinth rated for 25 kg'),
  clearance: ds('800 mm above for radome removal, 1000 mm clear around', 'radascanGuide'),
  connectionPanel: ds('Connection panel and information display underneath on one side, facing away from the operating area', 'radascanGuide'),
  mounting: ds('Mount at a different level from the X-band radars; plinth or universal rail bracket 20-0120-1', 'radascanGuide'),
  responderMount: ds('Responders on outside corners, 2 m below to 5 m above the sensor, longest side vertical, on a swivel bracket', 'radascanGuide'),
  pedestalHeight: asm(1.1, 'Plinth height on the bridge deck, chosen to clear the deck rail and put the sensor level with the responders; the guide gives the plate, not the plinth height'),
  accuracy: asm(0.5, 'No accuracy figure in the brochure; position noise 0.5 m (1σ)'),
  acquireSeconds: asm(6, 'Time to lock on to the responder after start'),
};

/** Guidance Marine CyScan AS: rotating laser ranging Absolute Signature (AS) targets. */
export const CYSCAN = {
  minRange: ds(10, 'cyscan', 'Nominal range 10–2,500 m'),
  maxRange: ds(2500, 'cyscan', 'With prism targets; 1.9 m cylindrical target 10–400 m'),
  cylinderRange: ds(300, 'cyscanGuide', '1.9 m cylindrical target usable to about 300 m per the installer’s guide; the leaflet says 400 m, so the lower figure is used'),
  laser: ds('Pulsed laser diodes, Class 1M', 'cyscan'),
  beam: ds('12° × 0.13°', 'cyscan', 'Beam divergence; total vertical coverage 52°'),
  gimbal: ds('Single-axis ±20°; wave motion compensation ±5° at 5 s; tilt compensation ±20°', 'cyscan'),
  rangeNoise: ds(0.05, 'cyscan', 'Range noise 50 mm; resolution 0.01 m'),
  bearingNoiseMrad: ds(0.2, 'cyscan', 'Bearing noise 0.2 mrad'),
  targets: ds('Up to 30 detectable, 9 trackable', 'cyscan'),
  power: ds('85–264 VAC, 100 W max', 'cyscan'),
  interfaces: ds('Ethernet 100Base-T or RS422; DP 2 × RS422; NMEA0183 R/P, ASCII17, MDL', 'cyscan'),
  width: ds(0.405, 'cyscanGuide', 'Base 405 mm wide'),
  depth: ds(0.407, 'cyscanGuide', 'Base 327 mm deep plus the 80 mm access-cover box (407 mm overall)'),
  baseDepth: ds(0.327, 'cyscanGuide', 'Base depth without the access-cover box'),
  headHeight: ds(0.563, 'cyscanGuide', 'Height 563 mm from the mounting plate (leaflet: 565 mm)'),
  boltPattern: ds('190 × 360 mm, 4 × Ø9 (M8)', 'cyscanGuide'),
  clearance: ds('857 × 705 mm zone; 150 mm at the sides, 300 mm in front of the access cover', 'cyscanGuide'),
  mounting: ds('Flat horizontal surface rated for 30 kg, normally above the wheelhouse, at least 5 m horizontally from VHF and radar antennas', 'cyscanGuide'),
  weight: ds(28, 'cyscan', 'Sensor, kg'),
  baseHeight: der(0.2, 'cyscanGuide', 'Split between the base box and the rotor scaled from the guide drawing'),
  accuracy: der(0.05, 'cyscan', 'Position noise from the 50 mm range noise; the 0.2 mrad bearing noise adds 0.02 m at 100 m'),
  acquireSeconds: asm(4, 'Time to lock on to the target after start'),
  fogRangeM: asm(60, 'Usable laser range in fog or heavy rain; not in the leaflet'),
};

/** Fugro Seastar 9410-AUT DGNSS receiver (two fitted, one per DP GNSS input). */
export const SEASTAR = {
  receiver: ds('Seastar 9410-AUT, 672 channels, dual Maxwell 7 chipset', 'seastar'),
  constellations: ds('GPS, GLONASS, Galileo, BeiDou (and NavIC L5); Fugro L-band DGNSS service', 'seastar'),
  service: ds('Preloaded with Seastar G4; also G2, XP2, XP3', 'seastar'),
  accuracy: ds(0.1, 'seastar', 'Seastar G4 horizontal < 10 cm (95 %), vertical < 15 cm (95 %)'),
  vertical: ds(0.15, 'seastar', 'Seastar G4 vertical < 15 cm (95 %)'),
  corrections: ds('L-band, or internet (NTRIP); all through one antenna', 'seastar'),
  outputs: ds('NMEA GGA, GST, GSA, VTG, ZDA, GNS, GBS, RMC; 1PPS', 'seastar'),
  display: ds('32 characters × 4 rows, keypad, web interface', 'seastar'),
  power: ds('24 V DC, 6 W typical', 'seastar'),
  size: ds('270 × 140 × 70 mm, 1.82 kg', 'seastar'),
  antenna: ds('Trimble GA830 GNSS antenna (one per receiver)', 'ga830', 'Confirmed by Rahul; one of the two options listed on the 9410-AUT datasheet'),
  antennaDiameter: ds(0.149, 'ga830', 'Ø149 mm'),
  antennaHeight: ds(0.099, 'ga830', 'Height 99 mm'),
  antennaWeight: ds(0.82, 'ga830', 'kg'),
  antennaMount: ds('5/8"-11 UNC pole thread or 3 × M8 surface mount; TNC connector; −40 to +70 °C', 'ga830'),
  antennaApc: ds(0.0885, 'ga830', 'L1 phase centre 88.5 mm above the mount base'),
  antennaColour: asm('Light grey radome, dark grey base', 'Colour is not given in the datasheet; drawn from the product photo'),
};

/** SMT Taut Wire 2.0, Z Range Mk2. */
export const SMT_TW = {
  waterDepth: ds(500, 'smt', '500 m water depth range'),
  cable: ds(700, 'smt', '700 m galvanised cable installed on the drum'),
  weight: ds(400, 'smt', '400 kg depressor weight'),
  footprintX: ds(1.7, 'smt', 'Footprint 1700 × 1600 mm; 1700 across ship, in the boom direction (drawing SMT-TW-MD-21)'),
  footprintZ: ds(1.6, 'smt', 'Footprint 1700 × 1600 mm; 1600 along ship'),
  storedHeight: ds(2.085, 'smt', 'Stored height 2085 mm (2083 on drawing SMT-TW-MD-20)'),
  deployHeight: ds(2.395, 'smt', 'Max height while deploying 2395 mm'),
  reach: ds(2.51, 'smt', 'Overboard reach 2510 mm'),
  headHeight: ds(1.059, 'smtManual', 'Deployed gimbal head 1059 mm above the skid base (drawing SMT-TW-MD-28)'),
  headLateral: der(0.28, 'smtManual', 'Head offset from the skid centreline along ship, scaled off drawing SMT-TW-MD-28 (the 1010 mm offset is to an undimensioned reference point)'),
  deployedLength: ds(4.485, 'smtManual', 'Overall length when deployed 4485 mm'),
  consoleHeight: ds(1.9, 'smtManual', 'Control cabinet top 1900 mm (drawings SMT-TW-MD-20/21)'),
  mass: ds(1600, 'smt', 'Unit 1600 kg; 2100 kg with the clump weight'),
  swl: ds(575, 'smtManual', 'Boom SWL 575 kg; dynamic load test 720 kg, static brake test 865 kg'),
  power: ds('380–460 VAC 3-phase, ≈ 13 kW / 22 A max (43 A Type D breaker), ≈ 0.8 kW normal; UPS 220–250 V 0.5 kW', 'smt'),
  winch: ds('Constant-tension electric winch, full vector-controlled variable speed drive, fail-safe electric brake', 'smt'),
  sensor: ds('Gimbal head sensor with inclinometer; direct and converted angles; PLC to DP', 'smt'),
  outputs: ds('±10 V / 4–20 mA (±45° span, ±30° operating); NMEA $PCPTW on RS232/422/485 at 9600 8N1; rope length 0–700 m', 'smtManual'),
  hmi: ds('Local and bridge 9" wide-aspect colour touch HMIs', 'smt'),
  environment: ds('Deck −25 to +50 °C, IP56', 'smt'),
  angleLimitDeg: ds(30, 'smt', 'Operating range ±30°'),
  /** Position accuracy at 0 m/s current, m, by water depth (rows) and wire angle 0°/10°/20° (columns). */
  accuracyTable: ds(
    [
      { depth: 100, err: [0, 0.5, 1.2] },
      { depth: 200, err: [0, 1.7, 2.2] },
      { depth: 300, err: [0, 3.3, 5.5] },
    ],
    'smt',
    'Accuracy table, current 0 m/s',
  ),
  weightDiameter: asm(0.55, 'Bell weight size is not stated; drawn in the proportions of the datasheet render'),
  weightTopDiameter: asm(0.3, 'Bell weight size is not stated; drawn in the proportions of the datasheet render'),
  weightHeight: asm(0.55, 'Bell weight size is not stated; drawn in the proportions of the datasheet render'),
  winchSpeed: asm(0.5, 'Lowering / hoisting speed m/s; not stated'),
  angleWarnDeg: asm(20, 'No warning threshold is stated; the datasheet accuracy table stops at 20°'),
  accuracy: asm(0.3, 'Position noise 0.3 m (1σ) in the 42 m scene; the datasheet table starts at 100 m'),
};

/** Sonardyne SPRINT-Nav DP (INS + DVL). Public datasheet; no document supplied. */
export const SPRINTNAV = {
  diameter: ds(0.225, 'sprintnav', '225 × 346 mm excluding deployment pole mount'),
  height: ds(0.346, 'sprintnav', '225 × 346 mm excluding deployment pole mount'),
  weight: ds('23.9 kg air / 13.1 kg water', 'sprintnav'),
  depthRating: ds(100, 'sprintnav', 'Depth rating 100 m'),
  dvl: ds('375 kHz DVL / ADCP, up to 20 Hz (DVL), fully water-blocked endcap', 'sprintnav'),
  adcp: ds('Current profiling 0.4–120 m (optional upgrade)', 'sprintnav'),
  altitudeMin: ds(0.4, 'sprintnav', 'Altitude 0.4–200 m in optimal conditions'),
  altitudeMax: ds(200, 'sprintnav', 'Altitude 0.4–200 m in optimal conditions'),
  stationKeeping: ds(3.2, 'sprintnav', 'DVL-aided station keeping < 3.2 m over 12 h (1DRMS), < 5.2 m R95'),
  heading: ds('0.04° (GNSS + DVL) / 0.05° secant latitude', 'sprintnav'),
  rollPitch: ds('0.01° (1DRMS)', 'sprintnav'),
  power: ds('24 V dc ±10 %, 18 W nominal, 30 W max', 'sprintnav'),
  comms: ds('1 × RS422, web UI, TCP/UDP; 2 PPS triggers', 'sprintnav'),
  battery: ds('Li-ion backup, 5 min', 'sprintnav'),
  unaided: ds('1.2 m after 60 s, 1 nm after 45 min without aiding', 'sprintnav'),
  heave: ds('5 cm', 'sprintnav'),
  operating: ds('−5 to +50 °C', 'sprintnav'),
  material: ds('Titanium', 'sprintnav'),
  alignSeconds: ds(600, 'sprintnav', 'Initialisation 10 min'),
  noise: asm(0.05, 'Short-term position noise 0.05 m (1σ)'),
};

/** Sonardyne Type 8097 modular over-the-side deployment pole, standard 3-section version. */
export const POLE_8097 = {
  length: ds(9.19, 'pole8097', 'Pivot axis to pole end 9190 mm on the datasheet drawing; nominal deployed length 9 m (6–12 m adjustable)'),
  /** Section ends measured from the pivot axis (drawing): 3110, 6170, 9190 mm. */
  sectionEnds: ds([3.11, 6.17, 9.19], 'pole8097', 'Joint positions from the pivot axis on the datasheet drawing'),
  /** Lifting lugs at each section's centre of mass (drawing): 1595, 4640, 7650 mm. */
  lugs: ds([1.595, 4.64, 7.65], 'pole8097', 'Lifting lugs at each section’s centre of mass'),
  stowSupports: ds([2.67, 4.64], 'pole8097', 'Deck stands under the stowed pole on the drawing (local stiffening may be required)'),
  pivotAboveDeckEdge: ds(0.525, 'pole8097', 'Pole axis 525 mm above the deck edge (drawing)'),
  lockBelowPivot: ds(2.415, 'pole8097', 'Hull lock bracket 2415 mm below the pole axis, vertically aligned with the pole (drawing)'),
  sections: ds(3, 'pole8097', 'Standard version, 3 sections with vortex suppression strakes'),
  mass: ds(1000, 'pole8097', 'Standard 3-section version, kg'),
  maxSpeedKn: ds(5, 'pole8097', 'Max operational speed 5 kn (10 kn short-term survival), with a Sonardyne transceiver'),
  lock: ds('Heavy-duty hydraulically operated lock welded to the hull', 'pole8097'),
  finish: ds('Hot-dip galvanised steel, two-part marine epoxy', 'pole8097'),
  winch: ds('Winch deployment / recovery, typically customer-supplied', 'pole8097'),
  motion: ds('Stowed horizontal along the deck edge, swung down over the side to vertical and locked to the hull bracket', 'pole8097', 'From the datasheet’s three-step illustration'),
  diameter: der(0.23, 'pole8097', 'Pole diameter is not stated; scaled off the datasheet drawing'),
  swingSeconds: asm(90, 'Swing time from stowed to deployed; not stated'),
  lockSeconds: asm(5, 'Hydraulic lock engage time; not stated'),
};

// ---------------------------------------------------------------------------------------------
// Placement on the generic 78 m vessel (vessel frame, see vesselLayout.ts). Representative.
// ---------------------------------------------------------------------------------------------

export const DECK_Y = LEVEL.main;
export const BULWARK_H = 1.1;
/** Ship side at the aft working deck (half the moulded breadth). */
export const SHIP_SIDE_X = PRINCIPAL.beam / 2;
export const BRIDGE_TOP_Y = LEVEL.roof;
/**
 * RadaScan View (port) and CyScan AS (starboard) on plinths at the aft corners of the bridge deck, facing the
 * operating area astern. Installer's guides: unobstructed view towards the targets (the open working deck),
 * level with the responders, a different level from the X-band radar and at least 5 m horizontally from the
 * S/X-band radars and VHF antennas (here about 9 m, and 4.6 m below the S-band), clear of the exhaust outlets
 * (5.6 m forward and 4 m higher), connection panel and access cover facing forward, away from the operating area.
 */
export const RADASCAN_POS: [number, number, number] = [-4.6, LEVEL.bridge, 6.4];
export const CYSCAN_POS: [number, number, number] = [4.6, LEVEL.bridge, 6.4];
/** CyScan AS plinth (assumed 1.1 m) so the beam clears the bridge-deck rail at responder height. */
export const CYSCAN_PEDESTAL = 1.1;
/** One GA830 antenna per 9410-AUT receiver, on the mast yardarm ends. */
export const GNSS_ANTENNAS: [number, number, number][] = [
  [-3.0, MAST.yard + 0.1, MAST.z],
  [3.0, MAST.yard + 0.1, MAST.z],
];

/**
 * Taut wire skid on the starboard main deck, outboard edge 0.1 m inside the ship side at a bulwark opening.
 * SMT manual §3.1: as close as possible to the roll centre (here 6 m aft of midships, the nearest clear deck to
 * the accommodation front), well clear of the thrusters (31 m from BT2, 28 m from the azimuths), on the side
 * opposite other over-side equipment (the SPRINT-Nav pole is to port) and within reach of the deck crane for the
 * 2100 kg lift (14.5 m from the main crane). The along-ship position is a judgement; the plan does not show it.
 */
export const TAUTWIRE_Z = -6;
export const TAUTWIRE_EDGE_X = SHIP_SIDE_X - 0.1;
export const TAUTWIRE_POS: [number, number, number] = [TAUTWIRE_EDGE_X - SMT_TW.footprintX.value / 2, DECK_Y, TAUTWIRE_Z];
/** Gimbal head when deployed: 2510 mm outboard of the skid edge, 1059 mm above the skid base. */
export const TAUTWIRE_TIP: [number, number, number] = [TAUTWIRE_EDGE_X + SMT_TW.reach.value, DECK_Y + SMT_TW.headHeight.value, TAUTWIRE_Z + SMT_TW.headLateral.value];
/** Bulwark openings cut in the procedural hull for the equipment above. */
export const BULWARK_GAPS: { side: 1 | -1; z0: number; z1: number }[] = [{ side: 1, z0: TAUTWIRE_Z - 1.3, z1: TAUTWIRE_Z + 1.3 }];

/** Over-the-side pole pivot: port side of the aft main deck (where the GA plan shows the SPRINT-Nav DP),
 *  axis 525 mm above the bulwark top, just outside the hull plating. */
export const POLE_PIVOT: [number, number, number] = [-(SHIP_SIDE_X + 0.25), DECK_Y + BULWARK_H + POLE_8097.pivotAboveDeckEdge.value, -7];
/** Openings in the crash barrier rail: the taut wire boom and the stowed pole. */
export const CRASH_RAIL_GAPS: { side: 1 | -1; z0: number; z1: number }[] = [
  ...BULWARK_GAPS,
  { side: -1, z0: POLE_PIVOT[2] - POLE_8097.length.value - 0.6, z1: POLE_PIVOT[2] + 0.8 },
];

/** Water depth in the scene (seabed plane, matching the HPR scene). */
export const SCENE_SEABED_Y = -42;

// ---------------------------------------------------------------------------------------------
// Fixed installation for the relative sensors (scene frame: X = east, Z = north). Illustrative.
// ---------------------------------------------------------------------------------------------

/** A small fixed platform astern of the vessel's initial position, carrying the RadaScan responder
 *  and a CyScan AS target. Not part of the supplied scope; illustrative only. */
export const PLATFORM = { east: 0, north: -110, deckY: 18, legSpread: 14 };
export const RESPONDER_WORLD: [number, number, number] = [PLATFORM.east - 3, PLATFORM.deckY - 4, PLATFORM.north + PLATFORM.legSpread / 2 + 0.6];
export const REFLECTOR_WORLD: [number, number, number] = [PLATFORM.east + 3, PLATFORM.deckY - 4, PLATFORM.north + PLATFORM.legSpread / 2 + 0.6];

export const sourceLabel = (r: RefValue<unknown>) => (r.source === 'datasheet' ? 'datasheet' : r.source === 'derived' ? 'derived' : 'illustrative');
