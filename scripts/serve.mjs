#!/usr/bin/env node
/**
 * Zero-dependency static server / 零依赖静态服务器
 *
 * ES modules cannot be loaded over the file:// protocol, so the modular
 * build must be served over HTTP. This uses only Node built-ins.
 * ES 模块无法通过 file:// 加载，因此模块化版本必须经 HTTP 提供。
 * 本脚本仅使用 Node 内置模块。
 *
 * Usage:  npm start  [--port 8080] [--host 127.0.0.1]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PORT = Number(arg('port', process.env.PORT || 8080));
const HOST = arg('host', process.env.HOST || '127.0.0.1');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.map':  'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';

    // Prevent path traversal outside the project root.
    const target = join(ROOT, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!target.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
         .end(`404 Not Found: ${pathname}`);
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    }).end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
       .end(`500 Internal Server Error\n${err.message}`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  🌙  lunar-rover-3d\n`);
  console.log(`  Modular build : http://${HOST}:${PORT}/index.html`);
  console.log(`  Standalone    : http://${HOST}:${PORT}/dist/lunar-rover-standalone.html`);
  console.log(`\n  Press Ctrl+C to stop.\n`);
});
