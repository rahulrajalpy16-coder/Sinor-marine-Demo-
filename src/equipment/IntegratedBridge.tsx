import { LEVEL, WHEELHOUSE_FRONT_Z } from '../vessels/vesselLayout';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';
import { dpSystem } from '../simulations/dpController';
import { bowThruster } from '../simulations/controller';
import { headingDeg } from '../simulations/dp';
import { activeQualityProfile } from '../rendering/quality';
import { readableInWorld } from '../scene/vesselTransform';

const ID = 'ibs-001';

/** Forward bridge console: five multi-function workstations (MFW) as in the IBS datasheet diagram. */
export type MfwApp = 'radar-x' | 'ecdis' | 'conning' | 'radar-s';
export const MFW_LAYOUT: { app: MfwApp; label: string; x: number; yaw: number }[] = [
  { app: 'radar-x', label: 'X-band ARPA radar', x: -4.7, yaw: 0.32 },
  { app: 'ecdis', label: 'ECDIS 1', x: -2.4, yaw: 0.12 },
  { app: 'conning', label: 'Conning', x: 0, yaw: 0 },
  { app: 'ecdis', label: 'ECDIS 2', x: 2.4, yaw: -0.12 },
  { app: 'radar-s', label: 'S-band ARPA radar', x: 4.7, yaw: -0.32 },
];
/** Forward console line and bridge deck, from the vessel layout (front windows 1.35 m ahead). */
const CONSOLE_Z = WHEELHOUSE_FRONT_Z - 1.35;
const FLOOR = LEVEL.bridge;
const MFW_W = 1.15;

function canvas(w = 384, h = 240) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  readableInWorld(tex);
  return { c, ctx, tex };
}

function header(ctx: CanvasRenderingContext2D, title: string, w: number) {
  ctx.fillStyle = '#16324a';
  ctx.fillRect(0, 0, w, 20);
  ctx.fillStyle = '#dce8f0';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(title, 8, 14);
}

