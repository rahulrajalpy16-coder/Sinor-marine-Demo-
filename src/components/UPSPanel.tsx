import { useState } from 'react';
import { powerSystem } from '../simulations/powerController';
import { useControllerState } from '../simulations/useController';
import { alarmText, batteryKWh, BUS_LABEL, POWER_CONFIG as CFG, type ConsumerId, type PowerCommand, type Ups, type UpsId } from '../simulations/power';
import { Bar, Btn, Chip, HmiFrame, KV, Rejection, Section, SEV_SYMBOL, Tabs, Trend, type Tone } from './hmi/kit';
import { DataNote } from './DataNote';

const MODE: Record<Ups['mode'], { tone: Tone; label: string }> = {
  normal: { tone: 'ok', label: 'NORMAL (INVERTER)' },
  battery: { tone: 'warn', label: 'ON BATTERY' },
  'static-bypass': { tone: 'warn', label: 'STATIC BYPASS' },
  'maintenance-bypass': { tone: 'warn', label: 'MAINTENANCE BYPASS' },
  off: { tone: 'alarm', label: 'OUTPUT OFF' },
};

/**
 * DP UPS HMI: power path (input, rectifier, battery, inverter, static and maintenance bypass), battery and runtime,
 * consumer mapping and fault injection. The values are the shared core's (power.ts); the battery energy balance is
 * integrated every step so the runtime estimate falls as the battery discharges.
 */
export function UPSPanel() {
  const s = useControllerState(powerSystem);
  const units = s.ups.filter((u) => u.installed);
  const [id, setId] = useState<UpsId>('UPS_A');
  const [err, setErr] = useState<string | null>(null);
  const u = units.find((x) => x.id === id) ?? units[0];
  const send = (c: PowerCommand) => {
    powerSystem.dispatch(c);
    setErr(powerSystem.lastError);
  };
  const worst = units.some((x) => x.mode === 'off') ? 'alarm' : units.some((x) => x.mode !== 'normal') ? 'warn' : 'ok';
  return (
    <HmiFrame
      title="DP UPS"
      testid="ups-hmi"
      status={
        <Chip tone={worst} testid="ups-status">
          {worst === 'ok' ? 'ALL NORMAL' : worst === 'alarm' ? 'OUTPUT LOST' : 'NOT PROTECTED'}
        </Chip>
      }
    >
      <Tabs tabs={units.map((x) => ({ id: x.id, label: x.id.replace('_', ' ') }))} value={u.id} onChange={setId} prefix="ups" />
      <Rejection msg={err} onClose={() => setErr(null)} />
      <UpsDetail u={u} send={send} />
      <Consumers s={s.consumers} ups={s.ups} />
      <Trend
        label="State of charge"
        unit="%"
        min={0}
        max={100}
        series={units.map((x, i) => ({ name: x.id.replace('_', ' '), color: ['#5fc8ff', '#f2c94c', '#c58bff'][i], values: s.trend.map((p) => (x.id === 'UPS_A' ? p.upsA : x.id === 'UPS_B' ? p.upsB : NaN)).filter(Number.isFinite) }))}
      />
      <DataNote>
        Generic online double-conversion DP UPS. Ratings, battery (108 × 2 V cells) and autonomy are provisional demonstration values: a UPS of this
        size carries the mapped DP consumers for well over 30 minutes from full charge. Runtime is an estimate from the present load, battery state of
        health and inverter efficiency. The UPS consumer map and input selector reproduce the arrangement described in IMCA DPE 03/19 and 04/18;
        verify the vessel's real map against its DP FMEA.
      </DataNote>
    </HmiFrame>
  );
}

