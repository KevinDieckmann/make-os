#!/usr/bin/env node
// ─── Fokus Innovation · Website (Prototyp 25.10.2026, dritte Fassung) ─────────────────────────────────────────────────
// Alle Seiten aus EINER Quelle: inhalt/fokus.json (Marke, Leitidee, Bereiche, Abend, Über uns — aus dem Positionierungs-Doc)
// und den Angeboten der bisherigen Website (makeinnovation/inhalt/*.json: Preise, Produktblätter, Fragen). Nie eine Seite von
// Hand ändern — Text in den JSON-Dateien, Aussehen in css/, dann:
//   node prototype/fokus-innovation/bauen.mjs            → schreibt alle Seiten und prüft sie
//   node prototype/fokus-innovation/bauen.mjs --pruefen  → nur prüfen (Ausgang 1 bei Abweichung oder Regelverstoß)
// Regeln: keine Cookies, kein Tracking, keine Formulare (einzige Ausnahme 31.10.: „Vorlage per E-Mail anfordern“, `form[data-unterlage]` ohne
// action — js/unterlage.js schickt an die eigene App, die CSP `form-action 'none'` bleibt), keine fremden Quellen, keine Inline-Skripte oder -Stile (CSP 'self'),
// der Name der eigenen Software und Connect stehen nirgends, Statistiken nur mit Quelle.
// Suche (27.10.): jede Seite trägt Titel, Beschreibung, Canonical, Vorschaubild und strukturierte Daten (JSON-LD, als Datenblock
// erlaubt — kein ausführbares Skript). Dazu sitemap.xml, robots.txt, llms.txt für KI-Suchen und site.webmanifest. Ob Suchmaschinen
// die Seite aufnehmen dürfen, entscheidet EIN Schalter: inhalt/fokus.json › seo.oeffentlich (bis Kevins Freigabe false).
// Vorschaubilder und Icons erzeugt bilder.mjs (braucht Chrome) — nach neuen Seiten oder geänderten Titeln einmal laufen lassen.

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buehne, videoAbschnitt, BILD_JE_GRUPPE } from './problembilder.mjs';

export const ORDNER = dirname(fileURLToPath(import.meta.url));
const REPO = join(ORDNER, '..', '..');
const lies = (p) => JSON.parse(readFileSync(p, 'utf8'));
/** Buchungsseite der eigenen Anwendung — dieselbe Form wie BUCHUNG_OFFEN in middleware.ts. */
const BUCHUNG = /^\/buchen\/[a-z0-9-]{1,40}-[a-f0-9]{24}$/;
/** Feste Adresse fürs Erstgespräch (31.10.): die App leitet auf die in MAKE OS gewählte Buchungsseite weiter (Caddy reicht sie durch). */
const ERSTGESPRAECH = '/erstgespraech';

