# Engineering source register and assumptions (release 1.0.0)

This simulator is an educational demonstration. It is **not** class approved, it is **not** an FMEA, and nothing in it
is a certification or a statement of compliance for any real vessel. Values marked *provisional* are demonstration
values chosen to behave plausibly; they are all configurable in `src/simulations/power.ts` (`POWER_CONFIG`),
`src/simulations/wind.ts` (`WIND_CONFIG`) and `src/simulations/dp.ts`.

## 1. Sources actually read for this release

Only text that was retrieved and read is cited. Where only a secondary summary was read, the entry says so.

| Decision | Source / title | Edition / date | URL | Section | Applicability | Consequence in the model |
|---|---|---|---|---|---|---|
| Number of DP UPS per class (1 / 2 / 3, the third in a separate compartment) | ABS Guide for Dynamic Positioning Systems | February 2024 | https://ww2.eagle.org/content/dam/eagle/rules-and-guides/current/other/191-guide-for-dynamic-positioning-systems-2024/191-dps-guide-feb24.pdf | 2/3.7 Table 1 (UPS row), 3/9 | ABS DPS-1..3 notations; used as a representative class view, not as a claim of ABS compliance | DP2 gives UPS A and B; DP3 adds UPS C in the backup room |
| Each UPS supplies its consumers for at least 30 min | Same ABS Guide | February 2024 | as above | 3/9 ("capable of supplying power for a minimum of 30 minutes") | as above | Battery sized so mapped load runs well over 30 min; runtime estimate shown on the UPS screen; low and critical alarms at 30 % and 10 % |
| PMS works with open and closed bus tie, has blackout prevention, redundancy per class | Same ABS Guide | February 2024 | as above | 3/7 | DPS-2 and DPS-3 with diesel-electric thrusters | Arrangement selector (one-per-bus, two-per-bus, closed-bus); load shedding, phase-back, standby start, blackout recovery |
| Thruster phase-back is a temporary power reduction after an event | Same ABS Guide | February 2024 | as above | 1/5.3 (definition, read in part) | as above | Phase-back limits drives when the online capacity is exceeded |
| Emergency generator carries full load within 45 s of cranking | USCG Marine Safety Center Plan Review Guideline E2, Emergency Generators and Switchboards, quoting 46 CFR 112.50-1(d) | PRG E2, 2016-06-14 | https://www.dco.uscg.mil/Portals/9/MSC/PRG/PRG.E2-08.2016.06.14.Emergency_Generators_and_Switchboards.pdf | 46 CFR 112.50-1(d) as quoted | US flag rule, used as a representative figure only | EG start delay 1 s + run-up 10 s; model test confirms ESB live well inside 45 s |
| Emergency switchboard disconnects on loss of main power and never parallels with another source | Same USCG PRG E2, quoting 46 CFR 112.05-3 | as above | as above | 46 CFR 112.05-3 as quoted | as above | ESB feeder opens on dead bus, EG breaker interlocked against parallel running, return to main after a delay and only if the feeder is healthy |
| Lessons on DP UPS failure (pre-operation status checks, battery tests) | IMCA DP Event DPE 03/19 "Failure of DP UPS" | 2019-09-03 | https://imca-int.com/resources/dp/dp-incidents/failure-of-dp-ups | whole bulletin | Industry lesson | UPS faults include inverter, rectifier, battery health; static bypass behaviour is shown |
| Lessons on isolated backup supplies and changeover switch position | IMCA DP Event DPE 04/18 "Isolation of backup supplies to DP critical equipment" | 2018-11-30 | https://www.imca-int.com/resources/dp/dp-incidents/isolation-of-backup-supplies-to-dp-critical-equipment/ | whole bulletin | Industry lesson | UPS input selector (main / emergency) is visible and settable; the training scenario shows a UPS running down its battery |

## 2. Sources NOT read (gaps, stated openly)

