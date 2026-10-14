# Sinor Marine Digital Universe — Claude Code Instructions

You are the lead engineer and creative technologist. Build a real browser-based interactive 3D maritime engineering world, not a landing page, video, or static viewer.

## Product vision
A representative offshore DP vessel in a dark ocean scene, mixing physically based realistic surfaces with glowing cyan engineering wireframes. Visitors orbit, zoom, enter bridge and machinery areas, select equipment, inspect assemblies and run interactive educational simulations.

## Non-negotiable rules
- Use React, TypeScript, Vite, Three.js, React Three Fiber, Drei, Zustand, Tailwind, Vitest and Playwright.
- The ship is the primary navigation interface. Equipment must have individually selectable meshes and stable IDs.
- Support hybrid, realistic, blueprint, X-ray and system-isolation modes; exploded view for suitable assemblies.
- Separate rendering, camera, content registry, interactions and simulation logic.
- Do not claim representative geometry, simulated physics or unverified OEM product information is certified or exact.
- No fake controls or pre-rendered videos substituting for interactions.
- If models are unavailable, create a segmented, navigable procedural vessel first; mark it representative.
- Inspect reference/gemini_generated_video_5EE032DE.MP4 for visual inspiration. Do not treat video as a source of exact engineering dimensions.
- Keep the app working at every phase. Run typecheck, tests and build. Report tested functionality honestly.
- Use meters. In Three.js: +Y up, +Z bow, +X starboard. Translate planar simulation coordinates to scene X/Z explicitly.
- Never require credentials for MVP. Backend is optional until content editing is implemented.

## Required first milestone
Running web app with procedural offshore vessel, smooth orbit/zoom, hybrid cyan wireframe effect, rendering mode selector, three selectable systems (DP console, HPR transducer, bow tunnel thruster), equipment panel, thruster animation and reset-to-overview.

## Working method
Read docs and data first; write a short implementation plan; implement files; install dependencies; test; fix; summarize. Do not stop at plans or scaffolding. Prefer functional vertical slices over broad unfinished features.
