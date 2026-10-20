import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { design, getEquipment } from '../equipment/registry';
import { REALISTIC_ENV } from '../rendering/modes';

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFragment = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uWater;
  uniform float uUnder;
  uniform float uSun;
  varying vec3 vDir;
  void main() {
    float y = vDir.y;
    vec3 col = y > 0.0 ? mix(uHorizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(uHorizon, uGround, clamp(-y * 6.0, 0.0, 1.0));
    float s = max(dot(normalize(vDir), uSunDir), 0.0);
    col += vec3(1.0, 0.93, 0.8) * (pow(s, 900.0) * 4.0 * uSun + pow(s, 12.0) * 0.18);
    col = mix(col, uWater, uUnder);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeSkyMaterial(sun = 1) {
  return new THREE.ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new THREE.Color(REALISTIC_ENV.zenith) },
      uHorizon: { value: new THREE.Color(REALISTIC_ENV.horizon) },
      uGround: { value: new THREE.Color(REALISTIC_ENV.seaFar) },
      uSunDir: { value: new THREE.Vector3(...REALISTIC_ENV.sunDir).normalize() },
      uWater: { value: new THREE.Color(REALISTIC_ENV.underwater) },
      uUnder: { value: 0 },
      uSun: { value: sun },
    },
  });
}

/**
 * Daylight for Realistic mode: a sky dome with the sun, a matching horizon fog, image-based lighting
 * baked from that sky (so metal and paint reflect a real sky instead of black), and murky water fog
 * when the camera is below the surface. Every other mode keeps the dark holographic stage.
 */
export function RealisticEnvironment() {
  const { gl, scene, camera } = useThree();
  const geo = useMemo(() => new THREE.SphereGeometry(900, 48, 24), []);
  const mat = useMemo(() => makeSkyMaterial(), []);

  // Image-based lighting from the same sky, prefiltered the first time Realistic is shown.
  const env = useMemo(() => ({ rt: null as THREE.WebGLRenderTarget | null }), []);
  const envMap = () => {
    if (!env.rt) {
      const pm = new THREE.PMREMGenerator(gl);
      const envScene = new THREE.Scene();
      const envSkyMat = makeSkyMaterial(0.15);
      const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), envSkyMat);
      envScene.add(sky);
      env.rt = pm.fromScene(envScene, 0.02);
      sky.geometry.dispose();
      envSkyMat.dispose();
      pm.dispose();
    }
    return env.rt.texture;
  };

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      env.rt?.dispose();
      scene.environment = null;
    },
    [geo, mat, env, scene],
  );

  const stage = useMemo(() => new THREE.Color(design.colors.background), []);
  const horizon = useMemo(() => new THREE.Color(REALISTIC_ENV.horizon), []);
  const water = useMemo(() => new THREE.Color(REALISTIC_ENV.underwater), []);
  const last = useMemo(() => ({ key: '' }), []);

  useFrame(() => {
    const s = useAppStore.getState();
    const real = s.visualMode === 'realistic';
    const sel = s.selectedId ? getEquipment(s.selectedId) : undefined;
    // Below the surface and not inside the hull: the view is through water.
    const under = real && camera.position.y < -0.3 && !sel?.placement.interior;
    const key = `${real}|${under}`;
    mat.uniforms.uUnder.value = under ? 1 : 0;
    if (key === last.key) return;
    last.key = key;
    scene.environment = real ? envMap() : null;
    scene.environmentIntensity = REALISTIC_ENV.envIntensity;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.color.copy(under ? water : real ? horizon : stage);
      fog.near = under ? 2 : real ? 220 : 160;
      fog.far = under ? 90 : real ? 900 : 560;
    }
    if (scene.background instanceof THREE.Color) scene.background.copy(real ? horizon : stage);
  });

  const visible = useAppStore((s) => s.visualMode === 'realistic');
  return <mesh geometry={geo} material={mat} visible={visible} renderOrder={-10} frustumCulled={false} name="sky-dome" />;
}
