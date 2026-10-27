/**
 * Playback Dock Controls, Timeline Scrubber, Stage Milestones & Physiological Arousal Slider
 */
import { KEYS } from '../config.js';
import { state, curI18n, TERMS } from '../state.js';
import { clamp } from '../math/helpers.js';
import { updateMorph } from '../mesh/manager.js';
import { updateLabelTexts } from './labels.js';

const gsap = window.gsap;

let scrubber, arousalSlider, stagesContainer, ticksContainer;
let onStageChange = null;
let lastStageSig = '';

export function getStageMeta(t) {
  const L = curI18n().stageMeta;
  if (state.advMode) {
    if (t < 0.12) return { key: 's0', title: L.s0Title, sub: L.s0Sub, color: '#8B5CF6' };
    if (t < 0.38) return { key: 'femaleNeo', title: L.femaleNeoTitle, sub: L.femaleNeoSub, color: '#F472B6' };
    if (t < 0.62) return { key: 'femaleAdult', title: L.femaleAdultTitle, sub: L.femaleAdultSub, color: '#EC4899' };
    if (t < 0.88) return { key: 'maleNeo', title: L.maleNeoTitle, sub: L.maleNeoSub, color: '#60A5FA' };
    return { key: 'maleAdult', title: L.maleAdultTitle, sub: L.maleAdultSub, color: '#3B82F6' };
  } else {
    if (t < 0.15 || t > 0.85) return { key: 's0', title: L.s0Title, sub: L.s0SubStd, color: '#8B5CF6' };
    if (t < 0.50) return { key: 'femaleNeo', title: L.femaleNeoTitle, sub: L.femaleNeoSubStd, color: '#EC4899' };
    return { key: 'maleNeo', title: L.maleNeoTitle, sub: L.maleNeoSubStd, color: '#3B82F6' };
  }
}

export function initDock(callbacks = {}) {
  onStageChange = callbacks.onStageChange;

  scrubber = document.getElementById('scrubber');
  arousalSlider = document.getElementById('arousal-slider');
  stagesContainer = document.getElementById('stages-container');
  ticksContainer = document.getElementById('ticks');

  // Play / Pause / Loop
  const btnPlay = document.getElementById('btn-play');
  const btnLoop = document.getElementById('btn-loop');
  if (btnPlay) btnPlay.addEventListener('click', () => setPlaying(!state.playing));
  if (btnLoop) {
    btnLoop.addEventListener('click', () => {
      state.loop = !state.loop;
      btnLoop.classList.toggle('on', state.loop);
      btnLoop.setAttribute('aria-pressed', String(state.loop));
    });
  }

  // Scrubber events
  if (scrubber) {
    scrubber.addEventListener('pointerdown', () => {
      state.scrubbing = true;
      gsap.killTweensOf(state);
      state.tweening = false;
    });
    ['pointerup', 'pointercancel', 'blur', 'change'].forEach(ev => {
      scrubber.addEventListener(ev, () => {
        state.scrubbing = false;
      });
    });
    scrubber.addEventListener('input', () => {
      gsap.killTweensOf(state);
      state.tweening = false;
      state.t = scrubber.value / 1000;
      updateMorph(state.t, state);
      updateUIFromT();
    });
  }

  // Advanced development toggle
  const btnAdv = document.getElementById('btn-adv');
  if (btnAdv) {
    btnAdv.addEventListener('click', () => setAdvMode(!state.advMode));
  }

  // Arousal slider & preset buttons
  if (arousalSlider) {
    arousalSlider.addEventListener('input', e => setArousal(parseFloat(e.target.value), false));
  }
  const btnA0 = document.getElementById('btn-arousal-0');
  const btnA50 = document.getElementById('btn-arousal-50');
  const btnA100 = document.getElementById('btn-arousal-100');
  const btnPulse = document.getElementById('btn-arousal-pulse');

  if (btnA0) btnA0.addEventListener('click', () => setArousal(0, true));
  if (btnA50) btnA50.addEventListener('click', () => setArousal(50, true));
  if (btnA100) btnA100.addEventListener('click', () => setArousal(100, true));

  if (btnPulse) {
    btnPulse.addEventListener('click', () => {
      state.arousalPulse = !state.arousalPulse;
      btnPulse.classList.toggle('active', state.arousalPulse);
      const L = curI18n();
      btnPulse.textContent = state.arousalPulse ? L.arousalPulseStop : L.arousalPulsePlay;
      if (state.arousalPulse) {
        const loopPulse = () => {
          if (!state.arousalPulse) return;
          gsap.to(state, {
            arousal: state.arousal > 0.5 ? 0 : 1,
            duration: 2.2,
            ease: 'power1.inOut',
            onUpdate: () => {
              arousalSlider.value = Math.round(state.arousal * 100);
              syncArousalUI();
              updateMorph(state.t, state);
            },
            onComplete: loopPulse
          });
        };
        loopPulse();
      } else {
        gsap.killTweensOf(state, 'arousal');
      }
    });
  }

  buildDockControls();
  updatePlayIcon();
}

