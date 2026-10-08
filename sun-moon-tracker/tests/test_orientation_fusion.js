import assert from 'node:assert';
import { OrientationFusion } from '../js/ar/orientation_fusion.js';

console.log("============================================================");
console.log("  LandscapeHelper AR Orientation Fusion Unit Tests          ");
console.log("============================================================");

// TEST 1: Manual Desktop Drag Mode
console.log("[TEST 1] Manual Desktop Drag Mode...");
const fusion = new OrientationFusion();
fusion.setManualPose(180, 15);
fusion.update(1000);
assert.ok(Math.abs(fusion.heading - 180) < 0.1, `Heading: ${fusion.heading}`);
assert.ok(Math.abs(fusion.pitch - 15) < 0.1, `Pitch: ${fusion.pitch}`);
assert.ok(Math.abs(fusion.roll - 0) < 0.1, `Roll: ${fusion.roll}`);
console.log("  ✓ Manual Desktop Drag Mode PASSED!");

// TEST 2: Android Absolute Orientation Mode
console.log("[TEST 2] Android Absolute Orientation Mode...");
const fusionAndroid = new OrientationFusion();
// Upright device facing East (Azimuth 90° -> Alpha = 270°, Beta = 90°, Gamma = 0°)
fusionAndroid.handleDeviceOrientation({
    alpha: 270,
    beta: 90,
    gamma: 0,
    absolute: true,
    timeStamp: 1000
}, true);
fusionAndroid.update(1000);
assert.ok(Math.abs(fusionAndroid.heading - 90) < 0.2, `Expected ~90°, got ${fusionAndroid.heading}`);
assert.ok(Math.abs(fusionAndroid.pitch - 0) < 0.2, `Expected ~0°, got ${fusionAndroid.pitch}`);
console.log("  ✓ Android Absolute Orientation Mode PASSED!");

// TEST 3: iOS Compass & Gyro Fusion with Jitter Filtering
console.log("[TEST 3] iOS Compass & Gyro Fusion with Jitter Filtering...");
const fusionIOS = new OrientationFusion();

// 1. Initial sample snaps to compass heading (e.g. 45° NE)
fusionIOS.handleDeviceOrientation({
    alpha: 0,
    beta: 90,
    gamma: 0,
    webkitCompassHeading: 45,
    webkitCompassAccuracy: 10,
    timeStamp: 1000
});
fusionIOS.update(1000);
assert.ok(Math.abs(fusionIOS.heading - 45) < 0.5, `Initial heading snap expected 45°, got ${fusionIOS.heading}`);

// 2. High frequency magnetometer noise (+5° spike for 1 sample)
// Gyro alpha stays at 0 (phone has not rotated)
fusionIOS.handleDeviceOrientation({
    alpha: 0,
    beta: 90,
    gamma: 0,
    webkitCompassHeading: 50, // 5° noise spike
    webkitCompassAccuracy: 10,
    timeStamp: 1016
});
fusionIOS.update(1016);
// Heading should barely budge because time constant is 2.5s (dt = 16ms -> alpha < 0.01)
const headingChange = Math.abs(fusionIOS.heading - 45);
assert.ok(headingChange < 0.15, `Compass noise rejected: change was only ${headingChange}°`);

// 3. Fast gyro rotation (user turns phone 30° clockwise to 75°)
// Alpha changes from 0 to 330° (-30° in W3C counterclockwise = +30° clockwise azimuth)
fusionIOS.handleDeviceOrientation({
    alpha: 330,
    beta: 90,
    gamma: 0,
    webkitCompassHeading: 75,
    webkitCompassAccuracy: 10,
    timeStamp: 1050
});
// Let SLERP catch up over ~150ms of frames
fusionIOS.update(1070);
fusionIOS.update(1120);
fusionIOS.update(1200);
assert.ok(Math.abs(fusionIOS.heading - 75) < 1.0, `Gyro tracking followed turn to 75°: got ${fusionIOS.heading}`);
console.log("  ✓ iOS Compass Jitter Filtering PASSED!");

// TEST 4: Continuous Orientation across iOS Euler Flip
console.log("[TEST 4] Continuous Orientation across iOS Euler Flip...");
const fusionFlip = new OrientationFusion();

// Frame 1: Tilt up 29° (Beta = 119°, Gamma = 0°, Alpha = 0°)
fusionFlip.handleDeviceOrientation({
    alpha: 0,
    beta: 119,
    gamma: 0,
    webkitCompassHeading: 0,
    webkitCompassAccuracy: 10,
    timeStamp: 2000
});
fusionFlip.update(2000);
const pitchBefore = fusionFlip.pitch;

// Frame 2: Tilt up 31° on iOS where Euler flip occurs (Beta = 59°, Gamma = 180°, Alpha = 180°)
fusionFlip.handleDeviceOrientation({
    alpha: 180,
    beta: 59,
    gamma: 180,
    webkitCompassHeading: 0,
    webkitCompassAccuracy: 10,
    timeStamp: 2030
});
fusionFlip.update(2030);
const pitchAfter = fusionFlip.pitch;

// Pitch should smoothly transition from ~29° to ~31° without flipping sign or jumping!
assert.ok(Math.abs(pitchBefore - 29.0) < 1.0, `Pitch before flip: ${pitchBefore}`);
assert.ok(Math.abs(pitchAfter - 31.0) < 1.0, `Pitch after flip: ${pitchAfter}`);
assert.ok(pitchAfter > pitchBefore, "Pitch increases monotonically across the 90° boundary");
console.log("  ✓ Continuous Euler Flip PASSED!");

console.log("\n>>> ALL ORIENTATION FUSION TESTS PASSED! <<<\n");
