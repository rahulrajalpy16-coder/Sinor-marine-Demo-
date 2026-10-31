import { dpSystem } from './dpController';
import { bowThruster } from './controller';
import { posRefs } from './posrefsController';
import { hprDeployment } from './deploymentController';
import { powerSystem, windSystem } from './powerController';
import { initialDPState, type DPCommand, type DPState } from './dp';
import { initialPowerState, type PowerCommand, type PowerState } from './power';
import { initialWindState, type WindCommand, type WindState } from './wind';
import { initialThrusterState, type ThrusterState } from './thruster';
import { initialPosRefState, onStationPosRefState, type PosRefState } from './posrefs';
import { initialDeploymentState, onStationDeploymentState, type DeploymentState } from './deployment';
import { startOnStation } from './startState';

/**
 * Simulator-level controls shared by the control bar, the exhibition demo and the tests: reset everything, freeze,
 * speed, built-in training scenarios and saved snapshots in local storage (versioned, with migration and with
 * corrupt data rejected instead of loaded).
 */

export const APP_VERSION = '1.0.1';

/** Puts every model back to the start-up state (on station, DP2, plant normal) and the camera to the overview. */
export function resetAll(onStation = startOnStation()) {
  dpSystem.setFrozen(false);
  dpSystem.replace(initialDPState(2));
  powerSystem.replace(initialPowerState(2));
  windSystem.replace(initialWindState());
  bowThruster.replace(initialThrusterState());
  posRefs.replace(onStation ? onStationPosRefState() : initialPosRefState());
  hprDeployment.replace(onStation ? onStationDeploymentState() : initialDeploymentState());
}

export function setFrozen(v: boolean) {
  dpSystem.setFrozen(v);
}

export const SPEEDS = [1, 5, 10, 20] as const;
export function setSpeed(v: (typeof SPEEDS)[number]) {
  dpSystem.dispatch({ type: 'set-time-scale', value: v });
  posRefs.setTimeScale(v);
}

// ------------------------------------------------------------------------------------- built-in scenarios

type Step = { dp?: DPCommand[]; power?: PowerCommand[]; wind?: WindCommand[] };
export interface TrainingScenario {
  id: string;
  title: string;
  /** What the visitor should watch for. */
  watch: string;
  /** System to open when the scenario starts. */
  focus: string;
  setup: Step;
  /** Fault applied after `faultDelayMs` (so the visitor first sees the healthy state). */
  fault?: Step;
  faultDelayMs?: number;
}

const startDp: DPCommand[] = [{ type: 'start' }, { type: 'set-mode', mode: 'AUTO_POSITION' }];

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    id: 'gen-trip',
    title: 'Generator trip with two sets per side',
    watch: 'G1 trips. G2 picks up the load, the PMS starts the standby set and the DP keeps position.',
    focus: 'pms-001',
    setup: { power: [{ type: 'arrangement', value: 'two-per-bus' }], dp: [...startDp, { type: 'set-wind', speedKn: 25, fromDeg: 60 }] },
    fault: { power: [{ type: 'gen-trip', id: 'G1' }] },
    faultDelayMs: 6000,
  },
  {
    id: 'blackout',
    title: 'Section blackout and automatic recovery',
    watch: 'With one set per side, losing G1 blacks out section A. The PMS closes the standby set on the dead bus and restarts the drives one by one.',
    focus: 'pms-001',
    setup: { power: [{ type: 'arrangement', value: 'one-per-bus' }], dp: [...startDp, { type: 'set-wind', speedKn: 20, fromDeg: 45 }] },
    fault: { power: [{ type: 'gen-trip', id: 'G1' }] },
    faultDelayMs: 6000,
  },
  {
    id: 'bus-fault',
    title: 'Busbar fault on switchboard A (worst-case failure)',
    watch: 'Section A is lost with AZ1 and BT1. Section B and its thrusters carry on; the consequence check shows whether position can still be held.',
    focus: 'msb-001',
    setup: { dp: [...startDp, { type: 'set-wind', speedKn: 25, fromDeg: 90 }] },
    fault: { power: [{ type: 'bus-fault', bus: 'MSB_A' }] },
    faultDelayMs: 6000,
  },
  {
    id: 'ups-battery',
    title: 'DP UPS A on battery',
    watch: '440 V board A is lost. UPS A carries the A-side DP equipment from its battery with no break; the runtime starts counting down.',
    focus: 'ups-001',
    setup: { dp: startDp },
    fault: { power: [{ type: 'tie-trip', id: 'TR_A' }] },
    faultDelayMs: 5000,
  },
  {
    id: 'wind-sensors',
    title: 'Both wind sensors fail in a gusty wind',
    watch: 'The DP loses its wind feed-forward, but the real wind keeps pushing: the position error grows before the thrusters catch up.',
    focus: 'wind-001',
    setup: { dp: [...startDp, { type: 'set-wind', speedKn: 30, fromDeg: 90 }], wind: [{ type: 'set-gust', pct: 20 }] },
    fault: { wind: [{ type: 'sensor-fault', id: 'WS1', fault: 'fail' }, { type: 'sensor-fault', id: 'WS2', fault: 'fail' }] },
    faultDelayMs: 6000,
  },
  {
    id: 'gyro-drift',
    title: 'Slowly drifting gyrocompass',
    watch: 'Gyro 2 drifts slowly. Once it is more than 2° from the other two, the voting rejects it and the DP keeps the true heading.',
    focus: 'gyro-mru-001',
    setup: { dp: startDp },
    fault: { dp: [{ type: 'sensor-fault', id: 'GYRO2', fault: 'drift' }] },
    faultDelayMs: 4000,
  },
];

