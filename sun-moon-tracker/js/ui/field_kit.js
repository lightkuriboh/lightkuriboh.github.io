/**
 * Field Kit — Photography & Hiker Utility Tools for Web PWA.
 * Includes FOV, Focus Stack, Night Sky Exposure, ND Filter, Moon Size, Sun Terrain, and Distance & Bearing.
 */

export const SensorPresets = [
    { name: 'Full Frame (35mm)', width: 36.0, height: 24.0 },
    { name: 'APS-C (Sony / Nikon / Fuji)', width: 23.5, height: 15.6 },
    { name: 'APS-C (Canon)', width: 22.3, height: 14.9 },
    { name: 'Micro 4/3', width: 17.3, height: 13.0 },
    { name: 'Medium Format (Fuji GFX)', width: 43.8, height: 32.9 },
    { name: '1-inch (Sony RX100)', width: 13.2, height: 8.8 },
    { name: 'Smartphone (1/1.3")', width: 9.8, height: 7.3 }
];

export class FieldKitMath {
    static calculateFOV(sensorWidthMm, sensorHeightMm, focalLengthMm) {
        if (focalLengthMm <= 0) return { hFov: 0, vFov: 0, dFov: 0 };
        const diagMm = Math.hypot(sensorWidthMm, sensorHeightMm);
        const hFov = 2.0 * Math.atan(sensorWidthMm / (2.0 * focalLengthMm)) * (180.0 / Math.PI);
        const vFov = 2.0 * Math.atan(sensorHeightMm / (2.0 * focalLengthMm)) * (180.0 / Math.PI);
        const dFov = 2.0 * Math.atan(diagMm / (2.0 * focalLengthMm)) * (180.0 / Math.PI);
        return { hFov, vFov, dFov };
    }

    static calculateFocusStack(focalLengthMm, apertureFNumber, nearDistanceM, farDistanceM, sensorDiagMm = 43.27) {
        const cocM = (sensorDiagMm / 1500.0) / 1000.0;
        const f = focalLengthMm / 1000.0;
        const hfd = (f * f) / (apertureFNumber * cocM) + f;
        const s = nearDistanceM;
        const dNear = (s * (hfd - f)) / (hfd + s - 2 * f);
        const dFar = (s >= hfd) ? Infinity : (s * (hfd - f)) / (hfd - s);

        const shots = [nearDistanceM];
        let current = nearDistanceM;
        const maxD = (farDistanceM === Infinity) ? hfd : farDistanceM;
        let iter = 50;

        while (current < maxD && iter-- > 0) {
            const stepFar = (current >= hfd) ? Infinity : (current * (hfd - f)) / (hfd - current);
            if (stepFar === Infinity || stepFar > maxD) {
                if (!shots.includes(maxD)) shots.push(maxD);
                break;
            }
            const next = current + (stepFar - current) * 0.7;
            if (next <= current) break;
            current = next;
            shots.push(current);
        }

        return {
            hfd,
            nearFocus: dNear,
            farFocus: dFar,
            totalDof: (dFar === Infinity) ? Infinity : (dFar - dNear),
            recommendedShots: shots.length,
            shotDistances: shots
        };
    }

    static calculateNightExposure(focalLengthMm, apertureFNumber, pixelPitchMicrons = 4.2, decDeg = 0.0) {
        const r500 = 500.0 / Math.max(1.0, focalLengthMm);
        const decRad = Math.abs(decDeg) * Math.PI / 180.0;
        const cosDec = Math.max(0.1, Math.cos(decRad));
        const npf = (35.0 * apertureFNumber + 30.0 * pixelPitchMicrons) / (focalLengthMm * cosDec);
        return {
            rule500: r500,
            npfRule: npf,
            recommendedISO: focalLengthMm < 24 ? '3200 - 6400' : '1600 - 3200',
            shutterSpeedStr: `${npf.toFixed(1)}s`
        };
    }

    static calculateNdFilter(baseShutterSec, stops) {
        const adjusted = baseShutterSec * Math.pow(2, stops);
        let formatted = '';
        if (adjusted < 1.0) {
            const denom = Math.round(1.0 / adjusted);
            formatted = (denom <= 1) ? '1.0s' : `1/${denom}s`;
        } else if (adjusted < 60.0) {
            formatted = `${adjusted.toFixed(1)}s`;
        } else {
            const totalSec = Math.round(adjusted);
            const mins = Math.floor(totalSec / 60);
            const secs = totalSec % 60;
            formatted = (secs === 0) ? `${mins}m` : `${mins}m ${secs}s`;
        }
        return {
            adjustedSec: adjusted,
            formatted,
            bulbRequired: adjusted >= 30.0
        };
    }

    static calculateApparentSize(focalLengthMm, sensorHeightMm = 24.0, angularDiameterDeg = 0.53) {
        const rad = angularDiameterDeg * Math.PI / 180.0;
        const sizeMm = 2.0 * focalLengthMm * Math.tan(rad / 2.0);
        const percent = (sizeMm / sensorHeightMm) * 100.0;
        const targetMm = sensorHeightMm * 0.5;
        const reqFocal = targetMm / (2.0 * Math.tan(rad / 2.0));
        return { sizeMm, percent, reqFocalFor50Percent: reqFocal };
    }

    static calculateSunTerrain(sunAltitudeDeg, terrainHorizonAngleDeg) {
        const clearance = sunAltitudeDeg - terrainHorizonAngleDeg;
        return {
            isObstructed: clearance < 0,
            clearanceDeg: clearance
        };
    }

    static calculateDistanceBearing(lat1, lon1, lat2, lon2) {
        const earthR = 6371.0;
        const phi1 = lat1 * Math.PI / 180.0;
        const phi2 = lat2 * Math.PI / 180.0;
        const dPhi = (lat2 - lat1) * Math.PI / 180.0;
        const dLambda = (lon2 - lon1) * Math.PI / 180.0;

        const a = Math.max(0.0, Math.min(1.0, Math.sin(dPhi / 2.0) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2.0) ** 2));
        const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
        const distKm = earthR * c;
        const distMiles = distKm * 0.621371;

        const y = Math.sin(dLambda) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
        const theta = Math.atan2(y, x);
        const bearingDeg = (theta * 180.0 / Math.PI + 360.0) % 360.0;

        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
        const cardIdx = Math.floor((bearingDeg + 22.5) / 45.0) % 8;

        return {
            distKm,
            distMiles,
            bearingDeg,
            cardinal: directions[cardIdx]
        };
    }
}
