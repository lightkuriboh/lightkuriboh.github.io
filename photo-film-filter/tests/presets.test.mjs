import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PRESETS } = require('../js/app.js');

test('PRESETS - Catalog contains 48 presets with continuous IDs', () => {
  assert.strictEqual(PRESETS.length, 48);

  for (let i = 0; i < PRESETS.length; ++i) {
    const item = PRESETS[i];
    assert.strictEqual(item.id, i, `Preset at index ${i} should have id ${i}`);
    assert.ok(typeof item.name === 'string' && item.name.length > 0, `Preset ${i} has valid name`);
    assert.ok(typeof item.category === 'string' && item.category.length > 0, `Preset ${i} has valid category`);
    assert.ok(typeof item.color === 'string' && item.color.startsWith('#'), `Preset ${i} has hex color`);
    assert.ok(typeof item.desc === 'string' && item.desc.length > 0, `Preset ${i} has valid description`);

    // Category check
    assert.ok(['Baseline', 'Film', 'Effect'].includes(item.category), `Preset ${i} has recognized category`);
  }
});

test('PRESETS - Key historic films and effects are present', () => {
  const names = PRESETS.map(p => p.name);
  assert.ok(names.includes('Original'));
  assert.ok(names.includes('Kodak Portra 400'));
  assert.ok(names.includes('Kodak Tri-X 400'));
  assert.ok(names.includes('Fujifilm Velvia 50'));
  assert.ok(names.includes('CineStill 800T'));
  assert.ok(names.includes('Polaroid 600'));
  assert.ok(names.includes('Lush Natural Green'));
  assert.ok(names.includes('Cinematic Teal & Orange'));
  assert.ok(names.includes('Soft Dreamy Pastel'));
  assert.ok(names.includes('Kodak Gold 200'));
  assert.ok(names.includes('Fujifilm Pro 400H'));
  assert.ok(names.includes('Kodak Ektar 100'));
  assert.ok(names.includes('Kodak T-Max 400'));
  assert.ok(names.includes('CineStill 50D'));
  assert.ok(names.includes('Cyberpunk Neon'));
  assert.ok(names.includes('Dark Film Noir'));
  assert.ok(names.includes('Vintage 70s Fade'));
  assert.ok(names.includes('Fuji Sensia 100'));
  assert.ok(names.includes('Chrome Sensia 200'));
  assert.ok(names.includes('Fuji Astia 100F'));
  assert.ok(names.includes('Fuji Superia 200'));
  assert.ok(names.includes('Fuji Superia 800'));
  assert.ok(names.includes('Fuji Pro 160C'));
  assert.ok(names.includes('Fuji Eterna 250D'));
  assert.ok(names.includes('Fuji F-64D'));
  assert.ok(names.includes('Kodak Portra 160'));
  assert.ok(names.includes('Kodak Portra 800 HC'));
  assert.ok(names.includes('Ektachrome E100VS'));
  assert.ok(names.includes('Kodak Kodachrome 25'));
  assert.ok(names.includes('Kodak ColorPlus 200'));
  assert.ok(names.includes('Kodak Elite Color 200'));
  assert.ok(names.includes('Ilford Delta 400'));
  assert.ok(names.includes('Agfa Color XR 200'));
  assert.ok(names.includes('Agfa Precisa 100'));
  assert.ok(names.includes('Agfa Ultra Color 100'));
  assert.ok(names.includes('Lomography Negative 100'));
  assert.ok(names.includes('Lomography Negative 400'));
  assert.ok(names.includes('Lomography Redscale 100'));
  assert.ok(names.includes('Ninoco 400'));
  assert.ok(names.includes('Vibe Photo 400 Blue'));
  assert.ok(names.includes('800 RED'));
});
