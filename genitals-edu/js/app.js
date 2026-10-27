/**
 * External Genital Homology & Morphogenesis - Main Application Orchestrator
 */
import { CAM } from './config.js';
import { state } from './state.js';
import { getInitialLanguage } from './i18n/index.js';
import { initScene, scene, camera, renderer, controls, checkHoverPick, resizeViewport } from './ui/scene.js';
import { initMeshes, updateMorph } from './mesh/manager.js';
import { initStyles, setStyle, applyVisuals } from './ui/style.js';
import { initDock, advanceT, updateUIFromT, updatePlayIcon, jumpTo, setPlaying, setAdvMode, setArousal } from './ui/dock.js';
import { initPanel, setHighlight, setPanelOpen, togglePanel, renderInfoCard } from './ui/panel.js';
import { initLabels, setLabels, updateLabels } from './ui/labels.js';
import { applyLanguage } from './ui/i18n-ui.js';

const THREE = window.THREE;
const gsap = window.gsap;

(function initApp() {
  if (typeof THREE === 'undefined' || typeof gsap === 'undefined' || !THREE.OrbitControls) {
    const err = document.getElementById('gl-error');
    if (err) err.style.display = 'grid';
    return;
  }

  // 1. Initialize Scene & Raycasting
  initScene({
    onHighlightChange: k => {
      setHighlight(k);
    },
    onPinChange: () => {
      // Pin state updated
    }
  });

  // 2. Initialize 3D Meshes & Geometry Morph Targets
  initMeshes(scene);

  // 3. Initialize Styles & Visual Shaders
  initStyles({
    onLabelsToggle: atlasActive => {
      setLabels(atlasActive);
    }
  });

  // 4. Initialize Dock, Scrubber & Arousal Controls
  initDock({
    onStageChange: () => {
      if (state.highlight) renderInfoCard();
    }
  });

  // 5. Initialize Educational Guide Panel & Accordions
  initPanel();

  // 6. Initialize Anatomical Labels & Leader Lines
  initLabels({
    onHighlightChange: k => {
      setHighlight(k);
    }
  });

  // 7. Reset View Button
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      gsap.to(camera.position, {
        x: CAM.pos[0],
        y: CAM.pos[1],
        z: CAM.pos[2],
        duration: 1,
        ease: 'power2.out'
      });
      gsap.to(controls.target, {
        x: CAM.target[0],
        y: CAM.target[1],
        z: CAM.target[2],
        duration: 1,
        ease: 'power2.out'
      });
    });
  }

  // 8. Language Selector
  const langSelect = document.getElementById('lang-select');
  if (langSelect) {
    langSelect.addEventListener('change', e => {
      applyLanguage(e.target.value);
    });
  }

  // 9. Global Keyboard Shortcuts
  window.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' && e.code !== 'Space' && !/^[12345sSaAlLiI]$/.test(e.key)) return;
    if (e.code === 'Space') {
      if (tag === 'BUTTON') return;
      e.preventDefault();
      setPlaying(!state.playing);
    } else if (e.key === '1') jumpTo(0);
    else if (e.key === '2') jumpTo(state.advMode ? 0.25 : 1 / 3);
    else if (e.key === '3') jumpTo(state.advMode ? 0.50 : 2 / 3);
    else if (e.key === '4' && state.advMode) jumpTo(0.75);
    else if (e.key === '5' && state.advMode) jumpTo(1.0);
    else if (e.key === 's' || e.key === 'S') setStyle(state.style === 'clay' ? 'atlas' : 'clay');
    else if (e.key === 'l' || e.key === 'L') setLabels(!state.labels);
    else if (e.key === 'a' || e.key === 'A') setAdvMode(!state.advMode);
    else if (e.key === 'i' || e.key === 'I') togglePanel();
    else if (e.key === 'Escape') {
      const panel = document.getElementById('panel');
      if (panel && !panel.classList.contains('collapsed')) setPanelOpen(false);
    }
  });

  // 10. Responsive Viewport Observer
  const viewport = document.getElementById('viewport');
  if (viewport) {
    new ResizeObserver(resizeViewport).observe(viewport);
  }

  // 11. Initial Language & Style Resolution
  const initialLang = getInitialLanguage();
  applyLanguage(initialLang);
  setStyle('clay');

  // 12. Parse URL Parameters
  const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
  if (urlParams) {
    if (urlParams.has('t')) {
      state.t = parseFloat(urlParams.get('t'));
      state.playing = false;
    }
    if (urlParams.has('play')) {
      state.playing = urlParams.get('play') === '1';
    }
    if (urlParams.has('style')) {
      setStyle(urlParams.get('style'));
    }
    if (urlParams.has('labels')) {
      setLabels(urlParams.get('labels') === '1');
    }
    if (urlParams.has('adv')) {
      setAdvMode(urlParams.get('adv') === '1');
    }
    if (urlParams.has('arousal')) {
      setArousal(parseFloat(urlParams.get('arousal')), false);
    }
    if (urlParams.has('panel')) {
      setPanelOpen(urlParams.get('panel') === '1');
    }
    if (urlParams.has('panelScroll')) {
      const scrollVal = parseFloat(urlParams.get('panelScroll'));
      setTimeout(() => {
        const p = document.getElementById('panel-inner');
        if (p) p.scrollTop = scrollVal;
      }, 100);
    }
  }

  // 13. Sync Initial State
  resizeViewport();
  updatePlayIcon();
  updateMorph(state.t, state);
  updateUIFromT();

  // 14. Main Animation Loop
  let last = performance.now();
  let lastT = -1, lastArousal = -1;

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (state.playing && !state.scrubbing && !state.tweening) {
      advanceT(dt);
    }

    if (state.t !== lastT || state.arousal !== lastArousal) {
      updateMorph(state.t, state);
      lastT = state.t;
      lastArousal = state.arousal;
      updateUIFromT();
    }

    checkHoverPick();
    applyVisuals(now / 1000);
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
  }

  requestAnimationFrame(frame);
})();
