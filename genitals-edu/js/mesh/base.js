/**
 * Anatomical Lithotomy Body Backdrop: sculpted lower torso (mons, groin creases,
 * perineum, buttocks, anus) + two abducted thigh volumes, & Concentric Metric Rings
 */
import { lerp, clamp, smoothstep } from '../math/helpers.js';
import { torsoStatic, torsoMons, thighPoint, thighClearance, THIGH } from './bodyField.js';
import { torsoMat, thighMat } from './materials.js';

const THREE = window.THREE;

/**
 * Cavity AO for the torso: concave regions (positive Laplacian: creases, cleft, anus)
 * and regions near the thigh roots are darkened. Returns a brightness in [0.45, 1].
 */
function torsoAO(x, y) {
  const h = 0.06;
  const z = torsoStatic(x, y);
  const lap = (torsoStatic(x + h, y) + torsoStatic(x - h, y) + torsoStatic(x, y + h) + torsoStatic(x, y - h) - 4 * z) / (h * h);
  let ao = 1 - clamp(lap * 0.9, 0, 0.45);
  const P = [x, y, z];
  const near = Math.min(thighClearance(1, P), thighClearance(-1, P));
  ao *= lerp(0.62, 1, smoothstep(0.0, 0.55, near)); // contact shadow where the thigh meets the torso
  return clamp(ao, 0.45, 1);
}

function buildTorsoGeometry() {
  const geo = new THREE.PlaneGeometry(16, 14, 180, 160);
  geo.translate(0, 0.2, 0);
  const pos = geo.attributes.position;
  pos.setUsage(THREE.DynamicDrawUsage);
  const zStatic = new Float32Array(pos.count);
  const zMons = new Float32Array(pos.count);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    zStatic[i] = torsoStatic(x, y);
    zMons[i] = torsoMons(x, y);
    const a = torsoAO(x, y);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.userData = { zStatic, zMons, maleness: -1 };
  return geo;
}

function buildThighGeometry(side) {
  const nT = 48, nP = 64;
  const n = (nT + 1) * (nP + 1);
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3);
  let k = 0;
  for (let i = 0; i <= nT; i++) {
    const w = i / nT;
    const t = lerp(THIGH.t0, 1, w);
    for (let j = 0; j <= nP; j++) {
      const P = thighPoint(side, t, (j / nP) * Math.PI * 2);
      pos[k * 3] = P[0]; pos[k * 3 + 1] = P[1]; pos[k * 3 + 2] = P[2];
      uv[k * 2] = j / nP; uv[k * 2 + 1] = w;
      const gap = P[2] - torsoStatic(P[0], P[1]);           // height above the torso surface
      const a = lerp(0.55, 1, smoothstep(0.0, 0.7, gap));
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = a;
      k++;
    }
  }
  const idx = [];
  for (let i = 0; i < nT; i++) {
    for (let j = 0; j < nP; j++) {
      const a = i * (nP + 1) + j, b = (i + 1) * (nP + 1) + j;
      const c = (i + 1) * (nP + 1) + j + 1, d = i * (nP + 1) + j + 1;
      idx.push(a, b, d, b, c, d); // same winding as makeGridGeometry -> outward normals
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // Average normals across the duplicated phi seam (no lighting seam line)
  const nrm = geo.attributes.normal;
  for (let i = 0; i <= nT; i++) {
    const a = i * (nP + 1), b = a + nP;
    const x = (nrm.getX(a) + nrm.getX(b)) / 2, y = (nrm.getY(a) + nrm.getY(b)) / 2, z = (nrm.getZ(a) + nrm.getZ(b)) / 2;
    nrm.setXYZ(a, x, y, z); nrm.setXYZ(b, x, y, z);
  }
  return geo;
}

/** Re-applies the sex-dependent mons channel. Cheap no-op unless maleness changed. */
export function updatePelvicBase(pelvic, maleness) {
  const geo = pelvic.torsoGeo;
  const ud = geo.userData;
  if (Math.abs(maleness - ud.maleness) < 0.002) return;
  ud.maleness = maleness;
  const pos = geo.attributes.position;
  const f = 1 - maleness;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, ud.zStatic[i] + f * ud.zMons[i]);
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

export function initPelvicBase(scene) {
  const torsoGeo = buildTorsoGeometry();
  const perinealBase = new THREE.Mesh(torsoGeo, torsoMat);
  perinealBase.name = 'LithotomyTorsoMesh';
  scene.add(perinealBase);

  const thighL = new THREE.Mesh(buildThighGeometry(-1), thighMat);
  const thighR = new THREE.Mesh(buildThighGeometry(1), thighMat);
  thighL.name = 'ThighLeftMesh';
  thighR.name = 'ThighRightMesh';
  scene.add(thighL, thighR);

  const depthRings = new THREE.Group();
  depthRings.visible = false;
  scene.add(depthRings);

  const pelvic = { perinealBase, torsoGeo, thighL, thighR, depthRings, baseGeo: torsoGeo, baseMat: torsoMat };
  updatePelvicBase(pelvic, 0);
  return pelvic;
}
