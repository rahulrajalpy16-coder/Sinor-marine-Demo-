# Installation locations and procedures

How each system is placed on the generic 78 m DP2 vessel, which rule decided the place, and the standard installation sequence.

Sources:
- **Supplied documents** come first: the installer's guides and manuals Rahul supplied.
- **Public rules and guidance** fill the gaps: IMO, maker installation guides.

Where a choice is a judgement rather than a rule, it says so. Positions are representative: the model is a concept, not an installation drawing.

All sensors share one rule that the guides repeat: after mounting, **measure the sensor offsets** to the vessel's common reference point. That means the bow, starboard and height offsets and the bearing offset. Enter them in the sensor software and the DP system. These are confirmed by a dimensional survey and DP trials.

## Summary

| System | Location on the model | Deciding rules |
| --- | --- | --- |
| Integrated bridge (IBS) | Wheelhouse forward console, centreline, bridge deck 12.9 m | View ahead (SOLAS V/22); console layout to IMO MSC/Circ.982 |
| DP operator station | Aft-facing station at the wheelhouse aft windows; DP3 backup in an A-60 room on the officers deck | Good view of the vessel's exterior limits (MSC.1/Circ.1580 §3.1.8); backup in an A-60-separated room (§3.4.2.6) |
| Bow tunnel thrusters | BT1 z +28.4 m, BT2 z +25.4 m, 1.3 m above the base line (GA plan) | As far forward as the hull allows; tunnel top well below the waterline (at least ½, preferably ¾ to 1 tunnel diameter) |
| HPR, Type 7950 + HPT 5000 | Centreline z +12 m in a dedicated trunk on a 14" gate valve; transceiver 2.9 m below the keel when deployed | Deploy 2–3 m below the hull; away from propellers, thrusters and aeration; arrow forward (UM-8142 §4) |
| RadaScan View | **Moved** to the port aft corner of the bridge deck, on a 1.1 m plinth | Clear view to the responders astern; level with them; different level from the X-band radar; panel facing away from the operating area (94-0492-4-A) |
| CyScan AS | **Moved** to the starboard aft corner of the bridge deck, on a 1.1 m plinth | Clear view to the targets; ≥ 5 m horizontally from S/X-band radars and VHF; ideally one deck below them; clear of exhausts; access cover to the bow (94-0559-C) |
| Seastar GA830 antennas (2 × 9410-AUT) | Mast yardarm ends, 6 m apart | Open sky; ≥ 3 m from and out of the beam of radars and satcom transmitters (IMO SN/Circ.227 §2.3.1) |
| SMT Taut Wire 2.0 Z Mk2 | **Moved** from z −14 m to z −6 m, starboard main deck, at a bulwark opening | Close to the roll centre; not above or near thrusters; opposite side from other over-side systems; within reach of a 2.1 t crane lift (PJ 0044-13 §3.1) |
| SPRINT-Nav DP on 8097 pole | Port aft main deck, pivot z −7 m (GA plan) | Where the plan shows it; opposite the taut wire; far from the azimuths |

## Bridge systems

### IBS
**Where:** forward console on the centreline of the wheelhouse.
- The multi-function workstations face forward under the front windows.
- The steering stand is on the centreline, behind the console.
- The chart table is aft, to starboard.

**Why:** the conning position needs the view ahead. SOLAS V/22 sets the visibility requirements and MSC/Circ.982 is the ergonomic layout guideline. The Bridge Mate IBS datasheet gives the console arrangement.

**Procedure** (standard, not from a supplied manual):
1. Land and bolt the console sections to the deck foundations.
2. Run the dual redundant network and power from separate distribution.
3. Connect the sensors: gyros, GNSS, speed log, AIS, radars.
4. Load the configuration.
5. Run the harbour acceptance test, then the sea trials with class.

### DP operator station
**Where:** aft-facing, at the wheelhouse aft windows over the working deck.

**DP3 backup:** a separate station in its own room one deck below, behind an A-60 division.

**Why:** MSC.1/Circ.1580 §3.1.8 says the station should give "a good view of the vessel's exterior limits", which on an OSV means the working deck and the platform astern. §3.4.2.6 requires the backup to be in a room separated by an A-60 division.

**Procedure:**
1. Mount the pedestal consoles and the 19" rack (drawing 5000-501092).
2. Install the controllers and the thruster and sensor I/O.
3. Cable the references and thrusters on segregated routes, as the redundancy concept requires.
4. Run the FMEA, then the FMEA proving trials and the annual DP trials.

### Bow tunnel thrusters (P2 CPP)
**Where:** at the GA positions.

**Why:** the thrusters need maximum lever arm about the pivot point, so they go as far forward as the hull allows. The tunnel needs enough immersion to avoid drawing air: tunnel top at least ½ of the tunnel diameter below the surface, ¾ to 1 diameter preferred (maker tunnel guides).

