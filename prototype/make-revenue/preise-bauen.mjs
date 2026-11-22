// Erzeugt prototype/make-revenue/preise.json aus der EINEN Preisliste von MAKE Innovation (inhalt.json). Nie von Hand ändern.
// Aufruf: node preise-bauen.mjs [pfad/zu/inhalt.json] [zielordner]
// bauen.mjs und seo.mjs der Seite lesen nur preise.json. Der Prüfer (seo.mjs) scheitert, wenn die Datei fehlt oder ein Preis im HTML nicht daraus stammt.
import { readFileSync, writeFileSync } from 'node:fs';
const QUELLE = process.argv[2] || '/Users/kevindieckmann/Claude/Projects/MakeOS/.claude/worktrees/haus-startseite/makeinnovation/inhalt/inhalt.json';
const ZIEL = (process.argv[3] || '/Users/kevindieckmann/Claude/Projects/MakeOS/.claude/worktrees/website-upload/prototype/make-revenue') + '/preise.json';
const d = JSON.parse(readFileSync(QUELLE, 'utf8'));
const betrag = (s) => { const m = /(\d[\d.]*)\s*€/.exec(s); if (!m) throw new Error('kein Betrag: ' + s); return Number(m[1].replace(/\./g, '')); };
const eur = (n) => n.toLocaleString('de-DE') + ' €';
const nimm = (id) => { const a = d.angebote.find((x) => x.id === id); if (!a) throw new Error('Angebot fehlt in der Preisliste: ' + id); return a; };
const rhythmus = (z) => (/pro Monat/.test(z) ? 'im Monat' : /je Abend/.test(z) ? 'je Abend' : /einmalig/.test(z) ? 'einmalig' : (() => { throw new Error('Rhythmus unklar: ' + z); })());
const laufzeit = (a) => { const m = /(\d+ oder \d+ Monate)/.exec(a.preis_zusatz || ''); if (m) return m[1]; if (/^Ein Tag\b/.test((a.enthalten || [])[0] || '')) return 'ein Tag'; if (/je Abend/.test(a.preis_zusatz || '')) return 'ein Abend'; return null; };
// Schlüssel auf der Seite → Angebot in der Preisliste, Kurzname auf makerevenue.de
const WAHL = [['tagesworkshop', 'tagesworkshop', 'Tagesworkshop'], ['head-of-sales', 'head-of-sales', 'Head of Sales auf Zeit'], ['cso', 'cso', 'Chief Sales Officer auf Zeit'], ['abendpartner', 'abendpartner', 'Abendpartner beim Fokus Abend']];
const eintraege = {};
for (const [k, id, kurzname] of WAHL) {
  const a = nimm(id), b = betrag(a.preis), z = a.preis_zusatz || '';
  eintraege[k] = { angebot: a.name, kurzname, betrag: b, ab: 'ab ' + eur(b), rhythmus: rhythmus(z), laufzeit: laufzeit(a), anrechnung: /voll angerechnet/.test(z), empfohlen: a.hervorheben === true, quelle: id };
}
if (nimm('ki-crm')) { /* „KI-CRM selbst bauen“ steht in der Preisliste, ist auf der Website aber bewusst ausgeblendet: kein Eintrag. */ }
const stand = (/(\d{4})-(\d{2})-(\d{2})/.exec(d.meta.stand) || [''])[0];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const [j, m] = stand.split('-');
if (!/netto/.test(d.meta.preise || '')) throw new Error('Preisliste ohne den Hinweis „netto“');
const aus = { hinweis_datei: 'Erzeugt von preise-bauen.mjs aus der Preisliste von MAKE Innovation. Nicht von Hand ändern.', stand, standText: MONATE[Number(m) - 1] + ' ' + j, netto: true, hinweis: 'Alle Preise netto zuzüglich Umsatzsteuer', quelle: 'MAKE Innovation, Preisliste (Stand der Liste: ' + stand + ')', eintraege };
writeFileSync(ZIEL, JSON.stringify(aus, null, 2) + '\n');
console.log('preise.json geschrieben:', Object.entries(eintraege).map(([k, e]) => `${k} ${e.ab} ${e.rhythmus}${e.laufzeit ? ', ' + e.laufzeit : ''}${e.empfohlen ? ' (empfohlen)' : ''}`).join(' | '));
