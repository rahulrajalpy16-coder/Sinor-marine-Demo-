import { dpSystem } from './dpController';
import { bowThruster } from './controller';
import { powerSystem, windSystem } from './powerController';
import { posRefs } from './posrefsController';
import { hprDeployment } from './deploymentController';
import { onStationPosRefState } from './posrefs';
import { initialThrusterState } from './thruster';
import {
  applyStep,
  parseStore,
  resetAll,
  restoreSnapshot,
  snapshot,
  STORE_SCHEMA,
  TRAINING_SCENARIOS,
  validSnapshot,
} from './simControl';

/** Drive the controllers as the scene does, for `seconds` of frame time. */
const frames = (seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 30) {
    hprDeployment.tick(1 / 30);
    posRefs.tick(1 / 30);
    dpSystem.tick(1 / 30);
    bowThruster.tick((1 / 30) * dpSystem.timeScale);
  }
};

describe('simulator controls', () => {
  beforeEach(() => resetAll(true));

  it('Reset all recovers from any state: blackout, faults, frozen, stopped thruster, stowed references', () => {
    applyStep({ dp: [{ type: 'start' }, { type: 'fail-thruster', id: 'AZ2', failed: true }, { type: 'sensor-fault', id: 'GYRO1', fault: 'fail' }] });
    applyStep({ power: [{ type: 'arrangement', value: 'one-per-bus' }, { type: 'bus-fault', bus: 'MSB_A' }, { type: 'ups-fault', id: 'UPS_B', kind: 'inverter', on: true }] });
    applyStep({ wind: [{ type: 'sensor-fault', id: 'WS1', fault: 'frozen' }] });
    posRefs.dispatch({ type: 'reset' });
    frames(3);
    dpSystem.setFrozen(true);
    expect(powerSystem.getState().alarms.length).toBeGreaterThan(0);

    resetAll(true);
    const dp = dpSystem.getState();
    expect(dpSystem.frozen).toBe(false);
    expect(dp.status).toBe('stopped');
    expect(dp.thrusters.every((t) => !t.failed)).toBe(true);
    expect(dp.sensors.every((s) => s.fault === null)).toBe(true);
    expect(powerSystem.getState().alarms).toEqual([]);
    expect(powerSystem.getState().buses.MSB_A.live).toBe(true);
    expect(windSystem.getState().sensors.every((s) => s.fault === null)).toBe(true);
    expect(bowThruster.getState()).toEqual(initialThrusterState());
    expect(posRefs.getState().tautwire.phase).toBe(onStationPosRefState().tautwire.phase);
    expect(hprDeployment.getState().travel).toBeGreaterThan(0.9);
    // And the plant runs normally afterwards.
    frames(2);
    expect(powerSystem.getState().buses.MSB_B.live).toBe(true);
  });

  it('freeze holds every model; unfreeze continues', () => {
    applyStep({ dp: [{ type: 'start' }] });
    frames(1);
    dpSystem.setFrozen(true);
    const t = powerSystem.getState().time;
    frames(2);
    expect(powerSystem.getState().time).toBe(t);
    dpSystem.setFrozen(false);
    frames(1);
    expect(powerSystem.getState().time).toBeGreaterThan(t);
  });

  it('every training scenario sets up and applies its fault without an error', () => {
    for (const sc of TRAINING_SCENARIOS) {
      resetAll(true);
      applyStep(sc.setup);
      expect([powerSystem.lastError, windSystem.lastError, dpSystem.lastError]).toEqual([null, null, null]);
      frames(1);
      applyStep(sc.fault);
      expect([powerSystem.lastError, windSystem.lastError, dpSystem.lastError]).toEqual([null, null, null]);
      frames(1);
    }
  });

  it('a snapshot round-trips through JSON and restores the plant exactly', () => {
    applyStep({ power: [{ type: 'gen-trip', id: 'G3' }], dp: [{ type: 'start' }, { type: 'set-wind', speedKn: 33, fromDeg: 120 }] });
    frames(2);
    const snap = JSON.parse(JSON.stringify(snapshot()));
    expect(validSnapshot(snap)).toBe(true);
    resetAll(true);
    restoreSnapshot(snap);
    expect(powerSystem.getState().gens.find((g) => g.id === 'G3')!.state).toBe('tripped');
    expect(dpSystem.getState().wind).toEqual({ speedKn: 33, fromDeg: 120 });
    expect(dpSystem.getState().status).toBe('running');
  });
});

describe('saved scenario store', () => {
  const data = () => JSON.parse(JSON.stringify(snapshot()));

  it('reads an empty store', () => {
    expect(parseStore(null)).toEqual({ store: { schema: STORE_SCHEMA, items: [] }, dropped: 0, error: null });
  });

  it('migrates schema 1 (a bare array) to the current schema', () => {
    const v1 = JSON.stringify([{ name: 'Old one', savedAt: '2026-10-01T00:00:00Z', data: data() }]);
    const r = parseStore(v1);
    expect(r.error).toBeNull();
    expect(r.store.schema).toBe(STORE_SCHEMA);
    expect(r.store.items[0].name).toBe('Old one');
    expect(r.store.items[0].appVersion).toBe('0.x');
  });

  it('rejects damaged JSON, unknown layouts and newer schemas without loading anything', () => {
    expect(parseStore('{"schema":2,"items":[').error).toMatch(/damaged/);
    expect(parseStore('{"hello":1}').error).toMatch(/unknown layout/);
    expect(parseStore(JSON.stringify({ schema: 99, items: [] })).error).toMatch(/newer version/);
  });

  it('drops individual damaged entries and keeps the good ones', () => {
    const bad = { name: 'Broken', data: { dp: {}, power: null } };
    const r = parseStore(JSON.stringify({ schema: STORE_SCHEMA, items: [bad, { id: 'a', name: 'Good', savedAt: 'x', appVersion: '1.0.0', data: data() }] }));
    expect(r.dropped).toBe(1);
    expect(r.store.items.map((i) => i.name)).toEqual(['Good']);
    expect(r.error).toMatch(/1 damaged/);
  });

  it('refuses to restore a damaged snapshot', () => {
    expect(() => restoreSnapshot({} as never)).toThrow(/damaged/);
  });
});
