import { keyboardGeometry } from './keyboard.js';
import { formatNote } from './notes.js';
import type { Note, RenderRequest } from './types.js';
export const THEME = {
  background: '#ffffff', panel: '#f4f6f8', white: '#ffffff', black: '#202735',
  left: '#2263a6', right: '#b64165', generic: '#8a6100', emphasis: '#a52b22',
  text: '#202735', secondary: '#586477', border: '#abb4c0',
};
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}
function wrap(value: string, limit: number): string[] {
  const lines: string[] = [];
  let rest = value;
  while (rest.length > limit) {
    const space = rest.lastIndexOf(' ', limit);
    const cut = space > limit / 2 ? space : limit;
    lines.push(rest.slice(0, cut)); rest = rest.slice(cut).trimStart();
  }
  if (rest) lines.push(rest);
  return lines;
}
export function renderSvg(request: RenderRequest): string {
  const pieces: string[] = [];
  const text = (value: string, x: number, y: number, size: number, color: string = THEME.text, extra = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${escapeXml(value)}</text>`;
  let y = 44;
  for (const line of wrap(request.title, 57)) { pieces.push(text(line, 48, y, 30, THEME.text, 'font-weight="700"')); y += 38; }
  for (const line of wrap(request.subtitle, 95)) { pieces.push(text(line, 48, y, 18, THEME.secondary)); y += 26; }
  if (request.title || request.subtitle) y += 14;
  const geometry = keyboardGeometry(request.from, request.to);
  const unit = Math.min(64, 1056 / geometry.width);
  const keyboardWidth = geometry.width * unit;
  const keyboardX = (1200 - keyboardWidth) / 2;
  const num = (n: number) => Number(n.toFixed(3));
  for (const [index, diagram] of request.diagrams.entries()) {
    const legends: { value: string; color: string }[] = [];
    for (const [prefix, notes, color] of [
      ['LH', diagram.lh, THEME.left], ['RH', diagram.rh, THEME.right],
      ['Notes', diagram.notes, THEME.generic], ['Emphasis', diagram.emphasize, THEME.emphasis],
    ] as [string, Note[], string][]) {
      if (notes.length) for (const line of wrap(`${prefix}: ${notes.map(n => n.spelling.replace(/-?\d+$/, '')).join(' · ')}`, 110)) legends.push({ value: line, color });
    }
    const labelLines = wrap(diagram.label || `Keyboard ${index + 1}`, 70);
    const keyY = y + 30 + labelLines.length * 30;
    const blockHeight = keyY - y + 180 + (legends.length ? 22 + legends.length * 23 : 0) + 24;
    pieces.push(`<g class="diagram" data-diagram-index="${index}"><rect x="32" y="${y}" width="1136" height="${blockHeight}" rx="16" fill="${THEME.panel}"/>`);
    labelLines.forEach((line, i) => pieces.push(text(line, 56, y + 35 + i * 30, 24, THEME.text, 'font-weight="600"')));
    pieces.push(`<g class="keyboard" data-diagram-index="${index}" transform="translate(${num(keyboardX)} ${keyY})">`);
    const highlighted = new Map<number, { note: Note; role: string; color: string }>();
    for (const [notes, role, color] of [[diagram.notes, 'generic', THEME.generic], [diagram.lh, 'left', THEME.left], [diagram.rh, 'right', THEME.right], [diagram.emphasize, 'emphasized', THEME.emphasis]] as [Note[], string, string][]) {
      for (const note of notes) highlighted.set(note.midi, { note, role, color });
    }
    for (const key of [...geometry.keys.filter(k => !k.black), ...geometry.keys.filter(k => k.black)]) {
      const active = highlighted.get(key.midi), height = key.black ? 112 : 180;
      const spelling = active?.note.spelling ?? formatNote(key.midi);
      const x = num(key.x * unit), width = num(key.width * unit);
      pieces.push(`<rect class="key ${key.black ? 'black' : 'white'}${active ? ` highlighted ${active.role}` : ''}" data-note="${escapeXml(spelling)}" data-midi="${key.midi}" x="${x}" y="0" width="${width}" height="${height}" rx="3" fill="${active?.color ?? (key.black ? THEME.black : THEME.white)}" stroke="${THEME.border}" stroke-width="1"><title>${escapeXml(spelling)}${active ? ` (${active.role})` : ''}</title></rect>`);
      if (request.labels && (active || key.midi % 12 === 0)) {
        pieces.push(text(spelling, num(x + width / 2), height - 13, num(Math.min(13, width / (spelling.length * 0.65 + 0.7))), active || key.black ? '#ffffff' : THEME.secondary, 'text-anchor="middle" font-weight="600"'));
      }
    }
    pieces.push('</g>');
    legends.forEach((line, i) => pieces.push(text(line.value, 56, keyY + 208 + i * 23, 16, line.color)));
    pieces.push('</g>'); y += blockHeight + 24;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${y + 8}" viewBox="0 0 1200 ${y + 8}" role="img" aria-labelledby="graphic-title" font-family="Arial, Helvetica, sans-serif"><title id="graphic-title">${escapeXml(request.title || 'Piano keyboard diagrams')}</title><rect width="100%" height="100%" fill="${THEME.background}"/>${pieces.join('')}</svg>`;
}
