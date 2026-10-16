/**
 * Shared input rules for mouse, touch, pen and keyboard (pure; no React).
 * Every selectable system and the camera rig use these, so new equipment inherits them.
 */
import * as THREE from 'three';
import type { LayoutClass } from '../responsive/device';
import type { CameraPose, OrbitLimits } from '../camera/cameraMachine';

/** How far a pointer may travel between down and up and still count as a tap/click (CSS px). */
export const TAP_SLOP_PX: Record<string, number> = { mouse: 5, pen: 8, touch: 12 };

/** A drag that ends over a system must not select it; only a genuine tap or click does. */
export function isTap(deltaPx: number, pointerType: string | undefined): boolean {
  return deltaPx <= (TAP_SLOP_PX[pointerType ?? 'mouse'] ?? TAP_SLOP_PX.mouse);
}

/** Events from WebXR controller and hand pointers (@pmndrs/pointer-events) carry their pointer; screen events do not. */
export function isXRPointerEvent(e: object): boolean {
  return 'internalPointer' in e;
}

/** Mouse: left orbit, wheel/middle zoom, right pan. Touch: one finger orbits, two fingers pinch-zoom and pan. */
export const ORBIT_MOUSE = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
export const ORBIT_TOUCH = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

/** Fingers cover less screen per degree than a mouse, so touch orbit is a little faster. */
export function orbitTuning(layout: LayoutClass, coarse: boolean) {
  const touch = coarse || layout === 'mobile';
  return {
    rotateSpeed: touch ? 0.85 : 0.6,
    zoomSpeed: touch ? 1.1 : 0.9,
    panSpeed: touch ? 1 : 0.8,
    dampingFactor: 0.08,
  };
}

export type KeyAction =
  | { kind: 'orbit'; azimuth: number; polar: number }
  | { kind: 'zoom'; factor: number }
  | { kind: 'overview' }
  | { kind: 'focus' };

const STEP = THREE.MathUtils.degToRad(6);

/** Keyboard camera map. Returns null for keys the camera does not use. */
export function keyAction(key: string, shift = false): KeyAction | null {
  const k = shift ? 2 : 1;
  switch (key) {
    case 'ArrowLeft':
      return { kind: 'orbit', azimuth: -STEP * k, polar: 0 };
    case 'ArrowRight':
      return { kind: 'orbit', azimuth: STEP * k, polar: 0 };
    case 'ArrowUp':
      return { kind: 'orbit', azimuth: 0, polar: -STEP * k };
    case 'ArrowDown':
      return { kind: 'orbit', azimuth: 0, polar: STEP * k };
    case '+':
    case '=':
      return { kind: 'zoom', factor: 1 / 1.15 };
    case '-':
    case '_':
      return { kind: 'zoom', factor: 1.15 };
    case 'Home':
    case 'o':
    case 'O':
      return { kind: 'overview' };
    case 'f':
    case 'F':
      return { kind: 'focus' };
    default:
      return null;
  }
}

/** Keys typed into form fields, sliders and selects belong to those controls, not to the camera. */
export function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || typeof (t as HTMLElement).tagName !== 'string') return false;
  const el = t as HTMLElement;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.getAttribute('role') === 'slider';
}

/** Rotate and/or dolly the camera about its target, respecting the current orbit limits. */
export function orbitStep(pose: CameraPose, action: { azimuth?: number; polar?: number; zoom?: number }, limits: OrbitLimits): CameraPose {
  const target = new THREE.Vector3(...pose.target);
  const offset = new THREE.Vector3(...pose.position).sub(target);
  const s = new THREE.Spherical().setFromVector3(offset);
  s.theta += action.azimuth ?? 0;
  s.phi = THREE.MathUtils.clamp(s.phi + (action.polar ?? 0), Math.max(0.01, limits.minPolarAngle), Math.min(Math.PI - 0.01, limits.maxPolarAngle));
  s.radius = THREE.MathUtils.clamp(s.radius * (action.zoom ?? 1), limits.minDistance, limits.maxDistance);
  const p = new THREE.Vector3().setFromSpherical(s).add(target);
  return { position: [p.x, p.y, p.z], target: pose.target };
}
