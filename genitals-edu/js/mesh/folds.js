/**
 * Urogenital / Urethral Folds Mesh Generator & Morphing Algorithm
 * (Forms labia minora in females; ventral raphe and spongy urethra in males)
 */
import { clamp, lerp } from '../math/helpers.js';
import { getTubFrame, tubRadius } from '../params/sampler.js';

const THREE = window.THREE;

export const nU_F = 60;
export const nV_F = 28;

export function initFoldsMesh(scene, makeGridGeometry, makeOutline, MAT, pickables) {
  const geoFoldL = makeGridGeometry(nU_F, nV_F);
  const geoFoldR = makeGridGeometry(nU_F, nV_F);
  const geoRaphe = makeGridGeometry(nU_F, 16);

  const UrogenitalFoldsMesh = new THREE.Group();
  UrogenitalFoldsMesh.name = 'UrogenitalFoldsMesh';

  const foldL = new THREE.Mesh(geoFoldL, MAT.clay.urogenitalFolds);
  const foldR = new THREE.Mesh(geoFoldR, MAT.clay.urogenitalFolds);
  const rapheMesh = new THREE.Mesh(geoRaphe, MAT.clay.urogenitalFolds);
  rapheMesh.name = 'VentralRapheMesh';

  [foldL, foldR, rapheMesh].forEach(m => {
    m.userData.tissue = 'urogenitalFolds';
    UrogenitalFoldsMesh.add(m);
    pickables.push(m);
  });
  scene.add(UrogenitalFoldsMesh);

  makeOutline(geoFoldL, 'urogenitalFolds', 0.016, UrogenitalFoldsMesh);
  makeOutline(geoFoldR, 'urogenitalFolds', 0.016, UrogenitalFoldsMesh);

  return { geoFoldL, geoFoldR, geoRaphe, foldL, foldR, rapheMesh, UrogenitalFoldsMesh };
}

export function foldPoint(s, side, f, tp, lift) {
  const fuseLocal = clamp(f.fuse * 1.5 - 0.5 * s, 0, 1);
  const pf = f.phalicFrac;
  if (s <= pf) {
    const u = 0.92 * (1 - s / pf);
    const frm = getTubFrame(u, tp);
    const rV = tubRadius(u, tp, Math.PI / 2);
    const dx = Math.min(lerp(f.dOpen, 0.006, fuseLocal) * (0.3 + 0.7 * (s / pf)), rV * 0.88);
    const x = side * dx;
    const y = frm.pos[1] + (rV + lift) * frm.N[1];
    const z = frm.pos[2] + (rV + lift) * frm.N[2];
    return [x, y, z];
  }
  const q = (s - pf) / (1 - pf);
  const frm0 = getTubFrame(0, tp);
  const arch = Math.sin(Math.PI * Math.pow(q, 0.85));
  const dBase = lerp(0.06, f.dPeri, arch);
  const dx = lerp(dBase, 0.006, fuseLocal);
  const y = frm0.pos[1] - q * f.periLen;
  const z = lerp(0.12, 0.04, q) + 0.06 * Math.sin(Math.PI * q) + lift;
  return [side * dx, y, z];
}

export function writeTube(geo, side, f, tp, a0, b0, lift) {
  const pos = geo.attributes.position;
  const { nU, nV } = geo.userData;
  let k = 0;
  const eps = 0.012;

  for (let i = 0; i <= nU; i++) {
    const s = i / nU;
    const c = foldPoint(s, side, f, tp, lift);
    const s2 = s + eps > 1 ? s - eps : s + eps;
    const c2 = foldPoint(s2, side, f, tp, lift);

    let T = [c2[0] - c[0], c2[1] - c[1], c2[2] - c[2]];
    if (s2 < s) T = T.map(x => -x);
    const tl = Math.hypot(...T) || 1;
    T = T.map(x => x / tl);

    let Bn = [T[1], -T[0], 0];
    const bl = Math.hypot(...Bn) || 1;
    Bn = Bn.map(x => x / bl);

    const N = [
      Bn[1] * T[2] - Bn[2] * T[1],
      Bn[2] * T[0] - Bn[0] * T[2],
      Bn[0] * T[1] - Bn[1] * T[0]
    ];

    const taper = Math.pow(Math.sin(Math.PI * s), 0.35);
    const a = a0 * taper;
    const b = b0 * taper;

    for (let j = 0; j <= nV; j++) {
      const ph = (j / nV) * Math.PI * 2;
      const cph = Math.cos(ph), sph = Math.sin(ph);
      // Delicate mucosal flange taper in female
      const flangeW = 1 - 0.45 * f.flange * sph * sph;
      const ruff = sph > 0 ? f.ruffle * 0.016 * Math.sin(18 * s) * sph : 0;
      const ca = a * cph * flangeW + ruff;
      const sb = b * sph;
      pos.setXYZ(
        k++,
        c[0] + Bn[0] * ca + N[0] * sb,
        c[1] + Bn[1] * ca + N[1] * sb,
        c[2] + Bn[2] * ca + N[2] * sb
      );
    }
  }
}
