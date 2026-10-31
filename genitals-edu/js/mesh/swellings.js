/**
 * Labioscrotal / Genital Swellings Mesh Generator & Morphing Algorithm
 * (Forms labia majora in females; scrotal sac & raphe in males)
 */
import { lerp, clamp, smoothstep } from '../math/helpers.js';

const THREE = window.THREE;

export const nU_S = 60;
export const nV_S = 36;

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
 * Computes 3D coordinates for the female labia majora (fuse = 0)
 */
function getFemaleLabiaPoint(s, th, side, p) {
  const phi = Math.PI * s;
  const fCurv = (1 - Math.cos(phi)) * 0.5;
  const y = lerp(p.yStart, p.yEnd, fCurv);

  const phiShape = Math.PI * Math.pow(s, 0.82);
  const q = Math.max(0, Math.sin(phiShape));
  const commFalloff = 1 - q;
  const xComm = lerp(p.xBase, 0.018, commFalloff * (s < 0.5 ? p.antComm : p.postComm));
  const xArchF = (xComm + p.xBulge * Math.pow(q, p.archPow)) * Math.pow(q, 0.22);
  const zArchF = lerp(p.zBase, p.zBase + p.zBulge, q);
  const tq = Math.pow(q, p.taperPow);
  const rxF = (p.rx0 + p.rxBulge * q) * tq;
  const rzF = (p.rz0 + p.rzBulge * q) * tq;
  const rzLow = rzF * 0.85;

  const cth = Math.cos(th), sth = Math.sin(th);
  const dx = Math.max(0.003, xArchF + cth * rxF);
  const z = zArchF + sth * (sth < 0 ? rzLow : rzF);

  return { x: side * dx, y, z };
}

/**
 * Computes 3D coordinates for the male scrotum (fuse = 1)
 * Reflects anatomical realism:
 * - Hanging pendulous pouch wrapping around the penis root
 * - Large testicular volume (twice original size)
 * - Two rounded testicular bulbs side-by-side
 * - Smooth hemispherical rounded bottom domes meeting gently at midline
 * - Left testicular descent asymmetry (hangs ~0.12 lower)
 * - Fine organic dartos skin rugae
 * - Watertight closure at root and bottom domes
 */
