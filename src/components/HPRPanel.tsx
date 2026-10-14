import { ASSUMED_SOUND_SPEED, roundTripTime, slantRange, TRANSPONDER } from '../simulations/acoustic';
import { getEquipment } from '../equipment/registry';
import { useAppStore } from '../store/useAppStore';

/** Illustrative acoustic path view. Range is computed from geometry and an assumed sound speed. */
export function HPRPanel() {
  const on = useAppStore((s) => s.hprSignals);
  const setOn = useAppStore((s) => s.setHprSignals);
  const origin = getEquipment('hpr-001')!.placement.target;
  const range = slantRange(origin, TRANSPONDER);
  const t = roundTripTime(range);
  return (
    <section aria-label="Acoustic signal path" className="flex flex-col gap-2 border-t border-cyan/15 pt-3 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan">Signal path</h3>
        <button
          type="button"
          data-testid="hpr-signals"
          aria-pressed={on}
          onClick={() => setOn(!on)}
          className={`rounded-sm border px-2.5 py-1.5 ${on ? 'border-cyan bg-cyan/20 text-ink' : 'border-cyan/40 text-ink hover:bg-cyan/10'}`}
        >
          {on ? 'Hide signals' : 'Show signals'}
        </button>
      </div>
      <dl className="grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div className="rounded-sm border border-cyan/10 bg-cyan/5 px-2 py-1.5">
          <dt className="text-[10px] uppercase text-mute">Slant range</dt>
          <dd className="text-ink">{range.toFixed(1)} m</dd>
        </div>
        <div className="rounded-sm border border-cyan/10 bg-cyan/5 px-2 py-1.5">
          <dt className="text-[10px] uppercase text-mute">Round trip</dt>
          <dd className="text-ink">{(t * 1000).toFixed(1)} ms</dd>
        </div>
        <div className="rounded-sm border border-cyan/10 bg-cyan/5 px-2 py-1.5">
          <dt className="text-[10px] uppercase text-mute">Sound speed</dt>
          <dd className="text-ink">{ASSUMED_SOUND_SPEED} m/s</dd>
        </div>
      </dl>
      <p className="text-[10px] text-mute">
        Measurement type: two-way travel time, range = c · t / 2 with an assumed c. The ping animation is slowed for legibility.
        Full ranging simulation arrives in Phase 3.
      </p>
    </section>
  );
}
