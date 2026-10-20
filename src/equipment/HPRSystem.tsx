import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useEquipmentMaterials, useSelectable } from '../interactions/useSelectable';
import { EqMesh } from './EqMesh';
import { useAppStore } from '../store/useAppStore';
import { MODE_STYLES } from '../rendering/modes';
import { CYAN } from '../rendering/materials';
import { useQualityProfile } from '../rendering/quality';
import { hprDeployment } from '../simulations/deploymentController';
import { hprReady } from '../simulations/deployment';
import { HPR_AXIS, HPR_DATUM_Y, SEABED_Y, TRANSPONDER, pingProgress, transceiverFace } from '../simulations/acoustic';
import { HPT5000, PARKED_PLATE_Y, POLE_LENGTH, T7950, TOP_SUPPORT_THICK, transceiverY } from './hprData';

const MACHINE = 'deployment-001';
const HPT = 'hpr-001';

// Heights in the machine frame (Y = 0 at the drawing datum, top of the hull penetrator).
const D = {
  hull: -T7950.penetratorHeight.value,
  gateTop: T7950.gateStackTop.value,
  chestTop: T7950.seachestTop.value,
  sealMid: T7950.sealingFlange.value,
  topBase: T7950.topSectionBase.value,
  top: T7950.overall.value,
};
const W = {
  top: T7950.topSectionWidth.value,
  chest: T7950.seachestWidth.value,
  seal: T7950.sealingWidth.value,
  pole: T7950.poleDiameter.value,
  flange: T7950.gateFlangeDiameter.value,
  wheel: T7950.handwheelDiameter.value,
  stem: T7950.handwheelStem.value,
};
// Mounting space: 1.8 m along the ship (z), 1.0 m athwartships (x), from the bottom plating up.
const SPACE = { w: T7950.mountingSpace.width.value, d: T7950.mountingSpace.depth.value, h: T7950.mountingSpace.height.value };
const FWD = T7950.axisFromForwardWall.value;
const SPACE_Z: [number, number] = [FWD - SPACE.w, FWD];
/**
 * Inspection door on the seachest's starboard face. The component drawing shows a bolted cover over most of the
 * face; its size, bolt count and hinge side are not dimensioned (assumed). The opening runs from just above the
 * adaptor flange, so the parked transceiver (face 50 mm above the gate) is in view when the door is open.
 */
const DOOR = { y0: T7950.gateStackTop.value + 0.06, y1: T7950.seachestTop.value - 0.12, w: 0.4, get h() { return this.y1 - this.y0; }, get y() { return (this.y0 + this.y1) / 2; } };
const DOOR_OPEN_RAD = -Math.PI * 0.97;
const DOOR_BOLTS: [number, number][] = (() => {
  const out: [number, number][] = [];
  const [hy, hz] = [DOOR.h / 2 + 0.02, DOOR.w / 2 + 0.02];
  for (let k = 0; k <= 6; k++) out.push([-hy + (2 * hy * k) / 6, -hz], [-hy + (2 * hy * k) / 6, hz]);
  for (let k = 1; k < 3; k++) out.push([-hy, -hz + (2 * hz * k) / 3], [hy, -hz + (2 * hz * k) / 3]);
  return out;
})();

