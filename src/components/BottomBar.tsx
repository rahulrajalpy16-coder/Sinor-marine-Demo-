import { useAppStore } from '../store/useAppStore';
import { getEquipment, vessel } from '../equipment/registry';

const CAMERA_LABEL: Record<string, string> = {
  overview: 'Overview',
  orbit: 'Free orbit',
  guided: 'Guided intro',
  interior: 'Interior',
  inspection: 'Inspection',
  simulation: 'Simulation',
};

export function BottomBar() {
  const cameraMode = useAppStore((s) => s.cameraMode);
  const selectedId = useAppStore((s) => s.selectedId);
  const reset = useAppStore((s) => s.resetToOverview);
  const ret = useAppStore((s) => s.returnToPrevious);
  const select = useAppStore((s) => s.select);
  const eq = selectedId ? getEquipment(selectedId) : undefined;
  const d = vessel.dimensionsMeters;

  return (
    <footer className="pointer-events-auto flex flex-wrap items-center gap-2 border-t border-cyan/15 bg-abyss/70 px-4 py-2 backdrop-blur-md">
      <button
        type="button"
        data-testid="reset-overview"
        onClick={reset}
        className="rounded-sm border border-cyan bg-cyan/15 px-3 py-1.5 text-xs text-ink hover:bg-cyan/25"
      >
        ⟲ Overview
      </button>
      <button
        type="button"
        data-testid="bottom-return"
        onClick={ret}
        disabled={!eq}
        className="rounded-sm border border-cyan/40 px-3 py-1.5 text-xs text-ink hover:bg-cyan/10 disabled:opacity-30"
      >
        ← Return
      </button>
      <button
        type="button"
        onClick={() => eq && select(eq.id)}
        disabled={!eq}
        className="rounded-sm border border-cyan/40 px-3 py-1.5 text-xs text-ink hover:bg-cyan/10 disabled:opacity-30"
      >
        ◎ Focus{eq ? `: ${eq.name}` : ''}
      </button>
      <span className="font-mono text-[11px] uppercase tracking-wider text-mute">
        Camera <span data-testid="camera-mode" className="text-cyan-light">{CAMERA_LABEL[cameraMode]}</span>
      </span>
      <span className="ml-auto hidden font-mono text-[11px] text-mute lg:inline">
        L {d.length} m · B {d.beam} m · D {d.depth} m · Representative concept, not certified
      </span>
      <span className="hidden text-[11px] text-mute xl:inline">Drag to orbit · scroll or pinch to zoom · right-drag to pan · Esc returns</span>
    </footer>
  );
}
