/**
 * Genital Tubercle Mesh Generator & Morphing Algorithm
 * (Forms clitoral complex in females; penile shaft and glans in males)
 */
import { getTubFrame, tubRadius } from '../params/sampler.js';

const THREE = window.THREE;

export const nU_T = 56;
export const nV_T = 40;

export function initTubercleMesh(scene, makeGridGeometry, makeOutline, MAT, pickables) {
  const geoTub = makeGridGeometry(nU_T, nV_T);
  const TubercleMesh = new THREE.Mesh(geoTub, MAT.clay.genitalTubercle);
  TubercleMesh.name = 'TubercleMesh';
  TubercleMesh.userData.tissue = 'genitalTubercle';
  scene.add(TubercleMesh);
  pickables.push(TubercleMesh);
  makeOutline(geoTub, 'genitalTubercle', 0.022, null, scene);

  return { geoTub, TubercleMesh };
}

export function writeTubercle(geo, p) {
  const pos = geo.attributes.position;
  const { nU, nV } = geo.userData;
  let k = 0;

  for (let i = 0; i <= nU; i++) {
    const u = i / nU;
    const f = getTubFrame(u, p);
    for (let j = 0; j <= nV; j++) {
      const v = (j / nV) * Math.PI * 2;
      const r = tubRadius(u, p, v);
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      const x = f.pos[0] + r * cv * f.B[0] + r * sv * f.N[0];
      const y = f.pos[1] + r * cv * f.B[1] + r * sv * f.N[1];
      const z = f.pos[2] + r * cv * f.B[2] + r * sv * f.N[2];
      pos.setXYZ(k++, x, y, z);
    }
  }
}
