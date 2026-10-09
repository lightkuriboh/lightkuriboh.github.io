import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PRESETS, FilmApp } = require('../js/app.js');
const { I18n } = require('../js/i18n.js');
const { LibraryDB } = require('../js/library.js');

global.ImageData = class MockImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};

global.SplitSlider = class MockSplitSlider {
  constructor() {}
  setImages() {}
  renderBefore() {}
  renderAfter() {}
  setDimensions(w, h) {}
};

function createMockElement(id = '', tag = 'div') {
  const classList = new Set();
  const listeners = {};
  let _innerHtml = '';
  const element = {
    id,
    tagName: tag.toUpperCase(),
    textContent: '',
    value: '',
    title: '',
    src: '',
    alt: '',
    download: '',
    href: '',
    style: {},
    dataset: {},
    children: [],
    classList: {
      add: (cls) => classList.add(cls),
      remove: (cls) => classList.delete(cls),
      contains: (cls) => classList.has(cls),
      toggle: (cls) => {
        if (classList.has(cls)) { classList.delete(cls); return false; }
        classList.add(cls); return true;
      }
    },
    addEventListener: (evt, handler) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(handler);
    },
    dispatchEvent: (evt) => {
      const handlers = listeners[evt.type || evt] || [];
      for (const h of handlers) h(evt);
    },
    trigger: (evtName, data = {}) => {
      const handlers = listeners[evtName] || [];
      for (const h of handlers) h({ target: element, preventDefault: () => {}, ...data });
    },
    click: () => {
      const handlers = listeners['click'] || [];
      for (const h of handlers) h({ target: element, preventDefault: () => {}, stopPropagation: () => {} });
    },
    setAttribute: (name, val) => { element[name] = val; },
    getAttribute: (name) => element[name] || null,
    appendChild: (child) => { element.children.push(child); return child; },
    removeChild: (child) => {
      const idx = element.children.indexOf(child);
      if (idx !== -1) element.children.splice(idx, 1);
      return child;
    }
  };

  Object.defineProperty(element, 'innerHTML', {
    get: () => _innerHtml,
    set: (val) => {
      _innerHtml = val;
      if (val === '') element.children = [];
    }
  });

  return element;
}

