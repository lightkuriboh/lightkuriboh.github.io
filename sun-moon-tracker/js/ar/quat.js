/**
 * quat.js - High-performance 3D Quaternion and Vector Math for AR
 *
 * Implements unit quaternion representation [x, y, z, w], W3C DeviceOrientation
 * Euler conversions, spherical linear interpolation (SLERP), and ENU spherical
 * coordinate projections.
 */

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

/**
 * Returns an identity quaternion [0, 0, 0, 1].
 */
export function quatIdentity() {
    return [0, 0, 0, 1];
}

/**
 * Creates a quaternion from an axis [x, y, z] and angle in radians.
 */
export function quatFromAxisAngle(axis, rad) {
    const half = rad * 0.5;
    const s = Math.sin(half);
    const len = Math.hypot(axis[0], axis[1], axis[2]) || 1.0;
    return [
        (axis[0] / len) * s,
        (axis[1] / len) * s,
        (axis[2] / len) * s,
        Math.cos(half)
    ];
}

/**
 * Multiplies quaternion a by quaternion b (a * b).
 */
export function quatMultiply(a, b) {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3];
    const bx = b[0], by = b[1], bz = b[2], bw = b[3];
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz
    ];
}

/**
 * Computes the inverse (conjugate for unit quaternions) of q.
 */
export function quatInverse(q) {
    const lenSq = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
    if (lenSq === 0) return [0, 0, 0, 1];
    const invLenSq = 1.0 / lenSq;
    return [-q[0] * invLenSq, -q[1] * invLenSq, -q[2] * invLenSq, q[3] * invLenSq];
}

/**
 * Normalizes a quaternion to unit length.
 */
export function quatNormalize(q) {
    const len = Math.hypot(q[0], q[1], q[2], q[3]);
    if (len < 1e-12) return [0, 0, 0, 1];
    const inv = 1.0 / len;
    return [q[0] * inv, q[1] * inv, q[2] * inv, q[3] * inv];
}

/**
 * Rotates a 3D vector v = [x, y, z] by quaternion q: q * [v, 0] * q^-1
 */
export function quatRotate(q, v) {
    // Optimized Rodrigues formula for unit quaternion vector rotation:
    // v' = v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const vx = v[0], vy = v[1], vz = v[2];

    const cx = qy * vz - qz * vy + qw * vx;
    const cy = qz * vx - qx * vz + qw * vy;
    const cz = qx * vy - qy * vx + qw * vz;

    return [
        vx + 2.0 * (qy * cz - qz * cy),
        vy + 2.0 * (qz * cx - qx * cz),
        vz + 2.0 * (qx * cy - qy * cx)
    ];
}

/**
 * Spherical Linear Interpolation (SLERP) between qa and qb by fraction t [0, 1].
 * Guarantees shortest path on S^3 and handles antipodal quaternions.
 */
export function quatSlerp(qa, qb, t) {
    if (t <= 0) return [qa[0], qa[1], qa[2], qa[3]];
    if (t >= 1) return [qb[0], qb[1], qb[2], qb[3]];

    let ax = qa[0], ay = qa[1], az = qa[2], aw = qa[3];
    let bx = qb[0], by = qb[1], bz = qb[2], bw = qb[3];

    // Compute dot product
    let cosOmega = ax * bx + ay * by + az * bz + aw * bw;

    // If negative, negate one quaternion to take the shortest arc on S^3
    if (cosOmega < 0.0) {
        bx = -bx;
        by = -by;
        bz = -bz;
        bw = -bw;
        cosOmega = -cosOmega;
    }

    // If quaternions are very close, use linear interpolation (lerp) to avoid division by zero
    if (cosOmega > 0.9995) {
        const k0 = 1.0 - t;
        const k1 = t;
        return quatNormalize([
            ax * k0 + bx * k1,
            ay * k0 + by * k1,
            az * k0 + bz * k1,
            aw * k0 + bw * k1
        ]);
    }

    // Standard SLERP
    const sinOmega = Math.sqrt(1.0 - cosOmega * cosOmega);
    const omega = Math.atan2(sinOmega, cosOmega);
    const invSinOmega = 1.0 / sinOmega;

    const scaleA = Math.sin((1.0 - t) * omega) * invSinOmega;
    const scaleB = Math.sin(t * omega) * invSinOmega;

    return [
        ax * scaleA + bx * scaleB,
        ay * scaleA + by * scaleB,
        az * scaleA + bz * scaleB,
        aw * scaleA + bw * scaleB
    ];
}

/**
 * Constructs a quaternion from W3C DeviceOrientation intrinsic Tait-Bryan Z-X-Y angles:
 * 1. Rotate by alpha around Earth Z (East-North-Up vertical)
 * 2. Rotate by beta around device X
 * 3. Rotate by gamma around device Y
 *
 * All angles in degrees.
 * Returns q_device_to_world.
 */
