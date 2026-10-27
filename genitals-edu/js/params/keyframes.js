/**
 * Parameter Keyframes for Morphological Stages
 */
export const P = {
  S0: { // Week 7 Bipotential Primordium
    tubercle:  { yBase: 0.04, L: 0.82, r0: 0.22, taper: 0.16, tilt: 0.20, bend: 0.00, glans: 0.14, glansU: 0.80, glansW: 0.14, corona: 0.00, sulcus: 0.00, hood: 0.00, shaftFlat: 0.00 },
    folds:     { dOpen: 0.20, dPeri: 0.22, fuse: 0.00, a: 0.048, b: 0.065, periLen: 0.95, phalicFrac: 0.35, ruffle: 0.00, flange: 0.15 },
    swellings: { yStart: 0.45, yEnd: -1.02, xBase: 0.34, xBulge: 0.16, zBase: 0.08, zBulge: 0.10, rx0: 0.14, rxBulge: 0.06, rz0: 0.11, rzBulge: 0.05, archPow: 0.88, taperPow: 0.35, fuse: 0.00, antComm: 0.00, postComm: 0.00, bilobe: 0.00, rugae: 0.00 },
    sinus:     { sx: 0.16, sy: 0.65, y: -0.48, depth: 0.35, open: 1.0, orifices: 0.0, meatus: 0.0 }
  },
  F_Neo: { // Female Neonatal (46,XX early differentiation)
    tubercle:  { yBase: 0.20, L: 0.38, r0: 0.125, taper: 0.06, tilt: 0.10, bend: 0.01, glans: 0.28, glansU: 0.78, glansW: 0.14, corona: 0.00, sulcus: 0.00, hood: 0.72, shaftFlat: 0.00 },
    folds:     { dOpen: 0.08, dPeri: 0.10, fuse: 0.00, a: 0.024, b: 0.092, periLen: 0.88, phalicFrac: 0.10, ruffle: 0.45, flange: 0.85 },
    swellings: { yStart: 0.52, yEnd: -0.82, xBase: 0.05, xBulge: 0.22, zBase: 0.10, zBulge: 0.12, rx0: 0.17, rxBulge: 0.07, rz0: 0.14, rzBulge: 0.07, archPow: 0.82, taperPow: 0.28, fuse: 0.00, antComm: 0.85, postComm: 0.80, bilobe: 0.00, rugae: 0.00 },
    sinus:     { sx: 0.15, sy: 0.52, y: -0.22, depth: 0.90, open: 1.0, orifices: 1.0, meatus: 0.0 }
  },
  F_Adult: { // Mature Adult Female (Post-pubertal, resting baseline)
    tubercle:  { yBase: 0.22, L: 0.44, r0: 0.140, taper: 0.05, tilt: 0.12, bend: 0.02, glans: 0.35, glansU: 0.80, glansW: 0.14, corona: 0.00, sulcus: 0.00, hood: 0.78, shaftFlat: 0.00 },
    folds:     { dOpen: 0.09, dPeri: 0.12, fuse: 0.00, a: 0.026, b: 0.118, periLen: 0.95, phalicFrac: 0.09, ruffle: 0.55, flange: 0.90 },
    swellings: { yStart: 0.55, yEnd: -0.88, xBase: 0.06, xBulge: 0.28, zBase: 0.12, zBulge: 0.16, rx0: 0.22, rxBulge: 0.09, rz0: 0.17, rzBulge: 0.09, archPow: 0.80, taperPow: 0.26, fuse: 0.00, antComm: 0.92, postComm: 0.88, bilobe: 0.00, rugae: 0.00 },
    sinus:     { sx: 0.17, sy: 0.58, y: -0.22, depth: 0.95, open: 1.0, orifices: 1.0, meatus: 0.0 }
  },
  M_Neo: { // Male Neonatal (46,XY early differentiation)
    tubercle:  { yBase: 0.06, L: 2.30, r0: 0.31, taper: 0.03, tilt: 0.15, bend: 0.10, glans: 0.26, glansU: 0.84, glansW: 0.08, corona: 0.32, sulcus: 0.15, hood: 0.00, shaftFlat: 0.18 },
    folds:     { dOpen: 0.20, dPeri: 0.22, fuse: 1.00, a: 0.040, b: 0.048, periLen: 0.02, phalicFrac: 0.95, ruffle: 0.00, flange: 0.00 },
    swellings: { yStart: 0.18, yEnd: -1.35, xBase: 0.02, xBulge: 0.25, zBase: 0.13, zBulge: 0.22, rx0: 0.21, rxBulge: 0.15, rz0: 0.19, rzBulge: 0.17, archPow: 0.92, taperPow: 0.35, fuse: 1.00, antComm: 0.00, postComm: 0.00, bilobe: 0.85, rugae: 0.80 },
    sinus:     { sx: 0.02, sy: 0.10, y: -0.65, depth: 0.00, open: 0.0, orifices: 0.0, meatus: 1.0 }
  },
  M_Adult: { // Mature Adult Male (Post-pubertal, resting flaccid)
    tubercle:  { yBase: 0.08, L: 2.70, r0: 0.35, taper: 0.02, tilt: 0.08, bend: 0.16, glans: 0.30, glansU: 0.85, glansW: 0.08, corona: 0.36, sulcus: 0.16, hood: 0.00, shaftFlat: 0.22 },
    folds:     { dOpen: 0.20, dPeri: 0.22, fuse: 1.00, a: 0.042, b: 0.052, periLen: 0.02, phalicFrac: 0.95, ruffle: 0.00, flange: 0.00 },
    swellings: { yStart: 0.15, yEnd: -1.55, xBase: 0.02, xBulge: 0.30, zBase: 0.14, zBulge: 0.28, rx0: 0.26, rxBulge: 0.20, rz0: 0.24, rzBulge: 0.22, archPow: 0.94, taperPow: 0.36, fuse: 1.00, antComm: 0.00, postComm: 0.00, bilobe: 0.94, rugae: 0.92 },
    sinus:     { sx: 0.02, sy: 0.10, y: -0.68, depth: 0.00, open: 0.0, orifices: 0.0, meatus: 1.0 }
  }
};
