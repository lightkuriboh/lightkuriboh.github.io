/**
 * Web Worker for Asynchronous Background Image Processing
 * Prioritizes C++ WebAssembly (WASM), with zero-dependency JS fallback.
 */

let wasmEngine = null;
let wasmCtx = null;
let isWasmReady = false;

// Attempt to load WASM module if present
try {
  if (typeof importScripts === 'function') {
    importScripts('../wasm/film_engine.js');
    if (typeof FilmEngineModule === 'function') {
      FilmEngineModule().then((module) => {
        wasmEngine = module;
        wasmCtx = wasmEngine._film_engine_create();
        isWasmReady = true;
        if (typeof postMessage === 'function') {
          postMessage({ type: 'status', status: 'wasm_ready' });
        }
      }).catch(() => {
        if (typeof postMessage === 'function') {
          postMessage({ type: 'status', status: 'js_fallback' });
        }
      });
    }
  }
} catch (e) {
  // Graceful fallback to pure JS pipeline
  if (typeof postMessage === 'function') {
    postMessage({ type: 'status', status: 'js_fallback' });
  }
}

// Cubic Spline Natural Curve Evaluator in JS
class JSSpline {
  constructor(pts) {
    this.pts = pts;
    this.init();
  }

  init() {
    const n = this.pts.length;
    this.a = this.pts.map(p => p.y);
    this.b = new Float32Array(n - 1);
    this.c = new Float32Array(n);
    this.d = new Float32Array(n - 1);

    const h = new Float32Array(n - 1);
    for (let i = 0; i < n - 1; ++i) h[i] = Math.max(1e-5, this.pts[i + 1].x - this.pts[i].x);

    const alpha = new Float32Array(n - 1);
    for (let i = 1; i < n - 1; ++i) {
      alpha[i] = (3 / h[i]) * (this.a[i + 1] - this.a[i]) - (3 / h[i - 1]) * (this.a[i] - this.a[i - 1]);
    }

    const l = new Float32Array(n);
    const mu = new Float32Array(n);
    const z = new Float32Array(n);
    l[0] = 1; mu[0] = 0; z[0] = 0;

    for (let i = 1; i < n - 1; ++i) {
      l[i] = 2 * (this.pts[i + 1].x - this.pts[i - 1].x) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }
    l[n - 1] = 1; z[n - 1] = 0; this.c[n - 1] = 0;

    for (let j = n - 2; j >= 0; --j) {
      this.c[j] = z[j] - mu[j] * this.c[j + 1];
      this.b[j] = (this.a[j + 1] - this.a[j]) / h[j] - h[j] * (this.c[j + 1] + 2 * this.c[j]) / 3;
      this.d[j] = (this.c[j + 1] - this.c[j]) / (3 * h[j]);
    }
  }

  eval(x) {
    if (x <= this.pts[0].x) return this.pts[0].y;
    if (x >= this.pts[this.pts.length - 1].x) return this.pts[this.pts.length - 1].y;
    let i = 0;
    while (i < this.pts.length - 1 && x > this.pts[i + 1].x) i++;
    const dx = x - this.pts[i].x;
    return Math.max(0, Math.min(1, this.a[i] + this.b[i] * dx + this.c[i] * dx * dx + this.d[i] * dx * dx * dx));
  }

  getLUT() {
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.round(this.eval(i / 255) * 255);
    }
    return lut;
  }
}

