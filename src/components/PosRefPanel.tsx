import { useState, type ReactNode } from 'react';
import { posRefs } from '../simulations/posrefsController';
import { dpSystem } from '../simulations/dpController';
import { useControllerState } from '../simulations/useController';
import {
  cyscanRange,
  KNOT,
  poleStatus,
  POSREF_ALARM_TEXT,
  posRefReadiness,
  radascanRange,
  sprintNavAltitude,
  sprintNavDepth,
  tautWireAngle,
  tautWireStatus,
  TW_VERTICAL,
  WATER_DEPTH,
  type PosRefAlarm,
  type PosRefCommand,
} from '../simulations/posrefs';
import { REF_LABEL, type RefId } from '../simulations/dp';
import { CYSCAN, POLE_8097, RADASCAN, SEASTAR, SMT_TW, SPRINTNAV } from '../equipment/posrefData';
import { HmiBtn, Readout, Status, Toggle } from './ThrusterPanel';

function usePosRefs() {
  const s = useControllerState(posRefs);
  const dp = useControllerState(dpSystem);
  const [error, setError] = useState<string | null>(null);
  const send = (cmd: PosRefCommand) => {
    posRefs.dispatch(cmd);
    setError(posRefs.lastError);
  };
  const pose = posRefs.getPose();
  return { s, dp, send, error, pose, ready: posRefReadiness(s, pose) };
}

