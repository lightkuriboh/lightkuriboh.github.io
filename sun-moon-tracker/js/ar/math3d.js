/**
 * math3d.js - High-performance 3D Vector, Matrix, Quaternion & Clipping Engine
 * 
 * Provides linear algebra and near-plane frustum clipping for the Stable Sky Sphere.
 * Zero-allocation in hot loops where target buffers are provided.
 */

export class Vec3 {
    static create(x = 0, y = 0, z = 0) {
        return { x, y, z };
    }

    static set(out, x, y, z) {
        out.x = x;
        out.y = y;
        out.z = z;
        return out;
    }

    static copy(out, a) {
        out.x = a.x;
        out.y = a.y;
        out.z = a.z;
        return out;
    }

    static dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    static length(a) {
        return Math.hypot(a.x, a.y, a.z);
    }

    static normalize(out, a) {
        const len = Math.hypot(a.x, a.y, a.z);
        if (len > 1e-8) {
            out.x = a.x / len;
            out.y = a.y / len;
            out.z = a.z / len;
        } else {
            out.x = 0;
            out.y = 0;
            out.z = 0;
        }
        return out;
    }

    static lerp(out, a, b, t) {
        out.x = a.x + t * (b.x - a.x);
        out.y = a.y + t * (b.y - a.y);
        out.z = a.z + t * (b.z - a.z);
        return out;
    }

    /**
     * Convert spherical topocentric coordinates (Azimuth, Altitude in degrees)
     * to a 3D unit vector in East-North-Up (ENU) world coordinates.
     * 
     * +X: East
     * +Y: True North
     * +Z: Up (Zenith)
     */
    static fromSphericalENU(out, azimuthDeg, altitudeDeg) {
        const azRad = (azimuthDeg * Math.PI) / 180.0;
        const altRad = (altitudeDeg * Math.PI) / 180.0;
        const cosAlt = Math.cos(altRad);

        out.x = cosAlt * Math.sin(azRad); // East
        out.y = cosAlt * Math.cos(azRad); // North
        out.z = Math.sin(altRad);         // Up
        return out;
    }
}

export class Quat {
    static create(x = 0, y = 0, z = 0, w = 1) {
        return { x, y, z, w };
    }

    static set(out, x, y, z, w) {
        out.x = x;
        out.y = y;
        out.z = z;
        out.w = w;
        return out;
    }

    static copy(out, a) {
        out.x = a.x;
        out.y = a.y;
        out.z = a.z;
        out.w = a.w;
        return out;
    }

    static identity(out) {
        out.x = 0;
        out.y = 0;
        out.z = 0;
        out.w = 1;
        return out;
    }

    static normalize(out, q) {
        const len = Math.hypot(q.x, q.y, q.z, q.w);
        if (len > 1e-8) {
            out.x = q.x / len;
            out.y = q.y / len;
            out.z = q.z / len;
            out.w = q.w / len;
        } else {
            out.x = 0;
            out.y = 0;
            out.z = 0;
            out.w = 1;
        }
        return out;
    }

    static multiply(out, a, b) {
        const ax = a.x, ay = a.y, az = a.z, aw = a.w;
        const bx = b.x, by = b.y, bz = b.z, bw = b.w;

        out.x = aw * bx + ax * bw + ay * bz - az * by;
        out.y = aw * by - ax * bz + ay * bw + az * bx;
        out.z = aw * bz + ax * by - ay * bx + az * bw;
        out.w = aw * bw - ax * bx - ay * by - az * bz;
        return out;
    }

    /**
     * Spherical Linear Interpolation (SLERP) between two quaternions.
     */
    static slerp(out, a, b, t) {
        let ax = a.x, ay = a.y, az = a.z, aw = a.w;
        let bx = b.x, by = b.y, bz = b.z, bw = b.w;

        let cosOmega = ax * bx + ay * by + az * bz + aw * bw;

        // If negative dot product, negate one to take the shortest path on S³
        if (cosOmega < 0.0) {
            cosOmega = -cosOmega;
            bx = -bx;
            by = -by;
            bz = -bz;
            bw = -bw;
        }

        let scale0, scale1;
        if (cosOmega > 0.9995) {
            // Very close: use linear interpolation to avoid division by zero
            scale0 = 1.0 - t;
            scale1 = t;
        } else {
            const omega = Math.acos(cosOmega);
            const sinOmega = Math.sin(omega);
            scale0 = Math.sin((1.0 - t) * omega) / sinOmega;
            scale1 = Math.sin(t * omega) / sinOmega;
        }

        out.x = scale0 * ax + scale1 * bx;
        out.y = scale0 * ay + scale1 * by;
        out.z = scale0 * az + scale1 * bz;
        out.w = scale0 * aw + scale1 * bw;
        return this.normalize(out, out);
    }

