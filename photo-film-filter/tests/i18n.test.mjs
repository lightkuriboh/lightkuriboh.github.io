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
const { I18n } = require('../js/i18n.js');

test('i18n - Translation JSON files exist and have consistent schema across 5 languages', () => {
  const locales = ['en', 'zh-Hans', 'zh-Hant', 'vi', 'ja'];
  const dictionaries = {};

  for (const loc of locales) {
    const filePath = path.join(webDir, 'i18n', `${loc}.json`);
    assert.ok(fs.existsSync(filePath), `Translation file ${loc}.json must exist`);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    assert.ok(typeof parsed === 'object' && parsed !== null, `${loc}.json must parse to object`);
    dictionaries[loc] = parsed;
  }

  const enKeys = Object.keys(dictionaries['en']);
  assert.ok(enKeys.length > 15, 'English base dictionary must contain core keys');

  for (const loc of locales) {
    if (loc === 'en') continue;
    const locKeys = Object.keys(dictionaries[loc]);
    for (const key of enKeys) {
      assert.ok(locKeys.includes(key), `Locale ${loc} must contain key "${key}"`);
      assert.ok(
        typeof dictionaries[loc][key] === 'string' && dictionaries[loc][key].length > 0,
        `Locale ${loc} key "${key}" must be a non-empty string`
      );
    }
  }
});

test('i18n - Locale detection respects priority: URL param > storage > browser > fallback', () => {
  const i18n = new I18n();

  // 1. URL search param has highest priority
  assert.strictEqual(
    i18n.detectLocale('?lang=ja', 'vi', 'en-US'),
    'ja',
    'URL param ?lang=ja must override storage and browser'
  );

  // 2. Storage has second priority
  assert.strictEqual(
    i18n.detectLocale('', 'zh-Hans', 'en-US'),
    'zh-Hans',
    'localStorage must override browser when URL param absent'
  );

  // 3. Browser locale used when no URL or storage
  assert.strictEqual(
    i18n.detectLocale('', undefined, 'vi-VN'),
    'vi',
    'Browser language must be detected when URL and storage are absent'
  );

  // 4. Dialect normalization
  assert.strictEqual(i18n.detectLocale('?lang=zh-CN'), 'zh-Hans');
  assert.strictEqual(i18n.detectLocale('?lang=zh-TW'), 'zh-Hant');
  assert.strictEqual(i18n.detectLocale('?lang=zh-HK'), 'zh-Hant');
  assert.strictEqual(i18n.detectLocale('?lang=ja-JP'), 'ja');
  assert.strictEqual(i18n.detectLocale('?lang=unknown'), 'en');
});

test('i18n - t() performs correct translation and variable interpolation', () => {
  const i18n = new I18n('en');

  // Direct lookup
  assert.strictEqual(i18n.t('sample'), 'Sample');

  // Interpolation
  assert.strictEqual(i18n.t('allPresets', { count: 48 }), 'All Presets (48)');
  assert.strictEqual(i18n.t('savedToDevice', { fileName: 'test.png' }), 'Saved to device: test.png');
  assert.strictEqual(
    i18n.t('addedToFavorites', { name: 'Kodak Portra 400' }),
    'Added "Kodak Portra 400" to Favorites'
  );

  // Fallback to English when key missing in active locale
  i18n.setDictionary('ja', { sample: 'サンプル' }); // Missing other keys
  i18n.locale = 'ja';
  assert.strictEqual(i18n.t('sample'), 'サンプル');
  assert.strictEqual(i18n.t('install'), 'Install'); // Falls back to en

  // Fallback to key when key missing everywhere
  assert.strictEqual(i18n.t('nonexistent_key'), 'nonexistent_key');
});

test('i18n - applyToDOM updates textContent and title based on data attributes', () => {
  const textEl = { dataset: { i18n: 'sample' }, textContent: '' };
  const titleEl = { dataset: { i18nTitle: 'saveImageTitle' }, title: '' };
  const placeholderEl = { dataset: { i18nPlaceholder: 'appTitle' }, placeholder: '' };

  global.document = {
    querySelectorAll: (sel) => {
      if (sel === '[data-i18n]') return [textEl];
      if (sel === '[data-i18n-title]') return [titleEl];
      if (sel === '[data-i18n-placeholder]') return [placeholderEl];
      return [];
    }
  };

  const i18n = new I18n('en');
  i18n.applyToDOM();

  assert.strictEqual(textEl.textContent, 'Sample');
  assert.strictEqual(titleEl.title, 'Save image to local device');
  assert.strictEqual(placeholderEl.placeholder, 'FILM MAGIC');
});
