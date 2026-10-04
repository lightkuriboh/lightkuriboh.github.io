/**
 * ARView - Augmented Reality Camera & Stable Sky Sphere Projection Engine
 * 
 * Features:
 * - Decoupled Architecture: Static 3D Sky Sphere (Slow Path) + Free Camera Observer (Fast Path, 60/120 Hz)
 * - Zero Zenith Gimbal Lock: Direct quaternion & 3x3 View Matrix pipeline without Euler singularity
 * - Platform Sensor Fusion: Android Generic Sensor API (AbsoluteOrientationSensor) & iOS WebKit CoreMotion
 * - Near-Plane Frustum Clipping: Eliminates edge wrapping, jagged artifacts, and divide-by-zero
 */

import { Vec3, Quat, Mat3, FrustumClipper } from './math3d.js';
import { SkySphere } from './sky_sphere.js';

export class ARView {
    constructor(canvasId, videoId) {
        this.canvas = (typeof document !== 'undefined' && canvasId) ? document.getElementById(canvasId) : null;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.video = (typeof document !== 'undefined' && videoId) ? document.getElementById(videoId) : null;

        // State
        this.cameraActive = false;
        this.stream = null;
        this.facingMode = 'environment'; // Back camera

        // Stable Sky Sphere Static Geometry & Cache
        this.skySphere = new SkySphere();

        // 3D Camera Orientation & Matrices
        this.cameraQuat = Quat.create(0, 0, 0, 1);
        this.targetQuat = Quat.create(0, 0, 0, 1);
        this.viewMatrix = Mat3.create();
        this._tempV = Vec3.create();
        this._pCam1 = Vec3.create();
        this._pCam2 = Vec3.create();

        // Orientation angles (degrees) - preserved for UI readouts & manual drag
        this.heading = 180; // Azimuth: 0 = N, 90 = E, 180 = S, 270 = W
        this.pitch = 10;    // Tilt: 0 = horizon, 90 = zenith (sky), -90 = nadir (ground)
        this.roll = 0;      // Bank rotation

        // Target angles for smooth interpolation
        this.targetHeading = 180;
        this.targetPitch = 10;
        this.targetRoll = 0;
        this.smoothingFactor = 0.18;
        this._compassInitialized = false;

        // Adaptive smoothing state
        this.deadbandMin = 0.08;
        this.deadbandMax = 0.30;
        this.spikeRejectThreshold = 30.0;
        this.alphaMin = 0.06;
        this.alphaMax = 0.28;
        this.velocityLow = 2.0;
        this.velocityHigh = 15.0;
        this.overshootDamp = 0.5;

        this._prevRawHeading = 180;
        this._prevRawPitch = 10;
        this._prevRawRoll = 0;
        this._prevVelocityH = 0;
        this._prevVelocityP = 0;
        this._prevVelocityR = 0;
        this._recentSpeedH = 0;
        this._recentSpeedP = 0;
        this._recentSpeedR = 0;
        this.spikeConfirmCount = 3;
        this._spikeCountH = 0;
        this._candidateSpikeH = 180;
        this._spikeCountP = 0;
        this._candidateSpikeP = 10;
        this._spikeCountR = 0;
        this._candidateSpikeR = 0;
        this.isUpsideDown = false;
        this._lastSmoothTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        this.compassUnavailable = false;

        // Camera Field of View (horizontal degrees)
        this.fovH = 65.0;
        this.calibrationOffset = 0.0; // Manual compass offset adjustment

        // Manual drag fallback (when gyro or camera is inactive/desktop)
        this.isDragging = false;
        this.lastPointerX = 0;
        this.lastPointerY = 0;
        this.gyroAvailable = false;
        this.usingAbsoluteSensor = false;

        // Overlays visibility
        this.showSunPath = true;
        this.showMoonPath = true;
        this.showGrid = true;
        this.showTimeLabels = true;

        // Ephemeris data
        this.sunPosition = null;
        this.moonPosition = null;
        this.moonPhase = null;
        this._sunTrajectory = [];
        this._moonTrajectory = [];
        this.currentTimeStr = "--:--";

        // Initialize camera orientation from starting angles
        this.syncQuatFromEuler();

        if (this.canvas) {
            this.initEvents();
            this.resize();
            window.addEventListener('resize', () => this.resize());
        }
    }