| Document | Status | Effect |
|---|---|---|
| IMO MSC.1/Circ.1580 (Guidelines for vessels and units with DP systems) | The full text could not be retrieved in this session (the copy tried failed to load). Earlier releases cite §3.1.8 and §3.4.2.6 for bridge layout from previous work; no new clause from it is used for the PMS or UPS. | No PMS, UPS or wind behaviour is attributed to it |
| SOLAS II-1 regulations 42 to 44 | Not read directly | The 45 s figure is attributed only to 46 CFR via USCG PRG E2 |
| IEC 60092 series, IEC 61892, IEC 62040 (UPS) | Not read | No IEC clause is cited; UPS behaviour is generic |
| IMCA M 103, M 166, M 190, M 220 | Not read in this session | No clause cited |
| Manufacturer manuals for generators, switchboards, UPS, wind sensors | Not supplied | All ratings are generic and provisional |

## 3. Assumptions register (all provisional and configurable)

| Id | Assumption | Value | Where | Why | To confirm with |
|---|---|---|---|---|---|
| AS-01 | Main generation | 4 × 1700 kW / 2125 kVA, 690 V, 60 Hz; G1, G2 on MSB A; G3, G4 on MSB B | `POWER_CONFIG.generators` | Typical size for a 78 m DP2 OSV | Real generator data sheet |
| AS-02 | Emergency generator | 250 kW, 440 V, radiator cooled (no auxiliaries from the main plant) | same | Typical | Real EG data |
| AS-03 | Bus tie philosophy | Open bus by default (DP2 two-split); closed-bus option for training | `Arrangement` | Most common DP2 mode | Vessel's DP operations manual / FMEA |
| AS-04 | Thruster drives | AZ1, AZ2 1800 kW; BT1, BT2 800 kW; A side on MSB A, B side on MSB B | `POWER_CONFIG.drives` | Typical | Thruster data |
| AS-05 | PMS settings | start at 85 % for 10 s, stop below 35 % for 120 s, phase-back at 98 %, shed at 100 %, overload trip 105 % for 5 s, run-up 8 s, sync 5 s, load ramp 10 s | `POWER_CONFIG.pms` | Plausible settings | PMS setting list |
| AS-06 | DP UPS | A and B 5 kVA, 108 cells × 12 Ah; C 3 kVA, 9 Ah; 230 V 60 Hz out | `POWER_CONFIG.ups` | Gives well over 30 min at the mapped load | UPS make and model, battery data |
| AS-07 | UPS consumer map | see ELECTRICAL_ARCHITECTURE.md | `POWER_CONFIG.consumers` | A-side / B-side split by redundancy group | Vessel's consumer list |
| AS-08 | Wind sensors | Two generic 2-axis ultrasonic sensors, NMEA 0183 MWV at 1 Hz, on a cross-arm near the mast top; stale after 3 s, frozen after 10 identical samples; disagreement 3 kn or 20 % or 20° for 5 s | `WIND_CONFIG` | Make and model not supplied | Real sensor model |
| AS-09 | Gusts | Gauss-Markov, time constant 20 s, seeded random numbers | `wind.ts` | Reproducible, step size independent | Site data |
| AS-10 | Mast shadow and exhaust | 20 % speed loss and 8° error on the leeward sensor; extra noise with wind from astern | `WIND_CONFIG` | Illustrates why two sensors are fitted | Not applicable (illustrative) |
| AS-11 | Heading sensors | 3 gyros (gyro 3 dual-fed), 2 MRUs; voting rejects a gyro more than 2° from the other two | `dp.ts` | Usual DP2 practice | Vessel's sensor list |
| AS-12 | Thruster power to thrust | Azimuths: shaft power rises with thrust to the power 1.5, 96 % drive efficiency, 1.5 % standby load. Bow tunnels: the existing CPP pitch-to-power model of BT1 | `thrusterKW` | Momentum theory shape; reuses the BT1 model | Thruster curves |

The vessel itself is a generic 78 m DP2 offshore support vessel. No identifiers of any real vessel are used.
