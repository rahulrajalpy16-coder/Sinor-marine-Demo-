# Sinor Marine · Digital Universe (Phase 1 slice)

Interactive 3D offshore DP support vessel in the browser: a hybrid realistic and holographic hull, five working visual modes plus an exploded view, three selectable systems with camera focus and inspector, a working bow tunnel thruster demonstration, and return to overview.

The vessel, its equipment placement and every number shown are a **representative concept**: procedurally generated, illustrative, not certified and not OEM-verified. The spec this was built from is in `spec/` (CLAUDE.md, docs, prompts); the config JSON is in `src/data/`.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build to dist/
npm run preview      # serve dist/ on http://localhost:4173
npm test             # unit tests (Vitest)
npm run test:e2e     # browser tests (Playwright; serves dist/ via vite preview)
```

`dist/` is a static build: serve it from any static host. Opening `dist/index.html` straight from disk will not work because browsers block module scripts on `file://`.

Playwright uses the Chromium at `PW_CHROMIUM` (defaults to the headless shell in this build container). On your own machine run `npx playwright install chromium` and `PW_CHROMIUM=$(node -e "console.log(require('@playwright/test').chromium.executablePath())") npm run test:e2e`.

URL options: `?intro=0` skips the opening sequence, `?quality=low|medium|high` sets the render quality (otherwise the last choice in this browser, or a device-based recommendation).

Responsive design: see [documentation/DEVICE_COMPATIBILITY.md](documentation/DEVICE_COMPATIBILITY.md) for layouts, input and supported browsers, and [documentation/RESPONSIVE_ARCHITECTURE.md](documentation/RESPONSIVE_ARCHITECTURE.md) for how new systems inherit it.

## What works

