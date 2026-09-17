import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignNotes, toggleNote, NOTE_MODES, type NoteGroups } from '../src/selection.js';
const empty = (): NoteGroups => ({ lh: '', rh: '', notes: '', emphasize: '' });
test('moving a key through every mode leaves precisely one state; clicking again clears it', () => {
  let groups = empty();
  for (const mode of NOTE_MODES) {
    groups = toggleNote(groups, mode, 60);
    for (const other of NOTE_MODES) assert.equal(groups[other], other === mode ? 'C4' : '');
  }
  assert.deepEqual(toggleNote(groups, 'emphasize', 60), empty());
});
test('typed notes claim enharmonic pitches without disturbing other octaves', () => {
  const groups = assignNotes({ lh: 'Db4,C3', rh: 'E4', notes: 'C#4', emphasize: 'Db4' }, 'rh', 'C#4,E4');
  assert.deepEqual(groups, { lh: 'C3', rh: 'C#4,E4', notes: '', emphasize: '' });
});
test('invalid input does not corrupt groups, and partial text elsewhere is preserved', () => {
  const groups = { ...empty(), rh: 'C4' };
  assert.throws(() => assignNotes(groups, 'lh', 'C4,H4'));
  assert.equal(groups.rh, 'C4');
  assert.equal(assignNotes({ ...groups, notes: 'C4,H' }, 'lh', 'C4').notes, 'H');
});
