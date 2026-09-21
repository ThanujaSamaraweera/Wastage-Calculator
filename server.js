import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { metadata, yearlyRows } from './repository.js';
import { REASONS } from './public/report.js';
const assets = new Map([['/', ['index.html','text/html']], ['/app.js',['app.js','text/javascript']], ['/styles.css',['styles.css','text/css']], ['/report.js',['report.js','text/javascript']]]);
assets.set('/assets/basilur-transparent.png', ['assets/basilur-transparent.png', 'image/png']);
assets.set('/assets/basilur.jpg', ['assets/basilur.jpg', 'image/jpeg']);
assets.set('/assets/cittacube.png', ['assets/cittacube.png', 'image/png']);
assets.set('/assets/cittacube-icon.png', ['assets/cittacube-icon.png', 'image/png']);
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Referrer-Policy','no-referrer');
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') { res.writeHead(405, {'Allow':'GET'}); return res.end(); }
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store');
      if (url.pathname === '/api/metadata') return res.end(JSON.stringify(await metadata()));
      if (url.pathname === '/api/report') {
        const value = url.searchParams.get('year');
        if (!/^\d{4}$/.test(value || '') || Number(value) < 2000 || Number(value) > 2100) { res.writeHead(400); return res.end(JSON.stringify({error:'Choose a valid year between 2000 and 2100.'})); }
        const result = await yearlyRows(Number(value), url.searchParams.get('refresh') === 'true');
        return res.end(JSON.stringify({year:Number(value), rows:result.rows, updatedAt:new Date(result.time).toISOString(), reasons:REASONS, issuedTransactionType:'I'}));
      }
      res.writeHead(404); return res.end(JSON.stringify({error:'Not found'}));
    }
    if (!assets.has(url.pathname)) { res.writeHead(404); return res.end('Not found'); }
    const [name, type] = assets.get(url.pathname);
    const body = await readFile(fileURLToPath(new URL(`./public/${name}`, import.meta.url)));
    res.writeHead(200, {'Content-Type': type.startsWith('image/') ? type : `${type}; charset=utf-8`, 'Cache-Control':'no-cache'}); res.end(body);
  } catch (error) {
    console.error('Request failed:', error.code || error.name);
    if (!res.headersSent) res.writeHead(503, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'Unable to load database data. Check your network or VPN and the server database configuration, then retry.'}));
  }
});
const host = process.env.HOST || '0.0.0.0', port = Number(process.env.PORT || 6000);
server.listen(port, host, () => console.log(`Wastage dashboard: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`));

