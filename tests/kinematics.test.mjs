/**
 * Rover kinematics tests / 探测车运动学测试
 *
 * These lock the axis convention that caused two real defects during
 * development:
 *   1. The rover drove sideways because the heading formula aligned local +Z
 *      (not +X) to the path tangent.
 *   2. Pitch and roll were applied to swapped axes, tilting the chassis the
 *      wrong way over craters.
 *
 * 这些测试锁定了开发期两个真实缺陷所涉及的轴约定：
 *   1. 航向公式把局部 +Z（而非 +X）对齐切线，导致车辆横着走。
 *   2. 俯仰与侧倾接错了轴，过坑时车身歪向错误方向。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  headingFromTangent, forwardVector, localToWorldOffset, leftNormal,
  solveAttitude, wheelSpinForDistance, WHEEL_LAYOUT, WHEEL_RADIUS, MOON_GRAVITY,
} from '../src/rover/kinematics.js';

const EPS = 1e-9;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('heading aligns the nose (+X) with the travel tangent, not the side', () => {
  // For each cardinal tangent the resulting forward vector must match it.
  const cases = [
    [1, 0], [0, 1], [-1, 0], [0, -1],
    [0.6, 0.8], [-0.6, 0.8], [0.6, -0.8], [-0.6, -0.8],
  ];
  for (const [tx, tz] of cases) {
    const h = headingFromTangent(tx, tz);
    const f = forwardVector(h);
    assert.ok(close(f.x, tx, 1e-12), `forward.x ${f.x} != tangent.x ${tx}`);
    assert.ok(close(f.z, tz, 1e-12), `forward.z ${f.z} != tangent.z ${tz}`);
  }
});

test('the regression case: nose must not be 90 degrees off the tangent', () => {
  // The buggy implementation was atan2(tx, tz). Verify we differ from it
  // wherever that formula would be wrong, and that our dot product is ~1.
  for (let i = 0; i < 360; i += 7) {
    const a = (i * Math.PI) / 180;
    const tx = Math.cos(a), tz = Math.sin(a);
    const f = forwardVector(headingFromTangent(tx, tz));
    const dot = f.x * tx + f.z * tz;
    assert.ok(dot > 1 - 1e-12, `dot=${dot} at ${i}deg — rover is not facing forward`);
  }
});

test('the old buggy formula really would drive sideways (guard against regression)', () => {
  const tx = 0, tz = 1;                 // travelling along +Z
  const buggy = Math.atan2(tx, tz);     // the old, wrong formula
  const f = forwardVector(buggy);
  const dot = f.x * tx + f.z * tz;
  // Under the wrong formula the nose is perpendicular to travel.
  assert.ok(Math.abs(dot) < 1e-12,
    `expected the buggy formula to be perpendicular, got dot=${dot}`);
});

test('local-to-world offset is a proper rotation (length and handedness preserved)', () => {
  for (const h of [0, 0.3, 1.2, -2.4, Math.PI]) {
    const o = localToWorldOffset(0.86, 0.80, h);
    assert.ok(close(Math.hypot(o.x, o.z), Math.hypot(0.86, 0.80), 1e-12),
      'rotation must preserve length');
  }
  // At zero yaw the mapping is the identity on the XZ plane.
  const id = localToWorldOffset(1, 0, 0);
  assert.ok(close(id.x, 1, 1e-12) && close(id.z, 0, 1e-12));
  const side = localToWorldOffset(0, 1, 0);
  assert.ok(close(side.x, 0, 1e-12) && close(side.z, 1, 1e-12));
});

test('left normal is perpendicular to travel and unit length', () => {
  for (const [fx, fz] of [[1, 0], [0, 1], [0.6, -0.8]]) {
    const n = leftNormal(fx, fz);
    assert.ok(close(n.x * fx + n.z * fz, 0, 1e-12), 'normal must be perpendicular');
    assert.ok(close(Math.hypot(n.x, n.z), 1, 1e-12), 'normal must be unit length');
  }
});

test('leftNormal tolerates a zero-length direction without producing NaN', () => {
  const n = leftNormal(0, 0);
  assert.ok(Number.isFinite(n.x) && Number.isFinite(n.z), 'must not be NaN');
});

test('attitude is level on flat ground', () => {
  const contacts = WHEEL_LAYOUT.map((w) => ({ lx: w.lx, lz: w.lz, groundY: 2.5 }));
  const { avgY, pitchZ, rollX } = solveAttitude(contacts);
  assert.ok(close(avgY, 2.5, 1e-12));
  assert.ok(close(pitchZ, 0, EPS), `pitch should be 0, got ${pitchZ}`);
  assert.ok(close(rollX, 0, EPS), `roll should be 0, got ${rollX}`);
});

test('front wheels higher produces nose-up pitch about Z, with zero roll', () => {
  const contacts = WHEEL_LAYOUT.map((w) => ({
    lx: w.lx, lz: w.lz, groundY: w.lx > 0.4 ? 0.3 : 0,
  }));
  const { pitchZ, rollX } = solveAttitude(contacts);
  assert.ok(pitchZ > 0, `expected positive (nose-up) pitch, got ${pitchZ}`);
  assert.ok(close(rollX, 0, EPS), `roll must stay 0 for a pure pitch, got ${rollX}`);
});

test('left wheels higher produces roll about X, with zero pitch', () => {
  const contacts = WHEEL_LAYOUT.map((w) => ({
    lx: w.lx, lz: w.lz, groundY: w.lz > 0 ? 0.25 : 0,
  }));
  const { pitchZ, rollX } = solveAttitude(contacts);
  assert.ok(Math.abs(rollX) > 1e-6, `expected non-zero roll, got ${rollX}`);
  assert.ok(close(pitchZ, 0, EPS), `pitch must stay 0 for a pure roll, got ${pitchZ}`);
});

test('pitch and roll are not swapped (the second historical bug)', () => {
  // A pure front-up tilt must move ONLY pitch; a pure left-up tilt only roll.
  const pitchOnly = solveAttitude(WHEEL_LAYOUT.map((w) => ({
    lx: w.lx, lz: w.lz, groundY: w.lx > 0.4 ? 0.4 : 0,
  })));
  const rollOnly = solveAttitude(WHEEL_LAYOUT.map((w) => ({
    lx: w.lx, lz: w.lz, groundY: w.lz > 0 ? 0.4 : 0,
  })));
  assert.ok(Math.abs(pitchOnly.pitchZ) > Math.abs(pitchOnly.rollX) * 1e6 ||
            Math.abs(pitchOnly.rollX) < EPS, 'pitch input leaked into roll');
  assert.ok(Math.abs(rollOnly.rollX) > Math.abs(rollOnly.pitchZ) * 1e6 ||
            Math.abs(rollOnly.pitchZ) < EPS, 'roll input leaked into pitch');
});

test('attitude handles an empty contact list', () => {
  const r = solveAttitude([]);
  assert.equal(r.avgY, 0);
  assert.ok(Number.isFinite(r.pitchZ) && Number.isFinite(r.rollX));
});

test('wheel spin matches no-slip rolling', () => {
  // One full revolution covers exactly the wheel circumference.
  const circumference = 2 * Math.PI * WHEEL_RADIUS;
  const spin = wheelSpinForDistance(circumference, WHEEL_RADIUS);
  assert.ok(close(spin, 2 * Math.PI, 1e-12), `expected 2pi, got ${spin}`);
});

test('wheel layout describes six wheels in two rows of three', () => {
  assert.equal(WHEEL_LAYOUT.length, 6);
  assert.equal(WHEEL_LAYOUT.filter((w) => w.lz > 0).length, 3);
  assert.equal(WHEEL_LAYOUT.filter((w) => w.lz < 0).length, 3);
  assert.equal(WHEEL_LAYOUT.filter((w) => w.role === 'front').length, 2);
  assert.equal(WHEEL_LAYOUT.filter((w) => w.role === 'rear').length, 2);
});

test('lunar gravity constant is the real value', () => {
  assert.ok(close(MOON_GRAVITY, 1.62, 1e-9));
});
