/**
 * test_sky_sphere.js - Unit tests for 3D Math, Frustum Clipper, and Stable Sky Sphere
 */

import assert from 'assert';
import { Vec3, Quat, Mat3, FrustumClipper } from '../js/ar/math3d.js';
import { SkySphere } from '../js/ar/sky_sphere.js';
import { ARView } from '../js/ar/ar_view.js';

console.log("============================================================");
console.log("  Stable Sky Sphere & 3D Projection Engine Unit Tests       ");
console.log("============================================================");

function testSphericalENUConversion() {
    console.log("[TEST 1] Spherical to ENU Unit Vector Conversion...");
    const v = Vec3.create();

    // 1. Zenith: Az = 0°, Alt = 90° -> [0, 0, 1]
    Vec3.fromSphericalENU(v, 0, 90);
    assert.ok(Math.abs(v.x) < 1e-6 && Math.abs(v.y) < 1e-6 && Math.abs(v.z - 1.0) < 1e-6, "Zenith vector is [0, 0, 1]");

    // 2. North Horizon: Az = 0°, Alt = 0° -> [0, 1, 0]
    Vec3.fromSphericalENU(v, 0, 0);
    assert.ok(Math.abs(v.x) < 1e-6 && Math.abs(v.y - 1.0) < 1e-6 && Math.abs(v.z) < 1e-6, "North Horizon vector is [0, 1, 0]");

    // 3. East Horizon: Az = 90°, Alt = 0° -> [1, 0, 0]
    Vec3.fromSphericalENU(v, 90, 0);
    assert.ok(Math.abs(v.x - 1.0) < 1e-6 && Math.abs(v.y) < 1e-6 && Math.abs(v.z) < 1e-6, "East Horizon vector is [1, 0, 0]");

    // 4. South Horizon: Az = 180°, Alt = 0° -> [0, -1, 0]
    Vec3.fromSphericalENU(v, 180, 0);
    assert.ok(Math.abs(v.x) < 1e-6 && Math.abs(v.y - (-1.0)) < 1e-6 && Math.abs(v.z) < 1e-6, "South Horizon vector is [0, -1, 0]");

    // 5. West Horizon: Az = 270°, Alt = 0° -> [-1, 0, 0]
    Vec3.fromSphericalENU(v, 270, 0);
    assert.ok(Math.abs(v.x - (-1.0)) < 1e-6 && Math.abs(v.y) < 1e-6 && Math.abs(v.z) < 1e-6, "West Horizon vector is [-1, 0, 0]");

    // Length of unit vectors must be 1.0
    assert.ok(Math.abs(Vec3.length(v) - 1.0) < 1e-6, "Vector length is exactly 1.0");

    console.log("  ✓ Spherical to ENU tests PASSED!");
}

function testZenithStabilityAndGimbalLock() {
    console.log("[TEST 2] Zenith Stability & Gimbal Lock Elimination...");

    // Point camera straight up to Zenith: heading 180°, pitch 90°, roll 0°
    const m = Mat3.create();
    Mat3.fromHeadingPitchRoll(m, 180, 90, 0);

    // World Zenith point
    const vZenith = Vec3.create();
    Vec3.fromSphericalENU(vZenith, 0, 90);

    // Transform to camera coordinates
    const pCam = Vec3.create();
    Mat3.multiplyVec3(pCam, m, vZenith);

    // Must be directly in front of camera: X_cam = 0, Y_cam = 0, Z_cam = 1.0
    assert.ok(Math.abs(pCam.x) < 1e-4, `X_cam at zenith is 0 (got ${pCam.x})`);
    assert.ok(Math.abs(pCam.y) < 1e-4, `Y_cam at zenith is 0 (got ${pCam.y})`);
    assert.ok(Math.abs(pCam.z - 1.0) < 1e-4, `Z_cam at zenith is 1 (got ${pCam.z})`);

    // Screen projection must be dead center (W=1000, H=600 -> 500, 300)
    const screenPt = FrustumClipper.projectToScreen(pCam, 1000, 600, 65.0);
    assert.strictEqual(screenPt.visible, true);
    assert.ok(Math.abs(screenPt.x - 500) < 1e-3, "Screen X is dead center");
    assert.ok(Math.abs(screenPt.y - 300) < 1e-3, "Screen Y is dead center");

    // Quaternion SLERP stability across near-zenith boundary (89.5° to 90.0°)
    const q1 = Quat.create();
    const q2 = Quat.create();
    const qSlerp = Quat.create();
    Quat.fromHeadingPitchRoll(q1, 180, 89.5, 0);
    Quat.fromHeadingPitchRoll(q2, 180, 90.0, 0);
    Quat.slerp(qSlerp, q1, q2, 0.5);

    assert.ok(!isNaN(qSlerp.x) && !isNaN(qSlerp.y) && !isNaN(qSlerp.z) && !isNaN(qSlerp.w), "Slerp result contains zero NaNs");
    assert.ok(Math.abs(Math.hypot(qSlerp.x, qSlerp.y, qSlerp.z, qSlerp.w) - 1.0) < 1e-5, "Interpolated quaternion is normalized");

    console.log("  ✓ Zenith stability tests PASSED!");
}