function Shell({ title, status, ok, testid, children }: { title: string; status: string; ok: boolean; testid: string; children: ReactNode }) {
  return (
    <div className="border-t border-cyan/15 pt-3">
      <section aria-label={title} data-testid={testid} className="flex flex-col gap-2 rounded-sm border border-[#4a5560] bg-[#23282d] p-2 text-[#e6edf2]">
        <header className="flex items-center justify-between gap-2 rounded-sm bg-[#16324a] px-2 py-1">
          <h3 className="text-[11px] font-semibold tracking-[0.12em]">{title}</h3>
          <span data-testid={`${testid}-status`} className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${ok ? 'bg-[#1f6b34]' : 'bg-white/10'}`}>
            {status}
          </span>
        </header>
        {children}
      </section>
    </div>
  );
}

/** How DP sees this reference, with the operator's select / deselect. */
function DpRef({ id, testid }: { id: RefId; testid: string }) {
  const dp = useControllerState(dpSystem);
  const r = dp.refs.find((x) => x.id === id);
  if (!r?.installed) return <Status k="In DP" v="Not fitted in this DP class" />;
  const v = !r.enabled
    ? 'Deselected'
    : !r.ready
      ? 'Selected, not ready'
      : dp.status !== 'running'
        ? 'Selected, ready (DP sim stopped)'
        : r.fault === 'lost'
          ? 'Lost'
          : r.rejected
            ? 'Rejected by voting'
            : 'In use';
  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px]">
      <dl className="flex-1">
        <Status k={`${REF_LABEL[id]} · DP`} v={v} warn={r.enabled && (!r.ready || r.rejected || r.fault !== null)} />
      </dl>
      <Toggle testid={`${testid}-dp-select`} label={r.enabled ? 'SELECTED IN DP' : 'SELECT IN DP'} active={r.enabled} onClick={() => dpSystem.dispatch({ type: 'ref-enable', id, enabled: !r.enabled })} />
    </div>
  );
}

function SimSpeed({ testid }: { testid: string }) {
  const [speed, setSpeed] = useState(posRefs.timeScale);
  return (
    <label className="flex items-center gap-1 text-[10px] text-[#9fb3c2]">
      Sim
      <select
        data-testid={testid}
        value={speed}
        onChange={(e) => {
          posRefs.setTimeScale(Number(e.target.value));
          setSpeed(posRefs.timeScale);
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
  );
}

function Alarms({ list, testid }: { list: PosRefAlarm[]; testid: string }) {
  return (
    <ul data-testid={testid} className="flex min-h-[1.25rem] flex-col gap-0.5 rounded-sm bg-black/30 px-2 py-1 font-mono text-[10px]">
      {list.length === 0 ? <li className="text-[#7f93a3]">No active alarms</li> : list.map((a) => <li key={a} className="text-amber-300">⚠ {POSREF_ALARM_TEXT[a]}</li>)}
    </ul>
  );
}

function ErrorLine({ error, testid }: { error: string | null; testid: string }) {
  return (
    <p data-testid={testid} role="alert" className="min-h-[1rem] text-[10px] text-amber-300">
      {error ? `Interlock: ${error}` : ''}
    </p>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-[9px] leading-snug text-[#7f93a3]">{children}</p>;
}

const scanText = (phase: string, inRange: boolean) => (phase === 'off' ? 'OFF' : phase === 'tracking' ? 'TRACKING' : inRange ? 'ACQUIRING' : 'NO TARGET');

export function RadaScanPanel() {
  const { s, send, pose, ready } = usePosRefs();
  const rb = radascanRange(pose.eta);
  const inRange = rb.range <= RADASCAN.maxRange.value;
  const on = s.radascan.phase !== 'off';
  return (
    <Shell title="RADASCAN · MICROWAVE RADAR" status={scanText(s.radascan.phase, inRange)} ok={ready.RADASCAN} testid="radascan-hmi">
      <div className="flex flex-wrap gap-1 text-[10px]">
        <HmiBtn testid="radascan-start" label="START" tone="go" disabled={on} onClick={() => send({ type: 'radascan', on: true })} />
        <HmiBtn testid="radascan-stop" label="STOP" disabled={!on} onClick={() => send({ type: 'radascan', on: false })} />
      </div>
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
        <Readout label="Responder range" value={ready.RADASCAN ? `${rb.range.toFixed(1)} m` : '—'} testid="radascan-range" />
        <Readout label="Bearing (rel. bow)" value={ready.RADASCAN ? `${rb.bearing.toFixed(1)}°` : '—'} />
        <Readout label="Responder" value="Red (coded)" />
        <Readout label="Max range" value={`${RADASCAN.maxRange.value} m`} />
      </dl>
      <DpRef id="RADASCAN" testid="radascan" />
      <Alarms list={s.alarms.filter((a) => a === 'RADASCAN_NO_TARGET')} testid="radascan-alarms" />
      <Note>
        Datasheet: range up to 1,000 m, 9.2–9.3 GHz FMCW, 360° scan, sensor Ø1.2 × 0.9 m. Illustrative: lock-on time {RADASCAN.acquireSeconds.value} s, position
        noise {RADASCAN.accuracy.value} m, the platform and its responder. Relative reference: it fixes the vessel to the structure.
      </Note>
    </Shell>
  );
}

export function CyScanPanel() {
  const { s, send, pose, ready } = usePosRefs();
  const rb = cyscanRange(pose.eta);
  const max = s.fog ? CYSCAN.fogRangeM.value : CYSCAN.maxRange.value;
  const inRange = rb.range >= CYSCAN.minRange.value && rb.range <= max;
  const on = s.cyscan.phase !== 'off';
  return (
    <Shell title="CYSCAN · LASER" status={scanText(s.cyscan.phase, inRange)} ok={ready.CYSCAN} testid="cyscan-hmi">
      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <HmiBtn testid="cyscan-start" label="START" tone="go" disabled={on} onClick={() => send({ type: 'cyscan', on: true })} />
        <HmiBtn testid="cyscan-stop" label="STOP" disabled={!on} onClick={() => send({ type: 'cyscan', on: false })} />
        <Toggle testid="cyscan-fog" label={s.fog ? 'FOG / RAIN ON' : 'FOG / RAIN'} active={s.fog} onClick={() => send({ type: 'set-fog', on: !s.fog })} />
      </div>
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
        <Readout label="Target range" value={ready.CYSCAN ? `${rb.range.toFixed(1)} m` : '—'} testid="cyscan-range" />
        <Readout label="Bearing (rel. bow)" value={ready.CYSCAN ? `${rb.bearing.toFixed(1)}°` : '—'} />
        <Readout label="Usable range" value={`${CYSCAN.minRange.value}–${max} m${s.fog ? ' (fog)' : ''}`} />
        <Readout label="Laser" value="Class 1 eye-safe" />
      </dl>
      <DpRef id="CYSCAN" testid="cyscan" />
      <Alarms list={s.alarms.filter((a) => a === 'CYSCAN_NO_TARGET')} testid="cyscan-alarms" />
      <Note>
        Datasheet: 10–2,500 m, Class 1, beam 12° × 0.13°, 360°. Illustrative: head size, lock-on time {CYSCAN.acquireSeconds.value} s, noise {CYSCAN.accuracy.value} m,
        and the {CYSCAN.fogRangeM.value} m range in fog (lasers lose range in fog, rain, spray and exhaust; RadaScan does not).
      </Note>
    </Shell>
  );
}

export function DGPSPanel() {
  const dp = useControllerState(dpSystem);
  const units: RefId[] = ['GNSS1', 'GNSS2'];
  const live = dp.refs.filter((r) => units.includes(r.id) && r.installed && r.enabled && r.fault !== 'lost');
  return (
    <Shell title="DGPS · FUGRO SEASTAR" status={`${live.length} / ${dp.refs.filter((r) => units.includes(r.id) && r.installed).length} ONLINE`} ok={live.length > 0} testid="dgps-hmi">
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
        <Readout label="Correction service" value="Seastar G4" />
        <Readout label="Accuracy" value={`${SEASTAR.accuracy.value * 100} cm`} />
        <Readout label="Constellations" value="GPS · GLO · GAL · BDS" />
        <Readout label="Link" value="L-band (NTRIP back-up)" />
      </dl>
      {units.map((id) => {
        const r = dp.refs.find((x) => x.id === id)!;
        return (
          <div key={id} className="flex flex-col gap-1">
            <DpRef id={id} testid={`dgps-${id}`} />
            {r.installed && (
              <div className="flex gap-1 text-[10px]">
                <HmiBtn
                  testid={`dgps-lose-${id}`}
                  label={r.fault === 'lost' ? `RESTORE ${REF_LABEL[id]}` : `LOSE ${REF_LABEL[id]} CORRECTIONS`}
                  tone={r.fault === 'lost' ? 'warn' : undefined}
                  onClick={() => dpSystem.dispatch({ type: 'ref-fault', id, fault: r.fault === 'lost' ? null : 'lost' })}
                />
              </div>
            )}
          </div>
        );
      })}
      <Note>
        Datasheet (Fugro Seastar page): G4 service, 10 cm, dual satellite delivery, Spatial Integrity Analysis and SatGuard. The receiver model was not specified, so
        the antennas are drawn as illustrative. DGPS 2 is fitted from DP2. Losing corrections removes that receiver from DP voting.
      </Note>
    </Shell>
  );
}

export function TautWirePanel() {
  const { s, send, error, pose, ready } = usePosRefs();
  const tw = s.tautwire;
  const { angleDeg, offset } = tautWireAngle(s, pose.eta);
  const moving = tw.phase === 'lowering' || tw.phase === 'hoisting';
  return (
    <Shell title="TAUT WIRE · SMT TW-1.0" status={tautWireStatus(s, pose.eta)} ok={ready.TAUTWIRE} testid="tautwire-hmi">
      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <HmiBtn testid="tw-deploy" label="LOWER WEIGHT" tone="go" disabled={tw.phase === 'on-bottom' || tw.phase === 'lowering'} onClick={() => send({ type: 'tw-deploy' })} />
        <HmiBtn testid="tw-recover" label="RECOVER" disabled={tw.phase === 'stowed' || tw.phase === 'hoisting'} onClick={() => send({ type: 'tw-recover' })} />
        <HmiBtn testid="tw-stop" label="STOP" disabled={!moving} onClick={() => send({ type: 'tw-stop' })} />
        <SimSpeed testid="tw-speed" />
      </div>
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
        <Readout label="Wire paid out" value={`${tw.payout.toFixed(1)} / ${TW_VERTICAL.toFixed(1)} m`} testid="tw-payout" />
        <Readout label="Water depth" value={`${WATER_DEPTH} m (rated ${SMT_TW.waterDepth.value} m)`} />
        <Readout label="Wire angle" value={tw.anchor ? `${angleDeg.toFixed(1)}°` : '—'} testid="tw-angle" />
        <Readout label="Offset from weight" value={tw.anchor ? `${offset.toFixed(1)} m` : '—'} />
      </dl>
      <DpRef id="TAUTWIRE" testid="tautwire" />
      <ErrorLine error={error} testid="tw-error" />
      <Alarms list={s.alarms.filter((a) => a.startsWith('TW_'))} testid="tw-alarms" />
      <Note>
        Datasheet: 300 m water depth (500 m cable), 460 kg depressor weight, 3 m overboard reach, constant-tension heave-compensated winch, gimbal head sensor.
        Illustrative: winch speed {SMT_TW.winchSpeed.value} m/s, angle warning {SMT_TW.angleWarnDeg.value}° and limit {SMT_TW.angleLimitDeg.value}°, weight shape
        (sized for 460 kg of steel). Move the vessel in DP to see the wire angle change.
      </Note>
    </Shell>
  );
}

export function SprintNavPanel() {
  const { s, send, error, pose, ready } = usePosRefs();
  const p = s.pole;
  const sn = s.sprintnav;
  const alt = sprintNavAltitude(p.angleDeg);
  const inWater = p.phase === 'deployed';
  const moving = p.phase === 'deploying' || p.phase === 'recovering';
  return (
    <Shell title="SPRINT-NAV DP · 8097 POLE" status={ready.SPRINTNAV ? 'REFERENCE OK' : poleStatus(s)} ok={ready.SPRINTNAV} testid="sprintnav-hmi">
      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <HmiBtn testid="pole-deploy" label="DEPLOY POLE" tone="go" disabled={p.phase === 'deployed' || p.phase === 'deploying' || p.phase === 'locking'} onClick={() => send({ type: 'pole-deploy' })} />
        <HmiBtn testid="pole-recover" label="RECOVER POLE" disabled={p.phase === 'stowed' || p.phase === 'recovering'} onClick={() => send({ type: 'pole-recover' })} />
        <HmiBtn testid="pole-stop" label="STOP" disabled={!moving} onClick={() => send({ type: 'pole-stop' })} />
        <Toggle testid="sprintnav-power" label={sn.power ? 'SPRINT-NAV ON' : 'SPRINT-NAV OFF'} active={sn.power} onClick={() => send({ type: 'sprintnav-power', on: !sn.power })} />
        <SimSpeed testid="sn-speed" />
      </div>
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
        <Readout label="Pole angle" value={`${p.angleDeg.toFixed(0)}° ${p.locked ? '· LOCKED' : ''}`} testid="pole-angle" />
        <Readout label="INS alignment" value={sn.power ? `${Math.round(sn.align * 100)} %` : 'OFF'} testid="sn-align" />
        <Readout label="DVL altitude" value={inWater ? `${alt.toFixed(1)} m` : '—'} testid="sn-altitude" />
        <Readout label="Unit depth" value={inWater ? `${sprintNavDepth(p.angleDeg).toFixed(1)} m (rated ${SPRINTNAV.depthRating.value} m)` : 'On deck'} />
        <Readout label="Bottom lock" value={inWater && alt <= SPRINTNAV.altitudeMax.value ? 'YES' : 'NO'} />
        <Readout label="Vessel speed" value={`${(pose.speed / KNOT).toFixed(1)} kn (max ${POLE_8097.maxSpeedKn.value})`} />
      </dl>
      <DpRef id="SPRINTNAV" testid="sprintnav" />
      <ErrorLine error={error} testid="sn-error" />
      <Alarms list={s.alarms.filter((a) => a === 'POLE_OVERSPEED')} testid="sn-alarms" />
      <Note>
        Datasheet: SPRINT-Nav DP {SPRINTNAV.diameter.value * 1000} × {SPRINTNAV.height.value * 1000} mm titanium, 100 m rating, 375 kHz DVL, bottom lock 0.4–200 m, station
        keeping &lt; 3.2 m over 12 h (modelled as a slow drift). Type 8097 pole: 9 m from the pivot, 3 sections with strakes, hydraulic hull lock, 5 kn. Illustrative: pole
        diameter and swing geometry, swing {POLE_8097.swingSeconds.value} s, lock {POLE_8097.lockSeconds.value} s, INS alignment {SPRINTNAV.alignSeconds.value} s, DVL beam
        angle.
      </Note>
    </Shell>
  );
}
