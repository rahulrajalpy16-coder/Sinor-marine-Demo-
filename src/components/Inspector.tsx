import { useState } from 'react';
import { CATEGORY_LABELS, getEquipment } from '../equipment/registry';
import { LESSONS, type SystemLesson } from '../equipment/learn';
import { CLOSE_UPS } from '../camera/closeUps';
import { useAppStore } from '../store/useAppStore';
import { SYSTEM_PANELS } from './systemPanels';

const PHASE_LABEL: Record<string, string> = {
  selected: 'Arriving',
  focused: 'Focused',
  inspecting: 'Inspecting',
  simulating: 'Simulating',
};

type Tab = 'operate' | 'learn' | 'specs';

/**
 * Contextual panel for the selected system: operate its simulator, learn how it works, or read its specifications.
 * Only actions the system supports are shown. `bare` drops the card chrome when a container (the phone bottom
 * sheet) already draws it.
 */
export function Inspector({ bare = false }: { bare?: boolean }) {
  const selectedId = useAppStore((s) => s.selectedId);
  const eq = selectedId ? getEquipment(selectedId) : undefined;
  if (!eq) return null;
  // Keyed by system so each one opens on its own default tab.
  return <InspectorBody key={eq.id} id={eq.id} bare={bare} />;
}

function InspectorBody({ id, bare }: { id: string; bare: boolean }) {
  const phase = useAppStore((s) => s.phase);
  const inspect = useAppStore((s) => s.inspect);
  const returnToPrevious = useAppStore((s) => s.returnToPrevious);
  const select = useAppStore((s) => s.select);
  const viewPose = useAppStore((s) => s.viewPose);
  const setMode = useAppStore((s) => s.setVisualMode);
  const mode = useAppStore((s) => s.visualMode);
  const eq = getEquipment(id)!;
  const p = eq.placement;
  const Panel = SYSTEM_PANELS[eq.id];
  const lesson = LESSONS[eq.id];
  const closeUp = CLOSE_UPS[eq.id];
  const [tab, setTab] = useState<Tab>(Panel ? 'operate' : 'learn');
  const btn = 'rounded-sm border border-cyan/40 px-2.5 py-1.5 text-xs text-ink hover:bg-cyan/10 coarse:min-h-[44px] coarse:px-3';
  const tabs: { id: Tab; label: string; testid: string }[] = [
    ...(Panel ? [{ id: 'operate' as const, label: 'Operate', testid: 'tab-operate' }] : []),
    { id: 'learn', label: 'How it works', testid: 'tab-learn' },
    { id: 'specs', label: 'Specifications', testid: 'action-inspect' },
  ];
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
          {lesson && <p className="text-xs text-mute">{lesson.tag}{eq.manufacturer ? ` · ${eq.manufacturer}` : ''}</p>}
        </div>
        <span data-testid="phase" className="whitespace-nowrap rounded-sm border border-cyan/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-cyan-light">
          {PHASE_LABEL[phase] ?? phase}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" data-testid="action-focus" onClick={() => select(eq.id)} className={btn}>
          Refocus
        </button>
        {closeUp && (
          <button
            type="button"
            data-testid="action-closeup"
            onClick={() => {
              // A close-up is for seeing the real unit: true colours, no holographic tint.
              if (mode !== 'realistic' && mode !== 'isolation') setMode('realistic');
              viewPose(closeUp.pose());
            }}
            className={btn}
          >
            Close-up
          </button>
        )}
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
      <div role="tablist" aria-label={`${eq.name} views`} className="grid auto-cols-fr grid-flow-col gap-1 rounded-sm border border-cyan/20 bg-black/20 p-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-testid={t.testid}
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === 'specs') inspect();
            }}
            className={`rounded-sm px-2 py-1.5 text-[11px] font-medium tracking-wide transition-colors coarse:min-h-[40px] ${
              tab === t.id ? 'bg-cyan/20 text-ink' : 'text-mute hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'operate' && Panel && <Panel />}
      {tab === 'learn' && <Lesson summary={p.summary} lesson={lesson} />}
      {tab === 'specs' && (
        <dl data-testid="specs" className="grid grid-cols-1 gap-1.5 text-xs">
          {p.specs.map((s) => (
            <div key={s.label} className="flex justify-between gap-3 border-b border-white/5 pb-1">
              <dt className="shrink-0 text-mute">{s.label}</dt>
              <dd className="text-right text-ink">{s.value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3">
            <dt className="text-mute">Manufacturer</dt>
            <dd className="text-right text-ink">{eq.manufacturer ?? 'Generic'}</dd>
          </div>
        </dl>
      )}
      <p className="border-t border-white/5 pt-2 text-[10px] leading-snug text-mute">
        Sinor Marine system simulation for training and demonstration. Not connected to live vessel systems.
      </p>
    </aside>
  );
}

function Lesson({ summary, lesson }: { summary: string; lesson?: SystemLesson }) {
  return (
    <div data-testid="lesson" className="flex flex-col gap-3 text-sm leading-relaxed text-ink/90">
      <p>{lesson?.role ?? summary}</p>
      {lesson && (
        <>
          <section>
            <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">How it works</h3>
            <ol className="flex flex-col gap-1.5">
              {lesson.how.map((step, i) => (
                <li key={i} className="flex gap-2 text-[13px]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan/50 font-mono text-[10px] text-cyan-light">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-sm border border-cyan/25 bg-cyan/5 p-2.5">
            <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">Try it yourself</h3>
            <ul className="flex flex-col gap-1 text-[13px]">
              {lesson.tryIt.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-cyan-light">›</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </section>
          {lesson.fact && (
            <p className="border-l-2 border-amber-300/70 pl-2 text-[12px] text-ink/80">
              <span className="font-semibold text-amber-200">Good to know: </span>
              {lesson.fact}
            </p>
          )}
          <details className="text-[12px] text-ink/75">
            <summary className="cursor-pointer text-mute">On this vessel</summary>
            <p className="mt-1">{summary}</p>
          </details>
        </>
      )}
    </div>
  );
}
