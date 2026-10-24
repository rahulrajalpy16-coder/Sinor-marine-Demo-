import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared building blocks for the Sinor Marine engineering HMIs (PMS, UPS, wind, sensors). Status is always shown
 * with a symbol and a word as well as a colour, so severity never depends on colour alone.
 */
export type Tone = 'ok' | 'warn' | 'alarm' | 'off' | 'info';
const TONE: Record<Tone, { cls: string; sym: string }> = {
  ok: { cls: 'border-[#3fd16b]/60 bg-[#1f6b34]/60 text-[#d7f7df]', sym: '●' },
  warn: { cls: 'border-amber-400/70 bg-amber-700/40 text-amber-100', sym: '◆' },
  alarm: { cls: 'border-[#e04444] bg-[#8f1d1d]/80 text-white', sym: '▲' },
  off: { cls: 'border-white/20 bg-[#2a3138] text-[#b8c4cc]', sym: '○' },
  info: { cls: 'border-[#5fc8ff]/50 bg-[#12345a] text-[#d9f1ff]', sym: '■' },
};

export function Chip({ tone, children, testid }: { tone: Tone; children: ReactNode; testid?: string }) {
  return (
    <span data-testid={testid} data-tone={tone} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[10px] ${TONE[tone].cls}`}>
      <span aria-hidden>{TONE[tone].sym}</span>
      {children}
    </span>
  );
}

export const SEV_SYMBOL = { alarm: '▲', warning: '◆', info: '●' } as const;

export function Tabs<T extends string>({ tabs, value, onChange, prefix }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void; prefix: string }) {
  return (
    <div role="tablist" aria-label="Pages" className="flex flex-wrap gap-1 text-[10px]">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          data-testid={`${prefix}-tab-${t.id}`}
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`min-w-[3.2rem] flex-1 rounded-t-sm border-b-2 px-1.5 py-1 font-semibold uppercase tracking-wide coarse:min-h-[40px] ${value === t.id ? 'border-[#5fc8ff] bg-[#12345a] text-white' : 'border-transparent text-[#9fb3c2] hover:text-white'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Bar({ pct, warn = 85, alarm = 100, label }: { pct: number; warn?: number; alarm?: number; label?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  const tone = pct >= alarm ? 'bg-[#e04444]' : pct >= warn ? 'bg-amber-400' : 'bg-[#5fc8ff]';
  return (
    <div className="flex items-center gap-1.5" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-1.5 flex-1 rounded bg-white/10">
        <div className={`h-1.5 rounded ${tone}`} style={{ width: `${p}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-[10px]">{pct.toFixed(0)}%</span>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[9px] uppercase tracking-[0.14em] text-[#9fb3c2]">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Btn({ label, onClick, testid, tone, disabled, title }: { label: string; onClick: () => void; testid?: string; tone?: 'go' | 'danger' | 'warn'; disabled?: boolean; title?: string }) {
  const t =
    tone === 'go'
      ? 'border-[#3fd16b] bg-[#1f6b34] hover:bg-[#25803e]'
      : tone === 'danger'
        ? 'border-[#e04444] bg-[#8f1d1d] hover:bg-[#a52525]'
        : tone === 'warn'
          ? 'border-amber-400 bg-amber-700/60 hover:bg-amber-700/80'
          : 'border-white/25 bg-[#24303a] hover:bg-[#33424f]';
  return (
    <button type="button" data-testid={testid} title={title} disabled={disabled} onClick={onClick} className={`rounded-sm border px-2 py-1 text-[10px] font-semibold tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-35 coarse:min-h-[40px] ${t}`}>
      {label}
    </button>
  );
}

/** Explains why a command was refused (interlocks), so no control fails silently. */
export function Rejection({ msg, onClose }: { msg: string | null; onClose: () => void }) {
  if (!msg) return null;
  return (
    <p role="alert" data-testid="hmi-rejection" className="flex items-start gap-2 rounded-sm border border-amber-400/60 bg-amber-900/40 px-2 py-1 text-[10px] text-amber-100">
      <span aria-hidden>◆</span>
      <span className="flex-1">Not done: {msg}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="px-1">
        ✕
      </button>
    </p>
  );
}

export const fmtTime = (t: number) => {
  const s = Math.floor(t);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/**
 * Branded panel frame with a full-screen option (portal), used by every new engineering HMI.
 */
export function HmiFrame({ title, status, testid, children }: { title: string; status?: ReactNode; testid: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const body = (
    <section aria-label={title} data-testid={testid} className="flex flex-col gap-2 rounded-sm border border-[#2c4a6b] bg-[#0b1a2c] p-2 text-[#e6edf2]">
      <header className="flex flex-wrap items-center justify-between gap-1.5 rounded-sm bg-gradient-to-r from-[#0d2a4a] to-[#12345a] px-2 py-1">
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}brand/sinor-mark.png`} alt="" aria-hidden className="h-4 w-auto opacity-90" />
          <h3 className="text-[11px] font-semibold tracking-[0.12em]">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {status}
          <button
            type="button"
            data-testid={`${testid}-expand`}
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? `Close full screen ${title}` : `Open ${title} full screen`}
            className="rounded-sm border border-white/20 px-1.5 text-[11px] hover:bg-white/10 coarse:min-h-[36px]"
          >
            {expanded ? '✕' : '⤢'}
          </button>
        </div>
      </header>
      {children}
    </section>
  );
  return expanded ? (
    <>
      <p className="border-t border-cyan/15 pt-3 text-xs text-mute">{title} open full screen.</p>
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-4xl">{body}</div>
        </div>,
        document.body,
      )}
    </>
  ) : (
    <div className="border-t border-cyan/15 pt-3">{body}</div>
  );
}

export function KV({ k, v, testid }: { k: string; v: ReactNode; testid?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-white/5 py-0.5 font-mono text-[10px]">
      <span className="text-[#9fb3c2]">{k}</span>
      <span data-testid={testid} className="text-right">
        {v}
      </span>
    </div>
  );
}

/** Minimal SVG line chart for the trend pages (values from the shared state only). */
export function Trend({ series, height = 70, label, unit, min, max }: { series: { name: string; color: string; values: number[] }[]; height?: number; label: string; unit: string; min?: number; max?: number }) {
  const all = series.flatMap((s) => s.values);
  const lo = min ?? Math.min(...all, 0);
  const hi = max ?? Math.max(...all, lo + 1);
  const n = Math.max(2, ...series.map((s) => s.values.length));
  const W = 300;
  const y = (v: number) => height - 4 - ((v - lo) / (hi - lo || 1)) * (height - 12);
  return (
    <figure className="rounded-sm bg-black/30 p-1">
      <figcaption className="flex flex-wrap justify-between gap-1 text-[9px] text-[#9fb3c2]">
        <span>{label}</span>
        <span className="flex gap-2">
          {series.map((s) => (
            <span key={s.name} style={{ color: s.color }}>
              — {s.name} {s.values.length ? `${s.values[s.values.length - 1].toFixed(unit === 'Hz' ? 2 : 0)} ${unit}` : ''}
            </span>
          ))}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={label}>
        <text x="2" y="9" fontSize="7" fill="#6f8aa3">
          {hi.toFixed(unit === 'Hz' ? 1 : 0)}
        </text>
        <text x="2" y={height - 2} fontSize="7" fill="#6f8aa3">
          {lo.toFixed(unit === 'Hz' ? 1 : 0)}
        </text>
        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth="1.3"
            points={s.values.map((v, i) => `${((i + n - s.values.length) / (n - 1)) * W},${y(v).toFixed(1)}`).join(' ')}
          />
        ))}
      </svg>
    </figure>
  );
}
