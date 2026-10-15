import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { equipment } from '../equipment/registry';
import { useAppStore } from '../store/useAppStore';
import { currentCameraPose } from '../interactions/poseRegistry';
import { useQualityProfile } from '../rendering/quality';

/**
 * Equipment location indicators with progressive labels.
 *
 * - Overview (camera far away): a small ring at each installation point, no names.
 * - Intermediate: short names fade in for indicators that are close enough, on screen, not hidden
 *   behind structure and not colliding with a nearer label.
 * - Close-up: the short name stays; hovering or focusing an indicator shows its name at any distance.
 *
 * Indicators behind the hull or superstructure stay as faint rings (they are still clickable) and
 * never show a label. Everything is updated imperatively per frame, so React does not re-render.
 */

/** Camera distance (m) where labels start to appear, and where they are fully shown. */
export const LABEL_FAR = 85;
export const LABEL_NEAR = 35;
/** Screen distance (px) under which two rings are merged (the nearer one stays). */
const RING_MERGE_PX = 14;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Proximity factor for labels: 1 when close, 0 when far. */
export const labelProximity = (dist: number) => 1 - smooth(LABEL_NEAR, LABEL_FAR, dist);

export interface ScreenMarker {
  id: string;
  x: number;
  y: number;
  dist: number;
  onScreen: boolean;
  occluded: boolean;
  wantLabel: boolean;
  forced: boolean;
  labelWidth: number;
}

/**
 * Decide which rings and labels are shown: forced (hovered / focused) first, then nearest first.
 * A ring within RING_MERGE_PX of an already shown ring is hidden; a label overlapping an already
 * shown label is hidden.
 */
export function layoutMarkers(ms: ScreenMarker[]) {
  const order = [...ms].sort((a, b) => Number(b.forced) - Number(a.forced) || a.dist - b.dist);
  const rings: ScreenMarker[] = [];
  const labels: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const out = new Map<string, { ring: boolean; label: boolean }>();
  for (const m of order) {
    if (!m.onScreen) {
      out.set(m.id, { ring: false, label: false });
      continue;
    }
    const ring = m.forced || !rings.some((r) => Math.hypot(r.x - m.x, r.y - m.y) < RING_MERGE_PX);
    if (ring) rings.push(m);
    let label = false;
    if (ring && (m.forced || (m.wantLabel && !m.occluded))) {
      const box = { x0: m.x + 8, y0: m.y - 10, x1: m.x + 14 + m.labelWidth, y1: m.y + 10 };
      const hit = labels.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
      if (m.forced || !hit) {
        labels.push(box);
        label = true;
      }
    }
    out.set(m.id, { ring, label });
  }
  return out;
}

interface MarkerRefs {
  anchor: THREE.Object3D | null;
  root: HTMLDivElement | null;
  label: HTMLSpanElement | null;
  ringA: number;
  labelA: number;
  occluded: boolean;
}

