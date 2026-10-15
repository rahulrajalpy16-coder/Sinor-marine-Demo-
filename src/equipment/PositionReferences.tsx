import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';
import { useAppStore } from '../store/useAppStore';
import { useQualityProfile } from '../rendering/quality';
import { CYAN } from '../rendering/materials';
import { posRefs } from '../simulations/posrefsController';
import { dpSystem } from '../simulations/dpController';
import { CYSCAN_WINDOW, posRefReadiness, toWorld, sprintNavPos } from '../simulations/posrefs';
import {
  BULWARK_H,
  CYSCAN,
  CYSCAN_PEDESTAL,
  CYSCAN_POS,
  DECK_Y,
  GNSS_ANTENNAS,
  PLATFORM,
  POLE_8097,
  POLE_PIVOT,
  RADASCAN,
  RADASCAN_POS,
  REFLECTOR_WORLD,
  RESPONDER_WORLD,
  SCENE_SEABED_Y,
  SEASTAR,
  SHIP_SIDE_X,
  SMT_TW,
  SPRINTNAV,
  TAUTWIRE_EDGE_X,
  TAUTWIRE_Z,
} from './posrefData';

const RADASCAN_ID = 'radascan-001';
const CYSCAN_ID = 'cyscan-001';
const DGPS_ID = 'dgps-001';
const TW_ID = 'tautwire-001';
const SN_ID = 'sprintnav-001';
// SPRINT-Nav housing split along its 346 mm length, scaled off the datasheet photo.
const SN_CAP = 0.07;
const SN_FLANGE = 0.03;
const SN_BAND = SPRINTNAV.height.value - SN_CAP - SN_FLANGE - 0.06;

function useDisposeAll(g: Record<string, { dispose(): void }>) {
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
}

const ease = (cur: number, target: number, dt: number, rate = 3) => cur + (target - cur) * (1 - Math.exp(-dt * rate));

/**
 * Guidance Marine RadaScan View sensor, Ø500 × 410 mm (installer's guide 94-0492-4-A): white radome with the blue
 * base band, on a 240 mm square M8 mounting plate and plinth. The connection panel and information display sit
 * underneath on one side, facing away from the operating area (forward, for working astern).
 */
export function RadaScanSensor() {
  const handlers = useSelectable(RADASCAN_ID);
  const { mats, visual } = useEquipmentMaterials(RADASCAN_ID, {
    radome: { color: '#eef1f3', metalness: 0.1, roughness: 0.55 },
    base: { color: '#3c434a', metalness: 0.6, roughness: 0.45 },
    band: { color: '#2b6cb3', metalness: 0.2, roughness: 0.45 },
    antenna: { color: '#9aa1a6', metalness: 0.6, roughness: 0.4 },
    panel: { color: '#22272c', metalness: 0.3, roughness: 0.5 },
  });
  const radial = useQualityProfile().radialSegments;
  const R = RADASCAN.diameter.value / 2;
  const H = RADASCAN.height.value;
  const P = RADASCAN.pedestalHeight.value;
  const plate = RADASCAN.mountHoles.value + 0.06;
  const band = H * 0.2;
  const body = H * 0.62;
  const cap = H - band - body;
  const g = useMemo(
    () => ({
      pedestal: new THREE.CylinderGeometry(0.1, 0.16, P, radial),
      plate: new THREE.BoxGeometry(plate, 0.02, plate),
      bolt: new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6),
      band: new THREE.CylinderGeometry(R, R, band, radial),
      body: new THREE.CylinderGeometry(R * 0.96, R, body, radial),
      cap: new THREE.SphereGeometry(R * 0.96, radial, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, cap / (R * 0.96), 1),
      antenna: new THREE.BoxGeometry(R * 1.5, body * 0.6, 0.05),
      panel: new THREE.BoxGeometry(0.2, band * 0.6, 0.012),
      display: new THREE.PlaneGeometry(0.07, band * 0.3),
    }),
    [R, P, plate, band, body, cap, radial],
  );
  useDisposeAll(g);
  const rotor = useRef<THREE.Group>(null);
  const reduced = useAppStore((s) => s.reducedMotion);
  useFrame((_, dt) => {
    // Antenna inside the radome (seen in X-ray / ghost views) turns while the sensor runs.
    if (rotor.current && posRefs.getState().radascan.phase !== 'off') rotor.current.rotation.y += dt * (reduced ? 0.4 : 2.4);
  });
  const o = visual.outline;
  const y0 = P + 0.02;
  const half = RADASCAN.mountHoles.value / 2;
  return (
    <group name={`equipment:${RADASCAN_ID}`} position={RADASCAN_POS} {...handlers}>
      <EqMesh geometry={g.pedestal} material={mats.base} outline={o} position={[0, P / 2, 0]} name="plinth" />
      <EqMesh geometry={g.plate} material={mats.base} outline={o} position={[0, P + 0.01, 0]} name="mounting-plate-240" />
      {[-half, half].flatMap((x) => [-half, half].map((z) => <mesh key={`${x}${z}`} geometry={g.bolt} material={mats.antenna} position={[x, P + 0.025, z]} />))}
      <EqMesh geometry={g.band} material={mats.band} outline={o} position={[0, y0 + band / 2, 0]} name="radome-band" />
      <mesh geometry={g.panel} material={mats.panel} position={[0, y0 + band / 2, R + 0.006]} name="connection-panel" />
      <mesh geometry={g.display} position={[0.06, y0 + band / 2, R + 0.013]} name="information-display">
        <meshBasicMaterial color="#3fd0ff" toneMapped={false} />
      </mesh>
      <EqMesh geometry={g.body} material={mats.radome} outline={o} position={[0, y0 + band + body / 2, 0]} name="radome" />
      <EqMesh geometry={g.cap} material={mats.radome} outline={o} position={[0, y0 + band + body, 0]} />
      <group ref={rotor} position={[0, y0 + band + body / 2, 0]} name="scanning-antenna">
        <mesh geometry={g.antenna} material={mats.antenna} />
      </group>
    </group>
  );
}

/**
 * Guidance Marine CyScan AS (installer's guide 94-0559-C): base 405 wide × 327 deep with the 80 mm access-cover box
 * facing forward, cable gland plate aft, and the rounded rotor with its slanted top and tall laser window;
 * 563 mm from the mounting plate. Bolted 190 × 360 mm, 4 × M8.
 */
