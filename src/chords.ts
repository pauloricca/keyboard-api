import { all } from '@tonaljs/chord-type';
import Note from '@tonaljs/note';
const { chroma, transpose } = Note;

export interface KeyContext { tonic: string; mode: 'major' | 'minor' }
export interface ChordSuggestion { label: string; root: number; minor: boolean; dominant: boolean; score: number; detail: string }
export interface ProgressionAnalysis { key: KeyContext | null; confidence: 'tentative' | 'likely'; alternatives: KeyContext[]; chords: ChordSuggestion[][] }
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
export const KEY_OPTIONS: KeyContext[] = [
  ...['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(tonic => ({ tonic, mode: 'major' as const })),
  ...['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'].map(tonic => ({ tonic, mode: 'minor' as const })),
];
const COMMON = new Set(['', 'm', 'dim', 'aug', '5', 'sus2', 'sus4', '7', 'maj7', 'm7', 'mMaj7', 'dim7', 'm7b5', '6', 'm6', 'add9', 'madd9', '9', 'maj9', 'm9', '11', 'm11', '13', 'maj13', 'm13', '6/9']);
const ALIASES: Record<string, string> = { M: '', 'm/ma7': 'mMaj7', Madd9: 'add9', '6add9': '6/9', 'maj#4': 'maj7#11', mM9: 'mMaj9', alt7: '7b9(no5)' };
const dictionary = all().map(type => ({ ...type, suffix: ALIASES[type.aliases[0]] ?? type.aliases[0].replace(/^M(?=\d)/, 'maj'), pcs: [...type.chroma].flatMap((bit, i) => bit === '1' ? [i] : []) }));
const mod = (n: number) => (n + 120) % 12;
const unique = (notes: number[]) => [...new Set(notes.map(n => mod(n)))];
function scale(key: KeyContext) { return (key.mode === 'major' ? MAJOR : MINOR).map(n => mod(n + chroma(key.tonic)!)); }
function pitchName(pitch: number, key?: KeyContext | null): string {
  if (!key) return FLATS[pitch];
  const intervals = key.mode === 'major' ? ['1P', '2M', '3M', '4P', '5P', '6M', '7M'] : ['1P', '2M', '3m', '4P', '5P', '6m', '7m'];
  const spelling = intervals.map(i => transpose(key.tonic, i)).find(n => chroma(n) === pitch);
  const sharpKey = key.tonic.includes('#') || (key.mode === 'major' ? ['G', 'D', 'A', 'E', 'B'] : ['E', 'B']).includes(key.tonic);
  return spelling ?? (sharpKey ? SHARPS : FLATS)[pitch];
}
function roman(root: number, minor: boolean, key: KeyContext): string {
  const degree = scale(key).indexOf(root);
  if (degree < 0) return 'Chromatic root';
  const numeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degree];
  return `Degree ${minor ? numeral.toLowerCase() : numeral}`;
}

/** Every selected pitch must be explained. Only root/perfect-fifth omissions
 * are permitted, explicitly labelled and penalized against exact matches. */
