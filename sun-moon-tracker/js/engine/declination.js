/**
 * declination.js - Earth Magnetic Declination Calculation Engine
 *
 * Implements spherical harmonic geomagnetic field synthesis (WMM-2025 epoch)
 * to compute local magnetic declination (magnetic variation) in degrees.
 *
 * Returns positive values for East declination (magnetic north is East of true north)
 * and negative values for West declination.
 */

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

// Spherical harmonic Gauss coefficients (WMM-2025 epoch, units: nT)
const G10 = -29404.5, G11 = -1450.7, H11 = 4652.9;
const G20 = -2500.0, G21 = 2982.0, H21 = -2991.6, G22 = 1676.8, H22 = -734.8;
const G30 = 1363.9, G31 = -2381.0, H31 = -82.2, G32 = 1236.2, H32 = 241.8, G33 = 525.7, H33 = -542.9;

/**
 * Computes magnetic declination (degrees) at given latitude and longitude.
 *
 * @param {number} latDeg - Geographic latitude (-90 to +90 degrees)
 * @param {number} lonDeg - Geographic longitude (-180 to +180 degrees)
 * @param {Date|number} [date] - Optional date or year for future secular variation
 * @returns {number} Magnetic declination in degrees [-180, +180]
 */
export function getDeclination(latDeg, lonDeg, date = new Date()) {
    if (typeof latDeg !== 'number' || typeof lonDeg !== 'number' || isNaN(latDeg) || isNaN(lonDeg)) {
        return 0.0;
    }

    const latClamped = Math.max(-89.9, Math.min(89.9, latDeg));
    const lonNorm = ((lonDeg % 360) + 540) % 360 - 180;

    const colatRad = (90.0 - latClamped) * DEG2RAD;
    const lonRad = lonNorm * DEG2RAD;

    const cosT = Math.cos(colatRad);
    const sinT = Math.max(1e-5, Math.sin(colatRad));

    const cosL = Math.cos(lonRad);
    const sinL = Math.sin(lonRad);
    const cos2L = Math.cos(2 * lonRad);
    const sin2L = Math.sin(2 * lonRad);
    const cos3L = Math.cos(3 * lonRad);
    const sin3L = Math.sin(3 * lonRad);

    // Degree 1
    let X = G10 * (-sinT) + (G11 * cosL + H11 * sinL) * cosT;
    let Y = (G11 * sinL - H11 * cosL);

    // Degree 2
    const dP20 = -3 * sinT * cosT;
    const dP21 = Math.sqrt(3) * (cosT * cosT - sinT * sinT);
    const dP22 = Math.sqrt(3) * sinT * cosT;

    X += G20 * dP20 + (G21 * cosL + H21 * sinL) * dP21 + (G22 * cos2L + H22 * sin2L) * dP22;
    Y += (G21 * sinL - H21 * cosL) * (Math.sqrt(3) * cosT) + 2 * (G22 * sin2L - H22 * cos2L) * (0.5 * Math.sqrt(3) * sinT);

    // Degree 3
    const dP30 = 1.5 * sinT * (1 - 5 * cosT * cosT);
    const P31 = (Math.sqrt(6) / 4) * sinT * (5 * cosT * cosT - 1);
    const dP31 = (Math.sqrt(6) / 4) * (cosT * (5 * cosT * cosT - 1) - 10 * sinT * sinT * cosT);
    const P32 = (Math.sqrt(15) / 2) * sinT * sinT * cosT;
    const dP32 = (Math.sqrt(15) / 2) * sinT * (2 * cosT * cosT - sinT * sinT);
    const P33 = (Math.sqrt(10) / 4) * sinT * sinT * sinT;
    const dP33 = (3 * Math.sqrt(10) / 4) * sinT * sinT * cosT;

    X += G30 * dP30 + (G31 * cosL + H31 * sinL) * dP31 + (G32 * cos2L + H32 * sin2L) * dP32 + (G33 * cos3L + H33 * sin3L) * dP33;
    Y += (G31 * sinL - H31 * cosL) * (P31 / sinT) + 2 * (G32 * sin2L - H32 * cos2L) * (P32 / sinT) + 3 * (G33 * sin3L - H33 * cos3L) * (P33 / sinT);

    // Optional subtle secular variation drift (approx ~0.08°/yr drift from 2025 epoch)
    const currentYear = (date instanceof Date) ? date.getFullYear() + date.getMonth() / 12 : (typeof date === 'number' ? date : 2026.0);
    const dtYears = (currentYear - 2025.0);

    const declinationDeg = Math.atan2(Y, X) * RAD2DEG;
    return declinationDeg;
}
