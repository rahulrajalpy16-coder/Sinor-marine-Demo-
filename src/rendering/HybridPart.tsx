import { useMemo } from 'react';
import * as THREE from 'three';
import { MATERIALS, type SolidMaterialKey } from './materials';

interface Props {
  geometry: THREE.BufferGeometry;
  material: SolidMaterialKey;
  /** Explicit linework; defaults to feature edges of the geometry. */
  lines?: THREE.BufferGeometry;
  edgeThreshold?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  name?: string;
  holo?: boolean;
}

/**
 * One structural part rendered three ways from a single geometry: PBR solid, holographic fill and
 * cyan linework. Which of the three are visible (and where) is driven by the shared materials.
 */
export function HybridPart({ geometry, material, lines, edgeThreshold = 20, position, rotation, name, holo = true }: Props) {
  const edges = useMemo(() => lines ?? new THREE.EdgesGeometry(geometry, edgeThreshold), [geometry, lines, edgeThreshold]);
  return (
    <group position={position} rotation={rotation} name={name}>
      <mesh geometry={geometry} material={MATERIALS[material]} castShadow receiveShadow />
      {holo && <mesh geometry={geometry} material={MATERIALS.holoFill} renderOrder={2} />}
      <lineSegments geometry={edges} material={MATERIALS.lines} renderOrder={3} />
    </group>
  );
}

const boxCache = new Map<string, THREE.BoxGeometry>();
/** Shared box geometry by size (structure is mostly boxes; reuse keeps memory flat). */
export function boxGeom(w: number, h: number, d: number) {
  const key = `${w}|${h}|${d}`;
  let g = boxCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    boxCache.set(key, g);
  }
  return g;
}

/** Axis-aligned box given min/max corners in metres. */
export function Box({ min, max, material, holo }: { min: [number, number, number]; max: [number, number, number]; material: SolidMaterialKey; holo?: boolean }) {
  const size: [number, number, number] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const center: [number, number, number] = [(max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2];
  return <HybridPart geometry={boxGeom(...size)} material={material} position={center} holo={holo} />;
}
