import { lazy, Suspense, useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { BottomBar } from './components/BottomBar';
import { SystemsPanel } from './components/shell/SystemsPanel';
import { InspectorDock } from './components/shell/InspectorDock';
import { IntroOverlay } from './components/IntroOverlay';
import { SceneErrorBoundary, hasWebGL } from './components/SceneErrorBoundary';
import { useAppStore } from './store/useAppStore';
import { initialQuality } from './rendering/quality';
import { installViewportListeners, useDevice } from './responsive/useDevice';

const SceneRoot = lazy(() => import('./scene/SceneRoot').then((m) => ({ default: m.SceneRoot })));

export default function App() {
  const [webgl] = useState(() => hasWebGL());
  const layout = useDevice((s) => s.layout);
  const orientation = useDevice((s) => s.orientation);

  useEffect(() => installViewportListeners(), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const st = useAppStore.getState();
    if (params.get('intro') !== '0' && !st.reducedMotion) st.startIntro();
    st.setQuality(initialQuality(window.location.search).quality);
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

      {/* One shell for every device: only the containers change with the layout class. */}
      {/* Above the scene indicators (z 0–20) so panels always cover them; clicks still pass through empty areas. */}
      <div className="pointer-events-none absolute inset-0 z-[25] flex flex-col" data-layout={layout} data-testid="app-shell">
        <TopBar layout={layout} />
        <div className={`relative flex min-h-0 flex-1 gap-3 ${layout === 'desktop' ? 'p-3' : 'safe-x'}`}>
          <SystemsPanel layout={layout} />
          <div className="flex-1" />
          <InspectorDock layout={layout} orientation={orientation} />
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
