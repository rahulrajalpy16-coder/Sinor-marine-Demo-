import { CATEGORY_LABELS, getEquipment } from '../equipment/registry';
import { useAppStore } from '../store/useAppStore';
import { SYSTEM_PANELS } from './systemPanels';

const PHASE_LABEL: Record<string, string> = {
  selected: 'Moving camera',
  focused: 'Focused',
  inspecting: 'Inspecting',
  simulating: 'Simulating',
};

/**
 * Contextual technical panel for the selected system. Only actions the system supports are shown as active.
 * `bare` drops the card chrome when a container (the phone bottom sheet) already draws it.
 */
export function Inspector({ bare = false }: { bare?: boolean }) {
  const selectedId = useAppStore((s) => s.selectedId);
  const phase = useAppStore((s) => s.phase);
  const asset = useAppStore((s) => (s.selectedId ? s.assetStatus[s.selectedId] : undefined));
  const inspect = useAppStore((s) => s.inspect);
  const returnToPrevious = useAppStore((s) => s.returnToPrevious);
  const select = useAppStore((s) => s.select);
  const setMode = useAppStore((s) => s.setVisualMode);
  const mode = useAppStore((s) => s.visualMode);
  const eq = selectedId ? getEquipment(selectedId) : undefined;
  if (!eq) return null;

  const p = eq.placement;
  const Panel = SYSTEM_PANELS[eq.id];
  const btn = 'rounded-sm border border-cyan/40 px-2.5 py-1.5 text-xs text-ink hover:bg-cyan/10 coarse:min-h-[44px] coarse:px-3';
  return (
    <aside
      aria-label={`${eq.name} details`}
      data-testid="inspector"
      data-equipment={eq.id}
      className={`pointer-events-auto flex max-h-full min-h-0 flex-col gap-3 overflow-y-auto ${
        bare ? 'px-4 pb-4' : 'rounded-sm border border-cyan/25 bg-abyss/85 p-4 shadow-[0_0_40px_rgba(0,217,255,0.08)] backdrop-blur-md'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">{CATEGORY_LABELS[eq.category] ?? eq.category}</p>
          <h2 data-testid="inspector-title" className="text-lg font-semibold text-ink">
            {eq.name}
          </h2>
          <p className="font-mono text-[10px] text-mute">ID {eq.id}</p>
        </div>
        <span data-testid="phase" className="whitespace-nowrap rounded-sm border border-cyan/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-cyan-light">
          {PHASE_LABEL[phase] ?? phase}
        </span>
      </div>
      <p className="order-3 text-sm leading-relaxed text-ink/85 md:order-none">{p.summary}</p>
      {phase === 'inspecting' || phase === 'simulating' ? (
        <dl className="order-3 grid grid-cols-1 gap-1.5 text-xs md:order-none">
          {p.specs.map((s) => (
            <div key={s.label} className="flex justify-between gap-3 border-b border-white/5 pb-1">
              <dt className="text-mute">{s.label}</dt>
              <dd className="text-right text-ink">{s.value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-b border-white/5 pb-1">
            <dt className="text-mute">Model</dt>
            <dd className="text-right text-ink">{asset === 'glb' ? 'GLB asset' : 'Procedural fallback (representative)'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-mute">Manufacturer</dt>
            <dd className="text-right text-ink">{eq.manufacturer ?? 'Not specified (generic)'}</dd>
          </div>
        </dl>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="action-inspect"
          onClick={inspect}
          disabled={phase === 'inspecting' || phase === 'simulating'}
          className={`${btn} disabled:opacity-35`}
        >
          Inspect details
        </button>
        <button
          type="button"
          data-testid="action-focus"
          onClick={() => select(eq.id)}
          className={btn}
        >
          Refocus
        </button>
        {p.explodable && (
          <button
            type="button"
            data-testid="action-explode"
            aria-pressed={mode === 'exploded'}
            onClick={() => setMode(mode === 'exploded' ? 'hybrid' : 'exploded')}
            className={btn}
          >
            {mode === 'exploded' ? 'Assemble' : 'Explode assembly'}
          </button>
        )}
        <button
          type="button"
          data-testid="action-isolate"
          aria-pressed={mode === 'isolation'}
          onClick={() => setMode(mode === 'isolation' ? 'hybrid' : 'isolation')}
          className={btn}
        >
          {mode === 'isolation' ? 'Show all' : 'Isolate'}
        </button>
        <button
          type="button"
          data-testid="action-return"
          onClick={returnToPrevious}
          className="ml-auto rounded-sm border border-cyan bg-cyan/15 px-2.5 py-1.5 text-xs text-ink hover:bg-cyan/25 coarse:min-h-[44px] coarse:px-3"
        >
          Return
        </button>
      </div>
      {Panel && <Panel />}
      <p className="order-3 border-t border-white/5 pt-2 text-[10px] leading-snug text-mute md:order-none">
        Illustrative, non-certified representation. Not connected to live equipment and not OEM-verified.
      </p>
    </aside>
  );
}
