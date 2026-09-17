import Fastify from 'fastify';
import { pathToFileURL } from 'node:url';
import { parseFormat, parseQuery, LIMITS } from './query.js';
import { renderSvg } from './render.js';
import { renderPng } from './png.js';
import { readFile } from 'node:fs/promises';
import { editorPage } from './editor-page.js';
import { apiHelp } from './api-help.js';
export function buildServer(rasterize: (svg: string) => Promise<Buffer> = renderPng) {
  const app = Fastify({ logger: true, routerOptions: { maxParamLength: LIMITS.query } });
  app.get('/', async (_request, reply) => reply.redirect('/editor'));
  app.get('/editor', async (_request, reply) => reply.type('text/html; charset=utf-8').send(editorPage));
  // Serve only the browser bundle, never arbitrary server modules.
  app.get('/assets/editor.js', async (_request, reply) => {
    const source = await readFile(new URL('../dist/editor.bundle.js', import.meta.url), 'utf8');
    return reply.type('text/javascript; charset=utf-8').send(source);
  });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/render', async (request, reply) => {
    const params = new URL(request.raw.url!, 'http://localhost').searchParams;
    if (params.size === 0) return reply.type('text/plain; charset=utf-8').header('X-Content-Type-Options', 'nosniff').send(apiHelp);
    let parsed;
    let format;
    try {
      parsed = parseQuery(params);
      format = parseFormat(params);
    } catch (error) {
      return reply.code(400).type('application/json').send({ error: (error as Error).message });
    }
    const svg = renderSvg(parsed);
    reply.header('Cache-Control', 'public, max-age=86400').header('X-Content-Type-Options', 'nosniff');
    if (format === 'png') {
      try { return reply.type('image/png').send(await rasterize(svg)); }
      catch (error) {
        request.log.error({ err: error }, 'PNG conversion failed');
        return reply.code(500).type('application/json').send({ error: 'PNG conversion failed' });
      }
    }
    return reply.type('image/svg+xml; charset=utf-8').send(svg);
  });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = buildServer();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
  try { await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 3000) }); }
  catch (error) { app.log.error(error); process.exitCode = 1; }
}
