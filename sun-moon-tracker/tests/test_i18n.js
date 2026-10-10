import assert from 'node:assert';
import { I18n } from '../js/ui/i18n.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log("============================================================");
console.log("  LandscapeHelper i18n Unit Tests                           ");
console.log("============================================================");

function testLocaleResolution() {
    console.log("[TEST 1] Locale Code Resolution...");
    const i18n = new I18n();

    assert.strictEqual(i18n.resolveLocale('en-US'), 'en');
    assert.strictEqual(i18n.resolveLocale('zh-TW'), 'zh-TW');
    assert.strictEqual(i18n.resolveLocale('zh-HK'), 'zh-TW');
    assert.strictEqual(i18n.resolveLocale('zh-CN'), 'zh-CN');
    assert.strictEqual(i18n.resolveLocale('zh'), 'zh-CN');
    assert.strictEqual(i18n.resolveLocale('vi-VN'), 'vi');
    assert.strictEqual(i18n.resolveLocale('ja-JP'), 'ja');
    assert.strictEqual(i18n.resolveLocale('de-DE'), 'en'); // Fallback
    assert.strictEqual(i18n.resolveLocale(null), 'en');
    console.log("  ✓ Locale resolution PASSED!");
}

function testTranslationsAndParamInterpolation() {
    console.log("[TEST 2] Translation & Parameter Interpolation...");
    const i18n = new I18n();
    i18n.strings = {
        'app_title': 'Stellar Vista',
        'greeting': 'Hello, {name}!',
        'sun_altitude': 'Sun altitude is {alt}° at {time}'
    };

    assert.strictEqual(i18n.t('app_title'), 'Stellar Vista');
    assert.strictEqual(i18n.t('greeting', { name: 'Photographer' }), 'Hello, Photographer!');
    assert.strictEqual(i18n.t('sun_altitude', { alt: '45.2', time: '14:30' }), 'Sun altitude is 45.2° at 14:30');
    assert.strictEqual(i18n.t('missing_key'), 'missing_key'); // Falls back to key
    console.log("  ✓ Interpolation PASSED!");
}

function testJsonLocalesIntegrity() {
    console.log("[TEST 3] 5 Languages JSON Locale Completeness...");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const locales = ['en', 'zh-TW', 'zh-CN', 'vi', 'ja'];
    const requiredKeys = ['appTitle', 'navArSky', 'navEphemeris', 'nav3dCompass', 'navFieldKit', 'fieldKitTitle'];

    for (const loc of locales) {
        const filePath = path.join(__dirname, '..', 'i18n', `${loc}.json`);
        assert.ok(fs.existsSync(filePath), `Locale file ${loc}.json exists`);
        const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        for (const k of requiredKeys) {
            assert.ok(json[k], `Key '${k}' exists in ${loc}.json`);
        }
    }
    console.log("  ✓ All 5 language JSON files exist and have required keys!");
}

async function testInitAndSetLocale() {
    console.log("[TEST 4] Async Init & SetLocale with Fetch Fallback...");
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Mock fetch to read local i18n json files
    globalThis.fetch = async (url) => {
        const fileName = path.basename(url);
        const filePath = path.join(__dirname, '..', 'i18n', fileName);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return {
                ok: true,
                status: 200,
                json: async () => data
            };
        }
        return {
            ok: false,
            status: 404,
            json: async () => ({})
        };
    };

    const i18n = new I18n();
    await i18n.init('vi-VN');
    assert.strictEqual(i18n.locale, 'vi');
    assert.strictEqual(i18n.t('today'), 'Hôm nay');

    // Switch locale to Japanese
    await i18n.setLocale('ja-JP');
    assert.strictEqual(i18n.locale, 'ja');
    assert.strictEqual(i18n.t('today'), '今日');

    // Fallback to English on unknown/network failure
    await i18n.init('de-DE');
    assert.strictEqual(i18n.locale, 'en');
    assert.strictEqual(i18n.t('today'), 'Today');

    console.log("  ✓ Async Init & SetLocale PASSED!");
}

function testDOMTranslations() {
    console.log("[TEST 5] DOM Translation Injection Attributes...");
    const i18n = new I18n();
    i18n.strings = {
        'btn_submit': 'Gửi dữ liệu',
        'input_hint': 'Nhập tọa độ...',
        'tooltip_info': 'Thông tin chi tiết',
        'aria_close': 'Đóng cửa sổ'
    };

    class MockNode {
        constructor(attrs = {}) {
            this.attrs = attrs;
            this.textContent = '';
            this.title = '';
            this.placeholder = '';
        }
        getAttribute(name) { return this.attrs[name] || null; }
        setAttribute(name, val) { this.attrs[name] = val; }
    }

    const n1 = new MockNode({ 'data-i18n': 'btn_submit' });
    const n2 = new MockNode({ 'data-i18n-title': 'tooltip_info' });
    const n3 = new MockNode({ 'data-i18n-placeholder': 'input_hint' });
    const n4 = new MockNode({ 'data-i18n-aria': 'aria_close' });

    const mockRoot = {
        querySelectorAll: (selector) => {
            if (selector === '[data-i18n]') return [n1];
            if (selector === '[data-i18n-title]') return [n2];
            if (selector === '[data-i18n-placeholder]') return [n3];
            if (selector === '[data-i18n-aria]') return [n4];
            return [];
        }
    };

    i18n.applyTranslations(mockRoot);

    assert.strictEqual(n1.textContent, 'Gửi dữ liệu');
    assert.strictEqual(n2.title, 'Thông tin chi tiết');
    assert.strictEqual(n3.placeholder, 'Nhập tọa độ...');
    assert.strictEqual(n4.getAttribute('aria-label'), 'Đóng cửa sổ');

    // Edge case: null root
    i18n.applyTranslations(null);

    console.log("  ✓ DOM Translation Injection PASSED!");
}

testLocaleResolution();
testTranslationsAndParamInterpolation();
testJsonLocalesIntegrity();
await testInitAndSetLocale();
testDOMTranslations();

console.log("\nAll i18n unit tests completed successfully!\n");
