/**
 * Procedural Texture Generation (Skin bump maps)
 */
const THREE = window.THREE;

export function makeProceduralSkinTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      const n1 = Math.sin(x * 0.14) * Math.cos(y * 0.14);
      const n2 = Math.sin(x * 0.32 + 1.2) * Math.sin(y * 0.32 + 0.7);
      const n3 = Math.sin((x + y) * 0.5);
      const val = 128 + Math.floor(26 * n1 + 16 * n2 + 10 * n3);
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

export const skinBumpTex = makeProceduralSkinTexture();
