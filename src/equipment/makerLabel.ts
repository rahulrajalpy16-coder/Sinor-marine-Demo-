import * as THREE from 'three';

export interface LabelText {
  text: string;
  /** Centre, as fractions of the canvas width and height (y down). */
  x: number;
  y: number;
  /** Font size as a fraction of the canvas height. */
  size: number;
  weight?: number;
  color?: string;
  /** Letter spacing in px at the canvas scale. */
  spacing?: number;
}

export interface LabelStripe {
  /** Top and bottom of the stripe, fractions of the canvas height. */
  y0: number;
  y1: number;
  color: string;
}

/**
 * Painted maker's band for a cylindrical housing: a canvas the band's cylinder wraps once (u = 0 → 1 around),
 * with the text placed where it should face. Returns null outside the browser (unit tests).
 */
export function makeBandTexture(opts: { width?: number; height?: number; background: string; stripes?: LabelStripe[]; texts: LabelText[] }) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = opts.width ?? 2048;
  c.height = opts.height ?? 512;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, c.width, c.height);
  for (const s of opts.stripes ?? []) {
    ctx.fillStyle = s.color;
    ctx.fillRect(0, s.y0 * c.height, c.width, (s.y1 - s.y0) * c.height);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of opts.texts) {
    ctx.fillStyle = t.color ?? '#ffffff';
    ctx.font = `${t.weight ?? 600} ${Math.round(t.size * c.height)}px "Helvetica Neue", Arial, sans-serif`;
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${t.spacing ?? 0}px`;
    ctx.fillText(t.text, t.x * c.width, t.y * c.height);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
