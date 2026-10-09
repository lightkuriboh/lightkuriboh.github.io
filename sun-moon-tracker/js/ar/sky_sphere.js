/**
 * sky_sphere.js - Static World Sky Sphere Geometry & Cache Engine
 * 
 * Precomputes 3D unit vectors in the local East-North-Up (ENU) topocentric frame.
 * Rebuilt on a slow lifecycle (startup, location/date change, 5-min epoch timer).
 * Completely decoupled from fast-path camera sensor movement.
 */

import { Vec3 } from './math3d.js';

export class SkySphere {
    constructor() {
        // Cached Geometry (Arrays of Vec3 unit vectors in ENU frame)
        this.sunCurve = [];           // Dense vertices for smooth Sun path
        this.moonCurve = [];          // Dense vertices for smooth Moon path
        this.sunHourlyMarkers = [];   // Hourly markers with time labels & ENU vec
        this.moonHourlyMarkers = [];  // Hourly markers with time labels & ENU vec

        // Static Grid & Horizon
        this.horizonRing = [];        // Circle at Alt = 0°
        this.altitudeRings = [];      // Parallels at +15°, +30°, +45°, +60°, -15°, -30°
        this.cardinalMarkers = [];    // N, NE, E, SE, S, SW, W, NW labels & ENU vectors
        this.compassTicks = [];       // 10° interval ticks along the horizon

        // Lifecycle & Invalidation Timestamps
        this.lastEpochKey = null;
        this.lastBuildTime = 0;

        // Initialize static horizon and grid
        this.initStaticGrid();
    }

    /**
     * Build static circles that only depend on the observer's local topocentric frame.
     */
    initStaticGrid() {
        // 1. Horizon Ring (Alt = 0°, sampled every 2°)
        this.horizonRing = [];
        for (let az = 0; az <= 360; az += 2) {
            const v = Vec3.create();
            Vec3.fromSphericalENU(v, az % 360, 0);
            this.horizonRing.push(v);
        }

        // 2. Altitude Parallels (+15°, +30°, +45°, +60°, +75°, -15°, -30°)
        const alts = [15, 30, 45, 60, 75, -15, -30];
        this.altitudeRings = alts.map(alt => {
            const ring = [];
            for (let az = 0; az <= 360; az += 3) {
                const v = Vec3.create();
                Vec3.fromSphericalENU(v, az % 360, alt);
                ring.push(v);
            }
            return { altitude: alt, points: ring };
        });

        // 3. Cardinal & Intercardinal Markers
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

        this.cardinalMarkers = directions.map(d => {
            const v = Vec3.create();
            Vec3.fromSphericalENU(v, d.az, 0);
            return { ...d, enu: v };
        });

        // 4. Horizon Compass Ticks every 5°
        this.compassTicks = [];
        for (let az = 0; az < 360; az += 5) {
            const v = Vec3.create();
            Vec3.fromSphericalENU(v, az, 0);
            const isMajor = (az % 30 === 0);
            const is10 = (az % 10 === 0);
            this.compassTicks.push({
                az,
                isMajor,
                is10,
                enu: v
            });
        }
    }

    /**
     * Check if cache needs rebuilding based on epoch key.
     */
    needsUpdate(epochKey) {
        if (!this.lastEpochKey || this.lastEpochKey !== epochKey) {
            return true;
        }
        // Force refresh every 5 minutes (300,000 ms)
        if (Date.now() - this.lastBuildTime > 300000) {
            return true;
        }
        return false;
    }

    /**
     * Update celestial trajectories from astronomy engine output.
     * Pre-interpolates paths to smooth curves of ~0.5° - 1.0° resolution.
     */
    updateTrajectories(sunTrajectory, moonTrajectory, epochKey = null) {
        if (epochKey) this.lastEpochKey = epochKey;
        this.lastBuildTime = Date.now();

        // 1. Sun Trajectory
        if (sunTrajectory && sunTrajectory.length > 0) {
            const { curve, markers } = this.densifyTrajectory(sunTrajectory);
            this.sunCurve = curve;
            this.sunHourlyMarkers = markers;
        } else {
            this.sunCurve = [];
            this.sunHourlyMarkers = [];
        }

        // 2. Moon Trajectory
        if (moonTrajectory && moonTrajectory.length > 0) {
            const { curve, markers } = this.densifyTrajectory(moonTrajectory);
            this.moonCurve = curve;
            this.moonHourlyMarkers = markers;
        } else {
            this.moonCurve = [];
            this.moonHourlyMarkers = [];
        }
    }

    /**
     * Densify raw sparse trajectory points into a high-density 3D spline on the unit sphere.
     */
    densifyTrajectory(rawPoints) {
        if (!rawPoints || rawPoints.length === 0) {
            return { curve: [], markers: [] };
        }

        const curve = [];
        const markers = [];

        for (let i = 0; i < rawPoints.length; ++i) {
            const pt = rawPoints[i];
            const vCurrent = Vec3.create();
            Vec3.fromSphericalENU(vCurrent, pt.azimuth, pt.altitude);

            // Add hourly marker
            if (pt.minute === 0 && pt.hour % 2 === 0) {
                markers.push({
                    timeStr: pt.timeStr,
                    hour: pt.hour,
                    minute: pt.minute,
                    isAboveHorizon: pt.isAboveHorizon,
                    azimuth: pt.azimuth,
                    altitude: pt.altitude,
                    enu: vCurrent
                });
            }

            if (i === 0) {
                curve.push(vCurrent);
                continue;
            }

            const ptPrev = rawPoints[i - 1];
            const vPrev = curve[curve.length - 1];

            // Compute spherical angular distance between previous and current
            const dot = Math.max(-1.0, Math.min(1.0, Vec3.dot(vPrev, vCurrent)));
            const angleRad = Math.acos(dot);
            const angleDeg = (angleRad * 180.0) / Math.PI;

            // Interpolate if gap > 1.0 degree
            const stepDeg = 1.0;
            if (angleDeg > stepDeg) {
                const subSteps = Math.ceil(angleDeg / stepDeg);
                for (let s = 1; s < subSteps; ++s) {
                    const t = s / subSteps;
                    const vInterp = Vec3.create();
                    // Slerp on unit sphere
                    const sinTotal = Math.sin(angleRad);
                    if (sinTotal > 1e-6) {
                        const s0 = Math.sin((1.0 - t) * angleRad) / sinTotal;
                        const s1 = Math.sin(t * angleRad) / sinTotal;
                        vInterp.x = s0 * vPrev.x + s1 * vCurrent.x;
                        vInterp.y = s0 * vPrev.y + s1 * vCurrent.y;
                        vInterp.z = s0 * vPrev.z + s1 * vCurrent.z;
                    } else {
                        Vec3.lerp(vInterp, vPrev, vCurrent, t);
                    }
                    Vec3.normalize(vInterp, vInterp);
                    curve.push(vInterp);
                }
            }

            curve.push(vCurrent);
        }

        return { curve, markers };
    }
}
