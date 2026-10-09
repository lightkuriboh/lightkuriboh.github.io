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

test('i18n - New keys exist and translate properly in all 5 languages', () => {
  const locales = ['en', 'zh-Hans', 'zh-Hant', 'vi', 'ja'];
  const testKeys = ['tagOriginal', 'tagFiltered', 'categoryFilm', 'categoryEffect', 'categoryBaseline', 'tuneRecipe', 'noFavoritesTitle'];

  for (const loc of locales) {
    const filePath = path.join(webDir, 'i18n', `${loc}.json`);
    const dict = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const i18n = new I18n(loc, { [loc]: dict });
    for (const key of testKeys) {
      assert.ok(i18n.t(key), `${loc} should translate ${key}`);
      assert.notStrictEqual(i18n.t(key), key, `${loc} should not return fallback key for ${key}`);
    }
  }
});

test('i18n - loadLocale and setLocale with storage and custom event', async () => {
  let storedKey = null;
  let storedVal = null;
  global.localStorage = {
    getItem: (k) => (k === storedKey ? storedVal : null),
    setItem: (k, v) => { storedKey = k; storedVal = v; }
  };

  let dispatchedEvent = null;
  global.document = {
    documentElement: { lang: '' },
    querySelectorAll: () => [],
    dispatchEvent: (evt) => { dispatchedEvent = evt; }
  };
  global.CustomEvent = class {
    constructor(name, opts) {
      this.type = name;
      this.detail = opts ? opts.detail : {};
    }
  };

  // Mock fetch for loadLocale
  const origFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.includes('vi.json')) {
      return { ok: true, json: async () => ({ sample: 'Mẫu thử', tagOriginal: 'ẢNH GỐC' }) };
    }
    throw new Error('Network error');
  };

  try {
    const i18n = new I18n('en');
    await i18n.setLocale('vi');
    assert.strictEqual(i18n.locale, 'vi');
    assert.strictEqual(global.document.documentElement.lang, 'vi');
    assert.strictEqual(storedVal, 'vi');
    assert.strictEqual(dispatchedEvent?.type, 'localechange');
    assert.strictEqual(dispatchedEvent?.detail?.locale, 'vi');
    assert.strictEqual(i18n.t('tagOriginal'), 'ẢNH GỐC');

    // Test invalid locale fallback to en
    await i18n.setLocale('unknown-loc');
    assert.strictEqual(i18n.locale, 'en');

    // Test loadLocale error handling
    await i18n.loadLocale('error-loc');
  } finally {
    global.fetch = origFetch;
  }
});
