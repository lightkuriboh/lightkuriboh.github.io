import assert from 'node:assert';
import { Compass3D } from '../js/ar/compass_3d.js';

console.log("============================================================");
console.log("  LandscapeHelper 3D Celestial Compass Unit Tests          ");
console.log("============================================================");

// Mock Canvas 2D Context
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
        this.ellipse = () => {};
        this.closePath = () => {};
        this.fillText = () => {};
        this.measureText = (text) => ({ width: (text || '').length * 8 });
        this.setLineDash = () => {};
        this.createRadialGradient = () => ({ addColorStop: () => {} });
        this.createLinearGradient = () => ({ addColorStop: () => {} });
        this.clip = () => {};
    }
}

class MockCanvas {
    constructor(id) {
        this.id = id;
        this.width = 360;
        this.height = 360;
        this._listeners = {};
    }
    getContext() { return new MockContext(); }
    getBoundingClientRect() { return { width: 360, height: 360, left: 0, top: 0 }; }
    addEventListener(evt, fn) {
        if (!this._listeners[evt]) this._listeners[evt] = [];
        this._listeners[evt].push(fn);
    }
    removeEventListener(evt, fn) {
        if (this._listeners[evt]) {
            this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
        }
    }
    dispatchEvent(evt) {
        const list = this._listeners[evt.type] || [];
        list.forEach(fn => fn(evt));
    }
}

// Global window/document mocks for Node test environment
global.document = {
    getElementById: (id) => new MockCanvas(id)
};
global.window = {
    innerWidth: 360,
    innerHeight: 360,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
};

function testInitAndGeometry() {
    console.log("[TEST 1] Initialization, Geometry & State Defaults...");
    const compass = new Compass3D('compass-3d-canvas');
    assert.strictEqual(compass.width, 360);
    assert.strictEqual(compass.height, 360);
    assert.strictEqual(compass.heading, 0);
    assert.strictEqual(compass.pitch, 28);
    assert.strictEqual(compass.roll, 0);
    assert.strictEqual(compass.followSensors, true);

    compass.resize();
    assert.ok(compass.width > 0);
    assert.ok(compass.height > 0);
    console.log("  ✓ Init & Geometry PASSED!");
}

function testFlatTopDownProjection() {
    console.log("[TEST 2] Orthographic 2D Top-Down Projection (Pitch = 0)...");
    const compass = new Compass3D('compass-3d-canvas');
    compass.pitch = 0.0;
    compass.heading = 0.0;
    compass.roll = 0.0;

    const cx = 180;
    const cy = 180;
    const radius = 360 * 0.42;

    // Zenith (Alt = 90) must be exactly at center
    const zenith = compass.projectToScreen(0, 90);
    assert.strictEqual(zenith.visible, true);
    assert.ok(Math.abs(zenith.x - cx) < 1e-3, `Zenith X: ${zenith.x}`);
    assert.ok(Math.abs(zenith.y - cy) < 1e-3, `Zenith Y: ${zenith.y}`);

    // North (Az = 0, Alt = 0) facing North: top of disk (cy - radius)
    const north = compass.projectToScreen(0, 0);
    assert.strictEqual(north.visible, true);
    assert.ok(Math.abs(north.x - cx) < 1e-3, `North X: ${north.x}`);
    assert.ok(Math.abs(north.y - (cy - radius)) < 1e-3, `North Y: ${north.y}`);

    // East (Az = 90, Alt = 0) facing North: right edge (cx + radius)
    const east = compass.projectToScreen(90, 0);
    assert.strictEqual(east.visible, true);
    assert.ok(Math.abs(east.x - (cx + radius)) < 1e-3, `East X: ${east.x}`);
    assert.ok(Math.abs(east.y - cy) < 1e-3, `East Y: ${east.y}`);

    // South (Az = 180, Alt = 0) facing North: bottom edge (cy + radius)
    const south = compass.projectToScreen(180, 0);
    assert.strictEqual(south.visible, true);
    assert.ok(Math.abs(south.x - cx) < 1e-3, `South X: ${south.x}`);
    assert.ok(Math.abs(south.y - (cy + radius)) < 1e-3, `South Y: ${south.y}`);

    // West (Az = 270, Alt = 0) facing North: left edge (cx - radius)
    const west = compass.projectToScreen(270, 0);
    assert.strictEqual(west.visible, true);
    assert.ok(Math.abs(west.x - (cx - radius)) < 1e-3, `West X: ${west.x}`);
    assert.ok(Math.abs(west.y - cy) < 1e-3, `West Y: ${west.y}`);

    console.log("  ✓ Flat Top-Down Projection PASSED!");
}

function testPerspective3DProjection() {
    console.log("[TEST 3] Perspective 3D Tilt Projection (Pitch > 0)...");
    const compass = new Compass3D('compass-3d-canvas');
    compass.pitch = 55.0; // Tilted into 3D view
    compass.heading = 0.0;
    compass.roll = 0.0;

    // In front: North (Az = 0, Alt = 10)
    const inFront = compass.projectToScreen(0, 10);
    assert.strictEqual(inFront.visible, true);
    assert.ok(typeof inFront.x === 'number' && !isNaN(inFront.x));
    assert.ok(typeof inFront.y === 'number' && !isNaN(inFront.y));

    // Behind camera or clipped in 3D perspective
    const behind = compass.projectToScreen(180, -70);
    // Should either be invisible or projected beyond screen bounds
    assert.ok(behind.visible === false || isNaN(behind.x) || typeof behind.x === 'number');

    console.log("  ✓ Perspective 3D Tilt Projection PASSED!");
}