function testFrustumClipping() {
    console.log("[TEST 3] 3D Near-Plane Frustum Line Clipping...");

    // 1. Both points in front of near plane (z >= 0.05)
    const p1 = { x: 0, y: 0, z: 1.0 };
    const p2 = { x: 1, y: 1, z: 2.0 };
    const resBothIn = FrustumClipper.clipLineSegment(p1, p2, 0.05);
    assert.ok(resBothIn !== null, "Segment in front is not culled");
    assert.strictEqual(resBothIn[0].z, 1.0);
    assert.strictEqual(resBothIn[1].z, 2.0);

    // 2. Both points behind near plane (z < 0.05)
    const pBehind1 = { x: 0, y: 0, z: -1.0 };
    const pBehind2 = { x: 1, y: 1, z: -0.5 };
    const resBothBehind = FrustumClipper.clipLineSegment(pBehind1, pBehind2, 0.05);
    assert.strictEqual(resBothBehind, null, "Segment completely behind camera is culled");

    // 3. Segment straddling near plane (z1 = 1.0, z2 = -1.0)
    const pFront = { x: 0, y: 0, z: 1.0 };
    const pBack = { x: 2, y: 0, z: -1.0 };
    const resStraddle = FrustumClipper.clipLineSegment(pFront, pBack, 0.05);
    assert.ok(resStraddle !== null, "Straddling segment is clipped");
    assert.strictEqual(resStraddle[0].z, 1.0);
    assert.ok(Math.abs(resStraddle[1].z - 0.05) < 1e-6, "Clipped endpoint lies exactly on near plane");
    // Midpoint x interpolation: t = (0.05 - 1.0) / (-1.0 - 1.0) = -0.95 / -2.0 = 0.475
    // x = 0 + 0.475 * 2 = 0.95
    assert.ok(Math.abs(resStraddle[1].x - 0.95) < 1e-4, "X coordinate is correctly interpolated");

    console.log("  ✓ Frustum clipping tests PASSED!");
}

function testSkySphereCaching() {
    console.log("[TEST 4] SkySphere Geometry Densification & Caching...");

    const skySphere = new SkySphere();
    assert.ok(skySphere.horizonRing.length > 100, "Horizon ring is generated with dense points");
    assert.strictEqual(skySphere.cardinalMarkers.length, 8, "8 Cardinal/Intercardinal markers present");

    // Raw sparse trajectory (2 points 15° apart)
    const raw = [
        { azimuth: 90, altitude: 10, hour: 8, minute: 0, timeStr: "08:00", isAboveHorizon: true },
        { azimuth: 105, altitude: 22, hour: 9, minute: 0, timeStr: "09:00", isAboveHorizon: true }
    ];

    skySphere.updateTrajectories(raw, [], "epoch_1");
    assert.ok(skySphere.sunCurve.length > 15, "Sparse 15° arc was densified into multiple interpolated vertices");
    assert.strictEqual(skySphere.sunHourlyMarkers.length, 1, "Hourly marker with even hour 8 was generated");

    // Check invalidation
    assert.strictEqual(skySphere.needsUpdate("epoch_1"), false, "Cache is valid for same epoch");
    assert.strictEqual(skySphere.needsUpdate("epoch_2"), true, "Cache invalidates on different epoch");

    console.log("  ✓ SkySphere caching tests PASSED!");
}

