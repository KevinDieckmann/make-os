// ─── Homepage prüfen: keine echten Namen, Kunden, Termine, verbotene Wörter (27.09.) ─
// Kevin: „Da dürfen niemals echte Namen rein oder Kundendaten.“ Dieses Skript läuft
// vor jedem Stand (node homepage/pruefen.mjs) und bricht ab, wenn etwas aus der
// Sperrliste in den ausgelieferten Dateien auftaucht. Die Liste enthält Namen aus
// CRM, Kalender und Vault, die in der ersten Fassung fälschlich drinstanden — plus
// die Wörter, die laut Terminologie-Brain nie auf eine MAKE-Seite gehören.
// Dritter Durchgang: geprüft werden index.html UND css/js (Kommentare zählen mit),
// damit auch kein Kundenname als Vorbild im Code steht.
import { readFileSync } from 'node:fs';
const lies = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const html = lies('./index.html');
const text = html.replace(/<[^>]+>/g, ' ');
const code = ['./css/site.css', './css/ci.css', './js/site.js', './js/brain.js'].map(p => `${p}\n${lies(p)}`).join('\n');
const SPERRE = ['Frank', 'Mathick', 'ACME', 'Venetian', 'ILD Institute', 'One Finance', 'Connect App', 'Katarzyna', 'Augustyn', 'Kempen', 'Strathus', 'Tittler', 'ReachOut', 'Prometheus', 'AIDU', 'Danilo', 'Kairys', 'Riese', 'Tagesspiegel', 'Ayu Sushi', 'KEMARIS', 'KD Ventures', 'POINCAP', 'CapOS', 'Liquido', 'Kapitalseite', 'Beteiligung 20'];
const WOERTER = [/\bDashboard\b/i, /\bTool\b/i, /\bDisruption\b/i, /Game Changer/i, /\bReporting\b/i, /einfach zu bedienen/i, /\bMakeOS\b/, /\bMake-OS\b/, /MAKE Operating System/];
const treffer = [];
const muster = s => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
for (const s of SPERRE) { if (muster(s).test(text)) treffer.push(`Name/Kunde in index.html: ${s}`); if (muster(s).test(code)) treffer.push(`Name/Kunde im Code: ${s}`); }
for (const w of WOERTER) { const m = text.match(w); if (m) treffer.push(`Wort: ${m[0]}`); }
// Vierter Durchgang: die Assistentin heißt Zoe — der alte Name darf weder im Text noch in Klassen, IDs oder Code stehen.
if (/jarvis/i.test(html)) treffer.push('Alter Name in index.html: Jarvis (heißt Zoe)');
if (/jarvis/i.test(code)) treffer.push('Alter Name im Code: Jarvis (heißt Zoe)');
// Terminmuster mit Uhrzeit UND Personenname in derselben Zeile sind erlaubt, solange der Name erfunden ist — geprüft wird nur die Sperrliste.
// Handwerk: jede Skriptdatei muss eingebunden sein, das Standbild muss existieren.
for (const s of ['js/site.js', 'js/brain.js', 'css/site.css']) if (!html.includes(s)) treffer.push(`Nicht eingebunden: ${s}`);
try { lies('./assets/brain-standbild.svg'); } catch { treffer.push('Standbild fehlt: assets/brain-standbild.svg'); }
if (treffer.length) { console.error('✕ Homepage-Prüfung: ' + treffer.join(' · ')); process.exit(1); }
console.log('✓ Homepage-Prüfung: keine gesperrten Namen, Kunden oder Wörter — in Seite und Code.');