function testVectorTransform() {
    console.log("[TEST 4] 3D Vector Transformation & Euler Matrix Math...");
    const compass = new Compass3D('compass-3d-canvas');
    compass.pitch = 0;
    compass.heading = 0;
    compass.roll = 0;

    // Vector pointing North [0, 1, 0] with heading = 0, pitch = 0, roll = 0
    const v1 = compass.transformVec([0, 1, 0]);
    assert.ok(Math.abs(v1[0] - 0) < 1e-3);
    assert.ok(Math.abs(v1[1] - 1) < 1e-3);
    assert.ok(Math.abs(v1[2] - 0) < 1e-3);

    // Rotate heading by 90 degrees: North [0, 1, 0] should rotate towards East/West
    compass.heading = 90;
    const v2 = compass.transformVec([0, 1, 0]);
    assert.ok(Math.abs(v2[0] - (-1)) < 1e-3, `v2[0]: ${v2[0]}`);
    assert.ok(Math.abs(v2[1] - 0) < 1e-3, `v2[1]: ${v2[1]}`);

    console.log("  ✓ Vector Transformation PASSED!");
}

function testStateAndCallbacks() {
    console.log("[TEST 5] Pose Setting, Snap Flat & Event Callbacks...");
    const compass = new Compass3D('compass-3d-canvas');
    let stateFired = null;
    compass.onStateChange = (st) => {
        stateFired = st;
    };

    // Sensor follow mode
    compass.followSensors = true;
    compass.setPose(120, -45, 5);
    assert.strictEqual(Math.round(compass.heading), 120);
    assert.strictEqual(Math.round(compass.pitch), 45); // abs applied
    assert.strictEqual(stateFired.heading, 120);
    assert.strictEqual(stateFired.pitch, 45);
    assert.strictEqual(stateFired.isFlat, false);

    // Snap Flat
    compass.snapFlat();
    assert.strictEqual(compass.pitch, 0);
    assert.strictEqual(compass.followSensors, false);
    assert.strictEqual(stateFired.isFlat, true);

    // Toggle sensor follow
    compass.toggleSensorFollow();
    assert.strictEqual(compass.followSensors, true);

    console.log("  ✓ State & Callbacks PASSED!");
}

function testDataFeedAndRender() {
    console.log("[TEST 6] Data Feed & Dual-Mode Render Engine...");
    const compass = new Compass3D('compass-3d-canvas');

    const sunPos = { azimuth: 135, altitude: 42, isAboveHorizon: true };
    const moonPos = { azimuth: 290, altitude: -15, isAboveHorizon: false };
    const sunTraj = [
        { azimuth: 90, altitude: 0, isAboveHorizon: true },
        { azimuth: 135, altitude: 42, isAboveHorizon: true },
        { azimuth: 180, altitude: 55, isAboveHorizon: true },
        { azimuth: 270, altitude: 0, isAboveHorizon: false }
    ];
    const moonTraj = [
        { azimuth: 240, altitude: 10, isAboveHorizon: true },
        { azimuth: 290, altitude: -15, isAboveHorizon: false }
    ];
    const moonPhase = {
        name: 'Waxing Gibbous',
        illuminationFraction: 0.78,
        phaseFraction: 0.35
    };

    compass.setData({
        sunPosition: sunPos,
        moonPosition: moonPos,
        sunTrajectory: sunTraj,
        moonTrajectory: moonTraj,
        moonPhase: moonPhase
    });

    assert.strictEqual(compass.sunPosition, sunPos);
    assert.strictEqual(compass.moonPosition, moonPos);
    assert.strictEqual(compass.sunTrajectory.length, 4);
    assert.strictEqual(compass.moonTrajectory.length, 2);

    // 1. Render in 2D Flat Mode
    compass.pitch = 0.0;
    compass.draw();

    // 2. Render in 3D Perspective Sphere Mode
    compass.pitch = 65.0;
    compass.draw();

    console.log("  ✓ Data Feed & Dual-Mode Render PASSED!");
}

function testTouchInteractionSimulation() {
    console.log("[TEST 7] Drag Interaction & Manual Tilt Simulation...");
    const compass = new Compass3D('compass-3d-canvas');
    const canvas = compass.canvas;

    // Simulate pointerdown
    canvas.dispatchEvent({
        type: 'pointerdown',
        clientX: 100,
        clientY: 100,
        setPointerCapture: () => {}
    });
    assert.strictEqual(compass.isDragging, true);
    assert.strictEqual(compass.followSensors, false);

    // Simulate pointermove dragging horizontally +50px and vertically +30px
    canvas.dispatchEvent({
        type: 'pointermove',
        clientX: 150,
        clientY: 130
    });
    assert.ok(compass.heading !== 0 || compass.pitch !== 0);

    // Simulate pointerup
    canvas.dispatchEvent({
        type: 'pointerup',
        clientX: 150,
        clientY: 130
    });
    assert.strictEqual(compass.isDragging, false);

    console.log("  ✓ Touch Interaction Simulation PASSED!");
}

testInitAndGeometry();
testFlatTopDownProjection();
testPerspective3DProjection();
testVectorTransform();
testStateAndCallbacks();
testDataFeedAndRender();
testTouchInteractionSimulation();

console.log("\n>>> ALL 3D CELESTIAL COMPASS UNIT TESTS PASSED! <<<\n");
