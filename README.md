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
| Scene | Dark animated ocean with fresnel, glints and a technical grid; procedural 80 × 18 × 8 m hull lofted from stations, plus superstructure, open bridge, mast, crane, A-frame and azimuth pods |
| Opening | The ship is revealed as a holographic wireframe, then a sweep turns it solid while the camera orbits in. You can skip it with the button, Esc or a drag. With reduced motion on, it is skipped |
| Visual modes | **Hybrid** (realistic aft, cyan holographic forward), **Realistic**, **Blueprint**, **X-ray** (see-through hull and sea), **Isolate** (selected system only) and **Exploded** (bow thruster assembly; disabled when no explodable system is selected). Switching modes never moves the camera or drops the selection |
| Selection | Click the 3D mesh, its callout label or the system explorer list. All three call the same store action. The camera flies to a focus anchor (GSAP, 1.3 s, instant with reduced motion), the mesh lights up and outlines, and the inspector opens |
| Systems | DP console (on the bridge, screens facing the operator), hydroacoustic PRS transducer (below the keel, with an optional acoustic path to a seabed transponder: range = c·t/2, c = 1500 m/s) and bow tunnel thruster |
| Bow thruster (P2 standard) | Controllable-pitch tunnel thruster: 800 kW constant-speed electric motor, Ø2.1 m tunnel, 4-blade CPP on a right-angle gear pod, hydraulic power unit and a Z-Thrust local cabinet. Operated from a Z-Thrust style CPP control panel (expandable to full screen): Propeller RPM and Pitch % gauges, status (Control active, Station Bridge/DP, FU/NFU mode, Shutdown, Reduction zone), follow-up lever or NFU port/stbd buttons, validated exact pitch entry, Start (soft-start, blocked unless the lever is at zero), Stop (de-pitch, then run down), E-Stop (trip, latched until reset), sim pause/resume, reset, power limit with load clipping, and an alarm list with acknowledge. Blades visibly change pitch while the shaft turns at constant speed; force arrow and water jet follow thrust. No azimuth control, because the tunnel is fixed |
| Integrated bridge | Forward IBS console with five multi-function workstations (X-band radar, ECDIS 1, conning, ECDIS 2, S-band radar) with live screens, overhead displays, steering stand with the Z-Thrust BT1 panel, navigator chairs and chart table. Interior camera with close orbit limits |
| DP system | Aft-facing DP station of 26" pedestal operator stations (654 × 1206 mm, after drawing 5000-501092) with DP panel, joystick, trackball, live display and a 19" rack (explodable). Class DP1/DP2/DP3 per the distributed architecture: 1 or 3 voting controllers, 1–3 operator stations, single or dual network, DP3 backup station in an A60 room. 3-DOF model with wind and current, PID with wind feed-forward, least-squares allocation over BT1 (Z-Thrust, handed over from the bridge), BT2 and two stern azimuths that visibly slew. Modes standby, joystick, auto heading, auto position; setpoint moves; references GNSS1/GNSS2/HPR with median voting; failure injection for controllers, networks, references (drift/lost), thrusters and a DP3 bridge fire; consequence analysis; alarms with acknowledge; the vessel really moves in the scene. Optional 3D overlay of the DP network and IO units |
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
- `npm test`: 79 unit tests in 9 files. They cover layout classification for phones, tablets and desktops, quality recommendation and persistence, tap-vs-drag, keyboard camera steps within orbit limits, bottom-sheet snapping, schema parsing and ID uniqueness, selection/deselection and the state model, camera mode transitions, reset and limits, mode changes preserving selection and camera, exploded-mode availability, CPP thruster clamp/validation, start interlock, soft start, pitch servo, load clipping, NFU and DP command transfer, stop/E-stop/reset/pause, large-step stability, fixed-step frame-rate independence, acoustic range maths, hull dimensions, asset fallback, and a test that unmounting a component removes its controller subscription
- `npm run build`: succeeds. The three.js chunk is about 684 kB (176 kB gzip)
- `npm run test:e2e`: 20 Playwright tests in headless Chromium using SwiftShader software WebGL (the 7 responsive ones are listed in documentation/DEVICE_COMPATIBILITY.md):
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
- The DP console's "simulate" action is deliberately disabled until Phase 3 (3-DOF model). The HPR panel shows geometric range and round-trip time; a full ranging simulation is Phase 3. The deployment mechanism is listed as Planned (Phase 4) and can't be selected.
- Bridge interior navigation with collision-safe boundaries is Phase 2. Today the DP focus anchor sits inside the open bridge shell, and orbiting from there can pass through walls.
- On phones the bottom sheet covers part of the view; drag it down to peek to see the focused item.
- Performance was checked only in software WebGL. GPU frame times on target devices are not yet measured (Phase 4 polish).
