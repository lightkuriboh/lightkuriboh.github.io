/**
 * AstronomyEngine - High-precision JavaScript Astronomical Calculations
 * Compatible 1:1 with C++ LandscapeEngine (Jean Meeus & NOAA algorithms)
 */

export class AstronomyEngine {
    static PI = Math.PI;
    static RAD2DEG = 180.0 / Math.PI;
    static DEG2RAD = Math.PI / 180.0;
    static SYNODIC_MONTH = 29.530588853;

    static normalizeDegrees(deg) {
        deg = deg % 360.0;
        if (deg < 0.0) deg += 360.0;
        return deg;
    }

    static calculateJulianDate(year, month, day, hour, minute, second, utcOffsetHours = 0) {
        let totalHoursUtc = hour + (minute / 60.0) + (second / 3600.0) - utcOffsetHours;
        let y = year;
        let m = month;
        let d = day;

        while (totalHoursUtc >= 24.0) {
            totalHoursUtc -= 24.0;
            d += 1;
        }
        while (totalHoursUtc < 0.0) {
            totalHoursUtc += 24.0;
            d -= 1;
        }

        if (m <= 2) {
            y -= 1;
            m += 12;
        }

        const a = Math.floor(y / 100);
        const b = 2 - a + Math.floor(a / 4);
        let jd = Math.floor(365.25 * (y + 4716)) +
                 Math.floor(30.6001 * (m + 1)) +
                 d + b - 1524.5;
        jd += totalHoursUtc / 24.0;
        return jd;
    }

