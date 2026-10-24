/**
 * Vessel electrical power plant and Power Management System (PMS): an engineering demonstration model.
 *
 * Fidelity: QUASI-STEADY. Each fixed step solves which bus sections are connected and energised (explicit
 * topology through breakers), shares the connected load between the online generators, and applies the PMS
 * logic (thruster phase-back, load shedding, standby start, blackout recovery) with configurable delays and
 * hysteresis. Frequency and voltage follow a first-order response to load steps; there is no transient
 * electrical (fault current, excitation, governor) model. Units: kW, kVAr, kVA, V, Hz, A, seconds.
 * Sign convention: generator output and consumer demand are positive; storage discharge is positive.
 *
 * ARRANGEMENT: a LABELLED DEMONSTRATION CONFIGURATION for a generic 78 m DP2 diesel-electric vessel. Ratings,
 * quantities and the bus philosophy were not supplied for the vessel and are provisional (see
 * documentation/ENGINEERING_REGISTER.md). Everything below lives in POWER_CONFIG so it can be replaced by
 * vessel data without touching the logic.
 */

import { DEFAULT_THRUSTER_PARAMS, maxPitchForLimit, powerFrom } from './thruster';

export type BusId = 'MSB_A' | 'MSB_B' | 'DB_A' | 'DB_B' | 'ESB';
export type GenId = 'G1' | 'G2' | 'G3' | 'G4' | 'EG';
export type UpsId = 'UPS_A' | 'UPS_B' | 'UPS_C';
export type DriveId = 'BT1' | 'BT2' | 'AZ1' | 'AZ2';
/** Breakers between bus sections (generator breakers live on the generators, feeder breakers on feeders). */
export type TieId = 'MSB_TIE' | 'TR_A' | 'TR_B' | 'DB_TIE' | 'ESB_FEED';
export type ConsumerId =
  | 'DP_CTRL_A'
  | 'DP_CTRL_B'
  | 'DP_CTRL_C'
  | 'DP_OS1'
  | 'DP_OS2'
  | 'DP_OS3'
  | 'DP_BACKUP_CTRL'
  | 'NET_A'
  | 'NET_B'
  | 'GNSS1'
  | 'GNSS2'
  | 'HPR'
  | 'RADASCAN'
  | 'CYSCAN'
  | 'TAUTWIRE'
  | 'SPRINTNAV'
  | 'GYRO1'
  | 'GYRO2'
  | 'GYRO3'
  | 'MRU1'
  | 'MRU2'
  | 'WS1'
  | 'WS2'
  | 'IJS'
  | 'AZ1_CTRL'
  | 'BT1_CTRL'
  | 'AZ2_CTRL'
  | 'BT2_CTRL';

export interface GenCfg {
  id: GenId;
  bus: BusId;
  ratedKW: number;
  ratedKVA: number;
  voltage: number;
  /** Feeder whose loss stops the engine's cooling/fuel pumps (null: self-contained, e.g. radiator-cooled EG). */
  auxFeeder: string | null;
  label: string;
}

export interface FeederCfg {
  id: string;
  label: string;
  bus: BusId;
  kind: 'thruster' | 'aux' | 'hotel' | 'deck' | 'essential';
  /** Running demand, kW (thruster drives: computed from thrust). */
  kw: number;
  pf: number;
  /** Load shedding: 0 never shed, 3 shed first. */
  shed: 0 | 1 | 2 | 3;
  drive?: DriveId;
}

export interface DriveCfg {
  id: DriveId;
  feeder: string;
  aux: string;
  ctrl: ConsumerId;
  ratedKW: number;
  maxThrustN: number;
  type: 'azimuth' | 'tunnel-cpp';
  group: 'A' | 'B';
}

export interface UpsCfg {
  id: UpsId;
  label: string;
  mainBus: BusId;
  emergBus: BusId;
  ratedKVA: number;
  pf: number;
  inverterEff: number;
  rectifierEff: number;
  chargerMaxKW: number;
  battery: { cells: number; ah: number; cellNominalV: number; internalOhm: number };
  outV: number;
  outHz: number;
}

export interface ConsumerCfg {
  label: string;
  supplies: UpsId[];
  kw: number;
  group: 'A' | 'B' | 'A+B' | 'C';
}

export interface PowerConfig {
  nominalV: number;
  nominalHz: number;
  distV: number;
  generators: GenCfg[];
  feeders: FeederCfg[];
  drives: DriveCfg[];
  ups: UpsCfg[];
  consumers: Record<ConsumerId, ConsumerCfg>;
  /** PMS settings (all configurable). */
  pms: {
    startLoadPct: number;
    startDelayS: number;
    stopLoadPct: number;
    stopDelayS: number;
    /** A generator is only stopped if the remaining ones would stay below this load. */
    stopRemainingMaxPct: number;
    phaseBackPct: number;
    shedLoadPct: number;
    shedDelayS: number;
    reconnectMarginPct: number;
    reconnectDelayS: number;
    overloadPct: number;
    overloadTripS: number;
    crankAndRunUpS: number;
    syncS: number;
    loadRampS: number;
    unloadS: number;
    cooldownS: number;
    deadBusDetectS: number;
    driveRestartS: number;
    driveRestartSpacingS: number;
    genAuxRideThroughS: number;
    egStartDelayS: number;
    egRunUpS: number;
    esbReturnDelayS: number;
    transformerLossPct: number;
  };
  /** UPS thresholds. */
  upsAlarm: { lowSocPct: number; criticalSocPct: number; overloadPct: number };
  /** True values in this file are provisional demonstration values. */
  provisional: true;
}

const C = (label: string, supplies: UpsId[], kw: number, group: ConsumerCfg['group']): ConsumerCfg => ({ label, supplies, kw, group });

