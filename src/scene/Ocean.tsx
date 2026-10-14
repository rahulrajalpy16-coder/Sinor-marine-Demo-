import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { MODE_STYLES } from '../rendering/modes';
import { useQualityProfile } from '../rendering/quality';
import { getEquipment, design } from '../equipment/registry';

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vWorld;
  varying float vH;
  float wave(vec2 p, vec2 d, float k, float s) { return sin(dot(p, d) * k + uTime * s); }
  void main() {
    vec3 p = position;
    vec4 w = modelMatrix * vec4(p, 1.0);
    float h = 0.0;
    h += 0.35 * wave(w.xz, normalize(vec2(1.0, 0.3)), 0.11, 0.9);
    h += 0.22 * wave(w.xz, normalize(vec2(-0.4, 1.0)), 0.19, 1.3);
    h += 0.08 * wave(w.xz, normalize(vec2(0.7, -0.7)), 0.53, 2.1);
    // Calm the water close to the hull so the waterline stays readable.
    float hull = smoothstep(10.0, 26.0, length(vec2(w.x * 1.8, w.z * 0.5)));
    h *= uAmp * mix(0.25, 1.0, hull);
    w.y += h;
    vH = h;
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uCyan;
  uniform vec3 uFog;
  uniform float uOpacity;
  uniform float uGrid;
  uniform float uTime;
  varying vec3 vWorld;
  varying float vH;
  void main() {
    vec3 dx = dFdx(vWorld);
    vec3 dy = dFdy(vWorld);
    vec3 n = normalize(cross(dx, dy));
    if (n.y < 0.0) n = -n;
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 col = mix(uDeep, uShallow, clamp(vH * 0.8 + 0.4, 0.0, 1.0));
    // Moon-like key light glints
    vec3 l = normalize(vec3(0.4, 0.6, -0.7));
    vec3 hlf = normalize(l + v);
    float spec = pow(max(dot(n, hlf), 0.0), 120.0);
    col += vec3(0.55, 0.75, 0.85) * spec * 0.9 + uShallow * fres * 0.6;
    // Technical grid
    vec2 g = abs(fract(vWorld.xz / 10.0 - 0.5) - 0.5) / fwidth(vWorld.xz / 10.0);
    float line = 1.0 - min(min(g.x, g.y), 1.0);
    float dist = length(vWorld.xz);
    float gridFade = 1.0 - smoothstep(60.0, 220.0, dist);
    col += uCyan * line * uGrid * 0.35 * gridFade;
    // Distance fog to the backdrop
    float fog = smoothstep(120.0, 520.0, length(cameraPosition - vWorld));
    col = mix(col, uFog, fog);
    gl_FragColor = vec4(col, mix(uOpacity, 1.0, fog));
    #include <colorspace_fragment>
  }
`;

/** Animated dark ocean with fresnel, a technical grid and mode-driven transparency. */
export function Ocean() {
  const segments = useQualityProfile().oceanSegments;
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1200, 1200, segments, segments).rotateX(-Math.PI / 2), [segments]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: 1 },
          uDeep: { value: new THREE.Color('#03101b') },
          uShallow: { value: new THREE.Color(design.colors.ocean).multiplyScalar(1.9) },
          uCyan: { value: new THREE.Color(design.colors.cyan) },
          uFog: { value: new THREE.Color(design.colors.background) },
          uOpacity: { value: 0.9 },
          uGrid: { value: 0.35 },
        },
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    const s = useAppStore.getState();
    const st = MODE_STYLES[s.visualMode];
    const sel = s.selectedId ? getEquipment(s.selectedId) : undefined;
    let targetOpacity = st.oceanOpacity;
    if (sel?.placement.underwater || s.hprSignals) targetOpacity = Math.min(targetOpacity, 0.38);
    const u = material.uniforms;
    const k = 1 - Math.exp(-dt * 4);
    u.uOpacity.value += (targetOpacity - u.uOpacity.value) * k;
    u.uGrid.value += (st.gridStrength - u.uGrid.value) * k;
    u.uAmp.value = reducedMotion ? 0.3 : 1;
    u.uTime.value += dt * (reducedMotion ? 0.25 : 1);
  });

  return <mesh geometry={geometry} material={material} renderOrder={1} name="ocean" />;
}