export function updatePlayIcon() {
  const icPlay = document.getElementById('ic-play');
  const icPause = document.getElementById('ic-pause');
  if (icPlay) icPlay.style.display = state.playing ? 'none' : 'block';
  if (icPause) icPause.style.display = state.playing ? 'block' : 'none';
}

export function setPlaying(v) {
  state.playing = v;
  if (v && !state.loop && state.t >= 1) {
    state.t = 0;
    state.dwell = 0;
  }
  updatePlayIcon();
}

export function jumpTo(target) {
  gsap.killTweensOf(state);
  state.tweening = true;
  gsap.to(state, {
    t: target,
    duration: 1.6,
    ease: 'power2.inOut',
    onUpdate: () => {
      updateMorph(state.t, state);
      updateUIFromT();
    },
    onComplete: () => {
      state.tweening = false;
      state.dwell = state.dwell > 0 ? state.dwell : 1.2;
    }
  });
}

export function setAdvMode(v) {
  state.advMode = v;
  const btnAdv = document.getElementById('btn-adv');
  if (btnAdv) {
    btnAdv.classList.toggle('on', v);
    btnAdv.setAttribute('aria-pressed', String(v));
  }
  buildDockControls();
  if (v && Math.abs(state.t - 0.3333) < 0.05) state.t = 0.50; // Jump to adult if in female
  if (v && Math.abs(state.t - 0.6667) < 0.05) state.t = 1.00; // Jump to adult if in male
  updateMorph(state.t, state);
  updateUIFromT();
}

export function setArousal(val, animate) {
  const num = clamp(val / 100, 0, 1);
  if (animate) {
    gsap.to(state, {
      arousal: num,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: () => {
        if (arousalSlider) arousalSlider.value = Math.round(state.arousal * 100);
        syncArousalUI();
        updateMorph(state.t, state);
      }
    });
  } else {
    state.arousal = num;
    if (arousalSlider) arousalSlider.value = Math.round(num * 100);
    syncArousalUI();
    updateMorph(state.t, state);
  }
}

export function syncArousalUI() {
  const pct = Math.round(state.arousal * 100);
  const isMale = state.derived ? state.derived.folds.fuse > 0.5 : false;
  const L = curI18n();
  let statusText;
  if (pct === 0) statusText = L.arousalBadgeResting;
  else if (pct < 60) statusText = isMale ? L.arousalBadgeMalePlat(pct) : L.arousalBadgeFemalePlat(pct);
  else statusText = isMale ? L.arousalBadgeMalePeak(pct) : L.arousalBadgeFemalePeak(pct);

  const badge = document.getElementById('arousal-badge');
  if (badge) badge.textContent = statusText;

  const b0 = document.getElementById('btn-arousal-0');
  const b50 = document.getElementById('btn-arousal-50');
  const b100 = document.getElementById('btn-arousal-100');
  if (b0) b0.classList.toggle('active', pct === 0);
  if (b50) b50.classList.toggle('active', pct >= 40 && pct <= 60);
  if (b100) b100.classList.toggle('active', pct === 100);
}

