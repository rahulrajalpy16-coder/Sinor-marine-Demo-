/**
 * Parametric hull for the representative 80 m offshore support vessel.
 * Scene frame: metres, +Y up (waterline at y = 0), +Z bow, +X starboard.
 * The lines are an illustrative concept shape, not a naval architecture design.
 */
import * as THREE from 'three';

export const HULL = {
  length: 80,
  halfBeam: 9,
  draft: 5,
  depth: 8,
  stations: 97,
  sectionPoints: 22,
} as const;

const L2 = HULL.length / 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Keel height (y) at longitudinal position z. Rises toward the transom for a flat aft run. */
export function keelY(z: number): number {
  const u = z / L2;
  const rise = u < -0.55 ? 3.0 * Math.pow((-0.55 - u) / 0.45, 1.5) : 0;
  return -HULL.draft + rise;
}

/** Main deck height (y) at z, with sheer rising toward the bow. */
export function deckY(z: number): number {
  const u = z / L2;
  return HULL.depth - HULL.draft + (u > 0.3 ? 2.6 * Math.pow((u - 0.3) / 0.7, 2) : 0);
}

/** Bow entrance fraction: 0 at the start of the entrance, 1 at the stem, for a height fraction h. */
function bowFraction(z: number, h: number): number {
  const u = z / L2;
  const stem = 0.86 + 0.14 * h; // raked stem: deck reaches further forward than the forefoot
  const s = u / stem;
  return s <= 0.35 ? 0 : (s - 0.35) / 0.65;
}

/** Maximum half-breadth at z for a height fraction h (0 keel → 1 deck). */
export function halfBreadth(z: number, h: number): number {
  const u = z / L2;
  const B = HULL.halfBeam;
  const f = bowFraction(z, h);
  if (f >= 1) return 0;
  if (f > 0) {
    const flare = 1 - f * (1 - h) * 0.35;
    return B * Math.pow(1 - Math.pow(f, 2.4), 0.7) * flare;
  }
  if (u < -0.6) return B * (1 - 0.07 * Math.pow((-0.6 - u) / 0.4, 2));
  return B;
}

/** Superellipse exponent: boxy midship, fine at the bow, slightly rounder aft. */
function sectionExponent(z: number): number {
  const u = z / L2;
  const f = bowFraction(z, 0.5);
  if (f > 0) return lerp(8, 2.3, clamp01(f));
  if (u < -0.6) return lerp(8, 5, (-0.6 - u) / 0.4);
  return 8;
}

/** Point on the section at z, parameter t in [0, 1] from keel centreline (0) to deck edge (1), starboard side. */
export function sectionPoint(z: number, t: number): [number, number] {
  const n = sectionExponent(z);
  const theta = clamp01(t) * (Math.PI / 2);
  const k = keelY(z);
  const d = deckY(z);
  const c = Math.pow(Math.cos(theta), 2 / n);
  const s = Math.pow(Math.sin(theta), 2 / n);
  const y = k + (d - k) * (1 - c);
  const h = (y - k) / (d - k);
  return [halfBreadth(z, h) * s, y];
}

/** Hull half-width at a given (z, y) — used to size the bow thruster tunnel. */
export function hullHalfWidthAt(z: number, y: number): number {
  let best = 0;
  for (let i = 0; i <= 200; i++) {
    const [x, py] = sectionPoint(z, i / 200);
    if (Math.abs(py - y) < 0.25) best = Math.max(best, x);
  }
  return best;
}

const stationZ = (i: number) => -L2 + (HULL.length * i) / (HULL.stations - 1);

/** Shell plating: one strip per station from port deck edge, through the keel, to starboard deck edge. */
export function buildHullGeometry(): THREE.BufferGeometry {
  const N = HULL.sectionPoints;
  const cols = 2 * N + 1;
  const pos: number[] = [];
  for (let i = 0; i < HULL.stations; i++) {
    const z = stationZ(i);
    for (let k = 0; k < cols; k++) {
      const t = Math.abs(k - N) / N;
      const [x, y] = sectionPoint(z, t);
      pos.push(k < N ? -x : x, y, z);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < HULL.stations - 1; i++) {
    for (let k = 0; k < cols - 1; k++) {
      const a = i * cols + k;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // Paint: light grey topsides, dark slate antifouling below the boot-top line.
  const col: number[] = [];
  const top = new THREE.Color('#c3cbd2');
  const bottom = new THREE.Color('#3d4852');
  const boot = new THREE.Color('#1c242b');
  for (let v = 1; v < pos.length; v += 3) {
    const y = pos[v];
    const c = y > 0.45 ? top : y > -0.15 ? boot : bottom;
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Main deck surface following the sheer line. */
export function buildDeckGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < HULL.stations; i++) {
    const z = stationZ(i);
    const w = halfBreadth(z, 1);
    const y = deckY(z);
    pos.push(-w, y, z, w, y, z);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Bulwark: a 1.1 m rail-height strip along both deck edges, with optional openings (side ±1, z range). */
export function buildBulwarkGeometry(height = 1.1, gaps: readonly { side: number; z0: number; z1: number }[] = []): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  let v = 0;
  for (const side of [-1, 1]) {
    for (let i = 0; i < HULL.stations; i++) {
      const z = stationZ(i);
      const w = halfBreadth(z, 1) * side;
      const y = deckY(z);
      pos.push(w, y, z, w, y + height, z);
      const zPrev = i > 0 ? stationZ(i - 1) : z;
      const open = gaps.some((g) => g.side === side && Math.max(z, zPrev) > g.z0 && Math.min(z, zPrev) < g.z1);
      if (i > 0 && !open) idx.push(v - 2, v, v - 1, v - 1, v, v + 1);
      v += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Flat transom closing the stern: a fan over the aftmost section. */
export function buildTransomGeometry(): THREE.BufferGeometry {
  const z = -L2;
  const N = HULL.sectionPoints;
  const ring: number[][] = [];
  for (let k = 0; k <= 2 * N; k++) {
    const [x, y] = sectionPoint(z, Math.abs(k - N) / N);
    ring.push([k < N ? -x : x, y, z]);
  }
  const cy = (keelY(z) + deckY(z)) / 2;
  const pos = [0, cy, z, ...ring.flat()];
  const idx: number[] = [];
  for (let k = 1; k < ring.length; k++) idx.push(0, k + 1, k);
  idx.push(0, 1, ring.length); // close across the deck edge
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Engineering linework: section stations plus longitudinal waterlines, as line segments. */
export function buildHullLines(stationEvery = 3, longEvery = 2): THREE.BufferGeometry {
  const N = HULL.sectionPoints;
  const pts: number[] = [];
  const P = (z: number, k: number): [number, number, number] => {
    const [x, y] = sectionPoint(z, Math.abs(k - N) / N);
    return [k < N ? -x : x, y, z];
  };
  for (let i = 0; i < HULL.stations; i += stationEvery) {
    const z = stationZ(i);
    for (let k = 0; k < 2 * N; k++) pts.push(...P(z, k), ...P(z, k + 1));
  }
  for (let k = 0; k <= 2 * N; k += longEvery) {
    for (let i = 0; i < HULL.stations - 1; i++) pts.push(...P(stationZ(i), k), ...P(stationZ(i + 1), k));
  }
  // Deck edge and sheer line
  for (let i = 0; i < HULL.stations - 1; i++) {
    for (const s of [-1, 1]) {
      const z0 = stationZ(i);
      const z1 = stationZ(i + 1);
      pts.push(s * halfBreadth(z0, 1), deckY(z0) + 1.1, z0, s * halfBreadth(z1, 1), deckY(z1) + 1.1, z1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}
