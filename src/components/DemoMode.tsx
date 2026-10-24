import { useEffect, useRef, useState } from 'react';
import { resetAll, runTrainingScenario, TRAINING_SCENARIOS } from '../simulations/simControl';
import { useAppStore } from '../store/useAppStore';
import { useSimUi } from '../store/useSimUi';

/** Seconds each scenario is shown: healthy state, fault, then the system's response. */
const SCENE_SECONDS = 32;

/**
 * Exhibition demo: loops through the training scenarios with a caption, flying to each system. It stops on the
 * EXIT button, Escape or the remote's Back key, and leaves the simulator reset.
 */
export function DemoMode() {
  const demo = useSimUi((s) => s.demo);
  const setDemo = useSimUi((s) => s.setDemo);
  const select = useAppStore((s) => s.select);
  const overview = useAppStore((s) => s.resetToOverview);
  const [i, setI] = useState(0);
  const [faulted, setFaulted] = useState(false);
  const exitRef = useRef<HTMLButtonElement>(null);
  const sc = TRAINING_SCENARIOS[i % TRAINING_SCENARIOS.length];

  useEffect(() => {
    if (!demo) return;
    const st = useAppStore.getState();
    if (st.introActive) st.endIntro();
    setFaulted(false);
    const cancel = runTrainingScenario(sc, () => setFaulted(true));
    select(sc.focus);
    const next = setTimeout(() => setI((v) => v + 1), SCENE_SECONDS * 1000);
    exitRef.current?.focus();
    return () => {
      cancel();
      clearTimeout(next);
    };
  }, [demo, i, sc, select]);

  useEffect(() => {
    if (!demo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') {
        e.preventDefault();
        e.stopImmediatePropagation();
        stop();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const stop = () => {
    setDemo(false);
    setI(0);
    resetAll();
    overview();
  };

  if (!demo) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex flex-col justify-between p-3" data-testid="demo-overlay">
      <div className="flex justify-end">
        <button
          ref={exitRef}
          type="button"
          data-testid="demo-exit"
          onClick={stop}
          className="pointer-events-auto rounded-sm border-2 border-white bg-[#8f1d1d] px-5 py-3 text-base font-semibold text-white shadow-lg"
        >
          ✕ EXIT DEMO
        </button>
      </div>
      <div className="mx-auto mb-14 w-full max-w-3xl rounded-sm border border-cyan/40 bg-abyss/90 p-4 text-center shadow-[0_0_40px_rgba(0,217,255,0.15)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan">
          Sinor Marine · live demonstration {(i % TRAINING_SCENARIOS.length) + 1}/{TRAINING_SCENARIOS.length}
        </p>
        <h2 className="mt-1 text-xl font-light text-ink md:text-2xl" data-testid="demo-title">
          {sc.title}
        </h2>
        <p className="mt-1 text-sm text-ink/85">{faulted ? sc.watch : 'Normal operation. Watch what happens when the fault is applied…'}</p>
      </div>
    </div>
  );
}
