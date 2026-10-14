/**
 * comets.js - Observable & Periodic Comets Ephemeris Catalog
 */

export const COMETS_CATALOG = [
    {
        id: 'c2023_a3',
        name: 'C/2023 A3 (Tsuchinshan-ATLAS)',
        type: 'Non-periodic / Oort Cloud',
        perihelionDate: '2024-09-27',
        perihelionDistAu: 0.39,
        peakMagnitude: 1.5,
        constellation: 'Serpens / Ophiuchus',
        observabilityWindow: 'Evening twilight post-sunset',
        notes: 'Spectacular forward-scattering dust tail and anti-tail structure.',
        raDeg: 232.5,
        decDeg: 2.1
    },
    {
        id: '12p_pons_brooks',
        name: '12P/Pons-Brooks',
        type: 'Halley-type Periodic (71 yr)',
        perihelionDate: '2024-04-21',
        perihelionDistAu: 0.78,
        peakMagnitude: 4.2,
        constellation: 'Aries / Taurus',
        observabilityWindow: 'Early spring dusk',
        notes: 'Famous "Devil Comet" known for explosive cryovolcanic outbursts.',
        raDeg: 46.8,
        decDeg: 18.5
    },
    {
        id: '1p_halley',
        name: '1P/Halley',
        type: 'Periodic (76 yr)',
        perihelionDate: '2061-07-28',
        perihelionDistAu: 0.59,
        peakMagnitude: 0.5,
        constellation: 'Hydra / Canis Major',
        observabilityWindow: 'Historic return 2061',
        notes: 'Parent comet of Orionids and Eta Aquariids meteor showers.',
        raDeg: 125.0,
        decDeg: -15.0
    },
    {
        id: 'c2020_f3',
        name: 'C/2020 F3 (NEOWISE)',
        type: 'Long-period (6,800 yr)',
        perihelionDate: '2020-07-03',
        perihelionDistAu: 0.29,
        peakMagnitude: 1.0,
        constellation: 'Ursa Major',
        observabilityWindow: 'Northern summer twilight',
        notes: 'Pristine twin ion and curved dust tails visible to naked eye.',
        raDeg: 155.2,
        decDeg: 41.5
    }
];

export class CometEngine {
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

    static calculateAll(date, hour, minute, utcOffset, lat, lon) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const jd = this.getJulianDate(year, month, day, hour, minute, utcOffset);

        return COMETS_CATALOG.map(comet => {
            const horiz = this.raDecToHorizontal(comet.raDeg, comet.decDeg, jd, lat, lon);
            return {
                info: comet,
                azimuth: horiz.azimuth,
                altitude: horiz.altitude,
                isAboveHorizon: horiz.altitude > 0
            };
        });
    }
}
