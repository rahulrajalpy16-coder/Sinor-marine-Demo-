import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { design } from '../equipment/registry';
import { Ocean } from './Ocean';
import { Hotspots } from './Hotspots';
import { ModeController } from './ModeController';
import { SimulationDriver } from './SimulationDriver';
import { TestBridge } from './TestBridge';
import { CameraRig } from '../camera/CameraRig';
import { VesselWithEquipment } from '../vessels/VesselWithEquipment';
import { VesselMotion } from './VesselMotion';
import { DPSetpointMarker } from './DPSceneOverlay';
import { PositionReferenceWorld } from '../equipment/PositionReferences';
import { OVERVIEW_POSE } from '../camera/cameraMachine';
import { useQualityProfile, type QualityProfile } from '../rendering/quality';
import { XR } from '@react-three/xr';
import { xrStore } from '../xr/xrStore';
import { VRPlayer } from '../xr/VRPlayer';
import { useVRActive } from '../xr/vrState';
import { VRStats, vrStatsRequested } from '../xr/VRStats';
import { WORLD_SCALE } from './vesselTransform';

export function SceneRoot({ onError }: { onError?: (e: unknown) => void }) {
  const profile = useQualityProfile();
  const inVR = useVRActive();
  const [lo, hi] = profile.dpr;
  // Start at the top of the preset's pixel-ratio range; the monitor steps down if frames drop.
  const [dpr, setDpr] = useState(hi);
  useEffect(() => setDpr(hi), [hi]);
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[lo, dpr]}
      resize={{ scroll: false, debounce: { scroll: 0, resize: 60 } }}
      camera={{ position: OVERVIEW_POSE.position, fov: 42, near: 0.1, far: 2000 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.localClippingEnabled = true;
        scene.background = new THREE.Color(design.colors.background);
        scene.fog = new THREE.Fog(design.colors.background, 160, 560);
      }}
      onError={onError as never}
      aria-label="Interactive 3D view of the representative offshore vessel"
    >
      <PerformanceMonitor
        flipflops={3}
        onChange={({ factor }) => setDpr(Math.round((lo + (hi - lo) * factor) * 4) / 4)}
        onFallback={() => setDpr(lo)}
      />
      <XR store={xrStore}>
        <Suspense fallback={null}>
          <hemisphereLight args={['#9cc8e8', '#02060c', 0.65]} />
          <directionalLight position={[60, 80, 40]} intensity={2.2} color="#e8f2ff" />
          <directionalLight position={[-50, 30, -60]} intensity={0.7} color="#5fd6ff" />
          <ambientLight intensity={0.15} />
          {/* Model frames are left-handed; this reflection shows the ship the right way round (see vesselTransform). */}
          <group name="world" scale={WORLD_SCALE}>
            <Ocean />
            <VesselMotion>
              <VesselWithEquipment />
              {/* Indicators are page overlays the headset never shows; skip them and their occlusion raycasts. */}
              {!inVR && <Hotspots />}
            </VesselMotion>
            <DPSetpointMarker />
            <PositionReferenceWorld />
          </group>
          <VRPlayer />
          {inVR && vrStatsRequested() && <VRStats />}
          <ModeController />
          <SimulationDriver />
          {/* The headset owns the camera in VR; the orbit rig and its focus flights would fight it. */}
          {!inVR && <CameraRig />}
          <TestBridge />
          <PostEffects profile={profile} />
        </Suspense>
      </XR>
    </Canvas>
  );
}

/** Bloom and vignette on screens only; the VR profile turns them off (the composer cannot draw into WebXR). */
function PostEffects({ profile }: { profile: QualityProfile }) {
  if (!profile.postprocessing) return null;
  return (
    <EffectComposer multisampling={profile.multisampling}>
      <Bloom intensity={profile.bloomIntensity} luminanceThreshold={0.62} luminanceSmoothing={0.2} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={0.7} />
    </EffectComposer>
  );
}
