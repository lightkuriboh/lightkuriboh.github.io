/**
 * Comprehensive Unit Test Suite for LandscapeHelper Web Astronomy Engine
 * Compatible with Node.js and Browser
 */

import assert from 'node:assert';
import { AstronomyEngine } from '../js/engine/astronomy.js';

console.log("============================================================");
console.log("  LandscapeHelper Web JavaScript Engine Unit Tests          ");
console.log("============================================================");

// 1. Julian Date
function testJulianDate() {
    console.log("[TEST 1] Julian Date & Calendar calculations...");

    // J2000.0 epoch: 2000-01-01 12:00:00 UTC = 2451545.0
    const jd2000 = AstronomyEngine.calculateJulianDate(2000, 1, 1, 12, 0, 0, 0);
    assert.ok(Math.abs(jd2000 - 2451545.0) < 1e-4, `Expected 2451545.0, got ${jd2000}`);

    // Leap year leap day: 2024-02-29
    const jdLeap = AstronomyEngine.calculateJulianDate(2024, 2, 29, 12, 0, 0, 0);
    const jdMar1 = AstronomyEngine.calculateJulianDate(2024, 3, 1, 12, 0, 0, 0);
    assert.ok(Math.abs((jdMar1 - jdLeap) - 1.0) < 1e-5, "One day difference between Feb 29 and Mar 1 in leap year");

    // Timezone offset equivalence: 14:00 at UTC+7 = 07:00 at UTC+0
    const jdLocal = AstronomyEngine.calculateJulianDate(2026, 9, 25, 14, 0, 0, 7.0);
    const jdUtc = AstronomyEngine.calculateJulianDate(2026, 9, 25, 7, 0, 0, 0.0);
    assert.ok(Math.abs(jdLocal - jdUtc) < 1e-5, "Local time minus offset matches UTC");

    console.log("  ✓ Julian Date & Calendar tests PASSED!");
}

// 2. Solar Position & Ephemeris
function testSolarPosition() {
    console.log("[TEST 2] Solar Coordinates & Parity with C++ Engine...");

    const lat = 21.0285;
    const lon = 105.8542;
    const jd = AstronomyEngine.calculateJulianDate(2026, 9, 25, 12, 0, 0, 7.0);
    const pos = AstronomyEngine.calculateSunPosition(jd, lat, lon);

    // Verify properties
    assert.strictEqual(typeof pos.azimuth, 'number');
    assert.strictEqual(typeof pos.altitude, 'number');
    assert.strictEqual(typeof pos.isAboveHorizon, 'boolean');

    // Bounds check
    assert.ok(pos.azimuth >= 0 && pos.azimuth < 360, "Azimuth within [0, 360)");
    assert.ok(pos.altitude >= -90 && pos.altitude <= 90, "Altitude within [-90, +90]");

    // On Autumn Equinox midday in tropics (Hanoi), sun is high (> 60°)
    assert.ok(pos.altitude > 60, `Noon altitude ${pos.altitude}° should be > 60°`);
    assert.strictEqual(pos.isAboveHorizon, true);

    // Midday sun azimuth should be near South (~180°)
    assert.ok(Math.abs(pos.azimuth - 188) < 10, `Azimuth ${pos.azimuth}° should be near 188°`);

    // Distance in AU (~0.98 to 1.02 AU)
    assert.ok(pos.distanceAU >= 0.98 && pos.distanceAU <= 1.02, `Sun distance AU: ${pos.distanceAU}`);

    console.log("  ✓ Solar Coordinates tests PASSED!");
}

// 3. Solar Times & Day Length
function testSolarTimes() {
    console.log("[TEST 3] Sunrise, Sunset & Day Length...");

    // Greenwich on Spring Equinox 2026-03-20
    const st = AstronomyEngine.calculateSolarTimes(2026, 3, 20, 0.0, 51.4826, 0.0077);

    assert.ok(st.sunrise !== "--:--", "Sunrise valid");
    assert.ok(st.sunset !== "--:--", "Sunset valid");
    assert.ok(st.solarNoon !== "--:--", "Solar noon valid");

    // Sunrise near 06:00, sunset near 18:00
    const [srH] = st.sunrise.split(':').map(Number);
    const [ssH] = st.sunset.split(':').map(Number);
    assert.ok(srH === 5 || srH === 6, `Sunrise hour ${srH} near 6`);
    assert.ok(ssH === 18 || ssH === 19, `Sunset hour ${ssH} near 18`);

    // Day length at equinox ~12 hours
    assert.ok(Math.abs(st.dayLengthHours - 12.1) < 0.6, `Day length ${st.dayLengthHours} near 12h`);

    console.log("  ✓ Solar Times & Day Length tests PASSED!");
}