| Area | Behaviour |
| --- | --- |
| Scene | Dark animated ocean with fresnel, glints and a technical grid; procedural generic 78 × 20 m DP2 offshore vessel (depth 6.5 m, draught 4.8 m) laid out from a supplied GA plan: forecastle, three-tier accommodation, wheelhouse with wings, mast, helideck over the bow, knuckle-boom crane and crash barrier on the aft working deck, azimuth pods (see documentation/VESSEL_LAYOUT.md) |
| Installation | Every system sits where its installer guide or the governing rule puts it; each details panel has an Installation row, and documentation/INSTALLATION_GUIDE.md gives the location, the rule and the standard installation procedure per system |
| Demo video | 2.5-minute exhibition video of the web interface (1080p30, narrated, with music and chapter titles): https://rahulrajalpy16-coder.github.io/Sinor-marine-Demo-/demo/sinor-marine-exhibition-demo.mp4 . Rebuild it with scripts/video (narration.json, voice.py, music.py, overlays.mjs, capture.mjs, assemble.py; see the header of each) |
| Opening | The ship is revealed as a holographic wireframe, then a sweep turns it solid while the camera orbits in. You can skip it with the button, Esc or a drag. With reduced motion on, it is skipped |
| Visual modes | **Hybrid** (realistic aft, cyan holographic forward), **Realistic** (daylight sky and sea, sky reflections, true paint colours with no cyan tint even on the selected system, underwater haze below the surface, open bow thruster tunnels, grey primer inside the hull), **Blueprint**, **X-ray** (see-through hull and sea), **Isolate** (selected system only) and **Exploded** (bow thruster assembly; disabled when no explodable system is selected). Switching modes never moves the camera or drops the selection |
| Selection | Click the 3D mesh, its callout label or the system explorer list. All three call the same store action. The camera flies to a focus anchor (GSAP, 1.3 s, instant with reduced motion), the mesh lights up and outlines, and the inspector opens |
| Systems | DP console (on the bridge, screens facing the operator), hydroacoustic PRS transducer (below the keel, with an optional acoustic path to a seabed transponder: range = c·t/2, c = 1500 m/s) and bow tunnel thruster |
| Bow thruster (P2 standard) | Controllable-pitch tunnel thruster: 800 kW constant-speed electric motor, Ø2.1 m tunnel, 4-blade CPP on a right-angle gear pod, hydraulic power unit and a Z-Thrust local cabinet. Operated from a Z-Thrust style CPP control panel (expandable to full screen): Propeller RPM and Pitch % gauges, status (Control active, Station Bridge/DP, FU/NFU mode, Shutdown, Reduction zone), follow-up lever or NFU port/stbd buttons, validated exact pitch entry, Start (soft-start, blocked unless the lever is at zero), Stop (de-pitch, then run down), E-Stop (trip, latched until reset), sim pause/resume, reset, power limit with load clipping, and an alarm list with acknowledge. Blades visibly change pitch while the shaft turns at constant speed; force arrow and water jet follow thrust. No azimuth control, because the tunnel is fixed |
| HPR system | Sonardyne Type 7950 through-hull deployment machine (standard length) carrying the HPT 5000 USBL transceiver, Type 8142-000-01, built from the supplied drawings and UM-8142. It includes the 6.1 × 1.8 × 1.0 m mounting space with its ladder and grating, the 150 mm hull penetrator, the 14" gate valve with handwheel, the adaptor flange, the seachest with inspection door, the sealing section and the top section (top support, moving plate, main ram inside the pole, guides). The deployment panel works through interlocks; the transceiver deploys to the 2,775 mm reference, 2.95 m below the hull. DP only uses the HPR reference while it is deployed. Verified and unverified data are listed in [documentation/HPR_SYSTEM.md](documentation/HPR_SYSTEM.md) |
| Integrated bridge | DP2 offshore vessel bridge: a wraparound forward console (centre section with five multi-function workstations, X-band radar, ECDIS 1, conning, ECDIS 2, S-band radar, with live screens, autopilot, thruster levers and the Z-Thrust BT1 panel; GMDSS and alarm/CCTV wings), two navigator chairs, overhead repeaters, chart table, and aft console wings either side of the DP station (aft manoeuvring levers, thruster mimic, deck CCTV, winch and tugger controls). Console top 1.2 m (SOLAS V/22, MSC/Circ.982). Only the IBS, DP and Z-Thrust items carry makers; the rest is generic. Interior camera with close orbit limits |
| Position references | Guidance Marine RadaScan View (radar) and CyScan AS (laser) on the bridge top, tracking a responder and target on an illustrative platform astern; two Fugro Seastar 9410-AUT DGPS receivers with antennas on the mast; SMT Taut Wire 2.0 Z Mk2 on the starboard deck, whose cranked boom swings out and whose 400 kg weight lands on the seabed while the across/along angles follow the vessel; Sonardyne SPRINT-Nav DP on a Type 8097 over-the-side pole on the port side, laid out to the 8097 drawing, with swing, hull lock, INS alignment and DVL bottom lock. Each has its own panel; DP uses each one only once it is running and selected. Values come from the supplied datasheets; derived and unverified values are listed in [documentation/POSITION_REFERENCES.md](documentation/POSITION_REFERENCES.md) |
| DP system | Aft-facing DP station of 26" pedestal operator stations built to Marine Technologies drawing 5000-501092 and the supplied photo (653.5 W × 685.9 D × 1204.25 H mm, desk front 767 mm, black cabinet 676 mm with door and flush handles, display housing leaning back about 26° in a silver-trimmed face, rounded trimmed desk nose) with DP panel (heading knob, joystick, keypad, red trackball), a light-grey DP display with green soft keys, and a 19" rack (explodable: door opens, rack slides out, upper unit lifts) in a cabinet beside the station. Each station has a DP operator chair on floor rails with the independent joystick system (IJS) in the left armrest and a trackball and keypad in the right. Class DP1/DP2/DP3 per the distributed architecture: 1 or 3 voting controllers, 1–3 operator stations, single or dual network, DP3 backup station in an A60 room. 3-DOF model with wind and current, PID with wind feed-forward, least-squares allocation over BT1 (Z-Thrust, handed over from the bridge), BT2 and two stern azimuths that visibly slew. Modes standby, joystick, auto heading, auto position; setpoint moves; references DGPS 1/2 (Fugro SeaSTAR), HPR, RadaScan, CyScan, taut wire and SPRINT-Nav, all connected and in use when the app starts with the vessel on station (`?start=stowed` starts with everything stowed), with median voting; failure injection for controllers, networks, references (drift/lost), thrusters and a DP3 bridge fire; consequence analysis; alarms with acknowledge; the vessel really moves in the scene. Optional 3D overlay of the DP network and IO units |
| Devices | One app for desktop, laptop, tablet and phone. Desktop: sidebar explorer and details column. Tablet: collapsible explorer and details drawer (bottom sheet in portrait). Phone: View menu, explorer drawer and a draggable bottom sheet with 44 px touch targets. Rotation and resizes re-fit the canvas and the overview. Low/medium/high quality with automatic starting choice and a frame-rate monitor that trims the pixel ratio |
| Camera | Orbit, zoom and pan (touch: one-finger orbit, pinch zoom, two-finger pan; keyboard: arrows orbit, +/- zoom, Home overview, F refocus). A drag across a system orbits; only a tap or click selects. Distance and pitch limits per camera mode, with looking up from below the surface allowed only for underwater systems. **Return** restores the exact pose you came from, **Overview** resets, Esc returns |
| Robustness | Each registry `model` path is probed first. When the GLB is missing (all of them, today), the procedural model is used and labelled. A WebGL failure leaves the HUD and list usable |
| Accessibility | A keyboard-operable system explorer, aria-pressed state on toggles, visible focus rings, a reduced-motion toggle (which also honours the OS setting), and low/medium/high quality presets |

