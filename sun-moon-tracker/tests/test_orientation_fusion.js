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
// Upright device facing East (Azimuth 90° -> Alpha = 90°, Beta = 90°, Gamma = 0°)
fusionAndroid.handleDeviceOrientation({
    alpha: 90,
    beta: 90,
    gamma: 0,
    absolute: true,
    timeStamp: 1000
}, true);
fusionAndroid.update(1000);
assert.ok(Math.abs(fusionAndroid.heading - 90) < 0.2, `Expected ~90°, got ${fusionAndroid.heading}`);
assert.ok(Math.abs(fusionAndroid.pitch - 0) < 0.2, `Expected ~0°, got ${fusionAndroid.pitch}`);
assert.ok(Math.abs(fusionAndroid.deviceTilt - 90) < 0.2, `Expected ~90° tilt, got ${fusionAndroid.deviceTilt}`);
assert.ok(Math.abs(fusionAndroid.compassHeading - 90) < 0.2, `Expected ~90° compass heading, got ${fusionAndroid.compassHeading}`);
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
// Alpha changes from 0 to 30° (+30° clockwise azimuth)
fusionIOS.handleDeviceOrientation({
    alpha: 30,
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

// TEST 5: Android Stream Immunity (Interleaving relative events must be ignored)
console.log("[TEST 5] Android Stream Immunity (Ignore relative events when absolute is active)...");
const fusionInterleave = new OrientationFusion();
// 1. Android absolute event arrives (Heading 120°)
fusionInterleave.handleDeviceOrientationAbsolute({
    alpha: 120, // 120° Azimuth
    beta: 90,
    gamma: 0
});
fusionInterleave.update(3000);
const headingAbs = fusionInterleave.heading;
assert.ok(Math.abs(headingAbs - 120.0) < 0.5, `Expected heading 120°, got ${headingAbs}`);

// 2. Interleaved relative deviceorientation event arrives with arbitrary relative alpha (e.g. 10°)
fusionInterleave.handleDeviceOrientation({
    alpha: 10,
    beta: 90,
    gamma: 0,
    absolute: false
});
fusionInterleave.update(3016);
const headingAfterRel = fusionInterleave.heading;
// Heading must stay at 120° and NOT jump to relative 10°!
assert.ok(Math.abs(headingAfterRel - 120.0) < 0.5, `Relative event corrupted heading! Got ${headingAfterRel}`);
console.log("  ✓ Android Stream Immunity PASSED!");

// TEST 6: iOS Pitch Sweep Stability & Camera Gating
console.log("[TEST 6] iOS Pitch Sweep Stability (Freeze yaw when pitching into sky)...");
const fusionPitch = new OrientationFusion();
// Snap initial level orientation (Heading 90° East)
fusionPitch.handleDeviceOrientation({
    alpha: 90,
    beta: 90,
    gamma: 0,
    webkitCompassHeading: 90,
    webkitCompassAccuracy: 10
});
fusionPitch.update(4000);
const initialYawOff = fusionPitch.getDiagnostics().yawOffset;

// User points camera high up into sky (Beta = 145°, Pitch ~ +55° > 35° gate threshold)
// Even if magnetometer is noisy or reports distorted heading 130° at high pitch:
fusionPitch.handleDeviceOrientation({
    alpha: 90,
    beta: 145,
    gamma: 5, // with roll
    webkitCompassHeading: 130, // distorted magnetic reading at high elevation
    webkitCompassAccuracy: 35
});
fusionPitch.update(4050);
const highPitchYawOff = fusionPitch.getDiagnostics().yawOffset;
// Yaw offset MUST remain frozen to prevent the lines from sliding away from camera center!
assert.ok(Math.abs(highPitchYawOff - initialYawOff) < 0.1, `High pitch should freeze yawOffset! Initial: ${initialYawOff}, Got: ${highPitchYawOff}`);
console.log("  ✓ iOS Pitch Sweep Stability PASSED!");

// TEST 7: Magnetic Declination True North Alignment
console.log("[TEST 7] Magnetic Declination True North Alignment...");
const fusionDecl = new OrientationFusion();
fusionDecl.setDeclination(15.0); // +15° East declination (e.g. Seattle)
fusionDecl.handleDeviceOrientationAbsolute({
    alpha: 90, // Magnetic 90° East
    beta: 90,
    gamma: 0
});
fusionDecl.update(5000);
// True heading should be 90° + 15° = 105°
assert.ok(Math.abs(fusionDecl.heading - 105.0) < 0.5, `Expected 105° true heading with declination, got ${fusionDecl.heading}`);
console.log("  ✓ Magnetic Declination PASSED!");

// TEST 8: Phone Flat on Surface (3D Compass Face-Up Parity)
console.log("[TEST 8] Phone Flat on Surface (Compass Disc Face-Up Parity)...");
const fusionFlat = new OrientationFusion();
// Placed flat face up on table pointing East (Beta = 0, Gamma = 0, Alpha = 90)
fusionFlat.handleDeviceOrientationAbsolute({
    alpha: 90,
    beta: 0,
    gamma: 0
});
fusionFlat.update(6000);
// When flat face up on surface:
// deviceTilt MUST be 0° (flat face up, ready for 3D compass top-down view!)
// compassHeading MUST be 90° (top of phone points East)
// cam pitch is -90° (camera points straight down into table)
assert.ok(Math.abs(fusionFlat.deviceTilt - 0.0) < 0.5, `deviceTilt flat on table expected 0°, got ${fusionFlat.deviceTilt}`);
assert.ok(Math.abs(fusionFlat.compassHeading - 90.0) < 0.5, `compassHeading flat on table expected 90°, got ${fusionFlat.compassHeading}`);
assert.ok(Math.abs(fusionFlat.pitch - (-90.0)) < 0.5, `cam pitch flat on table expected -90°, got ${fusionFlat.pitch}`);
console.log("  ✓ Phone Flat on Surface PASSED!");

// TEST 9: Manual Drag and Nudge Yaw Trim
console.log("[TEST 9] Manual Drag and Nudge Yaw Trim...");
const fusionTrim = new OrientationFusion();
fusionTrim.handleDeviceOrientationAbsolute({
    alpha: 90,
    beta: 90,
    gamma: 0
});
fusionTrim.update(7000);
assert.ok(Math.abs(fusionTrim.heading - 90.0) < 0.2);

// User drags view to trim heading by +10°
fusionTrim.nudgeYaw(10.0);
for (let t = 7050; t <= 8000; t += 50) fusionTrim.update(t);
assert.ok(Math.abs(fusionTrim.heading - 100.0) < 0.5, `Expected trimmed heading 100°, got ${fusionTrim.heading}`);

// In manual mode (gyro unavailable)
const fusionManualTrim = new OrientationFusion();
fusionManualTrim.setManualPose(180, 10);
fusionManualTrim.nudgeYaw(15.0);
for (let t = 8050; t <= 9000; t += 50) fusionManualTrim.update(t);
assert.ok(Math.abs(fusionManualTrim.heading - 195.0) < 0.5, `Expected manual trimmed heading 195°, got ${fusionManualTrim.heading}`);
console.log("  ✓ Manual Drag and Nudge Yaw Trim PASSED!");

// TEST 10: Quaternions, Diagnostics, CSV Export, and Reset
console.log("[TEST 10] Quaternions, Diagnostics, CSV Export & Reset...");
const fusionDiag = new OrientationFusion();
fusionDiag.handleDeviceOrientationAbsolute({ alpha: 180, beta: 90, gamma: 0 });
fusionDiag.update(10000);

const qCurr = fusionDiag.getQuaternion();
assert.strictEqual(qCurr.length, 4);
const qInv = fusionDiag.getInverseQuaternion();
assert.strictEqual(qInv.length, 4);

const diag = fusionDiag.getDiagnostics();
assert.strictEqual(typeof diag.heading, 'number');
assert.strictEqual(typeof diag.deviceTilt, 'number');
assert.strictEqual(typeof diag.compassHeading, 'number');

const csv = fusionDiag.exportDiagLogCSV();
assert.ok(csv.includes("time,src,heading,pitch,roll,yawOffset,acc"));

fusionDiag.reset();
assert.strictEqual(fusionDiag._yawOffsetInitialized, false);
console.log("  ✓ Diagnostics & CSV Export PASSED!");

console.log("\n>>> ALL ORIENTATION FUSION TESTS PASSED! <<<\n");

