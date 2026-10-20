import { LEVEL, WHEELHOUSE_AFT_Z, WHEELHOUSE_FRONT_Z } from '../vessels/vesselLayout';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';
import { dpSystem } from '../simulations/dpController';
import { bowThruster } from '../simulations/controller';
import { headingDeg } from '../simulations/dp';
import { qualityProfile } from '../rendering/quality';
import { useAppStore } from '../store/useAppStore';
import { AFT_CONSOLE, consoleSection, DESK, DESK_TILT, DISPLAY_FACE, FACE_TILT, FWD_CONSOLE, lerp2, type ConsoleSection } from './bridgeConsole';
import { BridgeChair } from './BridgeChair';

const ID = 'ibs-001';

/** Forward console: five multi-function workstations (MFW) as in the IBS datasheet diagram, port to starboard. */
export type MfwApp = 'radar-x' | 'ecdis' | 'conning' | 'radar-s';
export const MFW_LAYOUT: { app: MfwApp; label: string; x: number }[] = [
  { app: 'radar-x', label: 'X-band ARPA radar', x: -2.88 },
  { app: 'ecdis', label: 'ECDIS 1', x: -1.44 },
  { app: 'conning', label: 'Conning', x: 0 },
  { app: 'ecdis', label: 'ECDIS 2', x: 1.44 },
  { app: 'radar-s', label: 'S-band ARPA radar', x: 2.88 },
];
const FLOOR = LEVEL.bridge;

function canvas(w = 384, h = 240) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
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

/** Plain status page for the wing and aft displays (generic, no maker styling). */
function drawPage(ctx: CanvasRenderingContext2D, title: string, lines: [string, string, string?][]) {
  const w = 384;
  const h = 240;
  ctx.fillStyle = '#0b1622';
  ctx.fillRect(0, 0, w, h);
  header(ctx, title, w);
  lines.forEach(([k, v, c], i) => {
    const y = 48 + i * 26;
    ctx.fillStyle = '#12263a';
    ctx.fillRect(8, y - 16, w - 16, 22);
    ctx.fillStyle = '#9fb3c2';
    ctx.font = '12px sans-serif';
    ctx.fillText(k, 16, y);
    ctx.fillStyle = c ?? '#39e46b';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(v, w - 16, y);
    ctx.textAlign = 'left';
  });
}

/** Deck camera picture: the working deck from the crane camera, with deck cargo. */
function drawCctv(ctx: CanvasRenderingContext2D, title: string, seed: number) {
  const w = 384;
  const h = 240;
  const sky = ctx.createLinearGradient(0, 0, 0, 90);
  sky.addColorStop(0, '#8fb3cc');
  sky.addColorStop(1, '#c9d9e3');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, 90);
  ctx.fillStyle = '#2f5d78';
  ctx.fillRect(0, 70, w, 40);
  ctx.fillStyle = '#5d6872';
  ctx.beginPath();
  ctx.moveTo(40, h);
  ctx.lineTo(150, 80);
  ctx.lineTo(234, 80);
  ctx.lineTo(344, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d8c34a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, h);
  ctx.lineTo(170, 80);
  ctx.moveTo(274, h);
  ctx.lineTo(214, 80);
  ctx.stroke();
  ctx.lineWidth = 1;
  [
    [150 + seed * 20, 150, 50, 30, '#c0392b'],
    [220 - seed * 10, 120, 36, 22, '#2e86c1'],
    [180, 190, 60, 34, '#7f8c8d'],
  ].forEach(([x, y, bw, bh, c]) => {
    ctx.fillStyle = c as string;
    ctx.fillRect(x as number, y as number, bw as number, bh as number);
  });
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, h - 20, w, 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px monospace';
  ctx.fillText(`${title}  REC ●`, 8, h - 6);
}