export function applyStep(step: Step | undefined) {
  if (!step) return;
  step.power?.forEach((c) => powerSystem.dispatch(c));
  step.wind?.forEach((c) => windSystem.dispatch(c));
  step.dp?.forEach((c) => dpSystem.dispatch(c));
}

let pendingFault: ReturnType<typeof setTimeout> | null = null;
/** Resets, sets the scenario up and schedules its fault. Returns a cancel function. */
export function runTrainingScenario(sc: TrainingScenario, onFault?: () => void) {
  if (pendingFault) clearTimeout(pendingFault);
  resetAll(true);
  applyStep(sc.setup);
  if (sc.fault) {
    pendingFault = setTimeout(() => {
      pendingFault = null;
      applyStep(sc.fault);
      onFault?.();
    }, sc.faultDelayMs ?? 5000);
  }
  return () => {
    if (pendingFault) clearTimeout(pendingFault);
    pendingFault = null;
  };
}

// ------------------------------------------------------------------------------------- saved snapshots

export const STORE_KEY = 'sinor.scenarios';
export const STORE_SCHEMA = 2;

export interface SnapshotData {
  dp: DPState;
  power: PowerState;
  wind: WindState;
  bt1: ThrusterState;
  posrefs: PosRefState;
  hpr: DeploymentState;
}
export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  appVersion: string;
  data: SnapshotData;
}
export interface ScenarioStore {
  schema: typeof STORE_SCHEMA;
  items: SavedScenario[];
}

