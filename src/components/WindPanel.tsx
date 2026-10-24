import { useState } from 'react';
import { windSystem } from '../simulations/powerController';
import { dpSystem } from '../simulations/dpController';
import { useControllerState } from '../simulations/useController';
import { WIND_ALARM_TEXT, WIND_CONFIG, type WindCommand, type WindFault, type WindSensorId, type WindState } from '../simulations/wind';
import { Btn, Chip, HmiFrame, KV, Rejection, Section, SEV_SYMBOL, type Tone } from './hmi/kit';
import { DataNote } from './DataNote';

const STATUS_TONE: Record<string, Tone> = { OK: 'ok', 'NO POWER': 'alarm', 'NO DATA': 'alarm', STALE: 'warn', FROZEN: 'alarm' };
const FAULTS: { f: WindFault; label: string }[] = [
  { f: null, label: 'NORMAL' },
  { f: 'fail', label: 'SENSOR FAIL' },
  { f: 'comms', label: 'COMMS LOSS' },
  { f: 'frozen', label: 'FROZEN OUTPUT' },
  { f: 'bias', label: `${WIND_CONFIG.biasDeg}° MISALIGNED` },
];

/**
 * Wind HMI. The physical wind (the simulator's environment, with gusts) is kept apart from what the two wind sensors
 * report: a sensor fault changes only the measurement and therefore the DP wind feed-forward, never the wind force.
 */
