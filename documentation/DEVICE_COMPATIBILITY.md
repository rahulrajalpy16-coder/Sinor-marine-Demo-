# Device compatibility

One web application serves every device. Nothing is installed (no PWA yet) and there is no separate mobile site; the same 3D scene, simulations and HMI panels run everywhere, and only the HUD containers and render settings adapt.

## Layout classes

The class is chosen from the viewport and the primary pointer (`src/responsive/device.ts`, `layoutFor`). It is re-evaluated on every resize and rotation.

| Class | When | Systems explorer | System details / HMI | Top bar |
| --- | --- | --- | --- | --- |
| Desktop | width ≥ 1024 px with a mouse or trackpad | Fixed left sidebar | Right column | Modes and settings inline |
| Tablet | 640–1023 px, or any touch-first screen ≥ 640 px (iPad in either orientation) | "☰ Systems" panel that closes after a pick | Landscape: right drawer with Hide/Show. Portrait: bottom sheet (opens at peek) | Inline, modes wrap to their own row |
| Mobile | width < 640 px, or a touch screen whose short side is < 500 px (a phone in landscape) | Full-height drawer | Portrait: bottom sheet (drag or tap the handle for peek / half / full). Landscape: side drawer with Hide/Show, so the 3D view keeps its height | Brand plus a "View ▾" menu holding modes, quality and reduced motion |

Touch screens get 44 px minimum targets on the shell controls (Tailwind `coarse:` variant, `(pointer: coarse)`). Safe-area insets keep controls clear of notches and home indicators, and the root uses `100dvh` so mobile browser toolbars don't hide the bottom bar. The HMI panels (Z-Thrust, DP) keep their own "⤢" full-screen view on every device.

## Input

| Action | Mouse / trackpad | Touch | Keyboard |
| --- | --- | --- | --- |
| Orbit | Left drag | One-finger drag | Arrow keys (Shift for larger steps) |
| Zoom | Wheel, middle drag, trackpad pinch | Two-finger pinch | `+` / `-` |
| Pan | Right drag | Two-finger drag | — |
| Select a system | Click the mesh or its label, or the explorer | Tap the mesh or its label, or the explorer | Tab to the explorer, Enter |
| Refocus | "Refocus" / "◎ Focus" | Same | `F` |
| Return | "Return" | Same | Esc |
| Overview | "⟲ Overview" | Same | Home or `O` |

A drag that starts and ends on a system orbits the camera; only a click or tap (movement under 5 px for a mouse, 12 px for a finger) selects. Keys typed into sliders, number fields and selects stay with those controls. Rules live in `src/interactions/input.ts`.

## Render quality

| Preset | Pixel ratio | Bloom / vignette | MSAA | Ocean grid | Live screens |
| --- | --- | --- | --- | --- | --- |
| Low | 0.75–1 | Off | Off | 96² | 2 Hz |
| Medium | 1–1.5 | On | Off | 192² | 5 Hz (DP ≤ 4 Hz) |
| High | 1–2 | On (stronger) | 4× | 288² | 8 Hz (DP ≤ 4 Hz) |

The starting preset is, in order: `?quality=` in the URL, the user's last choice in this browser, then a recommendation from the device. No WebGL2, a software GPU (SwiftShader, llvmpipe) or ≤ 2 GB / ≤ 2 cores gives Low; phones and tablets get Medium; desktops with ≥ 8 cores and ≥ 8 GB get High; everything else Medium. While running, a frame-rate monitor lowers the pixel ratio within the preset's range when frames drop and raises it again when they recover, without changing the preset. Profiles live in `src/rendering/quality.ts`.

## Browser support

| Platform | Browser | Status |
| --- | --- | --- |
| Windows, macOS, Linux | Chrome / Edge 110+, Firefox 115+, Safari 16.4+ | Supported |
| iPhone, iPad (iOS / iPadOS 16.4+) | Safari, and Chrome/Edge/Firefox (all WebKit on iOS) | Supported |
| Android 10+ | Chrome 110+, Samsung Internet 21+, Firefox | Supported |
| Any | No WebGL | HUD and system explorer still work; the 3D view shows a notice |

`100dvh` needs Safari 15.4 / Chrome 108; older browsers fall back to `100%` height.

## How this was tested

Automated (Playwright, headless Chromium with software WebGL) in `e2e/responsive.spec.ts` and `e2e/app.spec.ts`:

- Desktop 1440 × 900: keyboard orbit, zoom and overview; a drag across a system does not reselect it; the chosen quality persists across reloads.
- Phone 390 × 844 with touch: tap-select in the 3D view, bottom sheet snapping, View menu, 44 px targets, one-finger orbit and two-finger pinch zoom (real touch events), rotation to 844 × 390 resizing the canvas, keeping the selection and moving the details to the side drawer, then back to the sheet.
- Tablet 1180 × 820 with touch: collapsible explorer and details drawer, then rotation to portrait switching to the bottom sheet.

Not yet measured: frame times on physical phones and tablets with real GPUs. The emulated tests prove layout and input, not GPU performance.

## Known limits

- iOS Safari in Low Power Mode caps WebGL at 30 fps; the monitor will step the pixel ratio down.
- On phones the bottom sheet covers part of the view; drag it down to peek to see the focused system.
- Pinch-zoom of the whole page is deliberately captured by the 3D view (`touch-action: none` on the canvas). The page itself does not zoom.
