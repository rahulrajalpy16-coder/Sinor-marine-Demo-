# Interaction specification
Equipment states: idle -> hovered -> selected -> focused -> inspecting -> simulating. Exit restores previous navigation context. Selecting through scene and equipment tree uses same state action.

Camera modes: overview, orbit, guided, interior, inspection, simulation. Prevent clipping, restrict distance and pitch appropriately, provide reset.
Visual modes: hybrid, realistic, blueprint, X-ray, isolation, exploded (where supported); switching mode must preserve camera.
On select: highlight exact mesh, move camera toward preconfigured focus anchor, open technical panel, enable available actions. Unsupported actions should not render as active.
Mobile: tap to select, one-finger orbit, pinch zoom, explicit focus and return buttons.
Simulation commands: start/pause/resume/reset/stop, validated inputs, deterministic states, explicit error/loading feedback.
