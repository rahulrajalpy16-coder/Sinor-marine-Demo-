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
  sprintNavMode,
  cyscanMaxRange,
  tautWireAngle,
  tautWireAxes,
  tautWireNmea,
  tautWireStatus,
  TW_VERTICAL,
  WATER_DEPTH,
  type PosRefAlarm,
  type PosRefCommand,
} from '../simulations/posrefs';
import { REF_LABEL, type RefId } from '../simulations/dp';
import { CYSCAN, POLE_8097, RADASCAN, SEASTAR, SMT_TW, SPRINTNAV } from '../equipment/posrefData';
import { HmiBtn, Readout, Status, Toggle } from './ThrusterPanel';
import { DataNote } from './DataNote';

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
        ? 'Selected, ready (DP not running)'
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


/** RadaScan View style radar picture: range rings, own ship, the coded responder and the platform echo (illustrative). */
function RadarView({ on, tracking, range, bearing }: { on: boolean; tracking: boolean; range: number; bearing: number }) {
  const max = RADASCAN.maxRange.value;
  const R = 70;
  const px = (r: number, b: number): [number, number] => [80 + (r / max) * R * Math.sin((b * Math.PI) / 180), 80 - (r / max) * R * Math.cos((b * Math.PI) / 180)];
  const [rx, ry] = px(range, bearing);
  const [ex, ey] = px(range + 12, bearing);
  return (
    <svg data-testid="radascan-ppi" viewBox="0 0 160 160" className="mx-auto h-36 w-36" role="img" aria-label="Radar picture">
      <circle cx={80} cy={80} r={R + 4} fill="#0d3f86" />
      {[90, 225, 450].map((r) => (
        <g key={r}>
          <circle cx={80} cy={80} r={(r / max) * R} fill="none" stroke="#ffffff55" strokeWidth={0.6} />
          <text x={82} y={80 - (r / max) * R - 1.5} fontSize={6} fill="#ffffffaa">
            {r}m
          </text>
        </g>
      ))}
      <path d="M80 72 L83 77 L83 88 L77 88 L77 77 Z" fill="#f2f4f6" />
      {on && <ellipse cx={ex} cy={ey} rx={9} ry={6} fill="#e53935" opacity={0.85} transform={`rotate(${bearing} ${ex} ${ey})`} />}
      {tracking && <circle cx={rx} cy={ry} r={3.2} fill="#ffd400" stroke="#000" strokeWidth={0.4} />}
      {!on && (
        <text x={80} y={112} fontSize={8} textAnchor="middle" fill="#ffffffaa">
          SENSOR OFF
        </text>
      )}
    </svg>
  );
}

/** Seastar 9410-AUT front panel: 32 characters × 4 rows (layout mock-up). */
function ReceiverDisplay({ unit, lost, eta }: { unit: number; lost: boolean; eta: readonly number[] }) {
  const pad = (t: string) => t.slice(0, 32).padEnd(32, ' ');
  const rows = [
    pad(`SEASTAR 9410-AUT       DGPS ${unit}`),
    pad(lost ? 'MODE: AUTONOMOUS  NO CORR' : 'MODE: G4 DIFF      L-BAND'),
    pad(`N ${eta[0] >= 0 ? '+' : '-'}${Math.abs(eta[0]).toFixed(2)}  E ${eta[1] >= 0 ? '+' : '-'}${Math.abs(eta[1]).toFixed(2)} m`),
    pad('GGA GST VTG ZDA   1PPS'),
  ];
  return (
    <pre data-testid={`dgps-display-${unit}`} className="overflow-x-auto rounded-sm border border-[#4a5560] bg-[#0b1a12] px-2 py-1 font-mono text-[9px] leading-tight text-[#8fe3a1]">
      {rows.join('\n')}
    </pre>
  );
}