    /**
     * Construct quaternion from Axis-Angle
     */
    static fromAxisAngle(out, axis, angleRad) {
        const half = angleRad * 0.5;
        const s = Math.sin(half);
        out.x = axis.x * s;
        out.y = axis.y * s;
        out.z = axis.z * s;
        out.w = Math.cos(half);
        return out;
    }

    /**
     * Convert 3x3 rotation matrix to unit quaternion.
     */
    static fromMat3(out, m) {
        const m00 = m[0], m01 = m[1], m02 = m[2];
        const m10 = m[3], m11 = m[4], m12 = m[5];
        const m20 = m[6], m21 = m[7], m22 = m[8];

        const tr = m00 + m11 + m22;
        if (tr > 0) {
            const s = Math.sqrt(tr + 1.0) * 2;
            out.w = 0.25 * s;
            out.x = (m21 - m12) / s;
            out.y = (m02 - m20) / s;
            out.z = (m10 - m01) / s;
        } else if ((m00 > m11) && (m00 > m22)) {
            const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
            out.w = (m21 - m12) / s;
            out.x = 0.25 * s;
            out.y = (m01 + m10) / s;
            out.z = (m02 + m20) / s;
        } else if (m11 > m22) {
            const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
            out.w = (m02 - m20) / s;
            out.x = (m01 + m10) / s;
            out.y = 0.25 * s;
            out.z = (m12 + m21) / s;
        } else {
            const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
            out.w = (m10 - m01) / s;
            out.x = (m02 + m20) / s;
            out.y = (m12 + m21) / s;
            out.z = 0.25 * s;
        }
        return this.normalize(out, out);
    }

    /**
     * Construct quaternion from Heading (Yaw), Pitch, Roll in degrees.
     * Uses the proper right-handed camera basis (Right, Up, -Forward) with det = +1.
     */
    static fromHeadingPitchRoll(out, headingDeg, pitchDeg, rollDeg) {
        const m = Mat3.create();
        Mat3.fromHeadingPitchRoll(m, headingDeg, pitchDeg, rollDeg);
        const rotMat = [
            m[0], m[1], m[2],
            m[3], m[4], m[5],
            -m[6], -m[7], -m[8]
        ];
        return this.fromMat3(out, rotMat);
    }
}

export class Mat3 {
    /**
     * Mat3 stored as a Float32Array of 9 elements in row-major order:
     * [0: m00, 1: m01, 2: m02,
     *  3: m10, 4: m11, 5: m12,
     *  6: m20, 7: m21, 8: m22]
     */
    static create() {
        const m = new Float32Array(9);
        m[0] = 1; m[4] = 1; m[8] = 1;
        return m;
    }

    static identity(out) {
        out[0] = 1; out[1] = 0; out[2] = 0;
        out[3] = 0; out[4] = 1; out[5] = 0;
        out[6] = 0; out[7] = 0; out[8] = 1;
        return out;
    }

    /**
     * Convert unit quaternion to 3x3 rotation matrix.
     */
    static fromQuat(out, q) {
        const x = q.x, y = q.y, z = q.z, w = q.w;
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;

        out[0] = 1 - (yy + zz);
        out[1] = xy - wz;
        out[2] = xz + wy;

        out[3] = xy + wz;
        out[4] = 1 - (xx + zz);
        out[5] = yz - wx;

        out[6] = xz - wy;
        out[7] = yz + wx;
        out[8] = 1 - (xx + yy);
        return out;
    }

    /**
     * Multiply 3x3 matrix with a 3D vector: out = M * v
     */
    static multiplyVec3(out, m, v) {
        const x = v.x, y = v.y, z = v.z;
        out.x = m[0] * x + m[1] * y + m[2] * z;
        out.y = m[3] * x + m[4] * y + m[5] * z;
        out.z = m[6] * x + m[7] * y + m[8] * z;
        return out;
    }

