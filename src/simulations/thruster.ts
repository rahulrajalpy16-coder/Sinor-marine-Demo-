/**
 * Bow tunnel thruster, P2 standard design: controllable-pitch propeller (CPP) driven by a
 * constant-speed electric motor, operated through a Z-Thrust style CPP control system.
 * Illustrative, non-certified educational model with representative coefficients.
 *
 * The motor runs the propeller at constant rated speed; thrust is set by blade pitch.
 *   Pitch setpoint p* in [-1, 1] (+ pushes the bow to starboard, i.e. force along +X).
 *   Pitch servo (hydraulic) is rate limited:        |dp/dt| <= pitchRatePerS.
 *   Thrust:   F = Fmax · sign(p) · |p|^1.5 · (n / nRated)^2
 *   Power:    P = Prated · (n / nRated)^3 · (P0 + (1 - P0) · |p|^2.5)   (P0 = zero-pitch load)
 * Load clipping limits the pitch so P never exceeds powerLimit · Prated.
 * The tunnel is fixed: there is deliberately no azimuth input.
 */

export type ThrusterStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'paused' | 'shutdown';
export type ControlMode = 'FU' | 'NFU';
export type ControlStation = 'BRIDGE' | 'DP';
export type AlarmCode = 'LEVER_NOT_ZERO' | 'LOAD_CLIPPING' | 'EMERGENCY_STOP' | 'NOT_IN_COMMAND';

export const ALARM_TEXT: Record<AlarmCode, string> = {
  LEVER_NOT_ZERO: 'Start blocked: lever not at zero',
  LOAD_CLIPPING: 'Load clipping active: pitch limited',
  EMERGENCY_STOP: 'Emergency stop: motor tripped',
  NOT_IN_COMMAND: 'Bridge lever not in command',
};

export interface ThrusterParams {
  ratedPowerKW: number;
  /** Propeller speed at rated motor speed. */
  ratedRpm: number;
  maxThrustKN: number;
  /** Soft-starter ramp time from standstill to rated speed. */
  startRampS: number;
  /** Run-down time constant after the motor breaker opens. */
  coastTimeConstantS: number;
  /** Hydraulic pitch servo rate, fraction of full ahead per second. */
  pitchRatePerS: number;
  /** Fraction of rated power drawn at zero pitch and rated speed. */
  zeroPitchLoad: number;
  tunnelDiameterM: number;
  blades: number;
  /** Mechanical blade angle at full pitch, degrees. */
  maxBladeAngleDeg: number;
}

export const DEFAULT_THRUSTER_PARAMS: ThrusterParams = {
  ratedPowerKW: 800,
  ratedRpm: 300,
  maxThrustKN: 105,
  startRampS: 4,
  coastTimeConstantS: 2,
  pitchRatePerS: 0.25,
  zeroPitchLoad: 0.12,
  tunnelDiameterM: 2.1,
  blades: 4,
  maxBladeAngleDeg: 28,
};

export interface ThrusterState {
  status: ThrusterStatus;
  /** Status to return to when a paused simulation resumes. */
  resumeStatus: ThrusterStatus | null;
  /** Lever / pitch setpoint, validated and clamped to [-1, 1]. */
  command: number;
  /** Actual blade pitch, fraction of full, signed. */
  pitch: number;
  /** Propeller speed, rpm (always ahead rotation; direction comes from pitch). */
  rpm: number;
  /** Propeller shaft angle, radians, wrapped to [0, 2π). */
  angle: number;
  /** Lateral force, signed kN along scene +X (starboard). */
  thrustKN: number;
  /** Motor shaft power, kW. */
  powerKW: number;
  mode: ControlMode;
  station: ControlStation;
  /** Available power as a fraction of rated (power management / reduction zone). */
  powerLimit: number;
  loadClipping: boolean;
  alarms: AlarmCode[];
  acknowledged: AlarmCode[];
  /** Simulated time, seconds. */
  time: number;
}

export const initialThrusterState = (): ThrusterState => ({
  status: 'stopped',
  resumeStatus: null,
  command: 0,
  pitch: 0,
  rpm: 0,
  angle: 0,
  thrustKN: 0,
  powerKW: 0,
  mode: 'FU',
  station: 'BRIDGE',
  powerLimit: 1,
  loadClipping: false,
  alarms: [],
  acknowledged: [],
  time: 0,
});

