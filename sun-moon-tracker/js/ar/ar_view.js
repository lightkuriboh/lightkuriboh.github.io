/**
 * ARView - Augmented Reality Camera & Celestial Sky Projection Engine
 * Projects Sun and Moon trajectories onto live video stream or 360° virtual dome
 */

export class ARView {
    constructor(canvasId, videoId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById(videoId);

        // State
        this.cameraActive = false;
        this.stream = null;
        this.facingMode = 'environment'; // Back camera

        // Orientation angles (degrees)
        this.heading = 180; // Azimuth: 0 = N, 90 = E, 180 = S, 270 = W
        this.pitch = 10;    // Tilt: 0 = horizon, 90 = zenith (sky), -90 = nadir (ground)
        this.roll = 0;      // Bank rotation

        // Target angles for smooth interpolation
        this.targetHeading = 180;
        this.targetPitch = 10;
        this.targetRoll = 0;
        this.smoothingFactor = 0.18;
        this._compassInitialized = false; // snap on first valid compass reading

        // 3-Stage Multi-Stage Adaptive Smoothing Filter (Section 1.2)
        this.deadbandMin = 0.08;
        this.deadbandMax = 0.30;
        this.spikeRejectThreshold = 30.0;
        this.alphaMin = 0.06;
        this.alphaMax = 0.25;
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
        this.compassUnavailable = false; // Section 1.1-D1

        // Camera Field of View (horizontal degrees)
        this.fovH = 65.0; // Typical mobile wide lens
        this.calibrationOffset = 0.0; // Manual compass offset adjustment

        // Manual drag fallback (when gyro or camera is inactive/desktop)
        this.isDragging = false;
        this.lastPointerX = 0;
        this.lastPointerY = 0;
        this.gyroAvailable = false;

        // Overlays visibility
        this.showSunPath = true;
        this.showMoonPath = true;
        this.showGrid = true;
        this.showTimeLabels = true;

        // Ephemeris data to render
        this.sunPosition = null;
        this.moonPosition = null;
        this.moonPhase = null;
        this.sunTrajectory = [];
        this.moonTrajectory = [];
        this.currentTimeStr = "--:--";

        this.initEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    get showSun() { return this.showSunPath; }
    set showSun(val) { this.showSunPath = val; }
    get showMoon() { return this.showMoonPath; }
    set showMoon(val) { this.showMoonPath = val; }

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

            // Sensitivity: dragging full width rotates ~90 degrees
            const degPerPxX = this.fovH / (this.canvas.width || 1);
            const degPerPxY = (this.fovH * (this.canvas.height / (this.canvas.width || 1))) / (this.canvas.height || 1);

            this.targetHeading = (this.targetHeading - dx * degPerPxX + 360) % 360;
            this.targetPitch = Math.max(-85, Math.min(85, this.targetPitch + dy * degPerPxY));
            this.heading = this.targetHeading;
            this.pitch = this.targetPitch;
        });

        window.addEventListener('pointerup', () => {
            this.isDragging = false;
        });
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width || window.innerWidth;
        this.height = rect.height || window.innerHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
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
            this.video.srcObject = this.stream;
            await this.video.play();
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
        // iOS 13+ permission request
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    this.attachOrientationListeners();
                    return true;
                }
                console.warn("DeviceOrientation permission not granted:", response);
                return false;
            } catch (err) {
                console.warn("DeviceOrientation permission error:", err);
                return false;
            }
        } else {
            // Android & Desktop (no permission API needed)
            this.attachOrientationListeners();
            return true;
        }
    }

    attachOrientationListeners() {
        if (this._listenersAttached) return;
        this._listenersAttached = true;

        // Absolute orientation on Android
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', (e) => this.handleOrientation(e, true), true);
        }
        // Standard fallback (and iOS Safari)
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e, false), true);
    }

    handleOrientation(e, isAbsolute) {
        if (e.alpha === null && e.beta === null && e.gamma === null && e.webkitCompassHeading === undefined) return;
        this.gyroAvailable = true;

        let compassHeading = null;

        // iOS provides webkitCompassHeading directly (always North-referenced, 0=N, 90=E, 180=S, 270=W)
        if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null && !isNaN(e.webkitCompassHeading)) {
            compassHeading = e.webkitCompassHeading;
        } else if (isAbsolute || e.absolute) {
            // deviceorientationabsolute: alpha is measured clockwise from North
            if (e.alpha !== null && !isNaN(e.alpha)) {
                compassHeading = (360 - e.alpha) % 360;
            }
        } else if (e.alpha !== null && !isNaN(e.alpha)) {
            // Relative fallback
            compassHeading = (360 - e.alpha) % 360;
        }

        // Screen orientation angle (portrait = 0, landscape-left = 90, landscape-right = -90 / 270)
        const screenAngle = (window.screen?.orientation?.angle !== undefined)
            ? window.screen.orientation.angle
            : (window.orientation || 0);

        // Device upside-down mount detection
        const isUpsideDownNow = (window.orientation === 180 || (typeof screen !== 'undefined' && screen.orientation && screen.orientation.type === 'portrait-secondary'));
        if (this.isUpsideDown !== isUpsideDownNow) {
            this.isUpsideDown = isUpsideDownNow;
            this.heading = (this.heading + 180) % 360;
            this.targetHeading = (this.targetHeading + 180) % 360;
            this._prevRawHeading = (this._prevRawHeading + 180) % 360;
            this._candidateSpikeH = (this._candidateSpikeH + 180) % 360;
            this._spikeCountH = 0;
            this._prevVelocityH = 0;
        }

        if (compassHeading !== null) {
            this.compassUnavailable = false;
            // Adjust heading for landscape rotation and manual calibration
            let adjustedHeading = compassHeading + this.calibrationOffset;
            if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
                // On iOS, webkitCompassHeading is relative to device top; rotate if in landscape
                adjustedHeading += screenAngle;
            }
            if (this.isUpsideDown) {
                adjustedHeading = (adjustedHeading + 180) % 360;
            }
            adjustedHeading = (adjustedHeading + 3600) % 360;

            if (!this._compassInitialized) {
                this.heading = adjustedHeading;
                this.targetHeading = adjustedHeading;
                this._prevRawHeading = adjustedHeading;
                this._candidateSpikeH = adjustedHeading;
                this._compassInitialized = true;
            } else {
                this.targetHeading = adjustedHeading;
            }
        } else {
            this.compassUnavailable = true;
        }

        // Robust 3D Pitch & Roll Calculation
        // In the W3C device coordinate frame (+X right, +Y top, +Z screen outward):
        // Rear camera vector is [0, 0, -1].
        // When rotated by Tait-Bryan Z-X-Y angles (alpha, beta, gamma),
        // the world Z component of the rear camera vector is:
        // camZ = -cos(beta) * cos(gamma)
        // This is invariant to alpha and handles iOS Euler-angle inversions cleanly!
        const beta = e.beta || 0;
        const gamma = e.gamma || 0;
        const degToRad = Math.PI / 180.0;
        const radToDeg = 180.0 / Math.PI;

        const bRad = beta * degToRad;
        const gRad = gamma * degToRad;

        // World vertical component of the rear camera forward vector
        const camZ = -Math.cos(bRad) * Math.cos(gRad);
        const clampedZ = Math.max(-1.0, Math.min(1.0, camZ));
        let pitch = Math.asin(clampedZ) * radToDeg;
        if (this.isUpsideDown) {
            pitch = -pitch;
        }

        // Roll calculation around screen normal
        let roll = gamma;
        if (screenAngle === 90) {
            roll = beta - 90;
        } else if (screenAngle === -90 || screenAngle === 270) {
            roll = -(beta - 90);
        } else if (screenAngle === 180) {
            roll = -gamma;
        }

        this.targetPitch = Math.max(-85, Math.min(85, pitch));
        this.targetRoll = roll;
    }

    updateOrientationSmoothly() {
        if (!this.gyroAvailable) return;

        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        const dt = Math.max(0.005, (now - this._lastSmoothTime) / 1000.0);
        this._lastSmoothTime = now;

        // Stage 1: Jitter Gate on target angles (spike reject & deadband)
        let dRawH = this.targetHeading - this._prevRawHeading;
        while (dRawH > 180) dRawH -= 360;
        while (dRawH < -180) dRawH += 360;

        const dRawP = this.targetPitch - this._prevRawPitch;
        const dRawR = this.targetRoll - this._prevRawRoll;

        const instantSpeedH = Math.abs(dRawH) / dt;
        const instantSpeedP = Math.abs(dRawP) / dt;
        const instantSpeedR = Math.abs(dRawR) / dt;

        this._recentSpeedH = this._recentSpeedH * 0.8 + instantSpeedH * 0.2;
        this._recentSpeedP = this._recentSpeedP * 0.8 + instantSpeedP * 0.2;
        this._recentSpeedR = this._recentSpeedR * 0.8 + instantSpeedR * 0.2;

        // Heading spike rejection with re-acquisition
        let filteredTargetH = this.targetHeading;
        if (Math.abs(dRawH) > this.spikeRejectThreshold) {
            let dCandH = this.targetHeading - this._candidateSpikeH;
            while (dCandH > 180) dCandH -= 360;
            while (dCandH < -180) dCandH += 360;

            if (this._spikeCountH > 0 && Math.abs(dCandH) < 10.0) {
                this._spikeCountH++;
            } else {
                this._spikeCountH = 1;
                this._candidateSpikeH = this.targetHeading;
            }

            if (this._spikeCountH >= this.spikeConfirmCount) {
                filteredTargetH = this.targetHeading;
                this._prevRawHeading = this.targetHeading;
                this._spikeCountH = 0;
            } else {
                filteredTargetH = this._prevRawHeading;
            }
        } else {
            this._spikeCountH = 0;
            this._prevRawHeading = this.targetHeading;
        }

        // Pitch spike rejection with re-acquisition
        let filteredTargetP = this.targetPitch;
        if (Math.abs(dRawP) > this.spikeRejectThreshold) {
            const dCandP = Math.abs(this.targetPitch - this._candidateSpikeP);
            if (this._spikeCountP > 0 && dCandP < 10.0) {
                this._spikeCountP++;
            } else {
                this._spikeCountP = 1;
                this._candidateSpikeP = this.targetPitch;
            }

            if (this._spikeCountP >= this.spikeConfirmCount) {
                filteredTargetP = this.targetPitch;
                this._prevRawPitch = this.targetPitch;
                this._spikeCountP = 0;
            } else {
                filteredTargetP = this._prevRawPitch;
            }
        } else {
            this._spikeCountP = 0;
            this._prevRawPitch = this.targetPitch;
        }

        // Roll spike rejection with re-acquisition
        let filteredTargetR = this.targetRoll;
        if (Math.abs(dRawR) > this.spikeRejectThreshold) {
            const dCandR = Math.abs(this.targetRoll - this._candidateSpikeR);
            if (this._spikeCountR > 0 && dCandR < 10.0) {
                this._spikeCountR++;
            } else {
                this._spikeCountR = 1;
                this._candidateSpikeR = this.targetRoll;
            }

            if (this._spikeCountR >= this.spikeConfirmCount) {
                filteredTargetR = this.targetRoll;
                this._prevRawRoll = this.targetRoll;
                this._spikeCountR = 0;
            } else {
                filteredTargetR = this._prevRawRoll;
            }
        } else {
            this._spikeCountR = 0;
            this._prevRawRoll = this.targetRoll;
        }

        // Per-axis Adaptive Deadband
        const speedNormH = Math.min(1.0, Math.max(0.0, this._recentSpeedH / 5.0));
        const speedNormP = Math.min(1.0, Math.max(0.0, this._recentSpeedP / 5.0));
        const speedNormR = Math.min(1.0, Math.max(0.0, this._recentSpeedR / 5.0));

        const deadbandH = this.deadbandMax + (this.deadbandMin - this.deadbandMax) * speedNormH;
        const deadbandP = this.deadbandMax + (this.deadbandMin - this.deadbandMax) * speedNormP;
        const deadbandR = this.deadbandMax + (this.deadbandMin - this.deadbandMax) * speedNormR;

        let dSmoothedH = filteredTargetH - this.heading;
        while (dSmoothedH > 180) dSmoothedH -= 360;
        while (dSmoothedH < -180) dSmoothedH += 360;

        if (Math.abs(dSmoothedH) < deadbandH) {
            filteredTargetH = this.heading;
            dSmoothedH = 0;
        }
        if (Math.abs(filteredTargetP - this.pitch) < deadbandP) {
            filteredTargetP = this.pitch;
        }
        if (Math.abs(filteredTargetR - this.roll) < deadbandR) {
            filteredTargetR = this.roll;
        }

        // Stage 2: Adaptive EMA per-axis
        const tH = Math.min(1.0, Math.max(0.0, (this._recentSpeedH - this.velocityLow) / (this.velocityHigh - this.velocityLow)));
        const tP = Math.min(1.0, Math.max(0.0, (this._recentSpeedP - this.velocityLow) / (this.velocityHigh - this.velocityLow)));
        const tR = Math.min(1.0, Math.max(0.0, (this._recentSpeedR - this.velocityLow) / (this.velocityHigh - this.velocityLow)));

        const alphaH = this.alphaMin + (this.alphaMax - this.alphaMin) * tH;
        const alphaP = this.alphaMin + (this.alphaMax - this.alphaMin) * tP;
        const alphaR = this.alphaMin + (this.alphaMax - this.alphaMin) * tR;

        let velH = dSmoothedH * alphaH;
        let velP = (filteredTargetP - this.pitch) * alphaP;
        let velR = (filteredTargetR - this.roll) * alphaR;

        // Stage 3: Velocity Damping (overshoot prevention)
        if (this._prevVelocityH !== 0 && (velH > 0) !== (this._prevVelocityH > 0)) {
            velH *= this.overshootDamp;
        }
        if (this._prevVelocityP !== 0 && (velP > 0) !== (this._prevVelocityP > 0)) {
            velP *= this.overshootDamp;
        }
        if (this._prevVelocityR !== 0 && (velR > 0) !== (this._prevVelocityR > 0)) {
            velR *= this.overshootDamp;
        }

        this._prevVelocityH = velH;
        this._prevVelocityP = velP;
        this._prevVelocityR = velR;

        this.heading = (this.heading + velH + 360) % 360;
        this.pitch = Math.max(-85, Math.min(85, this.pitch + velP));
        this.roll = Math.max(-90, Math.min(90, this.roll + velR));
    }

    /**
     * Project spherical coordinates (Azimuth, Altitude) to Screen (X, Y)
     * Uses true pinhole perspective with square pixels
     */
    projectToScreen(azimuth, altitude) {
        // Delta azimuth relative to camera heading
        let dAz = azimuth - this.heading;
        while (dAz > 180) dAz -= 360;
        while (dAz < -180) dAz += 360;

        // Delta altitude relative to camera pitch
        const dAlt = altitude - this.pitch;

        // Check if point is behind camera (> 95° away in azimuth or altitude)
        if (Math.abs(dAz) > 95 || Math.abs(dAlt) > 85) {
            return { visible: false, x: 0, y: 0 };
        }

        const fovH_rad = (this.fovH * Math.PI) / 180.0;
        const dAz_rad = (dAz * Math.PI) / 180.0;
        const dAlt_rad = (dAlt * Math.PI) / 180.0;

        // Physical focal length in pixels: f_px = (width / 2) / tan(fovH / 2)
        const f_px = (this.width / 2.0) / Math.tan(fovH_rad / 2.0);

        // Convert to canvas pixels (screen center = (width/2, height/2))
        let screenX = (this.width / 2.0) + f_px * Math.tan(dAz_rad);
        let screenY = (this.height / 2.0) - f_px * Math.tan(dAlt_rad);

        // Apply roll rotation if phone is tilted horizontally
        if (Math.abs(this.roll) > 1.0) {
            const rollRad = (this.roll * Math.PI) / 180.0;
            const cx = this.width / 2.0;
            const cy = this.height / 2.0;
            const dx = screenX - cx;
            const dy = screenY - cy;
            screenX = cx + dx * Math.cos(-rollRad) - dy * Math.sin(-rollRad);
            screenY = cy + dx * Math.sin(-rollRad) + dy * Math.cos(-rollRad);
        }

        // Visible if roughly within bounds (+ margin for smooth line transitions & tags)
        const margin = 160;
        const visible = (screenX >= -margin && screenX <= this.width + margin &&
                         screenY >= -margin && screenY <= this.height + margin);

        return { visible, x: screenX, y: screenY, dAz, dAlt };
    }

    drawVideoFrame() {
        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;
        if (!vw || !vh) {
            this.drawSimulatedSky();
            return;
        }

        // Center-crop "cover" to fill the canvas without aspect ratio distortion
        const videoAspect = vw / vh;
        const canvasAspect = this.width / this.height;
        let sx = 0, sy = 0, sw = vw, sh = vh;

        if (videoAspect > canvasAspect) {
            sw = vh * canvasAspect;
            sx = (vw - sw) / 2.0;
        } else {
            sh = vw / canvasAspect;
            sy = (vh - sh) / 2.0;
        }

        this.ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, this.width, this.height);
    }

    render() {
        this.updateOrientationSmoothly();
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // If camera is ON and has decoded frames, draw video feed directly onto the canvas.
        // This guarantees the celestial lines & HUD are ALWAYS rendered on top of the camera feed
        // and cannot be occluded by iOS Safari native AVPlayer compositor layers!
        if (this.cameraActive && this.video && this.video.readyState >= 2) {
            this.drawVideoFrame();
        } else {
            this.drawSimulatedSky();
        }

        // 1. Grid, Horizon, and Cardinal tape
        if (this.showGrid) {
            this.drawHorizonAndPitchLadder();
            this.drawCompassTape();
        }

        // 2. Trajectories
        if (this.showSunPath && this.sunTrajectory.length > 0) {
            this.drawTrajectory(this.sunTrajectory, '#ffb703', '#fb8500', 'sun');
        }

        if (this.showMoonPath && this.moonTrajectory.length > 0) {
            this.drawTrajectory(this.moonTrajectory, '#38bdf8', '#818cf8', 'moon');
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
        // Pitch-dependent sky gradient
        const horizonProj = this.projectToScreen(this.heading, 0);
        const horizonY = horizonProj.y;

        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        // Deep obsidian indigo night fading to twilight at horizon
        grad.addColorStop(0, '#040711');
        grad.addColorStop(0.45, '#0a1428');
        grad.addColorStop(0.55, '#122344');
        grad.addColorStop(1, '#050b14');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Ground shading below horizon
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

        // Draw pitch lines at 0° (Horizon), +15°, +30°, +45°, +60°
        const pitchSteps = [0, 15, 30, 45, 60, -15, -30];

        for (const p of pitchSteps) {
            // Only draw if within reasonable viewing range
            if (Math.abs(p - this.pitch) > 75) continue;

            const isZero = (p === 0);
            ctx.beginPath();
            ctx.strokeStyle = isZero ? 'rgba(56, 189, 248, 0.75)' : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = isZero ? 2 : 1;
            if (!isZero) ctx.setLineDash([4, 6]);
            else ctx.setLineDash([]);

            // Sample line across current FOV + extra margin for roll
            const span = this.fovH * 0.9;
            let firstPt = true;
            for (let d = -span; d <= span; d += span / 4) {
                const az = (this.heading + d + 3600) % 360;
                const pt = this.projectToScreen(az, p);
                if (firstPt) {
                    ctx.moveTo(pt.x, pt.y);
                    firstPt = false;
                } else {
                    ctx.lineTo(pt.x, pt.y);
                }
            }
            ctx.stroke();

            // Label
            const labelAz = (this.heading - this.fovH * 0.42 + 3600) % 360;
            const labelPt = this.projectToScreen(labelAz, p);
            if (labelPt.visible) {
                if (isZero) {
                    ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
                    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
                    ctx.fillText('HORIZON 0°', Math.max(16, labelPt.x), labelPt.y - 6);
                } else if (Math.abs(p) <= 45) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.font = '500 10px monospace';
                    ctx.fillText(`${p > 0 ? '+' : ''}${p}°`, Math.max(16, labelPt.x), labelPt.y - 4);
                }
            }
        }
        ctx.restore();
    }

    drawCompassTape() {
        const ctx = this.ctx;
        ctx.save();

        const tapeY = 32;
        const directions = [
            { label: 'N', az: 0, major: true, color: '#f43f5e' },
            { label: 'NE', az: 45, major: false },
            { label: 'E', az: 90, major: true, color: '#38bdf8' },
            { label: 'SE', az: 135, major: false },
            { label: 'S', az: 180, major: true, color: '#ffb703' },
            { label: 'SW', az: 225, major: false },
            { label: 'W', az: 270, major: true, color: '#38bdf8' },
            { label: 'NW', az: 315, major: false },
        ];

        // Draw ticks every 10 degrees
        for (let az = 0; az < 360; az += 10) {
            const proj = this.projectToScreen(az, this.pitch);
            if (!proj.visible) continue;

            const isMajor = (az % 30 === 0);
            ctx.beginPath();
            ctx.strokeStyle = isMajor ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = isMajor ? 1.5 : 1;
            ctx.moveTo(proj.x, tapeY);
            ctx.lineTo(proj.x, tapeY + (isMajor ? 12 : 6));
            ctx.stroke();

            if (isMajor && az % 90 !== 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${az}°`, proj.x, tapeY + 22);
            }
        }

        // Draw Cardinal labels
        for (const dir of directions) {
            const proj = this.projectToScreen(dir.az, this.pitch);
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

    drawTrajectory(points, colorMain, colorGlow, type) {
        if (!points || points.length === 0) return;
        const ctx = this.ctx;
        ctx.save();

        // 1. Draw glowing curve segments
        ctx.beginPath();
        let isDrawing = false;
        let lastPt = null;
        let lastProj = null;

        for (let i = 0; i < points.length; ++i) {
            const pt = points[i];
            const proj = this.projectToScreen(pt.azimuth, pt.altitude);

            if (proj.visible) {
                let wrapped = false;
                if (lastPt) {
                    let dAzDiff = Math.abs(pt.azimuth - lastPt.azimuth);
                    if (dAzDiff > 180) dAzDiff = 360 - dAzDiff;
                    // Detect boundary wrap jumps
                    if (dAzDiff > 30 || (lastProj && Math.hypot(proj.x - lastProj.x, proj.y - lastProj.y) > Math.hypot(this.width, this.height) * 0.95)) {
                        wrapped = true;
                    }
                }

                if (!isDrawing || wrapped) {
                    ctx.moveTo(proj.x, proj.y);
                    isDrawing = true;
                } else {
                    ctx.lineTo(proj.x, proj.y);
                }
                lastProj = proj;
            } else {
                isDrawing = false;
                lastProj = null;
            }
            lastPt = pt;
        }

        ctx.strokeStyle = colorMain;
        ctx.lineWidth = (type === 'sun') ? 3 : 2.5;
        if (type === 'moon') ctx.setLineDash([6, 5]);
        ctx.shadowColor = colorGlow;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 2. Draw Hourly Time Markers
        if (this.showTimeLabels) {
            ctx.setLineDash([]);
            for (let i = 0; i < points.length; ++i) {
                const pt = points[i];
                // Show markers every hour or at 2-hour intervals
                if (pt.minute === 0 && pt.hour % 2 === 0) {
                    const proj = this.projectToScreen(pt.azimuth, pt.altitude);
                    if (!proj.visible) continue;

                    // Tick dot
                    ctx.beginPath();
                    ctx.arc(proj.x, proj.y, 4, 0, 2 * Math.PI);
                    ctx.fillStyle = pt.isAboveHorizon ? colorMain : 'rgba(255, 255, 255, 0.4)';
                    ctx.fill();

                    // Pill label
                    const label = pt.timeStr;
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
            }
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

        // Sun readout tag
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

        // Dark side background
        ctx.fillStyle = '#1e293b';
        ctx.fill();

        // Illuminated crescent/gibbous
        ctx.fillStyle = '#e2e8f0';
        const illum = phase.illuminationFraction;
        const isWaxing = phase.phaseFraction < 0.5;

        ctx.beginPath();
        if (isWaxing) {
            // Bright on the right
            ctx.arc(x, y, radius, -Math.PI / 2, Math.PI / 2, false);
            const w = radius * (2 * illum - 1);
            ctx.ellipse(x, y, Math.abs(w), radius, 0, Math.PI / 2, -Math.PI / 2, w < 0);
        } else {
            // Bright on the left
            ctx.arc(x, y, radius, Math.PI / 2, -Math.PI / 2, false);
            const w = radius * (2 * illum - 1);
            ctx.ellipse(x, y, Math.abs(w), radius, 0, -Math.PI / 2, Math.PI / 2, w < 0);
        }
        ctx.fill();
        ctx.restore();

        // Moon rim stroke
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Moon readout tag
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

        // Outer compass ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // North indicator needle (pointing toward true/magnetic North)
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

        // Cardinal markers (N, E, S, W)
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

        // Center crosshair ticks
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
        ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
        ctx.stroke();

        // Numeric heading readout
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
