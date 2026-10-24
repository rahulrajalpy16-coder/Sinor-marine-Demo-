# Test results, release 1.0.0 (2026-10-24)

Test environment: cloud Linux container, 4 vCPU Intel Xeon 2.10 GHz, 16 GB RAM, **no GPU** (all 3D drawn by software
rendering, SwiftShader). Frame rates below are therefore far lower than on any PC or TV with a graphics chip; they
prove stability, not real-world smoothness. Evidence files are in `Documentation/evidence` on the pendrive.

What each word means: **passed** = an automated test ran here and passed. Nothing in this list was run on a real
Windows PC or a real Android TV (see "Not verified").

| Test | What was checked | Result | Evidence |
|---|---|---|---|
| Unit tests | 179 tests in 20 files: PMS, UPS, wind, DP, coupled core, scenarios, saved data, TV navigation | **179 / 179 passed** | `tests-unit-and-browser.txt` |
| Browser tests | 41 tests: 26 existing (regression) + 15 new system tests | **41 / 41 passed** | as above |
| A. Regression and preservation | OEM data files (`posrefData.ts`, `hprData.ts`, `design-config.json`) byte-identical to the previous release `c64b402`; equipment registry 10 to 18 entries with 0 removed and 0 changed; the 26 earlier browser tests pass | **Passed** | `test-A-preservation.txt` |
| B. PMS interlocks | Closing an unsynchronised generator on a live bus is refused (in the model and through the screen), dead-bus closing rules, EG never in parallel, no stop of the only set, synchronised close works | **Passed** | unit tests, browser test "PMS shows the shared state…" |
| C. Generator failure during DP | Manageable (two sets per side: position held), section blackout with one set per side (recovery), insufficient (switchboard A lost in strong beam wind: vessel drifts off) | **Passed** | `vesselCore.test.ts`, consistency run |
| D. UPS | Battery transfer with no break, energy accounting, 30 min at full rated load, low and critical alarms, only mapped consumers lost, static bypass rules, recharge, IMCA DPE 04/18 case | **Passed** | unit tests, browser test "UPS goes on battery…" |
| E. Wind and sensors | Sensors failing removes only feed-forward, never the wind force; stale, frozen, bias, disagreement, selection; gyro voting and drift | **Passed** | unit tests, browser test "wind sensor failure…" |
| F. 3D and HMI | Each of the 8 new systems clicked in 3D opens the right screen; values match the model when frozen; keyboard, touch (phone and tablet) and TV remote; Reset all from normal, failure, blackout, frozen and demo | **Passed** | browser tests, `apk/apk-assets-tv.json` (12 / 12) |
| G. Offline cold start | Packaged desktop app (same Electron 33.2.1 and same app files as the Windows package) started with the network removed (`unshare -n`, a test connection fails), twice: renders, all buses live, no request leaves the app, saved data kept between launches (run counter 1 then 2). APK content served at the Android WebView origin with every other request refused: renders in 4.1 s, no network attempt | **Passed** | `electron-offline/selftest.json`, `network-check.txt`, `apk/` |
| H. Online / offline consistency | Same seeded 300 s scenario (gen trip, sensor failure, recovery) in Node, the browser build, the offline desktop app, the APK content and the exact files now live online; declared tolerance 1e-6 | **Passed**, largest difference 9.1e-13 | `consistency/compare.txt` |
| I. Endurance, desktop app offline | 30 min exhibition demo loop with the network blocked, sampled every minute | **Passed**: 30 / 30 samples, demo active and scene drawn in every sample, exit returned to a normal plant with no alarms, 0 blocked requests. JS heap 25 to 35 MB (no growth trend); process memory rose from 751 to 855 MB, about 5 MB per minute in the first 15 minutes and under 2 MB per minute in the last 15; 1.9 to 6.0 frames/s in software rendering | `endurance/electron-offline-30min.json` |
| I. Endurance, APK content | 30 min demo loop in TV mode at 1920×1080 in a browser engine | **Passed**: 30 / 30 samples, no errors, no network requests, heap 36 MB at start and 27 MB at end, exit returned to normal; 1 to a few frames/s in software rendering | `endurance/apk-assets-30min.json` |
| J. Release | Windows exe is a 64-bit Windows program with Sinor version information; Electron runtime checksum matches the published one; APK signed (v2 + v3), no permissions, TV launcher; web content byte-identical in both packages; `CHECKSUMS.sha256` covers every file; online site redeployed from merge `e57bbb8` (GitHub Pages deployment succeeded) and serves the new build | **Passed** | `windows-build-checks.txt`, `apk/apk-build-checks.txt` |

Notes: the first desktop endurance attempt stopped at 29 samples because the test itself added its own sampling time
to each minute; the test was corrected to a fixed one-minute schedule and the full run above passed. The two
endurance runs ran at the same time on the same 4 CPUs, which lowers the frame rates further.

## Not verified (needs the real devices)

* **Windows**: the package was built and inspected, and the identical app and runtime ran offline on Linux, but it
  was not run on a Windows PC. Please run `Start Sinor Marine Simulator.bat` once on the exhibition PC before the event.
* **Android TV**: the APK was built, signed and its content tested, but it was not installed on a TV or an emulator
  (the Android emulator cannot be downloaded here). Please install it once on the exhibition TV before the event.
* Real frame rate on the target hardware.
