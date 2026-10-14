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

URL options: `?intro=0` skips the opening sequence, `?quality=low|medium|high` sets the render quality.

## What works

| Area | Behaviour |
| --- | --- |
| Scene | Dark animated ocean with fresnel, glints and a technical grid; procedural 80 × 18 × 8 m hull lofted from stations, plus superstructure, open bridge, mast, crane, A-frame and azimuth pods |
| Opening | The ship is revealed as a holographic wireframe, then a sweep turns it solid while the camera orbits in. You can skip it with the button, Esc or a drag. With reduced motion on, it is skipped |
| Visual modes | **Hybrid** (realistic aft, cyan holographic forward), **Realistic**, **Blueprint**, **X-ray** (see-through hull and sea), **Isolate** (selected system only) and **Exploded** (bow thruster assembly; disabled when no explodable system is selected). Switching modes never moves the camera or drops the selection |
| Selection | Click the 3D mesh, its callout label or the system explorer list. All three call the same store action. The camera flies to a focus anchor (GSAP, 1.3 s, instant with reduced motion), the mesh lights up and outlines, and the inspector opens |
| Systems | DP console (on the bridge, screens facing the operator), hydroacoustic PRS transducer (below the keel, with an optional acoustic path to a seabed transponder: range = c·t/2, c = 1500 m/s) and bow tunnel thruster |
| Thruster demo | Signed command −100…+100 % (slider or validated text field; non-numbers are rejected, out-of-range values are clamped). Start, pause, resume, stop (spins down) and reset (immediate zero). The propeller turns at the simulated speed, there is a force arrow on the pushed side and a water jet on the other, plus rpm and kN readouts. There is no azimuth control, because the tunnel is fixed |
| Camera | Orbit, zoom and pan (touch: one-finger orbit, pinch zoom). Distance and pitch limits per camera mode, with looking up from below the surface allowed only for underwater systems. **Return** restores the exact pose you came from, **Overview** resets, Esc returns |
| Robustness | Each registry `model` path is probed first. When the GLB is missing (all of them, today), the procedural model is used and labelled. A WebGL failure leaves the HUD and list usable |
| Accessibility | A keyboard-operable system explorer, aria-pressed state on toggles, visible focus rings, a reduced-motion toggle (which also honours the OS setting), and low/medium/high quality presets |

## Architecture

```
src/
  data/          vessel, equipment and design JSON (validated at startup)
  equipment/     typed schema + parser, registry with scene placements, asset adapter (GLB → procedural fallback), equipment meshes
  vessels/       parametric hull geometry, segmented procedural vessel
  rendering/     shared materials, pure mode table (modes.ts), mode → material application, hybrid part
  camera/        pure camera-mode state machine + limits, GSAP camera rig
  interactions/  selection hooks, pure equipment visual mapping, pose registry
  simulations/   pure thruster model + FSM, fixed-step integrator, controller with subscriptions, acoustic ranging
  scene/         Canvas, ocean shader, hotspots, simulation driver, test bridge
  components/    HUD: top bar, system explorer, inspector, thruster and HPR panels, bottom bar, intro
  store/         Zustand store (normalized IDs only, no Three.js objects)
```

Simulation state lives in a controller outside React. The scene reads it every frame, while the UI subscribes at 15 Hz and on every command. Integration uses a fixed 1/120 s step with an exact first-order-lag update, so it is stable at any frame rate. Frame gaps longer than 0.2 s are dropped rather than replayed. Coordinates are in metres with +Y up, +Z bow and +X starboard; a positive thrust command pushes the bow to starboard (+X).

## Tests (as run for this delivery)

- `npx tsc -b`: clean
- `npm test`: 46 unit tests in 7 files. They cover schema parsing and ID uniqueness, selection/deselection and the state model, camera mode transitions, reset and limits, mode changes preserving selection and camera, exploded-mode availability, thruster clamp/validation/stop/reset/pause, large-step stability, fixed-step frame-rate independence, acoustic range maths, hull dimensions, asset fallback, and a test that unmounting a component removes its controller subscription
- `npm run build`: succeeds. The three.js chunk is about 684 kB (176 kB gzip)
- `npm run test:e2e`: 11 Playwright tests in headless Chromium using SwiftShader software WebGL:
  - the ship renders with cyan linework, the missing GLBs fall back to procedural models, and there are no runtime errors
  - an orbit drag and a wheel zoom move the camera
  - clicking each of the three meshes on the canvas (a real raycast; the callout labels are hidden for this test) opens the right panel and focuses the camera
  - the system explorer centres the matching mesh, Return restores the exact starting pose, and Overview and Esc work
  - all six visual modes keep the scene drawn, the selection and the camera
  - the thruster rejects bad input, clamps, spins and pushes to port, pauses, and resets to zero
  - the intro plays and can be skipped, and is skipped under reduced motion
  - the system explorer works from the keyboard
  - on a 390 px mobile layout, the systems drawer, tap-to-select and Return work

Screenshots from the run are in `screenshots/`.

## Known limits (Phase 1)

- The geometry is procedural and representative. Equipment `model` paths in the registry point at GLBs that don't exist yet; dropping a real GLB at `public/models/<name>.glb` makes it load automatically.
- The DP console's "simulate" action is deliberately disabled until Phase 3 (3-DOF model). The HPR panel shows geometric range and round-trip time; a full ranging simulation is Phase 3. The deployment mechanism is listed as Planned (Phase 4) and can't be selected.
- Bridge interior navigation with collision-safe boundaries is Phase 2. Today the DP focus anchor sits inside the open bridge shell, and orbiting from there can pass through walls.
- On phones the inspector sheet covers the lower half of the view, so the focused item can sit behind it.
- Performance was checked only in software WebGL. GPU frame times on target devices are not yet measured (Phase 4 polish).
