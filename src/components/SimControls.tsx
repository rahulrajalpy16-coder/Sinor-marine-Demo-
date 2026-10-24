import { useEffect, useState } from 'react';
import { dpSystem } from '../simulations/dpController';
import { useControllerState } from '../simulations/useController';
import {
  deleteScenario,
  loadStore,
  resetAll,
  restoreSnapshot,
  runTrainingScenario,
  saveScenario,
  setFrozen,
  setSpeed,
  SPEEDS,
  TRAINING_SCENARIOS,
  type SavedScenario,
} from '../simulations/simControl';
import { useAppStore } from '../store/useAppStore';
import { useSimUi } from '../store/useSimUi';

const btn = 'rounded-sm border px-2.5 py-1.5 text-xs text-ink coarse:min-h-[44px] tv:min-h-[48px]';

/** Bottom-bar button that opens the simulator controls. */
export function SimControlsButton() {
  const open = useSimUi((s) => s.controlsOpen);
  const setOpen = useSimUi((s) => s.setControlsOpen);
  const dp = useControllerState(dpSystem);
  return (
    <button
      type="button"
      data-testid="sim-controls-open"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={`${btn} ${dpSystem.frozen ? 'border-amber-400 bg-amber-700/40' : 'border-cyan/40 hover:bg-cyan/10'}`}
    >
      ⚙ Simulator{dpSystem.frozen ? ' · FROZEN' : ` · ${dp.timeScale}×`}
    </button>
  );
}

/**
 * Simulator controls: reset everything, freeze, speed, guided training scenarios, saved scenarios and the exhibition
 * demo. Saved scenarios stay on this device only.
 */
export function SimControlsPanel() {
  const open = useSimUi((s) => s.controlsOpen);
  const setOpen = useSimUi((s) => s.setControlsOpen);
  const setDemo = useSimUi((s) => s.setDemo);
  const dp = useControllerState(dpSystem);
  const select = useAppStore((s) => s.select);
  const overview = useAppStore((s) => s.resetToOverview);
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const refresh = () => {
    const r = loadStore();
    setSaved(r.store.items);
    if (r.error) setNote(r.error);
  };
  useEffect(() => {
    if (open) refresh();
  }, [open]);
  if (!open) return null;
  const frozen = dpSystem.frozen;
  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-2 sm:items-center" onClick={() => setOpen(false)}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Simulator controls"
        data-testid="sim-controls"
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom flex max-h-[90%] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-sm border border-cyan/30 bg-abyss/95 p-4 text-ink"
      >
        <header className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-cyan">Simulator</h2>
          <button type="button" data-testid="sim-controls-close" onClick={() => setOpen(false)} className={`${btn} border-cyan/40`} aria-label="Close simulator controls">
            ✕
          </button>
        </header>
        {note && (
          <p role="status" className="rounded-sm border border-amber-400/60 bg-amber-900/40 px-2 py-1 text-xs text-amber-100" data-testid="sim-note">
            {note}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="sim-reset-all"
            onClick={() => {
              resetAll();
              overview();
              setNote('Everything is back to the start: on station, DP2, plant normal, no faults.');
            }}
            className={`${btn} border-[#e04444] bg-[#8f1d1d]/70`}
          >
            ⟲ Reset all
          </button>
          <button type="button" data-testid="sim-freeze" aria-pressed={frozen} onClick={() => setFrozen(!frozen)} className={`${btn} ${frozen ? 'border-amber-400 bg-amber-700/50' : 'border-cyan/40'}`}>
            {frozen ? '▶ Run' : '❚❚ Freeze'}
          </button>
          <span className="flex items-center gap-1 text-xs text-mute">
            Speed
            {SPEEDS.map((v) => (
              <button key={v} type="button" data-testid={`sim-speed-${v}`} aria-pressed={dp.timeScale === v} onClick={() => setSpeed(v)} className={`${btn} ${dp.timeScale === v ? 'border-cyan bg-cyan/20' : 'border-cyan/30'}`}>
                {v}×
              </button>
            ))}
          </span>
        </div>
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[11px] uppercase tracking-wider text-mute">Training scenarios</h3>
          {TRAINING_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              data-testid={`sim-scenario-${sc.id}`}
              onClick={() => {
                runTrainingScenario(sc, () => setNote(`Fault applied: ${sc.title}.`));
                setOpen(false);
                select(sc.focus);
              }}
              className={`${btn} border-cyan/30 text-left hover:bg-cyan/10`}
            >
              <span className="block font-semibold">{sc.title}</span>
              <span className="block text-[11px] text-mute">{sc.watch}</span>
            </button>
          ))}
        </section>
        <section className="flex flex-col gap-1.5">
          <h3 className="text-[11px] uppercase tracking-wider text-mute">Saved on this device</h3>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const r = saveScenario(name);
              setNote(r.ok ? 'Saved.' : r.error!);
              setName('');
              refresh();
            }}
          >
            <input
              data-testid="sim-save-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this moment"
              maxLength={60}
              className="min-w-0 flex-1 rounded-sm border border-cyan/30 bg-abyss px-2 text-xs text-ink coarse:min-h-[44px]"
            />
            <button type="submit" data-testid="sim-save" className={`${btn} border-cyan/40`}>
              Save
            </button>
          </form>
          {saved.length === 0 && <p className="text-xs text-mute">Nothing saved yet.</p>}
          {saved.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs" data-testid={`sim-saved-${s.id}`}>
              <span className="min-w-0 flex-1 truncate">
                {s.name} <span className="text-mute">· {new Date(s.savedAt).toLocaleString()}</span>
              </span>
              <button
                type="button"
                data-testid="sim-load"
                onClick={() => {
                  try {
                    restoreSnapshot(s.data);
                    setNote(`Loaded “${s.name}”.`);
                  } catch (err) {
                    setNote(err instanceof Error ? err.message : String(err));
                  }
                }}
                className={`${btn} border-cyan/40`}
              >
                Load
              </button>
              <button
                type="button"
                data-testid="sim-delete"
                onClick={() => {
                  deleteScenario(s.id);
                  refresh();
                }}
                className={`${btn} border-white/20`}
              >
                Delete
              </button>
            </div>
          ))}
        </section>
        <button
          type="button"
          data-testid="demo-start"
          onClick={() => {
            setOpen(false);
            setDemo(true);
          }}
          className={`${btn} border-cyan bg-cyan/15`}
        >
          ▶ Start exhibition demo (loops until you press Exit or Back)
        </button>
      </section>
    </div>
  );
}
