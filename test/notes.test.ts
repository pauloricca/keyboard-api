import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNote, isBlackKey, formatNote } from '../src/notes.js';
test('notes and enharmonics map to MIDI pitches', () => {
  for (const [name, midi] of [['C4', 60], ['Db4', 61], ['C#4', 61], ['B3', 59], ['Cb4', 59], ['B#3', 60]] as const) assert.equal(parseNote(name), midi);
  assert.equal(formatNote(61), 'Db4');
  for (const bad of ['H4', 'C', 'C##4', 'c4', 'C4x', 'G#9', '']) assert.throws(() => parseNote(bad));
});
test('key colours cover the chromatic octave', () => {
  for (let pc = 0; pc < 12; pc++) assert.equal(isBlackKey(60 + pc), [1, 3, 6, 8, 10].includes(pc));
});
