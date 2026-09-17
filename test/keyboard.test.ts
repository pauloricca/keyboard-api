import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyboardGeometry } from '../src/keyboard.js';
test('black keys follow the 2+3 pattern across octaves', () => {
  const { keys } = keyboardGeometry(48, 72);
  const blacks = keys.filter(k => k.black);
  assert.deepEqual(blacks.map(k => k.midi), [49, 51, 54, 56, 58, 61, 63, 66, 68, 70]);
  assert.deepEqual(blacks.map(k => Math.round(k.x + k.width / 2)), [1, 2, 4, 5, 6, 8, 9, 11, 12, 13]);
});
test('all piano subranges fit their bounds, including black endpoints', () => {
  for (let from = 21; from <= 108; from++) for (let to = from; to <= 108; to++) {
    const { keys, width } = keyboardGeometry(from, to);
    assert.equal(keys.length, to - from + 1);
    assert.equal(Math.min(...keys.map(k => k.x)), 0);
    for (const key of keys) assert.ok(key.x + key.width <= width + 1e-9);
  }
  assert.equal(keyboardGeometry(61, 61).keys[0].black, true);
  assert.throws(() => keyboardGeometry(72, 60));
});
