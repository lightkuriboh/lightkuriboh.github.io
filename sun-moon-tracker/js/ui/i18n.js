/**
 * Lightweight Internationalization (i18n) module for Web PWA.
 * Supports 5 languages: en, zh-TW, zh-CN, vi, ja.
 */
export class I18n {
    constructor() {
        this.strings = {};
        this.locale = 'en';
        this.initialized = false;
    }

    async init(locale) {
        let requested = locale;
        if (!requested && typeof navigator !== 'undefined') {
            requested = navigator.language || 'en';
        }
        this.locale = this.resolveLocale(requested);

        try {
            const resp = await fetch(`./i18n/${this.locale}.json`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            this.strings = await resp.json();
            this.initialized = true;
        } catch (e) {
            console.warn(`I18n: Failed to load ${this.locale}.json, falling back to English:`, e);
            try {
                const fallbackResp = await fetch('./i18n/en.json');
                this.strings = await fallbackResp.json();
            } catch (err) {
                this.strings = {};
            }
            this.locale = 'en';
            this.initialized = true;
        }
    }

    resolveLocale(localeStr) {
        if (!localeStr) return 'en';
        const lower = localeStr.toLowerCase();
        if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk')) return 'zh-TW';
        if (lower.startsWith('zh')) return 'zh-CN';
        if (lower.startsWith('vi')) return 'vi';
        if (lower.startsWith('ja')) return 'ja';
        return 'en';
    }

    t(key, params = {}) {
        let s = this.strings[key] || key;
        for (const [k, v] of Object.entries(params)) {
            s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
        return s;
    }

    async setLocale(locale) {
        await this.init(locale);
        this.applyTranslations();
    }

    applyTranslations(root = document) {
        if (!root || !root.querySelectorAll) return;
        const elements = root.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                el.textContent = this.t(key);
            }
        });
    }
}

export const i18n = new I18n();
