/**
 * Mathematical Helpers & Interpolation Utilities
 */
export const lerp = (a, b, t) => a + (b - a) * t;

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const gauss = (x, mu, s) => Math.exp(-0.5 * ((x - mu) / s) ** 2);

export const easeInOutCubic = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function mixParams(A, B, k) {
  const out = {};
  for (const key in A) {
    out[key] = (typeof A[key] === 'number') ? lerp(A[key], B[key], k) : mixParams(A[key], B[key], k);
  }
  return out;
}
