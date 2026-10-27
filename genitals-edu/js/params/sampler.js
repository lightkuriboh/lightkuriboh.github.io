/**
 * Morphological Parameter Sampling, Arousal Modification & Geometric Profiles
 */
import { clamp, lerp, gauss, easeInOutCubic, mixParams } from '../math/helpers.js';
import { P } from './keyframes.js';

/**
 * Applies autonomic neurovascular vasocongestion & tumescence
 */
export function applyArousal(baseP, isMale, arousal) {
  if (arousal <= 0.001) return baseP;
  const p = JSON.parse(JSON.stringify(baseP));
  const E = clamp(arousal, 0, 1);

  if (isMale) {
    // Penile erection: length, girth, dorsal erection angle, glans engorgement
    p.tubercle.L = lerp(p.tubercle.L, p.tubercle.L * 1.55, E);
    p.tubercle.r0 = lerp(p.tubercle.r0, p.tubercle.r0 * 1.35, E);
    p.tubercle.tilt = lerp(p.tubercle.tilt, 0.65, E); // elevates forward / up (erect angle)
    p.tubercle.bend = lerp(p.tubercle.bend, 0.02, E); // straightens erect shaft
    p.tubercle.corona = lerp(p.tubercle.corona, p.tubercle.corona * 1.30, E);

    // Scrotal elevation & tightening (dartos / cremasteric contraction)
    p.swellings.yStart = lerp(p.swellings.yStart, p.swellings.yStart + 0.18, E);
    p.swellings.yEnd = lerp(p.swellings.yEnd, p.swellings.yEnd + 0.32, E);
    p.swellings.rx0 = lerp(p.swellings.rx0, p.swellings.rx0 * 0.88, E);
    p.swellings.rz0 = lerp(p.swellings.rz0, p.swellings.rz0 * 0.88, E);
    p.swellings.rugae = lerp(p.swellings.rugae, 1.35, E);
  } else {
    // Female vasocongestion: clitoral glans tumescence & elevation
    p.tubercle.L = lerp(p.tubercle.L, p.tubercle.L * 1.38, E);
    p.tubercle.r0 = lerp(p.tubercle.r0, p.tubercle.r0 * 1.38, E);
    p.tubercle.tilt = lerp(p.tubercle.tilt, p.tubercle.tilt + 0.12, E);

    // Labia minora engorge and part laterally, widely exposing the vestibule
    p.folds.dOpen = lerp(p.folds.dOpen, p.folds.dOpen + 0.16, E);
    p.folds.dPeri = lerp(p.folds.dPeri, p.folds.dPeri + 0.20, E);
    p.folds.b = lerp(p.folds.b, p.folds.b * 1.35, E);
    p.folds.ruffle = lerp(p.folds.ruffle, p.folds.ruffle + 0.25, E);

    // Labia majora flatten slightly and spread outward
    p.swellings.xBase = lerp(p.swellings.xBase, p.swellings.xBase + 0.10, E);
    p.swellings.xBulge = lerp(p.swellings.xBulge, p.swellings.xBulge + 0.08, E);

    // Vestibule & introitus deepen and widen
    p.sinus.sx = lerp(p.sinus.sx, p.sinus.sx * 1.55, E);
    p.sinus.depth = lerp(p.sinus.depth, p.sinus.depth * 1.25, E);
  }
  return p;
}

/**
 * Samples and blends morphological parameters at time t
 */
