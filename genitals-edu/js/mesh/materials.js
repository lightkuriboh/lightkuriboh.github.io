/**
 * Three.js Materials & Inverted-Hull Outline Shaders
 */
import { KEYS, emissiveBase } from '../config.js';
import { TERMS } from '../state.js';
import { skinBumpTex } from './textures.js';

const THREE = window.THREE;

export function stdMat(hex, rough, bumpScale) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: rough,
    metalness: 0.02,
    emissive: hex,
    emissiveIntensity: 0.08,
    bumpMap: skinBumpTex,
    bumpScale: bumpScale || 0.012
  });
}

export const MAT = { clay: {}, atlas: {} };
for (const k of KEYS) {
  MAT.clay[k] = stdMat(new THREE.Color(TERMS.tissues[k].color), 0.70, 0.010);
  MAT.atlas[k] = stdMat(
    new THREE.Color(TERMS.tissues[k].atlas),
    k === 'urogenitalSinus' || k === 'urogenitalFolds' ? 0.38 : 0.52,
    0.014
  );
  MAT.atlas[k].emissiveIntensity = emissiveBase.atlas;
}

export const baseMat = new THREE.MeshStandardMaterial({
  color: 0x243248,
  roughness: 0.88
});

export const outlineMeshes = [];

/**
 * Creates an inverted-hull contour mesh for clinical atlas mode
 */
export function makeOutline(geometry, tissue, offset, parent, sceneRef) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { off: { value: offset } },
    vertexShader: 'uniform float off; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * off, 1.0); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.231, 0.114, 0.114, 1.0); }',
    side: THREE.BackSide
  });
  const m = new THREE.Mesh(geometry, mat);
  m.visible = false;
  (parent || sceneRef).add(m);
  outlineMeshes.push({ mesh: m, tissue });
  return m;
}
