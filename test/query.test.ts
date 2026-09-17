import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery } from '../src/query.js';
const parse = (q: string) => parseQuery(new URLSearchParams(q));
test('aligns groups, applies global emphasis, and uses defaults', () => {
  const request = parse('chords=C|Dbmaj7|Eb6&lh=C3,G3|Db3,Ab3|Eb3,Bb3&emphasize=C4');
  assert.equal(request.diagrams.length, 3);
  assert.equal(request.diagrams[1].lh[0].midi, 49);
  assert.ok(request.diagrams.every(d => d.emphasize[0].midi === 60));
  assert.equal(request.from, 48); assert.equal(request.to, 72); assert.equal(request.labels, true);
  assert.equal(parse('notes=C%234').diagrams[0].notes[0].spelling, 'C#4');
  assert.equal(parse('notes=C4|&emphasize=|D4').diagrams[0].emphasize.length, 0);
});
test('ignores unknown query parameters', () => {
  const request = parse('notes=C4&utm_source=chatgpt.com&whatever=hello');
  assert.equal(request.diagrams[0].notes[0].midi, 60);
});
test('rejects ambiguity, invalid notes, invalid booleans, and excessive input', () => {
  for (const query of ['chords=C|D&lh=C3', 'notes=C4,', 'notes=H4', 'notes=C2', 'from=C5&to=C3', 'from=C0', 'to=D8', 'labels=yes', 'title=a&title=b', 'title=%00', `title=${'a'.repeat(121)}`, `chords=${Array(17).fill('C').join('|')}`, 'notes=C4|D4|E4&emphasize=C4|D4']) assert.throws(() => parse(query), query);
  for (const value of ['false', '0']) assert.equal(parse(`labels=${value}`).labels, false);
  for (const value of ['true', '1']) assert.equal(parse(`labels=${value}`).labels, true);
});
