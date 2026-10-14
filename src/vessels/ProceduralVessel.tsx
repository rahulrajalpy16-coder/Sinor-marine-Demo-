import { useMemo } from 'react';
import * as THREE from 'three';
import { Box, HybridPart } from '../rendering/HybridPart';
import {
  buildBulwarkGeometry,
  buildDeckGeometry,
  buildHullGeometry,
  buildHullLines,
  buildTransomGeometry,
  deckY,
} from './hullGeometry';

/**
 * Segmented procedural offshore support vessel (representative concept, not a real ship).
 * Each named group is a separately addressable segment for later GLB replacement.
 */
export function ProceduralVessel() {
  const geo = useMemo(
    () => ({
      hull: buildHullGeometry(),
      hullLines: buildHullLines(),
      deck: buildDeckGeometry(),
      bulwark: buildBulwarkGeometry(),
      transom: buildTransomGeometry(),
    }),
    [],
  );

  return (
    <group name="vessel:sinor-osv-concept-001">
      <group name="segment:hull">
        <HybridPart geometry={geo.hull} material="hull" lines={geo.hullLines} />
        <HybridPart geometry={geo.transom} material="hull" />
        <HybridPart geometry={geo.deck} material="deck" holo={false} />
        <HybridPart geometry={geo.bulwark} material="hull" />
      </group>
      <Superstructure />
      <Mast />
      <AftDeck />
      <AzimuthPods />
    </group>
  );
}

function Superstructure() {
  return (
    <group name="segment:superstructure">
      {/* Tier 1: accommodation */}
      <Box min={[-7.6, 2.9, 3]} max={[7.6, 6, 22]} material="superstructure" />
      {/* Tier 2 */}
      <Box min={[-7, 6, 7]} max={[7, 9, 21.5]} material="superstructure" />
      <WindowBand y={4.6} z0={3.2} z1={21.6} x={7.62} />
      <WindowBand y={7.6} z0={7.2} z1={21.2} x={7.02} />
      <Bridge />
      {/* Funnels */}
      <Box min={[-4.6, 6, 4]} max={[-2.6, 12.5, 7]} material="superstructure" />
      <Box min={[2.6, 6, 4]} max={[4.6, 12.5, 7]} material="superstructure" />
      <Box min={[-4.6, 12.5, 4]} max={[-2.6, 13, 7]} material="dark" />
      <Box min={[2.6, 12.5, 4]} max={[4.6, 13, 7]} material="dark" />
      {/* Rescue boats on davits, port and starboard */}
      <Box min={[7.7, 4.2, 10]} max={[9.3, 5.6, 16]} material="accent" />
      <Box min={[-9.3, 4.2, 10]} max={[-7.7, 5.6, 16]} material="accent" />
      {/* Forecastle equipment */}
      <Box min={[-2.2, deckY(30), 28]} max={[2.2, deckY(30) + 1.2, 31]} material="dark" />
      <Box min={[-0.6, deckY(35), 33]} max={[0.6, deckY(35) + 0.8, 37]} material="dark" />
    </group>
  );
}

