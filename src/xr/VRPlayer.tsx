import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TeleportTarget, XROrigin, useXR, useXRControllerLocomotion } from '@react-three/xr';
import { VR_DECKS, VR_HELIDECK, VR_SPAWN } from './vrDecks';
import { vesselFrameUnmirrored } from '../scene/vesselTransform';
import { SmallFeatureCulling } from './SmallFeatureCulling';
import { useVRActive } from './vrState';
import { useVRNav } from './vrNav';
import { placeById, placePose } from './vrPlaces';
import { SEATED_LIFT_M, rotationOptions, useVRComfort } from './vrComfort';
import { VRUI } from './VRUI';
import { useAppStore } from '../store/useAppStore';
import { VRVignette } from './VRVignette';
import { VRAudio } from './VRAudio';

const FLOOR_COLOR = '#5fd6ff';

/**
 * The VR visitor: their feet on the vessel (so they ride with DP moves), teleport onto the walkable decks or jump to
 * a place from the menu, left stick to walk, right stick to turn (snap or smooth, see comfort settings).
 * Renders nothing outside a VR session.
 * It follows the vessel in an unreflected frame (a mirrored parent would mirror the headset view), where vessel
 * x is negated; the decks and spawn point are symmetric about the centreline, so their numbers carry over.
 */
export function VRPlayer() {
  const inVR = useXR((s) => s.mode === 'immersive-vr');
  const origin = useRef<THREE.Group>(null);
  const frame = useRef<THREE.Group>(null);
  const turn = useVRComfort((s) => s.turn);
  const seated = useVRComfort((s) => s.seated);
  const goto = useVRNav((s) => s.goto);

  useFrame(() => frame.current && vesselFrameUnmirrored(frame.current));
  const wasInVR = useRef(false);
  useEffect(() => {
    useVRActive.setState(inVR, true);
    // Back on the screen, the orbit camera starts from the overview rather than wherever the headset was.
    if (wasInVR.current && !inVR) useAppStore.getState().resetToOverview();
    wasInVR.current = inVR;
  }, [inVR]);

  useXRControllerLocomotion(origin, { speed: 2 }, rotationOptions(turn), 'left');

  // Menu and tour jumps.
  useEffect(() => {
    const o = origin.current;
    const place = goto && placeById(goto.place);
    if (!o || !place) return;
    const pose = placePose(place);
    o.position.set(...pose.position);
    o.rotation.set(0, pose.yaw, 0);
  }, [goto]);

  const teleport = (point: THREE.Vector3) => {
    const o = origin.current;
    if (!o || !frame.current) return;
    // Teleport lands the feet on the deck; the seated lift is applied above the origin by its parent group.
    o.position.copy(frame.current.worldToLocal(point.clone()));
  };

  return (
    <>
    <group ref={frame} name="vr-vessel-frame">
      <group name="vr-seated-lift" position={[0, seated ? SEATED_LIFT_M : 0, 0]}>
        <XROrigin ref={origin} position={VR_SPAWN.position} rotation={[0, VR_SPAWN.yaw, 0]} />
      </group>
      {inVR && <SmallFeatureCulling />}
      {inVR && <VRAudio />}
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
      {inVR && <VRUI />}
    </group>
    {inVR && <VRVignette />}
    </>
  );
}
