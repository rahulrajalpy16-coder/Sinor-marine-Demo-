# Responsive architecture

How the responsive framework is split, and what a new equipment system or simulation needs to do to inherit it. Short version: nothing device-specific.

## Layers

| Layer | Files | Knows about devices? |
| --- | --- | --- |
| Scene geometry (vessel, equipment meshes) | `src/vessels/`, `src/equipment/*.tsx` | No. Reads `useQualityProfile()` only if it has something to scale |
| Equipment data | `src/data/*.json`, `src/equipment/registry.ts` | No |
| Simulation logic | `src/simulations/` (pure models + controllers outside React) | No |
| Camera | `src/camera/` (pure state machine + limits, GSAP rig) | Reads orbit tuning for touch vs mouse |
| Input rules | `src/interactions/input.ts`, `useSelectable.ts` | Yes: tap slop, touch/mouse mapping, keyboard map |
| Device detection | `src/responsive/device.ts` (pure), `useDevice.ts` (live store) | Yes |
| Render quality | `src/rendering/quality.ts` | Yes: presets, recommendation, persistence |
| Device UI | `src/components/shell/` (SystemsPanel, InspectorDock, BottomSheet), `TopBar`, `BottomBar` | Yes |

Viewport state lives in its own small store (`useDevice`), separate from the app store, so a rotation never re-renders selection or simulation consumers.

## Adding a new system

1. Add the record to `src/data/equipment-registry.json` and its placement (focus anchor, `interior`/`underwater`, `explodable`) in `src/equipment/registry.ts`.
2. Build the mesh as a component and spread `useSelectable(id)` on its root group. Mouse click, touch tap, hover (mouse only), the drag-vs-tap rule and the explorer entry all come with it.
3. Use `useEquipmentMaterials` for highlight, ghost and visual modes.
4. If it has a live display or fine geometry, read `useQualityProfile()` (or `qualityProfile(useAppStore.getState().quality)` inside `useFrame`) for `screenHz` and `radialSegments`.
5. If it has an HMI, add one line to `src/components/systemPanels.ts`. The panel then appears in the desktop column, the tablet drawer and the phone bottom sheet. Lay it out as one column under 640 px (Tailwind `sm:` for wider), and add a "⤢" full-screen view through a portal like `ThrusterPanel` if it is dense.
6. Keep the simulation as a controller outside React (see `ThrusterController`, `DPController`) and tick it from `SimulationDriver`.

## Future VR

Geometry is in real metres with +Y up, +Z bow, +X starboard; selection goes through one store action (`select(id)`), and the camera rig is the only code that moves the camera. A WebXR controller ray would call the same `select` and replace the rig; no equipment or simulation code would change. WebXR is not implemented.