function getMaleScrotumPoint(s, th, side, p) {
  const phi = Math.PI * s;
  const fCurv = (1 - Math.cos(phi)) * 0.5;
  let y = lerp(p.yStart, p.yEnd, fCurv);

  const cth = Math.cos(th);
  const sth = Math.sin(th);

  const Rmax = p.rx0 + p.rxBulge;
  const Rzmax = p.rz0 + p.rzBulge;

  // Watertight top closure against body wall / penis root (s: 0 -> 0.14)
  const topDome = Math.sqrt(Math.max(0, 1.0 - Math.pow(1.0 - clamp(s / 0.14, 0, 1), 2)));

  // Neck expansion into body (s: 0 -> 0.32)
  const neckFactor = smoothstep(0.0, 0.32, s);
  const R_neck = Rmax * 0.52;
  const Rz_neck = Rzmax * 0.55;

  // Body bulbous contour (s: 0.32 -> 0.78)
  // Testis bulges out into a full rounded ovoid, widest in lower half
  const bodyBulge = 1.0 + 0.14 * Math.sin(Math.PI * clamp((s - 0.20) / 0.60, 0, 1));
  const R_body_x = lerp(R_neck, Rmax * bodyBulge, neckFactor);
  const R_body_z = lerp(Rz_neck, Rzmax * bodyBulge, neckFactor);

  let R_x = R_body_x * topDome;
  let R_z = R_body_z * topDome;

  // Smooth hemispherical rounded bottom dome (s: 0.78 -> 1.0)
  // Each testicle has a smooth rounded bottom bulb
  let u_dome = 0;
  let domeFactor = 1.0;
  if (s > 0.78) {
    u_dome = (s - 0.78) / 0.22;
    domeFactor = Math.sqrt(Math.max(0, 1.0 - u_dome * u_dome));
    R_x *= domeFactor;
    R_z *= domeFactor;
    // Bottom curves under smoothly in Y to form a true rounded dome
    y -= (1.0 - Math.cos(u_dome * Math.PI * 0.5)) * (Rmax * 0.40);
  }

  // Center position X_c:
  // At the body, X_c = R_x * 0.94 so the medial wall (cth = -1) kisses the midline.
  // At the bottom dome, X_c approaches the testicular pole center (0.42 * Rmax).
  const X_pole = Rmax * 0.42;
  const X_c = lerp(R_body_x * 0.94, X_pole, u_dome * u_dome) * topDome;

  // Compute dx:
  let dx = X_c + cth * R_x;
  dx = Math.max(0.003, dx);

  // Center position Z_c & Penoscrotal root wrapping:
  // At s < 0.20, scrotal skin wraps around the base/underside of the penis root
  const zBase = p.zBase;
  const penoscrotalWrap = (1 - neckFactor) * 0.16 * Math.max(0, sth);
  const Z_c = zBase + p.zBulge * 0.55 * neckFactor + penoscrotalWrap;

  // Contour the top collar at s < 0.14 to meet the penis root:
  if (s < 0.14) {
    const rootT = 1 - s / 0.14;
    if (sth > 0) {
      y += 0.14 * rootT * sth;
    }
  }

  // Natural dartos skin wrinkling:
  const rugaeMask = Math.pow(Math.sin(Math.PI * clamp(s, 0.04, 0.96)), 0.6);
  const rugae = (p.rugae > 0)
    ? 0.015 * p.rugae * rugaeMask * (
        0.55 * Math.sin(19 * y + 2.2 * cth + 0.6 * sth) +
        0.35 * Math.sin(34 * y - 2.6 * sth + 1.1 * cth) +
        0.20 * Math.cos(48 * y + 3.0 * cth * sth)
      )
    : 0;

  let z = Z_c + sth * (R_z + rugae);

  // Median groove (scrotal raphe sulcus between the two testicular lobes):
  if (p.bilobe > 0 && sth > -0.2) {
    const dMid = dx / (Rmax * 0.55);
    const groove = 0.040 * p.bilobe * Math.exp(- dMid * dMid) * neckFactor * domeFactor;
    z -= groove;
  }

  return { x: side * dx, y, z };
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
  let k = 0;

  const Rzmax = p.rz0 + p.rzBulge;

  for (let i = 0; i <= nU; i++) {
    const s = i / nU;
    const phi = Math.PI * s;
    const fCurv = (1 - Math.cos(phi)) * 0.5;
    const y = lerp(p.yStart, p.yEnd, fCurv);

    const neckFactor = smoothstep(0.0, 0.32, s);
    const bodyBulge = 1.0 + 0.14 * Math.sin(Math.PI * clamp((s - 0.20) / 0.60, 0, 1));
    let u_dome = 0;
    let domeFactor = 1.0;
    if (s > 0.78) {
      u_dome = (s - 0.78) / 0.22;
      domeFactor = Math.sqrt(Math.max(0, 1.0 - u_dome * u_dome));
    }
    const R_z = lerp(Rzmax * 0.55, Rzmax * bodyBulge, neckFactor) * domeFactor;
    const Z_c = p.zBase + p.zBulge * 0.55 * neckFactor;

    const zSurface = Z_c + R_z * 0.95 - 0.038 * p.bilobe * neckFactor * domeFactor;
    const rRaphe = 0.016 * p.fuse * Math.sin(Math.PI * clamp(s, 0.04, 0.95));

    for (let j = 0; j <= nV; j++) {
      const ph = (j / nV) * Math.PI * 2;
      const x = rRaphe * Math.cos(ph);
      const z = zSurface + rRaphe * Math.max(0, Math.sin(ph)) * 1.3 + 0.002;
      pos.setXYZ(k++, x, y, z);
    }
  }
}
