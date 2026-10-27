/**
 * Educational Guide Panel, Accordions, Homology Matrix & Tissue Information
 */
import { KEYS } from '../config.js';
import { state, curI18n, TERMS } from '../state.js';
import { getStageMeta } from './dock.js';
import { togglePin } from './scene.js';

let panel, panelBackdrop, btnPanel, btnInfo, btnPanelClose, btnAccToggle, sheetHandle;

export function initPanel() {
  panel = document.getElementById('panel');
  panelBackdrop = document.getElementById('panel-backdrop');
  btnPanel = document.getElementById('btn-panel');
  btnInfo = document.getElementById('btn-info');
  btnPanelClose = document.getElementById('btn-panel-close');
  btnAccToggle = document.getElementById('btn-acc-toggle');
  sheetHandle = document.querySelector('.sheet-handle');

  // Panel toggle listeners
  btnPanel?.addEventListener('click', togglePanel);
  btnInfo?.addEventListener('click', togglePanel);
  btnPanelClose?.addEventListener('click', () => setPanelOpen(false));
  panelBackdrop?.addEventListener('click', () => setPanelOpen(false));
  sheetHandle?.addEventListener('click', () => setPanelOpen(false));

  // Isolate panel scrolling and touch events so they NEVER bleed into OrbitControls
  ['wheel', 'touchmove', 'touchstart', 'touchend', 'pointerdown'].forEach(ev => {
    panel.addEventListener(ev, e => e.stopPropagation(), { passive: true });
  });

  // Accordion toggle clicks
  document.querySelectorAll('.acc > button').forEach(b =>
    b.addEventListener('click', () => {
      const a = b.parentElement;
      const willOpen = !a.classList.contains('open');
      a.classList.toggle('open', willOpen);
      b.setAttribute('aria-expanded', String(willOpen));
      updateAccToggleLabel();
      if (willOpen) {
        setTimeout(() => {
          const panelInner = document.getElementById('panel-inner');
          if (!panelInner) return;
          const bRect = b.getBoundingClientRect();
          const pRect = panelInner.getBoundingClientRect();
          if (bRect.bottom > pRect.bottom - 40) {
            b.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 150);
      }
    })
  );

  btnAccToggle?.addEventListener('click', () => {
    const accs = document.querySelectorAll('.acc');
    const allOpen = Array.from(accs).every(a => a.classList.contains('open'));
    const targetState = !allOpen;
    accs.forEach(a => {
      a.classList.toggle('open', targetState);
      a.querySelector('button')?.setAttribute('aria-expanded', String(targetState));
    });
    updateAccToggleLabel();
  });

  // Legend header toggle
  const legendToggle = document.getElementById('legend-toggle');
  if (legendToggle) {
    legendToggle.addEventListener('click', () => {
      const lg = document.getElementById('legend');
      lg.classList.toggle('collapsed');
      lg.classList.toggle('userOpen', !lg.classList.contains('collapsed'));
      legendToggle.setAttribute('aria-expanded', String(!lg.classList.contains('collapsed')));
    });
  }

  // Populate legend rows
  buildLegendList();

  // Initial panel responsiveness
  if (window.innerWidth <= 900) {
    setPanelOpen(false);
  } else {
    setPanelOpen(true);
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && panelBackdrop && panelBackdrop.classList.contains('active')) {
      panelBackdrop.classList.remove('active');
    }
  });
}

export function buildLegendList() {
  const legendList = document.getElementById('legend-list');
  if (!legendList) return;
  legendList.innerHTML = '';

  KEYS.forEach(k => {
    const t = TERMS.tissues[k];
    const b = document.createElement('button');
    b.className = 'lrow';
    b.dataset.tissue = k;
    b.setAttribute('aria-label', t.name);
    b.innerHTML =
      '<span class="chips"><span class="chip" style="background:' +
      t.color +
      '"></span><span class="chip atl" style="background:' +
      t.atlas +
      '"></span></span>' +
      '<span class="ltxt"><span class="lname">' +
      t.name +
      '</span><span class="lder" id="der-' +
      k +
      '"></span></span>';
    b.addEventListener('mouseenter', () => {
      if (!state.pinned) setHighlight(k);
    });
    b.addEventListener('mouseleave', () => {
      if (!state.pinned) setHighlight(null);
    });
    b.addEventListener('focus', () => {
      if (!state.pinned) setHighlight(k);
    });
    b.addEventListener('click', () => togglePin(k));
    legendList.appendChild(b);
  });
}

