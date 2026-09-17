import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
test('serves editor and redirects the homepage without exposing server modules', async () => {
  const app = buildServer();
  try {
    const home = await app.inject('/');
    assert.equal(home.statusCode, 302); assert.equal(home.headers.location, '/editor');
    const page = await app.inject('/editor');
    assert.equal(page.statusCode, 200); assert.match(page.headers['content-type']!, /text\/html/);
    assert.match(page.body, /src="\/assets\/editor.js"/);
    assert.equal((await app.inject('/assets/server.js')).statusCode, 404);
  } finally { await app.close(); }
});