/** SMT Z Range Mk2 datasheet accuracy table at 0 m/s current. */
function AccuracyTable() {
  return (
    <table className="w-full border-collapse font-mono text-[9px] text-[#c9d6df]">
      <caption className="pb-0.5 text-left text-[9px] text-[#7f93a3]">Datasheet accuracy, current 0 m/s (m)</caption>
      <thead>
        <tr className="text-[#7f93a3]">
          <th className="text-left font-normal">Depth</th>
          <th className="font-normal">0°</th>
          <th className="font-normal">10°</th>
          <th className="font-normal">20°</th>
        </tr>
      </thead>
      <tbody>
        {SMT_TW.accuracyTable.value.map((r) => (
          <tr key={r.depth}>
            <td>{r.depth} m</td>
            {r.err.map((e, i) => (
              <td key={i} className="text-center">
                {e.toFixed(1)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const scanText = (phase: string, inRange: boolean) => (phase === 'off' ? 'OFF' : phase === 'tracking' ? 'TRACKING' : inRange ? 'ACQUIRING' : 'NO TARGET');

export function RadaScanPanel() {
  const { s, send, pose, ready } = usePosRefs();
  const rb = radascanRange(pose.eta);
  const inRange = rb.range <= RADASCAN.maxRange.value;
  const on = s.radascan.phase !== 'off';
  return (
    <Shell title="RADASCAN VIEW · RADAR" status={scanText(s.radascan.phase, inRange)} ok={ready.RADASCAN} testid="radascan-hmi">
      <div className="flex flex-wrap gap-1 text-[10px]">
        <HmiBtn testid="radascan-start" label="START" tone="go" disabled={on} onClick={() => send({ type: 'radascan', on: true })} />
        <HmiBtn testid="radascan-stop" label="STOP" disabled={!on} onClick={() => send({ type: 'radascan', on: false })} />
      </div>
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
        <Readout label="Responder range" value={ready.RADASCAN ? `${rb.range.toFixed(1)} m` : '—'} testid="radascan-range" />
        <Readout label="Bearing (rel. bow)" value={ready.RADASCAN ? `${rb.bearing.toFixed(1)}°` : '—'} />
        <Readout label="Responder" value="Coded responder" />
        <Readout label="Working range" value={`${RADASCAN.maxRange.value} m zone`} />
      </dl>
      <RadarView on={on} tracking={ready.RADASCAN} range={rb.range} bearing={rb.bearing} />
      <DpRef id="RADASCAN" testid="radascan" />
      <Alarms list={s.alarms.filter((a) => a === 'RADASCAN_NO_TARGET')} testid="radascan-alarms" />
      <DataNote>
        RadaScan View brochure: combined position reference and navigation radar for the 500 m zone, range and bearing to coded responders, works through rain,
        fog, steam and dust, −25 to +55 °C. Sensor Ø500 × 410 mm (installer’s guide). Simulation settings not given in the documents: maximum range, lock-on time{' '}
        {RADASCAN.acquireSeconds.value} s, position noise {RADASCAN.accuracy.value} m, the platform and its radar echo.
      </DataNote>
    </Shell>
  );
}

export function CyScanPanel() {
  const { s, send, pose, ready } = usePosRefs();
  const rb = cyscanRange(pose.eta);
  const max = cyscanMaxRange(s);
  const inRange = rb.range >= CYSCAN.minRange.value && rb.range <= max;
  const on = s.cyscan.phase !== 'off';
  return (
    <Shell title="CYSCAN AS · LASER" status={scanText(s.cyscan.phase, inRange)} ok={ready.CYSCAN} testid="cyscan-hmi">
      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <HmiBtn testid="cyscan-start" label="START" tone="go" disabled={on} onClick={() => send({ type: 'cyscan', on: true })} />
        <HmiBtn testid="cyscan-stop" label="STOP" disabled={!on} onClick={() => send({ type: 'cyscan', on: false })} />
        <Toggle testid="cyscan-fog" label={s.fog ? 'FOG / RAIN ON' : 'FOG / RAIN'} active={s.fog} onClick={() => send({ type: 'set-fog', on: !s.fog })} />
      </div>
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
        <Readout label="Target range" value={ready.CYSCAN ? `${rb.range.toFixed(1)} m` : '—'} testid="cyscan-range" />
        <Readout label="Bearing (rel. bow)" value={ready.CYSCAN ? `${rb.bearing.toFixed(1)}°` : '—'} />
        <Readout label="Usable range" value={`${CYSCAN.minRange.value}–${max} m${s.fog ? ' (fog)' : ' (1.9 m cylinder)'}`} />
        <Readout label="Laser" value="Class 1M" />
        <Readout label="Range noise" value={`${CYSCAN.rangeNoise.value * 1000} mm`} />
        <Readout label="Bearing noise" value={`${CYSCAN.bearingNoiseMrad.value} mrad`} />
      </dl>
      <DpRef id="CYSCAN" testid="cyscan" />
      <Alarms list={s.alarms.filter((a) => a === 'CYSCAN_NO_TARGET')} testid="cyscan-alarms" />
      <DataNote>
        CyScan AS leaflet: 10–2,500 m with prisms, about 10–300 m with the 1.9 m cylindrical target used here (installer’s guide; the leaflet says 400 m); beam 12° × 0.13°; ±20° gimbal; 30 targets detectable,
        9 trackable; sensor base 405 × 327 mm plus the 80 mm access cover facing forward, 563 mm high, 4 × M8 on 190 × 360 mm, 28 kg. Simulation settings not given in the documents: lock-on time {CYSCAN.acquireSeconds.value} s and the {CYSCAN.fogRangeM.value} m
        range in fog (lasers lose range in fog and spray; the radar does not).
      </DataNote>
    </Shell>
  );
}

export function DGPSPanel() {
  const dp = useControllerState(dpSystem);
  const units: RefId[] = ['GNSS1', 'GNSS2'];
  const live = dp.refs.filter((r) => units.includes(r.id) && r.installed && r.enabled && r.fault !== 'lost');
  return (
    <Shell title="DGPS · SEASTAR 9410-AUT" status={`${live.length} / ${dp.refs.filter((r) => units.includes(r.id) && r.installed).length} ONLINE`} ok={live.length > 0} testid="dgps-hmi">
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
        <Readout label="Correction service" value="Seastar G4" />
        <Readout label="Horizontal (95 %)" value={`< ${SEASTAR.accuracy.value * 100} cm`} />
        <Readout label="Vertical (95 %)" value={`< ${SEASTAR.vertical.value * 100} cm`} />
        <Readout label="Channels" value="672 · GPS GLO GAL BDS" />
      </dl>
      {units.map((id) => {
        const r = dp.refs.find((x) => x.id === id)!;
        return (
          <div key={id} className="flex flex-col gap-1">
            <DpRef id={id} testid={`dgps-${id}`} />
            {r.installed && <ReceiverDisplay unit={id === 'GNSS1' ? 1 : 2} lost={r.fault === 'lost'} eta={dp.eta} />}
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
      <DataNote>
        Seastar 9410-AUT datasheet: 672 channels, G4 &lt; 10 cm horizontal / &lt; 15 cm vertical (95 %), L-band or NTRIP corrections through one antenna, 24 V DC 6 W,
        270 × 140 × 70 mm. Antenna: Trimble GA830, Ø149 × 99 mm, 0.82 kg, 5/8" pole mount (Trimble datasheet); its colours are drawn from the photo. The receiver display is a representation. DGPS 2 is fitted from
        DP2. Losing corrections removes that receiver from DP voting.
      </DataNote>
    </Shell>
  );
}

export function TautWirePanel() {
  const { s, send, error, pose, ready } = usePosRefs();
  const tw = s.tautwire;
  const { angleDeg, offset } = tautWireAngle(s, pose.eta);
  const axes = tautWireAxes(s, pose.eta);
  const moving = tw.phase === 'lowering' || tw.phase === 'hoisting';
  return (
    <Shell title="TAUT WIRE · SMT TW-2.0 Z MK2" status={tautWireStatus(s, pose.eta)} ok={ready.TAUTWIRE} testid="tautwire-hmi">
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
        <Readout label="Across / along ship" value={tw.anchor ? `${axes.across.toFixed(1)}° / ${axes.along.toFixed(1)}°` : '—'} testid="tw-axes" />
        <Readout label="Operating range" value={`±${SMT_TW.angleLimitDeg.value}°`} />
      </dl>
      <p data-testid="tw-nmea" className="overflow-x-auto whitespace-nowrap rounded-sm bg-black/40 px-2 py-1 font-mono text-[10px] text-[#8fe3a1]">
        {tautWireNmea(s, pose.eta)}
      </p>
      <AccuracyTable />
      <DpRef id="TAUTWIRE" testid="tautwire" />
      <ErrorLine error={error} testid="tw-error" />
      <Alarms list={s.alarms.filter((a) => a.startsWith('TW_'))} testid="tw-alarms" />
      <DataNote>
        SMT Z Range Mk2 and manual PJ 0044-13: 500 m depth (700 m cable), 400 kg weight, 1700 × 1600 mm skid, 2085 mm stored, 2395 mm max while deploying, head
        2510 mm outboard and 1059 mm up when deployed, ±30° range, $PCPTW output. Simulation settings not given in the documents: winch speed {SMT_TW.winchSpeed.value} m/s,{' '}
        {SMT_TW.angleWarnDeg.value}° warning, alarm codes in the NMEA line, the bell size, and the boom path between the two drawn poses. Move the vessel in DP to see
        the angles change.
      </DataNote>
    </Shell>
  );
}

/**
 * Positioning view in the style of the SPRINT-Nav web UI (datasheet 8388): mode banner, compass rose with range
 * rings, the INS position against the last GNSS fix it was started from, and the heading and position quality.
 */
function SprintNavPlot({ mode, drift }: { mode: ReturnType<typeof sprintNavMode>; drift: [number, number] }) {
  const cx = 90;
  const cy = 102;
  const R = 58;
  const maxM = 2;
  const err = Math.hypot(drift[0], drift[1]);
  const k = Math.min(1, maxM / Math.max(err, 1e-6));
  const x = cx + (drift[1] * k * R) / maxM;
  const y = cy - (drift[0] * k * R) / maxM;
  const live = mode === 'GNSS AIDED' || mode === 'INDEPENDENT';
  const banner = { OFF: 'Off', INITIALISING: 'Initialising from GNSS', 'GNSS AIDED': 'GNSS aided', INDEPENDENT: 'Independent from GNSS' }[mode];
  return (
    <svg data-testid="sn-plot" viewBox="0 0 180 186" className="mx-auto h-48 w-[11.6rem]" role="img" aria-label={`Positioning: ${banner}`}>
      <rect x={0} y={0} width={180} height={186} rx={4} fill="#160f3a" />
      <text x={cx} y={15} textAnchor="middle" fontSize={11} fontWeight={600} fill={live ? '#3fd16b' : '#f2c14e'}>
        Positioning
      </text>
      <text x={cx} y={28} textAnchor="middle" fontSize={8.5} fill="#e6e1ff">
        {banner}
      </text>
      {[0.5, 1, 2].map((r) => (
        <g key={r}>
          <circle cx={cx} cy={cy} r={(r / maxM) * R} fill="none" stroke="#8b7fd6" strokeOpacity={0.5} strokeWidth={0.7} strokeDasharray={r === 2 ? undefined : '2 2'} />
          <text x={cx + (r / maxM) * R * 0.71 + 2} y={cy - (r / maxM) * R * 0.71} fontSize={7} fill="#b6abf5">
            {r} m
          </text>
        </g>
      ))}
      {['N', 'E', 'S', 'W'].map((l, i) => {
        const a = (i * Math.PI) / 2;
        return (
          <text key={l} x={cx + Math.sin(a) * (R + 8)} y={cy - Math.cos(a) * (R + 8) + 3} textAnchor="middle" fontSize={8.5} fill="#e6e1ff">
            {l}
          </text>
        );
      })}
      {/* Last used GNSS fix (where the unit was when GNSS aiding was disabled) */}
      <circle cx={cx} cy={cy} r={3} fill="none" stroke="#3fd16b" strokeWidth={1.2} />
      {live && (
        <g>
          <line x1={cx} y1={cy} x2={x} y2={y} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.6} />
          <circle cx={x} cy={y} r={2.6} fill="#ffffff" />
          <line x1={x - 6} y1={y} x2={x + 6} y2={y} stroke="#ffffff" strokeWidth={0.7} />
          <line x1={x} y1={y - 6} x2={x} y2={y + 6} stroke="#ffffff" strokeWidth={0.7} />
        </g>
      )}
      <g fontSize={7.5} fill="#e6e1ff">
        <circle cx={14} cy={177} r={2.5} fill="#ffffff" />
        <text x={20} y={180}>INS</text>
        <circle cx={48} cy={177} r={2.5} fill="none" stroke="#3fd16b" strokeWidth={1.2} />
        <text x={54} y={180}>Last used GNSS</text>
      </g>
    </svg>
  );
}

export function SprintNavPanel() {
  const { s, dp, send, error, pose, ready } = usePosRefs();
  const p = s.pole;
  const sn = s.sprintnav;
  const mode = sprintNavMode(s);
  const alt = sprintNavAltitude(p.angleDeg);
  const inWater = p.phase === 'deployed';
  const moving = p.phase === 'deploying' || p.phase === 'recovering';
  const ref = dp.refs.find((r) => r.id === 'SPRINTNAV');
  const drift: [number, number] = ref ? ref.drift : [0, 0];
  const err = Math.hypot(drift[0], drift[1]);
  const aligned = sn.power && sn.align >= 1;
  const bottomLock = inWater && alt >= SPRINTNAV.altitudeMin.value && alt <= SPRINTNAV.altitudeMax.value;
  const profile = Math.min(SPRINTNAV.adcpRange.value, Math.max(0, alt));
  return (
    <Shell title="SPRINT-NAV DP · 8097 POLE" status={ready.SPRINTNAV ? 'REFERENCE OK' : poleStatus(s)} ok={ready.SPRINTNAV} testid="sprintnav-hmi">
      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <HmiBtn testid="pole-deploy" label="DEPLOY POLE" tone="go" disabled={p.phase === 'deployed' || p.phase === 'deploying' || p.phase === 'locking'} onClick={() => send({ type: 'pole-deploy' })} />
        <HmiBtn testid="pole-recover" label="RECOVER POLE" disabled={p.phase === 'stowed' || p.phase === 'recovering'} onClick={() => send({ type: 'pole-recover' })} />
        <HmiBtn testid="pole-stop" label="STOP" disabled={!moving} onClick={() => send({ type: 'pole-stop' })} />
      </div>
      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <Toggle testid="sprintnav-power" label={sn.power ? 'SPRINT-NAV ON' : 'SPRINT-NAV OFF'} active={sn.power} onClick={() => send({ type: 'sprintnav-power', on: !sn.power })} />
        <Toggle
          testid="sprintnav-gnss"
          label={sn.gnssAiding ? 'GNSS AIDING ON' : 'GNSS AIDING OFF'}
          active={sn.power && sn.gnssAiding}
          onClick={() => send({ type: 'sprintnav-gnss', on: !sn.gnssAiding })}
        />
        <SimSpeed testid="sn-speed" />
      </div>
      <div className="grid grid-cols-1 items-center gap-2 min-[420px]:grid-cols-[auto_1fr]">
        <SprintNavPlot mode={mode} drift={drift} />
        <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
          <Readout label="Mode" value={mode} testid="sn-mode" />
          <Readout label="Initialisation" value={sn.power ? `${Math.round(sn.align * 100)} %` : 'OFF'} testid="sn-align" />
          <Readout label="Heading quality" value={aligned ? `${SPRINTNAV.headingDeg.value.toFixed(3)}°` : '—'} />
          <Readout label="Drift from GNSS" value={aligned && !sn.gnssAiding ? `${err.toFixed(2)} m` : aligned ? 'GNSS held' : '—'} testid="sn-drift" />
          <Readout label="DVL" value={!sn.power ? 'OFF' : bottomLock ? 'Bottom tracking' : inWater ? 'No bottom' : 'In air'} testid="sn-dvl" />
          <Readout label="Vertical aiding" value={sn.power ? (inWater ? 'Pressure sensor' : 'In air') : 'OFF'} />
        </dl>
      </div>
      <dl className="grid grid-cols-2 gap-1 font-mono text-[11px]">
        <Readout label="Pole angle" value={`${p.angleDeg.toFixed(0)}° ${p.locked ? '· LOCKED' : ''}`} testid="pole-angle" />
        <Readout label="DVL altitude" value={inWater ? `${alt.toFixed(1)} m` : '—'} testid="sn-altitude" />
        <Readout label="Unit depth" value={inWater ? `${sprintNavDepth(p.angleDeg).toFixed(1)} m (rated ${SPRINTNAV.depthRating.value} m)` : 'On deck'} />
        <Readout label="Bottom lock" value={sn.power && bottomLock ? 'YES' : 'NO'} />
        <Readout
          label="Current (ADCP)"
          value={sn.power && inWater ? `${dp.current.speedKn.toFixed(1)} kn → ${dp.current.toDeg.toFixed(0)}° · 0–${profile.toFixed(0)} m` : '—'}
          testid="sn-adcp"
        />
        <Readout label="Vessel speed" value={`${(pose.speed / KNOT).toFixed(1)} kn (max ${POLE_8097.maxSpeedKn.value})`} />
      </dl>
      <DpRef id="SPRINTNAV" testid="sprintnav" />
      <ErrorLine error={error} testid="sn-error" />
      <Alarms list={s.alarms.filter((a) => a === 'POLE_OVERSPEED')} testid="sn-alarms" />
      <DataNote>
        SPRINT-Nav DP datasheet 8388 (specifications 01/2026) and drawing: Ø{SPRINTNAV.diameter.value * 1000} × {SPRINTNAV.height.value * 1000} mm titanium
        ({SPRINTNAV.bodyLength.value * 1000} mm body), {SPRINTNAV.boltHoles.value.toLowerCase()}; 100 m rating; 375 kHz DVL, altitude 0.4–200 m; ADCP 0.4–120 m;
        10-minute initialisation from GNSS, then GNSS aiding disabled for independent mode; station keeping &lt; 2 m over 24 h (CEP50), drawn as a slow drift;
        heading 0.05°; 5 min battery; 1 × RS422. Type 8097 pole datasheet: 9190 mm pivot to end, joints at 3110 and 6170 mm, strakes, 1,000 kg, axis 525 mm
        above the deck edge, hull lock 2415 mm below it, 5 kn. Simulation settings not given in the documents: pole diameter (scaled), swing{' '}
        {POLE_8097.swingSeconds.value} s, lock {POLE_8097.lockSeconds.value} s, DVL beam angle {SPRINTNAV.dvlBeamDeg.value}°, and how fast GNSS aiding pulls
        the drift back. The current shown is the DP simulator's current, which is uniform with depth.
      </DataNote>
    </Shell>
  );
}