/** Seachest walls (open box) from y = 0 up, with the door opening cut in the +x face. */
function seachestShell(h: number) {
  const w = W.chest;
  const t = 0.02;
  const parts: THREE.BufferGeometry[] = [];
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => parts.push(new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z).toNonIndexed());
  box(t, h, w, -w / 2 + t / 2, h / 2, 0);
  box(w - 2 * t, h, t, 0, h / 2, -w / 2 + t / 2);
  box(w - 2 * t, h, t, 0, h / 2, w / 2 - t / 2);
  // Starboard face around the opening (y measured from the chest base at the gate stack top).
  const o0 = DOOR.y0 - T7950.gateStackTop.value - 0.04;
  const o1 = DOOR.y1 - T7950.gateStackTop.value - 0.04;
  box(t, o0, w, w / 2 - t / 2, o0 / 2, 0);
  box(t, h - o1, w, w / 2 - t / 2, (h + o1) / 2, 0);
  const side = (w - DOOR.w) / 2;
  box(t, o1 - o0, side, w / 2 - t / 2, (o0 + o1) / 2, -w / 2 + side / 2);
  box(t, o1 - o0, side, w / 2 - t / 2, (o0 + o1) / 2, w / 2 - side / 2);
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** Raised frame round the door opening, against which the cover bolts down. */
function doorFrame() {
  const parts: THREE.BufferGeometry[] = [];
  const t = 0.03;
  const [h, w] = [DOOR.h, DOOR.w];
  parts.push(new THREE.BoxGeometry(0.02, t, w + 2 * t).translate(0.01, h / 2 + t / 2, 0).toNonIndexed());
  parts.push(new THREE.BoxGeometry(0.02, t, w + 2 * t).translate(0.01, -h / 2 - t / 2, 0).toNonIndexed());
  parts.push(new THREE.BoxGeometry(0.02, h, t).translate(0.01, 0, w / 2 + t / 2).toNonIndexed());
  parts.push(new THREE.BoxGeometry(0.02, h, t).translate(0.01, 0, -w / 2 - t / 2).toNonIndexed());
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

// Explode: stack sections apart along the axis (gate valve stays on the hull).
const EXPLODE = { chest: 0.45, seal: 0.9, top: 1.5 };

function useExploded(id: string) {
  return useAppStore((s) => MODE_STYLES[s.visualMode].explode && s.selectedId === id);
}

function smooth(cur: number, target: number, dt: number, reduced: boolean) {
  return reduced ? target : cur + (target - cur) * (1 - Math.exp(-dt * 6));
}

/**
 * Sonardyne Type 7950 through-hull deployment machine, standard length, in its 6.1 × 1.8 × 1.0 m
 * mounting space: hull penetrator, 14" gate valve with handwheel, adaptor flange, seachest with
 * inspection door, sealing section, and the top section (top support, moving plate, main ram inside
 * the pole, guides). Proportions follow the supplied drawings; see hprData.ts for sources.
 */
export function Type7950Machine() {
  const handlers = useSelectable(MACHINE);
  const { mats, visual } = useEquipmentMaterials(MACHINE, {
    frame: { color: '#9aa3ab', metalness: 0.75, roughness: 0.35 },
    pole: { color: '#4a5058', metalness: 0.8, roughness: 0.3 },
    valve: { color: '#c0261d', metalness: 0.45, roughness: 0.45 },
    flange: { color: '#6d747b', metalness: 0.8, roughness: 0.3 },
    chest: { color: '#a7adb3', metalness: 0.6, roughness: 0.45 },
    primer: { color: '#c3c7c9', metalness: 0.1, roughness: 0.75 },
    ram: { color: '#d7dde2', metalness: 0.95, roughness: 0.12 },
    ladder: { color: '#c9b37a', metalness: 0.5, roughness: 0.5 },
    plate: { color: '#5b636b', metalness: 0.6, roughness: 0.6 },
  });
  const o = visual.outline;
  const radial = useQualityProfile().radialSegments;
  const explode = useExploded(MACHINE);
  const reduced = useAppStore((s) => s.reducedMotion);
  const mode = useAppStore((s) => s.visualMode);
  const selected = useAppStore((s) => s.selectedId === MACHINE || s.hoveredId === MACHINE);

  // In X-ray and blueprint the pole turns translucent so the main ram inside it shows.
  useEffect(() => {
    const see = mode === 'xray' || mode === 'blueprint';
    const m = mats.pole as THREE.MeshStandardMaterial;
    if (!visual.ghost) {
      m.transparent = see;
      m.opacity = see ? 0.3 : 1;
      m.depthWrite = !see;
      m.needsUpdate = true;
    }
  }, [mode, mats, visual.ghost]);

  const g = useMemo(() => {
    const chestH = D.chestTop - D.gateTop;
    const sealH = D.topBase - D.chestTop;
    const guideH = D.top - TOP_SUPPORT_THICK - D.topBase;
    return {
      base: new THREE.BoxGeometry(SPACE.d + 0.1, 0.03, SPACE.w + 0.1),
      penetrator: new THREE.CylinderGeometry(0.178, 0.178, T7950.penetratorHeight.value + 0.05, radial),
      gateFlange: new THREE.CylinderGeometry(W.flange / 2, W.flange / 2, 0.035, radial),
      gateBody: new THREE.CylinderGeometry(W.flange / 2 - 0.05, W.flange / 2 - 0.05, 0.16, radial),
      bonnet: new THREE.BoxGeometry(0.34, 0.15, 0.5),
      stem: new THREE.CylinderGeometry(0.02, 0.02, W.stem, 8).rotateX(Math.PI / 2),
      wheel: new THREE.TorusGeometry(W.wheel / 2, 0.018, 8, radial).rotateY(0),
      spoke: new THREE.BoxGeometry(W.wheel, 0.02, 0.02),
      gate: new THREE.BoxGeometry(0.38, 0.03, 0.4),
      adaptor: new THREE.CylinderGeometry(W.flange / 2 - 0.03, W.flange / 2 - 0.03, 0.06, radial),
      chest: seachestShell(chestH - 0.08),
      chestInside: new THREE.BoxGeometry(W.chest - 0.05, chestH - 0.1, W.chest - 0.05).scale(-1, 1, 1),
      bore: new THREE.CircleGeometry(0.17, radial).rotateX(-Math.PI / 2),
      chestFlange: new THREE.BoxGeometry(W.chest + 0.08, 0.04, W.chest + 0.08),
      door: new THREE.BoxGeometry(0.022, DOOR.h + 0.08, DOOR.w + 0.08),
      doorFrame: doorFrame(),
      bolt: new THREE.CylinderGeometry(0.011, 0.011, 0.014, 6).rotateZ(Math.PI / 2),
      doorHandle: new THREE.TorusGeometry(0.045, 0.008, 6, 12, Math.PI).rotateY(Math.PI / 2),
      seal: new THREE.BoxGeometry(W.seal, sealH - 0.08, W.seal),
      sealFlange: new THREE.BoxGeometry(W.seal + 0.07, 0.04, W.seal + 0.07),
      topBase: new THREE.BoxGeometry(W.seal + 0.1, 0.06, W.top),
      topSupport: new THREE.BoxGeometry(W.seal + 0.1, TOP_SUPPORT_THICK, W.top),
      guide: new THREE.BoxGeometry(0.06, guideH, 0.1),
      movingPlate: new THREE.BoxGeometry(W.seal + 0.06, 0.06, W.top - 0.04),
      pole: new THREE.CylinderGeometry(W.pole / 2, W.pole / 2, POLE_LENGTH, radial),
      ram: new THREE.CylinderGeometry(0.06, 0.06, guideH - 0.2, Math.max(10, radial / 2)),
      rail: new THREE.CylinderGeometry(0.02, 0.02, SPACE.h - 0.2, 8),
      rung: new THREE.CylinderGeometry(0.014, 0.014, 0.44, 6).rotateZ(Math.PI / 2),
      grating: new THREE.BoxGeometry(SPACE.d - 0.04, 0.03, 0.85),
      gridTop: new THREE.PlaneGeometry(SPACE.d - 0.04, 0.85, 12, 10).rotateX(-Math.PI / 2),
      envelope: new THREE.EdgesGeometry(new THREE.BoxGeometry(SPACE.d, SPACE.h, SPACE.w)),
    };
  }, [radial]);
  const lineMats = useMemo(
    () => ({
      envelope: new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.55, toneMapped: false }),
      grid: new THREE.MeshBasicMaterial({ color: '#c9b37a', wireframe: true, transparent: true, opacity: 0.6 }),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(g).forEach((x) => x.dispose());
      Object.values(lineMats).forEach((m) => m.dispose());
    },
    [g, lineMats],
  );

  const top = useRef<THREE.Group>(null);
  const seal = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Group>(null);
  const gate = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const door = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    const s = hprDeployment.getState();
    const ex = explode ? 1 : 0;
    if (top.current) top.current.position.y = smooth(top.current.position.y, ex * EXPLODE.top, dt, reduced);
    if (seal.current) seal.current.position.y = smooth(seal.current.position.y, ex * EXPLODE.seal, dt, reduced);
    if (chest.current) chest.current.position.y = smooth(chest.current.position.y, ex * EXPLODE.chest, dt, reduced);
    // Moving plate and pole follow the pole travel.
    if (plate.current) plate.current.position.y = PARKED_PLATE_Y - s.travel;
    // Gate slides into the bonnet (aft, -z) as the valve opens; the handwheel turns with it.
    if (gate.current) gate.current.position.z = -s.valveOpen * 0.42;
    if (wheel.current) wheel.current.rotation.z = s.valveOpen * Math.PI * 8;
    // The door folds right back along the starboard face (the mounting space leaves no room to swing it into).
    if (door.current) door.current.rotation.y = smooth(door.current.rotation.y, s.doorOpen ? DOOR_OPEN_RAD : 0, dt, reduced);
  });

  const chestMid = (D.gateTop + D.chestTop) / 2;
  const sealMid = (D.chestTop + D.topBase) / 2;
  const guideMid = (D.topBase + D.top - TOP_SUPPORT_THICK) / 2;
  const guideZ = W.top / 2 - 0.07;
  const rungs = Math.floor((SPACE.h - 0.4) / 0.3);
  const ladderZ = SPACE_Z[0] + 0.1;

  return (
    <group name={`equipment:${MACHINE}`} position={[HPR_AXIS.x, HPR_DATUM_Y, HPR_AXIS.z]} {...handlers}>
      {/* Mounting space envelope 6.1 × 1.8 × 1.0 m, base plate, ladder and platform grating */}
      <lineSegments
        geometry={g.envelope}
        material={lineMats.envelope}
        position={[0, D.hull + SPACE.h / 2, (SPACE_Z[0] + SPACE_Z[1]) / 2]}
        visible={(selected && mode !== 'realistic') || mode === 'xray' || mode === 'blueprint'}
      />
      <EqMesh geometry={g.base} material={mats.plate} outline={false} position={[0, D.hull + 0.015, (SPACE_Z[0] + SPACE_Z[1]) / 2]} />
      <group name="ladder" position={[0, D.hull + 0.1 + (SPACE.h - 0.2) / 2, ladderZ]}>
        <EqMesh geometry={g.rail} material={mats.ladder} outline={false} position={[-0.22, 0, 0]} />
        <EqMesh geometry={g.rail} material={mats.ladder} outline={false} position={[0.22, 0, 0]} />
        {Array.from({ length: rungs }, (_, i) => (
          <mesh key={i} geometry={g.rung} material={mats.ladder} position={[0, -(SPACE.h - 0.2) / 2 + 0.3 + i * 0.3, 0]} />
        ))}
      </group>
      <group name="grating" position={[0, D.hull + T7950.gratingHeight.value, SPACE_Z[0] + 0.45]}>
        <mesh geometry={g.grating} material={mats.plate} />
        <mesh geometry={g.gridTop} material={lineMats.grid} position={[0, 0.02, 0]} />
      </group>

      {/* Hull penetrator (150 mm above the plating) and the gate valve stack (290 mm) */}
      <EqMesh geometry={g.penetrator} material={mats.flange} outline={o} position={[0, D.hull / 2 - 0.025, 0]} name="hull-penetrator" />
      <group name="gate-valve">
        <EqMesh geometry={g.gateFlange} material={mats.valve} outline={o} position={[0, 0.0175, 0]} />
        <EqMesh geometry={g.gateBody} material={mats.valve} outline={o} position={[0, 0.115, 0]} />
        <EqMesh geometry={g.bonnet} material={mats.valve} outline={o} position={[0, 0.115, -0.42]} />
        <EqMesh geometry={g.stem} material={mats.flange} outline={false} position={[0, 0.115, -0.42 - W.stem / 2]} />
        <group ref={wheel} position={[0, 0.115, -0.42 - W.stem]}>
          <mesh geometry={g.wheel} material={mats.valve} />
          <mesh geometry={g.spoke} material={mats.valve} />
          <mesh geometry={g.spoke} material={mats.valve} rotation={[0, 0, Math.PI / 2]} />
        </group>
        <group ref={gate} name="gate">
          <mesh geometry={g.gate} material={mats.flange} position={[0, 0.115, 0]} />
        </group>
        <EqMesh geometry={g.gateFlange} material={mats.valve} outline={o} position={[0, 0.2125, 0]} />
        <EqMesh geometry={g.adaptor} material={mats.flange} outline={o} position={[0, D.gateTop - 0.03, 0]} name="adaptor-flange" />
      </group>

      {/* Seachest: a hollow service section with a bolted inspection door on its starboard face (hinged on the aft
          edge, folding back along the face). With the transceiver parked and the gate valve closed, the open door shows the HPT 5000 inside. */}
      <group ref={chest} name="seachest">
        <EqMesh geometry={g.chestFlange} material={mats.flange} outline={o} position={[0, D.gateTop + 0.02, 0]} />
        <EqMesh geometry={g.chest} material={mats.chest} outline={o} position={[0, D.gateTop + 0.04, 0]} />
        <mesh geometry={g.chestInside} material={mats.primer} position={[0, chestMid, 0]} name="seachest-interior" />
        <mesh geometry={g.bore} material={mats.pole} position={[0, D.gateTop + 0.053, 0]} name="valve-bore" />
        <EqMesh geometry={g.doorFrame} material={mats.flange} outline={o} position={[W.chest / 2, DOOR.y, 0]} name="door-frame" />
        <EqMesh geometry={g.chestFlange} material={mats.flange} outline={o} position={[0, D.chestTop - 0.02, 0]} />
        <group ref={door} position={[W.chest / 2 + 0.024, DOOR.y, -DOOR.w / 2 - 0.04]}>
          <group position={[0.011, 0, DOOR.w / 2 + 0.04]}>
            <EqMesh geometry={g.door} material={mats.chest} outline={o} name="inspection-door" />
            {DOOR_BOLTS.map(([y, z], k) => (
              <mesh key={k} geometry={g.bolt} material={mats.flange} position={[0.016, y, z]} />
            ))}
            {[-1, 1].map((k) => (
              <mesh key={k} geometry={g.doorHandle} material={mats.flange} position={[0.012, k * DOOR.h * 0.3, 0]} />
            ))}
          </group>
        </group>
      </group>

      {/* Sealing section with its intermediate flange */}
      <group ref={seal} name="sealing-section">
        <EqMesh geometry={g.seal} material={mats.chest} outline={o} position={[0, sealMid, 0]} />
        <EqMesh geometry={g.sealFlange} material={mats.flange} outline={o} position={[0, D.chestTop + 0.02, 0]} />
        <EqMesh geometry={g.sealFlange} material={mats.flange} outline={o} position={[0, D.sealMid, 0]} />
      </group>

      {/* Top section: base plate, guides, top support, main ram; moving plate carries the pole */}
      <group ref={top} name="top-section">
        <EqMesh geometry={g.topBase} material={mats.frame} outline={o} position={[0, D.topBase + 0.03, 0]} />
        <EqMesh geometry={g.guide} material={mats.frame} outline={o} position={[0, guideMid, guideZ]} name="guide" />
        <EqMesh geometry={g.guide} material={mats.frame} outline={o} position={[0, guideMid, -guideZ]} name="guide" />
        <EqMesh geometry={g.topSupport} material={mats.frame} outline={o} position={[0, D.top - TOP_SUPPORT_THICK / 2, 0]} name="top-support" />
        <mesh geometry={g.ram} material={mats.ram} position={[0, D.top - TOP_SUPPORT_THICK - (g.ram.parameters.height / 2), 0]} name="main-ram" />
        <group ref={plate} position={[0, PARKED_PLATE_Y, 0]}>
          <EqMesh geometry={g.movingPlate} material={mats.flange} outline={o} name="moving-plate" />
          <EqMesh geometry={g.pole} material={mats.pole} outline={o} position={[0, -POLE_LENGTH / 2, 0]} name="pole" />
        </group>
      </group>
    </group>
  );
}

