import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';
import { currentCameraPose } from './poseRegistry';
import { equipmentVisual } from './equipmentVisual';
import { CYAN } from '../rendering/materials';
import { isTap, isXRPointerEvent } from './input';

/**
 * Pointer handlers shared by every selectable equipment group (mouse, touch and pen alike).
 * Scene and tree call the same store action. A drag that happens to end over a system is an
 * orbit, not a selection, so only a genuine tap or click selects.
 */
export function useSelectable(id: string) {
  const hover = useAppStore((s) => s.hover);
  const select = useAppStore((s) => s.select);
  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);
  return useMemo(() => {
    // Headset rays select on trigger down and up over the same system, however long the pull; their events have no
    // screen drag to measure (`delta` throws) and pointer-events' own click gives up after 300 ms.
    let xrPressed = false;
    return {
      onClick: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (isXRPointerEvent(e) || !isTap(e.delta, (e.nativeEvent as PointerEvent).pointerType)) return;
        select(id, currentCameraPose());
      },
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        if (!isXRPointerEvent(e)) return;
        e.stopPropagation();
        xrPressed = true;
      },
      onPointerUp: (e: ThreeEvent<PointerEvent>) => {
        if (!isXRPointerEvent(e) || !xrPressed) return;
        e.stopPropagation();
        xrPressed = false;
        select(id);
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        // Fingers have no hover; a highlight would stick after the tap.
        if (e.pointerType === 'touch') return;
        hover(id);
        document.body.style.cursor = 'pointer';
      },
      onPointerOut: () => {
        xrPressed = false;
        if (useAppStore.getState().hoveredId === id) hover(null);
        document.body.style.cursor = '';
      },
      userData: { equipmentId: id },
    };
  }, [id, hover, select]);
}

export interface EquipmentMaterialSpec {
  color: string;
  metalness?: number;
  roughness?: number;
}

/**
 * Per-equipment PBR materials that light up cyan on hover/selection and ghost in isolation mode.
 * Materials are disposed on unmount.
 */
export function useEquipmentMaterials<K extends string>(id: string, specs: Record<K, EquipmentMaterialSpec>) {
  const mats = useMemo(() => {
    const out = {} as Record<K, THREE.MeshStandardMaterial>;
    for (const k of Object.keys(specs) as K[]) {
      const sp = specs[k];
      out[k] = new THREE.MeshStandardMaterial({
        color: sp.color,
        metalness: sp.metalness ?? 0.6,
        roughness: sp.roughness ?? 0.35,
        emissive: CYAN,
        emissiveIntensity: 0.08,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const visual = useAppStore(useShallow((s) => equipmentVisual(id, s)));
  const { glow, ghost } = visual;
  useEffect(() => {
    for (const m of Object.values(mats) as THREE.MeshStandardMaterial[]) {
      m.emissiveIntensity = glow;
      m.transparent = ghost;
      m.opacity = ghost ? 0.12 : 1;
      m.depthWrite = !ghost;
      m.needsUpdate = true;
    }
  }, [mats, glow, ghost]);
  useEffect(() => () => Object.values(mats).forEach((m) => (m as THREE.Material).dispose()), [mats]);
  return { mats, visual };
}
