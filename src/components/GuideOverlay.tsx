import { useEffect } from 'react';
import { equipment, CATEGORY_LABELS } from '../equipment/registry';
import { LESSONS } from '../equipment/learn';
import { useAppStore } from '../store/useAppStore';
import { currentCameraPose } from '../interactions/poseRegistry';

const STEPS = [
  { n: '1', title: 'Pick a system', text: 'Tap a ring on the vessel or choose from Systems. The camera flies to it.' },
  { n: '2', title: 'Learn how it works', text: 'Open How it works for a step-by-step explanation and specifications.' },
  { n: '3', title: 'Operate it', text: 'Use the panel exactly as the crew would: deploy, start, change settings and watch the result.' },
];

/** Welcome and quick guide: what the platform is, how to use it, and a shortcut into every system. */
export function GuideOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const select = useAppStore((s) => s.select);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-end justify-center bg-abyss/80 p-3 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        data-testid="guide"
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom flex max-h-[92%] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-sm border border-cyan/30 bg-abyss/95 p-5 shadow-[0_0_60px_rgba(0,217,255,0.12)]"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-cyan">Sinor Marine</p>
            <h2 id="guide-title" className="mt-1 text-xl font-light text-ink sm:text-2xl">
              Vessel Systems Simulator
            </h2>
            <p className="mt-1 text-sm text-ink/80">We bring the vessel to you. Explore a DP2 offshore support vessel in 3D, learn how each system works, and operate it yourself.</p>
          </div>
          <button type="button" data-testid="guide-close" onClick={onClose} aria-label="Close guide" className="min-h-[40px] rounded-sm border border-cyan/40 px-3 text-xs text-ink hover:bg-cyan/10">
            ✕
          </button>
        </header>
        <ol className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-sm border border-cyan/20 bg-cyan/5 p-3">
              <span className="font-mono text-xs text-cyan-light">{s.n}</span>
              <h3 className="text-sm font-semibold text-ink">{s.title}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-ink/75">{s.text}</p>
            </li>
          ))}
        </ol>
        <section>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-cyan">Systems on board</h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {equipment.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  data-testid={`guide-${e.id}`}
                  onClick={() => {
                    onClose();
                    select(e.id, currentCameraPose());
                  }}
                  className="flex min-h-[44px] w-full flex-col items-start rounded-sm border border-cyan/15 px-3 py-2 text-left hover:border-cyan/50 hover:bg-cyan/5"
                >
                  <span className="text-sm text-ink">{e.name}</span>
                  <span className="text-[11px] text-mute">
                    {CATEGORY_LABELS[e.category] ?? e.category} · {LESSONS[e.id]?.tag}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <p className="text-[11px] leading-relaxed text-mute">
          Views: Hybrid shows the hull half real, half engineering drawing; Realistic shows the ship as built in daylight; Blueprint and X-ray reveal what sits
          inside and below the hull. Drag to look around, pinch or scroll to zoom.
        </p>
        <button type="button" data-testid="guide-start" onClick={onClose} className="self-end rounded-sm border border-cyan bg-cyan/20 px-4 py-2 text-sm text-ink hover:bg-cyan/30 min-h-[44px]">
          Start exploring ›
        </button>
      </div>
    </div>
  );
}
