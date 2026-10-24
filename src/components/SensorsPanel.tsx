import { dpSystem } from '../simulations/dpController';
import { powerSystem } from '../simulations/powerController';
import { useControllerState } from '../simulations/useController';
import { DP_ALARM_TEXT, SENSOR_LABEL, type SensorFault, type SensorId } from '../simulations/dp';
import { POWER_CONFIG as CFG } from '../simulations/power';
import { Btn, Chip, HmiFrame, KV, Section, type Tone } from './hmi/kit';
import { DataNote } from './DataNote';

const deg = (r: number) => (((r * 180) / Math.PI) % 360 + 360) % 360;

/**
 * Heading and motion sensors: three gyrocompasses with median voting and two MRUs, each fed from its UPS. Faults
 * change only what the DP measures; the vessel's real heading is unaffected until the DP acts on a wrong value.
 */
export function SensorsPanel() {
  const dp = useControllerState(dpSystem);
  const p = useControllerState(powerSystem);
  const gyros = dp.sensors.filter((x) => x.id.startsWith('GYRO') && x.installed);
  const mrus = dp.sensors.filter((x) => x.id.startsWith('MRU') && x.installed);
  const usable = gyros.filter((g) => g.powered && g.fault !== 'fail' && !g.rejected);
  const tone: Tone = dp.psiMeas === null ? 'alarm' : usable.length < 2 ? 'warn' : 'ok';
  const trueHdg = deg(dp.eta[2]);
  const sensorAlarms = (['NO_HEADING_REF', 'GYRO_REJECTED', 'HEADING_DEVIATION', 'SINGLE_GYRO', 'NO_MRU'] as const).filter((a) => dp.alarms.includes(a));
  const set = (id: SensorId, fault: SensorFault) => dpSystem.dispatch({ type: 'sensor-fault', id, fault });
  const row = (id: SensorId, gyro: boolean) => {
    const x = dp.sensors.find((v) => v.id === id)!;
    const status = !x.powered ? 'NO POWER' : x.fault === 'fail' ? 'FAILED' : x.rejected ? 'REJECTED' : 'IN USE';
    const reading = gyro && x.powered && x.fault !== 'fail' ? `${((trueHdg + (x.bias * 180) / Math.PI + 360) % 360).toFixed(1)}°` : '–';
    return (
      <div key={id} className="flex flex-col gap-1 rounded-sm bg-black/25 p-1.5" data-testid={`sensor-${id}`} data-status={status}>
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-[10px] font-semibold">
            {SENSOR_LABEL[id]} <span className="font-normal text-[#9fb3c2]">· {CFG.consumers[id].supplies.map((u) => u.replace('_', ' ')).join(' + ')}</span>
          </span>
          <Chip tone={status === 'IN USE' ? 'ok' : status === 'REJECTED' ? 'warn' : 'alarm'} testid={`sensor-${id}-status`}>
            {status}
          </Chip>
        </div>
        {gyro && <KV k="Heading output" v={reading} testid={`sensor-${id}-heading`} />}
        <div className="flex flex-wrap gap-1">
          <Btn label="NORMAL" tone={x.fault === null ? 'go' : undefined} onClick={() => set(id, null)} testid={`sensor-${id}-ok`} />
          <Btn label="FAIL" tone={x.fault === 'fail' ? 'danger' : undefined} onClick={() => set(id, 'fail')} testid={`sensor-${id}-fail`} />
          {gyro && <Btn label="SLOW DRIFT" tone={x.fault === 'drift' ? 'danger' : undefined} onClick={() => set(id, 'drift')} testid={`sensor-${id}-drift`} />}
        </div>
      </div>
    );
  };
  return (
    <HmiFrame
      title="HEADING & MOTION SENSORS"
      testid="sensors-hmi"
      status={
        <Chip tone={tone} testid="sensors-status">
          {dp.psiMeas === null ? 'NO HEADING' : `${usable.length} GYRO${usable.length === 1 ? '' : 'S'} IN USE`}
        </Chip>
      }
    >
      <Section title="Heading">
        <KV k="Vessel heading (truth)" v={`${trueHdg.toFixed(1)}°`} />
        <KV k="Heading used by DP (voted)" v={dp.psiMeas === null ? 'NONE' : `${deg(dp.psiMeas).toFixed(1)}°`} testid="sensors-voted" />
        <KV k="Voting" v={usable.length >= 3 ? 'Median of three' : usable.length === 2 ? 'Average of two, deviation alarm' : usable.length === 1 ? 'Single gyro, no check' : 'None'} />
      </Section>
      <div className="grid gap-1.5 md:grid-cols-3">{gyros.map((g) => row(g.id, true))}</div>
      <Section title="Motion reference units">
        <div className="grid gap-1.5 md:grid-cols-2">{mrus.map((m) => row(m.id, false))}</div>
        <KV k="MRU powered (UPS)" v={mrus.map((m) => `${m.id}: ${p.consumers[m.id] ? 'yes' : 'no'}`).join(' · ')} />
      </Section>
      <ul className="flex flex-col gap-0.5 font-mono text-[10px]" data-testid="sensors-alarms">
        {sensorAlarms.length === 0 && <li className="text-[#7f93a3]">No active sensor alarms</li>}
        {sensorAlarms.map((a) => (
          <li key={a} className={a === 'NO_HEADING_REF' ? 'text-[#ff9b9b]' : 'text-amber-200'}>
            {a === 'NO_HEADING_REF' ? '▲' : '◆'} {DP_ALARM_TEXT[a]}
          </li>
        ))}
      </ul>
      <DataNote>
        Generic gyrocompasses and MRUs (makes not supplied). A drifting gyro builds its error slowly, so voting catches it only once it is more than
        2° from the others. With no MRU the reference systems lose motion compensation and their noise rises. Thresholds are demonstration values.
      </DataNote>
    </HmiFrame>
  );
}
