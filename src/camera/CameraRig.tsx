import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { vesselMatrix } from '../scene/vesselTransform';
import gsap from 'gsap';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useAppStore } from '../store/useAppStore';
import { INTRO_START_POSE, OVERVIEW_POSE, orbitLimitsFor, overviewPoseFor, type CameraPose } from './cameraMachine';
import { registerPoseProvider } from '../interactions/poseRegistry';
import { getEquipment } from '../equipment/registry';
import { reveal } from '../scene/reveal';
import { ORBIT_MOUSE, ORBIT_TOUCH, isEditableTarget, keyAction, orbitStep, orbitTuning } from '../interactions/input';
import { useDevice } from '../responsive/useDevice';

// Wall-clock timing even on slow (software-rendered) frames: a focus flight always ends on time.
gsap.ticker.lagSmoothing(0);

const FOCUS_SECONDS = 1.3;
const INTRO_SECONDS = 6;

/**
 * Owns the camera: orbit controls, GSAP focus flights, orbit limits per camera mode.
 * It reacts to store camera requests; it never changes selection or visual mode.
 */
export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const request = useAppStore((s) => s.cameraRequest);
  const cameraMode = useAppStore((s) => s.cameraMode);
  const selectedId = useAppStore((s) => s.selectedId);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const layout = useDevice((s) => s.layout);
  const coarse = useDevice((s) => s.coarse);
  const tuning = orbitTuning(layout, coarse);

  // Expose the live pose so Return can restore it later.
  useEffect(() => {
    registerPoseProvider(() => ({
      position: camera.position.toArray() as [number, number, number],
      target: (controls.current?.target.toArray() as [number, number, number]) ?? OVERVIEW_POSE.target,
    }));
    return () => registerPoseProvider(null);
  }, [camera]);

  // Orbit limits follow the camera mode; underwater systems may look up from below the surface.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const pl = selectedId ? getEquipment(selectedId)?.placement : undefined;
    const lim = orbitLimitsFor(cameraMode, !!pl?.underwater, !!pl?.interior, pl?.interiorMaxDistance);
    c.minDistance = lim.minDistance;
    c.maxDistance = lim.maxDistance;
    c.minPolarAngle = lim.minPolarAngle;
    c.maxPolarAngle = lim.maxPolarAngle;
  }, [cameraMode, selectedId]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    tl.current?.kill();
    const store = useAppStore.getState();

    const fly = (pose: CameraPose, seconds: number, onDone?: () => void) => {
      // Loosen limits during the flight; the effect above restores them.
      c.minDistance = 0.1;
      c.maxDistance = 1000;
      c.minPolarAngle = 0;
      c.maxPolarAngle = Math.PI;
      const dur = reducedMotion ? 0 : seconds;
      store.setCameraMoving(true);
      const t = gsap.timeline({
        onUpdate: () => c.update(),
        onComplete: () => {
          c.update();
          useAppStore.getState().setCameraMoving(false);
          const st = useAppStore.getState();
          const pl = st.selectedId ? getEquipment(st.selectedId)?.placement : undefined;
          Object.assign(c, orbitLimitsFor(st.cameraMode, !!pl?.underwater, !!pl?.interior, pl?.interiorMaxDistance));
          onDone?.();
        },
      });
      t.to(camera.position, { x: pose.position[0], y: pose.position[1], z: pose.position[2], duration: dur, ease: 'power2.inOut' }, 0);
      t.to(c.target, { x: pose.target[0], y: pose.target[1], z: pose.target[2], duration: dur, ease: 'power2.inOut' }, 0);
      tl.current = t;
    };

    // Equipment anchors are in vessel coordinates; the vessel may have moved under DP.
    const onVessel = (pose: CameraPose): CameraPose => {
      const m = vesselMatrix();
      const p = new THREE.Vector3(...pose.position).applyMatrix4(m);
      const t = new THREE.Vector3(...pose.target).applyMatrix4(m);
      return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
    };
    switch (request.kind) {
      case 'focus':
        if (request.pose) fly(onVessel(request.pose), FOCUS_SECONDS, () => useAppStore.getState().focusArrived());
        break;
      case 'restore':
        if (request.pose) fly(request.pose, FOCUS_SECONDS);
        break;
      case 'overview':
        reveal.set(1);
        fly(overviewPoseFor(size.width / size.height), request.seq === 0 ? 0 : FOCUS_SECONDS);
        break;
      case 'intro': {
        if (reducedMotion) {
          reveal.set(1);
          fly(overviewPoseFor(size.width / size.height), 0, () => useAppStore.getState().endIntro());
          break;
        }
        camera.position.set(...INTRO_START_POSE.position);
        c.target.set(...INTRO_START_POSE.target);
        c.update();
        reveal.set(0);
        const proxy = { r: 0 };
        fly(overviewPoseFor(size.width / size.height), INTRO_SECONDS, () => useAppStore.getState().endIntro());
        tl.current?.to(proxy, { r: 1, duration: INTRO_SECONDS * 0.85, ease: 'none', onUpdate: () => reveal.set(proxy.r) }, 0);
        break;
      }
    }
    return () => {
      tl.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.seq]);

  // Ride with the vessel: apply the frame-to-frame change of the vessel pose to camera and target,
  // so an inspected system stays framed while the DP model moves the ship.
  const prevM = useRef(new THREE.Matrix4());
  const curM = useRef(new THREE.Matrix4());
  const delta = useRef(new THREE.Matrix4());
  const first = useRef(true);
  useFrame(() => {
    const c = controls.current;
    vesselMatrix(curM.current);
    if (first.current) {
      prevM.current.copy(curM.current);
      first.current = false;
      return;
    }
    if (curM.current.equals(prevM.current) || !c) return;
    const st = useAppStore.getState();
    if (st.selectedId) {
      delta.current.copy(curM.current).multiply(prevM.current.clone().invert());
      camera.position.applyMatrix4(delta.current);
      c.target.applyMatrix4(delta.current);
      c.update();
    }
    prevM.current.copy(curM.current);
  });

  // Rotation or resize while in the overview: re-fit the hull to the new aspect ratio.
  const aspect = size.width / Math.max(1, size.height);
  const lastAspect = useRef(aspect);
  useEffect(() => {
    const prev = lastAspect.current;
    lastAspect.current = aspect;
    if (Math.abs(prev - aspect) < 0.05) return;
    const st = useAppStore.getState();
    if (st.cameraMode !== 'overview' || st.cameraMoving || st.introActive || st.selectedId) return;
    useAppStore.setState({ cameraRequest: { seq: st.cameraRequest.seq + 1, kind: 'overview' } });
  }, [aspect]);

  // Keyboard camera: arrows orbit (Shift for bigger steps), +/- zoom, Home or O overview, F refocus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isEditableTarget(e.target)) return;
      const a = keyAction(e.key, e.shiftKey);
      const c = controls.current;
      if (!a || !c) return;
      const st = useAppStore.getState();
      if (a.kind === 'overview') {
        st.resetToOverview();
      } else if (a.kind === 'focus') {
        if (st.selectedId) st.select(st.selectedId);
      } else {
        if (st.introActive) st.endIntro();
        if (st.cameraMoving) tl.current?.progress(1);
        const pl = st.selectedId ? getEquipment(st.selectedId)?.placement : undefined;
        const lim = orbitLimitsFor(st.cameraMode, !!pl?.underwater, !!pl?.interior, pl?.interiorMaxDistance);
        const next = orbitStep(
          { position: camera.position.toArray() as CameraPose['position'], target: c.target.toArray() as CameraPose['target'] },
          a.kind === 'orbit' ? { azimuth: a.azimuth, polar: a.polar } : { zoom: a.factor },
          lim,
        );
        camera.position.set(...next.position);
        c.update();
        st.cameraEvent({ type: 'USER_ORBIT' });
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [camera]);

  // A user drag interrupts any flight and counts as free orbiting.
  const onStart = () => {
    const st = useAppStore.getState();
    if (st.introActive) {
      // Dragging during the intro skips it in place, without flying away from the user's hands.
      tl.current?.kill();
      reveal.set(1);
      st.setCameraMoving(false);
      useAppStore.setState({ introActive: false, cameraMode: 'orbit' });
      Object.assign(controls.current!, orbitLimitsFor('orbit', false));
      return;
    }
    if (st.cameraMoving) {
      tl.current?.progress(1);
    }
    st.cameraEvent({ type: 'USER_ORBIT' });
  };

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={tuning.dampingFactor}
      rotateSpeed={tuning.rotateSpeed}
      zoomSpeed={tuning.zoomSpeed}
      panSpeed={tuning.panSpeed}
      mouseButtons={ORBIT_MOUSE}
      touches={ORBIT_TOUCH}
      onStart={onStart}
    />
  );
}
