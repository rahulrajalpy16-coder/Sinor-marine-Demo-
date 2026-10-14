import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { dpSystem } from '../simulations/dpController';
import { bowThruster } from '../simulations/controller';
import { useControllerState } from '../simulations/useController';
import {
  classLayout,
  controlIntegrity,
  DEFAULT_DP_PARAMS as P,
  DP_ALARM_TEXT,
  headingDeg,
  positionError,
  unacknowledgedDP,
  wrapPi,
  type DPClass,
  type DPCommand,
  type DPMode,
  type DPState,
  type RefState,
  REF_LABEL,
} from '../simulations/dp';
import { useAppStore } from '../store/useAppStore';
import { HmiBtn, Readout, Toggle } from './ThrusterPanel';

const MODES: { mode: DPMode; label: string }[] = [
  { mode: 'STANDBY', label: 'STANDBY' },
  { mode: 'JOYSTICK', label: 'JOYSTICK' },
  { mode: 'AUTO_HEADING', label: 'AUTO HDG' },
  { mode: 'AUTO_POSITION', label: 'AUTO POS' },
];
type Tab = 'position' | 'thrusters' | 'redundancy' | 'environment';
const fmt = (v: number, d = 1) => (Math.abs(v) < 0.05 && d > 0 ? (0).toFixed(d) : v.toFixed(d));

/**
 * DP operator station HMI (illustrative, not OEM software): class 1/2/3 architecture, modes,
 * position plot, thruster allocation, references with voting, controller redundancy and failure
 * injection, consequence analysis and alarms.
 */
