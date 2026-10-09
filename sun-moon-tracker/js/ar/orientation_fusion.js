/**
 * orientation_fusion.js - High-Performance Sensor Fusion & Orientation Engine for AR
 *
 * Fuses high-rate gyroscope readings with absolute compass references using:
 * 1. Single-source-of-truth sensor selection (AbsoluteOrientationSensor -> deviceorientationabsolute -> iOS webkitCompassHeading)
 * 2. 3D Camera-forward vector heading comparison (eliminating Euler gimbal & pitch coupling artifacts)
 * 3. Strict tilt & motion gating with slow exponential filter (freezing yaw during high pitch)
 * 4. Magnetic declination integration for true astronomical North alignment
 * 5. Adaptive quaternion SLERP smoothing with stationary deadband
 * 6. Detailed diagnostics and diagnostic logging for ?debug=1
 */

import {
    quatIdentity,
    quatFromAxisAngle,
    quatMultiply,
    quatInverse,
    quatSlerp,
    quatNormalize,
    quatFromW3CEuler,
    quatFromHeadingPitch,
    quatGetHeadingPitchRoll,
    shortestAngleDeg
} from './quat.js';

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

export class OrientationFusion {
    constructor() {
        // Sensor state
        this.gyroAvailable = false;
        this.compassAvailable = false;
        this.compassAccuracy = null; // degrees (null if unknown)
        this.activeSource = 'none'; // 'generic-sensor' | 'dev-orient-absolute' | 'ios-compass' | 'relative' | 'manual'
        
        // Calibration & magnetic declination
        this.calibrationOffset = 0.0; // Manual user adjustment degrees
        this.declination = 0.0;       // Magnetic declination (deg) from location
        
        // Raw sensor readings
        this._rawAlpha = 0.0;
        this._rawBeta = 90.0; // Default upright portrait
        this._rawGamma = 0.0;
        this._lastEventTime = 0;
        this._eventCount = 0;
        this._eventRateHz = 0;
        this._lastRateCheckTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        this._screenAngle = 0;

        // Yaw Complementary Filter
        this._yawOffset = 0.0; // Degrees added to relative yaw around Earth Z
        this._yawOffsetInitialized = false;
        this._yawFilterTau = 10.0; // Slow correction time constant (seconds)
        this._yawInitCount = 0;
        this._prevHeading = 180.0;
        this._angularVelocityH = 0.0; // Est. heading angular velocity in deg/s

        // Quaternions
        this._targetQuat = quatFromHeadingPitch(180, 10);
        this._currentQuat = quatFromHeadingPitch(180, 10);
        this._invCurrentQuat = quatInverse(this._currentQuat);
        this._initializedFirstQuat = false;

        // Adaptive smoothing parameters
        this._smoothTauMin = 0.030; // 30ms during fast intentional motion
        this._smoothTauMax = 0.180; // 180ms when stationary (eliminates hand shake)
        this._deadbandDeg = 0.10;   // Angular threshold to eliminate static jitter
        this._lastUpdateTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        // Derived Euler readouts (for HUD and UI)
        this.heading = 180.0;
        this.pitch = 10.0;
        this.roll = 0.0;
        this.deviceTilt = 80.0;
        this.compassHeading = 180.0;

        // Manual drag fallback (when sensors unavailable or desktop)
        this.manualHeading = 180.0;
        this.manualPitch = 10.0;

        // Generic Sensor API instance
        this._absoluteSensor = null;

        // Diagnostics ring buffer (records last 30s of telemetry for ?debug=1)
        this._diagLog = [];
        this._diagLogMax = 600; // ~10-20 seconds at 30-60Hz

        // Event handler bindings
        this._boundOrientationHandler = (e) => this.handleDeviceOrientation(e);
        this._boundOrientationAbsoluteHandler = (e) => this.handleDeviceOrientationAbsolute(e);
        this._boundScreenAngleHandler = () => this.updateScreenAngle();

        this.updateScreenAngle();
        if (typeof window !== 'undefined') {
            window.addEventListener('orientationchange', this._boundScreenAngleHandler);
            if (window.screen?.orientation) {
                window.screen.orientation.addEventListener('change', this._boundScreenAngleHandler);
            }
        }
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this._yawInitCount = 0;
                }
            });
        }
    }

    setDeclination(declinationDeg) {
        if (typeof declinationDeg === 'number' && !isNaN(declinationDeg)) {
            this.declination = declinationDeg;
        }
    }

    updateScreenAngle() {
        if (typeof window === 'undefined') return;
        if (window.screen?.orientation?.angle !== undefined) {
            this._screenAngle = window.screen.orientation.angle;
        } else if (typeof window.orientation === 'number') {
            this._screenAngle = window.orientation;
        } else {
            this._screenAngle = 0;
        }
    }

    async requestPermission() {
        // iOS 13+ permission flow
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    this.attachListeners();
                    return true;
                }
                console.warn("DeviceOrientation permission not granted:", response);
                return false;
            } catch (err) {
                console.warn("DeviceOrientation permission error:", err);
                return false;
            }
        } else {
            // Android / Standard Browsers
            await this._tryInitGenericSensors();
            this.attachListeners();
            return true;
        }
    }

    async _tryInitGenericSensors() {
        if (typeof window === 'undefined' || !('AbsoluteOrientationSensor' in window)) {
            return false;
        }

        try {
            // Check permissions if Permissions API is supported
            if (navigator.permissions) {
                const results = await Promise.allSettled([
                    navigator.permissions.query({ name: 'accelerometer' }),
                    navigator.permissions.query({ name: 'magnetometer' }),
                    navigator.permissions.query({ name: 'gyroscope' })
                ]);
                const anyDenied = results.some(r => r.status === 'fulfilled' && r.value.state === 'denied');
                if (anyDenied) return false;
            }

            const sensor = new window.AbsoluteOrientationSensor({ frequency: 60, referenceFrame: 'screen' });
            sensor.addEventListener('reading', () => {
                this.activeSource = 'generic-sensor';
                this.gyroAvailable = true;
                this.compassAvailable = true;
                this.compassAccuracy = 5.0; // Hardware-fused sensor accuracy
                this._onGenericSensorReading(sensor.quaternion);
            });
            sensor.addEventListener('error', (e) => {
                console.warn("AbsoluteOrientationSensor error:", e.error);
                this._stopGenericSensor();
            });

            sensor.start();
            this._absoluteSensor = sensor;
            return true;
        } catch (e) {
            console.warn("Generic Sensor API init failed, using standard events:", e);
            return false;
        }
    }

    _stopGenericSensor() {
        if (this._absoluteSensor) {
            try { this._absoluteSensor.stop(); } catch (_) {}
            this._absoluteSensor = null;
        }
    }

    _onGenericSensorReading(sensorQuat) {
        if (!sensorQuat || sensorQuat.length < 4) return;
        this._recordEventHz();

        // AbsoluteOrientationSensor gives [x, y, z, w] representing device screen frame to East-North-Up Earth frame
        // Coordinate conversion: Sensor screen frame has X right, Y up, Z front (out of screen).
        // Camera frame (OpenCV): X right, Y down, Z forward (out back).
        // Rotation: 180° around X axis = [1, 0, 0, 0].
        const qScreenDev = [sensorQuat[0], sensorQuat[1], sensorQuat[2], sensorQuat[3]];
        
        // Apply magnetic declination + user calibration offset around Earth Z
        // Note: Earth Z points Up in ENU, so clockwise heading change requires negative Z rotation
        const totalYawDeg = this.declination + this.calibrationOffset;
        let qTarget;
        if (Math.abs(totalYawDeg) > 0.01) {
            const qYaw = quatFromAxisAngle([0, 0, 1], - totalYawDeg * DEG2RAD);
            const qAligned = quatMultiply(qYaw, qScreenDev);
            qTarget = quatMultiply(qAligned, [1, 0, 0, 0]);
        } else {
            qTarget = quatMultiply(qScreenDev, [1, 0, 0, 0]);
        }

        this._targetQuat = quatNormalize(qTarget);
    }

    attachListeners() {
        if (this._listenersAttached || typeof window === 'undefined') return;
        this._listenersAttached = true;

        // If AbsoluteOrientationSensor is already running, skip attaching conflicting listeners
        if (this._absoluteSensor) return;

        // Check if deviceorientationabsolute is available (Standard Android Chrome for absolute North)
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', this._boundOrientationAbsoluteHandler, true);
        }
        // General deviceorientation (iOS or relative fallback)
        window.addEventListener('deviceorientation', this._boundOrientationHandler, true);
    }

    detachListeners() {
        if (!this._listenersAttached || typeof window === 'undefined') return;
        this._listenersAttached = false;
        this._stopGenericSensor();
        window.removeEventListener('deviceorientationabsolute', this._boundOrientationAbsoluteHandler, true);
        window.removeEventListener('deviceorientation', this._boundOrientationHandler, true);
    }

    _recordEventHz() {
        this._eventCount++;
        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        if (now - this._lastRateCheckTime >= 1000) {
            this._eventRateHz = Math.round((this._eventCount * 1000) / (now - this._lastRateCheckTime));
            this._eventCount = 0;
            this._lastRateCheckTime = now;
        }
    }

    /**
     * Handler for Android Chrome deviceorientationabsolute.
     * Takes precedence over relative deviceorientation to prevent frame-flipping.
     */
    handleDeviceOrientationAbsolute(e) {
        if (e.alpha === null || e.beta === null || e.gamma === null) return;
        this._recordEventHz();
        this.activeSource = 'dev-orient-absolute';
        this.gyroAvailable = true;
        this.compassAvailable = true;
        this.compassAccuracy = 10.0;

        this._rawAlpha = e.alpha;
        this._rawBeta = e.beta;
        this._rawGamma = e.gamma;

        // In deviceorientationabsolute, alpha is referenced directly to magnetic North.
        // Yaw offset combines magnetic declination and user calibration offset.
        this._yawOffset = this.declination + this.calibrationOffset;
        this._yawOffsetInitialized = true;

        this._computeTargetQuat();
    }

    /**
     * Handler for deviceorientation (iOS or relative fallback).
     */
    handleDeviceOrientation(e) {
        // If an absolute source (Generic Sensor or deviceorientationabsolute) is active,
        // IGNORE relative events to prevent alternating reference frames and jitter!
        if (this.activeSource === 'generic-sensor' || this.activeSource === 'dev-orient-absolute') {
            return;
        }

        if (e.alpha === null && e.beta === null && e.gamma === null && e.webkitCompassHeading === undefined) {
            return;
        }
        this._recordEventHz();
        this.gyroAvailable = true;

        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const dt = (this._lastEventTime > 0) ? Math.max(0.001, (now - this._lastEventTime) / 1000.0) : 0.016;
        this._lastEventTime = now;

        this._rawAlpha = (e.alpha !== null && !isNaN(e.alpha)) ? e.alpha : 0;
        this._rawBeta = (e.beta !== null && !isNaN(e.beta)) ? e.beta : 90;
        this._rawGamma = (e.gamma !== null && !isNaN(e.gamma)) ? e.gamma : 0;

        const isIOS = (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null && !isNaN(e.webkitCompassHeading));

        if (isIOS) {
            this.activeSource = 'ios-compass';
            this.compassAvailable = true;
            this.compassAccuracy = (typeof e.webkitCompassAccuracy === 'number') ? e.webkitCompassAccuracy : 15.0;

            // Compute raw relative camera quaternion with zero yaw offset
            const qW3C = quatFromW3CEuler(this._rawAlpha, this._rawBeta, this._rawGamma);
            const qScreen = quatFromAxisAngle([0, 0, 1], -this._screenAngle * DEG2RAD);
            const qRawCam = quatMultiply(quatMultiply(qW3C, qScreen), [1, 0, 0, 0]);
            const relEuler = quatGetHeadingPitchRoll(qRawCam);
            const relCamHeading = relEuler.heading;

            // Track angular velocity of camera rotation
            const dH = shortestAngleDeg(this.heading, this._prevHeading);
            this._prevHeading = this.heading;
            const instantSpeed = Math.abs(dH) / dt;
            this._angularVelocityH = this._angularVelocityH * 0.8 + instantSpeed * 0.2;

            // Measured true heading: webkitCompassHeading + screen rotation + magnetic declination + user trim
            const measCompassHeading = (e.webkitCompassHeading + this._screenAngle + this.declination + this.calibrationOffset + 3600.0) % 360.0;
            
            // True yaw offset is the angular difference between measured heading and relative camera heading
            // Note: heading is clockwise from North, so a rotation around Z counter-clockwise needs negative sign
            const currentDelta = shortestAngleDeg(measCompassHeading, relCamHeading);

            if (!this._yawOffsetInitialized) {
                // Initial sample snaps to compass
                this._yawOffset = currentDelta;
                this._yawOffsetInitialized = true;
                this._yawInitTime = now;
            } else {
                // Strict Gating:
                // Magnetometer tilt compensation is only reliable when phone is reasonably level.
                // When looking high up into sky or down, FREEZE yawOffset and rely entirely on gyroscope!
                const pitchModerate = (Math.abs(this.pitch) <= 35.0);
                const rollModerate = (Math.abs(this.roll) <= 20.0);
                const motionStable = (this._angularVelocityH < 15.0);
                const accuracyGood = (this.compassAccuracy <= 25.0);

                if (pitchModerate && rollModerate && motionStable && accuracyGood) {
                    const diff = shortestAngleDeg(currentDelta, this._yawOffset);
                    // Outlier rejection: if compass jump is huge (>25°), dampen heavily
                    if (Math.abs(diff) < 25.0) {
                        const effectiveTau = (now - (this._yawInitTime || now) < 2000) ? 0.8 : this._yawFilterTau;
                        const alphaFilter = 1.0 - Math.exp(-dt / effectiveTau);
                        this._yawOffset = (this._yawOffset + diff * alphaFilter + 360.0) % 360.0;
                    }
                }
            }
        } else if (e.absolute) {
            this.activeSource = 'dev-orient-absolute';
            this.compassAvailable = true;
            this.compassAccuracy = 10.0;
            this._yawOffset = this.declination + this.calibrationOffset;
            this._yawOffsetInitialized = true;
        } else {
            this.activeSource = 'relative';
            if (!this._yawOffsetInitialized) {
                this._yawOffset = this.calibrationOffset;
                this._yawOffsetInitialized = true;
            }
        }

        this._computeTargetQuat();
    }

    _computeTargetQuat() {
        if (!this.gyroAvailable) {
            // Desktop manual pose
            this.activeSource = 'manual';
            this._targetQuat = quatFromHeadingPitch(this.manualHeading, this.manualPitch);
            return;
        }

        // A. Base W3C quaternion from raw sensor angles
        const qW3C = quatFromW3CEuler(this._rawAlpha, this._rawBeta, this._rawGamma);

        // B. Apply calibrated Yaw Offset around Earth Z (East-North-Up vertical axis)
        const qYaw = quatFromAxisAngle([0, 0, 1], - this._yawOffset * DEG2RAD);
        const qAligned = quatMultiply(qYaw, qW3C);

        // C. Apply Screen Orientation rotation around screen normal Z
        const qScreen = quatFromAxisAngle([0, 0, 1], -this._screenAngle * DEG2RAD);
        const qScreenDev = quatMultiply(qAligned, qScreen);

        // D. Transform from screen/device frame to camera frame (180° around X axis)
        const qCamToDev = [1, 0, 0, 0];
        this._targetQuat = quatNormalize(quatMultiply(qScreenDev, qCamToDev));
    }

    /**
     * Called once per frame in requestAnimationFrame to smoothly interpolate
     * the camera orientation quaternion using adaptive time-based SLERP.
     */
    update(currentTime) {
        const now = currentTime || ((typeof performance !== 'undefined') ? performance.now() : Date.now());
        const dt = Math.max(0.001, Math.min(0.1, (now - this._lastUpdateTime) / 1000.0));
        this._lastUpdateTime = now;

        if (!this._initializedFirstQuat) {
            this._currentQuat = [...this._targetQuat];
            this._initializedFirstQuat = true;
        } else {
            // Adaptive SLERP smoothing based on estimated angular velocity:
            // Slower filter (more smoothing) when stationary to eliminate hand tremble;
            // Faster filter (near-instant response) during intentional camera sweeps.
            const speedT = Math.min(1.0, Math.max(0.0, (this._angularVelocityH - 3.0) / 25.0));
            const dynamicTau = this._smoothTauMax + (this._smoothTauMin - this._smoothTauMax) * speedT;
            const slerpT = 1.0 - Math.exp(-dt / dynamicTau);

            this._currentQuat = quatSlerp(this._currentQuat, this._targetQuat, slerpT);
        }

        this._invCurrentQuat = quatInverse(this._currentQuat);

        // Update derived Euler angles for HUD and UI
        const euler = quatGetHeadingPitchRoll(this._currentQuat);
        
        // Static deadband filter: ignore tiny sub-0.1° noise if camera is held still
        if (Math.abs(shortestAngleDeg(euler.heading, this.heading)) > this._deadbandDeg || this._angularVelocityH > 1.5) {
            this.heading = euler.heading;
        }
        if (Math.abs(euler.pitch - this.pitch) > this._deadbandDeg || this._angularVelocityH > 1.5) {
            this.pitch = euler.pitch;
        }
        if (Math.abs(euler.roll - this.roll) > this._deadbandDeg || this._angularVelocityH > 1.5) {
            this.roll = euler.roll;
        }

        this.deviceTilt = euler.deviceTilt;
        this.compassHeading = euler.compassHeading;

        // Record diagnostic sample for ?debug=1
        if (this._diagLog.length >= this._diagLogMax) {
            this._diagLog.shift();
        }
        this._diagLog.push({
            t: Math.round(now),
            src: this.activeSource,
            h: parseFloat(this.heading.toFixed(1)),
            p: parseFloat(this.pitch.toFixed(1)),
            r: parseFloat(this.roll.toFixed(1)),
            tilt: parseFloat(this.deviceTilt.toFixed(1)),
            ch: parseFloat(this.compassHeading.toFixed(1)),
            yawOff: parseFloat(this._yawOffset.toFixed(1)),
            acc: this.compassAccuracy
        });
    }

    /**
     * Nudge yaw offset manually (e.g. from user drag or calibration slider).
     */
    nudgeYaw(deltaHeadingDeg) {
        if (this.gyroAvailable) {
            this.calibrationOffset = (this.calibrationOffset + deltaHeadingDeg + 3600.0) % 360.0;
            this._yawOffset = this.declination + this.calibrationOffset;
            this._computeTargetQuat();
        } else {
            this.manualHeading = (this.manualHeading + deltaHeadingDeg + 360.0) % 360.0;
            this._computeTargetQuat();
        }
    }

    setManualPose(headingDeg, pitchDeg) {
        this.manualHeading = (headingDeg + 360.0) % 360.0;
        this.manualPitch = Math.max(-85.0, Math.min(85.0, pitchDeg));
        this._computeTargetQuat();
    }

    getQuaternion() {
        return this._currentQuat;
    }

    getInverseQuaternion() {
        return this._invCurrentQuat;
    }

    getDiagnostics() {
        return {
            source: this.activeSource,
            hz: this._eventRateHz,
            heading: this.heading,
            pitch: this.pitch,
            roll: this.roll,
            deviceTilt: this.deviceTilt,
            compassHeading: this.compassHeading,
            yawOffset: this._yawOffset,
            declination: this.declination,
            calibOffset: this.calibrationOffset,
            compassAccuracy: this.compassAccuracy,
            angularSpeed: this._angularVelocityH,
            rawAlpha: this._rawAlpha,
            rawBeta: this._rawBeta,
            rawGamma: this._rawGamma
        };
    }

    exportDiagLogCSV() {
        if (!this._diagLog.length) return "time,src,heading,pitch,roll,yawOffset,acc\n";
        const rows = ["time,src,heading,pitch,roll,yawOffset,acc"];
        for (const item of this._diagLog) {
            rows.push(`${item.t},${item.src},${item.h},${item.p},${item.r},${item.yawOff},${item.acc || ''}`);
        }
        return rows.join("\n");
    }

    reset() {
        this._yawOffsetInitialized = false;
        this._yawInitCount = 0;
        this._initializedFirstQuat = false;
        this._lastUpdateTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    }
}