export function sampleParams(t, state) {
  t = clamp(t, 0, 1);
  let baseP, isMale = false;

  if (state.advMode) {
    // 4 Clean intervals: [0, 0.25], [0.25, 0.50], [0.50, 0.75], [0.75, 1.00]
    const stages = [P.S0, P.F_Neo, P.F_Adult, P.M_Neo, P.M_Adult];
    if (t >= 1) {
      baseP = P.M_Adult;
      isMale = true;
    } else {
      const segFloat = t * 4;
      const idx = Math.min(3, Math.floor(segFloat));
      const local = easeInOutCubic(segFloat - idx);
      baseP = mixParams(stages[idx], stages[idx + 1], local);
      isMale = (idx >= 3) || (idx === 2 && local > 0.5);
    }
  } else {
    // 3 Clean intervals: [0, 1/3], [1/3, 2/3], [2/3, 1]
    const segFloat = t * 3;
    const seg = Math.min(2, Math.floor(segFloat));
    const local = easeInOutCubic(segFloat - seg);
    const [A, B] = [[P.S0, P.F_Neo], [P.F_Neo, P.M_Neo], [P.M_Neo, P.S0]][seg];
    baseP = mixParams(A, B, local);
    isMale = baseP.folds.fuse > 0.5;
  }

  // Arousal applies when user engages arousal slider (in adult/differentiation phases)
  const isPrimordial = (t < 0.08);
  const effectiveArousal = isPrimordial ? 0 : state.arousal;
  return applyArousal(baseP, isMale, effectiveArousal);
}

/**
 * Moving orthogonal cross-section frame along the genital tubercle axis
 */
export function getTubFrame(u, p) {
  const yBase = p.yBase || 0;
  const y = yBase + p.L * u * Math.cos(p.tilt) - p.bend * u * u * p.L * 0.5;
  const z = p.L * u * Math.sin(p.tilt) + 0.12 * u;
  const dy = p.L * Math.cos(p.tilt) - p.bend * u * p.L;
  const dz = p.L * Math.sin(p.tilt) + 0.12;
  const len = Math.hypot(dy, dz) || 1;
  const Ty = dy / len, Tz = dz / len;
  const B = [1, 0, 0];
  const N = [0, -Tz, Ty]; // normal in YZ plane pointing ventrally (+Z)
  return { pos: [0, y, z], T: [0, Ty, Tz], B, N };
}

/**
 * Radius profile of the genital tubercle at parametric position u and polar angle v
 */
export function tubRadius(u, p, v) {
  let r = p.r0 * (1 - p.taper * u);
  const cosV = Math.cos(v);
  const sinV = Math.sin(v);

  // Dorsal corpora cavernosa twin-ridge on penile shaft (male)
  if (p.shaftFlat > 0 && u < p.glansU - 0.10) {
    const shaftMask = Math.pow(Math.sin(Math.PI * clamp(u / (p.glansU - 0.10), 0, 1)), 0.5);
    const dorsalTwin = 0.09 * p.shaftFlat * Math.cos(2 * v) * Math.max(0, -sinV);
    const ventralNarrow = -0.05 * p.shaftFlat * Math.max(0, sinV);
    r *= (1 + shaftMask * (dorsalTwin + ventralNarrow));
  }

  // Glans enlargement
  const glansVentralBias = (p.hood > 0) ? (1 + 0.18 * sinV) : 1.0;
  r += p.r0 * p.glans * gauss(u, p.glansU, p.glansW) * glansVentralBias;

  // Corona glandis (male)
  if (p.corona > 0) {
    const coronaFlare = p.r0 * p.corona * gauss(u, p.glansU - 0.08, 0.038);
    const coronaProfile = 1.0 - 0.65 * Math.max(0, sinV);
    r += coronaFlare * coronaProfile;
  }

  // Coronal sulcus (neck groove)
  if (p.sulcus > 0) {
    const sulcusDip = p.r0 * p.sulcus * gauss(u, p.glansU - 0.15, 0.042);
    const sulcusProfile = 1.0 - 0.35 * Math.max(0, sinV);
    r -= sulcusDip * sulcusProfile;
  }

  // Enhanced Preputial Hood (female clitoral prepuce)
  if (p.hood > 0) {
    const hoodDorsalCowl = Math.max(0, -sinV + 0.40) * (1 + 0.22 * Math.cos(2 * v));
    const hoodFlare = p.hood * 1.25 * p.r0 * gauss(u, 0.68, 0.18) * hoodDorsalCowl;
    r += hoodFlare;
  }

  // Proximal root closure
  if (u < 0.14) r *= Math.sqrt(Math.max(0, 1 - ((0.14 - u) / 0.14) ** 2));
  // Distal cap dome
  const uc = 0.88;
  if (u > uc) r *= Math.sqrt(Math.max(0, 1 - ((u - uc) / (1 - uc)) ** 2));
  return Math.max(r, 1e-4);
}
