import { keyboardGeometry } from './keyboard.js';
import { formatNote, parseNote } from './notes.js';
import { parseQuery } from './query.js';
import { analyzeProgression, KEY_OPTIONS, type ProgressionAnalysis } from './chords.js';
import { assignNotes, toggleNote, noteTokens, type Mode } from './selection.js';
import { playChord } from './audio.js';

interface Layout { id: number; label: string; automatic: boolean; mode: Mode; lh: string; rh: string; notes: string; emphasize: string }
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const modes: [Mode, string][] = [['lh', 'Left hand'], ['rh', 'Right hand'], ['notes', 'Generic'], ['emphasize', 'Emphasis']];
let nextId = 1;
const fresh = (): Layout => ({ id: nextId++, label: '', automatic: true, mode: 'lh', lh: '', rh: '', notes: '', emphasize: '' });
let layouts: Layout[] = [fresh()];
let analysis: ProgressionAnalysis = { key: null, confidence: 'tentative', alternatives: [], chords: [] };
let objectUrl: string | undefined;
let generation = 0;
let currentUrl = '';
let generatedUrl = '';
let playingId: number | undefined;
let playRequest = 0;
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const value = (id: string) => $<HTMLInputElement>(id).value;
const midis = (s: string) => noteTokens(s).map(parseNote);
function suggestions(layout: Layout) {
  return analysis.chords[layouts.indexOf(layout)] ?? [];
}
function updateAnalysis() {
  const choice = value('key-context');
  analysis = analyzeProgression(layouts.map(layout => {
    try { return modes.flatMap(([mode]) => midis(layout[mode])); } catch { return []; }
  }), choice === 'auto' || choice === 'none' ? choice : KEY_OPTIONS[Number(choice)]);
  for (const layout of layouts) if (layout.automatic) layout.label = suggestions(layout)[0]?.label ?? '';
  $('key-description').textContent = analysis.key ? `${choice === 'auto' ? `${analysis.confidence === 'likely' ? 'Likely' : 'Tentative'} key` : 'Chosen key'}: ${analysis.key.tonic} ${analysis.key.mode}.${choice === 'auto' ? ` Other possibilities: ${analysis.alternatives.map(k => `${k.tonic} ${k.mode}`).join(', ')}. The opening chord helps, but later chords can change this estimate.` : ' Chord suggestions use this key while retaining the actual bass.'}` : choice === 'none' ? 'Name each voicing independently, without a key assumption.' : 'Select a chord to estimate a key. A short progression can have several interpretations.';
}
function refreshAnalysis() {
  updateAnalysis();
  for (const layout of layouts) {
    const article = document.querySelector<HTMLElement>(`[data-id="${layout.id}"]`);
    if (!article) continue;
    const name = article.querySelector<HTMLInputElement>('[data-field=label]')!;
    if (document.activeElement !== name) name.value = layout.label;
    article.querySelector('.suggestion')!.innerHTML = suggestionHtml(layout);
  }
}
function range() {
  const from = parseNote(value('from')), to = parseNote(value('to'));
  if (from > to) throw new Error('First note must be lower than or equal to the last note.');
  return { from, to };
}
function status(message: string, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function playableNotes(layout: Layout): number[] {
  try {
    const notes = modes.flatMap(([mode]) => midis(layout[mode]));
    const { from, to } = range();
    return notes.every(n => n >= from && n <= to) ? notes : [];
  } catch { return []; }
}
function refreshPlayButtons() {
  for (const layout of layouts) {
    const button = document.querySelector<HTMLButtonElement>(`[data-id="${layout.id}"] [data-action="play"]`);
    if (!button) continue;
    button.disabled = playableNotes(layout).length === 0;
    button.textContent = playingId === layout.id ? '↻ Replay' : '▶ Play';
  }
}
async function playLayout(layout: Layout) {
  const id = ++playRequest;
  playingId = layout.id; refreshPlayButtons();
  try { await playChord(playableNotes(layout)); }
  catch (error) { if (id === playRequest) status((error as Error).message, true); }
  finally { if (id === playRequest) { playingId = undefined; refreshPlayButtons(); } }
}
function buildUrl(): string {
  const params = new URLSearchParams({ title: value('title'), subtitle: value('subtitle'), from: value('from'), to: value('to'), labels: String($<HTMLInputElement>('labels').checked) });
  params.set('chords', layouts.map(l => l.label).join('|'));
  for (const [mode] of modes) params.set(mode, layouts.map(l => l[mode]).join('|'));
  // Use the same validation as the HTTP API before offering a link.
  parseQuery(params);
  return `${location.origin}/render?${params}`;
}
function syncUrl() {
  refreshPlayButtons();
  generation++;
  try {
    currentUrl = buildUrl();
    $<HTMLTextAreaElement>('api-url').value = currentUrl;
    $<HTMLButtonElement>('copy').disabled = false;
    $<HTMLButtonElement>('generate').disabled = false;
    status(generatedUrl && generatedUrl !== currentUrl ? 'Your layout has changed. Generate again to update the preview.' : 'Ready when you are.');
  } catch (error) {
    currentUrl = '';
    $<HTMLTextAreaElement>('api-url').value = '';
    $<HTMLButtonElement>('copy').disabled = true;
    $<HTMLButtonElement>('generate').disabled = true;
    status((error as Error).message, true);
  }
  $('download').hidden = !objectUrl || generatedUrl !== currentUrl;
}
function keyboard(layout: Layout): string {
  let geometry;
  try { const { from, to } = range(); geometry = keyboardGeometry(from, to); }
  catch { return '<p class="hint">Choose an ordered keyboard range to edit notes.</p>'; }
  const membership = Object.fromEntries(modes.map(([mode]) => {
    try { return [mode, new Set(midis(layout[mode]))]; } catch { return [mode, new Set<number>()]; }
  })) as Record<Mode, Set<number>>;
  const width = Math.max(geometry.width * 38, 240);
  return `<div class="keyboard-scroll"><div class="keyboard" style="width:100%;min-width:${width}px">${geometry.keys.map(key => {
    const selected = modes.filter(([mode]) => membership[mode].has(key.midi));
    const colour = membership.emphasize.has(key.midi) ? 'emphasized' : membership.rh.has(key.midi) ? 'right' : membership.lh.has(key.midi) ? 'left' : membership.notes.has(key.midi) ? 'generic' : '';
    return `<button class="key ${key.black ? 'black' : 'white'} ${colour}" style="left:${key.x / geometry.width * 100}%;width:${key.width / geometry.width * 100}%" data-midi="${key.midi}" aria-label="${formatNote(key.midi)}${selected.length ? `; ${selected.map(([, label]) => label).join(', ')}` : ''}" aria-pressed="${membership[layout.mode].has(key.midi)}" title="${formatNote(key.midi)} — toggle ${layout.mode}"><span class="note">${formatNote(key.midi)}</span></button>`;
  }).join('')}</div></div>`;
}
function suggestionHtml(layout: Layout): string {
  const names = suggestions(layout);
  return `${names.length ? `Suggested: <strong>${esc(names[0].label)}</strong><span class="chord-detail">${esc(names[0].detail)}</span>` : 'Select a chord to suggest its name. No match yet.'}<button class="auto" data-action="auto" ${layout.automatic ? 'disabled' : ''}>${layout.automatic ? 'Auto name on' : 'Use auto name'}</button>${names.length > 1 ? `<details><summary>Other interpretations (${Math.min(names.length - 1, 7)})</summary>${names.slice(1, 8).map(n => `<button class="auto" data-suggestion="${esc(n.label)}" title="${esc(n.detail)}">${esc(n.label)}</button>`).join('')}</details>` : ''}`;
}
function renderLayouts() {
  updateAnalysis();
  $('layouts').innerHTML = layouts.map((layout, index) => `<article class="layout" data-id="${layout.id}"><div class="layout-head"><span class="number">${String(index + 1).padStart(2, '0')}</span><label><input data-field="label" value="${esc(layout.label)}" maxlength="80" placeholder="Name this layout" aria-label="Layout ${index + 1} name"></label><button class="play" data-action="play" aria-label="Play layout ${index + 1}" title="Play this chord with a gentle stagger">▶ Play</button><button class="remove" data-action="remove" ${layouts.length === 1 ? 'disabled' : ''}>Remove</button></div><div class="suggestion">${suggestionHtml(layout)}</div><div class="tools" role="group" aria-label="Note selection mode">${modes.map(([mode, label]) => `<button data-mode="${mode}" aria-pressed="${layout.mode === mode}">${label}</button>`).join('')}</div><div class="keyboard-container">${keyboard(layout)}</div><div class="note-fields">${modes.map(([mode, label]) => `<label>${label} notes<input data-field="${mode}" value="${esc(layout[mode])}" placeholder="e.g. C4,E4,G4" aria-label="Layout ${index + 1} ${label.toLowerCase()} notes" spellcheck="false"></label>`).join('')}</div></article>`).join('');
  $('count').textContent = `${layouts.length} / 16`;
  $<HTMLButtonElement>('add').disabled = layouts.length >= 16;
}
for (const id of ['from', 'to']) {
  $<HTMLSelectElement>(id).innerHTML = Array.from({ length: 88 }, (_, i) => `<option>${formatNote(i + 21)}</option>`).join('');
  $<HTMLSelectElement>(id).value = id === 'from' ? 'C3' : 'C5';
  $(id).addEventListener('change', () => { renderLayouts(); syncUrl(); });
}
for (const id of ['title', 'subtitle', 'labels']) $(id).addEventListener('input', syncUrl);
$<HTMLSelectElement>('key-context').innerHTML = '<option value="auto">Auto — follow the progression</option><option value="none">No key context</option>' + KEY_OPTIONS.map((key, i) => `<option value="${i}">${key.tonic} ${key.mode}</option>`).join('');
$('key-context').addEventListener('change', () => { refreshAnalysis(); syncUrl(); });
$('add').addEventListener('click', () => {
  if (layouts.length >= 16) return;
  layouts.push(fresh()); renderLayouts(); syncUrl();
  document.querySelector<HTMLInputElement>('.layout:last-child input')?.focus();
});
$('layouts').addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  const article = input.closest<HTMLElement>('[data-id]');
  const layout = layouts.find(l => l.id === Number(article?.dataset.id));
  if (!layout || !input.dataset.field || !article) return;
  const field = input.dataset.field as Mode | 'label';
  layout[field] = input.value;
  if (field === 'label') layout.automatic = false;
  else {
    try { Object.assign(layout, assignNotes(layout, field, input.value)); } catch { /* Keep incomplete input visible; shared query validation blocks generation. */ }
    for (const [mode] of modes) if (mode !== field) article.querySelector<HTMLInputElement>(`[data-field=${mode}]`)!.value = layout[mode];
    article.querySelector('.keyboard-container')!.innerHTML = keyboard(layout);
  }
  refreshAnalysis();
  syncUrl();
});
$('layouts').addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  const layout = layouts.find(l => l.id === Number(button?.closest<HTMLElement>('[data-id]')?.dataset.id));
  if (!button || !layout) return;
  if (button.dataset.action === 'play') { void playLayout(layout); return; }
  if (button.dataset.mode) layout.mode = button.dataset.mode as Mode;
  else if (button.dataset.action === 'remove') {
    if (layouts.length > 1) layouts = layouts.filter(l => l.id !== layout.id);
  } else if (button.dataset.action === 'auto') { layout.automatic = true; }
  else if (button.dataset.suggestion) { layout.label = button.dataset.suggestion; layout.automatic = false; }
  else if (button.dataset.midi) {
    try {
      Object.assign(layout, toggleNote(layout, layout.mode, Number(button.dataset.midi)));
    } catch { status('Correct the note text for this selection mode before clicking keys.', true); return; }
  }
  const focusSelector = button.dataset.midi ? `[data-midi="${button.dataset.midi}"]` : button.dataset.mode ? `[data-mode="${button.dataset.mode}"]` : '[data-field="label"]';
  renderLayouts(); syncUrl();
  document.querySelector<HTMLElement>(`[data-id="${layout.id}"] ${focusSelector}`)?.focus({ preventScroll: true });
});
$('copy').addEventListener('click', async () => {
  if (!currentUrl) return;
  try { await navigator.clipboard.writeText(currentUrl); status('API URL copied.'); }
  catch { $<HTMLTextAreaElement>('api-url').select(); status('Select and copy the URL above; clipboard access is unavailable.', true); }
});
$('generate').addEventListener('click', async () => {
  if (!currentUrl) return;
  const url = currentUrl, requestId = ++generation;
  $<HTMLButtonElement>('generate').disabled = true;
  status('Generating your graphic…');
  try {
    const response = await fetch(url);
    if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Could not generate the graphic.'); }
    const blob = await response.blob();
    if (requestId !== generation) return;
    const oldUrl = objectUrl;
    objectUrl = URL.createObjectURL(blob); generatedUrl = url;
    $<HTMLImageElement>('preview-image').src = objectUrl;
    const download = $<HTMLAnchorElement>('download'); download.href = objectUrl;
    download.download = `${value('title').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'keyboard-progression'}.svg`;
    download.hidden = false; $('preview').hidden = false; $('empty-preview').hidden = true;
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    status('Graphic ready. Download the SVG or share the API URL.');
  } catch (error) { if (requestId === generation) status((error as Error).message, true); }
  finally { if (requestId === generation) $<HTMLButtonElement>('generate').disabled = false; }
});
renderLayouts(); syncUrl();