export const POWER_CONFIG: PowerConfig = {
  nominalV: 690,
  nominalHz: 60,
  distV: 440,
  generators: [
    { id: 'G1', bus: 'MSB_A', ratedKW: 1700, ratedKVA: 2125, voltage: 690, auxFeeder: 'G12_AUX', label: 'Main generator 1' },
    { id: 'G2', bus: 'MSB_A', ratedKW: 1700, ratedKVA: 2125, voltage: 690, auxFeeder: 'G12_AUX', label: 'Main generator 2' },
    { id: 'G3', bus: 'MSB_B', ratedKW: 1700, ratedKVA: 2125, voltage: 690, auxFeeder: 'G34_AUX', label: 'Main generator 3' },
    { id: 'G4', bus: 'MSB_B', ratedKW: 1700, ratedKVA: 2125, voltage: 690, auxFeeder: 'G34_AUX', label: 'Main generator 4' },
    { id: 'EG', bus: 'ESB', ratedKW: 250, ratedKVA: 312, voltage: 440, auxFeeder: null, label: 'Emergency generator' },
  ],
  feeders: [
    { id: 'AZ1_DRV', label: 'AZ1 azimuth drive', bus: 'MSB_A', kind: 'thruster', kw: 0, pf: 0.95, shed: 0, drive: 'AZ1' },
    { id: 'BT1_DRV', label: 'BT1 bow thruster motor', bus: 'MSB_A', kind: 'thruster', kw: 0, pf: 0.86, shed: 0, drive: 'BT1' },
    { id: 'AZ2_DRV', label: 'AZ2 azimuth drive', bus: 'MSB_B', kind: 'thruster', kw: 0, pf: 0.95, shed: 0, drive: 'AZ2' },
    { id: 'BT2_DRV', label: 'BT2 bow thruster motor', bus: 'MSB_B', kind: 'thruster', kw: 0, pf: 0.86, shed: 0, drive: 'BT2' },
    { id: 'AZ1_AUX', label: 'AZ1 steering pumps + cooling', bus: 'DB_A', kind: 'aux', kw: 35, pf: 0.85, shed: 0 },
    { id: 'BT1_AUX', label: 'BT1 cooling + lube', bus: 'DB_A', kind: 'aux', kw: 8, pf: 0.85, shed: 0 },
    { id: 'G12_AUX', label: 'G1/G2 cooling + fuel pumps', bus: 'DB_A', kind: 'aux', kw: 30, pf: 0.85, shed: 0 },
    { id: 'ER_VENT_A', label: 'Engine room fans A', bus: 'DB_A', kind: 'aux', kw: 45, pf: 0.85, shed: 1 },
    { id: 'HOTEL_A', label: 'Accommodation HVAC + galley', bus: 'DB_A', kind: 'hotel', kw: 190, pf: 0.85, shed: 3 },
    { id: 'CRANE', label: 'Knuckle-boom crane', bus: 'DB_A', kind: 'deck', kw: 120, pf: 0.8, shed: 2 },
    { id: 'AZ2_AUX', label: 'AZ2 steering pumps + cooling', bus: 'DB_B', kind: 'aux', kw: 35, pf: 0.85, shed: 0 },
    { id: 'BT2_AUX', label: 'BT2 cooling + lube', bus: 'DB_B', kind: 'aux', kw: 8, pf: 0.85, shed: 0 },
    { id: 'G34_AUX', label: 'G3/G4 cooling + fuel pumps', bus: 'DB_B', kind: 'aux', kw: 30, pf: 0.85, shed: 0 },
    { id: 'ER_VENT_B', label: 'Engine room fans B', bus: 'DB_B', kind: 'aux', kw: 45, pf: 0.85, shed: 1 },
    { id: 'HOTEL_B', label: 'Workshops, laundry, HVAC', bus: 'DB_B', kind: 'hotel', kw: 150, pf: 0.85, shed: 3 },
    { id: 'TW_WINCH', label: 'Taut wire winch', bus: 'DB_B', kind: 'deck', kw: 0.8, pf: 0.8, shed: 1 },
    { id: 'TUGGER', label: 'Tugger winches', bus: 'DB_B', kind: 'deck', kw: 60, pf: 0.8, shed: 2 },
    { id: 'EM_LIGHT', label: 'Emergency lighting', bus: 'ESB', kind: 'essential', kw: 18, pf: 0.95, shed: 0 },
    { id: 'NAV_COMMS', label: 'Navigation lights, GMDSS, fire detection', bus: 'ESB', kind: 'essential', kw: 12, pf: 0.9, shed: 0 },
    { id: 'EM_FIRE_PUMP', label: 'Emergency fire pump (standby)', bus: 'ESB', kind: 'essential', kw: 0, pf: 0.85, shed: 0 },
  ],
  drives: [
    { id: 'AZ1', feeder: 'AZ1_DRV', aux: 'AZ1_AUX', ctrl: 'AZ1_CTRL', ratedKW: 1800, maxThrustN: 250e3, type: 'azimuth', group: 'A' },
    { id: 'BT1', feeder: 'BT1_DRV', aux: 'BT1_AUX', ctrl: 'BT1_CTRL', ratedKW: 800, maxThrustN: 105e3, type: 'tunnel-cpp', group: 'A' },
    { id: 'AZ2', feeder: 'AZ2_DRV', aux: 'AZ2_AUX', ctrl: 'AZ2_CTRL', ratedKW: 1800, maxThrustN: 250e3, type: 'azimuth', group: 'B' },
    { id: 'BT2', feeder: 'BT2_DRV', aux: 'BT2_AUX', ctrl: 'BT2_CTRL', ratedKW: 800, maxThrustN: 105e3, type: 'tunnel-cpp', group: 'B' },
  ],
  ups: [
    {
      id: 'UPS_A',
      label: 'DP UPS A',
      mainBus: 'DB_A',
      emergBus: 'ESB',
      ratedKVA: 5,
      pf: 0.8,
      inverterEff: 0.93,
      rectifierEff: 0.95,
      chargerMaxKW: 1.2,
      battery: { cells: 108, ah: 12, cellNominalV: 2.0, internalOhm: 0.004 },
      outV: 230,
      outHz: 60,
    },
    {
      id: 'UPS_B',
      label: 'DP UPS B',
      mainBus: 'DB_B',
      emergBus: 'ESB',
      ratedKVA: 5,
      pf: 0.8,
      inverterEff: 0.93,
      rectifierEff: 0.95,
      chargerMaxKW: 1.2,
      battery: { cells: 108, ah: 12, cellNominalV: 2.0, internalOhm: 0.004 },
      outV: 230,
      outHz: 60,
    },
    {
      id: 'UPS_C',
      label: 'Backup DP UPS C (A60 room)',
      mainBus: 'ESB',
      emergBus: 'ESB',
      ratedKVA: 3,
      pf: 0.8,
      inverterEff: 0.92,
      rectifierEff: 0.95,
      chargerMaxKW: 0.8,
      battery: { cells: 108, ah: 9, cellNominalV: 2.0, internalOhm: 0.005 },
      outV: 230,
      outHz: 60,
    },
  ],
  consumers: {
    DP_CTRL_A: C('DP controller A', ['UPS_A'], 0.25, 'A'),
    DP_CTRL_B: C('DP controller B', ['UPS_B'], 0.25, 'B'),
    DP_CTRL_C: C('DP controller C (dual-fed)', ['UPS_A', 'UPS_B'], 0.25, 'A+B'),
    DP_OS1: C('DP operator station 1', ['UPS_A'], 0.35, 'A'),
    DP_OS2: C('DP operator station 2', ['UPS_B'], 0.35, 'B'),
    DP_OS3: C('Backup DP operator station', ['UPS_C'], 0.3, 'C'),
    DP_BACKUP_CTRL: C('Backup DP controller', ['UPS_C'], 0.2, 'C'),
    NET_A: C('DP network A switches', ['UPS_A'], 0.12, 'A'),
    NET_B: C('DP network B switches', ['UPS_B'], 0.12, 'B'),
    GNSS1: C('DGPS 1 (Seastar 9410-AUT)', ['UPS_A'], 0.03, 'A'),
    GNSS2: C('DGPS 2 (Seastar 9410-AUT)', ['UPS_B'], 0.03, 'B'),
    HPR: C('HPR topside + HPT 5000', ['UPS_A'], 0.25, 'A'),
    RADASCAN: C('RadaScan View', ['UPS_B'], 0.12, 'B'),
    CYSCAN: C('CyScan AS', ['UPS_A'], 0.1, 'A'),
    TAUTWIRE: C('Taut wire sensor + control', ['UPS_B'], 0.05, 'B'),
    SPRINTNAV: C('SPRINT-Nav DP', ['UPS_B'], 0.03, 'B'),
    GYRO1: C('Gyrocompass 1', ['UPS_A'], 0.06, 'A'),
    GYRO2: C('Gyrocompass 2', ['UPS_B'], 0.06, 'B'),
    GYRO3: C('Gyrocompass 3 (dual-fed)', ['UPS_A', 'UPS_B'], 0.06, 'A+B'),
    MRU1: C('Motion reference unit 1', ['UPS_A'], 0.02, 'A'),
    MRU2: C('Motion reference unit 2', ['UPS_B'], 0.02, 'B'),
    WS1: C('Wind sensor 1 (port mast arm)', ['UPS_A'], 0.01, 'A'),
    WS2: C('Wind sensor 2 (stbd mast arm)', ['UPS_B'], 0.01, 'B'),
    IJS: C('Independent joystick', ['UPS_B'], 0.08, 'B'),
    AZ1_CTRL: C('AZ1 thruster control', ['UPS_A'], 0.15, 'A'),
    BT1_CTRL: C('BT1 Z-Thrust control', ['UPS_A'], 0.1, 'A'),
    AZ2_CTRL: C('AZ2 thruster control', ['UPS_B'], 0.15, 'B'),
    BT2_CTRL: C('BT2 thruster control', ['UPS_B'], 0.1, 'B'),
  },
  pms: {
    startLoadPct: 85,
    startDelayS: 10,
    stopLoadPct: 35,
    stopDelayS: 120,
    stopRemainingMaxPct: 70,
    phaseBackPct: 98,
    shedLoadPct: 100,
    shedDelayS: 1,
    reconnectMarginPct: 20,
    reconnectDelayS: 20,
    overloadPct: 105,
    overloadTripS: 5,
    crankAndRunUpS: 8,
    syncS: 5,
    loadRampS: 10,
    unloadS: 10,
    cooldownS: 30,
    deadBusDetectS: 1,
    driveRestartS: 10,
    driveRestartSpacingS: 4,
    genAuxRideThroughS: 60,
    egStartDelayS: 1,
    egRunUpS: 10,
    esbReturnDelayS: 20,
    transformerLossPct: 1.5,
  },
  upsAlarm: { lowSocPct: 30, criticalSocPct: 10, overloadPct: 110 },
  provisional: true,
};

export const TIE_LABEL: Record<TieId, string> = {
  MSB_TIE: 'Main bus tie',
  TR_A: 'Transformer A (690/440 V)',
  TR_B: 'Transformer B (690/440 V)',
  DB_TIE: '440 V interconnector',
  ESB_FEED: 'Emergency switchboard feeder',
};
const TIE_ENDS: Record<TieId, [BusId, BusId]> = {
  MSB_TIE: ['MSB_A', 'MSB_B'],
  TR_A: ['MSB_A', 'DB_A'],
  TR_B: ['MSB_B', 'DB_B'],
  DB_TIE: ['DB_A', 'DB_B'],
  ESB_FEED: ['DB_A', 'ESB'],
};
export const BUSES: BusId[] = ['MSB_A', 'MSB_B', 'DB_A', 'DB_B', 'ESB'];
export const BUS_LABEL: Record<BusId, string> = {
  MSB_A: 'Main switchboard A (690 V)',
  MSB_B: 'Main switchboard B (690 V)',
  DB_A: '440 V board A',
  DB_B: '440 V board B',
  ESB: 'Emergency switchboard (440 V)',
};

// ---------------------------------------------------------------------------------------------- state

export type GenState = 'stopped' | 'starting' | 'running' | 'synchronising' | 'online' | 'unloading' | 'cooldown' | 'tripped';

export interface Generator {
  id: GenId;
  state: GenState;
  mode: 'AUTO' | 'MANUAL';
  breaker: boolean;
  timer: number;
  /** Load-sharing weight 0…1 (ramps in after connection, out while unloading). */
  share: number;
  kw: number;
  kvar: number;
  hz: number;
  v: number;
  runningHours: number;
  tripReason: string | null;
  auxLostS: number;
  /** Order in which the PMS starts standby sets (lower first). */
  priority: number;
  startedAt: number;
  /** Close onto the bus once synchronised / ready (set by SYNC & CLOSE or by the PMS). */
  closeRequest: boolean;
}

export interface Feeder {
  id: string;
  closed: boolean;
  /** Opened by the PMS (load shedding or blackout), reconnected automatically. */
  shed: boolean;
  fault: boolean;
  tripped: boolean;
  /** Present consumption, kW (0 when de-energised). */
  kw: number;
  energised: boolean;
}

export type DriveStatus = 'ready' | 'no-supply' | 'restarting' | 'tripped';
export interface Drive {
  id: DriveId;
  status: DriveStatus;
  timer: number;
  /** Electrical power the DP asks for (from the commanded thrust), kW. */
  demandKW: number;
  /** Power the PMS allows (phase-back), kW. */
  allowedKW: number;
  /** Power drawn for the delivered thrust, kW. */
  kw: number;
  /** Largest thrust the drive can give within the allowed power, N. */
  limitN: number;
}

export type UpsMode = 'normal' | 'battery' | 'static-bypass' | 'maintenance-bypass' | 'off';
export interface Ups {
  id: UpsId;
  installed: boolean;
  selector: 'MAIN' | 'EMERG';
  maintBypass: boolean;
  rectifierFault: boolean;
  inverterFault: boolean;
  batteryFault: boolean;
  /** Battery state of health used for capacity, 0.1…1 (demonstration assumption). */
  soh: number;
  soc: number;
  mode: UpsMode;
  inputLive: boolean;
  bypassLive: boolean;
  outputLive: boolean;
  loadKW: number;
  inputKW: number;
  battKW: number;
  battV: number;
  battA: number;
  inV: number;
  inHz: number;
  outV: number;
  outHz: number;
  runtimeMin: number | null;
  overloadS: number;
}

export interface PowerEvent {
  t: number;
  sev: 'alarm' | 'warning' | 'info';
  src: string;
  text: string;
}

export interface BusState {
  id: BusId;
  live: boolean;
  fault: boolean;
  hz: number;
  v: number;
  island: number;
}

export interface Island {
  id: number;
  buses: BusId[];
  gens: GenId[];
  capacityKW: number;
  loadKW: number;
  loadPct: number;
  reserveKW: number;
  hz: number;
  v: number;
  pf: number;
}

export interface TrendPoint {
  t: number;
  kwA: number;
  kwB: number;
  hzA: number;
  hzB: number;
  reserveKW: number;
  upsA: number;
  upsB: number;
  thrKW: number;
}

export type RecoveryStage = 'normal' | 'blackout' | 'starting' | 'closing' | 'restoring';

