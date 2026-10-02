import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
const root = await realpath(path.resolve(import.meta.dirname, '../dist'));
const port = Number(process.env.DOSSIER_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid DOSSIER_PORT');
const mime = { '.html':'text/html; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
const server = createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (pathname === '/api/health') { res.writeHead(200, { 'Content-Type':'application/json' }); return res.end(JSON.stringify({ status:'ok', service:'architecture-dossier', providerCalls:0 })); }
    const file = await realpath(path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type':mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Dossier preview: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
