// Erzeugt prototype/make-studios/preise.json aus der EINEN Preisliste von MAKE Innovation (inhalt.json). Nie von Hand ändern.
// Aufruf: node preise-bauen.mjs [pfad/zu/inhalt.json] [zielordner]
import { readFileSync, writeFileSync } from 'node:fs';
const QUELLE = process.argv[2] || '/Users/kevindieckmann/Claude/Projects/MakeOS/.claude/worktrees/haus-startseite/makeinnovation/inhalt/inhalt.json';
const ZIEL = (process.argv[3] || '/Users/kevindieckmann/Claude/Projects/MakeOS/.claude/worktrees/website-upload/prototype/make-studios') + '/preise.json';
const d = JSON.parse(readFileSync(QUELLE, 'utf8'));
const betrag = (s) => { const m = /(\d[\d.]*)\s*€/.exec(s); if (!m) throw new Error('kein Betrag: ' + s); return Number(m[1].replace(/\./g, '')); };
const eur = (n) => n.toLocaleString('de-DE') + ' €';
const nimm = (id) => { const a = d.angebote.find((x) => x.id === id); if (!a) throw new Error('Angebot fehlt: ' + id); return a; };
const rhythmus = (zusatz) => (/pro Monat/.test(zusatz) ? 'im Monat' : /einmalig/.test(zusatz) ? 'einmalig' : (() => { throw new Error('Rhythmus unklar: ' + zusatz); })());
const laufzeit = (zusatz) => { const m = /mindestens (\d+) Monate/.exec(zusatz); return m ? 'mindestens ' + m[1] + ' Monate' : null; };
const eintraege = {};
const eintrag = (schluessel, angebot, kurzname, b, zusatz, extra = {}) => { eintraege[schluessel] = { angebot, kurzname, betrag: b, ab: 'ab ' + eur(b), rhythmus: rhythmus(zusatz), mindestlaufzeit: laufzeit(zusatz), quelle: extra.quelle || null }; };
// Website: der niedrigste Preis der drei Homepage-Pakete
const hp = ['homepage-landing', 'homepage-story', 'homepage-cinematic'].map(nimm);
const hpMin = hp.reduce((a, b) => (betrag(b.preis) < betrag(a.preis) ? b : a));
eintrag('website', hpMin.name, 'Website', betrag(hpMin.preis), hpMin.preis_zusatz, { quelle: hpMin.id });
for (const a of hp) eintrag(a.id, a.name, a.name, betrag(a.preis), a.preis_zusatz, { quelle: a.id });
for (const [k, id, name] of [['erklaervideo', 'erklaervideo', 'Erklärvideo'], ['videostory', 'videostory', 'Videostory'], ['video-serie', 'video-serie', 'Video-Serie']]) { const a = nimm(id); eintrag(k, a.name, name, betrag(a.preis), a.preis_zusatz, { quelle: id }); }
const sm = nimm('social-media');
for (const s of sm.stufen) eintrag('social-' + s.name.toLowerCase(), 'Social Media ' + s.name, 'Social Media ' + s.name, betrag(s.preis), sm.preis_zusatz, { quelle: 'social-media/' + s.name });
const stand = (/(\d{4})-(\d{2})-(\d{2})/.exec(d.meta.stand) || []).slice(1).join('-');
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const [j, m] = stand.split('-');
const aus = { stand, standText: MONATE[Number(m) - 1] + ' ' + j, netto: true, hinweis: 'Alle Preise netto zuzüglich Umsatzsteuer', quelle: 'MAKE Innovation, Preisliste (Stand der Liste: ' + d.meta.stand.split(' (')[0] + ')', eintraege };
writeFileSync(ZIEL, JSON.stringify(aus, null, 2) + '\n');
console.log('preise.json geschrieben:', Object.entries(eintraege).map(([k, e]) => k + ' ' + e.ab + ' ' + e.rhythmus).join(' | '));
