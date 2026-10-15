import registryJson from '../data/equipment-registry.json';
import vesselJson from '../data/vessel-config.json';
import designJson from '../data/design-config.json';
import { parseDesignConfig, parseEquipmentRegistry, parseVesselConfig } from './schema';
import type { Equipment, EquipmentPlacement } from './types';

export const registry = parseEquipmentRegistry(registryJson);
export const vessel = parseVesselConfig(vesselJson, new Set(registry.equipment.map((e) => e.id)));
export const design = parseDesignConfig(designJson);

/**
 * Where each system sits on the procedural vessel (generic 78 m DP2 vessel laid out from the supplied GA plan,
 * see vesselLayout.ts). Positions are representative; they are not engineering drawings.
 */
export const PLACEMENTS: Record<string, EquipmentPlacement> = {
  'ibs-001': {
    short: 'IBS',
    target: [0, 14.1, 22.7],
    camera: [1.4, 15.0, 18.9],
    underwater: false,
    interior: true,
    explodable: false,
    implemented: true,
    summary:
      'Integrated bridge system on a dual redundant network. The forward console carries five multi-function workstations (X-band radar, ECDIS, conning, ECDIS, S-band radar); any application can run on any workstation. Overhead displays, steering stand with the Z-Thrust BT1 panel, navigator chairs and chart table complete the layout.',
    specs: [
      { label: 'Installation', value: 'Wheelhouse forward console, centreline; SOLAS V/22 view ahead, MSC/Circ.982 layout' },
      { label: 'Workstations', value: '5 × MFW, 26" displays' },
      { label: 'Applications', value: 'ARPA radar, ECDIS, conning, ICAS, DP, cameras, thruster control' },
      { label: 'Network', value: 'Dual redundant Ethernet' },
      { label: 'Radar', value: 'X-band (port) and S-band (stbd)' },
      { label: 'Bridge type', value: 'One-man bridge operation (illustrative)' },
      { label: 'Reference', value: 'Bridge Mate IBS datasheet layout' },
    ],
  },
  'dp-console-001': {
    short: 'DP Console',
    target: [0, 14.0, 7.45],
    camera: [0.7, 15.15, 10.8],
    underwater: false,
    interior: true,
    explodable: true,
    implemented: true,
    summary:
      'Aft-facing DP station on the bridge, overlooking the working deck. 26-inch pedestal operator stations hold the DP panel (joystick, trackball, mode keys), the display and a 19-inch rack with the DP control and operator computers. Class 2 has three voting controllers, two stations and a dual network; class 3 adds a backup station in a separate A60 room.',
    specs: [
      { label: 'Location', value: 'Bridge, aft-facing station with a view of the working deck and vessel side (IMO MSC.1/Circ.1580 §3.1.8); DP3 backup in an A-60 room below (§3.4.2.6)' },
      { label: 'Console', value: '26" pedestal, 654 × 1206 mm (drawing 5000-501092)' },
      { label: 'Rack', value: 'MT computer, DP control + operator computers, PoE switch' },
      { label: 'Class options', value: 'DP1 · DP2 (default) · DP3' },
      { label: 'Thrusters', value: 'BT1 + BT2 (bow, P2 CPP), AZ1 + AZ2 (stern)' },
      { label: 'References', value: 'DGPS 1/2 (SeaSTAR), HPR, RadaScan, CyScan, taut wire, SPRINT-Nav' },
      { label: 'Simulation', value: '3-DOF educational model, not certified' },
    ],
  },
  'hpr-001': {
    short: 'HPR',
    // Deployed transceiver face, 2.95 m below the bottom plating at frame +12 m.
    target: [0, -7.7, 12],
    camera: [5.2, -8.4, 18.2],
    underwater: true,
    explodable: false,
    implemented: true,
    summary:
      'Sonardyne HPT 5000 USBL transceiver (Type 8142-000-01), deployed through the hull by the Type 7950 machine. It measures range and bearing to seabed transponders and is one of the DP position references. It can only measure while fully deployed through an open gate valve.',
    specs: [
      { label: 'Installation', value: 'Centreline, z +12 m: 13 m aft of BT2, far from the azimuths; transceiver 2.9 m below the keel (UM-8142: 2–3 m, away from thrusters and aeration)' },
      { label: 'Type', value: '8142-000-01 HPT 5000 (Ethernet and serial)' },
      { label: 'Frequency', value: 'MF, 19–34 kHz' },
      { label: 'Operating range', value: 'Up to 7,000 m' },
      { label: 'Acoustic coverage', value: 'Up to ±90°' },
      { label: 'Range precision', value: 'Better than 15 mm' },
      { label: 'Repeatability', value: '< 0.1 % of slant range (1 Drms)' },
      { label: 'Source level', value: '200 dB re 1 µPa @ 1 m' },
      { label: 'Power', value: '48 V dc ±10 %, 15 W typ, 120 W max' },
      { label: 'Comms', value: 'RS485, Ethernet 100 Mbps' },
      { label: 'Housing', value: 'Aluminium bronze, 322 × Ø225 mm' },
      { label: 'Weight', value: '26.7 kg air / 15.3 kg water' },
      { label: 'Source', value: 'UM-8142 Issue C1 §12.1.3' },
    ],
  },
  'bow-thruster-001': {
    short: 'Bow Thruster',
    target: [0, -3.5, 28.4],
    camera: [19, 2.4, 40.4],
    underwater: true,
    explodable: true,
    implemented: true,
    summary:
      'P2 standard bow thruster: a fixed transverse tunnel with a controllable-pitch propeller driven by a constant-speed electric motor. Blade pitch, set from the Z-Thrust CPP control system, decides how hard and to which side it pushes the bow. It has no azimuth steering.',
    specs: [
      { label: 'Location', value: 'Bow, BT1 at +28.4 m (BT2 at +25.4 m), per the GA plan: as far forward as the hull allows, tunnel top well below the waterline' },
      { label: 'Type', value: 'Tunnel, controllable pitch (CPP)' },
      { label: 'Drive', value: '800 kW electric motor, constant speed' },
      { label: 'Tunnel / blades', value: 'Ø2.1 m, 4 blades' },
      { label: 'Propeller speed', value: '300 rpm (fixed)' },
      { label: 'Max thrust (illustrative)', value: '105 kN' },
      { label: 'Control system', value: 'Z-Thrust CPP control (FU / NFU, DP interface)' },
    ],
  },
  'deployment-001': {
    short: 'HPR Hoist',
    // Machine stands on the bottom plating at frame +12 m; the camera is inside the hull, in the trunk space.
    target: [0, -1.9, 11.6],
    camera: [4.2, -1.0, 19.4],
    underwater: true,
    interior: true,
    interiorMaxDistance: 11,
    explodable: true,
    implemented: true,
    summary:
      'Sonardyne Type 7950 through-hull deployment machine, standard length. A hydraulically operated pole runs through a sealed bearing (sealing) section and a seachest service section with an inspection door. The machine sits on a 14-inch gate valve on the flange of the hull penetration, and lowers the HPT 5000 to its working depth. Controlled locally or from a remote panel.',
    specs: [
      { label: 'Installation', value: 'Dedicated trunk above the hull penetration and 14" gate valve, centreline z +11.6 m' },
      { label: 'Mounting space', value: '6.1 m H × 1.8 m W × 1.0 m D' },
      { label: 'Standard length', value: '5,930 mm (datum to top support)' },
      { label: 'Transceiver extension', value: '2,775 mm below datum' },
      { label: 'Hull penetrator', value: 'Min. 150 mm high (modelled at 150)' },
      { label: 'Gate valve', value: '14 inch, handwheel operated' },
      { label: 'Stack (from gate valve face)', value: 'Seachest 1,039 · sealing flange 1,254 · top section 1,468 mm' },
      { label: 'Deployed face below hull', value: '≈ 2.95 m (derived)' },
      { label: 'Stroke', value: '≈ 3.44 m (derived, park position assumed)' },
      { label: 'Hydraulics / speed', value: 'Not in supplied data (simulation speed illustrative)' },
      { label: 'Source', value: '7950 drawings, UM-8142 §4.3' },
    ],
  },
  'radascan-001': {
    short: 'RadaScan',
    target: [-4.6, 14.2, 6.4],
    camera: [-9.8, 16.4, 0.4],
    underwater: false,
    explodable: false,
    implemented: true,
    summary:
      'Guidance Marine RadaScan View: a combined position reference sensor and navigation radar for the 500 m zone. It measures range and bearing to uniquely coded responders on a fixed or moving structure, so DP holds position relative to that structure, and adds a radar picture to the Dashboard. Radar is not blinded by fog, rain or steam. In the scene the responder is on an illustrative platform astern.',
    specs: [
      { label: 'Installation', value: "Port aft corner of the bridge deck on a 1.1 m plinth: clear view astern, level with the responders, 9 m from and 4.6 m below the S-band radar, panel facing forward (installer's guide 94-0492-4-A)" },
      { label: 'System', value: 'Responders, RadaScan View sensor, Dashboard software' },
      { label: 'Measures', value: 'Range and bearing to coded responders' },
      { label: 'Working range', value: '"Suitable for the 500 m zone"; no maximum stated' },
      { label: 'Environment', value: 'Rain, snow, fog, steam, dust; −25 to +55 °C' },
      { label: 'Responders', value: 'Coded; CSA and ATEX certified; multi-vessel' },
      { label: 'Sensor', value: 'Ø500 × 410 mm; 240 × 240 mm plate, 4 × M8' },
      { label: 'Clearance', value: '800 mm above, 1000 mm around' },
      { label: 'Unverified', value: 'Accuracy, lock-on time, plinth height' },
      { label: 'Source', value: 'RadaScan View brochure and installer’s guide (supplied)' },
    ],
  },
  'cyscan-001': {
    short: 'CyScan',
    target: [4.6, 14.3, 6.4],
    camera: [9.8, 16.2, 0.6],
    underwater: false,
    explodable: false,
    implemented: true,
    summary:
      'Guidance Marine CyScan AS: a rotating Class 1M laser that measures range and bearing to Absolute Signature targets. A relative position reference with high precision, but fog, heavy rain or spray can block the beam. Use the fog switch in its panel to see the difference from RadaScan View.',
    specs: [
      { label: 'Installation', value: "Starboard aft corner of the bridge deck on a 1.1 m plinth: clear view astern, 9 m from the radars (≥ 5 m rule), clear of the exhausts, access cover facing the bow (installer's guide 94-0559-C)" },
      { label: 'Range', value: '10–2,500 m (prism); about 300 m (1.9 m cylinder)' },
      { label: 'Noise', value: 'Range 50 mm, bearing 0.2 mrad' },
      { label: 'Laser / beam', value: 'Class 1M pulsed diodes, 12° × 0.13°' },
      { label: 'Gimbal', value: '±20°, wave compensation ±5° at 5 s' },
      { label: 'Targets', value: '30 detectable, 9 trackable' },
      { label: 'Sensor', value: '405 × 407 × 563 mm, 28 kg, IP66; 4 × M8 on 190 × 360' },
      { label: 'Power', value: '85–264 VAC, 100 W max' },
      { label: 'Source', value: 'CyScan AS leaflet and installer’s guide (supplied)' },
    ],
  },
  'dgps-001': {
    short: 'SeaStar GNSS',
    target: [0, 21.9, 14],
    camera: [6, 24.2, 7.5],
    underwater: false,
    explodable: false,
    implemented: true,
    summary:
      'Two Fugro Seastar 9410-AUT DGNSS receivers (DGPS 1 and DGPS 2 in the DP), each with one Trimble GA830 antenna on the mast yardarm. Corrections arrive over L-band or NTRIP through the same antenna. These are the absolute position references; DP votes them against the others.',
    specs: [
      { label: 'Installation', value: 'Mast yardarm ends, 6 m apart: open sky, out of both radar beams and about 3.5 m from the radar centres (IMO SN/Circ.227: ≥ 3 m, out of the beam)' },
      { label: 'Receiver', value: 'Seastar 9410-AUT, 672 channels' },
      { label: 'Constellations', value: 'GPS, GLONASS, Galileo, BeiDou' },
      { label: 'Accuracy (G4)', value: '< 10 cm horizontal, < 15 cm vertical (95 %)' },
      { label: 'Outputs', value: 'NMEA GGA, GST, GSA, VTG, ZDA, GNS, GBS, RMC; 1PPS' },
      { label: 'Unit', value: '270 × 140 × 70 mm, 1.82 kg, 24 V DC 6 W' },
      { label: 'Antenna', value: 'Trimble GA830, Ø149 × 99 mm, 0.82 kg, 5/8" mount' },
      { label: 'Source', value: 'Seastar 9410-AUT datasheet (supplied); Trimble GA830 datasheet' },
    ],
  },
  'tautwire-001': {
    short: 'Taut Wire',
    target: [10.6, 2.9, -6],
    camera: [5.2, 6.8, 0.2],
    underwater: false,
    explodable: false,
    implemented: true,
    summary:
      'SMT Taut Wire 2.0, Z Range Mk2. A 400 kg depressor weight is lowered to the seabed by a constant-tension electric winch; the gimbal head on the cranked boom measures the wire angles across and along ship, which give the vessel offset from the weight. Usable within ±30°.',
    specs: [
      { label: 'Installation', value: 'Starboard main deck, 6 m aft of midships at a bulwark opening: near the roll centre, clear of thrusters, opposite the pole, within crane reach (SMT manual PJ 0044-13 §3)' },
      { label: 'Water depth', value: '500 m (700 m cable on drum)' },
      { label: 'Depressor weight', value: '400 kg' },
      { label: 'Skid / height', value: '1700 × 1600 mm; 2085 mm stored, 2395 mm deploying' },
      { label: 'Gimbal head', value: '2510 mm outboard, 1059 mm up (deployed)' },
      { label: 'Mass', value: '1600 kg (2100 kg with weight)' },
      { label: 'Power', value: '380–460 VAC 3-ph, ≈ 13 kW max, 0.8 kW normal' },
      { label: 'Output', value: '±30° range; $PCPTW NMEA, 4–20 mA, ±10 V' },
      { label: 'Source', value: 'SMT Z Range Mk2 spec and TW 2.0 manual (supplied)' },
    ],
  },
  'sprintnav-001': {
    short: 'SPRINT-Nav',
    target: [-10.8, -1.7, -7.4],
    camera: [-26, 2.2, 3],
    underwater: true,
    explodable: false,
    implemented: true,
    summary:
      'Sonardyne SPRINT-Nav DP: inertial sensors and a pressure sensor aided by a 375 kHz DVL locked on to the seabed, giving a GNSS-independent position reference in shallow water. It is lowered over the port side on a Sonardyne Type 8097 three-section pole, swung down from its stowed position along the deck edge by winch and held by a hydraulic lock welded to the hull.',
    specs: [
      { label: 'Installation', value: 'Port aft main deck where the GA plan shows it: opposite the taut wire, 27 m forward of the azimuths' },
      { label: 'Station keeping', value: '< 3.2 m over 12 h (1DRMS), < 5.2 m R95' },
      { label: 'DVL', value: '375 kHz, bottom lock 0.4–200 m altitude' },
      { label: 'Heading / roll, pitch', value: '0.04° / 0.01°' },
      { label: 'Depth rating', value: '100 m' },
      { label: 'Unit', value: 'Ø225 × 346 mm titanium, 23.9 kg air' },
      { label: 'Power / comms', value: '24 V dc, 18 W nominal; 1 × RS422, TCP/UDP' },
      { label: 'Initialisation', value: '10 minutes from GNSS; 5 min battery backup' },
      { label: 'Pole (Type 8097)', value: '9190 mm pivot to end, 3 sections, strakes, 1,000 kg' },
      { label: 'Pole limits', value: '5 kn operational, 10 kn survival' },
      { label: 'Source', value: 'SPRINT-Nav DP 8388 and 8097 pole datasheets (supplied)' },
    ],
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
