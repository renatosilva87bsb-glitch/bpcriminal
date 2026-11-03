import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import configHandler from './api/config.js';
import leadsHandler from './api/leads.js';
import iaHandler from './api/ia.js';
import contactEventsHandler from './api/contact-events.js';
import pushSubscribeHandler from './api/push-subscribe.js';
import pushSendHandler from './api/push-send.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);
const apiHandlers = {
  '/api/config': configHandler,
  '/api/leads': leadsHandler,
  '/api/ia': iaHandler,
  '/api/contact-events': contactEventsHandler,
  '/api/push-subscribe': pushSubscribeHandler,
  '/api/push-send': pushSendHandler
};
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.xml':'application/xml', '.txt':'text/plain; charset=utf-8' };

function responseAdapter(res) {
  return {
    setHeader(name, value) { res.setHeader(name, value); },
    status(code) { res.statusCode = code; return this; },
    json(payload) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(payload)); return this; }
  };
}

async function readBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return raw; }
}

async function handleApi(req, res, handler) {
  try {
    req.body = await readBody(req);
    await handler(req, responseAdapter(res));
    if (!res.writableEnded) res.end();
  } catch (error) {
    if (!res.writableEnded) { res.statusCode = error.message === 'request_too_large' ? 413 : 500; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: 'Não foi possível processar a solicitação.' })); }
  }
}

async function serveStatic(req, res) {
  let requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (requestPath === '/') requestPath = '/index.html';
  if (requestPath.endsWith('/')) requestPath += 'index.html';
  const candidate = path.resolve(staticRoot, `.${requestPath}`);
  if (!candidate.startsWith(staticRoot + path.sep)) { res.statusCode = 400; return res.end('Bad request'); }
  try {
    const stat = await fs.stat(candidate);
    if (!stat.isFile()) throw new Error('not_file');
    const ext = path.extname(candidate).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', ext === '.html' || ext === '.json' ? 'no-cache' : 'public, max-age=86400');
    res.end(await fs.readFile(candidate));
  } catch {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><title>Não encontrado</title><p>Página não encontrada.</p>');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (apiHandlers[url.pathname]) return handleApi(req, res, apiHandlers[url.pathname]);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD'); return res.end('Method Not Allowed'); }
  return serveStatic(req, res);
});

server.listen(port, '0.0.0.0', () => console.log(`B&P Advocacia listening on 0.0.0.0:${port}`));