export function CyScanSensor() {
  const handlers = useSelectable(CYSCAN_ID);
  const { mats, visual } = useEquipmentMaterials(CYSCAN_ID, {
    head: { color: '#e9ecef', metalness: 0.15, roughness: 0.45 },
    base: { color: '#eef0f2', metalness: 0.15, roughness: 0.5 },
    ring: { color: '#2f6fdd', metalness: 0.2, roughness: 0.4 },
    pedestal: { color: '#3c434a', metalness: 0.6, roughness: 0.45 },
    window: { color: '#14181c', metalness: 0.9, roughness: 0.1 },
    gland: { color: '#9aa1a6', metalness: 0.7, roughness: 0.35 },
  });
  const radial = useQualityProfile().radialSegments;
  const W = CYSCAN.width.value;
  const BD = CYSCAN.baseDepth.value;
  const cover = CYSCAN.depth.value - BD;
  const B = CYSCAN.baseHeight.value;
  const ring = 0.02;
  const HH = CYSCAN.headHeight.value - B - ring;
  const RR = Math.min(W, BD) * 0.42;
  const slant = 0.06;
  const g = useMemo(() => {
    // Rotor: a cylinder whose top is cut on a slope (slanted top), rounded at the upper edge.
    const rotor = new THREE.CylinderGeometry(RR, RR, HH, radial, 4);
    const pos = rotor.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) pos.setY(i, y - slant / 2 + (pos.getX(i) / RR) * (slant / 2));
    }
    rotor.computeVertexNormals();
    return {
      pedestal: new THREE.BoxGeometry(W + 0.04, CYSCAN_PEDESTAL, BD + 0.04),
      base: new THREE.BoxGeometry(W, B, BD),
      cover: new THREE.BoxGeometry(W * 0.7, B * 0.8, cover),
      gland: new THREE.BoxGeometry(W * 0.5, B * 0.45, 0.01),
      handle: new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI),
      ring: new THREE.CylinderGeometry(RR * 1.04, RR * 1.04, ring, radial),
      rotor,
      window: new THREE.BoxGeometry(0.012, HH * 0.62, RR * 0.9),
      display: new THREE.PlaneGeometry(0.08, B * 0.25),
    };
  }, [W, BD, cover, B, HH, RR, radial]);
  useDisposeAll(g);
  const head = useRef<THREE.Group>(null);
  const reduced = useAppStore((s) => s.reducedMotion);
  useFrame((_, dt) => {
    if (head.current && posRefs.getState().cyscan.phase !== 'off') head.current.rotation.y += dt * (reduced ? 0.5 : 3.2);
  });
  const o = visual.outline;
  const y0 = CYSCAN_PEDESTAL;
  return (
    <group name={`equipment:${CYSCAN_ID}`} position={CYSCAN_POS} {...handlers}>
      <EqMesh geometry={g.pedestal} material={mats.pedestal} outline={o} position={[0, y0 / 2, 0]} name="mounting-plinth" />
      <EqMesh geometry={g.base} material={mats.base} outline={o} position={[0, y0 + B / 2, 0]} name="sensor-base" />
      <EqMesh geometry={g.cover} material={mats.base} outline={o} position={[0, y0 + B * 0.45, BD / 2 + cover / 2]} name="access-cover" />
      <mesh geometry={g.display} position={[0, y0 + B * 0.55, BD / 2 + cover + 0.002]} name="sensor-information-display">
        <meshBasicMaterial color="#3fd0ff" toneMapped={false} />
      </mesh>
      <mesh geometry={g.gland} material={mats.gland} position={[0, y0 + B * 0.4, -BD / 2 - 0.005]} name="cable-gland-plate" />
      {[-1, 1].map((k) => (
        <mesh key={k} geometry={g.handle} material={mats.gland} position={[k * (W / 2 + 0.005), y0 + B * 0.5, 0]} rotation={[0, Math.PI / 2, 0]} name="lifting-handle" />
      ))}
      <EqMesh geometry={g.ring} material={mats.ring} outline={o} position={[0, y0 + B + ring / 2, 0]} name="blue-ring" />
      <group ref={head} position={[0, y0 + B + ring + HH / 2, 0]}>
        <EqMesh geometry={g.rotor} material={mats.head} outline={o} name="rotor" />
        <mesh geometry={g.window} material={mats.window} position={[RR - 0.004, -HH * 0.08, 0]} name="laser-window" />
      </group>
    </group>
  );
}

/**
 * Trimble GA830 GNSS antenna (Ø149 × 99 mm, 0.82 kg) for each Seastar 9410-AUT receiver, on a 5/8"-11 pole mount
 * on the mast yardarm. Colours are not stated in the datasheet; drawn from the product photo.
 */
export function DGPSAntennas() {
  const handlers = useSelectable(DGPS_ID);
  const { mats, visual } = useEquipmentMaterials(DGPS_ID, {
    dome: { color: '#d9dcde', metalness: 0.1, roughness: 0.55 },
    base: { color: '#4a4f54', metalness: 0.3, roughness: 0.5 },
    mount: { color: '#5d656c', metalness: 0.7, roughness: 0.35 },
  });
  const radial = useQualityProfile().radialSegments;
  const r = SEASTAR.antennaDiameter.value / 2;
  const h = SEASTAR.antennaHeight.value;
  const baseH = h * 0.3;
  const g = useMemo(
    () => ({
      post: new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8),
      base: new THREE.CylinderGeometry(r, r * 0.92, baseH, radial),
      dome: new THREE.SphereGeometry(r * 0.98, radial, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, (h - baseH) / (r * 0.98), 1),
      tnc: new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8).rotateZ(Math.PI / 2),
    }),
    [r, h, baseH, radial],
  );
  useDisposeAll(g);
  const o = visual.outline;
  return (
    <group name={`equipment:${DGPS_ID}`} {...handlers}>
      {GNSS_ANTENNAS.map((p, i) => (
        <group key={i} position={p} name={`ga830-antenna-${i + 1}`}>
          <EqMesh geometry={g.post} material={mats.mount} outline={o} position={[0, 0.25, 0]} name="pole-mount-5-8" />
          <EqMesh geometry={g.base} material={mats.base} outline={o} position={[0, 0.5 + baseH / 2, 0]} name="antenna-base" />
          <mesh geometry={g.tnc} material={mats.mount} position={[r * 0.6, 0.5 - 0.01, 0]} name="tnc-connector" />
          <EqMesh geometry={g.dome} material={mats.dome} outline={o} position={[0, 0.5 + baseH, 0]} name="radome" />
        </group>
      ))}
    </group>
  );
}

