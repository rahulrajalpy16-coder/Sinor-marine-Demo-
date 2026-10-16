import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hullHalfWidthAt } from '../vessels/hullGeometry';
import { getEquipment } from './registry';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';
import { bowThruster } from '../simulations/controller';
import { DEFAULT_THRUSTER_PARAMS } from '../simulations/thruster';
import { useAppStore } from '../store/useAppStore';
import { MODE_STYLES } from '../rendering/modes';
import { CYAN } from '../rendering/materials';
import { readableInWorld } from '../scene/vesselTransform';

const ID = 'bow-thruster-001';
const JET_PARTICLES = 90;
const P = DEFAULT_THRUSTER_PARAMS;
const MAX_BLADE = THREE.MathUtils.degToRad(P.maxBladeAngleDeg);

/** Skewed CPP blade outline in the (chord, radius) plane, extruded thin along the shaft axis. */
function makeBlade(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.16, 0.36);
  s.bezierCurveTo(-0.3, 0.55, -0.32, 0.82, -0.12, 0.97);
  s.bezierCurveTo(0.02, 1.02, 0.16, 0.96, 0.24, 0.82);
  s.bezierCurveTo(0.3, 0.62, 0.26, 0.48, 0.16, 0.36);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 10 });
  // Shape lies in XY (chord along X, radius along Y); turn the chord to Z so the blade sits in the disc plane.
  g.translate(0, 0, -0.025);
  g.rotateY(Math.PI / 2);
  return g;
}

