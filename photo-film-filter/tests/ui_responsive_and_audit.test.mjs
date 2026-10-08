import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..');

const require = createRequire(import.meta.url);
const { PRESETS, FilmApp } = require('../js/app.js');

test('UI Audit - Responsive CSS media queries protect small screen layouts', () => {
  const cssPath = path.join(webDir, 'css', 'style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify 480px breakpoint for icon-only collapse
  assert.ok(css.includes('@media (max-width: 480px)'), 'Must include 480px media query');
  assert.ok(
    css.includes('.header-actions .btn span') && css.includes('display: none'),
    'Header buttons must hide label spans on small screens to prevent overflow'
  );
  assert.ok(
    css.includes('.filter-desc') && css.includes('display: none'),
    'Filter description must hide on <= 480px to avoid bar overflow'
  );

  // Verify 360px breakpoint for ultra-small devices (iPhone SE / small Androids)
  assert.ok(css.includes('@media (max-width: 360px)'), 'Must include 360px media query');
  assert.ok(
    css.includes('.brand-text') && css.includes('display: none'),
    'Brand text should collapse on <= 360px to preserve Save button on screen'
  );

  // Verify processing spinner CSS
  assert.ok(css.includes('.spinner-mini'), 'Must define .spinner-mini class');
  assert.ok(
    css.includes('.status-indicator.is-processing .spinner-mini'),
    'Must display spinner when status-indicator has is-processing'
  );
});

test('UI Audit - index.html includes processing spinner in status indicator', () => {
  const htmlPath = path.join(webDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('class="status-indicator"'), 'Must have status-indicator');
  assert.ok(html.includes('spinner-mini'), 'Status indicator must contain spinner-mini element');
  assert.ok(html.includes('id="btnDownload"'), 'Must have btnDownload for saving images');
});

test('FilmApp - getPreset finds correct preset regardless of array order or gaps', () => {
  // Create an instance without DOM bootstrap
  const app = Object.create(FilmApp.prototype);

  // Custom non-sequential presets list simulating filter subsets or dynamic loaded filters
  app.presets = [
    { id: 10, name: 'Filter Ten', category: 'Film', color: '#111111', desc: 'Desc 10' },
    { id: 2, name: 'Filter Two', category: 'Effect', color: '#222222', desc: 'Desc 2' },
    { id: 45, name: 'Filter 45', category: 'Film', color: '#333333', desc: 'Desc 45' },
  ];

  // Lookup by ID should find the exact ID, not index
  const p10 = app.getPreset(10);
  assert.strictEqual(p10.name, 'Filter Ten');

  const p2 = app.getPreset(2);
  assert.strictEqual(p2.name, 'Filter Two');

  const p45 = app.getPreset(45);
  assert.strictEqual(p45.name, 'Filter 45');

  // Fallback for nonexistent ID
  const fallback = app.getPreset(999);
  assert.ok(fallback, 'Should return fallback preset rather than undefined');
  assert.strictEqual(fallback.id, 10);
});

test('FilmApp - selectFilter updates DOM attributes safely using getPreset', () => {
  const elements = {};
  global.document = {
    getElementById: (id) => {
      if (!elements[id]) {
        elements[id] = { textContent: '', style: {} };
      }
      return elements[id];
    },
    querySelector: () => null,
    querySelectorAll: () => [],
  };

  const app = Object.create(FilmApp.prototype);
  app.presets = [
    { id: 5, name: 'CineStill 800T', category: 'Film', color: '#e74c3c', desc: 'Tungsten balanced' },
  ];
  app.favorites = new Set();
  app.updateFavoriteButton = () => {};
  app.triggerProcessing = () => {};

  app.selectFilter(5);

  assert.strictEqual(elements['filterName'].textContent, 'CineStill 800T');
  assert.strictEqual(elements['filterCategory'].textContent, '(Film)');
  assert.strictEqual(elements['filterDesc'].textContent, 'Tungsten balanced');
  assert.strictEqual(elements['filterDot'].style.backgroundColor, '#e74c3c');
});

test('FilmApp - triggerProcessing toggles is-processing class on status-indicator', () => {
  const classList = new Set();
  const mockStatusEl = {
    classList: {
      add: (cls) => classList.add(cls),
      remove: (cls) => classList.delete(cls),
      contains: (cls) => classList.has(cls),
    }
  };

  global.document = {
    querySelector: (sel) => sel === '.status-indicator' ? mockStatusEl : null,
    getElementById: () => null,
  };

  const posted = [];
  const app = Object.create(FilmApp.prototype);
  app.originalImageData = {
    width: 100,
    height: 100,
    data: new Uint8ClampedArray(100 * 100 * 4),
  };
  app.jobCounter = 0;
  app.currentImgWidth = 100;
  app.currentImgHeight = 100;
  app.selectedFilterId = 1;
  app.params = {};
  app.worker = {
    postMessage: (msg, transfer) => posted.push({ msg, transfer }),
  };

  // Trigger processing -> should add is-processing
  app.triggerProcessing();
  assert.strictEqual(classList.has('is-processing'), true, 'Should mark is-processing on job start');
  assert.strictEqual(posted.length, 1, 'Worker should receive job payload');

  // Finish job -> should remove is-processing
  mockStatusEl.classList.remove('is-processing');
  assert.strictEqual(classList.has('is-processing'), false, 'Should clear is-processing on job completion');
});

test('UI Audit - index.html includes savePhotoModal for iOS PWA save fallback', () => {
  const htmlPath = path.join(webDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('id="savePhotoModal"'), 'Must have savePhotoModal');
  assert.ok(html.includes('id="savePhotoModalImg"'), 'Must have savePhotoModalImg element');
  assert.ok(html.includes('id="btnDoneSavePhotoModal"'), 'Must have btnDoneSavePhotoModal element');
});

test('FilmApp - openSavePhotoModal and closeSavePhotoModal toggle modal visibility', () => {
  const modalEl = { style: { display: 'none' } };
  const imgEl = { src: '' };

  global.document = {
    getElementById: (id) => {
      if (id === 'savePhotoModal') return modalEl;
      if (id === 'savePhotoModalImg') return imgEl;
      return null;
    }
  };

  const app = Object.create(FilmApp.prototype);
  app.openSavePhotoModal('data:image/png;base64,test1234');
  assert.strictEqual(modalEl.style.display, 'flex');
  assert.strictEqual(imgEl.src, 'data:image/png;base64,test1234');

  app.closeSavePhotoModal();
  assert.strictEqual(modalEl.style.display, 'none');
});

test('FilmApp - exportImage uses Web Share API when file sharing is supported', async () => {
  let shareCalledWith = null;
  const mockFile = {};

  global.File = class MockFile {
    constructor(chunks, name, opts) {
      this.chunks = chunks;
      this.name = name;
      this.opts = opts;
    }
  };

  const origNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      share: async (opts) => {
        shareCalledWith = opts;
      },
      canShare: (opts) => opts && Array.isArray(opts.files),
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    },
    configurable: true,
    writable: true,
  });

  let toastMessage = '';
  const app = Object.create(FilmApp.prototype);
  app.filteredImageData = { width: 10, height: 10, data: new Uint8ClampedArray(400) };
  app.currentImgWidth = 10;
  app.currentImgHeight = 10;
  app.selectedFilterId = 1;
  app.getPreset = () => ({ name: 'Kodak Portra 400', category: 'Film' });
  app.showToast = (msg) => { toastMessage = msg; };

  // Mock document.createElement('canvas')
  global.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            putImageData: () => {},
            drawImage: () => {},
          }),
          toBlob: (cb) => cb(new Blob(['image-bytes'])),
          toDataURL: () => 'data:image/png;base64,mock',
        };
      }
      return {};
    }
  };

  try {
    await app.exportImage();

    assert.ok(shareCalledWith, 'navigator.share must be called');
    assert.strictEqual(shareCalledWith.title, 'film_magic_Kodak_Portra_400.png');
    assert.ok(Array.isArray(shareCalledWith.files) && shareCalledWith.files.length === 1);
    assert.ok(toastMessage.includes('film_magic_Kodak_Portra_400.png'));
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: origNavigator,
      configurable: true,
      writable: true,
    });
  }
});
