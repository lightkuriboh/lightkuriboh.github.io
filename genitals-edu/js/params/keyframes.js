/**
 * Parameter Keyframes for Morphological Stages
 */
export const P = {
  S0: { // Week 7 Bipotential Primordium
    tubercle:  { yBase: 0.04, L: 0.82, r0: 0.22, taper: 0.16, tilt: 0.20, bend: 0.00, glans: 0.14, glansU: 0.80, glansW: 0.14, corona: 0.00, sulcus: 0.00, hood: 0.00, shaftFlat: 0.00 },
    folds:     { dOpen: 0.20, dPeri: 0.22, dEnd: 0.10, fuse: 0.00, a: 0.048, b: 0.065, periLen: 0.95, phalicFrac: 0.35, ruffle: 0.00, flange: 0.15, flare: 0.00 },
    swellings: { yStart: 0.18, yEnd: -0.78, xBase: 0.56, xBulge: 0.06, zBase: 0.02, zBulge: 0.10, rx0: 0.12, rxBulge: 0.10, rz0: 0.09, rzBulge: 0.09, archPow: 0.90, taperPow: 0.60, endPull: 0.02, latK: 1.15, medK: 0.95, fuse: 0.00, antComm: 0.00, postComm: 0.00, bilobe: 0.00, rugae: 0.00 },
    sinus:     { sx: 0.16, sy: 0.65, y: -0.48, depth: 0.35, open: 1.0, orifices: 0.0, meatus: 0.0 }
  },
  F_Neo: { // Female Neonatal (46,XX early differentiation)
    tubercle:  { yBase: 0.22, L: 0.30, r0: 0.070, taper: 0.05, tilt: 0.45, bend: 1.40, glans: 0.60, glansU: 0.82, glansW: 0.09, corona: 0.00, sulcus: 0.00, hood: 0.55, shaftFlat: 0.00 },
    folds:     { dOpen: 0.07, dPeri: 0.11, dEnd: 0.020, fuse: 0.00, a: 0.026, b: 0.100, periLen: 0.85, phalicFrac: 0.09, ruffle: 0.35, flange: 0.85, flare: 0.35 },
    swellings: { yStart: 0.52, yEnd: -0.80, xBase: 0.14, xBulge: 0.11, zBase: -0.02, zBulge: 0.09, rx0: 0.05, rxBulge: 0.06, rz0: 0.06, rzBulge: 0.07, archPow: 0.82, taperPow: 0.40, endPull: 0.22, latK: 1.40, medK: 0.70, fuse: 0.00, antComm: 0.85, postComm: 0.80, bilobe: 0.00, rugae: 0.00 },
    sinus:     { sx: 0.062, sy: 0.58, y: -0.20, depth: 0.90, open: 1.0, orifices: 1.0, meatus: 0.0 }
  },
  F_Adult: { // Mature Adult Female (Post-pubertal, resting baseline)
    tubercle:  { yBase: 0.24, L: 0.34, r0: 0.078, taper: 0.05, tilt: 0.45, bend: 1.40, glans: 0.55, glansU: 0.82, glansW: 0.09, corona: 0.00, sulcus: 0.00, hood: 0.60, shaftFlat: 0.00 },
    folds:     { dOpen: 0.08, dPeri: 0.13, dEnd: 0.018, fuse: 0.00, a: 0.030, b: 0.110, periLen: 0.95, phalicFrac: 0.09, ruffle: 0.45, flange: 0.90, flare: 0.45 },
    swellings: { yStart: 0.58, yEnd: -0.92, xBase: 0.20, xBulge: 0.16, zBase: -0.02, zBulge: 0.12, rx0: 0.08, rxBulge: 0.10, rz0: 0.08, rzBulge: 0.10, archPow: 0.80, taperPow: 0.40, endPull: 0.22, latK: 1.45, medK: 0.75, fuse: 0.00, antComm: 0.92, postComm: 0.88, bilobe: 0.00, rugae: 0.00 },
    sinus:     { sx: 0.075, sy: 0.62, y: -0.20, depth: 0.95, open: 1.0, orifices: 1.0, meatus: 0.0 }
  },
  M_Neo: { // Male Neonatal (46,XY early differentiation)
    tubercle:  { yBase: 0.06, L: 1.70, r0: 0.30, taper: 0.02, tilt: 0.15, bend: 0.10, glans: 0.22, glansU: 0.78, glansW: 0.07, corona: 0.15, sulcus: 0.07, hood: 0.00, shaftFlat: 0.12 },
    folds:     { dOpen: 0.20, dPeri: 0.22, dEnd: 0.006, fuse: 1.00, a: 0.030, b: 0.026, periLen: 0.02, phalicFrac: 0.95, ruffle: 0.00, flange: 0.00, flare: 0.00 },
    swellings: { yStart: 0.20, yEnd: -1.25, xBase: 0.02, xBulge: 0.22, zBase: 0.12, zBulge: 0.22, rx0: 0.22, rxBulge: 0.15, rz0: 0.19, rzBulge: 0.14, archPow: 0.92, taperPow: 0.35, endPull: 0.22, latK: 1.00, medK: 1.00, fuse: 1.00, antComm: 0.00, postComm: 0.00, bilobe: 0.80, rugae: 0.75 },
    sinus:     { sx: 0.02, sy: 0.10, y: -0.65, depth: 0.00, open: 0.0, orifices: 0.0, meatus: 1.0 }
  },
  M_Adult: { // Mature Adult Male (Post-pubertal, resting flaccid)
    tubercle:  { yBase: 0.08, L: 2.45, r0: 0.34, taper: 0.00, tilt: 0.08, bend: 0.16, glans: 0.24, glansU: 0.78, glansW: 0.07, corona: 0.16, sulcus: 0.08, hood: 0.00, shaftFlat: 0.12 },
    folds:     { dOpen: 0.20, dPeri: 0.22, dEnd: 0.006, fuse: 1.00, a: 0.030, b: 0.026, periLen: 0.02, phalicFrac: 0.95, ruffle: 0.00, flange: 0.00, flare: 0.00 },
    swellings: { yStart: 0.24, yEnd: -1.45, xBase: 0.02, xBulge: 0.26, zBase: 0.14, zBulge: 0.26, rx0: 0.26, rxBulge: 0.18, rz0: 0.22, rzBulge: 0.16, archPow: 0.94, taperPow: 0.45, endPull: 0.22, latK: 1.00, medK: 1.00, fuse: 1.00, antComm: 0.00, postComm: 0.00, bilobe: 0.75, rugae: 0.85 },
    sinus:     { sx: 0.02, sy: 0.10, y: -0.68, depth: 0.00, open: 0.0, orifices: 0.0, meatus: 1.0 }
  }
};
