import { create } from 'zustand';
import { nextCameraMode, type CameraEvent, type CameraMode, type CameraPose } from '../camera/cameraMachine';
import { getEquipment } from '../equipment/registry';
import type { QualityPreset, VisualMode } from '../equipment/types';
import { isModeAvailable } from '../rendering/modes';

export type EquipmentPhase = 'idle' | 'hovered' | 'selected' | 'focused' | 'inspecting' | 'simulating';

/** A request for the camera rig to fly somewhere. The rig resolves it and reports back. */
export interface CameraRequest {
  seq: number;
  kind: 'focus' | 'overview' | 'restore' | 'intro';
  pose?: CameraPose;
}

export interface AppState {
  visualMode: VisualMode;
  quality: QualityPreset;
  reducedMotion: boolean;
  introActive: boolean;
  /** HPR acoustic path visualisation toggle (registry action "show-signals"). */
  hprSignals: boolean;
  /** Show the DP network, controllers and IO units as a 3D overlay. */
  dpNetwork: boolean;
  /** Which representation each equipment item is using (planned GLB or procedural fallback). */
  assetStatus: Record<string, 'probing' | 'glb' | 'procedural'>;

  hoveredId: string | null;
  selectedId: string | null;
  phase: EquipmentPhase;

  cameraMode: CameraMode;
  cameraRequest: CameraRequest;
  cameraMoving: boolean;
  /** Pose captured before a focus so Return can restore the previous navigation context. */
  savedPose: CameraPose | null;
  savedCameraMode: CameraMode | null;

  setVisualMode: (m: VisualMode) => void;
  setQuality: (q: QualityPreset) => void;
  setReducedMotion: (v: boolean) => void;
  hover: (id: string | null) => void;
  /** Single action used by both scene clicks and the equipment tree. */
  select: (id: string, currentPose?: CameraPose) => boolean;
  deselect: () => void;
  focusArrived: () => void;
  inspect: () => void;
  startSimulating: () => void;
  stopSimulating: () => void;
  returnToPrevious: () => void;
  resetToOverview: () => void;
  cameraEvent: (ev: CameraEvent) => void;
  setCameraMoving: (v: boolean) => void;
  setHprSignals: (v: boolean) => void;
  setDpNetwork: (v: boolean) => void;
  setAssetStatus: (id: string, status: 'probing' | 'glb' | 'procedural') => void;
  startIntro: () => void;
  endIntro: () => void;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export const createAppStore = () =>
  create<AppState>((set, get) => ({
    visualMode: 'hybrid',
    quality: 'medium',
    reducedMotion: prefersReducedMotion(),
    introActive: false,
    hprSignals: false,
    dpNetwork: false,
    assetStatus: {},

    hoveredId: null,
    selectedId: null,
    phase: 'idle',

    cameraMode: 'overview',
    cameraRequest: { seq: 0, kind: 'overview' },
    cameraMoving: false,
    savedPose: null,
    savedCameraMode: null,

    setVisualMode: (m) => {
      const sel = get().selectedId ? getEquipment(get().selectedId!) : undefined;
      if (!isModeAvailable(m, !!sel?.placement.explodable)) return;
      set({ visualMode: m });
    },
    setQuality: (q) => set({ quality: q }),
    setReducedMotion: (v) => set({ reducedMotion: v }),

    hover: (id) => {
      const s = get();
      if (id && !getEquipment(id)?.placement.implemented) return;
      set({
        hoveredId: id,
        phase: s.selectedId ? s.phase : id ? 'hovered' : 'idle',
      });
    },

    select: (id, currentPose) => {
      const eq = getEquipment(id);
      if (!eq || !eq.placement.implemented) return false;
      const s = get();
      const firstFocus = s.selectedId === null;
      set({
        selectedId: id,
        phase: 'selected',
        // Exploded view only applies to assemblies that support it.
        visualMode: s.visualMode === 'exploded' && !eq.placement.explodable ? 'hybrid' : s.visualMode,
        cameraMode: nextCameraMode(s.cameraMode, { type: 'FOCUS' }),
        // Only remember the context the user came from, not a pose between two focuses.
        savedPose: firstFocus ? currentPose ?? s.savedPose : s.savedPose,
        savedCameraMode: firstFocus ? s.cameraMode : s.savedCameraMode,
        cameraRequest: {
          seq: s.cameraRequest.seq + 1,
          kind: 'focus',
          pose: { position: eq.placement.camera, target: eq.placement.target },
        },
        introActive: false,
      });
      return true;
    },

    deselect: () => {
      const s = get();
      set({
        selectedId: null,
        phase: s.hoveredId ? 'hovered' : 'idle',
        visualMode: s.visualMode === 'exploded' ? 'hybrid' : s.visualMode,
      });
    },

    focusArrived: () => {
      if (get().phase === 'selected') set({ phase: 'focused' });
    },
    inspect: () => {
      const p = get().phase;
      if (p === 'selected' || p === 'focused' || p === 'simulating') set({ phase: 'inspecting' });
    },
    startSimulating: () => {
      const s = get();
      if (!s.selectedId || !getEquipment(s.selectedId)?.simulation) return;
      set({ phase: 'simulating', cameraMode: nextCameraMode(s.cameraMode, { type: 'SIMULATE' }) });
    },
    stopSimulating: () => {
      const s = get();
      if (s.phase !== 'simulating') return;
      set({ phase: 'inspecting', cameraMode: nextCameraMode(s.cameraMode, { type: 'END_SIMULATION' }) });
    },

    returnToPrevious: () => {
      const s = get();
      if (!s.selectedId) return;
      const pose = s.savedPose;
      get().deselect();
      set({
        cameraMode: s.savedCameraMode ?? 'overview',
        savedPose: null,
        savedCameraMode: null,
        cameraRequest: { seq: s.cameraRequest.seq + 1, kind: pose ? 'restore' : 'overview', pose: pose ?? undefined },
      });
    },

    resetToOverview: () => {
      const s = get();
      get().deselect();
      set({
        cameraMode: nextCameraMode(s.cameraMode, { type: 'RESET' }),
        savedPose: null,
        savedCameraMode: null,
        introActive: false,
        cameraRequest: { seq: get().cameraRequest.seq + 1, kind: 'overview' },
      });
    },

    cameraEvent: (ev) => set({ cameraMode: nextCameraMode(get().cameraMode, ev) }),
    setCameraMoving: (v) => set({ cameraMoving: v }),

    setHprSignals: (v) => set({ hprSignals: v }),
    setDpNetwork: (v) => set({ dpNetwork: v }),
    setAssetStatus: (id, status) => set({ assetStatus: { ...get().assetStatus, [id]: status } }),
    startIntro: () => {
      const s = get();
      set({
        introActive: true,
        cameraMode: nextCameraMode(s.cameraMode, { type: 'INTRO' }),
        cameraRequest: { seq: s.cameraRequest.seq + 1, kind: 'intro' },
      });
    },
    endIntro: () => {
      const s = get();
      if (!s.introActive) return;
      set({
        introActive: false,
        cameraMode: 'overview',
        cameraRequest: { seq: s.cameraRequest.seq + 1, kind: 'overview' },
      });
    },
  }));

export const useAppStore = createAppStore();
