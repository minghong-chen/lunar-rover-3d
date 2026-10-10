/**
 * HUD formatting tests / HUD 格式化测试
 *
 * The FPS formatter matters: an earlier build computed frame rate from the
 * clamped simulation delta, which inflated the number. It now reports one
 * decimal below 10 so very low frame rates stay visible instead of showing 0.
 * 帧率格式化很重要：早期版本用被钳制的 dt 计算帧率导致读数虚高；
 * 现在低于 10 时保留一位小数，使极低帧率如实显示而不是变成 0。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fmt } from '../src/ui/controlPanel.js';

test('speed shows two decimals with a multiplier sign', () => {
  assert.equal(fmt.speed(1), '1.00×');
  assert.equal(fmt.speed(0.05), '0.05×');
  assert.equal(fmt.speed(3), '3.00×');
});

test('sun angle is a whole number of degrees', () => {
  assert.equal(fmt.sun(18), '18°');
  assert.equal(fmt.sun(2.4), '2°');
  assert.equal(fmt.sun(69.6), '70°');
});

test('star brightness renders as a percentage', () => {
  assert.equal(fmt.star(1), '100%');
  assert.equal(fmt.star(0), '0%');
  assert.equal(fmt.star(0.45), '45%');
});

test('low frame rates keep one decimal instead of rounding to zero', () => {
  assert.equal(fmt.fps(0.2), '0.2');
  assert.equal(fmt.fps(9.4), '9.4');
  // Above 10 an integer is enough.
  assert.equal(fmt.fps(60), '60');
  assert.equal(fmt.fps(59.6), '60');
});

test('a sub-1 FPS reading never displays as 0', () => {
  for (const v of [0.05, 0.1, 0.44, 0.99]) {
    assert.notEqual(fmt.fps(v), '0', `fps ${v} collapsed to "0"`);
  }
});

test('distance and velocity use stable decimal widths', () => {
  assert.equal(fmt.dist(0), '0.0');
  assert.equal(fmt.dist(12.34), '12.3');
  assert.equal(fmt.vel(0), '0.00');
  assert.equal(fmt.vel(0.42), '0.42');
});
