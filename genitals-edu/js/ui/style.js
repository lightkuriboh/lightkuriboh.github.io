/**
 * Visual Styles (Sculpted Clay vs. Clinical Atlas) & Dynamic Material Effects
 */
import { styleSets, KEYS, emissiveBase } from '../config.js';
import { state, TERMS } from '../state.js';
import { MAT, baseMat, outlineMeshes } from '../mesh/materials.js';
import { meshContext } from '../mesh/manager.js';
import { ambient, hemi, sun, rim, viewport } from './scene.js';

const THREE = window.THREE;
const gsap = window.gsap;

let onLabelsToggle = null;

export function initStyles(callbacks = {}) {
  onLabelsToggle = callbacks.onLabelsToggle;

  document.getElementById('btn-style-clay').addEventListener('click', () => setStyle('clay'));
  document.getElementById('btn-style-atlas').addEventListener('click', () => setStyle('atlas'));
}

export function setStyle(name) {
  state.style = name;
  const atlas = name === 'atlas';
  const S = styleSets[name];

  if (meshContext && meshContext.meshTissue) {
    meshContext.meshTissue.forEach(([m, k]) => {
      m.material = MAT[name][k];
    });
  }

  baseMat.color.setHex(S.base);
  baseMat.roughness = 0.88;

  if (meshContext && meshContext.pelvic) {
    meshContext.pelvic.depthRings.visible = atlas;
  }

  if (ambient) gsap.to(ambient, { intensity: S.amb, duration: 0.4 });
  if (hemi) gsap.to(hemi, { intensity: S.hemi, duration: 0.4 });
  if (sun) gsap.to(sun, { intensity: S.sun, duration: 0.4 });
  if (rim) gsap.to(rim, { intensity: S.rim, duration: 0.4 });

  viewport.classList.toggle('atlas', atlas);
  document.body.classList.toggle('atlas-on', atlas);

  const btnClay = document.getElementById('btn-style-clay');
  const btnAtlas = document.getElementById('btn-style-atlas');
  if (btnClay) {
    btnClay.classList.toggle('active', !atlas);
    btnClay.setAttribute('aria-pressed', String(!atlas));
  }
  if (btnAtlas) {
    btnAtlas.classList.toggle('active', atlas);
    btnAtlas.setAttribute('aria-pressed', String(atlas));
  }

  if (onLabelsToggle) onLabelsToggle(atlas);
}

/**
 * Per-frame visual updates: highlight pulse, dimming, and physiological vascular blush
 */
export function applyVisuals(time) {
  const hl = state.highlight;
  const p = state.derived;
  if (!p) return;

  const pulse = 0.25 + 0.2 * Math.sin(time * 4);
  const arousal = state.arousal;

  for (const k of KEYS) {
    const dim = hl && hl !== k ? 0.3 : 1;
    for (const set of ['clay', 'atlas']) {
      const m = MAT[set][k];
      m.transparent = dim < 1;
      m.opacity = dim;
      m.depthWrite = dim === 1;
      m.emissiveIntensity = hl === k ? pulse : emissiveBase[set];

      // Atlas vascular vasocongestion blush in female mucosal tissue during arousal
      if (set === 'atlas' && (k === 'urogenitalFolds' || k === 'urogenitalSinus')) {
        const isFemale = p.folds.fuse < 0.5;
        if (isFemale && arousal > 0.05) {
          const blushColor = new THREE.Color(TERMS.tissues[k].atlas).lerp(
            new THREE.Color(0xd92d4b),
            arousal * 0.45
          );
          m.color.copy(blushColor);
        } else {
          m.color.set(TERMS.tissues[k].atlas);
        }
      }
    }
  }

  outlineMeshes.forEach(({ mesh, tissue }) => {
    mesh.visible = state.style === 'atlas' && (!hl || hl === tissue);
  });
}