function drawRadar(ctx: CanvasRenderingContext2D, title: string, sweep: number) {
  const w = 384;
  const h = 240;
  ctx.fillStyle = '#05090d';
  ctx.fillRect(0, 0, w, h);
  header(ctx, title, w);
  const cx = 150;
  const cy = 130;
  const r = 100;
  ctx.strokeStyle = '#1d4d2f';
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * i) / 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Sweep with a fading trail
  for (let i = 0; i < 24; i++) {
    const a = sweep - i * 0.04;
    ctx.strokeStyle = `rgba(80,255,140,${0.5 * (1 - i / 24)})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
    ctx.stroke();
  }
  // Echoes: coastline and targets (ARPA vectors)
  ctx.fillStyle = '#e8c547';
  [
    [40, -60],
    [-55, 30],
    [70, 45],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(cx + x, cy + y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8c547';
    ctx.beginPath();
    ctx.moveTo(cx + x, cy + y);
    ctx.lineTo(cx + x + 12, cy + y - 8);
    ctx.stroke();
  });
  ctx.fillStyle = '#3c8a55';
  ctx.fillRect(cx - 95, cy - 90, 30, 50);
  ctx.fillStyle = '#9fb3c2';
  ctx.font = '11px monospace';
  ctx.fillText('RANGE 3 NM', 270, 50);
  ctx.fillText('ARPA 3 TGT', 270, 68);
  ctx.fillText('NORTH UP', 270, 86);
}

function drawEcdis(ctx: CanvasRenderingContext2D, title: string, hdg: number) {
  const w = 384;
  const h = 240;
  ctx.fillStyle = '#cfe3f2';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#a8cbe6';
  ctx.fillRect(0, 140, w, 100);
  ctx.fillStyle = '#e8d9a8';
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(120, 20);
  ctx.bezierCurveTo(140, 60, 90, 90, 60, 120);
  ctx.lineTo(0, 140);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7a8fa3';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(200, 230);
  ctx.lineTo(240, 120);
  ctx.lineTo(330, 40);
  ctx.stroke();
  ctx.setLineDash([]);
  // Own ship
  ctx.save();
  ctx.translate(240, 120);
  ctx.rotate((hdg * Math.PI) / 180);
  ctx.fillStyle = '#c62828';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(6, 8);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  header(ctx, title, w);
  ctx.fillStyle = '#16324a';
  ctx.font = '11px monospace';
  ctx.fillText(`HDG ${hdg.toFixed(1)}°  ROUTE: FIELD-A`, 8, 234);
}

function drawConning(ctx: CanvasRenderingContext2D, hdg: number, btKN: number, mode: string) {
  const w = 384;
  const h = 240;
  ctx.fillStyle = '#0b1a2c';
  ctx.fillRect(0, 0, w, h);
  header(ctx, 'CONNING', w);
  const gauge = (cx: number, label: string, value: string, frac: number) => {
    ctx.strokeStyle = '#2c4a6b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, 110, 42, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    ctx.strokeStyle = '#5fc8ff';
    ctx.beginPath();
    ctx.arc(cx, 110, 42, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * Math.max(0, Math.min(1, frac))));
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#e6edf2';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(value, cx, 115);
    ctx.fillStyle = '#9fb3c2';
    ctx.font = '11px sans-serif';
    ctx.fillText(label, cx, 170);
    ctx.textAlign = 'left';
  };
  gauge(70, 'HEADING', `${hdg.toFixed(0)}°`, hdg / 360);
  gauge(190, 'BT1 THRUST', `${btKN.toFixed(0)}kN`, Math.abs(btKN) / 105);
  gauge(310, 'SPEED', '0.0kn', 0);
  ctx.fillStyle = '#9fb3c2';
  ctx.font = '12px monospace';
  ctx.fillText(`DP: ${mode}`, 12, 215);
}

/**
 * Integrated bridge system (IBS): a forward console of five MFWs (X-band radar, ECDIS, conning,
 * ECDIS, S-band radar) on a dual redundant network, overhead displays, steering stand with the
 * Z-Thrust BT1 panel, navigator chairs, and a chart table. Representative layout after the IBS datasheet.
 */
export function IntegratedBridge() {
  const handlers = useSelectable(ID);
  const { mats, visual } = useEquipmentMaterials(ID, {
    console: { color: '#d4d8dc', metalness: 0.35, roughness: 0.5 },
    dark: { color: '#2f3a45', metalness: 0.4, roughness: 0.45 },
    desk: { color: '#1b2833', metalness: 0.3, roughness: 0.6 },
    accent: { color: '#2a74b8', metalness: 0.3, roughness: 0.5 },
    chair: { color: '#22272c', metalness: 0.2, roughness: 0.7 },
    wood: { color: '#6b5440', metalness: 0.1, roughness: 0.7 },
  });
  const g = useMemo(
    () => ({
      base: new THREE.BoxGeometry(MFW_W, 0.75, 0.7),
      desk: new THREE.BoxGeometry(MFW_W, 0.05, 0.5),
      kbd: new THREE.BoxGeometry(0.45, 0.02, 0.16),
      ball: new THREE.SphereGeometry(0.035, 12, 8),
      bezel: new THREE.BoxGeometry(0.68, 0.44, 0.05),
      screen: new THREE.PlaneGeometry(0.62, 0.39),
      overhead: new THREE.BoxGeometry(7.6, 0.32, 0.25),
      ohScreen: new THREE.PlaneGeometry(0.42, 0.24),
      stand: new THREE.BoxGeometry(0.7, 1.0, 0.5),
      wheel: new THREE.TorusGeometry(0.16, 0.018, 8, 24),
      lever: new THREE.BoxGeometry(0.03, 0.14, 0.03),
      smallScreen: new THREE.PlaneGeometry(0.22, 0.14),
      seat: new THREE.BoxGeometry(0.6, 0.14, 0.6),
      back: new THREE.BoxGeometry(0.6, 0.75, 0.12),
      arm: new THREE.BoxGeometry(0.08, 0.06, 0.5),
      post: new THREE.CylinderGeometry(0.06, 0.1, 0.5, 12),
      table: new THREE.BoxGeometry(1.4, 0.95, 0.9),
    }),
    [],
  );

  const screens = useMemo(() => MFW_LAYOUT.map(() => canvas()), []);
  const conn = useMemo(() => canvas(), []);
  const btScreen = useMemo(() => canvas(192, 120), []);
  const overhead = useMemo(() => Array.from({ length: 4 }, () => canvas(192, 110)), []);
  const screenMats = useMemo(
    () => screens.map((c) => new THREE.MeshBasicMaterial({ map: c?.tex ?? null, color: c ? '#ffffff' : '#0aa7c4', toneMapped: false })),
    [screens],
  );
  const btMat = useMemo(() => new THREE.MeshBasicMaterial({ map: btScreen?.tex ?? null, toneMapped: false }), [btScreen]);
  const ohMats = useMemo(() => overhead.map((c) => new THREE.MeshBasicMaterial({ map: c?.tex ?? null, toneMapped: false })), [overhead]);
  useEffect(
    () => () => {
      Object.values(g).forEach((x) => x.dispose());
      [...screens, conn, btScreen, ...overhead].forEach((c) => c?.tex.dispose());
      [...screenMats, btMat, ...ohMats].forEach((m) => m.dispose());
    },
    [g, screens, conn, btScreen, overhead, screenMats, btMat, ohMats],
  );

  // Static overhead displays: gyro, wind, speed log, depth.
  useEffect(() => {
    const labels = ['GYRO', 'WIND', 'LOG', 'DEPTH'];
    overhead.forEach((c, i) => {
      if (!c) return;
      c.ctx.fillStyle = '#05090d';
      c.ctx.fillRect(0, 0, 192, 110);
      c.ctx.fillStyle = '#9fb3c2';
      c.ctx.font = '13px sans-serif';
      c.ctx.fillText(labels[i], 10, 22);
      c.ctx.fillStyle = '#ffb000';
      c.ctx.font = 'bold 30px monospace';
      c.ctx.fillText(['000.0', '20 kn', '0.0', '85 m'][i], 10, 75);
      c.tex.needsUpdate = true;
    });
  }, [overhead]);

  const acc = useRef(1);
  const sweep = useRef(0);
  useFrame((_, dt) => {
    sweep.current += dt * 1.6;
    acc.current += dt;
    if (acc.current < 1 / activeQualityProfile().screenHz) return;
    acc.current = 0;
    const dp = dpSystem.getState();
    const bt = bowThruster.getState();
    const hdg = headingDeg(dp.eta[2]);
    MFW_LAYOUT.forEach((m, i) => {
      const c = screens[i];
      if (!c) return;
      if (m.app === 'radar-x' || m.app === 'radar-s') drawRadar(c.ctx, m.label.toUpperCase(), sweep.current + i);
      else if (m.app === 'ecdis') drawEcdis(c.ctx, m.label.toUpperCase(), hdg);
      else drawConning(c.ctx, hdg, bt.thrustKN, dp.status === 'running' ? dp.mode.replace('_', ' ') : 'OFF');
      c.tex.needsUpdate = true;
    });
    if (btScreen) {
      const x = btScreen.ctx;
      x.fillStyle = '#23282d';
      x.fillRect(0, 0, 192, 120);
      x.fillStyle = '#e6edf2';
      x.font = 'bold 12px sans-serif';
      x.fillText('Z-THRUST · BT1', 8, 16);
      x.font = '11px monospace';
      x.fillText(`${bt.status.toUpperCase()}  ${bt.station}`, 8, 36);
      x.fillText(`PITCH ${(bt.pitch * 100).toFixed(0)}%`, 8, 56);
      x.fillText(`RPM   ${bt.rpm.toFixed(0)}`, 8, 74);
      x.fillText(`THR   ${bt.thrustKN.toFixed(0)} kN`, 8, 92);
      btScreen.tex.needsUpdate = true;
    }
    const gyro = overhead[0];
    if (gyro) {
      gyro.ctx.fillStyle = '#05090d';
      gyro.ctx.fillRect(0, 30, 192, 60);
      gyro.ctx.fillStyle = '#ffb000';
      gyro.ctx.font = 'bold 30px monospace';
      gyro.ctx.fillText(hdg.toFixed(1).padStart(5, '0'), 10, 75);
      gyro.tex.needsUpdate = true;
    }
  });

  const o = visual.outline;
  return (
    <group name={`equipment:${ID}`} {...handlers}>
      {MFW_LAYOUT.map((m, i) => (
        <group key={i} position={[m.x, FLOOR, CONSOLE_Z - Math.abs(m.x) * 0.06]} rotation={[0, m.yaw, 0]} name={`mfw-${i + 1}-${m.app}`}>
          <EqMesh geometry={g.base} material={mats.console} outline={o} position={[0, 0.375, 0]} />
          <group position={[0, 0.8, -0.3]} rotation={[-0.2, 0, 0]}>
            <EqMesh geometry={g.desk} material={mats.dark} outline={o} />
            <EqMesh geometry={g.kbd} material={mats.desk} outline={o} position={[-0.15, 0.035, 0.02]} />
            <EqMesh geometry={g.ball} material={mats.accent} outline={o} position={[0.3, 0.04, 0.02]} />
          </group>
          <group position={[0, 1.08, 0.12]} rotation={[0.12, Math.PI, 0]}>
            <EqMesh geometry={g.bezel} material={mats.dark} outline={o} />
            <mesh geometry={g.screen} material={screenMats[i]} position={[0, 0, 0.026]} />
          </group>
        </group>
      ))}
      {/* Overhead console along the top of the front windows, displays facing aft */}
      <group position={[0, LEVEL.roof - 0.65, CONSOLE_Z + 0.7]}>
        <EqMesh geometry={g.overhead} material={mats.dark} outline={o} />
        {ohMats.map((m, i) => (
          <mesh key={i} geometry={g.ohScreen} material={m} position={[-2.4 + i * 1.6, 0, -0.13]} rotation={[0, Math.PI, 0]} />
        ))}
      </group>
      {/* Steering stand with autopilot wheel and the Z-Thrust BT1 control panel */}
      <group position={[0, FLOOR, CONSOLE_Z - 1]} name="steering-stand">
        <EqMesh geometry={g.stand} material={mats.console} outline={o} position={[0, 0.5, 0]} />
        <EqMesh geometry={g.wheel} material={mats.dark} outline={o} position={[0, 1.12, -0.2]} rotation={[0.4, 0, 0]} />
        <mesh geometry={g.smallScreen} material={btMat} position={[0, 0.88, -0.26]} rotation={[0.45, Math.PI, 0]} />
        <EqMesh geometry={g.lever} material={mats.accent} outline={o} position={[0.25, 1.06, -0.15]} name="bt1-lever" />
      </group>
      {[-1.25, 1.25].map((x) => (
        <group key={x} position={[x, FLOOR, CONSOLE_Z - 1.4]} name="navigator-chair">
          <EqMesh geometry={g.post} material={mats.dark} outline={o} position={[0, 0.25, 0]} />
          <EqMesh geometry={g.seat} material={mats.chair} outline={o} position={[0, 0.55, 0]} />
          <EqMesh geometry={g.back} material={mats.chair} outline={o} position={[0, 0.98, -0.28]} rotation={[0.1, 0, 0]} />
          <EqMesh geometry={g.arm} material={mats.chair} outline={o} position={[-0.32, 0.72, 0]} />
          <EqMesh geometry={g.arm} material={mats.chair} outline={o} position={[0.32, 0.72, 0]} />
        </group>
      ))}
      <EqMesh geometry={g.table} material={mats.wood} outline={o} position={[-5.6, FLOOR + 0.475, 16.6]} name="chart-table" />
    </group>
  );
}
