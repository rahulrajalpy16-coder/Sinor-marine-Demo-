import { useState } from 'react';
import { VISUAL_MODES, QUALITY_PRESETS, type QualityPreset } from '../equipment/types';
import { MODE_STYLES, isModeAvailable } from '../rendering/modes';
import { rememberQuality } from '../rendering/quality';
import { useAppStore } from '../store/useAppStore';
import { getEquipment, vessel } from '../equipment/registry';
import type { LayoutClass } from '../responsive/device';
import { EnterVRButton } from '../xr/EnterVRButton';

function ModeButtons({ compact }: { compact: boolean }) {
  const mode = useAppStore((s) => s.visualMode);
  const setMode = useAppStore((s) => s.setVisualMode);
  const selectedId = useAppStore((s) => s.selectedId);
  const explodable = !!(selectedId && getEquipment(selectedId)?.placement.explodable);
  return (
    <nav
      aria-label="Visual mode"
      className={compact ? 'grid grid-cols-3 gap-1.5' : 'order-3 flex w-full flex-wrap gap-1 lg:order-none lg:mx-auto lg:w-auto'}
    >
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
            className={`rounded-sm border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors coarse:min-h-[44px] ${
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
  );
}

function Settings() {
  const quality = useAppStore((s) => s.quality);
  const setQuality = useAppStore((s) => s.setQuality);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const setReducedMotion = useAppStore((s) => s.setReducedMotion);
  return (
    <div className="flex items-center gap-3">
      <EnterVRButton />
      <label className="flex items-center gap-1.5 text-[11px] text-mute">
        <span className="font-mono uppercase tracking-wider">Quality</span>
        <select
          data-testid="quality"
          value={quality}
          onChange={(e) => {
            const q = e.target.value as QualityPreset;
            setQuality(q);
            rememberQuality(q);
          }}
          className="rounded-sm border border-cyan/25 bg-abyss px-1.5 py-0.5 font-mono text-[11px] text-ink coarse:min-h-[40px]"
        >
          {QUALITY_PRESETS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-[11px] text-mute coarse:min-h-[40px]">
        <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} className="accent-cyan coarse:h-5 coarse:w-5" />
        <span className="font-mono uppercase tracking-wider">Reduce motion</span>
      </label>
    </div>
  );
}

/** Desktop and tablet: everything inline. Phones: brand plus a View menu holding modes and settings. */
export function TopBar({ layout }: { layout: LayoutClass }) {
  const [menu, setMenu] = useState(false);

  if (layout === 'mobile') {
    return (
      <header className="safe-top pointer-events-auto relative z-40 border-b border-cyan/15 bg-abyss/80 px-3 pb-2 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold tracking-[0.3em] text-cyan-light">SINOR MARINE</span>
          <button
            type="button"
            data-testid="view-menu-toggle"
            aria-expanded={menu}
            aria-controls="view-menu"
            onClick={() => setMenu((v) => !v)}
            className="min-h-[44px] rounded-sm border border-cyan/40 px-3 text-xs"
          >
            {menu ? '✕ Close' : 'View ▾'}
          </button>
        </div>
        {menu && (
          <div id="view-menu" data-testid="view-menu" className="mt-2 flex flex-col gap-3 border-t border-cyan/15 pt-3">
            <ModeButtons compact />
            <Settings />
          </div>
        )}
      </header>
    );
  }

  return (
    <header className="safe-top pointer-events-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-cyan/15 bg-abyss/70 px-4 pb-2 backdrop-blur-md">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-semibold tracking-[0.3em] text-cyan-light">SINOR MARINE</span>
        <span className="hidden text-xs text-mute sm:inline">Digital Universe · {vessel.name}</span>
      </div>
      <ModeButtons compact={false} />
      <div className="ml-auto lg:ml-0">
        <Settings />
      </div>
    </header>
  );
}
