import type { CameraPose } from '../camera/cameraMachine';

/** The camera rig registers a getter so non-3D UI (the equipment tree) can capture the current pose. */
let provider: (() => CameraPose) | null = null;

export function registerPoseProvider(fn: (() => CameraPose) | null) {
  provider = fn;
}

export function currentCameraPose(): CameraPose | undefined {
  return provider?.();
}
