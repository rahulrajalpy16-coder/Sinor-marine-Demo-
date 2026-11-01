# OEM systems showcase: caption sources

Every caption in the showcase video comes from the OEM document named below (the datasheets Rahul supplied). Brand names are set as text; no official logo files are used.

Captions are set in `showcase.json`. Advantages are datasheet lines, shortened, never changed in value.

## Marine Technologies: Bridge Mate DP
Source: Marine Technologies, Bridge Mate Dynamic Positioning, MT-SAL-0004 v2.0

How it works:
1. Sensors and position references feed the DP control computers
2. The computers work out the thrust that holds position and heading
3. Distributed IO units pass the commands to every thruster

Key advantages:
- **3** control computers with majority voting in DP2
- **Redundant** at all levels in DP2: a single failure will not lose position
- **Less cable** distributed IO units sit close to thrusters and sensors

## Marine Technologies: Bridge Mate IBS
Source: Marine Technologies, Bridge Mate Integrated Bridge System, MT-SAL-0009 v2.0

How it works:
1. Radar, ECDIS, conning and more run on multi-function workstations
2. Every application is available on any workstation
3. Routes, charts, radar and sensor data are shared across the bridge

Key advantages:
- **Dual** redundant network with no single point of failure
- **One-man** bridge operation, to IMO and class requirements
- **No fans** and no hard disks: durable marine-approved computers

## Amphicos: Z-Thrust
Source: Amphicos Engineering Services, Z-Thrust brochure

How it works:
1. PLC based control for thrusters, propulsion and steering
2. Works with DP, autopilot and joystick systems
3. Monitors key parameters and keeps equipment within safe limits

Key advantages:
- **Load clipping** prevents overloading of the power source
- **Redundant** redundancy for critical systems
- **One place** complete SCADA monitoring of the system

## Fugro: Seastar 9410-AUT
Source: Fugro, Seastar 9410-AUT GNSS receiver datasheet (EUAF/MAI/092023)

How it works:
1. Tracks GPS, GLONASS, Galileo and BeiDou satellites
2. Applies Fugro Seastar corrections by L-band satellite or internet
3. Sends a corrected position to the DP system

Key advantages:
- **<10 cm** horizontal accuracy with Seastar G4 (95%)
- **672** channels for simultaneous satellite tracking
- **4** constellations: more resistance to ionospheric scintillation

## Sonardyne: Type 7950 + HPT 5000
Source: Sonardyne UM-8142 Issue C1, §4.3 and §12.1.3 (Type 8142-000-01)

How it works:
1. The Type 7950 lowers the transceiver through the hull
2. The HPT 5000 interrogates a transponder on the seabed
3. Range and bearing of the reply give the vessel's position

Key advantages:
- **7,000 m** operating range
- **±90°** acoustic coverage
- **<15 mm** range precision

## Sonardyne: SPRINT-Nav DP
Source: Sonardyne SPRINT-Nav DP datasheet 8388 (01/2026); Type 8097 datasheet (03/2023)

How it works:
1. The Type 8097 pole swings the sensor down over the side
2. Inertial sensors, DVL and pressure sensor in one titanium housing
3. Starts from GNSS, then positions independently of satellites

Key advantages:
- **<2 m** station keeping over 24 hours, DVL aided (CEP50)
- **10 min** initialisation
- **5 min** internal battery: keeps navigating through power dropouts

## Guidance Marine: CyScan AS
Source: Guidance Marine, CyScan AS leaflet (2025)

How it works:
1. A pulsed laser scans for reflective targets on the structure
2. Absolute Signature positively identifies each AS target
3. Range and bearing give the position relative to the structure

Key advantages:
- **2,500 m** range with prism targets: the longest range DP laser on the market today
- **50 mm** range noise, with 0.2 mrad bearing noise
- **Add targets** without interrupting tracking

## Guidance Marine: RadaScan View
Source: Guidance Marine, RadaScan View brochure

How it works:
1. Microwave radar measures range and bearing to coded responders
2. Position reference and radar picture on one display
3. Operators confirm the responder locations on the asset

Key advantages:
- **All weather** works through rain, snow, fog, steam and dust
- **Coded** responders: immune to false reflections
- **No GPS shadow** unaffected when working close to platforms

## SMT: Taut Wire 2.0 Z Range Mk2
Source: SMT, Taut Wire Z Range Mk2 system specification AD 0004-10

How it works:
1. A 400 kg depressor weight is lowered to the seabed
2. A constant tension winch keeps the wire taut
3. A gimbal head measures the wire angles for the DP system

Key advantages:
- **500 m** water depth range, with 700 m of cable on the drum
- **±30°** measuring range
- **No air** required, with a fail-safe electric brake

## Notes
- CyScan AS: the simulator panel shows the usable range with a 1.9 m cylinder target (10 to 300 m); the caption quotes the datasheet range with prism targets (2,500 m), and says so.
- The Trimble antenna is not shown (Rahul, 2026-11-01): the DGNSS receiver is the Fugro Seastar 9410-AUT.