// Fast JS implementation of the 15 recipes
function processImageJS(pixels, width, height, filterId, params) {
  const intensity = params.intensity ?? 1.0;
  const grainMult = params.grainStrength ?? 1.0;
  const vignetteMult = params.vignetteStrength ?? 1.0;
  const exposureMult = Math.pow(2.0, params.exposure ?? 0.0);
  const temp = params.temperature ?? 0.0;

  // Recipe Curve Knots definition
  let curvePts = [{x: 0, y: 0}, {x: 1, y: 1}];
  let isMono = false;
  let monoWeights = [0.299, 0.587, 0.114];
  let shadowTint = [0, 0, 0];
  let highlightTint = [0, 0, 0];
  let satBoost = 0;
  let grainIntensity = 0;
  let grainScale = 1.0;
  let vignetteAmount = 0;

  switch (filterId) {
    case 1: // Portra 400
      curvePts = [{x: 0, y: 0.08}, {x: 0.25, y: 0.28}, {x: 0.5, y: 0.52}, {x: 0.8, y: 0.79}, {x: 1, y: 0.98}];
      shadowTint = [-0.03, 0.01, 0.04];
      highlightTint = [0.06, 0.02, -0.04];
      satBoost = -0.08;
      grainIntensity = 0.28;
      break;
    case 2: // Tri-X 400
      curvePts = [{x: 0, y: 0}, {x: 0.2, y: 0.12}, {x: 0.5, y: 0.52}, {x: 0.8, y: 0.88}, {x: 1, y: 1}];
      isMono = true;
      monoWeights = [0.45, 0.45, 0.10];
      grainIntensity = 0.55;
      grainScale = 1.6;
      vignetteAmount = 0.15;
      break;
    case 3: // Velvia 50
      curvePts = [{x: 0, y: 0}, {x: 0.25, y: 0.18}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.83}, {x: 1, y: 1}];
      satBoost = 0.28;
      grainIntensity = 0.15;
      break;
    case 4: // Provia 100F
      curvePts = [{x: 0, y: 0}, {x: 0.25, y: 0.23}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.78}, {x: 1, y: 1}];
      satBoost = 0.06;
      highlightTint = [-0.01, 0, 0.02];
      grainIntensity = 0.12;
      break;
    case 5: // CineStill 800T
      curvePts = [{x: 0, y: 0.10}, {x: 0.3, y: 0.3}, {x: 0.7, y: 0.72}, {x: 1, y: 0.96}];
      shadowTint = [-0.10, 0.02, 0.14];
      highlightTint = [0.10, 0.04, -0.06];
      grainIntensity = 0.38;
      break;
    case 6: // Kodachrome 64
      curvePts = [{x: 0, y: 0.04}, {x: 0.25, y: 0.2}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.82}, {x: 1, y: 0.99}];
      shadowTint = [-0.06, 0.02, 0.06];
      highlightTint = [0.10, 0.03, -0.08];
      satBoost = 0.12;
      grainIntensity = 0.22;
      break;
    case 7: // HP5 Plus 400
      curvePts = [{x: 0, y: 0.03}, {x: 0.25, y: 0.23}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.77}, {x: 1, y: 0.98}];
      isMono = true;
      monoWeights = [0.32, 0.53, 0.15];
      grainIntensity = 0.40;
      grainScale = 1.3;
      break;
    case 8: // Ektachrome E100
      curvePts = [{x: 0, y: 0}, {x: 0.25, y: 0.2}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.81}, {x: 1, y: 1}];
      satBoost = 0.14;
      highlightTint = [-0.02, 0, 0.04];
      grainIntensity = 0.14;
      break;
    case 9: // Polaroid 600
      curvePts = [{x: 0, y: 0.18}, {x: 0.3, y: 0.34}, {x: 0.7, y: 0.7}, {x: 1, y: 0.92}];
      shadowTint = [-0.05, 0.08, 0.07];
      highlightTint = [0.08, 0.05, -0.09];
      satBoost = -0.12;
      vignetteAmount = 0.28;
      grainIntensity = 0.35;
      break;
    case 10: // Agfa Vista 200
      curvePts = [{x: 0, y: 0.06}, {x: 0.25, y: 0.24}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.8}, {x: 1, y: 1}];
      highlightTint = [0.08, -0.02, -0.04];
      satBoost = 0.14;
      grainIntensity = 0.32;
      break;
    case 11: // Kodak Gold 200
      curvePts = [{x: 0, y: 0.05}, {x: 0.25, y: 0.24}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.77}, {x: 1, y: 0.98}];
      shadowTint = [0.05, 0.03, -0.04];
      highlightTint = [0.08, 0.04, -0.06];
      satBoost = 0.12;
      grainIntensity = 0.32;
      grainScale = 1.1;
      break;
    case 12: // Fujifilm Pro 400H
      curvePts = [{x: 0, y: 0.08}, {x: 0.25, y: 0.27}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.76}, {x: 1, y: 0.96}];
      shadowTint = [-0.04, 0.03, 0.05];
      highlightTint = [0.02, 0.01, -0.01];
      satBoost = 0.05;
      grainIntensity = 0.20;
      grainScale = 0.9;
      break;
    case 13: // Kodak Ektar 100
      curvePts = [{x: 0, y: 0}, {x: 0.25, y: 0.18}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.84}, {x: 1, y: 1}];
      satBoost = 0.28;
      grainIntensity = 0.12;
      grainScale = 0.8;
      break;
    case 14: // Kodak T-Max 400
      curvePts = [{x: 0, y: 0.02}, {x: 0.25, y: 0.22}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.80}, {x: 1, y: 0.98}];
      isMono = true;
      monoWeights = [0.26, 0.62, 0.12];
      grainIntensity = 0.30;
      grainScale = 1.0;
      break;
    case 15: // CineStill 50D
      curvePts = [{x: 0, y: 0.04}, {x: 0.25, y: 0.23}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.78}, {x: 1, y: 0.98}];
      shadowTint = [-0.03, 0.01, 0.04];
      highlightTint = [0.04, 0.02, -0.02];
      satBoost = 0.10;
      grainIntensity = 0.18;
      grainScale = 0.85;
      break;
    case 16: // Lush Natural Green
      curvePts = [{x: 0, y: 0.02}, {x: 0.5, y: 0.5}, {x: 1, y: 1}];
      satBoost = 0.10;
      break;
    case 17: // Punchy Contrast
      curvePts = [{x: 0, y: 0}, {x: 0.2, y: 0.13}, {x: 0.5, y: 0.5}, {x: 0.8, y: 0.87}, {x: 1, y: 1}];
      satBoost = 0.22;
      break;
    case 18: // Golden Hour Glow
      curvePts = [{x: 0, y: 0.05}, {x: 0.5, y: 0.52}, {x: 1, y: 0.98}];
      shadowTint = [0.06, 0.02, -0.03];
      highlightTint = [0.16, 0.09, -0.14];
      satBoost = 0.12;
      vignetteAmount = 0.12;
      break;
    case 19: // Cinematic Teal & Orange
      curvePts = [{x: 0, y: 0.05}, {x: 0.25, y: 0.22}, {x: 0.75, y: 0.78}, {x: 1, y: 0.97}];
      shadowTint = [-0.18, 0.04, 0.22];
      highlightTint = [0.20, 0.08, -0.14];
      satBoost = 0.15;
      break;
    case 20: // Soft Dreamy Pastel
      curvePts = [{x: 0, y: 0.15}, {x: 0.5, y: 0.48}, {x: 1, y: 0.92}];
      highlightTint = [0.06, 0.02, 0.05];
      satBoost = -0.15;
      break;
    case 21: // Cyberpunk Neon
      curvePts = [{x: 0, y: 0}, {x: 0.25, y: 0.16}, {x: 0.5, y: 0.5}, {x: 0.75, y: 0.85}, {x: 1, y: 1}];
      shadowTint = [0.18, -0.10, 0.22];
      highlightTint = [-0.15, 0.12, 0.20];
      satBoost = 0.25;
      break;
    case 22: // Dark Film Noir
      curvePts = [{x: 0, y: 0}, {x: 0.2, y: 0.05}, {x: 0.5, y: 0.5}, {x: 0.8, y: 0.95}, {x: 1, y: 1}];
      isMono = true;
      monoWeights = [0.35, 0.55, 0.10];
      grainIntensity = 0.55;
      grainScale = 1.35;
      vignetteAmount = 0.45;
      break;
    case 23: // Vintage 70s Fade
      curvePts = [{x: 0, y: 0.14}, {x: 0.25, y: 0.30}, {x: 0.5, y: 0.52}, {x: 0.75, y: 0.74}, {x: 1, y: 0.92}];
      shadowTint = [0.06, 0.05, -0.05];
      highlightTint = [0.08, 0.03, -0.03];
      satBoost = -0.15;
      grainIntensity = 0.25;
      grainScale = 1.1;
      vignetteAmount = 0.35;
      break;
    case 24: // Fuji Sensia 100
      curvePts = [{x: 0, y: 0.02}, {x: 0.25, y: 0.22}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.80}, {x: 1, y: 0.98}];
      shadowTint = [0.02, 0.01, -0.02];
      highlightTint = [0.04, 0.02, -0.02];
      satBoost = 0.14;
      grainIntensity = 0.18;
      grainScale = 0.9;
      break;
    case 25: // Chrome Sensia 200
      curvePts = [{x: 0, y: 0.03}, {x: 0.25, y: 0.21}, {x: 0.50, y: 0.51}, {x: 0.75, y: 0.82}, {x: 1, y: 0.99}];
      shadowTint = [0.01, 0.02, -0.03];
      highlightTint = [0.05, 0.03, -0.04];
      satBoost = 0.16;
      grainIntensity = 0.24;
      grainScale = 1.05;
      break;
    case 26: // Fuji Astia 100F
      curvePts = [{x: 0, y: 0.04}, {x: 0.25, y: 0.27}, {x: 0.50, y: 0.51}, {x: 0.75, y: 0.76}, {x: 1, y: 0.97}];
      shadowTint = [-0.02, 0.01, 0.02];
      highlightTint = [0.03, 0.02, 0.0];
      satBoost = -0.04;
      grainIntensity = 0.11;
      grainScale = 0.7;
      break;
    case 27: // Fuji Superia 200
      curvePts = [{x: 0, y: 0.05}, {x: 0.25, y: 0.24}, {x: 0.50, y: 0.51}, {x: 0.75, y: 0.80}, {x: 1, y: 0.98}];
      shadowTint = [-0.04, 0.03, 0.03];
      highlightTint = [0.03, 0.01, -0.02];
      satBoost = 0.10;
      grainIntensity = 0.26;
      grainScale = 1.0;
      break;
    case 28: // Fuji Superia 800
      curvePts = [{x: 0, y: 0.08}, {x: 0.25, y: 0.23}, {x: 0.50, y: 0.52}, {x: 0.75, y: 0.82}, {x: 1, y: 0.96}];
      shadowTint = [-0.06, 0.05, 0.04];
      highlightTint = [0.05, -0.01, 0.02];
      satBoost = 0.12;
      grainIntensity = 0.44;
      grainScale = 1.45;
      break;
    case 29: // Fuji Pro 160C
      curvePts = [{x: 0, y: 0.05}, {x: 0.25, y: 0.22}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.81}, {x: 1, y: 0.99}];
      shadowTint = [-0.03, 0.02, 0.04];
      highlightTint = [0.02, 0.01, 0.0];
      satBoost = 0.12;
      grainIntensity = 0.16;
      grainScale = 0.85;
      break;
    case 30: // Fuji Eterna 250D
      curvePts = [{x: 0, y: 0.10}, {x: 0.20, y: 0.26}, {x: 0.50, y: 0.50}, {x: 0.80, y: 0.76}, {x: 1, y: 0.92}];
      shadowTint = [-0.02, 0.03, 0.03];
      highlightTint = [0.03, 0.02, -0.02];
      satBoost = -0.14;
      grainIntensity = 0.22;
      grainScale = 1.1;
      break;
    case 31: // Fuji F-64D
      curvePts = [{x: 0, y: 0.04}, {x: 0.25, y: 0.24}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.79}, {x: 1, y: 0.96}];
      shadowTint = [-0.03, 0.01, 0.04];
      highlightTint = [0.02, 0.01, -0.01];
      satBoost = 0.04;
      grainIntensity = 0.12;
      grainScale = 0.75;
      break;
    case 32: // Kodak Portra 160
      curvePts = [{x: 0, y: 0.07}, {x: 0.25, y: 0.27}, {x: 0.50, y: 0.51}, {x: 0.75, y: 0.78}, {x: 1, y: 0.97}];
      shadowTint = [-0.02, 0.01, 0.03];
      highlightTint = [0.05, 0.02, -0.03];
      satBoost = -0.06;
      grainIntensity = 0.18;
      grainScale = 0.85;
      break;
    case 33: // Kodak Portra 800 HC
      curvePts = [{x: 0, y: 0.08}, {x: 0.25, y: 0.24}, {x: 0.50, y: 0.52}, {x: 0.75, y: 0.82}, {x: 1, y: 0.98}];
      shadowTint = [-0.04, 0.00, 0.05];
      highlightTint = [0.08, 0.04, -0.05];
      satBoost = 0.08;
      grainIntensity = 0.42;
      grainScale = 1.35;
      break;
    case 34: // Ektachrome E100VS
      curvePts = [{x: 0, y: 0.0}, {x: 0.20, y: 0.15}, {x: 0.50, y: 0.50}, {x: 0.80, y: 0.88}, {x: 1, y: 1.0}];
      shadowTint = [-0.04, -0.02, 0.06];
      highlightTint = [0.08, 0.03, -0.04];
      satBoost = 0.30;
      grainIntensity = 0.18;
      grainScale = 0.85;
      break;
    case 35: // Kodak Kodachrome 25
      curvePts = [{x: 0, y: 0.01}, {x: 0.25, y: 0.19}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.84}, {x: 1, y: 1.0}];
      shadowTint = [-0.07, 0.02, 0.05];
      highlightTint = [0.12, 0.04, -0.07];
      satBoost = 0.18;
      grainIntensity = 0.10;
      grainScale = 0.6;
      break;
    case 36: // Kodak ColorPlus 200
      curvePts = [{x: 0, y: 0.07}, {x: 0.25, y: 0.26}, {x: 0.50, y: 0.51}, {x: 0.75, y: 0.78}, {x: 1, y: 0.96}];
      shadowTint = [0.04, 0.05, -0.06];
      highlightTint = [0.09, 0.05, -0.07];
      satBoost = 0.08;
      grainIntensity = 0.38;
      grainScale = 1.25;
      break;
    case 37: // Kodak Elite Color 200
      curvePts = [{x: 0, y: 0.03}, {x: 0.25, y: 0.22}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.81}, {x: 1, y: 0.99}];
      shadowTint = [0.02, 0.01, -0.03];
      highlightTint = [0.06, 0.03, -0.04];
      satBoost = 0.15;
      grainIntensity = 0.28;
      grainScale = 1.05;
      break;
    case 38: // Ilford Delta 400
      curvePts = [{x: 0, y: 0.02}, {x: 0.25, y: 0.21}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.81}, {x: 1, y: 0.99}];
      isMono = true;
      monoWeights = [0.35, 0.50, 0.15];
      grainIntensity = 0.32;
      grainScale = 1.15;
      break;
    case 39: // Agfa Color XR 200
      curvePts = [{x: 0, y: 0.08}, {x: 0.25, y: 0.26}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.77}, {x: 1, y: 0.95}];
      shadowTint = [0.02, 0.04, -0.04];
      highlightTint = [0.06, 0.03, -0.03];
      satBoost = 0.06;
      grainIntensity = 0.36;
      grainScale = 1.25;
      break;
    case 40: // Agfa Precisa 100
      curvePts = [{x: 0, y: 0.01}, {x: 0.25, y: 0.19}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.82}, {x: 1, y: 1.0}];
      shadowTint = [-0.04, 0.02, 0.08];
      highlightTint = [0.05, -0.01, 0.0];
      satBoost = 0.20;
      grainIntensity = 0.16;
      grainScale = 0.85;
      break;
    case 41: // Agfa Ultra Color 100
      curvePts = [{x: 0, y: 0.0}, {x: 0.20, y: 0.14}, {x: 0.50, y: 0.50}, {x: 0.80, y: 0.87}, {x: 1, y: 1.0}];
      shadowTint = [0.02, -0.03, 0.05];
      highlightTint = [0.10, 0.04, -0.05];
      satBoost = 0.34;
      grainIntensity = 0.24;
      grainScale = 1.0;
      break;
    case 42: // Lomography Negative 100
      curvePts = [{x: 0, y: 0.03}, {x: 0.25, y: 0.21}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.81}, {x: 1, y: 0.99}];
      shadowTint = [0.0, 0.02, -0.03];
      highlightTint = [0.06, 0.03, -0.04];
      satBoost = 0.18;
      grainIntensity = 0.22;
      grainScale = 0.95;
      vignetteAmount = 0.18;
      break;
    case 43: // Lomography Negative 400
      curvePts = [{x: 0, y: 0.06}, {x: 0.25, y: 0.22}, {x: 0.50, y: 0.51}, {x: 0.75, y: 0.82}, {x: 1, y: 0.97}];
      shadowTint = [0.02, 0.03, -0.04];
      highlightTint = [0.08, 0.04, -0.05];
      satBoost = 0.16;
      grainIntensity = 0.40;
      grainScale = 1.35;
      vignetteAmount = 0.22;
      break;
    case 44: // Lomography Redscale 100
      curvePts = [{x: 0, y: 0.04}, {x: 0.25, y: 0.20}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.83}, {x: 1, y: 0.96}];
      shadowTint = [0.25, -0.05, -0.20];
      highlightTint = [0.30, 0.10, -0.25];
      satBoost = 0.22;
      grainIntensity = 0.35;
      grainScale = 1.2;
      vignetteAmount = 0.45;
      break;
    case 45: // Ninoco 400
      curvePts = [{x: 0, y: 0.06}, {x: 0.25, y: 0.22}, {x: 0.50, y: 0.51}, {x: 0.75, y: 0.83}, {x: 1, y: 0.98}];
      shadowTint = [0.04, -0.03, 0.06];
      highlightTint = [0.08, 0.03, -0.04];
      satBoost = 0.14;
      grainIntensity = 0.38;
      grainScale = 1.25;
      break;
    case 46: // Vibe Photo 400 Blue
      curvePts = [{x: 0, y: 0.05}, {x: 0.25, y: 0.23}, {x: 0.50, y: 0.50}, {x: 0.75, y: 0.80}, {x: 1, y: 0.97}];
      shadowTint = [-0.06, 0.02, 0.12];
      highlightTint = [-0.02, 0.02, 0.05];
      satBoost = 0.04;
      grainIntensity = 0.35;
      grainScale = 1.2;
      break;
    case 47: // 800 RED
      curvePts = [{x: 0, y: 0.06}, {x: 0.20, y: 0.16}, {x: 0.50, y: 0.51}, {x: 0.80, y: 0.85}, {x: 1, y: 0.98}];
      shadowTint = [0.14, -0.04, -0.10];
      highlightTint = [0.22, 0.06, -0.16];
      satBoost = 0.24;
      grainIntensity = 0.48;
      grainScale = 1.5;
      vignetteAmount = 0.28;
      break;
  }

  const lut = new JSSpline(curvePts).getLUT();
  const effGrain = grainIntensity * grainMult;
  const effVignette = vignetteAmount * vignetteMult;
  const halfW = width * 0.5;
  const halfH = height * 0.5;

  for (let y = 0; y < height; ++y) {
    const ny = (y - halfH) / halfH;
    for (let x = 0; x < width; ++x) {
      const idx = (y * width + x) * 4;
      const origR = pixels[idx + 0];
      const origG = pixels[idx + 1];
      const origB = pixels[idx + 2];

      let r = origR / 255;
      let g = origG / 255;
      let b = origB / 255;

      // Exposure
      if (Math.abs(params.exposure || 0) > 0.01) {
        r = Math.min(1, r * exposureMult);
        g = Math.min(1, g * exposureMult);
        b = Math.min(1, b * exposureMult);
      }

      // Warmth
      if (Math.abs(temp) > 0.01) {
        r = Math.min(1, Math.max(0, r * (1 + temp * 0.2)));
        b = Math.min(1, Math.max(0, b * (1 - temp * 0.2)));
      }

      // Monochrome
      if (isMono) {
        const mono = monoWeights[0] * r + monoWeights[1] * g + monoWeights[2] * b;
        r = g = b = mono;
      }

      // Tone curve LUT
      r = lut[Math.round(r * 255)] / 255;
      g = lut[Math.round(g * 255)] / 255;
      b = lut[Math.round(b * 255)] / 255;

      // Split Toning
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const hWeight = Math.max(0, Math.min(1, (lum - 0.25) / 0.5));
      const sWeight = 1 - hWeight;
      r = Math.max(0, Math.min(1, r + shadowTint[0] * sWeight + highlightTint[0] * hWeight));
      g = Math.max(0, Math.min(1, g + shadowTint[1] * sWeight + highlightTint[1] * hWeight));
      b = Math.max(0, Math.min(1, b + shadowTint[2] * sWeight + highlightTint[2] * hWeight));

      // Saturation
      if (!isMono && Math.abs(satBoost) > 0.01) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        const sf = 1 + satBoost;
        r = Math.max(0, Math.min(1, l + (r - l) * sf));
        g = Math.max(0, Math.min(1, l + (g - l) * sf));
        b = Math.max(0, Math.min(1, l + (b - l) * sf));
      }

      // Vignette
      if (effVignette > 0.01) {
        const nx = (x - halfW) / halfW;
        const dist = Math.sqrt(nx * nx + ny * ny) * 0.7071;
        if (dist > 0.5) {
          const t = Math.min(1, (dist - 0.5) / 0.5);
          const vf = 1 - effVignette * t * t;
          r *= vf; g *= vf; b *= vf;
        }
      }

      // Grain
      if (effGrain > 0.01) {
        const lKey = 4 * lum * (1 - lum);
        const noise = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 2 - 1;
        const gOff = noise * (effGrain * 0.08) * lKey;
        r = Math.max(0, Math.min(1, r + gOff));
        g = Math.max(0, Math.min(1, g + gOff));
        b = Math.max(0, Math.min(1, b + gOff));
      }

      // Intensity blend
      if (intensity < 0.99) {
        const oR = origR / 255;
        const oG = origG / 255;
        const oB = origB / 255;
        r = oR + intensity * (r - oR);
        g = oG + intensity * (g - oG);
        b = oB + intensity * (b - oB);
      }

      pixels[idx + 0] = Math.round(r * 255);
      pixels[idx + 1] = Math.round(g * 255);
      pixels[idx + 2] = Math.round(b * 255);
    }
  }
}

