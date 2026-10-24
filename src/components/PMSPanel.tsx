import { useState } from 'react';
import { powerSystem } from '../simulations/powerController';
import { dpSystem } from '../simulations/dpController';
import { useControllerState } from '../simulations/useController';
import {
  alarmText,
  BUS_LABEL,
  POWER_CONFIG as CFG,
  TIE_LABEL,
  unacknowledgedPower,
  type Arrangement,
  type BusId,
  type GenId,
  type PowerCommand,
  type PowerState,
  type TieId,
} from '../simulations/power';
import { DP_ALARM_TEXT, THRUSTER_GROUP } from '../simulations/dp';
import { useAppStore } from '../store/useAppStore';
import { Bar, Btn, Chip, fmtTime, HmiFrame, KV, Rejection, Section, SEV_SYMBOL, Tabs, Trend, type Tone } from './hmi/kit';
import { DataNote } from './DataNote';

export type PmsTab = 'sld' | 'gen' | 'swbd' | 'loads' | 'dp' | 'alarms' | 'trends' | 'faults';
const TABS: { id: PmsTab; label: string }[] = [
  { id: 'sld', label: 'SLD' },
  { id: 'gen', label: 'Gen' },
  { id: 'swbd', label: 'Swbd' },
  { id: 'loads', label: 'Loads' },
  { id: 'dp', label: 'DP pwr' },
  { id: 'alarms', label: 'Alarms' },
  { id: 'trends', label: 'Trends' },
  { id: 'faults', label: 'Faults' },
];

type Sel = { kind: 'gen'; id: GenId } | { kind: 'tie'; id: TieId } | { kind: 'bus'; id: BusId } | null;

const GEN_TONE: Record<string, Tone> = { online: 'ok', running: 'info', synchronising: 'info', starting: 'info', unloading: 'warn', cooldown: 'off', stopped: 'off', tripped: 'alarm' };
const genCfg = (id: GenId) => CFG.generators.find((g) => g.id === id)!;
const amps = (kw: number, kvar: number, v: number) => (v > 0 ? (Math.hypot(kw, kvar) * 1000) / (Math.sqrt(3) * v) : 0);

/**
 * Power Management System HMI: single-line diagram with live breakers, generators, switchboard, distribution and
 * load management, DP power, alarms/events, trends and fault injection. Every value comes from the shared core
 * (powerController / vesselCore); every control issues a PowerCommand and shows the reason if it is inhibited.
 */
export function PMSPanel({ initialTab = 'sld' }: { initialTab?: PmsTab }) {
  const s = useControllerState(powerSystem);
  const dp = useControllerState(dpSystem);
  const [tab, setTab] = useState<PmsTab>(initialTab);
  const [sel, setSel] = useState<Sel>(null);
  const [err, setErr] = useState<string | null>(null);
  const send = (c: PowerCommand) => {
    powerSystem.dispatch(c);
    setErr(powerSystem.lastError);
  };
  const open = unacknowledgedPower(s);
  const blackout = s.alarms.some((a) => a.startsWith('BLACKOUT'));
  const status = (
    <>
      <Chip tone={blackout ? 'alarm' : open.length ? 'warn' : 'ok'} testid="pms-status">
        {blackout ? 'BLACKOUT' : open.length ? `${open.length} ALARM${open.length > 1 ? 'S' : ''}` : 'NORMAL'}
      </Chip>
      <Chip tone={s.pmsAuto ? 'info' : 'warn'}>{s.pmsAuto ? 'PMS AUTO' : 'PMS MANUAL'}</Chip>
    </>
  );
  return (
    <HmiFrame title="POWER MANAGEMENT" status={status} testid="pms-hmi">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-[#c7d3dc]">
        <span>Sim {fmtTime(s.time)}</span>
        <span>Speed {dp.timeScale}×</span>
        {s.islands
          .filter((i) => i.capacityKW > 0)
          .map((i) => (
            <span key={i.id} data-testid={`pms-island-${i.buses[0]}`}>
              {i.buses.filter((b) => b.startsWith('MSB') || b === 'ESB').join('+')}: {i.loadKW.toFixed(0)}/{i.capacityKW} kW · {i.hz.toFixed(2)} Hz
            </span>
          ))}
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} prefix="pms" />
      <Rejection msg={err} onClose={() => setErr(null)} />
      {tab === 'sld' && <SLD s={s} sel={sel} setSel={setSel} send={send} />}
      {tab === 'gen' && <Generators s={s} send={send} />}
      {tab === 'swbd' && <Switchboard s={s} send={send} />}
      {tab === 'loads' && <Loads s={s} send={send} />}
      {tab === 'dp' && <DpPower s={s} send={send} />}
      {tab === 'alarms' && <Alarms s={s} send={send} />}
      {tab === 'trends' && <Trends s={s} />}
      {tab === 'faults' && <Faults s={s} send={send} />}
      <DataNote>
        Demonstration plant for a generic 78 m DP2 diesel-electric vessel: 4 × 1,700 kW 690 V 60 Hz main generators, split main switchboard with
        bus tie, 690/440 V transformers, 250 kW emergency generator, DP UPS A/B (+C on DP3). Ratings and bus philosophy were not supplied for the
        vessel and are configurable provisional values (power.ts). Quasi-steady load flow with first-order frequency response; not a transient
        electrical study, not an approved FMEA.
      </DataNote>
    </HmiFrame>
  );
}

