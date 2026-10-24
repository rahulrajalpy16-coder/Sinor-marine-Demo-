import { create } from 'zustand';

/** UI state for the simulator controls, the exhibition demo and TV (remote control) mode. */
interface SimUiState {
  /** Exhibition demo running. */
  demo: boolean;
  /** Remote-control (D-pad) navigation and on-screen camera buttons. */
  tv: boolean;
  controlsOpen: boolean;
  setDemo: (v: boolean) => void;
  setTv: (v: boolean) => void;
  setControlsOpen: (v: boolean) => void;
}

const params = () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

export const useSimUi = create<SimUiState>((set) => ({
  demo: params().get('demo') === '1',
  tv: params().get('tv') === '1',
  controlsOpen: false,
  setDemo: (demo) => set({ demo }),
  setTv: (tv) => set({ tv }),
  setControlsOpen: (controlsOpen) => set({ controlsOpen }),
}));
