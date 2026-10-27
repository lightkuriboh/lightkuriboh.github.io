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

  return { geoSinus3D, SinusVestibuleMesh, SinusOpeningMesh, meatus, meatusMat };
}

export function writeSinus3D(geo, s) {
  const pos = geo.attributes.position;
  const { nU, nV } = geo.userData;
  let k = 0;

  for (let i = 0; i <= nU; i++) {
    const u = i / nU;
    const y = lerp(s.y + s.sy * 0.48, s.y - s.sy * 0.48, u);
    const q = Math.sin(Math.PI * clamp(u, 0, 1));
    const w = s.sx * Math.pow(q, 0.38) * 1.35 * s.open;

    for (let j = 0; j <= nV; j++) {
      const v = (j / nV) * 2 - 1; // -1 to +1
      const x = v * w;
      let z = 0.04 - s.depth * 0.10 * (1 - v * v) * s.open;

      if (s.orifices > 0.01) {
        const o = s.orifices;
        // Urethral papilla & slit
        const dUrU = (u - 0.28) / 0.08, dUrV = v / 0.45;
        const rUr = Math.hypot(dUrU, dUrV);
        const papilla = 0.026 * o * gauss(rUr, 0.65, 0.35);
        const slitUr = -0.042 * o * gauss(u, 0.28, 0.05) * gauss(v, 0, 0.16);

        // Vaginal introitus & hymenal caruncles
        const dVagU = (u - 0.68) / 0.14, dVagV = v / 0.55;
        const rVag = Math.hypot(dVagU, dVagV);
        const hymen = 0.022 * o * gauss(rVag, 0.75, 0.30);
        const introitus = -0.090 * o * gauss(u, 0.68, 0.11) * gauss(v, 0, 0.38);

        z += papilla + slitUr + hymen + introitus;
      }
      pos.setXYZ(k++, x, y, z);
    }
  }
}

export function updateMeatus(meatus, pTub, pSinus) {
  const mu = 0.94;
  const axFrm = getTubFrame(mu, pTub);
  const rApex = tubRadius(mu, pTub, Math.PI / 2);
  meatus.position.set(
    0,
    axFrm.pos[1] + rApex * axFrm.N[1] + 0.012,
    axFrm.pos[2] + rApex * axFrm.N[2] + 0.012
  );
  meatus.scale.set(
    Math.max(1e-3, 0.22 * pSinus.meatus),
    Math.max(1e-3, 1.35 * pSinus.meatus),
    1
  );
  meatus.visible = pSinus.meatus > 0.03;
}
