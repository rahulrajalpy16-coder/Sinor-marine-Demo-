/**
 * Type 7950 through-hull deployment: pole travel, 14" gate valve and seachest inspection door.
 *
 * From the documents: the pole is hydraulically operated, the machine sits on a gate valve over the
 * hull penetration, the seachest has an inspection door, and operation is local or from a remote
 * control panel. The travel speed, valve stroke time and the interlocks below are NOT in the
 * supplied documents. They are simulation assumptions, labelled as such in the HMI.
 */
import { STROKE } from '../equipment/hprData';

/** Illustrative only: no hydraulic or speed data was supplied for the 7950. */
export const ASSUMED_POLE_SPEED = 0.1; // m/s
export const ASSUMED_VALVE_SECONDS = 8;

export type ValveState = 'closed' | 'opening' | 'open' | 'closing';
export type Motion = 'idle' | 'deploying' | 'retracting';
export type ControlPlace = 'LOCAL' | 'REMOTE';
export type DeployAlarm = 'ESTOP' | 'STOPPED_MID_TRAVEL' | 'DOOR_OPEN';

export const DEPLOY_ALARM_TEXT: Record<DeployAlarm, string> = {
  ESTOP: 'Emergency stop: machine halted (latched until reset)',
  STOPPED_MID_TRAVEL: 'Pole stopped between parked and deployed',
  DOOR_OPEN: 'Seachest inspection door open',
};

export interface DeploymentState {
  /** Pole travel from the parked position, metres (0 … STROKE). */
  travel: number;
  motion: Motion;
  valve: ValveState;
  /** Gate valve opening, 0 closed … 1 open. */
  valveOpen: number;
  doorOpen: boolean;
  place: ControlPlace;
  estop: boolean;
  alarms: DeployAlarm[];
  acknowledged: DeployAlarm[];
  time: number;
}

export type DeployStatus =
  | 'PARKED'
  | 'DOOR OPEN'
  | 'VALVE OPENING'
  | 'VALVE CLOSING'
  | 'READY TO DEPLOY'
  | 'DEPLOYING'
  | 'DEPLOYED'
  | 'RETRACTING'
  | 'STOPPED'
  | 'E-STOP';

export type DeployCommand =
  | { type: 'open-valve' }
  | { type: 'close-valve' }
  | { type: 'open-door' }
  | { type: 'close-door' }
  | { type: 'deploy' }
  | { type: 'retract' }
  | { type: 'stop' }
  | { type: 'emergency-stop' }
  | { type: 'reset' }
  | { type: 'acknowledge' }
  | { type: 'set-place'; place: ControlPlace };

export class InterlockError extends Error {}

export const initialDeploymentState = (): DeploymentState => ({
  travel: 0,
  motion: 'idle',
  valve: 'closed',
  valveOpen: 0,
  doorOpen: false,
  place: 'REMOTE',
  estop: false,
  alarms: [],
  acknowledged: [],
  time: 0,
});

const EPS = 1e-6;
export const isParked = (s: DeploymentState) => s.travel <= EPS && s.motion === 'idle';
export const isDeployed = (s: DeploymentState) => s.travel >= STROKE - EPS;

/** The HPR can serve as a DP position reference only when fully deployed through an open valve. */
export const hprReady = (s: DeploymentState) => isDeployed(s) && s.valve === 'open' && !s.estop;

export function deployStatus(s: DeploymentState): DeployStatus {
  if (s.estop) return 'E-STOP';
  if (s.motion === 'deploying') return 'DEPLOYING';
  if (s.motion === 'retracting') return 'RETRACTING';
  if (s.valve === 'opening') return 'VALVE OPENING';
  if (s.valve === 'closing') return 'VALVE CLOSING';
  if (isDeployed(s)) return 'DEPLOYED';
  if (s.travel > EPS) return 'STOPPED';
  if (s.doorOpen) return 'DOOR OPEN';
  return s.valve === 'open' ? 'READY TO DEPLOY' : 'PARKED';
}

