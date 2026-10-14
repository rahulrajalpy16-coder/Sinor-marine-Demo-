/**
 * DP position reference systems added alongside the HPR: Guidance Marine RadaScan and CyScan,
 * Fugro SeaSTAR DGNSS, SMT taut wire, and Sonardyne SPRINT-Nav DP on an over-the-side pole.
 *
 * No drawings or datasheets were supplied for these five, so every value comes from the
 * manufacturers' public datasheets and product pages (listed in SOURCES) or is tagged:
 *  - 'datasheet' stated in the public manufacturer document named in `doc`
 *  - 'derived'   calculated from datasheet values (the note says how)
 *  - 'assumed'   not in any document found; needed to draw or simulate, shown as unverified in the UI
 *
 * Vessel frame: metres, +Y up (waterline at 0), +Z bow, +X starboard.
 */

export type RefSource = 'datasheet' | 'derived' | 'assumed';
export interface RefValue<T> {
  value: T;
  source: RefSource;
  /** Key into SOURCES for 'datasheet' values. */
  doc?: keyof typeof SOURCES;
  note?: string;
}
const ds = <T,>(value: T, doc: keyof typeof SOURCES, note?: string): RefValue<T> => ({ value, source: 'datasheet', doc, note });
const der = <T,>(value: T, note: string): RefValue<T> => ({ value, source: 'derived', note });
const asm = <T,>(value: T, note?: string): RefValue<T> => ({ value, source: 'assumed', note });

export const SOURCES = {
  radascan: 'Guidance Marine RadaScan brochure (nauticexpo catalogue 32289-86441)',
  responders: 'Guidance Marine Responders brochure (nauticexpo catalogue 32289-57331)',
  cyscan: 'Guidance Marine CyScan brochure (nauticexpo catalogue 32289-56731)',
  seastar: 'Fugro Seastar service page (fugro.com/seastar)',
  smt: 'SMT TW-1.0 Lightweight Taut Wire datasheet (STR subsea, V3 2023-01-25)',
  sprintnav: 'Sonardyne SPRINT-Nav DP datasheet 8388 and product page',
  pole8097: 'Sonardyne Type 8097 modular over-the-side deployment pole datasheet',
} as const;

/** Guidance Marine RadaScan: FMCW microwave radar sensor ranging coded responders. */
export const RADASCAN = {
  maxRange: ds(1000, 'radascan', 'Operating range up to 1000 m'),
  band: ds('9.2–9.3 GHz FMCW', 'radascan'),
  rfPower: ds('3 W max RF output', 'radascan'),
  diameter: ds(1.2, 'radascan', 'Sensor 1.2 m diameter'),
  height: ds(0.9, 'radascan', 'Sensor 0.9 m height'),
  weight: ds(115, 'radascan', 'Sensor only, kg'),
  scan: ds('Full 360°', 'radascan'),
  targets: ds('Up to 4 (sensor software v3.0)', 'radascan'),
  responder: ds('Coded responders: Red, Yellow, Green, Blue; mains, primary cell or rechargeable', 'responders'),
  accuracy: asm(0.5, 'Range/bearing accuracy not in the public brochure; position noise 0.5 m (1σ) is illustrative'),
  acquireSeconds: asm(6, 'Time to lock on to the responder after start; illustrative'),
  pedestalHeight: asm(0.6, 'Mounting pedestal on the bridge top; illustrative'),
};

/** Guidance Marine CyScan: rotating laser ranging retro-reflective targets. */
export const CYSCAN = {
  minRange: ds(10, 'cyscan', '10 m to 2500 m, target type/environment dependent'),
  maxRange: ds(2500, 'cyscan', '10 m to 2500 m, target type/environment dependent'),
  laser: ds('Eye-safe Class 1', 'cyscan'),
  beam: ds('12° vertical × 0.13° horizontal', 'cyscan', 'Beam shape'),
  pulseRate: ds('min. 30 kHz', 'cyscan'),
  scan: ds('Full 360° horizontal', 'cyscan'),
  systemWeight: ds(61, 'cyscan', 'Kg, system including typical accessories (computer, monitor, mouse)'),
  systemSize: ds('680 × 570 × 780 mm (system)', 'cyscan'),
  targets: ds('Retro-reflective CyScan targets, true multi-target operation', 'cyscan'),
  headDiameter: asm(0.36, 'Sensor head size is not stated separately from the system; illustrative'),
  headHeight: asm(0.55, 'Sensor head size is not stated separately from the system; illustrative'),
  accuracy: asm(0.2, 'Range/bearing accuracy not in the public brochure; position noise 0.2 m (1σ) is illustrative'),
  acquireSeconds: asm(4, 'Time to lock on to the target after start; illustrative'),
  fogRangeM: asm(60, 'Usable laser range in fog or heavy rain; illustrative of optical obscuration'),
};