export interface PowerState {
  time: number;
  pmsAuto: boolean;
  phaseBack: boolean;
  /** Minimum generators kept online per main section (DP operating mode): the PMS never stops below it. */
  minOnline: Record<'A' | 'B', number>;
  dpClass: 1 | 2 | 3;
  gens: Generator[];
  ties: Record<TieId, { closed: boolean; tripped: boolean; syncing: number }>;
  buses: Record<BusId, BusState>;
  feeders: Feeder[];
  drives: Drive[];
  ups: Ups[];
  consumers: Record<ConsumerId, boolean>;
  islands: Island[];
  recovery: Record<'A' | 'B', { stage: RecoveryStage; timer: number; since: number }>;
  timers: { highLoad: Record<string, number>; lowLoad: Record<string, number>; overload: Record<string, number>; reconnect: number; esbDead: number; esbReturn: number; restartSpacing: number };
  /** Energy bookkeeping for the reconciliation check (cumulative, kWh). */
  energy: { genKWh: number; loadKWh: number; lossKWh: number; battOutKWh: number; battInKWh: number };
  balance: { genKW: number; loadKW: number; lossKW: number; unmetKW: number };
  alarms: string[];
  acknowledged: string[];
  events: PowerEvent[];
  trend: TrendPoint[];
  lastError: string | null;
}

export const MAX_EVENTS = 400;
export const TREND_POINTS = 600;

const genCfg = (id: GenId, cfg = POWER_CONFIG) => cfg.generators.find((g) => g.id === id)!;
const feederCfg = (id: string, cfg = POWER_CONFIG) => cfg.feeders.find((f) => f.id === id)!;
export const upsCfg = (id: UpsId, cfg = POWER_CONFIG) => cfg.ups.find((u) => u.id === id)!;

/** Usable battery energy, kWh (to the end-of-discharge voltage), scaled by state of health. */
export function batteryKWh(u: Pick<Ups, 'id' | 'soh'>, cfg = POWER_CONFIG) {
  const b = upsCfg(u.id, cfg).battery;
  return (b.cells * b.cellNominalV * b.ah * u.soh) / 1000;
}

export type Arrangement = 'one-per-bus' | 'two-per-bus' | 'closed-bus';

/** Known starting arrangement (the vessel on DP at sea). */
export function initialPowerState(dpClass: 1 | 2 | 3 = 2, arrangement: Arrangement = 'one-per-bus', cfg = POWER_CONFIG): PowerState {
  const online: GenId[] = arrangement === 'one-per-bus' ? ['G1', 'G3'] : arrangement === 'two-per-bus' ? ['G1', 'G2', 'G3', 'G4'] : ['G1', 'G2', 'G3'];
  const gens: Generator[] = cfg.generators.map((g, i) => {
    const on = online.includes(g.id);
    return {
      id: g.id,
      state: on ? 'online' : 'stopped',
      mode: 'AUTO',
      breaker: on,
      timer: 0,
      share: on ? 1 : 0,
      kw: 0,
      kvar: 0,
      hz: on ? cfg.nominalHz : 0,
      v: on ? g.voltage : 0,
      runningHours: [12450, 11980, 12310, 12105, 410][i],
      tripReason: null,
      auxLostS: 0,
      priority: i,
      startedAt: 0,
      closeRequest: false,
    };
  });
  const ties = {
    MSB_TIE: { closed: arrangement === 'closed-bus', tripped: false, syncing: 0 },
    TR_A: { closed: true, tripped: false, syncing: 0 },
    TR_B: { closed: true, tripped: false, syncing: 0 },
    DB_TIE: { closed: false, tripped: false, syncing: 0 },
    ESB_FEED: { closed: true, tripped: false, syncing: 0 },
  };
  const s: PowerState = {
    time: 0,
    pmsAuto: true,
    phaseBack: true,
    minOnline: arrangement === 'two-per-bus' ? { A: 2, B: 2 } : arrangement === 'closed-bus' ? { A: 2, B: 1 } : { A: 1, B: 1 },
    dpClass,
    gens,
    ties,
    buses: Object.fromEntries(BUSES.map((b) => [b, { id: b, live: false, fault: false, hz: 0, v: 0, island: -1 }])) as Record<BusId, BusState>,
    feeders: cfg.feeders.map((f) => ({ id: f.id, closed: true, shed: false, fault: false, tripped: false, kw: 0, energised: false })),
    drives: cfg.drives.map((d) => ({ id: d.id, status: 'ready', timer: 0, demandKW: 0, allowedKW: d.ratedKW, kw: 0, limitN: d.maxThrustN })),
    ups: cfg.ups.map((u) => ({
      id: u.id,
      installed: u.id !== 'UPS_C' || dpClass === 3,
      selector: 'MAIN',
      maintBypass: false,
      rectifierFault: false,
      inverterFault: false,
      batteryFault: false,
      soh: 1,
      soc: 1,
      mode: 'normal',
      inputLive: true,
      bypassLive: true,
      outputLive: true,
      loadKW: 0,
      inputKW: 0,
      battKW: 0,
      battV: 0,
      battA: 0,
      inV: 0,
      inHz: 0,
      outV: u.outV,
      outHz: u.outHz,
      runtimeMin: null,
      overloadS: 0,
    })),
    consumers: Object.fromEntries(Object.keys(cfg.consumers).map((k) => [k, true])) as Record<ConsumerId, boolean>,
    islands: [],
    recovery: { A: { stage: 'normal', timer: 0, since: 0 }, B: { stage: 'normal', timer: 0, since: 0 } },
    timers: { highLoad: {}, lowLoad: {}, overload: {}, reconnect: 0, esbDead: 0, esbReturn: 0, restartSpacing: 0 },
    energy: { genKWh: 0, loadKWh: 0, lossKWh: 0, battOutKWh: 0, battInKWh: 0 },
    balance: { genKW: 0, loadKW: 0, lossKW: 0, unmetKW: 0 },
    alarms: [],
    acknowledged: [],
    events: [],
    trend: [],
    lastError: null,
  };
  // Settle the topology and UPS outputs so the first frame is consistent.
  return solve(s, 0, NO_DEMAND, cfg);
}

// ---------------------------------------------------------------------------------- thruster power

/**
 * Electrical power a thruster draws for a delivered thrust, kW.
 * Azimuth (variable-speed FPP): P = Prated·(T/Tmax)^1.5 / ηdrive + idle (1.5 % rated).
 * Tunnel CPP at constant speed: the P2 bow thruster relation from thruster.ts, P = Prated·(P0 + (1−P0)|p|^2.5),
 * with pitch p from T = Tmax·|p|^1.5, divided by the motor efficiency.
 */
export function thrusterKW(d: DriveCfg, thrustN: number): number {
  const f = Math.min(1, Math.abs(thrustN) / d.maxThrustN);
  if (d.type === 'azimuth') return (d.ratedKW * f ** 1.5) / 0.96 + 0.015 * d.ratedKW;
  const pitch = f ** (2 / 3);
  const p = DEFAULT_THRUSTER_PARAMS;
  return (powerFrom(pitch, p.ratedRpm, { ...p, ratedPowerKW: d.ratedKW }) / 0.95);
}

/** Largest thrust the thruster gives within an electrical power allowance (inverse of thrusterKW), N. */
export function thrustForKW(d: DriveCfg, kw: number): number {
  if (d.type === 'azimuth') {
    const shaft = Math.max(0, (kw - 0.015 * d.ratedKW) * 0.96);
    return d.maxThrustN * Math.min(1, shaft / d.ratedKW) ** (2 / 3);
  }
  const limit = (kw * 0.95) / d.ratedKW;
  const pitch = maxPitchForLimit(Math.min(1, limit), { ...DEFAULT_THRUSTER_PARAMS, ratedPowerKW: d.ratedKW });
  return d.maxThrustN * pitch ** 1.5;
}

/** Thrust demand and delivered thrust per drive, N (from the DP model). */
export interface PowerDemand {
  /** Thrust the DP commands (magnitude), N. */
  cmdN: Partial<Record<DriveId, number>>;
  /** Thrust delivered last step (magnitude), N. */
  forceN: Partial<Record<DriveId, number>>;
  /** Thruster running (DP or lever command) — idle losses apply. */
  running: Partial<Record<DriveId, boolean>>;
  /** BT1 is the separately modelled P2 thruster: its own shaft power, kW (overrides the formula). */
  bt1ShaftKW?: number;
}
export const NO_DEMAND: PowerDemand = { cmdN: {}, forceN: {}, running: {} };

// ------------------------------------------------------------------------------------------ solving

class UF {
  p = new Map<BusId, BusId>();
  find(a: BusId): BusId {
    const q = this.p.get(a) ?? a;
    if (q === a) return a;
    const r = this.find(q);
    this.p.set(a, r);
    return r;
  }
  union(a: BusId, b: BusId) {
    this.p.set(this.find(a), this.find(b));
  }
}

/** Group bus sections connected through closed, healthy breakers. */
export function islandsOf(s: Pick<PowerState, 'ties' | 'buses'>): BusId[][] {
  const uf = new UF();
  (Object.keys(s.ties) as TieId[]).forEach((t) => {
    const tie = s.ties[t];
    const [a, b] = TIE_ENDS[t];
    if (tie.closed && !tie.tripped && !s.buses[a].fault && !s.buses[b].fault) uf.union(a, b);
  });
  const groups = new Map<BusId, BusId[]>();
  BUSES.forEach((b) => {
    const r = uf.find(b);
    groups.set(r, [...(groups.get(r) ?? []), b]);
  });
  return [...groups.values()];
}

function pushEvent(s: PowerState, sev: PowerEvent['sev'], src: string, text: string) {
  s.events = [...s.events.slice(-(MAX_EVENTS - 1)), { t: s.time, sev, src, text }];
}

function setAlarm(s: PowerState, code: string, on: boolean, text?: string) {
  const has = s.alarms.includes(code);
  if (on && !has) {
    s.alarms = [...s.alarms, code];
    pushEvent(s, ALARM_SEVERITY(code), code.split(':')[0], text ?? alarmText(code));
  }
  if (!on && has) {
    s.alarms = s.alarms.filter((a) => a !== code);
    s.acknowledged = s.acknowledged.filter((a) => a !== code);
    pushEvent(s, 'info', code.split(':')[0], `Cleared: ${text ?? alarmText(code)}`);
  }
}

const ALARM_SEVERITY = (code: string): PowerEvent['sev'] =>
  /^(BLACKOUT|GEN_TRIP|BUS_FAULT|UPS_OFF|UPS_CRIT|OVERLOAD|FEEDER_TRIP|DRIVE_TRIP|AUX_LOST|TR_TRIP)/.test(code) ? 'alarm' : 'warning';

