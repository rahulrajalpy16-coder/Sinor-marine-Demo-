# Engineering demonstration specifications
All demonstrations are illustrative, non-certified, not connected to live equipment.

## DP
Planar 3-DOF model: eta=[north,east,heading], nu=[surge,sway,yaw_rate]; eta_dot=R(heading)nu; M nu_dot + D nu = control_tau + environment_tau. Use a stable fixed timestep and documented illustrative coefficients. Map horizontal motion to Three.js X/Z, vertical Y unchanged. Controls: target position/heading, wind/current magnitude/direction, start/pause/reset. Render vessel position, desired position, heading, error and thrust vectors. Do not imitate a proprietary DP algorithm.

## Hydroacoustic PRS
Underwater transducer, seabed transponder and animated acoustic paths. For illustrative two-way range: range = assumed_sound_speed * round_trip_time / 2. Make measurement type explicit. Start/pause/reset and target position controls. No claims about Sonardyne proprietary implementation.

## Bow tunnel thruster
Signed thrust command [-1,1], propeller angular speed tied to command magnitude/sign, lateral force vector. Tunnel thruster is fixed orientation: no azimuth steering control. Include start, pause, stop, reset.

## Deployment mechanism (later)
States stowed, deploying, deployed, retracting, paused, fault_demo. Valid transitions only; clamp travel and protect limits. Animate actual carriage and sensor movement, not only text.