function UpsDetail({ u, send }: { u: Ups; send: (c: PowerCommand) => void }) {
  const c = CFG.ups.find((x) => x.id === u.id)!;
  const kwh = batteryKWh(u);
  const rated = c.ratedKVA * c.pf;
  const fault = (kind: 'rectifier' | 'inverter' | 'battery', on: boolean) => send({ type: 'ups-fault', id: u.id, kind, on });
  const inBus = u.selector === 'MAIN' ? c.mainBus : c.emergBus;
  return (
    <div className="flex flex-col gap-2" data-testid={`ups-${u.id}`} data-mode={u.mode}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="text-[11px] font-semibold">{c.label}</span>
        <Chip tone={MODE[u.mode].tone} testid={`ups-${u.id}-mode`}>
          {MODE[u.mode].label}
        </Chip>
      </div>
      <PowerPath u={u} inLabel={BUS_LABEL[inBus]} />
      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Section title="Input and output">
          <KV k="Input" v={`${u.inputLive ? `${u.inV.toFixed(0)} V ${u.inHz.toFixed(1)} Hz` : 'NO SUPPLY'} · ${u.selector}`} testid={`ups-${u.id}-input`} />
          <KV k="Bypass supply" v={u.bypassLive ? 'AVAILABLE' : 'NOT AVAILABLE'} />
          <KV k="Output" v={u.outputLive ? `${u.outV.toFixed(0)} V ${u.outHz.toFixed(1)} Hz` : 'OFF'} testid={`ups-${u.id}-output`} />
          <KV k="Load" v={`${(u.loadKW * 1000).toFixed(0)} W (${((u.loadKW / rated) * 100).toFixed(0)} %)`} testid={`ups-${u.id}-load`} />
          <KV k="Input power" v={`${(u.inputKW * 1000).toFixed(0)} W`} />
        </Section>
        <Section title="Battery">
          <Bar pct={u.soc * 100} warn={101} alarm={101} label="State of charge" />
          <KV k="State of charge" v={`${(u.soc * 100).toFixed(1)} %`} testid={`ups-${u.id}-soc`} />
          <KV k="Runtime estimate" v={u.runtimeMin === null ? (u.battKW < 0 ? 'CHARGING' : '–') : `${u.runtimeMin.toFixed(0)} min`} testid={`ups-${u.id}-runtime`} />
          <KV k="Battery" v={`${u.battV.toFixed(0)} V · ${u.battA.toFixed(1)} A ${u.battKW > 0.001 ? 'discharge' : u.battKW < -0.001 ? 'charge' : ''}`} />
          <KV k="Capacity · health" v={`${kwh.toFixed(2)} kWh · ${(u.soh * 100).toFixed(0)} %`} />
        </Section>
      </div>
      <Section title="Operation">
        <div className="flex flex-wrap gap-1">
          {u.id !== 'UPS_C' && (
            <Btn
              label={u.selector === 'MAIN' ? 'INPUT → EMERGENCY' : 'INPUT → MAIN'}
              onClick={() => send({ type: 'ups-selector', id: u.id, selector: u.selector === 'MAIN' ? 'EMERG' : 'MAIN' })}
              testid={`ups-${u.id}-selector`}
            />
          )}
          <Btn label={u.maintBypass ? 'LEAVE MAINT. BYPASS' : 'MAINTENANCE BYPASS'} tone={u.maintBypass ? 'go' : undefined} onClick={() => send({ type: 'ups-maint-bypass', id: u.id, on: !u.maintBypass })} testid={`ups-${u.id}-maint`} />
        </div>
      </Section>
      <Section title="Fault injection">
        <div className="flex flex-wrap gap-1">
          {(['rectifier', 'inverter', 'battery'] as const).map((k) => {
            const on = k === 'rectifier' ? u.rectifierFault : k === 'inverter' ? u.inverterFault : u.batteryFault;
            return <Btn key={k} label={on ? `CLEAR ${k.toUpperCase()} FAULT` : `${k.toUpperCase()} FAULT`} tone={on ? 'go' : 'danger'} onClick={() => fault(k, !on)} testid={`ups-${u.id}-fault-${k}`} />;
          })}
          {[1, 0.6, 0.3].map((v) => (
            <Btn key={v} label={`HEALTH ${v * 100}%`} tone={u.soh === v ? 'go' : undefined} onClick={() => send({ type: 'ups-soh', id: u.id, value: v })} testid={`ups-${u.id}-soh-${v * 100}`} />
          ))}
        </div>
        <p className="text-[10px] text-[#9fb3c2]">To lose the UPS input, trip or fault its 440 V board on the Power Management Faults page.</p>
      </Section>
      <UpsAlarms id={u.id} />
    </div>
  );
}

function UpsAlarms({ id }: { id: UpsId }) {
  const s = useControllerState(powerSystem);
  const mine = s.alarms.filter((a) => a.endsWith(`:${id}`));
  return (
    <ul className="flex flex-col gap-0.5 font-mono text-[10px]" data-testid={`ups-${id}-alarms`}>
      {mine.length === 0 && <li className="text-[#7f93a3]">No active UPS alarms</li>}
      {mine.map((a) => {
        const sev = /^UPS_(OFF|CRIT)/.test(a) ? 'alarm' : 'warning';
        return (
          <li key={a} className={sev === 'alarm' ? 'text-[#ff9b9b]' : 'text-amber-200'}>
            {SEV_SYMBOL[sev]} {alarmText(a)}
          </li>
        );
      })}
    </ul>
  );
}