/** Thruster mimic for the aft manoeuvring panel: azimuth angles and thrust from the DP model. */
function drawThrusterMimic(ctx: CanvasRenderingContext2D, dp: ReturnType<typeof dpSystem.getState>) {
  const w = 384;
  const h = 240;
  ctx.fillStyle = '#0b1622';
  ctx.fillRect(0, 0, w, h);
  header(ctx, 'THRUSTERS · AFT MANOEUVRING', w);
  ctx.strokeStyle = '#4d6b80';
  ctx.beginPath();
  ctx.moveTo(192, 30);
  ctx.lineTo(232, 60);
  ctx.lineTo(232, 220);
  ctx.lineTo(152, 220);
  ctx.lineTo(152, 60);
  ctx.closePath();
  ctx.stroke();
  const pos: Record<string, [number, number]> = { BT1: [192, 70], BT2: [192, 98], AZ1: [164, 204], AZ2: [220, 204] };
  dp.thrusters.forEach((t) => {
    const [x, y] = pos[t.id];
    const max = t.id.startsWith('AZ') ? 250e3 : 105e3;
    const f = Math.min(1, Math.abs(t.forceN) / max);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t.id.startsWith('AZ') ? t.angle : t.forceN >= 0 ? Math.PI / 2 : -Math.PI / 2);
    ctx.strokeStyle = t.failed ? '#d32f2f' : '#39e46b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -10 - 30 * f);
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#c7d3dc';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${t.id} ${Math.round(f * 100)}%`, x < 192 ? 20 : x > 192 ? 280 : 250, y + 4);
  });
}

/** Console section with its desk panel and display face trims, in the section's local frame (see bridgeConsole). */
function SectionShell({ s, geo, body, panel, bezel, outline }: { s: ConsoleSection; geo: THREE.BufferGeometry; body: THREE.Material; panel: THREE.Material; bezel: THREE.Material; outline: boolean }) {
  const [fd, fy] = lerp2(DISPLAY_FACE.top, DISPLAY_FACE.bottom, 0.5);
  const [dd, dy] = lerp2(DESK.back, DESK.front, 0.5);
  const faceLen = Math.hypot(DISPLAY_FACE.bottom[0] - DISPLAY_FACE.top[0], DISPLAY_FACE.bottom[1] - DISPLAY_FACE.top[1]);
  const deskLen = Math.hypot(DESK.front[0] - DESK.back[0], DESK.front[1] - DESK.back[1]);
  return (
    <>
      <EqMesh geometry={geo} material={body} outline={outline} name={`console-${s.name}`} />
      <mesh position={[0, fy, fd + 0.003]} rotation={[-FACE_TILT, 0, 0]} material={bezel}>
        <planeGeometry args={[s.length - 0.08, faceLen - 0.04]} />
      </mesh>
      <mesh position={[0, dy + 0.003, dd]} rotation={[-Math.PI / 2 + DESK_TILT, 0, 0]} material={panel}>
        <planeGeometry args={[s.length - 0.08, deskLen - 0.04]} />
      </mesh>
    </>
  );
}