/**
 * Sonardyne HPT 5000 USBL transceiver (8142-000-01), drawn from the UM-8142 description inside the manual's
 * 322 × 225 mm envelope (§3.3, §4.3.1, §4.5): an aluminium bronze housing slid over the electronics chassis and
 * secured to the metal base plate of the transducer face assembly with six bolts; the black polyurethane acoustic
 * face at the bottom; the underwater connector in the top; the mounting flange (210 mm PCD, 155 mm bore on the
 * adaptor side) bolted through the 6G kit's isolation flange ring to the end of the 7950 pole; a white
 * forward-pointing arrow on the transducer and a machined groove as the second forward mark.
 * The split of the 322 mm between flange, housing, base plate and face, and the bolt count on the flange, are
 * not dimensioned in the supplied documents (assumed proportions).
 */
export const HPT_PARTS = { flange: 0.022, body: 0.19, base: 0.015, face: 0.095, bodyR: 0.095 } as const;

/** Black transducer section: straight side, rounded lower edge, shallow dome (hemispherical-coverage array). */
function transducerProfile(R: number, h: number) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, 0), new THREE.Vector2(R, 0), new THREE.Vector2(R, -h * 0.55)];
  const rc = 0.022;
  for (let k = 1; k <= 6; k++) {
    const a = (k / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - rc + rc * Math.cos(a), -h * 0.55 - rc * Math.sin(a)));
  }
  const y0 = -h * 0.55 - rc;
  for (let k = 1; k <= 8; k++) {
    const t = k / 8;
    pts.push(new THREE.Vector2(Math.max(0.001, (R - rc) * (1 - t)), y0 - (h + y0) * (1 - (1 - t) * (1 - t))));
  }
  return pts;
}

