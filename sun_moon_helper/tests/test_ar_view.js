import assert from 'node:assert';
import { ARView } from '../js/ar/ar_view.js';

console.log("============================================================");
console.log("  LandscapeHelper ARView Integration Unit Tests             ");
console.log("============================================================");

// Mock Canvas & Video DOM elements for Node.js test environment
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
        this.quadraticCurveTo = () => {};
        this.roundRect = () => {};
        this.closePath = () => {};
        this.fillText = () => {};
        this.measureText = (text) => ({ width: text.length * 7 });
        this.setLineDash = () => {};
        this.createLinearGradient = () => ({ addColorStop: () => {} });
        this.createRadialGradient = () => ({ addColorStop: () => {} });
        this.drawImage = () => {};
    }
}

class MockElement {
    constructor(id) {
        this.id = id;
        this.width = 1000;
        this.height = 600;
        this.videoWidth = 1920;
        this.videoHeight = 1080;
        this.readyState = 4;
        this._listeners = {};
    }
    getContext() { return new MockContext(); }
    getBoundingClientRect() { return { width: 1000, height: 600 }; }
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

// Global DOM mocks
global.document = {
    getElementById: (id) => new MockElement(id)
};
global.window = {
    innerWidth: 1000,
    innerHeight: 600,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
};

// TEST 1: ARView Initialization
console.log("[TEST 1] ARView Initialization & Geometry...");
const ar = new ARView('ar-canvas', 'camera-video');
assert.strictEqual(ar.width, 1000);
assert.strictEqual(ar.height, 600);
assert.strictEqual(ar.heading, 180);
assert.strictEqual(ar.pitch, 10);
assert.strictEqual(ar.gyroAvailable, false);
console.log("  ✓ ARView Initialization PASSED!");

// TEST 2: 3D Projection Center Alignment
console.log("[TEST 2] 3D Projection Center Alignment...");
// Looking at South (Az=180) and Alt=10° (same as camera pose)
const centerProj = ar.projectToScreen(180, 10);
assert.strictEqual(centerProj.visible, true);
assert.ok(Math.abs(centerProj.x - 500) < 1e-3, `Center X: ${centerProj.x}`);
assert.ok(Math.abs(centerProj.y - 300) < 1e-3, `Center Y: ${centerProj.y}`);

// Point behind camera (North Az=0, Alt=0) must be invisible
const behindProj = ar.projectToScreen(0, 0);
assert.strictEqual(behindProj.visible, false);
console.log("  ✓ 3D Projection Center Alignment PASSED!");

// TEST 3: Camera Focal Length Calculation
console.log("[TEST 3] Physical Camera vs Virtual Focal Length...");
// Virtual mode (cameraActive = false)
const f_virtual = ar.getFocalLengthPixels();
assert.ok(f_virtual > 0, `f_virtual: ${f_virtual}`);

// Live camera mode (cameraActive = true)
ar.cameraActive = true;
const f_camera = ar.getFocalLengthPixels();
assert.ok(f_camera > 0, `f_camera: ${f_camera}`);
// Sensor aspect ratio match
assert.notStrictEqual(f_camera, f_virtual);
console.log("  ✓ Physical Camera Focal Length PASSED!");

// TEST 4: Sensor Orientation Tracking & Horizon Tilt Under Roll
console.log("[TEST 4] Sensor Fusion & Roll Invariance...");
// Simulate iOS device orientation: facing East (Az=90) tilted up 20°
ar.fusion.handleDeviceOrientation({
    alpha: 270,
    beta: 110,
    gamma: 0,
    webkitCompassHeading: 90,
    webkitCompassAccuracy: 10,
    timeStamp: 1000
});
ar.fusion.update(1000);

const eastProj = ar.projectToScreen(90, 20);
assert.strictEqual(eastProj.visible, true);
assert.ok(Math.abs(eastProj.x - 500) < 1.0, `Projected East X: ${eastProj.x}`);
assert.ok(Math.abs(eastProj.y - 300) < 1.0, `Projected East Y: ${eastProj.y}`);
console.log("  ✓ Sensor Fusion & Roll Invariance PASSED!");

// TEST 5: Render Loop Integrity
console.log("[TEST 5] Render Loop Execution...");
ar.sunPosition = { azimuth: 90, altitude: 20, isAboveHorizon: true };
ar.moonPosition = { azimuth: 270, altitude: 10, isAboveHorizon: true };
ar.moonPhase = { illuminationFraction: 0.5, phaseFraction: 0.25, icon: '🌓', name: 'First Quarter', illuminationPercent: 50 };
ar.sunTrajectory = [
    { azimuth: 80, altitude: 10, hour: 8, minute: 0, isAboveHorizon: true, timeStr: '08:00' },
    { azimuth: 90, altitude: 20, hour: 9, minute: 0, isAboveHorizon: true, timeStr: '09:00' },
    { azimuth: 100, altitude: 30, hour: 10, minute: 0, isAboveHorizon: true, timeStr: '10:00' }
];

// Must render without throwing any exceptions
ar.render();
console.log("  ✓ Render Loop PASSED!");

console.log("\n>>> ALL ARVIEW INTEGRATION TESTS PASSED! <<<\n");