**Procedure:**
1. Fit the tunnel in the hull block and fair it to the shell. Give the tunnel ends a radius or chamfer, and add grids.
2. Align the gear unit and the motor on their foundation.
3. Connect the hydraulic pitch system.
4. Commission with the Z-Thrust control system.
5. Run the bollard and turning trials.

## Hydroacoustic position reference (HPR)

**Where:** centreline at z +12 m.
- The Type 7950 deployment machine stands in a 6.1 × 1.8 × 1.0 m trunk on the hull penetration and 14" gate valve.
- The HPT 5000 deploys 2.9 m below the keel.

**Why** (UM-8142 §4.3):
- Deploy the transceiver at least 2–3 m below the lowest part of the hull. This reduces multipath, vessel noise and aerated water.
- Keep it as far as practical from propellers, thrusters, moonpools and other sources of noise or bubbles. Here that is 13 m aft of BT2 and 46 m forward of the azimuths.
- Keep the white arrow on the transceiver pointing forward.

**Procedure:**
1. Weld the hull penetration flange and seachest, and fit the gate valve. This is a dry-dock job with class approval.
2. Install the 7950 in assembly order: adaptor flange, seachest, sealing section, guides, pole, main ram, moving plate, top support.
3. Fit the HPT with the 6G installation kit 641-0197.
4. Connect the hydraulics and the local and remote control panels.
5. Check the deploy and retract cycles and the interlocks: the gate valve must be open before deploy.
6. Measure the vertical offset from the transceiver face to the waterline when deployed.
7. Run the USBL calibration (CASIUS or a calibration box-in) to find the misalignment.

## Relative position references

### RadaScan View
**Where:** port aft corner of the bridge deck, on a 1.1 m plinth.

**Why:** the installer's guide (94-0492-4-A) asks for:
- An unobstructed view towards the responders. On an OSV working stern-to, that is over the open working deck astern.
- The same height as the responders. The sensor sits at about 14.2 m and the responders at 14 m.
- A different vertical level from any X-band radar. The X-band is 9 m higher.
- The connection panel facing away from the operating area, so it faces forward.

The old compass-deck spot forward of the mast looked astern past the mast and the exhaust casings, so it was moved.

**Procedure:**
1. Fabricate the plinth with the 240 mm M8 mounting template, or use the universal bracket.
2. Bolt the sensor down with the connection panel facing forward.
3. Feed the cables through the glands: Ethernet, RS422 and mains. Fit the ferrite and the DC4 grease, then refit the panel and the radome.
4. Install the Dashboard and Service Interface software.
5. Set the bow and starboard offsets and the bearing offset.
6. Place the responders on the structure: no lower than 2 m below the sensor, no higher than 5 m above it, with a clear view to the vessel.

### CyScan AS
**Where:** starboard aft corner of the bridge deck, on a 1.1 m plinth.

**Why:** the installer's guide (94-0559-C) asks for:
- An unobstructed view to the targets.
- A position well above the sea.
- A flat, rigid plinth for 30 kg and 4 × M8 bolts.
- At least 5 m horizontal separation from VHF, S-band and X-band radars, and ideally one deck vertically. Here it is 9 m horizontally and 4.6 m below the S-band.
- A position clear of exhaust particulates. The outlets are 5.6 m forward and 4 m higher.
- No retro-reflective material in the field of view.
- The access cover facing the bow, with the alignment corrected in the Service Interface.

**Procedure:**
1. Fabricate and weld the plinth, then level it.
2. Bolt the sensor with the access cover forward.
3. Terminate the power and data cables at the connector board.
4. Set the vessel length, bow offset, starboard offset and bearing offset in the Service Interface.
5. Fix the targets on the structure at the same height where possible.
6. Check the tracking and the DP interface.

## Absolute position references

### Fugro Seastar 9410-AUT with Trimble GA830 antennas
**Where:** one antenna on each end of the mast yardarm, 6 m apart. The receivers are in the bridge rack.

**Why** (IMO SN/Circ.227 §2.3.1, maker GNSS installation guides):
- A clear view of the sky, with obstructions eclipsing no more than a few degrees.
- At least 3 m from, and out of the beam of, radars and other high-power transmitters.

Here each antenna is about 3.5 m from the radar centres, between the S-band and X-band levels and outside both beams. Two antennas on separate ends give independent references for DP2.

**Procedure:**
1. Fit the 5/8" antenna mounts on the yardarm ends.
2. Run the low-loss coax with drip loops and weatherproofed connectors.
3. Install the receivers.
4. Configure the corrections (G4 / XP2).
5. Enter the antenna offsets from the common reference point in the receiver and the DP system.
6. Check the position with a static comparison.

