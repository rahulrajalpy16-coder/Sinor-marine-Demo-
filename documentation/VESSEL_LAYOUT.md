# Vessel layout (generic 78 m DP2 offshore vessel)

On 2026-10-15 the procedural vessel was rebuilt to the proportions and arrangement of a general arrangement (GA) plan supplied for design and structural reference only. The model is a **generic** offshore vessel. Nothing that identifies the reference ship is used or shown: no vessel name, IMO number, owner, operator, yard, project, drawing number, title block, logo or marking.

All values live in `src/vessels/vesselLayout.ts`. The plan was read at 1:175 with 0.6 m frame spacing; scaled values are approximate.

## Main dimensions (stated on the plan)

| Item | Value |
| --- | --- |
| Length overall | 78.0 m |
| Breadth (moulded) | 20.0 m |
| Depth to main deck | 6.5 m |
| Design draught | 4.8 m |

## Scaled off the plan

| Item | Used value (scene: waterline y = 0, z = 0 near midships, +z forward) |
| --- | --- |
| Deck levels above the waterline | Main 1.7, forecastle 4.5, upper 7.3, officers 10.1, bridge 12.9, compass deck 15.8, helideck 19.6, mast top 26 m |
| Forecastle / accommodation front | Raised hull side from z = +3 m forward; accommodation z ≈ 4.5 to 28 m |
| Wheelhouse | z 6.5 to 24.4 m: narrow aft part with windows over the working deck, wide middle (±7.2 m), forward part (±6 m) with chamfered front; open wing decks to ±9 m |
| Mast | z ≈ 14 m on the compass deck, yardarm ≈ 21.2 m |
| Helideck | Octagon about 22 m across on a truss forward of the bridge, overhanging the bow |
| Bow tunnel thrusters | BT1 at z 28.4 m, BT2 at z 25.4 m, 1.3 m above the base line |
| Stern azimuth units | About 5 m from the stern |
| Aft working deck | Knuckle-boom crane starboard ≈ 19 m from the stern; smaller crane near the accommodation (port); tugger winches at the accommodation front; capstans at the stern corners; two circular deck hatches; crash barrier rail ≈ 2.9 m above deck with openings at the deck equipment |
| Rescue boat | Starboard, upper deck level |
| SPRINT-Nav DP pole | Port side of the aft main deck (where the plan shows it) |

## Equipment positions on the new vessel

| System | Where |
| --- | --- |
| IBS forward console, steering stand, chart table | Wheelhouse forward part, bridge deck 12.9 m |
| DP operator station (aft-facing) | Wheelhouse aft windows; DP3 backup station in an A60 room on the officers deck below |
| RadaScan View, CyScan AS | Aft corners of the bridge deck on 1.1 m plinths, port and starboard (z 6.4 m), facing the working area astern |
| Seastar GA830 antennas | Mast yardarm ends |
| HPR (Type 7950 + HPT 5000) | Centreline at z 12 m, on the bottom plating (keel at the 4.8 m draught) |
| Taut wire | Starboard main deck at z −6 m (near the roll centre), at a bulwark and rail opening |
| SPRINT-Nav DP on the 8097 pole | Port aft main deck, pivot at z −7 m |

## Assumptions and not from the plan

- Hull lines (section shape, bow and stern form) are illustrative at the plan's main dimensions; the plan gives no lines plan.
- Colours: dark hull, red-brown antifouling, white superstructure, orange cranes and rescue boat. The plan has no paint scheme.
- The HPR, taut wire, RadaScan View and CyScan AS positions are not on the plan; they follow the installation rules in [INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md).
- The A-frame of the previous concept vessel is not on the plan and was removed.
- No 3D reference image or model was supplied, so the superstructure is built from the plan views only.
