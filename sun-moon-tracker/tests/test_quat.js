import assert from 'node:assert';
import {
    quatIdentity,
    quatFromAxisAngle,
    quatMultiply,
    quatInverse,
    quatNormalize,
    quatRotate,
    quatSlerp,
    quatFromW3CEuler,
    quatFromHeadingPitch,
    quatGetHeadingPitchRoll,
    enuVectorFromAzAlt,
    shortestAngleDeg
} from '../js/ar/quat.js';

console.log("============================================================");
console.log("  LandscapeHelper AR Quaternion Math Unit Tests            ");
console.log("============================================================");

// TEST 1: Identity & Normalization
console.log("[TEST 1] Identity & Normalization...");
const qId = quatIdentity();
assert.deepStrictEqual(qId, [0, 0, 0, 1]);
const qNorm = quatNormalize([0, 0, 0, 5]);
assert.ok(Math.abs(qNorm[3] - 1.0) < 1e-6);
console.log("  ✓ Identity & Normalization PASSED!");

// TEST 2: Axis Angle & Rotation
console.log("[TEST 2] Axis Angle & Vector Rotation...");
// 90 deg rotation around Z rotates [1, 0, 0] to [0, 1, 0]
const qZ90 = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
const rotV = quatRotate(qZ90, [1, 0, 0]);
assert.ok(Math.abs(rotV[0] - 0) < 1e-6, "X should be 0");
assert.ok(Math.abs(rotV[1] - 1) < 1e-6, "Y should be 1");
assert.ok(Math.abs(rotV[2] - 0) < 1e-6, "Z should be 0");

// Inverse rotation restores original vector
const qZ90Inv = quatInverse(qZ90);
const restoredV = quatRotate(qZ90Inv, rotV);
assert.ok(Math.abs(restoredV[0] - 1) < 1e-6);
assert.ok(Math.abs(restoredV[1] - 0) < 1e-6);
console.log("  ✓ Axis Angle & Vector Rotation PASSED!");

// TEST 3: W3C Device Orientation Euler & Camera Orientation
console.log("[TEST 3] W3C Euler Angle Composition & Continuous Flips...");
// Upright device (beta=90, gamma=0) facing North (alpha=0)
// Camera looks out back: [0, 0, -1] in device frame.
// With qCamToDev = [1, 0, 0, 0] (Rx(180)), cam fwd [0, 0, 1] maps to device [0, 0, -1].
const qCamToDev = [1, 0, 0, 0];
const qDevNorth = quatFromW3CEuler(0, 90, 0);
const qCamNorth = quatMultiply(qDevNorth, qCamToDev);
const fwdNorth = quatRotate(qCamNorth, [0, 0, 1]);
assert.ok(Math.abs(fwdNorth[0]) < 1e-6, "Facing North X ≈ 0");
assert.ok(Math.abs(fwdNorth[1] - 1.0) < 1e-6, "Facing North Y ≈ 1");
assert.ok(Math.abs(fwdNorth[2]) < 1e-6, "Facing North Z ≈ 0");

// iOS Euler flip test: phone tilted up 30° to sky
// Standard: alpha=0, beta=120, gamma=0
const qStandard = quatMultiply(quatFromW3CEuler(0, 120, 0), qCamToDev);
const fwdStandard = quatRotate(qStandard, [0, 0, 1]);

// iOS Flipped: alpha=180, beta=60, gamma=180
const qFlipped = quatMultiply(quatFromW3CEuler(180, 60, 180), qCamToDev);
const fwdFlipped = quatRotate(qFlipped, [0, 0, 1]);

assert.ok(Math.abs(fwdStandard[1] - fwdFlipped[1]) < 1e-5, "Y components match across Euler flip");
assert.ok(Math.abs(fwdStandard[2] - fwdFlipped[2]) < 1e-5, "Z components match across Euler flip");
assert.ok(Math.abs(fwdStandard[2] - 0.5) < 1e-5, "Pitch is +30° (sin 30° = 0.5)");
console.log("  ✓ W3C Euler & Continuous Flip PASSED!");

// TEST 4: Slerp Interpolation
console.log("[TEST 4] Slerp Interpolation...");
const q0 = quatIdentity();
const q1 = quatFromAxisAngle([0, 1, 0], Math.PI / 2); // 90 deg around Y
const qMid = quatSlerp(q0, q1, 0.5); // Should be 45 deg around Y
const vRotMid = quatRotate(qMid, [0, 0, 1]);
// Rotating [0, 0, 1] by 45 deg around Y gives [sin 45°, 0, cos 45°]
assert.ok(Math.abs(vRotMid[0] - Math.SQRT1_2) < 1e-5);
assert.ok(Math.abs(vRotMid[2] - Math.SQRT1_2) < 1e-5);
console.log("  ✓ Slerp Interpolation PASSED!");

// TEST 5: Spherical ENU Vectors & Euler Extraction
console.log("[TEST 5] ENU Vectors & Heading/Pitch/Roll Roundtrip...");
// North at Horizon (Az=0, Alt=0) -> [0, 1, 0]
const vNorthENU = enuVectorFromAzAlt(0, 0);
assert.ok(Math.abs(vNorthENU[0] - 0) < 1e-6);
assert.ok(Math.abs(vNorthENU[1] - 1) < 1e-6);
assert.ok(Math.abs(vNorthENU[2] - 0) < 1e-6);

// East at Horizon (Az=90, Alt=0) -> [1, 0, 0]
const vEastENU = enuVectorFromAzAlt(90, 0);
assert.ok(Math.abs(vEastENU[0] - 1) < 1e-6);
assert.ok(Math.abs(vEastENU[1] - 0) < 1e-6);

// Zenith (Alt=90) -> [0, 0, 1]
const vZenithENU = enuVectorFromAzAlt(180, 90);
assert.ok(Math.abs(vZenithENU[2] - 1) < 1e-6);

// Roundtrip Heading/Pitch/Roll from manual pose
const testAngles = [
    { h: 0, p: 0, r: 0 },
    { h: 90, p: 25, r: 0 },
    { h: 180, p: -15, r: 0 },
    { h: 270, p: 45, r: 0 }
];
for (const a of testAngles) {
    const qTest = quatFromHeadingPitch(a.h, a.p);
    const derived = quatGetHeadingPitchRoll(qTest);
    assert.ok(Math.abs(derived.heading - a.h) < 1e-4, `Heading mismatch: ${derived.heading} vs ${a.h}`);
    assert.ok(Math.abs(derived.pitch - a.p) < 1e-4, `Pitch mismatch: ${derived.pitch} vs ${a.p}`);
}
console.log("  ✓ ENU Vectors & Euler Roundtrip PASSED!");

// TEST 6: Shortest Angle Difference
console.log("[TEST 6] Shortest Angle Difference...");
assert.strictEqual(shortestAngleDeg(10, 350), 20);
assert.strictEqual(shortestAngleDeg(350, 10), -20);
assert.strictEqual(shortestAngleDeg(180, 0), 180);
console.log("  ✓ Shortest Angle Difference PASSED!");

console.log("\n>>> ALL QUATERNION TESTS PASSED! <<<\n");
