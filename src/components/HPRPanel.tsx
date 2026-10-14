import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ASSUMED_SOUND_SPEED, roundTripTime, slantRange, transceiverFace, TRANSPONDER } from '../simulations/acoustic';
import { hprDeployment } from '../simulations/deploymentController';
import { dpSystem } from '../simulations/dpController';
import {
  ASSUMED_POLE_SPEED,
  ASSUMED_VALVE_SECONDS,
  DEPLOY_ALARM_TEXT,
  deployStatus,
  hprReady,
  isParked,
  unacknowledgedDeploy,
  type DeployCommand,
} from '../simulations/deployment';
import { useControllerState } from '../simulations/useController';
import { DATUM_TO_HULL, HPT5000, HPT5000_REPEATABILITY, POLE_LENGTH, STROKE, T7950, transceiverY } from '../equipment/hprData';
import { useAppStore } from '../store/useAppStore';
import { HmiBtn, Readout, Status, Toggle } from './ThrusterPanel';

/**
 * Type 7950 deployment control and HPT 5000 status. Shown for both the machine and the transceiver.
 * Commands go through interlocks; a blocked command shows why and changes nothing.
 */
export function HPRPanel() {
  const s = useControllerState(hprDeployment);
  const dp = useControllerState(dpSystem);
  const signals = useAppStore((st) => st.hprSignals);
  const setSignals = useAppStore((st) => st.setHprSignals);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [speed, setSpeed] = useState(hprDeployment.timeScale);

  const send = (cmd: DeployCommand) => {
    hprDeployment.dispatch(cmd);
    setError(hprDeployment.lastError);
  };

  const status = deployStatus(s);
  const ready = hprReady(s);
  const face = transceiverY(s.travel).face;
  const belowHull = DATUM_TO_HULL - face; // positive = face below the hull plating
  const faceScene = transceiverFace(s.travel);
  const range = slantRange(faceScene, TRANSPONDER);
  const rtt = roundTripTime(range);
  const hprRef = dp.refs.find((r) => r.id === 'HPR');
  const dpRef = !hprRef?.installed
    ? 'Not in this DP class'
    : !ready
      ? 'Unavailable (not deployed)'
      : dp.status !== 'running'
        ? 'Ready (DP sim stopped)'
        : hprRef.fault === 'lost'
          ? 'Lost'
          : hprRef.rejected
            ? 'Rejected by voting'
            : 'In use';
  const open = unacknowledgedDeploy(s);
  const moving = s.motion !== 'idle';
  const valveMoving = s.valve === 'opening' || s.valve === 'closing';

  const body = (
    <section aria-label="Type 7950 deployment control" data-testid="hpr-hmi" className="flex flex-col gap-2 rounded-sm border border-[#4a5560] bg-[#23282d] p-2 text-[#e6edf2]">
      <header className="flex items-center justify-between rounded-sm bg-[#16324a] px-2 py-1">
        <h3 className="text-[11px] font-semibold tracking-[0.12em]">TYPE 7950 · HPT 5000</h3>
        <div className="flex items-center gap-1.5">
          <span
            data-testid="hpr-status"
            className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${
              status === 'E-STOP' ? 'bg-[#8f1d1d]' : status === 'DEPLOYED' ? 'bg-[#1f6b34]' : moving || valveMoving ? 'bg-amber-700/70' : 'bg-white/10'
            }`}
          >
            {status}
          </span>
          <button type="button" data-testid="hpr-expand" aria-label={expanded ? 'Close full screen' : 'Open full screen'} onClick={() => setExpanded((v) => !v)} className="rounded-sm border border-white/20 px-1.5 text-[11px] hover:bg-white/10">
            {expanded ? '✕' : '⤢'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
        <Mimic travel={s.travel} valveOpen={s.valveOpen} doorOpen={s.doorOpen} ready={ready} />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <span className="text-[#9fb3c2]">Control</span>
            <Toggle testid="hpr-place-local" label="LOCAL" active={s.place === 'LOCAL'} onClick={() => send({ type: 'set-place', place: 'LOCAL' })} />
            <Toggle testid="hpr-place-remote" label="REMOTE" active={s.place === 'REMOTE'} onClick={() => send({ type: 'set-place', place: 'REMOTE' })} />
            <label className="flex items-center gap-1 text-[#9fb3c2]">
              Sim
              <select
                data-testid="hpr-speed"
                value={speed}
                onChange={(e) => {
                  hprDeployment.setTimeScale(Number(e.target.value));
                  setSpeed(hprDeployment.timeScale);
                }}
                className="rounded-sm border border-white/20 bg-[#16324a] px-1 text-[#e6edf2]"
              >
                {[1, 5, 10, 20].map((x) => (
                  <option key={x} value={x}>
                    {x}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          <dl className="grid grid-cols-1 gap-1 font-mono text-[11px] min-[480px]:grid-cols-2">
            <Readout label="Pole travel" value={`${s.travel.toFixed(2)} / ${STROKE.toFixed(2)} m`} testid="hpr-travel" />
            <Readout label="Face below hull" value={belowHull > 0 ? `${belowHull.toFixed(2)} m` : 'Inside seachest'} testid="hpr-depth" />
            <Readout label="Gate valve" value={`${Math.round(s.valveOpen * 100)} % ${s.valve.toUpperCase()}`} testid="hpr-valve" />
            <Readout label="Seachest door" value={s.doorOpen ? 'OPEN' : 'CLOSED'} />
          </dl>
          <dl className="grid grid-cols-1 gap-0.5 text-[10px]">
            <Status k="HPR as DP reference" v={dpRef} warn={!ready && !!hprRef?.installed} />
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <HmiBtn testid="hpr-valve-open" label="OPEN VALVE" disabled={s.valve === 'open' || s.valve === 'opening'} onClick={() => send({ type: 'open-valve' })} />
        <HmiBtn testid="hpr-valve-close" label="CLOSE VALVE" disabled={s.valve === 'closed' || s.valve === 'closing'} onClick={() => send({ type: 'close-valve' })} />
        <HmiBtn
          testid="hpr-door"
          label={s.doorOpen ? 'CLOSE DOOR' : 'OPEN DOOR'}
          onClick={() => send({ type: s.doorOpen ? 'close-door' : 'open-door' })}
        />
        <HmiBtn testid="hpr-deploy" label="DEPLOY" tone="go" disabled={s.motion === 'deploying' || s.travel >= STROKE} onClick={() => send({ type: 'deploy' })} />
        <HmiBtn testid="hpr-retract" label="RETRACT" disabled={s.motion === 'retracting' || isParked(s)} onClick={() => send({ type: 'retract' })} />
        <HmiBtn testid="hpr-stop" label="STOP" disabled={!moving && !valveMoving} onClick={() => send({ type: 'stop' })} />
        <HmiBtn testid="hpr-estop" label="E-STOP" tone="danger" disabled={s.estop} onClick={() => send({ type: 'emergency-stop' })} />
        <HmiBtn
          testid="hpr-reset"
          label="RESET SIM"
          onClick={() => {
            send({ type: 'reset' });
            setError(null);
          }}
        />
        <HmiBtn testid="hpr-ack" label={`ALARM ACK${open.length ? ` (${open.length})` : ''}`} tone={open.length ? 'warn' : undefined} disabled={!open.length} onClick={() => send({ type: 'acknowledge' })} />
      </div>
      <p data-testid="hpr-error" role="alert" className="min-h-[1rem] text-[10px] text-amber-300">
        {error ? `Interlock: ${error}` : ''}
      </p>

      <ul data-testid="hpr-alarms" aria-label="Deployment alarms" className="flex min-h-[1.5rem] flex-col gap-0.5 rounded-sm bg-black/30 px-2 py-1 font-mono text-[10px]">
        {s.alarms.length === 0 ? (
          <li className="text-[#7f93a3]">No active alarms</li>
        ) : (
          s.alarms.map((a) => (
            <li key={a} className={open.includes(a) ? 'animate-pulse text-amber-300' : 'text-amber-200/70'}>
              ⚠ {DEPLOY_ALARM_TEXT[a]}
            </li>
          ))
        )}
      </ul>

      <div className="flex items-center justify-between border-t border-white/10 pt-2">
        <h4 className="text-[10px] font-semibold tracking-[0.12em] text-[#9fb3c2]">HPT 5000 ACOUSTIC</h4>
        <button
          type="button"
          data-testid="hpr-signals"
          aria-pressed={signals}
          onClick={() => setSignals(!signals)}
          className={`rounded-sm border px-2 py-1 text-[10px] ${signals ? 'border-cyan bg-cyan/20' : 'border-white/25 hover:bg-white/10'}`}
        >
          {signals ? 'Hide signals' : 'Show signals'}
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px] sm:grid-cols-4">
        <Readout label="Slant range" value={ready ? `${range.toFixed(1)} m` : '—'} testid="hpr-range" />
        <Readout label="Round trip" value={ready ? `${(rtt * 1000).toFixed(1)} ms` : '—'} />
        <Readout label="Repeatability" value={ready ? `±${(HPT5000_REPEATABILITY * range * 100).toFixed(1)} cm` : '—'} />
        <Readout label="Sound speed" value={`${ASSUMED_SOUND_SPEED} m/s`} />
      </dl>
      <p className="text-[9px] leading-snug text-[#7f93a3]">
        Verified from your documents: dimensions on the 7950 drawings ({T7950.overall.value * 1000} mm standard length, {T7950.deployedExtension.value * 1000} mm
        extension, {T7950.mountingSpace.height.value} × {T7950.mountingSpace.width.value} × {T7950.mountingSpace.depth.value} m space) and HPT 5000{' '}
        {HPT5000.type} data from UM-8142 §12.1.3. Not in the documents, so illustrative here: pole speed {ASSUMED_POLE_SPEED} m/s, valve stroke{' '}
        {ASSUMED_VALVE_SECONDS} s, the parked position, the interlocks, sound speed and the seabed transponder. Ranges are geometric (r = c·t/2); signals show
        only when deployed. Not connected to real equipment.
      </p>
    </section>
  );

  return expanded ? (
    <>
      <p className="border-t border-cyan/15 pt-3 text-xs text-mute">Deployment panel open full screen.</p>
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

/** Side-elevation mimic: hull, gate valve, seachest, sealing and top sections, pole and transceiver. */
function Mimic({ travel, valveOpen, doorOpen, ready }: { travel: number; valveOpen: number; doorOpen: boolean; ready: boolean }) {
  // Scale: machine-local metres → SVG units. Top at 5.93, bottom shows the deployed face (≈ -3.1).
  const top = T7950.overall.value + 0.1;
  const bottom = transceiverY(STROKE).face - 0.25;
  const H = 230;
  const k = H / (top - bottom);
  const y = (m: number) => (top - m) * k;
  const cx = 60;
  const w = (m: number) => m * k;
  const tr = transceiverY(travel);
  const hull = DATUM_TO_HULL;
  return (
    <svg viewBox={`0 0 120 ${H}`} className="h-full max-h-[17rem] min-h-[13rem] w-full rounded-sm bg-[#0b1620]" role="img" aria-label={`Pole travel ${travel.toFixed(2)} metres`}>
      {/* Sea and hull */}
      <rect x="0" y={y(hull)} width="120" height={H - y(hull)} fill="#06263a" />
      <line x1="0" x2="120" y1={y(hull)} y2={y(hull)} stroke="#8aa0b2" strokeWidth="1.5" />
      <text x="3" y={y(hull) - 3} fontSize="6" fill="#8aa0b2">HULL</text>
      {/* Top section, sealing section, seachest */}
      <rect x={cx - w(T7950.topSectionWidth.value) / 2} y={y(T7950.overall.value)} width={w(T7950.topSectionWidth.value)} height={y(T7950.topSectionBase.value) - y(T7950.overall.value)} fill="none" stroke="#9aa3ab" strokeWidth="1" />
      <rect x={cx - w(T7950.sealingWidth.value) / 2} y={y(T7950.topSectionBase.value)} width={w(T7950.sealingWidth.value)} height={y(T7950.seachestTop.value) - y(T7950.topSectionBase.value)} fill="#3a4148" stroke="#9aa3ab" strokeWidth="0.8" />
      <rect x={cx - w(T7950.seachestWidth.value) / 2} y={y(T7950.seachestTop.value)} width={w(T7950.seachestWidth.value)} height={y(T7950.gateStackTop.value) - y(T7950.seachestTop.value)} fill="#2c3238" stroke="#9aa3ab" strokeWidth="0.8" />
      {doorOpen && <rect x={cx + w(T7950.seachestWidth.value) / 2} y={y(1.0)} width="5" height={w(0.55)} fill="#e0a43a" />}
      {/* Gate valve: red; the opening is shown as the gap */}
      <rect x={cx - w(T7950.gateFlangeDiameter.value) / 2} y={y(T7950.gateStackTop.value)} width={w(T7950.gateFlangeDiameter.value)} height={y(0) - y(T7950.gateStackTop.value)} fill="#c0261d" />
      <rect x={cx - (w(T7950.poleDiameter.value) / 2) * valveOpen - 0.5} y={y(T7950.gateStackTop.value) + 1} width={w(T7950.poleDiameter.value) * valveOpen + 1} height={y(0) - y(T7950.gateStackTop.value) - 2} fill="#06263a" />
      {/* Penetrator */}
      <rect x={cx - w(0.178)} y={y(0)} width={w(0.356)} height={y(hull) - y(0)} fill="#6d747b" />
      {/* Pole and transceiver */}
      <rect x={cx - w(T7950.poleDiameter.value) / 2} y={y(tr.flange + POLE_LENGTH)} width={w(T7950.poleDiameter.value)} height={y(tr.flange) - y(tr.flange + POLE_LENGTH)} fill="#4a5058" opacity="0.85" />
      <rect x={cx - w(HPT5000.diameter.value) / 2} y={y(tr.flange)} width={w(HPT5000.diameter.value)} height={y(tr.face) - y(tr.flange)} fill={ready ? '#d4a24c' : '#b98d4b'} stroke={ready ? '#67f0ff' : 'none'} strokeWidth="1" />
      {/* 2,775 mm deployed reference */}
      <line x1="98" x2="98" y1={y(0)} y2={y(-T7950.deployedExtension.value)} stroke="#67f0ff" strokeWidth="0.6" strokeDasharray="2 1.5" />
      <text x="100" y={(y(0) + y(-T7950.deployedExtension.value)) / 2} fontSize="6" fill="#67f0ff">2775</text>
      <line x1="10" x2="110" y1={y(0)} y2={y(0)} stroke="#67f0ff" strokeWidth="0.4" strokeDasharray="1 1.5" />
      <text x="3" y={y(0) - 2} fontSize="5.5" fill="#67f0ff">DATUM</text>
    </svg>
  );
}