export class InvalidCommandError extends Error {}

/** Validate and clamp a raw thrust command. Non-finite input is rejected, finite input is clamped. */
export function clampCommand(raw: unknown): number {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new InvalidCommandError('Thrust command must be a finite number');
  return Math.max(-1, Math.min(1, v));
}

export function thrustFrom(pitch: number, rpm: number, p: ThrusterParams = DEFAULT_THRUSTER_PARAMS): number {
  const n = rpm / p.ratedRpm;
  return p.maxThrustKN * Math.sign(pitch) * Math.abs(pitch) ** 1.5 * n * n;
}

export function powerFrom(pitch: number, rpm: number, p: ThrusterParams = DEFAULT_THRUSTER_PARAMS): number {
  const n = Math.abs(rpm) / p.ratedRpm;
  return p.ratedPowerKW * n ** 3 * (p.zeroPitchLoad + (1 - p.zeroPitchLoad) * Math.abs(pitch) ** 2.5);
}

/** Largest pitch magnitude whose power at rated speed stays within the limit. */
export function maxPitchForLimit(limit: number, p: ThrusterParams = DEFAULT_THRUSTER_PARAMS): number {
  if (limit >= 1) return 1;
  const x = (limit - p.zeroPitchLoad) / (1 - p.zeroPitchLoad);
  return x <= 0 ? 0 : x ** (1 / 2.5);
}

const TWO_PI = Math.PI * 2;
const STOP_EPS_RPM = 0.5;
const PITCH_ZERO_EPS = 0.02;
const LEVER_ZERO_EPS = 0.05;

/** Raise or clear an alarm. A cleared alarm also drops its acknowledgement, so a repeat needs a fresh one. */
function setAlarm(s: ThrusterState, code: AlarmCode, on: boolean): Pick<ThrusterState, 'alarms' | 'acknowledged'> {
  const has = s.alarms.includes(code);
  if (on === has) return { alarms: s.alarms, acknowledged: s.acknowledged };
  if (on) return { alarms: [...s.alarms, code], acknowledged: s.acknowledged };
  return { alarms: s.alarms.filter((a) => a !== code), acknowledged: s.acknowledged.filter((a) => a !== code) };
}

/** Advance the model by dt seconds. Pure: returns a new state. */
export function stepThruster(s: ThrusterState, dt: number, p: ThrusterParams = DEFAULT_THRUSTER_PARAMS): ThrusterState {
  if (!(dt > 0) || s.status === 'paused') return s;
  if (s.status === 'stopped' && s.rpm === 0) return s;

  let status = s.status;
  let rpm = s.rpm;
  let pitch = s.pitch;

  // Pitch setpoint: lever (clipped by load control) while the motor is under power, zero while stopping.
  const pMax = maxPitchForLimit(s.powerLimit, p);
  // In DP command the setpoint comes from the DP system (written through the controller), not the lever.
  const leverSet = s.command;
  const powered = status === 'starting' || status === 'running';
  const setpoint = powered && status === 'running' ? Math.sign(leverSet) * Math.min(Math.abs(leverSet), pMax) : 0;
  const loadClipping = powered && Math.abs(leverSet) > pMax + 1e-9;

  // The hydraulic pump is shaft driven, so the servo only moves the blades while the shaft turns.
  if (rpm > 0.2 * p.ratedRpm && status !== 'shutdown') {
    const maxStep = p.pitchRatePerS * dt;
    pitch += Math.max(-maxStep, Math.min(maxStep, setpoint - pitch));
  }

  if (status === 'starting') {
    rpm = Math.min(p.ratedRpm, rpm + (p.ratedRpm / p.startRampS) * dt);
    if (rpm >= p.ratedRpm) status = 'running';
  } else if (status === 'running') {
    rpm = p.ratedRpm;
  } else {
    // stopping: de-pitch first, then open the breaker and coast down. shutdown: coast immediately.
    const breakerOpen = status === 'shutdown' || status === 'stopped' || Math.abs(pitch) < PITCH_ZERO_EPS;
    if (breakerOpen) {
      rpm *= Math.exp(-dt / p.coastTimeConstantS);
      if (rpm < STOP_EPS_RPM) {
        rpm = 0;
        if (status === 'stopping') {
          status = 'stopped';
          pitch = 0;
        }
      }
    }
  }

  let angle = (s.angle + ((rpm * TWO_PI) / 60) * dt) % TWO_PI;
  if (angle < 0) angle += TWO_PI;
  return {
    ...s,
    ...setAlarm(s, 'LOAD_CLIPPING', loadClipping),
    status,
    rpm,
    pitch,
    angle,
    loadClipping,
    thrustKN: thrustFrom(pitch, rpm, p),
    powerKW: powerFrom(pitch, rpm, p),
    time: s.time + dt,
  };
}

