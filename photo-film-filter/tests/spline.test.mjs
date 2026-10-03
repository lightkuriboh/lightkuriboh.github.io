import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSSpline } = require('../js/filter_worker.js');

test('JSSpline - Identity curve evaluation', () => {
  const spline = new JSSpline([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  assert.ok(Math.abs(spline.eval(0.0) - 0.0) < 1e-4);
  assert.ok(Math.abs(spline.eval(0.25) - 0.25) < 1e-4);
  assert.ok(Math.abs(spline.eval(0.5) - 0.5) < 1e-4);
  assert.ok(Math.abs(spline.eval(0.75) - 0.75) < 1e-4);
  assert.ok(Math.abs(spline.eval(1.0) - 1.0) < 1e-4);
});

test('JSSpline - Clamping out-of-bounds input', () => {
  const spline = new JSSpline([{ x: 0, y: 0.2 }, { x: 1, y: 0.8 }]);
  assert.strictEqual(spline.eval(-0.5), 0.2);
  assert.strictEqual(spline.eval(1.5), 0.8);
});

test('JSSpline - S-Curve contrast boost', () => {
  const spline = new JSSpline([
    { x: 0, y: 0 },
    { x: 0.25, y: 0.15 },
    { x: 0.50, y: 0.50 },
    { x: 0.75, y: 0.85 },
    { x: 1, y: 1 }
  ]);
  assert.ok(spline.eval(0.25) < 0.25, 'Shadows should be pulled down');
  assert.ok(Math.abs(spline.eval(0.50) - 0.50) < 1e-2, 'Midpoint should be preserved');
  assert.ok(spline.eval(0.75) > 0.75, 'Highlights should be pushed up');
});

test('JSSpline - Generate LUT bounds and size', () => {
  const spline = new JSSpline([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  const lut = spline.getLUT();
  assert.strictEqual(lut.length, 256);
  assert.strictEqual(lut[0], 0);
  assert.strictEqual(lut[255], 255);

  for (let i = 0; i < 256; ++i) {
    assert.ok(lut[i] >= 0 && lut[i] <= 255);
    assert.strictEqual(lut[i], i);
  }
});
