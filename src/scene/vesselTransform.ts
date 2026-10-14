import * as THREE from 'three';
import { dpSystem } from '../simulations/dpController';

/**
 * The vessel's pose in the scene, from the DP model: X = east, Z = north, rotation.y = heading.
 * Everything placed in vessel coordinates (equipment targets, camera anchors) goes through this.
 */
export function vesselMatrix(out = new THREE.Matrix4()) {
  const [n, e, psi] = dpSystem.getState().eta;
  return out.makeRotationY(psi).setPosition(e, 0, n);
}

/** Vessel-frame point to scene point. */
export function toScene(p: readonly [number, number, number]): [number, number, number] {
  const v = new THREE.Vector3(...p).applyMatrix4(vesselMatrix());
  return [v.x, v.y, v.z];
}