    static atmosphericRefraction(altDeg) {
        if (altDeg < -1.0) return 0.0;
        const h = Math.max(altDeg, -0.5);
        const rArcmin = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * this.DEG2RAD);
        return rArcmin / 60.0;
    }

    static calculateSunPosition(jd, lat, lon) {
        const T = (jd - 2451545.0) / 36525.0;

        const L0 = this.normalizeDegrees(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
        const M = this.normalizeDegrees(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
        const M_rad = M * this.DEG2RAD;

        const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M_rad) +
                  (0.019993 - 0.000101 * T) * Math.sin(2.0 * M_rad) +
                  0.000289 * Math.sin(3.0 * M_rad);

        const sunTrueLon = L0 + C;
        const trueAnomaly = M + C;

        const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
        const R = (1.000001018 * (1.0 - e * e)) / (1.0 + e * Math.cos(trueAnomaly * this.DEG2RAD));

        const omega = 125.04 - 1934.136 * T;
        const lambda = sunTrueLon - 0.00569 - 0.00478 * Math.sin(omega * this.DEG2RAD);

        const eps0 = 23.439291 - 0.0130042 * T - 0.00000016 * T * T + 0.000000504 * T * T * T;
        const eps = eps0 + 0.00256 * Math.cos(omega * this.DEG2RAD);

        const eps_rad = eps * this.DEG2RAD;
        const lambda_rad = lambda * this.DEG2RAD;

        const sin_delta = Math.sin(eps_rad) * Math.sin(lambda_rad);
        const delta = Math.asin(sin_delta);
        const alpha = Math.atan2(Math.cos(eps_rad) * Math.sin(lambda_rad), Math.cos(lambda_rad));

        const gmst = this.normalizeDegrees(280.46061837 + 360.98564736629 * (jd - 2451545.0) +
                     0.000387933 * T * T - (T * T * T) / 38710000.0);
        const lst = this.normalizeDegrees(gmst + lon);
        const lst_rad = lst * this.DEG2RAD;

        const H = lst_rad - alpha;
        const phi = lat * this.DEG2RAD;

        const sin_alt = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H);
        const alt = Math.asin(Math.max(-1.0, Math.min(1.0, sin_alt)));

        const y = -Math.cos(delta) * Math.sin(H);
        const x = Math.sin(delta) * Math.cos(phi) - Math.cos(delta) * Math.sin(phi) * Math.cos(H);
        const az = Math.atan2(y, x);

        const az_deg = this.normalizeDegrees(az * this.RAD2DEG);
        const alt_deg = alt * this.RAD2DEG;
        const visual_alt = alt_deg + this.atmosphericRefraction(alt_deg);

        return {
            azimuth: az_deg,
            altitude: visual_alt,
            trueAltitude: alt_deg,
            distanceAU: R,
            rightAscension: this.normalizeDegrees(alpha * this.RAD2DEG),
            declination: delta * this.RAD2DEG,
            isAboveHorizon: visual_alt > -0.833
        };
    }

    static calculateMoonPosition(jd, lat, lon) {
        const d = jd - 2451543.5;

        const N = this.normalizeDegrees(125.1228 - 0.0529538083 * d);
        const i = 5.1454;
        const w = this.normalizeDegrees(318.0634 + 0.1643573223 * d);
        const a = 60.2666;
        const e = 0.054900;
        const M = this.normalizeDegrees(115.3654 + 13.0649929509 * d);

        const w_s = this.normalizeDegrees(282.9404 + 4.70935e-5 * d);
        const M_s = this.normalizeDegrees(356.0470 + 0.9856002585 * d);
        const L_s = this.normalizeDegrees(M_s + w_s);

        const L_m = this.normalizeDegrees(M + w + N);
        const D = this.normalizeDegrees(L_m - L_s);
        const F = this.normalizeDegrees(L_m - N);

        const M_rad = M * this.DEG2RAD;
        let E = M + this.RAD2DEG * e * Math.sin(M_rad) * (1.0 + e * Math.cos(M_rad));
        for (let iter = 0; iter < 3; ++iter) {
            const E_rad = E * this.DEG2RAD;
            E = E - (E - this.RAD2DEG * e * Math.sin(E_rad) - M) / (1.0 - e * Math.cos(E_rad));
        }
        const E_rad = E * this.DEG2RAD;

        const xv = a * (Math.cos(E_rad) - e);
        const yv = a * (Math.sqrt(1.0 - e * e) * Math.sin(E_rad));

        const v = Math.atan2(yv, xv) * this.RAD2DEG;
        let r = Math.hypot(xv, yv);

        const v_rad = v * this.DEG2RAD;
        const w_rad = w * this.DEG2RAD;
        const N_rad = N * this.DEG2RAD;
        const i_rad = i * this.DEG2RAD;

        const xh = r * (Math.cos(N_rad) * Math.cos(v_rad + w_rad) - Math.sin(N_rad) * Math.sin(v_rad + w_rad) * Math.cos(i_rad));
        const yh = r * (Math.sin(N_rad) * Math.cos(v_rad + w_rad) + Math.cos(N_rad) * Math.sin(v_rad + w_rad) * Math.cos(i_rad));
        const zh = r * (Math.sin(v_rad + w_rad) * Math.sin(i_rad));

        let lonecl = Math.atan2(yh, xh) * this.RAD2DEG;
        let latecl = Math.atan2(zh, Math.hypot(xh, yh)) * this.RAD2DEG;

        const D_rad = D * this.DEG2RAD;
        const Ms_rad = M_s * this.DEG2RAD;
        const F_rad = F * this.DEG2RAD;

        lonecl += -1.274 * Math.sin(M_rad - 2.0 * D_rad)
                  + 0.658 * Math.sin(2.0 * D_rad)
                  - 0.186 * Math.sin(Ms_rad)
                  - 0.059 * Math.sin(2.0 * M_rad - 2.0 * D_rad)
                  - 0.057 * Math.sin(M_rad - 2.0 * D_rad + Ms_rad)
                  + 0.053 * Math.sin(M_rad + 2.0 * D_rad)
                  + 0.046 * Math.sin(2.0 * D_rad - Ms_rad)
                  + 0.041 * Math.sin(M_rad - Ms_rad)
                  - 0.035 * Math.sin(D_rad)
                  - 0.031 * Math.sin(M_rad + Ms_rad);

        latecl += -0.173 * Math.sin(F_rad - 2.0 * D_rad)
                  - 0.055 * Math.sin(M_rad - F_rad - 2.0 * D_rad)
                  - 0.046 * Math.sin(M_rad + F_rad - 2.0 * D_rad)
                  + 0.033 * Math.sin(F_rad + 2.0 * D_rad)
                  + 0.017 * Math.sin(2.0 * M_rad + F_rad);

        r += -0.58 * Math.cos(M_rad - 2.0 * D_rad)
             - 0.46 * Math.cos(2.0 * D_rad);

        const eps = 23.4393 - 3.563e-7 * d;
        const eps_rad = eps * this.DEG2RAD;
        const lon_rad = lonecl * this.DEG2RAD;
        const lat_rad = latecl * this.DEG2RAD;

        const xg = r * Math.cos(lon_rad) * Math.cos(lat_rad);
        const yg = r * (Math.sin(lon_rad) * Math.cos(lat_rad) * Math.cos(eps_rad) - Math.sin(lat_rad) * Math.sin(eps_rad));
        const zg = r * (Math.sin(lon_rad) * Math.cos(lat_rad) * Math.sin(eps_rad) + Math.sin(lat_rad) * Math.cos(eps_rad));

        const ra = this.normalizeDegrees(Math.atan2(yg, xg) * this.RAD2DEG);
        const dec = Math.atan2(zg, Math.hypot(xg, yg)) * this.RAD2DEG;

        // Topocentric parallax correction
        const T = (jd - 2451545.0) / 36525.0;
        const gmst = this.normalizeDegrees(280.46061837 + 360.98564736629 * (jd - 2451545.0) +
                                           0.000387933 * T * T - (T * T * T) / 38710000.0);
        const lst = this.normalizeDegrees(gmst + lon);
        const H = (lst - ra) * this.DEG2RAD;

        const phi = lat * this.DEG2RAD;
        const dec_rad = dec * this.DEG2RAD;

        const mpar = Math.asin(1.0 / r) * this.RAD2DEG;
        const g = Math.atan(Math.tan(phi) / Math.cos(H)) * this.RAD2DEG;
        const topdec = dec_rad - (mpar * Math.sin((g - dec) * this.DEG2RAD) / Math.sin(g * this.DEG2RAD)) * this.DEG2RAD;
        const topra = (ra * this.DEG2RAD) - (mpar * Math.cos(phi) * Math.sin(H) / Math.cos(dec_rad)) * this.DEG2RAD;
        const topH = (lst * this.DEG2RAD) - topra;

        const sin_alt = Math.sin(phi) * Math.sin(topdec) + Math.cos(phi) * Math.cos(topdec) * Math.cos(topH);
        const alt = Math.asin(Math.max(-1.0, Math.min(1.0, sin_alt)));

        const y_az = -Math.cos(topdec) * Math.sin(topH);
        const x_az = Math.sin(topdec) * Math.cos(phi) - Math.cos(topdec) * Math.sin(phi) * Math.cos(topH);
        const az = Math.atan2(y_az, x_az);

        const az_deg = this.normalizeDegrees(az * this.RAD2DEG);
        const alt_deg = alt * this.RAD2DEG;
        const visual_alt = alt_deg + this.atmosphericRefraction(alt_deg);

        return {
            azimuth: az_deg,
            altitude: visual_alt,
            trueAltitude: alt_deg,
            distanceKm: r * 6378.137,
            rightAscension: this.normalizeDegrees(topra * this.RAD2DEG),
            declination: topdec * this.RAD2DEG,
            isAboveHorizon: visual_alt > -0.583
        };
    }

    static calculateMoonPhase(jd) {
        const knownNewMoon = 2451549.25972;
        const daysSince = jd - knownNewMoon;
        const cycles = daysSince / this.SYNODIC_MONTH;
        const currentPhaseFraction = cycles - Math.floor(cycles);
        const ageDays = currentPhaseFraction * this.SYNODIC_MONTH;

        const phaseAngleRad = currentPhaseFraction * 2.0 * Math.PI;
        const illumination = (1.0 - Math.cos(phaseAngleRad)) / 2.0;

        let daysToFullMoon = (currentPhaseFraction < 0.5) 
            ? (0.5 - currentPhaseFraction) * this.SYNODIC_MONTH
            : (1.5 - currentPhaseFraction) * this.SYNODIC_MONTH;
        let daysToNewMoon = (1.0 - currentPhaseFraction) * this.SYNODIC_MONTH;

        const phaseIndex = currentPhaseFraction * 8.0;
        let phaseType = 0;
        let name = "New Moon";
        let icon = "🌑";

        if (phaseIndex < 0.5 || phaseIndex >= 7.5) {
            phaseType = 0; name = "New Moon"; icon = "🌑";
        } else if (phaseIndex < 1.5) {
            phaseType = 1; name = "Waxing Crescent"; icon = "🌒";
        } else if (phaseIndex < 2.5) {
            phaseType = 2; name = "First Quarter"; icon = "🌓";
        } else if (phaseIndex < 3.5) {
            phaseType = 3; name = "Waxing Gibbous"; icon = "🌔";
        } else if (phaseIndex < 4.5) {
            phaseType = 4; name = "Full Moon"; icon = "🌕";
        } else if (phaseIndex < 5.5) {
            phaseType = 5; name = "Waning Gibbous"; icon = "🌖";
        } else if (phaseIndex < 6.5) {
            phaseType = 6; name = "Third Quarter"; icon = "🌗";
        } else {
            phaseType = 7; name = "Waning Crescent"; icon = "🌘";
        }

        return {
            phaseType,
            name,
            icon,
            illuminationFraction: Math.max(0.0, Math.min(1.0, illumination)),
            illuminationPercent: Math.round(illumination * 100),
            ageDays: Math.round(ageDays * 10) / 10,
            phaseFraction: currentPhaseFraction,
            daysToFullMoon: Math.round(daysToFullMoon * 10) / 10,
            daysToNewMoon: Math.round(daysToNewMoon * 10) / 10
        };
    }

    static formatTime(hoursLocal) {
        if (hoursLocal === null || isNaN(hoursLocal)) return "--:--";
        let h = Math.floor(hoursLocal);
        let m = Math.floor((hoursLocal - h) * 60);
        if (m >= 60) { m = 0; h = (h + 1) % 24; }
        while (h < 0) h += 24;
        h = h % 24;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    static calculateSolarTimes(year, month, day, utcOffset, lat, lon) {
        const jdNoon = this.calculateJulianDate(year, month, day, 12, 0, 0, utcOffset);
        const T = (jdNoon - 2451545.0) / 36525.0;

        const L0 = this.normalizeDegrees(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
        const M = this.normalizeDegrees(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
        const e = 0.016708634 - 0.000042037 * T;
        let yVal = Math.tan((23.439291 / 2.0) * this.DEG2RAD);
        yVal *= yVal;

        const M_rad = M * this.DEG2RAD;
        const L0_rad = L0 * this.DEG2RAD;

        const eqTime = 4.0 * this.RAD2DEG * (yVal * Math.sin(2.0 * L0_rad) -
                                            2.0 * e * Math.sin(M_rad) +
                                            4.0 * e * yVal * Math.sin(M_rad) * Math.cos(2.0 * L0_rad) -
                                            0.5 * yVal * yVal * Math.sin(4.0 * L0_rad) -
                                            1.25 * e * e * Math.sin(2.0 * M_rad));

        let solarNoonHours = 12.0 - (lon / 15.0) + utcOffset - (eqTime / 60.0);
        while (solarNoonHours < 0.0) solarNoonHours += 24.0;
        while (solarNoonHours >= 24.0) solarNoonHours -= 24.0;

        const C = (1.914602 - 0.004817 * T) * Math.sin(M_rad) + 0.019993 * Math.sin(2.0 * M_rad);
        const lambda = L0 + C;
        const eps = 23.439291 - 0.0130042 * T;
        const deltaRad = Math.asin(Math.sin(eps * this.DEG2RAD) * Math.sin(lambda * this.DEG2RAD));
        const phiRad = lat * this.DEG2RAD;

        const maxAlt = Math.asin(Math.sin(phiRad) * Math.sin(deltaRad) +
                                 Math.cos(phiRad) * Math.cos(deltaRad)) * this.RAD2DEG;

        const calcEvent = (targetAltDeg) => {
            const h0 = targetAltDeg * this.DEG2RAD;
            const cosH0 = (Math.sin(h0) - Math.sin(phiRad) * Math.sin(deltaRad)) /
                          (Math.cos(phiRad) * Math.cos(deltaRad));
            if (cosH0 > 1.0 || cosH0 < -1.0) {
                return { valid: false, rise: null, set: null };
            }
            const H0_deg = Math.acos(cosH0) * this.RAD2DEG;
            const deltaH = H0_deg / 15.0;
            return {
                valid: true,
                rise: (solarNoonHours - deltaH + 24.0) % 24.0,
                set: (solarNoonHours + deltaH + 24.0) % 24.0
            };
        };

        const standard = calcEvent(-0.833);
        const goldenMin = calcEvent(-4.0);
        const goldenMax = calcEvent(6.0);
        const civil = calcEvent(-6.0);
        const nautical = calcEvent(-12.0);
        const astro = calcEvent(-18.0);

        let dayLengthHours = 0;
        if (standard.valid) {
            dayLengthHours = standard.set - standard.rise;
            if (dayLengthHours < 0) dayLengthHours += 24;
        } else {
            dayLengthHours = (maxAlt > -0.833) ? 24.0 : 0.0;
        }

        return {
            solarNoon: this.formatTime(solarNoonHours),
            solarNoonAltitude: Math.round(maxAlt * 10) / 10,
            sunrise: this.formatTime(standard.rise),
            sunset: this.formatTime(standard.set),
            dayLengthHours: Math.round(dayLengthHours * 10) / 10,

            // Golden Hour photography slots
            goldenHourMorning: {
                start: this.formatTime(goldenMin.rise),
                end: this.formatTime(goldenMax.rise),
                valid: goldenMin.valid && goldenMax.valid
            },
            goldenHourEvening: {
                start: this.formatTime(goldenMax.set),
                end: this.formatTime(goldenMin.set),
                valid: goldenMin.valid && goldenMax.valid
            },

            // Blue Hour photography slots
            blueHourMorning: {
                start: this.formatTime(civil.rise),
                end: this.formatTime(goldenMin.rise),
                valid: civil.valid && goldenMin.valid
            },
            blueHourEvening: {
                start: this.formatTime(goldenMin.set),
                end: this.formatTime(civil.set),
                valid: civil.valid && goldenMin.valid
            },

            // Twilights
            civilDawn: this.formatTime(civil.rise),
            civilDusk: this.formatTime(civil.set),
            nauticalDawn: this.formatTime(nautical.rise),
            nauticalDusk: this.formatTime(nautical.set),
            astroDawn: this.formatTime(astro.rise),
            astroDusk: this.formatTime(astro.set),
        };
    }

    static calculateLunarTimes(year, month, day, utcOffset, lat, lon) {
        const SAMPLES = 48;
        const alts = [];
        const hours = [];
        let maxAlt = -999.0;
        let maxAltHour = 12.0;

        for (let i = 0; i <= SAMPLES; ++i) {
            const h = i * (24.0 / SAMPLES);
            hours.push(h);
            const jd = this.calculateJulianDate(year, month, day, 0, 0, 0, utcOffset) + h / 24.0;
            const mpos = this.calculateMoonPosition(jd, lat, lon);
            alts.push(mpos.altitude);

            if (mpos.altitude > maxAlt) {
                maxAlt = mpos.altitude;
                maxAltHour = h;
            }
        }

        const MOON_HORIZON = -0.583;
        let riseHour = null;
        let setHour = null;

        for (let i = 0; i < SAMPLES; ++i) {
            const y1 = alts[i] - MOON_HORIZON;
            const y2 = alts[i + 1] - MOON_HORIZON;

            if (y1 * y2 <= 0.0) {
                const fraction = -y1 / (y2 - y1);
                const crossH = hours[i] + fraction * (hours[i + 1] - hours[i]);

                if (y1 < 0.0 && y2 >= 0.0 && riseHour === null) {
                    riseHour = crossH;
                } else if (y1 >= 0.0 && y2 < 0.0 && setHour === null) {
                    setHour = crossH;
                }
            }
        }

        return {
            moonrise: this.formatTime(riseHour),
            moonset: this.formatTime(setHour),
            transit: this.formatTime(maxAltHour),
            transitAltitude: Math.round(maxAlt * 10) / 10,
            alwaysUp: riseHour === null && setHour === null && alts[0] > MOON_HORIZON,
            alwaysDown: riseHour === null && setHour === null && alts[0] <= MOON_HORIZON
        };
    }

    static calculateSunTrajectory(year, month, day, utcOffset, lat, lon, stepMins = 15) {
        const points = [];
        const total = 24 * 60;
        for (let m = 0; m <= total; m += stepMins) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const jd = this.calculateJulianDate(year, month, day, h, min, 0, utcOffset);
            const pos = this.calculateSunPosition(jd, lat, lon);
            points.push({
                hour: h,
                minute: min,
                timeStr: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
                fractionOfDay: m / total,
                azimuth: pos.azimuth,
                altitude: pos.altitude,
                isAboveHorizon: pos.isAboveHorizon
            });
        }
        return points;
    }

    static calculateMoonTrajectory(year, month, day, utcOffset, lat, lon, stepMins = 15) {
        const points = [];
        const total = 24 * 60;
        for (let m = 0; m <= total; m += stepMins) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const jd = this.calculateJulianDate(year, month, day, h, min, 0, utcOffset);
            const pos = this.calculateMoonPosition(jd, lat, lon);
            points.push({
                hour: h,
                minute: min,
                timeStr: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
                fractionOfDay: m / total,
                azimuth: pos.azimuth,
                altitude: pos.altitude,
                isAboveHorizon: pos.isAboveHorizon
            });
        }
        return points;
    }

    static getPhotographyTip(sunAlt, moonIllum, moonUp) {
        if (sunAlt >= -4.0 && sunAlt <= 6.0) {
            return {
                title: "✨ Prime Golden Hour",
                desc: "Warm directional amber rays with soft, long cinematic shadows. Perfect for landscape panoramas and back-lit portraits."
            };
        } else if (sunAlt >= -6.0 && sunAlt < -4.0) {
            return {
                title: "🌌 Magic Blue Hour",
                desc: "Vibrant saturated indigo sky balancing electric artificial city lights and silky long exposures of moving water."
            };
        } else if (sunAlt > 6.0 && sunAlt < 20.0) {
            return {
                title: "🌤️ Warm Low Sun",
                desc: "Gentle natural contrast and rich textures before midday harshness. Great for mountain ridges and coastal cliffs."
            };
        } else if (sunAlt >= 20.0) {
            return {
                title: "☀️ Overhead Harsh Sun",
                desc: "High dynamic range with deep shadows. Recommended: use Circular Polarizers (CPL) to cut water glare or 6-10 stop ND filters."
            };
        } else if (moonUp && moonIllum > 0.65) {
            return {
                title: "🌕 Moonlit Landscape",
                desc: "The bright moon illuminates foreground mountains, sand dunes, and lakes. Fast shutter (f/2.8, ISO 800) yields crisp nightscapes."
            };
        } else {
            return {
                title: "✨ Dark Sky Astrophotography",
                desc: "Dark moonless skies provide optimal contrast for capturing the Milky Way core, meteors, and pinpoint star fields."
            };
        }
    }
}
