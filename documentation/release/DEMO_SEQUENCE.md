# Exhibition demo sequence

Start it with `Start Exhibition Demo.bat` on Windows, or ⚙ Simulator, then *Start exhibition demo*, on any version.
Each scene lasts 32 s; the loop repeats until **Exit demo**, **Esc** or **Back** is pressed, which also resets the
simulator to the start.

| # | Scene (caption) | What the visitor sees |
|---|---|---|
| 1 | Generator trip with two sets per side | G1 trips. G2 picks up the load, the PMS starts the standby set and the DP keeps position |
| 2 | Section blackout and automatic recovery | With one set per side, losing G1 blacks out section A. The PMS closes the standby set on the dead bus and restarts the drives one by one |
| 3 | Busbar fault on switchboard A (worst-case failure) | Section A is lost with AZ1 and BT1. Section B carries on; the consequence check shows whether position can still be held |
| 4 | DP UPS A on battery | 440 V board A is lost. UPS A carries the A-side DP equipment from its battery with no break; the runtime counts down |
| 5 | Both wind sensors fail in a gusty wind | DP loses its wind feed-forward, but the real wind keeps pushing: position error grows before the thrusters catch up |
| 6 | Slowly drifting gyrocompass | Gyro 2 drifts. Once it is more than 2° from the other two, the voting rejects it and the DP keeps the true heading |

Suggested talk track for a presenter (about 3 minutes): open with the overview, choose the bow thruster and DP to show
station keeping, then start the demo and explain each failure as it happens. Finish with *Reset all*.
