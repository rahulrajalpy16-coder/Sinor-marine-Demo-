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
import { posRefReadiness, toWorld, sprintNavPos } from '../simulations/posrefs';
import {
  CYSCAN,
  CYSCAN_POS,
  GNSS_ANTENNAS,
  LBAND_POS,
  PLATFORM,
  POLE_8097,
  POLE_PIVOT,
  RADASCAN,
  RADASCAN_POS,
  REFLECTOR_WORLD,
  RESPONDER_WORLD,
  SCENE_SEABED_Y,
  SEASTAR,
  SMT_TW,
  SPRINTNAV,
  TAUTWIRE_POS,
  TAUTWIRE_TIP,
} from './posrefData';

const RADASCAN_ID = 'radascan-001';
const CYSCAN_ID = 'cyscan-001';
const DGPS_ID = 'dgps-001';
const TW_ID = 'tautwire-001';
const SN_ID = 'sprintnav-001';

function useDisposeAll(g: Record<string, { dispose(): void }>) {
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
}

const ease = (cur: number, target: number, dt: number, rate = 3) => cur + (target - cur) * (1 - Math.exp(-dt * rate));

/** Guidance Marine RadaScan sensor (Ø1.2 × 0.9 m radome) on a pedestal on the bridge top. */
export function RadaScanSensor() {
  const handlers = useSelectable(RADASCAN_ID);
  const { mats, visual } = useEquipmentMaterials(RADASCAN_ID, {
    radome: { color: '#e9edf0', metalness: 0.1, roughness: 0.55 },
    base: { color: '#3c434a', metalness: 0.6, roughness: 0.45 },
    stripe: { color: '#1b5e9a', metalness: 0.2, roughness: 0.5 },
  });
  const radial = useQualityProfile().radialSegments;
  const R = RADASCAN.diameter.value / 2;
  const H = RADASCAN.height.value;
  const P = RADASCAN.pedestalHeight.value;
  const g = useMemo(
    () => ({
      pedestal: new THREE.CylinderGeometry(0.16, 0.22, P, radial),
      flange: new THREE.CylinderGeometry(0.34, 0.34, 0.04, radial),
      base: new THREE.CylinderGeometry(R * 0.96, R, 0.12, radial),
      dome: new THREE.CylinderGeometry(R * 0.98, R * 0.98, H - 0.18, radial),
      cap: new THREE.CylinderGeometry(R * 0.9, R * 0.98, 0.06, radial),
      window: new THREE.BoxGeometry(0.06, H * 0.55, R * 0.7),
    }),
    [R, H, P, radial],
  );
  useDisposeAll(g);
  const rotor = useRef<THREE.Group>(null);
  const reduced = useAppStore((s) => s.reducedMotion);
  useFrame((_, dt) => {
    // Indicates the scanning antenna inside the radome while the sensor runs.
    if (rotor.current && posRefs.getState().radascan.phase !== 'off') rotor.current.rotation.y += dt * (reduced ? 0.4 : 2.4);
  });
  const o = visual.outline;
  return (
    <group name={`equipment:${RADASCAN_ID}`} position={RADASCAN_POS} {...handlers}>
      <EqMesh geometry={g.pedestal} material={mats.base} outline={o} position={[0, P / 2, 0]} name="pedestal" />
      <EqMesh geometry={g.flange} material={mats.base} outline={o} position={[0, 0.02, 0]} />
      <EqMesh geometry={g.base} material={mats.base} outline={o} position={[0, P + 0.06, 0]} name="sensor-base" />
      <EqMesh geometry={g.dome} material={mats.radome} outline={o} position={[0, P + 0.12 + (H - 0.18) / 2, 0]} name="radome" />
      <EqMesh geometry={g.cap} material={mats.radome} outline={o} position={[0, P + H - 0.03, 0]} />
      <group ref={rotor} position={[0, P + 0.12 + (H - 0.18) / 2, 0]}>
        <mesh geometry={g.window} material={mats.stripe} position={[R * 0.985, 0, 0]} />
      </group>
    </group>
  );
}

