import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';
import { powerSystem } from '../simulations/powerController';
import { windSystem } from '../simulations/powerController';
import { dpSystem } from '../simulations/dpController';
import { WIND_ARM, WIND_CONFIG } from '../simulations/wind';
import type { GenId, PowerState } from '../simulations/power';
import { LEVEL, MAST } from '../vessels/vesselLayout';

/**
 * Representative 3D models of the electrical plant and the heading/wind sensors, placed in the spaces a DP2 OSV
 * normally gives them (engine room, switchboard room, emergency generator room, separated UPS rooms, gyro room,
 * mast). Sizes are typical for the provisional ratings in power.ts, not taken from a maker's drawing.
 * Every model carries status lamps driven from the shared simulation state each frame (no React re-render).
 */

export const ENGINE_ROOM = { floorY: -3.8, z0: -28, z1: -13.5, x: 4.5 } as const;
export const GENSET_Z: Record<'G1' | 'G2' | 'G3' | 'G4', [number, number]> = { G1: [-ENGINE_ROOM.x, -24.5], G2: [-ENGINE_ROOM.x, -16.8], G3: [ENGINE_ROOM.x, -24.5], G4: [ENGINE_ROOM.x, -16.8] };
export const MSB_ROOM = { floorY: -1.5, z: -8.6 } as const;
export const EG_ROOM = { x: -6.0, z: 6.6, floorY: LEVEL.upper } as const;
export const UPS_ROOMS = { z: 9, x: 2.6, floorY: LEVEL.officers } as const;
export const GYRO_ROOM = { z: 12.6, floorY: LEVEL.officers } as const;
export const MRU_POS: [number, number, number][] = [
  [-0.8, -3.8, 1.0],
  [0.8, -3.8, 1.0],
];

const LAMP = { green: new THREE.Color('#3fd16b'), amber: new THREE.Color('#f2b01e'), red: new THREE.Color('#ff3b3b'), off: new THREE.Color('#2a3138'), blue: new THREE.Color('#5fc8ff') };
type LampColor = keyof typeof LAMP;

function useDisposeAll(g: Record<string, { dispose(): void }>) {
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
}

/** A set of unlit status-lamp materials updated every frame from `pick`. */
function useLamps(n: number, pick: (i: number) => LampColor, blinkAlarm = true) {
  const mats = useMemo(() => Array.from({ length: n }, () => new THREE.MeshBasicMaterial({ color: LAMP.off, toneMapped: false })), [n]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    const blinkOn = Math.floor(t.current * 2) % 2 === 0;
    mats.forEach((m, i) => {
      const c = pick(i);
      m.color.copy(c === 'red' && blinkAlarm && !blinkOn ? LAMP.off : LAMP[c]);
    });
  });
  return mats;
}

const genLamp = (s: PowerState, id: GenId): LampColor => {
  const g = s.gens.find((x) => x.id === id)!;
  return g.state === 'tripped' ? 'red' : g.state === 'online' ? 'green' : g.state === 'stopped' ? 'off' : 'amber';
};

// ------------------------------------------------------------------------------------------- gensets

