// ─── Homepage prüfen: alle Seiten, alle Links (27.09., siebter Durchgang) ───────────
// Kevin: „Da dürfen niemals echte Namen rein oder Kundendaten.“ Läuft vor jedem Stand
// (node homepage/pruefen.mjs) und bricht ab, wenn in einer der fertigen Seiten oder im
// Code etwas aus der Sperrliste steht, ein verbotenes Wort, der alte Assistenten-Name,
// „Zoe“ klein geschrieben, ein Link ins Leere oder ein Anker, den es nicht gibt.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const hier = new URL('./', import.meta.url);
const lies = p => readFileSync(new URL(p, hier), 'utf8');
const SEITEN = readdirSync(hier).filter(f => /^[a-z]+\.html$/.test(f));
const code = ['css/site.css', 'css/ci.css', 'js/site.js', 'js/brain.js', 'js/formationen.js'].map(p => `${p}\n${lies(p)}`).join('\n');
const SPERRE = ['Frank', 'Mathick', 'ACME', 'Venetian', 'ILD Institute', 'One Finance', 'Connect App', 'Katarzyna', 'Augustyn', 'Kempen', 'Strathus', 'Tittler', 'ReachOut', 'Prometheus', 'AIDU', 'Danilo', 'Kairys', 'Riese', 'Tagesspiegel', 'Ayu Sushi', 'KEMARIS', 'KD Ventures', 'POINCAP', 'CapOS', 'Liquido', 'Kapitalseite', 'Beteiligung 20'];
const WOERTER = [/\bDashboard\b/i, /\bTool\b/i, /\bDisruption\b/i, /Game Changer/i, /\bReporting\b/i, /einfach zu bedienen/i, /\bMakeOS\b/, /\bMake-OS\b/, /MAKE Operating System/];
const HOSTING = [/eigenen Server/i, /Server, der dir gehört/i, /auf deinen Namen/i, /Selbst gehostet/i, /Schlüssel liegt bei dir/i];
const muster = s => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
const treffer = [];
for (const s of SPERRE) if (muster(s).test(code)) treffer.push(`Name/Kunde im Code: ${s}`);
if (/jarvis/i.test(code)) treffer.push('Alter Name im Code: Jarvis (heißt ZOE)');
const ids = {}; for (const seite of SEITEN) ids[seite] = new Set([...lies(seite).matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
for (const seite of SEITEN) {
  const html = lies(seite), text = html.replace(/<[^>]+>/g, ' ');
  for (const s of SPERRE) if (muster(s).test(text)) treffer.push(`${seite}: Name/Kunde ${s}`);
  for (const w of WOERTER) { const m = text.match(w); if (m) treffer.push(`${seite}: Wort „${m[0]}“`); }
  for (const w of HOSTING) { const m = text.match(w); if (m) treffer.push(`${seite}: altes Hosting-Versprechen „${m[0]}“`); }
  if (/jarvis/i.test(html)) treffer.push(`${seite}: alter Name Jarvis (heißt ZOE)`);
  for (const m of text.matchAll(/\b[Zz]oe\b/g)) treffer.push(`${seite}: ZOE klein geschrieben „${m[0]}“`);
  for (const s of ['js/site.js', 'js/brain.js', 'js/formationen.js', 'css/site.css']) if (!html.includes(s)) treffer.push(`${seite}: nicht eingebunden ${s}`);
  // Links: jede Adresse muss existieren, jeder Anker auch.
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const ziel = m[1]; if (/^(https?:|mailto:|tel:|data:)/.test(ziel)) continue;
    const [pfadRoh, anker] = ziel.split('#'); const pfad = pfadRoh.split('?')[0];
    const datei = pfad || seite;
    if (pfad && !existsSync(new URL(pfad, hier))) { treffer.push(`${seite}: Link ins Leere „${ziel}“`); continue; }
    if (anker && anker !== 'top' && ids[datei] && !ids[datei].has(anker) && !['impressum', 'datenschutz'].includes(anker)) treffer.push(`${seite}: Anker fehlt „${ziel}“`);
  }
  for (const m of html.matchAll(/url\(([^)]+)\)/g)) { const p = m[1].replace(/['"]/g, ''); if (!p.startsWith('data:') && !existsSync(new URL(p, hier))) treffer.push(`${seite}: Bild fehlt „${p}“`); }
}
for (const seite of ['index.html', 'privat.html', 'business.html', 'zoe.html', 'preise.html', 'ueber.html']) if (!SEITEN.includes(seite)) treffer.push(`Seite fehlt: ${seite}`);
if (treffer.length) { console.error('✕ Homepage-Prüfung:\n  ' + treffer.join('\n  ')); process.exit(1); }
console.log(`✓ Homepage-Prüfung: ${SEITEN.length} Seiten — keine gesperrten Namen, Kunden, Wörter, alten Versprechen; alle Links und Anker vorhanden.`);