type P = { s: PowerState; send: (c: PowerCommand) => void };

// ----------------------------------------------------------------------------------- single-line diagram

const LIVE = '#3fd16b';
const DEAD = '#5a6670';
const FAULT = '#e04444';

function SLD({ s, sel, setSel, send }: P & { sel: Sel; setSel: (v: Sel) => void }) {
  const busColor = (b: BusId) => (s.buses[b].fault ? FAULT : s.buses[b].live ? LIVE : DEAD);
  const busLine = (b: BusId, x1: number, x2: number, y: number) => (
    <g key={b} onClick={() => setSel({ kind: 'bus', id: b })} className="cursor-pointer" data-testid={`sld-bus-${b}`} data-live={s.buses[b].live}>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={busColor(b)} strokeWidth="4" strokeDasharray={s.buses[b].live ? undefined : '5 3'} />
      <text x={x1} y={y - 4} fontSize="7" fill="#c7d3dc">
        {b.replace('_', '-')} {s.buses[b].live ? `${s.buses[b].v.toFixed(0)} V ${s.buses[b].hz.toFixed(1)} Hz` : s.buses[b].fault ? 'FAULT' : 'DEAD'}
      </text>
    </g>
  );
  const breaker = (x: number, y: number, closed: boolean, tripped: boolean, live: boolean, onClick: () => void, testid: string, selected: boolean) => (
    <g onClick={onClick} className="cursor-pointer" data-testid={testid} data-closed={closed}>
      <rect x={x - 5} y={y - 5} width="10" height="10" fill={closed ? (live ? LIVE : DEAD) : '#0b1a2c'} stroke={tripped ? FAULT : selected ? '#f2c94c' : closed && live ? LIVE : '#9fb3c2'} strokeWidth={selected ? 2 : 1.2} />
      {tripped && <path d={`M${x - 5} ${y - 5} L${x + 5} ${y + 5} M${x + 5} ${y - 5} L${x - 5} ${y + 5}`} stroke={FAULT} strokeWidth="1.5" />}
      <rect x={x - 9} y={y - 9} width="18" height="18" fill="transparent" />
    </g>
  );
  const gen = (id: GenId, x: number, busY: number) => {
    const g = s.gens.find((v) => v.id === id)!;
    const live = g.state === 'online';
    const col = g.state === 'tripped' ? FAULT : live ? LIVE : g.hz > 1 ? '#5fc8ff' : DEAD;
    const top = busY > 150 ? busY + 34 : busY - 46;
    const brkY = busY > 150 ? busY + 16 : busY - 22;
    return (
      <g key={id}>
        <line x1={x} y1={busY > 150 ? top - 9 : top + 9} x2={x} y2={busY} stroke={live ? LIVE : DEAD} strokeWidth="1.5" />
        <g onClick={() => setSel({ kind: 'gen', id })} className="cursor-pointer" data-testid={`sld-gen-${id}`} data-state={g.state}>
          <circle cx={x} cy={top} r="9" fill="#0b1a2c" stroke={col} strokeWidth={sel?.kind === 'gen' && sel.id === id ? 2.4 : 1.5} />
          <text x={x} y={top + 3} fontSize="7" textAnchor="middle" fill="#e6edf2">
            {id}
          </text>
          <text x={x} y={busY > 150 ? top + 18 : top - 12} fontSize="6.5" textAnchor="middle" fill="#9fb3c2">
            {g.state === 'online' ? `${g.kw.toFixed(0)} kW` : g.state.toUpperCase()}
          </text>
        </g>
        {breaker(x, brkY, g.breaker, g.state === 'tripped', live, () => setSel({ kind: 'gen', id }), `sld-gcb-${id}`, sel?.kind === 'gen' && sel.id === id)}
      </g>
    );
  };
  const tie = (id: TieId, x: number, y: number, vertical = false) => {
    const t = s.ties[id];
    const ends = { MSB_TIE: ['MSB_A', 'MSB_B'], TR_A: ['MSB_A', 'DB_A'], TR_B: ['MSB_B', 'DB_B'], DB_TIE: ['DB_A', 'DB_B'], ESB_FEED: ['DB_A', 'ESB'] }[id] as BusId[];
    const live = t.closed && s.buses[ends[0]].live;
    return (
      <g key={id}>
        {breaker(x, y, t.closed, t.tripped, live, () => setSel({ kind: 'tie', id }), `sld-tie-${id}`, sel?.kind === 'tie' && sel.id === id)}
        {t.syncing > 0 && (
          <text x={x} y={y + (vertical ? 0 : 14)} dx={vertical ? 8 : 0} fontSize="6" fill="#5fc8ff" textAnchor={vertical ? 'start' : 'middle'}>
            SYNC
          </text>
        )}
      </g>
    );
  };
  const drive = (id: string, x: number, busY: number) => {
    const d = s.drives.find((v) => v.id === id)!;
    const f = s.feeders.find((v) => v.id === `${id}_DRV`)!;
    const ok = d.status === 'ready' && f.energised;
    return (
      <g key={id} data-testid={`sld-drive-${id}`} data-status={d.status}>
        <line x1={x} y1={busY} x2={x} y2={busY + 26} stroke={ok ? LIVE : DEAD} strokeWidth="1.5" />
        <circle cx={x} cy={busY + 33} r="7" fill="#0b1a2c" stroke={d.status === 'tripped' ? FAULT : ok ? LIVE : DEAD} />
        <text x={x} y={busY + 35.5} fontSize="6" textAnchor="middle" fill="#e6edf2">
          M
        </text>
        <text x={x} y={busY + 49} fontSize="6.5" textAnchor="middle" fill="#c7d3dc">
          {id} {ok ? `${d.kw.toFixed(0)}kW` : d.status === 'restarting' ? 'RESTART' : 'OFF'}
        </text>
      </g>
    );
  };
  const ups = (id: 'UPS_A' | 'UPS_B' | 'UPS_C', x: number, y: number, fromY: number) => {
    const u = s.ups.find((v) => v.id === id)!;
    if (!u.installed) return null;
    const tone = u.mode === 'normal' ? LIVE : u.mode === 'off' ? FAULT : '#f2c94c';
    return (
      <g key={id} data-testid={`sld-${id}`} data-mode={u.mode}>
        <line x1={x} y1={fromY} x2={x} y2={y - 8} stroke={u.inputLive ? LIVE : DEAD} strokeWidth="1.2" />
        <rect x={x - 17} y={y - 8} width="34" height="16" fill="#0b1a2c" stroke={tone} />
        <text x={x} y={y - 1} fontSize="6.5" textAnchor="middle" fill="#e6edf2">
          {id.replace('_', ' ')}
        </text>
        <text x={x} y={y + 6} fontSize="5.5" textAnchor="middle" fill={tone}>
          {u.mode === 'normal' ? `${(u.soc * 100).toFixed(0)}%` : u.mode.toUpperCase()}
        </text>
      </g>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox="0 0 360 250" className="w-full select-none rounded-sm bg-[#061423]" role="img" aria-label="Electrical single-line diagram" data-testid="pms-sld">
        {/* Generators and main switchboard */}
        {gen('G1', 45, 70)}
        {gen('G2', 105, 70)}
        {gen('G3', 255, 70)}
        {gen('G4', 315, 70)}
        {busLine('MSB_A', 15, 165, 70)}
        {busLine('MSB_B', 195, 345, 70)}
        <line x1="165" y1="70" x2="195" y2="70" stroke={s.ties.MSB_TIE.closed ? LIVE : DEAD} strokeWidth="2" />
        {tie('MSB_TIE', 180, 70)}
        {drive('AZ1', 30, 70)}
        {drive('BT1', 70, 70)}
        {drive('BT2', 290, 70)}
        {drive('AZ2', 330, 70)}
        {/* Transformers to 440 V boards */}
        {[
          ['TR_A', 135, 'MSB_A'],
          ['TR_B', 225, 'MSB_B'],
        ].map(([id, x, b]) => (
          <g key={id as string}>
            <line x1={x as number} y1="70" x2={x as number} y2="150" stroke={s.ties[id as TieId].closed && s.buses[b as BusId].live ? LIVE : DEAD} strokeWidth="1.5" />
            {tie(id as TieId, x as number, 90, true)}
            <circle cx={x as number} cy="112" r="6" fill="none" stroke="#9fb3c2" />
            <circle cx={x as number} cy="120" r="6" fill="none" stroke="#9fb3c2" />
          </g>
        ))}
        {busLine('DB_A', 95, 165, 150)}
        {busLine('DB_B', 195, 265, 150)}
        <line x1="165" y1="150" x2="195" y2="150" stroke={s.ties.DB_TIE.closed ? LIVE : DEAD} strokeWidth="1.5" />
        {tie('DB_TIE', 180, 150)}
        {ups('UPS_A', 155, 185, 150)}
        {ups('UPS_B', 205, 185, 150)}
        {/* Emergency switchboard */}
        <line x1="105" y1="150" x2="105" y2="215" stroke={s.ties.ESB_FEED.closed && s.buses.DB_A.live ? LIVE : DEAD} strokeWidth="1.5" />
        {tie('ESB_FEED', 105, 172, true)}
        {busLine('ESB', 20, 120, 215)}
        {gen('EG', 40, 215)}
        {ups('UPS_C', 90, 238, 215)}
        <text x="230" y="214" fontSize="6.5" fill="#9fb3c2">
          ■ closed □ open ✕ tripped · click a breaker
        </text>
        <text x="230" y="224" fontSize="6.5" fill="#9fb3c2">
          — live - - dead · red = faulted
        </text>
      </svg>
      {sel && <Detail s={s} sel={sel} send={send} />}
    </div>
  );
}

function Detail({ s, sel, send }: P & { sel: NonNullable<Sel> }) {
  if (sel.kind === 'gen') return <GenCard s={s} id={sel.id} send={send} />;
  if (sel.kind === 'bus') {
    const b = s.buses[sel.id];
    return (
      <div className="rounded-sm bg-black/25 p-1.5" data-testid="pms-detail">
        <KV k={BUS_LABEL[sel.id]} v={<Chip tone={b.fault ? 'alarm' : b.live ? 'ok' : 'off'}>{b.fault ? 'FAULT' : b.live ? 'LIVE' : 'DEAD'}</Chip>} />
        <KV k="Voltage / frequency" v={`${b.v.toFixed(0)} V · ${b.hz.toFixed(2)} Hz`} />
        <div className="mt-1 flex flex-wrap gap-1">
          {b.fault ? <Btn label="CLEAR FAULT + RESET" tone="go" onClick={() => send({ type: 'bus-fault-clear', bus: sel.id })} testid="pms-bus-clear" /> : <Btn label="INJECT BUSBAR FAULT" tone="danger" onClick={() => send({ type: 'bus-fault', bus: sel.id })} testid="pms-bus-fault" />}
        </div>
      </div>
    );
  }
  const t = s.ties[sel.id];
  return (
    <div className="rounded-sm bg-black/25 p-1.5" data-testid="pms-detail">
      <KV k={TIE_LABEL[sel.id]} v={<Chip tone={t.tripped ? 'alarm' : t.closed ? 'ok' : 'off'}>{t.tripped ? 'TRIPPED' : t.closed ? 'CLOSED' : t.syncing ? 'SYNCHRONISING' : 'OPEN'}</Chip>} />
      <div className="mt-1 flex flex-wrap gap-1">
        {t.closed ? (
          <Btn label="OPEN" onClick={() => send({ type: 'tie-open', id: sel.id })} testid={`pms-${sel.id}-open`} />
        ) : (
          <>
            <Btn label="CLOSE" onClick={() => send({ type: 'tie-close', id: sel.id })} testid={`pms-${sel.id}-close`} />
            {sel.id === 'MSB_TIE' && <Btn label="SYNC & CLOSE" tone="go" onClick={() => send({ type: 'tie-sync-close', id: sel.id })} testid={`pms-${sel.id}-sync`} />}
          </>
        )}
        {t.tripped && <Btn label="RESET TRIP" tone="warn" onClick={() => send({ type: 'tie-reset', id: sel.id })} testid={`pms-${sel.id}-reset`} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ generators

function GenCard({ s, id, send }: P & { id: GenId }) {
  const g = s.gens.find((x) => x.id === id)!;
  const c = genCfg(id);
  const kva = Math.hypot(g.kw, g.kvar);
  const pf = kva > 0 ? g.kw / kva : 1;
  return (
    <div className="flex flex-col gap-1 rounded-sm bg-black/25 p-1.5" data-testid={`pms-gen-${id}`}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="font-mono text-[11px] font-semibold">
          {id} · {c.ratedKW} kW
        </span>
        <span className="flex gap-1">
          <Chip tone={GEN_TONE[g.state]} testid={`pms-gen-${id}-state`}>
            {g.state.toUpperCase()}
          </Chip>
          <Chip tone={g.mode === 'AUTO' ? 'info' : 'warn'}>{g.mode}</Chip>
        </span>
      </div>
      <Bar pct={(g.kw / c.ratedKW) * 100} label={`${id} load`} />
      <div className="grid grid-cols-2 gap-x-3">
        <KV k="kW / kVAr" v={`${g.kw.toFixed(0)} / ${g.kvar.toFixed(0)}`} testid={`pms-gen-${id}-kw`} />
        <KV k="kVA · PF" v={`${kva.toFixed(0)} · ${pf.toFixed(2)}`} />
        <KV k="Current" v={`${amps(g.kw, g.kvar, g.v).toFixed(0)} A`} />
        <KV k="V · Hz" v={`${g.v.toFixed(0)} · ${g.hz.toFixed(2)}`} />
        <KV k="Breaker" v={g.breaker ? 'CLOSED' : 'OPEN'} />
        <KV k="Run hours" v={g.runningHours.toFixed(1)} />
      </div>
      {g.tripReason && <p className="text-[10px] text-[#ff9b9b]">▲ Trip: {g.tripReason}</p>}
      {g.auxLostS > 0 && <p className="text-[10px] text-amber-200">◆ Cooling/fuel pumps unpowered: trip in {Math.max(0, CFG.pms.genAuxRideThroughS - g.auxLostS).toFixed(0)} s</p>}
      <div className="flex flex-wrap gap-1">
        <Btn label="START" tone="go" onClick={() => send({ type: 'gen-start', id })} testid={`pms-gen-${id}-start`} disabled={g.state !== 'stopped' && g.state !== 'cooldown'} />
        <Btn label="STOP" onClick={() => send({ type: 'gen-stop', id })} testid={`pms-gen-${id}-stop`} disabled={g.state === 'stopped' || g.state === 'tripped'} />
        <Btn label="SYNC & CLOSE" onClick={() => send({ type: 'gen-sync-close', id })} testid={`pms-gen-${id}-sync`} disabled={g.breaker} />
        <Btn label="CLOSE" onClick={() => send({ type: 'gen-close', id })} testid={`pms-gen-${id}-close`} disabled={g.breaker} />
        <Btn label="OPEN" onClick={() => send({ type: 'gen-open', id })} testid={`pms-gen-${id}-open`} disabled={!g.breaker} />
        <Btn label={g.mode === 'AUTO' ? 'SET MANUAL' : 'SET AUTO'} onClick={() => send({ type: 'gen-mode', id, mode: g.mode === 'AUTO' ? 'MANUAL' : 'AUTO' })} testid={`pms-gen-${id}-mode`} />
        {id !== 'EG' && <Btn label="1ST STANDBY" onClick={() => send({ type: 'gen-priority', id })} testid={`pms-gen-${id}-prio`} />}
        {g.state === 'tripped' && <Btn label="RESET TRIP" tone="warn" onClick={() => send({ type: 'gen-reset', id })} testid={`pms-gen-${id}-reset`} />}
      </div>
    </div>
  );
}

function Generators({ s, send }: P) {
  const order = [...s.gens].filter((g) => g.id !== 'EG').sort((a, b) => a.priority - b.priority);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] text-[#9fb3c2]">Standby order: {order.filter((g) => g.state !== 'online').map((g) => g.id).join(' → ') || 'none'} · CLOSE is only allowed on a dead bus; use SYNC & CLOSE on a live bus.</p>
      <div className="grid gap-1.5 md:grid-cols-2">
        {s.gens.map((g) => (
          <GenCard key={g.id} s={s} id={g.id} send={send} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------- switchboard

function Switchboard({ s, send }: P) {
  return (
    <div className="flex flex-col gap-2">
      <Section title="Bus sections">
        {(['MSB_A', 'MSB_B', 'DB_A', 'DB_B', 'ESB'] as BusId[]).map((b) => (
          <KV
            key={b}
            k={BUS_LABEL[b]}
            testid={`pms-bus-${b}`}
            v={
              <span className="flex items-center gap-1">
                {s.buses[b].live ? `${s.buses[b].v.toFixed(0)} V ${s.buses[b].hz.toFixed(2)} Hz` : ''}
                <Chip tone={s.buses[b].fault ? 'alarm' : s.buses[b].live ? 'ok' : 'off'}>{s.buses[b].fault ? 'FAULT' : s.buses[b].live ? 'LIVE' : 'DEAD'}</Chip>
              </span>
            }
          />
        ))}
      </Section>
      <Section title="Bus tie and interconnectors">
        {(Object.keys(s.ties) as TieId[]).map((id) => {
          const t = s.ties[id];
          return (
            <div key={id} className="flex flex-wrap items-center gap-1 rounded-sm bg-[#12345a] px-1.5 py-0.5 text-[10px]" data-testid={`pms-tie-${id}`}>
              <span className="flex-1">{TIE_LABEL[id]}</span>
              <Chip tone={t.tripped ? 'alarm' : t.closed ? 'ok' : t.syncing ? 'info' : 'off'}>{t.tripped ? 'TRIPPED' : t.closed ? 'CLOSED' : t.syncing ? 'SYNC' : 'OPEN'}</Chip>
              {t.closed ? (
                <Btn label="OPEN" onClick={() => send({ type: 'tie-open', id })} testid={`pms-tie-${id}-open`} />
              ) : (
                <Btn label={id === 'MSB_TIE' ? 'SYNC & CLOSE' : 'CLOSE'} onClick={() => send({ type: id === 'MSB_TIE' ? 'tie-sync-close' : 'tie-close', id })} testid={`pms-tie-${id}-close`} />
              )}
              {t.tripped && <Btn label="RESET" tone="warn" onClick={() => send({ type: 'tie-reset', id })} testid={`pms-tie-${id}-reset`} />}
            </div>
          );
        })}
      </Section>
      <Section title="Operating arrangement (resets the plant)">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['one-per-bus', 'Open bus · 1 set per side'],
              ['two-per-bus', 'Open bus · 2 sets per side'],
              ['closed-bus', 'Closed bus · 3 sets'],
            ] as [Arrangement, string][]
          ).map(([a, l]) => (
            <Btn key={a} label={l} onClick={() => send({ type: 'arrangement', value: a })} testid={`pms-arr-${a}`} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          {(['A', 'B'] as const).map((sec) => (
            <label key={sec} className="flex items-center gap-1">
              Min. sets online {sec}
              <select
                data-testid={`pms-min-${sec}`}
                value={s.minOnline[sec]}
                onChange={(e) => send({ type: 'min-online', section: sec, value: Number(e.target.value) })}
                className="rounded-sm border border-white/20 bg-[#12345a] px-1"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

// --------------------------------------------------------------------------------- loads and blackout

function Loads({ s, send }: P) {
  return (
    <div className="flex flex-col gap-2">
      <Section
        title="Load management"
        right={<Btn label={s.pmsAuto ? 'PMS AUTO: ON' : 'PMS AUTO: OFF'} tone={s.pmsAuto ? 'go' : 'warn'} onClick={() => send({ type: 'pms-auto', on: !s.pmsAuto })} testid="pms-auto" />}
      >
        {s.islands
          .filter((i) => i.capacityKW > 0)
          .map((i) => (
            <div key={i.id} className="rounded-sm bg-black/25 p-1.5 text-[10px]">
              <div className="flex justify-between font-mono">
                <span>{i.buses.join(' + ')}</span>
                <span>
                  {i.gens.join(', ')} · reserve {i.reserveKW.toFixed(0)} kW · PF {i.pf.toFixed(2)}
                </span>
              </div>
              <Bar pct={i.loadPct} warn={CFG.pms.startLoadPct} label="Island load" />
            </div>
          ))}
        <p className="text-[10px] text-[#9fb3c2]">
          Standby start above {CFG.pms.startLoadPct} % for {CFG.pms.startDelayS} s · stop below {CFG.pms.stopLoadPct} % for {CFG.pms.stopDelayS} s if the rest stay
          under {CFG.pms.stopRemainingMaxPct} % · thruster phase-back at {CFG.pms.phaseBackPct} % · shed above {CFG.pms.shedLoadPct} %.
        </p>
      </Section>
      <Section title="Blackout recovery">
        {(['A', 'B'] as const).map((sec) => (
          <KV
            key={sec}
            k={`Section ${sec}`}
            testid={`pms-recovery-${sec}`}
            v={<Chip tone={s.recovery[sec].stage === 'normal' ? 'ok' : s.recovery[sec].stage === 'restoring' ? 'warn' : 'alarm'}>{s.recovery[sec].stage.toUpperCase()}</Chip>}
          />
        ))}
        <KV k="Emergency switchboard" v={s.gens.find((g) => g.id === 'EG')!.breaker ? 'ON EMERGENCY GENERATOR' : s.buses.ESB.live ? 'FROM MAIN (440 V A)' : 'DEAD'} testid="pms-esb-source" />
      </Section>
      <Section title="Feeders · shed priority (3 = first)">
        <div className="flex flex-col gap-0.5">
          {s.feeders.map((f) => {
            const c = CFG.feeders.find((x) => x.id === f.id)!;
            const state = f.tripped ? 'TRIPPED' : f.shed ? 'SHED' : !f.closed ? 'OPEN' : f.energised ? 'ON' : 'NO SUPPLY';
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-1 rounded-sm bg-[#12345a]/70 px-1.5 py-0.5 text-[10px]" data-testid={`pms-feeder-${f.id}`}>
                <span className="w-14 font-mono text-[#9fb3c2]">{c.bus.replace('_', '-')}</span>
                <span className="min-w-[8rem] flex-1">{c.label}</span>
                <span className="w-12 text-right font-mono">{f.kw.toFixed(0)} kW</span>
                <span className="w-4 text-center font-mono text-[#9fb3c2]">{c.shed || '–'}</span>
                <Chip tone={state === 'ON' ? 'ok' : state === 'TRIPPED' ? 'alarm' : state === 'SHED' || state === 'NO SUPPLY' ? 'warn' : 'off'}>{state}</Chip>
                {f.closed && !f.tripped ? (
                  <Btn label="OPEN" onClick={() => send({ type: 'feeder-open', id: f.id })} testid={`pms-feeder-${f.id}-open`} />
                ) : (
                  <Btn label="CLOSE" onClick={() => send({ type: 'feeder-close', id: f.id })} testid={`pms-feeder-${f.id}-close`} />
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------------------------------- DP power

function DpPower({ s }: P) {
  const dp = useControllerState(dpSystem);
  const select = useAppStore((st) => st.select);
  const groupKW = (g: 'A' | 'B') => {
    const isl = s.islands.find((i) => i.buses.includes(g === 'A' ? 'MSB_A' : 'MSB_B'));
    return isl ? { cap: isl.capacityKW, load: isl.loadKW, reserve: isl.reserveKW } : { cap: 0, load: 0, reserve: 0 };
  };
  const groupsOk = (['A', 'B'] as const).map((g) => s.drives.filter((d) => THRUSTER_GROUP[d.id] === g).some((d) => dp.thrusters.find((t) => t.id === d.id)!.powered));
  return (
    <div className="flex flex-col gap-2 text-[10px]">
      <table className="w-full border-separate border-spacing-y-0.5 font-mono" data-testid="pms-thruster-power">
        <thead className="text-left text-[9px] text-[#9fb3c2]">
          <tr>
            <th>Unit</th>
            <th>Grp</th>
            <th>Drive</th>
            <th>Demand</th>
            <th>Allowed</th>
            <th>Actual</th>
            <th>Limit</th>
          </tr>
        </thead>
        <tbody>
          {s.drives.map((d) => (
            <tr key={d.id} className="bg-black/25" data-testid={`pms-drive-${d.id}`}>
              <td className="px-1">{d.id}</td>
              <td>{THRUSTER_GROUP[d.id]}</td>
              <td>
                <Chip tone={d.status === 'ready' ? 'ok' : d.status === 'restarting' ? 'info' : 'alarm'}>{d.status.toUpperCase()}</Chip>
              </td>
              <td>{d.demandKW.toFixed(0)} kW</td>
              <td>{d.status === 'ready' ? `${d.allowedKW.toFixed(0)} kW` : '–'}</td>
              <td>{d.kw.toFixed(0)} kW</td>
              <td>{(d.limitN / 1000).toFixed(0)} kN</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-1">
        {(['A', 'B'] as const).map((g, i) => {
          const k = groupKW(g);
          return (
            <div key={g} className="rounded-sm bg-black/25 p-1.5" data-testid={`pms-group-${g}`}>
              <div className="flex justify-between">
                <span>Group {g}</span>
                <Chip tone={groupsOk[i] ? 'ok' : 'alarm'}>{groupsOk[i] ? 'AVAILABLE' : 'LOST'}</Chip>
              </div>
              <KV k="Online / load" v={`${k.cap} / ${k.load.toFixed(0)} kW`} />
              <KV k="Reserve" v={`${k.reserve.toFixed(0)} kW`} />
            </div>
          );
        })}
      </div>
      <p className={`rounded-sm p-1.5 ${groupsOk.every(Boolean) ? 'bg-[#1f6b34]/40' : 'bg-[#8f1d1d]/60'}`} data-testid="pms-redundancy">
        {groupsOk.every(Boolean) ? '● Electrical redundancy: both power groups available.' : '▲ Electrical redundancy lost: one power group unavailable.'}
      </p>
      <p className={`rounded-sm p-1.5 ${dp.consequence.groupOk === false ? 'bg-[#8f1d1d]/60' : 'bg-[#12345a]'}`} data-testid="pms-capability">
        {dp.consequence.groupOk === false ? '▲' : '●'} Position capability after losing one power group (simplified thrust check, not a full capability analysis):{' '}
        {dp.status !== 'running' ? 'DP not running.' : dp.consequence.groupOk === false ? `NOT held if group ${dp.consequence.worstGroup} is lost.` : 'held in the present environment.'}
      </p>
      {dp.alarms.includes('POWER_LIMIT') && <p className="text-amber-200">◆ {DP_ALARM_TEXT.POWER_LIMIT}</p>}
      <Btn label="OPEN DP SYSTEM" onClick={() => select('dp-console-001')} testid="pms-open-dp" />
    </div>
  );
}

// -------------------------------------------------------------------------------------- alarms/events

function Alarms({ s, send }: P) {
  const open = unacknowledgedPower(s);
  return (
    <div className="flex flex-col gap-2">
      <Section title={`Active alarms (${s.alarms.length})`} right={<Btn label={`ACK${open.length ? ` (${open.length})` : ''}`} tone={open.length ? 'warn' : undefined} disabled={!open.length} onClick={() => send({ type: 'acknowledge' })} testid="pms-ack" />}>
        <ul className="flex flex-col gap-0.5 font-mono text-[10px]" data-testid="pms-alarms">
          {s.alarms.length === 0 && <li className="text-[#7f93a3]">No active alarms</li>}
          {s.alarms.map((a) => {
            const sev = /^(BLACKOUT|GEN_TRIP|BUS_FAULT|UPS_OFF|UPS_CRIT|OVERLOAD|FEEDER_TRIP|DRIVE_TRIP|AUX_LOST|TR_TRIP)/.test(a) ? 'alarm' : 'warning';
            return (
              <li key={a} className={`${open.includes(a) ? 'animate-pulse' : ''} ${sev === 'alarm' ? 'text-[#ff9b9b]' : 'text-amber-200'}`}>
                {SEV_SYMBOL[sev]} {sev === 'alarm' ? 'ALARM' : 'WARN'} · {alarmText(a)}
                {!open.includes(a) && ' (ack)'}
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Event history (newest first)">
        <ol className="flex max-h-56 flex-col gap-0.5 overflow-y-auto font-mono text-[10px]" data-testid="pms-events">
          {[...s.events]
            .reverse()
            .slice(0, 150)
            .map((e, i) => (
              <li key={`${e.t}-${i}`} className={e.sev === 'alarm' ? 'text-[#ff9b9b]' : e.sev === 'warning' ? 'text-amber-200' : 'text-[#c7d3dc]'}>
                {fmtTime(e.t)} {SEV_SYMBOL[e.sev]} {e.text}
              </li>
            ))}
        </ol>
      </Section>
    </div>
  );
}

function Trends({ s }: { s: PowerState }) {
  const tr = s.trend;
  return (
    <div className="flex flex-col gap-1.5" data-testid="pms-trends">
      <p className="text-[10px] text-[#9fb3c2]">Last {Math.round((tr.length ? tr[tr.length - 1].t - tr[0].t : 0) / 60)} min of simulated time, 1 sample per second.</p>
      <Trend label="Section load" unit="kW" min={0} max={3400} series={[{ name: 'A', color: '#5fc8ff', values: tr.map((p) => p.kwA) }, { name: 'B', color: '#f2c94c', values: tr.map((p) => p.kwB) }]} />
      <Trend label="Frequency" unit="Hz" min={55} max={62} series={[{ name: 'A', color: '#5fc8ff', values: tr.map((p) => p.hzA) }, { name: 'B', color: '#f2c94c', values: tr.map((p) => p.hzB) }]} />
      <Trend label="Reserve and thruster power" unit="kW" min={0} series={[{ name: 'Reserve', color: '#3fd16b', values: tr.map((p) => p.reserveKW) }, { name: 'Thrusters', color: '#e08a44', values: tr.map((p) => p.thrKW) }]} />
      <Trend label="UPS state of charge" unit="%" min={0} max={100} series={[{ name: 'UPS A', color: '#5fc8ff', values: tr.map((p) => p.upsA) }, { name: 'UPS B', color: '#f2c94c', values: tr.map((p) => p.upsB) }]} />
    </div>
  );
}

function Faults({ s, send }: P) {
  const g = (id: GenId) => s.gens.find((x) => x.id === id)!;
  return (
    <div className="flex flex-col gap-2">
      <Section title="Generators">
        <div className="flex flex-wrap gap-1">
          {(['G1', 'G2', 'G3', 'G4', 'EG'] as GenId[]).map((id) =>
            g(id).state === 'tripped' ? (
              <Btn key={id} label={`RESET ${id}`} tone="warn" onClick={() => send({ type: 'gen-reset', id })} testid={`pms-fault-reset-${id}`} />
            ) : (
              <Btn key={id} label={`TRIP ${id}`} tone="danger" onClick={() => send({ type: 'gen-trip', id })} testid={`pms-fault-trip-${id}`} />
            ),
          )}
        </div>
      </Section>
      <Section title="Switchboards and distribution">
        <div className="flex flex-wrap gap-1">
          {(['MSB_A', 'MSB_B', 'DB_A', 'DB_B'] as BusId[]).map((b) =>
            s.buses[b].fault ? (
              <Btn key={b} label={`CLEAR ${b}`} tone="warn" onClick={() => send({ type: 'bus-fault-clear', bus: b })} testid={`pms-fault-clear-${b}`} />
            ) : (
              <Btn key={b} label={`BUS FAULT ${b}`} tone="danger" onClick={() => send({ type: 'bus-fault', bus: b })} testid={`pms-fault-bus-${b}`} />
            ),
          )}
          {(['TR_A', 'TR_B', 'ESB_FEED'] as TieId[]).map((t) =>
            s.ties[t].tripped ? (
              <Btn key={t} label={`RESET ${t}`} tone="warn" onClick={() => send({ type: 'tie-reset', id: t })} testid={`pms-fault-reset-${t}`} />
            ) : (
              <Btn key={t} label={`TRIP ${t}`} tone="danger" onClick={() => send({ type: 'tie-trip', id: t })} testid={`pms-fault-trip-${t}`} />
            ),
          )}
        </div>
      </Section>
      <Section title="Feeders (short circuit)">
        <div className="flex flex-wrap gap-1">
          {['AZ1_DRV', 'BT2_DRV', 'AZ2_AUX', 'G12_AUX', 'HOTEL_A'].map((id) => {
            const f = s.feeders.find((x) => x.id === id)!;
            return f.tripped ? (
              <Btn key={id} label={`RESET ${id}`} tone="warn" onClick={() => send({ type: 'feeder-reset', id })} testid={`pms-fault-reset-${id}`} />
            ) : (
              <Btn key={id} label={`FAULT ${id}`} tone="danger" onClick={() => send({ type: 'feeder-fault', id })} testid={`pms-fault-feeder-${id}`} />
            );
          })}
        </div>
        <p className="text-[10px] text-[#9fb3c2]">A tripped feeder stays open after RESET until you close it on the Loads page.</p>
      </Section>
      <Section title="Protection functions">
        <Btn
          label={s.phaseBack ? 'DISABLE THRUSTER PHASE-BACK (fault)' : 'RESTORE THRUSTER PHASE-BACK'}
          tone={s.phaseBack ? 'danger' : 'go'}
          onClick={() => send({ type: 'phase-back', on: !s.phaseBack })}
          testid="pms-fault-phaseback"
        />
      </Section>
      <Section title="Diagnostics">
        <KV k="Generation" v={`${s.balance.genKW.toFixed(1)} kW`} testid="pms-diag-gen" />
        <KV k="Consumption + losses" v={`${(s.balance.loadKW + s.balance.lossKW).toFixed(1)} kW`} testid="pms-diag-load" />
        <KV k="Unmet demand" v={`${s.balance.unmetKW.toFixed(0)} kW`} />
        <KV k="Energy generated" v={`${s.energy.genKWh.toFixed(1)} kWh`} />
      </Section>
    </div>
  );
}