/** Guidance Marine CyScan laser sensor: fixed base, rotating head with the laser window. */
export function CyScanSensor() {
  const handlers = useSelectable(CYSCAN_ID);
  const { mats, visual } = useEquipmentMaterials(CYSCAN_ID, {
    body: { color: '#d8dde1', metalness: 0.35, roughness: 0.45 },
    base: { color: '#3c434a', metalness: 0.6, roughness: 0.45 },
    window: { color: '#14181c', metalness: 0.9, roughness: 0.1 },
  });
  const radial = useQualityProfile().radialSegments;
  const R = CYSCAN.headDiameter.value / 2;
  const H = CYSCAN.headHeight.value;
  const g = useMemo(
    () => ({
      pedestal: new THREE.CylinderGeometry(0.09, 0.14, 0.4, radial),
      base: new THREE.CylinderGeometry(R, R * 1.05, H * 0.35, radial),
      head: new THREE.CylinderGeometry(R * 0.92, R * 0.92, H * 0.55, radial),
      cap: new THREE.SphereGeometry(R * 0.92, radial, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      window: new THREE.BoxGeometry(0.03, H * 0.32, R * 0.9),
    }),
    [R, H, radial],
  );
  useDisposeAll(g);
  const head = useRef<THREE.Group>(null);
  const reduced = useAppStore((s) => s.reducedMotion);
  useFrame((_, dt) => {
    if (head.current && posRefs.getState().cyscan.phase !== 'off') head.current.rotation.y += dt * (reduced ? 0.5 : 3.2);
  });
  const o = visual.outline;
  const baseY = 0.4 + (H * 0.35) / 2;
  const headY = 0.4 + H * 0.35 + (H * 0.55) / 2;
  return (
    <group name={`equipment:${CYSCAN_ID}`} position={CYSCAN_POS} {...handlers}>
      <EqMesh geometry={g.pedestal} material={mats.base} outline={o} position={[0, 0.2, 0]} name="pedestal" />
      <EqMesh geometry={g.base} material={mats.base} outline={o} position={[0, baseY, 0]} name="sensor-base" />
      <group ref={head} position={[0, headY, 0]}>
        <EqMesh geometry={g.head} material={mats.body} outline={o} name="rotating-head" />
        <EqMesh geometry={g.cap} material={mats.body} outline={o} position={[0, (H * 0.55) / 2, 0]} />
        <mesh geometry={g.window} material={mats.window} position={[R * 0.92, 0, 0]} />
      </group>
    </group>
  );
}

/** Fugro SeaSTAR DGNSS antennas: two GNSS antennas on the yardarm and the L-band correction dome. */
export function DGPSAntennas() {
  const handlers = useSelectable(DGPS_ID);
  const { mats, visual } = useEquipmentMaterials(DGPS_ID, {
    radome: { color: '#f1f3f4', metalness: 0.1, roughness: 0.5 },
    mount: { color: '#5d656c', metalness: 0.7, roughness: 0.35 },
  });
  const radial = useQualityProfile().radialSegments;
  const r = SEASTAR.antennaDiameter.value / 2;
  const rl = SEASTAR.lbandDiameter.value / 2;
  const g = useMemo(
    () => ({
      post: new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8),
      antenna: new THREE.CylinderGeometry(r * 0.7, r, 0.08, radial),
      top: new THREE.SphereGeometry(r * 0.7, radial, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      lbandBase: new THREE.CylinderGeometry(rl, rl, 0.12, radial),
      lband: new THREE.SphereGeometry(rl, radial, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    }),
    [r, rl, radial],
  );
  useDisposeAll(g);
  const o = visual.outline;
  return (
    <group name={`equipment:${DGPS_ID}`} {...handlers}>
      {GNSS_ANTENNAS.map((p, i) => (
        <group key={i} position={p} name={`gnss-antenna-${i + 1}`}>
          <EqMesh geometry={g.post} material={mats.mount} outline={o} position={[0, 0.25, 0]} />
          <EqMesh geometry={g.antenna} material={mats.radome} outline={o} position={[0, 0.54, 0]} />
          <EqMesh geometry={g.top} material={mats.radome} outline={o} position={[0, 0.58, 0]} />
        </group>
      ))}
      <group position={LBAND_POS} name="seastar-lband-antenna">
        <EqMesh geometry={g.lbandBase} material={mats.mount} outline={o} position={[0, 0.06, 0]} />
        <EqMesh geometry={g.lband} material={mats.radome} outline={o} position={[0, 0.12, 0]} />
      </group>
    </group>
  );
}

// Taut wire boom: pivot at the inboard top of the unit; telescopes out and luffs up when deploying.
const TW_PIVOT: [number, number, number] = [TAUTWIRE_POS[0] - SMT_TW.footprintX.value / 2 + 0.1, 3 + 2.1, TAUTWIRE_POS[2]];
const TW_STOWED_TIP: [number, number, number] = [9 - 0.1, 3 + SMT_TW.storedHeight.value, TAUTWIRE_POS[2]];
const lerp3 = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Gimbal head position (vessel frame) for a boom extension 0 (stowed) … 1 (deployed). */
export const tautWireHead = (ext: number) => lerp3(TW_STOWED_TIP, TAUTWIRE_TIP, ext);
const boomExtension = { current: 0 };

/** SMT TW-1.0 lightweight taut wire: deck unit, winch drum, telescopic boom and gimbal head. */
export function TautWireUnit() {
  const handlers = useSelectable(TW_ID);
  const { mats, visual } = useEquipmentMaterials(TW_ID, {
    frame: { color: '#e2b322', metalness: 0.45, roughness: 0.5 },
    housing: { color: '#d9dde0', metalness: 0.35, roughness: 0.5 },
    drum: { color: '#3c434a', metalness: 0.7, roughness: 0.35 },
    boom: { color: '#e2b322', metalness: 0.45, roughness: 0.45 },
    head: { color: '#5d656c', metalness: 0.75, roughness: 0.3 },
  });
  const radial = useQualityProfile().radialSegments;
  const FX = SMT_TW.footprintX.value;
  const FZ = SMT_TW.footprintZ.value;
  const g = useMemo(
    () => ({
      skid: new THREE.BoxGeometry(FX, 0.12, FZ),
      housing: new THREE.BoxGeometry(FX * 0.55, 1.2, FZ * 0.9),
      post: new THREE.BoxGeometry(0.2, 2.0, 0.2),
      drum: new THREE.CylinderGeometry(0.42, 0.42, FZ * 0.7, radial).rotateX(Math.PI / 2),
      flange: new THREE.CylinderGeometry(0.55, 0.55, 0.04, radial).rotateX(Math.PI / 2),
      boomOuter: new THREE.BoxGeometry(2.2, 0.22, 0.22),
      boomInner: new THREE.BoxGeometry(1, 0.16, 0.16),
      gimbal: new THREE.TorusGeometry(0.18, 0.035, 8, radial),
      sheave: new THREE.CylinderGeometry(0.14, 0.14, 0.06, radial).rotateX(Math.PI / 2),
    }),
    [FX, FZ, radial],
  );
  useDisposeAll(g);
  const boom = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const reduced = useAppStore((s) => s.reducedMotion);
  useFrame((_, dt) => {
    const out = posRefs.getState().tautwire.phase !== 'stowed' ? 1 : 0;
    boomExtension.current = reduced ? out : ease(boomExtension.current, out, dt, 2);
    const tip = tautWireHead(boomExtension.current);
    const dx = tip[0] - TW_PIVOT[0];
    const dy = tip[1] - TW_PIVOT[1];
    const len = Math.hypot(dx, dy);
    if (boom.current) boom.current.rotation.z = Math.atan2(dy, dx);
    // Inner section slides out of the outer one so its end reaches the head.
    if (inner.current) {
      inner.current.scale.x = Math.max(0.1, len - 1.9);
      inner.current.position.x = (1.9 + len) / 2;
    }
    if (head.current) head.current.position.set(tip[0] - TAUTWIRE_POS[0], tip[1] - 3, 0);
  });
  const o = visual.outline;
  return (
    <group name={`equipment:${TW_ID}`} position={TAUTWIRE_POS} {...handlers}>
      <EqMesh geometry={g.skid} material={mats.frame} outline={o} position={[0, 0.06, 0]} name="skid" />
      <EqMesh geometry={g.housing} material={mats.housing} outline={o} position={[-FX * 0.2, 0.72, 0]} name="power-control-housing" />
      <EqMesh geometry={g.drum} material={mats.drum} outline={o} position={[FX * 0.22, 0.75, 0]} name="winch-drum" />
      <EqMesh geometry={g.flange} material={mats.head} outline={o} position={[FX * 0.22, 0.75, (FZ * 0.7) / 2]} />
      <EqMesh geometry={g.flange} material={mats.head} outline={o} position={[FX * 0.22, 0.75, -(FZ * 0.7) / 2]} />
      <EqMesh geometry={g.post} material={mats.frame} outline={o} position={[TW_PIVOT[0] - TAUTWIRE_POS[0], 1.1, 0]} name="boom-post" />
      <group ref={boom} position={[TW_PIVOT[0] - TAUTWIRE_POS[0], TW_PIVOT[1] - 3, 0]}>
        <EqMesh geometry={g.boomOuter} material={mats.boom} outline={o} position={[1.1, 0, 0]} name="boom" />
        <mesh ref={inner} geometry={g.boomInner} material={mats.boom} position={[0.3, 0, 0]} />
      </group>
      <group ref={head} name="gimbal-head">
        <EqMesh geometry={g.gimbal} material={mats.head} outline={o} rotation={[Math.PI / 2, 0, 0]} />
        <EqMesh geometry={g.sheave} material={mats.drum} outline={o} position={[0, -0.12, 0]} />
      </group>
    </group>
  );
}

/** Sonardyne Type 8097 over-the-side pole (3 sections, strakes) carrying SPRINT-Nav DP; hydraulic lock on the hull. */
export function SprintNavPole() {
  const handlers = useSelectable(SN_ID);
  const { mats, visual } = useEquipmentMaterials(SN_ID, {
    pole: { color: '#9aa1a6', metalness: 0.6, roughness: 0.45 },
    strake: { color: '#80878c', metalness: 0.6, roughness: 0.5 },
    mount: { color: '#e2b322', metalness: 0.45, roughness: 0.5 },
    ti: { color: '#b9bec2', metalness: 0.85, roughness: 0.25 },
    dvl: { color: '#202428', metalness: 0.4, roughness: 0.5 },
  });
  const radial = useQualityProfile().radialSegments;
  const L = POLE_8097.length.value;
  const D = POLE_8097.diameter.value;
  const sec = L / POLE_8097.sections.value;
  const g = useMemo(
    () => ({
      section: new THREE.CylinderGeometry(D / 2, D / 2, sec - 0.06, radial).rotateX(Math.PI / 2),
      flange: new THREE.CylinderGeometry(D / 2 + 0.07, D / 2 + 0.07, 0.05, radial).rotateX(Math.PI / 2),
      strake: new THREE.BoxGeometry(0.05, 0.1, 0.5),
      hinge: new THREE.CylinderGeometry(0.22, 0.22, 0.7, radial).rotateZ(Math.PI / 2),
      bracket: new THREE.BoxGeometry(0.9, 0.9, 0.5),
      lockPlate: new THREE.BoxGeometry(0.85, 0.5, 0.7),
      jaw: new THREE.BoxGeometry(0.12, 0.45, 0.25),
      body: new THREE.CylinderGeometry(SPRINTNAV.diameter.value / 2, SPRINTNAV.diameter.value / 2, SPRINTNAV.height.value - 0.06, radial).rotateX(Math.PI / 2),
      dvlHead: new THREE.CylinderGeometry(SPRINTNAV.diameter.value / 2, SPRINTNAV.diameter.value / 2 - 0.02, 0.06, radial).rotateX(Math.PI / 2),
      transducer: new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12).rotateX(Math.PI / 2),
      adaptor: new THREE.CylinderGeometry(D / 2 + 0.02, SPRINTNAV.diameter.value / 2, 0.12, radial).rotateX(Math.PI / 2),
    }),
    [D, sec, radial],
  );
  useDisposeAll(g);
  const swing = useRef<THREE.Group>(null);
  const jawL = useRef<THREE.Mesh>(null);
  const jawR = useRef<THREE.Mesh>(null);
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
    const gap = closed ? 0.17 : 0.4;
    if (jawL.current) jawL.current.position.x = ease(jawL.current.position.x, -gap, dt, 6);
    if (jawR.current) jawR.current.position.x = ease(jawR.current.position.x, gap, dt, 6);
    if (beams.current) {
      beams.current.visible = posRefReadiness(s, posRefs.getPose()).SPRINTNAV;
      const p = sprintNavPos(90);
      beams.current.position.set(p[0], p[1] - SPRINTNAV.height.value, p[2]);
      beams.current.scale.y = (p[1] - SPRINTNAV.height.value - SCENE_SEABED_Y) / 40;
    }
  });
  const o = visual.outline;
  // Hydraulic lock welded to the hull side, where the deployed pole passes above the waterline.
  const lockY = 1.2;
  return (
    <group name={`equipment:${SN_ID}`} {...handlers}>
      <group position={POLE_PIVOT}>
        <EqMesh geometry={g.bracket} material={mats.mount} outline={o} position={[0.55, 0, 0]} name="pivot-mount" />
        <EqMesh geometry={g.hinge} material={mats.pole} outline={o} name="pivot" />
        <group ref={swing}>
          {Array.from({ length: POLE_8097.sections.value }, (_, i) => (
            <group key={i} position={[0, 0, -(i + 0.5) * sec]}>
              <EqMesh geometry={g.section} material={mats.pole} outline={o} name={`pole-section-${i + 1}`} />
              <EqMesh geometry={g.flange} material={mats.pole} outline={o} position={[0, 0, sec / 2 - 0.03]} />
              {i > 0 &&
                Array.from({ length: 10 }, (_, k) => {
                  // Helical vortex-suppression strakes, three starts.
                  const z = -sec / 2 + 0.25 + (k / 10) * (sec - 0.5);
                  return [0, 1, 2].map((st) => {
                    const a = (st * 2 * Math.PI) / 3 + (k / 10) * Math.PI * 2;
                    return (
                      <mesh
                        key={`${k}-${st}`}
                        geometry={g.strake}
                        material={mats.strake}
                        position={[Math.cos(a) * (D / 2 + 0.04), Math.sin(a) * (D / 2 + 0.04), z]}
                        rotation={[0, 0, a]}
                      />
                    );
                  });
                })}
            </group>
          ))}
          <group position={[0, 0, -L]} name="sprint-nav-dp">
            <EqMesh geometry={g.adaptor} material={mats.pole} outline={o} position={[0, 0, 0.06]} />
            <EqMesh geometry={g.body} material={mats.ti} outline={o} position={[0, 0, -(SPRINTNAV.height.value - 0.06) / 2]} name="sprint-nav-housing" />
            <EqMesh geometry={g.dvlHead} material={mats.dvl} outline={o} position={[0, 0, -SPRINTNAV.height.value + 0.03]} name="dvl-head" />
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} geometry={g.transducer} material={mats.ti} position={[Math.cos((k * Math.PI) / 2) * 0.06, Math.sin((k * Math.PI) / 2) * 0.06, -SPRINTNAV.height.value - 0.005]} />
            ))}
          </group>
        </group>
      </group>
      <group position={[POLE_PIVOT[0], lockY, POLE_PIVOT[2]]} name="hydraulic-lock">
        <EqMesh geometry={g.lockPlate} material={mats.mount} outline={o} position={[0.6, 0, 0]} />
        <mesh ref={jawL} geometry={g.jaw} material={mats.mount} position={[-0.4, 0, 0]} />
        <mesh ref={jawR} geometry={g.jaw} material={mats.mount} position={[0.4, 0, 0]} />
      </group>
      <group ref={beams} visible={false}>
        <primitive object={beamLines} />
      </group>
    </group>
  );
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
    const responder = new THREE.MeshStandardMaterial({ color: '#c62828', metalness: 0.3, roughness: 0.4, emissive: '#5a0b0b', emissiveIntensity: 0.4 });
    const reflector = new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: 0.9, roughness: 0.1 });
    const weight = new THREE.MeshStandardMaterial({ color: '#2b2f33', metalness: 0.7, roughness: 0.4 });
    const wire = new THREE.LineBasicMaterial({ color: '#e8ecef' });
    const radar = new THREE.LineDashedMaterial({ color: '#f2c94c', dashSize: 1.2, gapSize: 0.8, toneMapped: false, transparent: true, opacity: 0.8 });
    const laser = new THREE.LineBasicMaterial({ color: '#ff3b3b', toneMapped: false, transparent: true, opacity: 0.85 });
    const legH = PLATFORM.deckY - SCENE_SEABED_Y;
    const geo = {
      leg: new THREE.CylinderGeometry(0.6, 0.8, legH, radial),
      brace: new THREE.CylinderGeometry(0.18, 0.18, PLATFORM.legSpread * Math.SQRT2, 8),
      deck: new THREE.BoxGeometry(PLATFORM.legSpread + 6, 1.2, PLATFORM.legSpread + 6),
      module: new THREE.BoxGeometry(PLATFORM.legSpread, 5, PLATFORM.legSpread * 0.6),
      responder: new THREE.CylinderGeometry(0.18, 0.18, 0.7, 12),
      reflector: new THREE.CylinderGeometry(0.25, 0.25, 1.2, 16),
      weight: new THREE.CylinderGeometry(SMT_TW.weightDiameter.value / 2, SMT_TW.weightDiameter.value / 2, SMT_TW.weightHeight.value, radial),
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
      : [head[0], head[1] - 0.35 - hw / 2 - s.tautwire.payout, head[2]];
    if (weight.current) weight.current.position.set(...w);
    setLine(res.lines.tw, [head[0], head[1] - 0.12, head[2]], [w[0], w[1] + hw / 2, w[2]]);
    res.lines.tw.visible = s.tautwire.phase !== 'stowed';
    const ready = posRefReadiness(s, posRefs.getPose());
    res.lines.radar.visible = ready.RADASCAN;
    if (ready.RADASCAN) setLine(res.lines.radar, toWorld([RADASCAN_POS[0], RADASCAN_POS[1] + RADASCAN.pedestalHeight.value + RADASCAN.height.value / 2, RADASCAN_POS[2]], eta), RESPONDER_WORLD);
    res.lines.laser.visible = ready.CYSCAN;
    if (ready.CYSCAN) setLine(res.lines.laser, toWorld([CYSCAN_POS[0], CYSCAN_POS[1] + 0.4 + CYSCAN.headHeight.value * 0.62, CYSCAN_POS[2]], eta), REFLECTOR_WORLD);
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
      <mesh geometry={res.geo.responder} material={res.mats.responder} position={RESPONDER_WORLD} name="radascan-responder" />
      <mesh geometry={res.geo.reflector} material={res.mats.reflector} position={REFLECTOR_WORLD} name="cyscan-reflector" />
      <mesh ref={weight} geometry={res.geo.weight} material={res.mats.weight} name="taut-wire-depressor-weight" />
      <primitive object={res.lines.tw} />
      <primitive object={res.lines.radar} />
      <primitive object={res.lines.laser} />
    </group>
  );
}
