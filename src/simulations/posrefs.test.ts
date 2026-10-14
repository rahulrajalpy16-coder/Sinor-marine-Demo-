import { describe, expect, it } from 'vitest';
import {
  applyPosRefCommand,
  initialPosRefState,
  KNOT,
  PosRefInterlockError,
  posRefReadiness,
  sprintNavAltitude,
  stepPosRefs,
  tautWireAngle,
  tautWireAxes,
  tautWireNmea,
  toWorld,
  TW_VERTICAL,
  type PosRefCommand,
  type PosRefState,
  type VesselPose,
} from './posrefs';
import { applyDPCommand, initialDPState, stepDP, type DPState } from './dp';
import { POLE_8097, SMT_TW, SPRINTNAV } from '../equipment/posrefData';

const still: VesselPose = { eta: [0, 0, 0], speed: 0 };
const run = (s: PosRefState, seconds: number, pose = still) => {
  for (let t = 0; t < seconds; t += 0.1) s = stepPosRefs(s, 0.1, pose);
  return s;
};
const cmd = (s: PosRefState, c: PosRefCommand, pose = still) => applyPosRefCommand(s, c, pose);

describe('position reference sensors', () => {
  it('maps vessel points to the scene like the 3D vessel transform', () => {
    expect(toWorld([0, 5, 10], [0, 0, 0])).toEqual([0, 5, 10]);
    const w = toWorld([0, 0, 10], [100, 50, Math.PI / 2]); // heading east: bow points +X
    expect(w[0]).toBeCloseTo(60);
    expect(w[2]).toBeCloseTo(100);
  });

  it('RadaScan locks on after acquisition; CyScan loses the reflector in fog, RadaScan does not', () => {
    let s = cmd(cmd(initialPosRefState(), { type: 'radascan', on: true }), { type: 'cyscan', on: true });
    expect(posRefReadiness(s, still).RADASCAN).toBe(false);
    s = run(s, 10);
    expect(s.radascan.phase).toBe('tracking');
    expect(s.cyscan.phase).toBe('tracking');
    expect(posRefReadiness(s, still)).toMatchObject({ RADASCAN: true, CYSCAN: true });
    s = run(cmd(s, { type: 'set-fog', on: true }), 1);
    expect(posRefReadiness(s, still)).toMatchObject({ RADASCAN: true, CYSCAN: false });
    expect(s.alarms).toContain('CYSCAN_NO_TARGET');
  });

  it('taut wire lowers the weight to the seabed, then measures the wire angle as the vessel moves', () => {
    let s = run(cmd(initialPosRefState(), { type: 'tw-deploy' }), 5);
    expect(s.tautwire.phase).toBe('lowering');
    s = run(s, TW_VERTICAL / SMT_TW.winchSpeed.value + 2);
    expect(s.tautwire.phase).toBe('on-bottom');
    expect(posRefReadiness(s, still).TAUTWIRE).toBe(true);
    expect(tautWireNmea(s, still.eta)).toMatch(/^\$PCPTW,000\.00,000\.00,A,00,\d{3}\.\d\*[0-9A-F]{2}$/);
    // 20 m east of where the weight landed: angle = atan(20 / vertical), above the 20° warning
    const moved: VesselPose = { eta: [0, 20, 0], speed: 0 };
    expect(tautWireAngle(s, moved.eta).angleDeg).toBeCloseTo((Math.atan2(20, TW_VERTICAL) * 180) / Math.PI, 3);
    // Vessel moved east (to starboard at heading 0), so the weight is inboard: across-ship angle negative.
    expect(tautWireAxes(s, moved.eta).across).toBeLessThan(-20);
    s = run(s, 1, moved);
    expect(s.alarms).toContain('TW_ANGLE_WARN');
    // Beyond the ±30° operating range
    const far: VesselPose = { eta: [0, 30, 0], speed: 0 };
    s = run(s, 1, far);
    expect(s.alarms).toContain('TW_ANGLE_LIMIT');
    expect(posRefReadiness(s, far).TAUTWIRE).toBe(false);
    s = run(cmd(s, { type: 'tw-recover' }), TW_VERTICAL / SMT_TW.winchSpeed.value + 2);
    expect(s.tautwire).toMatchObject({ phase: 'stowed', payout: 0, anchor: null });
  });

  it('SPRINT-Nav needs the pole deployed and locked, power, INS alignment and DVL bottom lock', () => {
    let s = cmd(initialPosRefState(), { type: 'sprintnav-power', on: true });
    s = run(s, SPRINTNAV.alignSeconds.value + 1);
    expect(s.sprintnav.align).toBe(1);
    expect(posRefReadiness(s, still).SPRINTNAV).toBe(false); // still stowed on deck
    s = run(cmd(s, { type: 'pole-deploy' }), POLE_8097.swingSeconds.value + 1);
    expect(s.pole.phase).toBe('locking');
    s = run(s, POLE_8097.lockSeconds.value + 0.5);
    expect(s.pole).toMatchObject({ phase: 'deployed', locked: true, angleDeg: 90 });
    const alt = sprintNavAltitude(90);
    expect(alt).toBeGreaterThan(SPRINTNAV.altitudeMin.value);
    expect(alt).toBeLessThan(SPRINTNAV.altitudeMax.value);
    expect(posRefReadiness(s, still).SPRINTNAV).toBe(true);
    // Above the pole's 5 kn operational speed the reference is withdrawn and an alarm raised.
    const fast: VesselPose = { eta: [0, 0, 0], speed: 6 * KNOT };
    expect(posRefReadiness(s, fast).SPRINTNAV).toBe(false);
    expect(run(s, 0.2, fast).alarms).toContain('POLE_OVERSPEED');
  });

  it('blocks deploying the pole above 5 kn', () => {
    expect(() => cmd(initialPosRefState(), { type: 'pole-deploy' }, { eta: [0, 0, 0], speed: 5.5 * KNOT })).toThrow(PosRefInterlockError);
  });

  it('reset returns everything to stowed and off', () => {
    let s = run(cmd(cmd(initialPosRefState(), { type: 'tw-deploy' }), { type: 'radascan', on: true }), 20);
    s = cmd(s, { type: 'reset' });
    expect(s).toEqual(initialPosRefState());
  });
});