/** Human-readable alarm text. Codes are "KIND:object". */
export function alarmText(code: string): string {
  const [k, o] = code.split(':');
  const map: Record<string, string> = {
    BLACKOUT: `Blackout: ${BUS_LABEL[o as BusId] ?? o} dead`,
    GEN_TRIP: `${o} tripped`,
    BUS_FAULT: `Busbar fault on ${BUS_LABEL[o as BusId] ?? o}: section locked out`,
    OVERLOAD: `Generator overload on ${o}`,
    HIGH_LOAD: `High load on ${o}: standby generator requested`,
    PHASE_BACK: `Thruster phase-back active on ${o}`,
    LOAD_SHED: `Load shedding active (${o})`,
    FEEDER_TRIP: `Feeder ${o} tripped`,
    DRIVE_TRIP: `${o} drive tripped on loss of supply`,
    DRIVE_NOT_READY: `${o} not available: ${o === 'BT1' || o === 'AZ1' ? 'group A' : 'group B'} supply/auxiliaries`,
    AUX_LOST: `${o} cooling/fuel pumps unpowered: engine will trip`,
    TR_TRIP: `${o} breaker tripped`,
    NO_STANDBY: `No standby generator available for ${o}`,
    ESB_ON_EG: 'Emergency switchboard supplied by the emergency generator',
    UPS_BATT: `${o} on battery: input supply lost`,
    UPS_LOW: `${o} battery low`,
    UPS_CRIT: `${o} battery critical`,
    UPS_OFF: `${o} output lost: consumers unpowered`,
    UPS_BYPASS: `${o} on static bypass: load not protected`,
    UPS_MAINT: `${o} in maintenance bypass`,
    UPS_FAULT: `${o} internal fault`,
    UPS_SEL_EMERG: `${o} input selector on EMERGENCY`,
    UPS_OVERLOAD: `${o} overload`,
    REDUNDANCY: `DP UPS redundancy lost: ${o} unavailable`,
    PMS_MANUAL: 'PMS automatic functions off (manual)',
  };
  return map[k] ?? code;
}

/** Advance the plant by dt seconds. Pure: returns a new state. */
export function stepPower(prev: PowerState, dt: number, demand: PowerDemand = NO_DEMAND, cfg = POWER_CONFIG): PowerState {
  if (!(dt > 0)) return prev;
  const s: PowerState = clone(prev);
  s.time = prev.time + dt;
  return solve(s, dt, demand, cfg);
}

function clone(p: PowerState): PowerState {
  return {
    ...p,
    gens: p.gens.map((g) => ({ ...g })),
    ties: Object.fromEntries(Object.entries(p.ties).map(([k, v]) => [k, { ...v }])) as PowerState['ties'],
    buses: Object.fromEntries(Object.entries(p.buses).map(([k, v]) => [k, { ...v }])) as PowerState['buses'],
    feeders: p.feeders.map((f) => ({ ...f })),
    drives: p.drives.map((d) => ({ ...d })),
    ups: p.ups.map((u) => ({ ...u })),
    consumers: { ...p.consumers },
    recovery: { A: { ...p.recovery.A }, B: { ...p.recovery.B } },
    timers: { ...p.timers, highLoad: { ...p.timers.highLoad }, lowLoad: { ...p.timers.lowLoad }, overload: { ...p.timers.overload } },
    energy: { ...p.energy },
  };
}

const section = (b: BusId): 'A' | 'B' | 'E' => (b === 'MSB_A' || b === 'DB_A' ? 'A' : b === 'ESB' ? 'E' : 'B');

/** Generator start/stop/synchronisation state machine (one step). */
function stepGenerators(s: PowerState, dt: number, cfg: PowerConfig, live: (b: BusId) => boolean) {
  const P = cfg.pms;
  const deadBusClosedThisStep = new Set<BusId>();
  for (const g of s.gens) {
    const gc = genCfg(g.id, cfg);
    if (g.state !== 'stopped' && g.state !== 'tripped') g.runningHours += dt / 3600;
    switch (g.state) {
      case 'starting':
        g.timer += dt;
        g.hz = (cfg.nominalHz * Math.min(1, g.timer / (g.id === 'EG' ? P.egRunUpS : P.crankAndRunUpS)));
        g.v = gc.voltage * Math.min(1, g.timer / (g.id === 'EG' ? P.egRunUpS : P.crankAndRunUpS));
        if (g.timer >= (g.id === 'EG' ? P.egRunUpS : P.crankAndRunUpS)) {
          g.state = 'running';
          g.timer = 0;
          pushEvent(s, 'info', g.id, `${g.id} running at rated speed, ready to connect`);
        }
        break;
      case 'running':
      case 'synchronising': {
        g.hz = cfg.nominalHz;
        g.v = gc.voltage;
        if (!g.closeRequest) break;
        const busLive = live(gc.bus);
        if (s.buses[gc.bus].fault) {
          g.closeRequest = false;
          pushEvent(s, 'warning', g.id, `${g.id} close blocked: ${BUS_LABEL[gc.bus]} faulted`);
          g.state = 'running';
          break;
        }
        if (!busLive) {
          // Dead-bus closing: only one incomer per dead section per step.
          if (deadBusClosedThisStep.has(gc.bus)) break;
          if (gc.bus === 'ESB' && s.ties.ESB_FEED.closed) break;
          deadBusClosedThisStep.add(gc.bus);
          connect(s, g, 'dead-bus closing');
        } else {
          if (g.state === 'running') {
            g.state = 'synchronising';
            g.timer = 0;
          }
          g.timer += dt;
          if (g.timer >= P.syncS) connect(s, g, 'synchronised');
        }
        break;
      }
      case 'online':
        g.share = Math.min(1, g.share + dt / P.loadRampS);
        break;
      case 'unloading':
        g.share = Math.max(0, g.share - dt / P.unloadS);
        if (g.share <= 0) {
          g.breaker = false;
          g.state = 'cooldown';
          g.timer = 0;
          pushEvent(s, 'info', g.id, `${g.id} unloaded, breaker open, cooling down`);
        }
        break;
      case 'cooldown':
        g.timer += dt;
        if (g.timer >= P.cooldownS) {
          g.state = 'stopped';
          g.hz = 0;
          g.v = 0;
          pushEvent(s, 'info', g.id, `${g.id} stopped`);
        }
        break;
      case 'stopped':
      case 'tripped':
        g.hz = 0;
        g.v = 0;
        g.share = 0;
        break;
    }
  }
}

function connect(s: PowerState, g: Generator, how: string) {
  g.breaker = true;
  g.state = 'online';
  g.closeRequest = false;
  g.timer = 0;
  // A dead-bus incomer takes the bus at once; a synchronised one ramps its share of the load in.
  g.share = how === 'dead-bus closing' ? 1 : 0.05;
  pushEvent(s, 'info', g.id, `${g.id} breaker closed (${how})`);
}

export function tripGenerator(s: PowerState, id: GenId, reason: string) {
  const g = s.gens.find((x) => x.id === id)!;
  if (g.state === 'tripped') return;
  g.state = 'tripped';
  g.breaker = false;
  g.share = 0;
  g.kw = 0;
  g.kvar = 0;
  g.closeRequest = false;
  g.tripReason = reason;
  g.auxLostS = 0;
  pushEvent(s, 'alarm', id, `${id} tripped: ${reason}`);
}

function requestStart(s: PowerState, g: Generator, why: string) {
  if (g.state !== 'stopped' && g.state !== 'cooldown') return false;
  if (g.state === 'cooldown') {
    g.state = 'running';
  } else {
    g.state = 'starting';
  }
  g.timer = 0;
  g.closeRequest = true;
  g.startedAt = s.time;
  pushEvent(s, 'info', g.id, `${g.id} start: ${why}`);
  return true;
}

