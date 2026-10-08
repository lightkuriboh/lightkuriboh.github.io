/**
 * Lightweight Internationalization (i18n) Module for Film Magic PWA
 */

const FALLBACK_STRINGS = {
  en: {
    appTitle: "FILM MAGIC",
    appSubtitle: "WebAssembly C++ Engine",
    sample: "Sample",
    open: "Open",
    tune: "Tune",
    install: "Install",
    saveToDevice: "Save to Device",
    loadSamplePhoto: "Load sample test photo",
    importCustomPhoto: "Import custom photo",
    fineTuneParameters: "Fine-tune parameters",
    installApp: "Install Film Magic App",
    saveImageTitle: "Save image to local device",
    toggleFavorite: "Toggle Favorite",
    allPresets: "All Presets ({count})",
    historicFilms: "Historic Films ({count})",
    creativeEffects: "Creative Effects ({count})",
    favorites: "Favorites ({count})",
    wasmReady: "WASM Ready",
    jsEngine: "JS Engine",
    filterStrength: "Filter Strength",
    filmGrain: "Film Grain",
    vignette: "Vignette",
    exposureEV: "Exposure (EV)",
    warmthTemp: "Warmth (Temp)",
    reset: "Reset",
    dragDropText: "Drag & drop your own photo here, or use buttons above",
    savedToDevice: "Saved to device: {fileName}",
    removedFromFavorites: "Removed \"{name}\" from Favorites",
    addedToFavorites: "Added \"{name}\" to Favorites",
    noFavoritesYet: "No favorite films yet. Click the star icon on any film card to bookmark it."
  }
};

class I18n {
  constructor(initialLocale = null, dictionaries = {}) {
    this.supported = ['en', 'zh-Hans', 'zh-Hant', 'vi', 'ja'];
    this.dictionaries = { ...FALLBACK_STRINGS, ...dictionaries };
    this.locale = initialLocale || this.detectLocale();
  }

  detectLocale(urlSearch, storageVal, browserLang) {
    let urlParam = null;
    if (urlSearch !== undefined) {
      const match = urlSearch.match(/[?&]lang=([^&#]*)/);
      if (match) urlParam = decodeURIComponent(match[1]);
    } else if (typeof location !== 'undefined') {
      urlParam = new URLSearchParams(location.search).get('lang');
    }

    let stored = storageVal;
    if (stored === undefined && typeof localStorage !== 'undefined') {
      try {
        stored = localStorage.getItem('film_magic_locale');
      } catch (_) {}
    }

    let navLang = browserLang;
    if (navLang === undefined && typeof navigator !== 'undefined') {
      navLang = navigator.language || (navigator.languages && navigator.languages[0]);
    }

    const candidate = urlParam || stored || navLang || 'en';
    const lower = candidate.toLowerCase();

    if (lower.startsWith('zh-hant') || lower === 'zh-tw' || lower === 'zh-hk') {
      return 'zh-Hant';
    }
    if (lower.startsWith('zh')) {
      return 'zh-Hans';
    }
    if (lower.startsWith('ja')) {
      return 'ja';
    }
    if (lower.startsWith('vi')) {
      return 'vi';
    }
    if (lower.startsWith('en')) {
      return 'en';
    }
    return 'en';
  }

  setDictionary(locale, dict) {
    this.dictionaries[locale] = { ...(this.dictionaries[locale] || {}), ...dict };
  }

  async loadLocale(locale) {
    if (this.dictionaries[locale] && Object.keys(this.dictionaries[locale]).length > 1) {
      return;
    }
    if (typeof fetch !== 'undefined') {
      try {
        const res = await fetch(`i18n/${locale}.json`);
        if (res.ok) {
          const data = await res.json();
          this.setDictionary(locale, data);
        }
      } catch (err) {
        console.warn(`Failed to fetch translations for ${locale}:`, err);
      }
    }
  }

  async setLocale(locale) {
    if (!this.supported.includes(locale)) {
      locale = 'en';
    }
    this.locale = locale;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('film_magic_locale', locale);
      } catch (_) {}
    }

    await this.loadLocale(locale);
    this.applyToDOM();

    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      const event = new CustomEvent('localechange', { detail: { locale } });
      document.dispatchEvent(event);
    }
  }

  t(key, params = {}) {
    const activeDict = this.dictionaries[this.locale] || {};
    const fallbackDict = this.dictionaries['en'] || {};
    let str = activeDict[key] !== undefined ? activeDict[key] : (fallbackDict[key] !== undefined ? fallbackDict[key] : key);

    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return str;
  }

  applyToDOM() {
    if (typeof document === 'undefined') return;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      el.textContent = this.t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.dataset.i18nTitle;
      el.title = this.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholder;
      el.placeholder = this.t(key);
    });
  }
}

if (typeof window !== 'undefined') {
  window.I18n = I18n;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18n, FALLBACK_STRINGS };
}
