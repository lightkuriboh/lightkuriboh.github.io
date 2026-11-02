/**
 * Anatomical Lithotomy Body Backdrop: sculpted lower torso (mons, groin creases,
 * perineum, buttocks, anus) + two abducted thigh volumes, & Concentric Metric Rings
 */
import { lerp } from '../math/helpers.js';
import { torsoStatic, torsoMons, thighPoint, THIGH } from './bodyField.js';
import { torsoMat, thighMat } from './materials.js';

const THREE = window.THREE;

function buildTorsoGeometry() {
  const geo = new THREE.PlaneGeometry(10, 9, 160, 144);
  geo.translate(0, 0.3, 0);
  const pos = geo.attributes.position;
  pos.setUsage(THREE.DynamicDrawUsage);
  const zStatic = new Float32Array(pos.count);
  const zMons = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    zStatic[i] = torsoStatic(x, y);
    zMons[i] = torsoMons(x, y);
  }
  geo.userData = { zStatic, zMons, maleness: -1 };
  return geo;
}

function buildThighGeometry(side) {
  const nT = 48, nP = 64;
  const n = (nT + 1) * (nP + 1);
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  let k = 0;
  for (let i = 0; i <= nT; i++) {
    const w = i / nT;
    const t = lerp(THIGH.t0, 1, w);
    for (let j = 0; j <= nP; j++) {
      const P = thighPoint(side, t, (j / nP) * Math.PI * 2);
      pos[k * 3] = P[0]; pos[k * 3 + 1] = P[1]; pos[k * 3 + 2] = P[2];
      uv[k * 2] = j / nP; uv[k * 2 + 1] = w;
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
  [0.9, 1.8].forEach(r => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.01, r, 72),
      new THREE.MeshBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    m.position.set(0, 0, -0.05);
    depthRings.add(m);
  });
  depthRings.visible = false;
  scene.add(depthRings);

  const pelvic = { perinealBase, torsoGeo, thighL, thighR, depthRings, baseGeo: torsoGeo, baseMat: torsoMat };
  updatePelvicBase(pelvic, 0);
  return pelvic;
}