/** Solve topology, PMS logic, load flow, UPS and consumers for one step. */
function solve(s: PowerState, dt: number, demand: PowerDemand, cfg: PowerConfig): PowerState {
  const P = cfg.pms;
  // 1. Which sections are energised (from the previous step's breaker states) — used by the state machines.
  const energised = (st: PowerState) => {
    const groups = islandsOf(st);
    const liveSet = new Set<BusId>();
    groups.forEach((grp) => {
      const has = st.gens.some((g) => g.breaker && (g.state === 'online' || g.state === 'unloading') && grp.includes(genCfg(g.id, cfg).bus));
      if (has) grp.forEach((b) => !st.buses[b].fault && liveSet.add(b));
    });
    return liveSet;
  };
  let liveSet = energised(s);
  const live = (b: BusId) => liveSet.has(b);

  // 2. Bus-tie synchronisation in progress.
  (Object.keys(s.ties) as TieId[]).forEach((t) => {
    const tie = s.ties[t];
    if (tie.syncing > 0) {
      tie.syncing += dt;
      const [a, b] = TIE_ENDS[t];
      if (!live(a) || !live(b)) tie.syncing = 0;
      else if (tie.syncing >= P.syncS) {
        tie.closed = true;
        tie.syncing = 0;
        pushEvent(s, 'info', t, `${TIE_LABEL[t]} closed (synchronised)`);
      }
    }
  });

  // 3. Generators.
  stepGenerators(s, dt, cfg, live);
  liveSet = energised(s);

  // 4. Emergency switchboard: changeover to the emergency generator and back.
  const eg = s.gens.find((g) => g.id === 'EG')!;
  const esbFromMain = s.ties.ESB_FEED.closed && live('DB_A');
  if (!esbFromMain && !(eg.breaker && eg.state === 'online')) {
    s.timers.esbDead += dt;
    if (s.timers.esbDead >= P.egStartDelayS) {
      if (s.ties.ESB_FEED.closed) {
        s.ties.ESB_FEED.closed = false;
        pushEvent(s, 'warning', 'ESB_FEED', 'Emergency switchboard feeder opened on loss of main supply');
      }
      if (eg.mode === 'AUTO' && eg.state === 'stopped') requestStart(s, eg, 'emergency switchboard dead');
      if (eg.state === 'running' || eg.state === 'synchronising') eg.closeRequest = true;
    }
  } else s.timers.esbDead = 0;
  if (eg.breaker && eg.state === 'online' && live('DB_A') && !s.ties.ESB_FEED.tripped && s.pmsAuto) {
    s.timers.esbReturn += dt;
    if (s.timers.esbReturn >= P.esbReturnDelayS) {
      // Transfer back: open the EG breaker, then close the main feeder (no parallel operation).
      eg.breaker = false;
      eg.state = 'cooldown';
      eg.timer = 0;
      eg.share = 0;
      s.ties.ESB_FEED.closed = true;
      s.timers.esbReturn = 0;
      pushEvent(s, 'info', 'ESB', 'Main supply stable: emergency switchboard transferred back to main, EG cooling down');
    }
  } else s.timers.esbReturn = 0;
  liveSet = energised(s);

  // 5. Generator auxiliaries (shared dependency): a set whose cooling/fuel pumps lose supply trips after a ride-through.
  for (const g of s.gens) {
    const aux = genCfg(g.id, cfg).auxFeeder;
    if (!aux || (g.state !== 'online' && g.state !== 'unloading')) {
      g.auxLostS = 0;
      setAlarm(s, `AUX_LOST:${g.id}`, false);
      continue;
    }
    const f = s.feeders.find((x) => x.id === aux)!;
    const ok = f.closed && !f.tripped && !f.shed && live(feederCfg(aux, cfg).bus);
    g.auxLostS = ok ? 0 : g.auxLostS + dt;
    setAlarm(s, `AUX_LOST:${g.id}`, !ok);
    if (g.auxLostS >= P.genAuxRideThroughS) tripGenerator(s, g.id, 'LT cooling water low pressure (pumps unpowered)');
  }
  liveSet = energised(s);

  // 6. Drives: supply, auxiliaries and control power decide readiness; a supply loss trips the drive.
  const consumersBefore = s.consumers;
  for (const d of s.drives) {
    const dc = cfg.drives.find((x) => x.id === d.id)!;
    const fd = s.feeders.find((f) => f.id === dc.feeder)!;
    const fa = s.feeders.find((f) => f.id === dc.aux)!;
    const supply = fd.closed && !fd.tripped && !fd.shed && live(feederCfg(dc.feeder, cfg).bus);
    const aux = fa.closed && !fa.tripped && !fa.shed && live(feederCfg(dc.aux, cfg).bus);
    const ctrl = consumersBefore[dc.ctrl];
    if (!supply) {
      if (d.status === 'ready' || d.status === 'restarting') {
        d.status = 'tripped';
        pushEvent(s, 'alarm', d.id, `${d.id} drive tripped: no supply`);
      }
    } else if (d.status === 'tripped' || d.status === 'no-supply') {
      // Heavy-consumer start request: the PMS only permits a restart with enough reserve and one at a time.
      const isl = islandOfBus(s, feederCfg(dc.feeder, cfg).bus, cfg);
      const reserve = isl ? isl.reserveKW : 0;
      if (s.pmsAuto && s.timers.restartSpacing <= 0 && reserve > 0.1 * dc.ratedKW) {
        d.status = 'restarting';
        d.timer = 0;
        s.timers.restartSpacing = P.driveRestartSpacingS;
        pushEvent(s, 'info', d.id, `${d.id} drive restart permitted by PMS`);
      }
    } else if (d.status === 'restarting') {
      d.timer += dt;
      if (d.timer >= P.driveRestartS) {
        d.status = 'ready';
        pushEvent(s, 'info', d.id, `${d.id} drive ready`);
      }
    }
    setAlarm(s, `DRIVE_NOT_READY:${d.id}`, d.status !== 'ready' || !aux || !ctrl);
  }
  s.timers.restartSpacing = Math.max(0, s.timers.restartSpacing - dt);

  // 7. Load flow per island, with phase-back, load shedding and protection.
  computeFlows(s, dt, demand, cfg, liveSet);

  // 8. PMS automatic functions per main section: standby start, load-dependent stop, blackout recovery.
  if (s.pmsAuto) pmsAutomation(s, dt, cfg);
  setAlarm(s, 'PMS_MANUAL', !s.pmsAuto);

  // 9. UPS and the consumers they feed.
  stepUps(s, dt, cfg);

  // 10. Trend (1 Hz).
  if (dt > 0 && Math.floor(s.time) !== Math.floor(s.time - dt)) {
    const isl = (b: BusId) => s.islands.find((i) => i.buses.includes(b));
    s.trend = [
      ...s.trend.slice(-(TREND_POINTS - 1)),
      {
        t: s.time,
        kwA: isl('MSB_A')?.loadKW ?? 0,
        kwB: isl('MSB_B')?.loadKW ?? 0,
        hzA: s.buses.MSB_A.hz,
        hzB: s.buses.MSB_B.hz,
        reserveKW: s.islands.filter((i) => i.buses.some((b) => b.startsWith('MSB'))).reduce((a, i) => a + i.reserveKW, 0),
        upsA: s.ups[0].soc * 100,
        upsB: s.ups[1].soc * 100,
        thrKW: s.drives.reduce((a, d) => a + d.kw, 0),
      },
    ];
  }
  s.acknowledged = s.acknowledged.filter((a) => s.alarms.includes(a));
  return s;
}

function islandOfBus(s: PowerState, b: BusId, _cfg: PowerConfig) {
  return s.islands.find((i) => i.buses.includes(b));
}

function computeFlows(s: PowerState, dt: number, demand: PowerDemand, cfg: PowerConfig, liveSet: Set<BusId>) {
  const P = cfg.pms;
  const groups = islandsOf(s);
  const islands: Island[] = [];
  let totGen = 0;
  let totLoad = 0;
  let totLoss = 0;
  let unmet = 0;

  // UPS input demand from the previous step's UPS state (charging + inverter losses), kW per bus.
  const upsIn: Partial<Record<BusId, number>> = {};
  s.ups.forEach((u) => {
    if (!u.installed) return;
    const uc = upsCfg(u.id, cfg);
    const bus = u.selector === 'MAIN' ? uc.mainBus : uc.emergBus;
    upsIn[bus] = (upsIn[bus] ?? 0) + u.inputKW;
  });

  groups.forEach((buses, idx) => {
    const gens = s.gens.filter((g) => g.breaker && (g.state === 'online' || g.state === 'unloading') && buses.includes(genCfg(g.id, cfg).bus));
    const islandLive = gens.length > 0 && buses.some((b) => liveSet.has(b));
    const capacity = gens.reduce((a, g) => a + genCfg(g.id, cfg).ratedKW, 0);
    // Non-thruster consumers on this island.
    let fixedKW = 0;
    let fixedKVAr = 0;
    let dbKW = 0;
    const feeders = s.feeders.filter((f) => buses.includes(feederCfg(f.id, cfg).bus));
    for (const f of feeders) {
      const fc = feederCfg(f.id, cfg);
      f.energised = islandLive && f.closed && !f.tripped && !f.shed && !s.buses[fc.bus].fault;
      if (fc.kind === 'thruster') continue;
      f.kw = f.energised ? fc.kw : 0;
      if (!f.energised && f.closed && !f.tripped && fc.kw > 0) unmet += fc.kw;
      fixedKW += f.kw;
      fixedKVAr += f.kw * Math.tan(Math.acos(fc.pf));
      if (fc.bus.startsWith('DB')) dbKW += f.kw;
    }
    for (const b of buses) {
      const u = upsIn[b] ?? 0;
      if (islandLive) {
        fixedKW += u;
        if (b.startsWith('DB')) dbKW += u;
      }
    }
    // ESB loads reached through the feeder count as distribution load (they pass through transformer A).
    const esbViaFeeder = buses.includes('ESB') && buses.includes('DB_A');
    if (esbViaFeeder) dbKW += feeders.filter((f) => feederCfg(f.id, cfg).bus === 'ESB').reduce((a, f) => a + f.kw, 0) + (upsIn.ESB ?? 0);
    const loss = buses.some((b) => b.startsWith('MSB')) ? (dbKW * P.transformerLossPct) / 100 : 0;
    fixedKW += loss;

    // Thrusters on this island: demand from the DP command, phase-back to the allowance.
    const drives = s.drives.filter((d) => buses.includes(feederCfg(cfg.drives.find((x) => x.id === d.id)!.feeder, cfg).bus));
    const thrDemand = drives.map((d) => {
      const dc = cfg.drives.find((x) => x.id === d.id)!;
      const running = d.status === 'ready' && (demand.running[d.id] ?? (demand.cmdN[d.id] ?? 0) > 0);
      d.demandKW = running ? thrusterKW(dc, demand.cmdN[d.id] ?? 0) : 0;
      return d.demandKW;
    });
    const thrTotal = thrDemand.reduce((a, b) => a + b, 0);
    const allowance = Math.max(0, (capacity * P.phaseBackPct) / 100 - fixedKW);
    const phaseBack = s.phaseBack && islandLive && thrTotal > allowance;
    drives.forEach((d, i) => {
      const dc = cfg.drives.find((x) => x.id === d.id)!;
      const fd = s.feeders.find((f) => f.id === dc.feeder)!;
      if (!islandLive || d.status !== 'ready' || !fd.energised) {
        d.allowedKW = 0;
        d.limitN = 0;
        d.kw = 0;
        fd.kw = 0;
        return;
      }
      // Each drive gets the allowance in proportion to its demand; without demand it may use its full share.
      d.allowedKW = !s.phaseBack ? dc.ratedKW * 1.05 : phaseBack ? (allowance * thrDemand[i]) / Math.max(thrTotal, 1e-9) : Math.min(dc.ratedKW * 1.05, thrDemand[i] + Math.max(0, allowance - thrTotal));
      d.limitN = Math.min(dc.maxThrustN, thrustForKW(dc, d.allowedKW));
      const delivered = Math.min(demand.forceN[d.id] ?? 0, d.limitN);
      const runningNow = demand.running[d.id] ?? delivered > 0;
      d.kw = d.id === 'BT1' && demand.bt1ShaftKW !== undefined ? demand.bt1ShaftKW / 0.95 : runningNow ? thrusterKW(dc, delivered) : 0;
      if (phaseBack || !s.phaseBack) d.kw = Math.min(d.kw, d.allowedKW);
      fd.kw = d.kw;
      if (thrDemand[i] > d.kw + 1) unmet += thrDemand[i] - d.kw;
    });
    const thrKW = drives.reduce((a, d) => a + d.kw, 0);
    const thrKVAr = drives.reduce((a, d) => a + d.kw * Math.tan(Math.acos(feederCfg(cfg.drives.find((x) => x.id === d.id)!.feeder, cfg).pf)), 0);
    const load = islandLive ? fixedKW + thrKW : 0;
    const kvar = islandLive ? fixedKVAr + thrKVAr : 0;
    const key = buses.slice().sort().join('+');
    const sec = buses.includes('MSB_A') ? 'MSB_A' : buses.includes('MSB_B') ? 'MSB_B' : buses[0];
    setAlarm(s, `PHASE_BACK:${sec}`, phaseBack);

    // Load sharing by rating and ramp weight.
    const weight = gens.map((g) => genCfg(g.id, cfg).ratedKW * Math.max(0.02, g.share));
    const wsum = weight.reduce((a, b) => a + b, 0) || 1;
    const loadPct = capacity > 0 ? (load / capacity) * 100 : 0;
    // Frequency/voltage: first-order response with a dip on load steps; governor droop above rating.
    const prevKW = gens.reduce((a, g) => a + g.kw, 0);
    const step = capacity > 0 ? (load - prevKW) / capacity : 0;
    const targetHz = cfg.nominalHz * (loadPct > 100 ? 1 - 0.1 * (loadPct / 100 - 1) : 1);
    const k = dt > 0 ? 1 - Math.exp(-dt / 1.5) : 1;
    gens.forEach((g, i) => {
      const gc = genCfg(g.id, cfg);
      g.kw = (load * weight[i]) / wsum;
      g.kvar = (kvar * weight[i]) / wsum;
      g.hz = g.hz + (targetHz - g.hz) * k - (dt > 0 ? Math.max(-1.5, Math.min(1.5, step * 4)) : 0);
      g.v = g.v + (gc.voltage * (1 - 0.02 * Math.max(0, loadPct / 100 - 0.5)) - g.v) * k - (dt > 0 ? step * 0.05 * gc.voltage : 0);
    });
    const hz = gens.length ? gens.reduce((a, g) => a + g.hz, 0) / gens.length : 0;
    const v = gens.length ? gens.reduce((a, g) => a + g.v, 0) / gens.length : 0;
    buses.forEach((b) => {
      const bs = s.buses[b];
      bs.live = islandLive && !bs.fault;
      bs.hz = bs.live ? hz : 0;
      bs.v = bs.live ? (b.startsWith('MSB') ? v : cfg.distV * (v / cfg.nominalV || 0)) : 0;
      bs.island = idx;
    });
    // Emergency switchboard on the EG: its voltage is the EG's own.
    if (buses.length === 1 && buses[0] === 'ESB' && gens.length) {
      s.buses.ESB.v = gens[0].v;
    }

    // Load shedding when the island is still overloaded after phase-back, then protection.
    const over = capacity > 0 && loadPct > P.shedLoadPct;
    s.timers.overload[key] = over ? (s.timers.overload[key] ?? 0) + dt : 0;
    if (over && s.timers.overload[key] >= P.shedDelayS) {
      const victim = feeders
        .filter((f) => f.energised && feederCfg(f.id, cfg).shed > 0)
        .sort((a, b) => feederCfg(b.id, cfg).shed - feederCfg(a.id, cfg).shed)[0];
      if (victim) {
        victim.shed = true;
        victim.energised = false;
        s.timers.reconnect = 0;
        s.timers.overload[key] = 0;
        pushEvent(s, 'warning', victim.id, `Load shed: ${feederCfg(victim.id, cfg).label}`);
      }
    }
    const overloadKey = `OVL:${key}`;
    const overload = capacity > 0 && loadPct > P.overloadPct;
    s.timers.overload[overloadKey] = overload ? (s.timers.overload[overloadKey] ?? 0) + dt : 0;
    setAlarm(s, `OVERLOAD:${sec}`, overload);
    if (overload && s.timers.overload[overloadKey] >= P.overloadTripS) {
      const worst = gens.slice().sort((a, b) => b.kw / genCfg(b.id, cfg).ratedKW - a.kw / genCfg(a.id, cfg).ratedKW)[0];
      tripGenerator(s, worst.id, 'overcurrent / overload protection');
      s.timers.overload[overloadKey] = 0;
    }

    const gensKW = gens.reduce((a, g) => a + g.kw, 0);
    totGen += gensKW;
    totLoad += load - loss;
    totLoss += loss;
    const pf = load > 0 ? load / Math.hypot(load, kvar) : 1;
    islands.push({ id: idx, buses, gens: gens.map((g) => g.id), capacityKW: capacity, loadKW: load, loadPct, reserveKW: Math.max(0, capacity - load), hz, v, pf });
  });

  // Gens not on a live island carry nothing.
  s.gens.forEach((g) => {
    if (!g.breaker) {
      g.kw = 0;
      g.kvar = 0;
    }
  });
  s.islands = islands;
  s.balance = { genKW: totGen, loadKW: totLoad, lossKW: totLoss, unmetKW: unmet };
  s.energy.genKWh += (totGen * dt) / 3600;
  s.energy.loadKWh += (totLoad * dt) / 3600;
  s.energy.lossKWh += (totLoss * dt) / 3600;

  // Automatic reconnection of shed loads once the reserve has been comfortable for a while (hysteresis).
  const shed = s.feeders.filter((f) => f.shed);
  setAlarm(s, 'LOAD_SHED:PMS', shed.length > 0);
  if (shed.length && s.pmsAuto) {
    const next = shed.sort((a, b) => feederCfg(a.id, cfg).shed - feederCfg(b.id, cfg).shed)[0];
    const fc = feederCfg(next.id, cfg);
    const isl = s.islands.find((i) => i.buses.includes(fc.bus));
    const ok = isl && isl.capacityKW > 0 && isl.loadKW + fc.kw < isl.capacityKW * (1 - P.reconnectMarginPct / 100) && s.recovery[section(fc.bus) === 'B' ? 'B' : 'A'].stage === 'normal';
    s.timers.reconnect = ok ? s.timers.reconnect + dt : 0;
    if (ok && s.timers.reconnect >= P.reconnectDelayS) {
      next.shed = false;
      s.timers.reconnect = 0;
      pushEvent(s, 'info', next.id, `Reconnected: ${fc.label}`);
    }
  }
}

