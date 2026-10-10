/**
 * Terrain & crater tests / 地形与陨石坑测试
 *
 * Verifies the height field has the geometric features the scene depends on:
 * bowl-shaped depressions, raised rims, and a drivable path corridor.
 * 验证高度场具备场景所依赖的几何特征：碗状凹陷、抬升坑沿、可通行的路径走廊。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTerrain, generateCraters, TERRAIN_SIZE, TERRAIN_SEG, PATH_RADIUS,
} from '../src/world/terrain.js';
import { makeRng, DEFAULT_SEED } from '../src/world/noise.js';

test('terrain height is finite everywhere across the full extent', () => {
  const { height } = createTerrain();
  const half = TERRAIN_SIZE / 2;
  for (let i = 0; i <= 40; i++) {
    for (let j = 0; j <= 40; j++) {
      const x = -half + (i / 40) * TERRAIN_SIZE;
      const z = -half + (j / 40) * TERRAIN_SIZE;
      const h = height(x, z);
      assert.ok(Number.isFinite(h), `non-finite height at (${x}, ${z})`);
      assert.ok(Math.abs(h) < 500, `implausible height ${h} at (${x}, ${z})`);
    }
  }
});

test('terrain is deterministic for a fixed seed', () => {
  const a = createTerrain({ seed: 999 });
  const b = createTerrain({ seed: 999 });
  for (let i = 0; i < 300; i++) {
    const x = (i * 7.3) % 400 - 200, z = (i * 11.9) % 400 - 200;
    assert.equal(a.height(x, z), b.height(x, z));
  }
});

test('different seeds produce different terrain', () => {
  const a = createTerrain({ seed: 1 });
  const b = createTerrain({ seed: 2 });
  let diff = 0;
  for (let i = 0; i < 200; i++) {
    const x = i * 2.1 - 200, z = i * 1.7 - 150;
    if (Math.abs(a.height(x, z) - b.height(x, z)) > 1e-6) diff++;
  }
  assert.ok(diff > 150, `terrain too similar across seeds (${diff}/200)`);
});

test('crater field is non-empty and geometrically sane', () => {
  const craters = generateCraters(makeRng(DEFAULT_SEED));
  assert.ok(craters.length > 20, `too few craters: ${craters.length}`);
  for (const c of craters) {
    assert.ok(c.R >= 2.2, `crater radius too small: ${c.R}`);
    assert.ok(c.depth > 0 && c.depth < c.R, `implausible depth ${c.depth} for R=${c.R}`);
    assert.ok(c.rim > 0 && c.rim < 1, `implausible rim factor ${c.rim}`);
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.z));
  }
});

test('a crater forms a depression at its centre relative to its surroundings', () => {
  // Use one isolated synthetic crater so neighbours cannot confound the test.
  const crater = { x: 0, z: 0, R: 20, depth: 3, rim: 0.4 };
  const { height } = createTerrain({ seed: 4242, craters: [crater] });
  const centre = height(0, 0);
  // Sample well outside the ejecta apron (> R * 1.42).
  let outside = 0;
  const ring = 8;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2;
    outside += height(Math.cos(a) * 60, Math.sin(a) * 60);
  }
  outside /= ring;
  assert.ok(centre < outside, `crater centre (${centre}) not below surroundings (${outside})`);
});

test('a crater has a raised rim above its own floor', () => {
  const crater = { x: 0, z: 0, R: 20, depth: 3, rim: 0.5 };
  const { height } = createTerrain({ seed: 4242, craters: [crater] });
  const floor = height(0, 0);
  // The rim peaks near t ~ 1.0 (d ~ R).
  let rimMax = -Infinity;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    rimMax = Math.max(rimMax, height(Math.cos(a) * crater.R, Math.sin(a) * crater.R));
  }
  assert.ok(rimMax > floor, `rim (${rimMax}) is not above the floor (${floor})`);
});

test('the driving corridor has no impassable step between adjacent samples', () => {
  // Walk the nominal circular path and check the slope the rover would meet.
  const { height } = createTerrain();
  const steps = 720;
  let worstStep = 0;
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.cos(a) * PATH_RADIUS, z = Math.sin(a) * PATH_RADIUS;
    const h = height(x, z);
    if (prev !== null) worstStep = Math.max(worstStep, Math.abs(h - prev));
    prev = h;
  }
  // Arc step at R=46 over 720 samples is ~0.4 m; a >1 m jump would mean a wall.
  assert.ok(worstStep < 1.0,
    `path contains a ${worstStep.toFixed(2)} m step — rover could not climb it`);
});

test('large craters are kept clear of the driving path', () => {
  const craters = generateCraters(makeRng(DEFAULT_SEED));
  for (const c of craters) {
    const dPath = Math.abs(Math.hypot(c.x, c.z) - PATH_RADIUS);
    if (c.R > 12) {
      assert.ok(dPath >= c.R * 0.6,
        `large crater R=${c.R.toFixed(1)} sits ${dPath.toFixed(1)} m from the path`);
    }
  }
});

test('terrain constants are coherent', () => {
  assert.ok(TERRAIN_SIZE > 0 && TERRAIN_SEG > 0);
  assert.ok(PATH_RADIUS * 2 < TERRAIN_SIZE / 2,
    'driving loop must sit well inside the terrain bounds');
  assert.equal(TERRAIN_SIZE % 2, 0);
});

test('custom crater injection is honoured', () => {
  const only = [{ x: 10, z: 10, R: 5, depth: 1, rim: 0.3 }];
  const t = createTerrain({ seed: 1, craters: only });
  assert.equal(t.craters.length, 1);
  assert.equal(t.craters[0].R, 5);
});
