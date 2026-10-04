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
        'app_title': 'LandscapeHelper',
        'greeting': 'Hello, {name}!',
        'sun_altitude': 'Sun altitude is {alt}° at {time}'
    };

    assert.strictEqual(i18n.t('app_title'), 'LandscapeHelper');
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

testLocaleResolution();
testTranslationsAndParamInterpolation();
testJsonLocalesIntegrity();

console.log("\nAll i18n unit tests completed successfully!\n");
