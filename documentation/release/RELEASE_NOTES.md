# Release notes: Sinor Marine Vessel Systems Simulator 1.0.0

Release date: 2026-10-24. Previous release: the online version built from main at `c64b402` (2026-10-21).

## Delivered packages

| Package | File | Runs from | Internet |
|---|---|---|---|
| Windows 10 / 11 x64, portable | `Windows/Sinor Marine Simulator/Sinor Marine Simulator.exe` (Electron 33.2.1) | The pendrive, no installation | Not needed; every network request is blocked inside the app |
| Android TV / Google TV / Android 7+ | `Android_TV/SinorMarine-1.0.0.apk` (package `com.sinormarine.simulator`, version code 10000) | Installed once from the pendrive | Not needed; the app has no INTERNET permission |
| Online | https://rahulrajalpy16-coder.github.io/Sinor-marine-Demo-/ (same address as before) | Browser | Needed to load the page |

macOS is not built, as requested.

## New in 1.0.0

* **Power management system**: live single line diagram with clickable breakers; 4 main generators, 2 main
  switchboard sections with bus tie, 690/440 V transformers, 440 V interconnector, emergency generator and
  switchboard; load sharing, automatic start and stop, standby start, load shedding by priority, thruster
  phase-back, DP power reserve, blackout recovery, synchronising and parallel-running interlocks, alarms and events
  with acknowledge, trends and fault injection.
* **PMS and DP linked**: the DP sees each thruster's real power limit, loses thrusters whose supply, auxiliaries or
  control power are lost, and shows the consequence of a worst-case failure.
* **DP UPS A, B (and C for DP3)**: rectifier, battery, inverter, static bypass and maintenance bypass, input
  selector, battery health, runtime estimate, consumer map, alarms and battery trend.
* **Wind**: the real wind (with gusts) is kept apart from what the two wind sensors measure; mast shadow, exhaust,
  stale, frozen, failed and biased sensors, sensor disagreement, selection, true and apparent wind. Losing the sensors
  removes only the DP wind feed-forward, never the wind.
* **Heading sensors**: three gyros with voting and slow-drift faults, two MRUs.
* **3D**: engine room with four generator sets, main switchboard room with PMS console, emergency generator room,
  DP UPS rooms, wind sensors on a mast-top arm, gyro room and MRUs; each is selectable and opens its screen.
  The stern azimuth thrusters are selectable too.
* **Simulator controls**: Reset all from any state, freeze, speed 1× to 20×, six training scenarios, saved
  scenarios kept on the device with a versioned format, migration of the earlier format and safe handling of damaged
  data.
* **Exhibition demo mode** with an obvious Exit button, Esc and Back.
* **TV remote navigation**: D-pad focus movement, OK, Back, on-screen camera pad.
* **Sinor Marine branding**: logo on the start screen, guide and top bar, app icons and TV banner. OEM equipment keeps
  its makers' names.

All earlier features and OEM data are kept unchanged (see TEST_RESULTS.md, test A).

## Known limitations

* The Windows executable is not code-signed, so Microsoft SmartScreen asks once for *More info, Run anyway*. A
  code-signing certificate in Sinor Marine's name would remove this.
* Android TV needs a file manager on the TV to install the APK; some TVs do not have one built in.
* The Windows build was built and checked here but not run on a real Windows PC; the same app and runtime were
  cold-started offline on Linux. The APK was built, signed and its web content tested in a browser engine, but it was
  not run on a physical TV or an emulator. See TEST_RESULTS.md.
* All ratings and settings are provisional demonstration values (ENGINEERING_REGISTER.md).
* No class approval, FMEA or certification is implied.

## Rollback

* Online: the previous site is the `docs/` folder of commit `c64b402` on main. Reverting the release merge commit on
  main and pushing restores it (GitHub Pages republishes in a few minutes).
* Source: a full git bundle of the previous state is kept at
  `sinor-marine/checkpoints/pre-pms-ups-wind-2026-10-23_c64b402.bundle` in the project files.
* Offline packages: keep the previous pendrive copy; the 1.0.0 packages do not change anything outside their own
  folder (Windows) or app (Android).