/** Fugro SeaSTAR DGNSS: two receivers on the DP, corrections over L-band (NTRIP as back-up). */
export const SEASTAR = {
  service: ds('Seastar G4: GPS, GLONASS, Galileo, BeiDou; 10 cm phase-based service, worldwide', 'seastar'),
  accuracy: ds(0.1, 'seastar', 'G4 and G2 services: 10 cm accuracy'),
  delivery: ds('Dual satellite broadcast links in all ocean regions; NTRIP back-up', 'seastar'),
  integrity: ds('Spatial Integrity Analysis; SatGuard navigation message authentication', 'seastar'),
  receiver: asm('Receiver model not specified', 'The Seastar page lists 9410AUT and Kongsberg DPS I1/I2/I4; none chosen'),
  antennaDiameter: asm(0.2, 'GNSS antenna size; illustrative'),
  lbandDiameter: asm(0.3, 'L-band correction antenna dome; illustrative'),
};

/** SMT TW-1.0 lightweight taut wire. */
export const SMT_TW = {
  waterDepth: ds(300, 'smt', 'Standard 300 m water depth range (500 m cable on drum); 500 m option'),
  cable: ds(500, 'smt', 'Cable on drum, m'),
  weight: ds(460, 'smt', '460 kg depressor weight on the seabed'),
  footprintX: ds(2.2, 'smt', 'Footprint 2.2 × 1.55 m'),
  footprintZ: ds(1.55, 'smt', 'Footprint 2.2 × 1.55 m'),
  storedHeight: ds(2.3, 'smt'),
  deployHeight: ds(2.8, 'smt', 'Max height while deploying'),
  reach: ds(3, 'smt', 'Overboard reach 3 m'),
  mass: ds(2300, 'smt', 'Approx. weight, kg'),
  power: ds('400–460 VAC 3-phase 50/60 Hz, 45 A feeder, ~13.5 kW; UPS 200–240 VAC 300 W', 'smt'),
  winch: ds('Constant-tension, heave-compensated electric winch', 'smt'),
  sensor: ds('Gimbal head sensor; direct and converted angles', 'smt'),
  weightDiameter: der(0.5, 'Cylinder sized for 460 kg at steel density 7,850 kg/m³ (Ø0.5 × 0.3 m)'),
  weightHeight: der(0.3, 'Cylinder sized for 460 kg at steel density 7,850 kg/m³ (Ø0.5 × 0.3 m)'),
  winchSpeed: asm(0.5, 'Lowering / hoisting speed m/s; illustrative'),
  angleWarnDeg: asm(10, 'Wire angle warning; illustrative'),
  angleLimitDeg: asm(20, 'Wire angle limit beyond which DP rejects the taut wire; illustrative'),
  accuracy: asm(0.3, 'Position noise 0.3 m (1σ) at this water depth; illustrative'),
};

/** Sonardyne SPRINT-Nav DP (INS + DVL) on a Sonardyne Type 8097 over-the-side pole. */
export const SPRINTNAV = {
  diameter: ds(0.225, 'sprintnav', '225 × 346 mm excluding deployment pole mount'),
  height: ds(0.346, 'sprintnav', '225 × 346 mm excluding deployment pole mount'),
  weight: ds('23.9 kg air / 13.1 kg water', 'sprintnav'),
  depthRating: ds(100, 'sprintnav', 'Depth rating 100 m'),
  dvl: ds('Syrinx DVL, 375 kHz, up to 20 Hz', 'sprintnav'),
  altitudeMin: ds(0.4, 'sprintnav', 'Altitude 0.4–230 m (standard, product page); datasheet gives 0.4–200 m in optimal conditions'),
  altitudeMax: ds(200, 'sprintnav', 'Modelled at the datasheet’s 200 m (product page says 230 m)'),
  stationKeeping: ds(3.2, 'sprintnav', 'DVL-aided station keeping < 3.2 m over 12 h (1DRMS), < 5.2 m R95'),
  heading: ds('0.04° (GNSS + DVL) / 0.05° secant latitude', 'sprintnav'),
  rollPitch: ds('0.01° (1DRMS)', 'sprintnav'),
  power: ds('24 V dc ±10 %, 18 W nominal, 30 W max', 'sprintnav', 'Product page: 15 W nominal, 35 W max'),
  comms: ds('RS422 / RS485, web UI, TCP/UDP; 2 PPS triggers', 'sprintnav'),
  material: ds('Titanium', 'sprintnav'),
  alignSeconds: asm(120, 'INS alignment time after power-up; not in the datasheet; illustrative'),
  noise: asm(0.05, 'Short-term position noise 0.05 m (1σ); illustrative'),
};

