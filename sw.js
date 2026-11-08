const SHELL = 'drop-shell-v1';
const SHARE = 'drop-share';
const ASSETS = ['./', './index.html', './manifest.json', './icon_192.png', './icon_512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== SHARE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function stashShare(request) {
  const form = await request.formData();
  const cache = await caches.open(SHARE);
  const items = [];
  let i = 0;
  for (const f of form.getAll('files')) {
    if (!(f instanceof File) || !f.size) continue;
    const key = `./_share/${Date.now()}_${i++}`;
    await cache.put(key, new Response(f, {headers: {'content-type': f.type || 'application/octet-stream'}}));
    items.push({key, name: f.name || 'file', type: f.type || 'application/octet-stream', size: f.size});
  }
  const text = [form.get('title'), form.get('text'), form.get('url')].filter(Boolean).join('\n');
  if (text.trim()) {
    const key = `./_share/${Date.now()}_${i++}`;
    await cache.put(key, new Response(text, {headers: {'content-type': 'text/plain; charset=utf-8'}}));
    items.push({key, name: 'shared_text.txt', type: 'text/plain', size: new Blob([text]).size});
  }
  await cache.put('./_share/manifest', new Response(JSON.stringify(items)));
  return Response.redirect('./?share=1', 303);
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith(stashShare(e.request));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then(r => { const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, {ignoreSearch: true})));
});
