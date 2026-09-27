// ─── Homepage prüfen: keine echten Namen, Kunden, Termine, verbotene Wörter (27.09.) ─
// Kevin: „Da dürfen niemals echte Namen rein oder Kundendaten.“ Dieses Skript läuft
// vor jedem Stand (node homepage/pruefen.mjs) und bricht ab, wenn etwas aus der
// Sperrliste in index.html auftaucht. Die Liste enthält Namen aus CRM, Kalender und
// Vault, die in der ersten Fassung fälschlich drinstanden — plus die Wörter, die
// laut Terminologie-Brain nie auf eine MAKE-Seite gehören.
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const text = html.replace(/<[^>]+>/g, ' ');
const SPERRE = ['Frank', 'Mathick', 'ACME', 'Venetian', 'ILD Institute', 'One Finance', 'Connect App', 'Katarzyna', 'Augustyn', 'Kempen', 'Strathus', 'Tittler', 'ReachOut', 'Prometheus', 'AIDU', 'Kairys', 'Riese', 'Tagesspiegel', 'Ayu Sushi', 'KEMARIS', 'KD Ventures', 'POINCAP', 'CapOS', 'Liquido', 'Kapitalseite', 'Beteiligung 20'];
const WOERTER = [/\bDashboard\b/i, /\bTool\b/i, /\bDisruption\b/i, /Game Changer/i, /\bReporting\b/i, /einfach zu bedienen/i, /\bMakeOS\b/, /\bMake-OS\b/, /MAKE Operating System/];
const treffer = [];
for (const s of SPERRE) if (new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text)) treffer.push(`Name/Kunde: ${s}`);
for (const w of WOERTER) { const m = text.match(w); if (m) treffer.push(`Wort: ${m[0]}`); }
// Terminmuster mit Uhrzeit UND Personenname in derselben Zeile sind erlaubt, solange der Name erfunden ist — geprüft wird nur die Sperrliste.
if (treffer.length) { console.error('✕ Homepage-Prüfung: ' + treffer.join(' · ')); process.exit(1); }
console.log('✓ Homepage-Prüfung: keine gesperrten Namen, Kunden oder Wörter.');
