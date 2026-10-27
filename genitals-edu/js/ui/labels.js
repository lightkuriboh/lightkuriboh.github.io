/**
 * 3D-Projected Anatomical Labels & Dynamic SVG Leader Lines
 */
import { KEYS } from '../config.js';
import { state, TERMS, curI18n } from '../state.js';
import { getTubFrame, tubRadius } from '../params/sampler.js';
import { foldPoint } from '../mesh/folds.js';
import { camera, viewport, togglePin } from './scene.js';

const THREE = window.THREE;

export const lblEls = {};
export const lineEls = {};
export const dotEls = {};

let labelsEl, leadersEl;
const _v = new THREE.Vector3();

let onHighlightChange = null;

export function initLabels(callbacks = {}) {
  onHighlightChange = callbacks.onHighlightChange;

  labelsEl = document.getElementById('labels');
  leadersEl = document.getElementById('leaders');

  labelsEl.innerHTML = '';
  leadersEl.innerHTML = '';

  const ns = 'http://www.w3.org/2000/svg';

  KEYS.forEach(k => {
    const d = document.createElement('div');
    d.className = 'lbl';
    d.dataset.tissue = k;
    d.textContent = TERMS.tissues[k].name;

    d.addEventListener('mouseenter', () => {
      if (!state.pinned && onHighlightChange) onHighlightChange(k);
    });
    d.addEventListener('mouseleave', () => {
      if (!state.pinned && onHighlightChange) onHighlightChange(null);
    });
    d.addEventListener('click', () => togglePin(k));

    labelsEl.appendChild(d);
    lblEls[k] = d;

    const l = document.createElementNS(ns, 'line');
    l.setAttribute('class', 'leader');
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('class', 'ldot');
    c.setAttribute('r', '3');

    leadersEl.appendChild(l);
    leadersEl.appendChild(c);
    lineEls[k] = l;
    dotEls[k] = c;
  });

  const btnLabels = document.getElementById('btn-labels');
  if (btnLabels) {
    btnLabels.addEventListener('click', () => setLabels(!state.labels));
  }
}

export function setLabels(v) {
  state.labels = v;
  if (labelsEl) labelsEl.classList.toggle('show', v);
  const btn = document.getElementById('btn-labels');
  if (btn) {
    btn.classList.toggle('on', v);
    btn.setAttribute('aria-pressed', String(v));
  }
}

export function updateLabelTexts(metaKey) {
  if (!lblEls) return;
  const aLabels = curI18n().arousalLabels;
  KEYS.forEach(k => {
    const el = lblEls[k];
    if (!el) return;
    let txt = metaKey === 's0' ? TERMS.tissues[k].name : (TERMS.tissues[k][metaKey] || TERMS.tissues[k].name);
    if (state.arousal > 0.4) {
      if (k === 'urogenitalFolds' && metaKey.startsWith('female')) txt = aLabels.partedLabia;
      if (k === 'genitalTubercle' && metaKey.startsWith('female')) txt = aLabels.tumescentClitoris;
      if (k === 'genitalTubercle' && metaKey.startsWith('male')) txt = aLabels.erectPenis;
      if (k === 'urogenitalSinus' && metaKey.startsWith('female')) txt = aLabels.patentVestibule;
    }
    if (el.textContent !== txt) el.textContent = txt;
  });
}

export function updateLabels() {
  if (!state.labels || !state.derived || !viewport || !camera) return;
  const p = state.derived;
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;

  const tp = getTubFrame(0.96, p.tubercle).pos;
  const tr = tubRadius(0.90, p.tubercle, Math.PI / 2);
  const fp = foldPoint(p.folds.phalicFrac + (1 - p.folds.phalicFrac) * 0.45, 1, p.folds, p.tubercle, 0);
  const swX = p.swellings.xBase + p.swellings.xBulge * 0.70 + p.swellings.rx0;
  const swY = (p.swellings.yStart + p.swellings.yEnd) * 0.50;
  const swZ = p.swellings.zBase + p.swellings.zBulge * 0.65;

  const anchors = {
    genitalTubercle: [tp[0], tp[1], tp[2] + tr * 0.85],
    urogenitalFolds: [fp[0], fp[1], fp[2] + 0.04],
    labioscrotalSwellings: [swX, swY, swZ],
    urogenitalSinus: [0, p.sinus.y, 0.04]
  };

  KEYS.forEach(k => {
    _v.set(...anchors[k]).project(camera);
    const el = lblEls[k];
    const ln = lineEls[k];
    const dt = dotEls[k];
    if (!el || !ln || !dt) return;

    if (_v.z > 1) {
      el.style.display = 'none';
      ln.style.display = 'none';
      dt.style.display = 'none';
      return;
    }
    el.style.display = '';
    ln.style.display = '';
    dt.style.display = '';

    const sx = (_v.x * 0.5 + 0.5) * w;
    const sy = (-_v.y * 0.5 + 0.5) * h;
    const right = k === 'labioscrotalSwellings' || k === 'urogenitalFolds' || k === 'genitalTubercle';
    const ew = el.offsetWidth;
    const tx = right ? w - ew - 14 : 14;
    const ty = { genitalTubercle: 0.24, urogenitalFolds: 0.42, labioscrotalSwellings: 0.62, urogenitalSinus: 0.50 }[k] * h;

    el.style.transform = `translate3d(${tx}px,${ty}px,0)`;
    ln.setAttribute('x1', sx);
    ln.setAttribute('y1', sy);
    ln.setAttribute('x2', right ? tx : tx + ew);
    ln.setAttribute('y2', ty + 12);
    dt.setAttribute('cx', sx);
    dt.setAttribute('cy', sy);
  });
}
