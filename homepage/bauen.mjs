// ─── Homepage bauen: aus quelle/ werden die fertigen Seiten (27.09., siebter Durchgang) ─
// Kopf, Fuß und wiederkehrende Teile stehen genau einmal in quelle/; jede Seite in
// quelle/seiten/<name>.html liefert nur ihren Inhalt und ein paar Kopfzeilen:
//   <!-- titel: … --> <!-- beschreibung: … --> <!-- krumen: … --> <!-- sicht: privat|business -->
// Platzhalter: {{teil:name}} fügt quelle/teile/name.html ein. Aufruf: node homepage/bauen.mjs
// Danach: node homepage/pruefen.mjs (prüft alle fertigen Seiten und alle Links).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const hier = new URL('./', import.meta.url);
const lies = p => readFileSync(new URL(p, hier), 'utf8');
const kopf = lies('quelle/kopf.html'), fuss = lies('quelle/fuss.html');
const SEITEN = ['index', 'privat', 'business', 'zoe', 'preise', 'ueber'];
const teile = s => s.replace(/\{\{teil:([a-z0-9-]+)\}\}/g, (_, n) => teile(lies(`quelle/teile/${n}.html`)));
const meta = (s, k, std = '') => (s.match(new RegExp(`<!--\\s*${k}:\\s*([\\s\\S]*?)\\s*-->`)) || [, std])[1];
for (const name of SEITEN) {
  const quelle = lies(`quelle/seiten/${name}.html`);
  const daten = { SEITE: name, TITEL: meta(quelle, 'titel', 'MAKE OS'), BESCHREIBUNG: meta(quelle, 'beschreibung'), KRUMEN: meta(quelle, 'krumen'), SICHT: meta(quelle, 'sicht', ''), TITEL_ATTR: '' };
  daten.TITEL_ATTR = daten.TITEL.replace(/"/g, '&quot;');
  const ersetze = s => s.replace(/\{\{(\w+)\}\}/g, (_, k) => daten[k] ?? '');
  const html = ersetze(teile(kopf)) + teile(quelle).replace(/<!--\s*(titel|beschreibung|krumen|sicht):[\s\S]*?-->\n?/g, '') + ersetze(teile(fuss)); // Achter Durchgang: {{teil:…}} auch in Kopf und Fuß (das Formular „Einmal testen“ blieb sonst ein Platzhalter)
  writeFileSync(new URL(`${name}.html`, hier), html);
}
writeFileSync(new URL('sitemap.txt', hier), SEITEN.map(s => `${s}.html`).join('\n') + '\n');
console.log(`✓ gebaut: ${SEITEN.map(s => s + '.html').join(' · ')} + sitemap.txt`);
