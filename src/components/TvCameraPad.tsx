import { useSimUi } from '../store/useSimUi';

/** Sends the keyboard camera keys from on-screen buttons (TV remotes have no mouse or wheel). */
const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

const KEYS: [string, string, string][] = [
  ['↺', 'ArrowLeft', 'Orbit left'],
  ['↻', 'ArrowRight', 'Orbit right'],
  ['⤒', 'ArrowUp', 'Look from higher'],
  ['⤓', 'ArrowDown', 'Look from lower'],
  ['＋', '+', 'Zoom in'],
  ['－', '-', 'Zoom out'],
  ['⌂', 'Home', 'Whole vessel'],
];

/** On-screen camera buttons, shown in TV mode, reachable with the D-pad. */
export function TvCameraPad() {
  const tv = useSimUi((s) => s.tv);
  if (!tv) return null;
  return (
    <nav aria-label="Camera" data-testid="tv-camera-pad" className="pointer-events-auto flex gap-1">
      {KEYS.map(([label, key, title]) => (
        <button key={key} type="button" title={title} aria-label={title} data-testid={`cam-${key}`} onClick={() => press(key)} className="min-h-[48px] min-w-[48px] rounded-sm border border-cyan/40 text-lg text-ink">
          {label}
        </button>
      ))}
    </nav>
  );
}