    get sunTrajectory() { return this._sunTrajectory; }
    set sunTrajectory(val) {
        this._sunTrajectory = val || [];
        this.skySphere.updateTrajectories(this._sunTrajectory, this._moonTrajectory);
    }

    get moonTrajectory() { return this._moonTrajectory; }
    set moonTrajectory(val) {
        this._moonTrajectory = val || [];
        this.skySphere.updateTrajectories(this._sunTrajectory, this._moonTrajectory);
    }

    get showSun() { return this.showSunPath; }
    set showSun(val) { this.showSunPath = val; }
    get showMoon() { return this.showMoonPath; }
    set showMoon(val) { this.showMoonPath = val; }

    syncQuatFromEuler() {
        Quat.fromHeadingPitchRoll(this.targetQuat, this.targetHeading, this.targetPitch, this.targetRoll);
        Quat.copy(this.cameraQuat, this.targetQuat);
        Mat3.fromHeadingPitchRoll(this.viewMatrix, this.heading, this.pitch, this.roll);
    }

    initEvents() {
        // Drag to rotate sky (Desktop / fallback)
        this.canvas.addEventListener('pointerdown', (e) => {
            this.isDragging = true;
            this.lastPointerX = e.clientX;
            this.lastPointerY = e.clientY;
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastPointerX;
            const dy = e.clientY - this.lastPointerY;
            this.lastPointerX = e.clientX;
            this.lastPointerY = e.clientY;

            const degPerPxX = this.fovH / (this.canvas.width || 1);
            const degPerPxY = (this.fovH * (this.canvas.height / (this.canvas.width || 1))) / (this.canvas.height || 1);

            this.targetHeading = (this.targetHeading - dx * degPerPxX + 360) % 360;
            this.targetPitch = Math.max(-89.5, Math.min(89.5, this.targetPitch + dy * degPerPxY));
            this.heading = this.targetHeading;
            this.pitch = this.targetPitch;

            Quat.fromHeadingPitchRoll(this.targetQuat, this.targetHeading, this.targetPitch, this.targetRoll);
            Quat.copy(this.cameraQuat, this.targetQuat);
            Mat3.fromHeadingPitchRoll(this.viewMatrix, this.heading, this.pitch, this.roll);
        });

        window.addEventListener('pointerup', () => {
            this.isDragging = false;
        });
    }

    resize() {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width || window.innerWidth;
        this.height = rect.height || window.innerHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        if (this.ctx) {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(dpr, dpr);
        }
    }

