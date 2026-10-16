import { createXRStore } from '@react-three/xr';

/**
 * One WebXR store for the app. Controllers and hands get a teleport pointer (arc ray) next to the
 * default ray pointer; only meshes inside a `TeleportTarget` accept it.
 * In `npm run dev` on localhost a Quest 3 is emulated when the browser has no WebXR device.
 */
export const xrStore = createXRStore({
  controller: { teleportPointer: true },
  hand: { teleportPointer: true },
  emulate: import.meta.env.DEV ? 'metaQuest3' : false,
});

/** Starts an immersive VR session; the browser asks for permission on first use. */
export const enterVR = () => xrStore.enterVR();
