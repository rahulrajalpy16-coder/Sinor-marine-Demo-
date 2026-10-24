import { dpSystem } from '../simulations/dpController';
import { powerSystem } from '../simulations/powerController';
import { useControllerState } from '../simulations/useController';
import { THRUSTER_GROUP } from '../simulations/dp';
import { Bar, Btn, Chip, HmiFrame, KV } from './hmi/kit';
import { DataNote } from './DataNote';
import { useAppStore } from '../store/useAppStore';

const MAX_N = 250e3;

/** Stern azimuth thrusters AZ1/AZ2: DP command, delivered thrust, angle, drive power and the PMS power limit. */
export function AzimuthPanel() {
  const dp = useControllerState(dpSystem);
  const p = useControllerState(powerSystem);
  const select = useAppStore((s) => s.select);
  return (
    <HmiFrame title="AZIMUTH THRUSTERS" testid="az-hmi" status={<Chip tone={dp.status === 'running' ? 'info' : 'off'}>{dp.status === 'running' ? 'IN DP' : 'DP STOPPED'}</Chip>}>
      <div className="grid gap-1.5 md:grid-cols-2">
        {(['AZ1', 'AZ2'] as const).map((id) => {
          const t = dp.thrusters.find((x) => x.id === id)!;
          const d = p.drives.find((x) => x.id === id)!;
          const state = t.failed ? 'FAILED' : !t.powered ? 'NO POWER' : t.available ? 'AVAILABLE' : 'NOT AVAILABLE';
          return (
            <div key={id} className="flex flex-col gap-1 rounded-sm bg-black/25 p-1.5" data-testid={`az-${id}`} data-state={state}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold">
                  {id} · {id === 'AZ1' ? 'port' : 'starboard'} · group {THRUSTER_GROUP[id]}
                </span>
                <Chip tone={state === 'AVAILABLE' ? 'ok' : 'alarm'} testid={`az-${id}-state`}>
                  {state}
                </Chip>
              </div>
              <Bar pct={(t.forceN / MAX_N) * 100} label={`${id} thrust`} />
              <KV k="Thrust command / delivered" v={`${(t.cmdN / 1000).toFixed(0)} / ${(t.forceN / 1000).toFixed(0)} kN`} />
              <KV k="Angle command / actual" v={`${((t.cmdAngle * 180) / Math.PI).toFixed(0)}° / ${((t.angle * 180) / Math.PI).toFixed(0)}°`} />
              <KV k="Power limit (PMS)" v={`${(t.limitN / 1000).toFixed(0)} kN`} testid={`az-${id}-limit`} />
              <KV k="Drive" v={`${d.status.toUpperCase()} · ${d.kw.toFixed(0)} kW`} />
              <Btn label={t.failed ? 'CLEAR FAILURE' : 'FAIL THRUSTER'} tone={t.failed ? 'go' : 'danger'} onClick={() => dpSystem.dispatch({ type: 'fail-thruster', id, failed: !t.failed })} testid={`az-${id}-fail`} />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1">
        <Btn label="OPEN DP SYSTEM" onClick={() => select('dp-console-001')} testid="az-open-dp" />
        <Btn label="OPEN POWER MANAGEMENT" onClick={() => select('pms-001')} testid="az-open-pms" />
      </div>
      <DataNote>Generic 1,800 kW azimuth thrusters, 250 kN each (provisional demonstration values). Steering and thrust are allocated by the DP.</DataNote>
    </HmiFrame>
  );
}