function withAlarms(s: DeploymentState): DeploymentState {
  const want: DeployAlarm[] = [];
  if (s.estop) want.push('ESTOP');
  if (s.motion === 'idle' && s.travel > EPS && !isDeployed(s)) want.push('STOPPED_MID_TRAVEL');
  if (s.doorOpen) want.push('DOOR_OPEN');
  const same = want.length === s.alarms.length && want.every((a) => s.alarms.includes(a));
  if (same) return s;
  return { ...s, alarms: want, acknowledged: s.acknowledged.filter((a) => want.includes(a)) };
}

/** Apply an operator command. Throws InterlockError (state unchanged) when an interlock blocks it. */
export function applyDeployCommand(s: DeploymentState, cmd: DeployCommand): DeploymentState {
  const block = (why: string) => {
    throw new InterlockError(why);
  };
  if (s.estop && !['reset', 'acknowledge', 'set-place', 'emergency-stop'].includes(cmd.type)) block('Emergency stop is latched: reset first');
  switch (cmd.type) {
    case 'set-place':
      return { ...s, place: cmd.place };
    case 'open-valve':
      if (s.doorOpen) block('Close the seachest inspection door before opening the gate valve');
      if (s.valve === 'open' || s.valve === 'opening') return s;
      return { ...s, valve: 'opening' };
    case 'close-valve':
      if (!isParked(s)) block('Retract the pole fully before closing the gate valve');
      if (s.valve === 'closed' || s.valve === 'closing') return s;
      return { ...s, valve: 'closing' };
    case 'open-door':
      if (!isParked(s)) block('The transceiver must be parked in the seachest');
      if (s.valve !== 'closed') block('Close the gate valve before opening the seachest door');
      return withAlarms({ ...s, doorOpen: true });
    case 'close-door':
      return withAlarms({ ...s, doorOpen: false });
    case 'deploy':
      if (s.doorOpen) block('Seachest inspection door is open');
      if (s.valve !== 'open') block('Open the gate valve fully before deploying');
      if (isDeployed(s)) return s;
      return withAlarms({ ...s, motion: 'deploying' });
    case 'retract':
      if (s.travel <= EPS) return s;
      return withAlarms({ ...s, motion: 'retracting' });
    case 'stop':
      return withAlarms({ ...s, motion: 'idle', valve: s.valve === 'opening' || s.valve === 'closing' ? (s.valveOpen > 0.5 ? 'open' : 'closed') : s.valve });
    case 'emergency-stop':
      return withAlarms({ ...s, estop: true, motion: 'idle', valve: s.valve === 'opening' ? 'open' : s.valve === 'closing' ? 'closed' : s.valve, acknowledged: [] });
    case 'reset':
      return initialDeploymentState();
    case 'acknowledge':
      return { ...s, acknowledged: [...s.alarms] };
  }
}

/** Advance by dt seconds. Pure. */
export function stepDeployment(s: DeploymentState, dt: number): DeploymentState {
  if (!(dt > 0)) return s;
  let n: DeploymentState = { ...s, time: s.time + dt };
  if (n.valve === 'opening' || n.valve === 'closing') {
    const dir = n.valve === 'opening' ? 1 : -1;
    const open = Math.min(1, Math.max(0, n.valveOpen + (dir * dt) / ASSUMED_VALVE_SECONDS));
    n = { ...n, valveOpen: open, valve: open >= 1 ? 'open' : open <= 0 ? 'closed' : n.valve };
  }
  if (n.motion !== 'idle') {
    const dir = n.motion === 'deploying' ? 1 : -1;
    const travel = Math.min(STROKE, Math.max(0, n.travel + dir * ASSUMED_POLE_SPEED * dt));
    const done = (dir > 0 && travel >= STROKE) || (dir < 0 && travel <= 0);
    n = { ...n, travel, motion: done ? 'idle' : n.motion };
  }
  return withAlarms(n);
}

export const unacknowledgedDeploy = (s: DeploymentState) => s.alarms.filter((a) => !s.acknowledged.includes(a));
