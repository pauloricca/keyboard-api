import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';

test('serves SVG by default and PNG when requested', async () => {
  let rasterizedSvg = '';
  const app = buildServer(async svg => {
    rasterizedSvg = svg;
    return Buffer.from('fake-png');
  });
  try {
    const svg = await app.inject({ method: 'GET', url: '/render?notes=C4' });
    assert.equal(svg.statusCode, 200);
    assert.match(svg.headers['content-type'] ?? '', /^image\/svg\+xml/);
    assert.match(svg.body, /^<svg/);

    const png = await app.inject({ method: 'GET', url: '/render?format=png&notes=C4' });
    assert.equal(png.statusCode, 200);
    assert.equal(png.headers['content-type'], 'image/png');
    assert.equal(png.rawPayload.toString(), 'fake-png');
    assert.match(rasterizedSvg, /^<svg/);

    const invalid = await app.inject({ method: 'GET', url: '/render?format=webp&notes=C4' });
    assert.equal(invalid.statusCode, 400);

    const oldRoute = await app.inject({ method: 'GET', url: '/render.svg?notes=C4' });
    assert.equal(oldRoute.statusCode, 404);
  } finally {
    await app.close();
  }
});