    async startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera API not supported on this browser.");
        }

        if (this.stream) {
            this.stopCamera();
        }

        try {
            const constraints = {
                video: {
                    facingMode: { ideal: this.facingMode },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (this.video) {
                this.video.srcObject = this.stream;
                await this.video.play();
            }
            this.cameraActive = true;
            return true;
        } catch (err) {
            console.warn("Camera start failed:", err);
            this.cameraActive = false;
            throw err;
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        this.cameraActive = false;
    }

    async requestDeviceOrientation() {
        // 1. Android: Try W3C Generic Sensor API (AbsoluteOrientationSensor)
        if (typeof window !== 'undefined' && 'AbsoluteOrientationSensor' in window) {
            try {
                // @ts-ignore
                const sensor = new AbsoluteOrientationSensor({ frequency: 60, referenceFrame: 'device' });
                sensor.addEventListener('reading', () => {
                    this.gyroAvailable = true;
                    this.usingAbsoluteSensor = true;
                    this.compassUnavailable = false;
                    const q = sensor.quaternion; // [x, y, z, w]
                    this.handleAbsoluteQuaternion(q[0], q[1], q[2], q[3]);
                });
                sensor.addEventListener('error', (event) => {
                    console.warn("AbsoluteOrientationSensor error:", event.error);
                    this.attachDeviceOrientationFallback();
                });
                sensor.start();
                return true;
            } catch (err) {
                console.warn("Could not start AbsoluteOrientationSensor:", err);
            }
        }

        // 2. iOS 13+ permission request
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    this.attachDeviceOrientationFallback();
                    return true;
                }
                return false;
            } catch (err) {
                console.warn("DeviceOrientation permission error:", err);
                return false;
            }
        } else {
            // Android & Desktop Fallback
            this.attachDeviceOrientationFallback();
            return true;
        }
    }

    attachDeviceOrientationFallback() {
        // Android deviceorientationabsolute
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', (e) => this.handleOrientation(e, true), true);
        }
        // Standard iOS & non-absolute fallback
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e, false), true);
    }

    /**
     * SENS-01: Direct Android Generic Sensor Quaternion Handler
     */
    handleAbsoluteQuaternion(qx, qy, qz, qw) {
        // Raw quaternion from Android sensor is in standard ENU reference frame
        Quat.set(this.targetQuat, qx, qy, qz, qw);

        // Derive approximate Euler angles for UI readouts
        const sinP = 2 * (qw * qy - qz * qx);
        if (Math.abs(sinP) >= 0.999) {
            this.pitch = Math.sign(sinP) * 90;
            this.heading = (2 * Math.atan2(qx, qw) * 180 / Math.PI + 360) % 360;
        } else {
            this.pitch = Math.asin(sinP) * 180 / Math.PI;
            this.heading = (Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) * 180 / Math.PI + 360) % 360;
        }
        this.targetHeading = this.heading;
        this.targetPitch = this.pitch;
    }

    /**
     * SENS-02: DeviceOrientation Event Handler (iOS Safari & Android fallback)
     */
    handleOrientation(e, isAbsolute) {
        if (e.alpha === null) return;
        this.gyroAvailable = true;

        let compassHeading = null;

        // iOS provides webkitCompassHeading directly (always North-referenced)
        if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
            compassHeading = e.webkitCompassHeading;
        } else if (isAbsolute || e.absolute) {
            compassHeading = (360 - e.alpha) % 360;
        } else {
            this.compassUnavailable = true;
        }

        const beta = e.beta || 0;
        const gamma = e.gamma || 0;

        let devicePitch = 0;

        if (window.orientation === 90 || window.orientation === -90) {
            devicePitch = gamma;
        } else {
            // Portrait: looking straight ahead is beta = 90, tilting to sky is beta > 90
            devicePitch = beta - 90;
        }

        if (compassHeading !== null) {
            this.compassUnavailable = false;
            compassHeading = (compassHeading + this.calibrationOffset + 360) % 360;
            this.targetHeading = compassHeading;
        }

        this.targetPitch = Math.max(-89.5, Math.min(89.5, devicePitch));
        this.targetRoll = Math.max(-90, Math.min(90, gamma));

        if (!this._compassInitialized && compassHeading !== null) {
            this.heading = this.targetHeading;
            this.pitch = this.targetPitch;
            this.roll = this.targetRoll;
            this._prevRawHeading = this.heading;
            this._prevRawPitch = this.pitch;
            this._prevRawRoll = this.roll;
            this._compassInitialized = true;
        }

        // Direct update of target quaternion without Euler singularity
        Quat.fromHeadingPitchRoll(this.targetQuat, this.targetHeading, this.targetPitch, this.targetRoll);
    }

    /**
     * SENS-03: Quaternion SLERP & Adaptive Smoothing Filter
     */
    updateOrientationSmoothly() {
        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const dt = Math.max(0.001, (now - this._lastSmoothTime) / 1000.0);
        this._lastSmoothTime = now;

        if (this.usingAbsoluteSensor) {
            // Absolute generic sensor: smooth using quaternion slerp directly
            Quat.slerp(this.cameraQuat, this.cameraQuat, this.targetQuat, 0.25);
            Mat3.fromQuat(this.viewMatrix, this.cameraQuat);
            return;
        }

        // Angular step
        let dH = this.targetHeading - this.heading;
        while (dH > 180) dH -= 360;
        while (dH < -180) dH += 360;

        const dP = this.targetPitch - this.pitch;
        const dR = this.targetRoll - this.roll;

        const speedH = Math.abs(dH) / dt;
        const speedP = Math.abs(dP) / dt;
        const speedR = Math.abs(dR) / dt;

        this._recentSpeedH = this._recentSpeedH * 0.8 + speedH * 0.2;
        this._recentSpeedP = this._recentSpeedP * 0.8 + speedP * 0.2;
        this._recentSpeedR = this._recentSpeedR * 0.8 + speedR * 0.2;

        const tH = Math.min(1.0, Math.max(0.0, (this._recentSpeedH - this.velocityLow) / (this.velocityHigh - this.velocityLow)));
        const tP = Math.min(1.0, Math.max(0.0, (this._recentSpeedP - this.velocityLow) / (this.velocityHigh - this.velocityLow)));
        const tR = Math.min(1.0, Math.max(0.0, (this._recentSpeedR - this.velocityLow) / (this.velocityHigh - this.velocityLow)));

        const alphaH = this.alphaMin + (this.alphaMax - this.alphaMin) * tH;
        const alphaP = this.alphaMin + (this.alphaMax - this.alphaMin) * tP;
        const alphaR = this.alphaMin + (this.alphaMax - this.alphaMin) * tR;

        this.heading = (this.heading + dH * alphaH + 360) % 360;
        this.pitch = Math.max(-89.5, Math.min(89.5, this.pitch + dP * alphaP));
        this.roll = Math.max(-90, Math.min(90, this.roll + dR * alphaR));

        // Reconstruct View Matrix from filtered angles with robust forward/up vectors
        Mat3.fromHeadingPitchRoll(this.viewMatrix, this.heading, this.pitch, this.roll);
    }

    /**
     * Project spherical coordinates (Azimuth, Altitude) to Screen (X, Y)
     * Fully backward compatible with existing tests and callers.
     */
    projectToScreen(azimuth, altitude) {
        Vec3.fromSphericalENU(this._tempV, azimuth, altitude);
        Mat3.multiplyVec3(this._pCam1, this.viewMatrix, this._tempV);
        return FrustumClipper.projectToScreen(this._pCam1, this.width, this.height, this.fovH);
    }

    /**
     * Fast-Path: Project 3D ENU unit vector directly to screen.
     */
    projectENUToScreen(vENU) {
        Mat3.multiplyVec3(this._pCam1, this.viewMatrix, vENU);
        return FrustumClipper.projectToScreen(this._pCam1, this.width, this.height, this.fovH);
    }

    /**
     * MATH-02 & VIEW-01: Draw pre-densified 3D line strip with near-plane frustum clipping.
     */
    drawClippedPolyline(pointsENU, colorMain, lineWidth, lineDash = [], glowColor = null) {
        if (!pointsENU || pointsENU.length < 2) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = colorMain;
        ctx.lineWidth = lineWidth;
        if (lineDash.length > 0) ctx.setLineDash(lineDash);
        if (glowColor) {
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 8;
        }

        const view = this.viewMatrix;
        const w = this.width;
        const h = this.height;
        const fov = this.fovH;

        for (let i = 0; i < pointsENU.length - 1; ++i) {
            const v1 = pointsENU[i];
            const v2 = pointsENU[i + 1];

            Mat3.multiplyVec3(this._pCam1, view, v1);
            Mat3.multiplyVec3(this._pCam2, view, v2);

            const clipped = FrustumClipper.clipLineSegment(this._pCam1, this._pCam2, 0.05);
            if (!clipped) continue;

            const s1 = FrustumClipper.projectToScreen(clipped[0], w, h, fov);
            const s2 = FrustumClipper.projectToScreen(clipped[1], w, h, fov);

            if (s1.visible || s2.visible) {
                ctx.moveTo(s1.x, s1.y);
                ctx.lineTo(s2.x, s2.y);
            }
        }

        ctx.stroke();
        ctx.restore();
    }

    render() {
        if (!this.ctx) return;
        this.updateOrientationSmoothly();
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // If camera is OFF, render simulated landscape sky dome background
        if (!this.cameraActive) {
            this.drawSimulatedSky();
        }

        // 1. Grid, Horizon, and Cardinal tape
        if (this.showGrid) {
            this.drawHorizonAndPitchLadder();
            this.drawCompassTape();
        }

        // 2. Trajectories from Static World Sky Sphere
        if (this.showSunPath && this.skySphere.sunCurve.length > 0) {
            this.drawClippedPolyline(this.skySphere.sunCurve, '#ffb703', 3, [], '#fb8500');
            this.drawHourlyMarkers(this.skySphere.sunHourlyMarkers, '#ffb703');
        }

        if (this.showMoonPath && this.skySphere.moonCurve.length > 0) {
            this.drawClippedPolyline(this.skySphere.moonCurve, '#38bdf8', 2.5, [6, 5], '#818cf8');
            this.drawHourlyMarkers(this.skySphere.moonHourlyMarkers, '#38bdf8');
        }

        // 3. Current Sun and Moon discs (only when active)
        if (this.showSunPath && this.sunPosition) {
            this.drawSun(this.sunPosition);
        }

        if (this.showMoonPath && this.moonPosition && this.moonPhase) {
            this.drawMoon(this.moonPosition, this.moonPhase);
        }

        // 4. Center Crosshair HUD
        this.drawReticle();
    }

    drawSimulatedSky() {
        const ctx = this.ctx;
        const horizonProj = this.projectToScreen(this.heading, 0);
        const horizonY = horizonProj.y;

        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, '#040711');
        grad.addColorStop(0.45, '#0a1428');
        grad.addColorStop(0.55, '#122344');
        grad.addColorStop(1, '#050b14');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        if (horizonY < this.height) {
            const groundGrad = ctx.createLinearGradient(0, Math.max(0, horizonY), 0, this.height);
            groundGrad.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
            groundGrad.addColorStop(1, 'rgba(5, 8, 16, 0.95)');
            ctx.fillStyle = groundGrad;
            ctx.fillRect(0, Math.max(0, horizonY), this.width, this.height - Math.max(0, horizonY));
        }
    }

    drawHorizonAndPitchLadder() {
        const ctx = this.ctx;
        ctx.save();

        // 1. Horizon Ring (Alt = 0°)
        this.drawClippedPolyline(this.skySphere.horizonRing, 'rgba(56, 189, 248, 0.65)', 2);

        // 2. Altitude Parallels
        for (const ring of this.skySphere.altitudeRings) {
            this.drawClippedPolyline(ring.points, 'rgba(255, 255, 255, 0.12)', 1, [4, 6]);
            // Draw altitude text label on the current view center line
            const proj = this.projectToScreen(this.heading, ring.altitude);
            if (proj.visible && Math.abs(ring.altitude) <= 45) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.font = '500 10px monospace';
                ctx.fillText(`${ring.altitude > 0 ? '+' : ''}${ring.altitude}°`, 20, proj.y - 4);
            }
        }

        // Horizon tag
        const hProj = this.projectToScreen(this.heading, 0);
        if (hProj.visible) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.font = '600 11px system-ui, -apple-system, sans-serif';
            ctx.fillText('HORIZON 0°', 16, hProj.y - 6);
        }

        ctx.restore();
    }

    drawCompassTape() {
        const ctx = this.ctx;
        ctx.save();

        const tapeY = 32;

        // Draw ticks from cached sky sphere
        for (const tick of this.skySphere.compassTicks) {
            const proj = this.projectENUToScreen(tick.enu);
            if (!proj.visible) continue;

            ctx.beginPath();
            ctx.strokeStyle = tick.isMajor ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = tick.isMajor ? 1.5 : 1;
            ctx.moveTo(proj.x, tapeY);
            ctx.lineTo(proj.x, tapeY + (tick.isMajor ? 12 : 6));
            ctx.stroke();

            if (tick.isMajor && tick.az % 90 !== 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${tick.az}°`, proj.x, tapeY + 22);
            }
        }

        // Draw Cardinal labels from cached geometry
        for (const dir of this.skySphere.cardinalMarkers) {
            const proj = this.projectENUToScreen(dir.enu);
            if (!proj.visible) continue;

            ctx.fillStyle = dir.color || '#ffffff';
            ctx.font = dir.major ? 'bold 13px system-ui' : '11px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(dir.label, proj.x, tapeY - 6);
        }

        // Heading digital readout
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(this.heading)}°`, this.width / 2, tapeY + 28);

        if (this.compassUnavailable) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            ctx.font = '600 11px system-ui, sans-serif';
            ctx.fillText('⚠ Compass Uncalibrated / Drag to Aim', this.width / 2, tapeY + 44);
        }

        ctx.restore();
    }

    drawHourlyMarkers(markers, colorMain) {
        if (!this.showTimeLabels || !markers || markers.length === 0) return;
        const ctx = this.ctx;
        ctx.save();

        for (const marker of markers) {
            const proj = this.projectENUToScreen(marker.enu);
            if (!proj.visible) continue;

            // Tick dot
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = marker.isAboveHorizon ? colorMain : 'rgba(255, 255, 255, 0.4)';
            ctx.fill();

            // Pill label
            const label = marker.timeStr;
            ctx.font = '600 10px monospace';
            const textWidth = ctx.measureText(label).width;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.strokeStyle = colorMain;
            ctx.lineWidth = 1;
            const pillX = proj.x - textWidth / 2 - 4;
            const pillY = proj.y - 20;

            this.roundRect(ctx, pillX, pillY, textWidth + 8, 15, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(label, proj.x, pillY + 11);
        }

        ctx.restore();
    }

    drawSun(sun) {
        const proj = this.projectToScreen(sun.azimuth, sun.altitude);
        if (!proj.visible) return;

        const ctx = this.ctx;
        ctx.save();

        const x = proj.x;
        const y = proj.y;
        const radius = 22;

        // Glowing corona
        const glow = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius * 3.5);
        glow.addColorStop(0, 'rgba(255, 241, 118, 0.9)');
        glow.addColorStop(0.3, 'rgba(255, 183, 3, 0.55)');
        glow.addColorStop(0.7, 'rgba(251, 133, 0, 0.2)');
        glow.addColorStop(1, 'rgba(251, 133, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius * 3.5, 0, 2 * Math.PI);
        ctx.fill();

        // Rays
        ctx.strokeStyle = 'rgba(255, 214, 10, 0.6)';
        ctx.lineWidth = 2;
        const rayLen = 10;
        for (let i = 0; i < 8; ++i) {
            const angle = (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * (radius + 4), y + Math.sin(angle) * (radius + 4));
            ctx.lineTo(x + Math.cos(angle) * (radius + 4 + rayLen), y + Math.sin(angle) * (radius + 4 + rayLen));
            ctx.stroke();
        }

        // Sun Core Disc
        const sunDisc = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, radius);
        sunDisc.addColorStop(0, '#ffffff');
        sunDisc.addColorStop(0.4, '#fff3b0');
        sunDisc.addColorStop(0.85, '#ffb703');
        sunDisc.addColorStop(1, '#fb8500');
        ctx.fillStyle = sunDisc;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();

        // Readout Tag
        const tag = `☀️ Sun ${this.currentTimeStr} | Alt ${Math.round(sun.altitude)}°`;
        ctx.font = '600 11px system-ui';
        const tw = ctx.measureText(tag).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = '#ffb703';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x - tw / 2 - 8, y + radius + 14, tw + 16, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(tag, x, y + radius + 28);

        ctx.restore();
    }

    drawMoon(moon, phase) {
        const proj = this.projectToScreen(moon.azimuth, moon.altitude);
        if (!proj.visible) return;

        const ctx = this.ctx;
        ctx.save();

        const x = proj.x;
        const y = proj.y;
        const radius = 20;

        // Ethereal lunar aura
        const glow = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius * 2.8);
        glow.addColorStop(0, 'rgba(129, 212, 250, 0.6)');
        glow.addColorStop(0.4, 'rgba(56, 189, 248, 0.25)');
        glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.8, 0, 2 * Math.PI);
        ctx.fill();

        // Draw Moon disc with accurate phase illumination
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.clip();

        ctx.fillStyle = '#1e293b';
        ctx.fill();

        ctx.fillStyle = '#e2e8f0';
        const illum = phase.illuminationFraction;
        const isWaxing = phase.phaseFraction < 0.5;

        ctx.beginPath();
        if (isWaxing) {
            ctx.arc(x, y, radius, -Math.PI / 2, Math.PI / 2, false);
            const w = radius * (2 * illum - 1);
            ctx.ellipse(x, y, Math.abs(w), radius, 0, Math.PI / 2, -Math.PI / 2, w < 0);
        } else {
            ctx.arc(x, y, radius, Math.PI / 2, -Math.PI / 2, false);
            const w = radius * (2 * illum - 1);
            ctx.ellipse(x, y, Math.abs(w), radius, 0, -Math.PI / 2, Math.PI / 2, w < 0);
        }
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();

        const tag = `${phase.icon} ${phase.name} ${phase.illuminationPercent}% | Alt ${Math.round(moon.altitude)}°`;
        ctx.font = '600 11px system-ui';
        const tw = ctx.measureText(tag).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x - tw / 2 - 8, y + radius + 12, tw + 16, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(tag, x, y + radius + 26);

        ctx.restore();
    }

    drawReticle() {
        const ctx = this.ctx;
        const cx = this.width / 2;
        const cy = this.height / 2;
        const radius = 28;
        ctx.save();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.stroke();

        const northAngle = -this.heading * Math.PI / 180.0;
        const tipX = cx + Math.sin(northAngle) * (radius - 2);
        const tipY = cy - Math.cos(northAngle) * (radius - 2);
        const base1X = cx + Math.sin(northAngle + 2.5) * 5;
        const base1Y = cy - Math.cos(northAngle + 2.5) * 5;
        const base2X = cx + Math.sin(northAngle - 2.5) * 5;
        const base2Y = cy - Math.cos(northAngle - 2.5) * 5;

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(base1X, base1Y);
        ctx.lineTo(base2X, base2Y);
        ctx.closePath();
        ctx.fill();

        const cardinals = [
            { label: 'N', angle: 0, color: '#f43f5e' },
            { label: 'E', angle: 90, color: '#ffffff' },
            { label: 'S', angle: 180, color: '#ffb703' },
            { label: 'W', angle: 270, color: '#ffffff' }
        ];

        ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        cardinals.forEach(c => {
            const rot = (c.angle - this.heading) * Math.PI / 180.0;
            const lx = cx + Math.sin(rot) * (radius + 9);
            const ly = cy - Math.cos(rot) * (radius + 9);
            ctx.fillStyle = c.color;
            ctx.fillText(c.label, lx, ly);
        });

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
        ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
        ctx.stroke();

        const cardinals16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const cardIdx = Math.floor(((this.heading + 11.25) % 360) / 22.5);
        const cardName = cardinals16[cardIdx];

        ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillText(`${Math.round(this.heading)}° ${cardName}`, cx, cy + radius + 15);

        ctx.restore();
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}