function setupMockEnvironment() {
  const elements = {};
  function getEl(id, tag = 'div') {
    if (!elements[id]) elements[id] = createMockElement(id, tag);
    return elements[id];
  }

  // Pre-populate core IDs
  const coreIds = [
    'engineBadge', 'latencyBadge', 'filterName', 'filterCategory', 'filterDesc',
    'filterDot', 'btnFavorite', 'favCount', 'tabFavorites', 'carouselTrack',
    'btnUpload', 'fileInput', 'btnDownload', 'btnTune', 'tuneDrawer', 'btnResetTune',
    'btnLibrary', 'btnCloseLibrary', 'libSortSelect', 'libraryModal', 'libraryGrid',
    'savePhotoModal', 'savePhotoModalImg', 'btnCloseSavePhotoModal', 'btnDoneSavePhotoModal',
    'btnInstall', 'dropZone', 'dropOverlay', 'langSelect',
    'sliderIntensity', 'valIntensity', 'sliderGrain', 'valGrain',
    'sliderVignette', 'valVignette', 'sliderExposure', 'valExposure',
    'sliderWarmth', 'valWarmth'
  ];
  for (const id of coreIds) getEl(id);

  const mockTabAll = createMockElement('tab-all');
  mockTabAll.dataset.category = 'all';
  const mockTabFilm = createMockElement('tab-film');
  mockTabFilm.dataset.category = 'Film';
  const mockTabEffect = createMockElement('tab-effect');
  mockTabEffect.dataset.category = 'Effect';
  const mockStatusInd = createMockElement('status-indicator');

  global.document = {
    getElementById: (id) => {
      const inBody = global.document.body.children.find(c => c.id === id);
      if (inBody) return inBody;
      if (elements[id]) return elements[id];
      if (id === 'appToast') return null;
      return getEl(id);
    },
    querySelector: (sel) => {
      if (sel === '.tab-btn[data-category="all"]') return mockTabAll;
      if (sel === '.tab-btn[data-category="Film"]') return mockTabFilm;
      if (sel === '.tab-btn[data-category="Effect"]') return mockTabEffect;
      if (sel === '.tab-btn[data-category="Favorites"]') return getEl('tabFavorites');
      if (sel === '.status-indicator') return mockStatusInd;
      if (sel === '.app-toast') return elements['appToast'] || null;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '.tab-btn') return [mockTabAll, getEl('tabFavorites'), mockTabFilm, mockTabEffect];
      if (sel === '.lib-chip') {
        const c1 = createMockElement('chip1'); c1.dataset.category = 'All';
        const c2 = createMockElement('chip2'); c2.dataset.category = 'Film';
        return [c1, c2];
      }
      return [];
    },
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            createLinearGradient: () => ({ addColorStop: () => {} }),
            createRadialGradient: () => ({ addColorStop: () => {} }),
            fillRect: () => {},
            strokeRect: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            bezierCurveTo: () => {},
            quadraticCurveTo: () => {},
            arc: () => {},
            closePath: () => {},
            fill: () => {},
            stroke: () => {},
            fillText: () => {},
            drawImage: () => {},
            putImageData: () => {},
            getImageData: (x, y, w, h) => ({
              width: w,
              height: h,
              data: new Uint8ClampedArray(w * h * 4)
            }),
          }),
          toBlob: (cb) => cb(new Blob(['bytes'])),
          toDataURL: () => 'data:image/png;base64,mockPng'
        };
      }
      const el = createMockElement('', tag);
      if (tag === 'div') {
        // if it's toast, track in elements
        if (el.id === 'appToast') elements['appToast'] = el;
      }
      return el;
    },
    body: createMockElement('body')
  };

  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { search: '' }
  };

  let storage = {};
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { storage = {}; }
  };

  global.confirm = () => true;

  return { elements, getEl };
}

test('FilmApp - getSwatchIconSvg renders distinct SVGs for all 48 catalog presets', () => {
  const app = Object.create(FilmApp.prototype);
  for (const preset of PRESETS) {
    const svg = app.getSwatchIconSvg(preset);
    assert.ok(typeof svg === 'string' && svg.startsWith('<svg'), `Preset ${preset.id} (${preset.name}) must produce SVG markup`);
    assert.ok(svg.includes('</svg>'), `Preset ${preset.id} SVG must be closed`);
  }
  // Test fallback preset
  const fallbackSvg = app.getSwatchIconSvg({ id: 9999, category: 'Unknown', color: '#ff0000' });
  assert.ok(fallbackSvg.includes('<svg'));
});

