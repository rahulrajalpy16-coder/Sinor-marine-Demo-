/** Camera navigation modes and their legal transitions (pure; no Three.js). */

export type CameraMode = 'overview' | 'orbit' | 'guided' | 'interior' | 'inspection' | 'simulation';

export type CameraEvent =
  | { type: 'USER_ORBIT' }
  | { type: 'FOCUS' }
  | { type: 'SIMULATE' }
  | { type: 'END_SIMULATION' }
  | { type: 'RESET' }
  | { type: 'INTRO' };

export function nextCameraMode(mode: CameraMode, ev: CameraEvent): CameraMode {
  switch (ev.type) {
    case 'RESET':
      return 'overview';
    case 'INTRO':
      return 'guided';
    case 'USER_ORBIT':
      // Free orbiting is only a mode change from overview; inspecting/simulating keeps its context.
      return mode === 'overview' || mode === 'guided' ? 'orbit' : mode;
    case 'FOCUS':
      return 'inspection';
    case 'SIMULATE':
      return mode === 'inspection' || mode === 'simulation' ? 'simulation' : mode;
    case 'END_SIMULATION':
      return mode === 'simulation' ? 'inspection' : mode;
  }
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

// Scene coordinates (after the world reflection): from the starboard bow quarter, where the crane side shows.
export const OVERVIEW_POSE: CameraPose = { position: [-84, 38, 70], target: [0, 5, 10] };
/** Pull the overview camera back on portrait screens so the whole hull fits horizontally. */
export function overviewPoseFor(aspect: number): CameraPose {
  if (!(aspect > 0) || aspect >= 1.2) return OVERVIEW_POSE;
  const k = Math.min(2.6, 1.2 / aspect);
  const [x, y, z] = OVERVIEW_POSE.position;
  return { position: [x * k, y * k, z * k], target: OVERVIEW_POSE.target };
}

export const INTRO_START_POSE: CameraPose = { position: [-26, 6, 78], target: [0, 1, 26] };

/** Orbit limits per mode: distance and polar angle (0 = straight down, π/2 = horizon). */
export interface OrbitLimits {
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

export function orbitLimitsFor(mode: CameraMode, underwaterFocus: boolean, interiorFocus = false, interiorMax = 7): OrbitLimits {
  if ((mode === 'inspection' || mode === 'simulation') && interiorFocus) {
    // Inside the ship: stay close so the camera does not pass through the bulkheads.
    return { minDistance: 0.8, maxDistance: interiorMax, minPolarAngle: 0.2, maxPolarAngle: Math.PI * 0.62 };
  }
  if ((mode === 'inspection' || mode === 'simulation') && underwaterFocus) {
    return { minDistance: 6, maxDistance: 90, minPolarAngle: 0.1, maxPolarAngle: Math.PI * 0.8 };
  }
  if (mode === 'inspection' || mode === 'simulation') {
    return { minDistance: 5, maxDistance: 120, minPolarAngle: 0.1, maxPolarAngle: Math.PI * 0.53 };
  }
  return { minDistance: 18, maxDistance: 260, minPolarAngle: 0.12, maxPolarAngle: Math.PI * 0.49 };
}

/** Clamp a camera position so it never sits inside the hull's bounding volume (simple clipping guard). */
export function clampOutsideHull(p: [number, number, number]): [number, number, number] {
  const [x, y, z] = p;
  const inside = Math.abs(x) < 9.5 && y > -5.5 && y < 13 && z > -41 && z < 41;
  if (!inside) return p;
  const pushX = (x >= 0 ? 1 : -1) * 9.5;
  return [pushX, y, z];
}
