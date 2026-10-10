/**
 * Rover heading & attitude maths / 探测车航向与姿态数学
 *
 * IMPORTANT AXIS CONVENTION / 重要的轴约定
 * ---------------------------------------------------------------
 * The rover model is built with its **body length along local +X**:
 *   +X = forward (nose, camera mast side)   车头方向
 *   +Z = left side                          车辆左侧
 *   +Y = up                                 车顶方向
 *
 * Therefore, for a yaw rotation `h` about +Y:
 *   local (1,0,0) -> world ( cos h, 0, -sin h)
 *   local (0,0,1) -> world ( sin h, 0,  cos h)
 *
 * Aligning the nose (+X) to a travel tangent (tx, tz) requires
 *   cos h =  tx  and  sin h = -tz   =>   h = atan2(-tz, tx)
 *
 * Using `atan2(tx, tz)` instead would align local **+Z** to the tangent,
 * which makes the rover drive sideways. That was a real bug in this project;
 * `tests/kinematics.test.mjs` locks the correct behaviour.
 *
 * 车身长轴为局部 +X。若误用 atan2(tx, tz)，对齐的是局部 +Z，
 * 车辆会"横着走"——这是本项目曾出现的真实缺陷，已由测试锁定。
 */

/**
 * Yaw angle that points the rover's nose (+X) along a travel tangent.
 * 使车头(+X)对齐行进切线的偏航角。
 *
 * @param {number} tx - tangent X component
 * @param {number} tz - tangent Z component
 * @returns {number} yaw in radians
 */
export function headingFromTangent(tx, tz) {
  return Math.atan2(-tz, tx);
}

/**
 * Rotate a rover-local XZ offset into world space for a given yaw.
 * 把车辆局部 XZ 偏移按偏航角变换到世界坐标。
 *
 * @param {number} lx - local X (forward+)
 * @param {number} lz - local Z (left+)
 * @param {number} heading - yaw in radians
 * @returns {{x:number, z:number}} world-space offset
 */
export function localToWorldOffset(lx, lz, heading) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return { x: lx * c + lz * s, z: -lx * s + lz * c };
}

/**
 * Unit forward vector in world space for a given yaw.
 * 给定偏航角时的世界前进单位向量。
 */
export function forwardVector(heading) {
  return { x: Math.cos(heading), z: -Math.sin(heading) };
}

/**
 * Left-hand normal of a travel direction, used to offset the two wheel ruts.
 * 行进方向的左法向，用于偏移左右两道车辙。
 */
export function leftNormal(fx, fz) {
  const len = Math.hypot(fx, fz) || 1;
  return { x: -fz / len, z: fx / len };
}

/**
 * Solve body attitude from six wheel-contact heights.
 * 由六个车轮触地高度求解车体姿态。
 *
 * Because the nose is +X, **pitch rotates about Z** and **roll about X** —
 * swapping them (an earlier bug) tilts the chassis the wrong way on craters.
 * 车头在 +X，故俯仰绕 Z、侧倾绕 X；两者对调会导致过坑时车身歪向错误方向。
 *
 * @param {Array<{lx:number, lz:number, groundY:number}>} contacts
 * @param {number} [wheelBase=1.72] - front-to-rear span in metres
 * @param {number} [trackWidth=1.60] - left-to-right span in metres
 * @returns {{avgY:number, pitchZ:number, rollX:number}}
 */
export function solveAttitude(contacts, wheelBase = 1.72, trackWidth = 1.60) {
  let sumY = 0, frontY = 0, rearY = 0, leftY = 0, rightY = 0;
  let nFront = 0, nRear = 0, nLeft = 0, nRight = 0;

  for (const c of contacts) {
    sumY += c.groundY;
    if (c.lx > 0.4)       { frontY += c.groundY; nFront++; }
    else if (c.lx < -0.4) { rearY  += c.groundY; nRear++;  }
    if (c.lz > 0) { leftY  += c.groundY; nLeft++;  }
    else          { rightY += c.groundY; nRight++; }
  }

  const avgY = contacts.length ? sumY / contacts.length : 0;
  const fAvg = nFront ? frontY / nFront : 0;
  const rAvg = nRear  ? rearY  / nRear  : 0;
  const lAvg = nLeft  ? leftY  / nLeft  : 0;
  const rtAvg = nRight ? rightY / nRight : 0;

  return {
    avgY,
    // Front higher than rear -> nose up.
    pitchZ:  Math.atan2(fAvg - rAvg, wheelBase),
    // Left (+Z) higher -> roll toward the right.
    rollX:  -Math.atan2(lAvg - rtAvg, trackWidth),
  };
}

/**
 * Wheel angular travel for a given ground distance (no-slip rolling).
 * 给定行驶距离对应的车轮转角（纯滚动，无滑移）。
 *
 * @param {number} distance - metres travelled
 * @param {number} wheelRadius - metres
 * @returns {number} radians
 */
export function wheelSpinForDistance(distance, wheelRadius) {
  return distance / wheelRadius;
}

/** Lunar surface gravity, m/s^2 — dust follows ballistic arcs, no air drag. */
export const MOON_GRAVITY = 1.62;

/**
 * Six wheel positions in rover-local space (metres).
 * 六个车轮的局部坐标（米）。lx: +forward, lz: +left
 */
export const WHEEL_LAYOUT = [
  { lx:  0.86, lz:  0.80, role: 'front' },
  { lx:  0.00, lz:  0.80, role: 'mid'   },
  { lx: -0.86, lz:  0.80, role: 'rear'  },
  { lx:  0.86, lz: -0.80, role: 'front' },
  { lx:  0.00, lz: -0.80, role: 'mid'   },
  { lx: -0.86, lz: -0.80, role: 'rear'  },
];

export const WHEEL_RADIUS = 0.325;
export const WHEEL_WIDTH = 0.235;
