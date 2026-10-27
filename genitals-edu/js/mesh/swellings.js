/**
 * Labioscrotal / Genital Swellings Mesh Generator & Morphing Algorithm
 * (Forms labia majora in females; scrotal sac & raphe in males)
 */
import { lerp } from '../math/helpers.js';

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

export function writeSwelling(geo, side, p) {
  const pos = geo.attributes.position;
  const { nU, nV } = geo.userData;
  let k = 0;

  for (let i = 0; i <= nU; i++) {
    const s = i / nU;
    const phi = Math.PI * s;
    const fCurv = (1 - Math.cos(phi)) * 0.5;
    const y = lerp(p.yStart, p.yEnd, fCurv);
    const q = Math.sin(phi);

    // Convergence at anterior commissure (s=0) and posterior commissure (s=1)
    const commFalloff = 1 - q;
    const xComm = lerp(p.xBase, 0.018, commFalloff * (s < 0.5 ? p.antComm : p.postComm));
    const xArch = (xComm + p.xBulge * Math.pow(q, p.archPow)) * Math.pow(q, 0.22);
    const zArch = lerp(p.zBase, p.zBase + p.zBulge, q);
    const tq = Math.pow(q, p.taperPow);
    const rx = (p.rx0 + p.rxBulge * q) * tq;
    const rz = (p.rz0 + p.rzBulge * q) * tq;

    // Transverse dartos rugae for male scrotum
    const rugae = p.rugae > 0 ? 0.045 * p.rugae * Math.sin(34 * y) * (0.45 + 0.55 * Math.sin(phi)) * q : 0;

    for (let j = 0; j <= nV; j++) {
      const th = -side * (j / nV) * Math.PI * 2;
      const cth = Math.cos(th), sth = Math.sin(th);
      let dx;
      if (cth >= 0) {
        dx = xArch + cth * rx;
      } else {
        const medR = lerp(rx, xArch, p.fuse);
        dx = Math.max(0.003, xArch + cth * medR);
        // Bilobate median sulcus indentation
        if (p.bilobe > 0 && p.fuse > 0.1) {
          const furrow = 0.065 * p.bilobe * Math.exp(-Math.pow(dx / 0.065, 2));
          dx += furrow * 0.5;
        }
      }
      let z = zArch + sth * (rz + rugae);
      if (p.fuse > 0 && sth >= -1e-4 && cth <= 0) {
        const midBlend = -cth;
        const domeZ = zArch + (rz + rugae) * (sth + midBlend * (1 - sth) * 0.88);
        z = lerp(z, domeZ, p.fuse);
        // Distinct bilobate scrotal cleft along the median raphe
        if (p.bilobe > 0) {
          z -= 0.075 * p.bilobe * Math.exp(-Math.pow(dx / 0.055, 2)) * p.fuse;
        }
      }
      pos.setXYZ(k++, side * dx, y, z);
    }
  }
}

export function writeScrotalRaphe(geo, p) {
  const pos = geo.attributes.position;
  const { nU, nV } = geo.userData;
  let k = 0;

  for (let i = 0; i <= nU; i++) {
    const s = i / nU;
    const y = lerp(p.yStart, p.yEnd, s);
    const q = Math.sin(Math.PI * s);
    const zSurface = lerp(p.zBase, p.zBase + p.zBulge, q) + (p.rz0 + p.rzBulge * q) * 0.88 * p.fuse;
    const rRaphe = 0.016 * p.fuse * Math.pow(q, 0.35);

    for (let j = 0; j <= nV; j++) {
      const ph = (j / nV) * Math.PI * 2;
      const x = rRaphe * Math.cos(ph);
      const z = zSurface + rRaphe * Math.max(0, Math.sin(ph)) * 1.3 + 0.002;
      pos.setXYZ(k++, x, y, z);
    }
  }
}
