/**
 * D-pad (remote control) navigation for TV: the arrow keys move the focus to the nearest focusable control in that
 * direction, OK/Enter presses it (native button behaviour), Back closes the open thing. Pure geometry helpers are
 * exported for the tests.
 */
export type Dir = 'left' | 'right' | 'up' | 'down';
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Score of a candidate box relative to the current one in a direction (lower is better), or null if not in that direction. */
export function navScore(from: Box, to: Box, dir: Dir): number | null {
  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  let main: number;
  let cross: number;
  switch (dir) {
    case 'right':
      if (dx <= 0) return null;
      main = Math.max(0, to.x - (from.x + from.w));
      cross = Math.abs(dy);
      break;
    case 'left':
      if (dx >= 0) return null;
      main = Math.max(0, from.x - (to.x + to.w));
      cross = Math.abs(dy);
      break;
    case 'down':
      if (dy <= 0) return null;
      main = Math.max(0, to.y - (from.y + from.h));
      cross = Math.abs(dx);
      break;
    case 'up':
      if (dy >= 0) return null;
      main = Math.max(0, from.y - (to.y + to.h));
      cross = Math.abs(dx);
      break;
  }
  // Prefer items in line with the current one: the sideways offset counts double.
  return main + cross * 2;
}

/** Index of the best candidate, or -1. */
export function pickNext(from: Box, candidates: Box[], dir: Dir): number {
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((c, i) => {
    const s = navScore(from, c, dir);
    if (s !== null && s < bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

const FOCUSABLE = 'button:not([disabled]), [href], select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visibleFocusables(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.pointerEvents !== 'none' && !el.closest('[aria-hidden="true"]');
  });
}

const box = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const DIRS: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

/** Installs the D-pad handler (capture phase, so the camera's arrow keys yield to it). Returns an uninstall function. */
export function installSpatialNav(onBack: () => void) {
  const onKey = (e: KeyboardEvent) => {
    if (!e.isTrusted) return;
    // Android TV Back arrives as Escape / GoBack / BrowserBack depending on the WebView.
    if (e.key === 'GoBack' || e.key === 'BrowserBack' || e.key === 'Backspace') {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      e.preventDefault();
      onBack();
      return;
    }
    const dir = DIRS[e.key];
    if (!dir) return;
    const active = document.activeElement as HTMLElement | null;
    // A focused select keeps its own up/down.
    if (active && active.tagName === 'SELECT' && (dir === 'up' || dir === 'down')) return;
    // Inside a modal dialog, stay inside it.
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const items = visibleFocusables(dialog ?? document);
    if (!items.length) return;
    e.preventDefault();
    if (!active || active === document.body || !items.includes(active)) {
      items[0].focus();
      return;
    }
    const others = items.filter((x) => x !== active);
    const i = pickNext(box(active), others.map(box), dir);
    if (i >= 0) {
      others[i].focus();
      others[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };
  window.addEventListener('keydown', onKey, true);
  document.documentElement.classList.add('tv-mode');
  return () => {
    window.removeEventListener('keydown', onKey, true);
    document.documentElement.classList.remove('tv-mode');
  };
}