export function chordCandidates(notes: number[], key?: KeyContext | null): ChordSuggestion[] {
  if (unique(notes).length < 2) return [];
  const pitches = unique(notes), bass = mod(Math.min(...notes));
  const keyPitches = key ? scale(key) : [];
  const result: ChordSuggestion[] = [];
  for (let root = 0; root < 12; root++) for (const type of dictionary) {
    const chordPitches = type.pcs.map(n => mod(n + root));
    const extras = pitches.filter(n => !chordPitches.includes(n));
    const slashBass = extras.length === 1 && extras[0] === bass && pitches.length >= 4;
    if (extras.length && !slashBass) continue;
    const missing = type.pcs.filter(n => !pitches.includes(mod(root + n)));
    if (missing.some(n => n !== 0 && n !== 7)) continue;
    if (missing.length && (pitches.length < 3 || slashBass)) continue;
    const noRoot = missing.includes(0), noFifth = missing.includes(7);
    const minor = type.intervals.includes('3m');
    const dominant = type.intervals.includes('3M') && type.pcs.includes(10);
    if (noRoot && !(type.pcs.some(n => n === 3 || n === 4) && type.pcs.some(n => n === 10 || n === 11) && type.intervals.some(i => Number.parseInt(i) >= 9))) continue;
    const rootName = pitchName(root, key);
    const bassSpelling = type.intervals.map(i => transpose(rootName, i)).find(n => chroma(n) === bass) ?? pitchName(bass, key);
    const suffix = type.suffix;
    const omissions = [noRoot ? 'no root' : '', noFifth && !suffix.includes('no5') ? 'no5' : ''].filter(Boolean);
    const label = `${rootName}${suffix}${root === bass ? '' : `/${bassSpelling}`}${omissions.length ? ` (${omissions.join(', ')})` : ''}`;
    let score = (COMMON.has(suffix) ? 2 : 0) + (root === bass ? 1.2 : 0) - (noRoot ? 5 : 0) - (noFifth ? 2 : 0) - (slashBass ? 3 : 0);
    score -= Math.max(0, type.pcs.length - 4) * 0.12;
    if (key) {
      const tonic = chroma(key.tonic)!;
      if (keyPitches.includes(root)) score += 0.7;
      if (root === tonic && (key.mode === 'minor' ? minor : type.intervals.includes('3M'))) score += 2.5;
      if (root === mod(tonic + 7) && type.intervals.includes('3M')) score += 1.1;
      if (chordPitches.every(n => keyPitches.includes(n))) score += 0.8;
    }
    const bassInterval = type.intervals.find(i => chroma(transpose(rootName, i)) === bass);
    const degree = Number.parseInt(bassInterval ?? '0');
    const inversion = root === bass ? 'Root position' : slashBass ? 'Non-chord bass' : degree === 3 ? 'First inversion' : degree === 5 ? 'Second inversion' : degree === 7 ? 'Third inversion' : 'Extension in bass';
    result.push({ label, root, minor, dominant, score, detail: [key ? roman(root, minor, key) : '', inversion, ...omissions.map(o => `Assumes ${o === 'no root' ? 'omitted root' : 'omitted fifth'}`)].filter(Boolean).join(' · ') });
  }
  const deduped = new Map<string, ChordSuggestion>();
  for (const c of result.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))) if (!deduped.has(c.label)) deduped.set(c.label, c);
  return [...deduped.values()];
}
export function suggestChords(notes: number[], key?: KeyContext | null): string[] { return chordCandidates(notes, key).map(c => c.label); }

/** Heuristic: pitch fit, opening harmony and dominant-to-tonic motion.
 * A short progression does not establish a unique key. */
export function analyzeProgression(progression: number[][], choice: KeyContext | 'auto' | 'none' = 'auto'): ProgressionAnalysis {
  const base = progression.map(notes => chordCandidates(notes));
  const nonempty = progression.map((notes, i) => ({ notes, candidates: base[i] })).filter(x => unique(x.notes).length >= 3);
  let key: KeyContext | null = typeof choice === 'object' ? choice : null;
  let alternatives: KeyContext[] = [];
  let confidence: ProgressionAnalysis['confidence'] = 'tentative';
  if (choice === 'auto' && nonempty.length) {
    const ranked = KEY_OPTIONS.map(candidate => {
      const allowed = scale(candidate), tonic = chroma(candidate.tonic)!;
      let score = 0;
      for (const { notes } of nonempty) for (const pitch of unique(notes)) score += allowed.includes(pitch) ? 1 : candidate.mode === 'minor' && pitch === mod(tonic + 11) ? 0.1 : -2;
      const tonicMatch = (cs: ChordSuggestion[]) => cs.slice(0, 3).find(c => c.score >= cs[0].score - 1.5 && c.root === tonic && c.minor === (candidate.mode === 'minor'));
      if (tonicMatch(nonempty[0].candidates)) score += 4;
      if (tonicMatch(nonempty[nonempty.length - 1].candidates)) score += 1.5;
      for (let i = 1; i < nonempty.length; i++) {
        const before = nonempty[i - 1].candidates[0], after = nonempty[i].candidates[0];
        if (before?.root === mod(tonic + 7) && before.dominant && after?.root === tonic) score += 3;
      }
      return { key: candidate, score };
    }).sort((a, b) => b.score - a.score);
    key = ranked[0].key; alternatives = ranked.slice(1, 3).map(r => r.key);
    confidence = nonempty.length > 1 && ranked[0].score - ranked[1].score >= 3 ? 'likely' : 'tentative';
  }
  const chords = progression.map(notes => chordCandidates(notes, key));
  if (choice !== 'none') for (let i = 0; i < chords.length - 1; i++) {
    const next = chords.slice(i + 1).find(cs => cs.length)?.[0];
    if (!next) continue;
    for (const chord of chords[i]) if (mod(chord.root - next.root) === 7 && chord.dominant) chord.score += 1.5;
    chords[i].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  }
  return { key, confidence, alternatives, chords };
}
