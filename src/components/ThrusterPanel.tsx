import { useState } from 'react';
import { bowThruster } from '../simulations/controller';
import { useControllerState } from '../simulations/useController';
import { clampCommand } from '../simulations/thruster';
import { useAppStore } from '../store/useAppStore';

/** Operator controls for the illustrative bow tunnel thruster model. No azimuth input: the tunnel is fixed. */
export function ThrusterPanel() {
  const s = useControllerState(bowThruster);
  const startSimulating = useAppStore((st) => st.startSimulating);
  const stopSimulating = useAppStore((st) => st.stopSimulating);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pct = Math.round(s.command * 100);

  const setCommand = (raw: unknown) => {
    try {
      clampCommand(raw);
      setError(null);
    } catch {
      setError('Enter a number between -100 and 100.');
      return;
    }
    bowThruster.dispatch({ type: 'set-command', value: raw });
  };

  const dir = s.thrustKN > 0.3 ? 'Starboard' : s.thrustKN < -0.3 ? 'Port' : 'None';
  const running = s.status === 'running';
  const paused = s.status === 'paused';

  return (
    <section aria-label="Bow thruster demonstration" className="flex flex-col gap-3 border-t border-cyan/15 pt-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan">Thruster demonstration</h3>
        <span data-testid="thruster-status" className="rounded-sm bg-cyan/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-cyan-light">
          {s.status}
        </span>
      </div>
      <label className="flex flex-col gap-1 text-xs text-mute">
        <span className="flex justify-between">
          <span>◀ Port</span>
          <span className="font-mono text-ink">Command {pct > 0 ? '+' : ''}{pct}%</span>
          <span>Starboard ▶</span>
        </span>
        <input
          data-testid="thrust-slider"
          type="range"
          min={-100}
          max={100}
          step={5}
          value={pct}
          onChange={(e) => setCommand(Number(e.target.value) / 100)}
          className="accent-cyan"
          aria-label="Thrust command, percent. Negative pushes the bow to port, positive to starboard."
        />
      </label>
      <form
        className="flex items-center gap-2 text-xs"
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
          placeholder="Exact %"
          value={text ?? ''}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="thrust-error"
          className="w-24 rounded-sm border border-cyan/25 bg-abyss px-2 py-1 font-mono text-ink"
        />
        <button type="submit" className="rounded-sm border border-cyan/40 px-2 py-1 text-ink hover:bg-cyan/10">
          Set
        </button>
        <span id="thrust-error" role="alert" className="text-[11px] text-amber-300">
          {error}
        </span>
      </form>
      <div className="grid grid-cols-4 gap-1.5">
        <Btn
          testid="thruster-start"
          label={paused ? 'Resume' : 'Start'}
          disabled={running}
          primary
          onClick={() => {
            bowThruster.dispatch({ type: paused ? 'resume' : 'start' });
            startSimulating();
          }}
        />
        <Btn testid="thruster-pause" label="Pause" disabled={!running} onClick={() => bowThruster.dispatch({ type: 'pause' })} />
        <Btn
          testid="thruster-stop"
          label="Stop"
          disabled={s.status === 'stopped' || s.status === 'stopping'}
          onClick={() => bowThruster.dispatch({ type: 'stop' })}
        />
        <Btn
          testid="thruster-reset"
          label="Reset"
          onClick={() => {
            bowThruster.dispatch({ type: 'reset' });
            stopSimulating();
            setError(null);
          }}
        />
      </div>
      <dl className="grid grid-cols-3 gap-2 font-mono text-[11px]">
        <Readout label="Propeller" value={`${s.rpm.toFixed(0)} rpm`} testid="readout-rpm" />
        <Readout label="Lateral force" value={`${Math.abs(s.thrustKN).toFixed(1)} kN`} testid="readout-thrust" />
        <Readout label="Push bow to" value={dir} />
      </dl>
    </section>
  );
}

function Btn({ label, onClick, disabled, primary, testid }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; testid: string }) {
  return (
    <button
      type="button"
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-sm border px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        primary ? 'border-cyan bg-cyan/20 text-ink hover:bg-cyan/30' : 'border-cyan/30 text-ink hover:bg-cyan/10'
      }`}
    >
      {label}
    </button>
  );
}

function Readout({ label, value, testid }: { label: string; value: string; testid?: string }) {
  return (
    <div className="rounded-sm border border-cyan/10 bg-cyan/5 px-2 py-1.5">
      <dt className="text-[10px] uppercase text-mute">{label}</dt>
      <dd data-testid={testid} className="text-ink">
        {value}
      </dd>
    </div>
  );
}
