# Electrical architecture and consumer map (demonstration plant)

All ratings are provisional demonstration values (see ENGINEERING_REGISTER.md, AS-01 to AS-07). The live single-line
diagram in the simulator (PMS screen, "Single line" tab) is drawn from the same configuration as this page.

## Single line (text form)

```
   G1 1700 kW   G2 1700 kW                       G3 1700 kW   G4 1700 kW
      |            |                                |            |
 ==== MSB A 690 V 60 Hz ====[ MAIN BUS TIE ]==== MSB B 690 V 60 Hz ====
   |       |         |                            |       |        |
  AZ1     BT1      TR A 690/440 V               TR B     AZ2      BT2
 1800 kW 800 kW      |                           |      1800 kW  800 kW
                ==== 440 V board A ==[ 440 V INTERCONNECTOR ]== 440 V board B ====
                 |  aux, fans, hotel, crane, UPS A input    aux, fans, hotel, winches, UPS B input
                 |
           [ ESB FEEDER ]
                 |
        ==== Emergency switchboard 440 V ====  EG 250 kW (never in parallel with the main supply)
           emergency lighting, nav lights / GMDSS / fire detection, emergency fire pump,
           UPS A and B emergency input, UPS C (DP3 only)
```

Default arrangement: open bus tie, one generator online per side (G1 and G3), G2 and G4 on standby. The PMS can be
set to two per side or a closed bus for training.

## Feeders and load shedding

| Board | Feeder | Demand kW | Shed priority (0 = never, 3 = first) |
|---|---|---|---|
| MSB A | AZ1 drive, BT1 motor | from thrust | 0 (phase-back instead) |
| MSB B | AZ2 drive, BT2 motor | from thrust | 0 (phase-back instead) |
| 440 V A | AZ1 steering + cooling 35, BT1 cooling 8, G1/G2 cooling + fuel 30 | | 0 |
| 440 V A | Engine room fans A 45 | | 1 |
| 440 V A | Crane 120 | | 2 |
| 440 V A | Accommodation HVAC + galley 190 | | 3 |
| 440 V B | AZ2 steering + cooling 35, BT2 cooling 8, G3/G4 cooling + fuel 30 | | 0 |
| 440 V B | Engine room fans B 45, taut wire winch 0.8 | | 1 |
| 440 V B | Tugger winches 60 | | 2 |
| 440 V B | Workshops, laundry, HVAC 150 | | 3 |
| ESB | Emergency lighting 18, nav / GMDSS / fire detection 12, emergency fire pump (standby) | | 0 |

## DP UPS

| UPS | Rating | Battery | Main input | Emergency input | Notes |
|---|---|---|---|---|---|
| UPS A | 5 kVA, pf 0.8 | 108 cells, 12 Ah | 440 V board A | ESB | Static bypass and maintenance bypass |
| UPS B | 5 kVA, pf 0.8 | 108 cells, 12 Ah | 440 V board B | ESB | as A |
| UPS C | 3 kVA, pf 0.8 | 108 cells, 9 Ah | ESB | ESB | Installed only when DP class 3 is selected; in the backup DP room |

## UPS consumer map

| Consumer | UPS | Load kW | Group |
|---|---|---|---|
| DP controller A | A | 0.25 | A |
| DP controller B | B | 0.25 | B |
| DP controller C | A + B (dual-fed) | 0.25 | A+B |
| DP operator station 1 | A | 0.35 | A |
| DP operator station 2 | B | 0.35 | B |
| Backup DP operator station (DP3) | C | 0.30 | C |
| Backup DP controller (DP3) | C | 0.20 | C |
| DP network A / B switches | A / B | 0.12 each | A / B |
| DGPS 1 / DGPS 2 (Seastar 9410-AUT) | A / B | 0.03 each | A / B |
| HPR topside + HPT 5000 | A | 0.25 | A |
| RadaScan View | B | 0.12 | B |
| CyScan AS | A | 0.10 | A |
| Taut wire sensor + control | B | 0.05 | B |
| SPRINT-Nav DP | B | 0.03 | B |
| Gyrocompass 1 / 2 | A / B | 0.06 each | A / B |
| Gyrocompass 3 | A + B (dual-fed) | 0.06 | A+B |
| MRU 1 / MRU 2 | A / B | 0.02 each | A / B |
| Wind sensor 1 (port) / 2 (stbd) | A / B | 0.01 each | A / B |
| Independent joystick | B | 0.08 | B |
| AZ1 / BT1 thruster control | A | 0.15 / 0.10 | A |
| AZ2 / BT2 thruster control | B | 0.15 / 0.10 | B |

## How power failures reach the DP

- A thruster needs its drive feeder live, its auxiliaries (steering pumps, cooling) live and its control supply from
  its UPS. Missing any of them makes the DP show the thruster as NO PWR or limited, and the DP stops using it.
- The PMS gives each drive a power limit from the spare capacity of its island. When the spare capacity is not enough,
  phase-back reduces thrust first; non-essential loads are shed by priority before an overload trip.
- Losing a generator's cooling and fuel pumps stops that generator after a ride-through of 60 s.
- Blackout recovery: dead bus detected in 1 s, the standby set is started (8 s run-up) and closed onto the dead bus,
  then the drives restart one at a time 4 s apart.
- UPS consumers stay powered from the battery while the inputs are lost, until the battery is exhausted. Sensors and
  DP stations powered from a failed UPS drop out of the DP and raise alarms.
