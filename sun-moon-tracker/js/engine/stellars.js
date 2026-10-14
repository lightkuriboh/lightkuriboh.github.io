/**
 * stellars.js - Bright Photographic & Navigational Stars Catalog & Ephemeris Engine
 */

export const BRIGHT_STARS_CATALOG = [
    {
        id: 'sirius',
        name: 'Sirius (Alpha Canis Majoris)',
        constellation: 'Canis Major',
        raHours: 6.752,
        decDeg: -16.716,
        magnitude: -1.46,
        description: 'Brightest star in Earth\'s night sky; primary vertex of the Winter Triangle.'
    },
    {
        id: 'betelgeuse',
        name: 'Betelgeuse (Alpha Orionis)',
        constellation: 'Orion',
        raHours: 5.919,
        decDeg: 7.407,
        magnitude: 0.50,
        description: 'Red supergiant marking Orion\'s eastern shoulder; pulsating variable.'
    },
    {
        id: 'rigel',
        name: 'Rigel (Beta Orionis)',
        constellation: 'Orion',
        raHours: 5.242,
        decDeg: -8.201,
        magnitude: 0.13,
        description: 'Luminous blue supergiant opposing Betelgeuse in Orion.'
    },
    {
        id: 'polaris',
        name: 'Polaris (North Star)',
        constellation: 'Ursa Minor',
        raHours: 2.530,
        decDeg: 89.264,
        magnitude: 1.98,
        description: 'Northern pole star aligning almost directly with Earth\'s rotation axis.'
    },
    {
        id: 'vega',
        name: 'Vega (Alpha Lyrae)',
        constellation: 'Lyra',
        raHours: 18.615,
        decDeg: 38.783,
        magnitude: 0.03,
        description: 'Brilliant sapphire-blue vertex of the Summer Triangle.'
    },
    {
        id: 'antares',
        name: 'Antares (Alpha Scorpii)',
        constellation: 'Scorpius',
        raHours: 16.490,
        decDeg: -26.432,
        magnitude: 0.96,
        description: 'Heart of the Scorpion; deep crimson beacon near the Milky Way Galactic Core.'
    }
];

export class StellarEngine {
    static getJulianDate(year, month, day, hour, minute, utcOffset) {
        let y = year;
        let m = month;
        if (m <= 2) {
            y -= 1;
            m += 12;
        }
        const a = Math.floor(y / 100);
        const b = 2 - a + Math.floor(a / 4);
        const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
        return jd + (hour + minute / 60.0 - utcOffset) / 24.0;
    }

    static raHoursToDeg(raHours) {
        return (raHours * 15.0) % 360.0;
    }

    static raDecToHorizontal(raDeg, decDeg, jd, latDeg, lonDeg) {
        const alphaRad = raDeg * Math.PI / 180.0;
        const deltaRad = decDeg * Math.PI / 180.0;
        const phiRad = latDeg * Math.PI / 180.0;

        const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360.0;
        const lstRad = (gmst + lonDeg) * Math.PI / 180.0;
        const hourAngle = lstRad - alphaRad;

        const sinAlt = Math.sin(phiRad) * Math.sin(deltaRad) + Math.cos(phiRad) * Math.cos(deltaRad) * Math.cos(hourAngle);
        const altDeg = Math.asin(Math.max(-1.0, Math.min(1.0, sinAlt))) * 180.0 / Math.PI;

        const y = -Math.cos(deltaRad) * Math.sin(hourAngle);
        const x = Math.sin(deltaRad) * Math.cos(phiRad) - Math.cos(deltaRad) * Math.sin(phiRad) * Math.cos(hourAngle);
        let azDeg = (Math.atan2(y, x) * 180.0 / Math.PI) % 360.0;
        if (azDeg < 0) azDeg += 360.0;

        return { azimuth: azDeg, altitude: altDeg };
    }

    static calculateAll(date, hour, minute, utcOffset, lat, lon) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const jd = this.getJulianDate(year, month, day, hour, minute, utcOffset);

        return BRIGHT_STARS_CATALOG.map(star => {
            const raDeg = this.raHoursToDeg(star.raHours);
            const horiz = this.raDecToHorizontal(raDeg, star.decDeg, jd, lat, lon);
            return {
                info: star,
                azimuth: horiz.azimuth,
                altitude: horiz.altitude,
                isAboveHorizon: horiz.altitude > 0
            };
        });
    }
}