/** Display set in the display face at `along` metres from the section centre; t = 0 top … 1 bottom of the face. */
function FaceDisplay({ along, t = 0.5, w = 0.56, h = 0.35, material, frame, name }: { along: number; t?: number; w?: number; h?: number; material: THREE.Material; frame: THREE.Material; name?: string }) {
  const [d, y] = lerp2(DISPLAY_FACE.top, DISPLAY_FACE.bottom, t);
  return (
    <group position={[along, y, d + 0.006]} rotation={[-FACE_TILT, 0, 0]} name={name}>
      <mesh material={frame}>
        <boxGeometry args={[w + 0.04, h + 0.04, 0.012]} />
      </mesh>
      <mesh material={material} position={[0, 0, 0.007]}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}

/** Group placed on the desk panel at `along` metres and fraction t from the back (0) to the nose (1). */
function OnDesk({ along, t, children, name }: { along: number; t: number; children: React.ReactNode; name?: string }) {
  const [d, y] = lerp2(DESK.back, DESK.front, t);
  return (
    <group position={[along, y + 0.004, d]} rotation={[DESK_TILT, 0, 0]} name={name}>
      {children}
    </group>
  );
}

/**
 * Integrated bridge system (IBS) and the bridge furniture of a DP2 offshore vessel.
 * Forward: a wraparound console under the front windows (centre section with the five MFWs of the Bridge Mate IBS
 * datasheet, propulsion levers, autopilot and the Z-Thrust BT1 panel; wings with GMDSS/VHF and alarm panels),
 * two navigator chairs at the conning position, overhead displays and the chart table.
 * Aft: console wings either side of the DP operator stations along the aft windows (aft manoeuvring levers, deck
 * cameras, winch and communication panels) and overhead repeaters facing the DP operators.
 * Only the IBS and DP items are named products; the rest is generic, unbranded bridge equipment.
 */
export function IntegratedBridge() {
  const handlers = useSelectable(ID);
  const { mats, visual } = useEquipmentMaterials(ID, {
    console: { color: '#3d444c', metalness: 0.3, roughness: 0.55 },
    panel: { color: '#1c2126', metalness: 0.25, roughness: 0.6 },
    bezel: { color: '#101316', metalness: 0.2, roughness: 0.35 },
    dark: { color: '#2f3a45', metalness: 0.4, roughness: 0.45 },
    desk: { color: '#1b2833', metalness: 0.3, roughness: 0.6 },
    key: { color: '#59626b', metalness: 0.2, roughness: 0.55 },
    accent: { color: '#2a74b8', metalness: 0.3, roughness: 0.5 },
    lever: { color: '#c9ced3', metalness: 0.7, roughness: 0.3 },
    red: { color: '#c42121', metalness: 0.2, roughness: 0.4 },
    upholstery: { color: '#1d2125', metalness: 0.05, roughness: 0.75 },
    frame: { color: '#8f979f', metalness: 0.7, roughness: 0.35 },
    grip: { color: '#121416', metalness: 0.2, roughness: 0.5 },
    wood: { color: '#6b5440', metalness: 0.1, roughness: 0.7 },
  });
  const o = visual.outline;
  const g = useMemo(
    () => ({
      fwdCentre: consoleSection(FWD_CONSOLE[1].length),
      fwdWing: consoleSection(FWD_CONSOLE[0].length),
      aftWing: consoleSection(AFT_CONSOLE[0].length),
      kbd: new THREE.BoxGeometry(0.42, 0.02, 0.15),
      ballCup: new THREE.CylinderGeometry(0.036, 0.04, 0.012, 16),
      ball: new THREE.SphereGeometry(0.028, 16, 10),
      // Lever unit: housing, lever and knob; the azimuth units add a steering ring.
      leverBase: new THREE.BoxGeometry(0.1, 0.035, 0.16),
      leverStick: new THREE.CylinderGeometry(0.008, 0.01, 0.13, 10),
      leverKnob: new THREE.SphereGeometry(0.022, 12, 8),
      aziRing: new THREE.TorusGeometry(0.06, 0.008, 6, 24).rotateX(Math.PI / 2),
      wheel: new THREE.TorusGeometry(0.14, 0.014, 8, 28),
      hub: new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12).rotateX(Math.PI / 2),
      smallPanel: new THREE.BoxGeometry(0.26, 0.02, 0.16),
      button: new THREE.CylinderGeometry(0.018, 0.018, 0.015, 12),
      handset: new THREE.CapsuleGeometry(0.02, 0.14, 4, 8).rotateZ(Math.PI / 2),
      cradle: new THREE.BoxGeometry(0.22, 0.03, 0.08),
      overhead: new THREE.BoxGeometry(7.6, 0.32, 0.25),
      overheadAft: new THREE.BoxGeometry(4.2, 0.3, 0.22),
      ohScreen: new THREE.PlaneGeometry(0.42, 0.24),
      hanger: new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
      table: new THREE.BoxGeometry(1.4, 0.92, 0.9),
      tableTop: new THREE.BoxGeometry(1.46, 0.04, 0.96),
      lampArm: new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8),
      lampHead: new THREE.ConeGeometry(0.07, 0.1, 12),
    }),
    [],
  );

  const screens = useMemo(() => MFW_LAYOUT.map(() => canvas()), []);
  const btScreen = useMemo(() => canvas(192, 120), []);
  const overhead = useMemo(() => Array.from({ length: 4 }, () => canvas(192, 110)), []);
  const aftOverhead = useMemo(() => Array.from({ length: 3 }, () => canvas(192, 110)), []);
  // Wing and aft displays: GMDSS, AIS/echo, alarms, bridge CCTV (fwd); deck CCTV, thruster mimic, CCTV, winches (aft).
  const pages = useMemo(() => Array.from({ length: 8 }, () => canvas()), []);
  const toMat = (c: ReturnType<typeof canvas>) => new THREE.MeshBasicMaterial({ map: c?.tex ?? null, color: c ? '#ffffff' : '#0aa7c4', toneMapped: false });
  const screenMats = useMemo(() => screens.map(toMat), [screens]);
  const btMat = useMemo(() => toMat(btScreen), [btScreen]);
  const ohMats = useMemo(() => overhead.map(toMat), [overhead]);
  const aftOhMats = useMemo(() => aftOverhead.map(toMat), [aftOverhead]);
  const pageMats = useMemo(() => pages.map(toMat), [pages]);
  useEffect(
    () => () => {
      Object.values(g).forEach((x) => x.dispose());
      [...screens, btScreen, ...overhead, ...aftOverhead, ...pages].forEach((c) => c?.tex.dispose());
      [...screenMats, btMat, ...ohMats, ...aftOhMats, ...pageMats].forEach((m) => m.dispose());
    },
    [g, screens, btScreen, overhead, aftOverhead, pages, screenMats, btMat, ohMats, aftOhMats, pageMats],
  );

  // Static pages: overhead repeaters and the wing / aft panels.
  useEffect(() => {
    const ohDraw = (c: ReturnType<typeof canvas>, label: string, value: string) => {
      if (!c) return;
      c.ctx.fillStyle = '#05090d';
      c.ctx.fillRect(0, 0, 192, 110);
      c.ctx.fillStyle = '#9fb3c2';
      c.ctx.font = '13px sans-serif';
      c.ctx.fillText(label, 10, 22);
      c.ctx.fillStyle = '#ffb000';
      c.ctx.font = 'bold 30px monospace';
      c.ctx.fillText(value, 10, 75);
      c.tex.needsUpdate = true;
    };
    ['GYRO', 'WIND', 'LOG', 'DEPTH'].forEach((l, i) => ohDraw(overhead[i], l, ['000.0', '20 kn', '0.0', '42 m'][i]));
    ['HEADING', 'WIND', 'DP'].forEach((l, i) => ohDraw(aftOverhead[i], l, ['000.0', '20 kn', 'STBY'][i]));
    const [gmdss, ais, alarm, bridgeCam, deckCam, , deckCam2, winch] = pages;
    if (gmdss) drawPage(gmdss.ctx, 'GMDSS · VHF / MF-HF', [['VHF 1', 'CH 16 · WATCH'], ['VHF 2', 'CH 13 · BRIDGE'], ['MF/HF DSC', 'READY'], ['NAVTEX', '0 NEW'], ['EPIRB', 'ARMED']]);
    if (ais) drawPage(ais.ctx, 'AIS · ECHO SOUNDER', [['AIS targets', '7'], ['Depth below keel', '37.2 m'], ['Speed log', '0.0 kn'], ['Wind (true)', '20 kn / 045°'], ['Air temp', '14 °C']]);
    if (alarm) drawPage(alarm.ctx, 'ALARMS · BNWAS', [['BNWAS', 'ARMED'], ['Fire detection', 'NORMAL'], ['Nav lights', 'ON · OK'], ['Steering gear', 'RUNNING'], ['Engine room', 'NO ALARMS']]);
    if (bridgeCam) drawCctv(bridgeCam.ctx, 'CAM 3 · FOREDECK', 0.5);
    if (deckCam) drawCctv(deckCam.ctx, 'CAM 1 · AFT DECK', 0);
    if (deckCam2) drawCctv(deckCam2.ctx, 'CAM 2 · STBD SIDE', 1);
    if (winch) drawPage(winch.ctx, 'DECK WINCHES · CARGO', [['Tugger PS', 'READY'], ['Tugger SB', 'READY'], ['Capstans', 'OFF'], ['Cargo pumps', 'STOPPED'], ['Deck lights', 'ON']]);
    [gmdss, ais, alarm, bridgeCam, deckCam, deckCam2, winch].forEach((c) => c && (c.tex.needsUpdate = true));
  }, [overhead, aftOverhead, pages]);

  const acc = useRef(1);
  const sweep = useRef(0);
  useFrame((_, dt) => {
    sweep.current += dt * 1.6;
    acc.current += dt;
    if (acc.current < 1 / qualityProfile(useAppStore.getState().quality).screenHz) return;
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
    const mimic = pages[5];
    if (mimic) {
      drawThrusterMimic(mimic.ctx, dp);
      mimic.tex.needsUpdate = true;
    }
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
    for (const c of [overhead[0], aftOverhead[0]]) {
      if (!c) continue;
      c.ctx.fillStyle = '#05090d';
      c.ctx.fillRect(0, 30, 192, 60);
      c.ctx.fillStyle = '#ffb000';
      c.ctx.font = 'bold 30px monospace';
      c.ctx.fillText(hdg.toFixed(1).padStart(5, '0'), 10, 75);
      c.tex.needsUpdate = true;
    }
    const dpRep = aftOverhead[2];
    if (dpRep) {
      dpRep.ctx.fillStyle = '#05090d';
      dpRep.ctx.fillRect(0, 30, 192, 60);
      dpRep.ctx.fillStyle = dp.dpLost ? '#ff4d4d' : dp.status === 'running' ? '#39e46b' : '#ffb000';
      dpRep.ctx.font = 'bold 24px monospace';
      dpRep.ctx.fillText(dp.dpLost ? 'LOST' : dp.status === 'running' ? dp.mode.replace('AUTO_', 'A-').replace('_', ' ') : 'STBY', 10, 72);
      dpRep.tex.needsUpdate = true;
    }
  });

  const kbd = (along: number) => (
    <OnDesk along={along} t={0.55}>
      <EqMesh geometry={g.kbd} material={mats.key} outline={o} position={[-0.05, 0.01, 0]} />
      <mesh geometry={g.ballCup} material={mats.bezel} position={[0.24, 0.006, 0]} />
      <mesh geometry={g.ball} material={mats.accent} position={[0.24, 0.016, 0]} />
    </OnDesk>
  );
  const lever = (along: number, t: number, azimuth: boolean, name: string, tilt = 0) => (
    <OnDesk along={along} t={t} name={name}>
      <EqMesh geometry={g.leverBase} material={mats.bezel} outline={o} position={[0, 0.017, 0]} />
      {azimuth && <mesh geometry={g.aziRing} material={mats.lever} position={[0, 0.04, 0]} />}
      <group position={[0, 0.035, 0]} rotation={[tilt, 0, 0]}>
        <mesh geometry={g.leverStick} material={mats.lever} position={[0, 0.065, 0]} />
        <mesh geometry={g.leverKnob} material={azimuth ? mats.lever : mats.red} position={[0, 0.13, 0]} />
      </group>
    </OnDesk>
  );
  const buttons = (along: number, t: number, n: number, mat: THREE.Material) => (
    <OnDesk along={along} t={t}>
      <mesh geometry={g.smallPanel} material={mats.panel} position={[0, 0.01, 0]} />
      {Array.from({ length: n }, (_, k) => (
        <mesh key={k} geometry={g.button} material={k === 0 ? mats.red : mat} position={[-0.09 + (k % 4) * 0.06, 0.025, -0.04 + Math.floor(k / 4) * 0.07]} />
      ))}
    </OnDesk>
  );
  const handset = (along: number, t: number) => (
    <OnDesk along={along} t={t} name="vhf-handset">
      <mesh geometry={g.cradle} material={mats.bezel} position={[0, 0.015, 0]} />
      <mesh geometry={g.handset} material={mats.grip} position={[0, 0.045, 0]} />
    </OnDesk>
  );
  const section = (s: ConsoleSection, geo: THREE.BufferGeometry, children: React.ReactNode) => (
    <group key={s.name} position={[s.x, FLOOR, s.z]} rotation={[0, s.yaw, 0]} name={s.name}>
      <SectionShell s={s} geo={geo} body={mats.console} panel={mats.panel} bezel={mats.bezel} outline={o} />
      {children}
    </group>
  );
  const chairMats = { upholstery: mats.upholstery, frame: mats.frame, panel: mats.panel, key: mats.key, grip: mats.grip, ball: mats.accent };
  const [fwdPort, fwdCentre, fwdStbd] = FWD_CONSOLE;
  const [aftPort, aftStbd] = AFT_CONSOLE;

  return (
    <group name={`equipment:${ID}`} {...handlers}>
      {/* Forward console: centre section seen from the conning position (yaw π, so local +x is to port) */}
      {section(
        fwdCentre,
        g.fwdCentre,
        <>
          {MFW_LAYOUT.map((m, i) => (
            <group key={i} name={`mfw-${i + 1}-${m.app}`}>
              <FaceDisplay along={-m.x} material={screenMats[i]} frame={mats.bezel} />
              {m.app !== 'conning' && kbd(-m.x)}
            </group>
          ))}
          {/* Conning position: autopilot with a small wheel, propulsion levers and the Z-Thrust BT1 panel */}
          <OnDesk along={0} t={0.62} name="autopilot-steering">
            <mesh geometry={g.smallPanel} material={mats.panel} position={[0, 0.01, 0]} />
            <group position={[0, 0.09, 0.02]} rotation={[-0.9, 0, 0]}>
              <EqMesh geometry={g.wheel} material={mats.grip} outline={o} />
              <mesh geometry={g.hub} material={mats.lever} />
            </group>
          </OnDesk>
          {lever(0.42, 0.45, true, 'az1-lever')}
          {lever(0.3, 0.45, true, 'az2-lever')}
          {lever(-0.3, 0.45, false, 'bt1-lever')}
          {lever(-0.42, 0.45, false, 'bt2-lever')}
          <OnDesk along={-0.62} t={0.4} name="zthrust-bt1-panel">
            <mesh geometry={g.smallPanel} material={mats.panel} position={[0, 0.01, 0]} />
            <mesh material={btMat} position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.22, 0.14]} />
            </mesh>
          </OnDesk>
          {buttons(0.68, 0.45, 8, mats.key)}
        </>,
      )}
      {section(
        fwdPort,
        g.fwdWing,
        <>
          <FaceDisplay along={0.45} w={0.48} h={0.3} material={pageMats[0]} frame={mats.bezel} name="gmdss-display" />
          <FaceDisplay along={-0.45} w={0.48} h={0.3} material={pageMats[1]} frame={mats.bezel} name="ais-echo-display" />
          {handset(0.45, 0.5)}
          {handset(0.15, 0.5)}
          {buttons(-0.45, 0.5, 8, mats.key)}
        </>,
      )}
      {section(
        fwdStbd,
        g.fwdWing,
        <>
          <FaceDisplay along={0.45} w={0.48} h={0.3} material={pageMats[2]} frame={mats.bezel} name="alarm-panel" />
          <FaceDisplay along={-0.45} w={0.48} h={0.3} material={pageMats[3]} frame={mats.bezel} name="cctv-forward" />
          {buttons(0.45, 0.5, 8, mats.accent)}
          {buttons(-0.45, 0.5, 4, mats.key)}
        </>,
      )}
      {/* Navigator chairs at the conning position, facing forward */}
      {[-0.8, 0.8].map((x) => (
        <group key={x} position={[x, FLOOR, fwdCentre.z - 1.75]}>
          <BridgeChair variant="nav" mats={chairMats} outline={o} />
        </group>
      ))}
      {/* Overhead console along the top of the front windows, displays facing aft */}
      <group position={[0, LEVEL.roof - 0.65, WHEELHOUSE_FRONT_Z - 0.6]}>
        <EqMesh geometry={g.overhead} material={mats.dark} outline={o} />
        {ohMats.map((m, i) => (
          <mesh key={i} geometry={g.ohScreen} material={m} position={[-2.4 + i * 1.6, 0, -0.13]} rotation={[0, Math.PI, 0]} />
        ))}
      </group>
      {/* Chart table on the port side, aft of the console, with its lamp */}
      <group position={[-5.6, FLOOR, 16.6]} name="chart-table">
        <EqMesh geometry={g.table} material={mats.wood} outline={o} position={[0, 0.46, 0]} />
        <mesh geometry={g.tableTop} material={mats.desk} position={[0, 0.94, 0]} />
        <mesh geometry={g.lampArm} material={mats.frame} position={[0.55, 1.24, -0.35]} />
        <mesh geometry={g.lampHead} material={mats.dark} position={[0.45, 1.52, -0.25]} rotation={[0.6, 0, 0.6]} />
      </group>

      {/* Aft console wings either side of the DP operator stations, facing the working deck */}
      {section(
        aftPort,
        g.aftWing,
        <>
          <FaceDisplay along={-0.45} w={0.48} h={0.3} material={pageMats[4]} frame={mats.bezel} name="cctv-aft-deck" />
          <FaceDisplay along={0.45} w={0.48} h={0.3} material={pageMats[5]} frame={mats.bezel} name="thruster-mimic" />
          {lever(0.28, 0.5, true, 'aft-az1-lever')}
          {lever(0.46, 0.5, true, 'aft-az2-lever')}
          {lever(0.64, 0.5, false, 'aft-bt1-lever')}
          {lever(0.8, 0.5, false, 'aft-bt2-lever')}
          {buttons(-0.45, 0.5, 8, mats.key)}
        </>,
      )}
      {section(
        aftStbd,
        g.aftWing,
        <>
          <FaceDisplay along={-0.45} w={0.48} h={0.3} material={pageMats[6]} frame={mats.bezel} name="cctv-side" />
          <FaceDisplay along={0.45} w={0.48} h={0.3} material={pageMats[7]} frame={mats.bezel} name="winch-panel" />
          {lever(-0.62, 0.5, false, 'tugger-ps-lever', 0.2)}
          {lever(-0.44, 0.5, false, 'tugger-sb-lever', -0.2)}
          {handset(-0.1, 0.5)}
          {buttons(0.45, 0.5, 8, mats.accent)}
        </>,
      )}
      {/* Overhead repeaters hung over the aft windows, facing the DP operators */}
      <group position={[0, LEVEL.roof - 0.75, WHEELHOUSE_AFT_Z + 0.45]} name="aft-overhead">
        <EqMesh geometry={g.overheadAft} material={mats.dark} outline={o} />
        {[-1.4, 1.4].map((x) => (
          <mesh key={x} geometry={g.hanger} material={mats.frame} position={[x, 0.3, 0]} />
        ))}
        {aftOhMats.map((m, i) => (
          <mesh key={i} geometry={g.ohScreen} material={m} position={[-1.4 + i * 1.4, 0, 0.12]} />
        ))}
      </group>
    </group>
  );
}