export function WindPanel() {
  const w = useControllerState(windSystem);
  const dp = useControllerState(dpSystem);
  const [err, setErr] = useState<string | null>(null);
  const send = (c: WindCommand) => {
    windSystem.dispatch(c);
    setErr(windSystem.lastError);
  };
  const open = w.alarms.filter((a) => !w.acknowledged.includes(a));
  const ffOn = dp.windFF.valid;
  return (
    <HmiFrame
      title="WIND"
      testid="wind-hmi"
      status={
        <Chip tone={w.output.valid ? (w.output.disagreement ? 'warn' : 'ok') : 'alarm'} testid="wind-status">
          {w.output.valid ? (w.output.disagreement ? 'DISAGREE' : `USING ${w.output.source}`) : 'NO VALID SENSOR'}
        </Chip>
      }
    >
      <Rejection msg={err} onClose={() => setErr(null)} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr]">
        <Rose w={w} headingDeg={(dp.eta[2] * 180) / Math.PI} />
        <div className="flex flex-col gap-1">
          <Section title="Physical wind (simulator)">
            <KV k="True wind now" v={`${w.actual.speedKn.toFixed(1)} kn from ${w.actual.fromDeg.toFixed(0)}°`} testid="wind-actual" />
            <KV k="Mean (set)" v={`${dp.wind.speedKn.toFixed(0)} kn from ${dp.wind.fromDeg.toFixed(0)}° · gust ${w.gustPct} %`} />
            <KV k="Apparent at vessel" v={`${w.apparent.speedKn.toFixed(1)} kn · ${w.apparent.relFromDeg.toFixed(0)}° rel`} testid="wind-apparent" />
          </Section>
          <Section title="Measured (to DP)">
            <KV k="Relative wind" v={w.output.valid ? `${w.output.relSpeedKn.toFixed(1)} kn · ${w.output.relFromDeg.toFixed(0)}° rel` : '–'} testid="wind-measured" />
            <KV
              k="True wind (calculated)"
              v={w.output.trueAvailable && w.output.trueSpeedKn !== null ? `${w.output.trueSpeedKn.toFixed(1)} kn from ${w.output.trueFromDeg!.toFixed(0)}°` : 'UNAVAILABLE'}
              testid="wind-true-calc"
            />
            <KV k="DP wind feed-forward" v={<Chip tone={ffOn ? 'ok' : 'warn'}>{ffOn ? 'ON' : 'OFF'}</Chip>} testid="wind-ff" />
          </Section>
        </div>
      </div>
      <Section title="Environment">
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <span className="w-16 text-[#9fb3c2]">Mean speed</span>
          {[0, 10, 20, 30, 40].map((v) => (
            <Btn key={v} label={`${v} kn`} tone={Math.round(dp.wind.speedKn) === v ? 'go' : undefined} onClick={() => dpSystem.dispatch({ type: 'set-wind', speedKn: v, fromDeg: dp.wind.fromDeg })} testid={`wind-speed-${v}`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <span className="w-16 text-[#9fb3c2]">From</span>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((v) => (
            <Btn key={v} label={`${v}°`} tone={Math.round(dp.wind.fromDeg) === v ? 'go' : undefined} onClick={() => dpSystem.dispatch({ type: 'set-wind', speedKn: dp.wind.speedKn, fromDeg: v })} testid={`wind-dir-${v}`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <span className="w-16 text-[#9fb3c2]">Gustiness</span>
          {[0, 10, 20, 35].map((v) => (
            <Btn key={v} label={`${v} %`} tone={w.gustPct === v ? 'go' : undefined} onClick={() => send({ type: 'set-gust', pct: v })} testid={`wind-gust-${v}`} />
          ))}
        </div>
      </Section>
      <Section title="Sensors" right={<Btn label={`ACK${open.length ? ` (${open.length})` : ''}`} disabled={!open.length} tone={open.length ? 'warn' : undefined} onClick={() => send({ type: 'acknowledge' })} testid="wind-ack" />}>
        <div className="flex flex-wrap gap-1 text-[10px]">
          <span className="text-[#9fb3c2]">Selection</span>
          {(['AUTO', 'WS1', 'WS2'] as const).map((sel) => (
            <Btn key={sel} label={sel} tone={w.selection === sel ? 'go' : undefined} onClick={() => send({ type: 'select', selection: sel })} testid={`wind-select-${sel}`} />
          ))}
        </div>
        {w.sensors.map((x) => {
          const cfg = WIND_CONFIG.sensors.find((c) => c.id === x.id)!;
          return (
            <div key={x.id} className="flex flex-col gap-1 rounded-sm bg-black/25 p-1.5" data-testid={`wind-sensor-${x.id}`} data-status={x.status}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[10px] font-semibold">{cfg.label}</span>
                <span className="flex gap-1">
                  {x.shadowed && <Chip tone="info">MAST SHADOW</Chip>}
                  {x.exhaust && <Chip tone="info">EXHAUST</Chip>}
                  <Chip tone={STATUS_TONE[x.status]} testid={`wind-sensor-${x.id}-status`}>
                    {x.status}
                  </Chip>
                </span>
              </div>
              <KV k="Reading" v={x.lastMsgT === null ? '–' : `${x.relSpeedKn.toFixed(1)} kn · ${x.relFromDeg.toFixed(0)}° rel · ${(w.time - x.lastMsgT).toFixed(0)} s ago`} testid={`wind-sensor-${x.id}-reading`} />
              <div className="flex flex-wrap gap-1">
                {FAULTS.map((f) => (
                  <Btn key={String(f.f)} label={f.label} tone={x.fault === f.f ? (f.f ? 'danger' : 'go') : undefined} onClick={() => send({ type: 'sensor-fault', id: x.id as WindSensorId, fault: f.f })} testid={`wind-${x.id}-fault-${f.f ?? 'none'}`} />
                ))}
              </div>
            </div>
          );
        })}
        <ul className="flex flex-col gap-0.5 font-mono text-[10px]" data-testid="wind-alarms">
          {w.alarms.length === 0 && <li className="text-[#7f93a3]">No active wind alarms</li>}
          {w.alarms.map((a) => {
            const sev = /^(WIND_ALL_FAIL|WIND_NO_DATA|WIND_FROZEN|WIND_NO_POWER)/.test(a) ? 'alarm' : 'warning';
            return (
              <li key={a} className={`${open.includes(a) ? 'animate-pulse' : ''} ${sev === 'alarm' ? 'text-[#ff9b9b]' : 'text-amber-200'}`}>
                {SEV_SYMBOL[sev]} {WIND_ALARM_TEXT(a)}
              </li>
            );
          })}
        </ul>
      </Section>
      <DataNote>
        Two generic ultrasonic wind sensors on the port and starboard ends of a cross-arm near the mast top, above the radars (make and model not supplied). Gusts are a seeded
        first-order random process, so a run can be repeated exactly. The leeward sensor sits in the mast wake and reads low; wind from astern carries
        exhaust turbulence. Disagreement, stale, frozen and no-data checks use configurable demonstration thresholds (wind.ts).
      </DataNote>
    </HmiFrame>
  );
}

/** Compass rose: north up, vessel outline at its heading, true wind (cyan), apparent (white) and each sensor (yellow). */
function Rose({ w, headingDeg }: { w: WindState; headingDeg: number }) {
  const R = 60;
  const arrow = (fromDeg: number, len: number, color: string, testid: string, dash = false) => {
    const a = ((fromDeg - 90) * Math.PI) / 180;
    const x = 75 + Math.cos(a) * R;
    const y = 75 + Math.sin(a) * R;
    const x2 = 75 + Math.cos(a) * (R - len);
    const y2 = 75 + Math.sin(a) * (R - len);
    return <line data-testid={testid} x1={x} y1={y} x2={x2} y2={y2} stroke={color} strokeWidth="2.4" strokeDasharray={dash ? '3 2' : undefined} markerEnd="url(#wh)" />;
  };
  const kn = (v: number) => Math.min(48, 10 + v);
  return (
    <svg viewBox="0 0 150 150" className="mx-auto w-full max-w-[160px]" role="img" aria-label="Wind direction" data-testid="wind-rose">
      <defs>
        <marker id="wh" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="currentColor" />
        </marker>
      </defs>
      <circle cx="75" cy="75" r={R} fill="#061423" stroke="#2c4a6b" />
      {['N', 'E', 'S', 'W'].map((t, i) => (
        <text key={t} x={75 + Math.sin((i * Math.PI) / 2) * (R + 8)} y={78 - Math.cos((i * Math.PI) / 2) * (R + 8)} fontSize="8" textAnchor="middle" fill="#9fb3c2">
          {t}
        </text>
      ))}
      <g transform={`rotate(${headingDeg} 75 75)`}>
        <path d="M75 52 L82 64 L82 96 L68 96 L68 64 Z" fill="#24303a" stroke="#c7d3dc" />
      </g>
      <g color="#5fc8ff">{arrow(w.actual.fromDeg, kn(w.actual.speedKn), '#5fc8ff', 'rose-true')}</g>
      <g color="#e6edf2">{arrow((w.apparent.relFromDeg + headingDeg + 360) % 360, kn(w.apparent.speedKn), '#e6edf2', 'rose-apparent', true)}</g>
      {w.output.trueAvailable && w.output.trueFromDeg !== null && <g color="#f2c94c">{arrow(w.output.trueFromDeg, kn(w.output.trueSpeedKn ?? 0) - 6, '#f2c94c', 'rose-measured')}</g>}
      <text x="4" y="146" fontSize="6.5" fill="#5fc8ff">
        — true
      </text>
      <text x="40" y="146" fontSize="6.5" fill="#e6edf2">
        - - apparent
      </text>
      <text x="92" y="146" fontSize="6.5" fill="#f2c94c">
        — measured
      </text>
    </svg>
  );
}
