/**
 * Clitoral Hood (Prepuce) Mesh Generator & Morphing Algorithm
 * A dorsal/lateral cowl shell over the clitoral body & glans (tissue: genital tubercle).
 * Collapses to a point when tubercle.hood ~ 0 (Week 7 & male stages).
 */
import { lerp, smoothstep } from '../math/helpers.js';
import { getTubFrame, tubRadius } from '../params/sampler.js';

const THREE = window.THREE;

export const nU_H = 36;
export const nV_H = 32;

export function initHoodMesh(scene, makeGridGeometry, makeOutline, MAT, pickables) {
  const geoHood = makeGridGeometry(nU_H, nV_H);
  const HoodMesh = new THREE.Mesh(geoHood, MAT.clay.genitalTubercle);
  HoodMesh.name = 'ClitoralHoodMesh';
  HoodMesh.userData.tissue = 'genitalTubercle';
  scene.add(HoodMesh);
  pickables.push(HoodMesh);
  makeOutline(geoHood, 'genitalTubercle', 0.014, null, scene);
  return { geoHood, HoodMesh };
}

export function writeHood(geo, tp) {
  const pos = geo.attributes.position;
  const { nU, nV } = geo.userData;
  const h = tp.hood;

  if (h < 0.02) {
    // Collapse to a single interior point (invisible mesh + outline)
    const f = getTubFrame(0.6, tp);
    for (let k = 0; k < (nU + 1) * (nV + 1); k++) pos.setXYZ(k, f.pos[0], f.pos[1], f.pos[2]);
    return;
  }

  const uA = 0.40, uB = 0.86;
  const vc = 1.5 * Math.PI; // dorsal direction (-N)
  let k = 0;
  for (let i = 0; i <= nU; i++) {
    const s = i / nU;
    const u = lerp(uA, uB, s);
    const f = getTubFrame(u, tp);
    const thick = h * 0.50 * tp.r0 * Math.pow(Math.sin(Math.PI * s), 0.6);  // 0 at both ends
    const gap = 0.004 + h * 0.30 * tp.r0 * smoothstep(0.45, 1.0, s);      // free edge stands off the glans
    const alpha = Math.PI * lerp(0.95, 0.62, smoothstep(0.25, 1.0, s));    // half-angle of coverage
    for (let j = 0; j <= nV; j++) {
      const w = j / nV;
      let ang, outer;
      if (w <= 0.5) {            // outer arc
        const q = w / 0.5;
        ang = vc - alpha + q * 2 * alpha;
        outer = Math.pow(Math.sin(Math.PI * q), 0.35); // rounded lateral edges
      } else {                   // inner arc (returns)
        const q = (w - 0.5) / 0.5;
        ang = vc + alpha - q * 2 * alpha;
        outer = 0;
      }
      const r = tubRadius(u, tp, ang) + gap + thick * outer;
      const c = Math.cos(ang), sn = Math.sin(ang);
      pos.setXYZ(
        k++,
        f.pos[0] + r * (c * f.B[0] + sn * f.N[0]),
        f.pos[1] + r * (c * f.B[1] + sn * f.N[1]),
        f.pos[2] + r * (c * f.B[2] + sn * f.N[2])
      );
    }
  }
}
