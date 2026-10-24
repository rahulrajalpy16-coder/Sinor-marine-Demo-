/**
 * The shared simulation core: one coupled, fixed-step update of the electrical plant, the wind and the DP vessel
 * model. Every screen (DP, PMS, UPS, wind, 3D) reads the states this produces; nothing else integrates time.
 *
 * Causal chain per step (dt = 0.05 s of simulated time):
 *   DP thrust demand (last step) → PMS load flow, phase-back, protection → per-thruster availability and thrust
 *   limit, UPS outputs → consumers powered (controllers, networks, stations, references, gyros, MRUs, wind sensors)
 *   → wind: physical gusts and sensor measurements → DP: voting, control, power-limited allocation, delivered
 *   thrust → vessel motion under thrust + wind + current.
 * The one-step lag between thrust demand and the PMS (50 ms) is far below the plant's time constants.
 */

import { applyDPCommand, applySupplies, initialDPState, stepDP, type DPCommand, type DPState, type RefId, type ThrusterId } from './dp';
import { applyPowerCommand, driveAvailable, initialPowerState, stepPower, type Arrangement, type PowerCommand, type PowerDemand, type PowerState } from './power';
import { applyWindCommand, initialWindState, stepWind, type WindCommand, type WindState } from './wind';
import { applyThrusterCommand, DEFAULT_THRUSTER_PARAMS, initialThrusterState, stepThruster, type ThrusterState } from './thruster';

export const CORE_STEP = 0.05;

export interface CoreState {
  dp: DPState;
  power: PowerState;
  wind: WindState;
}

export interface CoreExternal {
  /** BT1 is the separately simulated P2 thruster (Z-Thrust). */
  bt1: { inDp: boolean; running: boolean; forceN: number; shaftKW: number; cmdN: number };
  ready?: Partial<Record<RefId, boolean>>;
  sprintnavAided?: boolean;
}

export interface CoreStepOutput {
  core: CoreState;
  bt1CmdN: number;
  bt1Supply: { available: boolean; limit: number };
}

const DRIVES: ThrusterId[] = ['BT1', 'BT2', 'AZ1', 'AZ2'];

export function initialCore(opts: { dpClass?: 1 | 2 | 3; arrangement?: Arrangement; seed?: number } = {}): CoreState {
  return { dp: initialDPState(opts.dpClass ?? 2), power: initialPowerState(opts.dpClass ?? 2, opts.arrangement), wind: initialWindState(opts.seed) };
}

/** Advance the coupled core by one fixed step. Pure. */
export function coreStep(core: CoreState, dt: number, ext: CoreExternal): CoreStepOutput {
  const dp = core.dp;
  const running = dp.status === 'running';
  const demand: PowerDemand = { cmdN: {}, forceN: {}, running: {}, bt1ShaftKW: ext.bt1.shaftKW };
  for (const t of dp.thrusters) {
    if (t.id === 'BT1') {
      demand.cmdN.BT1 = Math.abs(ext.bt1.cmdN);
      demand.forceN.BT1 = Math.abs(ext.bt1.forceN);
      demand.running.BT1 = ext.bt1.running;
      continue;
    }
    demand.cmdN[t.id] = running && t.available ? Math.abs(t.cmdN) : 0;
    demand.forceN[t.id] = Math.abs(t.forceN);
    demand.running[t.id] = running && !t.failed;
  }
  const power = stepPower(core.power, dt, demand);
  const thrusterAvailable = Object.fromEntries(DRIVES.map((id) => [id, driveAvailable(power, id)])) as Record<ThrusterId, boolean>;
  const limitN = Object.fromEntries(DRIVES.map((id) => [id, thrusterAvailable[id] ? power.drives.find((d) => d.id === id)!.limitN : 0])) as Record<ThrusterId, number>;
  const pw = { thrusterAvailable, limitN, consumers: power.consumers };
  const wind = stepWind(core.wind, dt, {
    mean: dp.wind,
    psi: dp.eta[2],
    psiMeas: dp.psiMeas,
    nu: dp.nu,
    powered: { WS1: power.consumers.WS1, WS2: power.consumers.WS2 },
  });
  const windFF = { valid: wind.output.valid, relSpeedKn: wind.output.relSpeedKn, relFromDeg: wind.output.relFromDeg };
  let nextDp: DPState;
  let bt1CmdN = 0;
  if (running) {
    const out = stepDP(dp, dt, {
      bt1: { available: ext.bt1.inDp && ext.bt1.running && thrusterAvailable.BT1, forceN: ext.bt1.forceN },
      ready: ext.ready,
      sprintnavAided: ext.sprintnavAided,
      power: pw,
      windActual: wind.actual,
      windFF,
    });
    nextDp = out.state;
    bt1CmdN = out.bt1CmdN;
  } else {
    // Stopped or paused DP still shows live supply states and the wind.
    nextDp = { ...applySupplies(dp, pw), windActual: wind.actual, windFF };
  }
  const bt1Drive = power.drives.find((d) => d.id === 'BT1')!;
  const bt1Avail = bt1Drive.status === 'ready' && power.feeders.find((f) => f.id === 'BT1_DRV')!.energised;
  return {
    core: { dp: nextDp, power, wind },
    bt1CmdN,
    bt1Supply: { available: bt1Avail, limit: bt1Avail ? Math.min(1, (bt1Drive.allowedKW * 0.95) / DEFAULT_THRUSTER_PARAMS.ratedPowerKW) : 0 },
  };
}

// ------------------------------------------------------------------------------------- headless runner