// ── Hilfen ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Texte der bisherigen Website: Altnamen der Marke ersetzen (der Prüfer meldet jeden Rest). */
const BEGRIFFE = [
  [/aus dem MAKE-Netzwerk/g, 'aus unserem Netzwerk'], [/MAKE-Netzwerk/g, 'Netzwerk'], [/MAKE Innovation/g, 'Fokus Innovation'],
  // Interne Begriffe der Produktblätter in Worte, die Kunden verstehen
  [/Bestandsreaktivierung nach BEAN/g, 'Reaktivierung Ihrer Bestandskunden'], [/Skriptset mit BANT/g, 'Gesprächsleitfäden mit Bedarfsfragen'],
  [/33 gute Gründe/g, '33 Kaufargumente'], [/Security-Call gegen No-Shows/g, 'Erinnerungsanruf gegen ausgefallene Termine'],
  [/Onboarding mit Stempelkarte \(10 Stationen\)/g, 'Einarbeitung in 10 Stationen'], [/Stempelkarte vor dem ersten Live-Call/g, 'Einarbeitung vor dem ersten Live-Call'],
  [/die Stempelkarte abgeschlossen/g, 'die Einarbeitung abgeschlossen'], [/Sektionen/g, 'Abschnitte'], [/ im Hero/g, ' im Startbild'], [/7 Worten/g, '7 Wörtern'],
  // Prüfbericht 27.10.: Fachwörter, die ein Mittelständler nicht kennt, und „gehören“ passt nicht zum einfachen Nutzungsrecht.
  [/Quick Win aus (deinem|Ihrem) Bestand/g, 'ein erster schneller Erfolg aus Ihrem Kundenbestand'], [/ als Quick Win/g, ' als erster schneller Erfolg'], [/\bStages\b/g, 'Stufen'],
  [/mit (\d+ bis \d+) Abschnitte\b/g, 'mit $1 Abschnitten'], [/Video Serie/g, 'Videoserie'],
  [/Gehören Skripte und Playbooks danach mir\?/g, 'Darf ich Skripte und Playbooks danach weiter nutzen?'],
];
/** Preise in Ratgebern und Suchtexten nur als Platzhalter: {preis:id}, {ab:id} (erster Preis einer Staffel), {zusatz:id}. */
let ANGEBOTE = [];
// Seit 30.10. (Kevin: „Wir machen immer ab-Preise“) wird jeder Preis-Platzhalter zum Einstiegspreis mit „ab“ — „für {preis:x}“ wird „ab …“,
// am Satzanfang „Ab …“; steht schon „ab“ davor, kommt keins dazu.
const platz = (s) => String(s ?? '').replace(/(\bfür )?\{(preis|ab|zusatz):([a-z0-9-]+)\}/g, (_, fuer, art, id, pos, ganz) => {
  const a = ANGEBOTE.find((x) => x.id === id);
  if (!a) throw new Error(`Platzhalter ohne Angebot: {${art}:${id}}`);
  if (art === 'zusatz') return `${fuer ?? ''}${a.preis_zusatz ?? ''}`;
  const betrag = `${a.preis.replace(/^ab /, '').split(' / ')[0].replace(/ €$/, '')}\u00a0€`;
  const davor = ganz.slice(0, pos);
  if (!fuer && /\bab $/i.test(davor)) return betrag;
  return `${!fuer && (pos === 0 || /[.?!:]\s*$/.test(davor)) ? 'Ab' : 'ab'} ${betrag}`;
});
const alt = (s) => BEGRIFFE.reduce((x, [re, neu]) => x.replace(re, neu), platz(s));
/** Anker aus einer Überschrift: „Schritt 4: Wenige Kennzahlen“ → „schritt-4-wenige-kennzahlen“. */
export const slug = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Klartext für Suchtexte und strukturierte Daten (ohne HTML, Platzhalter ersetzt). */
const klar = (s) => alt(s).replace(/\[\[KEVIN: [^\]]*\]\]/g, '').replace(/\s+/g, ' ').trim();
/** Text mit Platzhaltern: [[KEVIN: …]] wird markiert und vom Prüfer gezählt. */
const t = (s) => e(alt(s)).replace(/\[\[KEVIN: ([^\]]*)\]\]/g, (_, x) => `<span class="ph">[[KEVIN: ${x}]]</span>`);
const istPlatzhalter = (s) => /\[\[KEVIN:/.test(String(s ?? ''));
/** Wie t(), aber ohne BEGRIFFE — für Namen, die wörtlich stehen müssen (Titel der Bausteine, Firmierung des Verkäufers). */
const wort = (s) => e(platz(s)).replace(/\[\[KEVIN: ([^\]]*)\]\]/g, (_, x) => `<span class="ph">[[KEVIN: ${x}]]</span>`);
const stempel = (datei) => createHash('sha256').update(readFileSync(join(ORDNER, datei))).digest('hex').slice(0, 10);
const PFEIL = '<svg class="pfeil" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
const ZEICHEN = (klasse = 'zeichen') => `<svg class="${klasse}" viewBox="0 0 48 48" aria-hidden="true"><path class="bahn" d="M37.86,16 A16,16 0 1 1 26.78,8.24"/><circle class="punkt" cx="35.33" cy="7.81" r="2.8"/><circle class="kern" cx="24" cy="24" r="7"/></svg>`;
/** Monogramm im Stil des Logos (31.10.: Personen ohne Foto): Ring mit Lücke und Punkt, die Initialen in der Mitte. */
const MONOGRAMM = (kuerzel, klasse = '') => `<svg class="monogramm${klasse ? ` ${klasse}` : ''}" viewBox="0 0 48 48" aria-hidden="true"><path class="bahn" d="M37.86,16 A16,16 0 1 1 26.78,8.24"/><circle class="punkt" cx="35.33" cy="7.81" r="2.8"/><text x="24" y="28.3" text-anchor="middle">${String(kuerzel).replace(/[<&>"]/g, '')}</text></svg>`;
const WORTBILD = '<span class="wortbild" aria-hidden="true"><b>FOKUS</b><small>Innovation</small></span>';

/** Reihenfolge der Bereiche (Positionierung 25.10.: gesehen → verkauft → im Alltag angekommen). */
export const BEREICHE = ['sichtbarkeit', 'vertrieb', 'innovation'];

export function quellen() {
  const alteSeite = join(REPO, 'makeinnovation', 'inhalt');
  const inhalt = lies(join(alteSeite, 'inhalt.json'));
  const seite = lies(join(alteSeite, 'seite.json'));
  const blaetter = lies(join(alteSeite, 'produkte.json'));
  const fokus = lies(join(ORDNER, 'inhalt', 'fokus.json'));
  const wissen = lies(join(ORDNER, 'inhalt', 'wissen.json'));
  // Seit 30.10. (abends) misst der Innovations-Check nur die Innovation — die Stufen sind die der Innovation.
  const scoring = lies(join(REPO, 'lib/check/vorlagen/innovations-check/scoring.json'));
  const stufen = scoring.saeulen_stufen ?? scoring.stufen;
  const katalog = lies(join(REPO, 'lib/check/vorlagen/innovations-check/fragenkatalog.json'));
  // Bereich „Kostenlos“ (30.10.): belegte Zahlen und Vorlagen — fehlen die Dateien, entfallen die Teile.
  const zahlenDatei = join(ORDNER, 'inhalt', 'zahlen.json');
  const vorlagenDatei = join(ORDNER, 'inhalt', 'vorlagen.json');
  const zahlen = existsSync(zahlenDatei) ? lies(zahlenDatei) : null;
  const vorlagen = existsSync(vorlagenDatei) ? lies(vorlagenDatei) : null;
  const aus = seite.ausgeblendet ?? {};
  inhalt.angebote = inhalt.angebote.filter((a) => !(aus.angebote ?? []).includes(a.id) && a.id !== 'fokus-innovation');
  inhalt.zusatzoptionen = inhalt.zusatzoptionen.filter((z) => !(aus.zusatzoptionen ?? []).includes(z.name));
  // Änderungsdatum je Seite (31.10., Prüfung Technik): Inhalts-Fingerabdruck → Datum der letzten echten Änderung (Sitemap, JSON-LD).
  const standDatei = join(ORDNER, 'inhalt', 'seitenstand.json');
  const seitenstand = existsSync(standDatei) ? lies(standDatei) : {};
  // Bausteine (31.10.): Katalog mit Bereich/Preis + Texte je Baustein aus inhalt/bausteine/<id>.meta.json.
  const bausteineDatei = join(ORDNER, 'inhalt', 'bausteine.json');
  const bausteine = existsSync(bausteineDatei) ? lies(bausteineDatei) : null;
  if (bausteine) for (const b of bausteine.bausteine) { const m = join(ORDNER, 'inhalt', 'bausteine', `${b.id}.meta.json`); if (existsSync(m)) Object.assign(b, { ...lies(m), ...b }); }
  return { inhalt, seite, blaetter, fokus, wissen, stufen, katalog, zahlen, vorlagen, seitenstand, bausteine };
}

/**
 * Die gebauten Dateien einer Vorlage (vorlagen.mjs): PDF mit Seitenzahl, Tabelle für Excel — gelesen aus assets/vorlagen, damit Seitenzahl und
 * Größe immer stimmen. Ohne Datei gibt es die Vorlage auf der Seite nicht.
 */
export function vorlageDateien(id) {
  const d = [];
  const pdf = join(VORLAGEN_QUELLE, `${id}.pdf`);
  if (existsSync(pdf)) d.push({ art: 'pdf', datei: `${id}.pdf`, seiten: (readFileSync(pdf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length, kb: Math.round(statSync(pdf).size / 1024) });
  const xlsx = join(VORLAGEN_QUELLE, `${id}.xlsx`);
  if (existsSync(xlsx)) d.push({ art: 'xlsx', datei: `${id}.xlsx`, kb: Math.max(1, Math.round(statSync(xlsx).size / 1024)) });
  return d;
}

/** Gebaute Vorlagen (vorlagen.mjs) — NICHT öffentlich; bauen.mjs verteilt sie (lauf): kurze nach assets/vorlagen, lange nach unterlagen/. */
export const VORLAGEN_QUELLE = join(ORDNER, 'dateien', 'vorlagen');
/** Lange Vorlagen für die App (Kevin 31.10.: „die größeren brauchen eine E-Mail“) — Repo-Ordner unterlagen/, liefert nur /api/unterlage aus. */
export const UNTERLAGEN = join(REPO, 'unterlagen');
/**
 * Die Vorlagen mit Dateien und der Entscheidung „per E-Mail“: ab `kostenlos.vorlagen.per_mail_ab_seiten` PDF-Seiten gibt es eine Vorlage
 * nur per E-Mail (Vorschau-Seite /kostenlos/vorlagen/<id>/), kürzere direkt als Download. Ohne gebaute Datei gibt es die Vorlage nicht.
 */
export function vorlagenListe(q) {
  const ab = q.fokus.kostenlos?.vorlagen?.per_mail_ab_seiten ?? Infinity;
  return (q.vorlagen?.vorlagen ?? []).map((v) => {
    const dateien = vorlageDateien(v.id);
    const seiten = dateien.find((d) => d.art === 'pdf')?.seiten ?? 0;
    const perMail = seiten >= ab;
    return { ...v, perMail, seiten, seite: `/kostenlos/vorlagen/${v.id}/`, dateien: dateien.map((d) => ({ ...d, href: perMail ? null : `/assets/vorlagen/${d.datei}` })) };
  }).filter((v) => v.dateien.length);
}

/** Gebaute Bausteine (vorlagen.mjs --bausteine) — NIE öffentlich; lauf verteilt sie nach unterlagen/bausteine/ (die App liefert nach Freigabe). */
export const BAUSTEINE_QUELLE = join(ORDNER, 'dateien', 'bausteine');
export const BAUSTEINE_ZIEL = join(REPO, 'unterlagen', 'bausteine');
const bausteinDateien = (id) => {
  const d = [];
  const pdf = join(BAUSTEINE_QUELLE, `${id}.pdf`);
  if (existsSync(pdf)) d.push({ art: 'pdf', datei: `${id}.pdf`, seiten: (readFileSync(pdf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length });
  const xlsx = join(BAUSTEINE_QUELLE, `${id}.xlsx`);
  if (existsSync(xlsx)) d.push({ art: 'xlsx', datei: `${id}.xlsx` });
  return d;
};
/**
 * Die Bausteine mit Dateien, Seiten und Preis (netto, Cent). Ein Paket hat keine eigenen Dateien: geliefert werden die seiner Teile, Seiten
 * und Einzelpreise werden summiert. Ohne gebautes PDF (bzw. ohne alle Teile) gibt es den Baustein auf der Seite nicht.
 */
export function bausteineListe(q) {
  const roh = q.bausteine?.bausteine ?? [];
  const einzeln = new Map(roh.filter((b) => !b.paket).map((b) => { const dateien = bausteinDateien(b.id); return [b.id, { ...b, dateien, seiten: dateien.find((d) => d.art === 'pdf')?.seiten ?? 0, seite: `/bausteine/${b.id}/` }]; }));
  const liste = roh.map((b) => {
    if (!b.paket) return einzeln.get(b.id);
    const teile = b.paket.map((id) => einzeln.get(id));
    if (teile.some((x) => !x?.dateien.length)) return null;
    return { ...b, teile, dateien: [], seiten: teile.reduce((s, x) => s + x.seiten, 0), einzelpreis: teile.reduce((s, x) => s + x.preis, 0), seite: `/bausteine/${b.id}/`, inhalt: teile.map((x) => x.titel) };
  });
  return liste.filter((b) => b && (b.paket || (b.dateien.length && b.titel)));
}

/** Adresse einer Seite im Netz: index.html → /, vertrieb/index.html → /vertrieb/. */
export const webPfad = (pfad) => (pfad === 'index.html' ? '/' : `/${pfad.replace(/index\.html$/, '')}`);
/** Dateiname des Vorschaubilds einer Seite (assets/bild/og/<name>.png). */
export const bildName = (pfad) => (pfad === 'index.html' ? 'start' : pfad.replace(/\/?index\.html$/, '').replace(/\.html$/, '').replace(/\//g, '-'));

// ── Seiten bauen ────────────────────────────────────────────────────────────────────────────────────────────────────
export function seitenBauen(q = quellen()) {
  const { inhalt, seite, blaetter, fokus: F, wissen: W, stufen, katalog, zahlen: Z, vorlagen: VL } = q;
  const K = F.kostenlos;
  // Vorlagen mit Dateien (30.10.: PDF mit Anleitung und Beispiel, dazu teils eine Tabelle für Excel) — ohne gebaute Datei nicht auf der Seite.
  const VORL = vorlagenListe(q);
  // Bausteine (31.10.) — früh, weil Kostenlos und Preise auf sie verweisen; das „Regal“ zeigt Titelseiten aufgefächert.
  const BS_LISTE = bausteineListe(q);
  // Startwerte für den Bereich „Website“ in MAKE OS (31.10.): was die Seite heute statisch zeigt — node bauen.mjs --startwerte <datei>.
  const START = { faq: [] };
  const regal = (ids, unterschrift, ordner = 'bausteine') => `<figure class="regal erscheint" aria-label="${e(unterschrift)}">${ids.slice(0, 3).map((id, i) => `<span class="regal-blatt r${i + 1}"><img src="/assets/bild/${ordner}/${id}-titel.jpg" width="640" height="905" alt="" loading="lazy"></span>`).join('')}<figcaption>${e(unterschrift)}</figcaption></figure>`;
  const vorlageVon = (id) => { const v = VORL.find((x) => x.id === id); if (!v) throw new Error(`Vorlage ${id} fehlt (inhalt/vorlagen.json bzw. assets/vorlagen)`); return v; };
  ANGEBOTE = [...inhalt.angebote];
  const angebot = (id) => inhalt.angebote.find((a) => a.id === id);
  const startBereiche = Object.fromEntries(inhalt.startseite.find((s) => s.id === 'bereiche').bereiche.map((b) => [b.name.toLowerCase(), b.angebote]));
  // Sichtbarkeit erzählt in der Reihenfolge der Arbeit: erst die Positionierung, dann Homepage, dann Videos.
  const REIHENFOLGE = { sichtbarkeit: ['positionierung', 'pr-kommunikation', 'homepage-landing', 'homepage-story', 'homepage-cinematic', 'erklaervideo', 'videostory', 'video-serie'] };
  const rang = (b, id) => { const i = (REIHENFOLGE[b] ?? []).indexOf(id); return i < 0 ? 99 : i; };
  const produkteIn = (b) => (startBereiche[b] ?? []).map(angebot).filter(Boolean).sort((x, y) => rang(b, x.id) - rang(b, y.id));
  const produktPfad = (a) => `/${a.bereich.toLowerCase()}/${a.id}/`;
  const faqVon = (ids) => ids.map((id) => inhalt.faq.find((f) => f.id === id)).filter(Boolean);
  /** Gemeinsame Antworten auf den Bereich zuschneiden (Rabatt, Kündigung). */
  const zuschneiden = (liste, k) => liste.map((f) => (F.fragen_zuschnitt[k]?.[f.id] ? { ...f, a: F.fragen_zuschnitt[k][f.id] } : f));
  const start = Object.fromEntries(inhalt.startseite.map((s) => [s.id, s]));
  const check = (quelle) => `${seite.check}?q=${quelle}`;
  /** Die kleinen Checks (30.10.): dieselbe Seite der Anwendung, gewählt über `thema` (lib/check/katalog.ts `VORLAGE_JE_THEMA`). */
  const checkThema = (thema, quelle) => `${seite.check}?thema=${thema}&q=${quelle}`;
  const kleinerCheck = (thema) => K.checks.find((c) => c.thema === thema);
  /** Der Check zu einem Bereich (Ratgeber, 30.10.): Vertrieb/Sichtbarkeit = der kleine Check, Innovation = der Innovations-Check. */
  const checkZuBereich = (bereich, quelle) => {
    const c = kleinerCheck(bereich) ?? K.checks.find((x) => x.haupt);
    return c ? { ...c, href: c.thema ? checkThema(c.thema, quelle) : c.pfad } : null;
  };
  const mail = (betreff) => `mailto:${seite.kontakt.mail}?subject=${encodeURIComponent(betreff)}`;
  const terminLink = (betreff) => (seite.termin.link ? seite.termin.link : mail(`Gespräch: ${betreff}`));
  /** Erstgespräch: die Buchungsseite aus MAKE OS, solange es keine gibt eine vorbereitete Mail mit drei Fragen. */
  // Die Buchungsseite läuft in der eigenen Anwendung (Caddy reicht /buchen/* durch) — nur diese Form, sonst bricht der Bau ab.
  if (seite.termin.link && seite.termin.link !== ERSTGESPRAECH && !BUCHUNG.test(seite.termin.link)) throw new Error(`termin.link muss ${ERSTGESPRAECH} oder /buchen/<name>-<24 Hex> sein, ist ${seite.termin.link}`);
  const erstLink = () => seite.termin.link || `mailto:${seite.kontakt.mail}?subject=${encodeURIComponent(F.erstgespraech.betreff)}&body=${encodeURIComponent(F.erstgespraech.mail_text)}`;
  const bald = (a) => a.status === 'Coming Soon';
  const monatlich = (a) => /^pro Monat/.test(a.preis_zusatz ?? '');
  const erster = (a) => `${a.preis.replace(/^ab /, '').split(' / ')[0].replace(/ €$/, '')}\u00a0€`;
  /** Preise (Kevin 30.10.: „Wir machen immer ab-Preise, nicht mit allen Preisen rausgehen“): überall nur der Einstiegspreis mit „ab“ —
   *  Listen, Angebotsseiten, Preisseite, llms.txt; was erst startet, hat noch keinen. Der volle Preis steht nur in den Daten. */
  const preisKurz = (a) => (bald(a) ? 'Anfrage starten' : `ab ${erster(a)}${monatlich(a) ? ' / Monat' : ''}`);
  const preisVoll = (a) => (bald(a) ? 'Preis auf Anfrage' : `ab ${erster(a)}`);
  /** Preis mit Markierung für js/inhalt.js (31.10., Bereich „Website“ in MAKE OS): ohne Antwort der App bleibt dieser Text stehen. */
  const mkPreis = (a, text) => (a && !bald(a) ? `<span data-mk="preis:${e(a.id)}">${e(text)}</span>` : e(text));
  const anbieter = seite.anbieter[seite.anbieter_aktiv];
  // Verkäufer und Rechnungssteller der Bausteine (Kevin 31.10.: „MAKE Innovation GmbH“) — Schlüssel in fokus.json bausteine.verkaeufer,
  // Daten aus seite.anbieter. Die App nennt beim Laden des Formulars die Firmierung der gewählten Gesellschaft (js/bestellung.js).
  // Kevin 31.10.: Bestellen erst nach Eintragung der GmbH ins Handelsregister. Bis Anschrift, Vertretung und Register ohne Platzhalter
  // dastehen, nennt die Seite keinen Verkäufer (die App bleibt bis dahin aus; ist sie an, setzt js/bestellung.js ihre Zeile ein).
  const verkaeuferDaten = F.bausteine?.verkaeufer ? seite.anbieter[F.bausteine.verkaeufer] : null;
  if (F.bausteine?.verkaeufer && !verkaeuferDaten) throw new Error(`bausteine.verkaeufer „${F.bausteine.verkaeufer}“ fehlt in seite.anbieter`);
  const verkaeufer = verkaeuferDaten && ![verkaeuferDaten.name, ...verkaeuferDaten.adresse, verkaeuferDaten.vertreten, verkaeuferDaten.register].some(istPlatzhalter) ? verkaeuferDaten : null;
  const verkaeuferEigen = verkaeufer && F.bausteine.verkaeufer !== seite.anbieter_aktiv;

  /** Produktblatt eines Angebots: eigene Angaben über denen der Familie; null, wenn es keins gibt. */
  const produktBlatt = (a) => {
    const p = blaetter.produkte[a.id] ?? F.produkt_blaetter?.[a.id];
    if (!p) return null;
    const f = p.familie ? blaetter.familien[p.familie] : {};
    const passt = (x) => (!x.nur || x.nur.includes(a.id)) && !(x.ohne ?? []).includes(a.id);
    return {
      ...f, ...p, ...(F.produkt_anpassung[a.id] ?? {}),
      konditionen: [...(p.konditionen_vorn ?? []), ...(p.konditionen ?? f.konditionen ?? [])],
      fragen: (p.fragen ?? f.fragen ?? []).filter(passt),
      katalog: p.katalog_auswahl ? p.katalog_auswahl.map((n) => f.katalog[n]) : null,
      // Positionierung: die drei Stufen als Bausteine (Preis immer „ab“).
      bausteine: p.bausteine ?? f.bausteine ?? (a.stufen ? a.stufen.map((x) => ({ name: `Positionierung ${x.name} · ab ${x.preis.replace(/^ab /, '')}`, hinweis: `Workshop: ${x.workshop}`, text: x.ergebnis })) : undefined),
    };
  };
  /** Angebote eines Bereichs in Gruppen (Homepage-Pakete, Videos, …); Einzelne bilden eine Gruppe ohne Titel. */
  const gruppenIn = (b) => {
    const gruppen = [];
    for (const a of produkteIn(b)) {
      const name = a.gruppe ?? '';
      let g = gruppen.find((x) => x.name === name);
      if (!g) gruppen.push((g = { name, liste: [] }));
      g.liste.push(a);
    }
    return gruppen;
  };
  const anker = (name) => `angebot-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  // ── Bausteine ──
  const knopf = (href, text, art = '') => `<a class="knopf${art ? ` ${art}` : ''}" href="${href}">${e(text)} ${PFEIL}</a>`;
  const checkKnopf = (quelle, text = 'Innovations-Check starten', art = '') => knopf(check(quelle), text, art);
  const erstKnopf = (art = '', text = F.erstgespraech.knopf) => knopf(erstLink(), text, art);
  /** Der passende Check je Bereich (31.10., Prüfung „Texte“): Sichtbarkeit/Vertrieb = der kleine Check, Innovation = der Innovations-Check,
   *  ohne Bereich die Übersicht unter „Kostenlos“. So führt der zweite Knopf nie zu einem Check, der das Falsche misst. */
  const passenderCheck = (bereich, quelle) => {
    if (bereich === 'innovation') return { href: check(quelle), knopf: 'Innovations-Check, 10 Minuten', satz: 'Oder Sie starten mit dem Innovations-Check: kurz in rund 10 Minuten, Ergebnis sofort.' };
    const c = bereich && kleinerCheck(bereich);
    if (c) return { href: checkThema(bereich, quelle), knopf: `${c.name}, ${c.minuten} Minuten`, satz: `Oder Sie starten mit dem ${c.name}: ${c.minuten} Minuten, Ergebnis sofort.` };
    return { href: '/kostenlos/#checks', knopf: 'Kostenlose Checks', satz: 'Oder Sie starten mit einem unserer kostenlosen Checks, Ergebnis sofort.' };
  };
  const passenderKnopf = (bereich, quelle, art = 'zweit') => { const c = passenderCheck(bereich, quelle); return knopf(c.href, c.knopf, art); };
  const textlink = (href, text) => `<a class="textlink" href="${href}"><span>${e(text)}</span> ${PFEIL}</a>`;
  /** Anfrage (01.11., Kevin: „ich kann nicht auf Anfrage reingehen“): jeder Knopf, der früher das Mail-Programm öffnete, führt auf das
   *  Anfrage-Formular der App (/anfrage, Caddy reicht es durch) und nennt den Anlass. Ist das Formular aus oder die App nicht erreichbar, setzt
   *  js/app-wege.js die Mail aus `data-anfrage-mail` ein — nie ein Weg ins Leere. Anlass nur [a-z0-9-]; die App kennt ihn oder übergeht ihn. */
  const anfrageAttr = (anlass, betreff) => {
    if (!/^[a-z0-9-]{1,60}$/.test(anlass)) throw new Error(`Anlass ungültig: ${anlass}`);
    return `href="/anfrage?anlass=${anlass}" data-anfrage-mail="${e(mail(betreff))}"`;
  };
  const anfrageKnopf = (anlass, betreff, text, art = '') => `<a class="knopf${art ? ` ${art}` : ''}" ${anfrageAttr(anlass, betreff)}>${e(text)} ${PFEIL}</a>`;
  const anfrageTextlink = (anlass, betreff, text) => `<a class="textlink" ${anfrageAttr(anlass, betreff)}><span>${e(text)}</span> ${PFEIL}</a>`;
  const anfrageInline = (anlass, betreff, text) => `<a class="unterstrichen" ${anfrageAttr(anlass, betreff)}>${e(text)}</a>`;
  const vorzeile = (text, nr) => `<p class="vorzeile${nr ? ' mit-nr' : ''}">${nr ? `<span class="nr">${e(nr)}</span>` : ''}${e(text)}</p>`;
  const zeilen = (s) => (String(s).includes('|') ? String(s).split('|').map((z) => `<span class="zeile">${e(z)}</span>`).join('') : e(s));
  // Leerzeichen vor der Unterzeile: sie steht als Block darunter, aber im Text (Crawler, Vorlesen) kleben die Sätze sonst aneinander.
  const titel = (haupt, ruhig) => `${zeilen(haupt)}${ruhig ? ` <span class="ruhig">${zeilen(ruhig)}</span>` : ''}`;
  const abKopf = ({ marke, nr, h2, ruhig, lead, id }) => `<header class="ab-kopf erscheint"><p class="ab-marke">${nr ? `<span class="nr">${e(nr)}</span>` : ''}${e(marke)}</p><div><h2 class="glanz"${id ? ` id="${id}"` : ''}>${titel(h2, ruhig)}</h2>${lead ? `<p class="lead">${t(lead)}</p>` : ''}</div></header>`;
  const punkte = (liste, klasse = 'punkte') => `<ul class="${klasse}">${liste.map((x) => `<li>${t(x)}</li>`).join('')}</ul>`;
  const weg = (stationen, { klasse = '', etiketten = ['Heute', 'Mit uns', 'Danach'], label = 'Der Weg' } = {}) => `<ol class="weg erscheint${klasse ? ` ${klasse}` : ''}" aria-label="${e(label)}">${stationen.map((s, i) => `<li class="station"><span class="etikett">${e(etiketten[i] ?? '')}</span><b>${t(typeof s === 'string' ? s : s.titel)}</b>${typeof s === 'string' || !s.text ? '' : `<span class="station-text">${t(s.text)}</span>`}</li>`).join('')}</ol>`;
  const zahl = (b) => `<figure class="zahl erscheint"><b class="glanz">${e(b.wert)}</b><figcaption>${e(b.text)}<cite><a href="${e(b.link)}" rel="noopener" target="_blank">${e(b.quelle)}</a></cite></figcaption></figure>`;
  const raster = (liste, n = liste.length) => `<div class="raster n${n} erscheint">${liste.map((x, i) => `<div class="spalte">${x.nr !== false ? `<span class="nr">${String(i + 1).padStart(2, '0')}</span>` : ''}${x.etikett ? `<span class="etikett">${e(x.etikett)}</span>` : ''}<h3>${e(x.titel)}</h3><p>${t(x.text)}</p>${x.unter ? `<p class="spalte-beleg">${t(x.unter)}</p>` : ''}</div>`).join('')}</div>`;
  // Was eine Seite an Fragen und Brotkrumen zeigt, landet auch in ihren strukturierten Daten (neu() liest und leert es).
  let seitenFragen = [];
  let seitenKrumen = null;
  // Dieselbe Frage nur auf EINER Seite als FAQPage auszeichnen (Google-Regel für wiederholte FAQs): die erste Seite, die sie zeigt.
  const ausgezeichnet = new Set();
  const fragen = (liste, titelText = 'Häufige Fragen', { id = 'fragen', marke = 'Fragen', hinweis = true, mehr = false } = {}) => {
    if (!liste.length) return '';
    for (const f of liste) if (!ausgezeichnet.has(klar(f.f))) { ausgezeichnet.add(klar(f.f)); seitenFragen.push(f); }
    return `<section class="abschnitt" id="${id}" aria-labelledby="${id}-titel"><div class="w"><div class="zweispaltig">
<div class="erscheint"><p class="ab-marke">${e(marke)}</p><h2 id="${id}-titel">${e(titelText)}</h2>${hinweis ? `<p class="leise">Noch etwas offen? ${anfrageInline('frage', 'Frage', 'Schreiben Sie uns')}, wir antworten persönlich.</p>` : ''}</div>
<div class="fragen erscheint">${liste.map((f) => `<details><summary>${t(f.f)}<span class="plus" aria-hidden="true"></span></summary><p>${t(f.a)}</p></details>`).join('')}${mehr ? `<p class="fragen-mehr">${textlink('/fragen/', 'Alle Fragen und Antworten')}</p>` : ''}</div>
</div></div></section>`;
  };
  const netto = '<p class="netto">Alle Preise netto zuzüglich Umsatzsteuer. Unsere Angebote richten sich an Unternehmen.</p>';
  const brotkrumen = (liste) => {
    seitenKrumen = liste;
    return `<nav class="brotkrumen" aria-label="Brotkrumen"><a href="/">Start</a>${liste.map(([h, n]) => `<span aria-hidden="true">/</span>${h ? `<a href="${h}">${e(n)}</a>` : `<span aria-current="page">${e(n)}</span>`}`).join('')}</nav>`;
  };
  /** Fakten kompakt, für Menschen und Maschinen: „Auf einen Blick“. */
  const blick = (zeilen, titelText = 'Auf einen Blick') => `<section class="blick-band" aria-label="${e(titelText)}"><div class="w"><dl class="blick erscheint">${zeilen.filter(([, v]) => v).map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${t(v)}</dd></div>`).join('')}</dl></div></section>`;
  const kurzGesagt = (text) => `<div class="kurz-gesagt erscheint"><p class="etikett">Das Wichtigste vorweg</p><p>${t(text)}</p></div>`;
  const zeitplan = (ab) => `<ol class="zeitplan">${ab.zeilen.map((z) => `<li><span class="wann">${e(z[0])}</span><div><b>${e(z[1])}</b>${z[2] ? `<span>${t(z[2])}</span>` : ''}</div></li>`).join('')}</ol>${ab.hinweis ? `<p class="leise klein-text">${t(ab.hinweis)}</p>` : ''}`;
  /** Events (Kevin 30.10.: „verschiedene Formate“ statt eines langen Tisches): die Formate als ruhige Liste. */
  const formatListe = () => `<ul class="format-liste erscheint">${F.events.formate.map((x) => `<li><b>${e(x.titel)}</b><span>${t(x.text)}</span></li>`).join('')}</ul>`;
  /** Die lange Tafel des Abends (bis 30.10.): Plätze als Punkte, ein paar Verbindungen über den Tisch (zeichnen sich einmal). */
  const tafel = () => {
    const plaetze = [];
    for (let i = 0; i < 6; i++) { const x = 70 + i * 52; plaetze.push([x, 38], [x, 142]); }
    // Die Gastgeberin (unten, dritter Platz) verbindet Gäste über den Tisch hinweg, dazu ein Gespräch zwischen zwei Gästen.
    const faeden = [[0, 5], [6, 5], [10, 5], [8, 7]].map(([a, b]) => {
      const [x1, y1] = plaetze[a], [x2, y2] = plaetze[b];
      return `<path class="faden" pathLength="1" d="M${x1} ${y1 + 10} C ${x1} 90, ${x2} 90, ${x2} ${y2 - 10}"/>`;
    }).join('');
    return `<svg class="tafel erscheint" viewBox="0 0 400 180" role="img" aria-label="Ein langer Tisch mit zwölf Plätzen, Linien verbinden Menschen über den Tisch hinweg"><rect class="tisch" x="40" y="62" width="320" height="56" rx="6"/>${faeden}${plaetze.map(([x, y], i) => `<circle class="platz${i === 5 ? ' gastgeberin' : ''}" cx="${x}" cy="${y}" r="9"/>`).join('')}</svg>`;
  };

  // ── Rahmen: Kopf, Fuß, Check-Knopf ──
  /**
   * Gruppen mit mehreren Paketen bekommen eine eigene Seite (Kevin 30.10.: „nur Positionierung, Homepages, Videos … wenn sie draufklicken,
   * stellen wir die Pakete vor“) — Pfad und Name aus fokus.json `gruppen_seiten`. Einzelne Angebote führen direkt auf ihre Seite.
   */
  const gruppenSeite = (b, g) => (g.liste.length > 1 && F.gruppen_seiten?.[g.name] ? { ...F.gruppen_seiten[g.name], href: `/${b}/${F.gruppen_seiten[g.name].pfad}/` } : null);
  const navUnter = (b) => [
    ...(b === 'innovation' ? [['/innovations-check/', 'Innovations-Check', 'kostenlos']] : []),
    ...(kleinerCheck(b) ? [[checkThema(b, `${b}_menue`), kleinerCheck(b).name, 'kostenlos']] : []),
    ...gruppenIn(b).flatMap((g) => { const gs = gruppenSeite(b, g); return gs ? [[gs.href, gs.name, '']] : g.liste.map((a) => [produktPfad(a), F.kurznamen[a.id] ?? a.name, bald(a) ? 'bald' : '']); }),
  ];
  // Kevin 31.10.: Sichtbarkeit, Vertrieb und Innovation stehen zusammen unter „Leistungen“, je Bereich mit seinen Bausteinen
  // (ohne Preis — Kevin 29.10.: kein Preis im Menü). Der Punkt selbst führt auf die Preisseite, die alle Leistungen zeigt.
  const bausteineVon = (b) => (BS_LISTE.some((x) => x.bereich === b) ? `/bausteine/#bausteine-${b}` : null);
  const NAV = [
    { key: 'leistungen', name: 'Leistungen', href: '/preise/', bereiche: BEREICHE },
    { key: 'events', name: 'Events', href: '/events/' },
    { key: 'kostenlos', name: 'Kostenlos', href: '/kostenlos/' },
    { key: 'ueber-uns', name: 'Über uns', href: '/ueber-uns/' },
  ];
  const kopf = (aktiv) => `<a class="sprung" href="#inhalt">Zum Inhalt</a>
<header class="kopf"><div class="w kopf-innen">
<a class="marke" href="/" aria-label="Fokus Innovation, zur Startseite">${ZEICHEN()}${WORTBILD}</a>
<nav class="haupt-nav" aria-label="Hauptmenü">${NAV.map((n) => {
    const cur = n.key === aktiv ? ' aria-current="page"' : '';
    if (n.bereiche) {
      const dabei = n.key === aktiv ? ' aria-current="page"' : n.bereiche.includes(aktiv) ? ' aria-current="true"' : '';
      return `<div class="nav-punkt"><a href="${n.href}"${dabei}>${e(n.name)}</a><div class="unter unter-leistungen">${n.bereiche.map((b) => `<div class="unter-spalte"><a class="unter-alles" href="/${b}/">${e(F.bereiche[b].name)}</a>${navUnter(b).map(([h, name, p]) => `<a href="${h}">${e(name)}${p ? `<span>${e(p)}</span>` : ''}</a>`).join('')}${bausteineVon(b) ? `<a class="unter-baustein" href="${bausteineVon(b)}">Bausteine<span>zum Selbermachen</span></a>` : ''}</div>`).join('')}<a class="unter-fuss" href="/preise/"><span>Alle Leistungen und Preise</span> ${PFEIL}</a></div></div>`;
    }
    if (!n.unter) return `<a href="${n.href}"${cur}>${e(n.name)}</a>`;
    return `<div class="nav-punkt"><a href="${n.href}"${cur}>${e(n.name)}</a><div class="unter"><a class="unter-alles" href="${n.href}">Überblick ${e(n.name)}</a>${n.unter.map(([h, name, p]) => `<a href="${h}">${e(name)}${p ? `<span>${e(p)}</span>` : ''}</a>`).join('')}</div></div>`;
  }).join('')}</nav>
<a class="kopf-kontakt" href="/kontakt/"${aktiv === 'kontakt' ? ' aria-current="page"' : ''}>Kontakt</a>
<a class="knopf klein kopf-check" href="${erstLink()}">${e(F.erstgespraech.name)}</a>
<details class="menue"><summary><span class="striche" aria-hidden="true"></span>Menü</summary><nav class="menue-blatt" aria-label="Menü">
${BEREICHE.map((b) => `<p class="menue-gruppe">${e(F.bereiche[b].name)}</p><a href="/${b}/">Überblick ${e(F.bereiche[b].name)}</a>${navUnter(b).map(([h, name]) => `<a href="${h}">${e(name)}</a>`).join('')}${bausteineVon(b) ? `<a href="${bausteineVon(b)}">Bausteine zum Selbermachen</a>` : ''}`).join('\n')}
<p class="menue-gruppe">Fokus Innovation</p><a href="/events/">Events</a><a href="/kostenlos/">Kostenlos</a><a href="/preise/">Preise</a><a href="/ueber-uns/">Über uns</a><a href="/kontakt/">Kontakt</a>
${erstKnopf()}<a class="textlink menue-check" href="${check('menue')}"><span>Oder: Innovations-Check, 10 Minuten</span> ${PFEIL}</a>
</nav></details>
</div></header>`;

  const fussSpalte = (titelText, links) => `<div><p class="fuss-titel">${e(titelText)}</p><ul>${links.map(([h, n]) => `<li><a href="${h}">${e(n)}</a></li>`).join('')}</ul></div>`;
  const fuss = () => `<footer class="fuss"><div class="w">
<div class="fuss-raster">
<div class="fuss-marke"><a class="marke" href="/" aria-label="Fokus Innovation, zur Startseite">${ZEICHEN()}${WORTBILD}</a><p class="claim glanz erscheint">${e(F.marke.claim)}</p>
<p><a ${anfrageAttr('kontakt', 'Anfrage')}>Nachricht schreiben</a><br><a href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a><br>${seite.kontakt.adresse.map(t).join('<br>')}</p></div>
${fussSpalte('Leistungen', [...BEREICHE.map((b) => [`/${b}/`, F.bereiche[b].name]), ['/innovations-check/', 'Innovations-Check'], ['/preise/', 'Preise'], ...(BS_LISTE.length ? [['/bausteine/', 'Bausteine']] : [])])}
${fussSpalte('Kostenlos', [['/kostenlos/#checks', 'Checks'], ['/kostenlos/#ratgeber', 'Ratgeber'], ...(Z ? [['/kostenlos/zahlen/', 'Zahlen']] : []), ...(VL ? [['/kostenlos/#vorlagen', 'Vorlagen']] : []), ['/fragen/', 'Häufige Fragen'], ['/begriffe/', 'Begriffe']])}
${fussSpalte('Fokus Innovation', [['/events/', 'Events'], ['/ueber-uns/', 'Über uns'], ['/kontakt/', 'Kontakt'], ['/impressum/', 'Impressum'], ['/datenschutz/', 'Datenschutz']])}
</div>
<div class="fuss-unten"><span>© 2026 ${e(anbieter.name)} · ${e(F.marke.name)} ist eine Marke der ${e(anbieter.name)}</span><span>Keine Cookies, kein Tracking. Alle Preise netto zuzüglich Umsatzsteuer, für Unternehmen.</span></div>
</div></footer>`;

  // ── Suche: Adressen, Organisation und strukturierte Daten (schema.org, eine @graph je Seite) ──
  const SEO = F.seo;
  const BASIS = `https://${F.domain}`;
  const absolut = (p) => `${BASIS}${p}`;
  const ORG = `${BASIS}/#organisation`;
  const SITE = `${BASIS}/#website`;
  const personAnker = (p) => slug(p.name);
  const personId = (p) => `${BASIS}/ueber-uns/#${personAnker(p)}`;
  const [strasse, ort] = seite.kontakt.adresse;
  const organisation = {
    '@type': 'ProfessionalService', '@id': ORG, name: F.marke.name, legalName: anbieter.name, url: `${BASIS}/`,
    description: klar(F.marke.beschreibung), slogan: F.marke.claim,
    logo: { '@type': 'ImageObject', '@id': `${BASIS}/#logo`, url: absolut('/assets/bild/logo.png'), width: 512, height: 512, caption: F.marke.name },
    image: absolut('/assets/bild/og/start.png'),
    email: seite.kontakt.mail,
    address: { '@type': 'PostalAddress', streetAddress: klar(strasse), postalCode: klar(ort).split(' ')[0], addressLocality: klar(ort).split(' ').slice(1).join(' '), addressCountry: 'DE' },
    areaServed: [{ '@type': 'Country', name: 'Deutschland' }, { '@type': 'Place', name: 'Europa' }],
    knowsAbout: SEO.wissen_gebiete,
    founder: F.team.map((p) => ({ '@id': personId(p) })),
    contactPoint: { '@type': 'ContactPoint', contactType: 'Anfragen', email: seite.kontakt.mail, availableLanguage: ['de'] },
    ...(SEO.same_as.length ? { sameAs: SEO.same_as } : {}),
  };
  const personen = F.team.map((p) => ({ '@type': 'Person', '@id': personId(p), name: p.name, jobTitle: p.rolle, description: klar(p.text), worksFor: { '@id': ORG }, url: personId(p) }));
  const webseite = { '@type': 'WebSite', '@id': SITE, url: `${BASIS}/`, name: F.marke.name, description: klar(F.marke.beschreibung), inLanguage: 'de-DE', publisher: { '@id': ORG } };
  /** Preis eines Angebots als Angebot nach schema.org (netto, Euro, monatlich wo „pro Monat“). */
  const angebotDaten = (a) => {
    const url = absolut(produktPfad(a));
    const monat = /^pro Monat/.test(a.preis_zusatz ?? '');
    const basis = { '@type': 'Offer', url, priceCurrency: 'EUR', availability: bald(a) ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock', eligibleCustomerType: 'https://schema.org/Business', seller: { '@id': ORG } };
    const spez = (preis, extra = {}) => ({ '@type': monat ? 'UnitPriceSpecification' : 'PriceSpecification', priceCurrency: 'EUR', valueAddedTaxIncluded: false, ...(monat ? { unitCode: 'MON', unitText: 'Monat' } : {}), ...preis, ...extra });
    const zahl = (s) => String(Number(String(s).replace(/[^\d]/g, '')));
    if (a.stufen) return a.stufen.map((s) => ({ ...basis, name: `${a.name.replace(/ S, M, L$/, '')} ${s.name}`, price: zahl(s.preis), priceSpecification: spez({ price: zahl(s.preis) }) }));
    if (/^ab /.test(a.preis)) return { ...basis, name: a.name, priceSpecification: spez({ minPrice: zahl(a.preis) }) };
    return { ...basis, name: a.name, price: zahl(a.preis), priceSpecification: spez({ price: zahl(a.preis) }) };
  };

  const rahmen = ({ pfad, titel: titelText, beschreibung, aktiv = '', main, film = false, klasse = '', schema = [], seitenTyp = 'WebPage', artikel = null, fragenListe = [], krumen = null, geaendertAm = SEO.stand }) => {
    const ohneSuche = pfad === '404.html';
    const url = absolut(webPfad(pfad));
    const bild = absolut(`/assets/bild/og/${bildName(pfad)}.png`);
    const geaendert = artikel?.aktualisiert ?? geaendertAm;
    const graph = [organisation, ...personen, webseite];
    if (!ohneSuche) {
      graph.push({ '@type': seitenTyp, '@id': `${url}#webseite`, url, name: titelText, description: beschreibung, isPartOf: { '@id': SITE }, about: { '@id': ORG }, inLanguage: 'de-DE', dateModified: geaendert, primaryImageOfPage: { '@type': 'ImageObject', url: bild, width: 1200, height: 630 }, ...(krumen ? { breadcrumb: { '@id': `${url}#brotkrumen` } } : {}) });
      if (krumen) graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#brotkrumen`, itemListElement: [['/', 'Start'], ...krumen].map(([h, n], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: h ? absolut(h) : url })) });
      const gesehen = new Set();
      const fragenEinmal = fragenListe.filter((f) => { const k = klar(f.f); if (gesehen.has(k)) return false; gesehen.add(k); return true; });
      if (fragenEinmal.length) graph.push({ '@type': 'FAQPage', '@id': `${url}#fragen-liste`, isPartOf: { '@id': `${url}#webseite` }, inLanguage: 'de-DE', mainEntity: fragenEinmal.map((f) => ({ '@type': 'Question', name: klar(f.f), acceptedAnswer: { '@type': 'Answer', text: klar(f.a) } })) });
      graph.push(...schema);
    }
    const ldJson = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
    const robots = ohneSuche || !SEO.oeffentlich ? 'noindex' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
    const suche = ohneSuche ? '' : `<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="de" href="${url}">
<meta property="og:type" content="${artikel ? 'article' : 'website'}">
<meta property="og:site_name" content="${e(F.marke.name)}">
<meta property="og:locale" content="de_DE">
<meta property="og:title" content="${e(titelText)}">
<meta property="og:description" content="${e(beschreibung)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${bild}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${e(titelText)}">
<meta name="twitter:card" content="summary_large_image">
${artikel ? `<meta property="article:published_time" content="${artikel.veroeffentlicht}">\n<meta property="article:modified_time" content="${artikel.aktualisiert}">\n<meta name="author" content="${e(artikel.autor)}">\n` : ''}`;
    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(titelText)}</title>
<meta name="description" content="${e(beschreibung)}">
<meta name="robots" content="${robots}">
${suche}<meta name="theme-color" content="${film ? '#0B0C0F' : '#F6F4F0'}">
<link rel="icon" href="/assets/zeichen.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/assets/bild/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/schriften/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/schriften/schibsted-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/fokus.css?v=${stempel('css/fokus.css')}">
${film ? `<link rel="stylesheet" href="/css/film.css?v=${stempel('css/film.css')}">\n` : ''}<script src="/js/frueh.js?v=${stempel('js/frueh.js')}"></script>
<script src="/js/seite.js?v=${stempel('js/seite.js')}" defer></script>
${film ? `<link rel="modulepreload" href="/js/szene.js?v=${stempel('js/szene.js')}">\n<script type="module" src="/js/film.js?v=${stempel('js/film.js')}"></script>\n` : ''}${main.includes('data-rechner') ? `<script src="/js/rechner.js?v=${stempel('js/rechner.js')}" defer></script>\n` : ''}${main.includes('data-unterlage') ? `<script src="/js/unterlage.js?v=${stempel('js/unterlage.js')}" defer></script>\n` : ''}${main.includes('data-baustein') ? `<script src="/js/bestellung.js?v=${stempel('js/bestellung.js')}" defer></script>\n` : ''}${main.includes('data-mk=') ? `<script src="/js/inhalt.js?v=${stempel('js/inhalt.js')}" defer></script>\n` : ''}<script src="/js/app-wege.js?v=${stempel('js/app-wege.js')}" defer></script>\n<script type="application/ld+json">${ldJson}</script>
</head>
<body${klasse ? ` class="${klasse}"` : ''}>
${kopf(aktiv)}
<main id="inhalt">
${main}
</main>
${fuss()}
</body>
</html>
`;
  };

  /** Der dunkle Schlussakt: eine Frage, ein Satz, der Einstieg in drei Schritten, zwei Knöpfe. */
  const ansprechpartner = () => { const p = F.team[0]; return `<p class="ansprechpartner">${MONOGRAMM(p.kuerzel)}<span>Ihr Ansprechpartner im Erstgespräch<b>${e(p.name)}</b></span></p>`; };
  const schlussakt = ({ quelle, bereich, h2 = 'Sprechen wir darüber.', lead, knoepfe, stufen = F.einstieg, ablauf = true }) => `<section class="schlussakt dunkel" aria-labelledby="schluss-titel"><div class="w">
<div class="schluss-kopf erscheint">${ZEICHEN('zeichen schluss-zeichen')}<p class="vorzeile">Der Einstieg</p><h2 id="schluss-titel" class="glanz">${e(h2)}</h2><p class="lead">${t(lead ?? `Im kostenlosen Erstgespräch, 30 Minuten per Video, klären wir, ob und womit wir helfen können. ${passenderCheck(bereich, quelle).satz}`)}</p>
<div class="knoepfe">${knoepfe ?? `${erstKnopf()}${passenderKnopf(bereich, quelle)}`}</div>${ansprechpartner()}</div>
${ablauf ? weg(stufen, { klasse: 'einstieg', etiketten: ['01', '02', '03'], label: 'Der Einstieg in drei Schritten' }) : ''}
</div></section>`;

  const seiten = [];
  const STAND = { ...(q.seitenstand ?? {}) };
  const HEUTE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
  /** Eine Seite anlegen. Titel und Beschreibung kommen aus fokus.json › seo.seiten[seo] (oder direkt, bei Ratgebern). */
  const neu = (pfad, s) => {
    const vorgabe = s.seo ? SEO.seiten[s.seo] : null;
    if (s.seo && !vorgabe) throw new Error(`seo.seiten.${s.seo} fehlt in fokus.json`);
    // woertlich: Namen ohne BEGRIFFE (Bausteine tragen ihren Produktnamen auch in Titel und Beschreibung).
    const kl = s.woertlich ? (x) => String(x ?? '').replace(/\[\[KEVIN: [^\]]*\]\]/g, '').replace(/\s+/g, ' ').trim() : klar;
    const titelText = kl(vorgabe?.titel ?? s.titel);
    const beschreibung = kl(vorgabe?.beschreibung ?? s.beschreibung);
    const fingerabdruck = createHash('sha1').update(`${titelText}|${beschreibung}|${s.main ?? ''}`).digest('hex').slice(0, 16);
    if (STAND[pfad]?.hash !== fingerabdruck) STAND[pfad] = { hash: fingerabdruck, datum: HEUTE };
    const geaendertAm = s.artikel?.aktualisiert ?? STAND[pfad].datum;
    const html = rahmen({ ...s, pfad, titel: titelText, beschreibung, fragenListe: seitenFragen, krumen: seitenKrumen, geaendertAm });
    seitenFragen = [];
    seitenKrumen = null;
    seiten.push({
      pfad, html, titel: titelText, beschreibung,
      geaendert: geaendertAm,
      bild: pfad === '404.html' ? null : { datei: `assets/bild/og/${bildName(pfad)}.png`, titel: s.bildTitel ?? titelText.replace(/ · Fokus Innovation$/, ''), vorzeile: s.bildVorzeile ?? F.marke.name },
    });
  };
  const B = F.bereiche;
  // Videos (30.10.): Datei nach assets/videos/, in fokus.json › videos eintragen — ersetzt das Problem-Bild bzw. bekommt einen Abschnitt.
  const VIDEOS = Object.fromEntries(Object.entries(F.videos ?? {}).filter(([, v]) => v && typeof v === 'object'));

  // ── Wissen: Ratgeber und Begriffe ──
  const artikelPfad = (a) => `/wissen/${a.id}/`;
  const artikelText = (a) => [a.kurz, ...a.abschnitte.flatMap((x) => [x.h, ...(x.absaetze ?? []), ...(x.punkte ?? []), ...(x.absaetze_danach ?? []), ...(x.schritte ?? []).flatMap((s) => [s.titel, s.text]), ...(x.tabelle?.zeilen.flat() ?? [])])].join(' ');
  const lesezeit = (a) => Math.max(2, Math.ceil(klar(artikelText(a)).split(/\s+/).length / 200));
  const wissenListe = (liste) => `<ul class="wissen-liste erscheint">${liste.map((a) => `<li><a href="${artikelPfad(a)}"><span class="etikett">${a.leitfaden ? 'Leitfaden · ' : ''}${e(B[a.bereich].name)} · ${lesezeit(a)} Minuten</span><h3>${e(a.titel)}</h3><p>${t(a.beschreibung)}</p><span class="textlink"><span>Lesen</span> ${PFEIL}</span></a></li>`).join('')}</ul>`;
  const artikelZu = (bedingung) => W.artikel.filter(bedingung);
  // Ohne Lücken im Raster (31.10.): drei oder sechs Ratgeber, der Rest über „Alle Ratgeber“; ein oder zwei stehen breiter.
  const wissenAbschnitt = (liste, h2 = 'Wissen zum Thema') => {
    if (!liste.length) return '';
    const n = liste.length >= 6 ? 6 : liste.length >= 3 ? 3 : liste.length;
    return `<section class="abschnitt" aria-labelledby="wissen-titel"><div class="w">${abKopf({ marke: 'Wissen', h2, id: 'wissen-titel' })}${wissenListe(liste.slice(0, n)).replace('class="wissen-liste', `class="wissen-liste n${n}`)}${liste.length > n ? `<div class="knoepfe erscheint">${textlink('/kostenlos/#ratgeber', 'Alle Ratgeber')}</div>` : ''}</div></section>`;
  };
  /** Vergleichstabelle der Produktblätter (Homepages, Videos): Kopf mit Links und Preisen, auf dem Handy als Karten. */
  const vergleichTabelle = (v) => {
    const liste = v.angebote.map(angebot).filter(Boolean);
    const kurzName = (a) => a.name.replace(/^Homepage /, '');
    return `<h3 class="gruppe-titel">${e(v.titel)}</h3><div class="tabelle-huelle erscheint"><table class="vergleich text"><thead><tr><th scope="col"><span class="sr">Merkmal</span></th>${liste.map((a) => `<th scope="col"><a href="${produktPfad(a)}">${e(kurzName(a))}</a><span class="zahl-klein">${e(preisKurz(a))}</span></th>`).join('')}</tr></thead>
<tbody>${v.zeilen.map(([m, ...w]) => `<tr><th scope="row">${e(alt(m))}</th>${w.map((x, n) => `<td data-name="${e(liste[n] ? kurzName(liste[n]) : '')}">${t(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const angebotZeilen = (liste) => `<ul class="zeilen erscheint">${liste.map((x) => `<li><a href="${produktPfad(x)}"><span class="z-name">${e(x.name)}${bald(x) ? ' <span class="marke-bald">Bald</span>' : ''}</span><span class="z-text">${t(F.kurztexte[x.id] ?? produktBlatt(x)?.versprechen ?? x.fuer_wen ?? (x.enthalten ?? [])[0] ?? '')}</span><span class="z-preis">${mkPreis(x, preisKurz(x))}</span>${PFEIL}</a></li>`).join('')}</ul>`;
  // ── Bausteine für Vertrauen (29.10.): Arbeitsprobe, Muster, Risiko, Rechner ──
  /** Arbeitsprobe (31.10., Prüfung „Gestaltung“: zeigen statt beschreiben): diese Website auf Rechner und Handy, daneben was sie ausmacht. */
  const arbeitsprobe = () => `<section class="abschnitt" aria-labelledby="probe-titel"><div class="w"><div class="probe">
<div class="probe-text erscheint">${vorzeile('Arbeitsprobe')}<h2 id="probe-titel">${e(F.arbeitsprobe.titel)}</h2><p class="lead">${t(F.arbeitsprobe.text)}</p>${punkte(F.arbeitsprobe.punkte)}<div class="knoepfe">${textlink('/', 'Zur Startseite mit dem Film')}</div></div>
<figure class="probe-buehne erscheint"><div class="geraet laptop"><img src="/assets/bild/arbeitsprobe/rechner.jpg" width="1440" height="900" loading="lazy" decoding="async" alt="Die Startseite von Fokus Innovation am Rechner: das Logo, der Satz „Fortschritt braucht Fokus.“ und zwei Knöpfe"></div><div class="geraet handy"><img src="/assets/bild/arbeitsprobe/handy.jpg" width="780" height="1688" loading="lazy" decoding="async" alt="Die Seite „In den Markt“ auf dem Handy mit Überschrift und Grafik zum Problem"></div><figcaption class="leise klein-text">Diese Website, gebaut wie Ihre: am Rechner und auf dem Handy.</figcaption></figure>
</div></div></section>`;
  const musterPositionierung = () => {
    const M = F.muster_positionierung;
    return `<section class="abschnitt" aria-labelledby="muster-titel"><div class="w">${abKopf({ marke: 'Muster', h2: M.titel, lead: M.lead, id: 'muster-titel' })}
<figure class="muster-blatt erscheint"><figcaption><span class="etikett">Positionierung S · Fokus Innovation</span><span class="leise">eigenes Beispiel</span></figcaption>
<dl class="daten">${M.saetze.map(([x, v]) => `<div><dt>${e(x)}</dt><dd>${t(v)}</dd></div>`).join('')}</dl>
<div class="muster-kurz"><div><span class="etikett">In einem Satz</span><p>${e(M.ein_satz)}</p></div><div><span class="etikett">In sieben Wörtern</span><p>${e(M.sieben_woerter)}</p></div><div><span class="etikett">Claim</span><p>${e(M.claim)}</p></div></div></figure></div></section>`;
  };
  const risiko = (pkt = F.risiko.punkte, titel = F.risiko.titel) => `<section class="abschnitt eng" aria-labelledby="risiko-titel"><div class="w"><div class="risiko erscheint"><h2 class="gruppe-titel" id="risiko-titel">${e(titel)}</h2>${punkte(pkt)}</div></div></section>`;
  /** Absicherung für Einmalprodukte (Kevin 31.10.: Freigabe vor dem Bau + Ausstieg) — je Gruppe oder Angebot aus fokus.json. */
  const absicherungVon = (a) => F.absicherung?.[a.id] ?? F.absicherung?.[a.gruppe] ?? null;
  /** Rückwärtsrechnung vom Umsatzziel. Dieselbe Rechnung steht in js/rechner.js; ohne JavaScript zeigt die Seite das Beispiel. */
  // Vertriebsrechner (31.10., Kevin: „2,2 Mio als Umsatzziel … noch besser, mehr Mehrwert“): vom Ziel zurück bis zu den Erstkontakten,
  // dazu offene Angebote, Vertriebszeit und der größte Hebel. DIESELBE Rechnung steht in js/rechner.js (Browser); beide hier gepflegt.
  const VERKAUFSZEIT = 0.4;      // Anteil der Arbeitszeit, den Vertriebler wirklich verkaufen (Salesforce, State of Sales 2026: 40 %)
  const VOLLZEIT_STUNDEN = 40;
  const rueckwaerts = (w) => {
    const abschluesse = Math.ceil(w.ziel / w.auftrag);
    const angebote = Math.ceil(abschluesse / (w.angebotsquote / 100));
    const termine = Math.ceil(angebote / (w.terminquote / 100));
    const kontakte = Math.ceil(termine / (w.kontaktquote / 100));
    const jeWoche = (n) => n / w.wochen;
    const termineMit = (aq, auftrag) => Math.ceil(Math.ceil(Math.ceil(w.ziel / auftrag) / (aq / 100)) / (w.terminquote / 100)) / w.wochen;
    const offen = Math.round(jeWoche(angebote) * w.offen);
    const stunden = jeWoche(termine) * w.stunden;
    return {
      abschluesse, angebote, termine, kontakte,
      kontakteWoche: jeWoche(kontakte), termineWoche: jeWoche(termine), angeboteWoche: jeWoche(angebote), umsatzMonat: w.ziel / 12,
      offen, pipeline: offen * w.auftrag, stunden, vertriebler: stunden / (VOLLZEIT_STUNDEN * VERKAUFSZEIT),
      hebelQuote: Math.max(0, jeWoche(termine) - termineMit(Math.min(100, w.angebotsquote + 7), w.auftrag)), quoteNeu: Math.min(100, w.angebotsquote + 7),
      hebelAuftrag: Math.max(0, jeWoche(termine) - termineMit(w.angebotsquote, w.auftrag * 1.25)),
      kiStunden: jeWoche(termine) * 0.5, // eine halbe Stunde weniger Vor- und Nachbereitung je Termin
    };
  };
  // Ab so vielen Stunden je Termin (mit Vor- und Nachbereitung) zeigt der Rechner den Weg zum Innovations-Check (Kevin 31.10.).
  const KI_AB_STUNDEN = 1.5;
  const RECHNER_START = { ziel: 2200000, auftrag: 8000, kontaktquote: 20, terminquote: 50, angebotsquote: 33, wochen: 45, offen: 4, stunden: 2 };
  const zahlDe = (n, stellen = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
  const rechner = () => {
    const r = rueckwaerts(RECHNER_START);
    const feld = (id, text, einheit, hilfe = '') => `<label class="rechner-feld"><span>${e(text)}${hilfe ? `<small>${e(hilfe)}</small>` : ''}</span><span class="rechner-eingabe"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${zahlDe(RECHNER_START[id])}" data-feld="${id}"><span class="einheit">${e(einheit)}</span></span></label>`;
    const stufe = (id, name, n) => `<g class="trichter-stufe" data-stufe="${id}"><rect class="grund" x="0" y="0" width="100" height="10" rx="2"/><rect class="wert" x="0" y="0" width="${(100 * n / r.kontakte).toFixed(2)}" height="10" rx="2" data-balken="${id}"/></g>`;
    const trichter = [['kontakte', 'Erstkontakte', r.kontakte], ['termine', 'Termine', r.termine], ['angebote', 'Angebote', r.angebote], ['abschluesse', 'Abschlüsse', r.abschluesse]];
    return `<section class="abschnitt" id="rechner" aria-labelledby="rechner-titel"><div class="w">${abKopf({ marke: 'Vertriebsrechner', h2: F.rechner.titel, lead: F.rechner.lead, id: 'rechner-titel' })}
<div class="rechner erscheint" data-rechner>
<div class="rechner-eingaben">
<p class="etikett">Ihr Ziel</p>${feld('ziel', 'Umsatzziel im Jahr', '€')}${feld('auftrag', 'Durchschnittlicher Auftrag', '€')}
<p class="etikett">Ihre Quoten</p>${feld('kontaktquote', 'Erstkontakte, aus denen ein Termin wird', '%')}${feld('terminquote', 'Termine, aus denen ein Angebot wird', '%')}${feld('angebotsquote', 'Angebote, die zum Auftrag werden', '%')}
<p class="etikett">Ihr Alltag</p>${feld('wochen', 'Arbeitswochen im Jahr', 'Wochen')}${feld('offen', 'Bis ein Angebot entschieden ist', 'Wochen')}${feld('stunden', 'Zeit je Termin mit Vor- und Nachbereitung', 'Stunden')}
<div class="rechner-ki" data-ki-hinweis${RECHNER_START.stunden > KI_AB_STUNDEN ? '' : ' hidden'}><p>Viel Zeit für Vor- und Nachbereitung? Protokolle, Angebote und Nachfassen kann KI vorbereiten. Eine halbe Stunde weniger je Termin sind <b data-aus="kiStunden">${zahlDe(r.kiStunden, 1)}</b>&nbsp;Stunden mehr pro Woche fürs Verkaufen.</p>${textlink(check('rechner_ki'), 'Innovations-Check: wo KI bei Ihnen Zeit spart')}</div>
</div>
<div class="rechner-rechts">
<dl class="rechner-ergebnis" aria-live="polite">
<div class="haupt"><dt>Termine je Woche</dt><dd data-aus="termineWoche">${zahlDe(r.termineWoche, 1)}</dd></div>
<div><dt>Erstkontakte je Woche</dt><dd data-aus="kontakteWoche">${zahlDe(r.kontakteWoche, 1)}</dd></div>
<div><dt>Angebote je Woche</dt><dd data-aus="angeboteWoche">${zahlDe(r.angeboteWoche, 1)}</dd></div>
<div><dt>Abschlüsse im Jahr</dt><dd data-aus="abschluesse">${zahlDe(r.abschluesse)}</dd></div>
<div><dt>Umsatz je Monat</dt><dd data-aus="umsatzMonat">${zahlDe(r.umsatzMonat)} €</dd></div>
</dl>
<figure class="trichter" aria-label="Der Weg vom Erstkontakt zum Abschluss, im Jahr"><figcaption class="etikett">Ihr Trichter im Jahr</figcaption>
<ul>${trichter.map(([id, name, n]) => `<li><span class="trichter-name">${e(name)}</span><svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">${stufe(id, name, n).replace(/<g[^>]*>|<\/g>/g, '')}</svg><b data-aus="${id}">${zahlDe(n)}</b></li>`).join('')}</ul></figure>
</div>
<div class="rechner-mehr">
<div class="rechner-karte"><p class="etikett">Offene Angebote</p><p class="karte-zahl"><b data-aus="offen">${zahlDe(r.offen)}</b> <span>Angebote im Wert von <b data-aus="pipeline">${zahlDe(r.pipeline)} €</b> sollten im Schnitt gleichzeitig offen sein.</span></p></div>
<div class="rechner-karte"><p class="etikett">Vertriebszeit</p><p class="karte-zahl"><b data-aus="stunden">${zahlDe(r.stunden, 1)}</b> <span>Stunden je Woche nur für Termine. Bei 40 % Verkaufszeit sind das rund <b data-aus="vertriebler">${zahlDe(r.vertriebler, 1)}</b> Vertriebler in Vollzeit.</span></p><p class="karte-quelle"><a href="${e(Z?.zahlen.find((x) => x.id === 'salesforce-verkaufszeit-2026')?.url ?? '/kostenlos/zahlen/')}" rel="noopener" target="_blank">40 % Verkaufszeit: Salesforce, 2026</a></p></div>
<div class="rechner-karte hebel"><p class="etikett">Ihr größter Hebel</p><p>Schließen Sie <b data-aus="quoteNeu">${zahlDe(r.quoteNeu)} %</b> statt <b data-aus="quoteAlt">${zahlDe(RECHNER_START.angebotsquote)} %</b> der Angebote ab, brauchen Sie <b data-aus="hebelQuote">${zahlDe(r.hebelQuote, 1)}</b> Termine weniger pro Woche.</p><p>Ist Ihr Auftrag im Schnitt ein Viertel größer, sind es <b data-aus="hebelAuftrag">${zahlDe(r.hebelAuftrag, 1)}</b> Termine weniger.</p></div>
</div>
</div>
<p class="satz-unter erscheint">Die Startwerte sind ein Beispiel. Ihre eigenen Quoten kennen Sie nach einigen Wochen mit sauberen Zahlen im CRM. Diesen Takt bauen wir als Head of Sales auf Zeit mit Ihnen auf.</p>
<div class="knoepfe erscheint">${textlink('/vertrieb/head-of-sales/', 'Head of Sales auf Zeit')}${textlink('/wissen/vertrieb-aufbauen/', 'Ratgeber Vertrieb aufbauen')}</div>
</div></section>`;
  };
  const itemListe = (name, eintraege) => ({ '@type': 'ItemList', name, numberOfItems: eintraege.length, itemListElement: eintraege.map(([url, n], i) => ({ '@type': 'ListItem', position: i + 1, url: absolut(url), name: n })) });

  // ── Startseite: der Film (kurz, mit „Überspringen“), dann der Einstieg mit zwei Türen und ruhige Abschnitte auf Papier ──
  {
    const fl = F.film;
    const block = (name, b, extra = '', unter = '') => `<div class="block" data-block="${name}" aria-hidden="true"><div class="film-text"><p class="film-titel">${b.titel.split("|").map((z) => `<span class="zeile" data-woerter>${e(z)}</span>`).join("")}</p><p class="film-satz">${e(b.satz)}</p>${unter}</div>${extra}</div>`;
    /** Ein Bereich der Startseite (31.10.): links Name und Satz, rechts das Problem und „Womit anfangen“ — die Lagen des Wegweisers
     *  dieses Bereichs mit Einstieg und Preis. Ersetzt den eigenen Wegweiser-Abschnitt und die Angebots-Kurzliste (keine Dopplung). */
    const lagenVon = (k) => [...F.wegweiser.markt, ...F.wegweiser.unternehmen].filter((z) => (z.bereich ?? (z.angebot ? angebot(z.angebot).bereich.toLowerCase() : z.gruppe ? 'sichtbarkeit' : 'innovation')) === k);
    const leistung = (k) => {
      const b = B[k];
      return `<article class="leistung" id="bereich-${k}">
<div class="leistung-kopf erscheint">${vorzeile(b.name, b.nr)}<h3 class="paar">${e(b.paar)}</h3><p class="satz">${t(b.satz)}</p>${textlink(`/${k}/`, `Mehr zu ${b.name}`)}</div>
<div class="leistung-weg"><p class="etikett erscheint">Woran es oft hakt</p><p class="problem erscheint">${t(b.problem)}</p>
<p class="etikett erscheint">Womit anfangen</p><ul class="wl erscheint">${lagenVon(k).map(wegZeile).join('')}</ul></div>
</article>`;
    };
    /** Eine Zeile des Wegweisers: Lage links, passender Einstieg rechts (mit Preis „ab“, wo es einen gibt). */
    const wegZeile = (z) => {
      const a = z.angebot ? angebot(z.angebot) : null;
      const gruppe = z.gruppe ? produkteIn('sichtbarkeit').filter((x) => x.gruppe === z.gruppe) : null;
      const [h, n, p, pa] = a ? [produktPfad(a), F.kurznamen[a.id] ?? a.name.replace(/ S, M, L$/, ''), preisKurz(a), a] : gruppe ? [z.ziel, z.name, preisKurz(gruppe[0]), gruppe[0]] : [z.ziel, z.name, z.preis, null];
      return `<li><a href="${h}"><span class="wl-lage">${t(z.lage)}</span><span class="wl-ziel"><b>${e(n)}</b><span>${mkPreis(pa, p)}</span></span>${PFEIL}</a></li>`;
    };
    neu('index.html', {
      seo: 'start',
      bildTitel: F.start.titel,
      bildVorzeile: 'Vertrieb · Sichtbarkeit · Innovation',
      film: true,
      klasse: 'start',
      main: `<section class="film" id="start" aria-label="${e(F.marke.claim)}">
<div class="buehne">
<canvas class="szene" aria-hidden="true"></canvas>
<div class="ersatz" aria-hidden="true">${ZEICHEN('zeichen gross')}</div>
<p class="sr">${[fl.laerm, fl.fokus, fl.luecke, fl.momentum, fl.durchbruch].map((b) => `${e(b.titel.replace(/\|/g, " "))} ${e(b.satz)}`).join(' ')}</p>
<div class="aufgaben" aria-hidden="true">${F.aufgaben.map((x) => `<span class="aufgabe">${e(x)}</span>`).join('')}</div>
${block('laerm', fl.laerm, `<span class="hinweis" aria-hidden="true">Scrollen<span class="hinweis-strich"></span></span>`)}
${block('fokus', fl.fokus)}
${block('luecke', fl.luecke)}
${block('momentum', fl.momentum)}
${block('durchbruch', fl.durchbruch)}
<div class="block" data-block="ende"><div class="ende-marke"><span class="ende-wort" aria-hidden="true">FOKUS</span><span class="ende-unter" aria-hidden="true">Innovation</span><span class="ende-claim" aria-hidden="true">${e(F.marke.claim)}</span><div class="ende-knoepfe dunkel">${erstKnopf()}${passenderKnopf(undefined, 'film_ende')}</div></div></div>
<a class="ueberspringen" href="#einstieg">Film überspringen</a>
</div>
</section>

<section class="held start-held" id="einstieg" aria-labelledby="start-titel"><div class="w held-raster">
<div class="start-titel erscheint">${vorzeile(F.start.vorzeile)}<h1 id="start-titel" class="glanz">${titel(F.start.titel, F.start.ruhig)}</h1></div>
<div class="erscheint"><p class="lead">${t(F.start.lead)}</p>
<div class="knoepfe">${erstKnopf()}${passenderKnopf(undefined, 'start_held')}</div></div>
<nav class="index tueren erscheint" aria-label="Ihr Anliegen">${F.tueren.map((d) => `<a href="${d.pfad ?? `#${d.id}`}"><span class="nr">${e(d.etikett)}</span><b>${e(d.titel)}</b><span class="index-satz">${t(d.text)}</span>${PFEIL}</a>`).join('')}</nav>
</div></section>

<section class="abschnitt" id="bekannt" aria-labelledby="bekannt-titel"><div class="w">
${abKopf({ marke: 'Ihr Alltag', h2: F.bekannt.titel, lead: F.bekannt.lead, id: 'bekannt-titel' })}
${F.bekannt.gruppen ? `<div class="momente-gruppen erscheint">${F.bekannt.gruppen.map((g) => `<div class="momente-gruppe"><h3 class="gruppe-titel">${e(B[g.bereich].name)}</h3><ul class="momente">${g.momente.map((m) => `<li>${t(m)}</li>`).join('')}</ul></div>`).join('')}</div>
${(() => { const zs = F.bekannt.gruppen.map((g) => g.zahl && Z?.zahlen.find((y) => y.id === g.zahl)).filter(Boolean); if (zs.length !== F.bekannt.gruppen.filter((g) => g.zahl).length) throw new Error('Zahl zu den Momenten fehlt in inhalt/zahlen.json'); return zs.length ? `<div class="momente-belege"><p class="etikett erscheint">${e(F.bekannt.belege_titel ?? 'Was Studien zeigen')}</p><div class="momente-belege-raster">${zs.map((z) => zahl({ wert: z.wert, text: z.kurz ?? z.satz, link: z.url, quelle: `${z.quelle}, ${String(z.datum).slice(0, 4)}` })).join('')}</div></div>` : ''; })()}` : `<ul class="momente erscheint">${F.bekannt.momente.map((m) => `<li>${t(m)}</li>`).join('')}</ul>`}
<div class="momente-schluss erscheint"><p>${(([frage, ...rest]) => `<b>${t(frage)}?</b> ${t(rest.join('?').trim())}`)(F.bekannt.schluss.split('?'))}</p>${erstKnopf()}</div>
</div></section>

<section class="abschnitt" id="was-wir-tun" aria-labelledby="leistungen-titel"><div class="w">
${abKopf({ marke: 'Was wir tun', h2: 'Drei Bereiche.', ruhig: 'Und in jedem arbeiten wir selbst mit.', lead: 'Die drei greifen ineinander. Was die Sichtbarkeit an Anfragen bringt, verfolgt der Vertrieb weiter, und KI nimmt Ihrem Team Routinearbeit ab. Bei unseren Events lernen Sie dazu die passenden Leute kennen.', id: 'leistungen-titel' })}
${BEREICHE.map(leistung).join('\n')}
<p class="satz-unter erscheint">Nichts dabei? ${textlink(erstLink(), 'Erzählen Sie uns im Erstgespräch, worum es geht')}</p>
</div></section>

<section class="abschnitt" id="warum-wir" aria-labelledby="warum-titel"><div class="w">
${abKopf({ marke: 'Warum wir', h2: 'Wir sitzen mit in Ihrem Team.', lead: F.warum_lead ?? 'Vier Unterschiede, an denen Sie uns messen können.', id: 'warum-titel' })}
${raster(F.warum_wir.map((w) => ({ titel: w.titel, text: w.text, unter: w.beleg })), 4)}
</div></section>

${fragen(F.einwaende.filter((x) => /Wer arbeitet|Was kostet|Verkaufsgespräch/.test(x.f)), F.einwaende_titel ?? 'Bevor Sie fragen', { id: 'einwaende', marke: F.einwaende_marke ?? 'Fragen', mehr: true })}

<section class="abschnitt" id="events" aria-labelledby="events-titel"><div class="w">
<div class="events-block kompakt">
<div class="events-kopf erscheint">${vorzeile(F.events.titel)}<h2 id="events-titel">${e(F.events.start_ruhig)}</h2></div>
<div class="events-text erscheint"><p class="lead">${t(F.events.start_text ?? F.events.text)}</p>
<div class="knoepfe">${anfrageKnopf('events', F.events.betreff, 'Einladung erhalten')}${textlink('/events/', 'Formate und Termine')}</div><p class="leise klein-text" data-mk="termin-naechster" hidden></p></div>
</div>
</div></section>

<section class="abschnitt" id="wissen" aria-labelledby="wissen-titel"><div class="w">
${abKopf({ marke: 'Wissen', h2: 'Aus unserer Arbeit.', ruhig: 'Zum Nachlesen.', lead: 'Ratgeber zu Vertrieb, Sichtbarkeit und Innovation: wie wir vorgehen, worauf es ankommt, mit Quellen.', id: 'wissen-titel' })}
${wissenListe(W.artikel.slice(0, 3))}
<div class="knoepfe erscheint">${textlink('/kostenlos/#ratgeber', 'Alle Ratgeber')}${textlink('/preise/', 'Alle Preise')}</div>
</div></section>

${schlussakt({ quelle: 'start_ende' })}`,
    });
  }

  // ── Bereichsseiten ──
  for (const k of BEREICHE) {
    const b = B[k];
    const gruppen = gruppenIn(k);
    const klein = kleinerCheck(k);
    const checkZeile = k === 'innovation' ? `<li><a href="/innovations-check/"><span class="z-name">Innovations-Check</span><span class="z-text">In rund 10 Minuten sehen Sie, wo Ihr Unternehmen steht.</span><span class="z-preis">kostenlos</span>${PFEIL}</a></li>`
      : klein ? `<li><a href="${checkThema(k, `${k}_angebote`)}"><span class="z-name">${e(klein.name)}</span><span class="z-text">${e(klein.text)}</span><span class="z-preis">kostenlos · ${klein.minuten} Min.</span>${PFEIL}</a></li>` : '';
    const angeboteHtml = gruppen.map((g, gi) => `<div class="angebot-gruppe" id="${anker(g.name || g.liste[0].name)}">${g.name ? `<h3 class="gruppe-titel">${e(g.name)}</h3>` : ''}
<ul class="zeilen erscheint">${gi === 0 ? checkZeile : ''}${g.liste.map((a) => `<li><a href="${produktPfad(a)}"><span class="z-name">${e(a.name)}${bald(a) ? ' <span class="marke-bald">Bald</span>' : ''}</span><span class="z-text">${t(F.kurztexte[a.id] ?? produktBlatt(a)?.versprechen ?? a.fuer_wen ?? (a.enthalten ?? [])[0] ?? '')}</span><span class="z-preis">${mkPreis(a, preisKurz(a))}</span>${PFEIL}</a></li>`).join('')}</ul></div>`).join('\n');

    const vergleich = k === 'vertrieb' ? (() => {
      const hos = angebot('head-of-sales'), cso = angebot('cso');
      const zeilen = [...hos.enthalten.map((x) => [x, true, true]), ...cso.enthalten.filter((x) => !/^Alles aus/.test(x)).map((x) => [x, false, true])];
      const zelle = (ja, name) => (ja ? `<td class="ja" data-name="${name}"><span class="knoten" aria-hidden="true"></span><span class="sr">enthalten</span></td>` : `<td class="nein" data-name="${name}"><span aria-hidden="true">–</span><span class="sr">nicht enthalten</span></td>`);
      return `<section class="abschnitt" aria-labelledby="vergleich-titel"><div class="w">${abKopf({ marke: 'Vergleich', h2: 'Head of Sales oder CSO?', lead: inhalt.faq.find((f) => f.id === 'was-ist-der-unterschied-zwischen-head')?.a, id: 'vergleich-titel' })}
<div class="tabelle-huelle erscheint"><table class="vergleich haken-tabelle"><thead><tr><th scope="col">Leistung</th><th scope="col">Head of Sales<span class="zahl-klein">${e(preisKurz(hos))}</span></th><th scope="col">CSO<span class="zahl-klein">${e(preisKurz(cso))}</span></th></tr></thead>
<tbody>${zeilen.map(([x, a, c]) => `<tr><th scope="row">${t(x)}</th>${zelle(a, 'Head of Sales')}${zelle(c, 'CSO')}</tr>`).join('')}</tbody></table></div>
<div class="knoepfe">${textlink(produktPfad(hos), 'Head of Sales im Detail')}${textlink(produktPfad(cso), 'CSO im Detail')}</div></div></section>`;
    })() : (blaetter.vergleiche[k] ?? []).length ? `<section class="abschnitt" aria-labelledby="vergleich-titel"><div class="w">${abKopf({ marke: 'Vergleich', h2: 'Was in welchem Angebot steckt', id: 'vergleich-titel' })}
${blaetter.vergleiche[k].map(vergleichTabelle).join('\n')}${netto}</div></section>` : '';

    const eigenes = {
      sichtbarkeit: () => `${arbeitsprobe()}
<section class="abschnitt" aria-labelledby="zusatz-titel"><div class="w">${abKopf({ marke: 'Dazu', h2: 'Zusatzoptionen und Netzwerk', id: 'zusatz-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Dazu buchbar</h3><dl class="daten">${inhalt.zusatzoptionen.map((z) => `<div><dt>${e(z.name)}<span class="leise">${e(z.name === 'Express' ? 'halbe Lieferzeit' : z.leistung)}</span></dt><dd>${e(z.preis)}</dd></div>`).join('')}</dl></div>
<div class="erscheint"><h3 class="gruppe-titel">${e(b.auch.titel)}</h3><p>${t(b.auch.text)}</p><div class="knoepfe">${textlink('/events/', 'Zu den Events')}</div></div></div></div></section>`,
      vertrieb: () => `<section class="abschnitt" aria-labelledby="leiter-titel"><div class="w"><div class="kasten leiter-kasten erscheint"><div>${vorzeile('Für den Mittelstand')}<h2 id="leiter-titel">${e(b.leiter.titel)}</h2></div><div><p class="lead">${t(b.leiter.text)}</p><div class="knoepfe">${textlink(produktPfad(angebot('head-of-sales')), 'Head of Sales auf Zeit')}${textlink(erstLink(), 'Erstgespräch vereinbaren')}</div></div></div></div></section>

${rechner()}

<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'Ablauf', h2: 'So kommen wir zusammen', lead: 'Vom ersten Gespräch bis zum Mandat, jeder Schritt mit klarem Ergebnis.', id: 'ablauf-titel' })}
${weg(b.ablauf, { klasse: 'vier', etiketten: ['01', '02', '03', '04'], label: 'Ablauf bis zum Mandat' })}</div></section>`,
      innovation: () => `<section class="abschnitt" aria-labelledby="felder-titel"><div class="w">${abKopf({ marke: 'Was dazugehört', h2: b.felder_titel ?? 'Innovation ist mehr als KI.', lead: b.felder_lead ?? b.mehr_als_ki, id: 'felder-titel' })}
${raster(b.felder, 4)}
<div class="zwei-teile ueber-zitat"><figure class="zitat erscheint"><blockquote><p>„${e(F.leitidee.zitat.text)}“</p></blockquote><figcaption><b>${e(F.leitidee.zitat.wer)}</b><cite><a href="${e(F.leitidee.zitat.link)}" rel="noopener" target="_blank">${e(F.leitidee.zitat.quelle)}</a></cite></figcaption></figure>
<div class="erscheint">${zahl(F.belege.systeme)}</div></div></div></section>

<section class="abschnitt" aria-labelledby="check-titel"><div class="w">${abKopf({ marke: 'Innovations-Check', h2: start['innovations-check'].titel, lead: F.check.text, id: 'check-titel' })}
<ol class="stufen breit erscheint" aria-label="Die fünf Stufen">${stufen.map((s) => `<li><span class="stufe-balken" aria-hidden="true"></span><b>${e(s.name.replace(/ \(.*\)$/, ''))}</b><span>${e(s.kurz)}</span></li>`).join('')}</ol>
<div class="zwei-teile check-unten"><div class="erscheint">${punkte(seite.check_punkte.punkte)}</div><div class="erscheint"><div class="knoepfe">${checkKnopf('innovation_check')}${textlink('/innovations-check/', 'So funktioniert der Check')}</div></div></div></div></section>

<section class="abschnitt" id="ki-brain" aria-label="KI-Brain"><div class="w">
<div class="kasten brain-kasten erscheint"><div>${vorzeile(b.brain.stand)}<h3>${e(b.brain.titel)}</h3></div><div><p>${t(b.brain.text)}</p><div class="knoepfe">${anfrageKnopf('angebot-ki-brain', b.brain.betreff, 'Interesse anmelden', 'zweit')}</div></div></div>
</div></section>`,
    }[k]();

    const knoepfe = k === 'innovation'
      ? `${erstKnopf()}${checkKnopf(`${k}_held`, 'Innovations-Check starten', 'zweit')}`
      : `${erstKnopf()}${knopf('#angebote', 'Angebote ansehen', 'zweit')}`;

    const liste = produkteIn(k);
    const fuerWen = F.fuer_wen.filter((w) => new RegExp(b.name).test(w.einstieg)).map((w) => w.titel).join(', ');
    neu(`${k}/index.html`, {
      seo: k,
      bildVorzeile: `${b.nr} · ${b.name}`,
      bildTitel: b.held.titel,
      aktiv: k,
      seitenTyp: 'CollectionPage',
      schema: [{ ...itemListe(`Angebote im Bereich ${b.name}`, [...(k === 'innovation' ? [['/innovations-check/', 'Innovations-Check']] : []), ...liste.map((a) => [produktPfad(a), a.name])]), '@id': `${absolut(`/${k}/`)}#angebote` }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[null, b.name]])}${vorzeile(b.name, b.nr)}<h1 id="held-titel" class="glanz">${e(b.held.titel)}</h1><p class="lead">${t(b.held.text)}</p><div class="knoepfe">${knoepfe}</div></div>
<aside class="weg-karte erscheint" aria-label="Der Weg"><p class="etikett">Der Weg mit uns</p>${weg(b.weg, { klasse: 'senkrecht' })}</aside>
</div></section>
${videoAbschnitt(VIDEOS[k])}

<section class="blick-band" aria-label="Kurz gesagt"><div class="w">${kurzGesagt(b.kurz)}
<dl class="blick erscheint">${[['Für wen', fuerWen], ['Einstieg', { vertrieb: `Erstgespräch, kostenlos, oder der Tagesworkshop ab ${erster(angebot('tagesworkshop'))}`, sichtbarkeit: 'Erstgespräch, kostenlos, oder direkt die Positionierung S', innovation: 'Innovations-Check, kostenlos, rund 10 Minuten' }[k]], ['Preise', k === 'innovation' ? 'Check kostenlos, Umsetzungsprojekte zum Festpreis nach Absprache' : 'netto, ab-Preis bei jedem Angebot']].filter(([, v]) => v).map(([x, v]) => `<div><dt>${e(x)}</dt><dd>${t(v)}</dd></div>`).join('')}</dl>
${b.beleg ? `<div class="beleg-zeile">${zahl(F.belege[b.beleg])}</div>` : ''}</div></section>

<section class="abschnitt" id="angebote" aria-labelledby="angebote-titel"><div class="w">${abKopf({ marke: 'Angebote', h2: `${b.name}: was wir für Sie tun`, lead: F.angebote_lead[k], id: 'angebote-titel' })}
${angeboteHtml}
${netto}</div></section>

${vergleich}
${eigenes}
${wissenAbschnitt(artikelZu((a) => a.bereich === k), `Wissen zu ${b.name}`)}
${fragen(zuschneiden(faqVon(seite.bereiche[k].faq), k))}
${schlussakt({ quelle: `${k}_ende`, bereich: k })}`,
    });
  }

  // ── Paket-Gruppen (30.10.): Homepages und Videos je eine Seite, die die Pakete vorstellt — das Menü zeigt nur die Gruppe. ──
  for (const k of BEREICHE) {
    for (const g of gruppenIn(k)) {
      const gs = gruppenSeite(k, g);
      if (!gs) continue;
      const familie = blaetter.produkte[g.liste[0].id]?.familie;
      const fam = familie ? blaetter.familien[familie] : null;
      const vergleiche = (blaetter.vergleiche[k] ?? []).filter((v) => v.angebote.every((id) => g.liste.some((a) => a.id === id)));
      const klein = kleinerCheck(k);
      const gruppenBild = BILD_JE_GRUPPE[`${k}/${gs.pfad}`];
      neu(`${k}/${gs.pfad}/index.html`, {
        titel: gs.seo_titel,
        beschreibung: gs.seo_beschreibung,
        bildVorzeile: B[k].name,
        bildTitel: `${gs.titel} ${gs.ruhig}`,
        aktiv: k,
        main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster${gruppenBild || VIDEOS[`${k}/${gs.pfad}`] ? '' : ' einspaltig'}">
<div class="erscheint">${brotkrumen([[`/${k}/`, B[k].name], [null, gs.name]])}${vorzeile(B[k].name)}<h1 id="held-titel" class="glanz">${titel(gs.titel, gs.ruhig)}</h1><p class="lead">${t(gs.lead)}</p>
<div class="knoepfe">${erstKnopf()}${klein ? textlink(checkThema(k, `${gs.pfad}_held`), `${klein.name}, ${klein.minuten} Minuten`) : ''}</div></div>
${gruppenBild || VIDEOS[`${k}/${gs.pfad}`] ? buehne(gruppenBild, VIDEOS[`${k}/${gs.pfad}`]) : ''}
</div></section>

<section class="abschnitt" aria-labelledby="pakete-titel"><div class="w">${abKopf({ marke: 'Pakete', h2: `${['', 'Ein Paket', 'Zwei Pakete', 'Drei Pakete', 'Vier Pakete'][g.liste.length] ?? `${g.liste.length} Pakete`} für mehr Anfragen.`, lead: 'Wie sich die Pakete unterscheiden, zeigt der Vergleich weiter unten.', id: 'pakete-titel' })}
${angebotZeilen(g.liste)}${netto}</div></section>
${vergleiche.length ? `<section class="abschnitt" aria-labelledby="vergleich-titel"><div class="w">${abKopf({ marke: 'Vergleich', h2: 'Was in welchem Paket steckt', id: 'vergleich-titel' })}
${vergleiche.map(vergleichTabelle).join('\n')}${netto}</div></section>` : ''}
${fam?.immer?.length ? `<section class="abschnitt" aria-labelledby="immer-titel"><div class="w">${abKopf({ marke: 'Immer dabei', h2: 'In jedem Paket enthalten', id: 'immer-titel' })}<div class="erscheint">${punkte(fam.immer)}</div></div></section>` : ''}
${fam?.fragen?.length ? fragen(fam.fragen.filter((x) => !x.nur).map((x) => ({ f: x.frage, a: x.antwort })), `Fragen zu ${gs.name}`) : ''}
${schlussakt({ quelle: `${gs.pfad}_ende`, bereich: k })}`,
      });
    }
  }

  // ── Produktseiten ──
  for (const a of inhalt.angebote) {
    const k = a.bereich.toLowerCase();
    const b = B[k];
    const pb = produktBlatt(a);
    const istBald = bald(a);
    const terminKnopf = istBald ? anfrageKnopf(`angebot-${a.id}`, `Anfrage: ${a.name}`, 'Anfrage starten') : erstKnopf();
    const mandat = monatlich(a) && k === 'vertrieb';
    const zweitKnopf = k === 'innovation' ? checkKnopf(`produkt_${a.id}`, 'Innovations-Check starten', 'zweit') : knopf('#fragen', 'Häufige Fragen', 'zweit');
    const homepage = a.gruppe === 'Homepage-Pakete';
    const groesstes = homepage && produkteIn(k).filter((x) => x.gruppe === a.gruppe).at(-1)?.id === a.id;
    const zusatz = homepage ? inhalt.zusatzoptionen.filter((z) => /Homepage/.test(z.fuer) && !(groesstes && z.name === 'Upgrade')) : [];
    const zusatzPreis = (z) => { for (const m of String(z.preis).matchAll(/([+\d.,]+ €) bei ([^,]+)/g)) if (m[2].split(/ und /).some((n) => a.name.endsWith(n.trim()))) return m[1]; return z.preis; };
    const geschwister = a.gruppe ? produkteIn(k).filter((x) => x.gruppe === a.gruppe && x.id !== a.id) : [];
    const weitere = geschwister.length ? geschwister : produkteIn(k).filter((x) => x.id !== a.id);
    const nichtEnthalten = pb?.nicht_enthalten ?? a.nicht_enthalten;
    const fragenListe = zuschneiden(pb ? [...pb.fragen.filter((f) => !/Kundenstimmen-Videos/.test(f.frage)).map((f) => ({ f: f.frage, a: f.antwort })), ...faqVon(['sind-die-preise-netto'])] : faqVon(seite.produkt_faq[a.id] ?? []), k);
    const regeln = [...(a.regeln ?? []), inhalt.konditionen[0]];
    const abs = absicherungVon(a);
    const datenTabelle = (zeilen) => `<dl class="daten">${zeilen.map(([x, v]) => `<div><dt>${e(x)}</dt><dd>${t(v)}</dd></div>`).join('')}</dl>`;

    const blattHtml = pb ? `<section class="abschnitt" aria-labelledby="lage-titel"><div class="w">${abKopf({ marke: 'Ausgangslage', h2: 'Woran es heute hakt', lead: pb.problem, id: 'lage-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Für wen</h3>${punkte(pb.fuer)}</div><div class="erscheint"><h3 class="gruppe-titel">Nicht für</h3><p>${t(pb.nicht_fuer)}</p></div></div></div></section>

<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'Ablauf', h2: 'So läuft es', id: 'ablauf-titel' })}
<div class="zwei-teile"><div class="erscheint">${zeitplan(pb.ablauf)}</div>
${pb.ergebnis ? `<div class="kasten ergebnis-kasten erscheint"><p class="vorzeile">Ergebnis</p><h3>Woran Sie den Erfolg sehen</h3>${punkte(pb.ergebnis)}${pb.ergebnis_hinweis ? `<p class="leise klein-text">${t(pb.ergebnis_hinweis)}</p>` : ''}</div>` : ''}</div></div></section>

<section class="abschnitt" aria-labelledby="leistung-titel"><div class="w">
${pb.bausteine ? `${abKopf({ marke: 'Leistung', h2: 'Was Sie bekommen', lead: pb.loesung, id: 'leistung-titel' })}<div class="bausteine erscheint">${pb.bausteine.map((x) => `<div class="baustein"><h3>${e(x.name)}</h3>${x.hinweis ? `<span class="etikett">${e(x.hinweis)}</span>` : ''}<p>${t(x.text)}</p></div>`).join('')}</div>${pb.bausteine_satz ? `<p class="satz-unter">${t(pb.bausteine_satz)}</p>` : ''}${a.id === 'cso' ? `<p class="satz-unter">${textlink(produktPfad(angebot('head-of-sales')), 'Was im Head of Sales steckt')}</p>` : ''}`
    : `${abKopf({ marke: 'Leistung', h2: 'Was Sie bekommen', id: 'leistung-titel' })}<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Das Paket</h3>${datenTabelle(pb.eckdaten)}</div><div class="erscheint"><h3 class="gruppe-titel">Immer enthalten</h3>${punkte(pb.immer)}</div></div>`}
</div></section>
${pb.katalog ? `<section class="abschnitt" aria-labelledby="katalog-titel"><div class="w">${abKopf({ marke: 'Videokatalog', h2: 'Sie wählen aus festen Formaten', lead: String(pb.katalog_hinweis ?? '').replace(/„Später“[^.]*\.\s*/g, '').trim() || null, id: 'katalog-titel' })}<div class="katalog n${pb.katalog.length} erscheint">${pb.katalog.map((g) => { const formate = g.formate.filter((f) => !/\(später\)$/.test(f)); return `<div><h3 class="gruppe-titel">${e(g.titel.replace(/^\d+/, String(formate.length)))}</h3><ul class="formate">${formate.map((f) => `<li>${e(f)}</li>`).join('')}</ul></div>`; }).join('')}</div></div></section>` : ''}

<section class="abschnitt" aria-labelledby="konditionen-titel"><div class="w">${abKopf({ marke: 'Konditionen', h2: 'Preis und Konditionen', id: 'konditionen-titel' })}
<div class="zwei-teile"><div class="erscheint">${datenTabelle([...pb.konditionen, ...(abs?.kondition && !pb.konditionen.some(([x]) => x === 'Ihr Risiko') ? [['Ausstieg', abs.kondition]] : [])])}${netto}</div>
<div class="erscheint"><h3 class="gruppe-titel">Was wir von Ihnen brauchen</h3>${punkte(pb.mitwirkung)}${nichtEnthalten ? `<h3 class="gruppe-titel">Nicht enthalten</h3>${punkte(nichtEnthalten, 'punkte nicht')}` : ''}${pb.abgrenzung ? `<h3 class="gruppe-titel">Abgrenzung</h3><p class="leise">${t(pb.abgrenzung)}</p>` : ''}</div></div></div></section>`
      : `<section class="abschnitt" aria-labelledby="inhalt-titel"><div class="w">${abKopf({ marke: 'Leistung', h2: 'Was drin ist', lead: a.fuer_wen, id: 'inhalt-titel' })}
${a.stufen ? `<div class="raster n3 erscheint">${a.stufen.map((s) => `<div class="spalte"><span class="etikett">Workshop: ${e(s.workshop)}</span><h3>Positionierung ${e(s.name)}</h3><p class="stufe-preis">ab ${e(s.preis.replace(/^ab /, ''))}</p><p>${t(s.ergebnis)}</p></div>`).join('')}</div>${netto}` : ''}
<div class="zwei-teile">${a.enthalten ? `<div class="erscheint"><h3 class="gruppe-titel">Enthalten</h3>${punkte(a.enthalten)}</div>` : ''}
<div class="erscheint">${nichtEnthalten ? `<h3 class="gruppe-titel">Nicht enthalten</h3>${punkte(nichtEnthalten, 'punkte nicht')}` : ''}<h3 class="gruppe-titel">Gut zu wissen</h3>${punkte(regeln)}</div></div>
</div></section>`;

    const zuArtikeln = artikelZu((x) => x.angebote.includes(a.id));
    // Ergebnis in einem Satz: bei Paketen (Websites, Videos) das Versprechen des Pakets, sonst das erste Ergebnis des Produktblatts.
    const ergebnisSatz = pb?.familie ? pb.versprechen : pb?.ergebnis?.[0] ?? (a.stufen ? 'Ihre Positionierung in Sätzen, die Ihr Team und Ihre Website sofort verwenden können.' : (a.enthalten ?? [])[0]);
    const leadText = F.kurztexte[a.id] ?? pb?.versprechen ?? a.fuer_wen ?? b.satz;
    // Gesamtcheck 31.10.: die Zeile „Ergebnis“ nur, wenn sie etwas Neues sagt — nicht den Lead wörtlich, nicht einen Punkt, der unten ohnehin steht.
    const ergebnisZeile = ergebnisSatz && klar(ergebnisSatz) !== klar(leadText) && !(pb?.ergebnis ?? []).includes(ergebnisSatz) ? ergebnisSatz : null;
    neu(`${k}/${a.id}/index.html`, {
      seo: a.id,
      bildVorzeile: `${b.name}${a.gruppe && a.gruppe !== a.name ? ` · ${a.gruppe}` : ''}`,
      bildTitel: a.name,
      aktiv: k,
      seitenTyp: 'ItemPage',
      schema: [{
        '@type': 'Service', '@id': `${absolut(produktPfad(a))}#leistung`, name: a.name, serviceType: b.name, category: b.name,
        description: klar(F.kurztexte[a.id] ?? pb?.versprechen ?? a.fuer_wen ?? ''), provider: { '@id': ORG }, areaServed: organisation.areaServed,
        audience: { '@type': 'BusinessAudience', audienceType: klar((pb?.fuer ?? [a.fuer_wen]).filter(Boolean).join('; ')) },
        url: absolut(produktPfad(a)), ...(istBald ? {} : { offers: angebotDaten(a) }),
        ...(zuArtikeln.length ? { subjectOf: zuArtikeln.map((x) => ({ '@type': 'Article', name: x.titel, url: absolut(artikelPfad(x)) })) } : {}),
      }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[`/${k}/`, b.name], [null, a.name]])}${vorzeile(`${b.name}${a.gruppe ? ` · ${a.gruppe}` : ''}${istBald ? ' · Bald' : ''}`)}<h1 id="held-titel" class="glanz">${e(F.titel_h1?.[a.id] ?? a.name)}</h1><p class="lead">${t(leadText)}</p></div>
<aside class="preis-kasten erscheint" aria-label="Preis"><p class="etikett">Preis</p><p class="betrag glanz">${mkPreis(a, preisVoll(a))}</p><p class="zusatz">${istBald ? 'Haben Sie ein Vorhaben? Melden Sie sich, wir sprechen darüber' : `${e(a.preis_zusatz ?? '')}${a.preis_zusatz ? ' · ' : ''}netto zuzüglich Umsatzsteuer`}</p>${F.umfang[a.id] ? `<p class="umfang">${e(F.umfang[a.id])}</p>` : ''}<div class="knoepfe senkrecht">${terminKnopf}${zweitKnopf}</div></aside>
</div></section>
${blick([['Für wen', pb?.fuer ? null : a.fuer_wen], ['Ergebnis', ergebnisZeile], ['Umfang', F.umfang[a.id]], ...(istBald ? [['Start', 'in Kürze, Anfrage schon jetzt möglich']] : [])])}
${mandat ? risiko() : abs ? risiko(abs.punkte, F.risiko.titel_absicherung) : ''}
${blattHtml}
${a.id === 'positionierung' ? musterPositionierung() : ''}
${a.gruppe === 'Homepage-Pakete' ? arbeitsprobe() : ''}
${zusatz.length ? `<section class="abschnitt" aria-labelledby="zusatz-titel"><div class="w">${abKopf({ marke: 'Zusatzoptionen', h2: 'Dazu buchbar', id: 'zusatz-titel' })}<dl class="daten erscheint">${zusatz.map((z) => `<div><dt>${e(z.name)}<span class="leise">${e(z.name === 'Express' && a.id !== 'homepage-landing' ? 'halbe Lieferzeit' : z.leistung)}</span></dt><dd>${e(zusatzPreis(z))}</dd></div>`).join('')}</dl></div></section>` : ''}
${fragen(fragenListe)}
${weitere.length ? `<section class="abschnitt" aria-labelledby="weitere-titel"><div class="w">${abKopf({ marke: geschwister.length ? a.gruppe : b.name, h2: geschwister.length ? `Die anderen ${a.gruppe}` : `Weitere Angebote im Bereich ${b.name}`, id: 'weitere-titel' })}
${angebotZeilen(weitere)}</div></section>` : ''}
${wissenAbschnitt(zuArtikeln)}
${schlussakt({ quelle: `produkt_${a.id}_ende`, bereich: k, ablauf: false, lead: istBald ? `Haben Sie ein Vorhaben? Melden Sie sich trotzdem, wir sprechen darüber. ${passenderCheck(k).satz}` : `Sprechen Sie mit uns über Ihren Start: Im kostenlosen Erstgespräch, 30 Minuten per Video, klären wir, ob dieses Angebot passt. ${passenderCheck(k).satz}`, knoepfe: `${terminKnopf}${passenderKnopf(k, `produkt_${a.id}_ende`)}` })}`,
    });
  }

  // ── Innovations-Check (die Seite davor; der Check selbst läuft in der eigenen Anwendung unter /check) ──
  {
    const c = start['innovations-check'];
    const a1 = katalog.abschnitte.flatMap((x) => x.fragen).find((f) => f.id === 'A1');
    neu('innovations-check/index.html', {
      seo: 'innovations-check',
      bildVorzeile: 'Kostenlos · 10 oder 25 Minuten',
      bildTitel: 'Innovations-Check: Wo steht Ihr Unternehmen?',
      aktiv: 'innovation',
      schema: [{ '@type': 'Service', '@id': `${absolut('/innovations-check/')}#leistung`, name: 'Innovations-Check', serviceType: 'Innovation', description: klar(F.check.text), provider: { '@id': ORG }, areaServed: organisation.areaServed, url: absolut('/innovations-check/'), offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: absolut('/innovations-check/') } }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([['/innovation/', 'Innovation'], [null, 'Innovations-Check']])}${vorzeile('Kostenlos · 10 oder 25 Minuten · Ergebnis sofort')}<h1 id="held-titel" class="glanz">${e(c.titel)}</h1><p class="lead">${t(F.check.text)}</p><div class="knoepfe">${checkKnopf('check_seite_held')}</div></div>
<figure class="frage-karte erscheint" aria-label="Beispiel: die erste Frage des Checks"><figcaption><span class="etikett">So sieht eine Frage aus</span><span class="leise">Frage 1 von ${katalog.anzahl_kurzcheck}</span></figcaption><p class="frage">${e(a1.text)}</p><ul class="optionen" aria-hidden="true">${a1.optionen.slice(0, 4).map((o) => `<li>${e(o.text)}</li>`).join('')}</ul><p class="leise klein-text">Zoe, unsere KI-Assistentin, führt durch die Fragen. Sie stellt sie mit festen Texten.</p></figure>
</div></section>
${videoAbschnitt(VIDEOS['innovations-check'])}

<section class="abschnitt" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'So läuft es', h2: 'In drei Schritten zu Ihren Top 3', id: 'ablauf-titel' })}
${weg(F.check_einstieg, { etiketten: ['01', '02', '03'], label: 'Der Check in drei Schritten' })}</div></section>

<section class="abschnitt" aria-labelledby="stufen-titel"><div class="w">${abKopf({ marke: 'Fünf Stufen', h2: 'Wo steht Ihr Unternehmen?', lead: 'Der Check misst Strategie, KI im Alltag, Abläufe, Daten und Team, vergleicht Sie mit Ihrer Branche und nennt für die zwei größten Lücken den nächsten Schritt.', id: 'stufen-titel' })}
<ol class="stufen breit erscheint" aria-label="Die fünf Stufen">${stufen.map((s) => `<li><span class="stufe-balken" aria-hidden="true"></span><b>${e(s.name.replace(/ \(.*\)$/, ''))}</b><span>${e(s.kurz)}</span></li>`).join('')}</ol></div></section>

<section class="abschnitt" aria-labelledby="gespraech-titel"><div class="w">${abKopf({ marke: 'Nach dem Check', h2: start.gespraech.titel, lead: start.gespraech.text, id: 'gespraech-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Was Sie bekommen</h3>${punkte(seite.check_punkte.punkte)}</div>
<div class="erscheint"><h3 class="gruppe-titel">Ihre Daten</h3>${punkte(['Ihre Antworten liegen auf unserem eigenen Server in Deutschland.', 'Zoe stellt die Fragen mit festen Texten. Ihre Antworten gehen an kein KI-Modell.', 'Kontaktdaten geben Sie nur an, wenn Sie Ihren Bericht oder ein Gespräch wollen.', 'Ohne Kontaktdaten löschen wir die Antworten nach 30 Tagen.'])}<p class="leise klein-text">${t(start.gespraech.regel)}</p></div></div></div></section>

${fragen(faqVon(seite.check_faq))}
${schlussakt({ quelle: 'check_seite_ende', h2: 'Bereit?', lead: 'Kurz in rund 10 Minuten oder ausführlich in rund 25: Danach wissen Sie, wo Ihr Unternehmen steht.', knoepfe: `${checkKnopf('check_seite_ende')}${erstKnopf('zweit', 'Lieber direkt sprechen')}`, stufen: F.check_einstieg })}`,
    });
  }

  // ── Events (bis 30.10. „Abend“; Caddy leitet /abend/ hierher um) ──
  neu('events/index.html', {
    seo: 'events',
    bildVorzeile: F.events.titel,
    bildTitel: F.events.satz,
    aktiv: 'events',
    main: `<section class="held sand" aria-labelledby="held-titel"><div class="w held-raster mitte">
<div class="erscheint">${brotkrumen([[null, 'Events']])}${vorzeile(F.events.titel)}<h1 id="held-titel" class="glanz">${titel(F.events.start_titel[0], F.events.start_titel.slice(1).join('|'))}</h1><p class="lead" data-mk="text:events.einleitung">${t(F.events.held_text ?? F.events.text)}</p>
<div class="knoepfe">${anfrageKnopf('events', F.events.betreff, 'Einladung erhalten')}</div><p class="leise klein-text">${e(F.events.kosten)} · <span data-mk="termin-naechster">Termine folgen</span></p></div>
<div class="events-tafel">${tafel()}<p class="etikett">Formate</p><ul class="felder-liste erscheint">${F.events.formate.map((f) => `<li>${e(f.titel)}</li>`).join('')}</ul></div>
</div></section>

<section class="abschnitt" aria-labelledby="formate-titel"><div class="w">${abKopf({ marke: 'Formate', h2: 'So kommen wir zusammen.', lead: F.events.formate_hinweis, id: 'formate-titel' })}
${raster(F.events.formate, Math.min(4, F.events.formate.length))}</div></section>

<section class="abschnitt" aria-labelledby="art-titel"><div class="w">${abKopf({ marke: 'So sind unsere Events', h2: `${F.events.merkmale.map((m, i) => (i ? m.titel.toLowerCase() : m.titel)).join(', ').replace(/, ([^,]+)$/, ' und $1')}.`, id: 'art-titel' })}
${raster(F.events.merkmale, 3)}</div></section>

<section class="abschnitt" aria-labelledby="gast-titel"><div class="w">${abKopf({ marke: 'Gastgeberin', h2: 'Malin bringt Menschen zusammen.', lead: F.team.find((p) => p.kuerzel === 'MA').text, id: 'gast-titel' })}
<div class="zwei-teile"><div class="erscheint"><h3 class="gruppe-titel">Warum wir Events machen</h3><p>${t(F.events.warum)}</p></div>
<div class="erscheint"><h3 class="gruppe-titel">Termine</h3><ul class="termine-liste" data-mk="events" hidden></ul><p data-mk="text:events.termine">${t(F.events.termine)}</p><div class="knoepfe">${anfrageKnopf('events', F.events.betreff, 'Einladung erhalten', 'zweit')}</div></div></div></div></section>

${schlussakt({ quelle: 'events_ende' })}`,
  });

  // ── Über uns ──
  neu('ueber-uns/index.html', {
    seo: 'ueber-uns',
    bildVorzeile: 'Über uns',
    bildTitel: F.leitidee.titel,
    aktiv: 'ueber-uns',
    seitenTyp: 'AboutPage',
    main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[null, 'Über uns']])}${vorzeile('Über uns')}<h1 id="held-titel" class="glanz">${e(F.leitidee.titel)}</h1><p class="lead">${t(F.leitidee.lead)}</p></div>
${buehne('netzwerk', VIDEOS['ueber-uns'])}
</div></section>

${blick([...F.fakten, ['Betreiber', anbieter.name], ['Kontakt', seite.kontakt.mail]], 'Fokus Innovation auf einen Blick')}

<section class="abschnitt" aria-labelledby="ursprung-titel"><div class="w">${abKopf({ marke: 'Warum es uns gibt', h2: 'Vier Erfahrungen,', ruhig: 'die uns hierher gebracht haben.', lead: F.leitidee.absaetze.join(' '), id: 'ursprung-titel' })}
${raster(F.leitidee.ursprung, 4)}
<div class="beleg-zeile">${zahl(F.belege.mittelstand)}</div></div></section>

<section class="abschnitt" aria-labelledby="wen-titel"><div class="w">${abKopf({ marke: 'Für wen', h2: 'Für Menschen, die umsetzen statt reden.', lead: 'Manche wollen ein neues Produkt in den Markt bringen, andere Neues im eigenen Unternehmen einführen. Wir helfen bei beidem.', id: 'wen-titel' })}
${raster(F.fuer_wen.map((w) => ({ etikett: w.richtung, titel: w.titel, text: w.text, unter: `Einstieg: ${w.einstieg}`, nr: false })), 3)}
</div></section>

<section class="abschnitt" aria-labelledby="team-titel"><div class="w">${abKopf({ marke: 'Team', h2: 'Ein Team.', ruhig: 'Alle Fachleute an Bord.', lead: 'Kevin verantwortet Vertrieb und Umsetzung, Malin Bühne und Netzwerk. Im Team sind die Fachleute für Film, Design, Entwicklung, PR, Daten und Leadgenerierung. Sie haben eine Ansprechperson.', id: 'team-titel' })}
<div class="team erscheint">${F.team.map((p) => `<article class="person" id="${personAnker(p)}"><span class="kuerzel mono">${MONOGRAMM(p.kuerzel)}</span><div><p class="etikett">${e(p.rolle)}</p><h3>${e(p.name)}</h3><p>${t(p.text)}</p></div></article>`).join('')}${F.team_netzwerk ? `<article class="person person-netzwerk"><span class="kuerzel" aria-hidden="true">${ZEICHEN()}</span><div><p class="etikett">${e(F.team_netzwerk.rolle)}</p><h3>${e(F.team_netzwerk.titel)}</h3><p>${t(F.team_netzwerk.text)}</p><ul class="felder-liste">${F.team_netzwerk.felder.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div></article>` : ''}</div></div></section>

<section class="abschnitt" aria-labelledby="werte-titel"><div class="w">${abKopf({ marke: 'Werte', h2: 'Woran man uns erkennt.', lead: 'Drei Werte, an denen Sie uns messen können.', id: 'werte-titel' })}
${raster(F.werte, 3)}
<div class="zwei-teile werte-unten erscheint"><div><h3 class="gruppe-titel">So arbeiten wir</h3><dl class="daten">${F.arbeitsweise.map((x) => `<div><dt>${e(x.titel)}</dt><dd>${t(x.text)}</dd></div>`).join('')}</dl></div>
<div><h3 class="gruppe-titel">Grundregel</h3><p class="grundregel">${t(F.grundregel)}</p></div></div></div></section>

<section class="abschnitt" aria-labelledby="nicht-titel"><div class="w">${abKopf({ marke: 'Abgrenzung', h2: 'Was wir nicht sind.', id: 'nicht-titel' })}
${raster(F.nicht.map((x) => ({ ...x, nr: false })), 4)}</div></section>

<section class="abschnitt" aria-labelledby="belege-titel"><div class="w">${abKopf({ marke: F.laufbahn.marke, h2: F.laufbahn.h2, id: 'belege-titel' })}
${raster(F.laufbahn.punkte, F.laufbahn.punkte.length)}</div></section>

${schlussakt({ quelle: 'ueber_uns_ende' })}`,
  });

  // ── Kontakt ──
  {
    const k = seite.kontakt;
    neu('kontakt/index.html', {
      seo: 'kontakt',
      bildVorzeile: 'Kontakt',
      bildTitel: 'Sprechen Sie mit uns.',
      aktiv: 'kontakt',
      seitenTyp: 'ContactPage',
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([[null, 'Kontakt']])}${vorzeile('Kontakt')}<h1 id="held-titel" class="glanz">Sprechen Sie mit uns.</h1><p class="lead">In einem kostenlosen Erstgespräch von 30 Minuten per Video klären wir, ob und womit wir helfen können. Oder Sie starten mit einem unserer Checks und sehen das Ergebnis sofort.</p>
<div class="knoepfe">${erstKnopf()}${passenderKnopf(undefined, 'kontakt')}</div></div>
</div></section>
<section class="abschnitt" aria-labelledby="weiter-titel"><div class="w">${abKopf({ marke: 'So geht es weiter', h2: 'Drei Schritte bis zum Start.', id: 'weiter-titel' })}
${weg(F.einstieg, { etiketten: ['01', '02', '03'], label: 'Drei Schritte bis zum Start' })}</div></section>
<section class="abschnitt" aria-label="Kontaktdaten"><div class="w"><div class="kontakt-liste erscheint">
<div><p class="etikett">Nachricht</p><a class="gross-link" ${anfrageAttr('kontakt', 'Anfrage')}>Nachricht schreiben</a><p class="leise klein-text">Oder per E-Mail an <a class="unterstrichen" href="mailto:${e(k.mail)}">${e(k.mail)}</a></p></div>
<div><p class="etikett">Adresse</p><address>${e(F.marke.name)}<br>${e(anbieter.name)}<br>${k.adresse.map(t).join('<br>')}</address><p class="leise klein-text">${e(F.marke.name)} ist eine Marke der ${e(anbieter.name)}.</p></div>
<div><p class="etikett">Events</p><p>Für die nächste Einladung genügt eine kurze Nachricht.</p>${anfrageTextlink('events', F.events.betreff, 'Einladung erhalten')}</div>
</div></div></section>`,
    });
  }

  // ── Rechtliches (Sie-Form; Hinweis, keine Rechtsberatung — vor dem Start anwaltlich prüfen) ──
  const vp = seite.vertragspartner;
  const anschrift = `<address>${e(anbieter.name)}<br>${anbieter.adresse.map(t).join('<br>')}</address>`;
  const recht = (titelText, inhaltHtml) => `<section class="held klein" aria-labelledby="held-titel"><div class="w">${brotkrumen([[null, titelText]])}${vorzeile('Rechtliches')}<h1 id="held-titel" class="glanz">${e(titelText)}</h1></div></section>
<section class="abschnitt"><div class="w"><div class="recht">${inhaltHtml}<p class="leise">Stand: Oktober 2026</p></div></div></section>`;
  neu('impressum/index.html', {
    seo: 'impressum',
    main: recht('Impressum', `<h2>Angaben gemäß § 5 DDG</h2>${anschrift}
<h2>Vertreten durch</h2><p>${t(anbieter.vertreten)}</p>
<h2>Kontakt</h2><p>E-Mail: <a class="unterstrichen" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a></p>
<h2>Registereintrag</h2><p>${t(anbieter.register)}</p>
${anbieter.ustid ? `<h2>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG</h2><p>${t(anbieter.ustid)}</p>` : ''}
${vp?.name ? `<h2>Vertragspartner für unsere Leistungen</h2><p>Verträge über die angebotenen Leistungen schließt derzeit:</p><address>${e(vp.name)}<br>${vp.adresse.map(t).join('<br>')}</address>${vp.ustid ? `<p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${t(vp.ustid)}</p>` : ''}` : ''}
${BS_LISTE.length && verkaeuferEigen ? `<h2 id="bausteine">Verkäufer der Bausteine</h2><p>Die <a class="unterstrichen" href="/bausteine/">Bausteine</a> verkauft und berechnet:</p><address>${wort(verkaeufer.name)}<br>${verkaeufer.adresse.map(wort).join('<br>')}</address><p>Vertreten durch ${wort(verkaeufer.vertreten)}</p><p>Registereintrag: ${wort(verkaeufer.register)}</p>${verkaeufer.ustid ? `<p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${wort(verkaeufer.ustid)}</p>` : ''}` : ''}
<h2>Verantwortlich nach § 18 Abs. 2 MStV</h2><p>${t(anbieter.vertreten)}, Anschrift wie oben</p>
<h2>Verbraucherstreitbeilegung</h2><p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Unsere Angebote richten sich an Unternehmen.</p>`),
  });
  neu('datenschutz/index.html', {
    seo: 'datenschutz',
    main: recht('Datenschutz', `<h2>Kurz gesagt</h2><p>Diese Website setzt keine Cookies und nutzt kein Tracking, keine Analyse und keine Werbung. Sie lädt nur Dateien von unserem eigenen Server: Schriften, Bilder, Stile und kleine Skripte liegen hier, nichts kommt von fremden Diensten. Persönliche Daten verarbeiten wir nur, wenn es technisch nötig ist, um die Seite auszuliefern, und wenn Sie selbst etwas tun: einen unserer Checks machen, eine Vorlage anfordern, ein Gespräch buchen, den Newsletter bestellen oder uns schreiben.</p>
<h2>Verantwortlich</h2>${anschrift}<p>vertreten durch ${t(anbieter.vertreten)}. Für alle Fragen zum Datenschutz: <a class="unterstrichen" href="mailto:${e(seite.kontakt.mail)}">${e(seite.kontakt.mail)}</a>.</p>
<h2>Hosting</h2><p>Die Website liegt auf einem Server der Hetzner Online GmbH (Industriestr. 25, 91710 Gunzenhausen) in einem Rechenzentrum in Deutschland. Auf demselben Server läuft unsere eigene Anwendung für die Checks, die Vorlagen per E-Mail, die Terminbuchung, das Kontaktformular und die Newsletter-Anmeldung. Hetzner verarbeitet die Daten nur in unserem Auftrag (Art. 28 DSGVO).</p>
<h2>Aufruf der Seite</h2><p>Wenn Sie die Seite öffnen, schickt Ihr Browser technisch bedingt Ihre IP-Adresse, den Zeitpunkt, die aufgerufene Adresse und eine Browser-Kennung an unseren Server. Wir brauchen diese Angaben, um die Seite verschlüsselt (HTTPS) auszuliefern und den Server sicher zu betreiben. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren, funktionierenden Angebot (Art. 6 Abs. 1 lit. f DSGVO). Unser Webserver führt kein Zugriffsprotokoll. Technische Fehlermeldungen können eine IP-Adresse enthalten; sie bleiben auf dem Server, werden nicht ausgewertet und rollierend überschrieben.</p>
<h2>Cookies und Speicher im Browser</h2><p>Die Website selbst setzt keine Cookies und legt nichts im Speicher Ihres Browsers ab. Kleine Skripte zeigen Abschnitte beim Scrollen an, spielen auf der Startseite eine Animation ab, rechnen den Vertriebsrechner und schließen auf dem Handy das Menü; sie lesen nichts aus und speichern nichts. Gesendet wird nur in zwei Fällen: Fordern Sie eine Vorlage an, schickt das Formular Ihre Angaben an unsere Anwendung (siehe Vorlagen). Und einige Seiten fragen unsere Anwendung, ob das Kontaktformular oder die Newsletter-Anmeldung gerade eingeschaltet ist, um den Link nur dann zu zeigen; dabei gehen keine persönlichen Angaben mit, nur die technischen Angaben jedes Seitenaufrufs. Was die Checks im Speicher Ihres Browsers ablegen, steht im Abschnitt zu den Checks.</p>
<h2>Links zu Quellen</h2><p>Bei Zahlen nennen wir die Quelle und verlinken sie. Erst wenn Sie einen solchen Link anklicken, öffnet Ihr Browser die Seite des jeweiligen Anbieters; dafür gilt dessen Datenschutzhinweis.</p>
<h2 id="vorlagen">Vorlagen</h2><p>Kurze Vorlagen laden Sie ohne Anmeldung direkt von unserem Server. Dabei fallen nur die technischen Angaben an, die beim Aufruf jeder Seite entstehen (siehe oben).</p><p>Ausführliche Arbeitshefte schicken wir Ihnen per E-Mail. Dafür geben Sie Ihren Vornamen, Ihre E-Mail-Adresse und, wenn Sie möchten, Ihre Firma an. Wir verwenden die Angaben, um Ihnen den Link zum Herunterladen zu schicken (er gilt 7 Tage), und legen Ihre Anfrage in unserem Kundensystem an, damit wir Ihnen bei Fragen weiterhelfen können (Art. 6 Abs. 1 lit. b DSGVO, Anfrage vor einem möglichen Vertrag). Der Link enthält keine persönlichen Angaben. Werbung schicken wir Ihnen nur, wenn Sie den Newsletter ankreuzen und bestätigen (siehe Newsletter). Anfragen ohne weiteren Kontakt löschen wir spätestens 24 Monate nach dem letzten Kontakt. Die Mail verschicken wir über unser Postfach bei Google Workspace (siehe unten).</p>
${BS_LISTE.length ? `<h2 id="bausteine">Bausteine bestellen</h2><p>Bestellen Sie einen Baustein, läuft die Bestellung über unsere eigene Anwendung.${verkaeufer ? ` Verkäufer und für Ihre Bestellung verantwortlich ist die ${wort(verkaeufer.name)}${verkaeuferEigen ? ' (Anschrift im <a class="unterstrichen" href="/impressum/#bausteine">Impressum</a>)' : ''}.` : ''} Wir verarbeiten Vor- und Nachname, Firma, Rechnungsanschrift und E-Mail-Adresse, wenn Sie möchten auch USt-IdNr. und Telefonnummer, um die Bestellung zu bearbeiten, die Rechnung zu stellen und Ihnen den Download-Link zu schicken (Art. 6 Abs. 1 lit. b DSGVO, Vertrag). Dafür legen wir die Bestellung in unserem Kundensystem an. Die Eingangsbestätigung, die Rechnung und den Link schicken wir über unser Postfach bei Google Workspace (siehe unten). Der Link enthält keine persönlichen Angaben und gilt 30 Tage. Rechnungen und die Angaben darauf bewahren wir so lange auf, wie das Steuer- und Handelsrecht es verlangt (bis zu zehn Jahre); alles Übrige löschen wir, wenn es nicht mehr gebraucht wird.</p>` : ''}
<h2>Checks: Innovations-Check, Vertriebs-Check, Sichtbarkeits-Check</h2><p>Die Checks laufen unter ${e(F.domain)}/check in unserer eigenen Anwendung auf demselben Server. Zoe ist eine KI-Assistentin; in den Checks stellt sie die Fragen mit festen Texten, Ihre Antworten gehen an kein KI-Modell. Wir speichern Ihre Antworten, um Ihr Ergebnis zu berechnen. Beim ausführlichen Innovations-Check sehen Sie ohne Kontaktdaten Ihre Stufe; den vollständigen Bericht schicken wir Ihnen per E-Mail. Geben Sie Kontaktdaten an, schicken wir Ihnen Ihren Bericht per E-Mail, legen Sie als Anfrage in unserem Kundensystem an und bieten Ihnen das Erstgespräch an (Art. 6 Abs. 1 lit. b DSGVO, Anfrage vor einem möglichen Vertrag). Ohne Kontaktdaten löschen wir Ihre Antworten nach 30 Tagen, mit Kontaktdaten spätestens 24 Monate nach dem letzten Kontakt.</p><p>Damit Sie später weitermachen können, legt jeder Check im Speicher Ihres Browsers eine zufällige Kennung ab; sie enthält keine Antworten. Wählen Sie im Ergebnis einen freien Termin, merkt sich Ihr Browser bis zum Schließen des Fensters die gewählte Zeit und, falls Sie sie angegeben haben, Vorname, E-Mail und Firma, damit die Buchungsseite sie vorausfüllt. Die Buchungsseite löscht diese Angaben, sobald sie sie gelesen hat. Vor dem Start jedes Checks sehen Sie einen eigenen Datenschutzhinweis.</p>
<h2>Erstgespräch buchen</h2><p>Das Erstgespräch buchen Sie unter ${e(F.domain)}/buchen in unserer eigenen Anwendung. Ihre Angaben (Name, E-Mail, Firma, Anliegen) verwenden wir, um Ihre Terminanfrage zu bearbeiten und das Gespräch vorzubereiten (Art. 6 Abs. 1 lit. b DSGVO). Bis wir den Termin bestätigen, liegt Ihre Anfrage nur in unserer Terminverwaltung. Nicht bestätigte, abgelehnte, abgesagte oder abgelaufene Anfragen löschen wir 30 Tage nach der letzten Änderung, bestätigte Buchungen 30 Tage nach dem Termin. Mit der Bestätigung legen wir Sie als Geschäftskontakt an und tragen den Termin mit Ihrem Namen und Ihrer E-Mail-Adresse in unseren Kalender bei Google Workspace ein (siehe unten). Nach dem Absenden zeigt Ihnen die Seite Ihren persönlichen Status; die Adresse mit Ihrem Schlüssel kennen nur Sie. Vor dem Absenden sehen Sie dort einen eigenen Datenschutzhinweis.</p>
<h2>Kontaktformular</h2><p>Das Kontaktformular unter ${e(F.domain)}/anfrage läuft in unserer eigenen Anwendung. Sie schicken uns Ihren Vornamen, Ihre E-Mail-Adresse und Ihre Nachricht, wenn Sie möchten auch Nachnamen, Firma und Telefonnummer. Wir verwenden die Angaben, um Ihre Anfrage zu beantworten, und legen sie dafür als Anfrage in unserem Kundensystem auf unserem Server an (Art. 6 Abs. 1 lit. b DSGVO, Anfrage vor einem möglichen Vertrag, bzw. lit. f, unser berechtigtes Interesse, Ihre Nachricht zu beantworten). Kennen wir Ihre E-Mail-Adresse schon, hängen wir die Nachricht dort nur als unbestätigt an und prüfen sie von Hand. Das Formular verschickt keine E-Mail, und Werbung schicken wir Ihnen darüber nicht. Anfragen ohne weiteren Kontakt prüfen wir spätestens 24 Monate nach dem letzten Kontakt und löschen sie; verlangen Sie die Löschung, löschen wir sofort.</p>
<h2>Newsletter</h2><p>Den Newsletter bestellen Sie unter ${e(F.domain)}/newsletter. Sie bekommen ihn nur, wenn Sie die Anmeldung über den Link in unserer Bestätigungsmail bestätigen (Double-Opt-in). Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Wir speichern Ihre E-Mail-Adresse, Ihren Vornamen, falls Sie ihn angeben, den Wortlaut Ihrer Einwilligung und die Zeitpunkte von Anmeldung, Bestätigungsmail und Bestätigung, um die Einwilligung nachweisen zu können. Nach der Bestätigung führen wir Sie mit diesem Nachweis in unserem Kundensystem. Unbestätigte Anmeldungen löschen wir nach 30 Tagen. Sie können die Einwilligung jederzeit widerrufen, über den Abmeldelink in jeder Ausgabe oder per E-Mail; danach bekommen Sie nichts mehr, und wir behalten nur den Nachweis, dass und wann Sie eingewilligt und widerrufen haben. Die Mails verschicken wir über unser Postfach bei Google Workspace (siehe unten).</p>
<h2>Kontakt per E-Mail, Kalender</h2><p>Schreiben Sie uns an ${e(seite.kontakt.mail)}, verarbeiten wir Ihre Adresse und den Inhalt Ihrer Nachricht, um zu antworten: bei Anfragen zu einem möglichen Vertrag nach Art. 6 Abs. 1 lit. b DSGVO, sonst nach Art. 6 Abs. 1 lit. f DSGVO. Wir löschen die Nachricht, wenn sie erledigt ist, es sei denn, gesetzliche Aufbewahrungspflichten verlangen mehr. Die Postfächer und den Kalender betreibt Google Workspace (Gmail, Google Kalender), ein Dienst der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland, auf Grundlage eines Auftragsverarbeitungsvertrags. Werden dabei Daten in Länder außerhalb der EU übermittelt, etwa in die USA, ist das über das EU-US Data Privacy Framework beziehungsweise über Standardvertragsklauseln abgesichert.</p>
<h2>Sicherungen</h2><p>Verschlüsselte Sicherungen unseres Servers bewahren wir bis zu 12 Monate auf (14 Tages-, 8 Wochen- und 12 Monatsstände), danach werden sie überschrieben. Gelöschte Daten können bis dahin noch in einer Sicherung stehen, werden dort aber nicht mehr verwendet. Wird eine Sicherung zurückgespielt, löschen wir sie sofort erneut.</p>
<h2>Weitergabe</h2><p>Wir verkaufen keine Daten und geben sie nicht an Dritte weiter, außer an die oben genannten Dienstleister, die in unserem Auftrag arbeiten. Es gibt keine automatisierten Entscheidungen.</p>
<h2>Ihre Rechte</h2><p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Verarbeiten wir Daten auf Grundlage berechtigter Interessen, können Sie jederzeit widersprechen (Art. 21). Eine Mail an ${e(seite.kontakt.mail)} genügt. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).</p>`),
  });
  neu('404.html', {
    titel: 'Seite nicht gefunden · Fokus Innovation',
    beschreibung: 'Diese Seite gibt es nicht.',
    main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig"><div>${vorzeile('404')}<h1 id="held-titel" class="glanz">Diese Seite gibt es nicht.</h1><p class="lead">Vielleicht hilft der Weg zurück zur Startseite. Oder Sie schauen, was wir kostenlos anbieten.</p><div class="knoepfe">${knopf('/', 'Zur Startseite')}${textlink('/kostenlos/', 'Zu Kostenlos')}</div></div></div></section>`,
  });

  // ── Wissen: Übersicht und Ratgeber ──
  const autor = F.team[0];
  const datum = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  /** Fragen eines Ratgebers: eigene ({f, a}), aus den gemeinsamen Fragen ({faq}) oder aus einem Produktblatt ({aus, frage}). */
  const frageAus = (x, bereich) => {
    if (x.f) return x;
    if (x.faq) {
      const f = inhalt.faq.find((y) => y.id === x.faq);
      if (!f) throw new Error(`Frage ${x.faq} fehlt in inhalt.json`);
      return zuschneiden([f], bereich)[0];
    }
    const f = produktBlatt(angebot(x.aus))?.fragen.find((y) => y.frage === x.frage);
    if (!f) throw new Error(`Frage „${x.frage}“ fehlt im Produktblatt ${x.aus}`);
    return { f: f.frage, a: f.antwort };
  };
  const tabelleHtml = (tb) => `<figure class="tabelle-figur"><p class="tabelle-titel">${e(tb.titel)}</p><div class="tabelle-huelle"><table class="vergleich text"><caption class="sr">${e(tb.titel)}</caption><thead><tr>${tb.kopf.map((k) => `<th scope="col">${k ? e(k) : '<span class="sr">Merkmal</span>'}</th>`).join('')}</tr></thead><tbody>${tb.zeilen.map(([m, ...w]) => `<tr><th scope="row">${e(m)}</th>${w.map((v, n) => `<td data-name="${e(tb.kopf[n + 1])}">${t(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${tb.hinweis ? `<figcaption class="leise klein-text">${t(tb.hinweis)}</figcaption>` : ''}</figure>`;
  /** Eine geprüfte Zahl aus inhalt/zahlen.json (Ratgeber-Feld `zahl`) — fehlt sie, bricht der Bau ab. */
  const zahlVon = (id) => { const z = Z?.zahlen.find((y) => y.id === id); if (!z) throw new Error(`Zahl ${id} fehlt in inhalt/zahlen.json`); return z; };
  /** Quelle zu einem genutzten Beleg (`startup`) bzw. einer Zahl (`zahl:<id>`) — für die Quellenliste und die strukturierten Daten. */
  const quelleVon = (k) => { if (!k.startsWith('zahl:')) return F.belege[k]; const z = zahlVon(k.slice(5)); return { quelle: `${z.quelle}: ${z.titel}`, link: z.url }; };
  const abschnittHtml = (x, genutzt, bereich) => {
    const id = slug(x.h);
    const teile = [`<h2 id="${id}">${e(x.h)}</h2>`];
    const beleg = (k) => { if (!F.belege[k]) throw new Error(`Beleg ${k} fehlt`); genutzt.add(k); teile.push(zahl(F.belege[k])); };
    if (x.faq) teile.push(`<p>${t(frageAus({ faq: x.faq }, bereich).a)}</p>`);
    for (const p of x.absaetze ?? []) teile.push(`<p>${t(p)}</p>`);
    if (x.punkte) teile.push(punkte(x.punkte));
    if (x.schritte) teile.push(`<ol class="schritte">${x.schritte.map((s, i) => `<li><span class="nr">${String(i + 1).padStart(2, '0')}</span><div><h3>${e(s.titel)}</h3><p>${t(s.text)}</p></div></li>`).join('')}</ol>`);
    if (x.tabelle) teile.push(tabelleHtml(x.tabelle));
    if (x.zeitplan_von) teile.push(zeitplan(produktBlatt(angebot(x.zeitplan_von)).ablauf));
    if (x.vergleich_von) { const [bk, n] = x.vergleich_von.split(':'); teile.push(`<div class="artikel-vergleich">${vergleichTabelle(blaetter.vergleiche[bk][Number(n)])}${netto}</div>`); }
    if (x.beleg) beleg(x.beleg);
    if (x.zahl) { const z = zahlVon(x.zahl); genutzt.add(`zahl:${z.id}`); teile.push(zahlKarte(z)); }
    for (const p of x.absaetze_danach ?? []) teile.push(`<p>${t(p)}</p>`);
    if (x.beleg_danach) beleg(x.beleg_danach);
    return `<section class="artikel-teil" aria-labelledby="${id}">${teile.join('')}</section>`;
  };

  // ── Kostenlos (30.10., Kevin: „einen Bereich, wo wir kostenlose Sachen anbieten“): Checks, Ratgeber, Zahlen, Vorlagen, Newsletter.
  // Ersetzt die frühere Übersicht /wissen/ (Caddy leitet sie hierher um); die Ratgeber behalten ihre Adressen /wissen/<id>/.
  const checkZeilen = K.checks.map((c) => {
    const href = c.thema ? checkThema(c.thema, 'kostenlos') : c.pfad;
    return `<li><a href="${href}"><span class="z-name">${e(c.name)}${c.haupt ? ' <span class="marke-bald">Empfohlen</span>' : ''}</span><span class="z-text">${e(c.text)}</span><span class="z-preis">${c.minuten} Minuten</span>${PFEIL}</a></li>`;
  }).join('');
  /** Download-Links einer Vorlage: PDF (mit Seitenzahl) und, falls gebaut, die Tabelle für Excel. */
  const umfangText = (v) => v.dateien.map((d) => (d.art === 'pdf' ? `PDF · ${d.seiten} ${d.seiten === 1 ? 'Seite' : 'Seiten'}` : 'Tabelle für Excel')).join(' · ');
  // Lange Vorlagen (Kevin 31.10.) führen auf ihre Vorschau-Seite mit dem Formular — die Datei selbst kommt nur per E-Mail.
  const dateiLinks = (v) => (v.perMail
    ? `<a class="textlink" href="${v.seite}"><span>Vorschau · per E-Mail</span> ${PFEIL}</a><span class="v-umfang">${e(umfangText(v))}</span>`
    : v.dateien.map((d) => `<a class="textlink" href="${d.href}" download><span>${d.art === 'pdf' ? `PDF · ${d.seiten} ${d.seiten === 1 ? 'Seite' : 'Seiten'}` : 'Tabelle für Excel'}</span> ${PFEIL}</a>`).join(''));
  const vorlageZeile = (v, mitAnker = true) => `<li${mitAnker ? ` id="vorlage-${v.id}"` : ''}><div class="v-text"><h3 class="z-name">${v.perMail ? `<a href="${v.seite}">${e(v.titel)}</a>` : e(v.titel)}</h3><p class="z-text">${e(v.text)}</p>${v.inhalt?.length ? `<p class="v-inhalt">${v.inhalt.map(e).join(' · ')}</p>` : ''}</div><div class="v-dateien">${dateiLinks(v)}</div></li>`;
  /**
   * „Nach Phase“ (30.10.): was in Start, Aufbau und Wachstum zuerst hilft. Ausgewählt in fokus.json (`empfohlen`: „r:<ratgeber>“, „v:<vorlage>“),
   * ohne Auswahl alles mit dieser Phase (Feld `phase`). Eine unbekannte Kennung bricht den Bau ab.
   */
  const phaseLinks = (p) => {
    if (!p.empfohlen?.length) return [
      ...W.artikel.filter((x) => x.phase?.includes(p.id)).sort((x, y) => (y.leitfaden ? 1 : 0) - (x.leitfaden ? 1 : 0)).map((x) => [artikelPfad(x), x.leitfaden ? 'Leitfaden' : 'Ratgeber', x.titel]),
      ...VORL.filter((x) => x.phase?.includes(p.id)).map((x) => [`#vorlage-${x.id}`, 'Vorlage', x.titel]),
    ];
    return p.empfohlen.map((k) => {
      const [art, id] = k.split(':');
      if (art === 'v') { const v = vorlageVon(id); return [`#vorlage-${v.id}`, 'Vorlage', v.titel]; }
      const a = W.artikel.find((x) => x.id === id);
      if (art !== 'r' || !a) throw new Error(`Nach Phase ${p.id}: ${k} gibt es nicht`);
      return [artikelPfad(a), a.leitfaden ? 'Leitfaden' : 'Ratgeber', a.titel];
    });
  };
  /** Eine belegte Zahl im Stil der Belege der Website (`zahl`), mit Herausgeber und Jahr. */
  // Zitiert wird wie üblich mit Herausgeber und Erscheinungsjahr; das Jahr der Daten steht, wo es abweicht, im Satz selbst.
  const zahlKarte = (z) => zahl({ wert: z.wert, text: z.satz, link: z.url, quelle: `${z.quelle}, ${String(z.datum).slice(0, 4)}` });
  /** Kachel der Zahlen-Seite (31.10.): Zahl, kurze Aussage, Anteilsbalken (SVG, keine Inline-Stile), Wortlaut auf Klick, Quelle. */
  const anteil = (w) => { const m = String(w).match(/(\d+(?:,\d+)?)\s*%/); return m ? Math.min(100, parseFloat(m[1].replace(',', '.'))) : null; };
  const zahlKachel = (z) => { const a = anteil(z.wert); return `<figure class="zahl-kachel erscheint"><b class="glanz">${e(z.wert)}</b><figcaption><p class="zk-kurz">${e(z.kurz ?? z.satz)}</p>${a != null ? `<svg class="zk-balken" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><rect class="grund" width="100" height="4" rx="2"/><rect class="wert" width="${a}" height="4" rx="2"/></svg>` : ''}<details><summary>Wortlaut und Grundlage</summary><p>${e(z.satz)}</p></details><cite><a href="${e(z.url)}" rel="noopener" target="_blank">${e(z.quelle)}, ${String(z.datum).slice(0, 4)}</a></cite></figcaption></figure>`; };
  neu('kostenlos/index.html', {
    seo: 'kostenlos',
    bildVorzeile: 'Kostenlos',
    bildTitel: 'Checks, Ratgeber, Zahlen und Vorlagen.',
    aktiv: 'kostenlos',
    seitenTyp: 'CollectionPage',
    schema: [{ ...itemListe('Kostenlos bei Fokus Innovation', [...K.checks.map((c) => [c.thema ? `/check?thema=${c.thema}` : c.pfad, c.name]), ...W.artikel.map((a) => [artikelPfad(a), a.titel])]), '@id': `${absolut('/kostenlos/')}#kostenlos` }],
    main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[null, 'Kostenlos']])}${vorzeile('Kostenlos')}<h1 id="held-titel" class="glanz">${titel(K.titel, K.ruhig)}</h1><p class="lead">${t(K.lead)}</p>
<p class="regal-zahlen"><span><b>${K.checks.length}</b> Checks</span>${VORL.length ? `<span><b>${VORL.length}</b> Vorlagen</span>` : ''}<span><b>${W.artikel.length}</b> Ratgeber</span>${Z ? `<span><b>${Z.zahlen.length}</b> Zahlen</span>` : ''}</p>
<nav class="az breit" aria-label="Auf dieser Seite"><a href="#checks">Checks</a>${K.phasen?.length ? '<a href="#phasen">Nach Phase</a>' : ''}<a href="#ratgeber">Ratgeber</a>${Z ? '<a href="#zahlen">Zahlen</a>' : ''}${VORL.length ? '<a href="#vorlagen">Vorlagen</a>' : ''}<a href="#newsletter" data-wenn-seite="/newsletter" hidden>Newsletter</a>${BS_LISTE.length ? '<a href="/bausteine/">Bausteine</a>' : ''}</nav></div>
${(() => { const ids = VORL.filter((v) => v.perMail).map((v) => v.id); return ids.length >= 3 ? regal([ids[0], ids.find((id) => VORL.find((v) => v.id === id).bereich === 'sichtbarkeit') ?? ids[1], ids.find((id) => VORL.find((v) => v.id === id).bereich === 'innovation') ?? ids[2]], 'Drei der Vorlagen: Titelseiten', 'vorlagen') : ''; })()}
</div></section>

<section class="abschnitt" id="checks" aria-labelledby="checks-titel"><div class="w">${abKopf({ marke: 'Checks', h2: 'Wo stehen Sie?', ruhig: 'In Minuten.', lead: 'Sie beantworten fast alles per Klick und sehen sofort, wo Sie stehen und was als Nächstes kommt. Zoe, unsere KI-Assistentin, führt durch die Fragen.', id: 'checks-titel' })}
<ul class="zeilen erscheint">${checkZeilen}</ul></div></section>
${K.phasen?.length ? `<section class="abschnitt" id="phasen" aria-labelledby="phasen-titel"><div class="w">${abKopf({ marke: 'Nach Phase', h2: K.phasen_titel, ruhig: K.phasen_ruhig, lead: K.phasen_lead, id: 'phasen-titel' })}
<div class="phasen-raster erscheint">${K.phasen.map((p) => `<div class="phase-spalte"><p class="etikett">${e(p.name)}</p><h3>${e(p.titel)}</h3><p>${t(p.satz)}</p><ul>${phaseLinks(p).map(([h, art, ti]) => `<li><a href="${h}"><span class="phase-art">${art}</span><span class="phase-titel">${e(ti)}</span></a></li>`).join('')}</ul></div>`).join('')}</div></div></section>` : ''}

<section class="abschnitt" id="ratgeber" aria-labelledby="ratgeber-titel"><div class="w">${abKopf({ marke: 'Ratgeber', h2: 'Aus unserer Arbeit.', ruhig: 'Zum Nachlesen.', lead: 'Hier schreiben wir auf, wie wir Vertrieb aufbauen, Angebote sichtbar machen und Neues einführen. Wo Zahlen stehen, nennen wir die Quelle.', id: 'ratgeber-titel' })}${artikelZu((a) => a.leitfaden).length ? wissenListe(artikelZu((a) => a.leitfaden)) : ''}</div></section>
${BEREICHE.map((k) => { const liste = artikelZu((a) => a.bereich === k && !a.leitfaden); return liste.length ? `<section class="abschnitt" aria-labelledby="ratgeber-${k}"><div class="w">${abKopf({ marke: B[k].name, nr: B[k].nr, h2: B[k].paar, id: `ratgeber-${k}` })}${wissenListe(liste)}</div></section>` : ''; }).join('\n')}
${Z ? `<section class="abschnitt" id="zahlen" aria-labelledby="zahlen-titel"><div class="w">${abKopf({ marke: 'Zahlen', h2: K.zahlen.titel, lead: K.zahlen.lead, id: 'zahlen-titel' })}<div class="zahlen-raster">${(Z.zahlen.some((z) => z.vorn) ? Z.zahlen.filter((z) => z.vorn) : Z.zahlen.slice(0, 3)).map(zahlKarte).join('')}</div><div class="knoepfe erscheint">${textlink('/kostenlos/zahlen/', `Alle ${Z.zahlen.length} Zahlen`)}</div></div></section>` : ''}
${VORL.length ? `<section class="abschnitt" id="vorlagen" aria-labelledby="vorlagen-titel"><div class="w">${abKopf({ marke: 'Vorlagen', h2: K.vorlagen.titel, lead: K.vorlagen.lead, id: 'vorlagen-titel' })}${BEREICHE.map((k) => { const l = VORL.filter((v) => v.bereich === k); return l.length ? `<h3 class="vorlagen-bereich">${e(B[k].name)}</h3><ul class="vorlagen-liste erscheint">${l.map((v) => vorlageZeile(v)).join('')}</ul>` : ''; }).join('')}</div></section>` : ''}
${BS_LISTE.length ? `<section class="abschnitt" id="mehr" aria-labelledby="mehr-titel"><div class="w">${abKopf({ marke: 'Mehr als kostenlos', h2: 'Bausteine zum Selbermachen.', lead: `Die ausführliche Fassung: fertige Arbeitspakete aus unserer Arbeit, ab ${(Math.min(...BS_LISTE.map((b) => b.preis)) / 100).toLocaleString('de-DE')}\u00a0€ netto, auf Rechnung.`, id: 'mehr-titel' })}<div class="knoepfe erscheint">${knopf('/bausteine/', 'Alle Bausteine ansehen', 'zweit')}</div></div></section>` : ''}
<section class="abschnitt" id="newsletter" aria-labelledby="newsletter-titel" data-wenn-seite="/newsletter" hidden><div class="w">${abKopf({ marke: 'Newsletter', h2: K.newsletter.titel, lead: K.newsletter.text, id: 'newsletter-titel' })}<div class="knoepfe erscheint">${knopf(K.newsletter.pfad, K.newsletter.knopf)}</div></div></section>
<section class="abschnitt" aria-labelledby="nachschlagen-titel"><div class="w">${abKopf({ marke: 'Nachschlagen', h2: 'Begriffe, Fragen, Preise.', id: 'nachschlagen-titel' })}
<ul class="zeilen erscheint">${[['/begriffe/', 'Begriffe von A bis Z', 'Pipeline, Sales Playbook, Wiedervorlage: kurz und klar erklärt.', `${W.begriffe.length} Begriffe`], ['/fragen/', 'Häufige Fragen', 'Antworten zu Check, Vertrieb, Homepages, Videos und Verträgen.', 'alle Bereiche'], ['/preise/', 'Alle Preise', 'Jedes Angebot mit Preis und Konditionen auf einer Seite.', 'netto']].map(([h, n, s, p]) => `<li><a href="${h}"><span class="z-name">${e(n)}</span><span class="z-text">${e(s)}</span><span class="z-preis">${e(p)}</span>${PFEIL}</a></li>`).join('')}</ul></div></section>
${schlussakt({ quelle: 'kostenlos_ende' })}`,
  });

  // ── Vorschau-Seiten der langen Vorlagen (Kevin 31.10.: „die größeren brauchen eine E-Mail, damit wir denen das Ganze zuschicken können“) ──
  // Titelseite + eine Beispielseite als Bild (vorlagen.mjs), der Inhalt als Liste, dann das Formular. Das Formular spricht mit der App
  // (js/unterlage.js → /api/unterlage, über die Website-Adresse); ohne Skript oder wenn die App die Anforderung gerade nicht annimmt, steht der
  // Weg per E-Mail da. Die Datei selbst liegt nicht im öffentlichen Ordner (lauf → unterlagen/).
  /** Beschreibung für die Suche (110–165 Zeichen): erster Satz + Umfang, sonst Titel + Umfang. */
  const vorlageBeschreibung = (v) => {
    const satz1 = klar(v.text).match(/^.*?[.!?](?=\s|$)/)?.[0] ?? klar(v.text);
    const wahl = [`${satz1} ${umfangText(v)}, kostenlos per E-Mail.`, `${v.titel}: ${umfangText(v)} mit Anleitung, ausgefülltem Beispiel und Bögen zum Ausfüllen. Kostenlos per E-Mail.`, `Kostenlose Vorlage: ${v.titel}. ${umfangText(v)} mit Anleitung und Beispiel, per E-Mail.`].find((x) => x.length >= 110 && x.length <= 165);
    if (!wahl) throw new Error(`Vorlage ${v.id}: keine Beschreibung mit 110–165 Zeichen — Text kürzen`);
    return wahl;
  };
  for (const v of VORL.filter((x) => x.perMail)) {
    const pfad = `kostenlos/vorlagen/${v.id}/index.html`;
    const ratgeber = v.ratgeber ? W.artikel.find((a) => a.id === v.ratgeber) : null;
    if (v.ratgeber && !ratgeber) throw new Error(`Vorlage ${v.id}: Ratgeber ${v.ratgeber} fehlt`);
    const pdf = v.dateien.find((d) => d.art === 'pdf');
    const nr = v.vorschau_seite ?? 2;
    const weitere = VORL.filter((x) => x.id !== v.id && x.bereich === v.bereich).slice(0, 3);
    const ersatz = `Schreiben Sie uns kurz ${anfrageInline(`vorlage-${v.id}`, `Vorlage: ${v.titel}`, 'über das Formular')}, wir schicken Ihnen die Vorlage zu.`;
    neu(pfad, {
      titel: [`${v.titel}: Vorlage kostenlos · Fokus Innovation`, `${v.titel} · Fokus Innovation`, `${v.titel}: Vorlage kostenlos`, v.titel].find((x) => x.length <= 65),
      beschreibung: vorlageBeschreibung(v),
      bildVorzeile: `Vorlage · ${B[v.bereich].name}`,
      bildTitel: v.titel,
      aktiv: 'kostenlos',
      schema: [{ '@type': 'DigitalDocument', '@id': `${absolut(v.seite)}#vorlage`, name: v.titel, description: klar(v.text), inLanguage: 'de-DE', encodingFormat: 'application/pdf', numberOfPages: pdf?.seiten, isAccessibleForFree: true, publisher: { '@id': ORG }, ...(ratgeber ? { isBasedOn: absolut(artikelPfad(ratgeber)) } : {}) }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([['/kostenlos/', 'Kostenlos'], ['/kostenlos/#vorlagen', 'Vorlagen'], [null, v.titel]])}${vorzeile(`Vorlage · ${B[v.bereich].name}`)}<h1 id="held-titel" class="glanz">${e(v.titel)}</h1><p class="lead">${t(v.text)}</p>
<p class="vorlage-umfang">${e(umfangText(v))} · kostenlos per E-Mail</p>
<div class="knoepfe">${knopf('#anfordern', 'Per E-Mail anfordern')}${ratgeber ? textlink(artikelPfad(ratgeber), ratgeber.leitfaden ? 'Den Leitfaden dazu lesen' : 'Den Ratgeber dazu lesen') : ''}</div></div>
<figure class="vorlage-blatt erscheint"><img class="blatt-titel" src="/assets/bild/vorlagen/${v.id}-titel.jpg" width="640" height="905" alt="Titelseite der Vorlage „${e(v.titel)}“"><img class="blatt-seite" src="/assets/bild/vorlagen/${v.id}-seite.jpg" width="900" height="1273" alt="Seite ${nr} der Vorlage als Beispiel"><figcaption>Seite ${nr} von ${pdf?.seiten ?? ''} · Vorschau</figcaption></figure>
</div></section>
${v.inhalt?.length ? `<section class="abschnitt" aria-labelledby="inhalt-titel"><div class="w">${abKopf({ marke: 'Inhalt', h2: 'Was drin ist.', lead: `${pdf?.seiten ?? ''} Seiten mit Anleitung, ausgefülltem Beispiel und Bögen zum Ausfüllen${v.dateien.some((d) => d.art === 'xlsx') ? ', dazu eine Tabelle, die selbst rechnet' : ''}.`, id: 'inhalt-titel' })}<ol class="vorlage-inhalt erscheint">${v.inhalt.map((x) => `<li>${t(x)}</li>`).join('')}</ol></div></section>` : ''}
${(() => { const bs = v.baustein && BS_LISTE.find((x) => x.id === v.baustein); return bs ? `<section class="abschnitt eng" aria-label="Die ausführliche Fassung"><div class="w"><div class="risiko erscheint"><p class="etikett">Die ausführliche Fassung</p><p class="gruppe-titel">${e(bs.titel)} · <span data-mk="baustein:${bs.id}">${(bs.preis / 100).toLocaleString('de-DE')}\u00a0€</span> netto</p><p>${e(bs.kurz)}</p>${textlink(bs.seite, 'Baustein ansehen')}</div></div></section>` : ''; })()}
<section class="abschnitt" id="anfordern" aria-labelledby="anfordern-titel"><div class="w">${abKopf({ marke: 'Kostenlos', h2: 'Per E-Mail anfordern.', lead: 'Den Link zum Herunterladen bekommen Sie per E-Mail.', id: 'anfordern-titel' })}
<div class="anfordern erscheint">
<form class="anfordern-form" data-unterlage="${v.id}" novalidate hidden>
<p class="anfordern-vorab">Sie bekommen den Link sofort, er gilt 7 Tage.</p>
<div class="anfordern-felder"><label><span>Vorname</span><input name="vorname" autocomplete="given-name" maxlength="60" required></label><label><span>E-Mail</span><input name="email" type="email" autocomplete="email" maxlength="160" required></label><label><span>Firma <small>freiwillig</small></span><input name="firma" autocomplete="organization" maxlength="120"></label></div>
<div class="anfordern-falle" aria-hidden="true"><label>Webseite <input name="webseite" tabindex="-1" autocomplete="off"></label></div>
<label class="anfordern-haken" data-newsletter hidden><input type="checkbox" name="newsletter"><span></span></label>
<p class="anfordern-hinweis">Wir nutzen Ihre Angaben, um Ihnen den Link zu schicken, und legen Ihre Anfrage in unserem Kundensystem an. Werbung bekommen Sie nur, wenn Sie den Newsletter ankreuzen und bestätigen. Mehr im <a class="unterstrichen" href="/datenschutz/#vorlagen">Datenschutzhinweis</a>.</p>
<button class="knopf" type="submit">Vorlage per E-Mail anfordern ${PFEIL}</button>
<p class="anfordern-meldung" data-meldung role="status" aria-live="polite"></p>
</form>
<div class="anfordern-fertig" data-fertig hidden tabindex="-1"><p class="etikett">Ist unterwegs</p><p class="anfordern-fertig-text" data-fertig-text></p></div>
<p class="anfordern-ersatz" data-ersatz hidden>${ersatz}</p>
<noscript><p class="anfordern-ersatz">${ersatz}</p></noscript>
</div></div></section>
${weitere.length ? `<section class="abschnitt" aria-labelledby="weitere-titel"><div class="w">${abKopf({ marke: 'Vorlagen', h2: `Weitere Vorlagen: ${B[v.bereich].name}`, id: 'weitere-titel' })}<ul class="vorlagen-liste erscheint">${weitere.map((x) => vorlageZeile(x, false)).join('')}</ul><div class="knoepfe erscheint">${textlink('/kostenlos/#vorlagen', 'Alle Vorlagen')}</div></div></section>` : ''}
${schlussakt({ quelle: `vorlage_${v.id}`, bereich: v.bereich })}`,
    });
  }

  // ── Bausteine (Kevin 31.10.: „Bausteine, die sich die Leute für 100–300 € kaufen können … der Einstieg“) ──
  // Übersicht /bausteine/ und je Baustein eine Seite mit Vorschau, Inhalt und Bestellformular (js/bestellung.js → App /api/bestellung).
  // Lieferung erst nach Freigabe in MAKE OS. Preise netto aus inhalt/bausteine.json; ohne gebautes PDF gibt es den Baustein nicht.
  const BS = BS_LISTE;
  const BZ = F.bausteine ?? {};
  const euro = (cent) => `${(cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
  const bausteinUmfang = (b) => (b.paket ? `${b.teile.length} Bausteine · ${b.seiten} Seiten` : [`PDF · ${b.seiten} Seiten`, b.dateien.some((d) => d.art === 'xlsx') ? 'Tabelle für Excel' : null].filter(Boolean).join(' · '));
  const bausteinKarte = (b) => `<li class="preis-karte${b.paket ? ' einstieg' : ''}"><a href="${b.seite}">${b.paket ? '<span class="marke-einstieg">Spar-Paket</span>' : ''}<h3>${e(b.titel)}</h3><p class="karte-preis glanz"><span data-mk="baustein:${b.id}">${euro(b.preis)}</span></p><p class="karte-zusatz">netto${b.paket ? `, statt ${euro(b.einzelpreis)}` : ''} · ${e(bausteinUmfang(b))}</p><p class="karte-satz">${e(b.kurz)}</p><span class="textlink"><span>Ansehen und bestellen</span> ${PFEIL}</span></a></li>`;
  if (BS.length) {
    const bereiche = (q.bausteine.bereiche ?? []).filter((bb) => BS.some((b) => b.bereich === bb.id));
    const abAb = euro(Math.min(...BS.map((b) => b.preis)));
    neu('bausteine/index.html', {
      titel: 'Bausteine zum Selbermachen · Fokus Innovation',
      beschreibung: `Fertige Arbeitspakete aus unserer Arbeit, ab ${abAb.replace(' ', ' ')} netto: Vertrieb, Positionierung und KI im Team. Mit Anleitung, ausgefülltem Beispiel und Bögen, auf Rechnung.`,
      bildVorzeile: 'Bausteine',
      bildTitel: 'Bausteine zum Selbermachen.',
      woertlich: true,
      aktiv: 'leistungen',
      seitenTyp: 'CollectionPage',
      schema: [{ ...itemListe('Bausteine von Fokus Innovation', BS.map((b) => [b.seite, b.titel])), '@id': `${absolut('/bausteine/')}#bausteine` }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[null, 'Bausteine']])}${vorzeile('Bausteine')}<h1 id="held-titel" class="glanz">${titel('Bausteine.', 'Zum Selbermachen.')}</h1><p class="lead">${wort(BZ.lead ?? '')}</p>
<nav class="az breit" aria-label="Auf dieser Seite">${bereiche.map((bb) => `<a href="#bausteine-${bb.id}">${e(bb.name)}</a>`).join('')}<a href="#ablauf">So läuft es</a><a href="#bedingungen">Bedingungen</a></nav></div>
${regal(BS.filter((b) => !b.paket).map((b) => b.id).filter((id, i, l) => i === 0 || BS.find((b) => b.id === id).bereich !== BS.find((b) => b.id === l[i - 1]).bereich), 'Drei der Bausteine: Titelseiten')}
</div></section>
${bereiche.map((bb) => `<section class="abschnitt" id="bausteine-${bb.id}" aria-labelledby="bausteine-${bb.id}-titel"><div class="w">${abKopf({ marke: bb.name, h2: bb.satz, id: `bausteine-${bb.id}-titel` })}<ul class="preis-karten erscheint">${BS.filter((b) => b.bereich === bb.id).sort((x, y) => (y.paket ? 1 : 0) - (x.paket ? 1 : 0)).map(bausteinKarte).join('')}</ul></div></section>`).join('\n')}
<section class="abschnitt" id="ablauf" aria-labelledby="ablauf-titel"><div class="w">${abKopf({ marke: 'Bestellen', h2: 'So läuft es.', id: 'ablauf-titel' })}
${weg(BZ.ablauf ?? [], { etiketten: ['01', '02', '03'], label: 'So läuft die Bestellung' })}</div></section>
<section class="abschnitt" id="bedingungen" aria-labelledby="bedingungen-titel"><div class="w">${abKopf({ marke: 'Gut zu wissen', h2: 'Bedingungen auf einen Blick.', id: 'bedingungen-titel' })}
<div class="zwei-teile"><div class="erscheint"><dl class="daten">${[...(verkaeufer ? [['Verkäufer', `${verkaeufer.name}, stellt auch die Rechnung`]] : []), ...(BZ.bedingungen ?? [])].map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${wort(v)}</dd></div>`).join('')}</dl></div><div class="erscheint"><p>${wort(BZ.bedingungen_hinweis ?? '')}</p><p class="leise klein-text">Die vollständigen Bestellbedingungen sehen Sie vor dem Absenden.</p></div></div></div></section>
${schlussakt({ quelle: 'bausteine_ende' })}`,
    });

    for (const b of BS) {
      const pfad = `bausteine/${b.id}/index.html`;
      const bild = b.paket ? b.teile[0].id : b.id;
      const brutto = Math.round(b.preis * 1.19);
      const ersatz = `Schreiben Sie uns kurz ${anfrageInline(`baustein-${b.id}`, `Bestellung: ${b.titel}`, 'über das Formular')} mit Firma und Rechnungsanschrift, wir schicken Ihnen Rechnung und Download-Link.`;
      const weitere = BS.filter((x) => x.id !== b.id && x.bereich === b.bereich).slice(0, 3);
      const vorschau = b.paket
        ? regal(b.teile.map((x) => x.id), `Die ${b.teile.length} Bausteine im Paket`)
        : `<figure class="vorlage-blatt erscheint"><img class="blatt-titel" src="/assets/bild/bausteine/${bild}-titel.jpg" width="640" height="905" alt="Titelseite: ${e(b.titel)}"><img class="blatt-seite" src="/assets/bild/bausteine/${bild}-seite.jpg" width="900" height="1273" alt="Seite ${b.vorschau_seite ?? 2} als Beispiel"><figcaption>Seite ${b.vorschau_seite ?? 2} von ${b.seiten} · Vorschau</figcaption></figure>`;
      const feld = (name, text, typ = 'text', pflicht = true, auto = '', breit = false) => `<label${breit ? ' class="breit"' : ''}><span>${e(text)}${pflicht ? '' : ' <small>freiwillig</small>'}</span><input name="${name}" type="${typ}"${auto ? ` autocomplete="${auto}"` : ''} maxlength="${name === 'email' ? 160 : 120}"${pflicht ? ' required' : ''}${name === 'land' ? ' value="Deutschland"' : ''}></label>`;
      neu(pfad, {
        titel: [`${b.titel}: Baustein · Fokus Innovation`, `${b.titel} · Fokus Innovation`, b.titel].find((x) => x.length <= 65),
        beschreibung: (() => {
          const preis = `${euro(b.preis).replace('\u00a0', ' ')} netto`;
          const wahl = [`${b.kurz} ${bausteinUmfang(b)}, ${preis}.`, `${b.kurz} ${bausteinUmfang(b)}, ${preis}, mit Anleitung, Beispiel und Bögen.`, `${b.titel}: ${bausteinUmfang(b)}, ${preis}, mit Anleitung, ausgefülltem Beispiel und Bögen zum Ausfüllen.`, `${b.titel}: ${preis}, mit Anleitung, ausgefülltem Beispiel und Bögen. Auf Rechnung, für Unternehmen.`].find((x) => x.length >= 110 && x.length <= 165);
          if (!wahl) throw new Error(`Baustein ${b.id}: keine Beschreibung mit 110–165 Zeichen — „kurz“ anpassen`);
          return wahl;
        })(),
        bildVorzeile: `Baustein · ${(q.bausteine.bereiche ?? []).find((x) => x.id === b.bereich)?.name ?? ''}`,
        bildTitel: b.titel,
        woertlich: true,
        aktiv: 'leistungen',
        schema: [{ '@type': 'Product', '@id': `${absolut(b.seite)}#baustein`, name: b.titel, description: String(b.text ?? b.kurz).replace(/\s+/g, ' ').trim(), brand: { '@id': ORG }, offers: { '@type': 'Offer', ...(verkaeufer ? { seller: { '@type': 'Organization', name: verkaeufer.name } } : {}), price: (b.preis / 100).toFixed(2), priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: absolut(b.seite), priceSpecification: { '@type': 'UnitPriceSpecification', price: (b.preis / 100).toFixed(2), priceCurrency: 'EUR', valueAddedTaxIncluded: false } } }],
        main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([['/bausteine/', 'Bausteine'], [null, b.titel]])}${vorzeile(`Baustein · ${(q.bausteine.bereiche ?? []).find((x) => x.id === b.bereich)?.name ?? ''}`)}<h1 id="held-titel" class="glanz">${e(b.titel)}</h1><p class="lead">${wort(b.text ?? b.kurz)}</p>
<div class="baustein-preis"><b class="glanz" data-mk="baustein:${b.id}">${euro(b.preis)}</b><span>netto zzgl. 19 % USt${b.paket ? `, statt ${euro(b.einzelpreis)} einzeln` : ''} · ${e(bausteinUmfang(b))}</span></div>
<div class="knoepfe">${knopf('#bestellen', 'Auf Rechnung bestellen')}${textlink('/bausteine/', 'Alle Bausteine')}</div></div>
${vorschau}
</div></section>
${blick([['Für wen', b.fuer ?? null], ['Ihre Zeit', b.dauer ?? null], ['Lieferung', 'Download-Link per E-Mail nach kurzer Prüfung, meist am selben Werktag']])}
${b.paket ? `<section class="abschnitt" aria-labelledby="teile-titel"><div class="w">${abKopf({ marke: 'Im Paket', h2: 'Vier Bausteine, die aufeinander aufbauen.', lead: `Einzeln kosten sie zusammen ${euro(b.einzelpreis)} netto.`, id: 'teile-titel' })}<ul class="preis-karten erscheint">${b.teile.map(bausteinKarte).join('').replace(/Ansehen und bestellen/g, 'Was drin ist')}</ul></div></section>` : ''}
${!b.paket && b.inhalt?.length ? `<section class="abschnitt" aria-labelledby="inhalt-titel"><div class="w">${abKopf({ marke: 'Inhalt', h2: 'Was drin ist.', lead: `${b.seiten} Seiten mit Anleitung, ausgefülltem Beispiel und Bögen zum Ausfüllen${b.dateien.some((d) => d.art === 'xlsx') ? ', dazu eine Tabelle, die selbst rechnet' : ''}.`, id: 'inhalt-titel' })}<ol class="vorlage-inhalt erscheint">${b.inhalt.map((x) => `<li>${wort(x)}</li>`).join('')}</ol></div></section>` : ''}
${b.ergebnis?.length ? `<section class="abschnitt" aria-labelledby="ergebnis-titel"><div class="w">${abKopf({ marke: 'Ergebnis', h2: 'Was Sie danach haben.', id: 'ergebnis-titel' })}<ul class="punkte erscheint">${b.ergebnis.map((x) => `<li>${wort(x)}</li>`).join('')}</ul></div></section>` : ''}
<section class="abschnitt" id="bestellen" aria-labelledby="bestellen-titel"><div class="w">${abKopf({ marke: 'Bestellen', h2: 'Auf Rechnung bestellen.', lead: 'Nur für Unternehmen. Rechnung und Download-Link schicken wir Ihnen per E-Mail.', id: 'bestellen-titel' })}
<div class="anfordern bestellen erscheint">
<p class="bestell-verkaeufer" data-verkaeufer${verkaeufer ? '' : ' hidden'}>${verkaeufer ? `Vertragspartner und Rechnungssteller: ${wort(verkaeufer.name)}.${verkaeuferEigen ? ' <a class="unterstrichen" href="/impressum/#bausteine">Anschrift</a>' : ''}` : ''}</p>
<form class="anfordern-form bestell-form" data-baustein="${b.id}" novalidate hidden>
<p class="anfordern-vorab">Nach kurzer Prüfung bekommen Sie Rechnung und Download-Link, meist am selben Werktag. Der Link gilt 30 Tage.</p>
<div class="anfordern-felder bestell-felder">${feld('vorname', 'Vorname', 'text', true, 'given-name')}${feld('nachname', 'Nachname', 'text', true, 'family-name')}${feld('firma', 'Firma', 'text', true, 'organization', true)}${feld('email', 'E-Mail für Rechnung und Download', 'email', true, 'email', true)}${feld('strasse', 'Straße und Hausnummer', 'text', true, 'address-line1', true)}${feld('plz', 'PLZ', 'text', true, 'postal-code')}${feld('ort', 'Ort', 'text', true, 'address-level2')}${feld('land', 'Land', 'text', true, 'country-name')}${feld('ustid', 'USt-IdNr.', 'text', false)}${feld('telefon', 'Telefon', 'tel', false, 'tel')}</div>
<div class="anfordern-falle" aria-hidden="true"><label>Webseite <input name="webseite" tabindex="-1" autocomplete="off"></label></div>
<div class="bestell-summe"><span>${e(b.titel)}</span><b data-summe>${euro(b.preis)} netto + 19 % USt = ${euro(brutto)}</b></div>
<label class="anfordern-haken"><input type="checkbox" name="unternehmer"><span>Ich bestelle für mein Unternehmen, nicht als Verbraucher.</span></label>
<div class="bestell-bedingungen" data-bedingungen hidden></div>
<label class="anfordern-haken"><input type="checkbox" name="bedingungen"><span>Ich habe die Bestellbedingungen gelesen und stimme ihnen zu.</span></label>
<p class="anfordern-hinweis">Ihre Angaben nutzen wir für Bestellung, Rechnung und Lieferung. Mehr im <a class="unterstrichen" href="/datenschutz/#bausteine">Datenschutzhinweis</a>.</p>
<button class="knopf" type="submit">Kostenpflichtig bestellen ${PFEIL}</button>
<p class="anfordern-meldung" data-meldung role="status" aria-live="polite"></p>
</form>
<div class="anfordern-fertig" data-fertig hidden tabindex="-1"><p class="etikett">Bestellung eingegangen</p><p class="anfordern-fertig-text" data-fertig-text></p></div>
<p class="anfordern-ersatz" data-ersatz hidden>${ersatz}</p>
<noscript><p class="anfordern-ersatz">${ersatz}</p></noscript>
</div></div></section>
${weitere.length ? `<section class="abschnitt" aria-labelledby="weitere-titel"><div class="w">${abKopf({ marke: 'Bausteine', h2: 'Passt dazu.', id: 'weitere-titel' })}<ul class="preis-karten erscheint">${weitere.map(bausteinKarte).join('')}</ul></div></section>` : ''}
${schlussakt({ quelle: `baustein_${b.id}`, bereich: b.bereich })}`,
      });
    }
  }

  if (Z) {
    neu('kostenlos/zahlen/index.html', {
      seo: 'zahlen',
      bildVorzeile: 'Kostenlos · Zahlen',
      bildTitel: 'Zahlen zu Vertrieb, Sichtbarkeit und KI.',
      aktiv: 'kostenlos',
      seitenTyp: 'CollectionPage',
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([['/kostenlos/', 'Kostenlos'], [null, 'Zahlen']])}${vorzeile(`Stand ${datum(Z.stand)}`)}<h1 id="held-titel" class="glanz">${titel(K.zahlen.titel)}</h1><p class="lead">${t(K.zahlen.lead)}</p></div>
</div></section>
${BEREICHE.map((k) => { const liste = Z.zahlen.filter((z) => z.bereich === k); return liste.length ? `<section class="abschnitt" aria-labelledby="zahlen-${k}"><div class="w">${abKopf({ marke: B[k].name, nr: B[k].nr, h2: B[k].paar, id: `zahlen-${k}` })}<div class="zahlen-raster kacheln">${liste.map(zahlKachel).join('')}</div></div></section>` : ''; }).join('\n')}
<section class="abschnitt" aria-labelledby="zahlen-hinweis"><div class="w"><p class="leise klein-text erscheint" id="zahlen-hinweis">Wir geben die Zahlen so wieder, wie die Herausgeber sie veröffentlicht haben. Der Link führt jeweils zur Quelle. Die Zahlen beziehen sich auf Deutschland, wo nicht anders genannt. Zahlen verschiedener Quellen können voneinander abweichen, weil sie unterschiedliche Unternehmensgrößen und Begriffe zählen.</p></div></section>
${schlussakt({ quelle: 'zahlen_ende' })}`,
    });
  }

  // ── Einstiegsseiten (Kevin 30.10.: „hinter den beiden Einstiegen eine eigene Seite, nicht direkt zu den Preisen“) ──
  if (F.einstiege) {
    const einZeile = (z) => {
      const a = z.angebot ? angebot(z.angebot) : null;
      const gruppe = z.gruppe ? produkteIn('sichtbarkeit').filter((x) => x.gruppe === z.gruppe) : null;
      const [h, n, p, pa] = a ? [produktPfad(a), F.kurznamen[a.id] ?? a.name.replace(/ S, M, L$/, ''), preisKurz(a), a] : gruppe ? [z.ziel, z.name, preisKurz(gruppe[0]), gruppe[0]] : [z.ziel, z.name, z.preis, null];
      return `<li><a href="${h}"><span class="wl-lage">${t(z.lage)}</span><span class="wl-ziel"><b>${e(n)}</b><span>${mkPreis(pa, p)}</span></span>${PFEIL}</a></li>`;
    };
    const SEITEN = [
      { id: 'markt', pfad: 'in-den-markt', bild: 'produkt-umsatz', bereiche: ['sichtbarkeit', 'vertrieb'], schritte: F.einstiege.markt.schritte },
      { id: 'unternehmen', pfad: 'ins-unternehmen', bild: 'inseln', bereiche: ['innovation'], schritte: B.innovation.felder },
    ];
    for (const s of SEITEN) {
      const x = F.einstiege[s.id];
      const tuer = F.tueren.find((d) => d.id === s.id);
      const momente = (F.bekannt.gruppen ?? []).filter((g) => s.bereiche.includes(g.bereich)).flatMap((g) => g.momente);
      const checkKnoepfe = x.checks.map(([thema, text], i) => knopf(thema === 'innovation' ? check(`${s.pfad}_check`) : checkThema(thema, `${s.pfad}_check`), text, i ? 'zweit' : '')).join('');
      neu(`${s.pfad}/index.html`, {
        seo: s.pfad,
        bildVorzeile: tuer.etikett,
        bildTitel: `${x.titel} ${x.ruhig}`,
        main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[null, tuer.etikett]])}${vorzeile(tuer.etikett)}<h1 id="held-titel" class="glanz">${titel(x.titel, x.ruhig)}</h1><p class="lead">${t(x.lead)}</p>
<div class="knoepfe">${erstKnopf()}${textlink('#einstieg', 'Womit anfangen')}</div></div>
${buehne(s.bild, VIDEOS[s.pfad])}
</div></section>

<section class="abschnitt" aria-labelledby="merken-titel"><div class="w">${abKopf({ marke: 'Ihr Alltag', h2: x.merken, lead: 'Diese Situationen schildern uns Gründer und Geschäftsführer immer wieder.', id: 'merken-titel' })}
<ul class="momente erscheint">${momente.map((m) => `<li>${t(m)}</li>`).join('')}</ul></div></section>

<section class="abschnitt" aria-labelledby="schritte-titel"><div class="w">${abKopf({ marke: 'So gehen wir vor', h2: x.schritte_titel, id: 'schritte-titel' })}
${raster(s.schritte.map((y) => ({ titel: y.titel, text: y.text })), Math.min(4, s.schritte.length))}
<div class="zwei-teile belege-paar">${x.zahlen.map((id) => zahlKarte(zahlVon(id))).join('')}</div></div></section>

<section class="abschnitt" id="einstieg" aria-labelledby="einstieg-titel"><div class="w">${abKopf({ marke: 'Womit anfangen?', h2: F.wegweiser.titel, lead: F.wegweiser.lead, id: 'einstieg-titel' })}
<ul class="wl erscheint">${F.wegweiser[s.id].map(einZeile).join('')}</ul>
<p class="satz-unter erscheint">Nichts dabei? ${textlink(erstLink(), 'Erzählen Sie uns im Erstgespräch, worum es geht')}</p></div></section>

<section class="abschnitt" aria-labelledby="check-titel"><div class="w">${abKopf({ marke: 'Kostenlos', h2: 'Wo stehen Sie?', lead: x.check_satz, id: 'check-titel' })}
<div class="knoepfe erscheint">${checkKnoepfe}</div></div></section>

${wissenAbschnitt(artikelZu((a) => s.bereiche.includes(a.bereich)).slice(0, 4), 'Zum Weiterlesen')}

${schlussakt({ quelle: `${s.pfad}_ende`, bereich: s.id === 'unternehmen' ? 'innovation' : undefined })}`,
      });
    }
  }

  for (const a of W.artikel) {
    const b = B[a.bereich];
    const pfad = `wissen/${a.id}/index.html`;
    const url = absolut(artikelPfad(a));
    const genutzt = new Set();
    const teile = a.abschnitte.map((x) => abschnittHtml(x, genutzt, a.bereich)).join('\n');
    const quellenListe = [...genutzt].map(quelleVon);
    const angebote = a.angebote.map(angebot).filter(Boolean);
    const weiter = a.weiter.map((id) => W.artikel.find((x) => x.id === id)).filter(Boolean);
    neu(pfad, {
      titel: a.seo_titel.length + ' · Fokus Innovation'.length <= 65 ? `${a.seo_titel} · Fokus Innovation` : a.seo_titel,
      beschreibung: a.beschreibung,
      bildVorzeile: `${a.leitfaden ? 'Leitfaden' : 'Wissen'} · ${b.name}`,
      bildTitel: a.titel,
      aktiv: 'kostenlos',
      artikel: { veroeffentlicht: a.veroeffentlicht, aktualisiert: a.aktualisiert, autor: autor.name },
      schema: [{
        '@type': 'Article', '@id': `${url}#artikel`, headline: a.titel, description: klar(a.beschreibung), abstract: klar(a.kurz),
        image: absolut(`/assets/bild/og/${bildName(pfad)}.png`), datePublished: a.veroeffentlicht, dateModified: a.aktualisiert,
        author: { '@id': personId(autor) }, publisher: { '@id': ORG }, mainEntityOfPage: { '@id': `${url}#webseite` }, inLanguage: 'de-DE',
        articleSection: b.name, wordCount: klar(artikelText(a)).split(/\s+/).length, timeRequired: `PT${lesezeit(a)}M`,
        ...(quellenListe.length ? { citation: quellenListe.map((q) => ({ '@type': 'CreativeWork', name: q.quelle, url: q.link })) } : {}),
        ...(angebote.length ? { mentions: angebote.map((x) => ({ '@type': 'Service', name: x.name, url: absolut(produktPfad(x)) })) } : {}),
      }],
      main: `<section class="held artikel-held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([['/kostenlos/', 'Kostenlos'], [null, a.titel]])}${vorzeile(`${a.leitfaden ? 'Leitfaden · ' : ''}${b.name} · ${lesezeit(a)} Minuten Lesezeit`)}<h1 id="held-titel" class="glanz">${e(a.titel)}</h1>
<p class="autor-zeile">Von <a class="unterstrichen" href="/ueber-uns/#${personAnker(autor)}">${e(autor.name)}</a>, ${e(autor.rolle)} · <time datetime="${a.aktualisiert}">${e(datum(a.aktualisiert))}</time></p></div>
</div></section>

<section class="abschnitt" aria-label="Artikel"><div class="w artikel-raster">
<nav class="inhaltsangabe" aria-label="Inhalt dieses Artikels"><p class="etikett">Inhalt</p><ol>${a.abschnitte.map((x) => `<li><a href="#${slug(x.h)}">${e(x.h)}</a></li>`).join('')}</ol></nav>
<article class="artikel">
${kurzGesagt(a.kurz)}
${teile}
${a.vorlagen?.length ? `<aside class="artikel-mitnehmen erscheint" aria-labelledby="mitnehmen-titel"><p class="etikett" id="mitnehmen-titel">Zum Mitnehmen · kostenlos</p><ul class="vorlagen-liste">${a.vorlagen.map(vorlageVon).map((v) => vorlageZeile(v, false)).join('')}</ul></aside>` : ''}
${(() => { const c = checkZuBereich(a.bereich, `wissen_${a.id}`); return c ? `<aside class="artikel-check erscheint" aria-label="${e(c.name)}"><p class="etikett">Kostenlos · ${c.minuten} Minuten</p><p class="artikel-check-titel">${e(c.name)}</p><p>${e(c.text)}</p>${knopf(c.href, `${c.name} starten`)}</aside>` : ''; })()}
${quellenListe.length ? `<section class="quellen" aria-labelledby="quellen-titel"><h2 id="quellen-titel">Quellen</h2><ol>${quellenListe.map((q) => `<li><a href="${e(q.link)}" rel="noopener" target="_blank">${e(q.quelle)}</a></li>`).join('')}</ol></section>` : ''}
</article>
</div></section>

${fragen(a.fragen.map((x) => frageAus(x, a.bereich)), 'Fragen zum Thema')}
<section class="abschnitt" aria-labelledby="passend-titel"><div class="w">${abKopf({ marke: 'Angebote', h2: 'Passende Angebote', id: 'passend-titel' })}${angebotZeilen(angebote)}${netto}</div></section>
${weiter.length ? `<section class="abschnitt" aria-labelledby="weiter-titel"><div class="w">${abKopf({ marke: 'Weiterlesen', h2: 'Mehr zum Thema', id: 'weiter-titel' })}${wissenListe(weiter)}</div></section>` : ''}
${schlussakt({ quelle: `wissen_${a.id}_ende`, bereich: a.bereich })}`,
    });
  }

  // ── Begriffe von A bis Z ──
  {
    const sortiert = [...W.begriffe].sort((x, y) => x.name.localeCompare(y.name, 'de'));
    const buchstabe = (n) => (/^\d/.test(n) ? '0–9' : n[0].toLocaleUpperCase('de').replace('Ä', 'A').replace('Ö', 'O').replace('Ü', 'U'));
    const gruppen = [];
    for (const x of sortiert) { const g = buchstabe(x.name); const da = gruppen.find((y) => y.g === g); if (da) da.liste.push(x); else gruppen.push({ g, liste: [x] }); }
    const BASIS_B = absolut('/begriffe/');
    neu('begriffe/index.html', {
      seo: 'begriffe',
      bildVorzeile: 'Begriffe von A bis Z',
      bildTitel: 'Vertrieb, Sichtbarkeit und KI, kurz erklärt.',
      aktiv: 'kostenlos',
      schema: [{ '@type': 'DefinedTermSet', '@id': `${BASIS_B}#begriffe`, name: 'Begriffe aus Vertrieb, Sichtbarkeit und KI', inLanguage: 'de-DE', hasDefinedTerm: sortiert.map((x) => ({ '@type': 'DefinedTerm', '@id': `${BASIS_B}#${x.id}`, name: x.name, description: klar(x.text), url: `${BASIS_B}#${x.id}`, inDefinedTermSet: { '@id': `${BASIS_B}#begriffe` } })) }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([['/kostenlos/', 'Kostenlos'], [null, 'Begriffe']])}${vorzeile('Begriffe von A bis Z')}<h1 id="held-titel" class="glanz">${titel('Begriffe,', 'kurz erklärt.')}</h1><p class="lead">Die Wörter, die in Vertrieb, Sichtbarkeit und bei der Einführung von KI immer wieder fallen. So, wie wir sie verwenden.</p>
<nav class="az" aria-label="Buchstaben">${gruppen.map((g) => `<a href="#b-${slug(g.g)}">${e(g.g)}</a>`).join('')}</nav></div>
</div></section>
<section class="abschnitt" aria-label="Begriffe"><div class="w"><div class="begriffe erscheint">
${gruppen.map((g) => `<section class="begriff-gruppe" aria-labelledby="b-${slug(g.g)}"><h2 class="buchstabe" id="b-${slug(g.g)}">${e(g.g)}</h2><dl>${g.liste.map((x) => `<div id="${x.id}"><dt>${e(x.name)}</dt><dd><p>${t(x.text)}</p>${x.link ? textlink(x.link, 'Mehr dazu') : ''}</dd></div>`).join('')}</dl></section>`).join('\n')}
</div></div></section>
${schlussakt({ quelle: 'begriffe_ende' })}`,
    });
  }

  // ── Häufige Fragen: alle an einem Ort ──
  {
    // Fragen aus den Produktblättern; was nur für ein Angebot gilt, sagt die Frage hier dazu (sonst liest man es für beide Mandate).
    const UMBENANNT = { 'Wie viel Zeit kostet mich das?': 'Wie viel Zeit kostet mich der Head of Sales?', 'Wie viel Zeit bringen Sie ein?': 'Wie viel Zeit bringen Sie beim Chief Sales Officer ein?', 'Stellen Sie unsere Vertriebler ein?': 'Stellen Sie als CSO unsere Vertriebler ein?', 'Kann ich später zum Head of Sales wechseln?': 'Kann ich vom CSO zum Head of Sales wechseln?', 'Was passiert am Ende?': 'Was passiert am Ende des CSO-Mandats?' };
    const ausBlatt = (id, ausser) => produktBlatt(angebot(id)).fragen.filter((f) => !ausser.test(f.frage)).map((f) => ({ f: UMBENANNT[f.frage] ?? f.frage, a: f.antwort }));
    const gruppen = [
      ['vorab', 'Bevor Sie fragen', F.einwaende],
      ['einstieg', 'Einstieg und Innovations-Check', faqVon(seite.check_faq)],
      ['vertrieb', 'Vertrieb', [...zuschneiden(faqVon(['was-ist-der-unterschied-zwischen-head', 'was-kostet-der-tagesworkshop-und-was']), 'vertrieb'), ...ausBlatt('head-of-sales', /Unterschied/), ...ausBlatt('cso', /Unterschied|Investoren/)]],
      ['sichtbarkeit', 'Homepages und Videos', [...faqVon(['wie-schnell-ist-meine-homepage-fertig', 'kann-ich-spaeter-auf-ein-groesseres', 'sind-eure-videos-ki-generiert']), ...ausBlatt('homepage-story', /Wie schnell|größeres Paket/), ...ausBlatt('video-serie', /Kundenstimmen-Videos/)]],
      ['vertraege', 'Preise und Verträge', faqVon(['sind-die-preise-netto', 'gibt-es-rabatt', 'wie-lange-laufen-die-vertraege'])],
    ];
    START.faq = gruppen.flatMap(([k, n, liste]) => liste.map((x) => ({ frage: klar(x.f), antwort: klar(x.a), bereich: k, gruppe: n })));
    neu('fragen/index.html', {
      seo: 'fragen',
      bildVorzeile: 'Häufige Fragen',
      bildTitel: 'Was Sie vor dem ersten Gespräch wissen wollen.',
      aktiv: 'kostenlos',
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster einspaltig">
<div class="erscheint">${brotkrumen([['/kostenlos/', 'Kostenlos'], [null, 'Häufige Fragen']])}${vorzeile('Häufige Fragen')}<h1 id="held-titel" class="glanz">${titel('Häufige Fragen.', 'Kurz beantwortet.')}</h1><p class="lead">Was Gründer, Unternehmer und Mittelständler uns vor dem ersten Gespräch fragen. Fehlt Ihre Frage, ${anfrageInline('frage', 'Frage', 'schreiben Sie uns')}.</p>
<nav class="az breit" aria-label="Themen">${gruppen.map(([k, n]) => `<a href="#fragen-${k}">${e(n)}</a>`).join('')}</nav></div>
</div></section>
${gruppen.map(([k, n, liste]) => fragen(liste, n, { id: `fragen-${k}`, marke: 'Fragen', hinweis: false })).join('\n')}
${schlussakt({ quelle: 'fragen_ende' })}`,
    });
  }

  // ── Preise: alles auf einer Seite ──
  {
    const frei = [[erstLink(), F.erstgespraech.name, '30 Minuten per Video. Wir klären, ob und womit wir helfen können.'], ['/kostenlos/#checks', 'Drei Checks', 'Sichtbarkeit, Vertrieb und Innovation. Ergebnis sofort.'], ['/events/', F.events.titel, 'Auf Einladung, für Gäste kostenlos.']];
    const angeboteAlle = BEREICHE.flatMap(produkteIn);
    // Karten statt Tabellen (31.10., Prüfung Gestaltung): je Angebot Name, Preis, ein Satz, drei Punkte. Der Einstieg je Bereich ist markiert.
    const EINSTIEG = { sichtbarkeit: 'positionierung', vertrieb: 'tagesworkshop' };
    const karte = (a, k) => {
      const pb = produktBlatt(a);
      const pkt = (a.enthalten ?? pb?.immer ?? pb?.bausteine?.map((x) => x.name) ?? []).slice(0, 3);
      return `<li class="preis-karte${EINSTIEG[k] === a.id ? ' einstieg' : ''}"><a href="${produktPfad(a)}">${EINSTIEG[k] === a.id ? '<span class="marke-einstieg">Guter Einstieg</span>' : ''}<h3>${e(F.titel_h1?.[a.id] ?? a.name)}${bald(a) ? ' <span class="marke-bald">Bald</span>' : ''}</h3><p class="karte-preis glanz">${mkPreis(a, preisKurz(a))}</p><p class="karte-zusatz">${e(bald(a) ? 'Festpreis mit klarem Umfang, vorab vereinbart' : [a.preis_zusatz, F.umfang[a.id]].filter(Boolean).join(' · '))}</p><p class="karte-satz">${t(F.kurztexte[a.id] ?? pb?.versprechen ?? a.fuer_wen ?? '')}</p>${pkt.length ? punkte(pkt) : ''}<span class="textlink"><span>Mehr erfahren</span> ${PFEIL}</span></a></li>`;
    };
    const karten = (liste, k) => `<ul class="preis-karten erscheint">${liste.map((a) => karte(a, k)).join('')}</ul>`;
    // Reihenfolge der Preisseite (Kevin 31.10.: „Innovation muss immer im Fokus sein … gerade können wir am besten Sales verkaufen, danach
    // Homepages und Erklärvideos, also Sichtbarkeit“): Innovation oben als Fokus-Block, dann Vertrieb, dann Sichtbarkeit; Kostenlos unten.
    // Gilt NUR hier — der Rest der Website behält 01 Sichtbarkeit · 02 Vertrieb · 03 Innovation.
    const PREISE_REIHE = ['innovation', 'vertrieb', 'sichtbarkeit'];
    const freiKarte = (h, n, z) => `<li class="preis-karte"><a href="${h}"><h3>${e(n)}</h3><p class="karte-preis">kostenlos</p><p class="karte-satz">${e(z)}</p><span class="textlink"><span>Mehr erfahren</span> ${PFEIL}</span></a></li>`;
    const kondition = (x) => { const [k, ...v] = String(x).split(': '); return v.length ? `<div><dt>${e(k)}</dt><dd>${t(v.join(': '))}</dd></div>` : `<div><dt>${/Nutzungsrecht/.test(x) ? 'Nutzungsrecht' : /netto/.test(x) ? 'Preise' : 'Allgemein'}</dt><dd>${t(x)}</dd></div>`; };
    neu('preise/index.html', {
      seo: 'preise',
      aktiv: 'leistungen',
      bildVorzeile: 'Preise',
      bildTitel: 'Alle Preise auf einen Blick. Fest und netto.',
      schema: [{ '@type': 'OfferCatalog', '@id': `${absolut('/preise/')}#katalog`, name: 'Preise von Fokus Innovation', numberOfItems: angeboteAlle.length, itemListElement: angeboteAlle.filter((a) => !bald(a)).flatMap((a) => [angebotDaten(a)].flat().map((o) => ({ ...o, itemOffered: { '@type': 'Service', name: a.name, url: absolut(produktPfad(a)) } }))) }],
      main: `<section class="held" aria-labelledby="held-titel"><div class="w held-raster">
<div class="erscheint">${brotkrumen([[null, 'Preise']])}${vorzeile('Preise')}<h1 id="held-titel" class="glanz">${titel('Alle Preise.', 'Offen und netto.')}</h1><p class="lead">Jeder Preis gilt für den beschriebenen Umfang. Den genauen Festpreis bekommen Sie vor dem Start schriftlich, ohne Abrechnung nach Stunden. Die Details stehen auf der Seite des Angebots.</p>
<nav class="az breit" aria-label="Auf dieser Seite">${PREISE_REIHE.map((k) => `<a href="#preise-${k}">${e(B[k].name)}</a>`).join('')}${BS_LISTE.length ? '<a href="#preise-bausteine">Bausteine</a>' : ''}<a href="#kostenlos-titel">Kostenlos</a><a href="#konditionen-titel">Konditionen</a></nav></div>
${buehne('festpreis', VIDEOS.preise)}
</div></section>
<section class="abschnitt dunkel preis-fokus" aria-labelledby="preise-innovation"><div class="w">${abKopf({ marke: 'Unser Ziel · Innovation', h2: 'Wir rücken Innovation in den Fokus.', lead: `${B.innovation.satz} Der Weg dorthin führt oft über Vertrieb und Sichtbarkeit, deshalb stehen diese Preise gleich darunter.`, id: 'preise-innovation' })}
<ul class="preis-karten erscheint"><li class="preis-karte einstieg"><a href="${check('preise_fokus')}"><span class="marke-einstieg">Guter Einstieg</span><h3>Innovations-Check</h3><p class="karte-preis">kostenlos</p><p class="karte-satz">Wo Ihr Unternehmen bei Strategie, KI im Alltag, Abläufen, Daten und Team steht, im Vergleich mit Ihrer Branche.</p>${punkte(['Kurz: 20 Fragen in rund 10 Minuten, Ergebnis sofort', 'Ausführlich: rund 25 Minuten, Bericht per E‑Mail', 'Danach: das kostenlose Erstgespräch'])}<span class="textlink"><span>Check starten</span> ${PFEIL}</span></a></li>${karten(produkteIn('innovation'), 'innovation').replace(/^<ul class="preis-karten erscheint">|<\/ul>$/g, '')}</ul></div></section>
${PREISE_REIHE.filter((k) => k !== 'innovation').map((k) => `<section class="abschnitt" aria-labelledby="preise-${k}"><div class="w">${abKopf({ marke: B[k].name, h2: B[k].paar, lead: F.angebote_lead[k], id: `preise-${k}` })}
${gruppenIn(k).map((g, _, alle) => `${alle.length > 1 && g.name ? `<h3 class="gruppe-titel">${e(g.name)}</h3>` : ''}${karten(g.liste, k)}`).join('\n')}${k === 'sichtbarkeit' ? `<h3 class="gruppe-titel">Dazu buchbar</h3><dl class="daten erscheint">${inhalt.zusatzoptionen.map((z) => `<div><dt>${e(z.name)}<span class="leise">${e(z.fuer)}: ${e(z.leistung)}</span></dt><dd>${e(z.preis)}</dd></div>`).join('')}</dl>` : ''}</div></section>`).join('\n')}
${BS_LISTE.length ? `<section class="abschnitt" id="preise-bausteine" aria-labelledby="preise-bausteine-titel"><div class="w">${abKopf({ marke: 'Einzeln kaufen', h2: 'Bausteine zum Selbermachen.', lead: `Teile aus unserer Arbeit als fertiges Paket: Anleitung, ausgefülltes Beispiel, Bögen. Ab ${(Math.min(...BS_LISTE.map((b) => b.preis)) / 100).toLocaleString('de-DE')}\u00a0€ netto, auf Rechnung.`, id: 'preise-bausteine-titel' })}<ul class="preis-karten erscheint">${[BS_LISTE.find((b) => b.paket), ...BS_LISTE.filter((b) => !b.paket).sort((x, y) => x.preis - y.preis).slice(0, 1), BS_LISTE.find((b) => b.bereich === 'innovation')].filter((b, i, l) => b && l.indexOf(b) === i).map(bausteinKarte).join('')}</ul><div class="knoepfe erscheint">${textlink('/bausteine/', `Alle ${BS_LISTE.length} Bausteine`)}</div></div></section>` : ''}
<section class="abschnitt" aria-labelledby="kostenlos-titel"><div class="w">${abKopf({ marke: 'Der Einstieg', h2: 'Kostenlos', lead: 'Erstgespräch, Innovations-Check und das Gespräch danach kosten nichts und verpflichten zu nichts.', id: 'kostenlos-titel' })}
<ul class="preis-karten frei erscheint">${frei.map(([h, n, z]) => freiKarte(h, n, z)).join('')}</ul></div></section>
<section class="abschnitt" aria-labelledby="konditionen-titel"><div class="w">${abKopf({ marke: 'Gut zu wissen', h2: 'Zahlung und Konditionen', id: 'konditionen-titel' })}
<div class="zwei-teile"><div class="erscheint"><dl class="daten">${inhalt.konditionen.map(kondition).join('')}</dl></div><div class="erscheint"><p>${t(F.preise_nebenkosten)}</p><p class="leise klein-text">Unsere Angebote richten sich an Unternehmen.</p></div></div></div></section>
${schlussakt({ quelle: 'preise_ende' })}`,
    });
  }

  // ── Dateien für Suchmaschinen und KI-Suchen ──
  const htmlSeiten = seiten.filter((s) => s.pfad.endsWith('.html') && s.pfad !== '404.html');
  seiten.push({
    pfad: 'robots.txt', datei: true,
    html: SEO.oeffentlich
      ? `User-agent: *\nAllow: /\n\nSitemap: ${absolut('/sitemap.xml')}\n`
      : '# Vorschau: noch nicht für Suchmaschinen freigegeben.\nUser-agent: *\nDisallow: /\n',
  });
  seiten.push({
    pfad: 'sitemap.xml', datei: true,
    html: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${htmlSeiten.map((s) => `<url><loc>${absolut(webPfad(s.pfad))}</loc><lastmod>${s.geaendert}</lastmod></url>`).join('\n')}\n</urlset>\n`,
  });
  seiten.push({
    pfad: 'site.webmanifest', datei: true,
    html: `${JSON.stringify({ name: F.marke.name, short_name: 'Fokus', description: klar(F.marke.beschreibung), lang: 'de', start_url: '/', display: 'browser', background_color: '#F6F4F0', theme_color: '#F6F4F0', icons: [{ src: '/assets/bild/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/bild/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2)}\n`,
  });
  seiten.push({ pfad: `${SEO.indexnow}.txt`, datei: true, html: `${SEO.indexnow}\n` });

  // llms.txt (Vorschlag llmstxt.org): kurzer Wegweiser für KI-Assistenten, dazu llms-full.txt mit allen Inhalten als Klartext.
  const mdLink = (n, p) => `[${n}](${absolut(p)})`;
  const angebotMd = (a) => `- ${mdLink(a.name, produktPfad(a))}: ${bald(a) ? 'bald, Anfrage schon jetzt möglich, Preis auf Anfrage' : `ab ${erster(a)} netto${a.preis_zusatz ? ` (${klar(a.preis_zusatz)})` : ''}`}. ${klar(F.kurztexte[a.id] ?? produktBlatt(a)?.versprechen ?? a.fuer_wen ?? '')}${bald(a) ? ' Startet in Kürze.' : ''}`;
  const faktenMd = [...F.fakten, ['Betreiber', `${anbieter.name}, ${anbieter.adresse.map(klar).join(', ')}`], ['Kontakt', seite.kontakt.mail]].map(([k, v]) => `- ${k}: ${klar(v)}`).join('\n');
  const leistungenMd = BEREICHE.map((k) => `### ${B[k].name}: ${B[k].paar}\n\n${klar(B[k].kurz)}\n\n${k === 'innovation' ? `- ${mdLink('Innovations-Check', '/innovations-check/')}: kostenlos, rund 10 Minuten. ${klar(F.check.text)}\n` : ''}${produkteIn(k).map(angebotMd).join('\n')}`).join('\n\n');
  seiten.push({
    pfad: 'llms.txt', datei: true,
    html: `# ${F.marke.name}

> ${klar(F.marke.beschreibung)} Claim: „${F.marke.claim}“

${klar(F.start.lead)} Alle Preise sind fest, netto und auf der Website veröffentlicht.

## Auf einen Blick

${faktenMd}

## Leistungen

${leistungenMd}

## Wissen

${W.artikel.map((a) => `- ${mdLink(a.titel, artikelPfad(a))}: ${klar(a.beschreibung)}`).join('\n')}

## Weitere Seiten

- ${mdLink('Alle Preise', '/preise/')}: jedes Angebot mit Preis und Konditionen
- ${mdLink('Häufige Fragen', '/fragen/')}: Check, Vertrieb, Homepages, Videos, Verträge
- ${mdLink('Begriffe von A bis Z', '/begriffe/')}: ${W.begriffe.length} Begriffe aus Vertrieb, Sichtbarkeit und KI
- ${mdLink(F.events.titel, '/events/')}: ${klar(F.events.text)}
- ${mdLink('Über uns', '/ueber-uns/')}: Leitidee, Team, Werte
- ${mdLink('Kontakt', '/kontakt/')}: ${seite.kontakt.mail}

## Optional

- ${mdLink('Alle Inhalte als Klartext', '/llms-full.txt')}
`,
  });
  const artikelMd = (a) => `## ${a.titel}\n\nQuelle: ${absolut(artikelPfad(a))} · ${autor.name} · ${a.aktualisiert}\n\nKurz gesagt: ${klar(a.kurz)}\n\n${a.abschnitte.map((x) => {
    const teile = [`### ${x.h}`];
    if (x.faq) teile.push(klar(frageAus({ faq: x.faq }, a.bereich).a));
    for (const p of x.absaetze ?? []) teile.push(klar(p));
    if (x.punkte) teile.push(x.punkte.map((p) => `- ${klar(p)}`).join('\n'));
    if (x.schritte) teile.push(x.schritte.map((s, i) => `${i + 1}. ${s.titel}: ${klar(s.text)}`).join('\n'));
    if (x.tabelle) teile.push(`${x.tabelle.titel}${x.tabelle.hinweis ? ` (${klar(x.tabelle.hinweis)})` : ''}:\n${x.tabelle.zeilen.map((z) => `- ${z.map(klar).filter(Boolean).join(' | ')}`).join('\n')}`);
    if (x.zeitplan_von) teile.push(produktBlatt(angebot(x.zeitplan_von)).ablauf.zeilen.map((z) => `- ${z.map(klar).filter(Boolean).join(': ')}`).join('\n'));
    for (const k of [x.beleg, x.beleg_danach].filter(Boolean)) teile.push(`${F.belege[k].wert} ${klar(F.belege[k].text)} (Quelle: ${F.belege[k].quelle}, ${F.belege[k].link})`);
    if (x.zahl) { const z = zahlVon(x.zahl); teile.push(`${z.wert}: ${klar(z.satz)} (Quelle: ${z.quelle}, ${z.url})`); }
    for (const p of x.absaetze_danach ?? []) teile.push(klar(p));
    return teile.join('\n\n');
  }).join('\n\n')}\n\n${a.fragen.map((x) => frageAus(x, a.bereich)).map((f) => `Frage: ${klar(f.f)}\nAntwort: ${klar(f.a)}`).join('\n\n')}`;
  const fragenAlle = [...new Map([...faqVon(seite.check_faq), ...inhalt.faq].map((f) => [f.id, f])).values()];
  seiten.push({
    pfad: 'llms-full.txt', datei: true,
    html: `# ${F.marke.name}: alle Inhalte als Klartext

Stand: ${Object.values(STAND).map((x) => x.datum).sort().at(-1) ?? SEO.stand}. Website: ${absolut('/')}. Diese Datei fasst die Website für KI-Assistenten zusammen. Maßgeblich sind die Seiten selbst.

## Wer wir sind

${klar(F.marke.beschreibung)} ${klar(F.leitidee.lead)} ${F.leitidee.absaetze.map(klar).join(' ')}

${faktenMd}

${F.team.map((p) => `- ${p.name} (${p.rolle}): ${klar(p.text)}`).join('\n')}${F.team_netzwerk ? `\n- ${F.team_netzwerk.titel} (${F.team_netzwerk.rolle}): ${klar(F.team_netzwerk.text)} Fachgebiete: ${F.team_netzwerk.felder.join(', ')}.` : ''}

Was wir nicht sind: ${F.nicht.map((x) => `${x.titel} (${klar(x.text)})`).join('; ')}.

## Leistungen und Preise

${leistungenMd}

Zahlung und Konditionen: ${inhalt.konditionen.map(klar).join('; ')}.

## Häufige Fragen

${fragenAlle.map((f) => `Frage: ${klar(f.f)}\nAntwort: ${klar(f.a)}`).join('\n\n')}

## Begriffe

${[...W.begriffe].sort((x, y) => x.name.localeCompare(y.name, 'de')).map((x) => `- ${x.name}: ${klar(x.text)}`).join('\n')}

# Ratgeber

${W.artikel.map(artikelMd).join('\n\n')}
`,
  });
  seiten.stand = STAND;
  // Firmierungen sind Rechtsangaben (Impressum, Verkäufer der Bausteine), keine Marke — der Prüfer lässt genau diese Namen zu.
  seiten.firmierungen = Object.values(seite.anbieter ?? {}).map((a) => a.name).filter((n) => n && !istPlatzhalter(n));
  const cent = (txt) => Math.round(Number(String(txt).replace(/[^\d,]/g, '').replace(',', '.')) * 100);
  seiten.startwerte = {
    hinweis: 'Startwerte aus dem statischen Stand von fokusinnovation.de (node prototype/fokus-innovation/bauen.mjs --startwerte <datei>). Alles hier steht öffentlich auf der Website. Für die Demo-Saat nur die Struktur übernehmen (ids, Bereiche, welche Felder es gibt), die Werte erfinden.',
    stand: HEUTE,
    markierungen: {
      'preis:<angebot>': 'angebote[].preisText — Listen, Karten, Preiskasten der Angebotsseite',
      'baustein:<id>': 'bausteine[].preisNetto (Cent) — Karten, Bausteine-Seite, Hinweis an der Vorlage',
      'text:<schlüssel>': 'texte[schlüssel] — heute events.einleitung und events.termine',
      events: 'events[] ab heute (datum JJJJ-MM-TT oder JJJJ-MM-TTThh:mm), höchstens 6 — Events-Seite',
      'termin-naechster': 'erstes kommendes Event — Startseite und Events-Seite',
    },
    angebote: ANGEBOTE.map((a, i) => ({ id: a.id, bereich: slug(a.bereich), titel: klar(F.titel_h1?.[a.id] ?? a.name), kurz: klar(F.kurztexte?.[a.id] ?? produktBlatt(a)?.versprechen ?? a.fuer_wen ?? ''), preisText: bald(a) ? null : preisKurz(a).replace(/\u00a0/g, ' '), preisNetto: bald(a) ? null : cent(erster(a)), ab: !bald(a), monatlich: monatlich(a), bald: bald(a), seite: produktPfad(a), rang: i + 1 })),
    bausteine: BS_LISTE.map((b, i) => ({ id: b.id, bereich: b.bereich, titel: b.titel, kurz: b.kurz, preisNetto: b.preis, paket: !!b.paket, seite: b.seite, rang: i + 1 })),
    events: [],
    faq: START.faq,
    fakten: F.fakten.map(([k, v]) => ({ titel: k, text: klar(v) })),
    texte: { 'events.einleitung': klar(F.events.held_text ?? F.events.text), 'events.termine': klar(F.events.termine) },
    bilder: [],
  };
  return seiten;
}

// ── Prüfen: Regeln der Seite ─────────────────────────────────────────────────────────────────────────────────────────
const SPERRWOERTER = [
  [/\bMAKE\b/, 'alter Markenname „MAKE“'], [/KEMARIS/, 'KEMARIS'], [/Make\.One/i, 'Make.One'], [/\bConnect\b/i, 'Connect (nicht erwähnen)'],
  [/MAKE OS|Make OS/i, 'Name der eigenen Software'], [/\b(führend|revolutionär|disruptiv|einzigartig|Gamechanger)\b/i, 'Superlativ'],
  [/Made in Germany|Deutschland first/i, 'Nationalstolz-Vokabular'], [/Investor(en)?-?(zugang|zugänge|kontakte)/i, 'Investoren nur im Gespräch'],
];
export function pruefen(seiten) {
  const fehler = [];
  const pfade = new Set(seiten.map((s) => s.pfad));
  const ids = new Map(seiten.map((s) => [s.pfad, new Set([...s.html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
  const ziel = (href) => (href === '/' ? 'index.html' : `${href.replace(/^\//, '')}${href.endsWith('/') ? 'index.html' : ''}`);
  const titel = new Map();
  const beschreibungen = new Map();
  let platzhalter = 0;
  for (const s of seiten) {
    const sichtbar = s.html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    const ohneFirmierung = (seiten.firmierungen ?? []).reduce((x, n) => x.split(e(n)).join(' '), sichtbar);
    for (const [re, was] of SPERRWOERTER) if (re.test(ohneFirmierung)) fehler.push(`${s.pfad}: ${was}`);
    if (/makeinnovation/i.test(sichtbar.replace(/kevin@makeinnovation\.de/g, ''))) fehler.push(`${s.pfad}: alte Domain im Text`);
    if (/\bZoe\b/.test(sichtbar) && !/KI-Assistentin/.test(sichtbar)) fehler.push(`${s.pfad}: Zoe ohne Kennzeichnung als KI-Assistentin`);
    if (/\{(preis|ab|zusatz):/.test(s.html)) fehler.push(`${s.pfad}: Platzhalter nicht ersetzt`);
    if (s.datei) continue;
    if (/\sstyle="/.test(s.html)) fehler.push(`${s.pfad}: Inline-Stil`);
    if (/<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>/.test(s.html)) fehler.push(`${s.pfad}: Inline-Skript`);
    if (/\son[a-z]+="/.test(s.html)) fehler.push(`${s.pfad}: Ereignis-Attribut`);
    if (/<(script|img|link|iframe|source|video)\b[^>]*\s(src|href)="https?:/.test(s.html.replace(/<link rel="(canonical|alternate)"[^>]*>/g, ''))) fehler.push(`${s.pfad}: fremde Quelle`);
    // Formulare nur „Vorlage per E-Mail anfordern“ (31.10.): ohne action/method, nur auf den Vorschau-Seiten der Vorlagen.
    for (const f of s.html.match(/<form\b[^>]*>/g) ?? []) if (!(/^<form class="anfordern-form" data-unterlage="[a-z0-9-]+" novalidate hidden>$/.test(f) && s.pfad.startsWith('kostenlos/vorlagen/')) && !(/^<form class="anfordern-form bestell-form" data-baustein="[a-z0-9-]+" novalidate hidden>$/.test(f) && s.pfad.startsWith('bausteine/'))) fehler.push(`${s.pfad}: Formular`);
    platzhalter += (s.html.match(/class="ph"/g) ?? []).length;
    for (const [, href] of s.html.matchAll(/\shref="([^"]+)"/g)) {
      if (href.startsWith('/assets/vorlagen/') && !existsSync(join(ORDNER, href))) { fehler.push(`${s.pfad}: Vorlage fehlt ${href}`); continue; }
      if (/^(https?:|mailto:|tel:)/.test(href) || href.startsWith('/check') || href === '/newsletter' || href === '/anfrage' || /^\/anfrage\?anlass=[a-z0-9-]{1,60}$/.test(href) || href === ERSTGESPRAECH || BUCHUNG.test(href) || href.startsWith('/css/') || href.startsWith('/js/') || href.startsWith('/assets/') || ['/favicon.ico', '/site.webmanifest'].includes(href)) continue;
      const [teil, hash] = href.split('#');
      const seite = teil ? ziel(teil.split('?')[0]) : s.pfad;
      if (!pfade.has(seite)) { fehler.push(`${s.pfad}: Link ins Leere ${href}`); continue; }
      if (hash && !ids.get(seite).has(hash)) fehler.push(`${s.pfad}: Anker fehlt ${href}`);
    }
    // Suche: ein h1, Titel und Beschreibung in Google-Länge und je Seite einmalig, Canonical, gültige strukturierte Daten.
    const h1 = (s.html.match(/<h1\b/g) ?? []).length;
    if (h1 !== 1) fehler.push(`${s.pfad}: ${h1} statt einer Hauptüberschrift`);
    if (s.pfad === '404.html') continue;
    if (s.titel.length < 15 || s.titel.length > 65) fehler.push(`${s.pfad}: Titel hat ${s.titel.length} Zeichen (15–65)`);
    if (s.beschreibung.length < 110 || s.beschreibung.length > 165) fehler.push(`${s.pfad}: Beschreibung hat ${s.beschreibung.length} Zeichen (110–165)`);
    if (titel.has(s.titel)) fehler.push(`${s.pfad}: Titel doppelt mit ${titel.get(s.titel)}`); else titel.set(s.titel, s.pfad);
    if (beschreibungen.has(s.beschreibung)) fehler.push(`${s.pfad}: Beschreibung doppelt mit ${beschreibungen.get(s.beschreibung)}`); else beschreibungen.set(s.beschreibung, s.pfad);
    if (!s.html.includes(`<link rel="canonical" href="https://`)) fehler.push(`${s.pfad}: Canonical fehlt`);
    const ld = s.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    try {
      const daten = JSON.parse(ld[1]);
      for (const knoten of daten['@graph']) for (const [k, v] of Object.entries(knoten)) if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) fehler.push(`${s.pfad}: strukturierte Daten, ${knoten['@type']}.${k} leer`);
      for (const f of daten['@graph'].filter((x) => x['@type'] === 'FAQPage').flatMap((x) => x.mainEntity)) if (!sichtbar.replace(/\s+/g, ' ').includes(f.name.replace(/&/g, '&amp;').slice(0, 40))) fehler.push(`${s.pfad}: Frage in den Daten, aber nicht auf der Seite: ${f.name}`);
    } catch (err) { fehler.push(`${s.pfad}: strukturierte Daten ungültig (${err.message})`); }
    if (s.bild && !existsSync(join(ORDNER, s.bild.datei))) fehler.push(`${s.pfad}: Vorschaubild fehlt (node bilder.mjs)`);
  }
  for (const datei of ['css/fokus.css', 'css/film.css', 'js/frueh.js', 'js/seite.js', 'js/film.js', 'js/szene.js', 'js/rechner.js', 'js/unterlage.js', 'js/app-wege.js', 'js/bestellung.js', 'js/inhalt.js', 'assets/zeichen.svg', 'assets/schriften/schibsted-grotesk-latin.woff2', 'assets/bild/logo.png', 'assets/bild/apple-touch-icon.png', 'assets/bild/icon-192.png', 'assets/bild/icon-512.png', 'favicon.ico']) if (!existsSync(join(ORDNER, datei))) fehler.push(`fehlt: ${datei}${/bild|favicon/.test(datei) ? ' (node bilder.mjs)' : ''}`);
  return { fehler, platzhalter };
}

/**
 * Soll-Stand der Vorlagen-Dateien herstellen (bzw. beim Prüfen nur melden): kurze Vorlagen in assets/vorlagen (öffentlich), lange in
 * unterlagen/ mit katalog.json (Vertrag mit der App: lib/unterlage — id, titel, seite, dateien[{ art, datei, name }]). Liefert die Änderungen.
 */
function vorlagenVerteilen(liste, nurPruefen) {
  const aenderungen = [];
  const oeffentlich = join(ORDNER, 'assets', 'vorlagen');
  const gleich = (a, b) => existsSync(b) && readFileSync(a).equals(readFileSync(b));
  const soll = new Map(); // Zielpfad → Quelle
  for (const v of liste) for (const d of v.dateien) soll.set(join(v.perMail ? UNTERLAGEN : oeffentlich, d.datei), join(VORLAGEN_QUELLE, d.datei));
  const katalog = `${JSON.stringify({ hinweis: 'Gebaut von prototype/fokus-innovation/bauen.mjs — nicht von Hand ändern. Lange Vorlagen, nur per E-Mail (/api/unterlage).', unterlagen: liste.filter((v) => v.perMail).map((v) => ({ id: v.id, titel: v.titel, seite: v.seite, dateien: v.dateien.map((d) => ({ art: d.art, datei: d.datei, name: `${v.titel.replace(/[:/\\?*"<>|]+/g, ' –').replace(/\s+/g, ' ').trim()}.${d.art}` })) })) }, null, 2)}\n`;
  const katalogDatei = join(UNTERLAGEN, 'katalog.json');
  if (!existsSync(katalogDatei) || readFileSync(katalogDatei, 'utf8') !== katalog) { aenderungen.push('unterlagen/katalog.json'); if (!nurPruefen) { mkdirSync(UNTERLAGEN, { recursive: true }); writeFileSync(katalogDatei, katalog); } }
  for (const [ziel, quelle] of soll) {
    if (gleich(quelle, ziel)) continue;
    aenderungen.push(ziel.slice(join(ORDNER, '..', '..').length + 1));
    if (!nurPruefen) { mkdirSync(dirname(ziel), { recursive: true }); copyFileSync(quelle, ziel); }
  }
  // Was nicht (mehr) dorthin gehört, fliegt raus — vor allem eine lange Vorlage im öffentlichen Ordner.
  for (const ordner of [oeffentlich, UNTERLAGEN]) {
    if (!existsSync(ordner)) continue;
    for (const f of readdirSync(ordner)) {
      if (f === 'katalog.json' || soll.has(join(ordner, f)) || statSync(join(ordner, f)).isDirectory()) continue;
      aenderungen.push(`entfernt: ${join(ordner, f).slice(join(ORDNER, '..', '..').length + 1)}`);
      if (!nurPruefen) unlinkSync(join(ordner, f));
    }
  }
  return aenderungen;
}

/**
 * Bausteine für die App: Dateien nach unterlagen/bausteine/ (nie öffentlich) + katalog.json (Vertrag mit lib/bausteine in der App:
 * id, titel, bereich, preis netto in Cent, seite, dateien[{ art, datei, name }], paket?[ids]). Liefert die Änderungen.
 */
function bausteineVerteilen(liste, nurPruefen) {
  const aenderungen = [];
  const dateiName = (titel, art) => `${titel.replace(/[:/\\?*"<>|]+/g, ' –').replace(/\s+/g, ' ').trim()}.${art}`;
  const katalog = `${JSON.stringify({ hinweis: 'Gebaut von prototype/fokus-innovation/bauen.mjs — nicht von Hand ändern. Bezahlte Bausteine, Lieferung nur über die App nach Freigabe.', bausteine: liste.map((b) => ({ id: b.id, titel: b.titel, bereich: b.bereich, preis: b.preis, seite: b.seite, dateien: b.dateien.map((d) => ({ art: d.art, datei: d.datei, name: dateiName(b.titel, d.art) })), ...(b.paket ? { paket: b.paket } : {}) })) }, null, 2)}\n`;
  const katalogDatei = join(BAUSTEINE_ZIEL, 'katalog.json');
  if (!existsSync(katalogDatei) || readFileSync(katalogDatei, 'utf8') !== katalog) { aenderungen.push('unterlagen/bausteine/katalog.json'); if (!nurPruefen) { mkdirSync(BAUSTEINE_ZIEL, { recursive: true }); writeFileSync(katalogDatei, katalog); } }
  const soll = new Set(['katalog.json']);
  for (const b of liste) for (const d of b.dateien) {
    soll.add(d.datei);
    const quelle = join(BAUSTEINE_QUELLE, d.datei), ziel = join(BAUSTEINE_ZIEL, d.datei);
    if (existsSync(ziel) && readFileSync(quelle).equals(readFileSync(ziel))) continue;
    aenderungen.push(`unterlagen/bausteine/${d.datei}`);
    if (!nurPruefen) { mkdirSync(BAUSTEINE_ZIEL, { recursive: true }); copyFileSync(quelle, ziel); }
  }
  if (existsSync(BAUSTEINE_ZIEL)) for (const f of readdirSync(BAUSTEINE_ZIEL)) if (!soll.has(f)) { aenderungen.push(`entfernt: unterlagen/bausteine/${f}`); if (!nurPruefen) unlinkSync(join(BAUSTEINE_ZIEL, f)); }
  return aenderungen;
}

// ── Schreiben oder prüfen ────────────────────────────────────────────────────────────────────────────────────────────
function lauf() {
  const nurPruefen = process.argv.includes('--pruefen');
  const startwerteZiel = process.argv.includes('--startwerte') ? process.argv[process.argv.indexOf('--startwerte') + 1] : null;
  if (startwerteZiel) {
    if (!startwerteZiel.endsWith('.json')) throw new Error('--startwerte braucht eine Zieldatei *.json');
    writeFileSync(startwerteZiel, `${JSON.stringify(seitenBauen().startwerte, null, 2)}\n`);
    console.log(`Startwerte geschrieben: ${startwerteZiel}`);
    return;
  }
  // Film-Modul mit Versionsstempel importieren (31.10., Prüfung Technik): sonst trifft nach einem Upload neues film.js auf altes szene.js.
  if (!nurPruefen) {
    const filmDatei = join(ORDNER, 'js/film.js');
    const alt = readFileSync(filmDatei, 'utf8');
    const neuText = alt.replace(/from '\.\/szene\.js(\?v=[a-f0-9]+)?'/, `from './szene.js?v=${stempel('js/szene.js')}'`);
    if (neuText !== alt) writeFileSync(filmDatei, neuText);
  }
  const q = quellen();
  const seiten = seitenBauen(q);
  let abweichend = 0;
  // Vorlagen verteilen (31.10.): kurze öffentlich nach assets/vorlagen, lange nur nach unterlagen/ (+ katalog.json für die App) — und eine lange
  // Vorlage nie zusätzlich öffentlich. Beim Prüfen wird nur verglichen.
  for (const d of [...vorlagenVerteilen(vorlagenListe(q), nurPruefen), ...bausteineVerteilen(bausteineListe(q), nurPruefen)]) { abweichend++; console.log(`${nurPruefen ? 'weicht ab' : 'verteilt'}: ${d}`); }
  for (const s of seiten) {
    const zielDatei = join(ORDNER, s.pfad);
    const vorher = existsSync(zielDatei) ? readFileSync(zielDatei, 'utf8') : null;
    if (vorher === s.html) continue;
    abweichend++;
    if (nurPruefen) { console.log(`weicht ab: ${s.pfad}`); continue; }
    mkdirSync(dirname(zielDatei), { recursive: true });
    writeFileSync(zielDatei, s.html);
  }
  if (!nurPruefen) writeFileSync(join(ORDNER, 'inhalt', 'seitenstand.json'), `${JSON.stringify(Object.fromEntries(Object.entries(seiten.stand).sort()), null, 2)}\n`);
  const { fehler, platzhalter } = pruefen(seiten);
  console.log(nurPruefen ? `${seiten.length} Seiten, ${abweichend} weichen ab` : `${seiten.length} Seiten, ${abweichend} neu geschrieben`);
  console.log(`Platzhalter für Kevin: ${platzhalter}`);
  for (const f of fehler) console.log(`REGEL: ${f}`);
  if (fehler.length || (nurPruefen && abweichend)) process.exit(1);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) lauf();
