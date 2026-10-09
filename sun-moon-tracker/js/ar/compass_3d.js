/**
 * Compass3D - 3D Celestial Compass Sphere Engine for Web PWA
 * Direct parity with Flutter Mobile App Compass3DView (mobile_app/lib/views/compass_3d_view.dart).
 * 
 * Renders an interactive 3D celestial sphere:
 * - When pitch = 0 (phone flat or 'Snap Flat' clicked): Top-down orthographic 2D compass view.
 * - When pitch > 0: Smoothly transitions into 3D perspective celestial sphere.
 * - Displays ground compass disc with N/E/S/W and tick marks, altitude circles, 
 *   3D Sun trajectory with hourly markers, 3D Moon trajectory with phase,
 *   direction needle, and live gyro/touch drag controls.
 */

export class Compass3D {
    constructor(canvasId = 'compass-3d-canvas', fusion = null) {
        this.canvas = (typeof document !== 'undefined' && canvasId) ? document.getElementById(canvasId) : null;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.fusion = fusion;

        // View angles (degrees)
        this.heading = 0.0; // 0 = North, 90 = East
        this.pitch = 28.0;  // 0 = top-down flat, 90 = side profile
        this.roll = 0.0;

        // Interaction state
        this.followSensors = true;
        this.isDragging = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._startHeading = 0;
        this._startPitch = 0;

        // Ephemeris Data
        this.sunPosition = null;
        this.moonPosition = null;
        this.sunTrajectory = [];
        this.moonTrajectory = [];
        this.moonPhase = null;

        // Visibility toggles
        this.showSun = true;
        this.showMoon = true;

        // Canvas dimensions
        this.width = 340;
        this.height = 340;

        if (this.canvas) {
            this.initEvents();
            this.resize();
        }
    }

