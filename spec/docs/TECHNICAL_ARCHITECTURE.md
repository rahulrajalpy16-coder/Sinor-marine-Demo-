# Technical architecture
Stack: Vite + React + TypeScript; Three.js + @react-three/fiber + @react-three/drei; Zustand; Tailwind; GSAP for camera choreography; Vitest; Playwright. Use Rapier only where needed.

Modules:
- src/scene: Canvas, environment, lights, ocean, postprocessing
- src/vessels: vessel mesh groups, compartment coordinates
- src/rendering: hybrid materials, wireframe overlays, modes
- src/camera: orbit/interior/focus transitions, clipping guards
- src/equipment: data registry, mesh IDs, asset adapters
- src/interactions: raycasting, hover, selection, action dispatch
- src/simulations: pure TypeScript models and finite state machines
- src/components: HUD, explorer, information, simulation controls
- src/store: scene and equipment state

Keep simulation state separate from render frames. Define typed contracts for Equipment, Vessel, SimulationController. Store normalized IDs, not Three.js object instances. All animation loops must clean up on unmount.

Assets: GLB/GLTF, compressed geometry and textures, lazy loading and graceful procedural fallbacks. Backend deferred for MVP; later PostgreSQL/object storage with role-based content editing.
