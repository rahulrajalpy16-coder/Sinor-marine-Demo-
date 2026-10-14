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

export const SOURCES = {
  radascan: 'Guidance Marine RadaScan View brochure (971055613-radascanView.pdf)',
  cyscan: 'Guidance Marine CyScan AS leaflet, 2025 (Leaflets_CyScan AS.pdf)',
  seastar: 'Fugro Seastar 9410-AUT GNSS receiver datasheet, EUAF/MAI/092023',
  smt: 'SMT Taut Wire Z Range Mk2 system specification AD 0004-10 (SMT Z Mk2.pdf)',
  smtManual: 'SMT Taut Wire 2.0 Installation Manual PJ 0044-13, drawings SMT-TW-MD-20/21/28',
  sprintnav: 'Sonardyne SPRINT-Nav DP datasheet 8388 (public; no document supplied)',
  pole8097: 'Sonardyne Deployment Pole modular over-the-side datasheet, Type 8097, 03/2023',
} as const;

/** Guidance Marine RadaScan View: combined position reference sensor and navigation radar. */
export const RADASCAN = {
  system: ds('Combined position reference sensor and navigation radar; responders, sensor and Dashboard software', 'radascan'),
  measures: ds('Range and bearing to one or more uniquely coded responders', 'radascan'),
  maxRange: der(500, 'radascan', 'The brochure calls it "radar suitable for the 500 m zone"; no maximum range is stated, so 500 m is used as the working range'),
  environment: ds('Operates through rain, snow, fog, steam and dust, −25 °C to +55 °C', 'radascan'),
  responder: ds('Uniquely coded responders; CSA and ATEX certified, intrinsically safe; multi-vessel use', 'radascan'),
  diameter: asm(0.6, 'Sensor dimensions are not in the brochure; drawn in the proportions of the brochure photo'),
  height: asm(0.48, 'Sensor dimensions are not in the brochure; drawn in the proportions of the brochure photo'),
  pedestalHeight: asm(0.6, 'Mounting pedestal on the bridge top'),
  accuracy: asm(0.5, 'No accuracy figure in the brochure; position noise 0.5 m (1σ)'),
  acquireSeconds: asm(6, 'Time to lock on to the responder after start'),
};

