import { LEVEL, WHEELHOUSE_AFT_Z } from '../vessels/vesselLayout';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';
import { useAppStore } from '../store/useAppStore';
import { MODE_STYLES } from '../rendering/modes';
import { activeQualityProfile } from '../rendering/quality';
import { dpSystem } from '../simulations/dpController';
import { useControllerState } from '../simulations/useController';
import { classLayout, DEFAULT_DP_PARAMS, headingDeg, positionError, type DPState } from '../simulations/dp';
import { readableInWorld } from '../scene/vesselTransform';

const ID = 'dp-console-001';

/** Aft-facing DP station on the bridge (operators look over the aft working deck). */
export const DP_STATION: [number, number, number] = [0, LEVEL.bridge, WHEELHOUSE_AFT_Z + 0.95];
/** DP3 backup station in a separate A60 compartment one deck below. */
export const DP_BACKUP_ROOM = { min: [3.6, LEVEL.officers, 8.2] as const, max: [6.6, LEVEL.bridge - 0.15, 11.4] as const };

/**
 * 26" DP operator pedestal, after the Console II drawing (5000-501092): 654 mm wide, 1206 mm high,
 * 797 mm to the desk. Lower 19" rack holds the MT computer, DP control and operator computers,
 * PoE switch and DIN-rail breakers on a telescoping shelf; the DP panel with joystick and trackball
 * sits on the desk; the 26" display above. Dimensions are from the drawing, detailing is representative.
 */
const W = 0.654;
const DESK_Y = 0.797;
const TOP_Y = 1.206;
const DEPTH = 0.62;

function drawDPScreen(ctx: CanvasRenderingContext2D, s: DPState, idx: number) {
  const w = 512;
  const h = 320;
  ctx.fillStyle = '#071a2e';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#12345a';
  ctx.fillRect(0, 0, w, 26);
  ctx.fillStyle = '#e6edf2';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`DP OS${idx + 1} · CLASS ${s.dpClass}`, 10, 18);
  const lost = s.dpLost;
  ctx.fillStyle = lost ? '#c62828' : s.status === 'running' ? '#2e7d32' : '#455a64';
  ctx.fillRect(w - 120, 4, 112, 18);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(lost ? 'DP LOST' : s.status === 'running' ? s.mode.replace('_', ' ') : 'STANDBY', w - 114, 17);
  // Position plot
  const cx = 150;
  const cy = 175;
  const r = 120;
  ctx.strokeStyle = '#1f3b57';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * i) / 4, 0, Math.PI * 2);
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
  ctx.fillStyle = 'rgba(95,200,255,0.18)';
  ctx.strokeStyle = lost ? '#e04444' : '#e6edf2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f2c94c';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);
  ctx.stroke();
  // Readouts
  ctx.fillStyle = '#9fb3c2';
  ctx.font = '13px monospace';
  const rows: [string, string][] = [
    ['POS ERR', `${positionError(s).toFixed(1)} m`],
    ['HEADING', `${headingDeg(s.eta[2]).toFixed(1)}°`],
    ['WIND', `${s.wind.speedKn.toFixed(0)} kn ${s.wind.fromDeg.toFixed(0)}°`],
    ['CURRENT', `${s.current.speedKn.toFixed(1)} kn`],
  ];
  rows.forEach(([a, b], i) => {
    ctx.fillStyle = '#9fb3c2';
    ctx.fillText(a, 300, 60 + i * 22);
    ctx.fillStyle = '#e6edf2';
    ctx.fillText(b, 390, 60 + i * 22);
  });
  // Thruster bars
  s.thrusters.forEach((t, i) => {
    const x = 305 + i * 50;
    const max = DEFAULT_DP_PARAMS.thrusters[i].maxN;
    const f = Math.min(1, Math.abs(t.forceN) / max);
    ctx.strokeStyle = '#3f6f99';
    ctx.strokeRect(x, 170, 30, 110);
    ctx.fillStyle = t.failed ? '#c62828' : t.available ? '#5fc8ff' : '#8a6d12';
    ctx.fillRect(x + 3, 277 - 104 * f, 24, 104 * f);
    ctx.fillStyle = '#e6edf2';
    ctx.font = '11px monospace';
    ctx.fillText(t.id, x + 3, 297);
  });
  if (s.alarms.length) {
    ctx.fillStyle = '#f2c94c';
    ctx.font = '12px monospace';
    ctx.fillText(`⚠ ${s.alarms.length} ALARM${s.alarms.length > 1 ? 'S' : ''}`, 300, 150);
  }
}

