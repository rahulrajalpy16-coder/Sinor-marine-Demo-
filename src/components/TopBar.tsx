import { VISUAL_MODES, QUALITY_PRESETS, type QualityPreset } from '../equipment/types';
import { MODE_STYLES, isModeAvailable } from '../rendering/modes';
import { useAppStore } from '../store/useAppStore';
import { getEquipment, vessel } from '../equipment/registry';

export function TopBar() {
  const mode = useAppStore((s) => s.visualMode);
  const setMode = useAppStore((s) => s.setVisualMode);
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const setReducedMotion = useAppStore((s) => s.setReducedMotion);
  const selectedId = useAppStore((s) => s.selectedId);
  const explodable = !!(selectedId && getEquipment(selectedId)?.placement.explodable);

  return (
    <header className="pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-cyan/15 bg-abyss/70 px-4 py-2 backdrop-blur-md">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-semibold tracking-[0.3em] text-cyan-light">SINOR MARINE</span>
        <span className="hidden text-xs text-mute sm:inline">Digital Universe · {vessel.name}</span>
      </div>
      <nav aria-label="Visual mode" className="order-3 flex w-full flex-wrap gap-1 md:order-none md:mx-auto md:w-auto">
        {VISUAL_MODES.map((m) => {
          const available = isModeAvailable(m, explodable);
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              data-testid={`mode-${m}`}
              aria-pressed={active}
              disabled={!available}
              title={available ? MODE_STYLES[m].description : 'Select an assembly that supports exploded view (bow thruster)'}
              onClick={() => setMode(m)}
              className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                active
                  ? 'border-cyan bg-cyan/20 text-ink'
                  : available
                    ? 'border-cyan/25 text-mute hover:border-cyan/60 hover:text-ink'
                    : 'cursor-not-allowed border-white/5 text-mute/40'
              }`}
            >
              {MODE_STYLES[m].label}
            </button>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-3 md:ml-0">
        <label className="flex items-center gap-1.5 text-[11px] text-mute">
          <span className="font-mono uppercase tracking-wider">Quality</span>
          <select
            data-testid="quality"
            value={quality}
            onChange={(e) => setQuality(e.target.value as QualityPreset)}
            className="rounded-sm border border-cyan/25 bg-abyss px-1.5 py-0.5 font-mono text-[11px] text-ink"
          >
            {QUALITY_PRESETS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-mute">
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} className="accent-cyan" />
          <span className="font-mono uppercase tracking-wider">Reduce motion</span>
        </label>
      </div>
    </header>
  );
}