function handleWorkerMessage(data, postMessageFn) {
  const { id, rgbaBuffer, width, height, filterId, params } = data;
  const startTime = performance.now();

  let engineType = 'javascript';
  const pixels = new Uint8Array(rgbaBuffer);

  if (isWasmReady && wasmEngine && wasmCtx) {
    try {
      engineType = 'wasm';
      const byteLen = width * height * 4;
      const heapPtr = wasmEngine._malloc(byteLen);
      wasmEngine.HEAPU8.set(pixels, heapPtr);

      wasmEngine._film_engine_process_rgba(
        wasmCtx,
        heapPtr,
        width,
        height,
        width * 4,
        filterId,
        params.intensity ?? 1.0,
        params.grainStrength ?? 1.0,
        params.vignetteStrength ?? 1.0,
        params.exposure ?? 0.0,
        params.temperature ?? 0.0
      );

      pixels.set(wasmEngine.HEAPU8.subarray(heapPtr, heapPtr + byteLen));
      wasmEngine._free(heapPtr);
    } catch (err) {
      console.warn('WASM execution failed, falling back to JS:', err);
      processImageJS(pixels, width, height, filterId, params);
      engineType = 'javascript_fallback';
    }
  } else {
    processImageJS(pixels, width, height, filterId, params);
  }

  const latencyMs = performance.now() - startTime;

  if (typeof postMessageFn === 'function') {
    postMessageFn({
      id,
      rgbaBuffer: pixels.buffer,
      width,
      height,
      filterId,
      latencyMs,
      engineType
    }, [pixels.buffer]); // Zero-copy transfer
  }
}

// Processing dispatcher
if (typeof self !== 'undefined') {
  self.onmessage = function(e) {
    handleWorkerMessage(e.data, (payload, transfer) => self.postMessage(payload, transfer));
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { JSSpline, processImageJS, handleWorkerMessage };
}

