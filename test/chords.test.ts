import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestChords, analyzeProgression, chordCandidates } from '../src/chords.js';
test('suggests exact chords across octaves, inversions and ambiguous voicings', () => {
  assert.equal(suggestChords([48, 60, 64, 67])[0], 'C');
  assert.equal(suggestChords([64, 67, 72])[0], 'C/E');
  assert.equal(suggestChords([49, 56, 60, 65, 68])[0], 'Dbmaj7');
  assert.equal(suggestChords([51, 58, 60, 67, 70])[0], 'Eb6');
  assert.ok(suggestChords([60, 64, 67, 69]).includes('Am7/C'));
  assert.equal(suggestChords([60, 63, 67])[0], 'Cm');
  assert.deepEqual(suggestChords([60, 61, 62]), []);
  assert.deepEqual(suggestChords([]), []);
});
test('recognizes extended, altered, suspended and diminished families', () => {
  for (const [notes, label] of [
    [[60, 64, 67, 70, 73], 'C7b9'],
    [[60, 64, 67, 71, 74, 78], 'Cmaj9#11'],
    [[60, 63, 67, 70, 74, 77], 'Cm11'],
    [[60, 64, 67, 70, 74, 81], 'C13'],
    [[60, 65, 67, 70], 'C7sus4'],
    [[60, 63, 66, 69], 'Cdim7'],
    [[60, 64, 67, 69, 74], 'C6/9'],
  ] as [number[], string][]) assert.ok(suggestChords(notes).includes(label), label);
});
test('opening harmony changes the preferred reading of an identical later voicing', () => {
  const ambiguous = [60, 64, 67, 69];
  const major = analyzeProgression([[60, 64, 67], ambiguous]);
  const minor = analyzeProgression([[57, 60, 64], ambiguous]);
  assert.deepEqual(major.key, { tonic: 'C', mode: 'major' });
  assert.deepEqual(minor.key, { tonic: 'A', mode: 'minor' });
  assert.equal(major.chords[1][0].label, 'C6');
  assert.equal(minor.chords[1][0].label, 'Am7/C');
  assert.match(minor.chords[1][0].detail, /First inversion/);
  assert.equal(analyzeProgression([[60, 64, 67]], { tonic: 'A', mode: 'minor' }).key?.tonic, 'A');
  assert.equal(analyzeProgression([[57, 60, 64], ambiguous], 'none').chords[1][0].label, 'C6');
});
test('key inference uses later harmony, cadence and sensible sharp spelling', () => {
  const progression = analyzeProgression([[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71]]);
  assert.deepEqual(progression.key, { tonic: 'C', mode: 'major' });
  assert.deepEqual(progression.chords.map(c => c[0].label), ['Dm7', 'G7', 'Cmaj7']);
  assert.equal(suggestChords([54, 57, 61], { tonic: 'D', mode: 'major' })[0], 'F#m');
  assert.equal(suggestChords([58, 62, 65], { tonic: 'F', mode: 'major' })[0], 'Bb');
  assert.equal(analyzeProgression([[], [60], []]).key, null);
  assert.equal(analyzeProgression([[60, 64, 67]]).confidence, 'tentative');
});
test('omissions are disclosed and slash basses are not called inversions', () => {
  const rootless = chordCandidates([64, 70, 74]).find(c => c.root === 0 && c.label.includes('no root'));
  assert.ok(rootless); assert.match(rootless.detail, /omitted root/);
  const slash = chordCandidates([50, 60, 64, 67]).find(c => c.label === 'C/D');
  assert.ok(slash); assert.match(slash.detail, /Non-chord bass/);
  assert.deepEqual(suggestChords([60, 61, 62]), []);
});
