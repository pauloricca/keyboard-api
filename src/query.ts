import { parseNote } from './notes.js';
import type { Note, RenderRequest } from './types.js';
export const LIMITS = { diagrams: 16, title: 120, subtitle: 200, label: 80, query: 16384 };
export type RenderFormat = 'svg' | 'png';
export function parseFormat(params: URLSearchParams): RenderFormat {
  const format = params.get('format') ?? 'svg';
  if (format !== 'svg' && format !== 'png') throw new Error('format must be svg or png');
  return format;
}
export function parseQuery(params: URLSearchParams): RenderRequest {
  const allowed = new Set(['format', 'title', 'subtitle', 'from', 'to', 'chords', 'notes', 'lh', 'rh', 'emphasize', 'labels']);
  if (params.toString().length > LIMITS.query) throw new Error('Query is too long');
  for (const name of params.keys()) {
    if (!allowed.has(name)) continue;
    if (params.getAll(name).length !== 1) throw new Error(`Duplicate parameter: ${name}`);
  }
  parseFormat(params);
  const text = (name: string, max: number) => {
    const value = params.get(name) ?? '';
    if (value.length > max || /[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/u.test(value)) throw new Error(`Invalid ${name}: text is too long or contains control characters`);
    return value;
  };
  const title = text('title', LIMITS.title), subtitle = text('subtitle', LIMITS.subtitle);
  const from = parseNote(params.get('from') ?? 'C3'), to = parseNote(params.get('to') ?? 'C5');
  if (from < 21 || to > 108 || from > to) throw new Error('Range must be ordered and within A0–C8');
  const labels = params.get('labels') ?? 'true';
  if (!['true', 'false', '1', '0'].includes(labels)) throw new Error('labels must be true, false, 1, or 0');
  const groups = (name: string) => params.has(name) ? params.get(name)!.split('|') : undefined;
  const chords = groups('chords'), notes = groups('notes'), lh = groups('lh'), rh = groups('rh'), emphasis = groups('emphasize');
  const count = Math.max(1, ...[chords, notes, lh, rh, emphasis].map(g => g?.length ?? 0));
  if (count > LIMITS.diagrams) throw new Error('At most 16 diagrams are allowed');
  for (const g of [chords, notes, lh, rh]) if (g && g.length !== count) throw new Error('Diagram group counts must match; use empty pipe-separated groups for rests');
  if (emphasis && emphasis.length !== 1 && emphasis.length !== count) throw new Error('Emphasis must be global or match the diagram count');
  const noteList = (value = ''): Note[] => {
    if (!value.trim()) return [];
    const tokens = value.split(',');
    if (tokens.length > 88) throw new Error('At most 88 notes per group are allowed');
    const unique = new Map<number, Note>();
    for (const token of tokens) {
      const spelling = token.trim(), midi = parseNote(spelling);
      if (midi < from || midi > to) throw new Error(`Note outside displayed range: ${spelling}`);
      if (!unique.has(midi)) unique.set(midi, { midi, spelling });
    }
    return [...unique.values()];
  };
  return { title, subtitle, from, to, labels: labels === 'true' || labels === '1', diagrams: Array.from({ length: count }, (_, i) => {
    const label = chords?.[i] ?? '';
    if (label.length > LIMITS.label || /[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/u.test(label)) throw new Error('Invalid diagram label');
    return { label, notes: noteList(notes?.[i]), lh: noteList(lh?.[i]), rh: noteList(rh?.[i]), emphasize: noteList(emphasis?.[emphasis.length === 1 ? 0 : i]) };
  }) };
}
