import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playbackNotes } from '../src/audio.js';
test('playback preserves pitch and octaves, deduplicates and gently staggers notes', () => {
  const plan = playbackNotes([81, 57, 69, 69]);
  assert.deepEqual(plan.map(n => n.frequency), [220, 440, 880]);
  assert.deepEqual(plan.map(n => n.delay), [0, 0.025, 0.05]);
  assert.equal(playbackNotes(Array.from({ length: 88 }, (_, i) => i + 21)).at(-1)!.delay, 0.22);
  assert.deepEqual(playbackNotes([]), []);
  assert.throws(() => playbackNotes([NaN]));
});