export const POLE_8097 = {
  length: ds(9, 'pole8097', 'Nominal deployed length 9 m from the pivot axis (6–12 m adjustable)'),
  sections: ds(3, 'pole8097', 'Standard version, 3 sections with vortex suppression strakes'),
  mass: ds(1000, 'pole8097', 'Standard 3-section version, kg'),
  maxSpeedKn: ds(5, 'pole8097', 'Max operational speed 5 kn (10 kn short-term survival)'),
  lock: ds('Heavy-duty hydraulic lock welded to the hull', 'pole8097'),
  finish: ds('Hot-dip galvanised steel, two-part marine epoxy', 'pole8097'),
  winch: ds('Winch deployment / recovery, typically customer-supplied', 'pole8097'),
  diameter: asm(0.3, 'Pole diameter not stated in the datasheet; illustrative'),
  stowGeometry: asm('Swings about an athwartships pivot from horizontal (stowed, pointing aft) to vertical', 'Rotation geometry not in the datasheet'),
  swingSeconds: asm(90, 'Swing time from stowed to deployed; illustrative'),
  lockSeconds: asm(5, 'Hydraulic lock engage time; illustrative'),
};

// ---------------------------------------------------------------------------------------------
// Placement on the 80 m concept vessel (vessel frame). Representative, chosen for this hull.
// ---------------------------------------------------------------------------------------------

export const BRIDGE_TOP_Y = 12.35;
export const RADASCAN_POS: [number, number, number] = [-4.4, BRIDGE_TOP_Y, 14.2];
export const CYSCAN_POS: [number, number, number] = [4.4, BRIDGE_TOP_Y, 14.2];
/** GNSS antennas on the mast yardarm ends (yard top at y 17.6, z 16). */
export const GNSS_ANTENNAS: [number, number, number][] = [
  [-3.0, 17.6, 16],
  [3.0, 17.6, 16],
];
export const LBAND_POS: [number, number, number] = [0, 20.3, 16];
/** Taut wire unit on the starboard main deck; outboard face at the ship side (x 9). */
export const TAUTWIRE_POS: [number, number, number] = [9 - SMT_TW.footprintX.value / 2, 3, -14];
/** Gimbal head at the end of the boom, overboard reach from the ship side. */
export const TAUTWIRE_TIP: [number, number, number] = [9 + SMT_TW.reach.value, 3 + SMT_TW.deployHeight.value, -14];
/** Over-the-side pole pivot: port side, on a hull-side mount just above the bulwark. */
export const POLE_PIVOT: [number, number, number] = [-9.8, 4.1, -6];

/** Water depth in the scene (seabed plane, matching the HPR scene). */
export const SCENE_SEABED_Y = -42;

// ---------------------------------------------------------------------------------------------
// Fixed installation for the relative sensors (scene frame: X = east, Z = north). Illustrative.
// ---------------------------------------------------------------------------------------------

/** A small fixed platform astern of the vessel's initial position, carrying the RadaScan responder
 *  and a CyScan reflective target. Not part of the supplied scope; illustrative only. */
export const PLATFORM = { east: 0, north: -110, deckY: 18, legSpread: 14 };
export const RESPONDER_WORLD: [number, number, number] = [PLATFORM.east - 3, PLATFORM.deckY - 4, PLATFORM.north + PLATFORM.legSpread / 2 + 0.6];
export const REFLECTOR_WORLD: [number, number, number] = [PLATFORM.east + 3, PLATFORM.deckY - 4, PLATFORM.north + PLATFORM.legSpread / 2 + 0.6];

export const sourceLabel = (r: RefValue<unknown>) => (r.source === 'datasheet' ? 'datasheet' : r.source === 'derived' ? 'derived' : 'illustrative');