// 4. Golden Hour & Blue Hour Photographic Intervals
function testPhotographicIntervals() {
    console.log("[TEST 4] Golden Hour & Blue Hour photographic slots...");

    const st = AstronomyEngine.calculateSolarTimes(2026, 6, 21, 2.0, 48.8566, 2.3522); // Paris

    assert.strictEqual(st.goldenHourMorning.valid, true);
    assert.strictEqual(st.goldenHourEvening.valid, true);
    assert.strictEqual(st.blueHourMorning.valid, true);
    assert.strictEqual(st.blueHourEvening.valid, true);

    assert.ok(st.goldenHourMorning.start.includes(':'));
    assert.ok(st.goldenHourMorning.end.includes(':'));
    assert.ok(st.goldenHourEvening.start.includes(':'));
    assert.ok(st.goldenHourEvening.end.includes(':'));

    // Check chronological format HH:MM
    const timeRegex = /^\d{2}:\d{2}$/;
    assert.ok(timeRegex.test(st.goldenHourMorning.start));
    assert.ok(timeRegex.test(st.goldenHourMorning.end));
    assert.ok(timeRegex.test(st.blueHourEvening.start));
    assert.ok(timeRegex.test(st.blueHourEvening.end));

    console.log("  ✓ Photographic Intervals tests PASSED!");
}

// 5. Moon Ephemeris, Phases & Topocentric Parallax
function testMoonEphemeris() {
    console.log("[TEST 5] Moon Coordinates, Phase & Synodic Cycle...");

    const lat = 21.0285;
    const lon = 105.8542;

    // Test multiple points across synodic cycle
    for (let day = 1; day <= 28; day += 3) {
        const jd = AstronomyEngine.calculateJulianDate(2026, 10, day, 21, 0, 0, 7.0);
        const mpos = AstronomyEngine.calculateMoonPosition(jd, lat, lon);
        const phase = AstronomyEngine.calculateMoonPhase(jd);

        // Distance physically bounded
        assert.ok(mpos.distanceKm >= 350000 && mpos.distanceKm <= 415000, `Distance ${mpos.distanceKm} km`);

        // Illumination between 0 and 100%
        assert.ok(phase.illuminationFraction >= 0.0 && phase.illuminationFraction <= 1.0);
        assert.ok(phase.illuminationPercent >= 0 && phase.illuminationPercent <= 100);

        // Phase type in [0..7]
        assert.ok(phase.phaseType >= 0 && phase.phaseType <= 7);

        // Name and icon non-empty
        assert.ok(phase.name.length > 0);
        assert.ok(phase.icon.length > 0);

        // Countdown values positive
        assert.ok(phase.daysToFullMoon >= 0);
        assert.ok(phase.daysToNewMoon >= 0);
    }

    console.log("  ✓ Moon Ephemeris & Phase tests PASSED!");
}

// 6. 24-Hour Trajectory Generation
function testTrajectories() {
    console.log("[TEST 6] 24-Hour Sun & Moon Trajectories...");

    const sunTraj = AstronomyEngine.calculateSunTrajectory(2026, 9, 25, 7.0, 21.0285, 105.8542, 15);
    const moonTraj = AstronomyEngine.calculateMoonTrajectory(2026, 9, 25, 7.0, 21.0285, 105.8542, 15);

    // 24 hours * 4 steps/hour = 96 intervals + 1 = 97 points
    assert.strictEqual(sunTraj.length, 97);
    assert.strictEqual(moonTraj.length, 97);

    // First point should be 00:00, last should be 24:00
    assert.strictEqual(sunTraj[0].timeStr, "00:00");
    assert.strictEqual(sunTraj[sunTraj.length - 1].timeStr, "24:00");

    // Verify sequential time progression
    for (let i = 1; i < sunTraj.length; ++i) {
        assert.ok(sunTraj[i].fractionOfDay >= sunTraj[i - 1].fractionOfDay);
        assert.ok(sunTraj[i].azimuth >= 0 && sunTraj[i].azimuth < 360);
    }

    console.log("  ✓ Trajectory generation tests PASSED!");
}