export function buildDockControls() {
  if (!stagesContainer || !ticksContainer) return;
  const L = curI18n();
  const list = state.advMode ? L.stagesAdv : L.stagesStd;
  stagesContainer.innerHTML = '';
  ticksContainer.innerHTML = '';

  list.forEach((s, idx) => {
    // Only add jump button if not duplicate return
    if (idx < list.length - (state.advMode ? 0 : 1)) {
      const b = document.createElement('button');
      b.className = 'stg';
      b.dataset.t = String(s.t);
      b.innerHTML = '<i></i>' + s.label;
      b.addEventListener('click', () => jumpTo(s.t));
      stagesContainer.appendChild(b);
    }
    const tb = document.createElement('button');
    tb.dataset.t = String(s.t);
    tb.style.left = s.t * 100 + '%';
    tb.title = s.label;
    tb.textContent = s.tick;
    tb.addEventListener('click', () => jumpTo(s.t));
    ticksContainer.appendChild(tb);
  });

  const arousalBox = document.getElementById('arousal-box');
  if (arousalBox) arousalBox.classList.toggle('show', state.advMode);
}

export function advanceT(dt) {
  if (state.dwell > 0) {
    state.dwell -= dt;
    return;
  }
  const prev = state.t;
  let nt = prev + dt / state.duration;
  const milestones = state.advMode ? [0.25, 0.50, 0.75, 1.0] : [1 / 3, 2 / 3, 1];
  for (const m of milestones) {
    if (prev < m - 1e-9 && nt >= m) {
      nt = m;
      state.dwell = 1.2;
      break;
    }
  }
  if (nt >= 1) {
    if (state.loop) {
      nt = 0;
    } else {
      nt = 1;
      state.playing = false;
      updatePlayIcon();
    }
  }
  state.t = nt;
}

export function updateUIFromT() {
  const t = state.t;
  const pct = Math.round(t * 100);

  const stagePct = document.getElementById('stage-pct');
  if (stagePct) stagePct.textContent = pct + '%';
  if (scrubber && !state.scrubbing) scrubber.value = Math.round(t * 1000);

  const meta = getStageMeta(t);
  const sig = meta.title + meta.sub + (state.arousal > 0.05 ? `[Ar:${Math.round(state.arousal * 100)}]` : '');
  if (sig !== lastStageSig) {
    lastStageSig = sig;
    const stageTitle = document.getElementById('stage-title');
    const stageSub = document.getElementById('stage-sub');
    const d = document.getElementById('status-dot');
    if (stageTitle) stageTitle.textContent = meta.title;
    if (stageSub) stageSub.textContent = meta.sub;
    if (d) {
      d.style.background = meta.color;
      d.style.color = meta.color;
    }
  }

  // Active stage button sync
  const stepList = state.advMode ? [0, 0.25, 0.50, 0.75, 1.0] : [0, 1 / 3, 2 / 3, 1];
  const nearIdx = stepList.findIndex(m => Math.abs(t - m) <= 0.04);
  document.querySelectorAll('.stg').forEach((b, i) =>
    b.classList.toggle('active', nearIdx === i || (i === 0 && nearIdx === stepList.length - 1))
  );
  document.querySelectorAll('.ticks button').forEach((b, i) =>
    b.classList.toggle('on', nearIdx === i)
  );

  // Legend derivatives text
  KEYS.forEach(k => {
    const el = document.getElementById('der-' + k);
    if (el) el.textContent = '\u2192 ' + (TERMS.tissues[k][meta.key] || TERMS.tissues[k].s0);
  });

  updateLabelTexts(meta.key);
  if (onStageChange) onStageChange(meta);
  syncArousalUI();
}

export function resetStageSig() {
  lastStageSig = '';
}
