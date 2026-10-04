/**
 * Meteor Shower Catalog and Calculation Engine for Web
 */

export const MAJOR_METEOR_SHOWERS = [
    {
        id: 'quadrantids',
        name: 'Quadrantids',
        radiantRaDeg: 229.5,
        radiantDecDeg: 49.7,
        peakZhr: 120,
        peakMonth: 1,
        peakDay: 4,
        activeStartMonth: 12,
        activeStartDay: 28,
        activeEndMonth: 1,
        activeEndDay: 12,
        parentBody: '2003 EH1 (Asteroid)'
    },
    {
        id: 'lyrids',
        name: 'Lyrids',
        radiantRaDeg: 271.0,
        radiantDecDeg: 33.3,
        peakZhr: 18,
        peakMonth: 4,
        peakDay: 22,
        activeStartMonth: 4,
        activeStartDay: 14,
        activeEndMonth: 4,
        activeEndDay: 30,
        parentBody: 'C/1861 G1 Thatcher'
    },
    {
        id: 'eta_aquariids',
        name: 'Eta Aquariids',
        radiantRaDeg: 338.0,
        radiantDecDeg: -1.0,
        peakZhr: 50,
        peakMonth: 5,
        peakDay: 6,
        activeStartMonth: 4,
        activeStartDay: 19,
        activeEndMonth: 5,
        activeEndDay: 28,
        parentBody: '1P/Halley'
    },
    {
        id: 'delta_aquariids',
        name: 'Southern Delta Aquariids',
        radiantRaDeg: 340.0,
        radiantDecDeg: -16.3,
        peakZhr: 25,
        peakMonth: 7,
        peakDay: 30,
        activeStartMonth: 7,
        activeStartDay: 12,
        activeEndMonth: 8,
        activeEndDay: 23,
        parentBody: '96P/Machholz'
    },
    {
        id: 'perseids',
        name: 'Perseids',
        radiantRaDeg: 48.25,
        radiantDecDeg: 58.0,
        peakZhr: 100,
        peakMonth: 8,
        peakDay: 13,
        activeStartMonth: 7,
        activeStartDay: 17,
        activeEndMonth: 8,
        activeEndDay: 24,
        parentBody: '109P/Swift-Tuttle'
    },
    {
        id: 'draconids',
        name: 'Draconids',
        radiantRaDeg: 262.0,
        radiantDecDeg: 54.0,
        peakZhr: 10,
        peakMonth: 10,
        peakDay: 8,
        activeStartMonth: 10,
        activeStartDay: 6,
        activeEndMonth: 10,
        activeEndDay: 10,
        parentBody: '21P/Giacobini-Zinner'
    },
    {
        id: 'orionids',
        name: 'Orionids',
        radiantRaDeg: 95.0,
        radiantDecDeg: 15.6,
        peakZhr: 20,
        peakMonth: 10,
        peakDay: 21,
        activeStartMonth: 10,
        activeStartDay: 2,
        activeEndMonth: 11,
        activeEndDay: 7,
        parentBody: '1P/Halley'
    },
    {
        id: 'taurids_south',
        name: 'Southern Taurids',
        radiantRaDeg: 52.0,
        radiantDecDeg: 14.0,
        peakZhr: 5,
        peakMonth: 11,
        peakDay: 5,
        activeStartMonth: 9,
        activeStartDay: 10,
        activeEndMonth: 11,
        activeEndDay: 20,
        parentBody: '2P/Encke'
    },
    {
        id: 'taurids_north',
        name: 'Northern Taurids',
        radiantRaDeg: 58.0,
        radiantDecDeg: 22.0,
        peakZhr: 5,
        peakMonth: 11,
        peakDay: 12,
        activeStartMonth: 10,
        activeStartDay: 20,
        activeEndMonth: 12,
        activeEndDay: 10,
        parentBody: '2P/Encke'
    },
    {
        id: 'leonids',
        name: 'Leonids',
        radiantRaDeg: 153.0,
        radiantDecDeg: 21.6,
        peakZhr: 15,
        peakMonth: 11,
        peakDay: 17,
        activeStartMonth: 11,
        activeStartDay: 6,
        activeEndMonth: 11,
        activeEndDay: 30,
        parentBody: '55P/Tempel-Tuttle'
    },
    {
        id: 'geminids',
        name: 'Geminids',
        radiantRaDeg: 112.0,
        radiantDecDeg: 32.2,
        peakZhr: 150,
        peakMonth: 12,
        peakDay: 14,
        activeStartMonth: 12,
        activeStartDay: 4,
        activeEndMonth: 12,
        activeEndDay: 17,
        parentBody: '3200 Phaethon'
    },
    {
        id: 'ursids',
        name: 'Ursids',
        radiantRaDeg: 217.0,
        radiantDecDeg: 75.9,
        peakZhr: 10,
        peakMonth: 12,
        peakDay: 22,
        activeStartMonth: 12,
        activeStartDay: 17,
        activeEndMonth: 12,
        activeEndDay: 26,
        parentBody: '8P/Tuttle'
    }
];

export class MeteorShowerEngine {
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

    static isDateInWindow(month, day, startMonth, startDay, endMonth, endDay) {
        const getDoy = (m, d) => {
            const start = new Date(2024, 0, 1);
            const current = new Date(2024, m - 1, d);
            return Math.floor((current - start) / 86400000) + 1;
        };

        const currentDoy = getDoy(month, day);
        const startDoy = getDoy(startMonth, startDay);
        const endDoy = getDoy(endMonth, endDay);

        if (startDoy <= endDoy) {
            return currentDoy >= startDoy && currentDoy <= endDoy;
        } else {
            return currentDoy >= startDoy || currentDoy <= endDoy;
        }
    }

    static calculateAll(date, hour, minute, utcOffset, lat, lon, moonIlluminationFraction = 0.0) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const jd = this.getJulianDate(year, month, day, hour, minute, utcOffset);

        return MAJOR_METEOR_SHOWERS.map(shower => {
            const horiz = this.raDecToHorizontal(shower.radiantRaDeg, shower.radiantDecDeg, jd, lat, lon);
            const isAbove = horiz.altitude > 0;
            const isActive = this.isDateInWindow(month, day, shower.activeStartMonth, shower.activeStartDay, shower.activeEndMonth, shower.activeEndDay);
            const peakDate = new Date(year, shower.peakMonth - 1, shower.peakDay);
            const curDate = new Date(year, month - 1, day);
            const daysDiff = Math.abs(Math.round((curDate - peakDate) / 86400000));
            const isPeak = daysDiff <= 1;

            let visibleRate = 0;
            if (isAbove && isActive) {
                const altRad = horiz.altitude * Math.PI / 180.0;
                const moonDarknessFactor = 1.0 - (Math.max(0, Math.min(1, moonIlluminationFraction)) * 0.8);
                visibleRate = shower.peakZhr * Math.sin(altRad) * moonDarknessFactor;
                if (!isPeak) {
                    visibleRate *= 0.35;
                }
            }

            return {
                info: shower,
                radiantAzimuth: horiz.azimuth,
                radiantAltitude: horiz.altitude,
                isRadiantAboveHorizon: isAbove,
                isCurrentlyActive: isActive,
                isPeakToday: isPeak,
                estimatedVisibleRate: Math.max(0, visibleRate)
            };
        });
    }
}
