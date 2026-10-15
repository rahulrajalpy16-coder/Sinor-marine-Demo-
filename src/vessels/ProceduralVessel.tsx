import { BULWARK_GAPS, CRASH_RAIL_GAPS } from '../equipment/posrefData';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { dpSystem } from '../simulations/dpController';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Box, HybridPart } from '../rendering/HybridPart';
import {
  buildBulwarkGeometry,
  buildDeckGeometry,
  buildForecastleGeometry,
  buildHullGeometry,
  buildHullLines,
  buildTransomGeometry,
  forecastleTopY,
  halfBreadth,
} from './hullGeometry';
import {
  AZIMUTHS,
  BRIDGE_DECK,
  CRANES,
  CRASH_RAIL_H,
  FORECASTLE_Z,
  HELIDECK,
  HOUSE,
  LEVEL,
  MAST,
  RESCUE_BOAT,
  WHEELHOUSE,
} from './vesselLayout';

/**
 * Segmented procedural model of a generic 78 m DP2 offshore support vessel. Proportions, deck levels and
 * the arrangement follow the supplied GA plan (see vesselLayout.ts); no identifying details are shown.
 * Each named group is a separately addressable segment for later GLB replacement.
 */
export function ProceduralVessel() {
  const geo = useMemo(
    () => ({
      hull: buildHullGeometry(),
      hullLines: buildHullLines(),
      deck: buildDeckGeometry(),
      forecastle: buildForecastleGeometry(),
      bulwark: buildBulwarkGeometry(1.1, BULWARK_GAPS),
      transom: buildTransomGeometry(),
    }),
    [],
  );

  return (
    <group name="vessel:generic-dp2-osv-78m">
      <group name="segment:hull">
        <HybridPart geometry={geo.hull} material="hull" lines={geo.hullLines} />
        <HybridPart geometry={geo.transom} material="hull" />
        <HybridPart geometry={geo.deck} material="deck" holo={false} />
        <HybridPart geometry={geo.forecastle} material="hull" />
        <HybridPart geometry={geo.bulwark} material="hull" />
      </group>
      <Superstructure />
      <Bridge />
      <Mast />
      <Helideck />
      <AftDeck />
      <AzimuthPods />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------------------

/** Full outline (both sides) from a starboard half outline [x, z][] ordered aft → forward. */
function mirrored(half: [number, number][]): [number, number][] {
  return [...half, ...[...half].reverse().map(([x, z]) => [-x, z] as [number, number])];
}

/** Horizontal plate of thickness t whose top is at y, from a closed outline in plan ([x, z]). */
function plate(outline: [number, number][], y: number, t: number) {
  // Shape in (x, -z) so that after rotating -90° about X the plate lies in plan with +Z forward.
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y - t, 0);
  return g;
}

/** A vertical wall band between two plan points, from y0 to y1, thickness t. */
function wall(a: [number, number], b: [number, number], y0: number, y1: number, t: number) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const g = new THREE.BoxGeometry(len, y1 - y0, t);
  g.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0]));
  g.translate((a[0] + b[0]) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2);
  return g;
}

/** Cylinder strut between two points. */
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Hand rail along a polyline in plan at deck height y: top and mid rails plus posts about every 2 m. */
function railing(pts: [number, number][], y: number, h = 1.1) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    parts.push(wall(a, b, y + h - 0.05, y + h, 0.06), wall(a, b, y + h * 0.5 - 0.02, y + h * 0.5 + 0.02, 0.04));
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      parts.push(new THREE.BoxGeometry(0.05, h, 0.05).translate(x, y + h / 2, z));
    }
  }
  const last = pts[pts.length - 1];
  parts.push(new THREE.BoxGeometry(0.05, h, 0.05).translate(last[0], y + h / 2, last[1]));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

// ---------------------------------------------------------------------------------------------
// Superstructure
// ---------------------------------------------------------------------------------------------

