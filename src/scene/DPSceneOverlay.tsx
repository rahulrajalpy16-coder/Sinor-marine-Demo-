import { BOW_THRUSTERS, LEVEL, MAST } from '../vessels/vesselLayout';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { dpSystem } from '../simulations/dpController';
import { useControllerState } from '../simulations/useController';
import { classLayout, DEFAULT_DP_PARAMS } from '../simulations/dp';
import { useAppStore } from '../store/useAppStore';
import { DP_BACKUP_ROOM, DP_STATION } from '../equipment/DPConsole';

/** Setpoint marker on the sea surface (scene frame, not moving with the vessel). */
export function DPSetpointMarker() {
  const dp = useControllerState(dpSystem);
  const ring = useMemo(() => new THREE.RingGeometry(3.2, 3.6, 48).rotateX(-Math.PI / 2), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f2c94c', transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }), []);
  useEffect(
    () => () => {
      ring.dispose();
      mat.dispose();
    },
    [ring, mat],
  );
  if (dp.status === 'stopped' || dp.mode !== 'AUTO_POSITION') return null;
  const [n, e, psi] = dp.setpoint;
  const tip: [number, number, number] = [e + Math.sin(psi) * 12, 0.25, n + Math.cos(psi) * 12];
  return (
    <group name="dp-setpoint">
      <mesh geometry={ring} material={mat} position={[e, 0.2, n]} renderOrder={5} />
      <Line points={[[e, 0.25, n], tip]} color="#f2c94c" lineWidth={2} dashed dashSize={1} gapSize={0.6} />
    </group>
  );
}

/** Second P2 bow tunnel thruster (DP-only twin of BT1), in vessel coordinates. */
export function BT2Tunnel() {
  const geo = useMemo(() => new THREE.CylinderGeometry(1.05, 1.05, 10.3, 28, 1, true).rotateZ(Math.PI / 2), []);
  const rim = useMemo(() => new THREE.TorusGeometry(1.08, 0.1, 8, 28).rotateY(Math.PI / 2), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#56616b', metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }), []);
  const arrowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#00D9FF', toneMapped: false }), []);
  const arrow = useRef<THREE.Group>(null);
  useEffect(
    () => () => {
      geo.dispose();
      rim.dispose();
      mat.dispose();
      arrowMat.dispose();
    },
    [geo, rim, mat, arrowMat],
  );
  useFrame(() => {
    const t = dpSystem.getState().thrusters.find((x) => x.id === 'BT2');
    if (!arrow.current || !t) return;
    const f = t.forceN / DEFAULT_DP_PARAMS.thrusters[1].maxN;
    arrow.current.visible = Math.abs(f) > 0.02;
    const dir = Math.sign(f) || 1;
    arrow.current.position.set(dir * 5.6, 0, 0);
    arrow.current.scale.set(dir * (1.5 + 9 * Math.abs(f)), 1.6, 1.6);
  });
  return (
    <group name="bt2-tunnel" position={[0, BOW_THRUSTERS.y, BOW_THRUSTERS.bt2Z]}>
      <mesh geometry={geo} material={mat} />
      <mesh geometry={rim} material={mat} position={[5.15, 0, 0]} />
      <mesh geometry={rim} material={mat} position={[-5.15, 0, 0]} />
      <group ref={arrow} visible={false}>
        <mesh material={arrowMat} position={[0.42, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.84, 10]} />
        </mesh>
        <mesh material={arrowMat} position={[0.92, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.22, 0.16, 16]} />
        </mesh>
      </group>
    </group>
  );
}

type V3 = [number, number, number];
/** IO units after the distributed architecture: one near each thruster, reference system and sensor group. */
const IO_UNITS: { id: string; label: string; pos: V3 }[] = [
  { id: 'io-bt1', label: 'IO · BT1', pos: [1.6, 1.2, BOW_THRUSTERS.bt1Z] },
  { id: 'io-bt2', label: 'IO · BT2', pos: [-1.6, 1.2, BOW_THRUSTERS.bt2Z] },
  { id: 'io-az', label: 'IO · AZ1/AZ2', pos: [0, 1.5, -33] },
  { id: 'io-sensors', label: 'IO · Gyro/MRU/Wind', pos: [0, LEVEL.roof + 0.6, MAST.z + 1.5] },
  { id: 'io-gnss', label: 'GNSS 1/2', pos: [0, MAST.yard + 0.8, MAST.z] },
  { id: 'io-hpr', label: 'IO · HPR', pos: [1.4, 1.2, 12] },
  { id: 'io-power', label: 'IO · Power plant/UPS', pos: [0, 3.2, 0] },
];

/** 3D overlay of the DP network: controllers, operator stations, IO units, single or dual network. */
export function DPNetworkOverlay() {
  const on = useAppStore((s) => s.dpNetwork);
  const dp = useControllerState(dpSystem);
  if (!on) return null;
  const lay = classLayout(dp.dpClass);
  const hub: V3 = [DP_STATION[0] + 2.4, DP_STATION[1] + 2.2, DP_STATION[2]];
  const nets = dp.networks.filter((n) => n.installed);
  const route = (to: V3, off: number): V3[] => [
    [hub[0] + off, hub[1], hub[2]],
    [hub[0] + off, hub[1], to[2]],
    [to[0] + off, to[1], to[2]],
  ];
  const backup: V3 = [(DP_BACKUP_ROOM.min[0] + DP_BACKUP_ROOM.max[0]) / 2, DP_BACKUP_ROOM.min[1] + 1.5, (DP_BACKUP_ROOM.min[2] + DP_BACKUP_ROOM.max[2]) / 2];
  return (
    <group name="dp-network-overlay">
      {nets.map((n, k) => {
        const off = k * 0.35;
        const color = n.failed ? '#e04444' : k === 0 ? '#00D9FF' : '#f2c94c';
        return (
          <group key={n.id}>
            {IO_UNITS.map((u) => (
              <Line key={u.id} points={route(u.pos, off)} color={color} lineWidth={1.5} transparent opacity={n.failed ? 0.5 : 0.9} dashed={n.failed} depthTest={false} />
            ))}
            {lay.backupStation && <Line points={route(backup, off)} color={color} lineWidth={1.5} depthTest={false} />}
          </group>
        );
      })}
      {IO_UNITS.map((u) => (
        <group key={u.id} position={u.pos}>
          <mesh>
            <boxGeometry args={[0.6, 0.4, 0.3]} />
            <meshBasicMaterial color="#5fc8ff" toneMapped={false} />
          </mesh>
          <Html center position={[0, 0.7, 0]} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
            <span className="whitespace-nowrap rounded-sm border border-cyan/40 bg-abyss/80 px-1 font-mono text-[9px] text-cyan-light">{u.label}</span>
          </Html>
        </group>
      ))}
      <Html center position={[hub[0], hub[1] + 0.8, hub[2]]} zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
        <span className="whitespace-nowrap rounded-sm border border-amber-300/60 bg-abyss/85 px-1 font-mono text-[9px] text-amber-200">
          DP{dp.dpClass}: {lay.controllers} ctrl · {lay.networks === 2 ? 'net A+B' : 'net A'}
        </span>
      </Html>
    </group>
  );
}