    initEvents() {
        if (!this.canvas) return;

        // Pointer / touch drag interaction
        this.canvas.addEventListener('pointerdown', (e) => {
            this.isDragging = true;
            this.followSensors = false;
            this._dragStartX = e.clientX;
            this._dragStartY = e.clientY;
            this._startHeading = this.heading;
            this._startPitch = this.pitch;
            this.canvas.setPointerCapture?.(e.pointerId);
            this.dispatchStateChange();
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this._dragStartX;
            const dy = e.clientY - this._dragStartY;

            // Horizontal drag rotates heading (azimuth)
            let newH = (this._startHeading - dx * 0.5) % 360.0;
            if (newH < 0) newH += 360.0;
            this.heading = newH;

            // Vertical drag tilts pitch (0 = flat top-down, 85 = maximum side view)
            let newP = Math.max(0.0, Math.min(85.0, this._startPitch + dy * 0.4));
            this.pitch = newP;

            this.draw();
            this.dispatchStateChange();
        });

        const stopDrag = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.dispatchStateChange();
            }
        };

        this.canvas.addEventListener('pointerup', stopDrag);
        this.canvas.addEventListener('pointercancel', stopDrag);
        if (typeof window !== 'undefined') {
            window.addEventListener('pointerup', stopDrag);
            window.addEventListener('pointercancel', stopDrag);
        }
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(2.0, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
        this.width = rect.width || 340;
        this.height = rect.height || 340;
        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        if (this.ctx) {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(dpr, dpr);
        }
        this.draw();
    }

    setData({ sunPosition, moonPosition, sunTrajectory, moonTrajectory, moonPhase }) {
        if (sunPosition !== undefined) this.sunPosition = sunPosition;
        if (moonPosition !== undefined) this.moonPosition = moonPosition;
        if (sunTrajectory !== undefined) this.sunTrajectory = sunTrajectory || [];
        if (moonTrajectory !== undefined) this.moonTrajectory = moonTrajectory || [];
        if (moonPhase !== undefined) this.moonPhase = moonPhase;
        this.draw();
    }

    setPose(heading, pitch, roll) {
        if (this.followSensors && !this.isDragging) {
            this.heading = (heading + 360.0) % 360.0;
            // Map camera pitch (-90 to +90) to compass tilt (0 to 85)
            // When phone is upright portrait (pitch = 0 in camera space): compass tilt is ~75°
            // When phone lies flat face up (pitch = -90 or +90 in camera space): compass tilt is 0°
            if (pitch !== undefined) {
                const absTilt = Math.max(0.0, Math.min(85.0, Math.abs(pitch)));
                this.pitch = absTilt;
            }
            if (roll !== undefined) this.roll = roll;
            this.draw();
            this.dispatchStateChange();
        }
    }

    snapFlat() {
        this.followSensors = false;
        this.pitch = 0.0;
        this.roll = 0.0;
        this.draw();
        this.dispatchStateChange();
    }

    toggleSensorFollow() {
        this.followSensors = !this.followSensors;
        if (this.followSensors && this.fusion) {
            this.heading = this.fusion.heading;
        }
        this.draw();
        this.dispatchStateChange();
    }

    dispatchStateChange() {
        if (this.onStateChange) {
            this.onStateChange({
                heading: this.heading,
                pitch: this.pitch,
                roll: this.roll,
                followSensors: this.followSensors,
                isFlat: this.pitch < 2.0
            });
        }
    }

    /**
     * Converts spherical horizontal coordinates (Azimuth, Altitude) to 3D world vector (East, North, Up)
     * and transforms into screen space using heading, pitch, and roll.
     * Direct mathematical parity with Flutter Compass3DPainter._projectToScreen.
     */
    projectToScreen(azDeg, altDeg, center, radius) {
        center = center || { x: this.width / 2, y: this.height / 2 };
        radius = radius !== undefined ? radius : Math.min(this.width, this.height) * 0.42;

        const azR = azDeg * Math.PI / 180.0;
        const altR = altDeg * Math.PI / 180.0;

        // World ENU coordinates
        const x0 = Math.cos(altR) * Math.sin(azR); // East
        const y0 = Math.cos(altR) * Math.cos(azR); // North
        const z0 = Math.sin(altR);                 // Up

        return this.transformVec(x0, y0, z0, center, radius);
    }

    transformVec(x0, y0, z0, center, radius) {
        if (Array.isArray(x0)) {
            const arr = x0;
            x0 = arr[0];
            y0 = arr[1];
            z0 = arr[2];
        }
        center = center || { x: this.width / 2, y: this.height / 2 };
        radius = radius !== undefined ? radius : Math.min(this.width, this.height) * 0.42;

        // 1. Azimuth heading rotation around Z-axis (North aligns with heading)
        const hR = this.heading * Math.PI / 180.0;
        const cosH = Math.cos(hR);
        const sinH = Math.sin(hR);
        const x1 = x0 * cosH - y0 * sinH;
        const y1 = x0 * sinH + y0 * cosH;
        const z1 = z0;

        // 2. Pitch tilt around X-axis:
        // When pitch = 0 (flat): camera looks from Zenith (+Z) down to origin (top-down view)
        // As pitch increases toward 90°: camera tilts down to look from side
        const pR = this.pitch * Math.PI / 180.0;
        const cosP = Math.cos(pR);
        const sinP = Math.sin(pR);

        const x2 = x1;
        const y2 = y1 * cosP + z1 * sinP;
        const z2 = -y1 * sinP + z1 * cosP;

        // 3. Roll rotation around line of sight
        const rR = this.roll * Math.PI / 180.0;
        const cosR = Math.cos(rR);
        const sinR = Math.sin(rR);

        const x3 = x2 * cosR - y2 * sinR;
        const y3 = x2 * sinR + y2 * cosR;
        const z3 = z2;

        // Top-down / perspective mapping:
        // Weak perspective factor d / (d - z3 * factor)
        const pFactor = 1.0 / (1.0 + (1.0 - z3) * 0.15 * (this.pitch / 90.0));
        const sx = center.x + x3 * radius * pFactor;
        const sy = center.y - y3 * radius * pFactor;
        const isBehind = z3 < -0.15;
        const visible = true;

        return { x: sx, y: sy, z: z3, isBehind: isBehind, visible: visible, 0: x3, 1: y3, 2: z3 };
    }

    draw() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const cx = w * 0.5;
        const cy = h * 0.5;
        const center = { x: cx, y: cy };
        const radius = Math.min(w, h) * 0.40;

        ctx.clearRect(0, 0, w, h);

        // 1. Outer Celestial Sphere Wireframe / Glow
        ctx.save();
        const sphereGrad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius * 1.05);
        sphereGrad.addColorStop(0, 'rgba(15, 23, 42, 0.4)');
        sphereGrad.addColorStop(0.85, 'rgba(15, 23, 42, 0.8)');
        sphereGrad.addColorStop(1, 'rgba(30, 41, 59, 0.6)');
        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.02, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();

        // 2. Altitude Parallels (30° and 60° overhead circles)
        if (this.pitch > 3.0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.setLineDash([3, 4]);
            ctx.lineWidth = 1.0;

            [30, 60].forEach(alt => {
                ctx.beginPath();
                for (let a = 0; a <= 360; a += 6) {
                    const pt = this.projectToScreen(a, alt, center, radius);
                    if (a === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.closePath();
                ctx.stroke();
            });
            ctx.restore();
        }

        // 3. Ground Horizon Disc (alt = 0°)
        ctx.save();
        ctx.beginPath();
        for (let a = 0; a <= 360; a += 4) {
            const pt = this.projectToScreen(a, 0, center, radius);
            if (a === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        const discGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        discGrad.addColorStop(0, 'rgba(30, 41, 59, 0.5)');
        discGrad.addColorStop(1, 'rgba(15, 23, 42, 0.7)');
        ctx.fillStyle = discGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // 4. Compass Tick Marks & Cardinal Directions (N, E, S, W)
        ctx.save();
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let a = 0; a < 360; a += 15) {
            const isCardinal = (a % 90 === 0);
            const isMajor = (a % 45 === 0);
            const pOuter = this.projectToScreen(a, 0, center, radius);
            const tickInnerR = isCardinal ? 0.88 : (isMajor ? 0.92 : 0.95);
            const pInner = this.projectToScreen(a, 0, center, radius * tickInnerR);

            ctx.strokeStyle = isCardinal ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = isCardinal ? 2.0 : 1.0;
            ctx.beginPath();
            ctx.moveTo(pOuter.x, pOuter.y);
            ctx.lineTo(pInner.x, pInner.y);
            ctx.stroke();

            if (isCardinal) {
                const labelDist = radius * 0.78;
                const pLabel = this.projectToScreen(a, 0, center, labelDist);
                let text = 'N';
                let col = '#f43f5e'; // Red for North
                if (a === 90) { text = 'E'; col = '#ffffff'; }
                else if (a === 180) { text = 'S'; col = '#ffb703'; }
                else if (a === 270) { text = 'W'; col = '#ffffff'; }

                ctx.fillStyle = col;
                ctx.fillText(text, pLabel.x, pLabel.y);
            }
        }
        ctx.restore();

        // 5. Sun Trajectory Arc (3D path in celestial dome)
        if (this.showSun && this.sunTrajectory.length > 1) {
            this._drawTrajectoryArc(this.sunTrajectory, center, radius, '#ffb703', 'rgba(251, 133, 0, 0.35)', true);
        }

        // 6. Moon Trajectory Arc (3D path in celestial dome)
        if (this.showMoon && this.moonTrajectory.length > 1) {
            this._drawTrajectoryArc(this.moonTrajectory, center, radius, '#38bdf8', 'rgba(56, 189, 248, 0.35)', false);
        }

        // 7. Current Sun Marker
        if (this.showSun && this.sunPosition) {
            this._drawCelestialBody(this.sunPosition.azimuth, this.sunPosition.altitude, center, radius, 'sun');
        }

        // 8. Current Moon Marker
        if (this.showMoon && this.moonPosition) {
            this._drawCelestialBody(this.moonPosition.azimuth, this.moonPosition.altitude, center, radius, 'moon');
        }

        // 9. Center Zenith Marker (when pitch > 5°)
        if (this.pitch > 5.0) {
            const pZenith = this.projectToScreen(0, 90, center, radius);
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(pZenith.x, pZenith.y, 2.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.font = '9px system-ui';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillText('Zenith', pZenith.x, pZenith.y - 7);
            ctx.restore();
        }

        // 10. Center Pointer Needle / Heading reference line
        ctx.save();
        const pHeading = this.projectToScreen(0, 0, center, radius * 0.95);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pHeading.x, pHeading.y);
        ctx.stroke();

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    _drawTrajectoryArc(points, center, radius, strokeCol, glowCol, isSun) {
        const ctx = this.ctx;
        ctx.save();

        // Separate above horizon and below horizon
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = strokeCol;
        ctx.beginPath();

        let started = false;
        points.forEach((pt, i) => {
            const p = this.projectToScreen(pt.azimuth, pt.altitude, center, radius);
            if (!started) {
                ctx.moveTo(p.x, p.y);
                started = true;
            } else {
                ctx.lineTo(p.x, p.y);
            }
        });
        ctx.stroke();

        // Hourly Tick Markers
        points.forEach(pt => {
            if (pt.hour % 2 === 0 && pt.minute === 0) {
                const p = this.projectToScreen(pt.azimuth, pt.altitude, center, radius);
                ctx.fillStyle = pt.isAboveHorizon ? strokeCol : 'rgba(148, 163, 184, 0.5)';
                ctx.beginPath();
                ctx.arc(p.x, p.y, pt.isAboveHorizon ? 2.5 : 1.8, 0, 2 * Math.PI);
                ctx.fill();

                if (pt.isAboveHorizon && this.pitch > 8) {
                    ctx.font = '8px system-ui';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.fillText(`${pt.hour}h`, p.x, p.y - 6);
                }
            }
        });

        ctx.restore();
    }

    _drawCelestialBody(az, alt, center, radius, type) {
        const ctx = this.ctx;
        const pt = this.projectToScreen(az, alt, center, radius);
        const ptGround = this.projectToScreen(az, 0, center, radius);
        const isAbove = alt >= 0;

        ctx.save();

        // Altitude projection line down to ground disc
        ctx.strokeStyle = isAbove ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.15)';
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(ptGround.x, ptGround.y);
        ctx.stroke();

        // Footprint circle on ground plane
        ctx.fillStyle = isAbove ? (type === 'sun' ? 'rgba(251, 133, 0, 0.4)' : 'rgba(56, 189, 248, 0.4)') : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(ptGround.x, ptGround.y, 2.5, 0, 2 * Math.PI);
        ctx.fill();

        if (type === 'sun') {
            // Sun Body with glow
            const radGrad = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 14);
            radGrad.addColorStop(0, '#ffffff');
            radGrad.addColorStop(0.3, '#ffb703');
            radGrad.addColorStop(1, 'rgba(251, 133, 0, 0)');
            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 14, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = '#ffb703';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.5, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            // Moon Body
            const radGrad = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 12);
            radGrad.addColorStop(0, '#ffffff');
            radGrad.addColorStop(0.4, '#38bdf8');
            radGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 12, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
            ctx.fill();
        }

        ctx.restore();
    }
}