// SMT Taut Wire 2.0, in the skid's own frame: u outboard from the skid's outboard edge, h above the skid base.
// Laid out to the manual's cover render and drawings SMT-TW-MD-20/21 (recovered / deployed): yellow skid with
// the weight basket at the outboard end, winch and drum at the inboard end, tall control cabinet down one side,
// and a ladder-braced A-frame that leans inboard when recovered, carrying a cranked upper arm whose arched end
// holds the gimbal head over the weight. Fixed by the documents: stored height 2085, max height while deploying
// 2395 (the A-frame pin passes over the pivot), deployed head 2510 outboard and 1059 up. Pivot, joint and part
// sizes are scaled off the drawings.
const TW_PIVOT_UH: [number, number] = [-0.25, 0.35];
/** A-frame length, pivot to arm pin: the pin's highest point while swinging is the 2395 mm max height. */
const TW_L1 = SMT_TW.deployHeight.value - TW_PIVOT_UH[1];
/** Weight basket centre (u) and the seat the weight rests on (h). Scaled. */
const TW_BASKET_U = -0.45;
const TW_BASKET_H = 0.3;
const TW_RECOVERED_THETA = (-37 * Math.PI) / 180; // A-frame lean from vertical, negative inboard (scaled)
const TW_RECOVERED_HEAD: [number, number] = [TW_BASKET_U, 1.72];
const TW_DEPLOYED_HEAD: [number, number] = [SMT_TW.reach.value, SMT_TW.headHeight.value];
const TW_HEAD_Z = SMT_TW.headLateral.value;
const twElbow = (theta: number): [number, number] => [TW_PIVOT_UH[0] + TW_L1 * Math.sin(theta), TW_PIVOT_UH[1] + TW_L1 * Math.cos(theta)];
const TW_RECOVERED_ELBOW = twElbow(TW_RECOVERED_THETA);
/** Arm length, pin to gimbal head (rigid cranked arm). */
const TW_L2 = Math.hypot(TW_RECOVERED_HEAD[0] - TW_RECOVERED_ELBOW[0], TW_RECOVERED_HEAD[1] - TW_RECOVERED_ELBOW[1]);
const TW_RECOVERED_PHI = Math.atan2(TW_RECOVERED_HEAD[1] - TW_RECOVERED_ELBOW[1], TW_RECOVERED_HEAD[0] - TW_RECOVERED_ELBOW[0]);
/** Deployed joint angles from the documented head position (two-link, pin up). */
const [TW_DEPLOYED_THETA, TW_DEPLOYED_PHI] = (() => {
  const [pu, ph] = TW_PIVOT_UH;
  const [hu, hh] = TW_DEPLOYED_HEAD;
  const du = hu - pu;
  const dh = hh - ph;
  const d = Math.min(Math.hypot(du, dh), TW_L1 + TW_L2 - 1e-6);
  const a = (TW_L1 * TW_L1 - TW_L2 * TW_L2 + d * d) / (2 * d);
  const k = Math.sqrt(Math.max(0, TW_L1 * TW_L1 - a * a));
  const eu = pu + (a * du) / d - (k * dh) / d;
  const eh = ph + (a * dh) / d + (k * du) / d;
  return [Math.atan2(eu - pu, eh - ph), Math.atan2(hh - eh, hu - eu)];
})();
/** Joint angles [A-frame lean, arm direction] for a boom position 0 (recovered) … 1 (deployed). */
function tautWireJoints(t: number): [number, number] {
  const s = t * t * (3 - 2 * t);
  return [TW_RECOVERED_THETA + (TW_DEPLOYED_THETA - TW_RECOVERED_THETA) * s, TW_RECOVERED_PHI + (TW_DEPLOYED_PHI - TW_RECOVERED_PHI) * s];
}
/** Gimbal head (u, h) for a boom position 0 (recovered) … 1 (deployed). */
export function tautWireHeadUH(t: number): [number, number] {
  const [theta, phi] = tautWireJoints(t);
  const e = twElbow(theta);
  return [e[0] + TW_L2 * Math.cos(phi), e[1] + TW_L2 * Math.sin(phi)];
}
/** Gimbal head position (vessel frame) for a boom position 0 (recovered) … 1 (deployed). */
export function tautWireHead(t: number): [number, number, number] {
  const [u, h] = tautWireHeadUH(t);
  return [TAUTWIRE_EDGE_X + u, DECK_Y + h, TAUTWIRE_Z + TW_HEAD_Z];
}
/** Wire hanging below the head with no payout: the weight sits in its basket when recovered. */
export const tautWireHang = (t: number) => (1 - t) * (TW_RECOVERED_HEAD[1] - 0.12 - TW_BASKET_H - SMT_TW.weightHeight.value);
const boomExtension = { current: 0 };

/** Place a unit-length (along Y) member between two points of the skid frame. */
function setBeam(obj: THREE.Object3D | null, a: readonly number[], b: readonly number[]) {
  if (!obj) return;
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  obj.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  obj.scale.set(1, len, 1);
}
/** Static transform for a unit-length (along Y) member between two points. */
function beamProps(a: readonly number[], b: readonly number[]) {
  const o = new THREE.Object3D();
  setBeam(o, a, b);
  return { position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() };
}

// A-frame legs in the frame's own axes (pin at y = L1): wide at the pivots astride the basket, narrow at the pin.
const TW_LEG_FOOT = 0.55;
const TW_LEG_HEAD = 0.2;
const legZ = (y: number) => TW_LEG_FOOT + ((TW_LEG_HEAD - TW_LEG_FOOT) * y) / TW_L1;
const TW_RUNGS = [0.62, 1.12, 1.58];
/** Luffing rams: skid anchors under the winch, rod ends on the legs. Scaled off the render. */
const TW_RAM_ANCHOR_U = -1.05;
const TW_RAM_LEG_Y = 0.7;
// Cranked arm drawn in the recovered pose (relative to the pin), then turned into the arm's own axes.
const twArmLocal = (du: number, dh: number): [number, number] => {
  const c = Math.cos(-TW_RECOVERED_PHI);
  const s = Math.sin(-TW_RECOVERED_PHI);
  return [du * c - dh * s, du * s + dh * c];
};

/**
 * SMT Taut Wire 2.0 (Z Range Mk2), modelled on the unit shown in the installation manual PJ 0044-13: yellow skid
 * with grating, weight basket and orange bell-shaped depressor weight, winch with side plates and drive motor,
 * white control cabinet, ladder-braced A-frame on luffing rams, cranked arm with the domed gimbal head and beacon.
 */
