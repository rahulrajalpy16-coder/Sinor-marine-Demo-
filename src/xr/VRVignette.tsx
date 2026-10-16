import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXRInputSourceState } from '@react-three/xr';
import * as THREE from 'three';
import { readHeadPose } from './vrState';
import { useVRComfort, vignetteStrength } from './vrComfort';

/**
 * Comfort vignette: the edges of the view darken while the visitor walks with the stick or turns smoothly, which
 * reduces motion sickness. Head-locked, drawn last. Snap turns and teleports need none.
 */
export function VRVignette() {
  const camera = useThree((s) => s.camera);
  const left = useXRInputSourceState('controller', 'left');
  const right = useXRInputSourceState('controller', 'right');
  const mesh = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), off: new THREE.Vector3() }), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: { strength: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform float strength; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float a = strength * smoothstep(0.62 - 0.3 * strength, 0.95 - 0.3 * strength, r); gl_FragColor = vec4(0.0, 0.0, 0.0, a); }',
      }),
    [],
  );

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const c = useVRComfort.getState();
    const stick = left?.gamepad['xr-standard-thumbstick'];
    const turnStick = right?.gamepad['xr-standard-thumbstick'];
    const walk = Math.hypot(stick?.xAxis ?? 0, stick?.yAxis ?? 0);
    const turn = c.turn === 'smooth' ? turnStick?.xAxis ?? 0 : 0;
    const target = c.vignette ? vignetteStrength(walk, turn) : 0;
    const u = material.uniforms.strength;
    // Close in quickly, open up gently.
    u.value += (target - u.value) * Math.min(1, dt * (target > u.value ? 10 : 4));
    m.visible = u.value > 0.01;
    if (!m.visible) return;
    readHeadPose(camera, tmp.v, tmp.q);
    m.position.copy(tmp.v).add(tmp.off.set(0, 0, -0.3).applyQuaternion(tmp.q));
    m.quaternion.copy(tmp.q);
  });

  return (
    <mesh ref={mesh} renderOrder={1000} visible={false} material={material} raycast={() => null}>
      <planeGeometry args={[1.6, 1.6]} />
    </mesh>
  );
}
