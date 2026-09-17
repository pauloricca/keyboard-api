import Fastify from 'fastify';
import { pathToFileURL } from 'node:url';
import { parseQuery, LIMITS } from './query.js';
import { renderSvg } from './render.js';
import { readFile } from 'node:fs/promises';
import { editorPage } from './editor-page.js';
import { apiHelp } from './api-help.js';
export function buildServer() {
  const app = Fastify({ logger: true, routerOptions: { maxParamLength: LIMITS.query } });
  app.get('/', async (_request, reply) => reply.redirect('/editor'));
  app.get('/editor', async (_request, reply) => reply.type('text/html; charset=utf-8').send(editorPage));
  // Serve only the browser bundle, never arbitrary server modules.
  app.get('/assets/editor.js', async (_request, reply) => {
    const source = await readFile(new URL('../dist/editor.bundle.js', import.meta.url), 'utf8');
    return reply.type('text/javascript; charset=utf-8').send(source);
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/render.svg', async (request, reply) => {
    const params = new URL(request.raw.url!, 'http://localhost').searchParams;
    if (params.size === 0) return reply.type('text/plain; charset=utf-8').header('X-Content-Type-Options', 'nosniff').send(apiHelp);
    let parsed;
    try { parsed = parseQuery(params); }
    catch (error) { return reply.code(400).type('application/json').send({ error: (error as Error).message }); }
    return reply.type('image/svg+xml; charset=utf-8').header('Cache-Control', 'public, max-age=86400').header('X-Content-Type-Options', 'nosniff').send(renderSvg(parsed));
  });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = buildServer();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
  try { await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) }); }
  catch (error) { app.log.error(error); process.exitCode = 1; }
}
