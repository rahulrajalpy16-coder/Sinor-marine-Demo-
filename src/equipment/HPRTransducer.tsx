import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getEquipment } from './registry';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';
import { useAppStore } from '../store/useAppStore';
import { pingProgress, SEABED_Y, TRANSPONDER } from '../simulations/acoustic';
import { CYAN } from '../rendering/materials';

const ID = 'hpr-001';

/** Hull-mounted hydroacoustic transducer on a pole below the keel, with an optional seabed signal path. */
export function HPRTransducer() {
  const eq = getEquipment(ID)!;
  const [, ty, tz] = eq.placement.target;
  const handlers = useSelectable(ID);
  const { mats, visual } = useEquipmentMaterials(ID, {
    trunk: { color: '#5a6672', metalness: 0.7, roughness: 0.4 },
    head: { color: '#d8c35a', metalness: 0.4, roughness: 0.35 },
    pole: { color: '#a3adb7', metalness: 0.8, roughness: 0.25 },
  });
  const geo = useMemo(
    () => ({
      trunk: new THREE.CylinderGeometry(0.55, 0.55, 1.8, 20),
      valve: new THREE.BoxGeometry(1.5, 0.5, 1.5),
      pole: new THREE.CylinderGeometry(0.16, 0.16, 2.6, 12),
      head: new THREE.SphereGeometry(0.42, 20, 14),
      skirt: new THREE.CylinderGeometry(0.42, 0.25, 0.4, 20),
    }),
    [],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const o = visual.outline;
  return (
    <group name={`equipment:${ID}`} {...handlers}>
      <group position={[0, ty, tz]}>
        <EqMesh geometry={geo.trunk} material={mats.trunk} outline={o} position={[0, 2.4, 0]} />
        <EqMesh geometry={geo.valve} material={mats.trunk} outline={o} position={[0, 3.4, 0]} />
        <EqMesh geometry={geo.pole} material={mats.pole} outline={o} position={[0, 1.1, 0]} />
        <EqMesh geometry={geo.skirt} material={mats.head} outline={o} position={[0, 0.25, 0]} />
        <EqMesh geometry={geo.head} material={mats.head} outline={o} />
      </group>
      <AcousticSignals origin={[0, ty, tz]} />
    </group>
  );
}

function AcousticSignals({ origin }: { origin: [number, number, number] }) {
  const enabled = useAppStore((s) => s.hprSignals);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const ping = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const a = useMemo(() => new THREE.Vector3(...origin), [origin]);
  const b = useMemo(() => new THREE.Vector3(...TRANSPONDER), []);
  const res = useMemo(() => {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const lineMat = new THREE.LineDashedMaterial({ color: CYAN, dashSize: 0.8, gapSize: 0.5, toneMapped: false, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    const glow = new THREE.MeshBasicMaterial({ color: '#b6f7ff', toneMapped: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
    const seabedMat = new THREE.MeshBasicMaterial({ color: '#0b3346', wireframe: true, transparent: true, opacity: 0.35 });
    return { line, lineGeo, lineMat, glow, ringMat, seabedMat };
  }, [a, b]);
  useEffect(
    () => () => {
      res.lineGeo.dispose();
      res.lineMat.dispose();
      res.glow.dispose();
      res.ringMat.dispose();
      res.seabedMat.dispose();
    },
    [res],
  );
  useFrame((_, dt) => {
    if (!enabled) return;
    t.current += reducedMotion ? dt * 0.25 : dt;
    // Visual cycle is slowed for legibility; the inspector reports the physical round-trip time.
    const { along } = pingProgress(t.current / 3);
    ping.current?.position.lerpVectors(a, b, along);
    if (ring.current) {
      const r = (t.current % 1.5) / 1.5;
      ring.current.scale.setScalar(0.5 + r * 7);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - r);
    }
  });
  if (!enabled) return null;
  return (
    <group name="hpr-signals">
      <primitive object={res.line} />
      <mesh ref={ping} material={res.glow}>
        <sphereGeometry args={[0.35, 12, 8]} />
      </mesh>
      <mesh ref={ring} material={res.ringMat} position={[origin[0], origin[1] - 0.6, origin[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 48]} />
      </mesh>
      <group position={TRANSPONDER}>
        <mesh material={res.glow}>
          <cylinderGeometry args={[0.35, 0.5, 2.4, 12]} />
        </mesh>
      </group>
      <mesh position={[TRANSPONDER[0], SEABED_Y, TRANSPONDER[2]]} rotation={[-Math.PI / 2, 0, 0]} material={res.seabedMat}>
        <planeGeometry args={[80, 80, 20, 20]} />
      </mesh>
    </group>
  );
}