function Superstructure() {
  const { upper, officers } = HOUSE;
  return (
    <group name="segment:superstructure">
      {/* Upper deck house (upper → officers deck) and officers deck house (officers → bridge deck). */}
      <Box min={[-upper.half, LEVEL.upper, upper.z0]} max={[upper.half, LEVEL.officers, upper.z1]} material="superstructure" />
      <Box min={[-officers.half, LEVEL.officers, officers.z0]} max={[officers.half, LEVEL.bridge - 0.15, officers.z1]} material="superstructure" />
      <WindowBand y={(LEVEL.upper + LEVEL.officers) / 2 + 0.2} z0={upper.z0 + 0.6} z1={upper.z1 - 0.8} x={upper.half + 0.01} />
      <WindowBand y={(LEVEL.officers + LEVEL.bridge) / 2 + 0.2} z0={officers.z0 + 0.6} z1={officers.z1 - 0.8} x={officers.half + 0.01} />
      {/* Exhaust casings rising through the bridge to above the compass deck (bridge deck plan). */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box min={[s > 0 ? 4.5 : -6.5, LEVEL.bridge, 12]} max={[s > 0 ? 6.5 : -4.5, LEVEL.roof + 2.4, 14.5]} material="superstructure" />
          <Box min={[s > 0 ? 4.7 : -6.3, LEVEL.roof + 2.4, 12.2]} max={[s > 0 ? 6.3 : -4.7, LEVEL.roof + 2.7, 14.3]} material="dark" />
        </group>
      ))}
      <RescueBoat />
      <ForecastleDeck />
    </group>
  );
}

function WindowBand({ y, z0, z1, x }: { y: number; z0: number; z1: number; x: number }) {
  return (
    <group>
      <Box min={[x, y - 0.35, z0]} max={[x + 0.05, y + 0.35, z1]} material="dark" holo={false} />
      <Box min={[-x - 0.05, y - 0.35, z0]} max={[-x, y + 0.35, z1]} material="dark" holo={false} />
    </group>
  );
}

/** Rescue boat in its davit cradle on the starboard side at upper deck level. */
function RescueBoat() {
  const { x, y, z0, z1 } = RESCUE_BOAT;
  const hull = useMemo(() => {
    const g = new THREE.CapsuleGeometry(0.85, z1 - z0 - 1.7, 6, 12).rotateX(Math.PI / 2);
    g.scale(1, 0.75, 1);
    return g;
  }, [z0, z1]);
  return (
    <group name="rescue-boat">
      <HybridPart geometry={hull} material="accent" position={[x, y + 0.7, (z0 + z1) / 2]} />
      <Box min={[x - 0.9, LEVEL.upper, z0 + 0.6]} max={[x + 0.9, y, z0 + 0.9]} material="dark" />
      <Box min={[x - 0.9, LEVEL.upper, z1 - 0.9]} max={[x + 0.9, y, z1 - 0.6]} material="dark" />
      <Box min={[x - 0.15, y, (z0 + z1) / 2 - 0.2]} max={[x + 0.15, y + 3.4, (z0 + z1) / 2 + 0.2]} material="dark" />
    </group>
  );
}

