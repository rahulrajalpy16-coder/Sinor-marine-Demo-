import { useAppStore } from '../store/useAppStore';
import { reveal } from '../scene/reveal';

/** Opening sequence caption with an always-available skip control. */
export function IntroOverlay() {
  const intro = useAppStore((s) => s.introActive);
  const endIntro = useAppStore((s) => s.endIntro);
  if (!intro) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 flex flex-col items-center gap-3 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-cyan">Sinor Marine</p>
      <h1 className="text-2xl font-light tracking-wide text-ink md:text-4xl">Offshore DP support vessel</h1>
      <p className="text-xs text-mute">Representative concept · procedurally generated</p>
      <button
        type="button"
        data-testid="skip-intro"
        onClick={() => {
          reveal.set(1);
          endIntro();
        }}
        className="pointer-events-auto mt-2 rounded-sm border border-cyan/60 bg-abyss/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-cyan/15"
      >
        Skip intro ›
      </button>
    </div>
  );
}
