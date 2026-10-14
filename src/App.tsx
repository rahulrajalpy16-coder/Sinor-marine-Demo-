import { lazy, Suspense, useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { EquipmentTree } from './components/EquipmentTree';
import { Inspector } from './components/Inspector';
import { BottomBar } from './components/BottomBar';
import { IntroOverlay } from './components/IntroOverlay';
import { SceneErrorBoundary, hasWebGL } from './components/SceneErrorBoundary';
import { useAppStore } from './store/useAppStore';
import { registry } from './equipment/registry';

const SceneRoot = lazy(() => import('./scene/SceneRoot').then((m) => ({ default: m.SceneRoot })));

export default function App() {
  const [webgl] = useState(() => hasWebGL());
  const [treeOpen, setTreeOpen] = useState(false);
  const selectedId = useAppStore((s) => s.selectedId);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const st = useAppStore.getState();
    if (params.get('intro') !== '0' && !st.reducedMotion) st.startIntro();
    const q = params.get('quality');
    if (q === 'low' || q === 'medium' || q === 'high') st.setQuality(q);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useAppStore.getState();
      if (s.introActive) s.endIntro();
      else if (s.selectedId) s.returnToPrevious();
      else s.resetToOverview();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-abyss text-ink">
      <SceneErrorBoundary>
        {webgl ? (
          <Suspense fallback={<Loading />}>
            <SceneRoot />
          </Suspense>
        ) : (
          <div role="alert" className="absolute inset-0 flex items-center justify-center p-6 text-center text-mute">
            WebGL is not available in this browser. Use the system explorer to browse equipment details.
          </div>
        )}
      </SceneErrorBoundary>
      <div className="scanlines pointer-events-none absolute inset-0" aria-hidden />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <TopBar />
        <div className="relative flex min-h-0 flex-1 gap-3 p-3">
          <div className="pointer-events-auto hidden w-60 shrink-0 flex-col gap-3 self-start rounded-sm border border-cyan/20 bg-abyss/75 p-3 backdrop-blur-md md:flex">
            <EquipmentTree />
            <p className="border-t border-white/5 pt-2 text-[10px] leading-snug text-mute">{registry.note}</p>
          </div>
          <button
            type="button"
            className="pointer-events-auto absolute left-3 top-3 rounded-sm border border-cyan/40 bg-abyss/80 px-3 py-1.5 text-xs md:hidden"
            aria-expanded={treeOpen}
            data-testid="tree-toggle"
            onClick={() => setTreeOpen((v) => !v)}
          >
            ☰ Systems
          </button>
          {treeOpen && (
            <div className="pointer-events-auto absolute left-3 top-14 z-10 w-64 rounded-sm border border-cyan/30 bg-abyss/95 p-3 md:hidden">
              <EquipmentTree onPicked={() => setTreeOpen(false)} />
            </div>
          )}
          <div className="flex-1" />
          {selectedId && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 max-h-[55%] md:static md:inset-auto md:max-h-full md:w-[22rem] md:shrink-0 md:self-start">
              <Inspector />
            </div>
          )}
        </div>
        <BottomBar />
      </div>
      <IntroOverlay />
    </div>
  );
}

function Loading() {
  return (
    <div role="status" className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-cyan">
      Loading vessel…
    </div>
  );
}
