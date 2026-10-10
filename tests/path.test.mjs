/**
 * Driving path tests / 行驶路径测试
 *
 * Requires `three` (installed as a devDependency) because the path is a
 * CatmullRomCurve3. If three is unavailable the suite skips rather than fails.
 * 需要 three（已作为 devDependency），因为路径是 CatmullRomCurve3。
 * 若 three 不可用则跳过而非失败。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PATH_RADIUS, TERRAIN_SIZE } from '../src/world/terrain.js';

let createPath, BASE_SPEED, available = true;
try {
  ({ createPath, BASE_SPEED } = await import('../src/world/path.js'));
} catch {
  available = false;
}

test('path module loads (requires three)', { skip: !available ? 'three not installed' : false }, () => {
  assert.equal(typeof createPath, 'function');
});

test('path is a closed loop of plausible length',
  { skip: !available ? 'three not installed' : false }, () => {
    const { curve, length } = createPath();
    // A loop around R~46 with undulation: circumference is on the order of 2*pi*R.
    assert.ok(length > 2 * Math.PI * PATH_RADIUS * 0.6,
      `path too short: ${length}`);
    assert.ok(length < 2 * Math.PI * PATH_RADIUS * 2.2,
      `path implausibly long: ${length}`);
    // Closed: start and end coincide.
    const a = curve.getPointAt(0), b = curve.getPointAt(1);
    assert.ok(a.distanceTo(b) < 1e-6, 'path is not closed');
  });

test('every point on the path stays inside the terrain bounds',
  { skip: !available ? 'three not installed' : false }, () => {
    const { curve } = createPath();
    const half = TERRAIN_SIZE / 2;
    for (let i = 0; i <= 400; i++) {
      const p = curve.getPointAt(i / 400);
      assert.ok(Math.abs(p.x) < half * 0.9 && Math.abs(p.z) < half * 0.9,
        `path leaves the terrain at t=${i / 400}: (${p.x}, ${p.z})`);
    }
  });

test('path tangents are unit length and continuous',
  { skip: !available ? 'three not installed' : false }, () => {
    const { curve } = createPath();
    let prev = null, worst = 0;
    for (let i = 0; i <= 400; i++) {
      const t = curve.getTangentAt(i / 400);
      assert.ok(Math.abs(t.length() - 1) < 1e-6, 'tangent is not normalised');
      if (prev) worst = Math.max(worst, t.angleTo(prev));
      prev = t;
    }
    // No sudden direction reversal between adjacent samples.
    assert.ok(worst < 0.3, `tangent turns too sharply (${worst} rad) — path has a kink`);
  });

test('base cruise speed is a slow, rover-like crawl',
  { skip: !available ? 'three not installed' : false }, () => {
    assert.ok(BASE_SPEED > 0 && BASE_SPEED < 2,
      `base speed ${BASE_SPEED} m/s is not a realistic rover pace`);
  });
