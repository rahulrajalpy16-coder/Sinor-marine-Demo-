import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TeleportTarget, XROrigin, useXR, useXRControllerLocomotion } from '@react-three/xr';
import { VR_DECKS, VR_HELIDECK, VR_SPAWN } from './vrDecks';
import { vesselFrameUnmirrored } from '../scene/vesselTransform';
import { SmallFeatureCulling } from './SmallFeatureCulling';
import { useVRActive } from './vrState';

const FLOOR_COLOR = '#5fd6ff';

/**
 * The VR visitor: their feet on the vessel (so they ride with DP moves), teleport onto the walkable decks,
 * left stick to walk, right stick to snap-turn 45°. Renders nothing outside a VR session.
 * It follows the vessel in an unreflected frame (a mirrored parent would mirror the headset view), where vessel
 * x is negated; the decks and spawn point are symmetric about the centreline, so their numbers carry over.
 */
export function VRPlayer() {
  const inVR = useXR((s) => s.mode === 'immersive-vr');
  const origin = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);

  useFrame(() => frame.current && vesselFrameUnmirrored(frame.current));
  useEffect(() => useVRActive.setState(inVR, true), [inVR]);

  useXRControllerLocomotion(origin, { speed: 2 }, { type: 'snap', degrees: 45 }, 'left');

  const teleport = (point: THREE.Vector3) => {
    const o = origin.current;
    if (!o?.parent) return;
    o.position.copy(o.parent.worldToLocal(point.clone()));
  };

  return (
    <group ref={frame} name="vr-vessel-frame">
      <XROrigin ref={origin} position={VR_SPAWN.position} rotation={[0, VR_SPAWN.yaw, 0]} />
      {inVR && <SmallFeatureCulling />}
      {inVR && (
        <TeleportTarget onTeleport={teleport}>
          {VR_DECKS.map((d) => (
            <mesh key={d.id} name={`vr-floor-${d.id}`} position={[0, d.y + 0.02, (d.z0 + d.z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[d.half * 2, d.z1 - d.z0]} />
              <meshBasicMaterial color={FLOOR_COLOR} transparent opacity={0.05} depthWrite={false} />
            </mesh>
          ))}
          <mesh name="vr-floor-helideck" position={[0, VR_HELIDECK.y + 0.02, VR_HELIDECK.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[VR_HELIDECK.radius, 8]} />
            <meshBasicMaterial color={FLOOR_COLOR} transparent opacity={0.05} depthWrite={false} />
          </mesh>
        </TeleportTarget>
      )}
    </group>
  );
}

