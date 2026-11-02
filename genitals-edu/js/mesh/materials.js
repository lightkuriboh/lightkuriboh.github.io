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

/**
 * Alpha fade textures for the body backdrop (alphaMap uses the green channel).
 * 'radial': torso fades out toward an ellipse matching the plane's UV square.
 * 'linear': thigh fades out along V (CanvasTexture flipY=true: canvas top row = v 1).
 */
function makeFadeTexture(kind) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 256);
  let g;
  if (kind === 'radial') {
    g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0.00, '#fff');
    g.addColorStop(0.62, '#fff');
    g.addColorStop(1.00, '#000');
  } else {
    g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.00, '#000'); // v = 1 (thigh cut end) fully transparent
    g.addColorStop(0.30, '#fff'); // v <= 0.70 fully opaque
    g.addColorStop(1.00, '#fff');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export const torsoMat = new THREE.MeshStandardMaterial({
  color: 0x243248, roughness: 0.88, transparent: true, depthWrite: true, alphaMap: makeFadeTexture('radial')
});
export const thighMat = new THREE.MeshStandardMaterial({
  color: 0x243248, roughness: 0.85, transparent: true, depthWrite: true, alphaMap: makeFadeTexture('linear')
});
export const bodyMats = [torsoMat, thighMat];
export const baseMat = torsoMat; // backward-compatible alias

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
