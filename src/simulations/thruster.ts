/**
 * Bow tunnel thruster: illustrative, non-certified educational model.
 *
 * Signed command u in [-1, 1] (+ pushes the bow to starboard, i.e. force along +X).
 * Propeller speed follows the command with a first-order lag:  dn/dt = (u * nMax - n) / tau.
 * Thrust scales with the square of propeller speed:            F = Fmax * sign(n) * (n / nMax)^2.
 * The tunnel is fixed: there is deliberately no azimuth input.
 */

export type ThrusterStatus = 'stopped' | 'running' | 'paused' | 'stopping';

export interface ThrusterParams {
  maxRpm: number;
  maxThrustKN: number;
  timeConstantS: number;
}

export interface ThrusterState {
  status: ThrusterStatus;
  /** Validated, clamped command in [-1, 1]. */
  command: number;
  /** Propeller speed, signed, rpm. */
  rpm: number;
  /** Propeller shaft angle, radians, wrapped to [0, 2π). */
  angle: number;
  /** Lateral force, signed kN along scene +X (starboard). */
  thrustKN: number;
  /** Simulated time, seconds. */
  time: number;
}

export const DEFAULT_THRUSTER_PARAMS: ThrusterParams = { maxRpm: 300, maxThrustKN: 120, timeConstantS: 1.2 };

export const initialThrusterState = (): ThrusterState => ({
  status: 'stopped',
  command: 0,
  rpm: 0,
  angle: 0,
  thrustKN: 0,
  time: 0,
});

export class InvalidCommandError extends Error {}

/** Validate and clamp a raw thrust command. Non-finite input is rejected, finite input is clamped. */
export function clampCommand(raw: unknown): number {
  const v = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new InvalidCommandError('Thrust command must be a finite number');
  return Math.max(-1, Math.min(1, v));
}

export function thrustFromRpm(rpm: number, p: ThrusterParams = DEFAULT_THRUSTER_PARAMS): number {
  const r = rpm / p.maxRpm;
  return p.maxThrustKN * Math.sign(r) * r * r;
}

const TWO_PI = Math.PI * 2;
const STOP_EPS_RPM = 0.5;

/** Advance the model by dt seconds. Pure: returns a new state. */
export function stepThruster(s: ThrusterState, dt: number, p: ThrusterParams = DEFAULT_THRUSTER_PARAMS): ThrusterState {
  if (!(dt > 0) || s.status === 'paused' || s.status === 'stopped') return s;
  const target = s.status === 'stopping' ? 0 : s.command * p.maxRpm;
  // Exact discretisation of the first-order lag: unconditionally stable for any dt.
  const k = 1 - Math.exp(-dt / p.timeConstantS);
  let rpm = s.rpm + (target - s.rpm) * k;
  let status: ThrusterStatus = s.status;
  if (status === 'stopping' && Math.abs(rpm) < STOP_EPS_RPM) {
    rpm = 0;
    status = 'stopped';
  }
  const omega = (rpm * TWO_PI) / 60;
  let angle = (s.angle + omega * dt) % TWO_PI;
  if (angle < 0) angle += TWO_PI;
  return { ...s, status, rpm, angle, thrustKN: thrustFromRpm(rpm, p), time: s.time + dt };
}

export type ThrusterCommand =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  | { type: 'reset' }
  | { type: 'set-command'; value: unknown };

/** Finite state machine for operator commands. Invalid transitions return the state unchanged. */
export function applyThrusterCommand(s: ThrusterState, cmd: ThrusterCommand): ThrusterState {
  switch (cmd.type) {
    case 'start':
      return s.status === 'stopped' || s.status === 'stopping' ? { ...s, status: 'running' } : s;
    case 'pause':
      return s.status === 'running' ? { ...s, status: 'paused' } : s;
    case 'resume':
      return s.status === 'paused' ? { ...s, status: 'running' } : s;
    case 'stop':
      if (s.status === 'stopped') return { ...s, command: 0 };
      return { ...s, status: 'stopping', command: 0 };
    case 'reset':
      return initialThrusterState();
    case 'set-command':
      return { ...s, command: clampCommand(cmd.value) };
  }
}
