# DP position references: RadaScan View, CyScan AS, Seastar 9410-AUT DGPS, SMT Taut Wire 2.0, SPRINT-Nav DP on the 8097 pole

First added on 2026-10-14 from public datasheets (PR #5). Rebuilt the same day to the exact models in the documents Rahul supplied:

1. Guidance Marine **RadaScan View** (combined position reference sensor and navigation radar)
2. Guidance Marine **CyScan AS** (laser)
3. **DGPS**: two **Fugro Seastar 9410-AUT** GNSS receivers
4. **SMT Taut Wire 2.0, Z Range Mk2**
5. Sonardyne **SPRINT-Nav DP** on the Sonardyne **Type 8097 modular over-the-side deployment pole**

Only those documents are used for each unit. Nothing is carried over from the original RadaScan, the older CyScan, the SMT TW-1.0 or the Fugro service page used in PR #5. No SPRINT-Nav document was supplied, so the SPRINT-Nav DP itself stays on its public Sonardyne datasheet (8388). All values and their sources live in `src/equipment/posrefData.ts`, tagged datasheet, derived or assumed.

## Sources

| Key | Document |
| --- | --- |
| radascan | RadaScan View brochure (971055613-radascanView.pdf) |
| cyscan | CyScan AS leaflet, Guidance Marine 2025 |
| seastar | Fugro Seastar 9410-AUT GNSS receiver datasheet, EUAF/MAI/092023 |
| smt | SMT Taut Wire Z Range Mk2 system specification, AD 0004-10 |
| smtManual | SMT Taut Wire 2.0 Installation Manual PJ 0044-13 (drawings SMT-TW-MD-20 GA recovered, -21 GA deployed, -28 DP offsets) |
| pole8097 | Sonardyne Deployment Pole, modular over-the-side, Type 8097 datasheet, 03/2023 |
| sprintnav | Sonardyne SPRINT-Nav DP datasheet 8388 (public, not supplied) |

## From the documents

| System | Item | Value |
| --- | --- | --- |
| RadaScan View | System | Responders, RadaScan View sensor, Dashboard software on a bridge computer |
| | Measures | Range and bearing to uniquely coded responders; adds a radar picture |
| | Range | "Radar suitable for the 500 m zone" (no maximum range stated) |
| | Environment | Rain, snow, fog, steam, dust; −25 to +55 °C |
| | Responders | CSA and ATEX certified, intrinsically safe; usable by any number of vessels |
| CyScan AS | Range | 10–2,500 m nominal; 1.9 m cylindrical target 10–400 m; prism 10–2,500 m |
| | Laser | Pulsed laser diodes, Class 1M; beam 12° × 0.13°; vertical coverage 52° |
| | Noise | Range 50 mm (resolution 0.01 m); bearing 0.2 mrad |
| | Gimbal | Single axis ±20°; wave motion compensation ±5° at 5 s; tilt ±20° |
| | Targets | 30 detectable, 9 trackable |
| | Sensor | 405 W × 407 D × 565 H mm, 28 kg, IP66, −25 to +55 °C; 85–264 VAC, 100 W max |
| Seastar 9410-AUT | Receiver | 672 channels (dual Maxwell 7); GPS, GLONASS, Galileo, BeiDou, NavIC L5 |
| | Accuracy | Seastar G4: < 10 cm horizontal, < 15 cm vertical (95 %) |
| | Corrections | Fugro L-band or NTRIP, all through one antenna; G2, G4, XP2, XP3 |
| | Unit | 270 × 140 × 70 mm, 1.82 kg; 24 V DC, 6 W; display 32 × 4 characters |
| | Outputs | NMEA GGA, GST, GSA, VTG, ZDA, GNS, GBS, RMC; 1PPS |
| | Antenna | GA 830 or AD 492 |
| SMT TW 2.0 Z Mk2 | Range | 500 m water depth, 700 m cable on the drum |
| | Weight | 400 kg depressor; unit 1600 kg (2100 kg with weight); boom SWL 575 kg |
| | Skid | 1700 (across ship) × 1600 mm; stored height 2085 mm; max 2395 mm while deploying |
| | Deployed head | 2510 mm outboard of the skid, 1059 mm above the skid base; 4485 mm overall |
| | Winch | Constant tension, vector-controlled drive, fail-safe electric brake |
| | Sensor, outputs | Gimbal head inclinometer via PLC; ±30° operating range; ±10 V / 4–20 mA; `$PCPTW` NMEA at 9600 8N1 |
| | Power | 380–460 VAC 3-phase, ≈ 13 kW max, ≈ 0.8 kW normal; UPS 220–250 V 0.5 kW |
| | Accuracy (0 m/s current) | 100 m: 0 / 0.5 / 1.2 m; 200 m: 0 / 1.7 / 2.2 m; 300 m: 0 / 3.3 / 5.5 m at 0° / 10° / 20° |
| Type 8097 pole | Length | 9190 mm from the pivot axis on the drawing (9 m nominal, 6–12 m adjustable) |
| | Sections | 3; joints at 3110 and 6170 mm; lifting lugs at 1595, 4640, 7650 mm; strakes on the lower sections |
| | Mounting | Pole axis 525 mm above the deck edge; hydraulic lock bracket welded to the hull 2415 mm below, in line with the pole |
| | Motion | Stowed horizontal along the deck edge, swung down over the side to vertical, locked (datasheet illustration) |
| | Limits, mass | 5 kn operational, 10 kn survival; 1,000 kg; galvanised steel with epoxy |
| SPRINT-Nav DP (public) | Unit | Ø225 × 346 mm titanium, 100 m rating, 375 kHz DVL, bottom lock 0.4–200 m |
| | Performance | Station keeping < 3.2 m over 12 h (1DRMS) |

## Derived from the documents

| Item | Used value | How |
| --- | --- | --- |
| RadaScan View working range | 500 m | From "suitable for the 500 m zone" |
| CyScan AS head / base split | 0.2 m base, rest head | Scaled from the leaflet photo, inside the 565 mm overall height |
| CyScan AS position noise | 0.05 m | From the 50 mm range noise |
| SMT head along-ship offset | 0.28 m from the skid centre | Scaled off SMT-TW-MD-28; its 1010 mm offset is to an undimensioned reference point |
| SMT A-frame pivot and knuckle | Pivot at the skid edge 0.23 m up; knuckle 1.16 m out, 1.41 m up when deployed | Scaled off SMT-TW-MD-21 |
| 8097 pole diameter | 0.23 m | Scaled off the datasheet drawing |

## Unverified: not in any supplied document

| Item | Used value |
| --- | --- |
| RadaScan View sensor size | Ø0.6 × 0.48 m, drawn in the proportions of the brochure photo |
| RadaScan View accuracy, lock-on time | 0.5 m noise (1σ), 6 s |
| Responder size | Box 0.26 × 0.42 × 0.2 m with handle, from the photo |
| CyScan AS lock-on time; range in fog | 4 s; 60 m |
| CyScan target diameter | 0.3 m (the 1.9 m height is from the leaflet) |
| Seastar antenna size and which option | Ø0.18 × 0.13 m, drawn from the datasheet photo; GA 830 or AD 492 not stated |
| Seastar front-panel text | Layout mock-up |
| SMT bell weight size | Ø0.55 m base, Ø0.3 m top, 0.55 m tall, from the render |
| SMT boom path between the drawn poses | Illustrative, kept under 2395 mm |
| SMT winch speed, warning angle | 0.5 m/s; 20° |
| SMT alarm codes in `$PCPTW` | 00 / 01 / 02 (the manual gives the field, not the codes) |
| SMT position noise in the 42 m scene | 0.3 m (the accuracy table starts at 100 m) |
| Bulwark opening at the taut wire | 2.6 m, so the boom can pass the deck edge |
| 8097 pole swing / lock time | 90 s / 5 s |
| SPRINT-Nav INS alignment time, DVL beam angle | 120 s, 30° |
| Placements on the vessel | RadaScan View and CyScan AS on the bridge top, antennas on the yardarm ends, taut wire on the starboard main deck at −14 m, pole on the port side at −6 m |
| Fixed platform, responder and target | 110 m astern of the starting position; a scene prop |
| Water depth | 42 m (the existing scene seabed) |

## How it works in the app

- Each system is selectable in the scene and the System Explorer and has its own panel.
- RadaScan View and CyScan AS: start, lock on, show range and bearing. RadaScan View also shows a radar picture with the responder and the platform echo. The fog switch blinds the laser, not the radar.
- DGPS: both 9410-AUT receivers show a front-panel view and their DP status; corrections can be lost per receiver.
- Taut wire: the boom swings from its recovered pose over the weight basket to the deployed pose, then the 400 kg bell weight is lowered and stays on the seabed. The panel shows the across- and along-ship angles, the `$PCPTW` sentence and the datasheet accuracy table. A warning sounds at 20° and DP drops the wire beyond ±30°.
- SPRINT-Nav DP: the 8097 pole swings down from the deck edge to vertical and the hull lock closes. Power on and the INS aligns; with DVL bottom lock it becomes a reference. Above 5 kn it is withdrawn and alarmed.
- DP: the four operator references are fitted on every class but start deselected. Select them in the sensor panel or on the DP Redundancy tab. A selected reference that is not ready raises `REF_NOT_READY`. All ready, selected references are median-voted.

Not connected to real equipment; not certified.