export function HPT5000Transceiver() {
  const handlers = useSelectable(HPT);
  const { mats, visual } = useEquipmentMaterials(HPT, {
    bronze: { color: '#b98d4b', metalness: 0.85, roughness: 0.3 },
    bronzeDark: { color: '#8d6a36', metalness: 0.8, roughness: 0.4 },
    face: { color: '#15181b', metalness: 0.05, roughness: 0.55 },
    isolator: { color: '#e7e2d6', metalness: 0.1, roughness: 0.7 },
    bolt: { color: '#c9ccce', metalness: 0.9, roughness: 0.3 },
    connector: { color: '#2b2f33', metalness: 0.6, roughness: 0.4 },
  });
  const o = visual.outline;
  const radial = useQualityProfile().radialSegments;
  const explodeTop = useExploded(MACHINE);
  const reduced = useAppStore((s) => s.reducedMotion);
  const R = HPT5000.diameter.value / 2;
  const P = HPT_PARTS;
  const g = useMemo(() => {
    const ring = (r: number, n: number, y: number, src: THREE.BufferGeometry) =>
      mergeGeometries(Array.from({ length: n }, (_, k) => src.clone().translate(r * Math.cos(((k + 0.5) * 2 * Math.PI) / n), y, r * Math.sin(((k + 0.5) * 2 * Math.PI) / n)).toNonIndexed()))!;
    const head = new THREE.CylinderGeometry(0.008, 0.008, 0.008, 6);
    return {
      isolator: new THREE.CylinderGeometry(W.pole / 2 + 0.01, W.pole / 2 + 0.01, 0.03, radial),
      flange: new THREE.CylinderGeometry(R, R, P.flange, radial),
      flangeBolts: ring(0.105, 8, -P.flange - 0.004, head),
      body: new THREE.CylinderGeometry(P.bodyR, P.bodyR, P.body, radial),
      groove: new THREE.BoxGeometry(0.004, P.body * 0.9, 0.006),
      base: new THREE.CylinderGeometry(R, R, P.base, radial),
      baseBolts: ring(0.104, 6, 0.004, head),
      face: new THREE.LatheGeometry(transducerProfile(R, P.face), radial),
      connector: new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12),
      arrow: new THREE.ShapeGeometry(
        new THREE.Shape([new THREE.Vector2(-0.012, -0.02), new THREE.Vector2(0.012, -0.02), new THREE.Vector2(0.012, 0.005), new THREE.Vector2(0.026, 0.005), new THREE.Vector2(0, 0.032), new THREE.Vector2(-0.026, 0.005), new THREE.Vector2(-0.012, 0.005)]),
      ),
    };
  }, [radial, R, P]);
  const arrowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), []);
  useEffect(
    () => () => {
      Object.values(g).forEach((x) => x.dispose());
      arrowMat.dispose();
    },
    [g, arrowMat],
  );
  const grp = useRef<THREE.Group>(null);
  const exY = useRef(0);
  useFrame((_, dt) => {
    const s = hprDeployment.getState();
    exY.current = smooth(exY.current, explodeTop ? EXPLODE.top : 0, dt, reduced);
    if (grp.current) grp.current.position.y = HPR_DATUM_Y + transceiverY(s.travel).flange + exY.current;
  });
  const yBody = -P.flange;
  const yBase = yBody - P.body;
  const yFace = yBase - P.base;
  return (
    <group name={`equipment:${HPT}`} {...handlers}>
      <group ref={grp} position={[HPR_AXIS.x, HPR_DATUM_Y + transceiverY(0).flange, HPR_AXIS.z]}>
        {/* 6G kit isolation flange ring between the pole and the transceiver flange; connector in the top, inside the pole */}
        <EqMesh geometry={g.isolator} material={mats.isolator} outline={o} position={[0, 0.015, 0]} name="isolation-flange" />
        <mesh geometry={g.connector} material={mats.connector} position={[0, 0.03, 0]} name="underwater-connector" />
        <EqMesh geometry={g.flange} material={mats.bronze} outline={o} position={[0, -P.flange / 2, 0]} name="mounting-flange" />
        <mesh geometry={g.flangeBolts} material={mats.bolt} />
        <EqMesh geometry={g.body} material={mats.bronze} outline={o} position={[0, yBody - P.body / 2, 0]} name="hpt-housing" />
        {/* Machined groove: forward reference when the label is missing (§4.5) */}
        <mesh geometry={g.groove} material={mats.bronzeDark} position={[0, yBody - P.body / 2, P.bodyR + 0.001]} rotation={[0, Math.PI / 2, 0]} />
        <EqMesh geometry={g.base} material={mats.bronzeDark} outline={o} position={[0, yBase - P.base / 2, 0]} name="transducer-base-plate" />
        <mesh geometry={g.baseBolts} material={mats.bolt} position={[0, yBase, 0]} />
        <EqMesh geometry={g.face} material={mats.face} outline={o} position={[0, yFace, 0]} name="transducer-face" />
        {/* White forward arrow on the black transducer face, pointing to the bow (§4.3.1) */}
        <mesh geometry={g.arrow} material={arrowMat} position={[0, yFace - P.face - 0.002, 0]} rotation={[Math.PI / 2, 0, 0]} name="forward-arrow" />
      </group>
      <AcousticSignals />
    </group>
  );
}

