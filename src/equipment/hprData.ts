/**
 * Sonardyne Type 7950 through-hull deployment machine (standard length) carrying a
 * Sonardyne HPT 5000 USBL transceiver, Type 8142-000-01. The configuration was confirmed by Sinor Marine.
 *
 * Every value is tagged with where it comes from:
 *  - 'drawing'  dimensioned on the supplied 7950 drawings (mounting space, standard length)
 *  - 'manual'   UM-8142 Issue C1, the HPT user manual (section 12.1.3 unless noted)
 *  - 'scaled'   measured off the standard-length drawing at its own scale (≈ 7.65 mm per pixel,
 *               checked against the manual's 225 mm transceiver diameter, which scales to 214 mm)
 *  - 'assumed'  not in the supplied documents; needed to draw or simulate, shown as unverified in the UI
 *
 * Machine-local frame: metres, +Y up along the pole axis, Y = 0 at the datum line of the standard
 * drawing (top of the hull penetrator), which sits 150 mm above the hull plating.
 */

export type Source = 'drawing' | 'manual' | 'scaled' | 'assumed';
export interface Sourced<T> {
  value: T;
  source: Source;
  note?: string;
}
const v = <T,>(value: T, source: Source, note?: string): Sourced<T> => ({ value, source, note });

export const T7950 = {
  mountingSpace: {
    height: v(6.1, 'drawing'),
    width: v(1.8, 'drawing'),
    depth: v(1.0, 'drawing'),
  },
  /** Datum to the top of the top support (standard length). */
  overall: v(5.93, 'drawing', '5,930 mm reference dimension'),
  /** Datum to the top face of the gate valve / adaptor flange stack. */
  gateStackTop: v(0.29, 'drawing', '290 mm'),
  /** Gate valve top face to the top of the seachest. */
  seachestTop: v(0.29 + 1.039, 'drawing', '1,039 mm from the gate valve face'),
  /** Gate valve top face to the intermediate sealing-section flange. */
  sealingFlange: v(0.29 + 1.254, 'drawing', '1,254 mm from the gate valve face'),
  /** Gate valve top face to the base of the top section. */
  topSectionBase: v(0.29 + 1.468, 'drawing', '1,468 mm from the gate valve face'),
  /** Hull penetrator height above the hull: the drawing gives a minimum, modelled at that minimum. */
  penetratorHeight: v(0.15, 'drawing', 'minimum 150 mm'),
  /** Datum to the deployed transceiver (USBL transceiver extension). */
  deployedExtension: v(2.775, 'drawing', '2,775 mm reference dimension'),
  gateValveNominal: v('14 inch', 'drawing'),

  topSectionWidth: v(0.73, 'scaled'),
  seachestWidth: v(0.57, 'scaled'),
  sealingWidth: v(0.37, 'scaled'),
  poleDiameter: v(0.27, 'scaled'),
  gateFlangeDiameter: v(0.64, 'scaled'),
  handwheelDiameter: v(0.35, 'scaled'),
  handwheelStem: v(0.57, 'scaled'),

  /** Gap between the transceiver face and the gate valve when parked inside the seachest. */
  parkClearance: v(0.05, 'assumed', 'park position inside the seachest is not dimensioned'),
  /** Machine axis position inside the 1.8 × 1.0 m space, from the forward wall (approximate from the drawing). */
  axisFromForwardWall: v(0.55, 'assumed', 'estimated from the mounting-space drawing'),
  /** Platform grating height above the base plate, estimated from the mounting-space drawing. */
  gratingHeight: v(4.3, 'assumed', 'estimated from the mounting-space drawing'),
} as const;

export const HPT5000 = {
  type: '8142-000-01',
  name: 'HPT 5000',
  variant: v('Allows both Ethernet and serial operation', 'manual', 'Table 3-2'),
  frequency: v('MF (19–34 kHz)', 'manual'),
  operatingRange: v('Up to 7,000 m', 'manual'),
  coverage: v('Up to ±90°', 'manual'),
  rangePrecision: v('Better than 15 mm', 'manual'),
  repeatability: v('Better than 0.1% of slant range (1 Drms)', 'manual'),
  sourceLevel: v('200 dB re 1 µPa @ 1 m', 'manual'),
  tee: v('206 dB (13 J)', 'manual', 'tone equivalent energy'),
  power: v('48 V dc (±10%), typical 15 W, max 120 W', 'manual'),
  comms: v('RS485 (baud switchable), Ethernet 100 Mbps', 'manual'),
  operatingTemp: v('-5 to 40 °C', 'manual'),
  storageTemp: v('-20 to 45 °C', 'manual'),
  construction: v('Aluminium bronze', 'manual'),
  length: v(0.322, 'manual', '322 mm'),
  diameter: v(0.225, 'manual', '225 mm'),
  weight: v('26.7 kg in air / 15.3 kg in water', 'manual'),
  installKit: v('6G Transceiver Installation Kit 641-0197 (fixings, O-rings, isolation flange)', 'manual', 'section 4.4.2.1'),
} as const;

/** Repeatability as a fraction of slant range (1 Drms), from the manual. */
export const HPT5000_REPEATABILITY = 0.001;

// Derived machine geometry (local Y, metres).
export const DATUM_TO_HULL = -T7950.penetratorHeight.value;
export const PARKED_FLANGE_Y = T7950.gateStackTop.value + T7950.parkClearance.value + HPT5000.length.value;
export const DEPLOYED_FLANGE_Y = -T7950.deployedExtension.value;
/** Pole travel between parked and fully deployed (derived; the drawings give no stroke figure). */
export const STROKE = PARKED_FLANGE_Y - DEPLOYED_FLANGE_Y;
/** Moving plate sits just under the top support when parked. */
export const TOP_SUPPORT_THICK = 0.08;
export const PARKED_PLATE_Y = T7950.overall.value - TOP_SUPPORT_THICK - 0.06;
export const POLE_LENGTH = PARKED_PLATE_Y - PARKED_FLANGE_Y;

/** Transceiver mounting flange and face heights for a given pole travel (0 = parked). */
export function transceiverY(travel: number) {
  const flange = PARKED_FLANGE_Y - travel;
  return { flange, face: flange - HPT5000.length.value };
}

/** Depth of the transceiver face below the hull plating when fully deployed. Manual 4.3.1 recommends 2–3 m. */
export const DEPLOYED_FACE_BELOW_HULL = DATUM_TO_HULL - transceiverY(STROKE).face;
