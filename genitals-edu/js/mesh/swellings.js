/**
 * Labioscrotal / Genital Swellings Mesh Generator & Morphing Algorithm
 * (Forms labia majora in females; scrotal sac & raphe in males)
 */
import { lerp, clamp, smoothstep } from '../math/helpers.js';
import { Z_ROOT } from './bodyField.js';

const THREE = window.THREE;

export const nU_S = 60;
export const nV_S = 36;

// Scrotal lobe egg silhouette: a = -1 (root) ... +1 (fundus); fuller above, widest below middle
const EGG_K = 0.18;
const MEDIAL_K = 0.72; // lobe centre offset / radius -> lobes press together at midline, shallow raphe groove
function eggRaw(a) {
  const pw = a < 0 ? 0.38 : 0.50;
  return Math.pow(Math.max(0, 1 - a * a), pw) * (1 + EGG_K * a);
}
const EGG_MAX = (() => { let m = 0; for (let i = 0; i <= 400; i++) m = Math.max(m, eggRaw(-1 + i / 200)); return m; })();

export function initSwellingsMesh(scene, makeGridGeometry, makeOutline, MAT, pickables) {
  const geoSwellingL = makeGridGeometry(nU_S, nV_S);
  const geoSwellingR = makeGridGeometry(nU_S, nV_S);
  const geoScrotalRaphe = makeGridGeometry(44, 12);

  const LabioscrotalSwellingsMesh = new THREE.Group();
  LabioscrotalSwellingsMesh.name = 'LabioscrotalSwellingsMesh';

  const swL = new THREE.Mesh(geoSwellingL, MAT.clay.labioscrotalSwellings);
  const swR = new THREE.Mesh(geoSwellingR, MAT.clay.labioscrotalSwellings);
  const scrotalRaphe = new THREE.Mesh(geoScrotalRaphe, MAT.clay.labioscrotalSwellings);
  scrotalRaphe.name = 'ScrotalRapheMesh';

  [swL, swR, scrotalRaphe].forEach(m => {
    m.userData.tissue = 'labioscrotalSwellings';
    LabioscrotalSwellingsMesh.add(m);
    pickables.push(m);
  });
  scene.add(LabioscrotalSwellingsMesh);

  makeOutline(geoSwellingL, 'labioscrotalSwellings', 0.024, LabioscrotalSwellingsMesh);
  makeOutline(geoSwellingR, 'labioscrotalSwellings', 0.024, LabioscrotalSwellingsMesh);

  return { geoSwellingL, geoSwellingR, geoScrotalRaphe, swL, swR, scrotalRaphe, LabioscrotalSwellingsMesh };
}

/**
 * Computes 3D coordinates for the female labia majora / primordial swellings (fuse = 0)
 * - Asymmetric cushion: gentle lateral slope into the thigh, steep medial wall
 * - Back half is rooted down to Z_ROOT so the cushion grows out of the body (no floating gap)
 */
function getFemaleLabiaPoint(s, th, side, p) {
  const phi = Math.PI * s;
  const fCurv = (1 - Math.cos(phi)) * 0.5;
  const y = lerp(p.yStart, p.yEnd, fCurv);

  const phiShape = Math.PI * Math.pow(s, 0.82);
  const q = Math.max(0, Math.sin(phiShape));
  const commFalloff = 1 - q;
  const xComm = lerp(p.xBase, 0.018, commFalloff * (s < 0.5 ? p.antComm : p.postComm));
  const xArchF = (xComm + p.xBulge * Math.pow(q, p.archPow)) * Math.pow(q, p.endPull);
  const zArchF = lerp(p.zBase, p.zBase + p.zBulge, q);
  const tq = Math.pow(q, p.taperPow);
  const rxF = (p.rx0 + p.rxBulge * q) * tq;
  const rzF = (p.rz0 + p.rzBulge * q) * tq;

  const cth = Math.cos(th), sth = Math.sin(th);
  const lateral = cth >= 0;
  const below = Math.max(0, -sth);
  const spread = 1 + (lateral ? 0.8 : 0.2) * below;          // base widens laterally -> sloping flank
  const rxSide = rxF * (lateral ? p.latK : p.medK) * spread;
  const dx = Math.max(0.003, xArchF + cth * rxSide);
  const z = sth >= 0
    ? zArchF + sth * rzF
    : zArchF + sth * (zArchF - Z_ROOT);                        // rooted back side
  return { x: side * dx, y, z };
}

