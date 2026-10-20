import { useMemo } from 'react';
import * as THREE from 'three';
import { CYAN_LIGHT } from '../rendering/materials';

const outlineMat = new THREE.LineBasicMaterial({ color: CYAN_LIGHT, toneMapped: false, transparent: true, opacity: 0.95 });
// Outlines are not picked: three.js lines hit anything within 1 m of the ray, so a nearby outline would steal a
// click meant for the equipment behind it. The mesh surface is what selects.
const noRaycast = () => {};

/** One equipment mesh with an optional cyan selection outline. */
export function EqMesh({
  geometry,
  material,
  outline,
  position,
  rotation,
  name,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  outline: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  name?: string;
}) {
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 25), [geometry]);
  return (
    <group position={position} rotation={rotation} name={name}>
      <mesh geometry={geometry} material={material} castShadow />
      <lineSegments geometry={edges} material={outlineMat} visible={outline} renderOrder={4} raycast={noRaycast} />
    </group>
  );
}
