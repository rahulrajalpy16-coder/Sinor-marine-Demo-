import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getEquipment } from './registry';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';

const ID = 'dp-console-001';

/** Draws an illustrative DP display (position plot and heading rose) into a texture. */
function makeScreenTexture(kind: 'plot' | 'thrusters'): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#021622';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = '#00d9ff';
  ctx.fillStyle = '#67f0ff';
  ctx.lineWidth = 2;
  if (kind === 'plot') {
    for (const r of [20, 40, 60]) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(128, 80, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(128, 62);
    ctx.lineTo(136, 92);
    ctx.lineTo(120, 92);
    ctx.closePath();
    ctx.fill();
    ctx.font = '12px monospace';
    ctx.fillText('HDG 045.0', 8, 18);
    ctx.fillText('POS ERR 0.4 m', 8, 152);
  } else {
    ctx.font = '12px monospace';
    ['BT1', 'AZ1', 'AZ2'].forEach((n, i) => {
      const x = 30 + i * 75;
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(x, 30, 40, 100);
      ctx.globalAlpha = 1;
      const h = [55, 70, 64][i];
      ctx.fillRect(x + 4, 130 - h, 32, h - 4);
      ctx.fillText(n, x + 8, 148);
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Representative DP operator station on the bridge. Screens face aft, towards the operator. */
export function DPConsole() {
  const eq = getEquipment(ID)!;
  const [, , tz] = eq.placement.target;
  const handlers = useSelectable(ID);
  const { mats, visual } = useEquipmentMaterials(ID, {
    body: { color: '#2b3540', metalness: 0.5, roughness: 0.5 },
    trim: { color: '#9aa6b2', metalness: 0.7, roughness: 0.3 },
  });
  const geo = useMemo(
    () => ({
      base: new THREE.BoxGeometry(2.6, 0.95, 0.9),
      desk: new THREE.BoxGeometry(2.6, 0.08, 0.75),
      pod: new THREE.BoxGeometry(2.6, 0.75, 0.12),
      stick: new THREE.CylinderGeometry(0.03, 0.04, 0.22, 8),
      knob: new THREE.SphereGeometry(0.06, 12, 8),
      screen: new THREE.PlaneGeometry(0.78, 0.48),
    }),
    [],
  );
  const screens = useMemo(() => {
    const plot = makeScreenTexture('plot');
    const thr = makeScreenTexture('thrusters');
    const mk = (map: THREE.Texture | null) =>
      new THREE.MeshBasicMaterial({ map, color: map ? '#ffffff' : '#0aa7c4', toneMapped: false });
    return [mk(thr), mk(plot), mk(thr)];
  }, []);
  useEffect(
    () => () => {
      Object.values(geo).forEach((x) => x.dispose());
      screens.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    },
    [geo, screens],
  );

  const o = visual.outline;
  return (
    <group name={`equipment:${ID}`} position={[0, 9, tz]} {...handlers}>
      <EqMesh geometry={geo.base} material={mats.body} outline={o} position={[0, 0.475, 0]} />
      <EqMesh geometry={geo.desk} material={mats.trim} outline={o} position={[0, 0.99, -0.2]} rotation={[-0.25, 0, 0]} />
      <EqMesh geometry={geo.pod} material={mats.body} outline={o} position={[0, 1.42, 0.32]} rotation={[0.28, 0, 0]} />
      {screens.map((m, i) => (
        <mesh key={i} geometry={geo.screen} material={m} position={[(i - 1) * 0.84, 1.42, 0.25]} rotation={[0.28, Math.PI, 0]} />
      ))}
      <EqMesh geometry={geo.stick} material={mats.trim} outline={o} position={[0.75, 1.12, -0.3]} />
      <EqMesh geometry={geo.knob} material={mats.trim} outline={o} position={[0.75, 1.24, -0.3]} />
    </group>
  );
}