/** Ping path from the deployed transceiver face to the seabed transponder. Only shown while the HPR can measure. */
function AcousticSignals() {
  const enabled = useAppStore((s) => s.hprSignals);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const root = useRef<THREE.Group>(null);
  const ping = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const a = useRef(new THREE.Vector3());
  const b = useMemo(() => new THREE.Vector3(...TRANSPONDER), []);
  const res = useMemo(() => {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), b]);
    const lineMat = new THREE.LineDashedMaterial({ color: CYAN, dashSize: 0.8, gapSize: 0.5, toneMapped: false, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(lineGeo, lineMat);
    const glow = new THREE.MeshBasicMaterial({ color: '#b6f7ff', toneMapped: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
    const seabedMat = new THREE.MeshBasicMaterial({ color: '#0b3346', wireframe: true, transparent: true, opacity: 0.35 });
    return { line, lineGeo, lineMat, glow, ringMat, seabedMat };
  }, [b]);
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
    const s = hprDeployment.getState();
    const live = enabled && hprReady(s);
    if (root.current) root.current.visible = live;
    if (!live) return;
    a.current.set(...transceiverFace(s.travel));
    const pos = res.lineGeo.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, a.current.x, a.current.y, a.current.z);
    pos.needsUpdate = true;
    res.line.computeLineDistances();
    t.current += reducedMotion ? dt * 0.25 : dt;
    // Visual cycle is slowed for legibility; the panel reports the physical round-trip time.
    const { along } = pingProgress(t.current / 3);
    ping.current?.position.lerpVectors(a.current, b, along);
    if (ring.current) {
      ring.current.position.set(a.current.x, a.current.y - 0.05, a.current.z);
      const r = (t.current % 1.5) / 1.5;
      ring.current.scale.setScalar(0.3 + r * 7);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - r);
    }
  });
  if (!enabled) return null;
  return (
    <group ref={root} name="hpr-signals" visible={false}>
      <primitive object={res.line} />
      <mesh ref={ping} material={res.glow}>
        <sphereGeometry args={[0.3, 12, 8]} />
      </mesh>
      <mesh ref={ring} material={res.ringMat} rotation={[-Math.PI / 2, 0, 0]}>
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