export function TautWireUnit() {
  const handlers = useSelectable(TW_ID);
  const { mats, visual } = useEquipmentMaterials(TW_ID, {
    frame: { color: '#f0cf13', metalness: 0.35, roughness: 0.45 },
    cabinet: { color: '#eceeee', metalness: 0.2, roughness: 0.5 },
    drum: { color: '#3c434a', metalness: 0.7, roughness: 0.35 },
    motor: { color: '#8a9298', metalness: 0.6, roughness: 0.4 },
    grating: { color: '#a3a8ab', metalness: 0.6, roughness: 0.6 },
    head: { color: '#4b5258', metalness: 0.75, roughness: 0.3 },
    rod: { color: '#d6dade', metalness: 0.9, roughness: 0.2 },
    gland: { color: '#2b8fd6', metalness: 0.2, roughness: 0.5 },
    beacon: { color: '#f2a516', metalness: 0.2, roughness: 0.4 },
  });
  const radial = useQualityProfile().radialSegments;
  const FX = SMT_TW.footprintX.value;
  const FZ = SMT_TW.footprintZ.value;
  const cab = { u0: -1.5, u1: -0.55, z0: -FZ / 2 + 0.02, z1: -FZ / 2 + 0.5, h0: 0.15, h1: SMT_TW.consoleHeight.value };
  const g = useMemo(() => {
    // Arch from the end of the arm beam over and down to the far rim of the gimbal ring, in the arm's own axes.
    const [ax, ay] = twArmLocal(0.72, 0);
    const [cx, cy] = twArmLocal(TW_RECOVERED_HEAD[0] - TW_RECOVERED_ELBOW[0] + 0.32, 0.03);
    const [ex, ey] = twArmLocal(TW_RECOVERED_HEAD[0] - TW_RECOVERED_ELBOW[0] + 0.275, TW_RECOVERED_HEAD[1] - TW_RECOVERED_ELBOW[1] + 0.02);
    const arch = new THREE.QuadraticBezierCurve3(new THREE.Vector3(ax, ay, 0), new THREE.Vector3(cx, cy, 0), new THREE.Vector3(ex, ey, 0));
    return {
      rail: new THREE.BoxGeometry(FX, 0.15, 0.14),
      cross: new THREE.BoxGeometry(0.14, 0.15, FZ - 0.28),
      eye: new THREE.TorusGeometry(0.05, 0.015, 6, 12),
      grating: new THREE.BoxGeometry(0.75, 0.03, FZ - 0.28),
      basketRing: new THREE.TorusGeometry(0.4, 0.03, 6, radial).rotateX(Math.PI / 2),
      basketPost: new THREE.BoxGeometry(0.06, TW_BASKET_H - 0.15, 0.06),
      basketSeat: new THREE.CylinderGeometry(0.36, 0.36, 0.03, radial),
      basketPlate: new THREE.BoxGeometry(0.03, 0.32, 0.6),
      pivotPlate: new THREE.BoxGeometry(0.4, 0.42, 0.03),
      cabinet: new THREE.BoxGeometry(cab.u1 - cab.u0, cab.h1 - cab.h0, cab.z1 - cab.z0),
      cabinetPlinth: new THREE.BoxGeometry(cab.u1 - cab.u0 - 0.1, 0.35, 0.06),
      plug: new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10),
      drum: new THREE.CylinderGeometry(0.26, 0.26, 0.62, radial).rotateX(Math.PI / 2),
      winchPlate: new THREE.BoxGeometry(0.8, 0.72, 0.04),
      hole: new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10).rotateX(Math.PI / 2),
      motor: new THREE.CylinderGeometry(0.17, 0.17, 0.42, radial).rotateZ(Math.PI / 2),
      motorFins: new THREE.CylinderGeometry(0.19, 0.19, 0.06, radial).rotateZ(Math.PI / 2),
      leg: new THREE.BoxGeometry(0.12, 1, 0.12),
      rung: new THREE.BoxGeometry(0.08, 0.08, 1),
      pin: new THREE.CylinderGeometry(0.05, 0.05, 1, 12).rotateX(Math.PI / 2),
      pinCap: new THREE.CylinderGeometry(0.1, 0.1, 0.05, radial).rotateX(Math.PI / 2),
      ramBody: new THREE.CylinderGeometry(0.05, 0.05, 1, 10),
      ramRod: new THREE.CylinderGeometry(0.022, 0.022, 1, 8),
      armBeam: new THREE.BoxGeometry(1, 0.17, 0.3),
      arch: new THREE.TubeGeometry(arch, 12, 0.045, 8, false),
      ring: new THREE.TorusGeometry(0.3, 0.035, 8, radial).rotateX(Math.PI / 2),
      disc: new THREE.CylinderGeometry(0.3, 0.3, 0.03, radial),
      rib: new THREE.TorusGeometry(0.26, 0.02, 6, radial, Math.PI),
      sheave: new THREE.CylinderGeometry(0.1, 0.1, 0.04, radial).rotateX(Math.PI / 2),
      beacon: new THREE.SphereGeometry(0.055, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    };
  }, [FX, FZ, cab.u0, cab.u1, cab.z0, cab.z1, cab.h0, cab.h1, radial]);
  useDisposeAll(g);
  const frameRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const ramBodies = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const ramRods = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const reduced = useAppStore((s) => s.reducedMotion);
  const pose = (t: number) => {
    const [theta, phi] = tautWireJoints(t);
    const [eu, eh] = twElbow(theta);
    frameRef.current?.rotation.set(0, 0, -theta);
    armRef.current?.position.set(eu, eh, TW_HEAD_Z);
    armRef.current?.rotation.set(0, 0, phi);
    head.current?.position.set(eu + TW_L2 * Math.cos(phi), eh + TW_L2 * Math.sin(phi), TW_HEAD_Z);
    // Luffing rams: fixed body length from the skid anchor, rod to the leg.
    const ru = TW_PIVOT_UH[0] + TW_RAM_LEG_Y * Math.sin(theta);
    const rh = TW_PIVOT_UH[1] + TW_RAM_LEG_Y * Math.cos(theta);
    [-1, 1].forEach((k, i) => {
      const z = TW_HEAD_Z + k * (legZ(TW_RAM_LEG_Y) - 0.1);
      const a = [TW_RAM_ANCHOR_U, 0.3, z];
      const b = [ru, rh, z];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const f = Math.min(1, 0.62 / len);
      setBeam(ramBodies[i].current, a, [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, z]);
      setBeam(ramRods[i].current, a, b);
    });
  };
  useFrame((_, dt) => {
    const out = posRefs.getState().tautwire.phase !== 'stowed' ? 1 : 0;
    boomExtension.current = reduced ? out : ease(boomExtension.current, out, dt, 1.5);
    pose(boomExtension.current);
  });
  const legs = useMemo(
    () =>
      [-1, 1].map((k) => beamProps([0, -0.05, k * TW_LEG_FOOT], [0, TW_L1 + 0.05, k * TW_LEG_HEAD])),
    [],
  );
  const armBeam = useMemo(() => {
    const a = twArmLocal(-0.12, 0);
    const b = twArmLocal(0.78, 0);
    return { position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0] as [number, number, number], rotation: Math.atan2(b[1] - a[1], b[0] - a[0]), length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  }, []);
  const o = visual.outline;
  const winchU = -1.3;
  const holes: [number, number][] = [
    [-0.25, 0.2],
    [0.25, 0.2],
    [-0.25, -0.2],
    [0.25, -0.2],
    [0, 0.28],
  ];
  return (
    <group name={`equipment:${TW_ID}`} position={[TAUTWIRE_EDGE_X, DECK_Y, TAUTWIRE_Z]} {...handlers}>
      {/* Skid base: perimeter beams, cross members, lifting eyes and grating walkways */}
      {[-1, 1].map((k) => (
        <EqMesh key={`r${k}`} geometry={g.rail} material={mats.frame} outline={o} position={[-FX / 2, 0.075, k * (FZ / 2 - 0.07)]} name={k > 0 ? 'skid' : undefined} />
      ))}
      {[0.07, 0.95, FX - 0.07].map((x) => (
        <EqMesh key={`c${x}`} geometry={g.cross} material={mats.frame} outline={o} position={[-x, 0.075, 0]} />
      ))}
      {[-1, 1].flatMap((k) =>
        [-0.05, -FX + 0.05].map((x) => <mesh key={`e${k}${x}`} geometry={g.eye} material={mats.frame} position={[x, 0.2, k * (FZ / 2 - 0.07)]} />),
      )}
      <mesh geometry={g.grating} material={mats.grating} position={[-1.3, 0.14, 0]} />
      {/* Weight basket at the outboard end, with the side plates carrying the A-frame pivots */}
      <group position={[TW_BASKET_U, 0, TW_HEAD_Z]} name="weight-basket">
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={g.basketPost} material={mats.frame} position={[0.36 * Math.cos((i * Math.PI) / 2 + Math.PI / 4), 0.15 + (TW_BASKET_H - 0.15) / 2, 0.36 * Math.sin((i * Math.PI) / 2 + Math.PI / 4)]} />
        ))}
        <mesh geometry={g.basketSeat} material={mats.head} position={[0, TW_BASKET_H - 0.015, 0]} />
        <EqMesh geometry={g.basketRing} material={mats.frame} outline={o} position={[0, TW_BASKET_H + 0.05, 0]} />
        <EqMesh geometry={g.basketPlate} material={mats.frame} outline={o} position={[0.42, 0.31, 0]} name="basket-front-plate" />
      </group>
      {[-1, 1].map((k) => (
        <EqMesh key={`p${k}`} geometry={g.pivotPlate} material={mats.frame} outline={o} position={[TW_PIVOT_UH[0] - 0.05, 0.3, TW_HEAD_Z + k * (TW_LEG_FOOT + 0.08)]} />
      ))}
      <mesh geometry={g.pin} material={mats.head} position={[TW_PIVOT_UH[0], TW_PIVOT_UH[1], TW_HEAD_Z]} scale={[1, 1, 2 * TW_LEG_FOOT + 0.24]} name="a-frame-pivot" />
      {/* Control cabinet with the cable entry panel below its sloped front */}
      <EqMesh geometry={g.cabinet} material={mats.cabinet} outline={o} position={[(cab.u0 + cab.u1) / 2, (cab.h0 + cab.h1) / 2, (cab.z0 + cab.z1) / 2]} name="control-cabinet" />
      <mesh geometry={g.cabinetPlinth} material={mats.grating} position={[(cab.u0 + cab.u1) / 2, 0.32, cab.z1 + 0.03]} />
      {[-0.2, -0.05, 0.1].map((du) => (
        <mesh key={du} geometry={g.plug} material={mats.gland} position={[(cab.u0 + cab.u1) / 2 + du, 0.42, cab.z1 + 0.07]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      {/* Winch: drum between perforated side plates, drive motor outboard of the plate */}
      <group position={[winchU, 0, TW_HEAD_Z]} name="winch">
        {[-0.36, 0.36].map((z) => (
          <group key={z} position={[0, 0.51, z]}>
            <EqMesh geometry={g.winchPlate} material={mats.frame} outline={o} />
            {holes.map(([hu, hh]) => (
              <mesh key={`${hu}${hh}`} geometry={g.hole} material={mats.drum} position={[hu, hh, 0]} />
            ))}
          </group>
        ))}
        <EqMesh geometry={g.drum} material={mats.drum} outline={o} position={[0, 0.5, 0]} name="winch-drum" />
        <EqMesh geometry={g.motor} material={mats.motor} outline={o} position={[0, 1.05, 0]} name="winch-motor" />
        <mesh geometry={g.motorFins} material={mats.motor} position={[-0.23, 1.05, 0]} />
      </group>
      {/* Ladder-braced A-frame, turning about the pivot at the basket */}
      <group position={[TW_PIVOT_UH[0], TW_PIVOT_UH[1], TW_HEAD_Z]}>
        <group ref={frameRef} name="a-frame">
          {legs.map((p, i) => (
            <group key={i} position={p.position} quaternion={p.quaternion} scale={p.scale}>
              <EqMesh geometry={g.leg} material={mats.frame} outline={o} />
            </group>
          ))}
          {TW_RUNGS.map((y) => (
            <group key={y} position={[0, y, 0]} scale={[1, 1, 2 * legZ(y)]}>
              <EqMesh geometry={g.rung} material={mats.frame} outline={o} />
            </group>
          ))}
          <mesh geometry={g.pin} material={mats.head} position={[0, TW_L1, 0]} scale={[1, 1, 2 * TW_LEG_HEAD + 0.12]} />
          {[-1, 1].map((k) => (
            <mesh key={k} geometry={g.pinCap} material={mats.drum} position={[0, TW_L1, k * (TW_LEG_HEAD + 0.07)]} />
          ))}
        </group>
      </group>
      {[0, 1].map((i) => (
        <group key={i}>
          <group ref={ramBodies[i]}>
            <EqMesh geometry={g.ramBody} material={mats.frame} outline={o} name={i === 0 ? 'luffing-ram' : undefined} />
          </group>
          <group ref={ramRods[i]}>
            <mesh geometry={g.ramRod} material={mats.rod} />
          </group>
        </group>
      ))}
      {/* Cranked upper arm with its arched end */}
      <group ref={armRef} name="cranked-arm">
        <group position={armBeam.position} rotation={[0, 0, armBeam.rotation]} scale={[armBeam.length, 1, 1]}>
          <EqMesh geometry={g.armBeam} material={mats.frame} outline={o} />
        </group>
        {[-0.12, 0.12].map((z) => (
          <EqMesh key={z} geometry={g.arch} material={mats.frame} outline={o} position={[0, 0, z]} />
        ))}
      </group>
      {/* Gimbal head: ring and wire guide under a ribbed dome, beacon on top; stays level */}
      <group ref={head} name="gimbal-head">
        <EqMesh geometry={g.ring} material={mats.frame} outline={o} />
        <mesh geometry={g.disc} material={mats.head} position={[0, -0.03, 0]} />
        <EqMesh geometry={g.rib} material={mats.frame} outline={o} />
        <EqMesh geometry={g.rib} material={mats.frame} outline={o} rotation={[0, Math.PI / 2, 0]} />
        <mesh geometry={g.sheave} material={mats.drum} position={[0, 0.1, 0]} />
        <mesh geometry={g.beacon} material={mats.beacon} position={[0.16, 0.2, 0]} />
      </group>
    </group>
  );
}

/** Sonardyne Type 8097 modular over-the-side pole carrying SPRINT-Nav DP, laid out to the datasheet drawing. */
export function SprintNavPole() {
  const handlers = useSelectable(SN_ID);
  const { mats, visual } = useEquipmentMaterials(SN_ID, {
    pole: { color: '#2a55b0', metalness: 0.45, roughness: 0.45 },
    strake: { color: '#234a99', metalness: 0.45, roughness: 0.5 },
    mount: { color: '#2a55b0', metalness: 0.45, roughness: 0.5 },
    adapter: { color: '#c62828', metalness: 0.4, roughness: 0.45 },
    ti: { color: '#b9bec2', metalness: 0.85, roughness: 0.25 },
    dvl: { color: '#202428', metalness: 0.4, roughness: 0.5 },
    navy: { color: '#1d2b4a', metalness: 0.35, roughness: 0.45 },
  });
  const radial = useQualityProfile().radialSegments;
  const L = POLE_8097.length.value;
  const D = POLE_8097.diameter.value;
  const ends = POLE_8097.sectionEnds.value;
  const starts = [0, ...ends.slice(0, -1)];
  const pivotY = POLE_PIVOT[1];
  const lockY = pivotY - POLE_8097.lockBelowPivot.value;
  const railTop = DECK_Y + BULWARK_H;
  const g = useMemo(
    () => ({
      section: new THREE.CylinderGeometry(D / 2, D / 2, 1, radial).rotateX(Math.PI / 2),
      flange: new THREE.CylinderGeometry(D / 2 + 0.06, D / 2 + 0.06, 0.05, radial).rotateX(Math.PI / 2),
      strake: new THREE.BoxGeometry(0.04, 0.09, 0.42),
      lug: new THREE.BoxGeometry(0.04, 0.12, 0.16),
      hub: new THREE.CylinderGeometry(0.17, 0.17, 0.5, radial).rotateZ(Math.PI / 2),
      post: new THREE.BoxGeometry(0.4, pivotY - DECK_Y + 0.35, 0.5),
      beam: new THREE.BoxGeometry(0.75, 0.3, 0.5),
      stand: new THREE.BoxGeometry(0.16, POLE_PIVOT[1] - D / 2 - railTop, 0.3),
      lockPlate: new THREE.BoxGeometry(0.12, 0.6, 0.8),
      lockArm: new THREE.BoxGeometry(0.4, 0.14, 0.14),
      jaw: new THREE.BoxGeometry(0.08, 0.4, 0.26),
      cap: new THREE.CylinderGeometry(SPRINTNAV.diameter.value / 2, SPRINTNAV.diameter.value / 2, SN_CAP, radial).rotateX(Math.PI / 2),
      body: new THREE.CylinderGeometry(SPRINTNAV.diameter.value / 2 - 0.006, SPRINTNAV.diameter.value / 2 - 0.006, SN_BAND, radial).rotateX(Math.PI / 2),
      snFlange: new THREE.CylinderGeometry(SPRINTNAV.diameter.value / 2 + 0.006, SPRINTNAV.diameter.value / 2 + 0.006, SN_FLANGE, radial).rotateX(Math.PI / 2),
      connector: new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8).rotateX(Math.PI / 2),
      dvlHead: new THREE.CylinderGeometry(SPRINTNAV.diameter.value / 2, SPRINTNAV.diameter.value / 2 - 0.02, 0.06, radial).rotateX(Math.PI / 2),
      transducer: new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12).rotateX(Math.PI / 2),
      adaptor: new THREE.CylinderGeometry(D / 2 + 0.07, D / 2 + 0.07, 0.14, radial).rotateX(Math.PI / 2),
    }),
    [D, radial, pivotY, railTop],
  );
  useDisposeAll(g);
  const swing = useRef<THREE.Group>(null);
  const jawL = useRef<THREE.Mesh>(null);
  const beams = useRef<THREE.Group>(null);
  const reduced = useAppStore((s) => s.reducedMotion);
  const angle = useRef(0);
  const beamGeo = useMemo(() => {
    // Four illustrative Janus beams from the DVL face to the seabed (beam angle not stated; 30° drawn).
    const pts: THREE.Vector3[] = [];
    const h = 40;
    const t = Math.tan((30 * Math.PI) / 180) * h;
    for (const [x, z] of [[t, 0], [-t, 0], [0, t], [0, -t]] as const) pts.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, -h, z));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  const beamMat = useMemo(() => new THREE.LineDashedMaterial({ color: CYAN, dashSize: 0.7, gapSize: 0.5, transparent: true, opacity: 0.7, toneMapped: false }), []);
  const beamLines = useMemo(() => {
    const l = new THREE.LineSegments(beamGeo, beamMat);
    l.computeLineDistances();
    return l;
  }, [beamGeo, beamMat]);
  useEffect(
    () => () => {
      beamGeo.dispose();
      beamMat.dispose();
    },
    [beamGeo, beamMat],
  );
  useFrame((_, dt) => {
    const s = posRefs.getState();
    angle.current = reduced ? s.pole.angleDeg : ease(angle.current, s.pole.angleDeg, dt, 8);
    if (swing.current) swing.current.rotation.x = -(angle.current * Math.PI) / 180;
    const closed = s.pole.phase === 'deployed' || (s.pole.phase === 'locking' && s.pole.lockTimer > 0.5);
    const gap = closed ? D / 2 + 0.04 : D / 2 + 0.22;
    if (jawL.current) jawL.current.position.x = ease(jawL.current.position.x, -gap, dt, 6);
    if (beams.current) {
      beams.current.visible = posRefReadiness(s, posRefs.getPose()).SPRINTNAV;
      const p = sprintNavPos(90);
      beams.current.position.set(p[0], p[1] - SPRINTNAV.height.value, p[2]);
      beams.current.scale.y = (p[1] - SPRINTNAV.height.value - SCENE_SEABED_Y) / 40;
    }
  });
  const o = visual.outline;
  const hullX = -SHIP_SIDE_X;
  return (
    <group name={`equipment:${SN_ID}`} {...handlers}>
      {/* Deck pivot bracket: post on the deck inside the bulwark, beam out over the side to the hub (datasheet photo). */}
      <EqMesh geometry={g.post} material={mats.mount} outline={o} position={[-SHIP_SIDE_X + 0.45, DECK_Y + (pivotY - DECK_Y + 0.35) / 2, POLE_PIVOT[2]]} name="pivot-mount" />
      <EqMesh geometry={g.beam} material={mats.mount} outline={o} position={[(-SHIP_SIDE_X + 0.45 + POLE_PIVOT[0]) / 2 - 0.05, pivotY + 0.2, POLE_PIVOT[2]]} />
      {POLE_8097.stowSupports.value.map((d) => (
        <EqMesh key={d} geometry={g.stand} material={mats.mount} outline={o} position={[POLE_PIVOT[0] + 0.1, (railTop + POLE_PIVOT[1] - D / 2) / 2, POLE_PIVOT[2] - d]} />
      ))}
      <group position={POLE_PIVOT}>
        <EqMesh geometry={g.hub} material={mats.mount} outline={o} name="pivot" />
        <group ref={swing}>
          {starts.map((z0, i) => {
            const len = ends[i] - z0;
            return (
              <group key={i} position={[0, 0, -(z0 + len / 2)]}>
                <group scale={[1, 1, len - 0.06]}>
                  <EqMesh geometry={g.section} material={mats.pole} outline={o} name={`pole-section-${i + 1}`} />
                </group>
                {i < ends.length - 1 && <EqMesh geometry={g.flange} material={mats.pole} outline={o} position={[0, 0, -len / 2]} />}
                <mesh geometry={g.lug} material={mats.pole} position={[0, D / 2 + 0.05, len / 2 + z0 - POLE_8097.lugs.value[i]]} />
                {i > 0 &&
                  Array.from({ length: 7 }, (_, k) => {
                    // Helical vortex-suppression strakes, three starts, on the lower sections (datasheet drawing and photo).
                    const z = -len / 2 + 0.25 + (k / 7) * (len - 0.5);
                    return [0, 1, 2].map((st) => {
                      const a = (st * 2 * Math.PI) / 3 + (k / 7) * Math.PI * 2;
                      return (
                        <mesh
                          key={`${k}-${st}`}
                          geometry={g.strake}
                          material={mats.strake}
                          position={[Math.cos(a) * (D / 2 + 0.03), Math.sin(a) * (D / 2 + 0.03), z]}
                          rotation={[0, 0, a]}
                        />
                      );
                    });
                  })}
              </group>
            );
          })}
          <group position={[0, 0, -L]} name="sprint-nav-dp">
            <EqMesh geometry={g.adaptor} material={mats.adapter} outline={o} position={[0, 0, 0.07]} name="transceiver-adapter" />
            {/* Datasheet photo: titanium top cap with connectors, dark navy body band, titanium flange, DVL endcap with four angled transducers. */}
            <EqMesh geometry={g.cap} material={mats.ti} outline={o} position={[0, 0, -SN_CAP / 2]} name="titanium-top-cap" />
            {[0.05, -0.05].map((x) => (
              <mesh key={x} geometry={g.connector} material={mats.ti} position={[x, 0.07, 0.015]} name="connector" />
            ))}
            <EqMesh geometry={g.body} material={mats.navy} outline={o} position={[0, 0, -SN_CAP - SN_BAND / 2]} name="sprint-nav-housing" />
            <EqMesh geometry={g.snFlange} material={mats.ti} outline={o} position={[0, 0, -SN_CAP - SN_BAND - SN_FLANGE / 2]} name="bottom-flange" />
            <EqMesh geometry={g.dvlHead} material={mats.dvl} outline={o} position={[0, 0, -SPRINTNAV.height.value + 0.03]} name="dvl-endcap" />
            {[0, 1, 2, 3].map((k) => {
              const a = (k * Math.PI) / 2 + Math.PI / 4;
              return (
                <mesh
                  key={k}
                  geometry={g.transducer}
                  material={mats.ti}
                  position={[Math.cos(a) * 0.065, Math.sin(a) * 0.065, -SPRINTNAV.height.value - 0.002]}
                  rotation={[-Math.sin(a) * 0.5, Math.cos(a) * 0.5, 0]}
                  name="dvl-transducer"
                />
              );
            })}
          </group>
        </group>
      </group>
      {/* Hydraulic lock bracket welded to the hull, 2415 mm below the pole axis and in line with the pole; the outboard jaw closes the pole against the hull saddle. */}
      <group position={[POLE_PIVOT[0], lockY, POLE_PIVOT[2]]} name="hydraulic-lock">
        <EqMesh geometry={g.lockPlate} material={mats.mount} outline={o} position={[hullX - POLE_PIVOT[0] - 0.06, 0, 0]} />
        {[-0.3, 0.3].map((z) => (
          <EqMesh key={z} geometry={g.lockArm} material={mats.mount} outline={o} position={[(hullX - POLE_PIVOT[0]) / 2 - 0.1, 0, z]} />
        ))}
        <mesh ref={jawL} geometry={g.jaw} material={mats.mount} position={[-D / 2 - 0.22, 0, 0]} name="lock-jaw" />
      </group>
      <group ref={beams} visible={false}>
        <primitive object={beamLines} />
      </group>
    </group>
  );
}

