/**
 * ARView - Augmented Reality Camera & Celestial Sky Projection Engine
 * Projects Sun and Moon trajectories onto live video stream or 360° virtual dome
 * with quaternion sensor fusion, true 3D pinhole camera projection, and SLERP smoothing.
 */

import { OrientationFusion } from './orientation_fusion.js';
import { quatRotate, enuVectorFromAzAlt, shortestAngleDeg } from './quat.js';

export class ARView {
    constructor(canvasId, videoId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById(videoId);

        // State
        this.cameraActive = false;
        this.stream = null;
        this.facingMode = 'environment'; // Back camera

        // Sensor Fusion Engine
        this.fusion = new OrientationFusion();

        // Base Camera Field of View (horizontal degrees for virtual 360° mode)
        this.fovH = 65.0;

        // Manual drag fallback (when gyro or camera is inactive/desktop)
        this.isDragging = false;
        this.lastPointerX = 0;
        this.lastPointerY = 0;

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
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.resize());
        }
    }

    // Dynamic Getters/Setters for compatibility with UI callers
    get heading() { return this.fusion.heading; }
    set heading(val) { this.fusion.manualHeading = val; }

    get pitch() { return this.fusion.pitch; }
    set pitch(val) { this.fusion.manualPitch = val; }

    get roll() { return this.fusion.roll; }

    get gyroAvailable() { return this.fusion.gyroAvailable; }
    get compassUnavailable() { return !this.fusion.compassAvailable; }

    get calibrationOffset() { return this.fusion.calibrationOffset; }
    set calibrationOffset(val) { this.fusion.calibrationOffset = val; }

    get showSun() { return this.showSunPath; }
    set showSun(val) { this.showSunPath = val; }
    get showMoon() { return this.showMoonPath; }
    set showMoon(val) { this.showMoonPath = val; }

    initEvents() {
        // Drag to rotate sky (Desktop / fallback / manual nudge)
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

            const f_px = this.getFocalLengthPixels();
            // Convert pixel displacement to angular rotation
            const dHeading = Math.atan2(dx, f_px) * (180.0 / Math.PI);
            const dPitch = Math.atan2(dy, f_px) * (180.0 / Math.PI);

            if (this.fusion.gyroAvailable) {
                // In gyro mode, dragging nudges yaw offset
                this.fusion.nudgeYaw(dHeading);
            } else {
                // In desktop mode, rotate heading and pitch directly
                const newH = (this.fusion.manualHeading - dHeading + 360.0) % 360.0;
                const newP = Math.max(-85.0, Math.min(85.0, this.fusion.manualPitch + dPitch));
                this.fusion.setManualPose(newH, newP);
            }
        });

        window.addEventListener('pointerup', () => {
            this.isDragging = false;
        });

        window.addEventListener('pointercancel', () => {
            this.isDragging = false;
        });
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width || window.innerWidth;
        this.height = rect.height || window.innerHeight;
        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
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
        return await this.fusion.requestPermission();
    }

    /**
     * Computes the optical focal length in canvas pixels.
     * When camera is active, accurately matches the camera's physical sensor
     * aspect ratio and center-crop scale to eliminate drifting.
     */
    getFocalLengthPixels() {
        const vw = this.video?.videoWidth;
        const vh = this.video?.videoHeight;

        if (this.cameraActive && vw && vh) {
            // Standard smartphone main wide lens has ~68° FOV along the long sensor edge
            const fovMajorRad = (68.0 * Math.PI) / 180.0;
            const videoLong = Math.max(vw, vh);
            const f_video = (videoLong * 0.5) / Math.tan(fovMajorRad * 0.5);

            // Scale factor applied during cover-crop onto canvas
            const scale = Math.max(this.width / vw, this.height / vh);
            return f_video * scale;
        }

        // Virtual 360° dome fallback
        const fovRad = (this.fovH * Math.PI) / 180.0;
        return (this.width * 0.5) / Math.tan(fovRad * 0.5);
    }

    /**
     * Project spherical celestial coordinates (Azimuth, Altitude) to Screen (X, Y).
     * Uses true 3D pinhole camera perspective with quaternion rotation.
     *
     * @param {number} azimuth  - Compass azimuth degrees (0=N, 90=E, 180=S, 270=W)
     * @param {number} altitude - Altitude above horizon degrees (-90 to +90)
     * @returns {{ visible: boolean, x: number, y: number, z: number }}
     */
    projectToScreen(azimuth, altitude) {
        // 1. Convert celestial coordinates to 3D unit vector in ENU coordinates
        const vENU = enuVectorFromAzAlt(azimuth, altitude);

        // 2. Rotate into Camera coordinate frame using the inverse camera quaternion
        const invQ = this.fusion.getInverseQuaternion();
        const vCam = quatRotate(invQ, vENU);

        // 3. Camera coordinates (OpenCV pinhole convention):
        // X points right, Y points down, Z points forward (optical axis).
        // A point is visible only if it is in front of the camera plane (Z > 0.02)
        if (vCam[2] <= 0.02) {
            return { visible: false, x: 0, y: 0, z: vCam[2] };
        }

        const f_px = this.getFocalLengthPixels();
        const cx = this.width * 0.5;
        const cy = this.height * 0.5;

        const screenX = cx + f_px * (vCam[0] / vCam[2]);
        const screenY = cy + f_px * (vCam[1] / vCam[2]);

        // Boundary margin for smooth line transitions and pill labels
        const margin = 160;
        const visible = (
            screenX >= -margin && screenX <= this.width + margin &&
            screenY >= -margin && screenY <= this.height + margin
        );

        return { visible, x: screenX, y: screenY, z: vCam[2] };
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
            sx = (vw - sw) * 0.5;
        } else {
            sh = vw / canvasAspect;
            sy = (vh - sh) * 0.5;
        }

        this.ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, this.width, this.height);
    }

    render() {
        // Smoothly update orientation quaternion via SLERP
        this.fusion.update();

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // 1. Background video stream or virtual sky dome
        if (this.cameraActive && this.video && this.video.readyState >= 2) {
            this.drawVideoFrame();
        } else {
            this.drawSimulatedSky();
        }

        // 2. Grid, Horizon, and Cardinal tape
        if (this.showGrid) {
            this.drawHorizonAndPitchLadder();
            this.drawCompassTape();
        }

        // 3. Trajectories
        if (this.showSunPath && this.sunTrajectory.length > 0) {
            this.drawTrajectory(this.sunTrajectory, '#ffb703', 'rgba(251, 133, 0, 0.4)', 'sun');
        }

        if (this.showMoonPath && this.moonTrajectory.length > 0) {
            this.drawTrajectory(this.moonTrajectory, '#38bdf8', 'rgba(129, 140, 248, 0.4)', 'moon');
        }

        // 4. Current Sun and Moon discs
        if (this.showSunPath && this.sunPosition) {
            this.drawSun(this.sunPosition);
        }

        if (this.showMoonPath && this.moonPosition && this.moonPhase) {
            this.drawMoon(this.moonPosition, this.moonPhase);
        }

        // 5. Center Reticle HUD
        this.drawReticle();
    }

    drawSimulatedSky() {
        const ctx = this.ctx;
        const horizonProj = this.projectToScreen(this.heading, 0);
        const horizonY = horizonProj.visible ? horizonProj.y : (this.height * 0.5);

        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
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

        const pitchSteps = [0, 15, 30, 45, 60, -15, -30];

        for (const p of pitchSteps) {
            if (Math.abs(p - this.pitch) > 75) continue;

            const isZero = (p === 0);
            ctx.beginPath();
            ctx.strokeStyle = isZero ? 'rgba(56, 189, 248, 0.85)' : 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = isZero ? 2 : 1;
            if (!isZero) ctx.setLineDash([4, 6]);
            else ctx.setLineDash([]);

            // Sample altitude circle across visible azimuth span in 3D
            const span = 85.0;
            let firstPt = true;
            for (let d = -span; d <= span; d += 3.5) {
                const az = (this.heading + d + 3600.0) % 360.0;
                const pt = this.projectToScreen(az, p);
                if (pt.visible) {
                    if (firstPt) {
                        ctx.moveTo(pt.x, pt.y);
                        firstPt = false;
                    } else {
                        ctx.lineTo(pt.x, pt.y);
                    }
                } else {
                    firstPt = true;
                }
            }
            ctx.stroke();

            // Label
            const labelAz = (this.heading - 35.0 + 3600.0) % 360.0;
            const labelPt = this.projectToScreen(labelAz, p);
            if (labelPt.visible) {
                if (isZero) {
                    ctx.fillStyle = 'rgba(56, 189, 248, 0.95)';
                    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
                    ctx.fillText('HORIZON 0°', Math.max(16, labelPt.x), labelPt.y - 6);
                } else if (Math.abs(p) <= 45) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
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

        const f_px = this.getFocalLengthPixels();
        const cx = this.width * 0.5;

        // Draw ticks every 10 degrees along top compass tape
        for (let az = 0; az < 360; az += 10) {
            const dAz = shortestAngleDeg(az, this.heading);
            if (Math.abs(dAz) > 55.0) continue;

            const x = cx + f_px * Math.tan(dAz * (Math.PI / 180.0));
            if (x < -20 || x > this.width + 20) continue;

            const isMajor = (az % 30 === 0);
            ctx.beginPath();
            ctx.strokeStyle = isMajor ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = isMajor ? 1.5 : 1;
            ctx.moveTo(x, tapeY);
            ctx.lineTo(x, tapeY + (isMajor ? 12 : 6));
            ctx.stroke();

            if (isMajor && az % 90 !== 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${az}°`, x, tapeY + 22);
            }
        }

        // Draw Cardinal labels
        for (const dir of directions) {
            const dAz = shortestAngleDeg(dir.az, this.heading);
            if (Math.abs(dAz) > 55.0) continue;

            const x = cx + f_px * Math.tan(dAz * (Math.PI / 180.0));
            if (x < -20 || x > this.width + 20) continue;

            ctx.fillStyle = dir.color || '#ffffff';
            ctx.font = dir.major ? 'bold 13px system-ui' : '11px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(dir.label, x, tapeY - 6);
        }

        // Heading digital readout
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(this.heading)}°`, cx, tapeY + 28);

        // Compass status warnings
        if (this.compassUnavailable) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            ctx.font = '600 11px system-ui, sans-serif';
            ctx.fillText('⚠ Drag to Aim / Gyro Calibrating', cx, tapeY + 44);
        } else if (this.fusion.compassAccuracy !== null && this.fusion.compassAccuracy > 25) {
            ctx.fillStyle = 'rgba(251, 146, 60, 0.9)';
            ctx.font = '600 11px system-ui, sans-serif';
            ctx.fillText('⚠ Low Compass Accuracy (Wave in ∞)', cx, tapeY + 44);
        }

        ctx.restore();
    }

    drawTrajectory(points, colorMain, colorGlow, type) {
        if (!points || points.length === 0) return;
        const ctx = this.ctx;
        ctx.save();

        // 1. Draw smooth curve segments
        let isDrawing = false;
        let lastProj = null;

        ctx.beginPath();
        for (let i = 0; i < points.length; ++i) {
            const pt = points[i];
            const proj = this.projectToScreen(pt.azimuth, pt.altitude);

            if (proj.visible) {
                if (!isDrawing) {
                    ctx.moveTo(proj.x, proj.y);
                    isDrawing = true;
                } else {
                    // Check if gap is unreasonably large across screen boundary
                    if (lastProj && Math.hypot(proj.x - lastProj.x, proj.y - lastProj.y) > this.width * 0.9) {
                        ctx.moveTo(proj.x, proj.y);
                    } else {
                        ctx.lineTo(proj.x, proj.y);
                    }
                }
                lastProj = proj;
            } else {
                isDrawing = false;
                lastProj = null;
            }
        }

        // Neon Glow Pass (GPU performant: two-stroke pass instead of shadowBlur)
        ctx.strokeStyle = colorGlow;
        ctx.lineWidth = (type === 'sun') ? 7 : 6;
        ctx.stroke();

        // Core Line Pass
        ctx.strokeStyle = colorMain;
        ctx.lineWidth = (type === 'sun') ? 3 : 2.5;
        if (type === 'moon') ctx.setLineDash([6, 5]);
        ctx.stroke();

        // 2. Draw Hourly Time Markers
        if (this.showTimeLabels) {
            ctx.setLineDash([]);
            for (let i = 0; i < points.length; ++i) {
                const pt = points[i];
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
                    const pillX = proj.x - textWidth * 0.5 - 4;
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
        this.roundRect(ctx, x - tw * 0.5 - 8, y + radius + 14, tw + 16, 20, 6);
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

        // Lunar aura
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
        this.roundRect(ctx, x - tw * 0.5 - 8, y + radius + 12, tw + 16, 20, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(tag, x, y + radius + 26);

        ctx.restore();
    }

    drawReticle() {
        const ctx = this.ctx;
        const cx = this.width * 0.5;
        const cy = this.height * 0.5;
        const radius = 28;
        ctx.save();

        // Outer compass ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // North indicator needle pointing toward North
        const northAngle = (-this.heading - this.roll) * (Math.PI / 180.0);
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
            const rot = (c.angle - this.heading - this.roll) * (Math.PI / 180.0);
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
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, width, height, radius);
            return;
        }
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
