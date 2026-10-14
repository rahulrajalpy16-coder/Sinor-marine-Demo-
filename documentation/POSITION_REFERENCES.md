# DP position references: RadaScan, CyScan, DGPS, taut wire, SPRINT-Nav DP

Added on 2026-10-14 alongside the HPR (see [HPR_SYSTEM.md](HPR_SYSTEM.md)). Requested systems:

1. Guidance Marine **RadaScan** (microwave radar)
2. Guidance Marine **CyScan** (laser)
3. **DGPS** with **Fugro SeaSTAR** corrections
4. **Taut wire** from **SMT** (modelled as the SMT TW-1.0 lightweight taut wire)
5. Sonardyne **SPRINT-Nav DP** with an **over-the-side deployment system** (modelled as the Sonardyne Type 8097 modular over-the-side pole)

No drawings or datasheets were supplied for these five. Every value below comes from the manufacturers' public datasheets or product pages, or is marked illustrative. All values and their sources live in `src/equipment/posrefData.ts`. Where Sinor Marine has its own documents for the installed units, those should replace these values.

## Sources used

| Key | Document |
| --- | --- |
| radascan | Guidance Marine RadaScan brochure (nauticexpo catalogue 32289-86441) |
| responders | Guidance Marine Responders brochure (32289-57331) |
| cyscan | Guidance Marine CyScan brochure (32289-56731) |
| seastar | Fugro Seastar service page, fugro.com/seastar |
| smt | SMT TW-1.0 Lightweight Taut Wire datasheet, STR subsea, V3 2023-01-25 |
| sprintnav | Sonardyne SPRINT-Nav DP datasheet (8388) and product page |
| pole8097 | Sonardyne Type 8097 modular over-the-side deployment pole datasheet |

## From the datasheets

| System | Item | Value |
| --- | --- | --- |
| RadaScan | Range | Up to 1,000 m |
| | Band, RF output | 9.2–9.3 GHz FMCW, 3 W max |
| | Sensor | Ø1.2 m × 0.9 m, 115 kg, 360° scan, up to 4 responders (s/w v3.0) |
| | Responders | Coded Red / Yellow / Green / Blue; mains, primary cell or rechargeable |
| CyScan | Range | 10–2,500 m (target and environment dependent) |
| | Laser | Eye-safe Class 1, pulse rate min. 30 kHz, beam 12° vertical × 0.13° horizontal, 360° |
| | System | 680 × 570 × 780 mm, 61 kg including computer, monitor, mouse |
| Fugro SeaSTAR | Service | G4: GPS, GLONASS, Galileo, BeiDou; 10 cm phase-based, worldwide |
| | Delivery, integrity | Dual satellite links in all ocean regions, NTRIP back-up; Spatial Integrity Analysis, SatGuard |
| SMT TW-1.0 | Water depth | 300 m standard (500 m cable on drum); 500 m option (700 m cable) |
| | Depressor weight | 460 kg |
| | Unit | Footprint 2.2 × 1.55 m, 2.3 m stored, 2.8 m max while deploying, 3 m overboard reach, ≈ 2,300 kg |
| | Power | 400–460 VAC 3-phase 50/60 Hz, 45 A feeder, ≈ 13.5 kW; UPS 200–240 VAC 300 W |
| | Winch, sensor | Constant-tension, heave-compensated electric winch; gimbal head sensor |
| SPRINT-Nav DP | Unit | Ø225 × 346 mm (excluding pole mount), titanium, 23.9 kg air / 13.1 kg water, 100 m rating |
| | Performance | Station keeping < 3.2 m over 12 h (1DRMS), < 5.2 m R95; heading 0.04°; roll/pitch 0.01° |
| | DVL | Syrinx 375 kHz, up to 20 Hz, altitude 0.4–200 m (datasheet; product page says 230 m) |
| | Power, comms | 24 V dc, 18 W nominal / 30 W max (product page: 15 / 35 W); RS422/485, TCP/UDP, 2 PPS inputs |
| Type 8097 pole | Length | 9 m nominal from the pivot axis (6–12 m adjustable) |
| | Build | 3 sections with vortex-suppression strakes, 1,000 kg, galvanised steel with epoxy |
| | Limits | 5 kn operational, 10 kn short-term survival |
| | Lock, winch | Hydraulic lock welded to the hull; winch typically customer-supplied |

## Illustrative: not in any document found

| Item | Used value |
| --- | --- |
| RadaScan / CyScan position accuracy | 0.5 m / 0.2 m noise (1σ) |
| RadaScan / CyScan lock-on time | 6 s / 4 s |
| CyScan sensor head size | Ø0.36 × 0.55 m |
| CyScan range in fog or heavy rain | 60 m |
| Fugro receiver model | Not specified; antennas drawn generic (Ø0.2 m GNSS, Ø0.3 m L-band) |
| Taut wire winch speed | 0.5 m/s |
| Taut wire angle warning / limit | 10° / 20° |
| Taut wire noise | 0.3 m (1σ) |
| Depressor weight shape | Ø0.5 × 0.3 m cylinder (460 kg of steel) |
| Taut wire boom | Telescopic, luffing; reach measured from the ship side |
| Pole diameter | 0.3 m |
| Pole swing geometry | Athwartships pivot, stowed horizontal pointing aft, swings to vertical |
| Pole swing / lock time | 90 s / 5 s |
| SPRINT-Nav INS alignment time | 120 s |
| DVL beam angle (drawing only) | 30° |
| Placements on the vessel | RadaScan and CyScan on the bridge top, antennas on the mast, taut wire on the starboard main deck at frame −14 m, pole on the port side at frame −6 m |
| Fixed platform, responder and reflector | 110 m astern of the starting position; a scene prop for the relative sensors |
| Water depth | 42 m (the existing scene seabed) |

## How it works in the app

- Each system is selectable in the scene and the System Explorer and has its own panel.
- RadaScan and CyScan: start, lock on, show range and bearing to the target; the fog switch blinds the laser but not the radar.
- DGPS: both receivers are shown with their DP status; corrections can be lost per receiver.
- Taut wire: lower the weight, which lands and stays fixed on the seabed; the wire angle and offset follow the vessel as DP moves it, with warning and limit alarms.
- SPRINT-Nav DP: deploy the pole, which swings out, then the hydraulic lock engages. Power on and the INS aligns. With DVL bottom lock it becomes a reference. Above 5 kn it is withdrawn and alarmed.
- DP: the four new references are fitted on every class but start deselected. Select them in the sensor panel or on the DP Redundancy tab. A selected reference that is not ready raises `REF_NOT_READY`.
- Voting: all ready, selected references are median-voted, so with seven references a drifting one is rejected. SPRINT-Nav also drifts slowly (datasheet rate, 3.2 m per 12 h).

Not connected to real equipment; not certified.
