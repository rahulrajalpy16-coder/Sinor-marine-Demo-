import * as THREE from 'three';
import { design } from '../equipment/registry';

/**
 * Shared materials for the vessel structure. One instance each so a visual-mode change is a
 * handful of uniform/flag updates, not a scene rebuild.
 *
 * Hybrid split: solid materials keep z <= split, holographic materials keep z >= split.
 */
export const SPLIT = {
  /** Steady-state hybrid split position (m along +Z). */
  hybridZ: 4,
  solidPlane: new THREE.Plane(new THREE.Vector3(0, 0, -1), 4),
  holoPlane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -4),
  set(z: number) {
    this.solidPlane.constant = z;
    this.holoPlane.constant = -z + 0.05;
  },
};

const cyan = new THREE.Color(design.colors.cyan);
const cyanLight = new THREE.Color(design.colors.cyanLight);

function shellMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
  // The shell's triangles face inboard (see buildHullGeometry), so front faces are the inside.
  // Near the stem both sides meet on the centreline, so primer stays off there (it would z-fight the paint).
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vShellX;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vShellX = position.x;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vShellX;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  if (gl_FrontFacing && abs(vShellX) > 0.6) diffuseColor.rgb = vec3(0.34, 0.36, 0.38);');
  };
  return m;
}

export const MATERIALS = {
  hull: new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }),
  /** Shell plating: the outside paint scheme, grey primer seen from inside (trunks, thruster and HPR spaces). */
  shell: shellMaterial(),
  hullBottom: new THREE.MeshStandardMaterial({ color: '#3b4752', roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }),
  deck: new THREE.MeshStandardMaterial({ color: '#4f5a64', roughness: 0.85, metalness: 0.15, side: THREE.DoubleSide }),
  superstructure: new THREE.MeshStandardMaterial({ color: '#d9dee3', roughness: 0.45, metalness: 0.2 }),
  dark: new THREE.MeshStandardMaterial({ color: '#1d252d', roughness: 0.6, metalness: 0.5 }),
  accent: new THREE.MeshStandardMaterial({ color: '#d36b2c', roughness: 0.5, metalness: 0.2 }),
  glass: new THREE.MeshStandardMaterial({
    color: '#0b2233',
    roughness: 0.08,
    metalness: 0.9,
    transparent: true,
    opacity: 0.42,
    emissive: '#0a3a4d',
    emissiveIntensity: 0.35,
    depthWrite: false,
  }),
  holoFill: new THREE.MeshBasicMaterial({
    color: cyan,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  }),
  lines: new THREE.LineBasicMaterial({ color: cyanLight, transparent: true, opacity: 0.95, toneMapped: false }),
};

export type SolidMaterialKey = 'hull' | 'shell' | 'hullBottom' | 'deck' | 'superstructure' | 'dark' | 'accent' | 'glass';
export const SOLID_KEYS: SolidMaterialKey[] = ['hull', 'shell', 'hullBottom', 'deck', 'superstructure', 'dark', 'accent', 'glass'];

/** Base opacities so ghosting can be undone exactly. */
export const BASE_OPACITY: Record<SolidMaterialKey, number> = {
  hull: 1,
  shell: 1,
  hullBottom: 1,
  deck: 1,
  superstructure: 1,
  dark: 1,
  accent: 1,
  glass: 0.42,
};

export const CYAN = cyan;
export const CYAN_LIGHT = cyanLight;
