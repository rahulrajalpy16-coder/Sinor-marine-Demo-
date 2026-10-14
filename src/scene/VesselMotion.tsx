import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { dpSystem } from '../simulations/dpController';

/** Moves its children with the DP vessel pose every frame (station keeping, drift-off, joystick moves). */
export function VesselMotion({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const [n, e, psi] = dpSystem.getState().eta;
    if (!g.current) return;
    g.current.position.set(e, 0, n);
    g.current.rotation.set(0, psi, 0);
  });
  return (
    <group ref={g} name="vessel-motion">
      {children}
    </group>
  );
}
