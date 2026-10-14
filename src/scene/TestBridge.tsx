import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { getEquipment } from '../equipment/registry';
import { bowThruster } from '../simulations/controller';
import { dpSystem } from '../simulations/dpController';
import { hprDeployment } from '../simulations/deploymentController';
import { posRefs } from '../simulations/posrefsController';
import { toScene } from './vesselTransform';

declare global {
  interface Window {
    __SINOR__?: {
      project: (id: string) => { x: number; y: number } | null;
      sample: () => { lit: number; cyan: number; total: number };
      state: () => ReturnType<typeof useAppStore.getState>;
      thruster: () => ReturnType<typeof bowThruster.getState>;
      dp: () => ReturnType<typeof dpSystem.getState>;
      hpr: () => ReturnType<typeof hprDeployment.getState>;
      posrefs: () => ReturnType<typeof posRefs.getState>;
      camera: () => { position: number[] };
    };
  }
}

/** Read-only diagnostics used by the browser tests and for manual debugging. */
export function TestBridge() {
  const { camera, gl, size } = useThree();
  useEffect(() => {
    window.__SINOR__ = {
      project: (id) => {
        const eq = getEquipment(id);
        if (!eq) return null;
        const v = new THREE.Vector3(...toScene(eq.placement.target)).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      sample: () => {
        const src = gl.domElement;
        const c = document.createElement('canvas');
        c.width = 160;
        c.height = 100;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(src, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let lit = 0;
        let cyan = 0;
        for (let i = 0; i < d.length; i += 4) {
          const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
          if (r + g + b > 120) lit++;
          if (b > 140 && g > 120 && r < 120) cyan++;
        }
        return { lit, cyan, total: d.length / 4 };
      },
      state: () => useAppStore.getState(),
      thruster: () => bowThruster.getState(),
      dp: () => dpSystem.getState(),
      hpr: () => hprDeployment.getState(),
      posrefs: () => posRefs.getState(),
      camera: () => ({ position: camera.position.toArray() }),
    };
    return () => {
      delete window.__SINOR__;
    };
  }, [camera, gl, size]);
  return null;
}