/** Simplified power-path mimic: the energised path is drawn solid green, everything else dashed grey. */
function PowerPath({ u, inLabel }: { u: Ups; inLabel: string }) {
  const G = '#3fd16b';
  const D = '#5a6670';
  const rect = u.inputLive && !u.rectifierFault && !u.maintBypass;
  const inv = !u.inverterFault && u.mode !== 'static-bypass' && u.mode !== 'maintenance-bypass' && u.mode !== 'off';
  const batt = u.mode === 'battery';
  const byp = u.mode === 'static-bypass';
  const maint = u.mode === 'maintenance-bypass';
  const ln = (x1: number, y1: number, x2: number, y2: number, on: boolean) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? G : D} strokeWidth="2" strokeDasharray={on ? undefined : '4 3'} />;
  const box = (x: number, y: number, label: string, ok: boolean, faulted = false) => (
    <g>
      <rect x={x} y={y} width="54" height="22" rx="2" fill="#0b1a2c" stroke={faulted ? '#e04444' : ok ? G : '#9fb3c2'} />
      <text x={x + 27} y={y + 14} fontSize="7.5" textAnchor="middle" fill="#e6edf2">
        {label}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 340 120" className="w-full rounded-sm bg-[#061423]" role="img" aria-label="UPS power path" data-testid="ups-path">
      <text x="4" y="12" fontSize="7" fill="#9fb3c2">
        {inLabel}
      </text>
      {ln(10, 46, 60, 46, u.inputLive)}
      {box(60, 35, 'RECTIFIER', rect, u.rectifierFault)}
      {ln(114, 46, 160, 46, rect || batt)}
      {ln(137, 46, 137, 72, rect || batt)}
      <g>
        <rect x="117" y="72" width="40" height="18" fill="#0b1a2c" stroke={u.batteryFault ? '#e04444' : batt ? '#f2c94c' : '#9fb3c2'} />
        <text x="137" y="84" fontSize="7" textAnchor="middle" fill="#e6edf2">
          BATT {(u.soc * 100).toFixed(0)}%
        </text>
      </g>
      {box(160, 35, 'INVERTER', inv, u.inverterFault)}
      {ln(214, 46, 250, 46, inv)}
      {box(250, 35, 'STATIC SW', inv || byp, false)}
      {ln(304, 46, 336, 46, u.outputLive)}
      <text x="306" y="40" fontSize="7" fill="#9fb3c2">
        OUT
      </text>
      {/* Static bypass */}
      {ln(30, 46, 30, 20, u.bypassLive)}
      {ln(30, 20, 277, 20, byp)}
      {ln(277, 20, 277, 35, byp)}
      <text x="150" y="16" fontSize="6.5" fill="#9fb3c2">
        static bypass
      </text>
      {/* Maintenance bypass */}
      {ln(20, 46, 20, 108, maint)}
      {ln(20, 108, 320, 108, maint)}
      {ln(320, 108, 320, 46, maint)}
      <text x="190" y="104" fontSize="6.5" fill="#9fb3c2">
        maintenance bypass (external)
      </text>
    </svg>
  );
}

function Consumers({ s, ups }: { s: Record<ConsumerId, boolean>; ups: Ups[] }) {
  const installed = new Set(ups.filter((u) => u.installed).map((u) => u.id));
  const ids = (Object.keys(CFG.consumers) as ConsumerId[]).filter((k) => CFG.consumers[k].supplies.some((x) => installed.has(x)));
  return (
    <Section title="Consumer map (UPS → DP consumer)">
      <table className="w-full font-mono text-[10px]" data-testid="ups-consumers">
        <tbody>
          {ids.map((k) => {
            const c = CFG.consumers[k];
            return (
              <tr key={k} className="border-b border-white/5" data-testid={`ups-consumer-${k}`} data-powered={s[k]}>
                <td className="py-0.5">{c.label}</td>
                <td className="text-[#9fb3c2]">{c.supplies.map((x) => x.replace('UPS_', '')).join('+')}</td>
                <td className="text-right">
                  <Chip tone={s[k] ? 'ok' : 'alarm'}>{s[k] ? 'POWERED' : 'NO POWER'}</Chip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}