function pmsAutomation(s: PowerState, dt: number, cfg: PowerConfig) {
  const P = cfg.pms;
  for (const sec of ['A', 'B'] as const) {
    const msb: BusId = sec === 'A' ? 'MSB_A' : 'MSB_B';
    const isl = s.islands.find((i) => i.buses.includes(msb));
    const key = isl ? isl.buses.slice().sort().join('+') : msb;
    // Generators the PMS may use for this section: AUTO, healthy, on a bus in the same island.
    const islBuses = isl?.buses ?? [msb];
    const candidates = s.gens.filter((g) => g.id !== 'EG' && g.mode === 'AUTO' && islBuses.includes(genCfg(g.id, cfg).bus));
    const standby = candidates.filter((g) => g.state === 'stopped' || g.state === 'cooldown').sort((a, b) => a.priority - b.priority);
    const rec = s.recovery[sec];
    const live = s.buses[msb].live;
    const faulted = s.buses[msb].fault;

    // Blackout detection and recovery.
    if (!live && !faulted) {
      rec.timer += dt;
      if (rec.stage === 'normal' && rec.timer >= P.deadBusDetectS) {
        rec.stage = 'blackout';
        rec.since = s.time;
        setAlarm(s, `BLACKOUT:${msb}`, true);
        // Undervoltage release: heavy and non-essential consumers are opened for a controlled restart.
        s.feeders.forEach((f) => {
          const fc = feederCfg(f.id, cfg);
          if ((fc.bus === msb || fc.bus === (sec === 'A' ? 'DB_A' : 'DB_B')) && fc.shed >= 2 && f.closed) f.shed = true;
        });
      }
      if (rec.stage === 'blackout' || rec.stage === 'starting') {
        const starting = candidates.filter((g) => ['starting', 'running', 'synchronising'].includes(g.state));
        if (!starting.length) {
          const g = standby[0];
          if (g) {
            requestStart(s, g, `blackout recovery (${msb})`);
            rec.stage = 'starting';
          }
          setAlarm(s, `NO_STANDBY:${msb}`, !g);
        } else {
          starting.forEach((g) => (g.closeRequest = true));
          rec.stage = 'starting';
        }
      }
    } else {
      rec.timer = 0;
      if (rec.stage === 'blackout' || rec.stage === 'starting') {
        rec.stage = 'restoring';
        rec.since = s.time;
        setAlarm(s, `BLACKOUT:${msb}`, false);
        pushEvent(s, 'info', msb, `${msb} restored: restarting consumers in sequence`);
      }
      if (rec.stage === 'restoring') {
        const drivesBack = s.drives.filter((d) => cfg.drives.find((x) => x.id === d.id)!.group === sec).every((d) => d.status === 'ready');
        if (drivesBack && s.time - rec.since > 5) {
          rec.stage = 'normal';
          pushEvent(s, 'info', msb, `Blackout recovery complete on ${msb}`);
        }
      }
      if (faulted) setAlarm(s, `BLACKOUT:${msb}`, true);
    }
    if (!isl || !live) continue;

    // Load-dependent standby start (with delay) and stop (with longer delay and a post-stop load check).
    const high = isl.loadPct > P.startLoadPct;
    s.timers.highLoad[key] = high ? (s.timers.highLoad[key] ?? 0) + dt : 0;
    setAlarm(s, `HIGH_LOAD:${msb}`, high);
    const anyStarting = candidates.some((g) => ['starting', 'running', 'synchronising'].includes(g.state));
    if (high && s.timers.highLoad[key] >= P.startDelayS && !anyStarting) {
      const g = standby[0];
      if (g) requestStart(s, g, `load ${isl.loadPct.toFixed(0)} % > ${P.startLoadPct} %`);
      setAlarm(s, `NO_STANDBY:${msb}`, !g);
      s.timers.highLoad[key] = 0;
    }
    const online = candidates.filter((g) => g.state === 'online' && genCfg(g.id, cfg).bus === msb);
    const low = isl.loadPct < P.stopLoadPct && online.length > Math.max(1, s.minOnline[sec]);
    s.timers.lowLoad[key] = low ? (s.timers.lowLoad[key] ?? 0) + dt : 0;
    if (low && s.timers.lowLoad[key] >= P.stopDelayS) {
      const last = online.sort((a, b) => b.startedAt - a.startedAt || b.priority - a.priority)[0];
      const remaining = isl.capacityKW - genCfg(last.id, cfg).ratedKW;
      if (remaining > 0 && (isl.loadKW / remaining) * 100 < P.stopRemainingMaxPct) {
        last.state = 'unloading';
        pushEvent(s, 'info', last.id, `${last.id} stop: load ${isl.loadPct.toFixed(0)} % < ${P.stopLoadPct} % for ${P.stopDelayS} s`);
      }
      s.timers.lowLoad[key] = 0;
    }
  }
}

