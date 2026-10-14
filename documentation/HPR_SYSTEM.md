# HPR system: Sonardyne Type 7950 + HPT 5000

Configuration confirmed by Sinor Marine on 2026-10-14:

1. Sonardyne **Type 7950** through-hull deployment machine, standard length.
2. Sonardyne **HPT 5000** USBL transceiver, **Type 8142-000-01** ("allows both Ethernet and serial operation", UM-8142 Table 3-2).
3. The 14-inch gate valve with the seachest, sealing section, adaptor flange and hull penetration arrangement shown in the drawings.

Nothing from other Sonardyne machines, transceivers, variants (8142-000-31/-11, HPT 7000) or deployment methods (8097, 8169) is used. Every value in the app carries its source in `src/equipment/hprData.ts`.

## Verified: taken from the supplied documents

| Item | Value | Source |
| --- | --- | --- |
| Mounting space | 6.1 m high × 1.8 m wide × 1.0 m deep | 7950 mounting-space drawing |
| Standard length, datum to top support | 5,930 mm | Standard-length drawing |
| Datum to gate valve top face | 290 mm | Standard-length drawing |
| Gate valve face to top of seachest | 1,039 mm | Standard-length drawing |
| Gate valve face to the intermediate sealing-section flange | 1,254 mm | Standard-length drawing |
| Gate valve face to top-section base | 1,468 mm | Standard-length drawing |
| USBL transceiver extension below datum | 2,775 mm | Standard-length drawing |
| Hull penetrator height | minimum 150 mm (modelled at 150 mm) | Standard-length drawing |
| Gate valve | 14 inch, handwheel | Standard-length drawing |
| Assembly order | Top support, moving plate, main ram (inside pole), pole, guides, sealing section, seachest, adaptor flange, gate valve | Component drawing |
| Mounting space contents | Platform grating, ladder | Mounting-space drawing |
| Operation | Hydraulically operated pole, sealed bearing section, seachest service section with inspection door, sits on a gate valve on the hull penetration flange, controlled locally or from a remote control panel | UM-8142 Table 4-1, §4.3.3 |
| HPT 5000 frequency | MF, 19–34 kHz | UM-8142 §12.1.3 |
| Operating range | Up to 7,000 m | §12.1.3 |
| Acoustic coverage | Up to ±90° | §12.1.3 |
| Range precision | Better than 15 mm | §12.1.3 |
| Positioning repeatability | Better than 0.1 % of slant range, 1 Drms | §12.1.3 |
| Source level / TEE | 200 dB re 1 µPa @ 1 m / 206 dB | §12.1.3 |
| Electrical | 48 V dc ±10 %, typical 15 W, max 120 W | §12.1.3 |
| Communication | RS485 (baud switchable), Ethernet 100 Mbps | §12.1.3 |
| Temperatures | Operating −5 to 40 °C, storage −20 to 45 °C | §12.1.3 |
| Housing | Aluminium bronze, 322 mm long × 225 mm diameter | §12.1.3 |
| Weight | 26.7 kg in air, 15.3 kg in water | §12.1.3 |
| Mounting on the 7950 | 6G Transceiver Installation Kit 641-0197 (fixings, O-rings, isolation flange) | §4.4.2.1 |
| Orientation | Pointing down, connector at the top, black transducer face at the bottom, white arrow forward | §4.3.1 |
| Recommended depth | 2–3 m below the lowest part of the hull | §4.3.1 |

## Derived from the verified values

| Item | Value | How |
| --- | --- | --- |
| Transceiver face below the hull when deployed | 2.947 m | 2,775 − 150 + 322 mm. This meets the manual's 2–3 m recommendation |
| Pole stroke | 3.437 m | Park position (below) down to the 2,775 mm reference |
| HPR noise in the DP model | 0.1 % × slant range ≈ 3.6 cm | Manual repeatability at the scene's 35.5 m slant range |

## Scaled: measured off the standard-length drawing

The drawing scale is about 7.65 mm per pixel. Checked against the manual, the 225 mm transceiver diameter measures 214 mm, about 5 % small. These values are close but not exact:

| Item | Modelled |
| --- | --- |
| Top-section width | 0.73 m |
| Seachest width | 0.57 m |
| Sealing-section width | 0.37 m |
| Pole diameter | 0.27 m |
| Gate valve flange diameter | 0.64 m |
| Handwheel diameter | 0.35 m |
| Handwheel stem length | 0.57 m |

## Unverified: not in the supplied documents

These values are needed to draw or simulate the system. The HMI and inspector label them as illustrative, and none should be used for engineering.

- **Pole speed:** 0.10 m/s. **Valve stroke time:** 8 s. No hydraulic data, speeds, pressures or flow rates were supplied.
- **Park position:** the transceiver face sits 50 mm above the gate valve, inside the seachest.
- **Interlocks:** there are four.
  - The valve won't open while the seachest door is open.
  - The pole won't deploy unless the valve is fully open.
  - The valve won't close unless the pole is fully retracted.
  - The door only opens with the transceiver parked and the valve closed.

  These are logical safeguards for the simulation, not Sonardyne's control logic.
- **Layout in the mounting space:** the machine axis sits 0.55 m from the forward wall, the grating 4.3 m above the base plate, and the ladder on the aft wall. These were estimated from the mounting-space drawing.
- **Other parts:** the gate valve handwheel's turns, the seachest door hinge side and the bolt pattern.
- **Acoustic model:** sound speed 1,500 m/s, seabed transponder position and water depth.
- **Not modelled:** electrical ratings of the 7950, its hydraulic power unit, the local and remote control panel hardware, and the cable routing (8-way AGP tail).

## Behaviour in the app

- **Type 7950 Deployment Machine** (`deployment-001`): select it to open the deployment panel.
  - The panel has controls for Local/Remote, sim speed, the gate valve, the seachest door, Deploy, Retract, Stop, E-Stop, Reset and alarm acknowledgement, plus a side-elevation mimic.
  - The 3D gate opens and the handwheel turns, the door swings, and the moving plate, pole and transceiver travel.
  - Exploded view separates the seachest, sealing section and top section.
  - In X-ray and blueprint the pole turns translucent to show the main ram.
- **HPR · HPT 5000 USBL** (`hpr-001`): the transceiver on the pole. It shows the same panel plus the acoustic readouts.
- **DP link:** the DP model's HPR reference only measures while the transceiver is fully deployed through an open valve. Otherwise the DP panel shows HPR "NOT DEPLOYED" and raises an alarm. DP1 (GNSS1 + HPR) is then left with a single reference.