export function Hotspots() {
  const selectedId = useAppStore((s) => s.selectedId);
  const intro = useAppStore((s) => s.introActive);
  const select = useAppStore((s) => s.select);
  const hover = useAppStore((s) => s.hover);
  const { camera, size } = useThree();
  const occlusionEvery = useQualityProfile().indicatorOcclusionS;
  const group = useRef<THREE.Group>(null);
  const items = useMemo(() => equipment.filter((e) => e.placement.implemented), []);
  const refs = useRef(new Map<string, MarkerRefs>());
  const focusId = useRef<string | null>(null);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), p: new THREE.Vector3(), dir: new THREE.Vector3(), ray: new THREE.Raycaster(), t: 0 }), []);
  tmp.ray.params.Line = { threshold: 0.001 };
  tmp.ray.params.Points = { threshold: 0.001 };

  const reg = (id: string) => {
    let r = refs.current.get(id);
    if (!r) {
      r = { anchor: null, root: null, label: null, ringA: 0, labelA: 0, occluded: false };
      refs.current.set(id, r);
    }
    return r;
  };

  /** True when solid structure (not this equipment, not glass or ghosted parts) lies between the camera and p. */
  const isOccluded = (id: string, p: THREE.Vector3) => {
    const scene = group.current?.parent;
    if (!scene) return false;
    tmp.dir.copy(p).sub(camera.position);
    const d = tmp.dir.length();
    tmp.ray.set(camera.position, tmp.dir.normalize());
    tmp.ray.far = d - 1.2;
    for (const hit of tmp.ray.intersectObject(scene, true)) {
      const o = hit.object as THREE.Mesh;
      if (!(o as THREE.Mesh).isMesh) continue;
      const mat = o.material as THREE.Material | THREE.Material[];
      const m = Array.isArray(mat) ? mat[0] : mat;
      if (!m || (m.transparent && m.opacity < 0.6)) continue;
      let own = false;
      let shown = true;
      for (let a: THREE.Object3D | null = o; a; a = a.parent) {
        if (!a.visible) shown = false;
        if (a.name === `equipment:${id}` || a === group.current) own = true;
      }
      if (shown && !own) return true;
    }
    return false;
  };

  useFrame((_, dt) => {
    const st = useAppStore.getState();
    const hovered = st.hoveredId;
    tmp.t += dt;
    const doOcclusion = tmp.t >= occlusionEvery;
    if (doOcclusion) tmp.t = 0;
    const ms: ScreenMarker[] = [];
    for (const e of items) {
      const r = refs.current.get(e.id);
      if (!r?.anchor) continue;
      r.anchor.getWorldPosition(tmp.p);
      const dist = camera.position.distanceTo(tmp.p);
      tmp.v.copy(tmp.p).project(camera);
      const onScreen = e.id !== st.selectedId && tmp.v.z < 1 && Math.abs(tmp.v.x) < 1.05 && Math.abs(tmp.v.y) < 1.05;
      if (doOcclusion && onScreen) r.occluded = isOccluded(e.id, tmp.p);
      ms.push({
        id: e.id,
        x: (tmp.v.x * 0.5 + 0.5) * size.width,
        y: (-tmp.v.y * 0.5 + 0.5) * size.height,
        dist,
        onScreen,
        occluded: r.occluded,
        wantLabel: labelProximity(dist) > 0.02,
        forced: hovered === e.id || focusId.current === e.id,
        labelWidth: e.placement.short.length * 6.4 + 10,
      });
    }
    const layout = layoutMarkers(ms);
    const k = 1 - Math.exp(-dt * 10);
    for (const m of ms) {
      const r = refs.current.get(m.id)!;
      const l = layout.get(m.id)!;
      const ringT = l.ring ? (m.occluded && !m.forced ? 0.32 : 0.95) : 0;
      const labelT = l.label ? (m.forced ? 1 : labelProximity(m.dist)) : 0;
      r.ringA += (ringT - r.ringA) * k;
      r.labelA += (labelT - r.labelA) * k;
      if (r.root) {
        r.root.style.opacity = r.ringA.toFixed(3);
        r.root.style.visibility = r.ringA < 0.02 ? 'hidden' : 'visible';
        r.root.style.pointerEvents = l.ring ? 'auto' : 'none';
        r.root.dataset.occluded = m.occluded ? 'true' : 'false';
      }
      if (r.label) {
        r.label.style.opacity = r.labelA.toFixed(3);
        r.label.style.transform = `translate(${(1 - r.labelA) * -4}px, -50%)`;
        r.label.dataset.shown = r.labelA > 0.5 ? 'true' : 'false';
      }
    }
  });

  if (intro) return null;
  return (
    <group name="equipment-indicators" ref={group}>
      {items.map((e) => {
        const r = reg(e.id);
        return (
          <group
            key={e.id}
            position={e.placement.target}
            ref={(o) => {
              r.anchor = o;
            }}
          >
            <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div
                ref={(el) => {
                  r.root = el;
                }}
                className="relative"
                style={{ opacity: 0, visibility: 'hidden' }}
              >
                <button
                  type="button"
                  data-testid={`hotspot-${e.id}`}
                  aria-label={`Select ${e.name}`}
                  title={e.placement.short}
                  onClick={() => select(e.id, currentCameraPose())}
                  onPointerEnter={() => hover(e.id)}
                  onPointerLeave={() => useAppStore.getState().hoveredId === e.id && hover(null)}
                  onFocus={() => {
                    focusId.current = e.id;
                  }}
                  onBlur={() => {
                    if (focusId.current === e.id) focusId.current = null;
                  }}
                  className="group grid h-6 w-6 place-items-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-cyan-light"
                >
                  <span
                    aria-hidden
                    className={`grid h-2.5 w-2.5 place-items-center rounded-full border border-cyan-light/90 bg-abyss/40 shadow-[0_0_6px_rgba(0,217,255,0.55)] transition-transform duration-150 group-hover:scale-125 ${
                      selectedId === e.id ? 'scale-125' : ''
                    }`}
                  >
                    <span className="h-1 w-1 rounded-full bg-cyan-light" />
                  </span>
                </button>
                <span
                  ref={(el) => {
                    r.label = el;
                  }}
                  data-testid={`hotspot-label-${e.id}`}
                  aria-hidden
                  className="pointer-events-none absolute left-[22px] top-1/2 whitespace-nowrap rounded-sm bg-abyss/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-light/95 backdrop-blur-[2px]"
                  style={{ opacity: 0, transform: 'translate(-4px, -50%)' }}
                >
                  {e.placement.short}
                </span>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