/** One medium-speed diesel generator set on a common skid: V-engine, turbocharger, alternator, local panel. */
function Genset({ id, mats, lamp, o }: { id: GenId; mats: Record<string, THREE.Material>; lamp: THREE.Material; o: boolean }) {
  const g = useMemo(() => {
    const cyl = new THREE.CylinderGeometry(0.85, 0.85, 1.7, 24).rotateX(Math.PI / 2);
    return {
      skid: new THREE.BoxGeometry(1.9, 0.3, 7.0),
      block: new THREE.BoxGeometry(1.5, 1.4, 4.2),
      heads: new THREE.BoxGeometry(0.42, 0.32, 3.9),
      turbo: new THREE.CylinderGeometry(0.42, 0.42, 0.9, 20).rotateZ(Math.PI / 2),
      exhaust: new THREE.CylinderGeometry(0.22, 0.22, 2.6, 12),
      alternator: cyl,
      altBase: new THREE.BoxGeometry(1.7, 0.4, 1.8),
      terminal: new THREE.BoxGeometry(0.6, 0.6, 0.7),
      panel: new THREE.BoxGeometry(0.6, 1.1, 0.25),
      lamp: new THREE.SphereGeometry(0.07, 10, 8),
      cooler: new THREE.BoxGeometry(1.2, 0.8, 0.5),
    };
  }, []);
  useDisposeAll(g);
  const [x, z] = GENSET_Z[id as 'G1'];
  const y = ENGINE_ROOM.floorY;
  // Alternator forward, engine aft; the local panel faces the centreline walkway.
  const inboard = x < 0 ? 1 : -1;
  return (
    <group position={[x, y, z]} name={`genset:${id}`}>
      <EqMesh geometry={g.skid} material={mats.skid} outline={o} position={[0, 0.15, 0]} name="common-skid" />
      <EqMesh geometry={g.block} material={mats.engine} outline={o} position={[0, 1.0, -1.0]} name="diesel-engine" />
      {[-1, 1].map((k) => (
        <EqMesh key={k} geometry={g.heads} material={mats.heads} outline={o} position={[k * 0.48, 1.86, -1.0]} rotation={[0, 0, k * 0.5]} name="cylinder-heads" />
      ))}
      <EqMesh geometry={g.turbo} material={mats.metal} outline={o} position={[0, 2.0, -3.3]} name="turbocharger" />
      <EqMesh geometry={g.exhaust} material={mats.lagging} outline={o} position={[0, 3.5, -3.3]} name="exhaust-uptake" />
      <EqMesh geometry={g.cooler} material={mats.metal} outline={o} position={[0, 0.7, -3.4]} name="charge-air-cooler" />
      <EqMesh geometry={g.altBase} material={mats.skid} outline={o} position={[0, 0.5, 2.15]} name="alternator-feet" />
      <EqMesh geometry={g.alternator} material={mats.alternator} outline={o} position={[0, 1.4, 2.15]} name="alternator" />
      <EqMesh geometry={g.terminal} material={mats.alternator} outline={o} position={[inboard * 0.6, 2.25, 2.15]} name="terminal-box" />
      <EqMesh geometry={g.panel} material={mats.panel} outline={o} position={[inboard * 1.15, 0.9, 0.6]} rotation={[0, (inboard * Math.PI) / 2, 0]} name="local-control-panel" />
      <mesh geometry={g.lamp} material={lamp} position={[inboard * 1.3, 1.3, 0.6]} name="run-lamp" />
    </group>
  );
}

export function Gensets() {
  const id = 'gensets-001';
  const handlers = useSelectable(id);
  const { mats, visual } = useEquipmentMaterials(id, {
    skid: { color: '#3a4148', metalness: 0.6, roughness: 0.5 },
    engine: { color: '#6f8f6a', metalness: 0.45, roughness: 0.45 },
    heads: { color: '#58745a', metalness: 0.45, roughness: 0.45 },
    metal: { color: '#8a9399', metalness: 0.8, roughness: 0.3 },
    lagging: { color: '#c9c3b4', metalness: 0.2, roughness: 0.8 },
    alternator: { color: '#2f5e8f', metalness: 0.4, roughness: 0.45 },
    panel: { color: '#d8dcdf', metalness: 0.3, roughness: 0.5 },
  });
  const ids: GenId[] = ['G1', 'G2', 'G3', 'G4'];
  const lamps = useLamps(4, (i) => genLamp(powerSystem.getState(), ids[i]));
  const floor = useMemo(() => new THREE.BoxGeometry(ENGINE_ROOM.x * 2 + 4, 0.06, ENGINE_ROOM.z1 - ENGINE_ROOM.z0), []);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#59616a', metalness: 0.5, roughness: 0.7 }), []);
  useEffect(() => () => (floor.dispose(), floorMat.dispose()), [floor, floorMat]);
  return (
    <group name={`equipment:${id}`} {...handlers}>
      <mesh geometry={floor} material={floorMat} position={[0, ENGINE_ROOM.floorY - 0.03, (ENGINE_ROOM.z0 + ENGINE_ROOM.z1) / 2]} name="engine-room-floor-plates" />
      {ids.map((g, i) => (
        <Genset key={g} id={g} mats={mats} lamp={lamps[i]} o={visual.outline} />
      ))}
    </group>
  );
}