## Architecture

```
src/
  data/          vessel, equipment and design JSON (validated at startup)
  equipment/     typed schema + parser, registry with scene placements, asset adapter (GLB → procedural fallback), equipment meshes
  vessels/       parametric hull geometry, segmented procedural vessel
  rendering/     shared materials, pure mode table (modes.ts), mode → material application, hybrid part, quality profiles
  camera/        pure camera-mode state machine + limits, GSAP camera rig
  interactions/  shared input rules (tap vs drag, touch/mouse/keyboard), selection hooks, equipment visual mapping, pose registry
  responsive/    pure layout classification and device capabilities, live viewport store
  simulations/   pure thruster model + FSM, fixed-step integrator, controller with subscriptions, acoustic ranging
  scene/         Canvas, ocean shader, hotspots, simulation driver, test bridge
  components/    HUD: top bar, system explorer, inspector, system HMI panels (systemPanels.ts), bottom bar, intro
    shell/       device containers: systems panel, inspector dock, bottom sheet
  store/         Zustand store (normalized IDs only, no Three.js objects)
```

Simulation state lives in a controller outside React. The scene reads it every frame, while the UI subscribes at 15 Hz and on every command. Integration uses a fixed 1/120 s step with an exact first-order-lag update, so it is stable at any frame rate. Frame gaps longer than 0.2 s are dropped rather than replayed. Coordinates are in metres with +Y up, +Z bow and +X starboard; a positive pitch command pushes the bow to starboard (+X). Thruster model: F = Fmax·sign(p)·|p|^1.5·(n/n_rated)², P = P_rated·(n/n_rated)³·(0.12 + 0.88·|p|^2.5), pitch servo rate limited to 25 %/s.

## Tests (as run for this delivery)

- `npx tsc -b`: clean
- `npm test`: 99 unit tests in 11 files (including the position reference sensors and seven-reference DP voting, Type 7950 geometry against the drawings, the deployment sequence and interlocks, and the HPR as a DP reference). They cover layout classification for phones, tablets and desktops, quality recommendation and persistence, tap-vs-drag, keyboard camera steps within orbit limits, bottom-sheet snapping, schema parsing and ID uniqueness, selection/deselection and the state model, camera mode transitions, reset and limits, mode changes preserving selection and camera, exploded-mode availability, CPP thruster clamp/validation, start interlock, soft start, pitch servo, load clipping, NFU and DP command transfer, stop/E-stop/reset/pause, large-step stability, fixed-step frame-rate independence, acoustic range maths, hull dimensions, asset fallback, and a test that unmounting a component removes its controller subscription
- `npm run build`: succeeds. The three.js chunk is about 684 kB (176 kB gzip)
- `npm run test:e2e`: 24 Playwright tests (including the HPR deployment flow and the position references flow) in headless Chromium using SwiftShader software WebGL (the 7 responsive ones are listed in documentation/DEVICE_COMPATIBILITY.md):
  - the ship renders with cyan linework, the missing GLBs fall back to procedural models, and there are no runtime errors
  - an orbit drag and a wheel zoom move the camera
  - clicking each of the three meshes on the canvas (a real raycast; the callout labels are hidden for this test) opens the right panel and focuses the camera
  - the system explorer centres the matching mesh, Return restores the exact starting pose, and Overview and Esc work
  - all six visual modes keep the scene drawn, the selection and the camera
  - the thruster rejects bad input, clamps, blocks a start with the lever off zero, runs up, pitches to port, pauses, and resets to zero
  - the intro plays and can be skipped, and is skipped under reduced motion
  - the system explorer works from the keyboard
  - on a 390 px mobile layout, the systems drawer, tap-to-select and Return work

Screenshots from the run are in `screenshots/`.

## Known limits (Phase 1)

- The geometry is procedural and representative. Equipment `model` paths in the registry point at GLBs that don't exist yet; dropping a real GLB at `public/models/<name>.glb` makes it load automatically.
- HPR ranges are geometric (r = c·t/2 with an assumed sound speed); the Type 7950's speeds, valve time and interlocks are illustrative because no hydraulic data was supplied.
- Bridge interior navigation with collision-safe boundaries is Phase 2. Today the DP focus anchor sits inside the open bridge shell, and orbiting from there can pass through walls.
- On phones the bottom sheet covers part of the view; drag it down to peek to see the focused item.
- Performance was checked only in software WebGL. GPU frame times on target devices are not yet measured (Phase 4 polish).
