// A static server for the tests and for local development:
//   npm start        then open http://localhost:4173/round-timer/
// Sends the same Cache-Control that Cloudflare sends in production.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2]) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path.split(sep).some(part => part.startsWith('.'))) throw new Error('hidden');
    let file = join(ROOT, path);
    if ((await stat(file)).isDirectory()) {
      if (!path.endsWith(sep)) { res.writeHead(307, { Location: path + '/' }).end(); return; }
      file = join(file, 'index.html');
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    }).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, 'localhost', () => console.log(`http://localhost:${PORT}/`));
