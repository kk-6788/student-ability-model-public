'use strict';
const VERSION = 'mdiag-v20261010-review2';
const BASE = new URL('./', self.location.href);
const SHELL = ['index.html', 'style.css', 'theme.css', 'themes.js', 'knowledge.js', 'content.js', 'math-content.js', 'physics-knowledge.js', 'physics-content.js', 'subjects.js', 'exam-focus.js', 'study-guides.js', 'model.js', 'migration.js', 'app.js', 'services.js', 'manifest.webmanifest', 'icon.svg'];
const OCR = ['vendor/tesseract/tesseract.min.js', 'vendor/tesseract/worker.min.js',
  ...['tesseract-core', 'tesseract-core-simd', 'tesseract-core-lstm', 'tesseract-core-simd-lstm'].flatMap(n => [`vendor/core/${n}.wasm.js`, `vendor/core/${n}.wasm`]),
  'vendor/lang/chi_sim.traineddata.gz', 'vendor/lang/eng.traineddata.gz'];
const allowed = new Set([...SHELL, ...OCR].map(p => new URL(p, BASE).href));
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(VERSION);
  // An incomplete candidate must never replace a working offline version.
  const results = await Promise.allSettled(SHELL.map(async p => {
    const url = new URL(p, BASE), response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error('核心资源下载失败：' + p);
    await cache.put(url, response);
  }));
  if (results.some(r => r.status === 'rejected')) {
    await caches.delete(VERSION);
    throw new Error('新版核心文件不完整，继续使用已有版本');
  }
  // Let existing tabs finish with their own version; activate after they close.
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const cache = await caches.open(VERSION);
  for (const p of SHELL) if (!await cache.match(new URL(p, BASE))) throw new Error('核心缓存不完整');
  const previous = (await caches.keys()).filter(key => key.startsWith('mdiag-v') && key !== VERSION);
  const complete = [];
  for (const key of previous) {
    const old = await caches.open(key);
    if ((await Promise.all(SHELL.map(p => old.match(new URL(p, BASE))))).every(Boolean)) complete.push(key);
  }
  // A status check may create an empty cache. Never mistake it for a predecessor.
  const retain = complete.at(-1);
  for (const key of previous) if (key !== retain) await caches.delete(key);
})()));
self.addEventListener('fetch', event => {
  const req = event.request, requestURL = new URL(req.url);
  // Never intercept APIs, credentials, POSTs, cross-origin requests, or files outside the app allowlist.
  if (req.method !== 'GET' || requestURL.origin !== BASE.origin || req.headers.has('authorization')) return;
  const home = requestURL.href === BASE.href;
  if (!home && !allowed.has(requestURL.href)) return;
  const key = home ? new URL('index.html', BASE).href : requestURL.href;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // A shell version is immutable; network-first would mix old HTML with new JS.
    const saved = await cache.match(key); if (saved) return saved;
    try {
      const response = await fetch(req);
      if (response.ok) await cache.put(key, response.clone());
      return response;
    } catch (_) {
      const saved = await cache.match(key);
      return saved || new Response('此资源尚未缓存。请启动本地服务并准备离线资源。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
