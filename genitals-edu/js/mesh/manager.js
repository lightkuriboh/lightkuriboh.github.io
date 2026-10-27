/**
 * Mesh Lifecycle & Dynamic Geometry Morphing Coordinator
 */
import { smoothstep } from '../math/helpers.js';
import { sampleParams } from '../params/sampler.js';
import { MAT, makeOutline } from './materials.js';
import { initPelvicBase } from './base.js';
import { initTubercleMesh, writeTubercle } from './tubercle.js';
import { initFoldsMesh, writeTube } from './folds.js';
import { initSwellingsMesh, writeSwelling, writeScrotalRaphe } from './swellings.js';
import { initSinusMesh, writeSinus3D, updateMeatus } from './sinus.js';

const THREE = window.THREE;

export const dynamicGeometries = [];
export const pickables = [];

export function makeGridGeometry(nU, nV) {
  const g = new THREE.BufferGeometry();
  const n = (nU + 1) * (nV + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nV; j++) {
      const a = i * (nV + 1) + j;
      const b = (i + 1) * (nV + 1) + j;
      const c = (i + 1) * (nV + 1) + j + 1;
      const d = i * (nV + 1) + j + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  g.setIndex(idx);
  g.userData = { nU, nV };
  dynamicGeometries.push(g);
  return g;
}

export function fixSeam(g) {
  const { nU, nV } = g.userData;
  const nrm = g.attributes.normal;
  for (let i = 0; i <= nU; i++) {
    const a = i * (nV + 1);
    const b = a + nV;
    const x = (nrm.getX(a) + nrm.getX(b)) / 2;
    const y = (nrm.getY(a) + nrm.getY(b)) / 2;
    const z = (nrm.getZ(a) + nrm.getZ(b)) / 2;
    nrm.setXYZ(a, x, y, z);
    nrm.setXYZ(b, x, y, z);
  }
}

export let meshContext = null;

export function initMeshes(scene) {
  const pelvic = initPelvicBase(scene);
  const tub = initTubercleMesh(scene, makeGridGeometry, makeOutline, MAT, pickables);
  const folds = initFoldsMesh(scene, makeGridGeometry, makeOutline, MAT, pickables);
  const swell = initSwellingsMesh(scene, makeGridGeometry, makeOutline, MAT, pickables);
  const sinus = initSinusMesh(scene, makeGridGeometry, makeOutline, MAT, pickables);

  const meshTissue = [
    [tub.TubercleMesh, 'genitalTubercle'],
    [folds.foldL, 'urogenitalFolds'],
    [folds.foldR, 'urogenitalFolds'],
    [folds.rapheMesh, 'urogenitalFolds'],
    [swell.swL, 'labioscrotalSwellings'],
    [swell.swR, 'labioscrotalSwellings'],
    [swell.scrotalRaphe, 'labioscrotalSwellings'],
    [sinus.SinusVestibuleMesh, 'urogenitalSinus']
  ];

  meshContext = {
    pelvic,
    tub,
    folds,
    swell,
    sinus,
    meshTissue
  };

  return meshContext;
}

export function updateMorph(t, state) {
  if (!meshContext) return;
  const { tub, folds, swell, sinus } = meshContext;
  const p = sampleParams(t, state);

  writeTubercle(tub.geoTub, p.tubercle);
  writeTube(folds.geoFoldL, -1, p.folds, p.tubercle, p.folds.a, p.folds.b, 0);
  writeTube(folds.geoFoldR,  1, p.folds, p.tubercle, p.folds.a, p.folds.b, 0);

  const rf = smoothstep(0.55, 1, p.folds.fuse);
  writeTube(folds.geoRaphe, 0, p.folds, p.tubercle, 0.022 * rf, 0.028 * rf, p.folds.b * 0.5 * rf);

  writeSwelling(swell.geoSwellingL, -1, p.swellings);
  writeSwelling(swell.geoSwellingR,  1, p.swellings);
  writeScrotalRaphe(swell.geoScrotalRaphe, p.swellings);
  swell.scrotalRaphe.visible = p.swellings.fuse > 0.12;

  writeSinus3D(sinus.geoSinus3D, p.sinus);
  sinus.SinusVestibuleMesh.visible = p.sinus.open > 0.02;

  updateMeatus(sinus.meatus, p.tubercle, p.sinus);

  for (const g of dynamicGeometries) {
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    if (
      g === tub.geoTub ||
      g === folds.geoFoldL ||
      g === folds.geoFoldR ||
      g === folds.geoRaphe ||
      g === swell.geoSwellingL ||
      g === swell.geoSwellingR
    ) {
      fixSeam(g);
    }
    g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
    g.computeBoundingBox();
  }

  state.derived = p;
}
