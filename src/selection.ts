import { formatNote, parseNote } from './notes.js';
export const NOTE_MODES = ['lh', 'rh', 'notes', 'emphasize'] as const;
export type Mode = typeof NOTE_MODES[number];
export type NoteGroups = Record<Mode, string>;
export const noteTokens = (value: string) => value.trim() ? value.split(',').map(n => n.trim()) : [];
export function assignNotes(groups: NoteGroups, mode: Mode, value: string): NoteGroups {
  const selected = new Set(noteTokens(value).map(parseNote));
  const result = { ...groups, [mode]: value };
  for (const other of NOTE_MODES) if (other !== mode) {
    // Preserve unfinished text elsewhere; remove valid overlapping pitches.
    result[other] = noteTokens(groups[other]).filter(token => {
      try { return !selected.has(parseNote(token)); } catch { return true; }
    }).join(',');
  }
  return result;
}
export function toggleNote(groups: NoteGroups, mode: Mode, midi: number): NoteGroups {
  const tokens = noteTokens(groups[mode]);
  const existing = tokens.map(parseNote);
  const next = existing.includes(midi) ? tokens.filter(n => parseNote(n) !== midi) : [...tokens, formatNote(midi)].sort((a, b) => parseNote(a) - parseNote(b));
  return assignNotes(groups, mode, next.join(','));
}
