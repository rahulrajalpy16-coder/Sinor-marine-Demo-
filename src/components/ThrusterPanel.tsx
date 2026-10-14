import { useState } from 'react';
import { createPortal } from 'react-dom';
import { bowThruster } from '../simulations/controller';
import { useControllerState } from '../simulations/useController';
import { ALARM_TEXT, clampCommand, DEFAULT_THRUSTER_PARAMS as P, maxPitchForLimit, unacknowledged, type ThrusterState } from '../simulations/thruster';
import { useAppStore } from '../store/useAppStore';

const STATUS_LABEL: Record<ThrusterState['status'], string> = {
  stopped: 'STOPPED',
  starting: 'STARTING',
  running: 'RUNNING',
  stopping: 'STOPPING',
  paused: 'SIM PAUSED',
  shutdown: 'TRIPPED',
};

/**
 * Z-Thrust style CPP control HMI for the bow tunnel thruster (illustrative, not the OEM software).
 * Lever sets blade pitch; the motor runs at constant speed. No azimuth input: the tunnel is fixed.
 */
export function ThrusterPanel() {
  const s = useControllerState(bowThruster);
  const startSimulating = useAppStore((st) => st.startSimulating);
  const stopSimulating = useAppStore((st) => st.stopSimulating);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const send = (cmd: Parameters<typeof bowThruster.dispatch>[0]) => {
    bowThruster.dispatch(cmd);
    setError(bowThruster.lastError);
  };
  const setCommand = (raw: unknown) => {
    try {
      clampCommand(raw);
    } catch {
      setError('Enter a number between -100 and 100.');
      return;
    }
    send({ type: 'set-command', value: raw });
  };

  const pct = Math.round(s.command * 100);
  const inCmd = s.station === 'BRIDGE';
  const running = s.status === 'running' || s.status === 'starting';
  const paused = s.status === 'paused';
  const dir = s.thrustKN > 0.3 ? 'Starboard' : s.thrustKN < -0.3 ? 'Port' : 'None';
  const alarmsOpen = unacknowledged(s);
  const clipPct = Math.round(maxPitchForLimit(s.powerLimit) * 100);

  const body = (
    <section
      aria-label="Z-Thrust CPP control"
      data-testid="zthrust-hmi"
      className="flex flex-col gap-2 rounded-sm border border-[#4a5560] bg-[#23282d] p-2 text-[#e6edf2]"
    >
      <header className="flex items-center justify-between rounded-sm bg-[#16324a] px-2 py-1">
        <h3 className="text-[11px] font-semibold tracking-[0.12em]">Z-THRUST CPP CONTROL · BT1</h3>
        <div className="flex items-center gap-1.5">
          <span data-testid="thruster-status" className="sr-only">
            {s.status}
          </span>
          <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${statusTone(s.status)}`}>{STATUS_LABEL[s.status]}</span>
          <button
            type="button"
            data-testid="hmi-expand"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Close full screen control panel' : 'Open control panel full screen'}
            className="rounded-sm border border-white/20 px-1.5 text-[11px] hover:bg-white/10"
          >
            {expanded ? '✕' : '⤢'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Gauge label="Propeller RPM" value={s.rpm} min={0} max={P.ratedRpm * 1.1} ticks={[0, 100, 200, 300]} unit="rpm" />
        <Gauge label="Propeller pitch %" value={s.pitch * 100} min={-100} max={100} ticks={[-100, -50, 0, 50, 100]} unit="%" setpoint={pct} bipolar />
      </div>

      <dl className="grid grid-cols-2 gap-1 text-[10px]">
        <Status k="Control active" v={inCmd ? 'IN CMD' : 'NOT IN CMD'} warn={!inCmd} />
        <Status k="Station" v={s.station === 'BRIDGE' ? 'BRIDGE' : 'DP'} />
        <Status k="Control mode" v={s.mode} />
        <Status k="Thrust mode" v="CONST RPM" />
        <Status k="Shutdown" v={s.status === 'shutdown' ? 'E-STOP' : 'NORMAL'} warn={s.status === 'shutdown'} />
        <Status k="Reduction zone" v={`AUTO ${Math.round(s.powerLimit * 100)}%`} warn={s.loadClipping} />
      </dl>

      <dl className="grid grid-cols-4 gap-1 font-mono text-[10px]">
        <Readout label="Pitch cmd" value={`${pct > 0 ? '+' : ''}${pct}%`} testid="readout-command" />
        <Readout label="Motor load" value={`${s.powerKW.toFixed(0)} kW`} testid="readout-power" />
        <Readout label="Thrust" value={`${Math.abs(s.thrustKN).toFixed(1)} kN`} testid="readout-thrust" />
        <Readout label="Bow to" value={dir} />
      </dl>
      <span data-testid="readout-rpm" className="sr-only">
        {s.rpm.toFixed(0)} rpm
      </span>

      <div className="flex gap-1 text-[10px]">
        <Toggle label="FU" active={s.mode === 'FU'} onClick={() => send({ type: 'set-mode', mode: 'FU' })} testid="mode-fu" />
        <Toggle label="NFU" active={s.mode === 'NFU'} onClick={() => send({ type: 'set-mode', mode: 'NFU' })} testid="mode-nfu" />
        <span className="w-2" />
        <Toggle label="Bridge" active={s.station === 'BRIDGE'} onClick={() => send({ type: 'set-station', station: 'BRIDGE' })} testid="station-bridge" />
        <Toggle label="DP" active={s.station === 'DP'} onClick={() => send({ type: 'set-station', station: 'DP' })} testid="station-dp" />
        <label className="ml-auto flex items-center gap-1 text-[#9fb3c2]">
          Power
          <select
            data-testid="power-limit"
            value={s.powerLimit}
            onChange={(e) => send({ type: 'set-power-limit', value: Number(e.target.value) })}
            className="rounded-sm border border-white/20 bg-[#16324a] px-1 py-0.5 text-[#e6edf2]"
            aria-label="Available power for the thruster (power management limit)"
          >
            {[1, 0.75, 0.5, 0.3].map((v) => (
              <option key={v} value={v}>
                {v * 100}%
              </option>
            ))}
          </select>
        </label>
      </div>

      {s.mode === 'FU' ? (
        <label className="flex flex-col gap-1 text-[10px] text-[#9fb3c2]">
          <span className="flex justify-between">
            <span>◀ Port</span>
            <span>Follow-up lever{s.loadClipping ? ` · clipped at ±${clipPct}%` : ''}</span>
            <span>Stbd ▶</span>
          </span>
          <input
            data-testid="thrust-slider"
            type="range"
            min={-100}
            max={100}
            step={5}
            value={pct}
            disabled={!inCmd}
            onChange={(e) => setCommand(Number(e.target.value) / 100)}
            className="accent-[#3fd16b] disabled:opacity-40"
            aria-label="Pitch lever, percent. Negative pushes the bow to port, positive to starboard."
          />
        </label>
      ) : (
        <div className="flex items-center justify-between gap-1 text-[10px]">
          <HmiBtn testid="nfu-port" label="◀ PORT" disabled={!inCmd} onClick={() => send({ type: 'nudge', delta: -0.05 })} />
          <span className="text-[#9fb3c2]">Non-follow-up: 5% per press</span>
          <HmiBtn testid="nfu-stbd" label="STBD ▶" disabled={!inCmd} onClick={() => send({ type: 'nudge', delta: 0.05 })} />
        </div>
      )}

      <form
        className="flex items-center gap-1.5 text-[10px]"
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(text);
          if (text === null || text.trim() === '' || !Number.isFinite(v)) {
            setError('Enter a number between -100 and 100.');
            return;
          }
          setCommand(v / 100);
          setText(null);
        }}
      >
        <input
          data-testid="thrust-input"
          inputMode="decimal"
          placeholder="Exact pitch %"
          value={text ?? ''}
          disabled={!inCmd}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="thrust-error"
          className="w-24 rounded-sm border border-white/20 bg-[#16324a] px-2 py-1 font-mono text-[#e6edf2] disabled:opacity-40"
        />
        <HmiBtn testid="thrust-set" label="SET" submit disabled={!inCmd} />
        <span id="thrust-error" role="alert" className="text-[10px] text-amber-300">
          {error}
        </span>
      </form>

      <div className="grid grid-cols-3 gap-1">
        <HmiBtn
          testid="thruster-start"
          label="START"
          tone="go"
          disabled={s.status !== 'stopped' && s.status !== 'stopping'}
          onClick={() => {
            send({ type: 'start' });
            startSimulating();
          }}
        />
        <HmiBtn
          testid="thruster-stop"
          label="STOP"
          disabled={s.status === 'stopped' || s.status === 'stopping' || s.status === 'shutdown'}
          onClick={() => send({ type: 'stop' })}
        />
        <HmiBtn testid="thruster-estop" label="E-STOP" tone="danger" disabled={s.status === 'stopped' || s.status === 'shutdown'} onClick={() => send({ type: 'emergency-stop' })} />
        <HmiBtn
          testid="thruster-pause"
          label={paused ? 'RESUME SIM' : 'PAUSE SIM'}
          disabled={!paused && !running && s.status !== 'stopping' && s.status !== 'shutdown'}
          onClick={() => send({ type: paused ? 'resume' : 'pause' })}
        />
        <HmiBtn
          testid="thruster-reset"
          label="RESET"
          onClick={() => {
            send({ type: 'reset' });
            stopSimulating();
            setError(null);
          }}
        />
        <HmiBtn testid="thruster-ack" label={`ALARM ACK${alarmsOpen.length ? ` (${alarmsOpen.length})` : ''}`} tone={alarmsOpen.length ? 'warn' : undefined} disabled={!alarmsOpen.length} onClick={() => send({ type: 'acknowledge' })} />
      </div>

      <ul data-testid="thruster-alarms" aria-label="Active alarms" className="flex min-h-[1.5rem] flex-col gap-0.5 rounded-sm bg-black/30 px-2 py-1 font-mono text-[10px]">
        {s.alarms.length === 0 ? (
          <li className="text-[#7f93a3]">No active alarms</li>
        ) : (
          s.alarms.map((a) => (
            <li key={a} className={alarmsOpen.includes(a) ? 'animate-pulse text-amber-300' : 'text-amber-200/70'}>
              ⚠ {ALARM_TEXT[a]}
            </li>
          ))
        )}
      </ul>
      <p className="text-[9px] leading-snug text-[#7f93a3]">
        P2 standard: CPP tunnel thruster, {P.ratedPowerKW} kW constant-speed motor, Ø{P.tunnelDiameterM} m, {P.blades} blades. Start needs the lever at zero; Stop
        de-pitches before the motor runs down. Illustrative values.
      </p>
    </section>
  );

  return expanded ? (
    <>
      <p className="border-t border-cyan/15 pt-3 text-xs text-mute">Control panel open full screen.</p>
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-xl">{body}</div>
        </div>,
        document.body,
      )}
    </>
  ) : (
    <div className="border-t border-cyan/15 pt-3">{body}</div>
  );
}

function statusTone(status: ThrusterState['status']) {
  if (status === 'running') return 'bg-[#1f6b34] text-white';
  if (status === 'shutdown') return 'bg-[#8f1d1d] text-white';
  if (status === 'stopped') return 'bg-[#3a4148] text-[#cfd8df]';
  return 'bg-[#8a6d12] text-white';
}

/** Arc gauge in the Z-Thrust style: 240° sweep, needle, optional setpoint marker and port/stbd colouring. */
function Gauge({
  label,
  value,
  min,
  max,
  ticks,
  unit,
  setpoint,
  bipolar,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  ticks: number[];
  unit: string;
  setpoint?: number;
  bipolar?: boolean;
}) {
  const cx = 60;
  const cy = 58;
  const r = 44;
  const ang = (v: number) => (-210 + ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 240) * (Math.PI / 180);
  const pt = (v: number, rr: number) => [cx + rr * Math.cos(ang(v)), cy + rr * Math.sin(ang(v))] as const;
  const arc = (a: number, b: number, rr: number) => {
    const [x1, y1] = pt(a, rr);
    const [x2, y2] = pt(b, rr);
    const large = Math.abs(ang(b) - ang(a)) > Math.PI ? 1 : 0;
    return `M${x1} ${y1} A${rr} ${rr} 0 ${large} 1 ${x2} ${y2}`;
  };
  const [nx, ny] = pt(value, r - 6);
  return (
    <figure className="flex flex-col items-center rounded-sm bg-black/30 pb-1">
      <svg viewBox="0 0 120 92" className="w-full max-w-[150px]" role="img" aria-label={`${label}: ${value.toFixed(0)} ${unit}`}>
        {bipolar ? (
          <>
            <path d={arc(min, 0, r)} stroke="#e04444" strokeWidth="6" fill="none" />
            <path d={arc(0, max, r)} stroke="#3fd16b" strokeWidth="6" fill="none" />
          </>
        ) : (
          <>
            <path d={arc(min, max * 0.91, r)} stroke="#9aa6b0" strokeWidth="3" fill="none" />
            <path d={arc(max * 0.91, max, r)} stroke="#e04444" strokeWidth="6" fill="none" />
          </>
        )}
        {ticks.map((t) => {
          const [x1, y1] = pt(t, r - 4);
          const [x2, y2] = pt(t, r + 3);
          const [tx, ty] = pt(t, r - 13);
          return (
            <g key={t}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e6edf2" strokeWidth="1" />
              <text x={tx} y={ty + 3} fontSize="7" fill="#cfd8df" textAnchor="middle">
                {Math.abs(t)}
              </text>
            </g>
          );
        })}
        {setpoint !== undefined &&
          (() => {
            const [sx, sy] = pt(setpoint, r + 6);
            return <circle cx={sx} cy={sy} r="2.6" fill="#f2c94c" />;
          })()}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#f4f8fc" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill="#f4f8fc" />
        <text x={cx} y={86} fontSize="11" fill="#f4f8fc" textAnchor="middle" fontFamily="monospace">
          {value.toFixed(0)}
          {unit === '%' ? '%' : ''}
        </text>
        {bipolar && (
          <>
            <text x={8} y={88} fontSize="7" fill="#e04444">
              PORT
            </text>
            <text x={112} y={88} fontSize="7" fill="#3fd16b" textAnchor="end">
              STBD
            </text>
          </>
        )}
      </svg>
      <figcaption className="text-[10px] text-[#9fb3c2]">{label}</figcaption>
    </figure>
  );
}

export function Status({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-sm bg-[#16324a] px-1.5 py-0.5">
      <dt className="text-[#9fb3c2]">{k}</dt>
      <dd className={`font-mono ${warn ? 'text-amber-300' : 'text-[#e6edf2]'}`}>
        {warn ? '⚠ ' : ''}
        {v}
      </dd>
    </div>
  );
}

export function Readout({ label, value, testid }: { label: string; value: string; testid?: string }) {
  return (
    <div className="rounded-sm border border-white/10 bg-black/30 px-1.5 py-1">
      <dt className="text-[9px] uppercase text-[#9fb3c2]">{label}</dt>
      <dd data-testid={testid} className="text-[#e6edf2]">
        {value}
      </dd>
    </div>
  );
}

export function Toggle({ label, active, onClick, testid }: { label: string; active: boolean; onClick: () => void; testid: string }) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-sm border px-1.5 py-0.5 ${active ? 'border-[#3fd16b] bg-[#1f6b34] text-white' : 'border-white/20 text-[#cfd8df] hover:bg-white/10'}`}
    >
      {label}
    </button>
  );
}

export function HmiBtn({
  label,
  onClick,
  disabled,
  tone,
  testid,
  submit,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'go' | 'danger' | 'warn';
  testid: string;
  submit?: boolean;
}) {
  const t =
    tone === 'go'
      ? 'border-[#3fd16b] bg-[#1f6b34] hover:bg-[#25803e]'
      : tone === 'danger'
        ? 'border-[#e04444] bg-[#8f1d1d] hover:bg-[#a52525]'
        : tone === 'warn'
          ? 'border-amber-400 bg-amber-700/60 hover:bg-amber-700/80'
          : 'border-white/25 bg-[#2f363c] hover:bg-[#3a434a]';
  return (
    <button
      type={submit ? 'submit' : 'button'}
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-sm border px-2 py-1.5 text-[10px] font-semibold tracking-wide text-white transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${t}`}
    >
      {label}
    </button>
  );
}