/** Static nameplate for the Z-Thrust local control cabinet. */
function makeCabinetScreen(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#0b2a3d';
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#dce8f0';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Z-THRUST', 14, 28);
  ctx.font = '12px sans-serif';
  ctx.fillText('CPP CONTROL · BT1', 14, 46);
  ctx.strokeStyle = '#3fd16b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(70, 112, 34, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#e04444';
  ctx.beginPath();
  ctx.arc(186, 112, 34, Math.PI, Math.PI * 1.5);
  ctx.stroke();
  ctx.strokeStyle = '#3fd16b';
  ctx.beginPath();
  ctx.arc(186, 112, 34, Math.PI * 1.5, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9fb3c2';
  ctx.fillText('RPM', 58, 140);
  ctx.fillText('PITCH', 168, 140);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  readableInWorld(tex);
  return tex;
}

/**
 * P2 standard bow thruster: fixed transverse tunnel with a controllable-pitch propeller on a
 * right-angle gear pod, vertical constant-speed electric motor, hydraulic power unit and a
 * Z-Thrust local control cabinet. Blade pitch, shaft rotation and the force arrow follow the simulation.
 */
export function BowThruster() {
  const eq = getEquipment(ID)!;
  const [, ty, tz] = eq.placement.target;
  const half = useMemo(() => hullHalfWidthAt(tz, ty) + 0.15, [tz, ty]);
  const handlers = useSelectable(ID);
  const { mats, visual } = useEquipmentMaterials(ID, {
    tunnel: { color: '#56616b', metalness: 0.7, roughness: 0.4 },
    bronze: { color: '#b08a4a', metalness: 0.9, roughness: 0.25 },
    unit: { color: '#b3261e', metalness: 0.45, roughness: 0.45 },
    motor: { color: '#2f6f8f', metalness: 0.5, roughness: 0.4 },
    steel: { color: '#8b96a0', metalness: 0.8, roughness: 0.3 },
    hpu: { color: '#c9a227', metalness: 0.4, roughness: 0.5 },
    cabinet: { color: '#c9ced3', metalness: 0.3, roughness: 0.55 },
  });
  const explode = useAppStore((s) => MODE_STYLES[s.visualMode].explode && s.selectedId === ID);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  const g = useMemo(() => {
    const strut = new THREE.CylinderGeometry(0.22, 0.22, 1.05, 16);
    strut.scale(1, 1, 1.9);
    return {
      tunnel: new THREE.CylinderGeometry(1.05, 1.05, half * 2, 32, 1, true).rotateZ(Math.PI / 2),
      rim: new THREE.TorusGeometry(1.08, 0.1, 8, 32).rotateY(Math.PI / 2),
      pod: new THREE.CapsuleGeometry(0.36, 1.0, 6, 20).rotateZ(Math.PI / 2),
      strut,
      hub: new THREE.SphereGeometry(0.4, 24, 16).scale(1.15, 1, 1),
      cone: new THREE.ConeGeometry(0.3, 0.5, 20).rotateZ(-Math.PI / 2),
      blade: makeBlade(),
      flange: new THREE.CylinderGeometry(0.85, 0.85, 0.16, 28),
      shaft: new THREE.CylinderGeometry(0.13, 0.13, 1.7, 10),
      coupling: new THREE.CylinderGeometry(0.3, 0.3, 0.35, 16),
      motor: new THREE.CylinderGeometry(0.72, 0.72, 1.7, 28),
      fan: new THREE.CylinderGeometry(0.62, 0.72, 0.4, 28),
      terminal: new THREE.BoxGeometry(0.4, 0.45, 0.3),
      hpuTank: new THREE.BoxGeometry(0.9, 0.7, 0.6),
      hpuPump: new THREE.CylinderGeometry(0.16, 0.16, 0.45, 12),
      pipe: new THREE.CylinderGeometry(0.04, 0.04, 1, 8),
      cabinet: new THREE.BoxGeometry(1.0, 1.9, 0.5),
      screen: new THREE.PlaneGeometry(0.62, 0.39),
    };
  }, [half]);
  (mats.tunnel as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

  const screenMat = useMemo(() => {
    const tex = makeCabinetScreen();
    return new THREE.MeshBasicMaterial({ map: tex ?? undefined, color: tex ? '#ffffff' : '#0b2a3d', toneMapped: false });
  }, []);

  const prop = useRef<THREE.Group>(null);
  const blades = useRef<(THREE.Group | null)[]>([]);
  const propGroup = useRef<THREE.Group>(null);
  const shaftGroup = useRef<THREE.Group>(null);
  const motorGroup = useRef<THREE.Group>(null);
  const auxGroup = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Group>(null);
  const jet = useRef<THREE.Points>(null);

  const jetGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(JET_PARTICLES * 3), 3));
    return geo;
  }, []);
  const seeds = useMemo(() => Array.from({ length: JET_PARTICLES }, (_, i) => [((i * 0.6180339) % 1), Math.random(), Math.random()]), []);
  const arrowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false }), []);
  const jetMat = useMemo(
    () => new THREE.PointsMaterial({ color: '#9befff', size: 0.22, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(g).forEach((x) => x.dispose());
      jetGeo.dispose();
      arrowMat.dispose();
      jetMat.dispose();
      screenMat.map?.dispose();
      screenMat.dispose();
    },
    [g, jetGeo, arrowMat, jetMat, screenMat],
  );

  useFrame((_, dt) => {
    const s = bowThruster.getState();
    if (prop.current) prop.current.rotation.x = s.angle;
    for (const b of blades.current) if (b) b.rotation.y = s.pitch * MAX_BLADE;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
    const ex = explode ? 1 : 0;
    if (propGroup.current) propGroup.current.position.x += (ex * (half + 2.2) - propGroup.current.position.x) * k;
    if (shaftGroup.current) shaftGroup.current.position.y += (ex * 2.0 - shaftGroup.current.position.y) * k;
    if (motorGroup.current) motorGroup.current.position.y += (ex * 4.2 - motorGroup.current.position.y) * k;
    if (auxGroup.current) auxGroup.current.position.z += (ex * -2.5 - auxGroup.current.position.z) * k;

    const f = s.thrustKN / P.maxThrustKN;
    if (arrow.current) {
      const on = Math.abs(s.thrustKN) > 0.3;
      arrow.current.visible = on;
      const len = 1.5 + 9 * Math.abs(f);
      const dir = Math.sign(f) || 1;
      arrow.current.position.set(dir * (half + 0.4), 0, 0);
      arrow.current.scale.set(dir * len, 1.6, 1.6);
    }
    if (jet.current) {
      jet.current.visible = Math.abs(f) > 0.01;
      const arr = jetGeo.attributes.position.array as Float32Array;
      const out = -(Math.sign(f) || 1); // water leaves opposite to the force on the hull
      const speed = Math.sqrt(Math.abs(f));
      const t = s.time;
      for (let i = 0; i < JET_PARTICLES; i++) {
        const [phase, a, b] = seeds[i];
        const life = (phase + t * (0.5 + 1.2 * speed)) % 1;
        const r = 0.9 * life * speed + 0.15;
        arr[i * 3] = out * (half + life * 7 * speed);
        arr[i * 3 + 1] = Math.cos(a * 6.283) * r * (0.4 + 0.6 * b);
        arr[i * 3 + 2] = Math.sin(a * 6.283) * r * (0.4 + 0.6 * b);
      }
      jetGeo.attributes.position.needsUpdate = true;
    }
  });

  const o = visual.outline;
  return (
    <group name={`equipment:${ID}`} position={[0, ty, tz]} {...handlers}>
      <EqMesh geometry={g.tunnel} material={mats.tunnel} outline={o} name="tunnel" />
      <EqMesh geometry={g.rim} material={mats.steel} outline={o} position={[half, 0, 0]} />
      <EqMesh geometry={g.rim} material={mats.steel} outline={o} position={[-half, 0, 0]} />
      <group ref={propGroup}>
        <group position={[0.55, 0, 0]}>
          <group ref={prop} name="cpp-propeller">
            <EqMesh geometry={g.hub} material={mats.bronze} outline={o} name="cpp-hub" />
            <EqMesh geometry={g.cone} material={mats.bronze} outline={o} position={[0.62, 0, 0]} />
            {Array.from({ length: P.blades }, (_, i) => (
              <group key={i} rotation={[(i * Math.PI * 2) / P.blades, 0, 0]}>
                <group
                  ref={(el) => {
                    blades.current[i] = el;
                  }}
                  name={`blade-${i + 1}`}
                >
                  <EqMesh geometry={g.blade} material={mats.bronze} outline={o} />
                </group>
              </group>
            ))}
          </group>
        </group>
      </group>
      <group ref={shaftGroup} name="gear-pod-and-shaft">
        <EqMesh geometry={g.pod} material={mats.unit} outline={o} position={[-0.35, 0, 0]} name="gear-pod" />
        <EqMesh geometry={g.strut} material={mats.unit} outline={o} position={[-0.35, 0.55, 0]} />
        <EqMesh geometry={g.flange} material={mats.unit} outline={o} position={[-0.35, 1.18, 0]} />
        <EqMesh geometry={g.shaft} material={mats.steel} outline={o} position={[-0.35, 2.05, 0]} />
        <EqMesh geometry={g.coupling} material={mats.steel} outline={o} position={[-0.35, 2.85, 0]} />
      </group>
      <group ref={motorGroup} name="motor">
        <EqMesh geometry={g.motor} material={mats.motor} outline={o} position={[-0.35, 3.9, 0]} />
        <EqMesh geometry={g.fan} material={mats.motor} outline={o} position={[-0.35, 4.95, 0]} />
        <EqMesh geometry={g.terminal} material={mats.motor} outline={o} position={[-0.35, 4.0, 0.85]} />
      </group>
      <group ref={auxGroup} name="hpu-and-control">
        <group position={[-1.9, 1.75, -0.6]} name="hydraulic-power-unit">
          <EqMesh geometry={g.hpuTank} material={mats.hpu} outline={o} />
          <EqMesh geometry={g.hpuPump} material={mats.motor} outline={o} position={[0.2, 0.55, 0]} />
          <mesh geometry={g.pipe} material={mats.steel} position={[0.75, -0.2, 0.6]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1.2, 1]} />
          <mesh geometry={g.pipe} material={mats.steel} position={[1.35, -0.7, 0.6]} scale={[1, 1.0, 1]} />
        </group>
        <group position={[1.9, 2.15, -0.9]} name="z-thrust-local-cabinet">
          <EqMesh geometry={g.cabinet} material={mats.cabinet} outline={o} />
          <mesh geometry={g.screen} material={screenMat} position={[0, 0.45, 0.26]} />
        </group>
      </group>
      <group ref={arrow} visible={false} name="force-vector">
        <mesh material={arrowMat} position={[0.42, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.84, 10]} />
        </mesh>
        <mesh material={arrowMat} position={[0.92, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.22, 0.16, 16]} />
        </mesh>
      </group>
      <points ref={jet} geometry={jetGeo} material={jetMat} visible={false} />
    </group>
  );
}
