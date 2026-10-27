/**
 * I18n Manager & Language Provider
 */
import { en } from './en.js';
import { vi } from './vi.js';

export const I18N = { en, vi };

export const SUPPORTED_LANGUAGES = ['en', 'vi'];
export const DEFAULT_LANGUAGE = 'en';

/**
 * Returns current translation object for given language code (fallback to English)
 */
export function getI18n(lang) {
  return I18N[lang] || I18N[DEFAULT_LANGUAGE];
}

/**
 * Resolves initial language from URL search params (?lang=) or localStorage
 */
export function getInitialLanguage() {
  const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
  if (urlParams && urlParams.has('lang')) {
    const pLang = urlParams.get('lang').toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(pLang)) return pLang;
  }
  try {
    const saved = localStorage.getItem('genitals_edu_lang');
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch (e) {}
  return DEFAULT_LANGUAGE;
}

/**
 * Saves selected language into localStorage
 */
export function persistLanguage(lang) {
  try {
    localStorage.setItem('genitals_edu_lang', lang);
  } catch (e) {}
}
