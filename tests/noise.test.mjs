/**
 * Noise primitive tests / 噪声基础函数测试
 *
 * The whole world is generated from these functions, so determinism and
 * bounded output are load-bearing properties.
 * 整个场景都由这些函数生成，因此"确定性"与"输出有界"是关键性质。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeRng, buildPermutation, createNoise, fade, lerp, DEFAULT_SEED,
} from '../src/world/noise.js';

test('RNG is deterministic for a given seed', () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  for (let i = 0; i < 1000; i++) assert.equal(a(), b());
});

test('RNG output stays within [0, 1)', () => {
  const r = makeRng(DEFAULT_SEED);
  for (let i = 0; i < 20000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('RNG does not collapse to a constant', () => {
  const r = makeRng(7);
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(r().toFixed(6));
  assert.ok(seen.size > 400, `suspiciously low variety: ${seen.size}`);
});

test('RNG survives a zero seed without producing a dead state', () => {
  const r = makeRng(0);
  const vals = Array.from({ length: 10 }, () => r());
  assert.ok(new Set(vals).size > 1, 'zero seed collapsed to a constant');
  assert.ok(vals.every((v) => v >= 0 && v < 1));
});

test('permutation table is a valid 512-entry mirrored shuffle', () => {
  const perm = buildPermutation(makeRng(DEFAULT_SEED));
  assert.equal(perm.length, 512);
  // First half must be a permutation of 0..255.
  const first = Array.from(perm.slice(0, 256)).sort((a, b) => a - b);
  for (let i = 0; i < 256; i++) assert.equal(first[i], i);
  // Second half mirrors the first.
  for (let i = 0; i < 256; i++) assert.equal(perm[i + 256], perm[i]);
});

test('fade curve is a proper smoothstep on [0, 1]', () => {
  assert.equal(fade(0), 0);
  assert.equal(fade(1), 1);
  assert.ok(Math.abs(fade(0.5) - 0.5) < 1e-12);
  // Monotonic increasing.
  let prev = -Infinity;
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const v = fade(t);
    assert.ok(v >= prev - 1e-12, `fade not monotonic at ${t}`);
    prev = v;
  }
});

test('lerp endpoints and midpoint', () => {
  assert.equal(lerp(2, 10, 0), 2);
  assert.equal(lerp(2, 10, 1), 10);
  assert.equal(lerp(2, 10, 0.5), 6);
});

test('noise2 output is bounded and finite', () => {
  const { noise2 } = createNoise(buildPermutation(makeRng(DEFAULT_SEED)));
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < 6000; i++) {
    const v = noise2((i % 97) * 0.37, Math.floor(i / 97) * 0.53);
    assert.ok(Number.isFinite(v), 'noise produced a non-finite value');
    min = Math.min(min, v); max = Math.max(max, v);
  }
  assert.ok(min >= -1.5 && max <= 1.5, `range too wide: [${min}, ${max}]`);
  assert.ok(max - min > 0.2, 'noise appears flat');
});

test('noise2 is continuous (no large jumps between adjacent samples)', () => {
  const { noise2 } = createNoise(buildPermutation(makeRng(DEFAULT_SEED)));
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const x = i * 0.011, y = 3.3;
    worst = Math.max(worst, Math.abs(noise2(x + 0.001, y) - noise2(x, y)));
  }
  assert.ok(worst < 0.1, `discontinuity detected, max step ${worst}`);
});

test('fbm is bounded, finite and seed-reproducible', () => {
  const mk = () => createNoise(buildPermutation(makeRng(DEFAULT_SEED)));
  const a = mk(), b = mk();
  for (let i = 0; i < 500; i++) {
    const x = i * 0.13, y = i * 0.07;
    const va = a.fbm(x, y), vb = b.fbm(x, y);
    assert.equal(va, vb, 'fbm is not reproducible for the same seed');
    assert.ok(Number.isFinite(va) && Math.abs(va) <= 1.5, `fbm out of range: ${va}`);
  }
});

test('fbm octave count changes detail but keeps output bounded', () => {
  const { fbm } = createNoise(buildPermutation(makeRng(DEFAULT_SEED)));
  for (const oct of [1, 3, 5, 8]) {
    const v = fbm(1.7, 2.9, oct);
    assert.ok(Number.isFinite(v) && Math.abs(v) <= 1.5, `oct=${oct} gave ${v}`);
  }
});

test('ridged noise stays within a sane band', () => {
  const { ridged } = createNoise(buildPermutation(makeRng(DEFAULT_SEED)));
  for (let i = 0; i < 1000; i++) {
    const v = ridged(i * 0.09, i * 0.04);
    assert.ok(Number.isFinite(v) && v >= -0.2 && v <= 1.5, `ridged out of band: ${v}`);
  }
});

test('different seeds produce different worlds', () => {
  const a = createNoise(buildPermutation(makeRng(1)));
  const b = createNoise(buildPermutation(makeRng(2)));
  let diff = 0;
  for (let i = 0; i < 200; i++) {
    if (Math.abs(a.fbm(i * 0.21, i * 0.17) - b.fbm(i * 0.21, i * 0.17)) > 1e-6) diff++;
  }
  assert.ok(diff > 150, `seeds produced near-identical fields (${diff}/200 differ)`);
});
