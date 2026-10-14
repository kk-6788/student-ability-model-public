'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = fs.realpathSync(__dirname);
const args = process.argv.slice(2);
const lan = args.includes('--lan');
const portArg = args.find(x => x.startsWith('--port='));
const port = portArg ? Number(portArg.slice(7)) : 8765;
if (!Number.isInteger(port) || port < 1 || port > 65535 || args.some(x => x !== '--lan' && !x.startsWith('--port='))) {
  console.error('用法：node server.cjs [--lan] [--port=8765]'); process.exit(1);
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.gz': 'application/gzip', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.md': 'text/plain; charset=utf-8' };
const publicRoot = new Set(['index.html', 'style.css', 'theme.css', 'themes.js', 'knowledge.js', 'content.js', 'math-content.js', 'physics-knowledge.js', 'physics-content.js', 'subjects.js', 'exam-focus.js', 'study-guides.js', 'model.js', 'migration.js', 'app.js', 'services.js', 'sw.js', 'manifest.webmanifest', 'icon.svg']);
const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent((req.url || '/').split('?')[0]); } catch (_) { res.writeHead(400); return res.end('Invalid path'); }
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..')) { res.writeHead(403); return res.end('Forbidden'); }
  if (pathname === '/') pathname = '/index.html';
  const relative = pathname.replace(/^\/+/, '');
  if (!publicRoot.has(relative) && !relative.startsWith('vendor/')) { res.writeHead(404); return res.end('Not found'); }
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.realpath(target, (error, real) => {
    if (error) { res.writeHead(404); return res.end('Not found'); }
    if (!real.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.stat(real, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(real).toLowerCase()] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': relative.startsWith('vendor/') ? 'public, max-age=86400' : 'no-cache' });
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(real); stream.on('error', () => res.destroy()); stream.pipe(res);
    });
  });
});
server.on('error', err => { console.error(err.code === 'EADDRINUSE' ? `端口 ${port} 被占用。请关闭已启动的实例，或使用 --port=8766。` : `服务启动失败：${err.message}`); process.exitCode = 1; });
server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`数学与物理能力诊断已启动：http://localhost:${port}/`);
  console.log('请保持此窗口运行。按 Ctrl+C 停止。离线资源已缓存后可断网使用。');
  if (lan) {
    for (const entries of Object.values(os.networkInterfaces())) for (const item of entries || []) if (item.family === 'IPv4' && !item.internal) console.log(`局域网访问：http://${item.address}:${port}/`);
    console.log('局域网 HTTP 不能提供手机 PWA 离线安装；手机离线需受信任的 HTTPS。只在可信家庭网络使用 --lan。');
  }
});
