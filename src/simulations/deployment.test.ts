import { describe, expect, it } from 'vitest';
import {
  ASSUMED_POLE_SPEED,
  ASSUMED_VALVE_SECONDS,
  InterlockError,
  applyDeployCommand,
  deployStatus,
  hprReady,
  initialDeploymentState,
  stepDeployment,
  type DeploymentState,
} from './deployment';
import { DEPLOYED_FACE_BELOW_HULL, HPT5000, PARKED_FLANGE_Y, STROKE, T7950, transceiverY } from '../equipment/hprData';
import { initialDPState, applyDPCommand, stepDP } from './dp';

const run = (s: DeploymentState, seconds: number, dt = 0.05) => {
  for (let t = 0; t < seconds; t += dt) s = stepDeployment(s, dt);
  return s;
};
const openValve = (s: DeploymentState) => run(applyDeployCommand(s, { type: 'open-valve' }), ASSUMED_VALVE_SECONDS + 0.5);
const deployFully = (s: DeploymentState) => run(applyDeployCommand(openValve(s), { type: 'deploy' }), STROKE / ASSUMED_POLE_SPEED + 1);

describe('Type 7950 geometry from the drawings', () => {
  it('uses the dimensioned reference points', () => {
    expect(T7950.overall.value).toBe(5.93);
    expect(T7950.deployedExtension.value).toBe(2.775);
    expect(T7950.gateStackTop.value).toBe(0.29);
    expect(T7950.seachestTop.value).toBeCloseTo(1.329, 6);
    expect(T7950.sealingFlange.value).toBeCloseTo(1.544, 6);
    expect(T7950.topSectionBase.value).toBeCloseTo(1.758, 6);
    expect(T7950.penetratorHeight.value).toBe(0.15);
    // Machine plus penetrator fits the 6.1 m mounting space.
    expect(T7950.overall.value + T7950.penetratorHeight.value).toBeLessThanOrEqual(T7950.mountingSpace.height.value);
  });
  it('deploys the transceiver flange to the 2,775 mm reference and its face 2–3 m below the hull', () => {
    expect(transceiverY(STROKE).flange).toBeCloseTo(-2.775, 6);
    expect(transceiverY(0).flange).toBeCloseTo(PARKED_FLANGE_Y, 6);
    // Parked: the whole transceiver is above the gate valve, inside the seachest.
    expect(transceiverY(0).face).toBeGreaterThan(T7950.gateStackTop.value);
    expect(transceiverY(0).flange).toBeLessThan(T7950.seachestTop.value);
    expect(DEPLOYED_FACE_BELOW_HULL).toBeCloseTo(2.775 - 0.15 + HPT5000.length.value, 6);
    expect(DEPLOYED_FACE_BELOW_HULL).toBeGreaterThanOrEqual(2);
    expect(DEPLOYED_FACE_BELOW_HULL).toBeLessThanOrEqual(3);
  });
  it('keeps every unverified value labelled', () => {
    expect(T7950.parkClearance.source).toBe('assumed');
    expect(T7950.poleDiameter.source).toBe('scaled');
    expect(HPT5000.length.source).toBe('manual');
  });
});