export function setPanelOpen(open) {
  if (!panel) return;
  panel.classList.toggle('collapsed', !open);
  if (btnPanel) btnPanel.setAttribute('aria-expanded', String(open));
  if (btnInfo) {
    btnInfo.classList.toggle('on', open);
    btnInfo.setAttribute('aria-pressed', String(open));
  }
  if (panelBackdrop) {
    panelBackdrop.classList.toggle('active', open && window.innerWidth <= 900);
  }
}

export function togglePanel() {
  const isCurrentlyOpen = !panel.classList.contains('collapsed');
  setPanelOpen(!isCurrentlyOpen);
}

export function updateAccToggleLabel() {
  const accs = document.querySelectorAll('.acc');
  const allOpen = Array.from(accs).every(a => a.classList.contains('open'));
  const L = curI18n();
  if (btnAccToggle) btnAccToggle.textContent = allOpen ? L.collapseAll : L.expandAll;
}

export function renderMatrix() {
  const matrixBody = document.querySelector('#matrix tbody');
  if (!matrixBody) return;
  matrixBody.innerHTML = '';
  KEYS.forEach(k => {
    const t = TERMS.tissues;
    const tr = document.createElement('tr');
    tr.dataset.tissue = k;
    tr.style.cursor = 'pointer';
    if (state.highlight === k) tr.classList.add('hl');
    tr.innerHTML =
      '<td><span class="tchip" style="background:' +
      t[k].color +
      '"></span><strong>' +
      t[k].name +
      '</strong></td><td>' +
      t[k].s0 +
      '</td><td>' +
      t[k].femaleAdult +
      '</td><td>' +
      t[k].maleAdult +
      '</td>';
    tr.addEventListener('click', () => togglePin(k));
    matrixBody.appendChild(tr);
  });
}

export function renderTissueDescs() {
  const container = document.getElementById('tissue-descs');
  if (!container) return;
  const L = curI18n();
  container.innerHTML = KEYS.map(k => {
    const t = TERMS.tissues[k];
    return (
      '<div class="tissue-desc" style="--c:' +
      t.color +
      '"><h5>' +
      t.name +
      '</h5><p>' +
      t.desc +
      '</p><p><strong>' +
      L.adultHomologuesLabel +
      '</strong> ' +
      t.femaleAdult +
      ' (' +
      L.femaleLabel +
      ') / ' +
      t.maleAdult +
      ' (' +
      L.maleLabel +
      ')</p></div>'
    );
  }).join('');
}

export function renderPanelStatic() {
  const L = curI18n();
  const endo = document.getElementById('endocrine-steps');
  if (endo) {
    endo.innerHTML = L.endocrineSteps
      .map(s => '<div class="step ' + s.cls + '"><strong>' + s.num + '</strong> ' + s.text + '</div>')
      .join('');
  }
  const pub = document.getElementById('pubertal-steps');
  if (pub) {
    pub.innerHTML = L.pubertalSteps
      .map(s => '<div class="step ' + s.cls + '"><strong>' + s.lead + '</strong> ' + s.body + '</div>')
      .join('');
  }
  const clin = document.getElementById('clinical-callouts');
  if (clin) {
    clin.innerHTML = L.clinicalItems
      .map(c => '<div class="callout"><h5>' + c.head + '</h5>' + c.text + '</div>')
      .join('');
  }
}

export function renderInfoCard() {
  const k = state.highlight;
  const card = document.getElementById('info-card');
  if (!card) return;
  if (!k) {
    card.classList.remove('show');
    return;
  }
  const t = TERMS.tissues[k];
  const meta = getStageMeta(state.t);
  const curKey = meta.key;
  const L = curI18n().infoLabels;
  const b = (txt, key) => '<b class="' + (curKey === key ? 'now' : '') + '">' + txt + '</b>';

  card.classList.add('show');
  document.getElementById('info-chip').style.background = t.color;
  document.getElementById('info-name').textContent = t.name;
  document.getElementById('info-body').innerHTML =
    L.w7 +
    ': ' +
    b(t.s0, 's0') +
    '<br>' +
    L.female +
    ': ' +
    b(t[curKey.startsWith('female') ? curKey : 'femaleAdult'], curKey) +
    ' &middot; ' +
    L.male +
    ': ' +
    b(t[curKey.startsWith('male') ? curKey : 'maleAdult'], curKey);
}

export function setHighlight(k) {
  state.highlight = k;
  document.querySelectorAll('.lrow').forEach(r => r.classList.toggle('active', r.dataset.tissue === k));
  document.querySelectorAll('#matrix tbody tr').forEach(r => r.classList.toggle('hl', r.dataset.tissue === k));
  renderInfoCard();
}