    /**
     * Construct rotation matrix from camera basis vectors (Right, Up, Forward).
     * Camera coordinates:
     *   Row 0: Camera Right vector in world ENU
     *   Row 1: Camera Up vector in world ENU
     *   Row 2: Camera Forward (Optical Axis) vector in world ENU
     * 
     * Transforming world point: p_cam = M_view * v_world
     */
    static fromCameraBasis(out, right, up, forward) {
        out[0] = right.x;   out[1] = right.y;   out[2] = right.z;
        out[3] = up.x;      out[4] = up.y;      out[5] = up.z;
        out[6] = forward.x; out[7] = forward.y; out[8] = forward.z;
        return out;
    }

    /**
     * Create View Matrix from Heading, Pitch, Roll (in degrees)
     * Robust implementation without zenith singularity in vector basis.
     */
    static fromHeadingPitchRoll(out, headingDeg, pitchDeg, rollDeg) {
        const hR = (headingDeg * Math.PI) / 180.0;
        const pR = (pitchDeg * Math.PI) / 180.0;
        const rR = (rollDeg * Math.PI) / 180.0;

        // Optical forward axis in ENU
        const cosP = Math.cos(pR);
        const sinP = Math.sin(pR);
        const cosH = Math.cos(hR);
        const sinH = Math.sin(hR);

        const fx = cosP * sinH;
        const fy = cosP * cosH;
        const fz = sinP;

        // Base Up & Right before roll
        const u0x = -sinP * sinH;
        const u0y = -sinP * cosH;
        const u0z = cosP;

        const r0x = cosH;
        const r0y = -sinH;
        const r0z = 0.0;

        // Apply roll rotation around optical axis
        const cosR = Math.cos(rR);
        const sinR = Math.sin(rR);

        const rx = cosR * r0x + sinR * u0x;
        const ry = cosR * r0y + sinR * u0y;
        const rz = cosR * r0z + sinR * u0z;

        const ux = -sinR * r0x + cosR * u0x;
        const uy = -sinR * r0y + cosR * u0y;
        const uz = -sinR * r0z + cosR * u0z;

        out[0] = rx; out[1] = ry; out[2] = rz;
        out[3] = ux; out[4] = uy; out[5] = uz;
        out[6] = fx; out[7] = fy; out[8] = fz;
        return out;
    }
}

/**
 * 3D Near-Plane Frustum Clipper
 * 
 * Prevents line segments from wrapping across the screen or causing division by zero
 * when passing behind the camera plane (z_cam <= nearZ).
 */
export class FrustumClipper {
    /**
     * Clip a 3D line segment against the near plane z_cam >= nearZ.
     * Returns an array of two endpoints [p1, p2], or null if completely behind camera.
     */
    static clipLineSegment(p1, p2, nearZ = 0.05) {
        const z1 = p1.z;
        const z2 = p2.z;

        // Both points in front of near plane: fully visible
        if (z1 >= nearZ && z2 >= nearZ) {
            return [p1, p2];
        }

        // Both points behind near plane: completely culled
        if (z1 < nearZ && z2 < nearZ) {
            return null;
        }

        // Segment crosses near plane: compute intersection point
        const t = (nearZ - z1) / (z2 - z1);
        const clipPt = {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
            z: nearZ
        };

        if (z1 >= nearZ) {
            return [p1, clipPt];
        } else {
            return [clipPt, p2];
        }
    }

    /**
     * Project 3D Camera coordinate point (where +Z is forward) to 2D screen coordinates.
     */
    static projectToScreen(pCam, width, height, fovHDeg) {
        if (pCam.z <= 1e-4) {
            return { visible: false, x: 0, y: 0 };
        }

        const fovHRad = (fovHDeg * Math.PI) / 180.0;
        const fx = (width * 0.5) / Math.tan(fovHRad * 0.5);
        const fovVRad = fovHRad * (height / width);
        const fy = (height * 0.5) / Math.tan(fovVRad * 0.5);

        const screenX = (width * 0.5) + (pCam.x / pCam.z) * fx;
        const screenY = (height * 0.5) - (pCam.y / pCam.z) * fy;

        const margin = 120;
        const visible = (screenX >= -margin && screenX <= width + margin &&
                         screenY >= -margin && screenY <= height + margin);

        return { visible, x: screenX, y: screenY };
    }
}