/** UPS operating mode, battery energy and the consumers each UPS supplies. */
function stepUps(s: PowerState, dt: number, cfg: PowerConfig) {
  const live = (b: BusId) => s.buses[b].live;
  // Consumer loads per UPS (dual-fed consumers split between live outputs, decided iteratively from last output state).
  const outputs: Partial<Record<UpsId, boolean>> = {};
  s.ups.forEach((u) => (outputs[u.id] = u.installed && u.outputLive));
  const loadFor = (id: UpsId) =>
    (Object.entries(cfg.consumers) as [ConsumerId, ConsumerCfg][]).reduce((acc, [, c]) => {
      if (!c.supplies.includes(id)) return acc;
      const liveSup = c.supplies.filter((x) => outputs[x]);
      return acc + (liveSup.includes(id) ? c.kw / liveSup.length : 0);
    }, 0);

  for (const u of s.ups) {
    const uc = upsCfg(u.id, cfg);
    if (!u.installed) {
      u.outputLive = false;
      u.mode = 'off';
      continue;
    }
    const src: BusId = u.selector === 'MAIN' ? uc.mainBus : uc.emergBus;
    u.inputLive = live(src);
    u.bypassLive = live(src);
    u.inV = u.inputLive ? s.buses[src].v : 0;
    u.inHz = u.inputLive ? s.buses[src].hz : 0;
    const prevMode = u.mode;
    const load = loadFor(u.id);
    const ratedKW = uc.ratedKVA * uc.pf;
    u.overloadS = load > (ratedKW * cfg.upsAlarm.overloadPct) / 100 ? u.overloadS + dt : 0;
    const Ekwh = batteryKWh(u, cfg);
    let mode: UpsMode;
    if (u.maintBypass) mode = u.bypassLive ? 'maintenance-bypass' : 'off';
    else if (u.inverterFault || u.overloadS > 5) mode = u.bypassLive ? 'static-bypass' : 'off';
    else if (u.inputLive && !u.rectifierFault) mode = 'normal';
    else if (!u.batteryFault && u.soc > 0) mode = 'battery';
    else mode = u.bypassLive ? 'static-bypass' : 'off';
    u.mode = mode;
    u.loadKW = mode === 'off' ? 0 : load;
    // Energy: the inverter draws load/η from the DC link (rectifier or battery). Charging when input is healthy.
    let battKW = 0;
    let inputKW = 0;
    const b = uc.battery;
    if (mode === 'normal') {
      const taper = u.soc >= 0.9 ? Math.max(0, (1 - u.soc) / 0.1) : 1;
      const charge = u.batteryFault ? 0 : uc.chargerMaxKW * taper;
      battKW = -charge;
      inputKW = (u.loadKW / uc.inverterEff + charge) / uc.rectifierEff;
    } else if (mode === 'battery') {
      battKW = u.loadKW / uc.inverterEff;
    } else if (mode === 'static-bypass' || mode === 'maintenance-bypass') {
      inputKW = u.loadKW;
      // The rectifier keeps charging on static bypass if it is healthy; maintenance bypass isolates the UPS.
      if (mode === 'static-bypass' && u.inputLive && !u.rectifierFault && !u.batteryFault) {
        const taper = u.soc >= 0.9 ? Math.max(0, (1 - u.soc) / 0.1) : 1;
        battKW = -uc.chargerMaxKW * taper;
        inputKW += (uc.chargerMaxKW * taper) / uc.rectifierEff;
      }
    }
    if (Ekwh > 0 && dt > 0) {
      const dSoc = (battKW * dt) / 3600 / Ekwh;
      // Charging is lossy (0.9 coulombic/energy efficiency, demonstration assumption).
      u.soc = Math.max(0, Math.min(1, u.soc - (battKW > 0 ? dSoc : dSoc * 0.9)));
      if (battKW > 0) s.energy.battOutKWh += (battKW * dt) / 3600;
      else s.energy.battInKWh += (-battKW * dt) / 3600;
    }
    if (mode === 'battery' && u.soc <= 0) {
      u.mode = u.bypassLive ? 'static-bypass' : 'off';
      u.loadKW = u.mode === 'off' ? 0 : load;
      battKW = 0;
    }
    u.battKW = battKW;
    u.inputKW = u.inputLive ? inputKW : 0;
    // Battery terminal: open-circuit 1.95…2.15 V/cell with SoC, IR drop on discharge, float 2.25 V/cell on charge.
    const ocv = b.cells * (1.95 + 0.2 * u.soc);
    if (u.batteryFault) {
      u.battV = 0;
      u.battA = 0;
    } else if (battKW > 0) {
      const i = (battKW * 1000) / ocv;
      u.battA = i;
      u.battV = ocv - i * b.internalOhm * b.cells;
    } else if (battKW < 0) {
      u.battV = b.cells * 2.25;
      u.battA = (battKW * 1000) / u.battV;
    } else {
      u.battV = ocv;
      u.battA = 0;
    }
    u.outputLive = u.mode !== 'off';
    u.outV = u.outputLive ? (u.mode.includes('bypass') ? (u.inV / cfg.distV) * uc.outV : uc.outV) : 0;
    u.outHz = u.outputLive ? (u.mode.includes('bypass') ? u.inHz : uc.outHz) : 0;
    const usable = Ekwh * u.soc;
    u.runtimeMin = u.loadKW > 0 && !u.batteryFault ? (usable * uc.inverterEff * 60) / u.loadKW : null;
    if (prevMode !== u.mode) pushEvent(s, u.mode === 'off' ? 'alarm' : u.mode === 'normal' ? 'info' : 'warning', u.id, `${uc.label}: ${prevMode} → ${u.mode}`);
    setAlarm(s, `UPS_BATT:${u.id}`, u.mode === 'battery');
    setAlarm(s, `UPS_LOW:${u.id}`, u.soc * 100 <= cfg.upsAlarm.lowSocPct && u.soc * 100 > cfg.upsAlarm.criticalSocPct && u.mode === 'battery');
    setAlarm(s, `UPS_CRIT:${u.id}`, u.soc * 100 <= cfg.upsAlarm.criticalSocPct && u.mode === 'battery');
    setAlarm(s, `UPS_OFF:${u.id}`, u.mode === 'off');
    setAlarm(s, `UPS_BYPASS:${u.id}`, u.mode === 'static-bypass');
    setAlarm(s, `UPS_MAINT:${u.id}`, u.maintBypass);
    setAlarm(s, `UPS_FAULT:${u.id}`, u.rectifierFault || u.inverterFault || u.batteryFault);
    setAlarm(s, `UPS_SEL_EMERG:${u.id}`, u.selector === 'EMERG' && u.id !== 'UPS_C');
    setAlarm(s, `UPS_OVERLOAD:${u.id}`, u.overloadS > 0);
    outputs[u.id] = u.outputLive;
  }
  // Consumers: powered when at least one of their supplies has a live output.
  (Object.keys(cfg.consumers) as ConsumerId[]).forEach((k) => {
    s.consumers[k] = cfg.consumers[k].supplies.some((x) => outputs[x]);
  });
  const lostA = !outputs.UPS_A;
  const lostB = !outputs.UPS_B;
  setAlarm(s, 'REDUNDANCY:UPS A', lostA && !lostB);
  setAlarm(s, 'REDUNDANCY:UPS B', lostB && !lostA);
}

// ------------------------------------------------------------------------------------------ commands

export class PowerCommandRejected extends Error {}

export type PowerCommand =
  | { type: 'gen-start'; id: GenId }
  | { type: 'gen-stop'; id: GenId }
  | { type: 'gen-close'; id: GenId }
  | { type: 'gen-sync-close'; id: GenId }
  | { type: 'gen-open'; id: GenId }
  | { type: 'gen-mode'; id: GenId; mode: 'AUTO' | 'MANUAL' }
  | { type: 'gen-trip'; id: GenId; reason?: string }
  | { type: 'gen-reset'; id: GenId }
  | { type: 'gen-priority'; id: GenId }
  | { type: 'tie-close'; id: TieId }
  | { type: 'tie-sync-close'; id: TieId }
  | { type: 'tie-open'; id: TieId }
  | { type: 'tie-trip'; id: TieId }
  | { type: 'tie-reset'; id: TieId }
  | { type: 'feeder-open'; id: string }
  | { type: 'feeder-close'; id: string }
  | { type: 'feeder-fault'; id: string }
  | { type: 'feeder-reset'; id: string }
  | { type: 'bus-fault'; bus: BusId }
  | { type: 'bus-fault-clear'; bus: BusId }
  | { type: 'pms-auto'; on: boolean }
  | { type: 'min-online'; section: 'A' | 'B'; value: number }
  | { type: 'phase-back'; on: boolean }
  | { type: 'ups-selector'; id: UpsId; selector: 'MAIN' | 'EMERG' }
  | { type: 'ups-maint-bypass'; id: UpsId; on: boolean }
  | { type: 'ups-fault'; id: UpsId; kind: 'rectifier' | 'inverter' | 'battery'; on: boolean }
  | { type: 'ups-soh'; id: UpsId; value: number }
  | { type: 'set-dp-class'; value: 1 | 2 | 3 }
  | { type: 'arrangement'; value: Arrangement }
  | { type: 'acknowledge' }
  | { type: 'reset' };

const reject = (why: string): never => {
  throw new PowerCommandRejected(why);
};

