import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { readHeadPose } from './vrState';

/** `?vrstats=1`: a small frame-rate and draw-call readout that floats low in the visitor's view while in VR. */
export const vrStatsRequested = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('vrstats') === '1';

export function VRStats() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.Mesh>(null);
  const acc = useRef({ frames: 0, t: 0, calls: 0, tris: 0 });
  const pos = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const { ctx, tex } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { ctx: c.getContext('2d')!, tex: t };
  }, []);

  useFrame((_, dt) => {
    const a = acc.current;
    a.frames++;
    a.t += dt;
    a.calls = gl.info.render.calls;
    a.tris = gl.info.render.triangles;
    if (a.t >= 0.5) {
      ctx.fillStyle = '#02131f';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#5fd6ff';
      ctx.font = 'bold 26px monospace';
      ctx.fillText(`${Math.round(a.frames / a.t)} fps`, 12, 30);
      ctx.font = '18px monospace';
      ctx.fillText(`${a.calls} calls ${Math.round(a.tris / 1000)}k tris`, 12, 54);
      tex.needsUpdate = true;
      a.frames = 0;
      a.t = 0;
    }
    // Follow the head: 1.2 m ahead, 0.35 m below eye level.
    const m = mesh.current;
    if (!m) return;
    readHeadPose(camera, pos.v, pos.q);
    m.position.copy(pos.v).add(new THREE.Vector3(0, -0.35, -1.2).applyQuaternion(pos.q));
    m.quaternion.copy(pos.q);
  });

  return (
    <mesh ref={mesh} renderOrder={999}>
      <planeGeometry args={[0.4, 0.1]} />
      <meshBasicMaterial map={tex} depthTest={false} transparent toneMapped={false} />
    </mesh>
  );
}
