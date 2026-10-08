/**
 * orientation_fusion.js - Sensor Fusion & Orientation Engine for AR
 *
 * Fuses high-rate, low-noise gyroscope readings with low-drift compass data
 * using a quaternion complementary filter. Solves iOS compass swimming and
 * Euler gimbal singularity near vertical phone poses.
 */

import {
    quatIdentity,
    quatFromAxisAngle,
    quatMultiply,
    quatInverse,
    quatSlerp,
    quatFromW3CEuler,
    quatFromHeadingPitch,
    quatGetHeadingPitchRoll,
    shortestAngleDeg
} from './quat.js';

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

export class OrientationFusion {
    constructor() {
        // State
        this.gyroAvailable = false;
        this.compassAvailable = false;
        this.compassAccuracy = null; // degrees (null if unknown)
        this.calibrationOffset = 0.0; // Manual user adjustment degrees

        // Raw sensor readings
        this._rawAlpha = 0.0;
        this._rawBeta = 90.0; // Default upright portrait
        this._rawGamma = 0.0;
        this._lastEventTime = 0;
        this._screenAngle = 0;

        // Yaw Complementary Filter
        this._yawOffset = 0.0; // Degrees added to raw alpha around Earth Z
        this._yawOffsetInitialized = false;
        this._yawFilterTau = 2.5; // Time constant (seconds) for compass slow correction
        this._prevRawAlpha = 0.0;
        this._angularVelocityH = 0.0; // Est. heading angular velocity in deg/s

        // Quaternions
        this._targetQuat = quatFromHeadingPitch(180, 10);
        this._currentQuat = quatFromHeadingPitch(180, 10);
        this._invCurrentQuat = quatInverse(this._currentQuat);

        // Smoothing parameters
        this._smoothTau = 0.040; // 40 ms time constant for SLERP (~25 Hz cutoff)
        this._lastUpdateTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();

        // Derived Euler readouts (for HUD and UI)
        this.heading = 180.0;
        this.pitch = 10.0;
        this.roll = 0.0;

        // Manual drag fallback (when sensors unavailable or on desktop)
        this.manualHeading = 180.0;
        this.manualPitch = 10.0;

        this._boundOrientationHandler = (e) => this.handleDeviceOrientation(e);
        this._boundOrientationAbsoluteHandler = (e) => this.handleDeviceOrientation(e, true);
        this._boundScreenAngleHandler = () => this.updateScreenAngle();

        this.updateScreenAngle();
        if (typeof window !== 'undefined') {
            window.addEventListener('orientationchange', this._boundScreenAngleHandler);
            if (window.screen?.orientation) {
                window.screen.orientation.addEventListener('change', this._boundScreenAngleHandler);
            }
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
            this.attachListeners();
            return true;
        }
    }

