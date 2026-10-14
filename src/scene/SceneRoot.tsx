import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { design } from '../equipment/registry';
import { Ocean } from './Ocean';
import { Hotspots } from './Hotspots';
import { ModeController } from './ModeController';
import { SimulationDriver } from './SimulationDriver';
import { TestBridge } from './TestBridge';
import { CameraRig } from '../camera/CameraRig';
import { VesselWithEquipment } from '../vessels/VesselWithEquipment';
import { OVERVIEW_POSE } from '../camera/cameraMachine';

const DPR: Record<string, [number, number]> = { low: [1, 1], medium: [1, 1.5], high: [1, 2] };

export function SceneRoot({ onError }: { onError?: (e: unknown) => void }) {
  const quality = useAppStore((s) => s.quality);
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={DPR[quality]}
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
      <Suspense fallback={null}>
        <hemisphereLight args={['#9cc8e8', '#02060c', 0.65]} />
        <directionalLight position={[60, 80, 40]} intensity={2.2} color="#e8f2ff" />
        <directionalLight position={[-50, 30, -60]} intensity={0.7} color="#5fd6ff" />
        <ambientLight intensity={0.15} />
        <Ocean />
        <VesselWithEquipment />
        <Hotspots />
        <ModeController />
        <SimulationDriver />
        <CameraRig />
        <TestBridge />
        {quality !== 'low' && (
          <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
            <Bloom intensity={quality === 'high' ? 0.9 : 0.6} luminanceThreshold={0.62} luminanceSmoothing={0.2} mipmapBlur />
            <Vignette eskil={false} offset={0.25} darkness={0.7} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
