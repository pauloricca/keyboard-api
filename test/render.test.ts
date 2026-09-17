import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery } from '../src/query.js';
import { renderSvg } from '../src/render.js';
import { buildServer } from '../src/server.js';
test('semantic SVG is deterministic, escaped, and highlights correct pitches', () => {
  const request = parseQuery(new URLSearchParams({ title: '<Lesson & "notes">', chords: 'C|Dbmaj7|Eb6', lh: 'C3,G3|Db3,Ab3|Eb3,Bb3', rh: 'C4,E4,G4|C4,F4,Ab4|C4,G4,Bb4', emphasize: 'C4' }));
  const svg = renderSvg(request);
  assert.equal(svg, renderSvg(request));
  assert.ok(svg.startsWith('<svg')); assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('&lt;Lesson &amp; &quot;notes&quot;&gt;'));
  assert.equal((svg.match(/class="keyboard"/g) ?? []).length, 3);
  assert.equal((svg.match(/class="key white highlighted emphasized" data-note="C4" data-midi="60"/g) ?? []).length, 3);
  assert.ok(svg.includes('class="key black highlighted left" data-note="Db3" data-midi="49"'));
  assert.ok(svg.includes('RH: C · F · Ab'));
});
test('one to sixteen diagrams calculate their own heights and labels can be disabled', () => {
  let previousHeight = 0;
  for (const count of [1, 10, 16]) {
    const svg = renderSvg(parseQuery(new URLSearchParams({ chords: Array(count).fill('Chord').join('|'), labels: 'false' })));
    const height = Number(/height="(\d+)"/.exec(svg)![1]);
    assert.ok(height > previousHeight); previousHeight = height;
    assert.equal((svg.match(/class="keyboard"/g) ?? []).length, count);
    assert.ok(!svg.includes('text-anchor="middle"'));
  }
});
test('HTTP health, SVG cache/type, and invalid query responses', async () => {
  const app = buildServer();
  try {
    assert.equal((await app.inject('/health')).statusCode, 200);
    const response = await app.inject('/render.svg?notes=C4');
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'image/svg+xml; charset=utf-8');
    assert.equal(response.headers['cache-control'], 'public, max-age=86400');
    const invalid = await app.inject('/render.svg?notes=H4');
    assert.equal(invalid.statusCode, 400); assert.equal(invalid.headers['cache-control'], undefined);
  } finally { await app.close(); }
});
test('bare render endpoint returns instructions; explicit parameters still render SVG', async () => {
  const app = buildServer();
  try {
    for (const url of ['/render.svg', '/render.svg?']) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['content-type'], 'text/plain; charset=utf-8');
      assert.match(response.body, /GET \/render.svg\?<parameters>/);
      assert.match(response.body, /\/editor/);
      assert.match(response.body, /notes=C4,E4,G4/);
    }
    for (const url of ['/render.svg?from=C3&to=C5', '/render.svg?notes=']) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['content-type'], 'image/svg+xml; charset=utf-8');
    }
    assert.equal((await app.inject('/render.svg?unknown=')).statusCode, 400);
  } finally { await app.close(); }
});
