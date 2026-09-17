import { isBlackKey } from './notes.js';
export interface Key { midi: number; black: boolean; x: number; width: number }
// Absolute white-key indices keep accidental boundaries correct across octaves.
const WHITE_INDEX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
export function keyboardGeometry(from: number, to: number): { keys: Key[]; width: number } {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 21 || to > 108 || from > to) {
    throw new Error('Keyboard range must be ordered and within A0–C8');
  }
  const keys: Key[] = [];
  for (let midi = from; midi <= to; midi++) {
    const black = isBlackKey(midi);
    const index = Math.floor(midi / 12) * 7 + WHITE_INDEX[midi % 12];
    keys.push({ midi, black, x: index + (black ? 0.69 : 0), width: black ? 0.62 : 1 });
  }
  const left = Math.min(...keys.map(k => k.x));
  const right = Math.max(...keys.map(k => k.x + k.width));
  return { keys: keys.map(k => ({ ...k, x: k.x - left })), width: right - left };
}
