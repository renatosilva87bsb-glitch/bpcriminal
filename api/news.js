const SOURCES = [
  { key: 'stj', name: 'STJ', url: 'https://res.stj.jus.br/hrestp-c-portalp/RSS.xml', kind: 'rss' },
  { key: 'stf', name: 'STF', url: 'https://noticias.stf.jus.br/', kind: 'html' },
  { key: 'cnj', name: 'CNJ', url: 'https://www.cnj.jus.br/agencia-cnj/noticias-do-cnj/', kind: 'html' }
];
const cache = { expiresAt: 0, payload: null };
const timeoutMs = 8000;

function decodeEntities(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
function clean(value = '') { return decodeEntities(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function absoluteUrl(value, base) { try { const u = new URL(value, base); return u.protocol === 'https:' ? u.href : null; } catch { return null; } }
function dateValue(value) { const time = Date.parse(value || ''); return Number.isFinite(time) ? new Date(time).toISOString() : null; }
function parseRss(xml, source) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].slice(0, 12).map(match => {
    const item = match[0];
    const get = tag => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '';
    return { title: clean(get('title')), url: absoluteUrl(clean(get('link')), source.url), excerpt: clean(get('description')).slice(0, 240), publishedAt: dateValue(clean(get('pubDate')) || clean(get('dc:date'))), source: source.name, sourceKey: source.key };
  }).filter(item => item.title && item.url);
}
function parseHtml(html, source) {
  const pattern = source.key === 'stf' ? /<h3[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi : /<h3[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const items = [];
  for (const match of html.matchAll(pattern)) {
    const url = absoluteUrl(match[1], source.url);
    const title = clean(match[2]);
    if (url && title && !items.some(item => item.url === url)) items.push({ title, url, excerpt: `Atualização publicada no portal oficial do ${source.name}.`, publishedAt: null, source: source.name, sourceKey: source.key });
    if (items.length >= 8) break;
  }
  return items;
}
async function fetchSource(source) {
  const response = await fetch(source.url, { headers: { accept: source.kind === 'rss' ? 'application/rss+xml, application/xml, text/xml' : 'text/html' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`source_${response.status}`);
  const body = await response.text();
  return source.kind === 'rss' ? parseRss(body, source) : parseHtml(body, source);
}
async function getNews() {
  if (cache.payload && cache.expiresAt > Date.now()) return cache.payload;
  const settled = await Promise.all(SOURCES.map(async source => {
    try { return { source: source.name, sourceKey: source.key, status: 'ok', items: await fetchSource(source) }; }
    catch { return { source: source.name, sourceKey: source.key, status: 'unavailable', items: [] }; }
  }));
  const items = settled.flatMap(result => result.items).sort((a, b) => (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0)).slice(0, 12);
  const payload = { items, fetchedAt: new Date().toISOString(), refreshAfterSeconds: 300, sources: settled.map(({ source, sourceKey, status }) => ({ source, sourceKey, status })) };
  cache.payload = payload; cache.expiresAt = Date.now() + 5 * 60 * 1000;
  return payload;
}
export default async function newsHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  try { return res.status(200).json(await getNews()); }
  catch { return res.status(503).json({ error: 'As fontes oficiais estão temporariamente indisponíveis.', items: [], sources: [] }); }
}