/** Forecastle top (upper deck forward of the accommodation): mooring winches under the helideck. */
function ForecastleDeck() {
  return (
    <group name="segment:forecastle">
      {[-1, 1].map((s) => (
        <Box key={s} min={[s > 0 ? 1.4 : -4.2, forecastleTopY(30.5), 29.5]} max={[s > 0 ? 4.2 : -1.4, forecastleTopY(30.5) + 1.2, 31.5]} material="dark" />
      ))}
      <Box min={[-0.7, forecastleTopY(35), 34]} max={[0.7, forecastleTopY(35) + 0.8, 36.5]} material="dark" />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Bridge: wheelhouse with all-round windows, open wing decks and the compass deck above.
// ---------------------------------------------------------------------------------------------

/** Bridge deck, wheelhouse and compass deck as an open shell; the IBS console and DP station stand inside. */
function Bridge() {
  const geo = useMemo(() => {
    const y0 = LEVEL.bridge;
    const y1 = LEVEL.roof;
    const house = mirrored(WHEELHOUSE);
    const ring = [...house, house[0]];
    const sill: THREE.BufferGeometry[] = [];
    const head: THREE.BufferGeometry[] = [];
    const posts: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const [a, b] = [ring[i], ring[i + 1]];
      sill.push(wall(a, b, y0, y0 + 0.45, 0.25).toNonIndexed());
      head.push(wall(a, b, y1 - 0.5, y1 - 0.3, 0.25).toNonIndexed());
      glass.push(wall(a, b, y0 + 0.45, y1 - 0.5, 0.04).toNonIndexed());
      posts.push(new THREE.BoxGeometry(0.22, y1 - 0.3 - y0, 0.22).translate(a[0], (y0 + y1 - 0.3) / 2, a[1]).toNonIndexed());
    }
    const deckOutline = mirrored(BRIDGE_DECK);
    const roofOutline = mirrored(WHEELHOUSE.map(([x, z]) => [x + 0.3, z] as [number, number]));
    roofOutline[0] = [roofOutline[0][0], roofOutline[0][1] - 0.3];
    roofOutline[roofOutline.length - 1] = [roofOutline[roofOutline.length - 1][0], roofOutline[roofOutline.length - 1][1] - 0.3];
    const wingRail = [...BRIDGE_DECK].reverse();
    return {
      floor: plate(deckOutline, y0, 0.15),
      roof: plate(roofOutline, y1, 0.3),
      sill: mergeGeometries(sill),
      head: mergeGeometries(head),
      posts: mergeGeometries(posts),
      glass: mergeGeometries(glass),
      wingRails: mergeGeometries([railing(wingRail, y0), railing(wingRail.map(([x, z]) => [-x, z] as [number, number]), y0)]),
      roofRail: railing([...roofOutline, roofOutline[0]], y1),
    };
  }, []);
  return (
    <group name="segment:bridge">
      <HybridPart geometry={geo.floor} material="deck" holo={false} />
      <HybridPart geometry={geo.sill} material="superstructure" />
      <HybridPart geometry={geo.head} material="superstructure" />
      <HybridPart geometry={geo.posts} material="superstructure" holo={false} />
      <HybridPart geometry={geo.glass} material="glass" holo={false} />
      <HybridPart geometry={geo.roof} material="superstructure" />
      <HybridPart geometry={geo.wingRails} material="superstructure" holo={false} edgeThreshold={60} />
      <HybridPart geometry={geo.roofRail} material="superstructure" holo={false} edgeThreshold={60} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Mast and helideck
// ---------------------------------------------------------------------------------------------

function Mast() {
  const geo = useMemo(
    () => ({
      pole: new THREE.CylinderGeometry(0.2, 0.3, LEVEL.mastTop - LEVEL.roof, 10),
      platform: new THREE.CylinderGeometry(1.4, 1.4, 0.12, 16),
      radarX: new THREE.BoxGeometry(3.8, 0.28, 0.35),
      radarS: new THREE.BoxGeometry(5.6, 0.4, 0.45),
      light: new THREE.SphereGeometry(0.18, 10, 8),
    }),
    [],
  );
  const z = MAST.z;
  return (
    <group name="segment:mast">
      <HybridPart geometry={geo.pole} material="superstructure" position={[0, (LEVEL.mastTop + LEVEL.roof) / 2, z]} />
      {/* Radar platforms: S-band lower, X-band above (IBS radars). */}
      <HybridPart geometry={geo.platform} material="superstructure" position={[0, LEVEL.roof + 2.6, z]} />
      <HybridPart geometry={geo.radarS} material="dark" position={[0, LEVEL.roof + 3.1, z]} />
      <HybridPart geometry={geo.platform} material="superstructure" position={[0, MAST.yard + 1.6, z]} />
      <HybridPart geometry={geo.radarX} material="dark" position={[0, MAST.yard + 2.0, z]} />
      {/* Yardarm carrying the two GNSS antennas */}
      <Box min={[-MAST.yardHalf, MAST.yard - 0.2, z - 0.2]} max={[MAST.yardHalf, MAST.yard, z + 0.2]} material="superstructure" />
      <HybridPart geometry={geo.light} material="accent" position={[0, LEVEL.mastTop + 0.15, z]} holo={false} />
    </group>
  );
}

/** Octagonal helideck on a truss forward of the bridge, overhanging the bow (GA plan profile). */
function Helideck() {
  const geo = useMemo(() => {
    const R = HELIDECK.across / 2 / Math.cos(Math.PI / 8);
    const oct = (r: number): [number, number][] =>
      Array.from({ length: 8 }, (_, k) => {
        const a = Math.PI / 8 + (k * Math.PI) / 4;
        return [Math.cos(a) * r, HELIDECK.z + Math.sin(a) * r];
      });
    const y = LEVEL.helideck;
    const outer = oct(R);
    // Truss: legs from the deck underside down to the forecastle and back to the compass deck front.
    const legs: [number, number, number, number][] = [
      [-4.5, 27.5, -3.5, 29],
      [4.5, 27.5, 3.5, 29],
      [-4.5, 36, -2.5, 35],
      [4.5, 36, 2.5, 35],
    ];
    const truss: THREE.BufferGeometry[] = [];
    for (const [xt, zt, xb, zb] of legs) truss.push(strut(new THREE.Vector3(xt, y - 1.2, zt), new THREE.Vector3(xb, forecastleTopY(zb), zb), 0.28).toNonIndexed());
    for (const s of [-1, 1]) {
      truss.push(strut(new THREE.Vector3(s * 4.5, y - 1.2, 27.5), new THREE.Vector3(s * 4.5, y - 1.2, 36), 0.18).toNonIndexed());
      truss.push(strut(new THREE.Vector3(s * 4.5, y - 1.2, 27.5), new THREE.Vector3(s * 2.5, forecastleTopY(35), 35), 0.15).toNonIndexed());
      truss.push(strut(new THREE.Vector3(s * 4.5, y - 1.2, 23.5), new THREE.Vector3(s * 3.5, LEVEL.roof, 23.2), 0.2).toNonIndexed());
      truss.push(strut(new THREE.Vector3(s * 4.5, y - 1.2, 23.5), new THREE.Vector3(s * 4.5, y - 1.2, 27.5), 0.18).toNonIndexed());
    }
    truss.push(strut(new THREE.Vector3(-4.5, y - 1.2, 27.5), new THREE.Vector3(4.5, y - 1.2, 27.5), 0.18).toNonIndexed());
    truss.push(strut(new THREE.Vector3(-4.5, y - 1.2, 36), new THREE.Vector3(4.5, y - 1.2, 36), 0.18).toNonIndexed());
    // Touchdown circle and aiming marking (generic helideck paint scheme).
    const ring = new THREE.RingGeometry(3.6, 4.2, 40).rotateX(-Math.PI / 2).translate(0, y + 0.02, HELIDECK.z);
    return {
      deck: plate(outer, y, 0.25),
      girder: plate(oct(R - 0.6), y - 0.25, 0.95),
      net: railing([...oct(R + 0.6), oct(R + 0.6)[0]], y - 0.15, 0.25),
      truss: mergeGeometries(truss),
      ring,
    };
  }, []);
  return (
    <group name="segment:helideck">
      <HybridPart geometry={geo.deck} material="deck" />
      <HybridPart geometry={geo.girder} material="dark" holo={false} />
      <HybridPart geometry={geo.net} material="dark" holo={false} edgeThreshold={60} />
      <HybridPart geometry={geo.truss} material="superstructure" edgeThreshold={60} />
      <mesh geometry={geo.ring}>
        <meshStandardMaterial color="#e3c21a" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Aft working deck
// ---------------------------------------------------------------------------------------------

/** Open aft working deck: knuckle-boom crane, auxiliary crane, crash barrier, tuggers, capstans and hatches. */
function AftDeck() {
  const d = LEVEL.main;
  const geo = useMemo(() => {
    const { x, z } = CRANES.main;
    const pivot = new THREE.Vector3(x - 0.4, d + 6.2, z + 0.6);
    const knuckle = new THREE.Vector3(x - 0.6, d + 12.2, z + 15);
    const tip = new THREE.Vector3(x - 0.6, d + 8.2, z + 7.5);
    const aux = CRANES.aux;
    // Crash barrier rail along both sides of the working deck, with openings at the deck equipment.
    const rails: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1] as const) {
      const xs = side * (halfBreadth(0, 1) - 0.25);
      let z0 = -37.8;
      const stops = [...CRASH_RAIL_GAPS.filter((g) => g.side === side).sort((a, b) => a.z0 - b.z0), { z0: FORECASTLE_Z - 0.3, z1: FORECASTLE_Z }];
      for (const g of stops) {
        if (g.z0 - z0 > 1) rails.push(railing([[xs, z0], [xs, g.z0]], d, CRASH_RAIL_H));
        z0 = g.z1;
      }
    }
    rails.push(railing([[-(halfBreadth(-37.8, 1) - 0.25), -37.8], [-3, -37.8]], d, CRASH_RAIL_H));
    rails.push(railing([[3, -37.8], [halfBreadth(-37.8, 1) - 0.25, -37.8]], d, CRASH_RAIL_H));
    return {
      pedestal: new THREE.CylinderGeometry(1.1, 1.3, 4.6, 16),
      house: new THREE.BoxGeometry(2.6, 2.2, 3.2),
      boom: strut(pivot, knuckle, 0.55, 8),
      jib: strut(knuckle, tip, 0.42, 8),
      hook: strut(tip, new THREE.Vector3(tip.x, d + 4.4, tip.z), 0.05, 6),
      auxPedestal: new THREE.CylinderGeometry(0.55, 0.7, 3.2, 12),
      auxBoom: strut(new THREE.Vector3(aux.x, d + 3.6, aux.z), new THREE.Vector3(aux.x + 1.2, d + 5.5, aux.z - 8), 0.28, 8),
      tugger: new THREE.BoxGeometry(1.6, 1.1, 1.3),
      capstan: new THREE.CylinderGeometry(0.32, 0.4, 0.7, 12),
      hatch: new THREE.CylinderGeometry(1.5, 1.5, 0.18, 24),
      rails: mergeGeometries(rails),
    };
  }, [d]);
  const { x, z } = CRANES.main;
  return (
    <group name="segment:aft-deck">
      <group name="knuckle-boom-crane">
        <HybridPart geometry={geo.pedestal} material="superstructure" position={[x, d + 2.3, z]} />
        <HybridPart geometry={geo.house} material="accent" position={[x, d + 5.7, z]} />
        <HybridPart geometry={geo.boom} material="accent" />
        <HybridPart geometry={geo.jib} material="accent" />
        <HybridPart geometry={geo.hook} material="dark" holo={false} />
      </group>
      <group name="auxiliary-crane">
        <HybridPart geometry={geo.auxPedestal} material="superstructure" position={[CRANES.aux.x, d + 1.6, CRANES.aux.z]} />
        <HybridPart geometry={geo.auxBoom} material="accent" />
      </group>
      {[-3.2, 3.2].map((tx) => (
        <HybridPart key={tx} geometry={geo.tugger} material="dark" position={[tx, d + 0.55, FORECASTLE_Z - 1.6]} name="tugger-winch" />
      ))}
      {[-7.6, 7.6].map((cx) => (
        <HybridPart key={cx} geometry={geo.capstan} material="dark" position={[cx, d + 0.35, -36.6]} name="capstan" />
      ))}
      {[-5, 5].map((hx) => (
        <HybridPart key={hx} geometry={geo.hatch} material="dark" position={[hx, d + 0.09, -30.5]} name="deck-hatch" />
      ))}
      <HybridPart geometry={geo.rails} material="superstructure" holo={false} edgeThreshold={60} />
    </group>
  );
}

/** Aft azimuth propulsion pods AZ1 (port) and AZ2 (stbd); they slew to the angle the DP allocation commands. */
function AzimuthPods() {
  const strutG = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 2.2, 12), []);
  const pod = useMemo(() => new THREE.CapsuleGeometry(0.9, 2.4, 6, 14), []);
  const nozzle = useMemo(() => new THREE.TorusGeometry(1.5, 0.28, 8, 24), []);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const th = dpSystem.getState().thrusters;
    ['AZ1', 'AZ2'].forEach((id, i) => {
      const t = th.find((x) => x.id === id);
      const g = refs.current[i];
      // Thrust angle 0 = ahead, +90° = starboard; the nozzle sits aft of the pod, so rotation.y = angle.
      if (t && g) g.rotation.y = t.angle;
    });
  });
  return (
    <group name="segment:azimuth-pods">
      {[-AZIMUTHS.x, AZIMUTHS.x].map((x, i) => (
        <group key={x} position={[x, AZIMUTHS.y, AZIMUTHS.z]} name={i === 0 ? 'AZ1' : 'AZ2'}>
          <HybridPart geometry={strutG} material="dark" position={[0, 0.4, 0]} />
          <group
            ref={(el) => {
              refs.current[i] = el;
            }}
          >
            <HybridPart geometry={pod} material="dark" position={[0, -1.2, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <HybridPart geometry={nozzle} material="dark" position={[0, -1.2, -1.4]} />
          </group>
        </group>
      ))}
    </group>
  );
}
