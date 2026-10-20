import { LEVEL, WHEELHOUSE_AFT_Z } from '../vessels/vesselLayout';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';
import { useAppStore } from '../store/useAppStore';
import { MODE_STYLES } from '../rendering/modes';
import { qualityProfile, useQualityProfile } from '../rendering/quality';
import { dpSystem } from '../simulations/dpController';
import { useControllerState } from '../simulations/useController';
import { classLayout, DEFAULT_DP_PARAMS, headingDeg, positionError, type DPState } from '../simulations/dp';

const ID = 'dp-console-001';

/** Aft-facing DP station on the bridge (operators look over the aft working deck). */
export const DP_STATION: [number, number, number] = [0, LEVEL.bridge, WHEELHOUSE_AFT_Z + 0.95];
/** DP3 backup station in a separate A60 compartment one deck below. */
export const DP_BACKUP_ROOM = { min: [3.6, LEVEL.officers, 8.2] as const, max: [6.6, LEVEL.bridge - 0.15, 11.4] as const };

/**
 * 26" DP operator pedestal to the Marine Technologies GA drawing 5000-501092 (sheets 3 and 4) and the
 * supplied product photo. Overall 653.5 W × 685.9 D × 1204.25 H mm; desk front edge 766.96 mm; lower
 * cabinet 676 mm high. The upper unit is one side profile taken off the side view: a display housing
 * leaning back about 26° with the 26" screen in a silver-trimmed face, and a desk that slopes gently to a
 * rounded, trimmed nose carrying the DP panel (joystick, trackball, heading knob, keypads). The black lower
 * cabinet is set in from the desk on all sides, with a front door and two flush handles, and holds the 19"
 * rack (MT computers, PoE switch, DIN-rail breakers). Panel and rack detailing follow the drawing loosely.
 */
const MM = 0.001;
const W = 653.5 * MM;
const DEPTH = 685.9 * MM;
const TOP_Y = 1204.25 * MM;
const DESK_Y = 766.96 * MM;
const CAB_H = 676 * MM;
/** Lower cabinet footprint, measured off the side and rear views (set in from the desk); back/front in mm from the back. */
const CAB_W = 603 * MM;
const CAB_BACK = 54;
const CAB_FRONT = 611;
/** Distance from the back of the console, measured in the side view, to local z (front = +z). */
/** Overall dimensions in metres (drawing 5000-501092), exported for the drawing-conformance test. */
export const DP_PEDESTAL = { width: W, depth: DEPTH, height: TOP_Y, deskFront: DESK_Y, cabinet: CAB_H };
const zb = (mmFromBack: number) => (mmFromBack - DEPTH / MM / 2) * MM;

/** Side profile of the upper unit (display housing + desk), [mm from back, mm above floor]. */
export const PROFILE: [number, number][] = [
  [12, 676],
  [0, 692],
  [4, 722],
  [104, 754],
  [6, 1180],
  [16, 1200],
  [113, 1204.25],
  [306, 805],
  [593, 777],
  [648, 772],
  [674, 761],
  [685.9, 737],
  [682, 704],
  [668, 676],
];
/** Silver nose trim at the front of the desk. */
const NOSE: [number, number][] = [
  [588, 777.5],
  [648, 772],
  [674, 761],
  [685.9, 737],
  [682, 704],
  [668, 676],
  [588, 676],
];
/** Display face: from the top front corner down to where it meets the desk. */
const FACE_TOP: [number, number] = [113, 1204.25];
const FACE_BOT: [number, number] = [306, 805];
const FACE_LEN = Math.hypot(FACE_BOT[0] - FACE_TOP[0], FACE_BOT[1] - FACE_TOP[1]) * MM;
const FACE_TILT = Math.atan2(FACE_BOT[0] - FACE_TOP[0], FACE_TOP[1] - FACE_BOT[1]);
/** Desk top, behind the nose: slopes about 5.6° down towards the operator. */
const DESK_A: [number, number] = [306, 805];
const DESK_B: [number, number] = [593, 777];
const DESK_TILT = Math.atan2(DESK_A[1] - DESK_B[1], DESK_B[0] - DESK_A[0]);

/** Extrude a side profile across the console width; profile x runs back→front (local +z), y is height. */
function extrudeProfile(pts: [number, number][], width: number, bevel = 0.004) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(zb(x), y * MM)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(width - 2 * bevel) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Point on a profile segment, as [local z, y]. */
const along = (a: [number, number], b: [number, number], t: number): [number, number] => [zb(a[0] + (b[0] - a[0]) * t), (a[1] + (b[1] - a[1]) * t) * MM];

