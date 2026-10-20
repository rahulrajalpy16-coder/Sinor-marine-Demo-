import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EqMesh } from './EqMesh';

/** Materials a chair borrows from the equipment it belongs to, so selection highlighting covers it. */
export interface ChairMaterials {
  upholstery: THREE.Material;
  frame: THREE.Material;
  panel: THREE.Material;
  key: THREE.Material;
  grip: THREE.Material;
  ball: THREE.Material;
}

/**
 * Generic bridge operator chair (no maker), facing +z, origin on the floor under the seat centre.
 *  - 'dp': DP operator chair as fitted at DP2 aft stations: fore-and-aft floor rails, column, high back with
 *    headrest, and armrest consoles. The left armrest carries the independent joystick system (IJS: joystick,
 *    small display, mode keys), the manual backup class rules generally require, which the Bridge Mate DP datasheet says
 *    can be interfaced to it; the right armrest carries a trackball, keypad and heading knob for the DP operator
 *    station.
 *  - 'nav': navigator chair at the forward conning position, armrest panels for the MFW trackball and keys.
 * Proportions follow typical offshore bridge chairs: seat 0.56 m above the floor, armrest panels at 0.74 m.
 */
export const CHAIR = { seatY: 0.56, armY: 0.74, armX: 0.37, width: 0.92 } as const;

