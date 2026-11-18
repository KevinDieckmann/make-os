// Kleiner Dateiserver zum Prüfen: liefert diesen Ordner mit den Kopfzeilen der Website aus (Sicherheitsregeln wie online).
// Aufruf: node werkzeug/csp-server.mjs [port]   (Standard 3391). Wege der Anwendung (/check, /anfrage, /api/…) antworten mit 404.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 3391;
const TYP = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'";
createServer(async (req, res) => {
  try {
    let pfad = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (pfad.includes('..')) throw new Error('nein');
    let datei = join(WURZEL, pfad);
    if ((await stat(datei)).isDirectory()) datei = join(datei, 'index.html');
    const inhalt = await readFile(datei);
    res.writeHead(200, { 'Content-Type': TYP[extname(datei)] ?? 'application/octet-stream', 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' });
    res.end(inhalt);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Security-Policy': CSP }); res.end('gibt es nicht'); }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}/ (mit Content-Security-Policy)`));
