import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { processImageJS } = require('../js/filter_worker.js');

test('processImageJS - Filter 0 (Original) preserves buffer exactly', () => {
  const w = 4, h = 4;
  const pixels = new Uint8Array(w * h * 4);
  for (let i = 0; i < pixels.length; ++i) pixels[i] = (i * 17) % 256;
  const original = new Uint8Array(pixels);

  processImageJS(pixels, w, h, 0, { intensity: 1.0 });

  assert.deepStrictEqual(pixels, original);
});

test('processImageJS - All 48 filter IDs process without NaN or throw', () => {
  const w = 4, h = 4;
  for (let filterId = 0; filterId < 48; ++filterId) {
    const pixels = new Uint8Array(w * h * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i + 0] = 120;
      pixels[i + 1] = 150;
      pixels[i + 2] = 180;
      pixels[i + 3] = 255;
    }

    processImageJS(pixels, w, h, filterId, {
      intensity: 1.0,
      grainStrength: 0.5,
      vignetteStrength: 0.5,
      exposure: 0.0,
      temperature: 0.0
    });

    for (let i = 0; i < pixels.length; ++i) {
      assert.ok(!Number.isNaN(pixels[i]), `Pixel at ${i} should not be NaN for filter ${filterId}`);
      assert.ok(pixels[i] >= 0 && pixels[i] <= 255, `Pixel at ${i} should be clamped [0, 255]`);
    }
  }
});

test('processImageJS - Monochrome filters produce equal RGB channels when grain is disabled', () => {
  const w = 4, h = 4;
  const monoFilters = [2, 7, 14, 22, 38]; // Kodak Tri-X 400 (2), Ilford HP5 Plus (7), Kodak T-Max 400 (14), Dark Film Noir (22), Ilford Delta 400 (38)

  for (const filterId of monoFilters) {
    const pixels = new Uint8Array(w * h * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i + 0] = 200;
      pixels[i + 1] = 100;
      pixels[i + 2] = 50;
      pixels[i + 3] = 255;
    }

    processImageJS(pixels, w, h, filterId, {
      intensity: 1.0,
      grainStrength: 0.0, // Disable grain to test pure monochrome mapping
      vignetteStrength: 0.0,
      exposure: 0.0,
      temperature: 0.0
    });

    for (let i = 0; i < pixels.length; i += 4) {
      assert.strictEqual(pixels[i + 0], pixels[i + 1], `Filter ${filterId}: R should equal G`);
      assert.strictEqual(pixels[i + 1], pixels[i + 2], `Filter ${filterId}: G should equal B`);
    }
  }
});

test('processImageJS - Intensity 0 preserves original image', () => {
  const w = 4, h = 4;
  const pixels = new Uint8Array(w * h * 4);
  for (let i = 0; i < pixels.length; ++i) pixels[i] = (i * 23) % 256;
  const original = new Uint8Array(pixels);

  processImageJS(pixels, w, h, 1, { intensity: 0.0 });

  assert.deepStrictEqual(pixels, original);
});

test('processImageJS - Exposure adjustment increases pixel luminance', () => {
  const w = 4, h = 4;
  const pixelsBase = new Uint8Array(w * h * 4).fill(100);
  const pixelsExposed = new Uint8Array(w * h * 4).fill(100);

  processImageJS(pixelsBase, w, h, 0, { exposure: 0.0 });
  processImageJS(pixelsExposed, w, h, 0, { exposure: 1.0 });

  // With positive exposure on baseline, pixel values should be brighter
  assert.ok(pixelsExposed[0] > pixelsBase[0]);
});

test('processImageJS - Warmth / Temperature adjustment adjusts red and blue channels', () => {
  const w = 4, h = 4;
  const pixelsWarm = new Uint8Array(w * h * 4).fill(128);
  const pixelsCool = new Uint8Array(w * h * 4).fill(128);

  processImageJS(pixelsWarm, w, h, 0, { temperature: 0.8 });
  processImageJS(pixelsCool, w, h, 0, { temperature: -0.8 });

  // Warmth increases red and decreases blue
  assert.ok(pixelsWarm[0] > pixelsWarm[2], 'Warm temperature should make red higher than blue');
  // Cool decreases red and increases blue
  assert.ok(pixelsCool[2] > pixelsCool[0], 'Cool temperature should make blue higher than red');
});

test('handleWorkerMessage - dispatches image processing and calls postMessageFn', () => {
  const { handleWorkerMessage } = require('../js/filter_worker.js');
  const w = 4, h = 4;
  const buffer = new ArrayBuffer(w * h * 4);
  const pixels = new Uint8Array(buffer).fill(128);

  let postedPayload = null;
  let postedTransfer = null;

  handleWorkerMessage({
    id: 42,
    rgbaBuffer: buffer,
    width: w,
    height: h,
    filterId: 1,
    params: { intensity: 1.0, grainStrength: 0.5, vignetteStrength: 0.5, exposure: 0.1, temperature: 0.1 }
  }, (payload, transfer) => {
    postedPayload = payload;
    postedTransfer = transfer;
  });

  assert.ok(postedPayload);
  assert.strictEqual(postedPayload.id, 42);
  assert.strictEqual(postedPayload.width, w);
  assert.strictEqual(postedPayload.height, h);
  assert.strictEqual(postedPayload.filterId, 1);
  assert.strictEqual(postedPayload.engineType, 'javascript');
  assert.ok(postedPayload.latencyMs >= 0);
  assert.ok(Array.isArray(postedTransfer) && postedTransfer.length === 1);
});