export function BridgeChair({
  variant,
  mats,
  outline,
  ijsScreen,
  name,
}: {
  variant: 'dp' | 'nav';
  mats: ChairMaterials;
  outline: boolean;
  ijsScreen?: THREE.Material;
  name?: string;
}) {
  const g = useMemo(() => {
    const key = new THREE.BoxGeometry(0.018, 0.008, 0.016);
    const keys = (cols: number, rows: number, x0: number, z0: number, dx = 0.024, dz = 0.022) =>
      mergeGeometries(Array.from({ length: cols * rows }, (_, k) => key.clone().translate(x0 + (k % cols) * dx, 0, z0 + Math.floor(k / cols) * dz).toNonIndexed()))!;
    const out = {
      rail: new THREE.BoxGeometry(0.06, 0.035, 1.2),
      carriage: new THREE.BoxGeometry(0.5, 0.05, 0.46),
      star: mergeGeometries(Array.from({ length: 5 }, (_, k) => new THREE.BoxGeometry(0.05, 0.035, 0.32).translate(0, 0, 0.16).rotateY((k * 2 * Math.PI) / 5).toNonIndexed()))!,
      column: new THREE.CylinderGeometry(0.055, 0.075, CHAIR.seatY - 0.12, 16),
      seat: new RoundedBoxGeometry(0.56, 0.12, 0.52, 3, 0.04),
      back: new RoundedBoxGeometry(0.54, 0.72, 0.12, 3, 0.05),
      head: new RoundedBoxGeometry(0.32, 0.2, 0.1, 3, 0.04),
      backFrame: new THREE.BoxGeometry(0.06, 0.5, 0.05),
      armPost: new THREE.BoxGeometry(0.04, CHAIR.armY - CHAIR.seatY, 0.06),
      arm: new RoundedBoxGeometry(0.17, 0.08, 0.6, 2, 0.02),
      armPad: new THREE.BoxGeometry(0.15, 0.006, 0.4),
      footrest: new THREE.TorusGeometry(0.2, 0.012, 6, 24).rotateX(Math.PI / 2),
      // Armrest controls (y = 0 on the panel top).
      keysL: keys(3, 2, -0.024, 0.02),
      keysR: keys(3, 3, -0.024, 0.09),
      bootBase: new THREE.CylinderGeometry(0.032, 0.04, 0.012, 16),
      boot: new THREE.CylinderGeometry(0.014, 0.028, 0.03, 16),
      stick: new THREE.CylinderGeometry(0.009, 0.011, 0.04, 10),
      grip: new THREE.CapsuleGeometry(0.017, 0.04, 4, 12),
      ballCup: new THREE.CylinderGeometry(0.03, 0.033, 0.01, 16),
      ball: new THREE.SphereGeometry(0.022, 16, 10),
      knob: new THREE.CylinderGeometry(0.018, 0.02, 0.02, 16),
      screen: new THREE.PlaneGeometry(0.12, 0.07).rotateX(-Math.PI / 2 + 0.5),
      screenBox: new THREE.BoxGeometry(0.14, 0.06, 0.03),
    };
    key.dispose();
    return out;
  }, []);
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);

  const o = outline;
  const dp = variant === 'dp';
  // Left armrest (operator's left, -x) and right armrest controls.
  const left = (
    <group position={[-CHAIR.armX, CHAIR.armY + 0.043, 0.06]} name={dp ? 'ijs-armrest' : 'armrest-left'}>
      <mesh geometry={g.armPad} material={mats.panel} />
      {dp ? (
        <>
          {/* Independent joystick system: joystick, mode keys and its own small display at the front */}
          <group position={[0, 0.003, -0.02]} name="ijs-joystick">
            <mesh geometry={g.bootBase} material={mats.frame} position={[0, 0.006, 0]} />
            <mesh geometry={g.boot} material={mats.grip} position={[0, 0.026, 0]} />
            <mesh geometry={g.stick} material={mats.grip} position={[0, 0.058, 0]} />
            <EqMesh geometry={g.grip} material={mats.grip} outline={o} position={[0, 0.098, 0]} />
          </group>
          <mesh geometry={g.keysL} material={mats.key} position={[0, 0.006, 0.07]} />
          <group position={[0, 0.03, 0.2]} name="ijs-display">
            <mesh geometry={g.screenBox} material={mats.frame} rotation={[0.5, 0, 0]} />
            {ijsScreen && <mesh geometry={g.screen} material={ijsScreen} position={[0, 0.017, 0.008]} />}
          </group>
        </>
      ) : (
        <>
          <mesh geometry={g.keysL} material={mats.key} position={[0, 0.006, 0.03]} />
          <group position={[0, 0.003, -0.08]}>
            <mesh geometry={g.knob} material={mats.key} position={[0, 0.01, 0]} />
          </group>
        </>
      )}
    </group>
  );
  const right = (
    <group position={[CHAIR.armX, CHAIR.armY + 0.043, 0.06]} name={dp ? 'dp-armrest' : 'armrest-right'}>
      <mesh geometry={g.armPad} material={mats.panel} />
      <mesh geometry={g.ballCup} material={mats.frame} position={[0, 0.005, 0.0]} />
      <EqMesh geometry={g.ball} material={mats.ball} outline={o} position={[0, 0.014, 0.0]} name="trackball" />
      <mesh geometry={g.keysR} material={mats.key} position={[0, 0.006, 0]} />
      {dp && <mesh geometry={g.knob} material={mats.key} position={[0, 0.013, -0.12]} name="heading-knob" />}
    </group>
  );
  return (
    <group name={name ?? (dp ? 'dp-chair' : 'navigator-chair')}>
      {dp ? (
        <>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} geometry={g.rail} material={mats.frame} position={[x, 0.0175, 0]} name="floor-rail" />
          ))}
          <EqMesh geometry={g.carriage} material={mats.frame} outline={o} position={[0, 0.06, 0]} />
        </>
      ) : (
        <mesh geometry={g.star} material={mats.frame} position={[0, 0.02, 0]} />
      )}
      <EqMesh geometry={g.column} material={mats.frame} outline={o} position={[0, 0.06 + (CHAIR.seatY - 0.12) / 2, 0]} />
      <mesh geometry={g.footrest} material={mats.frame} position={[0, 0.24, 0]} />
      <EqMesh geometry={g.seat} material={mats.upholstery} outline={o} position={[0, CHAIR.seatY - 0.02, 0.02]} />
      <group position={[0, CHAIR.seatY + 0.05, -0.24]} rotation={[-0.16, 0, 0]}>
        <mesh geometry={g.backFrame} material={mats.frame} position={[0, 0.2, -0.07]} />
        <EqMesh geometry={g.back} material={mats.upholstery} outline={o} position={[0, 0.4, 0]} />
        <EqMesh geometry={g.head} material={mats.upholstery} outline={o} position={[0, 0.88, 0.01]} />
      </group>
      {[-1, 1].map((k) => (
        <group key={k}>
          <mesh geometry={g.armPost} material={mats.frame} position={[k * CHAIR.armX, (CHAIR.seatY + CHAIR.armY) / 2, -0.08]} />
          <EqMesh geometry={g.arm} material={mats.upholstery} outline={o} position={[k * CHAIR.armX, CHAIR.armY, 0.06]} />
        </group>
      ))}
      {left}
      {right}
    </group>
  );
}

/** Small IJS display: thruster bars and the IJS mode, drawn once (the IJS is independent of the DP). */
export function drawIjsScreen(ctx: CanvasRenderingContext2D, w: number, h: number, mode: string) {
  ctx.fillStyle = '#0d1418';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#9fd5ff';
  ctx.font = `bold ${Math.round(h * 0.16)}px sans-serif`;
  ctx.fillText('IJS', 6, h * 0.2);
  ctx.fillStyle = mode === 'STANDBY' ? '#ffb000' : '#39e46b';
  ctx.fillText(mode, w * 0.45, h * 0.2);
  ['BT1', 'BT2', 'AZ1', 'AZ2'].forEach((t, i) => {
    const x = 8 + i * (w - 16) / 4;
    ctx.strokeStyle = '#4d6b80';
    ctx.strokeRect(x, h * 0.35, (w - 16) / 4 - 8, h * 0.45);
    ctx.fillStyle = '#22c322';
    ctx.fillRect(x + 2, h * 0.6, (w - 16) / 4 - 12, h * 0.18);
    ctx.fillStyle = '#c7d3dc';
    ctx.font = `${Math.round(h * 0.12)}px sans-serif`;
    ctx.fillText(t, x, h * 0.95);
  });
}
