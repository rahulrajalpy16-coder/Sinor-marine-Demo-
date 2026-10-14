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

const ID = 'bow-thruster-001';
const JET_PARTICLES = 90;

/** Fixed transverse tunnel thruster. Propeller speed and force arrow are driven by the thruster simulation. */
export function BowThruster() {
  const eq = getEquipment(ID)!;
  const [, ty, tz] = eq.placement.target;
  const half = useMemo(() => hullHalfWidthAt(tz, ty) + 0.15, [tz, ty]);
  const handlers = useSelectable(ID);
  const { mats, visual } = useEquipmentMaterials(ID, {
    tunnel: { color: '#56616b', metalness: 0.7, roughness: 0.4 },
    bronze: { color: '#b08a4a', metalness: 0.9, roughness: 0.25 },
    motor: { color: '#2f6f8f', metalness: 0.5, roughness: 0.4 },
    steel: { color: '#8b96a0', metalness: 0.8, roughness: 0.3 },
  });
  const explode = useAppStore((s) => MODE_STYLES[s.visualMode].explode && s.selectedId === ID);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  const g = useMemo(() => {
    const blade = new THREE.BoxGeometry(0.07, 0.82, 0.42);
    blade.translate(0, 0.55, 0);
    return {
      tunnel: new THREE.CylinderGeometry(1.05, 1.05, half * 2, 32, 1, true).rotateZ(Math.PI / 2),
      rim: new THREE.TorusGeometry(1.08, 0.1, 8, 32).rotateY(Math.PI / 2),
      hub: new THREE.CylinderGeometry(0.3, 0.3, 0.8, 18).rotateZ(Math.PI / 2),
      blade,
      shaft: new THREE.CylinderGeometry(0.13, 0.13, 2.4, 10),
      gearbox: new THREE.BoxGeometry(0.75, 0.6, 0.75),
      motor: new THREE.CylinderGeometry(0.7, 0.7, 1.8, 24),
      grate: new THREE.CircleGeometry(1.0, 32).rotateY(Math.PI / 2),
    };
  }, [half]);
  (mats.tunnel as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

  const prop = useRef<THREE.Group>(null);
  const propGroup = useRef<THREE.Group>(null);
  const shaftGroup = useRef<THREE.Group>(null);
  const motorGroup = useRef<THREE.Group>(null);
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
    },
    [g, jetGeo, arrowMat, jetMat],
  );

  useFrame((_, dt) => {
    const s = bowThruster.getState();
    if (prop.current) prop.current.rotation.x = s.angle;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
    const ex = explode ? 1 : 0;
    if (propGroup.current) propGroup.current.position.x += (ex * (half + 2.2) - propGroup.current.position.x) * k;
    if (shaftGroup.current) shaftGroup.current.position.y += (ex * 2.0 - shaftGroup.current.position.y) * k;
    if (motorGroup.current) motorGroup.current.position.y += (ex * 4.2 - motorGroup.current.position.y) * k;

    const f = s.thrustKN / DEFAULT_THRUSTER_PARAMS.maxThrustKN;
    if (arrow.current) {
      const on = Math.abs(s.thrustKN) > 0.3;
      arrow.current.visible = on;
      const len = 1.5 + 9 * Math.abs(f);
      const dir = Math.sign(f) || 1;
      arrow.current.position.set(dir * (half + 0.4), 0, 0);
      arrow.current.scale.set(dir * len, 1.6, 1.6);
    }
    if (jet.current) {
      const rpmFrac = s.rpm / DEFAULT_THRUSTER_PARAMS.maxRpm;
      jet.current.visible = Math.abs(rpmFrac) > 0.03;
      const arr = jetGeo.attributes.position.array as Float32Array;
      const out = -(Math.sign(rpmFrac) || 1); // water leaves opposite to the force on the hull
      const speed = Math.abs(rpmFrac);
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
        <group ref={prop} name="propeller">
          <EqMesh geometry={g.hub} material={mats.bronze} outline={o} />
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[(i * Math.PI) / 2, 0, 0]}>
              <EqMesh geometry={g.blade} material={mats.bronze} outline={o} rotation={[0, 0.5, 0]} />
            </group>
          ))}
        </group>
      </group>
      <group ref={shaftGroup} name="gear-and-shaft">
        <EqMesh geometry={g.gearbox} material={mats.steel} outline={o} position={[0, 0.45, 0]} />
        <EqMesh geometry={g.shaft} material={mats.steel} outline={o} position={[0, 1.9, 0]} />
      </group>
      <group ref={motorGroup} name="motor">
        <EqMesh geometry={g.motor} material={mats.motor} outline={o} position={[0, 3.9, 0]} />
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