/** Guidance Marine CyScan AS: rotating laser ranging Absolute Signature (AS) targets. */
export const CYSCAN = {
  minRange: ds(10, 'cyscan', 'Nominal range 10–2,500 m'),
  maxRange: ds(2500, 'cyscan', 'With prism targets; 1.9 m cylindrical target 10–400 m'),
  cylinderRange: ds(400, 'cyscan', '1.9 m cylindrical target'),
  laser: ds('Pulsed laser diodes, Class 1M', 'cyscan'),
  beam: ds('12° × 0.13°', 'cyscan', 'Beam divergence; total vertical coverage 52°'),
  gimbal: ds('Single-axis ±20°; wave motion compensation ±5° at 5 s; tilt compensation ±20°', 'cyscan'),
  rangeNoise: ds(0.05, 'cyscan', 'Range noise 50 mm; resolution 0.01 m'),
  bearingNoiseMrad: ds(0.2, 'cyscan', 'Bearing noise 0.2 mrad'),
  targets: ds('Up to 30 detectable, 9 trackable', 'cyscan'),
  power: ds('85–264 VAC, 100 W max', 'cyscan'),
  interfaces: ds('Ethernet 100Base-T or RS422; DP 2 × RS422; NMEA0183 R/P, ASCII17, MDL', 'cyscan'),
  width: ds(0.405, 'cyscan', 'Sensor 405 W × 407 D × 565 H mm, 28 kg, IP66, −25 to +55 °C'),
  depth: ds(0.407, 'cyscan', 'Sensor 405 W × 407 D × 565 H mm'),
  headHeight: ds(0.565, 'cyscan', 'Overall sensor height 565 mm'),
  weight: ds(28, 'cyscan', 'Sensor, kg'),
  baseHeight: der(0.2, 'cyscan', 'Split between the white base and the rotating head scaled from the leaflet photo'),
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
  antenna: ds('GA 830 GNSS antenna or AD 492 narrow-band filter antenna', 'seastar', 'Which option is fitted is not stated'),
  antennaDiameter: asm(0.18, 'Antenna dimensions are not in the datasheet; drawn in the proportions of the datasheet photo'),
  antennaHeight: asm(0.13, 'Antenna dimensions are not in the datasheet; drawn in the proportions of the datasheet photo'),
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
  dvl: ds('Syrinx DVL, 375 kHz, up to 20 Hz', 'sprintnav'),
  altitudeMin: ds(0.4, 'sprintnav', 'Altitude 0.4–200 m in optimal conditions'),
  altitudeMax: ds(200, 'sprintnav', 'Altitude 0.4–200 m in optimal conditions'),
  stationKeeping: ds(3.2, 'sprintnav', 'DVL-aided station keeping < 3.2 m over 12 h (1DRMS), < 5.2 m R95'),
  heading: ds('0.04° (GNSS + DVL) / 0.05° secant latitude', 'sprintnav'),
  rollPitch: ds('0.01° (1DRMS)', 'sprintnav'),
  power: ds('24 V dc ±10 %, 18 W nominal, 30 W max', 'sprintnav'),
  comms: ds('RS422 / RS485, web UI, TCP/UDP; 2 PPS triggers', 'sprintnav'),
  material: ds('Titanium', 'sprintnav'),
  alignSeconds: asm(120, 'INS alignment time after power-up; not in the datasheet'),
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
// Placement on the 80 m concept vessel (vessel frame). Representative, chosen for this hull.
// ---------------------------------------------------------------------------------------------

export const DECK_Y = 3;
export const BULWARK_H = 1.1;
export const BRIDGE_TOP_Y = 12.35;
export const RADASCAN_POS: [number, number, number] = [-4.4, BRIDGE_TOP_Y, 14.2];
export const CYSCAN_POS: [number, number, number] = [4.4, BRIDGE_TOP_Y, 14.2];
/** CyScan AS on a short pedestal (assumed 0.4 m) so the beam clears the bridge-top rail. */
export const CYSCAN_PEDESTAL = 0.4;
/** One GNSS antenna per 9410-AUT receiver, on the mast yardarm ends (yard top at y 17.6, z 16). */
export const GNSS_ANTENNAS: [number, number, number][] = [
  [-3.0, 17.6, 16],
  [3.0, 17.6, 16],
];

/** Taut wire skid on the starboard main deck: outboard edge 0.1 m inside the ship side (x 9),
 *  at a bulwark opening (assumed; the boom passes the deck edge low). */
export const TAUTWIRE_Z = -14;
export const TAUTWIRE_EDGE_X = 8.9;
export const TAUTWIRE_POS: [number, number, number] = [TAUTWIRE_EDGE_X - SMT_TW.footprintX.value / 2, DECK_Y, TAUTWIRE_Z];
/** Gimbal head when deployed: 2510 mm outboard of the skid edge, 1059 mm above the skid base. */
export const TAUTWIRE_TIP: [number, number, number] = [TAUTWIRE_EDGE_X + SMT_TW.reach.value, DECK_Y + SMT_TW.headHeight.value, TAUTWIRE_Z + SMT_TW.headLateral.value];
/** Bulwark openings cut in the procedural hull for the equipment above. */
export const BULWARK_GAPS: { side: 1 | -1; z0: number; z1: number }[] = [{ side: 1, z0: TAUTWIRE_Z - 1.3, z1: TAUTWIRE_Z + 1.3 }];

/** Over-the-side pole pivot: port side, axis 525 mm above the bulwark top, just outside the hull plating. */
export const POLE_PIVOT: [number, number, number] = [-9.25, DECK_Y + BULWARK_H + POLE_8097.pivotAboveDeckEdge.value, -6];

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
