import { createAppStore } from './useAppStore';
import { nextCameraMode, orbitLimitsFor, clampOutsideHull, overviewPoseFor, OVERVIEW_POSE } from '../camera/cameraMachine';
import { MODE_STYLES, isModeAvailable } from '../rendering/modes';
import { equipmentVisual } from '../interactions/equipmentVisual';
import { VISUAL_MODES } from '../equipment/types';

const pose = { position: [1, 2, 3] as [number, number, number], target: [0, 0, 0] as [number, number, number] };

describe('equipment selection', () => {
  it('selects a valid id, requests a focus flight and enters inspection', () => {
    const s = createAppStore();
    expect(s.getState().select('bow-thruster-001', pose)).toBe(true);
    const st = s.getState();
    expect(st.selectedId).toBe('bow-thruster-001');
    expect(st.phase).toBe('selected');
    expect(st.cameraMode).toBe('inspection');
    expect(st.cameraRequest.kind).toBe('focus');
    expect(st.savedPose).toEqual(pose);
    s.getState().focusArrived();
    expect(s.getState().phase).toBe('focused');
  });

  it('rejects unknown equipment', () => {
    const s = createAppStore();
    expect(s.getState().select('nope')).toBe(false);
    expect(s.getState().selectedId).toBeNull();
  });

  it('keeps the original context when hopping between systems, and Return restores it', () => {
    const s = createAppStore();
    s.getState().select('dp-console-001', pose);
    s.getState().select('hpr-001', { position: [9, 9, 9], target: [1, 1, 1] });
    expect(s.getState().savedPose).toEqual(pose);
    const seq = s.getState().cameraRequest.seq;
    s.getState().returnToPrevious();
    const st = s.getState();
    expect(st.selectedId).toBeNull();
    expect(st.phase).toBe('idle');
    expect(st.cameraMode).toBe('overview');
    expect(st.cameraRequest).toMatchObject({ seq: seq + 1, kind: 'restore', pose });
  });

  it('deselect and hover follow the state model', () => {
    const s = createAppStore();
    s.getState().hover('hpr-001');
    expect(s.getState().phase).toBe('hovered');
    s.getState().hover(null);
    expect(s.getState().phase).toBe('idle');
    s.getState().select('hpr-001');
    s.getState().deselect();
    expect(s.getState().selectedId).toBeNull();
  });

  it('inspect and simulate transitions', () => {
    const s = createAppStore();
    s.getState().startSimulating();
    expect(s.getState().phase).toBe('idle');
    s.getState().select('bow-thruster-001');
    s.getState().inspect();
    expect(s.getState().phase).toBe('inspecting');
    s.getState().startSimulating();
    expect(s.getState().phase).toBe('simulating');
    expect(s.getState().cameraMode).toBe('simulation');
    s.getState().stopSimulating();
    expect(s.getState().phase).toBe('inspecting');
    expect(s.getState().cameraMode).toBe('inspection');
  });
});

describe('camera modes', () => {
  it('reset always returns to overview', () => {
    for (const m of ['overview', 'orbit', 'guided', 'interior', 'inspection', 'simulation'] as const) {
      expect(nextCameraMode(m, { type: 'RESET' })).toBe('overview');
    }
  });
  it('user orbit only leaves overview/guided', () => {
    expect(nextCameraMode('overview', { type: 'USER_ORBIT' })).toBe('orbit');
    expect(nextCameraMode('inspection', { type: 'USER_ORBIT' })).toBe('inspection');
  });
  it('resetToOverview clears selection and requests the overview pose', () => {
    const s = createAppStore();
    s.getState().select('hpr-001', pose);
    s.getState().resetToOverview();
    expect(s.getState()).toMatchObject({ selectedId: null, cameraMode: 'overview', savedPose: null });
    expect(s.getState().cameraRequest.kind).toBe('overview');
  });
  it('restricts pitch above water in overview but allows looking up at underwater systems', () => {
    expect(orbitLimitsFor('overview', false).maxPolarAngle).toBeLessThan(Math.PI / 2);
    expect(orbitLimitsFor('inspection', true).maxPolarAngle).toBeGreaterThan(Math.PI / 2);
  });
  it('pulls the overview back on portrait screens', () => {
    expect(overviewPoseFor(16 / 9)).toBe(OVERVIEW_POSE);
    const p = overviewPoseFor(390 / 700).position;
    expect(Math.hypot(...p)).toBeGreaterThan(Math.hypot(...OVERVIEW_POSE.position) * 1.5);
  });
  it('clipping guard pushes a camera out of the hull volume', () => {
    expect(clampOutsideHull([1, 2, 3])).toEqual([9.5, 2, 3]);
    expect(clampOutsideHull([30, 2, 3])).toEqual([30, 2, 3]);
  });
});

describe('visual modes', () => {
  it('changing mode preserves selection and camera', () => {
    const s = createAppStore();
    s.getState().select('dp-console-001', pose);
    const before = { sel: s.getState().selectedId, cam: s.getState().cameraMode, req: s.getState().cameraRequest };
    for (const m of ['realistic', 'blueprint', 'xray', 'isolation', 'hybrid'] as const) {
      s.getState().setVisualMode(m);
      expect(s.getState().visualMode).toBe(m);
      expect(s.getState().selectedId).toBe(before.sel);
      expect(s.getState().cameraMode).toBe(before.cam);
      expect(s.getState().cameraRequest).toBe(before.req);
    }
  });
  it('exploded mode is only available for an explodable assembly and is left on deselect', () => {
    const s = createAppStore();
    s.getState().setVisualMode('exploded');
    expect(s.getState().visualMode).toBe('hybrid');
    s.getState().select('hpr-001');
    s.getState().setVisualMode('exploded');
    expect(s.getState().visualMode).toBe('hybrid');
    s.getState().select('bow-thruster-001');
    s.getState().setVisualMode('exploded');
    expect(s.getState().visualMode).toBe('exploded');
    s.getState().deselect();
    expect(s.getState().visualMode).toBe('hybrid');
    s.getState().select('bow-thruster-001');
    s.getState().setVisualMode('exploded');
    s.getState().select('hpr-001');
    expect(s.getState().visualMode).toBe('hybrid');
    expect(isModeAvailable('exploded', false)).toBe(false);
  });
  it('every mode keeps something visible (no blank scene)', () => {
    for (const m of VISUAL_MODES) {
      const st = MODE_STYLES[m];
      expect(st.hull !== 'hidden' || st.lines !== 'none').toBe(true);
    }
  });
  it('isolation ghosts everything except the selection', () => {
    const base = { selectedId: 'hpr-001', hoveredId: null, visualMode: 'isolation' as const };
    expect(equipmentVisual('hpr-001', base).ghost).toBe(false);
    expect(equipmentVisual('dp-console-001', base).ghost).toBe(true);
    expect(equipmentVisual('dp-console-001', { ...base, visualMode: 'hybrid' }).ghost).toBe(false);
    expect(equipmentVisual('hpr-001', base).outline).toBe(true);
  });
});
