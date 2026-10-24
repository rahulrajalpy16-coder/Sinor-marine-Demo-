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
      'Integrated bridge system on a dual redundant network, laid out like a DP2 offshore vessel bridge. A wraparound forward console under the front windows carries five multi-function workstations (X-band radar, ECDIS, conning, ECDIS, S-band radar), the autopilot, thruster levers and the Z-Thrust BT1 panel, with GMDSS and alarm wings either side, two navigator chairs and an overhead repeater row. The aft console wings either side of the DP station carry the aft manoeuvring levers, deck CCTV and winch panels. Only the IBS, DP and Z-Thrust items are the supplied makers; the rest is generic bridge equipment.',
    specs: [
      { label: 'Installation', value: 'Forward wraparound console (centre + chamfered wings) and aft console wings; SOLAS V/22 view ahead, MSC/Circ.982 layout, console top 1.2 m' },
      { label: 'Forward console', value: '5 × MFW, autopilot, AZ1/AZ2 + BT1/BT2 levers, Z-Thrust BT1 panel, GMDSS (port wing), alarms/BNWAS + CCTV (stbd wing)' },
      { label: 'Aft console', value: 'Aft manoeuvring levers + thruster mimic (port), deck CCTV, winch and tugger controls (stbd), DP station in the centre' },
      { label: 'Workstations', value: '5 × MFW, 26" displays' },
      { label: 'Applications', value: 'ARPA radar, ECDIS, conning, ICAS, DP, cameras, thruster control' },
      { label: 'Network', value: 'Dual redundant Ethernet' },
      { label: 'Radar', value: 'X-band (port) and S-band (stbd)' },
      { label: 'Bridge type', value: 'One-man bridge operation' },
      { label: 'Reference', value: 'Bridge Mate IBS datasheet layout' },
    ],
  },
  'dp-console-001': {
    short: 'DP Console',
    // On the starboard operator station's desk (the stations stand either side of the centreline), so a click
    // on the target lands on the equipment.
    target: [0.62, 13.7, 7.3],
    // From behind the DP chairs, high enough to see both operator stations over the headrests.
    camera: [1.4, 15.75, 10.6],
    underwater: false,
    interior: true,
    explodable: true,
    implemented: true,
    summary:
      'Aft-facing DP station on the bridge, overlooking the working deck. 26-inch pedestal operator stations hold the DP panel (joystick, trackball, mode keys) and the display; the 19-inch rack with the DP control and operator computers stands in a cabinet against the side wall. Each station has a DP operator chair on floor rails with armrest controls: the left armrest carries the independent joystick system (IJS), the right a trackball and keypad. All fitted position references are connected and in use when the vessel is on station. Class 2 has three voting controllers, two stations and a dual network; class 3 adds a backup station in a separate A60 room.',
    specs: [
      { label: 'Location', value: 'Bridge, aft-facing station with a view of the working deck and vessel side (IMO MSC.1/Circ.1580 §3.1.8); DP3 backup in an A-60 room below (§3.4.2.6)' },
      { label: 'Console', value: '26" pedestal, 653.5 W × 685.9 D × 1204.25 H mm, desk front 767 mm, cabinet 676 mm (MT drawing 5000-501092)' },
      { label: 'Rack', value: 'MT computer, DP control + operator computers, PoE switch (cabinet beside the station)' },
      { label: 'Chairs', value: 'DP operator chairs on fore-and-aft rails; IJS joystick, keys and display in the left armrest, trackball + keypad + heading knob in the right' },
      { label: 'IJS', value: 'Independent joystick system interfaced to the DP (Bridge Mate DP datasheet), own display and mode keys' },
      { label: 'Class options', value: 'DP1 · DP2 (default) · DP3' },
      { label: 'Thrusters', value: 'BT1 + BT2 (bow, P2 CPP), AZ1 + AZ2 (stern)' },
      { label: 'References', value: 'All connected and in use on station: DGPS 1/2 (SeaSTAR), HPR, RadaScan, CyScan, taut wire, SPRINT-Nav' },
      { label: 'Simulator', value: 'Surge, sway and yaw vessel model with wind, current, thruster allocation and consequence analysis' },
    ],
  },
  'hpr-001': {
    short: 'HPR',
    // Deployed transceiver, mid-body (face 2.95 m below the bottom plating at frame +12 m), seen close up from
    // starboard and forward so the Sonardyne HPT band and its Forward mark face the camera.
    target: [0, -7.55, 12],
    camera: [1.0, -7.35, 13.0],
    underwater: true,
    closeUpDistance: 0.45,
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
      { label: 'Housing', value: 'Aluminium bronze, dark navy finish, 322 × Ø225 mm; 12 × M8 on Ø210.6 mm; slotted transducer guard' },
      { label: 'Weight', value: '26.7 kg air / 15.3 kg water' },
      { label: 'Source', value: 'UM-8142 Issue C1 §12.1.3 and the HPT 5000 outline drawing' },
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
      { label: 'Max thrust (simulated)', value: '105 kN' },
      { label: 'Control system', value: 'Z-Thrust CPP control (FU / NFU, DP interface)' },
    ],
  },
  'deployment-001': {
    short: 'HPR Hoist',
    // Machine stands on the bottom plating at frame +12 m; the camera is inside the hull, in the trunk space.
    target: [0, -2.9, 11.8],
    // Looks at the starboard face, where the seachest inspection door opens on to the parked transceiver.
    camera: [5.0, -2.2, 13.6],
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
      { label: 'Stroke', value: '≈ 3.44 m' },
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
    target: [10.4, 8.4, 4.1],
    camera: [4.6, 12.4, -2.6],
    underwater: false,
    explodable: false,
    implemented: true,
    summary:
      'SMT Taut Wire 2.0, Z Range Mk2. A 400 kg depressor weight is lowered to the seabed by a constant-tension electric winch; the gimbal head on the cranked boom measures the wire angles across and along ship, which give the vessel offset from the weight. Usable within ±30°.',
    specs: [
      { label: 'Installation', value: 'Starboard upper (forecastle) deck, aft end, just aft of the rescue boat at a bulwark opening: 4 m from mid-length (near the roll centre), 21 m from BT2, opposite the pole, cable run to the bridge about 25 m (SMT manual PJ 0044-13 §3)' },
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
    closeUpDistance: 0.45,
    explodable: false,
    implemented: true,
    summary:
      'Sonardyne SPRINT-Nav DP: inertial sensors, a high-accuracy pressure sensor and a 375 kHz DVL locked on to the seabed, in one titanium housing. It initialises from GNSS, then runs independent of GNSS as the DP2 reference that does not rely on satellites. It is lowered over the port side on a Sonardyne Type 8097 three-section pole, swung down from its stowed position along the deck edge by winch and held by a hydraulic lock welded to the hull.',
    specs: [
      { label: 'Installation', value: 'Port aft main deck where the GA plan shows it: opposite side from the taut wire, 27 m forward of the azimuths' },
      { label: 'Station keeping', value: '< 2 m over 24 h, DVL aided (CEP50)' },
      { label: 'Distance travelled', value: '0.12 % straight line, 0.04 % dynamic' },
      { label: 'Unaided', value: '1.2 m in 60 s' },
      { label: 'GNSS aided', value: 'Precision up to 7× better' },
      { label: 'DVL', value: '375 kHz, bottom lock 0.4–200 m altitude, water-blocked transducers' },
      { label: 'ADCP', value: '0.4–120 m, ±8.4 m/s, 255 cells, 1 Hz' },
      { label: 'Heading / roll, pitch', value: '0.05° secant latitude / 0.01° (1DRMS)' },
      { label: 'Depth rating', value: '100 m' },
      { label: 'Unit', value: 'Ø225 × 346 mm titanium (298 mm body), 12 × M8 flange, 23.9 kg air / 13.1 kg water' },
      { label: 'Power / comms', value: '24 V dc, 18 W nominal, 30 W max; 1 × RS422, web UI, TCP/UDP, 2 PPS inputs' },
      { label: 'Initialisation', value: '10 minutes from GNSS; 5 min battery backup; > 1 week logging' },
      { label: 'Pole (Type 8097)', value: '9190 mm pivot to end, 3 sections, strakes, 1,000 kg' },
      { label: 'Pole limits', value: '5 kn operational, 10 kn survival' },
      { label: 'Source', value: 'SPRINT-Nav DP 8388 and 8097 pole datasheets (supplied)' },
    ],
  },
  'pms-001': {
    short: 'PMS',
    // Engine control room console facing the main switchboard, seen from behind the operator.
    target: [0, -0.6, -5.7],
    camera: [1.6, 0.6, -3.2],
    underwater: false,
    interior: true,
    interiorMaxDistance: 7,
    explodable: false,
    implemented: true,
    summary:
      'Power management system for a diesel-electric DP vessel. It watches every generator, breaker and consumer, starts and stops generators to match the load, shares load between running sets, keeps a power reserve for the thrusters, sheds non-essential loads before an overload and restores the plant automatically after a blackout. The single-line diagram here is live: every breaker can be opened or closed, every generator started and stopped, and faults can be injected to see how the plant and the DP system respond.',
    specs: [
      { label: 'Location', value: 'Engine control room, facing the main switchboard; repeater on the bridge' },
      { label: 'Plant', value: '4 × 1,700 kW 690 V 60 Hz main generators, split main switchboard with bus tie, 2 × 690/440 V transformers, 250 kW emergency generator (provisional values)' },
      { label: 'Functions', value: 'Auto start/stop, load sharing, standby order, thruster phase-back, priority load shedding, blackout recovery, DP power reserve' },
      { label: 'Operating modes', value: 'Open bus with one or two sets per side, or closed bus (configurable)' },
      { label: 'Interlocks', value: 'Synchronising check before closing onto a live bus; emergency generator never parallels the main plant' },
      { label: 'Status', value: 'Demonstration model: quasi-steady load flow, not an approved FMEA or electrical study' },
    ],
  },
  'gensets-001': {
    short: 'Generators',
    target: [0, -2.8, -21.0],
    camera: [0, 0.9, -10.6],
    underwater: false,
    interior: true,
    interiorMaxDistance: 13,
    explodable: false,
    implemented: true,
    summary:
      'Four main diesel generator sets in the engine room: G1 and G2 on the port side feed switchboard section A, G3 and G4 on the starboard side feed section B. Each set is a medium-speed diesel engine driving an alternator on a common skid. The status lamp on each local panel shows the live state from the power management system: green on the board, amber running or starting, red tripped.',
    specs: [
      { label: 'Location', value: 'Engine room on the tank top, port pair and starboard pair either side of the centre walkway (z −28 to −13.5 m)' },
      { label: 'Rating', value: '1,700 kWe / 2,125 kVA each, 690 V, 60 Hz, PF 0.8 (provisional: vessel data not supplied)' },
      { label: 'Start to load', value: 'About 13 s to run up, synchronise and close, then a 10 s load ramp (provisional)' },
      { label: 'Supply', value: 'G1 + G2 → MSB-A, G3 + G4 → MSB-B; cooling and fuel pumps on the 440 V board of the same side' },
      { label: 'Protection', value: 'Overload trip above 105 % for 5 s; trip after 60 s without auxiliaries' },
    ],
  },
  'msb-001': {
    short: 'Switchboard',
    target: [0, -0.2, -8.6],
    camera: [0.6, 1.0, -1.6],
    underwater: false,
    interior: true,
    interiorMaxDistance: 9,
    explodable: false,
    implemented: true,
    summary:
      'Main 690 V switchboard in two sections joined by the bus-tie breaker. Section A (port) carries G1, G2, azimuth AZ1, bow thruster BT1 and transformer A; section B carries G3, G4, AZ2, BT2 and transformer B. The 440 V boards A and B stand behind it. With the bus tie open, a fault on one side cannot take down the other, which is how a DP2 vessel keeps half its thrusters after the worst single failure. The lamp on each cubicle shows its breaker live from the simulation.',
    specs: [
      { label: 'Location', value: 'Switchboard room forward of the engine room, below the main deck' },
      { label: 'Sections', value: 'MSB-A and MSB-B, 690 V 60 Hz, bus tie between them' },
      { label: 'Distribution', value: '440 V boards A and B through 690/440 V transformers, with a normally open 440 V tie' },
      { label: 'Bus philosophy', value: 'Open bus by default (configurable to closed bus): to be confirmed for the real vessel' },
    ],
  },
  'emergency-gen-001': {
    short: 'Emergency Gen',
    target: [-6.0, 8.0, 6.6],
    camera: [-1.6, 9.6, 10.4],
    underwater: false,
    interior: true,
    interiorMaxDistance: 8,
    explodable: false,
    implemented: true,
    summary:
      'Emergency generator and emergency switchboard in their own room above the main deck. The emergency board is normally fed from 440 V board A. If it goes dead, the emergency generator starts by itself and takes the emergency lighting, navigation and communications and the emergency fire pump. It never runs in parallel with the main plant: when main power is back and stable the board transfers back.',
    specs: [
      { label: 'Location', value: 'Emergency generator room, upper deck, port aft corner of the accommodation' },
      { label: 'Rating', value: '250 kW, 440 V (provisional)' },
      { label: 'Start', value: 'Automatic on a dead emergency board; model reaches load in about 11 s' },
      { label: 'Interlock', value: 'No parallel operation with the main supply (46 CFR 112.05-3 as summarised in USCG PRG E2)' },
      { label: 'Requirement cited', value: 'Automatic start and full load within 45 s (46 CFR 112.50-1(d), via USCG PRG E2): the model meets it' },
    ],
  },
  'ups-001': {
    short: 'DP UPS',
    target: [-0.55, 10.9, 8.9],
    camera: [0, 11.8, 13.4],
    underwater: false,
    interior: true,
    interiorMaxDistance: 8,
    explodable: false,
    implemented: true,
    summary:
      'Uninterruptible power supplies for the DP system. UPS A feeds the A side (controller A, operator station 1, network A, DGPS 1, gyro 1, MRU 1, wind sensor 1 and the A-side thruster controls); UPS B feeds the B side. Shared items such as gyro 3 and controller C take both. If the 440 V supply is lost the batteries carry the DP equipment with no break. On DP3 a third UPS in the A60 backup room feeds the backup station.',
    specs: [
      { label: 'Location', value: 'Separate UPS rooms A (port) and B (starboard) on the officers deck; UPS C in the A60 backup DP room (DP3)' },
      { label: 'Type', value: 'Online double conversion: rectifier, battery, inverter, static bypass, external maintenance bypass' },
      { label: 'Rating', value: 'A/B 5 kVA, battery 108 × 2 V 12 Ah; C 3 kVA, 9 Ah (provisional)' },
      { label: 'Autonomy', value: 'Each DP UPS at least 30 min (ABS DPS Guide Pt 3 Ch 9 as summarised); the model gives well over 30 min at the mapped load' },
      { label: 'Lessons modelled', value: 'IMCA DPE 03/19 (failure of a DP UPS) and DPE 04/18 (isolation of backup supplies)' },
    ],
  },
  'wind-001': {
    short: 'Wind Sensors',
    target: [0, 25.3, 14],
    camera: [3.2, 26.6, 18.2],
    underwater: false,
    explodable: false,
    implemented: true,
    summary:
      'Two ultrasonic wind sensors on a cross-arm near the top of the mast, one each side so at least one is always clear of the mast wake. The DP uses their reading to push against the wind before the vessel moves. What they measure is kept separate from the real wind: if both fail, the wind still pushes the vessel, but DP loses its feed-forward and must wait for the position error.',
    specs: [
      { label: 'Location', value: 'Mast cross-arm about 25 m above the waterline, above the radars and clear of the GNSS antennas' },
      { label: 'Type', value: 'Generic 2-axis ultrasonic anemometer, NMEA MWV at 1 Hz (make not supplied)' },
      { label: 'Supply', value: 'Sensor 1 from UPS A, sensor 2 from UPS B' },
      { label: 'Checks', value: 'Stale (3 s), no data (9 s), frozen output, disagreement (3 kn or 20 %, 20° for 5 s); windward sensor preferred' },
    ],
  },
  'gyro-mru-001': {
    short: 'Gyros & MRUs',
    target: [0, 10.8, 12.6],
    camera: [1.6, 11.8, 15.4],
    underwater: false,
    interior: true,
    interiorMaxDistance: 6,
    explodable: false,
    implemented: true,
    summary:
      'Three gyrocompasses in the gyro room give DP its heading; the DP takes the middle value of the three, so a single wrong gyro is voted out. Two motion reference units low in the hull near midships measure roll and pitch so the position references can be corrected for the vessel motion.',
    specs: [
      { label: 'Location', value: 'Gyro room on the officers deck under the bridge; MRUs on the tank top near midships' },
      { label: 'Voting', value: 'Median of three with 2° rejection; two left: average with a deviation alarm; one left: alarm' },
      { label: 'Supply', value: 'Gyro 1 and MRU 1 from UPS A, gyro 2 and MRU 2 from UPS B, gyro 3 from both' },
      { label: 'Type', value: 'Generic (makes not supplied)' },
    ],
  },
  'azimuth-001': {
    short: 'Azimuths',
    target: [-4.8, -4.3, -34],
    camera: [8, -2.6, -45],
    underwater: true,
    explodable: false,
    implemented: true,
    summary:
      'Two azimuth thrusters at the stern, AZ1 port and AZ2 starboard. Each can turn its propeller to push in any direction, so together with the bow thrusters the DP can move the vessel sideways, forwards and around. AZ1 is powered from switchboard section A, AZ2 from section B.',
    specs: [
      { label: 'Location', value: 'Stern, 4.8 m either side of the centreline, about 5 m from the transom' },
      { label: 'Rating', value: '1,800 kW, 250 kN each (provisional)' },
      { label: 'Power', value: 'AZ1 drive on MSB-A, AZ2 on MSB-B; thrust limited by the PMS phase-back' },
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
  electrical: 'Power & Electrical',
  'dp-sensors': 'Heading & Wind Sensors',
};
