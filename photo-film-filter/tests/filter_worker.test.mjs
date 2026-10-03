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
