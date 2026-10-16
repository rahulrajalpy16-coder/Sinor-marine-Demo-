import { createXRStore } from '@react-three/xr';

/**
 * Dev only: desktop Chrome ships a native `navigator.xr` that reports no headset, and the emulator refuses to
 * replace a native runtime. Hide it so the Quest 3 emulator can install, unless this is a real headset browser
 * or the URL has `?emulate=0`.
 */
function allowDevEmulator() {
  if (!import.meta.env.DEV || typeof navigator === 'undefined' || !('xr' in navigator)) return;
  const onHeadset = /OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent);
  if (onHeadset || new URLSearchParams(window.location.search).get('emulate') === '0') return;
  Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true });
}
allowDevEmulator();

/**
 * One WebXR store for the app. Controllers and hands get a teleport pointer (arc ray) next to the
 * default ray pointer; only meshes inside a `TeleportTarget` accept it.
 * In `npm run dev` on localhost a Quest 3 is emulated on desktop browsers (see `allowDevEmulator`).
 */
export const xrStore = createXRStore({
  controller: { teleportPointer: true },
  hand: { teleportPointer: true },
  // Full fixed foveation: lower resolution at the lens edges, where the Quest optics blur anyway.
  foveation: 1,
  emulate: import.meta.env.DEV ? 'metaQuest3' : false,
});

/** Starts an immersive VR session; the browser asks for permission on first use. */
export const enterVR = () => xrStore.enterVR();
