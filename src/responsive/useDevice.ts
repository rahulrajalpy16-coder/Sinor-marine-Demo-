import { create } from 'zustand';
import { viewportInfo, type ViewportInfo } from './device';

/**
 * Live viewport state shared by the HUD and the scene. Kept apart from the app store so a resize
 * or rotation never re-renders anything that only cares about selection or simulation.
 */
interface DeviceState extends ViewportInfo {
  update: () => void;
}

const coarseQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;

const measure = (): ViewportInfo => {
  if (typeof window === 'undefined') return viewportInfo(1440, 900, false);
  // visualViewport tracks the on-screen keyboard and mobile browser chrome more closely than innerHeight.
  const w = Math.round(window.innerWidth);
  const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
  return viewportInfo(w, h, !!coarseQuery()?.matches);
};

export const useDevice = create<DeviceState>((set, get) => ({
  ...measure(),
  update: () => {
    const next = measure();
    const cur = get();
    if (next.width !== cur.width || next.height !== cur.height || next.coarse !== cur.coarse) set(next);
  },
}));

/** Install resize, rotation and pointer-type listeners once. Returns a cleanup. */
export function installViewportListeners(): () => void {
  if (typeof window === 'undefined') return () => {};
  const update = () => useDevice.getState().update();
  // Some mobile browsers report the new size a frame after orientationchange.
  const onRotate = () => {
    update();
    requestAnimationFrame(update);
    window.setTimeout(update, 250);
  };
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', onRotate);
  window.visualViewport?.addEventListener('resize', update);
  const mq = coarseQuery();
  mq?.addEventListener?.('change', update);
  update();
  return () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', onRotate);
    window.visualViewport?.removeEventListener('resize', update);
    mq?.removeEventListener?.('change', update);
  };
}
