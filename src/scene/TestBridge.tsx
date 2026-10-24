import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { getEquipment } from '../equipment/registry';
import { bowThruster } from '../simulations/controller';
import { dpSystem } from '../simulations/dpController';
import { hprDeployment } from '../simulations/deploymentController';
import { posRefs } from '../simulations/posrefsController';
import { toScene, vesselMatrix } from './vesselTransform';
import { powerSystem, windSystem } from '../simulations/powerController';
import { runScenario, type ScenarioOptions } from '../simulations/vesselCore';
import { consistencyRun } from '../simulations/consistency';

declare global {
  interface Window {
    __SINOR__?: {
      project: (id: string) => { x: number; y: number } | null;
      /** Screen point of a vessel-frame position. */
      projectPoint: (p: [number, number, number]) => { x: number; y: number };
      sample: () => { lit: number; cyan: number; total: number };
      state: () => ReturnType<typeof useAppStore.getState>;
      thruster: () => ReturnType<typeof bowThruster.getState>;
      dp: () => ReturnType<typeof dpSystem.getState>;
      hpr: () => ReturnType<typeof hprDeployment.getState>;
      posrefs: () => ReturnType<typeof posRefs.getState>;
      power: () => ReturnType<typeof powerSystem.getState>;
      wind: () => ReturnType<typeof windSystem.getState>;
      /** Runs the deterministic headless scenario engine (the same core the app uses), for test H. */
      runScenario: (o: ScenarioOptions) => ReturnType<typeof runScenario>;
      /** Test H reference run (identical inputs in every build). */
      consistency: () => ReturnType<typeof consistencyRun>;
      camera: () => { position: number[] };
      /** Places the camera at a vessel-frame pose at once (the exhibition video's cinematic shots). */
      setCamera: (position: [number, number, number], target: [number, number, number], fov?: number) => void;
    };
  }
}

/** Diagnostics used by the browser tests and for manual debugging, plus a camera hook for the video capture. */
export function TestBridge() {
  const { camera, gl, size, controls } = useThree();
  useEffect(() => {
    window.__SINOR__ = {
      project: (id) => {
        const eq = getEquipment(id);
        if (!eq) return null;
        const v = new THREE.Vector3(...toScene(eq.placement.target)).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      projectPoint: (p) => {
        const v = new THREE.Vector3(...toScene(p)).project(camera);
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
      power: () => powerSystem.getState(),
      wind: () => windSystem.getState(),
      runScenario: (o) => runScenario(o),
      consistency: () => consistencyRun(),
      camera: () => ({ position: camera.position.toArray() }),
      setCamera: (position, target, fov) => {
        const m = vesselMatrix();
        if (fov && camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
        camera.position.copy(new THREE.Vector3(...position).applyMatrix4(m));
        const orbit = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
        const t = new THREE.Vector3(...target).applyMatrix4(m);
        if (orbit) {
          // Free framing, as during a camera flight; the next flight restores the orbit limits.
          Object.assign(orbit, { minDistance: 0.1, maxDistance: 1000, minPolarAngle: 0, maxPolarAngle: Math.PI });
          orbit.target.copy(t);
          orbit.update();
        } else camera.lookAt(t);
      },
    };
    return () => {
      delete window.__SINOR__;
    };
  }, [camera, gl, size, controls]);
  return null;
}
