/** Pure layout for the canvas-drawn VR panels: word wrapping and button placement, in canvas pixels. */

export type Measure = (text: string, font: string) => number;

export const PANEL_FONT = {
  title: 'bold 44px system-ui, sans-serif',
  body: '28px system-ui, sans-serif',
  button: 'bold 28px system-ui, sans-serif',
};
const PAD = 36;
const TITLE_LH = 54;
const BODY_LH = 38;
const BTN_H = 72;
const GAP = 16;

/** Greedy word wrap; a single word wider than the line is left on its own line. */
export function wrapText(text: string, maxWidth: number, font: string, measure: Measure): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, font) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export interface PanelButton {
  id: string;
  label: string;
  /** Drawn highlighted (a toggle that is on, the current choice). */
  active?: boolean;
}

export interface PanelLayout {
  width: number;
  height: number;
  title: string[];
  body: string[];
  bodyTop: number;
  buttons: (PanelButton & { x: number; y: number; w: number; h: number })[];
}

export function layoutPanel(
  spec: { title: string; body?: string; buttons: PanelButton[]; columns?: number; maxBodyLines?: number },
  width: number,
  measure: Measure,
): PanelLayout {
  const inner = width - PAD * 2;
  const title = wrapText(spec.title, inner, PANEL_FONT.title, measure);
  let body = spec.body ? wrapText(spec.body, inner, PANEL_FONT.body, measure) : [];
  const max = spec.maxBodyLines ?? 14;
  if (body.length > max) body = [...body.slice(0, max - 1), `${body[max - 1].replace(/\s*\S*$/, '')} …`];
  const bodyTop = PAD + title.length * TITLE_LH + (body.length ? 12 : 0);
  let y = bodyTop + body.length * BODY_LH + (spec.buttons.length ? 24 : 0);
  const cols = Math.max(1, spec.columns ?? 2);
  const w = (inner - GAP * (cols - 1)) / cols;
  const buttons = spec.buttons.map((b, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { ...b, x: PAD + col * (w + GAP), y: y + row * (BTN_H + GAP), w, h: BTN_H };
  });
  const rows = Math.ceil(spec.buttons.length / cols);
  y += rows ? rows * BTN_H + (rows - 1) * GAP : 0;
  return { width, height: Math.ceil(y + PAD), title, body, bodyTop, buttons };
}

export const LINE_HEIGHT = { title: TITLE_LH, body: BODY_LH, pad: PAD };