test('FilmApp - UI controls, sliders, and fine-tuning synchronization', () => {
  const { elements, getEl } = setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  app.params = { intensity: 1.0, grainStrength: 1.0, vignetteStrength: 1.0, exposure: 0.0, temperature: 0.0 };
  let processedCalled = false;
  app.triggerProcessing = () => { processedCalled = true; };

  // Slider bindings
  app.bindSlider('sliderIntensity', 'valIntensity', (v) => { app.params.intensity = v / 100; return `${v}%`; });
  app.bindSlider('sliderGrain', 'valGrain', (v) => { app.params.grainStrength = v / 100; return `${v}%`; });
  app.bindSlider('sliderVignette', 'valVignette', (v) => { app.params.vignetteStrength = v / 100; return `${v}%`; });
  app.bindSlider('sliderExposure', 'valExposure', (v) => { app.params.exposure = v / 10; return `${v >= 0 ? '+' : ''}${(v / 10).toFixed(1)} EV`; });
  app.bindSlider('sliderWarmth', 'valWarmth', (v) => { app.params.temperature = v / 10; return `${v >= 0 ? '+' : ''}${(v / 10).toFixed(1)}`; });

  // Simulate input
  const intensityInput = getEl('sliderIntensity');
  intensityInput.value = '75';
  intensityInput.trigger('input');
  assert.strictEqual(app.params.intensity, 0.75);
  assert.strictEqual(getEl('valIntensity').textContent, '75%');
  assert.strictEqual(processedCalled, true);

  const expInput = getEl('sliderExposure');
  expInput.value = '5';
  expInput.trigger('input');
  assert.strictEqual(app.params.exposure, 0.5);
  assert.strictEqual(getEl('valExposure').textContent, '+0.5 EV');

  const warmthInput = getEl('sliderWarmth');
  warmthInput.value = '-3';
  warmthInput.trigger('input');
  assert.strictEqual(app.params.temperature, -0.3);
  assert.strictEqual(getEl('valWarmth').textContent, '-0.3');

  // Sync sliders
  app.params = { intensity: 0.5, grainStrength: 0.8, vignetteStrength: 0.2, exposure: -0.4, temperature: 0.6 };
  app.syncSliders();
  assert.strictEqual(getEl('sliderIntensity').value, 50);
  assert.strictEqual(getEl('sliderGrain').value, 80);
  assert.strictEqual(getEl('sliderVignette').value, 20);
  assert.strictEqual(getEl('valExposure').textContent, '-0.4 EV');
  assert.strictEqual(getEl('valWarmth').textContent, '+0.6');
});

test('FilmApp - Carousel rendering across all categories and empty favorites', () => {
  const { getEl } = setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  app.selectedFilterId = 1;
  app.favorites = new Set([1, 2]);
  app.i18n = new I18n('en');
  let selectedId = null;
  app.selectFilter = (id) => { selectedId = id; };

  // 1. All category
  app.activeCategory = 'all';
  app.renderCarousel();
  const track = getEl('carouselTrack');
  assert.strictEqual(track.children.length, PRESETS.length);
  // Click first card
  track.children[0].click();
  assert.strictEqual(selectedId, PRESETS[0].id);

  // 2. Film category
  app.activeCategory = 'Film';
  app.renderCarousel();
  const filmCount = PRESETS.filter(p => p.category === 'Film').length;
  assert.strictEqual(track.children.length, filmCount);

  // 3. Effect category
  app.activeCategory = 'Effect';
  app.renderCarousel();
  const effectCount = PRESETS.filter(p => p.category === 'Effect').length;
  assert.strictEqual(track.children.length, effectCount);

  // 4. Favorites category populated
  app.activeCategory = 'Favorites';
  app.renderCarousel();
  assert.strictEqual(track.children.length, 2);

  // 5. Favorites category empty
  app.favorites = new Set();
  app.renderCarousel();
  assert.ok(track.innerHTML.includes('No favorite films yet'));
});

test('FilmApp - Favorites toggle, persistence, and localized categories', () => {
  const { getEl } = setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  app.selectedFilterId = 1;
  app.favorites = new Set();
  app.i18n = new I18n('en');
  app.showToast = () => {};
  app.renderCarousel = () => {};
  app.triggerProcessing = () => {};

  // Check initial favorite
  assert.strictEqual(app.isFavorite(1), false);

  // Toggle on
  const isFavOn = app.toggleFavorite(1);
  assert.strictEqual(isFavOn, true);
  assert.strictEqual(app.isFavorite(1), true);
  assert.strictEqual(getEl('favCount').textContent, 1);
  assert.strictEqual(getEl('btnFavorite').classList.contains('active'), true);

  // Toggle off
  const isFavOff = app.toggleFavorite(1);
  assert.strictEqual(isFavOff, false);
  assert.strictEqual(app.isFavorite(1), false);
  assert.strictEqual(getEl('favCount').textContent, 0);
  assert.strictEqual(getEl('btnFavorite').classList.contains('active'), false);

  // selectFilter localization
  app.selectFilter(1); // Kodak Portra 400 (Film)
  assert.strictEqual(getEl('filterName').textContent, 'Kodak Portra 400');
  assert.strictEqual(getEl('filterCategory').textContent, '(Film)');

  app.selectFilter(16); // Lush Natural Green (Effect)
  assert.strictEqual(getEl('filterCategory').textContent, '(Effect)');

  app.selectFilter(0); // Original (Baseline)
  assert.strictEqual(getEl('filterCategory').textContent, '(Original)');
});

