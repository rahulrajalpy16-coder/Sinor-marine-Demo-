import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Layer the culled meshes move to; no camera renders it. */
const CULLED_LAYER = 7;
/** Objects whose bounding sphere subtends less than this (radius / distance) are not drawn. ≈0.6°, about 12 px on a Quest 3S. */
export const MIN_ANGULAR_RADIUS = 0.008;
const CHECK_SECONDS = 0.25;

/** Pure test for one object: radius and distance in metres. */
export const isTooSmall = (radius: number, distance: number) => distance > 0 && radius / distance < MIN_ANGULAR_RADIUS;

/**
 * VR only: skips drawing meshes too small to see from where the visitor stands (bolts, chair legs and console
 * buttons across the ship), which cuts draw calls, the main cost on a standalone headset. Culled meshes move
 * to an unrendered layer, so the app's own `visible` flags (visual modes, isolate) are left alone, and they
 * come back as soon as the visitor gets close or leaves VR.
 */
export function SmallFeatureCulling() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const culled = useRef(new Set<THREE.Object3D>());
  const t = useRef(0);
  const tmp = useRef({ eye: new THREE.Vector3(), sphere: new THREE.Sphere() });

  useEffect(() => {
    const set = culled.current;
    return () => {
      set.forEach((o) => o.layers.set(0));
      set.clear();
    };
  }, []);

  useFrame((_, dt) => {
    t.current += dt;
    if (t.current < CHECK_SECONDS) return;
    t.current = 0;
    const { eye, sphere } = tmp.current;
    camera.updateWorldMatrix(true, false);
    eye.setFromMatrixPosition(camera.matrixWorld);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!(m.isMesh || (o as THREE.Line).isLine) || !m.geometry) return;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      sphere.copy(m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld);
      const small = isTooSmall(sphere.radius, sphere.center.distanceTo(eye));
      const was = culled.current.has(o);
      if (small && !was && o.layers.mask === 1) {
        o.layers.set(CULLED_LAYER);
        culled.current.add(o);
      } else if (!small && was) {
        o.layers.set(0);
        culled.current.delete(o);
      }
    });
  });
  return null;
}
