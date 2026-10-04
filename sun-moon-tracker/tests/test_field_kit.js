import assert from 'node:assert';
import { FieldKitMath, SensorPresets } from '../js/ui/field_kit.js';

console.log("============================================================");
console.log("  LandscapeHelper Field Kit Unit Tests                      ");
console.log("============================================================");

// 1. Sensor Presets
function testSensorPresets() {
    console.log("[TEST 1] Sensor Presets...");
    assert.ok(SensorPresets.length >= 7, "At least 7 presets defined");
    const fullFrame = SensorPresets.find(p => p.name.includes('Full Frame'));
    assert.ok(fullFrame, "Full Frame preset exists");
    assert.strictEqual(fullFrame.width, 36.0);
    assert.strictEqual(fullFrame.height, 24.0);
    console.log("  ✓ Sensor Presets PASSED!");
}

// 2. FOV Calculator
function testFOV() {
    console.log("[TEST 2] Field of View...");
    const fov = FieldKitMath.calculateFOV(36.0, 24.0, 50.0);
    // 50mm on Full Frame: ~39.6° horizontal, ~27.0° vertical, ~46.8° diagonal
    assert.ok(Math.abs(fov.hFov - 39.6) < 0.5, `Expected ~39.6°, got ${fov.hFov}`);
    assert.ok(Math.abs(fov.vFov - 27.0) < 0.5, `Expected ~27.0°, got ${fov.vFov}`);
    assert.ok(Math.abs(fov.dFov - 46.8) < 0.5, `Expected ~46.8°, got ${fov.dFov}`);

    const zero = FieldKitMath.calculateFOV(36.0, 24.0, 0);
    assert.strictEqual(zero.hFov, 0);
    console.log("  ✓ Field of View PASSED!");
}

// 3. Focus Stack Calculator
function testFocusStack() {
    console.log("[TEST 3] Focus Stacking & Hyperfocal Distance...");
    const stack = FieldKitMath.calculateFocusStack(50.0, 2.8, 1.0, 10.0, 43.27);
    assert.ok(stack.hfd > 0, "HFD is positive");
    assert.ok(stack.recommendedShots >= 1, "At least 1 shot recommended");
    assert.ok(Array.isArray(stack.shotDistances), "Shot distances is an array");
    console.log("  ✓ Focus Stacking PASSED!");
}

// 4. Night Sky Exposure
function testNightExposure() {
    console.log("[TEST 4] Night Sky Exposure (500 Rule & NPF)...");
    const exp = FieldKitMath.calculateNightExposure(14.0, 2.8, 4.2, 0.0);
    // 500 / 14 = 35.7s
    assert.ok(Math.abs(exp.rule500 - 35.7) < 0.2, `Expected ~35.7s, got ${exp.rule500}`);
    // NPF: (35*2.8 + 30*4.2) / 14 = 224 / 14 = 16.0s
    assert.ok(Math.abs(exp.npfRule - 16.0) < 0.2, `Expected ~16.0s, got ${exp.npfRule}`);
    assert.strictEqual(exp.shutterSpeedStr, '16.0s');
    console.log("  ✓ Night Sky Exposure PASSED!");
}

// 5. ND Filter Calculator
function testNdFilter() {
    console.log("[TEST 5] ND Filter Calculation & Formatting...");
    // 0.97s base, 0 stops -> 1.0s (not 1/1s)
    const ndSub1 = FieldKitMath.calculateNdFilter(0.97, 0);
    assert.strictEqual(ndSub1.formatted, '1.0s');
    assert.ok(!ndSub1.formatted.includes('1/1s'));

    // 1/1000s base, 10 stops (1024x) -> ~1.024s -> 1.0s
    const nd10 = FieldKitMath.calculateNdFilter(0.001, 10);
    assert.ok(Math.abs(nd10.adjustedSec - 1.024) < 1e-4);
    assert.strictEqual(nd10.formatted, '1.0s');

    // 119.6s -> 2m (not 1m 60s)
    const ndCarry = FieldKitMath.calculateNdFilter(119.6, 0);
    assert.strictEqual(ndCarry.formatted, '2m');
    assert.ok(!ndCarry.formatted.includes('1m 60s'));
    assert.strictEqual(ndCarry.bulbRequired, true);

    // 1/250s base, 6 stops (64x) -> ~0.256s -> 1/4s
    const ndFrac = FieldKitMath.calculateNdFilter(1 / 250.0, 6);
    assert.strictEqual(ndFrac.formatted, '1/4s');
    console.log("  ✓ ND Filter PASSED!");
}

// 6. Apparent Moon Size
function testApparentSize() {
    console.log("[TEST 6] Apparent Celestial Size...");
    const moon = FieldKitMath.calculateApparentSize(200.0, 24.0, 0.53);
    assert.ok(moon.sizeMm > 1.8 && moon.sizeMm < 1.9, `Expected ~1.85mm, got ${moon.sizeMm}`);
    assert.ok(moon.percent > 7.0 && moon.percent < 8.0, `Expected ~7.7%, got ${moon.percent}`);
    assert.ok(moon.reqFocalFor50Percent > 1200, "Requires > 1200mm lens for 50% sensor fill");
    console.log("  ✓ Apparent Size PASSED!");
}

// 7. Sun Terrain Elevation
function testSunTerrain() {
    console.log("[TEST 7] Sun Terrain Obstruction...");
    const unobstructed = FieldKitMath.calculateSunTerrain(15.0, 10.0);
    assert.strictEqual(unobstructed.isObstructed, false);
    assert.strictEqual(unobstructed.clearanceDeg, 5.0);

    const obstructed = FieldKitMath.calculateSunTerrain(5.0, 10.0);
    assert.strictEqual(obstructed.isObstructed, true);
    assert.strictEqual(obstructed.clearanceDeg, -5.0);
    console.log("  ✓ Sun Terrain PASSED!");
}

// 8. Distance and Bearing
function testDistanceBearing() {
    console.log("[TEST 8] Distance & Bearing (Haversine)...");
    // London (51.5074, -0.1278) to Paris (48.8566, 2.3522): ~343 km, ~149° (SE)
    const db = FieldKitMath.calculateDistanceBearing(51.5074, -0.1278, 48.8566, 2.3522);
    assert.ok(Math.abs(db.distKm - 343.5) < 5.0, `Expected ~343.5km, got ${db.distKm}`);
    assert.ok(Math.abs(db.bearingDeg - 149.0) < 5.0, `Expected ~149°, got ${db.bearingDeg}`);
    assert.strictEqual(db.cardinal, 'SE');

    // Antipodal check
    const anti = FieldKitMath.calculateDistanceBearing(45.0, 10.0, -45.0, -170.0);
    assert.ok(!isNaN(anti.distKm), "No NaN on antipodal points");
    assert.ok(Math.abs(anti.distKm - 20015.0) < 50.0);
    console.log("  ✓ Distance & Bearing PASSED!");
}

testSensorPresets();
testFOV();
testFocusStack();
testNightExposure();
testNdFilter();
testApparentSize();
testSunTerrain();
testDistanceBearing();

console.log("\nAll Field Kit unit tests completed successfully!\n");
