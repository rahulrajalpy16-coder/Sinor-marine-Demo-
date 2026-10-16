import * as THREE from 'three';
import { dpSystem } from '../simulations/dpController';

/**
 * The model frames (vessel: +X starboard, +Z bow, +Y up; DP: X = east, Z = north, heading clockwise) are
 * left-handed, while three.js is right-handed. Rendering them as-is shows a mirror image: starboard on the
 * left when facing the bow, and headings turning the wrong way. The scene's `world` group applies this
 * reflection once so the ship reads the right way round; anything converting model coordinates to scene
 * coordinates applies it too.
 */
export const WORLD_SCALE: [number, number, number] = [-1, 1, 1];
const WORLD_MIRROR = new THREE.Matrix4().makeScale(...WORLD_SCALE);

/**
 * The vessel's pose in the scene, from the DP model (X = east, Z = north, rotation.y = heading), including
 * the world reflection. Everything placed in vessel coordinates (equipment targets, camera anchors) goes
 * through this.
 */
export function vesselMatrix(out = new THREE.Matrix4()) {
  const [n, e, psi] = dpSystem.getState().eta;
  return out.makeRotationY(psi).setPosition(e, 0, n).premultiply(WORLD_MIRROR);
}

/**
 * The vessel's pose as a proper (unreflected) frame, for things that must not be mirrored, such as the VR
 * origin: vessel point [x, y, z] sits at [-x, y, z] in this frame.
 */
export function vesselFrameUnmirrored(target: THREE.Object3D) {
  const [n, e, psi] = dpSystem.getState().eta;
  target.position.set(-e, 0, n);
  target.rotation.set(0, -psi, 0);
}

/** Canvas textures shown inside the reflected world are flipped back so their text reads normally. */
export function readableInWorld<T extends THREE.Texture>(tex: T): T {
  tex.repeat.x = -1;
  tex.offset.x = 1;
  return tex;
}

/** Vessel-frame point to scene point. */
export function toScene(p: readonly [number, number, number]): [number, number, number] {
  const v = new THREE.Vector3(...p).applyMatrix4(vesselMatrix());
  return [v.x, v.y, v.z];
}

/**
 * three.js culls back faces during raycasting by triangle winding in the mesh's local space, without allowing
 * for a reflected world matrix, so inside the reflected world front faces would be unpickable from the front.
 * Swap the culled side for the duration of the raycast of a reflected mesh (picking, hover, occlusion tests).
 */
const meshRaycast = THREE.Mesh.prototype.raycast;
const swapSide = (m: THREE.Material) => {
  if (m.side === THREE.FrontSide) m.side = THREE.BackSide;
  else if (m.side === THREE.BackSide) m.side = THREE.FrontSide;
};
THREE.Mesh.prototype.raycast = function raycastAllowingReflection(raycaster, intersects) {
  if (this.matrixWorld.determinant() >= 0) return meshRaycast.call(this, raycaster, intersects);
  const mats = Array.isArray(this.material) ? this.material : [this.material];
  mats.forEach(swapSide);
  try {
    meshRaycast.call(this, raycaster, intersects);
  } finally {
    mats.forEach(swapSide);
  }
};
