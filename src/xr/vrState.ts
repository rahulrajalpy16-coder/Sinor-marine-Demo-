import * as THREE from 'three';
import { create } from 'zustand';

/** True while an immersive VR session runs. Readable outside `<XR>` (quality profile, HUD). */
export const useVRActive = create<boolean>(() => false);

const scratchScale = new THREE.Vector3();

/**
 * The headset's world pose, from the scene's user camera, which three sets from the XR pose each frame relative to
 * its parent (the XR origin). Nothing else may move that camera in VR (the orbit rig is unmounted).
 */
export function readHeadPose(camera: THREE.Camera, position: THREE.Vector3, quaternion: THREE.Quaternion) {
  camera.updateWorldMatrix(true, false);
  camera.matrixWorld.decompose(position, quaternion, scratchScale);
}