export function snapshot(): SnapshotData {
  // Deep copies: the saved data must not change when the live state does.
  return JSON.parse(
    JSON.stringify({
      dp: dpSystem.getState(),
      power: powerSystem.getState(),
      wind: windSystem.getState(),
      bt1: bowThruster.getState(),
      posrefs: posRefs.getState(),
      hpr: hprDeployment.getState(),
    }),
  );
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Checks the parts every model needs; anything else missing is filled from a fresh state on load. */
export function validSnapshot(d: unknown): d is SnapshotData {
  if (!isObj(d)) return false;
  const { dp, power, wind, bt1, posrefs, hpr } = d as Record<string, unknown>;
  return (
    isObj(dp) && Array.isArray(dp.thrusters) && Array.isArray(dp.eta) && Array.isArray(dp.refs) &&
    isObj(power) && Array.isArray(power.gens) && Array.isArray(power.ups) && isObj(power.ties) && isObj(power.buses) &&
    isObj(wind) && Array.isArray(wind.sensors) && isObj(wind.actual) &&
    isObj(bt1) && typeof bt1.status === 'string' &&
    isObj(posrefs) && isObj(posrefs.tautwire) &&
    isObj(hpr) && typeof hpr.travel === 'number'
  );
}

/**
 * Reads the store, migrating older layouts. Schema 1 (a bare array of {name, savedAt, data}) is upgraded; unreadable
 * or invalid entries are dropped and reported, never loaded.
 */
export function parseStore(raw: string | null): { store: ScenarioStore; dropped: number; error: string | null } {
  const empty: ScenarioStore = { schema: STORE_SCHEMA, items: [] };
  if (!raw) return { store: empty, dropped: 0, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { store: empty, dropped: 0, error: 'Saved scenarios could not be read (damaged data) and were set aside.' };
  }
  let items: unknown[];
  if (Array.isArray(parsed)) items = parsed; // schema 1
  else if (isObj(parsed) && parsed.schema === STORE_SCHEMA && Array.isArray(parsed.items)) items = parsed.items;
  else if (isObj(parsed) && typeof parsed.schema === 'number' && parsed.schema > STORE_SCHEMA)
    return { store: empty, dropped: 0, error: 'Saved scenarios come from a newer version of the simulator and were not loaded.' };
  else return { store: empty, dropped: 0, error: 'Saved scenarios have an unknown layout and were set aside.' };
  const ok: SavedScenario[] = [];
  let dropped = 0;
  items.forEach((it, i) => {
    if (!isObj(it) || !validSnapshot(it.data)) {
      dropped++;
      return;
    }
    ok.push({
      id: typeof it.id === 'string' ? it.id : `migrated-${i}`,
      name: typeof it.name === 'string' && it.name.trim() ? it.name.slice(0, 60) : `Scenario ${i + 1}`,
      savedAt: typeof it.savedAt === 'string' ? it.savedAt : new Date(0).toISOString(),
      appVersion: typeof it.appVersion === 'string' ? it.appVersion : '0.x',
      data: it.data,
    });
  });
  return { store: { schema: STORE_SCHEMA, items: ok }, dropped, error: dropped ? `${dropped} damaged saved scenario${dropped > 1 ? 's were' : ' was'} skipped.` : null };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadStore() {
  const st = storage();
  let raw: string | null = null;
  try {
    raw = st?.getItem(STORE_KEY) ?? null;
  } catch {
    raw = null;
  }
  const res = parseStore(raw);
  // Keep a copy of unreadable data rather than losing it, and write back the migrated store.
  if (res.error && raw) {
    try {
      st?.setItem(`${STORE_KEY}.damaged`, raw);
    } catch {
      /* storage full or blocked: nothing more to do */
    }
  }
  if (raw && (res.error || !raw.includes(`"schema":${STORE_SCHEMA}`))) writeStore(res.store);
  return res;
}

export function writeStore(store: ScenarioStore): boolean {
  try {
    storage()?.setItem(STORE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function saveScenario(name: string): { ok: boolean; error?: string } {
  const { store } = loadStore();
  const item: SavedScenario = { id: `s${Date.now().toString(36)}`, name: name.trim().slice(0, 60) || 'Untitled', savedAt: new Date().toISOString(), appVersion: APP_VERSION, data: snapshot() };
  store.items = [item, ...store.items].slice(0, 20);
  return writeStore(store) ? { ok: true } : { ok: false, error: 'This device would not save (storage full or blocked).' };
}

export function deleteScenario(id: string) {
  const { store } = loadStore();
  store.items = store.items.filter((x) => x.id !== id);
  writeStore(store);
}

/** Restores a snapshot; fields added in later versions take their fresh defaults. */
export function restoreSnapshot(d: SnapshotData) {
  if (!validSnapshot(d)) throw new Error('This saved scenario is damaged and cannot be loaded.');
  dpSystem.setFrozen(false);
  powerSystem.replace({ ...initialPowerState(2), ...d.power });
  windSystem.replace({ ...initialWindState(), ...d.wind });
  bowThruster.replace({ ...initialThrusterState(), ...d.bt1 });
  posRefs.replace({ ...onStationPosRefState(), ...d.posrefs });
  hprDeployment.replace({ ...onStationDeploymentState(), ...d.hpr });
  dpSystem.replace({ ...initialDPState(d.dp.dpClass ?? 2), ...d.dp });
}