export interface ScenarioEvent {
  t: number;
  dp?: DPCommand;
  power?: PowerCommand;
  wind?: WindCommand;
}

export interface ScenarioSample {
  t: number;
  north: number;
  east: number;
  headingDeg: number;
  posErr: number;
  genKW: number;
  loadKW: number;
  reserveKW: number;
  thrustKN: number;
  upsA: number;
  upsB: number;
  windKn: number;
  measWindKn: number;
  dpAlarms: number;
  powerAlarms: number;
}

export interface ScenarioResult {
  samples: ScenarioSample[];
  final: CoreState;
  bt1: ThrusterState;
}

export interface ScenarioOptions {
  seconds: number;
  seed?: number;
  dpClass?: 1 | 2 | 3;
  arrangement?: Arrangement;
  wind?: { speedKn: number; fromDeg: number };
  current?: { speedKn: number; toDeg: number };
  gustPct?: number;
  events?: ScenarioEvent[];
  sampleEvery?: number;
  /** Start on DP in auto position with every reference ready (the app's on-station start). */
  onStation?: boolean;
}

/**
 * Deterministic headless run of the whole core (no rendering): the same code the app steps, so results from the
 * online and offline builds can be compared sample by sample.
 */
export function runScenario(o: ScenarioOptions): ScenarioResult {
  let core = initialCore({ dpClass: o.dpClass, arrangement: o.arrangement, seed: o.seed });
  core.dp = { ...core.dp, seed: o.seed ?? core.dp.seed };
  if (o.wind) core.dp = applyDPCommand(core.dp, { type: 'set-wind', ...o.wind });
  if (o.current) core.dp = applyDPCommand(core.dp, { type: 'set-current', ...o.current });
  if (o.gustPct !== undefined) core.wind = applyWindCommand(core.wind, { type: 'set-gust', pct: o.gustPct });
  let bt = applyThrusterCommand(initialThrusterState(), { type: 'set-station', station: 'DP' });
  bt = applyThrusterCommand(bt, { type: 'start' });
  if (o.onStation !== false) {
    core.dp = applyDPCommand(core.dp, { type: 'start' });
    core.dp = applyDPCommand(core.dp, { type: 'set-mode', mode: 'AUTO_POSITION' });
  }
  const ready: Partial<Record<RefId, boolean>> = { HPR: true, RADASCAN: true, CYSCAN: true, TAUTWIRE: true, SPRINTNAV: true };
  const events = [...(o.events ?? [])].sort((a, b) => a.t - b.t);
  const samples: ScenarioSample[] = [];
  const every = o.sampleEvery ?? 1;
  const steps = Math.round(o.seconds / CORE_STEP);
  let ei = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i * CORE_STEP;
    while (ei < events.length && events[ei].t <= t + 1e-9) {
      const ev = events[ei++];
      try {
        if (ev.dp) core.dp = applyDPCommand(core.dp, ev.dp);
        if (ev.power) core.power = applyPowerCommand(core.power, ev.power);
        if (ev.wind) core.wind = applyWindCommand(core.wind, ev.wind);
      } catch {
        // A rejected command (interlock) is part of the scenario outcome; the run continues.
      }
    }
    if (i % Math.round(every / CORE_STEP) === 0) samples.push(sample(core, t, bt));
    if (i === steps) break;
    const out = coreStep(core, CORE_STEP, {
      bt1: { inDp: bt.station === 'DP', running: bt.status === 'running', forceN: bt.thrustKN * 1000, shaftKW: bt.powerKW, cmdN: Math.abs(core.dp.thrusters[0].cmdN) },
      ready,
      sprintnavAided: false,
    });
    core = out.core;
    bt = applyThrusterCommand(bt, { type: 'set-supply', available: out.bt1Supply.available, limit: out.bt1Supply.limit });
    if (bt.station === 'DP' && bt.status === 'stopped' && out.bt1Supply.available) bt = applyThrusterCommand(bt, { type: 'start' });
    if (bt.station === 'DP') {
      const f = out.bt1CmdN / (DEFAULT_THRUSTER_PARAMS.maxThrustKN * 1000);
      bt = { ...bt, command: Math.sign(f) * Math.min(1, Math.abs(f)) ** (2 / 3) };
    }
    bt = stepThruster(bt, CORE_STEP);
  }
  return { samples, final: core, bt1: bt };
}

function sample(core: CoreState, t: number, bt: ThrusterState): ScenarioSample {
  const { dp, power, wind } = core;
  return {
    t: Math.round(t * 1000) / 1000,
    north: dp.eta[0],
    east: dp.eta[1],
    headingDeg: (((dp.eta[2] * 180) / Math.PI) % 360 + 360) % 360,
    posErr: Math.hypot(dp.eta[0] - dp.setpoint[0], dp.eta[1] - dp.setpoint[1]),
    genKW: power.balance.genKW,
    loadKW: power.balance.loadKW,
    reserveKW: power.islands.reduce((a, i) => a + i.reserveKW, 0),
    thrustKN: (dp.thrusters.reduce((a, x) => a + (x.id === 'BT1' ? 0 : Math.abs(x.forceN)), 0) + Math.abs(bt.thrustKN * 1000)) / 1000,
    upsA: power.ups[0].soc,
    upsB: power.ups[1].soc,
    windKn: wind.actual.speedKn,
    measWindKn: wind.output.relSpeedKn,
    dpAlarms: dp.alarms.length,
    powerAlarms: power.alarms.length,
  };
}
