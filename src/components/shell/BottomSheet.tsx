import { useRef, useState, type ReactNode } from 'react';

/** Snap heights as a fraction of the space between the top and bottom bars. */
export const SHEET_SNAPS = { peek: 0.34, half: 0.58, full: 0.94 } as const;
export type SheetSnap = keyof typeof SHEET_SNAPS;
const ORDER: SheetSnap[] = ['peek', 'half', 'full'];

/** Nearest snap to a dragged height fraction. */
export function nearestSnap(fraction: number): SheetSnap {
  return ORDER.reduce((best, k) => (Math.abs(SHEET_SNAPS[k] - fraction) < Math.abs(SHEET_SNAPS[best] - fraction) ? k : best), 'half' as SheetSnap);
}

/**
 * Phone details panel: a draggable bottom sheet with three snap heights.
 * Drag the handle to resize; tap it to step peek → half → full → peek. Works with mouse too.
 */
export function BottomSheet({ children, label, initial = 'half' }: { children: ReactNode; label: string; initial?: SheetSnap }) {
  const [snap, setSnap] = useState<SheetSnap>(initial);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; frac: number; host: number; moved: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const frac = drag ?? SHEET_SNAPS[snap];

  const onDown = (e: React.PointerEvent) => {
    const host = root.current?.parentElement?.clientHeight ?? window.innerHeight;
    start.current = { y: e.clientY, frac: SHEET_SNAPS[snap], host, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dy = s.y - e.clientY;
    if (Math.abs(dy) > 6) s.moved = true;
    if (s.moved) setDrag(Math.min(SHEET_SNAPS.full, Math.max(0.18, s.frac + dy / s.host)));
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (s.moved && drag !== null) setSnap(nearestSnap(drag));
    else setSnap(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);
    setDrag(null);
  };

  return (
    <div
      ref={root}
      data-testid="bottom-sheet"
      data-snap={snap}
      className="safe-bottom pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-xl border-x border-t border-cyan/25 bg-abyss/90 shadow-[0_-10px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
      style={{ height: `${frac * 100}%`, transition: drag === null ? 'height 180ms ease-out' : 'none' }}
    >
      <button
        type="button"
        data-testid="sheet-handle"
        aria-label={`${label}: resize panel (now ${snap})`}
        aria-expanded={snap === 'full'}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        // Keyboard activation (Enter/Space) has no pointer events.
        onClick={(e) => e.detail === 0 && setSnap(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length])}
        className="flex h-11 w-full shrink-0 touch-none items-center justify-center"
      >
        <span className="h-1.5 w-12 rounded-full bg-cyan/50" aria-hidden />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}
