/**
 * Anatomical Lithotomy Pelvic Examination Base & Concentric Metric Rings
 */
import { lerp } from '../math/helpers.js';
import { baseMat } from './materials.js';

const THREE = window.THREE;

export function initPelvicBase(scene) {
  // High-resolution anatomical open-leg lithotomy pelvic base (clinical examination position)
  const baseGeo = new THREE.PlaneGeometry(9.5, 8.5, 96, 96);
  const a = baseGeo.attributes.position;

  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i);
    const y = a.getY(i);
    const absX = Math.abs(x);
    let z = -0.15; // baseline recessed floor

    // Urogenital hiatus basin depression (ensures zero clipping with genitalia)
    const dBasinX = x / 0.60;
    const dBasinY = (y + 0.15) / 0.70;
    const basin = -0.05 * Math.exp(-0.5 * (dBasinX * dBasinX + dBasinY * dBasinY));
    z += basin;

    // 1. Mons Pubis (anterior adipose mound at y > 0.35)
    if (y > 0.35) {
      const dX = x / 0.85;
      const dY = (y - 1.10) / 0.55;
      z += 0.24 * Math.exp(-0.5 * (dX * dX + dY * dY));
    }

    // 2. Open Thighs in Lithotomy Position (abducted at |x| > 0.60)
    if (absX > 0.60) {
      const thighX = (absX - 1.85) / 0.85;
      const thighY = (y + 0.25) / 1.35;
      const thighBump = 0.35 * Math.exp(-0.5 * (thighX * thighX + thighY * thighY));
      const sulcus = -0.06 * Math.exp(-0.5 * Math.pow((absX - 0.78) / 0.12, 2));
      z += thighBump + sulcus;
    }

    // 3. Perineal body & Posterior Pelvic Floor / Gluteal cleft (y < -0.80)
    if (y < -0.80) {
      const dAnalX = x / 0.25;
      const dAnalY = (y + 1.30) / 0.35;
      const analDepression = -0.08 * Math.exp(-0.5 * (dAnalX * dAnalX + dAnalY * dAnalY));
      const buttockX = (absX - 1.05) / 0.55;
      const buttockY = (y + 1.45) / 0.55;
      const buttockMound = 0.20 * Math.exp(-0.5 * (buttockX * buttockX + buttockY * buttockY));
      z += analDepression + buttockMound;
    }

    // Soft natural perimeter edge falloff
    const rEdge = Math.hypot(x / 4.4, y / 3.9);
    if (rEdge > 0.68) {
      const tEdge = Math.min(1, (rEdge - 0.68) / 0.32);
      z = lerp(z, -0.32, tEdge * tEdge);
    }
    a.setZ(i, z);
  }
  baseGeo.computeVertexNormals();

  const perinealBase = new THREE.Mesh(baseGeo, baseMat);
  perinealBase.position.set(0, 0, 0);
  scene.add(perinealBase);

  const depthRings = new THREE.Group();
  [0.9, 1.8, 2.7].forEach(r => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.01, r, 72),
      new THREE.MeshBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    m.position.set(0, 0, -0.05);
    depthRings.add(m);
  });
  depthRings.visible = false;
  scene.add(depthRings);

  return { perinealBase, depthRings, baseGeo, baseMat };
}