/** Bridge deck built as an open shell so the DP console inside is visible through the front glass. */
function Bridge() {
  const y0 = 9;
  const y1 = 12;
  return (
    <group name="segment:bridge">
      <Box min={[-7.4, y0 - 0.15, 12]} max={[7.4, y0, 23]} material="deck" holo={false} />
      <Box min={[-7.4, y1, 12]} max={[7.4, y1 + 0.35, 23.3]} material="superstructure" />
      <Box min={[-7.4, y0, 12]} max={[7.4, y1, 12.3]} material="superstructure" />
      {/* Sills and corner posts */}
      <Box min={[-7.4, y0, 22.7]} max={[7.4, y0 + 0.45, 23]} material="superstructure" />
      <Box min={[-7.4, y0, 12.3]} max={[-7.1, y1, 22.7]} material="superstructure" />
      <Box min={[7.1, y0, 12.3]} max={[7.4, y1, 22.7]} material="superstructure" />
      {[-7.4, -2.5, 2.5].map((x) => (
        <Box key={x} min={[x, y0, 22.7]} max={[x + 0.2, y1, 23]} material="superstructure" holo={false} />
      ))}
      <Box min={[7.2, y0, 22.7]} max={[7.4, y1, 23]} material="superstructure" holo={false} />
      {/* Front glazing */}
      <Box min={[-7.2, y0 + 0.45, 22.8]} max={[7.2, y1 - 0.15, 22.9]} material="glass" holo={false} />
      {/* Bridge wings */}
      <Box min={[7.4, y0 - 0.15, 18.5]} max={[9.3, y0 + 0.05, 23]} material="superstructure" />
      <Box min={[-9.3, y0 - 0.15, 18.5]} max={[-7.4, y0 + 0.05, 23]} material="superstructure" />
      <Box min={[9.1, y0, 18.5]} max={[9.3, y0 + 1.1, 23]} material="superstructure" />
      <Box min={[-9.3, y0, 18.5]} max={[-9.1, y0 + 1.1, 23]} material="superstructure" />
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

function Mast() {
  const pole = useMemo(() => new THREE.CylinderGeometry(0.22, 0.32, 8, 10), []);
  const dome = useMemo(() => new THREE.SphereGeometry(0.75, 16, 10), []);
  return (
    <group name="segment:mast">
      <HybridPart geometry={pole} material="superstructure" position={[0, 16.3, 16]} />
      <Box min={[-3.2, 17.4, 15.8]} max={[3.2, 17.6, 16.2]} material="superstructure" />
      <Box min={[-2.2, 19.6, 15.8]} max={[2.2, 19.8, 16.2]} material="dark" />
      <HybridPart geometry={dome} material="superstructure" position={[2.4, 18.4, 16]} />
      <HybridPart geometry={dome} material="superstructure" position={[-2.4, 18.4, 16]} />
    </group>
  );
}

/** Open aft working deck: crane and stern A-frame. */
function AftDeck() {
  const pedestal = useMemo(() => new THREE.CylinderGeometry(1.1, 1.3, 4, 16), []);
  const boom = useMemo(() => new THREE.BoxGeometry(0.9, 0.9, 20), []);
  const leg = useMemo(() => new THREE.BoxGeometry(1, 13, 1), []);
  const d = deckY(0);
  return (
    <group name="segment:aft-deck">
      <group name="crane">
        <HybridPart geometry={pedestal} material="superstructure" position={[6, d + 2, -2]} />
        <HybridPart geometry={boom} material="accent" position={[3.2, d + 9, -9]} rotation={[0.62, -0.38, 0]} />
      </group>
      <group name="a-frame">
        <HybridPart geometry={leg} material="accent" position={[-6.5, d + 6, -37.2]} rotation={[0.28, 0, 0]} />
        <HybridPart geometry={leg} material="accent" position={[6.5, d + 6, -37.2]} rotation={[0.28, 0, 0]} />
        <Box min={[-7, d + 11.4, -39.6]} max={[7, d + 12.6, -38.4]} material="accent" />
      </group>
      {/* Deck cargo rails and a container */}
      <Box min={[-3, d, -24]} max={[3, d + 2.6, -18]} material="dark" />
      <Box min={[-8.4, d, -36]} max={[-8, d + 1.4, 2]} material="superstructure" holo={false} />
      <Box min={[8, d, -36]} max={[8.4, d + 1.4, 2]} material="superstructure" holo={false} />
    </group>
  );
}

/** Aft azimuth propulsion pods (visual only in Phase 1). */
function AzimuthPods() {
  const strut = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 2.2, 12), []);
  const pod = useMemo(() => new THREE.CapsuleGeometry(0.9, 2.4, 6, 14), []);
  const nozzle = useMemo(() => new THREE.TorusGeometry(1.5, 0.28, 8, 24), []);
  return (
    <group name="segment:azimuth-pods">
      {[-4.6, 4.6].map((x) => (
        <group key={x} position={[x, -3.4, -34.5]}>
          <HybridPart geometry={strut} material="dark" position={[0, 0.4, 0]} />
          <HybridPart geometry={pod} material="dark" position={[0, -1.2, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <HybridPart geometry={nozzle} material="dark" position={[0, -1.2, -1.4]} />
        </group>
      ))}
    </group>
  );
}