function testARViewCompatibility() {
    console.log("[TEST 5] ARView Backward Compatibility & Center Projection...");

    // Mock minimal DOM
    const arView = new ARView(null, null);
    arView.width = 1000;
    arView.height = 600;
    arView.fovH = 65.0;

    // Center alignment: camera at heading 180°, pitch 10°
    arView.fusion.setManualPose(180, 10);
    arView.fusion.update(1000);

    const projCenter = arView.projectToScreen(180, 10);
    assert.strictEqual(projCenter.visible, true);
    assert.ok(Math.abs(projCenter.x - 500) < 1e-3, "Target at center aligns to 500px");
    assert.ok(Math.abs(projCenter.y - 300) < 1e-3, "Target at center aligns to 300px");

    // Object 180° behind camera MUST be invisible
    const projBehind = arView.projectToScreen(0, 10);
    assert.strictEqual(projBehind.visible, false, "Object behind camera is invisible");

    console.log("  ✓ ARView compatibility tests PASSED!");
}

function testMath3DUtilities() {
    console.log("[TEST 6] Math3D Matrix, Vector & Quaternion Utilities...");

    // 1. Vec3 set, copy, lerp, normalize edge cases
    const a = Vec3.create(1, 2, 3);
    const b = Vec3.create();
    Vec3.set(b, 4, 5, 6);
    assert.strictEqual(b.x, 4);
    assert.strictEqual(b.y, 5);
    assert.strictEqual(b.z, 6);

    const c = Vec3.create();
    Vec3.copy(c, b);
    assert.strictEqual(c.x, 4);

    const zero = Vec3.create(0, 0, 0);
    const normZero = Vec3.create();
    Vec3.normalize(normZero, zero);
    assert.strictEqual(normZero.x, 0);

    const lerpRes = Vec3.create();
    Vec3.lerp(lerpRes, a, b, 0.5);
    assert.strictEqual(lerpRes.x, 2.5);
    assert.strictEqual(lerpRes.y, 3.5);
    assert.strictEqual(lerpRes.z, 4.5);

    // 2. Quat creation, set, copy, fromAxisAngle, slerp
    const q1 = Quat.create();
    assert.strictEqual(q1.w, 1);
    Quat.set(q1, 1, 0, 0, 0);
    assert.strictEqual(q1.x, 1);

    const qCopy = Quat.create();
    Quat.copy(qCopy, q1);
    assert.strictEqual(qCopy.x, 1);

    const qAxis = Quat.create();
    Quat.fromAxisAngle(qAxis, { x: 0, y: 1, z: 0 }, Math.PI / 2);
    assert.ok(Math.abs(qAxis.w - Math.cos(Math.PI / 4)) < 1e-5);

    const qSlerp = Quat.create();
    Quat.slerp(qSlerp, Quat.create(), qAxis, 0.5);
    assert.ok(qSlerp.w > 0);

    // Quat from heading, pitch, roll
    const qHpr = Quat.create();
    Quat.fromHeadingPitchRoll(qHpr, 45, 30, 10);
    const qLen = Math.hypot(qHpr.x, qHpr.y, qHpr.z, qHpr.w);
    assert.ok(Math.abs(qLen - 1.0) < 1e-4);

    // 3. Mat3 identity, fromQuat, fromCameraBasis
    const m = Mat3.create();
    Mat3.identity(m);
    assert.strictEqual(m[0], 1);
    assert.strictEqual(m[4], 1);
    assert.strictEqual(m[8], 1);

    Mat3.fromQuat(m, qAxis);
    assert.ok(m[0] !== 0);

    const right = { x: 1, y: 0, z: 0 };
    const up = { x: 0, y: 1, z: 0 };
    const fwd = { x: 0, y: 0, z: 1 };
    Mat3.fromCameraBasis(m, right, up, fwd);
    assert.strictEqual(m[0], 1);
    assert.strictEqual(m[4], 1);
    assert.strictEqual(m[8], 1);

    console.log("  ✓ Math3D Utilities tests PASSED!");
}

testSphericalENUConversion();
testZenithStabilityAndGimbalLock();
testFrustumClipping();
testSkySphereCaching();
testARViewCompatibility();
testMath3DUtilities();

console.log("\n>>> ALL STABLE SKY SPHERE UNIT TESTS PASSED FLAWLESSLY! <<<\n");
