/**
 * Three.js Scene, Camera, Lighting, OrbitControls & Pointer Raycasting
 */
import { CAM } from '../config.js';
import { state } from '../state.js';
import { pickables } from '../mesh/manager.js';

const THREE = window.THREE;

export let scene, camera, renderer, controls;
export let ambient, hemi, sun, fillLight, rim;
export let viewport, canvas;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
export let mouseIn = false;
let downPos = null;

let onHighlightChange = null;
let onPinChange = null;

export function initScene(callbacks = {}) {
  onHighlightChange = callbacks.onHighlightChange;
  onPinChange = callbacks.onPinChange;

  viewport = document.getElementById('viewport');
  canvas = document.getElementById('gl');

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(...CAM.pos);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  controls = new THREE.OrbitControls(camera, canvas);
  Object.assign(controls, {
    enableDamping: true,
    dampingFactor: 0.08,
    minDistance: 3,
    maxDistance: 12,
    enablePan: true
  });
  controls.target.set(...CAM.target);
  controls.update();

  // Medical studio lighting
  ambient = new THREE.AmbientLight(0xfff5ea, 0.22);
  hemi = new THREE.HemisphereLight(0xfff5ea, 0x1e2438, 0.65);
  sun = new THREE.DirectionalLight(0xfff8ee, 1.05);
  sun.position.set(3.5, 4.5, 5.0);
  fillLight = new THREE.DirectionalLight(0xdce7ff, 0.45);
  fillLight.position.set(-4.0, 1.0, 3.5);
  rim = new THREE.PointLight(0x8b5cf6, 0.35, 14);
  rim.position.set(-4, 2, -2);
  scene.add(ambient, hemi, sun, fillLight, rim);

  // Pointer interactions
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    mouseIn = true;
  });

  canvas.addEventListener('pointerleave', () => {
    mouseIn = false;
    if (!state.pinned && onHighlightChange) onHighlightChange(null);
  });

  canvas.addEventListener('pointerdown', e => {
    downPos = [e.clientX, e.clientY];
  });

  canvas.addEventListener('click', e => {
    if (downPos && Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 5) return;
    const k = pickAt(mouse, e);
    togglePin(k);
  });

  return { scene, camera, renderer, controls };
}

export function pickAt(m, e) {
  if (e) {
    const r = canvas.getBoundingClientRect();
    m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  raycaster.setFromCamera(m, camera);
  const hits = raycaster.intersectObjects(pickables.filter(o => o.visible), false);
  return hits.length ? hits[0].object.userData.tissue : null;
}

export function togglePin(k) {
  if (!k || state.pinned === k) {
    state.pinned = null;
    if (onHighlightChange) onHighlightChange(null);
  } else {
    state.pinned = k;
    if (onHighlightChange) onHighlightChange(k);
  }
  if (onPinChange) onPinChange(state.pinned);
}

export function checkHoverPick() {
  if (mouseIn && !state.pinned) {
    const k = pickAt(mouse);
    if (k !== state.highlight && onHighlightChange) onHighlightChange(k);
  }
}

export function resizeViewport() {
  if (!viewport || !renderer || !camera) return;
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.9 ? 40 / Math.max(0.55, (w / h) * 1.05) : 40;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
