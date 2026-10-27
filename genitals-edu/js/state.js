/**
 * Application State & Dynamic Terminology Provider
 */
import { TISSUE_COLORS, KEYS } from './config.js';
import { getI18n, getInitialLanguage } from './i18n/index.js';

export const state = {
  lang: getInitialLanguage(),
  t: 0,
  playing: true,
  loop: true,
  style: 'clay',
  highlight: null,
  pinned: null,
  duration: 20,
  dwell: 1.2,
  tweening: false,
  scrubbing: false,
  labels: false,
  derived: null,
  advMode: false,
  arousal: 0,
  arousalPulse: false
};

export const curI18n = () => getI18n(state.lang);

export const TERMS = {
  get s0() { return curI18n().stageMeta.s0Title; },
  get femaleNeo() { return curI18n().stageMeta.femaleNeoTitle; },
  get femaleAdult() { return curI18n().stageMeta.femaleAdultTitle; },
  get maleNeo() { return curI18n().stageMeta.maleNeoTitle; },
  get maleAdult() { return curI18n().stageMeta.maleAdultTitle; },
  tissues: {}
};

KEYS.forEach(k => {
  TERMS.tissues[k] = {
    get color() { return TISSUE_COLORS[k].color; },
    get atlas() { return TISSUE_COLORS[k].atlas; },
    get name() { return curI18n().tissues[k].name; },
    get s0() { return curI18n().tissues[k].s0; },
    get femaleNeo() { return curI18n().tissues[k].femaleNeo; },
    get femaleAdult() { return curI18n().tissues[k].femaleAdult; },
    get maleNeo() { return curI18n().tissues[k].maleNeo; },
    get maleAdult() { return curI18n().tissues[k].maleAdult; },
    get desc() { return curI18n().tissues[k].desc; }
  };
});