/** Shared longitudinal frame of a scrotal lobe (used by the lobe surface and the raphe). */
function scrotumFrame(s, p) {
  const fCurv = (1 - Math.cos(Math.PI * s)) * 0.5;
  const a = 2 * fCurv - 1;                                    // -1 root ... +1 fundus
  const prof = eggRaw(a) / EGG_MAX;                           // 0..1 egg silhouette
  const Rmax = p.rx0 + p.rxBulge;
  const Rzmax = p.rz0 + p.rzBulge;
  const R_x = Rmax * prof;
  const R_z = Rzmax * prof * lerp(0.85, 1.18, smoothstep(-1, 0.2, a)); // lower lobe bulges toward viewer
  const X_c = Math.max(R_x * MEDIAL_K, Rmax * 0.30 * smoothstep(0.55, 1.0, a)); // fundus notch between lobes
  const Z_c = p.zBase + p.zBulge * 0.6 * smoothstep(-1, 0.2, a);
  const rootK = 1 - smoothstep(0.15, 0.85, a);                // upper sac rests on perineum; fundus hangs free
  return { y: lerp(p.yStart, p.yEnd, fCurv), a, R_x, R_z, X_c, Z_c, rootK, Rmax };
}

/**
 * Computes 3D coordinates for the male scrotum (fuse = 1)
 * Reflects anatomical realism:
 * - Hanging pendulous pouch wrapping around the penis root
 * - Large testicular volume (twice original size)
 * - Two rounded egg-shaped lobes side-by-side
 * - Symmetric hang
 * - Fine organic dartos skin rugae
 * - Watertight closure at root and bottom domes
 */
function getMaleScrotumPoint(s, th, side, p) {
  const F = scrotumFrame(s, p);
  const cth = Math.cos(th), sth = Math.sin(th);
  const dx = Math.max(0.003, F.X_c + cth * F.R_x);
  let z;
  if (sth >= 0) {
    // Natural dartos skin wrinkling (front only)
    const rugaeMask = Math.pow(Math.sin(Math.PI * clamp(s, 0.04, 0.96)), 0.6);
    const rugae = (p.rugae > 0)
      ? 0.015 * p.rugae * rugaeMask * (
          0.55 * Math.sin(19 * F.y + 2.2 * cth + 0.6 * sth) +
          0.35 * Math.sin(34 * F.y - 2.6 * sth + 1.1 * cth) +
          0.20 * Math.cos(48 * F.y + 3.0 * cth * sth)
        )
      : 0;
    // Super-elliptic front (exponent < 1 rounds the "shield" shoulders into egg-like lobes)
    z = F.Z_c + Math.sign(sth) * Math.pow(Math.abs(sth), 0.80) * (F.R_z + rugae);
    // Median raphe sulcus (shallow groove where the lobes meet)
    const dMid = dx / (F.Rmax * 0.35);
    z -= 0.035 * p.bilobe * Math.exp(-dMid * dMid) * smoothstep(0, 0.3, sth);
  } else {
    const zBack = lerp(F.Z_c - F.R_z, Z_ROOT, F.rootK);
    z = F.Z_c + (-sth) * (zBack - F.Z_c);
  }
  return { x: side * dx, y: F.y, z };
}

export function writeSwelling(geo, side, p) {
  const pos = geo.attributes.position;
  const { nU, nV } = geo.userData;
  let k = 0;

  const f = smoothstep(0, 1, p.fuse);

  for (let i = 0; i <= nU; i++) {
    const s = i / nU;
    for (let j = 0; j <= nV; j++) {
      const th = -side * (j / nV) * Math.PI * 2;

      const pF = getFemaleLabiaPoint(s, th, side, p);
      const pM = getMaleScrotumPoint(s, th, side, p);

      const x = lerp(pF.x, pM.x, f);
      const y = lerp(pF.y, pM.y, f);
      const z = lerp(pF.z, pM.z, f);

      pos.setXYZ(k++, x, y, z);
    }
  }
}

export function writeScrotalRaphe(geo, p) {
  const pos = geo.attributes.position;
  const { nU, nV } = geo.userData;
  const sthMid = Math.sqrt(1 - MEDIAL_K * MEDIAL_K); // front point where a lobe meets the midline
  let k = 0;
  for (let i = 0; i <= nU; i++) {
    const s = i / nU;
    const F = scrotumFrame(s, p);
    const zSurface = F.Z_c + sthMid * F.R_z - 0.035 * p.bilobe * smoothstep(0, 0.3, sthMid) + 0.006;
    const fade = 1 - smoothstep(0.55, 0.90, F.a); // lobes separate at the fundus notch
    const rRaphe = 0.014 * p.fuse * Math.sin(Math.PI * clamp(s, 0.04, 0.95)) * fade;
    for (let j = 0; j <= nV; j++) {
      const ph = (j / nV) * Math.PI * 2;
      pos.setXYZ(k++, rRaphe * Math.cos(ph), F.y, zSurface + rRaphe * Math.max(0, Math.sin(ph)) * 1.3);
    }
  }
}
