/**
 * UI Internationalization Applier & DOM Text Synchronizer
 */
import { KEYS } from '../config.js';
import { state, curI18n, TERMS } from '../state.js';
import { persistLanguage } from '../i18n/index.js';
import {
  renderMatrix,
  renderTissueDescs,
  renderPanelStatic,
  updateAccToggleLabel
} from './panel.js';
import { buildDockControls, updateUIFromT, syncArousalUI, resetStageSig } from './dock.js';
import { updateLabels } from './labels.js';

const $ = id => document.getElementById(id);

export function applyLanguage(lang) {
  if (lang !== 'en' && lang !== 'vi') lang = 'en';
  state.lang = lang;
  persistLanguage(lang);
  document.documentElement.lang = lang;

  const select = document.getElementById('lang-select');
  if (select && select.value !== lang) select.value = lang;

  const L = curI18n();

  // Document title
  document.title = L.pageTitle;

  // Header branding & buttons
  if ($('brand-title')) $('brand-title').textContent = L.brandTitle;
  if ($('brand-sub')) $('brand-sub').innerHTML = L.brandSub;
  if ($('btn-style-clay')) {
    $('btn-style-clay').innerHTML = `<span class="seg-full">${L.clayBtn}</span><span class="seg-short">${L.clayBtnShort || 'Clay'}</span>`;
    $('btn-style-clay').title = L.clayTitle;
  }
  if ($('btn-style-atlas')) {
    $('btn-style-atlas').innerHTML = `<span class="seg-full">${L.atlasBtn}</span><span class="seg-short">${L.atlasBtnShort || 'Atlas'}</span>`;
    $('btn-style-atlas').title = L.atlasTitle;
  }
  if ($('txt-adv')) $('txt-adv').textContent = L.advBtn;
  if ($('btn-adv')) $('btn-adv').title = L.advTitle;
  if ($('txt-labels')) $('txt-labels').textContent = L.labelsBtn;
  if ($('btn-labels')) $('btn-labels').title = L.labelsTitle;
  if ($('txt-reset')) $('txt-reset').textContent = L.resetBtn;
  if ($('btn-reset')) $('btn-reset').title = L.resetTitle;
  if ($('txt-info')) $('txt-info').textContent = L.guideBtn;
  if ($('btn-info')) $('btn-info').title = L.guideTitle;
  if ($('gl-error')) $('gl-error').textContent = L.glError;

  // Legend
  if ($('legend-title')) $('legend-title').textContent = L.legendTitle;
  if ($('legend-hint')) $('legend-hint').textContent = L.legendHint;
  KEYS.forEach(k => {
    const row = document.querySelector(`.lrow[data-tissue="${k}"] .lname`);
    if (row) row.textContent = TERMS.tissues[k].name;
    const lrowBtn = document.querySelector(`.lrow[data-tissue="${k}"]`);
    if (lrowBtn) lrowBtn.setAttribute('aria-label', TERMS.tissues[k].name);
  });

  // Dock & Arousal controls
  if ($('btn-play')) $('btn-play').title = L.btnPlayTitle;
  if ($('btn-loop')) $('btn-loop').title = L.btnLoopTitle;
  const scrubber = $('scrubber');
  if (scrubber) scrubber.setAttribute('aria-label', L.scrubberLabel);
  if ($('arousal-title-text')) $('arousal-title-text').textContent = L.arousalTitle;
  if ($('arousal-sub-min')) $('arousal-sub-min').textContent = L.arousalResting;
  if ($('arousal-sub-max')) $('arousal-sub-max').textContent = L.arousalPeak;
  if ($('btn-arousal-0')) $('btn-arousal-0').textContent = L.arousalPreset0;
  if ($('btn-arousal-50')) $('btn-arousal-50').textContent = L.arousalPreset50;
  if ($('btn-arousal-100')) $('btn-arousal-100').textContent = L.arousalPreset100;
  if ($('btn-arousal-pulse')) {
    $('btn-arousal-pulse').title = L.arousalPulseTitle;
    $('btn-arousal-pulse').textContent = state.arousalPulse ? L.arousalPulseStop : L.arousalPulsePlay;
  }

  // Aside panel
  if ($('btn-panel')) $('btn-panel').title = L.guideTitle;
  if ($('panel-badge')) $('panel-badge').textContent = L.panelBadge;
  if ($('panel-title')) $('panel-title').textContent = L.panelTitle;
  if ($('btn-panel-close')) $('btn-panel-close').title = L.closeGuide;
  if ($('panel-desc')) $('panel-desc').textContent = L.panelDesc;
  if ($('acc-matrix-title')) $('acc-matrix-title').textContent = L.matrixTitle;
  if ($('matrix-hint')) $('matrix-hint').textContent = L.matrixHint;
  if ($('th-tissue')) $('th-tissue').textContent = L.thTissue;
  if ($('th-s0')) $('th-s0').textContent = L.thS0;
  if ($('th-female')) $('th-female').textContent = L.thFemale;
  if ($('th-male')) $('th-male').textContent = L.thMale;
  if ($('acc-origins-title')) $('acc-origins-title').textContent = L.originsTitle;
  if ($('acc-endocrine-title')) $('acc-endocrine-title').textContent = L.endocrineTitle;
  if ($('acc-pubertal-title')) $('acc-pubertal-title').textContent = L.pubertalTitle;
  if ($('acc-clinical-title')) $('acc-clinical-title').textContent = L.clinicalTitle;
  if ($('panel-notice')) $('panel-notice').textContent = L.notice;

  // Render matrix, descriptions, static panel accordions
  renderMatrix();
  renderTissueDescs();
  renderPanelStatic();
  updateAccToggleLabel();

  // Rebuild dock buttons & ticks
  buildDockControls();

  // Re-sync UI state, info card, and labels
  resetStageSig();
  updateUIFromT();
  syncArousalUI();
  updateLabels();
}
