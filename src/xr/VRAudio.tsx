import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { bowThruster } from '../simulations/controller';
import { dpSystem } from '../simulations/dpController';
import { DEFAULT_DP_PARAMS } from '../simulations/dp';
import { DEFAULT_THRUSTER_PARAMS } from '../simulations/thruster';
import { AZIMUTHS, BOW_THRUSTERS } from '../vessels/vesselLayout';
import { useVRComfort } from './vrComfort';
import { readHeadPose } from './vrState';

/** Thruster sound level from its load (0 idle … 1 full), with a floor for a unit that is turning but not pushing. */
export function thrusterGain(load: number, running: boolean): number {
  if (!running) return 0;
  return 0.12 + 0.88 * Math.min(1, Math.max(0, Math.abs(load)));
}

/** Looping brown noise: a deep rumble that a low-pass filter turns into machinery hum. */
function brownNoise(ctx: AudioContext, seconds = 4): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

// In the VR player's frame (vessel x negated; the units are symmetric, so the numbers carry over).
const SOURCES = [
  { id: 'BT1', pos: [0, BOW_THRUSTERS.y, BOW_THRUSTERS.bt1Z] },
  { id: 'BT2', pos: [0, BOW_THRUSTERS.y, BOW_THRUSTERS.bt2Z] },
  { id: 'AZ1', pos: [AZIMUTHS.x, AZIMUTHS.y, AZIMUTHS.z] },
  { id: 'AZ2', pos: [-AZIMUTHS.x, AZIMUTHS.y, AZIMUTHS.z] },
] as const;

/**
 * Spatial machinery sound in VR: each bow tunnel thruster and stern azimuth hums from where it sits, louder and
 * brighter as it pushes harder, so you hear the bow thruster ahead of you on the bridge and the azimuths under the
 * aft deck. A quiet wash of sea underneath. Off when comfort settings turn sound off.
 */
export function VRAudio() {
  const camera = useThree((s) => s.camera);
  const parts = useMemo(() => {
    const listener = new THREE.AudioListener();
    const ctx = listener.context;
    const noise = brownNoise(ctx);
    const sources = SOURCES.map((s) => {
      const a = new THREE.PositionalAudio(listener);
      a.setBuffer(noise);
      a.setLoop(true);
      a.setRefDistance(5);
      a.setRolloffFactor(1.2);
      a.setDistanceModel('inverse');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 160;
      a.setFilter(lp);
      a.setVolume(0);
      a.position.set(...(s.pos as unknown as [number, number, number]));
      // Different start points so the four units do not sound identical.
      a.offset = Math.random() * 3;
      return { id: s.id, audio: a, lp };
    });
    const sea = new THREE.Audio(listener);
    sea.setBuffer(noise);
    sea.setLoop(true);
    sea.setVolume(0.08);
    sea.setPlaybackRate(1.6);
    return { listener, sources, sea };
  }, []);

  const scene = useThree((s) => s.scene);
  useEffect(() => {
    // The listener sits at the scene root and copies the head pose each frame (see readHeadPose).
    scene.add(parts.listener);
    void parts.listener.context.resume();
    for (const s of parts.sources) s.audio.play();
    parts.sea.play();
    return () => {
      for (const s of parts.sources) s.audio.stop();
      parts.sea.stop();
      scene.remove(parts.listener);
    };
  }, [scene, parts]);

  useFrame(() => {
    readHeadPose(camera, parts.listener.position, parts.listener.quaternion);
    parts.listener.setMasterVolume(useVRComfort.getState().sound ? 1 : 0);
    const bt = bowThruster.getState();
    const dp = dpSystem.getState();
    for (const s of parts.sources) {
      let gain = 0;
      if (s.id === 'BT1') gain = thrusterGain((bt.rpm / DEFAULT_THRUSTER_PARAMS.ratedRpm) * (0.3 + 0.7 * Math.abs(bt.pitch)), bt.rpm > 1);
      else {
        const t = dp.thrusters.find((x) => x.id === s.id);
        const max = DEFAULT_DP_PARAMS.thrusters.find((x) => x.id === s.id)?.maxN ?? 1;
        gain = t ? thrusterGain(t.forceN / max, s.id !== 'BT2' || Math.abs(t.forceN) > 1) : 0;
      }
      s.audio.setVolume(gain * 1.4);
      s.lp.frequency.value = 140 + 420 * gain;
    }
  });

  return (
    <>
      {parts.sources.map((s) => (
        <primitive key={s.id} object={s.audio} />
      ))}
    </>
  );
}
