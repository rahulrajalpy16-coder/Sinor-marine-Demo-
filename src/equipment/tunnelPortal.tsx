import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { hullHalfWidthExact } from '../vessels/hullGeometry';
import { MODE_STYLES } from '../rendering/modes';
import { useAppStore } from '../store/useAppStore';

/**
 * Tunnel thruster openings in the solid hull.
 *
 * The hull is one closed shell, so a transverse tunnel inside it is hidden in Realistic mode. Instead of
 * cutting the hull mesh, each opening gets an invisible "portal" surface that only writes depth. Draw order
 * does the rest: tunnel parts first (renderOrder -2), then the portals (-1), then the hull (0), which fails
 * the depth test inside them. The tunnel wall ends exactly on the flared shell plating, so the opening
 * reads as the oval cut a real tunnel makes in a V-shaped bow.
 */

const SEGMENTS = 48;
/** Shell plating sits on the hull surface; push tunnel ends and portals just outside the faceted mesh. */
const SKIN = 0.03;

export interface TunnelOpenings {
  /** Open tunnel wall from port to starboard plating. */
  wall: THREE.BufferGeometry;
  /** Depth-only caps over both openings. */
  portals: THREE.BufferGeometry;
  /** Thin lip along each opening edge. */
  lips: THREE.BufferGeometry[];
  /** Tunnel half-length at its axis (where the shaft line meets the plating). */
  half: number;
}

/** Tunnel of radius r on the transverse axis through (z, y), in coordinates local to that axis point. */
export function buildTunnelOpenings(z: number, y: number, r: number): TunnelOpenings {
  const ring: [number, number, number][] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const dy = Math.cos(a) * r;
    const dz = Math.sin(a) * r;
    ring.push([hullHalfWidthExact(z + dz, y + dy) + SKIN, dy, dz]);
  }
  const wallPos: number[] = [];
  const wallIdx: number[] = [];
  ring.forEach(([x, dy, dz]) => wallPos.push(-x, dy, dz, x, dy, dz));
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2;
    const b = ((i + 1) % SEGMENTS) * 2;
    wallIdx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const wall = new THREE.BufferGeometry();
  wall.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wall.setIndex(wallIdx);
  wall.computeVertexNormals();

  // Portal caps follow the curved plating: a polar grid over the opening, each point just outside the shell.
  const RINGS = 6;
  const capPos: number[] = [];
  const capIdx: number[] = [];
  for (let k = 0; k <= RINGS; k++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const rr = (r * k) / RINGS;
      const dy = Math.cos(a) * rr;
      const dz = Math.sin(a) * rr;
      capPos.push(hullHalfWidthExact(z + dz, y + dy) + 2 * SKIN, dy, dz);
    }
  }
  for (let k = 0; k < RINGS; k++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = k * SEGMENTS + i;
      const b = k * SEGMENTS + ((i + 1) % SEGMENTS);
      capIdx.push(a, a + SEGMENTS, b, b, a + SEGMENTS, b + SEGMENTS);
    }
  }
  const portalPos: number[] = [];
  for (const side of [1, -1]) for (const v of capIdx) portalPos.push(side * capPos[v * 3], capPos[v * 3 + 1], capPos[v * 3 + 2]);
  const portals = new THREE.BufferGeometry();
  portals.setAttribute('position', new THREE.Float32BufferAttribute(portalPos, 3));

  const lips = [1, -1].map((side) => {
    const curve = new THREE.CatmullRomCurve3(
      ring.map(([x, dy, dz]) => new THREE.Vector3(side * x, dy, dz)),
      true,
    );
    return new THREE.TubeGeometry(curve, SEGMENTS * 2, 0.045, 6, true);
  });
  return { wall, portals, lips, half: hullHalfWidthExact(z, y) + SKIN };
}

const portalMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });

/** Tunnel geometry for one thruster, disposed with the component. */
export function useTunnelOpenings(z: number, y: number, r: number) {
  const t = useMemo(() => buildTunnelOpenings(z, y, r), [z, y, r]);
  useEffect(
    () => () => {
      t.wall.dispose();
      t.portals.dispose();
      t.lips.forEach((l) => l.dispose());
    },
    [t],
  );
  return t;
}

/** Depth-only portals over both tunnel openings (only while the hull is drawn solid). */
export function TunnelPortals({ geometry }: { geometry: THREE.BufferGeometry }) {
  const solid = useAppStore((s) => MODE_STYLES[s.visualMode].hull === 'full');
  return <mesh geometry={geometry} material={portalMat} visible={solid} userData={{ portalMask: true }} renderOrder={-1} name="tunnel-openings" />;
}

/** Draw the tunnel and everything in it before the portals and the hull. */
export function usePortalOrder(root: RefObject<THREE.Object3D>) {
  useEffect(() => {
    root.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) o.renderOrder = o.userData.portalMask ? -1 : -2;
    });
  });
}