/** Layout units for the HMI drawing; the canvas itself is smaller (texture uploads dominate on slow GPUs). */
const SCREEN_W = 640;
const SCREEN_H = 400;
const CANVAS_SCALE = 0.8;

/** DP operator display in the style of the supplied photo: light-grey HMI, green soft keys, polar position plot. */
function drawDPScreen(ctx: CanvasRenderingContext2D, s: DPState, idx: number) {
  const w = SCREEN_W;
  const h = SCREEN_H;
  ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0);
  const running = s.status === 'running';
  const lost = s.dpLost;
  ctx.fillStyle = '#c9cdc9';
  ctx.fillRect(0, 0, w, h);
  // Header: station, class, date line and the mode banner.
  ctx.fillStyle = '#1b1e22';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(`DP OS${idx + 1} · CLASS ${s.dpClass}`, 64, 14);
  ctx.font = '10px sans-serif';
  ctx.fillText(`SIM ${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`, 64, 27);
  ctx.fillStyle = lost ? '#c62828' : running ? '#1d4f9a' : '#5b6670';
  ctx.fillRect(200, 4, 150, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(lost ? 'DP LOST' : running ? s.mode.replace('_', ' ') : 'STANDBY', 210, 20);
  // Left column of green soft keys.
  const keys = ['AUTO POS', 'AUTO HDG', 'JOYSTICK', 'STANDBY', 'THRUST', 'REFS'];
  const active = !running ? 'STANDBY' : s.mode === 'AUTO_POSITION' ? 'AUTO POS' : s.mode === 'AUTO_HEADING' ? 'AUTO HDG' : s.mode === 'JOYSTICK' ? 'JOYSTICK' : '';
  keys.forEach((k, i) => {
    const y = 40 + i * 40;
    ctx.fillStyle = k === active ? '#16c216' : '#3ad13a';
    ctx.fillRect(4, y, 52, 32);
    ctx.strokeStyle = k === active ? '#ffffff' : '#1d6b1d';
    ctx.lineWidth = k === active ? 2 : 1;
    ctx.strokeRect(4.5, y + 0.5, 51, 31);
    ctx.fillStyle = '#05220a';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(k, 8, y + 20);
  });
  // Polar position plot.
  const cx = 180;
  const cy = 215;
  const r = 128;
  ctx.fillStyle = '#eef0ee';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9aa29a';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * i) / 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let a = 0; a < 360; a += 30) {
    const t = (a * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(t) * r, cy - Math.cos(t) * r);
    ctx.stroke();
  }
  const R = 60;
  const k = r / R;
  const psi = s.eta[2];
  const pts = [
    [40, 0],
    [30, 9],
    [-40, 9],
    [-40, -9],
    [30, -9],
  ].map(([x, y]) => {
    const n = s.est[0] - s.setpoint[0] + x * Math.cos(psi) - y * Math.sin(psi);
    const e = s.est[1] - s.setpoint[1] + x * Math.sin(psi) + y * Math.cos(psi);
    return [cx + e * k, cy - n * k];
  });
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.strokeStyle = lost ? '#c62828' : '#1b1e22';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#d32f2f';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();
  ctx.fillStyle = '#1b1e22';
  ctx.font = '10px sans-serif';
  ctx.fillText('N', cx - 3, cy - r - 4);
  // Environment dials.
  const dial = (x: number, label: string, deg: number, value: string) => {
    ctx.fillStyle = '#e3e6e3';
    ctx.fillRect(x, 34, 62, 70);
    ctx.strokeStyle = '#7d857d';
    ctx.strokeRect(x + 0.5, 34.5, 61, 69);
    ctx.beginPath();
    ctx.arc(x + 31, 64, 20, 0, Math.PI * 2);
    ctx.stroke();
    const t = (deg * Math.PI) / 180;
    ctx.strokeStyle = '#1d4f9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 31, 64);
    ctx.lineTo(x + 31 + Math.sin(t) * 18, 64 - Math.cos(t) * 18);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#1b1e22';
    ctx.font = '9px sans-serif';
    ctx.fillText(label, x + 4, 44);
    ctx.fillText(value, x + 4, 100);
  };
  dial(330, 'WIND', s.wind.fromDeg, `${s.wind.speedKn.toFixed(0)} kn`);
  dial(398, 'HEADING', headingDeg(s.eta[2]), `${headingDeg(s.eta[2]).toFixed(1)}°`);
  dial(466, 'CURRENT', 0, `${s.current.speedKn.toFixed(1)} kn`);
  // Readouts.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(330, 112, 198, 44);
  ctx.strokeStyle = '#7d857d';
  ctx.strokeRect(330.5, 112.5, 197, 43);
  ctx.fillStyle = '#1b1e22';
  ctx.font = '11px monospace';
  ctx.fillText(`POS ERR  ${positionError(s).toFixed(1)} m`, 338, 130);
  ctx.fillText(`ALARMS   ${s.alarms.length}`, 338, 148);
  // Thrusters: green blocks with demand bars, red when failed.
  ctx.fillStyle = '#1b1e22';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('THRUSTERS', 330, 176);
  ctx.strokeStyle = '#4b6aa0';
  ctx.beginPath();
  ctx.moveTo(330, 182);
  ctx.lineTo(600, 182);
  ctx.stroke();
  s.thrusters.forEach((t, i) => {
    const x = 334 + i * 68;
    const max = DEFAULT_DP_PARAMS.thrusters[i].maxN;
    const f = Math.min(1, Math.abs(t.forceN) / max);
    ctx.fillStyle = t.failed ? '#d32f2f' : t.available ? '#22c322' : '#b8a13a';
    ctx.fillRect(x, 192, 56, 56);
    ctx.strokeStyle = '#0d3d0d';
    ctx.strokeRect(x + 0.5, 192.5, 55, 55);
    ctx.fillStyle = '#05220a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(t.id, x + 4, 206);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 8, 238, 40, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 8, 238, 40 * f, 6);
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#05220a';
    ctx.fillText(`${Math.round(f * 100)}%`, x + 4, 230);
  });
  // Status line.
  ctx.fillStyle = '#9da59d';
  ctx.fillRect(0, h - 22, w, 22);
  ctx.fillStyle = '#1b1e22';
  ctx.font = '10px sans-serif';
  ctx.fillText(s.alarms.length ? `⚠ ${s.alarms[s.alarms.length - 1]}`.slice(0, 90) : 'No active alarms', 8, h - 7);
}

