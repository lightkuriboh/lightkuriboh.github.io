/**
 * Urogenital Sinus / Vestibule & Meatus Mesh Generator & Morphing Algorithm
 * (Forms vestibule with urethral & vaginal orifices in females; spongy urethral lumen & distal meatus in males)
 */
import { clamp, lerp, gauss } from '../math/helpers.js';
import { getTubFrame, tubRadius } from '../params/sampler.js';

const THREE = window.THREE;

export const nU_Sinus = 52;
export const nV_Sinus = 28;

export function initSinusMesh(scene, makeGridGeometry, makeOutline, MAT, pickables) {
  const geoSinus3D = makeGridGeometry(nU_Sinus, nV_Sinus);
  const SinusVestibuleMesh = new THREE.Mesh(geoSinus3D, MAT.clay.urogenitalSinus);
  SinusVestibuleMesh.name = 'SinusVestibuleMesh';
  SinusVestibuleMesh.userData.tissue = 'urogenitalSinus';

  const SinusOpeningMesh = new THREE.Group();
  SinusOpeningMesh.name = 'SinusOpeningMesh';
  SinusOpeningMesh.add(SinusVestibuleMesh);
  pickables.push(SinusVestibuleMesh);
  scene.add(SinusOpeningMesh);

  makeOutline(geoSinus3D, 'urogenitalSinus', 0.016, SinusOpeningMesh);

  // Male external urethral meatus (apex sagittal slit on glans penis)
  const meatusMat = new THREE.MeshBasicMaterial({ color: 0x05080f, transparent: true });
  const meatus = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.038, 20), meatusMat);
  meatus.userData.tissue = 'urogenitalSinus';
  SinusOpeningMesh.add(meatus);

  // Female dark orifice decals (urethral slit & vaginal introitus)
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x1a0508, transparent: true, opacity: 0.85, depthWrite: false });
  const introitusHole = new THREE.Mesh(new THREE.CircleGeometry(1, 32), holeMat);
  const urethralSlit = new THREE.Mesh(new THREE.CircleGeometry(1, 20), holeMat);
  [introitusHole, urethralSlit].forEach(m => { m.userData.tissue = 'urogenitalSinus'; SinusOpeningMesh.add(m); });

  return { geoSinus3D, SinusVestibuleMesh, SinusOpeningMesh, meatus, meatusMat, introitusHole, urethralSlit };
}

export function sinusY(u, s) { return lerp(s.y + s.sy * 0.48, s.y - s.sy * 0.48, u); }
export function sinusHalfWidth(u, s) {
  const q = Math.sin(Math.PI * clamp(u, 0, 1));
  return s.sx * Math.pow(q, 0.38) * 1.35 * s.open;
}
export function sinusZ(u, v, s) {
  let z = 0.04 - s.depth * 0.10 * (1 - v * v) * s.open;
  if (s.orifices > 0.01) {
    const o = s.orifices;
    // Urethral papilla & slit
    const rUr = Math.hypot((u - 0.28) / 0.08, v / 0.45);
    const papilla = 0.026 * o * gauss(rUr, 0.65, 0.35);
    const slitUr = -0.042 * o * gauss(u, 0.28, 0.05) * gauss(v, 0, 0.16);
    // Vaginal introitus (deeper) & hymenal rim
    const rVag = Math.hypot((u - 0.68) / 0.14, v / 0.55);
    const hymen = 0.026 * o * gauss(rVag, 0.80, 0.22);
    const introitus = -0.130 * o * gauss(u, 0.68, 0.10) * gauss(v, 0, 0.34);
    z += papilla + slitUr + hymen + introitus;
  }
  return z;
}

export function writeSinus3D(geo, s) {
  const pos = geo.attributes.position;
  const { nU, nV } = geo.userData;
  let k = 0;
  for (let i = 0; i <= nU; i++) {
    const u = i / nU;
    const y = sinusY(u, s);
    const w = sinusHalfWidth(u, s);
    for (let j = 0; j <= nV; j++) {
      const v = (j / nV) * 2 - 1;
      pos.setXYZ(k++, v * w, y, sinusZ(u, v, s));
    }
  }
}

export function updateOrifices(sinus, s) {
  const o = s.orifices * s.open;
  const show = o > 0.05;
  sinus.introitusHole.visible = show;
  sinus.urethralSlit.visible = show;
  if (!show) return;
  const w = sinusHalfWidth(0.68, s);
  sinus.introitusHole.position.set(0, sinusY(0.68, s), sinusZ(0.68, 0, s) + 0.003);
  sinus.introitusHole.scale.set(Math.max(1e-3, 0.40 * w * o), Math.max(1e-3, 0.11 * s.sy * o), 1);
  const wu = sinusHalfWidth(0.28, s);
  sinus.urethralSlit.position.set(0, sinusY(0.28, s), sinusZ(0.28, 0, s) + 0.003);
  sinus.urethralSlit.scale.set(Math.max(1e-3, 0.10 * wu * o), Math.max(1e-3, 0.045 * s.sy * o), 1);
}

export function updateMeatus(meatus, pTub, pSinus) {
  const mu = 0.965;
  const axFrm = getTubFrame(mu, pTub);
  const rApex = tubRadius(mu, pTub, Math.PI / 2);
  meatus.position.set(
    0,
    axFrm.pos[1] + rApex * axFrm.N[1] + 0.010,
    axFrm.pos[2] + rApex * axFrm.N[2] + 0.010
  );
  meatus.scale.set(
    Math.max(1e-3, 0.22 * pSinus.meatus),
    Math.max(1e-3, 1.35 * pSinus.meatus),
    1
  );
  meatus.visible = pSinus.meatus > 0.03;
}
