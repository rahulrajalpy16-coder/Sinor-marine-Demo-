import { useAppStore } from '../store/useAppStore';
import { getEquipment, vessel } from '../equipment/registry';
import { useDevice } from '../responsive/useDevice';

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
  const layout = useDevice((s) => s.layout);
  const coarse = useDevice((s) => s.coarse);
  const mobile = layout === 'mobile';
  const btn = 'rounded-sm border px-3 py-1.5 text-xs text-ink coarse:min-h-[44px]';

  return (
    <footer className="safe-bottom pointer-events-auto relative z-30 flex flex-wrap items-center gap-2 border-t border-cyan/15 bg-abyss/70 px-3 pt-2 backdrop-blur-md sm:px-4">
      <button
        type="button"
        data-testid="reset-overview"
        onClick={reset}
        className={`${btn} border-cyan bg-cyan/15 hover:bg-cyan/25`}
      >
        ⟲ Overview
      </button>
      <button
        type="button"
        data-testid="bottom-return"
        onClick={ret}
        disabled={!eq}
        className={`${btn} border-cyan/40 hover:bg-cyan/10 disabled:opacity-30`}
      >
        ← Return
      </button>
      <button
        type="button"
        onClick={() => eq && select(eq.id)}
        disabled={!eq}
        className={`${btn} border-cyan/40 hover:bg-cyan/10 disabled:opacity-30`}
      >
        ◎ Focus{eq && !mobile ? `: ${eq.name}` : ''}
      </button>
      <span className="font-mono text-[11px] uppercase tracking-wider text-mute">
        Camera <span data-testid="camera-mode" className="text-cyan-light">{CAMERA_LABEL[cameraMode]}</span>
      </span>
      <span className="ml-auto hidden font-mono text-[11px] text-mute lg:inline">
        L {d.length} m · B {d.beam} m · D {d.depth} m · Representative concept, not certified
      </span>
      <span data-testid="input-hint" className="hidden text-[11px] text-mute xl:inline">
        {coarse
          ? 'Drag to orbit · pinch to zoom · two-finger drag to pan · tap a system'
          : 'Drag to orbit · scroll to zoom · right-drag to pan · arrows orbit · +/- zoom · Esc returns'}
      </span>
    </footer>
  );
}