/** Operator and fault-injection commands. Inhibited commands throw PowerCommandRejected with the reason. */
export function applyPowerCommand(prev: PowerState, cmd: PowerCommand, cfg = POWER_CONFIG): PowerState {
  const s = clone(prev);
  const gen = (id: GenId) => s.gens.find((g) => g.id === id) ?? reject(`Unknown generator ${id}`);
  const feeder = (id: string) => s.feeders.find((f) => f.id === id) ?? reject(`Unknown feeder ${id}`);
  const ups = (id: UpsId) => s.ups.find((u) => u.id === id) ?? reject(`Unknown UPS ${id}`);
  switch (cmd.type) {
    case 'gen-start': {
      const g = gen(cmd.id);
      if (g.state === 'tripped') reject(`${g.id} is tripped (${g.tripReason}): reset the trip first`);
      if (g.state !== 'stopped' && g.state !== 'cooldown') reject(`${g.id} is already ${g.state}`);
      requestStart(s, g, 'operator');
      g.closeRequest = false;
      break;
    }
    case 'gen-stop': {
      const g = gen(cmd.id);
      if (g.state === 'online') {
        const isl = s.islands.find((i) => i.gens.includes(g.id));
        const remaining = (isl?.capacityKW ?? 0) - genCfg(g.id, cfg).ratedKW;
        if (isl && remaining <= 0 && isl.loadKW > 1) reject(`Stop inhibited: ${g.id} is the only generator on the bus (would black out ${isl.buses[0]})`);
        if (isl && remaining > 0 && (isl.loadKW / remaining) * 100 > 90) reject(`Stop inhibited: remaining generators would run at ${((isl.loadKW / remaining) * 100).toFixed(0)} % (limit 90 %)`);
        g.state = 'unloading';
        pushEvent(s, 'info', g.id, `${g.id} stop by operator: unloading`);
      } else if (['starting', 'running', 'synchronising'].includes(g.state)) {
        g.state = 'cooldown';
        g.timer = 0;
        g.closeRequest = false;
      } else reject(`${g.id} is ${g.state}`);
      break;
    }
    case 'gen-close': {
      const g = gen(cmd.id);
      const bus = genCfg(g.id, cfg).bus;
      if (g.state !== 'running' && g.state !== 'synchronising') reject(`${g.id} not ready: it must be running at rated speed and voltage`);
      if (s.buses[bus].fault) reject(`${BUS_LABEL[bus]} is faulted and locked out`);
      if (g.id === 'EG' && s.ties.ESB_FEED.closed) reject('Interlock: emergency generator cannot parallel with the main supply (open the ESB feeder first)');
      if (s.buses[bus].live) reject(`Synchronising check failed: ${BUS_LABEL[bus]} is live and ${g.id} is not synchronised (use SYNC & CLOSE)`);
      connect(s, g, 'dead-bus closing (operator)');
      break;
    }
    case 'gen-sync-close': {
      const g = gen(cmd.id);
      if (g.state !== 'running' && g.state !== 'synchronising') reject(`${g.id} not ready: start it first`);
      if (g.id === 'EG' && s.ties.ESB_FEED.closed) reject('Interlock: emergency generator cannot parallel with the main supply');
      g.closeRequest = true;
      break;
    }
    case 'gen-open': {
      const g = gen(cmd.id);
      if (!g.breaker) reject(`${g.id} breaker is already open`);
      const isl = s.islands.find((i) => i.gens.includes(g.id));
      if (isl && isl.gens.length > 1) {
        const remaining = isl.capacityKW - genCfg(g.id, cfg).ratedKW;
        if ((isl.loadKW / remaining) * 100 > 100) reject(`Open inhibited: remaining generators would be overloaded (use STOP to unload first)`);
      }
      g.breaker = false;
      g.state = 'running';
      g.share = 0;
      pushEvent(s, 'warning', g.id, `${g.id} breaker opened by operator`);
      break;
    }
    case 'gen-mode':
      gen(cmd.id).mode = cmd.mode;
      break;
    case 'gen-priority': {
      const g = gen(cmd.id);
      const min = Math.min(...s.gens.map((x) => x.priority));
      g.priority = min - 1;
      pushEvent(s, 'info', g.id, `${g.id} set as first standby`);
      break;
    }
    case 'gen-trip':
      tripGenerator(s, cmd.id, cmd.reason ?? 'protection trip (simulated fault)');
      setAlarm(s, `GEN_TRIP:${cmd.id}`, true);
      break;
    case 'gen-reset': {
      const g = gen(cmd.id);
      if (g.state !== 'tripped') reject(`${g.id} is not tripped`);
      g.state = 'stopped';
      g.tripReason = null;
      setAlarm(s, `GEN_TRIP:${g.id}`, false);
      pushEvent(s, 'info', g.id, `${g.id} trip reset: available`);
      break;
    }
    case 'tie-close':
    case 'tie-sync-close': {
      const t = s.ties[cmd.id] ?? reject('Unknown breaker');
      const [a, b] = TIE_ENDS[cmd.id];
      if (t.closed) reject(`${TIE_LABEL[cmd.id]} already closed`);
      if (t.tripped) reject(`${TIE_LABEL[cmd.id]} tripped: reset first`);
      if (s.buses[a].fault || s.buses[b].fault) reject('Interlock: a connected section is faulted');
      const la = s.buses[a].live;
      const lb = s.buses[b].live;
      const sameIsland = la && lb && s.buses[a].island === s.buses[b].island;
      if (cmd.id === 'ESB_FEED' && s.gens.find((g) => g.id === 'EG')!.breaker) reject('Interlock: emergency generator is connected; it transfers back automatically, or open the EG breaker first');
      if (la && lb && !sameIsland) {
        if (cmd.id !== 'MSB_TIE') reject(`Interlock: ${TIE_LABEL[cmd.id]} would parallel two live sections through transformers`);
        if (cmd.type === 'tie-close') reject('Synchronising check failed: both sides are live (use SYNC & CLOSE)');
        t.syncing = 1e-6;
        pushEvent(s, 'info', cmd.id, `${TIE_LABEL[cmd.id]} synchronising`);
      } else {
        t.closed = true;
        pushEvent(s, 'info', cmd.id, `${TIE_LABEL[cmd.id]} closed${la !== lb ? ' (dead-bus closing)' : ''}`);
      }
      break;
    }
    case 'tie-open':
      s.ties[cmd.id].closed = false;
      s.ties[cmd.id].syncing = 0;
      pushEvent(s, 'info', cmd.id, `${TIE_LABEL[cmd.id]} opened`);
      break;
    case 'tie-trip':
      s.ties[cmd.id].closed = false;
      s.ties[cmd.id].tripped = true;
      setAlarm(s, `TR_TRIP:${cmd.id}`, true, `${TIE_LABEL[cmd.id]} tripped (simulated fault)`);
      break;
    case 'tie-reset':
      if (!s.ties[cmd.id].tripped) reject(`${TIE_LABEL[cmd.id]} is not tripped`);
      s.ties[cmd.id].tripped = false;
      setAlarm(s, `TR_TRIP:${cmd.id}`, false, `${TIE_LABEL[cmd.id]} tripped (simulated fault)`);
      break;
    case 'feeder-open':
      feeder(cmd.id).closed = false;
      pushEvent(s, 'info', cmd.id, `${feederCfg(cmd.id, cfg).label} opened by operator`);
      break;
    case 'feeder-close': {
      const f = feeder(cmd.id);
      if (f.tripped) reject(`${feederCfg(cmd.id, cfg).label} tripped on fault: reset first`);
      const fc = feederCfg(cmd.id, cfg);
      const isl = s.islands.find((i) => i.buses.includes(fc.bus));
      if (fc.kind !== 'thruster' && isl && isl.loadKW + fc.kw > isl.capacityKW) reject(`Heavy consumer start blocked: not enough reserve (${isl.reserveKW.toFixed(0)} kW available)`);
      f.closed = true;
      f.shed = false;
      break;
    }
    case 'feeder-fault': {
      const f = feeder(cmd.id);
      f.fault = true;
      f.tripped = true;
      f.closed = false;
      setAlarm(s, `FEEDER_TRIP:${cmd.id}`, true, `${feederCfg(cmd.id, cfg).label} tripped: short circuit (simulated)`);
      break;
    }
    case 'feeder-reset': {
      const f = feeder(cmd.id);
      f.fault = false;
      f.tripped = false;
      setAlarm(s, `FEEDER_TRIP:${cmd.id}`, false, `${feederCfg(cmd.id, cfg).label} tripped: short circuit (simulated)`);
      break;
    }
    case 'bus-fault': {
      // Selective protection: every breaker on the faulted section opens and the section is locked out.
      s.buses[cmd.bus].fault = true;
      s.gens.filter((g) => genCfg(g.id, cfg).bus === cmd.bus && g.breaker).forEach((g) => tripGenerator(s, g.id, `busbar fault on ${cmd.bus}`));
      (Object.keys(s.ties) as TieId[]).forEach((t) => {
        if (TIE_ENDS[t].includes(cmd.bus) && s.ties[t].closed) {
          s.ties[t].closed = false;
          pushEvent(s, 'alarm', t, `${TIE_LABEL[t]} opened by bus protection`);
        }
      });
      setAlarm(s, `BUS_FAULT:${cmd.bus}`, true);
      break;
    }
    case 'bus-fault-clear':
      if (!s.buses[cmd.bus].fault) reject(`${BUS_LABEL[cmd.bus]} has no fault`);
      s.buses[cmd.bus].fault = false;
      setAlarm(s, `BUS_FAULT:${cmd.bus}`, false);
      s.gens.filter((g) => genCfg(g.id, cfg).bus === cmd.bus && g.state === 'tripped').forEach((g) => {
        g.state = 'stopped';
        g.tripReason = null;
      });
      // Restore the section's own transformer path; the bus tie stays open for the operator.
      if (cmd.bus === 'MSB_A' || cmd.bus === 'DB_A') s.ties.TR_A.closed = true;
      if (cmd.bus === 'MSB_B' || cmd.bus === 'DB_B') s.ties.TR_B.closed = true;
      pushEvent(s, 'info', cmd.bus, `${BUS_LABEL[cmd.bus]} fault cleared and reset`);
      break;
    case 'pms-auto':
      s.pmsAuto = cmd.on;
      pushEvent(s, 'info', 'PMS', `PMS automatic functions ${cmd.on ? 'ON' : 'OFF'}`);
      break;
    case 'min-online':
      s.minOnline = { ...s.minOnline, [cmd.section]: Math.max(1, Math.min(2, Math.round(cmd.value))) };
      pushEvent(s, 'info', 'PMS', `Minimum sets online, section ${cmd.section}: ${s.minOnline[cmd.section]}`);
      break;
    case 'phase-back':
      s.phaseBack = cmd.on;
      pushEvent(s, cmd.on ? 'info' : 'warning', 'PMS', `Thruster phase-back ${cmd.on ? 'enabled' : 'DISABLED (fault injection)'}`);
      break;
    case 'ups-selector':
      ups(cmd.id).selector = cmd.selector;
      pushEvent(s, 'info', cmd.id, `${cmd.id} input selector → ${cmd.selector}`);
      break;
    case 'ups-maint-bypass': {
      const u = ups(cmd.id);
      if (cmd.on && !u.bypassLive) reject(`Maintenance bypass inhibited: the bypass supply to ${cmd.id} is dead`);
      u.maintBypass = cmd.on;
      break;
    }
    case 'ups-fault': {
      const u = ups(cmd.id);
      if (cmd.kind === 'rectifier') u.rectifierFault = cmd.on;
      if (cmd.kind === 'inverter') u.inverterFault = cmd.on;
      if (cmd.kind === 'battery') u.batteryFault = cmd.on;
      pushEvent(s, cmd.on ? 'warning' : 'info', cmd.id, `${cmd.id} ${cmd.kind} fault ${cmd.on ? 'injected' : 'cleared'}`);
      break;
    }
    case 'ups-soh': {
      const v = Number(cmd.value);
      if (!Number.isFinite(v)) reject('State of health must be a number');
      ups(cmd.id).soh = Math.max(0.1, Math.min(1, v));
      break;
    }
    case 'set-dp-class': {
      s.dpClass = cmd.value;
      s.ups.forEach((u) => {
        if (u.id === 'UPS_C') {
          u.installed = cmd.value === 3;
          u.soc = 1;
        }
      });
      return solve(s, 0, NO_DEMAND, cfg);
    }
    case 'arrangement': {
      const fresh = initialPowerState(s.dpClass, cmd.value, cfg);
      return { ...fresh, time: s.time, events: [...s.events, { t: s.time, sev: 'info', src: 'PMS', text: `Plant set to ${cmd.value}` }] };
    }
    case 'acknowledge':
      s.acknowledged = [...s.alarms];
      break;
    case 'reset':
      return initialPowerState(s.dpClass);
  }
  return solve(s, 0, NO_DEMAND, cfg);
}

export const unacknowledgedPower = (s: PowerState) => s.alarms.filter((a) => !s.acknowledged.includes(a));

/** Is a drive able to run for DP (supply, auxiliaries and control power)? */
export function driveAvailable(s: PowerState, id: DriveId, cfg = POWER_CONFIG): boolean {
  const d = s.drives.find((x) => x.id === id)!;
  const dc = cfg.drives.find((x) => x.id === id)!;
  const aux = s.feeders.find((f) => f.id === dc.aux)!;
  return d.status === 'ready' && aux.energised && s.consumers[dc.ctrl];
}