export type ThrusterCommand =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'emergency-stop' }
  | { type: 'reset' }
  | { type: 'acknowledge' }
  | { type: 'set-command'; value: unknown }
  | { type: 'nudge'; delta: number }
  | { type: 'set-mode'; mode: ControlMode }
  | { type: 'set-station'; station: ControlStation }
  | { type: 'set-power-limit'; value: number };

/** Finite state machine for operator commands. Invalid transitions return the state unchanged. */
export function applyThrusterCommand(s: ThrusterState, cmd: ThrusterCommand): ThrusterState {
  switch (cmd.type) {
    case 'start': {
      if (s.status !== 'stopped' && s.status !== 'stopping') return s;
      // Start interlock: the bridge lever must be at zero so the propeller is not loaded on start.
      const leverZero = s.station !== 'BRIDGE' || Math.abs(s.command) <= LEVER_ZERO_EPS;
      if (!leverZero) return { ...s, ...setAlarm(s, 'LEVER_NOT_ZERO', true) };
      return { ...s, status: 'starting', ...setAlarm(s, 'LEVER_NOT_ZERO', false) };
    }
    case 'pause':
      return s.status === 'stopped' || s.status === 'paused' ? s : { ...s, status: 'paused', resumeStatus: s.status };
    case 'resume':
      return s.status === 'paused' ? { ...s, status: s.resumeStatus ?? 'running', resumeStatus: null } : s;
    case 'stop':
      if (s.status === 'stopped' || s.status === 'shutdown') return { ...s, command: 0 };
      return { ...s, status: 'stopping', resumeStatus: null, command: 0 };
    case 'emergency-stop':
      if (s.status === 'stopped' && s.rpm === 0) return s;
      return { ...s, status: 'shutdown', resumeStatus: null, ...setAlarm(s, 'EMERGENCY_STOP', true) };
    case 'reset':
      return initialThrusterState();
    case 'acknowledge':
      return { ...s, acknowledged: [...s.alarms] };
    case 'set-command': {
      const value = clampCommand(cmd.value);
      if (s.station !== 'BRIDGE') throw new InvalidCommandError('Bridge lever is not in command (DP has control)');
      const clean = { ...s, command: value };
      return Math.abs(value) <= LEVER_ZERO_EPS ? { ...clean, ...setAlarm(s, 'LEVER_NOT_ZERO', false) } : clean;
    }
    case 'nudge':
      return applyThrusterCommand(s, { type: 'set-command', value: Math.max(-1, Math.min(1, s.command + cmd.delta)) });
    case 'set-mode':
      return s.mode === cmd.mode ? s : { ...s, mode: cmd.mode };
    case 'set-station': {
      if (s.station === cmd.station) return s;
      // Bumpless transfer: the lever setpoint is zeroed when command leaves the bridge.
      return { ...s, station: cmd.station, command: 0, ...setAlarm(s, 'NOT_IN_COMMAND', cmd.station !== 'BRIDGE') };
    }
    case 'set-power-limit': {
      const v = Number(cmd.value);
      if (!Number.isFinite(v)) throw new InvalidCommandError('Power limit must be a finite number');
      return { ...s, powerLimit: Math.max(0.2, Math.min(1, v)) };
    }
  }
}

/** Alarms that are active and not yet acknowledged by the operator. */
export const unacknowledged = (s: ThrusterState) => s.alarms.filter((a) => !s.acknowledged.includes(a));