function useDPScreens(count: number) {
  const screens = useMemo(
    () =>
      Array.from({ length: 3 }, () => {
        if (typeof document === 'undefined') return { mat: new THREE.MeshBasicMaterial({ color: '#0b2a3d' }), ctx: null, tex: null };
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 320;
        const ctx = c.getContext('2d');
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        readableInWorld(tex);
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
    if (acc.current < Math.max(0.25, 1 / activeQualityProfile().screenHz)) return; // ≤4 Hz is plenty for a DP display
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
    body: { color: '#d4d8dc', metalness: 0.35, roughness: 0.5 },
    side: { color: '#2f3a45', metalness: 0.4, roughness: 0.45 },
    panel: { color: '#1b2833', metalness: 0.3, roughness: 0.6 },
    rack: { color: '#3b444c', metalness: 0.6, roughness: 0.4 },
    unit: { color: '#596470', metalness: 0.6, roughness: 0.35 },
    accent: { color: '#2a74b8', metalness: 0.3, roughness: 0.5 },
    chair: { color: '#22272c', metalness: 0.2, roughness: 0.7 },
  });
  const explode = useAppStore((s) => MODE_STYLES[s.visualMode].explode && s.selectedId === ID);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const screenMats = useDPScreens(lay.operatorStations);

  const g = useMemo(
    () => ({
      cabinet: new THREE.BoxGeometry(W, DESK_Y - 0.06, DEPTH),
      plinth: new THREE.BoxGeometry(W - 0.04, 0.06, DEPTH - 0.04),
      desk: new THREE.BoxGeometry(W, 0.05, 0.42),
      dpPanel: new THREE.BoxGeometry(W - 0.08, 0.02, 0.34),
      sideUpper: new THREE.BoxGeometry(0.03, TOP_Y - DESK_Y, 0.3),
      bezel: new THREE.BoxGeometry(W, TOP_Y - DESK_Y - 0.02, 0.06),
      screen: new THREE.PlaneGeometry(0.575, 0.36),
      rackUnit: new THREE.BoxGeometry(0.48, 0.09, 0.42),
      rackUnitTall: new THREE.BoxGeometry(0.48, 0.18, 0.42),
      dinRail: new THREE.BoxGeometry(0.44, 0.06, 0.08),
      shelf: new THREE.BoxGeometry(0.5, 0.015, 0.45),
      stickBase: new THREE.CylinderGeometry(0.045, 0.055, 0.03, 16),
      stick: new THREE.CylinderGeometry(0.014, 0.018, 0.12, 10),
      knob: new THREE.SphereGeometry(0.03, 14, 10),
      ball: new THREE.SphereGeometry(0.035, 14, 10),
      key: new THREE.BoxGeometry(0.028, 0.012, 0.028),
      seat: new THREE.BoxGeometry(0.55, 0.12, 0.55),
      back: new THREE.BoxGeometry(0.55, 0.65, 0.1),
      post: new THREE.CylinderGeometry(0.05, 0.08, 0.45, 12),
      cab: new THREE.BoxGeometry(0.6, 1.9, 0.6),
      a60: new THREE.BoxGeometry(DP_BACKUP_ROOM.max[0] - DP_BACKUP_ROOM.min[0], DP_BACKUP_ROOM.max[1] - DP_BACKUP_ROOM.min[1], DP_BACKUP_ROOM.max[2] - DP_BACKUP_ROOM.min[2]),
    }),
    [],
  );
  const a60Mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f2c94c', transparent: true, opacity: 0.12, depthWrite: false }), []);
  const a60Edges = useMemo(() => new THREE.EdgesGeometry(g.a60), [g]);
  const a60LineMat = useMemo(() => new THREE.LineBasicMaterial({ color: '#f2c94c', toneMapped: false }), []);
  useEffect(
    () => () => {
      Object.values(g).forEach((x) => x.dispose());
      a60Mat.dispose();
      a60Edges.dispose();
      a60LineMat.dispose();
    },
    [g, a60Mat, a60Edges, a60LineMat],
  );

  // Exploded view: rack shelf slides out, display lifts, upper side plates move out.
  const rackRefs = useRef<(THREE.Group | null)[]>([]);
  const topRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
    const ex = explode ? 1 : 0;
    rackRefs.current.forEach((r) => r && (r.position.z += (ex * 0.75 - r.position.z) * k));
    topRefs.current.forEach((r) => r && (r.position.y += (ex * 0.5 - r.position.y) * k));
  });

  const o = visual.outline;
  const pedestal = (i: number, screenMat: THREE.Material) => (
    <group>
      <EqMesh geometry={g.plinth} material={mats.side} outline={o} position={[0, 0.03, 0]} />
      <EqMesh geometry={g.cabinet} material={mats.body} outline={o} position={[0, 0.06 + (DESK_Y - 0.06) / 2, 0]} name="lower-cabinet" />
      {/* 19" rack contents on the telescoping shelf, visible through the open front in exploded view */}
      <group
        ref={(el) => {
          rackRefs.current[i] = el;
        }}
        name="19in-rack"
      >
        <EqMesh geometry={g.shelf} material={mats.rack} outline={o} position={[0, 0.16, 0.12]} />
        <EqMesh geometry={g.rackUnitTall} material={mats.unit} outline={o} position={[0, 0.27, 0.12]} name="mt-computer-100" />
        <EqMesh geometry={g.rackUnit} material={mats.accent} outline={o} position={[0, 0.42, 0.12]} name="dp-control-computer" />
        <EqMesh geometry={g.rackUnit} material={mats.unit} outline={o} position={[0, 0.52, 0.12]} name="dp-operator-computer" />
        <EqMesh geometry={g.rackUnit} material={mats.rack} outline={o} position={[0, 0.62, 0.12]} name="poe-switch" />
        <EqMesh geometry={g.dinRail} material={mats.side} outline={o} position={[0, 0.71, 0.3]} name="din-rail-breakers" />
      </group>
      {/* Desk and DP panel (joystick, trackball, mode keys) */}
      <group position={[0, DESK_Y, 0.12]} rotation={[0.18, 0, 0]}>
        <EqMesh geometry={g.desk} material={mats.side} outline={o} position={[0, 0.025, 0]} />
        <EqMesh geometry={g.dpPanel} material={mats.panel} outline={o} position={[0, 0.06, 0]} name="dp-panel" />
        <EqMesh geometry={g.stickBase} material={mats.rack} outline={o} position={[0.02, 0.08, 0]} />
        <EqMesh geometry={g.stick} material={mats.rack} outline={o} position={[0.02, 0.14, 0]} name="dp-joystick" />
        <EqMesh geometry={g.knob} material={mats.side} outline={o} position={[0.02, 0.21, 0]} />
        <EqMesh geometry={g.ball} material={mats.accent} outline={o} position={[0.2, 0.08, 0.05]} name="trackball" />
        {Array.from({ length: 8 }, (_, k) => (
          <EqMesh key={k} geometry={g.key} material={k < 4 ? mats.accent : mats.unit} outline={o} position={[-0.25 + (k % 4) * 0.045, 0.075, -0.06 + Math.floor(k / 4) * 0.05]} />
        ))}
      </group>
      {/* 26" display between the upper side plates */}
      <group
        ref={(el) => {
          topRefs.current[i] = el;
        }}
      >
        <EqMesh geometry={g.sideUpper} material={mats.side} outline={o} position={[-W / 2 + 0.015, DESK_Y + (TOP_Y - DESK_Y) / 2, -0.12]} />
        <EqMesh geometry={g.sideUpper} material={mats.side} outline={o} position={[W / 2 - 0.015, DESK_Y + (TOP_Y - DESK_Y) / 2, -0.12]} />
        <group position={[0, DESK_Y + (TOP_Y - DESK_Y) / 2 + 0.01, -0.15]} rotation={[-0.12, 0, 0]}>
          <EqMesh geometry={g.bezel} material={mats.side} outline={o} name="display-26in" />
          <mesh geometry={g.screen} material={screenMat} position={[0, 0, 0.031]} />
        </group>
      </group>
    </group>
  );

  const xs = lay.operatorStations === 1 ? [0] : [-0.39, 0.39];
  return (
    <group name={`equipment:${ID}`} {...handlers}>
      <group position={DP_STATION}>
        {xs.map((x, i) => (
          <group key={i} position={[x, 0, 0]} name={`dp-operator-station-${i + 1}`}>
            {pedestal(i, screenMats[i])}
          </group>
        ))}
        {/* Operator chair behind the station */}
        <group position={[0, 0, 1.2]} name="dp-chair">
          <EqMesh geometry={g.post} material={mats.rack} outline={o} position={[0, 0.25, 0]} />
          <EqMesh geometry={g.seat} material={mats.chair} outline={o} position={[0, 0.52, 0]} />
          <EqMesh geometry={g.back} material={mats.chair} outline={o} position={[0, 0.9, 0.25]} rotation={[-0.12, 0, 0]} />
        </group>
        {/* DP cabinet: third controller (DP2/3), network switches and UPS */}
        {lay.controllers > 1 && <EqMesh geometry={g.cab} material={mats.body} outline={o} position={[2.4, 0.95, -0.05]} name="dp-cabinet" />}
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
