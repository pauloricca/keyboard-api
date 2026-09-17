const PITCHES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export function parseNote(note: string): number {
  const match = /^([A-G])([b#]?)(-1|[0-9])$/.exec(note);
  if (!match) throw new Error(`Invalid note: ${note}`);
  const midi = (Number(match[3]) + 1) * 12 + PITCHES[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
  if (midi < 0 || midi > 127) throw new Error(`Note outside MIDI range: ${note}`);
  return midi;
}
export function isBlackKey(midi: number): boolean { return [1, 3, 6, 8, 10].includes(midi % 12); }
export function formatNote(midi: number): string { return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`; }
