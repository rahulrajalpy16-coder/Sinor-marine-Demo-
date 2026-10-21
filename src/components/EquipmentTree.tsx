import { CATEGORY_LABELS, equipment } from '../equipment/registry';
import { useAppStore } from '../store/useAppStore';
import { currentCameraPose } from '../interactions/poseRegistry';
import { LESSONS } from '../equipment/learn';

/** Accessible, non-3D system explorer. Uses the same select action as clicking a mesh. */
export function EquipmentTree({ onPicked }: { onPicked?: () => void }) {
  const selectedId = useAppStore((s) => s.selectedId);
  const hoveredId = useAppStore((s) => s.hoveredId);
  const select = useAppStore((s) => s.select);
  const hover = useAppStore((s) => s.hover);
  const categories = [...new Set(equipment.map((e) => e.category))];

  return (
    <nav aria-label="Systems on board" className="flex flex-col gap-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan">Systems on board</h2>
      {categories.map((cat) => (
        <section key={cat} aria-label={CATEGORY_LABELS[cat] ?? cat}>
          <h3 className="mb-1 text-[11px] uppercase tracking-wider text-mute">{CATEGORY_LABELS[cat] ?? cat}</h3>
          <ul className="flex flex-col gap-1">
            {equipment
              .filter((e) => e.category === cat)
              .map((e) => {
                const active = selectedId === e.id;
                const ok = e.placement.implemented;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      data-testid={`tree-${e.id}`}
                      aria-pressed={active}
                      disabled={!ok}
                      onClick={() => {
                        select(e.id, currentCameraPose());
                        onPicked?.();
                      }}
                      onMouseEnter={() => ok && hover(e.id)}
                      onMouseLeave={() => ok && hover(null)}
                      onFocus={() => ok && hover(e.id)}
                      onBlur={() => ok && hover(null)}
                      className={`flex w-full items-center justify-between gap-2 rounded-sm border px-2.5 py-2 text-left text-sm transition-colors ${
                        active
                          ? 'border-cyan bg-cyan/15 text-ink'
                          : hoveredId === e.id
                            ? 'border-cyan/50 bg-cyan/5 text-ink'
                            : ok
                              ? 'border-cyan/15 text-ink/90 hover:border-cyan/50'
                              : 'cursor-not-allowed border-white/5 text-mute/60'
                      }`}
                    >
                      <span className="flex flex-col">
                        <span>{e.name}</span>
                        {LESSONS[e.id] && <span className="text-[11px] text-mute">{LESSONS[e.id].tag}</span>}
                      </span>
                      {ok && <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-cyan-light' : 'bg-cyan/50'}`} aria-hidden />}
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