    attachListeners() {
        if (this._listenersAttached || typeof window === 'undefined') return;
        this._listenersAttached = true;

        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', this._boundOrientationAbsoluteHandler, true);
        }
        window.addEventListener('deviceorientation', this._boundOrientationHandler, true);
    }

    detachListeners() {
        if (!this._listenersAttached || typeof window === 'undefined') return;
        this._listenersAttached = false;
        window.removeEventListener('deviceorientationabsolute', this._boundOrientationAbsoluteHandler, true);
        window.removeEventListener('deviceorientation', this._boundOrientationHandler, true);
    }

    handleDeviceOrientation(e, isAbsolute = false) {
        if (e.alpha === null && e.beta === null && e.gamma === null && e.webkitCompassHeading === undefined) {
            return;
        }
        this.gyroAvailable = true;

        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const eventTime = e.timeStamp || now;
        const dt = (this._lastEventTime > 0) ? Math.max(0.001, (eventTime - this._lastEventTime) / 1000.0) : 0.016;
        this._lastEventTime = eventTime;

        this._rawAlpha = (e.alpha !== null && !isNaN(e.alpha)) ? e.alpha : 0;
        this._rawBeta = (e.beta !== null && !isNaN(e.beta)) ? e.beta : 90;
        this._rawGamma = (e.gamma !== null && !isNaN(e.gamma)) ? e.gamma : 0;

        // Track angular velocity around vertical axis
        const dAlpha = shortestAngleDeg(this._rawAlpha, this._prevRawAlpha);
        this._prevRawAlpha = this._rawAlpha;
        const instantSpeed = Math.abs(dAlpha) / dt;
        this._angularVelocityH = this._angularVelocityH * 0.8 + instantSpeed * 0.2;

        // 1. Process Yaw Reference (Compass vs Absolute Alpha)
        const isIOS = (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null && !isNaN(e.webkitCompassHeading));

        if (isIOS) {
            this.compassAvailable = true;
            this.compassAccuracy = (typeof e.webkitCompassAccuracy === 'number') ? e.webkitCompassAccuracy : null;

            // webkitCompassHeading is magnetic North-referenced heading of device top
            const compassHeading = e.webkitCompassHeading;
            // Adjust for screen orientation (landscape-left/right)
            const adjustedHeading = (compassHeading + this._screenAngle + this.calibrationOffset + 3600) % 360;
            // In W3C, absolute alpha = (360 - Heading)
            const targetAlpha = (360.0 - adjustedHeading + 360.0) % 360.0;
            const targetOffset = (targetAlpha - this._rawAlpha + 3600.0) % 360.0;

            if (!this._yawOffsetInitialized) {
                // First valid reading: snap yaw immediately
                this._yawOffset = targetOffset;
                this._yawOffsetInitialized = true;
            } else {
                // Filter compass updates:
                // Only update when compass accuracy is good, pitch is not extreme, and device isn't rotating rapidly
                const accuracyGood = (this.compassAccuracy === null || (this.compassAccuracy >= 0 && this.compassAccuracy <= 25.0));
                const pitchModerate = (Math.abs(this.pitch) < 70.0);
                const motionStable = (this._angularVelocityH < 35.0);

                if (accuracyGood && pitchModerate && motionStable) {
                    const diff = shortestAngleDeg(targetOffset, this._yawOffset);
                    const alphaFilter = 1.0 - Math.exp(-dt / this._yawFilterTau);
                    this._yawOffset = (this._yawOffset + diff * alphaFilter + 360.0) % 360.0;
                }
            }
        } else if (isAbsolute || e.absolute) {
            // Android deviceorientationabsolute: alpha is already absolute North-referenced
            this.compassAvailable = true;
            this.compassAccuracy = 10.0;
            // Yaw offset is purely the manual calibration offset
            this._yawOffset = this.calibrationOffset;
            this._yawOffsetInitialized = true;
        } else {
            // Relative fallback without compass
            if (!this._yawOffsetInitialized) {
                this._yawOffset = this.calibrationOffset;
                this._yawOffsetInitialized = true;
            }
        }

        // 2. Compute 3D Target Camera Quaternion
        this._computeTargetQuat();
    }

    _computeTargetQuat() {
        if (!this.gyroAvailable) {
            // Desktop manual pose
            this._targetQuat = quatFromHeadingPitch(this.manualHeading, this.manualPitch);
            return;
        }

        // A. Base W3C quaternion from raw sensor angles
        const qW3C = quatFromW3CEuler(this._rawAlpha, this._rawBeta, this._rawGamma);

        // B. Apply Yaw Offset around Earth Z (East-North-Up vertical axis)
        const qYaw = quatFromAxisAngle([0, 0, 1], this._yawOffset * DEG2RAD);
        const qAligned = quatMultiply(qYaw, qW3C);

        // C. Apply Screen Orientation rotation around screen normal Z
        const qScreen = quatFromAxisAngle([0, 0, 1], -this._screenAngle * DEG2RAD);
        const qScreenDev = quatMultiply(qAligned, qScreen);

        // D. Transform from screen/device frame to camera frame
        // In screen coordinates: X is right, Y is up, Z is out of screen (front).
        // Camera frame (OpenCV convention): X is right, Y is down, Z is forward (out the back).
        // Rotation: 180° around X axis = [1, 0, 0, 0].
        const qCamToDev = [1, 0, 0, 0];
        this._targetQuat = quatMultiply(qScreenDev, qCamToDev);
    }

    /**
     * Called once per frame in requestAnimationFrame to smoothly interpolate
     * the camera orientation quaternion using time-based SLERP.
     */
    update(currentTime) {
        const now = currentTime || ((typeof performance !== 'undefined') ? performance.now() : Date.now());
        const dt = Math.max(0.001, Math.min(0.1, (now - this._lastUpdateTime) / 1000.0));
        this._lastUpdateTime = now;

        if (!this._initializedFirstQuat) {
            this._currentQuat = [...this._targetQuat];
            this._initializedFirstQuat = true;
        } else {
            // Time-invariant SLERP parameter: t = 1 - exp(-dt / tau)
            const slerpT = 1.0 - Math.exp(-dt / this._smoothTau);
            this._currentQuat = quatSlerp(this._currentQuat, this._targetQuat, slerpT);
        }

        this._invCurrentQuat = quatInverse(this._currentQuat);

        // Update derived Euler angles for UI
        const euler = quatGetHeadingPitchRoll(this._currentQuat);
        this.heading = euler.heading;
        this.pitch = euler.pitch;
        this.roll = euler.roll;
    }

    /**
     * Nudge yaw offset manually (e.g. from desktop drag or calibration slider).
     */
    nudgeYaw(deltaHeadingDeg) {
        if (this.gyroAvailable) {
            // Invert delta because heading is clockwise while yaw around Z is counterclockwise
            this._yawOffset = (this._yawOffset - deltaHeadingDeg + 3600.0) % 360.0;
            this._computeTargetQuat();
        } else {
            this.manualHeading = (this.manualHeading + deltaHeadingDeg + 360.0) % 360.0;
            this._computeTargetQuat();
        }
    }

    /**
     * Sets manual pose for desktop dragging mode.
     */
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

    reset() {
        this._yawOffsetInitialized = false;
        this._initializedFirstQuat = false;
        this._lastUpdateTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    }
}
