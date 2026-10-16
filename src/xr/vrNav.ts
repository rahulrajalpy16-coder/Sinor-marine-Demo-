import { create } from 'zustand';

export type VRMenu = 'closed' | 'main' | 'comfort';

/** VR-only navigation state: which menu is open, tour progress, and teleport requests for the VR player. */
interface VRNav {
  menu: VRMenu;
  /** Index into TOUR while the guided tour runs. */
  tourStep: number | null;
  /** The visitor has opened the menu at least once (hides the first-run hint). */
  menuSeen: boolean;
  goto: { seq: number; place: string } | null;
}

export const useVRNav = create<VRNav>(() => ({ menu: 'closed', tourStep: null, menuSeen: false, goto: null }));

export const goToPlace = (place: string) =>
  useVRNav.setState((s) => ({ goto: { seq: (s.goto?.seq ?? 0) + 1, place } }));

export const openMenu = (menu: VRMenu) => useVRNav.setState({ menu, menuSeen: true });
