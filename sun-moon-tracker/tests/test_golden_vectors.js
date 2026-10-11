// Unit test suite verifying Web implementation against canonical AR Golden Test Vectors.
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    quatFromW3CEuler,
    quatGetHeadingPitchRoll,
    quatMultiply,
    quatFromAxisAngle,
    DEG2RAD,
    RAD2DEG
} from '../js/ar/quat.js';
import { ARView } from '../js/ar/ar_view.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MockContext {
    constructor() {
        this.setTransform = () => {};
        this.scale = () => {};
        this.clearRect = () => {};
        this.save = () => {};
        this.restore = () => {};
        this.beginPath = () => {};
        this.moveTo = () => {};
        this.lineTo = () => {};
        this.stroke = () => {};
        this.fill = () => {};
        this.arc = () => {};
        this.roundRect = () => {};
        this.closePath = () => {};
        this.fillText = () => {};
        this.measureText = (text) => ({ width: 10 });
        this.setLineDash = () => {};
        this.drawImage = () => {};
    }
}

class MockElement {
    constructor(id) {
        this.id = id;
        this.width = 360;
        this.height = 640;
        this.videoWidth = 360;
        this.videoHeight = 640;
        this._listeners = {};
    }
    getBoundingClientRect() {
        return { width: 360, height: 640, top: 0, left: 0 };
    }
    getContext() {
        return new MockContext();
    }
    addEventListener(evt, fn) {
        if (!this._listeners[evt]) this._listeners[evt] = [];
        this._listeners[evt].push(fn);
    }
    removeEventListener(evt, fn) {
        if (this._listeners[evt]) {
            this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
        }
    }
}

global.document = {
    getElementById: (id) => new MockElement(id)
};
global.window = {
    innerWidth: 360,
    innerHeight: 640,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
};

console.log("=== Running AR Golden Vectors Web Parity Tests ===");

const goldenPath = path.resolve(__dirname, '../../shared/ar_golden/ar_golden_vectors.json');
const goldenData = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

// 1. Euler angle conversion test cases
console.log("\n[TEST 1] Euler to Heading/Pitch Oracles (E1)...");
const qCamToDev = [1, 0, 0, 0]; // Rx(180): back camera points along device -Z
for (const tc of goldenData.euler_cases) {
    const qDev = quatFromW3CEuler(tc.alpha, tc.beta, tc.gamma);
    const qCam = quatMultiply(qDev, qCamToDev);
    const pose = quatGetHeadingPitchRoll(qCam);

    // Normalize heading to [0, 360)
    let h = (pose.heading % 360 + 360) % 360;
    if (Math.abs(h - 360) < 1e-4) h = 0;

    const diffH = Math.min(Math.abs(h - tc.expected_heading), 360 - Math.abs(h - tc.expected_heading));
    const diffP = Math.abs(pose.pitch - tc.expected_pitch);

    assert.ok(diffH < 0.05, `${tc.id}: heading ${h} vs expected ${tc.expected_heading} (diff: ${diffH})`);
    assert.ok(diffP < 0.05, `${tc.id}: pitch ${pose.pitch} vs expected ${tc.expected_pitch} (diff: ${diffP})`);
    console.log(`  ✓ ${tc.id}: heading=${h.toFixed(2)}°, pitch=${pose.pitch.toFixed(2)}° PASSED`);
}

// 2. Declination cases
console.log("\n[TEST 2] Declination True North Correction (E3)...");
for (const tc of goldenData.declination_cases) {
    const headingTrue = (tc.mag_heading + tc.declination + 360) % 360;
    assert.strictEqual(headingTrue, tc.expected_true_heading, `${tc.id} direct formula`);

    // Verify quaternion rotation Rz(-delta)
    const qDevMag = quatFromW3CEuler((360 - tc.mag_heading) % 360, 90, 0);
    const qCamMag = quatMultiply(qDevMag, qCamToDev);
    const qDecl = quatFromAxisAngle([0, 0, 1], -tc.declination * DEG2RAD);
    const qTrue = quatMultiply(qDecl, qCamMag);
    const poseTrue = quatGetHeadingPitchRoll(qTrue);
    const hNorm = (poseTrue.heading % 360 + 360) % 360;

    const diff = Math.min(Math.abs(hNorm - tc.expected_true_heading), 360 - Math.abs(hNorm - tc.expected_true_heading));
    assert.ok(diff < 0.05, `${tc.id}: quat heading ${hNorm} vs expected ${tc.expected_true_heading}`);
    console.log(`  ✓ ${tc.id}: true_heading=${hNorm.toFixed(2)}° PASSED`);
}

// 3. Projection test cases
console.log("\n[TEST 3] Pinhole Camera Perspective Projection (P1 - P5)...");
const ar = new ARView('ar-canvas', 'camera-video');
ar.width = goldenData.camera.width;
ar.height = goldenData.camera.height;
ar.fovH = goldenData.camera.fovH_deg;
ar.cameraActive = false; // use standard virtual FOV

for (const tc of goldenData.projection_cases) {
    ar.fusion.setManualPose(tc.camera_heading, tc.camera_pitch);
    ar.fusion._currentQuat = [...ar.fusion._targetQuat];
    ar.fusion._invCurrentQuat = [
        -ar.fusion._currentQuat[0],
        -ar.fusion._currentQuat[1],
        -ar.fusion._currentQuat[2],
        ar.fusion._currentQuat[3]
    ];
    ar.fusion.heading = tc.camera_heading;
    ar.fusion.pitch = tc.camera_pitch;
    ar.fusion.roll = tc.camera_roll;

    const proj = ar.projectToScreen(tc.object_azimuth, tc.object_altitude);

    if (!tc.visible) {
        assert.strictEqual(proj.visible, false, `${tc.id} should be invisible`);
        console.log(`  ✓ ${tc.id}: properly clipped/invisible PASSED`);
    } else {
        assert.strictEqual(proj.visible, true, `${tc.id} should be visible`);
        assert.ok(
            Math.abs(proj.x - tc.expected_u) < 0.1,
            `${tc.id} u: got ${proj.x}, expected ${tc.expected_u}`
        );
        assert.ok(
            Math.abs(proj.y - tc.expected_v) < 0.1,
            `${tc.id} v: got ${proj.y}, expected ${tc.expected_v}`
        );
        console.log(`  ✓ ${tc.id}: (u=${proj.x.toFixed(2)}, v=${proj.y.toFixed(2)}) matches (${tc.expected_u.toFixed(2)}, ${tc.expected_v.toFixed(2)}) PASSED`);
    }
}

console.log("\n✓ All AR Golden Vectors Web Parity Tests PASSED!\n");