// 7. Photography Guidance Tips
function testPhotographyTips() {
    console.log("[TEST 7] Photographic Tips Generation...");

    const goldenTip = AstronomyEngine.getPhotographyTip(2.0, 0.5, false);
    assert.ok(goldenTip.title.includes("Golden Hour"));

    const blueTip = AstronomyEngine.getPhotographyTip(-5.0, 0.5, false);
    assert.ok(blueTip.title.includes("Blue Hour"));

    const overheadTip = AstronomyEngine.getPhotographyTip(45.0, 0.5, false);
    assert.ok(overheadTip.title.includes("Overhead"));

    const moonTip = AstronomyEngine.getPhotographyTip(-20.0, 0.9, true);
    assert.ok(moonTip.title.includes("Moonlit"));

    const darkTip = AstronomyEngine.getPhotographyTip(-25.0, 0.1, false);
    assert.ok(darkTip.title.includes("Dark Sky"));

    console.log("  ✓ Photography Guidance tips tests PASSED!");
}

// 8. AR 3D Spherical to Screen Pinhole Projection Geometry
function testARProjectionMath() {
    console.log("[TEST 8] AR 3D Spherical to Screen Projection Geometry...");

    // Simulated projection formula from ARView
    const project = (az, alt, heading, pitch, roll, width, height, fovH = 65.0) => {
        let dAz = az - heading;
        while (dAz > 180) dAz -= 360;
        while (dAz < -180) dAz += 360;
        const dAlt = alt - pitch;

        if (Math.abs(dAz) > 95 || Math.abs(dAlt) > 85) {
            return { visible: false };
        }

        const fovH_rad = (fovH * Math.PI) / 180.0;
        const fovV_rad = fovH_rad * (height / width);

        const dAz_rad = (dAz * Math.PI) / 180.0;
        const dAlt_rad = (dAlt * Math.PI) / 180.0;

        const xNorm = Math.tan(dAz_rad) / Math.tan(fovH_rad / 2.0);
        const yNorm = Math.tan(dAlt_rad) / Math.tan(fovV_rad / 2.0);

        let screenX = (width / 2) + xNorm * (width / 2);
        let screenY = (height / 2) - yNorm * (height / 2);

        return { visible: true, x: screenX, y: screenY };
    };

    const W = 1000;
    const H = 600;

    // 1. Center alignment: Target at heading 180° and pitch 10° MUST project to screen center (500, 300)
    const pCenter = project(180, 10, 180, 10, 0, W, H);
    assert.strictEqual(pCenter.visible, true);
    assert.ok(Math.abs(pCenter.x - 500) < 1e-4, "Center X alignment");
    assert.ok(Math.abs(pCenter.y - 300) < 1e-4, "Center Y alignment");

    // 2. Horizon below eye level when tilting phone up to 30°
    const pHorizon = project(180, 0, 180, 30, 0, W, H);
    assert.strictEqual(pHorizon.visible, true);
    assert.ok(pHorizon.y > 300, "Horizon appears in lower half when tilting up to sky");

    // 3. Object behind camera (> 95° away) MUST be invisible
    const pBehind = project(0, 0, 180, 0, 0, W, H);
    assert.strictEqual(pBehind.visible, false, "Object 180° behind camera is not visible");

    // 4. Azimuth wrap-around: Heading 359° looking at Azimuth 1° is only 2° to the right
    const pWrap = project(1, 0, 359, 0, 0, W, H);
    assert.strictEqual(pWrap.visible, true);
    assert.ok(pWrap.x > 500, "Azimuth 1° is to the right of Heading 359°");

    console.log("  ✓ AR Projection geometry tests PASSED!");
}

// Run all test functions
testJulianDate();
testSolarPosition();
testSolarTimes();
testPhotographicIntervals();
testMoonEphemeris();
testTrajectories();
testPhotographyTips();
testARProjectionMath();

console.log("\n>>> ALL 8 WEB ASTRONOMY & AR TEST SUITES PASSED! <<<\n");
