/**
 * Lithotomy Body Field (pure math, THREE-free)
 * Analytic torso height field + abducted thigh volumes.
 * Shared by mesh/base.js (rendering), mesh/swellings.js (root depth)
 * and tools/check-clearance.mjs (headless verification).
 */
import { clamp, lerp, smoothstep } from '../math/helpers.js';

export const Z_FLOOR = -0.36; // urogenital / suprapubic floor level
export const Z_ROOT = -0.40;  // depth the swellings' back side sinks to (must be < Z_FLOOR)

const g2 = (x, y, cx, cy, sx, sy) => {
  const dx = (x - cx) / sx, dy = (y - cy) / sy;
  return Math.exp(-0.5 * (dx * dx + dy * dy));
};

/** Static (sex-independent) torso surface height at (x, y). */
export function torsoStatic(x, y) {
  const ax = Math.abs(x);
  let z = Z_FLOOR;

  // 1. Groin / hip rise: the surface climbs laterally toward the thigh roots
  z += 0.32 * smoothstep(0.95, 2.3, ax);

  // 2. Genitocrural (inguinal) crease, drifting laterally as it runs anteriorly
  const creaseX = 1.02 + 0.10 * y;
  const creaseMask = smoothstep(-1.6, -0.9, y) * (1 - smoothstep(1.4, 2.2, y));
  z -= 0.06 * Math.exp(-0.5 * ((ax - creaseX) / 0.14) ** 2) * creaseMask;

  // 3. Lower abdomen above the pubis bulges gently toward the viewer
  z += 0.20 * smoothstep(1.7, 3.4, y) * (1 - smoothstep(1.4, 3.4, ax));

  // 4. Buttocks (paired gluteal mounds) + gluteal cleft
  z += 0.55 * g2(ax, y, 1.05, -2.15, 0.70, 0.60);
  z -= 0.10 * Math.exp(-0.5 * (x / 0.12) ** 2) * (1 - smoothstep(-1.95, -1.35, y));

  // 5. Perineal body (slight raised pad between vestibule/scrotum and anus)
  z += 0.04 * g2(x, y, 0, -1.22, 0.22, 0.18);

  // 6. Anus: puckered depression with radial folds
  const ay = y + 1.62;
  const ra = Math.hypot(x / 0.11, ay / 0.09);
  z -= 0.06 * Math.exp(-0.5 * ra * ra);
  z += 0.012 * Math.exp(-0.5 * ((ra - 1.4) / 0.5) ** 2) * Math.cos(10 * Math.atan2(ay, x));

  return z;
}

/** Mons pubis adipose mound (full in female, flattened in male so the reflected penis never clips). */
export function torsoMons(x, y) {
  return 0.42 * g2(x, y, 0, 1.10, 0.85, 0.52);
}

/** Final torso height. maleness in [0, 1]. */
export function torsoHeight(x, y, maleness) {
  return torsoStatic(x, y) + (1 - maleness) * torsoMons(x, y);
}

// ---------------------------------------------------------------------------
// Thighs: abducted & flexed (lithotomy). Values are for side = +1 (viewer's right);
// side = -1 mirrors X.
// ---------------------------------------------------------------------------
export const THIGH = {
  root: [2.05, -0.40, -0.95], // axis point at t = 0 (behind the torso surface)
  dir: [0.56, 0.30, 0.77],    // outward, slightly anterior, toward the viewer
  length: 3.8,
  t0: -0.35,                  // the tube starts buried inside the body (t < 0) so its open root is hidden
  rRoot: 1.08,
  rEnd: 0.80,
  rootFlare: 0.18,
  ellipW: 0.92                // cross-section squash along the W axis
};

const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const _frames = {};

export function thighFrame(side) {
  if (_frames[side]) return _frames[side];
  const d = norm([side * THIGH.dir[0], THIGH.dir[1], THIGH.dir[2]]);
  const U = norm(cross(d, [0, 1, 0]));
  const W = cross(U, d); // guarantees (d × W) = U, so the grid winding yields outward normals
  const A = [side * THIGH.root[0], THIGH.root[1], THIGH.root[2]];
  return (_frames[side] = { A, d, U, W });
}

/** Radius at axial parameter t for a unit world-space radial direction dirW. */
export function thighRadius(t, dirW, side) {
  let r = lerp(THIGH.rRoot, THIGH.rEnd, smoothstep(0, 1, clamp(t, 0, 1)));
  r += THIGH.rootFlare * (1 - smoothstep(-0.1, 0.22, t));          // root blends into hip / buttock
  const medial = Math.max(0, -side * dirW[0]);
  r *= 1 - 0.10 * medial * medial;                                  // flatter adductor (inner-thigh) wall
  const anterior = Math.max(0, dirW[1]);
  r *= 1 + 0.05 * anterior * Math.exp(-0.5 * ((t - 0.5) / 0.2) ** 2); // quadriceps fullness
  return r;
}

/** Surface point of the thigh tube. t in [THIGH.t0, 1], phi in [0, 2π]. Returns [x, y, z]. */
export function thighPoint(side, t, phi) {
  const { A, d, U, W } = thighFrame(side);
  const c = Math.cos(phi), s = Math.sin(phi) * THIGH.ellipW;
  const rx = c * U[0] + s * W[0], ry = c * U[1] + s * W[1], rz = c * U[2] + s * W[2];
  const r = thighRadius(t, norm([rx, ry, rz]), side);
  const L = t * THIGH.length;
  return [A[0] + d[0] * L + r * rx, A[1] + d[1] * L + r * ry, A[2] + d[2] * L + r * rz];
}

/** Approximate signed clearance (positive = outside the thigh). Used by the verification script. */
export function thighClearance(side, P) {
  const { A, d } = thighFrame(side);
  const v = [P[0] - A[0], P[1] - A[1], P[2] - A[2]];
  const L = clamp(v[0] * d[0] + v[1] * d[1] + v[2] * d[2], THIGH.t0 * THIGH.length, THIGH.length);
  const rv = [P[0] - (A[0] + d[0] * L), P[1] - (A[1] + d[1] * L), P[2] - (A[2] + d[2] * L)];
  const dist = Math.hypot(rv[0], rv[1], rv[2]);
  return dist - thighRadius(L / THIGH.length, norm(rv), side);
}