describe('Type 7950 deployment sequence and interlocks', () => {
  it('starts parked with the gate valve closed and the HPR unavailable', () => {
    const s = initialDeploymentState();
    expect(deployStatus(s)).toBe('PARKED');
    expect(hprReady(s)).toBe(false);
  });
  it('will not deploy through a closed or partly open gate valve', () => {
    const s = initialDeploymentState();
    expect(() => applyDeployCommand(s, { type: 'deploy' })).toThrow(InterlockError);
    const opening = run(applyDeployCommand(s, { type: 'open-valve' }), 2);
    expect(deployStatus(opening)).toBe('VALVE OPENING');
    expect(() => applyDeployCommand(opening, { type: 'deploy' })).toThrow(/gate valve/);
  });
  it('opens the valve, deploys to full stroke and becomes a usable reference', () => {
    const open = openValve(initialDeploymentState());
    expect(deployStatus(open)).toBe('READY TO DEPLOY');
    let s = applyDeployCommand(open, { type: 'deploy' });
    s = run(s, 5);
    expect(deployStatus(s)).toBe('DEPLOYING');
    expect(s.travel).toBeCloseTo(5 * ASSUMED_POLE_SPEED, 1);
    s = run(s, STROKE / ASSUMED_POLE_SPEED);
    expect(deployStatus(s)).toBe('DEPLOYED');
    expect(s.travel).toBeCloseTo(STROKE, 6);
    expect(hprReady(s)).toBe(true);
  });
  it('will not close the gate valve on the pole, and closes it once retracted', () => {
    const s = deployFully(initialDeploymentState());
    expect(() => applyDeployCommand(s, { type: 'close-valve' })).toThrow(/Retract/);
    const parked = run(applyDeployCommand(s, { type: 'retract' }), STROKE / ASSUMED_POLE_SPEED + 1);
    expect(parked.travel).toBe(0);
    const closed = run(applyDeployCommand(parked, { type: 'close-valve' }), ASSUMED_VALVE_SECONDS + 0.5);
    expect(deployStatus(closed)).toBe('PARKED');
  });
  it('seachest door only opens with the transceiver parked and the valve closed; an open door blocks the valve', () => {
    const s = initialDeploymentState();
    const door = applyDeployCommand(s, { type: 'open-door' });
    expect(deployStatus(door)).toBe('DOOR OPEN');
    expect(door.alarms).toContain('DOOR_OPEN');
    expect(() => applyDeployCommand(door, { type: 'open-valve' })).toThrow(/door/);
    expect(() => applyDeployCommand(openValve(s), { type: 'open-door' })).toThrow(/Close the gate valve/);
  });
  it('stop holds the pole mid travel with an alarm; E-stop latches until reset', () => {
    let s = run(applyDeployCommand(openValve(initialDeploymentState()), { type: 'deploy' }), 6);
    s = applyDeployCommand(s, { type: 'stop' });
    const held = run(s, 3);
    expect(held.travel).toBeCloseTo(s.travel, 6);
    expect(deployStatus(held)).toBe('STOPPED');
    expect(held.alarms).toContain('STOPPED_MID_TRAVEL');
    const e = applyDeployCommand(applyDeployCommand(held, { type: 'deploy' }), { type: 'emergency-stop' });
    expect(deployStatus(e)).toBe('E-STOP');
    expect(() => applyDeployCommand(e, { type: 'retract' })).toThrow(/Emergency/);
    expect(run(e, 2).travel).toBeCloseTo(e.travel, 6);
    const acked = applyDeployCommand(e, { type: 'acknowledge' });
    expect(acked.acknowledged).toEqual(acked.alarms);
    expect(deployStatus(applyDeployCommand(e, { type: 'reset' }))).toBe('PARKED');
  });
  it('a blocked command leaves the state unchanged', () => {
    const s = initialDeploymentState();
    try {
      applyDeployCommand(s, { type: 'deploy' });
    } catch {
      /* expected */
    }
    expect(s).toEqual(initialDeploymentState());
  });
});

describe('HPR as a DP position reference', () => {
  it('is unusable and alarmed in DP until the transceiver is deployed', () => {
    let dp = applyDPCommand(initialDPState(2), { type: 'start' });
    const input = (ready: boolean) => ({ bt1: { available: false, forceN: 0 }, hpr: { ready } });
    for (let i = 0; i < 20; i++) dp = stepDP(dp, 0.05, input(false)).state;
    expect(dp.refs.find((r) => r.id === 'HPR')!.ready).toBe(false);
    expect(dp.alarms).toContain('HPR_NOT_DEPLOYED');
    for (let i = 0; i < 20; i++) dp = stepDP(dp, 0.05, input(true)).state;
    expect(dp.refs.find((r) => r.id === 'HPR')!.ready).toBe(true);
    expect(dp.alarms).not.toContain('HPR_NOT_DEPLOYED');
  });
  it('DP1 with the HPR parked falls back to its single GNSS', () => {
    let dp = applyDPCommand(applyDPCommand(initialDPState(1), { type: 'start' }), { type: 'ref-fault', id: 'GNSS1', fault: 'lost' });
    for (let i = 0; i < 20; i++) dp = stepDP(dp, 0.05, { bt1: { available: false, forceN: 0 }, hpr: { ready: false } }).state;
    expect(dp.alarms).toContain('DEAD_RECKONING');
  });
});