// -------------------------------------------------------------------------------- main switchboard

/**
 * Main switchboard 690 V in two sections (MSB-A port, MSB-B starboard) with the bus-tie breaker cubicle between,
 * plus the 440 V boards behind. Each cubicle has a breaker-state lamp; the bus lamps show live/dead.
 */
export function MainSwitchboard() {
  const id = 'msb-001';
  const handlers = useSelectable(id);
  const { mats, visual } = useEquipmentMaterials(id, {
    cubicle: { color: '#c9ced3', metalness: 0.35, roughness: 0.45 },
    plinth: { color: '#3a4148', metalness: 0.5, roughness: 0.5 },
    handle: { color: '#30363b', metalness: 0.7, roughness: 0.35 },
    mimic: { color: '#1f6fbf', metalness: 0.2, roughness: 0.5 },
  });
  const g = useMemo(
    () => ({
      cubicle: new THREE.BoxGeometry(0.78, 2.2, 0.9),
      plinth: new THREE.BoxGeometry(0.8, 0.1, 0.92),
      door: new THREE.PlaneGeometry(0.66, 0.9),
      handle: new THREE.BoxGeometry(0.04, 0.16, 0.04),
      mimic: new THREE.BoxGeometry(0.78, 0.05, 0.02),
      lamp: new THREE.SphereGeometry(0.035, 8, 6),
      db: new THREE.BoxGeometry(0.7, 2.0, 0.6),
    }),
    [],
  );
  useDisposeAll(g);
  // Cubicles from port to starboard: A side (G1, G2, AZ1, BT1, TR-A, feeders), tie, B side mirrored.
  const layout = ['FDR', 'TR_A', 'BT1', 'AZ1', 'G2', 'G1', 'BUS_A', 'MSB_TIE', 'BUS_B', 'G3', 'G4', 'AZ2', 'BT2', 'TR_B', 'FDR'];
  const W = 0.8;
  const x0 = (-(layout.length - 1) * W) / 2;
  const lamps = useLamps(layout.length, (i) => {
    const s = powerSystem.getState();
    const c = layout[i];
    if (c === 'BUS_A') return s.buses.MSB_A.fault ? 'red' : s.buses.MSB_A.live ? 'green' : 'off';
    if (c === 'BUS_B') return s.buses.MSB_B.fault ? 'red' : s.buses.MSB_B.live ? 'green' : 'off';
    if (c === 'MSB_TIE' || c === 'TR_A' || c === 'TR_B') {
      const t = s.ties[c];
      return t.tripped ? 'red' : t.closed ? 'green' : 'off';
    }
    if (c.startsWith('G')) {
      const gen = s.gens.find((x) => x.id === c)!;
      return gen.state === 'tripped' ? 'red' : gen.breaker ? 'green' : 'off';
    }
    if (c === 'FDR') return 'blue';
    const d = s.drives.find((x) => x.id === c);
    return d ? (d.status === 'ready' ? 'green' : d.status === 'tripped' ? 'red' : d.status === 'restarting' ? 'amber' : 'off') : 'off';
  });
  const dbLamps = useLamps(2, (i) => {
    const b = powerSystem.getState().buses[i === 0 ? 'DB_A' : 'DB_B'];
    return b.fault ? 'red' : b.live ? 'green' : 'off';
  });
  const o = visual.outline;
  const y = MSB_ROOM.floorY;
  return (
    <group name={`equipment:${id}`} position={[0, y, MSB_ROOM.z]} {...handlers}>
      {layout.map((c, i) => {
        const x = x0 + i * W;
        return (
          <group key={`${c}-${i}`} position={[x, 0, 0]} name={`cubicle:${c}`}>
            <EqMesh geometry={g.plinth} material={mats.plinth} outline={o} position={[0, 0.05, 0]} />
            <EqMesh geometry={g.cubicle} material={mats.cubicle} outline={o} position={[0, 1.2, 0]} />
            <mesh geometry={g.mimic} material={mats.mimic} position={[0, 2.05, 0.46]} name="bus-mimic" />
            <mesh geometry={g.handle} material={mats.handle} position={[0.26, 1.15, 0.47]} name="door-handle" />
            <mesh geometry={g.lamp} material={lamps[i]} position={[0, 1.8, 0.47]} name="breaker-lamp" />
          </group>
        );
      })}
      {/* 440 V distribution boards A and B, back to back with the main switchboard */}
      {[-1, 1].map((k, i) => (
        <group key={k} position={[k * 3.6, 0, -1.9]} name={i === 0 ? 'DB-A' : 'DB-B'}>
          {[-0.72, 0, 0.72].map((dx) => (
            <EqMesh key={dx} geometry={g.db} material={mats.cubicle} outline={o} position={[dx, 1.0, 0]} />
          ))}
          <mesh geometry={g.lamp} material={dbLamps[i]} position={[0, 1.7, 0.31]} name="bus-lamp" />
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------------------- emergency generator and ESB

export function EmergencyGenerator() {
  const id = 'emergency-gen-001';
  const handlers = useSelectable(id);
  const { mats, visual } = useEquipmentMaterials(id, {
    skid: { color: '#3a4148', metalness: 0.6, roughness: 0.5 },
    engine: { color: '#b33a2e', metalness: 0.4, roughness: 0.45 },
    radiator: { color: '#2e3338', metalness: 0.6, roughness: 0.5 },
    alternator: { color: '#2f5e8f', metalness: 0.4, roughness: 0.45 },
    board: { color: '#c9ced3', metalness: 0.35, roughness: 0.45 },
  });
  const g = useMemo(
    () => ({
      skid: new THREE.BoxGeometry(1.1, 0.2, 3.2),
      engine: new THREE.BoxGeometry(0.9, 1.0, 1.6),
      radiator: new THREE.BoxGeometry(1.1, 1.3, 0.25),
      alternator: new THREE.CylinderGeometry(0.42, 0.42, 0.8, 20).rotateX(Math.PI / 2),
      esb: new THREE.BoxGeometry(0.7, 2.0, 0.6),
      lamp: new THREE.SphereGeometry(0.05, 8, 6),
    }),
    [],
  );
  useDisposeAll(g);
  const lamps = useLamps(2, (i) => {
    const s = powerSystem.getState();
    if (i === 0) return genLamp(s, 'EG');
    return s.buses.ESB.fault ? 'red' : s.buses.ESB.live ? 'green' : 'off';
  });
  const o = visual.outline;
  return (
    <group name={`equipment:${id}`} position={[EG_ROOM.x, EG_ROOM.floorY, EG_ROOM.z]} {...handlers}>
      <EqMesh geometry={g.skid} material={mats.skid} outline={o} position={[0, 0.1, 0]} name="skid" />
      <EqMesh geometry={g.engine} material={mats.engine} outline={o} position={[0, 0.7, -0.3]} name="emergency-diesel" />
      <EqMesh geometry={g.radiator} material={mats.radiator} outline={o} position={[0, 0.85, -1.4]} name="radiator" />
      <EqMesh geometry={g.alternator} material={mats.alternator} outline={o} position={[0, 0.65, 0.95]} name="alternator" />
      <mesh geometry={g.lamp} material={lamps[0]} position={[0.5, 1.15, 0.4]} name="eg-run-lamp" />
      {[0, 0.72, 1.44].map((dz) => (
        <EqMesh key={dz} geometry={g.esb} material={mats.board} outline={o} position={[1.5, 1.0, -0.7 + dz]} rotation={[0, -Math.PI / 2, 0]} name="emergency-switchboard" />
      ))}
      <mesh geometry={g.lamp} material={lamps[1]} position={[1.19, 1.7, 0]} name="esb-bus-lamp" />
    </group>
  );
}

// --------------------------------------------------------------------------------------- DP UPS

/** UPS A and UPS B in separate rooms either side of the centreline; UPS C (DP3 only) in the A60 backup DP room. */
export function DpUps() {
  const id = 'ups-001';
  const handlers = useSelectable(id);
  const { mats, visual } = useEquipmentMaterials(id, {
    cabinet: { color: '#dfe3e6', metalness: 0.3, roughness: 0.5 },
    rack: { color: '#3a4148', metalness: 0.6, roughness: 0.5 },
    battery: { color: '#1d2226', metalness: 0.2, roughness: 0.6 },
    screen: { color: '#0f2236', metalness: 0.2, roughness: 0.3 },
  });
  const g = useMemo(
    () => ({
      cabinet: new THREE.BoxGeometry(0.6, 1.9, 0.8),
      rack: new THREE.BoxGeometry(0.8, 1.6, 0.6),
      shelf: new THREE.BoxGeometry(0.76, 0.03, 0.56),
      battery: new THREE.BoxGeometry(0.16, 0.2, 0.2),
      screen: new THREE.PlaneGeometry(0.24, 0.16),
      lamp: new THREE.SphereGeometry(0.035, 8, 6),
    }),
    [],
  );
  useDisposeAll(g);
  const lamps = useLamps(3, (i) => {
    const u = powerSystem.getState().ups[i];
    if (!u.installed) return 'off';
    return u.mode === 'normal' ? 'green' : u.mode === 'off' ? 'red' : 'amber';
  });
  const dp3 = useRef<THREE.Group>(null);
  useFrame(() => {
    if (dp3.current) dp3.current.visible = powerSystem.getState().ups[2].installed;
  });
  const o = visual.outline;
  const unit = (key: string, x: number, z: number, lamp: THREE.Material, rot = 0) => (
    <group key={key} position={[x, UPS_ROOMS.floorY, z]} rotation={[0, rot, 0]} name={key}>
      <EqMesh geometry={g.cabinet} material={mats.cabinet} outline={o} position={[0, 0.95, 0]} name="ups-cabinet" />
      <mesh geometry={g.screen} material={mats.screen} position={[0, 1.45, 0.401]} name="ups-display" />
      <mesh geometry={g.lamp} material={lamp} position={[0.2, 1.65, 0.405]} name="ups-status-lamp" />
      <EqMesh geometry={g.rack} material={mats.rack} outline={o} position={[0.75, 0.8, -0.1]} name="battery-rack" />
      {[0.35, 0.75, 1.15].map((sy) => (
        <group key={sy}>
          <mesh geometry={g.shelf} material={mats.rack} position={[0.75, sy, -0.1]} />
          {[-0.27, -0.09, 0.09, 0.27].map((bx) => (
            <mesh key={bx} geometry={g.battery} material={mats.battery} position={[0.75 + bx, sy + 0.115, -0.1]} />
          ))}
        </group>
      ))}
    </group>
  );
  return (
    <group name={`equipment:${id}`} {...handlers}>
      {unit('UPS-A', -UPS_ROOMS.x - 0.4, UPS_ROOMS.z, lamps[0])}
      {unit('UPS-B', UPS_ROOMS.x - 0.4, UPS_ROOMS.z, lamps[1])}
      <group ref={dp3}>{unit('UPS-C', 6.1, 8.7, lamps[2], -Math.PI / 2)}</group>
    </group>
  );
}

// ------------------------------------------------------------------------------------ wind sensors

/** Two 2-axis ultrasonic wind sensors on a cross-arm near the mast top. */
export function WindSensors() {
  const id = 'wind-001';
  const handlers = useSelectable(id);
  const { mats, visual } = useEquipmentMaterials(id, {
    arm: { color: '#e6e9eb', metalness: 0.4, roughness: 0.45 },
    body: { color: '#f2f3f4', metalness: 0.2, roughness: 0.45 },
    transducer: { color: '#3c434a', metalness: 0.5, roughness: 0.4 },
  });
  const g = useMemo(
    () => ({
      arm: new THREE.BoxGeometry(WIND_ARM.half * 2, 0.08, 0.08),
      clamp: new THREE.BoxGeometry(0.5, 0.2, 0.5),
      stub: new THREE.CylinderGeometry(0.025, 0.025, 0.32, 10),
      body: new THREE.CylinderGeometry(0.06, 0.06, 0.18, 16),
      prong: new THREE.CylinderGeometry(0.01, 0.01, 0.14, 6),
      head: new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14),
      lamp: new THREE.SphereGeometry(0.025, 8, 6),
    }),
    [],
  );
  useDisposeAll(g);
  const lamps = useLamps(2, (i) => {
    const x = windSystem.getState().sensors[i];
    return x.status === 'OK' ? 'green' : x.status === 'STALE' ? 'amber' : 'red';
  });
  const o = visual.outline;
  return (
    <group name={`equipment:${id}`} {...handlers}>
      <EqMesh geometry={g.arm} material={mats.arm} outline={o} position={[0, WIND_ARM.y, MAST.z]} name="sensor-cross-arm" />
      <EqMesh geometry={g.clamp} material={mats.arm} outline={o} position={[0, WIND_ARM.y, MAST.z]} name="mast-clamp" />
      {WIND_CONFIG.sensors.map((c, i) => {
        const [x, yTop, z] = c.pos;
        return (
          <group key={c.id} position={[x, WIND_ARM.y, z]} name={`wind-sensor:${c.id}`}>
            <EqMesh geometry={g.stub} material={mats.arm} outline={o} position={[0, 0.16, 0]} />
            <EqMesh geometry={g.body} material={mats.body} outline={o} position={[0, yTop - WIND_ARM.y - 0.15, 0]} />
            {[0, 1, 2].map((k) => {
              const a = (k * 2 * Math.PI) / 3;
              return <mesh key={k} geometry={g.prong} material={mats.transducer} position={[Math.cos(a) * 0.045, yTop - WIND_ARM.y, Math.sin(a) * 0.045]} />;
            })}
            <mesh geometry={g.head} material={mats.body} position={[0, yTop - WIND_ARM.y + 0.08, 0]} />
            <mesh geometry={g.lamp} material={lamps[i]} position={[0, 0.06, 0.06]} name="status-lamp" />
          </group>
        );
      })}
    </group>
  );
}

// --------------------------------------------------------------------------------- gyros and MRUs

/** Three gyrocompasses in the gyro room under the bridge, and two MRUs low in the hull near midships. */
export function HeadingSensors() {
  const id = 'gyro-mru-001';
  const handlers = useSelectable(id);
  const { mats, visual } = useEquipmentMaterials(id, {
    gyro: { color: '#d9dde0', metalness: 0.3, roughness: 0.5 },
    base: { color: '#3a4148', metalness: 0.5, roughness: 0.5 },
    mru: { color: '#e08a2a', metalness: 0.4, roughness: 0.45 },
    bracket: { color: '#8a9399', metalness: 0.7, roughness: 0.35 },
  });
  const g = useMemo(
    () => ({
      cabinet: new THREE.BoxGeometry(0.5, 0.8, 0.45),
      dome: new THREE.CylinderGeometry(0.2, 0.22, 0.18, 20),
      base: new THREE.BoxGeometry(0.6, 0.06, 0.55),
      mru: new THREE.CylinderGeometry(0.07, 0.07, 0.2, 16),
      bracket: new THREE.BoxGeometry(0.3, 0.02, 0.3),
      lamp: new THREE.SphereGeometry(0.025, 8, 6),
    }),
    [],
  );
  useDisposeAll(g);
  const ids = ['GYRO1', 'GYRO2', 'GYRO3', 'MRU1', 'MRU2'] as const;
  const lamps = useLamps(5, (i) => {
    const x = dpSystem.getState().sensors.find((v) => v.id === ids[i]);
    if (!x) return 'off';
    return !x.powered || x.fault === 'fail' ? 'red' : x.rejected || x.fault === 'drift' ? 'amber' : 'green';
  });
  const o = visual.outline;
  return (
    <group name={`equipment:${id}`} {...handlers}>
      {[-0.9, 0, 0.9].map((x, i) => (
        <group key={x} position={[x, GYRO_ROOM.floorY, GYRO_ROOM.z]} name={`gyro:${ids[i]}`}>
          <EqMesh geometry={g.base} material={mats.base} outline={o} position={[0, 0.03, 0]} />
          <EqMesh geometry={g.cabinet} material={mats.gyro} outline={o} position={[0, 0.46, 0]} />
          <EqMesh geometry={g.dome} material={mats.gyro} outline={o} position={[0, 0.95, 0]} />
          <mesh geometry={g.lamp} material={lamps[i]} position={[0.16, 0.75, 0.23]} name="status-lamp" />
        </group>
      ))}
      {MRU_POS.map((p, i) => (
        <group key={i} position={p} name={`mru:${ids[3 + i]}`}>
          <EqMesh geometry={g.bracket} material={mats.bracket} outline={o} position={[0, 0.01, 0]} />
          <EqMesh geometry={g.mru} material={mats.mru} outline={o} position={[0, 0.12, 0]} />
          <mesh geometry={g.lamp} material={lamps[3 + i]} position={[0, 0.25, 0]} name="status-lamp" />
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------------------- PMS operator console

/** PMS operator console in the engine control room, facing the main switchboard (the bridge has a repeater). */
export function PmsConsole() {
  const id = 'pms-001';
  const handlers = useSelectable(id);
  const { mats, visual } = useEquipmentMaterials(id, {
    desk: { color: '#c9ced3', metalness: 0.3, roughness: 0.5 },
    frame: { color: '#30363b', metalness: 0.6, roughness: 0.4 },
  });
  const g = useMemo(
    () => ({
      desk: new THREE.BoxGeometry(2.0, 0.8, 0.8),
      top: new THREE.BoxGeometry(2.1, 0.05, 0.9),
      monitor: new THREE.BoxGeometry(0.62, 0.4, 0.05),
      screen: new THREE.PlaneGeometry(0.58, 0.36),
    }),
    [],
  );
  useDisposeAll(g);
  // Screen tint follows the plant: blue normal, amber alarm, red blackout.
  const screens = useLamps(2, () => {
    const s = powerSystem.getState();
    if (s.alarms.some((a) => a.startsWith('BLACKOUT'))) return 'red';
    return s.alarms.length ? 'amber' : 'blue';
  });
  const o = visual.outline;
  return (
    <group name={`equipment:${id}`} position={[0, MSB_ROOM.floorY, MSB_ROOM.z + 2.6]} rotation={[0, Math.PI, 0]} {...handlers}>
      <EqMesh geometry={g.desk} material={mats.desk} outline={o} position={[0, 0.4, 0]} name="pms-console-desk" />
      <EqMesh geometry={g.top} material={mats.frame} outline={o} position={[0, 0.82, 0]} name="desk-top" />
      {[-0.4, 0.4].map((x, i) => (
        <group key={x} position={[x, 1.15, 0.2]} rotation={[-0.15, 0, 0]}>
          <EqMesh geometry={g.monitor} material={mats.frame} outline={o} />
          <mesh geometry={g.screen} material={screens[i]} position={[0, 0, -0.027]} rotation={[0, Math.PI, 0]} name="pms-screen" />
        </group>
      ))}
    </group>
  );
}