function useDPScreens(count: number) {
  const screens = useMemo(
    () =>
      Array.from({ length: 3 }, () => {
        if (typeof document === 'undefined') return { mat: new THREE.MeshBasicMaterial({ color: '#0b2a3d' }), ctx: null, tex: null };
        const c = document.createElement('canvas');
        c.width = SCREEN_W * CANVAS_SCALE;
        c.height = SCREEN_H * CANVAS_SCALE;
        const ctx = c.getContext('2d');
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return { mat: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), ctx, tex };
      }),
    [],
  );
  useEffect(
    () => () =>
      screens.forEach((s) => {
        s.tex?.dispose();
        s.mat.dispose();
      }),
    [screens],
  );
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < Math.max(0.25, 1 / qualityProfile(useAppStore.getState().quality).screenHz)) return; // ≤4 Hz is plenty for a DP display
    acc.current = 0;
    const st = dpSystem.getState();
    screens.slice(0, count).forEach((s, i) => {
      if (!s.ctx || !s.tex) return;
      drawDPScreen(s.ctx, st, i);
      s.tex.needsUpdate = true;
    });
  });
  return screens.map((s) => s.mat);
}

export function DPConsole() {
  const handlers = useSelectable(ID);
  const dp = useControllerState(dpSystem);
  const lay = classLayout(dp.dpClass);
  const { mats, visual } = useEquipmentMaterials(ID, {
    body: { color: '#141619', metalness: 0.25, roughness: 0.55 },
    trim: { color: '#a3aab1', metalness: 0.85, roughness: 0.3 },
    bezel: { color: '#0b0c0e', metalness: 0.2, roughness: 0.25 },
    panel: { color: '#1d2023', metalness: 0.3, roughness: 0.6 },
    key: { color: '#3d4247', metalness: 0.2, roughness: 0.55 },
    keyLight: { color: '#d5d9dc', metalness: 0.1, roughness: 0.5 },
    knob: { color: '#ecebe6', metalness: 0.1, roughness: 0.35 },
    ball: { color: '#c42121', metalness: 0.2, roughness: 0.2 },
    handle: { color: '#30353a', metalness: 0.6, roughness: 0.4 },
    rack: { color: '#3b444c', metalness: 0.6, roughness: 0.4 },
    unit: { color: '#596470', metalness: 0.6, roughness: 0.35 },
    accent: { color: '#2a74b8', metalness: 0.3, roughness: 0.5 },
    breaker: { color: '#e9e9e4', metalness: 0.1, roughness: 0.6 },
    chair: { color: '#22272c', metalness: 0.2, roughness: 0.7 },
    cabinet: { color: '#2b3036', metalness: 0.4, roughness: 0.5 },
  });
  const explode = useAppStore((s) => MODE_STYLES[s.visualMode].explode && s.selectedId === ID);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const screenMats = useDPScreens(lay.operatorStations);
  const radial = useQualityProfile().radialSegments;

  const g = useMemo(() => {
    const cabD = (CAB_FRONT - CAB_BACK) * MM;
    const t = 0.018;
    // Keys and breakers are merged per material: dozens of tiny parts, a handful of draw calls.
    const key = new THREE.BoxGeometry(0.022, 0.008, 0.016);
    const oval = new THREE.CapsuleGeometry(0.006, 0.012, 4, 8).rotateX(Math.PI / 2);
    const breaker = new THREE.BoxGeometry(0.018, 0.085, 0.06);
    const at = (src: THREE.BufferGeometry, x: number, y: number, z: number) => src.clone().translate(x, y, z);
    const light: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    for (const [x, z] of [
      [-0.205, -0.055],
      [-0.205, 0.095],
      [-0.27, 0.02],
      [-0.14, 0.02],
    ])
      light.push(at(key, x, 0.004, z));
    for (let k = 0; k < 12; k++) (k % 4 === 0 ? light : dark).push(at(oval, -0.105 + (k % 6) * 0.03, 0.004, -0.07 + Math.floor(k / 6) * 0.03));
    for (let k = 0; k < 12; k++) (k === 9 || k === 11 ? dark : light).push(at(key, 0.125 + (k % 3) * 0.028, 0.004, -0.075 + Math.floor(k / 3) * 0.024));
    const keysLight = mergeGeometries(light)!;
    const keysDark = mergeGeometries(dark)!;
    const breakers = mergeGeometries(Array.from({ length: 8 }, (_, b) => at(breaker, -0.17 + b * 0.022, 0.2, 0.16)))!;
    [key, oval, breaker, ...light, ...dark].forEach((x) => x.dispose());
    return {
      keysLight,
      keysDark,
      breakers,
      upper: extrudeProfile(PROFILE, W),
      nose: extrudeProfile(NOSE, W + 0.004, 0.003),
      // Display face: silver trim, black bezel, 26" (16:10) active area.
      faceTrim: new THREE.BoxGeometry(W + 0.006, FACE_LEN, 0.01),
      faceBezel: new THREE.BoxGeometry(W - 0.05, FACE_LEN - 0.05, 0.01),
      screen: new THREE.PlaneGeometry(0.56, 0.35),
      // Lower cabinet as panels so the open door shows the rack.
      cabSide: new THREE.BoxGeometry(t, CAB_H, cabD),
      cabBack: new THREE.BoxGeometry(CAB_W - 2 * t, CAB_H, t),
      cabBase: new THREE.BoxGeometry(CAB_W - 2 * t, 0.02, cabD - t),
      door: new THREE.BoxGeometry(CAB_W - 0.006, CAB_H - 0.012, t),
      doorPanel: new THREE.BoxGeometry(CAB_W - 0.09, CAB_H - 0.17, 0.004),
      handle: new THREE.BoxGeometry(0.07, 0.05, 0.012),
      handleRecess: new THREE.BoxGeometry(0.05, 0.03, 0.004),
      // Desk DP panel.
      dpPanel: new THREE.BoxGeometry(0.583, 0.012, 0.217),
      panelTrim: new THREE.BoxGeometry(0.595, 0.008, 0.229),
      bootBase: new THREE.CylinderGeometry(0.04, 0.05, 0.02, radial),
      boot: new THREE.CylinderGeometry(0.016, 0.034, 0.04, radial),
      stick: new THREE.CylinderGeometry(0.011, 0.013, 0.06, 12),
      grip: new THREE.CapsuleGeometry(0.019, 0.045, 4, radial),
      gripTop: new THREE.CylinderGeometry(0.02, 0.02, 0.006, radial),
      knob: new THREE.CylinderGeometry(0.022, 0.024, 0.026, radial),
      knobRing: new THREE.TorusGeometry(0.032, 0.004, 6, radial).rotateX(Math.PI / 2),
      ballCup: new THREE.CylinderGeometry(0.034, 0.038, 0.012, radial),
      ball: new THREE.SphereGeometry(0.026, radial, Math.max(8, radial / 2)),
      // 19" rack (drawing sheet 3): rails, connector plate, two computers, PoE switch, DIN rail breakers.
      rail: new THREE.BoxGeometry(0.02, CAB_H - 0.06, 0.03),
      shelf: new THREE.BoxGeometry(0.46, 0.012, 0.42),
      connPlate: new THREE.BoxGeometry(0.46, 0.09, 0.01),
      rackUnit: new THREE.BoxGeometry(0.44, 0.09, 0.38),
      dinRail: new THREE.BoxGeometry(0.44, 0.035, 0.02),
      // Chair and DP cabinet.
      seat: new THREE.BoxGeometry(0.52, 0.1, 0.5),
      back: new THREE.BoxGeometry(0.5, 0.62, 0.08),
      post: new THREE.CylinderGeometry(0.035, 0.045, 0.42, 12),
      leg: new THREE.BoxGeometry(0.04, 0.03, 0.34),
      cab: new THREE.BoxGeometry(0.6, 1.9, 0.6),
      cabDoor: new THREE.BoxGeometry(0.52, 1.7, 0.01),
      a60: new THREE.BoxGeometry(DP_BACKUP_ROOM.max[0] - DP_BACKUP_ROOM.min[0], DP_BACKUP_ROOM.max[1] - DP_BACKUP_ROOM.min[1], DP_BACKUP_ROOM.max[2] - DP_BACKUP_ROOM.min[2]),
    };
  }, [radial]);
  const a60Mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f2c94c', transparent: true, opacity: 0.12, depthWrite: false }), []);
  const a60Edges = useMemo(() => new THREE.EdgesGeometry(g.a60), [g]);
  const a60LineMat = useMemo(() => new THREE.LineBasicMaterial({ color: '#f2c94c', toneMapped: false }), []);
  const ledMats = useMemo(
    () => ({
      green: new THREE.MeshBasicMaterial({ color: '#39e46b' }),
      amber: new THREE.MeshBasicMaterial({ color: '#ffb02e' }),
      blue: new THREE.MeshBasicMaterial({ color: '#4aa3ff' }),
    }),
    [],
  );
  const led = useMemo(() => new THREE.BoxGeometry(0.008, 0.003, 0.004), []);
  useEffect(
    () => () => {
      Object.values(g).forEach((x) => x.dispose());
      Object.values(ledMats).forEach((m) => m.dispose());
      led.dispose();
      a60Mat.dispose();
      a60Edges.dispose();
      a60LineMat.dispose();
    },
    [g, ledMats, led, a60Mat, a60Edges, a60LineMat],
  );

  // Exploded view: the door swings open, the rack slides out of it and the upper unit lifts off.
  const rackRefs = useRef<(THREE.Group | null)[]>([]);
  const topRefs = useRef<(THREE.Group | null)[]>([]);
  const doorRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
    const ex = explode ? 1 : 0;
    rackRefs.current.forEach((r) => r && (r.position.z += (ex * 0.62 - r.position.z) * k));
    topRefs.current.forEach((r) => r && (r.position.y += (ex * 0.45 - r.position.y) * k));
    doorRefs.current.forEach((r) => r && (r.rotation.y += (ex * -1.9 - r.rotation.y) * k));
  });

  const o = visual.outline;
  const cabZ0 = zb(CAB_BACK);
  const cabZ1 = zb(CAB_FRONT);
  const cabZc = (cabZ0 + cabZ1) / 2;
  const [faceZ, faceY] = along(FACE_TOP, FACE_BOT, 0.5);
  const [deskZ, deskY] = along(DESK_A, DESK_B, 0.6);

  const pedestal = (i: number, screenMat: THREE.Material) => (
    <group>
      {/* Lower cabinet: sides, back and base, set in from the desk */}
      <group name="lower-cabinet">
        <EqMesh geometry={g.cabSide} material={mats.body} outline={o} position={[-CAB_W / 2 + 0.009, CAB_H / 2, cabZc]} />
        <EqMesh geometry={g.cabSide} material={mats.body} outline={o} position={[CAB_W / 2 - 0.009, CAB_H / 2, cabZc]} />
        <EqMesh geometry={g.cabBack} material={mats.body} outline={o} position={[0, CAB_H / 2, cabZ0 + 0.009]} />
        <EqMesh geometry={g.cabBase} material={mats.body} outline={o} position={[0, 0.01, cabZc + 0.009]} />
      </group>
      {/* Front door, hinged on the operator's left, with two flush handles under the desk */}
      <group
        ref={(el) => {
          doorRefs.current[i] = el;
        }}
        position={[-CAB_W / 2, 0, cabZ1 - 0.009]}
        name="cabinet-door"
      >
        <EqMesh geometry={g.door} material={mats.body} outline={o} position={[CAB_W / 2, CAB_H / 2, 0]} />
        <mesh geometry={g.doorPanel} material={mats.bezel} position={[CAB_W / 2, CAB_H / 2 - 0.04, 0.008]} />
        {[-0.17, 0.17].map((x) => (
          <group key={x} position={[CAB_W / 2 + x, CAB_H - 0.11, 0.012]}>
            <mesh geometry={g.handle} material={mats.handle} />
            <mesh geometry={g.handleRecess} material={mats.bezel} position={[0, 0, 0.006]} />
          </group>
        ))}
      </group>
      {/* 19" rack on its telescoping shelf (drawing sheet 3) */}
      <group
        ref={(el) => {
          rackRefs.current[i] = el;
        }}
        name="19in-rack"
      >
        <EqMesh geometry={g.rail} material={mats.rack} outline={o} position={[-0.235, CAB_H / 2, cabZ1 - 0.06]} />
        <EqMesh geometry={g.rail} material={mats.rack} outline={o} position={[0.235, CAB_H / 2, cabZ1 - 0.06]} />
        <EqMesh geometry={g.shelf} material={mats.rack} outline={o} position={[0, 0.14, cabZc + 0.02]} />
        <group position={[0, 0, cabZc + 0.02]}>
          <EqMesh geometry={g.dinRail} material={mats.rack} outline={o} position={[0, 0.2, 0.17]} name="din-rail-breakers" />
          <mesh geometry={g.breakers} material={mats.breaker} />
          <EqMesh geometry={g.rackUnit} material={mats.rack} outline={o} position={[0, 0.3, 0]} name="poe-switch" />
          <EqMesh geometry={g.rackUnit} material={mats.unit} outline={o} position={[0, 0.4, 0]} name="dp-control-computer" />
          <EqMesh geometry={g.rackUnit} material={mats.unit} outline={o} position={[0, 0.5, 0]} name="mt-computer-100" />
          <EqMesh geometry={g.connPlate} material={mats.rack} outline={o} position={[0, 0.6, 0.19]} name="connector-plate" />
          {[0.3, 0.4, 0.5].map((y, k) => (
            <mesh key={y} geometry={led} material={k === 0 ? ledMats.amber : ledMats.blue} position={[0.18, y + 0.02, 0.192]} />
          ))}
        </group>
      </group>
      {/* Upper unit: display housing and desk in one side profile, lifted off in exploded view */}
      <group
        ref={(el) => {
          topRefs.current[i] = el;
        }}
        name="upper-unit"
      >
        <EqMesh geometry={g.upper} material={mats.body} outline={o} name="display-housing-and-desk" />
        <EqMesh geometry={g.nose} material={mats.trim} outline={o} name="desk-nose-trim" />
        <group position={[0, faceY, faceZ]} rotation={[-FACE_TILT, 0, 0]} name="display-26in">
          <EqMesh geometry={g.faceTrim} material={mats.trim} outline={o} position={[0, 0, 0.002]} />
          <mesh geometry={g.faceBezel} material={mats.bezel} position={[0, 0, 0.006]} />
          <mesh geometry={g.screen} material={screenMat} position={[0, 0.012, 0.0115]} />
        </group>
        {/* DP panel: heading knob and arrow keys (left), joystick (centre), keypad and trackball (right) */}
        <group position={[0, deskY + 0.001, deskZ]} rotation={[DESK_TILT, 0, 0]} name="dp-panel">
          <mesh geometry={g.panelTrim} material={mats.handle} position={[0, 0.004, 0]} />
          <EqMesh geometry={g.dpPanel} material={mats.panel} outline={o} position={[0, 0.01, 0]} />
          <group position={[0, 0.016, 0]}>
            <mesh geometry={g.knobRing} material={mats.trim} position={[-0.205, 0.002, 0.02]} />
            <EqMesh geometry={g.knob} material={mats.knob} outline={o} position={[-0.205, 0.013, 0.02]} name="heading-knob" />
            <mesh geometry={g.keysLight} material={mats.keyLight} name="keys" />
            <mesh geometry={g.keysDark} material={mats.key} />
            {Array.from({ length: 6 }, (_, k) => (
              <mesh key={k} geometry={led} material={k < 2 ? ledMats.green : ledMats.amber} position={[-0.105 + k * 0.03, 0.006, -0.088]} />
            ))}
            <group position={[0.03, 0, 0.03]} name="dp-joystick">
              <mesh geometry={g.bootBase} material={mats.handle} position={[0, 0.01, 0]} />
              <mesh geometry={g.boot} material={mats.bezel} position={[0, 0.04, 0]} />
              <mesh geometry={g.stick} material={mats.bezel} position={[0, 0.085, 0]} />
              <EqMesh geometry={g.grip} material={mats.bezel} outline={o} position={[0, 0.14, 0]} />
              <mesh geometry={g.gripTop} material={mats.key} position={[0, 0.185, 0]} />
            </group>
            <mesh geometry={g.ballCup} material={mats.bezel} position={[0.24, 0.002, 0.045]} />
            <EqMesh geometry={g.ball} material={mats.ball} outline={o} position={[0.24, 0.012, 0.045]} name="trackball" />
          </group>
        </group>
      </group>
    </group>
  );

  const xs = lay.operatorStations === 1 ? [0] : [-0.335, 0.335];
  return (
    <group name={`equipment:${ID}`} {...handlers}>
      <group position={DP_STATION}>
        {xs.map((x, i) => (
          <group key={i} position={[x, 0, 0]} name={`dp-operator-station-${i + 1}`}>
            {pedestal(i, screenMats[i])}
          </group>
        ))}
        {/* Operator chair behind the station */}
        <group position={[0, 0, 1.15]} name="dp-chair">
          {Array.from({ length: 5 }, (_, k) => (
            <group key={k} rotation={[0, (k * Math.PI * 2) / 5, 0]}>
              <mesh geometry={g.leg} material={mats.rack} position={[0, 0.03, 0.16]} />
            </group>
          ))}
          <EqMesh geometry={g.post} material={mats.rack} outline={o} position={[0, 0.25, 0]} />
          <EqMesh geometry={g.seat} material={mats.chair} outline={o} position={[0, 0.5, 0]} />
          <EqMesh geometry={g.back} material={mats.chair} outline={o} position={[0, 0.88, 0.24]} rotation={[-0.12, 0, 0]} />
        </group>
        {/* DP cabinet: third controller (DP2/3), network switches and UPS */}
        {lay.controllers > 1 && (
          <group position={[2.4, 0.95, -0.05]} name="dp-cabinet">
            <EqMesh geometry={g.cab} material={mats.cabinet} outline={o} />
            <mesh geometry={g.cabDoor} material={mats.body} position={[0, 0, 0.301]} />
          </group>
        )}
      </group>
      {lay.backupStation && (
        <group name="dp3-backup-a60-room">
          <mesh
            geometry={g.a60}
            material={a60Mat}
            position={[(DP_BACKUP_ROOM.min[0] + DP_BACKUP_ROOM.max[0]) / 2, (DP_BACKUP_ROOM.min[1] + DP_BACKUP_ROOM.max[1]) / 2, (DP_BACKUP_ROOM.min[2] + DP_BACKUP_ROOM.max[2]) / 2]}
          />
          <lineSegments
            geometry={a60Edges}
            material={a60LineMat}
            position={[(DP_BACKUP_ROOM.min[0] + DP_BACKUP_ROOM.max[0]) / 2, (DP_BACKUP_ROOM.min[1] + DP_BACKUP_ROOM.max[1]) / 2, (DP_BACKUP_ROOM.min[2] + DP_BACKUP_ROOM.max[2]) / 2]}
          />
          <group position={[5.1, DP_BACKUP_ROOM.min[1], 9.4]} name="dp-operator-station-3-backup">
            {pedestal(2, screenMats[2])}
          </group>
        </group>
      )}
    </group>
  );
}