describe('DP with the added references', () => {
  const ALL = { RADASCAN: true, CYSCAN: true, TAUTWIRE: true, SPRINTNAV: true };
  const runDP = (s: DPState, seconds: number, ready: Partial<Record<string, boolean>>) => {
    for (let t = 0; t < seconds; t += 0.05) s = stepDP(s, 0.05, { bt1: { available: true, forceN: 0 }, ready }).state;
    return s;
  };

  it('a selected reference that is not ready raises an alarm and is not used', () => {
    let s = applyDPCommand(applyDPCommand(initialDPState(2), { type: 'ref-enable', id: 'TAUTWIRE', enabled: true }), { type: 'start' });
    s = runDP(s, 5, {});
    expect(s.alarms).toContain('REF_NOT_READY');
    s = runDP(s, 5, { TAUTWIRE: true });
    expect(s.alarms).not.toContain('REF_NOT_READY');
    expect(s.refs.find((r) => r.id === 'TAUTWIRE')!.ready).toBe(true);
  });

  it('voting over seven references rejects a drifting taut wire', () => {
    let s = initialDPState(2);
    for (const id of ['RADASCAN', 'CYSCAN', 'TAUTWIRE', 'SPRINTNAV'] as const) s = applyDPCommand(s, { type: 'ref-enable', id, enabled: true });
    s = runDP(applyDPCommand(s, { type: 'start' }), 120, ALL);
    s = runDP(applyDPCommand(s, { type: 'ref-fault', id: 'TAUTWIRE', fault: 'drift' }), 200, ALL);
    expect(s.refs.find((r) => r.id === 'TAUTWIRE')!.rejected).toBe(true);
    expect(s.refs.filter((r) => r.rejected).map((r) => r.id)).toEqual(['TAUTWIRE']);
    expect(Math.hypot(s.eta[0], s.eta[1])).toBeLessThan(2.5);
  });
});