export function quatFromW3CEuler(alphaDeg = 0, betaDeg = 0, gammaDeg = 0) {
    // In Earth East-North-Up (ENU), +Z points Up.
    // Compass azimuth heading increases clockwise (North -> East -> South -> West).
    // In right-handed coordinates, clockwise rotation around +Z (Up) is negative.
    // Therefore, alpha must be negated to align clockwise compass azimuth with ENU world frame.
    const a = - (alphaDeg || 0) * DEG2RAD * 0.5;
    const b = (betaDeg || 0) * DEG2RAD * 0.5;
    const g = (gammaDeg || 0) * DEG2RAD * 0.5;

    const qZ = [0, 0, Math.sin(a), Math.cos(a)];
    const qX = [Math.sin(b), 0, 0, Math.cos(b)];
    const qY = [0, Math.sin(g), 0, Math.cos(g)];

    return quatMultiply(quatMultiply(qZ, qX), qY);
}

/**
 * Builds a camera-to-world quaternion from manual heading and pitch (degrees).
 * Used when gyro/sensors are inactive (desktop drag mode).
 */
export function quatFromHeadingPitch(headingDeg = 180, pitchDeg = 0) {
    const qYaw = quatFromAxisAngle([0, 0, 1], -headingDeg * DEG2RAD);
    const qPitch = quatFromAxisAngle([1, 0, 0], (90.0 + pitchDeg) * DEG2RAD);
    const qCamToDev = [1, 0, 0, 0]; // Rx(180)
    return quatMultiply(quatMultiply(qYaw, qPitch), qCamToDev);
}

/**
 * Extracts derived heading (azimuth 0..360°), pitch (-90..+90°), and roll (-180..+180°)
 * from a camera-to-world quaternion.
 * Also computes deviceTilt (0° flat face up to 90° upright) and compassHeading for 3D compass.
 *
 * In camera space:
 * - Camera forward optical axis is [0, 0, 1] (OpenCV convention)
 * - Camera right is [1, 0, 0]
 * - Camera up is [0, -1, 0] (down is [0, 1, 0])
 */
export function quatGetHeadingPitchRoll(qCamToWorld) {
    const fwd = quatRotate(qCamToWorld, [0, 0, 1]);
    const right = quatRotate(qCamToWorld, [1, 0, 0]);
    const up = quatRotate(qCamToWorld, [0, -1, 0]);

    // Heading (Azimuth): in ENU, X is East, Y is North. Clockwise from North:
    const heading = (Math.atan2(fwd[0], fwd[1]) * RAD2DEG + 360.0) % 360.0;

    // Pitch: angle above horizon in [-90, +90]
    const clampedZ = Math.max(-1.0, Math.min(1.0, fwd[2]));
    const pitch = Math.asin(clampedZ) * RAD2DEG;

    // Roll: bank rotation around optical axis
    // When right vector's Z component tilts down/up:
    const roll = Math.atan2(right[2], up[2]) * RAD2DEG;

    // Device physical tilt relative to the horizontal surface:
    // Screen normal is out of screen (-fwd in camera coordinates, because camera is out back).
    // When phone lies flat face up on surface: screen normal is [0, 0, 1], deviceTilt = 0°
    // When phone is held upright: screen normal is horizontal, deviceTilt = 90°
    const screenNormalZ = Math.max(-1.0, Math.min(1.0, -fwd[2]));
    const deviceTilt = Math.acos(screenNormalZ) * RAD2DEG;

    // Compass heading:
    // When phone is flat on table (deviceTilt ≈ 0°): top of phone (up vector) defines heading.
    // When phone is held upright (deviceTilt ≈ 90°): forward camera axis (fwd vector) defines heading.
    const tTilt = Math.max(0.0, Math.min(1.0, deviceTilt / 90.0));
    const aimX = (1.0 - tTilt) * up[0] + tTilt * fwd[0];
    const aimY = (1.0 - tTilt) * up[1] + tTilt * fwd[1];
    const compassHeading = (Math.atan2(aimX, aimY) * RAD2DEG + 360.0) % 360.0;

    return { heading, pitch, roll, fwd, right, up, deviceTilt, compassHeading };
}

/**
 * Converts spherical celestial coordinates (Azimuth, Altitude in degrees)
 * into a 3D unit direction vector in Earth East-North-Up (ENU) coordinates.
 *
 * Azimuth: 0=North, 90=East, 180=South, 270=West
 * Altitude: 0=Horizon, 90=Zenith, -90=Nadir
 */
export function enuVectorFromAzAlt(azimuthDeg, altitudeDeg) {
    const azRad = azimuthDeg * DEG2RAD;
    const altRad = altitudeDeg * DEG2RAD;
    const cosAlt = Math.cos(altRad);

    return [
        cosAlt * Math.sin(azRad), // X = East
        cosAlt * Math.cos(azRad), // Y = North
        Math.sin(altRad)          // Z = Up
    ];
}

/**
 * Shortest angular difference from current to target in degrees [-180, 180].
 */
export function shortestAngleDeg(target, current) {
    let diff = (target - current) % 360.0;
    if (diff > 180.0) diff -= 360.0;
    if (diff < -180.0) diff += 360.0;
    return diff;
}
