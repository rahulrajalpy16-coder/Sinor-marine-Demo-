import { create } from 'zustand';

/** True while an immersive VR session runs. Readable outside `<XR>` (quality profile, HUD). */
export const useVRActive = create<boolean>(() => false);