/** Bell-shaped depressor weight centred on its mid-height (proportions from the SMT datasheet render). */
function bellGeometry(radial: number) {
  const R = SMT_TW.weightDiameter.value / 2;
  const r = SMT_TW.weightTopDiameter.value / 2;
  const H = SMT_TW.weightHeight.value;
  const pts = [
    [0, 0],
    [R, 0],
    [R, H * 0.1],
    [R * 0.9, H * 0.45],
    [r * 1.1, H * 0.82],
    [r, H * 0.9],
    [r, H],
    [0, H],
  ].map(([x, y]) => new THREE.Vector2(x, y - H / 2));
  return new THREE.LatheGeometry(pts, radial);
}

/**
 * Scene-frame parts that do not move with the vessel: the fixed platform carrying the RadaScan
 * responder and CyScan reflector (illustrative), the taut wire and its depressor weight, and the
 * RadaScan / CyScan measurement lines.
 */
export function PositionReferenceWorld() {
  const radial = useQualityProfile().radialSegments;
  const res = useMemo(() => {
    const steel = new THREE.MeshStandardMaterial({ color: '#7d868d', metalness: 0.6, roughness: 0.5 });
    const deck = new THREE.MeshStandardMaterial({ color: '#4a5258', metalness: 0.4, roughness: 0.7 });
    const responder = new THREE.MeshStandardMaterial({ color: '#f1f3f5', metalness: 0.2, roughness: 0.5 });
    const reflector = new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: 0.9, roughness: 0.1 });
    const weight = new THREE.MeshStandardMaterial({ color: '#e8541c', metalness: 0.35, roughness: 0.5 });
    const wire = new THREE.LineBasicMaterial({ color: '#e8ecef' });
    const radar = new THREE.LineDashedMaterial({ color: '#f2c94c', dashSize: 1.2, gapSize: 0.8, toneMapped: false, transparent: true, opacity: 0.8 });
    const laser = new THREE.LineBasicMaterial({ color: '#ff3b3b', toneMapped: false, transparent: true, opacity: 0.85 });
    const legH = PLATFORM.deckY - SCENE_SEABED_Y;
    const geo = {
      leg: new THREE.CylinderGeometry(0.6, 0.8, legH, radial),
      brace: new THREE.CylinderGeometry(0.18, 0.18, PLATFORM.legSpread * Math.SQRT2, 8),
      deck: new THREE.BoxGeometry(PLATFORM.legSpread + 6, 1.2, PLATFORM.legSpread + 6),
      module: new THREE.BoxGeometry(PLATFORM.legSpread, 5, PLATFORM.legSpread * 0.6),
      // RadaScan responder: white box with a carry handle (brochure photo); size illustrative.
      responder: new THREE.BoxGeometry(0.26, 0.42, 0.2),
      handle: new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI),
      // CyScan AS 1.9 m cylindrical target (leaflet); diameter illustrative.
      reflector: new THREE.CylinderGeometry(0.15, 0.15, 1.9, 16),
      // SMT 400 kg bell-shaped depressor weight, proportioned from the datasheet render.
      weight: bellGeometry(radial),
    };
    const lineGeo = () => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
    const twGeo = lineGeo();
    const rdGeo = lineGeo();
    const lsGeo = lineGeo();
    return {
      mats: { steel, deck, responder, reflector, weight, wire, radar, laser },
      geo,
      lines: { tw: new THREE.Line(twGeo, wire), radar: new THREE.Line(rdGeo, radar), laser: new THREE.Line(lsGeo, laser) },
      lineGeos: [twGeo, rdGeo, lsGeo],
      legH,
    };
  }, [radial]);
  useEffect(
    () => () => {
      Object.values(res.mats).forEach((m) => m.dispose());
      Object.values(res.geo).forEach((g) => g.dispose());
      res.lineGeos.forEach((g) => g.dispose());
    },
    [res],
  );
  const weight = useRef<THREE.Mesh>(null);
  const setLine = (line: THREE.Line, a: readonly number[], b: readonly number[]) => {
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, a[0], a[1], a[2]);
    pos.setXYZ(1, b[0], b[1], b[2]);
    pos.needsUpdate = true;
    line.geometry.computeBoundingSphere();
    if (line.material instanceof THREE.LineDashedMaterial) line.computeLineDistances();
  };
  useFrame(() => {
    const s = posRefs.getState();
    const eta = dpSystem.getState().eta;
    // Taut wire: from the gimbal head (moves with the vessel) to the weight (fixed once on the bottom).
    const head = toWorld(tautWireHead(boomExtension.current), eta);
    const hw = SMT_TW.weightHeight.value;
    const w: [number, number, number] = s.tautwire.anchor
      ? [s.tautwire.anchor[1], SCENE_SEABED_Y + hw / 2, s.tautwire.anchor[0]]
      : [head[0], head[1] - 0.12 - tautWireHang(boomExtension.current) - hw / 2 - s.tautwire.payout, head[2]];
    if (weight.current) weight.current.position.set(...w);
    setLine(res.lines.tw, [head[0], head[1] - 0.12, head[2]], [w[0], w[1] + hw / 2, w[2]]);
    res.lines.tw.visible = s.tautwire.phase !== 'stowed' || boomExtension.current > 0.02;
    const ready = posRefReadiness(s, posRefs.getPose());
    res.lines.radar.visible = ready.RADASCAN;
    if (ready.RADASCAN) setLine(res.lines.radar, toWorld([RADASCAN_POS[0], RADASCAN_POS[1] + RADASCAN.pedestalHeight.value + RADASCAN.height.value / 2, RADASCAN_POS[2]], eta), RESPONDER_WORLD);
    res.lines.laser.visible = ready.CYSCAN;
    if (ready.CYSCAN) setLine(res.lines.laser, toWorld(CYSCAN_WINDOW, eta), REFLECTOR_WORLD);
  });
  const S = PLATFORM.legSpread / 2;
  const legs: [number, number][] = [
    [-S, -S],
    [S, -S],
    [-S, S],
    [S, S],
  ];
  return (
    <group name="position-reference-world">
      <group name="fixed-platform-illustrative" position={[PLATFORM.east, 0, PLATFORM.north]}>
        {legs.map(([x, z]) => (
          <mesh key={`${x}${z}`} geometry={res.geo.leg} material={res.mats.steel} position={[x, SCENE_SEABED_Y + res.legH / 2, z]} />
        ))}
        {[-25, -10, 5].map((y) =>
          [0, 1, 2, 3].map((k) => (
            <mesh
              key={`${y}-${k}`}
              geometry={res.geo.brace}
              material={res.mats.steel}
              position={k < 2 ? [k === 0 ? -S : S, y, 0] : [0, y, k === 2 ? -S : S]}
              rotation={k < 2 ? [Math.PI / 4, 0, 0] : [0, 0, Math.PI / 4]}
            />
          )),
        )}
        <mesh geometry={res.geo.deck} material={res.mats.deck} position={[0, PLATFORM.deckY, 0]} />
        <mesh geometry={res.geo.module} material={res.mats.steel} position={[0, PLATFORM.deckY + 3.1, -S * 0.3]} />
      </group>
      <group position={RESPONDER_WORLD} name="radascan-responder">
        <mesh geometry={res.geo.responder} material={res.mats.responder} />
        <mesh geometry={res.geo.handle} material={res.mats.steel} position={[0, 0.21, 0]} />
      </group>
      <mesh geometry={res.geo.reflector} material={res.mats.reflector} position={REFLECTOR_WORLD} name="cyscan-reflector" />
      <mesh ref={weight} geometry={res.geo.weight} material={res.mats.weight} name="taut-wire-depressor-weight" />
      <primitive object={res.lines.tw} />
      <primitive object={res.lines.radar} />
      <primitive object={res.lines.laser} />
    </group>
  );
}