export function DPPanel() {
  const s = useControllerState(dpSystem);
  const bt = useControllerState(bowThruster);
  const startSimulating = useAppStore((st) => st.startSimulating);
  const stopSimulating = useAppStore((st) => st.stopSimulating);
  const showNetwork = useAppStore((st) => st.dpNetwork);
  const setShowNetwork = useAppStore((st) => st.setDpNetwork);
  const [tab, setTab] = useState<Tab>('position');
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = (cmd: DPCommand) => {
    dpSystem.dispatch(cmd);
    setError(dpSystem.lastError);
  };
  const integ = controlIntegrity(s);
  const lay = classLayout(s.dpClass);
  const open = unacknowledgedDP(s);
  const posErr = positionError(s);
  const hdgErr = (wrapPi(s.eta[2] - s.setpoint[2]) * 180) / Math.PI;

  const body = (
    <section aria-label="DP operator station" data-testid="dp-hmi" className="flex flex-col gap-2 rounded-sm border border-[#2c4a6b] bg-[#0b1a2c] p-2 text-[#e6edf2]">
      <header className="flex flex-wrap items-center justify-between gap-1.5 rounded-sm bg-[#12345a] px-2 py-1">
        <h3 className="text-[11px] font-semibold tracking-[0.12em]">DP SYSTEM · CLASS {s.dpClass}</h3>
        <div className="flex items-center gap-1">
          <span data-testid="dp-status" className="sr-only">
            {s.status}
          </span>
          <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${s.dpLost ? 'animate-pulse bg-[#8f1d1d]' : s.status === 'running' ? 'bg-[#1f6b34]' : 'bg-[#3a4148]'}`}>
            {s.dpLost ? 'DP LOST' : s.status === 'running' ? (integ.backup ? 'BACKUP DP' : 'DP ON') : s.status === 'paused' ? 'SIM PAUSED' : 'DP OFF'}
          </span>
          <button
            type="button"
            data-testid="dp-expand"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Close full screen DP panel' : 'Open DP panel full screen'}
            className="rounded-sm border border-white/20 px-1.5 text-[11px] hover:bg-white/10"
          >
            {expanded ? '✕' : '⤢'}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <span className="text-[#9fb3c2]">Class</span>
        {([1, 2, 3] as DPClass[]).map((c) => (
          <Toggle key={c} label={`DP${c}`} active={s.dpClass === c} onClick={() => send({ type: 'set-class', value: c })} testid={`dp-class-${c}`} />
        ))}
        <span className="ml-auto text-[#9fb3c2]">Sim speed</span>
        <select
          data-testid="dp-speed"
          value={s.timeScale}
          onChange={(e) => send({ type: 'set-time-scale', value: Number(e.target.value) })}
          className="rounded-sm border border-white/20 bg-[#12345a] px-1 py-0.5"
          aria-label="Simulation speed multiplier"
        >
          {[1, 5, 10, 20].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            data-testid={`dp-mode-${m.mode}`}
            aria-pressed={s.mode === m.mode}
            onClick={() => send({ type: 'set-mode', mode: m.mode })}
            className={`rounded-sm border px-1 py-1.5 text-[10px] font-semibold ${s.mode === m.mode ? 'border-[#3fd16b] bg-[#1f6b34]' : 'border-white/20 bg-[#16324a] hover:bg-[#1d4266]'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1">
        <HmiBtn
          testid="dp-start"
          label={s.status === 'paused' ? 'RESUME' : 'START SIM'}
          tone="go"
          disabled={s.status === 'running'}
          onClick={() => {
            send({ type: s.status === 'paused' ? 'resume' : 'start' });
            startSimulating();
          }}
        />
        <HmiBtn testid="dp-pause" label="PAUSE" disabled={s.status !== 'running'} onClick={() => send({ type: 'pause' })} />
        <HmiBtn
          testid="dp-reset"
          label="RESET"
          onClick={() => {
            send({ type: 'reset' });
            stopSimulating();
          }}
        />
      </div>

      <dl className="grid grid-cols-4 gap-1 font-mono text-[10px]">
        <Readout label="Pos err" value={`${fmt(posErr)} m`} testid="dp-pos-error" />
        <Readout label="Heading" value={`${fmt(headingDeg(s.eta[2]))}°`} testid="dp-heading" />
        <Readout label="Hdg err" value={`${fmt(hdgErr)}°`} />
        <Readout label="Sim time" value={`${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`} />
      </dl>

      <div role="tablist" aria-label="DP pages" className="grid grid-cols-4 gap-1 text-[10px]">
        {(['position', 'thrusters', 'redundancy', 'environment'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            data-testid={`dp-tab-${t}`}
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-t-sm border-b-2 px-1 py-1 uppercase ${tab === t ? 'border-[#5fc8ff] bg-[#12345a] text-white' : 'border-transparent text-[#9fb3c2] hover:text-white'}`}
          >
            {t === 'redundancy' ? 'Redund.' : t === 'environment' ? 'Environ.' : t}
          </button>
        ))}
      </div>

      {tab === 'position' && <PositionPage s={s} send={send} />}
      {tab === 'thrusters' && <ThrustersPage s={s} bt={bt} send={send} />}
      {tab === 'redundancy' && <RedundancyPage s={s} send={send} lay={lay} showNetwork={showNetwork} setShowNetwork={setShowNetwork} />}
      {tab === 'environment' && <EnvironmentPage s={s} send={send} />}

      {error && (
        <p role="alert" className="text-[10px] text-amber-300">
          {error}
        </p>
      )}
      <div className="flex items-start gap-1">
        <ul data-testid="dp-alarms" aria-label="DP alarms" className="flex min-h-[1.5rem] flex-1 flex-col gap-0.5 rounded-sm bg-black/30 px-2 py-1 font-mono text-[10px]">
          {s.alarms.length === 0 ? (
            <li className="text-[#7f93a3]">No active alarms</li>
          ) : (
            s.alarms.map((a) => (
              <li key={a} className={open.includes(a) ? 'animate-pulse text-amber-300' : 'text-amber-200/70'}>
                ⚠ {DP_ALARM_TEXT[a]}
                {a === 'CONSEQUENCE' && s.consequence.worst ? ` (${s.consequence.worst})` : ''}
              </li>
            ))
          )}
        </ul>
        <HmiBtn testid="dp-ack" label={`ACK${open.length ? ` (${open.length})` : ''}`} tone={open.length ? 'warn' : undefined} disabled={!open.length} onClick={() => send({ type: 'acknowledge' })} />
      </div>
      <p className="text-[9px] leading-snug text-[#7f93a3]">
        Educational 3-DOF model (wind, current, PID with wind feed-forward, least-squares allocation). Redundancy per DP class follows the distributed
        Bridge Mate DP architecture datasheet. Not a certified DP system.
      </p>
    </section>
  );

  return expanded ? (
    <>
      <p className="border-t border-cyan/15 pt-3 text-xs text-mute">DP panel open full screen.</p>
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-2xl">{body}</div>
        </div>,
        document.body,
      )}
    </>
  ) : (
    <div className="border-t border-cyan/15 pt-3">{body}</div>
  );
}

type Send = (c: DPCommand) => void;

function PositionPage({ s, send }: { s: DPState; send: Send }) {
  const [n, setN] = useState('');
  const [e, setE] = useState('');
  const [h, setH] = useState('');
  const auto = s.mode === 'AUTO_POSITION' || s.mode === 'AUTO_HEADING';
  const joy = s.mode === 'JOYSTICK' || s.mode === 'AUTO_HEADING';
  return (
    <div className="flex flex-col gap-2">
      <PositionPlot s={s} />
      <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
        <Readout label="Setpoint N" value={`${fmt(s.setpoint[0])} m`} />
        <Readout label="Setpoint E" value={`${fmt(s.setpoint[1])} m`} />
        <Readout label="Setpoint hdg" value={`${fmt(headingDeg(s.setpoint[2]))}°`} testid="dp-sp-heading" />
      </div>
      <form
        className="flex flex-wrap items-end gap-1 text-[10px]"
        onSubmit={(ev) => {
          ev.preventDefault();
          send({ type: 'set-setpoint', north: n === '' ? undefined : n, east: e === '' ? undefined : e, headingDeg: h === '' ? undefined : h });
          setN('');
          setE('');
          setH('');
        }}
      >
        <Field label="North m" value={n} onChange={setN} testid="dp-sp-north" />
        <Field label="East m" value={e} onChange={setE} testid="dp-sp-east" />
        <Field label="Heading °" value={h} onChange={setH} testid="dp-sp-heading-input" />
        <HmiBtn testid="dp-sp-set" label="MOVE" submit disabled={!auto} />
        <HmiBtn testid="dp-sp-here" label="SET HERE" disabled={!auto} onClick={() => send({ type: 'setpoint-here' })} />
      </form>
      <div className="grid grid-cols-6 gap-1 text-[10px]">
        {[
          ['N+5', { north: s.setpoint[0] + 5 }],
          ['N−5', { north: s.setpoint[0] - 5 }],
          ['E+5', { east: s.setpoint[1] + 5 }],
          ['E−5', { east: s.setpoint[1] - 5 }],
          ['Hdg+10', { headingDeg: headingDeg(s.setpoint[2]) + 10 }],
          ['Hdg−10', { headingDeg: headingDeg(s.setpoint[2]) - 10 }],
        ].map(([label, v]) => (
          <HmiBtn key={label as string} testid={`dp-step-${label}`} label={label as string} disabled={!auto} onClick={() => send({ type: 'set-setpoint', ...(v as object) })} />
        ))}
      </div>
      {joy && (
        <div className="flex flex-col gap-1 rounded-sm bg-black/20 p-1.5 text-[10px]">
          <span className="text-[#9fb3c2]">Joystick{s.mode === 'AUTO_HEADING' ? ' (heading held automatically)' : ''}</span>
          <Slider label="Surge" left="Astern" right="Ahead" value={s.joystick[0]} onChange={(v) => send({ type: 'set-joystick', surge: v })} testid="dp-joy-surge" />
          <Slider label="Sway" left="Port" right="Stbd" value={s.joystick[1]} onChange={(v) => send({ type: 'set-joystick', sway: v })} testid="dp-joy-sway" />
          {s.mode === 'JOYSTICK' && (
            <Slider label="Yaw" left="Port" right="Stbd" value={s.joystick[2]} onChange={(v) => send({ type: 'set-joystick', yaw: v })} testid="dp-joy-yaw" />
          )}
          <HmiBtn testid="dp-joy-zero" label="CENTRE JOYSTICK" onClick={() => send({ type: 'set-joystick', surge: 0, sway: 0, yaw: 0 })} />
        </div>
      )}
    </div>
  );
}

/** North-up position plot around the setpoint: vessel (estimated), actual position, track and thrust vectors. */
function PositionPlot({ s }: { s: DPState }) {
  const err = positionError(s);
  const R = [60, 120, 250, 500].find((r) => r > err * 1.4 + 45) ?? 500;
  const size = 220;
  const k = size / 2 / R;
  const toXY = (north: number, east: number) => [size / 2 + (east - s.setpoint[1]) * k, size / 2 - (north - s.setpoint[0]) * k] as const;
  const hull = [
    [40, 0],
    [30, 9],
    [-40, 9],
    [-40, -9],
    [30, -9],
  ];
  const outline = (n0: number, e0: number, psi: number) =>
    hull
      .map(([x, y]) => {
        const [px, py] = toXY(n0 + x * Math.cos(psi) - y * Math.sin(psi), e0 + x * Math.sin(psi) + y * Math.cos(psi));
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
  const psi = s.eta[2];
  const thrustArrows = s.thrusters.map((t, i) => {
    const g = P.thrusters[i];
    const fx = t.forceN * Math.cos(t.angle);
    const fy = t.forceN * Math.sin(t.angle);
    const L = (Math.hypot(fx, fy) / 250e3) * 30;
    if (L < 0.5) return null;
    const bn = s.est[0] + g.x * Math.cos(psi) - g.y * Math.sin(psi);
    const be = s.est[1] + g.x * Math.sin(psi) + g.y * Math.cos(psi);
    const dirN = (fx * Math.cos(psi) - fy * Math.sin(psi)) / Math.hypot(fx, fy);
    const dirE = (fx * Math.sin(psi) + fy * Math.cos(psi)) / Math.hypot(fx, fy);
    const [x0, y0] = toXY(bn, be);
    const [x1, y1] = toXY(bn + dirN * L * (R / 60), be + dirE * L * (R / 60));
    return <line key={t.id} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#5fc8ff" strokeWidth="1.6" markerEnd="url(#dp-arrow)" />;
  });
  const arrowAt = (deg: number, toward: boolean, color: string, label: string, ox: number) => {
    const a = (deg * Math.PI) / 180 + (toward ? 0 : Math.PI);
    const cx = ox;
    const cy = 18;
    const dx = Math.sin(a) * 11;
    const dy = -Math.cos(a) * 11;
    return (
      <g>
        <line x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} stroke={color} strokeWidth="2" markerEnd="url(#dp-arrow-w)" />
        <text x={cx} y={cy + 20} fontSize="7" fill={color} textAnchor="middle">
          {label}
        </text>
      </g>
    );
  };
  const truthDiffers = Math.hypot(s.eta[0] - s.est[0], s.eta[1] - s.est[1]) > 1;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full rounded-sm bg-[#061423]" role="img" aria-label={`Position plot, error ${err.toFixed(1)} metres`} data-testid="dp-plot">
      <defs>
        <marker id="dp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10z" fill="#5fc8ff" />
        </marker>
        <marker id="dp-arrow-w" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10z" fill="context-stroke" />
        </marker>
      </defs>
      {[1, 2, 3, 4].map((i) => (
        <circle key={i} cx={size / 2} cy={size / 2} r={(i * size) / 8} fill="none" stroke="#1f3b57" strokeWidth="0.8" />
      ))}
      <line x1={size / 2} y1="0" x2={size / 2} y2={size} stroke="#1f3b57" strokeWidth="0.8" />
      <line x1="0" y1={size / 2} x2={size} y2={size / 2} stroke="#1f3b57" strokeWidth="0.8" />
      <text x={size / 2 + 12} y={size / 2 - (size / 8) * 4 + 9} fontSize="7" fill="#6f8aa3">
        {R} m
      </text>
      <text x={size / 2 + 2} y={size / 2 - size / 8 + 8} fontSize="7" fill="#6f8aa3">
        {R / 4} m
      </text>
      <text x={size / 2} y="9" fontSize="8" fill="#9fb3c2" textAnchor="middle">
        N
      </text>
      {/* Setpoint: cross and heading tick */}
      <g stroke="#f2c94c" strokeWidth="1.4">
        <line x1={size / 2 - 6} y1={size / 2} x2={size / 2 + 6} y2={size / 2} />
        <line x1={size / 2} y1={size / 2 - 6} x2={size / 2} y2={size / 2 + 6} />
        <line x1={size / 2} y1={size / 2} x2={size / 2 + Math.sin(s.setpoint[2]) * 20} y2={size / 2 - Math.cos(s.setpoint[2]) * 20} strokeDasharray="2 2" />
      </g>
      {s.track.length > 1 && (
        <polyline points={s.track.map(([tn, te]) => toXY(tn, te).join(',')).join(' ')} fill="none" stroke="#3f7fae" strokeWidth="1" strokeOpacity="0.8" />
      )}
      {truthDiffers && <polygon points={outline(s.eta[0], s.eta[1], psi)} fill="none" stroke="#e04444" strokeWidth="1" strokeDasharray="3 2" />}
      <polygon points={outline(s.est[0], s.est[1], psi)} fill="#5fc8ff22" stroke={s.dpLost ? '#e04444' : '#e6edf2'} strokeWidth="1.2" data-testid="dp-plot-vessel" />
      {thrustArrows}
      {arrowAt(s.wind.fromDeg, false, '#c7d3dc', `WIND ${s.wind.speedKn.toFixed(0)} kn`, 26)}
      {arrowAt(s.current.toDeg, true, '#3fd1c4', `CURR ${s.current.speedKn.toFixed(1)} kn`, size - 26)}
      {truthDiffers && (
        <text x={size - 4} y={size - 6} fontSize="7" fill="#e04444" textAnchor="end">
          - - actual position (sim truth)
        </text>
      )}
    </svg>
  );
}

function ThrustersPage({ s, bt, send }: { s: DPState; bt: ReturnType<typeof bowThruster.getState>; send: Send }) {
  const btInDp = bt.station === 'DP';
  const btRunning = bt.status === 'running' || bt.status === 'starting';
  const total = s.tauAchieved;
  return (
    <div className="flex flex-col gap-2 text-[10px]">
      <table className="w-full border-separate border-spacing-y-0.5 font-mono" data-testid="dp-thruster-table">
        <thead className="text-left text-[9px] text-[#9fb3c2]">
          <tr>
            <th>Unit</th>
            <th>State</th>
            <th>Force</th>
            <th>Dir</th>
            <th className="w-1/3">Load</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {s.thrusters.map((t, i) => {
            const g = P.thrusters[i];
            const state = t.failed ? 'FAIL' : t.available ? 'DP' : t.id === 'BT1' ? (btInDp ? 'STOPPED' : 'BRIDGE') : 'OFF';
            const load = Math.min(1, Math.abs(t.forceN) / g.maxN);
            const dir = g.azimuth ? `${((((t.angle * 180) / Math.PI) % 360) + 360) % 360 | 0}°` : t.forceN > 500 ? 'STBD' : t.forceN < -500 ? 'PORT' : '—';
            return (
              <tr key={t.id} className="bg-black/25">
                <td className="px-1">{t.id}</td>
                <td className={`px-1 ${state === 'DP' ? 'text-[#3fd16b]' : state === 'FAIL' ? 'text-[#e04444]' : 'text-amber-300'}`}>{state}</td>
                <td className="px-1">{(Math.abs(t.forceN) / 1000).toFixed(0)} kN</td>
                <td className="px-1">{dir}</td>
                <td className="px-1">
                  <div className="h-1.5 w-full rounded bg-white/10">
                    <div className={`h-1.5 rounded ${load > 0.9 ? 'bg-[#e04444]' : 'bg-[#5fc8ff]'}`} style={{ width: `${load * 100}%` }} />
                  </div>
                </td>
                <td className="px-1 text-right">
                  <button
                    type="button"
                    data-testid={`dp-fail-${t.id}`}
                    onClick={() => send({ type: 'fail-thruster', id: t.id, failed: !t.failed })}
                    className="rounded-sm border border-white/20 px-1 hover:bg-white/10"
                  >
                    {t.failed ? 'Restore' : 'Fail'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-1 rounded-sm bg-black/20 p-1.5">
        <span className="text-[#9fb3c2]">BT1 (Z-Thrust, P2 CPP):</span>
        <span className="font-mono">
          {bt.station === 'DP' ? 'DP in command' : 'Bridge lever in command'} · {bt.status}
        </span>
        <HmiBtn
          testid="dp-bt1-take"
          label={btInDp && btRunning ? 'BT1 IN DP' : 'GIVE BT1 TO DP'}
          disabled={btInDp && btRunning}
          onClick={() => {
            bowThruster.dispatch({ type: 'set-station', station: 'DP' });
            if (bowThruster.getState().status === 'stopped') bowThruster.dispatch({ type: 'start' });
          }}
        />
        {btInDp && (
          <HmiBtn testid="dp-bt1-release" label="RETURN TO BRIDGE" onClick={() => bowThruster.dispatch({ type: 'set-station', station: 'BRIDGE' })} />
        )}
      </div>
      <dl className="grid grid-cols-3 gap-1 font-mono">
        <Readout label="Surge Fx" value={`${(total[0] / 1000).toFixed(0)} / ${(s.tauCmd[0] / 1000).toFixed(0)} kN`} />
        <Readout label="Sway Fy" value={`${(total[1] / 1000).toFixed(0)} / ${(s.tauCmd[1] / 1000).toFixed(0)} kN`} />
        <Readout label="Yaw Mz" value={`${(total[2] / 1e6).toFixed(1)} / ${(s.tauCmd[2] / 1e6).toFixed(1)} MNm`} />
      </dl>
      <p className="text-[9px] text-[#7f93a3]">Delivered / demanded. BT2 is a DP-only twin of the P2 bow thruster; AZ1/AZ2 are the stern azimuths.</p>
    </div>
  );
}

function RedundancyPage({
  s,
  send,
  lay,
  showNetwork,
  setShowNetwork,
}: {
  s: DPState;
  send: Send;
  lay: ReturnType<typeof classLayout>;
  showNetwork: boolean;
  setShowNetwork: (v: boolean) => void;
}) {
  const integ = controlIntegrity(s);
  const healthy = s.controllers.filter((c) => c.installed && !c.failed);
  return (
    <div className="flex flex-col gap-2 text-[10px]">
      <p className="rounded-sm bg-black/20 p-1.5 leading-snug text-[#c7d3dc]" data-testid="dp-architecture">
        DP{s.dpClass}: {lay.controllers} controller{lay.controllers > 1 ? 's' : ''}
        {lay.controllers > 1 ? ' (majority voting)' : ''}, {lay.operatorStations} operator station{lay.operatorStations > 1 ? 's' : ''}, {lay.networks === 2 ? 'dual' : 'single'} network,{' '}
        {s.refs.filter((r) => r.installed).length} position references fitted{lay.backupStation ? ', backup controller + station in a separate A60 room' : ''}.
      </p>
      <Group title="Controllers">
        {s.controllers
          .filter((c) => c.installed)
          .map((c) => {
            const role = c.failed ? 'REJECTED' : integ.backup ? 'LOST (bridge)' : healthy[0]?.id === c.id ? 'ONLINE · VOTING' : lay.controllers > 1 ? 'VOTING' : 'ONLINE';
            return (
              <Unit key={c.id} name={`Ctrl ${c.id}`} status={s.bridgeCompartmentLost ? 'LOST' : role} bad={c.failed || s.bridgeCompartmentLost} testid={`dp-ctrl-${c.id}`}>
                <SmallBtn onClick={() => send({ type: 'fail-controller', id: c.id, failed: !c.failed })} label={c.failed ? 'Restore' : 'Fail'} testid={`dp-fail-ctrl-${c.id}`} />
              </Unit>
            );
          })}
        {lay.backupStation && <Unit name="Backup (A60)" status={integ.backup ? 'IN COMMAND' : 'STANDBY'} bad={false} testid="dp-ctrl-backup" />}
      </Group>
      <Group title="Networks">
        {s.networks
          .filter((n) => n.installed)
          .map((n) => (
            <Unit key={n.id} name={`Net ${n.id}`} status={n.failed ? 'FAIL' : 'OK'} bad={n.failed} testid={`dp-net-${n.id}`}>
              <SmallBtn onClick={() => send({ type: 'fail-network', id: n.id, failed: !n.failed })} label={n.failed ? 'Restore' : 'Fail'} testid={`dp-fail-net-${n.id}`} />
            </Unit>
          ))}
      </Group>
      <Group title="Position references">
        {s.refs
          .filter((r) => r.installed)
          .map((r) => (
            <Unit key={r.id} name={REF_LABEL[r.id]} status={refStatus(r)} bad={r.enabled && (r.rejected || !!r.fault || !r.ready)} testid={`dp-ref-${r.id}`}>
              <SmallBtn onClick={() => send({ type: 'ref-enable', id: r.id, enabled: !r.enabled })} label={r.enabled ? 'Desel' : 'Select'} testid={`dp-sel-${r.id}`} />
              <SmallBtn onClick={() => send({ type: 'ref-fault', id: r.id, fault: r.fault === 'drift' ? null : 'drift' })} label={r.fault === 'drift' ? 'Stop drift' : 'Drift'} testid={`dp-drift-${r.id}`} />
              <SmallBtn onClick={() => send({ type: 'ref-fault', id: r.id, fault: r.fault === 'lost' ? null : 'lost' })} label={r.fault === 'lost' ? 'Restore' : 'Lose'} testid={`dp-lose-${r.id}`} />
            </Unit>
          ))}
      </Group>
      {s.dpClass === 3 && (
        <HmiBtn
          testid="dp-fire"
          tone={s.bridgeCompartmentLost ? 'warn' : 'danger'}
          label={s.bridgeCompartmentLost ? 'RESTORE BRIDGE COMPARTMENT' : 'FIRE IN BRIDGE (DP3 TEST)'}
          onClick={() => send({ type: 'bridge-compartment', lost: !s.bridgeCompartmentLost })}
        />
      )}
      <p data-testid="dp-consequence" className={`rounded-sm p-1.5 ${s.consequence.ok ? 'bg-[#1f6b34]/40' : 'bg-[#8f1d1d]/60'}`}>
        Consequence analysis: {s.consequence.ok ? 'position can be held after the worst single thruster failure.' : `losing ${s.consequence.worst} would exceed remaining capability.`}
      </p>
      <label className="flex items-center gap-1.5 text-[#c7d3dc]">
        <input type="checkbox" data-testid="dp-network-toggle" checked={showNetwork} onChange={(e) => setShowNetwork(e.target.checked)} />
        Show DP network and IO units in 3D
      </label>
    </div>
  );
}

function refStatus(r: RefState) {
  if (!r.enabled) return r.ready ? 'DESELECTED' : 'OFF · NOT READY';
  if (!r.ready) return r.id === 'HPR' ? 'NOT DEPLOYED' : 'NOT READY';
  if (r.fault === 'lost') return 'LOST';
  if (r.rejected) return 'REJECTED';
  if (r.fault === 'drift') return 'DRIFTING';
  return 'OK';
}

function EnvironmentPage({ s, send }: { s: DPState; send: Send }) {
  return (
    <div className="flex flex-col gap-1.5 text-[10px]">
      <Range label={`Wind speed ${s.wind.speedKn.toFixed(0)} kn`} min={0} max={60} step={1} value={s.wind.speedKn} onChange={(v) => send({ type: 'set-wind', speedKn: v })} testid="dp-wind-speed" />
      <Range label={`Wind from ${s.wind.fromDeg.toFixed(0)}°`} min={0} max={359} step={5} value={s.wind.fromDeg} onChange={(v) => send({ type: 'set-wind', fromDeg: v })} testid="dp-wind-dir" />
      <Range label={`Current ${s.current.speedKn.toFixed(1)} kn`} min={0} max={4} step={0.1} value={s.current.speedKn} onChange={(v) => send({ type: 'set-current', speedKn: v })} testid="dp-current-speed" />
      <Range label={`Current setting to ${s.current.toDeg.toFixed(0)}°`} min={0} max={359} step={5} value={s.current.toDeg} onChange={(v) => send({ type: 'set-current', toDeg: v })} testid="dp-current-dir" />
      <dl className="grid grid-cols-3 gap-1 font-mono">
        <Readout label="Env Fx" value={`${(s.tauEnv[0] / 1000).toFixed(0)} kN`} />
        <Readout label="Env Fy" value={`${(s.tauEnv[1] / 1000).toFixed(0)} kN`} />
        <Readout label="Env Mz" value={`${(s.tauEnv[2] / 1e6).toFixed(1)} MNm`} />
      </dl>
      <p className="text-[9px] text-[#7f93a3]">Wind is given as the direction it comes from; current as the direction it sets towards. Forces use simple illustrative coefficients.</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h4 className="text-[9px] uppercase tracking-wider text-[#9fb3c2]">{title}</h4>
      {children}
    </div>
  );
}

function Unit({ name, status, bad, children, testid }: { name: string; status: string; bad: boolean; children?: ReactNode; testid: string }) {
  return (
    <div className="flex items-center gap-1 rounded-sm bg-[#12345a] px-1.5 py-0.5" data-testid={testid}>
      <span className="w-20 font-mono">{name}</span>
      <span className={`flex-1 font-mono ${bad ? 'text-amber-300' : 'text-[#3fd16b]'}`}>{status}</span>
      {children}
    </div>
  );
}

function SmallBtn({ label, onClick, testid }: { label: string; onClick: () => void; testid: string }) {
  return (
    <button type="button" data-testid={testid} onClick={onClick} className="rounded-sm border border-white/20 px-1.5 hover:bg-white/10">
      {label}
    </button>
  );
}

function Field({ label, value, onChange, testid }: { label: string; value: string; onChange: (v: string) => void; testid: string }) {
  return (
    <label className="flex flex-col text-[#9fb3c2]">
      {label}
      <input
        data-testid={testid}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 rounded-sm border border-white/20 bg-[#12345a] px-1 py-0.5 font-mono text-[#e6edf2]"
      />
    </label>
  );
}

function Slider({ label, left, right, value, onChange, testid }: { label: string; left: string; right: string; value: number; onChange: (v: number) => void; testid: string }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="w-9 text-[#9fb3c2]">{label}</span>
      <span className="w-8 text-right text-[9px] text-[#7f93a3]">{left}</span>
      <input data-testid={testid} type="range" min={-100} max={100} step={5} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} className="flex-1 accent-[#5fc8ff]" />
      <span className="w-8 text-[9px] text-[#7f93a3]">{right}</span>
    </label>
  );
}

function Range({ label, min, max, step, value, onChange, testid }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; testid: string }) {
  return (
    <label className="flex flex-col gap-0.5 text-[#c7d3dc]">
      {label}
      <input data-testid={testid} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[#5fc8ff]" />
    </label>
  );
}