### SMT Taut Wire 2.0, Z Range Mk2
**Where:** starboard main deck at z −6 m, with the skid's outboard edge 0.1 m inside the ship side at a bulwark and crash-rail opening.

**Why** (installation manual PJ 0044-13 §3.1):
- It works best close to the vessel's roll centre. It was moved from z −14 m to the clear deck nearest midships, aft of the accommodation front.
- It must not be above or close to the thrusters, because thruster wash disturbs the wire angle. Here it is 31 m from BT2 and 28 m from the azimuths.
- It goes on the opposite side from ROV or over-side systems, to avoid entanglement. The SPRINT-Nav pole is to port.
- It must be near a crane that can lift 2,100 kg. The main deck crane is 14.5 m away.
- It needs a lifting point of at least 500 kg over the weight basket for weight changes.
- It needs space to open the console doors and walk around the unit.
- It must be within 100 m of cable from the bridge panel.

The along-ship position is a judgement; the plan does not show a taut wire.

**Procedure** (PJ 0044-13 §5 to §7):
1. Prepare the deck seating or skid base, then weld and paint it. Prepare both supplies: 380–460 VAC 3-phase on a 43 A Type D breaker, and a UPS 220–250 V on a 6 A Type C breaker.
2. **Before the lift:** check the boom is fully recovered and the rigging is undamaged. Strap the depressor weight into the basket and close the console doors.
3. Lift with the hook over the centre of gravity (half-way between the forklift pockets, centre of the upper boom arm). Make a gentle test lift, then land the unit and bolt it down with the supplied bolts.
4. Mount the bridge touch screen and E-stop within reach of the DP chair, and the backplate in the DP desk. Run the two Ethernet cables and the multicore, each up to 100 m.
5. Carry out the load tests, witnessed by class:
   - Dynamic test at 720 kg (1.25 × SWL), boom raised and lowered.
   - Static brake test at 865 kg (1.5 × SWL) with an E-stop applied.
6. Measure the gimbal head offsets from the skid reference point to the vessel's roll centre and enter them in the DP system.

### Sonardyne SPRINT-Nav DP on the 8097 over-the-side pole
**Where:** port aft main deck, pivot at z −7 m, where the GA plan shows it.

**Why:**
- The pole is rigid and hinged at the deck edge. When deployed it holds the instrument vertical below the hull.
- It is on the side opposite the taut wire.
- It is 27 m forward of the azimuth thrusters, to keep the DVL out of propeller wash and aeration.

**Procedure:**
1. Weld the pivot bracket and the stowage cradle.
2. Fit the pole sections and the hydraulic swing and lock.
3. Mount SPRINT-Nav DP with its forward mark aligned.
4. Run the cable through the pole to the topside unit.
5. Measure the offsets in the deployed position.
6. Calibrate the alignment and check against GNSS during trials.

## What changed on the model

| Item | Before | Now |
| --- | --- | --- |
| RadaScan View | Compass deck z +19.4 m, port, 0.6 m plinth | Bridge deck aft corner z +6.4 m, port, 1.1 m plinth |
| CyScan AS | Compass deck z +19.4 m, starboard, 0.4 m plinth | Bridge deck aft corner z +6.4 m, starboard, 1.1 m plinth |
| Taut wire | Starboard main deck z −14 m | Starboard main deck z −6 m |
| Taut wire model | Simple skid, A-frame and straight arm | Rebuilt to the unit in the SMT manual (see below) |
| Every system | — | An "Installation" row in its details panel stating the location and the rule |

### Taut wire model, rebuilt to the SMT unit

No new image arrived with the request, so the reference is the product render on the cover of the supplied installation manual PJ 0044-13, together with drawings SMT-TW-MD-20 and SMT-TW-MD-21.

The rebuilt model has:
- **Skid:** a yellow skid with perimeter beams, lifting eyes and grating.
- **Weight basket:** at the outboard end, with its front plate, holding the orange bell-shaped depressor weight.
- **Winch:** at the inboard end, with perforated side plates, the drum and the drive motor.
- **Control cabinet:** tall and white, down one side, with blue cable glands below.
- **A-frame:** ladder-braced, on two luffing rams. It leans inboard when recovered.
- **Upper arm:** cranked, with an arched end that holds the ribbed, domed gimbal head and an amber beacon over the weight.

**Dimensions from the documents:**
- Footprint 1700 × 1600 mm.
- Stored height 2085 mm.
- Maximum height while deploying 2395 mm. This sets the A-frame length: the pin passes over the pivot.
- Deployed head 2510 mm outboard and 1059 mm up.

**Scaled off the drawings (approximate):** the pivot, the pin, the basket and the part sizes.

**Assumed, as before:** the size of the bell weight.
