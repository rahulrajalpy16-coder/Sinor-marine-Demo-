import * as THREE from 'three';
import { LEVEL, WHEELHOUSE_AFT_Z, WHEELHOUSE_FRONT_Z } from '../vessels/vesselLayout';

/**
 * Generic wheelhouse console line, as fitted on DP2 offshore vessels (no maker): a sloped display panel over a
 * shallow desk with a rounded nose, a closed back towards the windows and a kick recess at the operator side.
 * Heights follow the bridge design guidance used by class and flag: console top no higher than 1.2 m so the
 * seated and standing view over it to the sea surface is kept (SOLAS V/22, MSC/Circ.982 §5.1), desk at about
 * 0.78 m for standing and seated work, foot recess for the seated operator.
 *
 * Profile in metres: d runs from the back (window side) towards the operator, y is height above the floor.
 */
export const CONSOLE_PROFILE: [number, number][] = [
  [0, 0],
  [0, 1.08],
  [0.06, 1.17],
  [0.18, 1.2],
  [0.42, 0.82],
  [0.88, 0.785],
  [0.94, 0.765],
  [0.955, 0.72],
  [0.93, 0.69],
  [0.84, 0.69],
  [0.84, 0.1],
  [0.78, 0.1],
  [0.78, 0],
];
export const CONSOLE_DEPTH = 0.955;
export const CONSOLE_TOP = 1.2;
/** Display face: from the top front edge down to the desk; displays sit in it. */
export const DISPLAY_FACE = { top: [0.18, 1.2] as [number, number], bottom: [0.42, 0.82] as [number, number] };
/** Desk panel behind the nose. */
export const DESK = { back: [0.42, 0.82] as [number, number], front: [0.88, 0.785] as [number, number] };

/** Point on a profile segment at fraction t, as [d, y]. */
export const lerp2 = (a: readonly [number, number], b: readonly [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Tilt of the display face back from vertical, and of the desk towards the operator, radians. */
export const FACE_TILT = Math.atan2(DISPLAY_FACE.bottom[0] - DISPLAY_FACE.top[0], DISPLAY_FACE.top[1] - DISPLAY_FACE.bottom[1]);
export const DESK_TILT = Math.atan2(DESK.back[1] - DESK.front[1], DESK.front[0] - DESK.back[0]);

/**
 * One straight console section of the given length, centred on x = 0, back at z = 0, operator side towards +z.
 * Rotate the group to face the operator the other way.
 */
export function consoleSection(length: number) {
  const shape = new THREE.Shape(CONSOLE_PROFILE.map(([d, y]) => new THREE.Vector2(d, y)));
  const b = 0.006;
  const g = new THREE.ExtrudeGeometry(shape, { depth: length - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 4 });
  // Shape x (d) → +z, shape y → y, extrusion → x.
  g.translate(0, 0, -(length - 2 * b) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** A console section placed in the wheelhouse: centre of its back edge and the yaw that turns +z to the operator. */
export interface ConsoleSection {
  name: string;
  x: number;
  z: number;
  yaw: number;
  length: number;
}

const WALL_HALF = 0.125;
const GAP = 0.1;

/**
 * Forward console: a straight centre section under the front windows and two wings that follow the chamfered
 * front corners, the conning position on the centreline (SOLAS V/22.1.1 view ahead; MSC/Circ.982 §5.2 work
 * stations grouped around the conning position).
 */
const FWD_BACK_Z = WHEELHOUSE_FRONT_Z - WALL_HALF - GAP;
const CHAMFER = Math.atan2(1, 2); // front corners run 2 m across for 1 m aft
export const FWD_CENTRE_HALF = 3.6;
// Wing back edge runs parallel to the chamfer, 0.225 m inside it (wall half thickness + gap); it starts where that
// line meets the centre section's back line (x ≈ 3.95 m) and stops short of the side wall.
const wingLen = 1.95;
// Inside face of the starboard chamfer, offset by the wall half thickness + gap: through (4.70, 23.80), sloping
// 1 m aft per 2 m outboard; it meets the centre section's back line (z = 24.175) at x = 3.95.
const WING_START_X = 4.7 - 2 * (FWD_BACK_Z - 23.8);
const wingCx = WING_START_X + (wingLen / 2) * Math.cos(CHAMFER);
const wingCz = FWD_BACK_Z - (wingLen / 2) * Math.sin(CHAMFER);
export const FWD_CONSOLE: ConsoleSection[] = [
  { name: 'fwd-port-wing', x: -wingCx, z: wingCz, yaw: Math.PI - CHAMFER, length: wingLen },
  { name: 'fwd-centre', x: 0, z: FWD_BACK_Z, yaw: Math.PI, length: 2 * FWD_CENTRE_HALF },
  { name: 'fwd-stbd-wing', x: wingCx, z: wingCz, yaw: Math.PI + CHAMFER, length: wingLen },
];

/**
 * Aft console along the aft windows, facing the working deck (MSC.1/Circ.1580 §3.1.8: a good view of the
 * vessel's exterior limits from the DP station). The two DP operator stations stand in the centre gap; the wings
 * carry the aft manoeuvring, deck and communication panels.
 */
const AFT_BACK_Z = WHEELHOUSE_AFT_Z + WALL_HALF + GAP;
export const AFT_GAP_HALF = 1.38;
const AFT_INNER_HALF = 3.5 - WALL_HALF - 0.08;
const aftLen = AFT_INNER_HALF - AFT_GAP_HALF;
export const AFT_CONSOLE: ConsoleSection[] = [
  { name: 'aft-port-wing', x: -(AFT_GAP_HALF + aftLen / 2), z: AFT_BACK_Z, yaw: 0, length: aftLen },
  { name: 'aft-stbd-wing', x: AFT_GAP_HALF + aftLen / 2, z: AFT_BACK_Z, yaw: 0, length: aftLen },
];

export const BRIDGE_FLOOR = LEVEL.bridge;

/** Local console point (along the section, d from the back, height) to wheelhouse coordinates. */
export function consolePoint(s: ConsoleSection, along: number, d: number, y: number): [number, number, number] {
  // Local frame before yaw: x along the section, z = d (operator side +z).
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  return [s.x + along * c + d * sn, BRIDGE_FLOOR + y, s.z - along * sn + d * c];
}