test('FilmApp - loadFile, handleFileSelect, and image scaling', async () => {
  setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  let setImageDataArg = null;
  app.setImageData = (imgData) => { setImageDataArg = imgData; };
  app.showToast = () => {};

  global.FileReader = class MockFileReader {
    readAsDataURL(file) {
      if (file.name === 'error.png') {
        if (this.onerror) this.onerror(new Error('Read failed'));
      } else {
        this.result = 'data:image/png;base64,validBase64';
        if (this.onload) this.onload({ target: this });
      }
    }
  };

  global.Image = class MockImage {
    set src(val) {
      this.width = 1600;
      this.height = 1200;
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
  };

  // Test loadFile normal
  const mockFile = { name: 'photo.jpg' };
  app.loadFile(mockFile);
  await new Promise(r => setTimeout(r, 20));
  assert.ok(setImageDataArg);

  // Test loadFile error
  app.loadFile({ name: 'error.png' });

  // Test handleFileSelect
  let loadedFile = null;
  app.loadFile = (f) => { loadedFile = f; };
  app.handleFileSelect({ target: { files: [mockFile] } });
  assert.strictEqual(loadedFile, mockFile);
});

test('FilmApp - generateSyntheticTarget creates test pattern', () => {
  setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  let passedData = null;
  app.setImageData = (data) => { passedData = data; };

  app.generateSyntheticTarget();
  assert.ok(passedData);
  assert.strictEqual(passedData.width, 900);
  assert.strictEqual(passedData.height, 675);
});

test('FilmApp - Toast notification lifecycle', () => {
  setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  global.setTimeout = (cb) => { cb(); return 1; };

  app.showToast('Test Message');
  const toast = document.getElementById('appToast');
  assert.ok(toast);
  assert.strictEqual(toast.textContent, 'Test Message');
});

test('FilmApp - Library modal and grid rendering with item delete and reload', async () => {
  const { getEl } = setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  app.i18n = new I18n('en');
  app.libraryDb = new LibraryDB('mock_lib');
  app.showToast = () => {};
  app.handleLoadedImage = () => {};
  app.selectFilter = () => {};

  // Mock libraryDB methods
  let entries = [
    { id: '1', filterId: 1, filterName: 'Portra 400', width: 800, height: 600, createdAt: new Date().toISOString() }
  ];
  app.libraryDb.getEntries = async () => entries;
  app.libraryDb.getImage = async () => ({ thumbnail: 'thumbData', fullRes: 'fullData' });
  app.libraryDb.deleteEntry = async (id) => { entries = entries.filter(e => e.id !== id); };

  // Open modal
  app.openLibraryModal();
  assert.strictEqual(getEl('libraryModal').style.display, 'flex');

  // Render grid with items
  await app.renderLibraryGrid();
  const grid = getEl('libraryGrid');
  assert.strictEqual(grid.children.length, 1);

  // Click item to load
  grid.children[0].click();

  // Delete item
  const delBtn = grid.children[0].children[2].children[0];
  delBtn.click();
  await new Promise(r => setTimeout(r, 10));

  // Close modal
  app.closeLibraryModal();
  assert.strictEqual(getEl('libraryModal').style.display, 'none');

  // Empty grid render
  entries = [];
  await app.renderLibraryGrid();
  assert.ok(grid.innerHTML.includes('No saved photos yet'));
});

test('FilmApp - initWorker message dispatcher handles WASM, JS and completion', () => {
  const { getEl } = setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  let workerMessageHandler = null;
  let workerErrorHandler = null;

  global.Worker = class MockWorker {
    set onmessage(h) { workerMessageHandler = h; }
    set onerror(h) { workerErrorHandler = h; }
  };

  app.slider = { renderAfter: () => {} };
  app.pendingJobId = 123;
  app.initWorker();

  // 1. Status wasm_ready
  workerMessageHandler({ data: { type: 'status', status: 'wasm_ready' } });
  assert.strictEqual(getEl('engineBadge').textContent, 'WASM Ready');

  // 2. Status js_fallback
  workerMessageHandler({ data: { type: 'status', status: 'js_fallback' } });
  assert.strictEqual(getEl('engineBadge').textContent, 'JS Engine');

  // 3. Completion
  const buffer = new ArrayBuffer(40);
  workerMessageHandler({
    data: {
      id: 123,
      rgbaBuffer: buffer,
      width: 10,
      height: 1,
      latencyMs: 12.34,
      engineType: 'wasm'
    }
  });
  assert.ok(getEl('latencyBadge').textContent.includes('12.3 ms'));

  // 4. Error
  workerErrorHandler(new Error('Worker failure'));
});

test('FilmApp - initUI wires up all interactive controls without error', () => {
  const { getEl } = setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  app.i18n = new I18n('en');
  app.favorites = new Set([1]);
  app.presets = PRESETS;
  app.params = { intensity: 1.0, grainStrength: 1.0, vignetteStrength: 1.0, exposure: 0.0, temperature: 0.0 };
  app.updateTabLabels = () => {};
  app.renderCarousel = () => {};
  app.triggerProcessing = () => {};

  app.initUI();

  // Test Tune drawer button
  getEl('btnTune').click();
  assert.strictEqual(getEl('tuneDrawer').classList.contains('open'), true);

  // Test Reset button
  getEl('btnResetTune').click();
  assert.strictEqual(app.params.intensity, 1.0);

  // Test Save Photo modal open and close
  app.openSavePhotoModal('dataUrl');
  assert.strictEqual(getEl('savePhotoModal').style.display, 'flex');
  getEl('btnCloseSavePhotoModal').click();
  assert.strictEqual(getEl('savePhotoModal').style.display, 'none');

  // Test alias
  let exportCalled = false;
  app.exportImage = () => { exportCalled = true; };
  app.saveImageToDevice();
  assert.strictEqual(exportCalled, true);
});

test('FilmApp - constructor runs clean initialization', () => {
  setupMockEnvironment();
  global.Worker = class MockWorker {
    postMessage() {}
  };
  global.Image = class MockImage {
    set src(v) {
      this.width = 100;
      this.height = 100;
      setTimeout(() => { if (this.onload) this.onload(); }, 0);
    }
  };

  const app = new FilmApp();
  assert.strictEqual(app.selectedFilterId, 1);
  assert.strictEqual(app.activeCategory, 'all');
  assert.ok(app.params);
  assert.ok(app.favorites);
});

test('FilmApp - exportImage desktop download fallback and iOS fallback', async () => {
  setupMockEnvironment();
  const app = Object.create(FilmApp.prototype);
  app.filteredImageData = new ImageData(new Uint8ClampedArray(40), 10, 1);
  app.currentImgWidth = 10;
  app.currentImgHeight = 1;
  app.selectedFilterId = 1;
  app.libraryDb = new LibraryDB('mock_export');
  app.showToast = () => {};

  // Desktop download test
  let clickedDownload = false;
  const origCreateEl = global.document.createElement;
  global.document.createElement = (tag) => {
    const el = origCreateEl(tag);
    if (tag === 'a') {
      el.click = () => { clickedDownload = true; };
    }
    return el;
  };

  global.URL = {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {}
  };

  await app.exportImage();
  assert.strictEqual(clickedDownload, true);

  // iOS Standalone PWA fallback
  let openedModalUrl = null;
  app.openSavePhotoModal = (url) => { openedModalUrl = url; };
  const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { standalone: true, userAgent: 'iPhone' },
    configurable: true,
    writable: true
  });
  await app.exportImage();
  assert.ok(openedModalUrl);
  if (origDescriptor) {
    Object.defineProperty(globalThis, 'navigator', origDescriptor);
  }
});
