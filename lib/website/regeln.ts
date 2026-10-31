// ─── Website — Inhalte der Instanz selbst pflegen (31.10., rein, client-sicher, getestet) ─────────────────────────────────────────────
// Kevin 31.10.: „bei Marketing noch einen Button mit Homepage und da unsere Sachen der Homepage alles sauber sammeln wie Produkte, Bilder, die Checks …
// wir werden immer wieder an der Homepage bauen“ — Stufe 1 sammelt (Markttraktion › Website), Stufe 2 pflegt die Inhalte hier selbst.
//
// EIN Bestand `website-inhalt` (Instanz = Haushalt des Inhabers, Speicher-Register `H`): Angebote/Leistungen, Überlagerung des Bausteine-Katalogs,
// Events „auf der Website zeigen“, FAQ, Fakten für die KI-Suche (llms.txt-Zeilen), Text-Bausteine je Schlüssel, freigegebene Bilder, Einstellungen
// (Bereiche, Buchungsseite fürs Erstgespräch). Keine Namen, keine Firmen, keine Preise im Code — alles sind Daten der Instanz.
//
// Schreiben nur als Einzel-Änderungen mit Stand je Eintrag (`opsAnwenden`): ein bestehender Eintrag ohne passenden Stand → Konflikt (409, nie still
// überschreiben), Grenzen → 413 (nie kürzen), Unsinn → 400. Die Website liest über die öffentliche Schnittstelle `GET /api/website/inhalt`
// (Vertrag: WEBSITE_VERTRAG_INHALT.md) — nur sichtbare Einträge, nur öffentliche Felder (`oeffentlicherInhalt`).

import type { Baustein } from '@/lib/bausteine/regeln';

export const WEBSITE_BESTAND = 'website-inhalt';

/** Vorgabe der Bereiche (frei wählbare Werteliste der Instanz — die Vorgabe gilt nur, solange keine eigene gespeichert ist). */
export const BEREICHE_VORGABE: readonly string[] = ['innovation', 'vertrieb', 'sichtbarkeit'];

export const GRENZEN = {
  angebote: 60, bausteine: 120, events: 60, faq: 80, fakten: 80, texte: 200, bilder: 120, bereiche: 20,
  titel: 160, kurz: 600, preisText: 60, frage: 300, antwort: 3000, fakt: 400, faktTitel: 80, gruppe: 80, text: 2000, alt: 300, link: 300, bereich: 40,
  ops: 100, preisCent: 10_000_000, rang: 100_000,
} as const;

// ── Typen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface WebAngebot {
  id: string;
  bereich: string;
  titel: string;
  kurz?: string;
  /** Preistext der Website („ab … €“, „auf Anfrage“) — ≤ 60 Zeichen, ohne < > (die Website setzt ihn so ein, fokusinnovation/js/inhalt.js); fehlt er, bleibt dort der gebaute Text. */
  preisText?: string;
  /** Netto in Cent (optional). */
  preisNetto?: number;
  /** „ab“ vor dem Preis. */
  ab?: boolean;
  /** Bezug zum Produktkatalog (lib/crm/produkte) — nur für den Abgleich, nie öffentlich. */
  produktId?: string;
  /** Monatlicher Preis (die Website schreibt „/ Monat“ dazu). */
  monatlich?: boolean;
  /** Noch nicht buchbar („bald“). */
  bald?: boolean;
  /** Seite auf der Website (/… oder https://). */
  seite?: string;
  sichtbar: boolean;
  rang: number;
}
/** Überlagerung eines Bausteins aus unterlagen/bausteine/katalog.json (id = Kennung des Bausteins). Ohne Eintrag gilt die Datei. */
export interface WebBaustein { id: string; titel?: string; preisNetto?: number; kurz?: string; sichtbar?: boolean; rang?: number }
/** Ein eigenes Event auf der Website (nie besuchte, nie Gäste). */
export interface WebEvent { id: string; eventId: string; sichtbar: boolean; anmeldeLink?: string }
export interface WebFaq { id: string; frage: string; antwort: string; bereich?: string; /** Überschrift der Gruppe auf der Website. */ gruppe?: string; sichtbar: boolean; rang: number }
export interface WebFakt { id: string; titel?: string; text: string; sichtbar: boolean; rang: number }
/** Text-Baustein je Schlüssel (z. B. „start.titel“) — die Website entscheidet, welche sie nutzt. */
export interface WebText { id: string; text: string }
/** Ein freigegebenes Bild (Medien-Ablage, Kanal „Website“). `medium` bleibt intern; öffentlich heißt das Bild nach `id`. */
export interface WebBild { id: string; medium: string; alt: string; sichtbar: boolean; rang: number }
export interface WebEinstellungen {
  bereiche?: string[];
  /** Buchungsseite für das Erstgespräch (`/erstgespraech` leitet dorthin) — fehlt = die Buchungsseite des Checks. */
  erstgespraechSlug?: string;
}

export interface WebsiteInhalt {
  angebote: WebAngebot[];
  bausteine: WebBaustein[];
  events: WebEvent[];
  faq: WebFaq[];
  fakten: WebFakt[];
  texte: WebText[];
  bilder: WebBild[];
  einstellungen: WebEinstellungen;
  geaendert?: string;
}

export type WebListe = 'angebote' | 'bausteine' | 'events' | 'faq' | 'fakten' | 'texte' | 'bilder';
export const WEB_LISTEN: readonly WebListe[] = ['angebote', 'bausteine', 'events', 'faq', 'fakten', 'texte', 'bilder'];

export const leererInhalt = (): WebsiteInhalt => ({ angebote: [], bausteine: [], events: [], faq: [], fakten: [], texte: [], bilder: [], einstellungen: {} });

// ── Kennungen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const EIGEN_ID = /^w[a-z]-[a-z0-9-]{4,64}$/;
export const KENNUNG_OK: Record<WebListe, RegExp> = {
  faq: EIGEN_ID, fakten: EIGEN_ID, events: EIGEN_ID, bilder: EIGEN_ID,
  // Angebote und Bausteine heißen wie ihre Seite auf der Website (die Website findet sie über `data-mk="preis:<id>"`).
  angebote: /^[a-z0-9-]{1,60}$/, bausteine: /^[a-z0-9-]{1,60}$/,
  texte: /^[a-z][a-z0-9_.-]{0,60}$/,
};
/** Neue eigene Kennung (Präfix je Liste) — im Browser wie auf dem Server. */
export const PRAEFIX: Record<'faq' | 'fakten' | 'events' | 'bilder', string> = { faq: 'wq', fakten: 'wf', events: 'we', bilder: 'wb' };
export function neueWebKennung(liste: keyof typeof PRAEFIX): string {
  return `${PRAEFIX[liste]}-${crypto.randomUUID()}`;
}
const PRODUKT_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const MEDIUM_ID = /^md-[0-9a-f-]{36}$/;
const SLUG = /^[a-z0-9-]{1,40}-[a-f0-9]{24}$/;

// ── Stand (Fingerabdruck je Eintrag, FNV-1a über das sortierte JSON) ─────────────────────────────────────────────────────────────

function sortiert(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(sortiert);
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x as object).sort().map(k => [k, sortiert((x as Record<string, unknown>)[k])]));
  return x;
}
export function fingerabdruck(x: unknown): string {
  const s = JSON.stringify(sortiert(x));
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

// ── Säubern ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export class WebFehler extends Error { constructor(msg: string, readonly status: 400 | 409 | 413) { super(msg); } }

const zeile = (x: unknown): string => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '');
const absatz = (x: unknown): string => (typeof x === 'string' ? x.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '');
function laenge(wert: string, max: number, was: string): string {
  if (wert.length > max) throw new WebFehler(`${was}: höchstens ${max} Zeichen (nichts gekürzt, nichts gespeichert).`, 413);
  if (/[<>]/.test(wert)) throw new WebFehler(`${was}: bitte ohne < und >.`, 400);
  return wert;
}
const bool = (x: unknown, vorgabe: boolean) => (typeof x === 'boolean' ? x : vorgabe);
const rangVon = (x: unknown): number => (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= GRENZEN.rang ? x : 0);
/** Link der Website: eigener Pfad (/…) oder https://. */
/** Link der Website: eigener Pfad (/…, nur a–z 0–9 / _ -) oder https://… — dieselbe Regel, mit der die Website liest (fokusinnovation/js/inhalt.js). */
export function linkOk(x: string): boolean {
  if (/^\/[a-z0-9/_-]{1,120}$/.test(x)) return true;
  if (!/^https:\/\/[^\s<>"]{3,300}$/.test(x)) return false;
  try { return new URL(x).protocol === 'https:'; } catch { return false; }
}
function linkVon(x: unknown, was: string): string | undefined {
  const l = zeile(x);
  if (!l) return undefined;
  if (!linkOk(l)) throw new WebFehler(`${was}: nur ein Pfad der Website (/…) oder https://…`, 400);
  return l;
}
function preisVon(x: unknown): number | undefined {
  if (x === null || x === undefined || x === '') return undefined;
  if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x > GRENZEN.preisCent) throw new WebFehler('Preis: netto in ganzen Cent (0 bis 100.000 €).', 400);
  return x;
}
function bereichVon(x: unknown): string {
  const b = zeile(x).toLowerCase();
  if (!b || b.length > GRENZEN.bereich || !/^[a-z0-9äöüß-]+$/.test(b)) throw new WebFehler('Bereich: ein kurzes Wort aus der Werteliste (a–z, 0–9, -).', 400);
  return b;
}

/** Einen Eintrag einer Liste säubern (wirft WebFehler). `id` kommt aus der Änderung, nie aus dem Körper. */
export function eintragSaeubern(liste: WebListe, id: string, roh: unknown): WebAngebot | WebBaustein | WebEvent | WebFaq | WebFakt | WebText | WebBild {
  if (!KENNUNG_OK[liste].test(id)) throw new WebFehler(`Kennung ungültig (${liste}).`, 400);
  const e = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  switch (liste) {
    case 'angebote': {
      const titel = laenge(zeile(e.titel), GRENZEN.titel, 'Titel');
      if (!titel) throw new WebFehler('Titel fehlt.', 400);
      const kurz = laenge(absatz(e.kurz), GRENZEN.kurz, 'Kurztext');
      const preisText = laenge(zeile(e.preisText), GRENZEN.preisText, 'Preistext');
      const preisNetto = preisVon(e.preisNetto);
      const produktId = zeile(e.produktId);
      if (produktId && !PRODUKT_ID.test(produktId)) throw new WebFehler('Produkt-Bezug ungültig.', 400);
      const seite = linkVon(e.seite, 'Seite');
      return {
        id, bereich: bereichVon(e.bereich), titel, ...(kurz ? { kurz } : {}), ...(preisText ? { preisText } : {}), ...(preisNetto !== undefined ? { preisNetto } : {}),
        ...(e.ab === true ? { ab: true } : {}), ...(e.monatlich === true ? { monatlich: true } : {}), ...(e.bald === true ? { bald: true } : {}),
        ...(produktId ? { produktId } : {}), ...(seite ? { seite } : {}), sichtbar: bool(e.sichtbar, false), rang: rangVon(e.rang),
      };
    }
    case 'bausteine': {
      const titel = laenge(zeile(e.titel), GRENZEN.titel, 'Titel');
      const kurz = laenge(absatz(e.kurz), GRENZEN.kurz, 'Kurztext');
      const preisNetto = preisVon(e.preisNetto);
      if (preisNetto === 0) throw new WebFehler('Preis eines Bausteins: ganze Cent größer 0 (oder leer = Preis aus der Datei).', 400);
      return {
        id, ...(titel ? { titel } : {}), ...(preisNetto !== undefined ? { preisNetto } : {}), ...(kurz ? { kurz } : {}),
        ...(typeof e.sichtbar === 'boolean' ? { sichtbar: e.sichtbar } : {}), ...(e.rang !== undefined ? { rang: rangVon(e.rang) } : {}),
      };
    }
    case 'events': {
      const eventId = zeile(e.eventId);
      if (!EVENT_ID.test(eventId)) throw new WebFehler('Event-Bezug ungültig.', 400);
      const anmeldeLink = linkVon(e.anmeldeLink, 'Anmeldelink');
      return { id, eventId, sichtbar: bool(e.sichtbar, false), ...(anmeldeLink ? { anmeldeLink } : {}) };
    }
    case 'faq': {
      const frage = laenge(zeile(e.frage), GRENZEN.frage, 'Frage');
      const antwort = laenge(absatz(e.antwort), GRENZEN.antwort, 'Antwort');
      if (!frage || !antwort) throw new WebFehler('Frage und Antwort gehören zusammen.', 400);
      const bereich = zeile(e.bereich) ? bereichVon(e.bereich) : '';
      const gruppe = laenge(zeile(e.gruppe), GRENZEN.gruppe, 'Gruppe');
      return { id, frage, antwort, ...(bereich ? { bereich } : {}), ...(gruppe ? { gruppe } : {}), sichtbar: bool(e.sichtbar, false), rang: rangVon(e.rang) };
    }
    case 'fakten': {
      const text = laenge(zeile(e.text), GRENZEN.fakt, 'Fakt');
      if (!text) throw new WebFehler('Fakt fehlt.', 400);
      const titel = laenge(zeile(e.titel), GRENZEN.faktTitel, 'Titel des Fakts');
      return { id, ...(titel ? { titel } : {}), text, sichtbar: bool(e.sichtbar, false), rang: rangVon(e.rang) };
    }
    case 'texte': {
      const text = laenge(absatz(e.text), GRENZEN.text, 'Text');
      if (!text) throw new WebFehler('Text fehlt (leeren = entfernen).', 400);
      return { id, text };
    }
    case 'bilder': {
      const medium = zeile(e.medium);
      if (!MEDIUM_ID.test(medium)) throw new WebFehler('Bild-Bezug ungültig.', 400);
      const alt = laenge(zeile(e.alt), GRENZEN.alt, 'Alt-Text');
      if (bool(e.sichtbar, false) && !alt) throw new WebFehler('Ohne Alt-Text kein Bild auf der Website (Barrierefreiheit).', 400);
      return { id, medium, alt, sichtbar: bool(e.sichtbar, false), rang: rangVon(e.rang) };
    }
  }
}

export function einstellungenSaeubern(roh: unknown): WebEinstellungen {
  const e = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const raus: WebEinstellungen = {};
  if (Array.isArray(e.bereiche)) {
    if (e.bereiche.length > GRENZEN.bereiche) throw new WebFehler(`Höchstens ${GRENZEN.bereiche} Bereiche.`, 413);
    const b = Array.from(new Set(e.bereiche.map(bereichVon)));
    if (b.length) raus.bereiche = b;
  }
  const slug = zeile(e.erstgespraechSlug);
  if (slug) { if (!SLUG.test(slug)) throw new WebFehler('Buchungsseite ungültig.', 400); raus.erstgespraechSlug = slug; }
  return raus;
}

/** Den gespeicherten Bestand lesen — tolerant: Kaputtes fällt beim LESEN nicht still weg, sondern bleibt, wie es ist, nur fehlende Listen werden leer. */
export function inhaltAus(roh: unknown): WebsiteInhalt {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Partial<WebsiteInhalt>;
  const l = <T,>(x: unknown): T[] => (Array.isArray(x) ? x as T[] : []);
  return {
    angebote: l(r.angebote), bausteine: l(r.bausteine), events: l(r.events), faq: l(r.faq), fakten: l(r.fakten), texte: l(r.texte), bilder: l(r.bilder),
    einstellungen: r.einstellungen && typeof r.einstellungen === 'object' ? r.einstellungen : {},
    ...(r.geaendert ? { geaendert: r.geaendert } : {}),
  };
}

export const bereicheVon = (i: Pick<WebsiteInhalt, 'einstellungen'>): string[] => (i.einstellungen.bereiche?.length ? i.einstellungen.bereiche : [...BEREICHE_VORGABE]);

// ── Änderungen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type WebOp =
  | { liste: WebListe; art: 'setze'; id: string; eintrag: unknown; stand?: string }
  | { liste: WebListe; art: 'weg'; id: string; stand?: string }
  | { liste: 'einstellungen'; art: 'setze'; eintrag: unknown; stand?: string };

export interface WebKonflikt { liste: WebListe | 'einstellungen'; id?: string; aktuell: unknown }

/** Änderungen aus dem Körper lesen (wirft 400/413). */
export function opsAus(roh: unknown): WebOp[] {
  const ops = Array.isArray(roh) ? roh : null;
  if (!ops || !ops.length) throw new WebFehler('ops: eine Liste von Änderungen.', 400);
  if (ops.length > GRENZEN.ops) throw new WebFehler(`Höchstens ${GRENZEN.ops} Änderungen auf einmal.`, 413);
  return ops.map((o0, i) => {
    const o = (o0 && typeof o0 === 'object' ? o0 : {}) as Record<string, unknown>;
    const stand = typeof o.stand === 'string' && o.stand.length <= 40 ? o.stand : undefined;
    if (o.liste === 'einstellungen') {
      if (o.art !== 'setze') throw new WebFehler(`Änderung ${i + 1}: Einstellungen nur setzen.`, 400);
      return { liste: 'einstellungen', art: 'setze', eintrag: o.eintrag, ...(stand ? { stand } : {}) };
    }
    if (!WEB_LISTEN.includes(o.liste as WebListe)) throw new WebFehler(`Änderung ${i + 1}: unbekannte Liste.`, 400);
    if (typeof o.id !== 'string') throw new WebFehler(`Änderung ${i + 1}: id fehlt.`, 400);
    if (o.art === 'setze') return { liste: o.liste as WebListe, art: 'setze', id: o.id, eintrag: o.eintrag, ...(stand ? { stand } : {}) };
    if (o.art === 'weg') return { liste: o.liste as WebListe, art: 'weg', id: o.id, ...(stand ? { stand } : {}) };
    throw new WebFehler(`Änderung ${i + 1}: art = setze oder weg.`, 400);
  });
}

/**
 * Änderungen anwenden (rein, alles oder nichts). Bestehender Eintrag: nur mit seinem Stand (sonst Konflikt — auch beim Löschen). Neuer Eintrag: ohne Stand.
 * Konflikte werden gesammelt; gibt es welche, bleibt der Bestand, wie er ist.
 */
export function opsAnwenden(alt: WebsiteInhalt, ops: readonly WebOp[], wer: { person: string; jetzt: string }): { inhalt: WebsiteInhalt; konflikte: WebKonflikt[] } {
  const neu: WebsiteInhalt = { ...alt, einstellungen: { ...alt.einstellungen }, ...Object.fromEntries(WEB_LISTEN.map(l => [l, [...alt[l]]])) } as WebsiteInhalt;
  const konflikte: WebKonflikt[] = [];
  for (const op of ops) {
    if (op.liste === 'einstellungen') {
      if (op.stand !== fingerabdruck(neu.einstellungen)) { konflikte.push({ liste: 'einstellungen', aktuell: neu.einstellungen }); continue; }
      neu.einstellungen = einstellungenSaeubern(op.eintrag);
      continue;
    }
    const liste = neu[op.liste] as { id: string }[];
    const i = liste.findIndex(x => x.id === op.id);
    if (i >= 0 && op.stand !== fingerabdruck(liste[i])) { konflikte.push({ liste: op.liste, id: op.id, aktuell: liste[i] }); continue; }
    if (op.art === 'weg') { if (i >= 0) liste.splice(i, 1); continue; }
    if (i < 0 && op.stand) { konflikte.push({ liste: op.liste, id: op.id, aktuell: null }); continue; }
    const e = eintragSaeubern(op.liste, op.id, op.eintrag) as { id: string };
    if (op.liste === 'events' && liste.some((x, j) => j !== i && (x as WebEvent).eventId === (e as WebEvent).eventId)) throw new WebFehler('Dieses Event steht schon auf der Liste.', 409);
    if (op.liste === 'bilder' && liste.some((x, j) => j !== i && (x as WebBild).medium === (e as WebBild).medium)) throw new WebFehler('Dieses Bild steht schon auf der Liste.', 409);
    if (i >= 0) liste[i] = e; else liste.push(e);
    if (liste.length > GRENZEN[op.liste]) throw new WebFehler(`Höchstens ${GRENZEN[op.liste]} Einträge (${op.liste}) — nichts gespeichert.`, 413);
  }
  if (konflikte.length) return { inhalt: alt, konflikte };
  // Wer geändert hat, steht nur im Änderungsprotokoll (ohne Werte) — der Bestand selbst trägt keine Person.
  return { inhalt: { ...neu, geaendert: wer.jetzt }, konflikte };
}

/** Jeder Eintrag mit seinem Stand (für den Browser; der Stand wird nie gespeichert). */
export function mitStand(i: WebsiteInhalt): WebsiteInhalt & { einstellungenStand: string } {
  const m = <T extends { id: string },>(l: T[]) => l.map(x => ({ ...x, stand: fingerabdruck(x) }));
  return {
    ...i, angebote: m(i.angebote), bausteine: m(i.bausteine), events: m(i.events), faq: m(i.faq), fakten: m(i.fakten), texte: m(i.texte), bilder: m(i.bilder),
    einstellungenStand: fingerabdruck(i.einstellungen),
  };
}

// ── Abgleich Website ↔ Produktkatalog ──────────────────────────────────────────────────────────────────────────────────────────

export interface ProduktKurz { id: string; name: string; /** Netto in Cent (aus `preis.betrag` in Euro). */ preisNetto: number | null; status: string }
export type Abgleich = { art: 'gleich' } | { art: 'ohne' } | { art: 'produkt-fehlt' } | { art: 'abweichung'; website: number | null; katalog: number | null };
/** Euro aus dem Katalog in Cent (kaufmännisch). */
export const euroInCent = (betrag: unknown): number | null => (typeof betrag === 'number' && Number.isFinite(betrag) && betrag >= 0 ? Math.round(betrag * 100) : null);

/** Weicht der Preis eines Angebots vom Katalogprodukt ab? (rein) — ohne Produkt-Bezug nichts zu prüfen. */
export function preisAbgleich(a: Pick<WebAngebot, 'produktId' | 'preisNetto'>, produkte: readonly ProduktKurz[]): Abgleich {
  if (!a.produktId) return { art: 'ohne' };
  const p = produkte.find(x => x.id === a.produktId);
  if (!p) return { art: 'produkt-fehlt' };
  const w = a.preisNetto ?? null;
  return w === p.preisNetto ? { art: 'gleich' } : { art: 'abweichung', website: w, katalog: p.preisNetto };
}

// ── Bausteine-Katalog überlagern ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die Datei (unterlagen/bausteine/katalog.json) bleibt die Grundlage (Dateien, Seiten, Pakete); ein Eintrag im Bestand überlagert Titel, Preis, Kurztext, Rang und
 * „sichtbar“. Ohne Eintrag kommt GENAU dasselbe Objekt zurück (bit-gleich). Ausgeblendete Bausteine bleiben im Katalog (Lieferung bestehender
 * Bestellungen), sind aber nicht mehr bestellbar und nicht auf der Website (`ausgeblendet`).
 */
export function bausteineUeberlagern<B extends Baustein>(katalog: readonly B[], ueber: readonly WebBaustein[]): B[] {
  if (!ueber.length) return katalog as B[];
  return katalog.map(b => {
    const u = ueber.find(x => x.id === b.id);
    if (!u) return b;
    return {
      ...b,
      ...(u.titel ? { titel: u.titel } : {}),
      ...(typeof u.preisNetto === 'number' && u.preisNetto > 0 ? { preis: u.preisNetto } : {}),
      ...(u.kurz ? { kurz: u.kurz } : {}),
      ...(typeof u.rang === 'number' ? { rang: u.rang } : {}),
      ...(u.sichtbar === false ? { ausgeblendet: true } : {}),
    };
  });
}

// ── Öffentliche Form (der Vertrag mit der Website) ─────────────────────────────────────────────────────────────────────────────

export interface OeffentlichesEvent { id: string; titel: string; /** JJJJ-MM-TT oder JJJJ-MM-TTThh:mm (Berliner Wandzeit). */ datum: string; bis?: string; ort?: string; format?: string; anmeldung?: string }
export interface WebsiteOeffentlich {
  ok: true;
  stand: string;
  angebote: { id: string; bereich: string; titel: string; kurz?: string; preisText?: string; preisNetto?: number; ab?: boolean; monatlich?: boolean; bald?: boolean; seite?: string }[];
  bausteine: { id: string; titel: string; bereich: string; preisNetto: number; kurz?: string; seite: string; paket?: string[] }[];
  events: OeffentlichesEvent[];
  faq: { id: string; frage: string; antwort: string; bereich?: string; gruppe?: string }[];
  fakten: { titel?: string; text: string }[];
  texte: Record<string, string>;
  bilder: { id: string; url: string; alt: string }[];
}

/** Quelle eines eigenen Events (nur die Felder, die die Website zeigen darf). */
export interface EventQuelle { id: string; titel: string; datum: string; uhrzeit?: string; bisDatum?: string; ort?: string; format?: string; status: string; besucht: boolean }

/** Sichtbare Namen der Event-Formate (allgemeine Wörter, keine Marke). */
export const FORMAT_NAME: Record<string, string> = { stammtisch: 'Stammtisch', workshop: 'Workshop', dinner: 'Dinner', webinar: 'Webinar', messe: 'Messe', sonstig: 'Veranstaltung' };
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const UHR = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Datum für die Website: JJJJ-MM-TT, mit Uhrzeit JJJJ-MM-TTThh:mm — sonst null (dann zeigt die Website das Event nicht). */
export function eventDatum(datum: string, uhrzeit?: string): string | null {
  const tag = (datum ?? '').slice(0, 10);
  if (!TAG.test(tag)) return null;
  const uhr = uhrzeit && UHR.test(uhrzeit) ? uhrzeit : /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d/.test(datum) ? datum.slice(11, 16) : '';
  return uhr ? `${tag}T${uhr}` : tag;
}

const nachRang = <T extends { rang?: number; id: string },>(l: readonly T[]) => [...l].sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0) || a.id.localeCompare(b.id));
const textOk = (x: unknown, max: number): x is string => typeof x === 'string' && !!x.trim() && x.length <= max && !/[<>]/.test(x);

/**
 * Die öffentliche Antwort bauen (rein): nur sichtbare Einträge, nur öffentliche Felder — keine Produkt-, Event- oder Medien-Kennungen, keine Gäste,
 * keine Personen. Events nur eigene (nie besuchte), geplant oder eingeladen, ab heute. Bilder nur, wenn das Medium für die Website freigegeben ist
 * (`bildOk`). Was nicht ins Format der Website passt, fehlt (zweite Sicherung nach der Prüfung beim Speichern — nie etwas Ungültiges ausliefern).
 */
export function oeffentlicherInhalt(i: WebsiteInhalt, q: { katalog: readonly (Baustein & { ausgeblendet?: boolean; kurz?: string; rang?: number })[]; events: readonly EventQuelle[]; bildOk: (medium: string) => boolean; heute: string }): WebsiteOeffentlich {
  const angebote = nachRang(i.angebote.filter(a => a.sichtbar)).map(a => ({
    id: a.id, bereich: a.bereich, titel: a.titel, ...(a.kurz ? { kurz: a.kurz } : {}), ...(textOk(a.preisText, GRENZEN.preisText) ? { preisText: a.preisText } : {}),
    ...(typeof a.preisNetto === 'number' ? { preisNetto: a.preisNetto } : {}), ...(a.ab ? { ab: true } : {}), ...(a.monatlich ? { monatlich: true } : {}),
    ...(a.bald ? { bald: true } : {}), ...(a.seite && linkOk(a.seite) ? { seite: a.seite } : {}),
  }));
  const bausteine = nachRang(q.katalog.filter(b => !b.ausgeblendet && Number.isInteger(b.preis) && b.preis > 0)).map(b => ({
    id: b.id, titel: b.titel, bereich: b.bereich, preisNetto: b.preis, ...(b.kurz ? { kurz: b.kurz } : {}), seite: b.seite, ...(b.paket ? { paket: [...b.paket] } : {}),
  }));
  const events: OeffentlichesEvent[] = [];
  for (const w of i.events) {
    if (!w.sichtbar) continue;
    const e = q.events.find(x => x.id === w.eventId);
    if (!e || e.besucht || (e.status !== 'geplant' && e.status !== 'einladung') || !textOk(e.titel, 160)) continue;
    const datum = eventDatum(e.datum, e.uhrzeit);
    const bis = e.bisDatum && TAG.test(e.bisDatum.slice(0, 10)) ? e.bisDatum.slice(0, 10) : undefined;
    if (!datum || (bis ?? datum.slice(0, 10)) < q.heute) continue;
    const format = e.format ? FORMAT_NAME[e.format] : undefined;
    events.push({
      id: w.id, titel: e.titel, datum, ...(bis && bis > datum.slice(0, 10) ? { bis } : {}), ...(e.ort && textOk(e.ort, 120) ? { ort: e.ort } : {}),
      ...(format ? { format } : {}), ...(w.anmeldeLink && linkOk(w.anmeldeLink) ? { anmeldung: w.anmeldeLink } : {}),
    });
  }
  events.sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id));
  const faq = nachRang(i.faq.filter(f => f.sichtbar)).map(f => ({ id: f.id, frage: f.frage, antwort: f.antwort, ...(f.bereich ? { bereich: f.bereich } : {}), ...(f.gruppe ? { gruppe: f.gruppe } : {}) }));
  const fakten = nachRang(i.fakten.filter(f => f.sichtbar)).map(f => ({ ...(f.titel ? { titel: f.titel } : {}), text: f.text }));
  const texte = Object.fromEntries([...i.texte].filter(t => textOk(t.text, GRENZEN.text)).sort((a, b) => a.id.localeCompare(b.id)).map(t => [t.id, t.text]));
  const bilder = nachRang(i.bilder.filter(b => b.sichtbar && b.alt && q.bildOk(b.medium))).map(b => ({ id: b.id, url: `/api/website/bild/${b.id}`, alt: b.alt }));
  const koerper = { angebote, bausteine, events, faq, fakten, texte, bilder };
  return { ok: true, stand: fingerabdruck(koerper), ...koerper };
}

/** Darf dieses Bild öffentlich ausgeliefert werden? (rein) — nur ein sichtbarer Eintrag mit Alt-Text. */
export function bildEintragOeffentlich(i: Pick<WebsiteInhalt, 'bilder'>, id: string): WebBild | null {
  if (!KENNUNG_OK.bilder.test(id)) return null;
  const b = i.bilder.find(x => x.id === id);
  return b && b.sichtbar && b.alt ? b : null;
}

// ── Erstgespräch ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Vorsatz, an dem eine Buchungsseite als „Erstgespräch“ erkannt wird, wenn keine gewählt ist (eine Namensregel, kein fester Slug). */
export const ERSTGESPRAECH_VORSATZ = 'erstgespraech-';
/**
 * Wohin `/erstgespraech` führt (rein): die in MAKE OS gewählte Buchungsseite (aktiv) → sonst die EINZIGE aktive Buchungsseite, deren Adresse mit
 * `erstgespraech-` beginnt → sonst (keine oder mehrere) die neutrale Seite „gibt es nicht“.
 */
export function erstgespraechZiel(p: { gewaehlt?: string; aktiveSeiten: readonly string[] }): { art: 'buchung'; pfad: string } | { art: 'keins' } {
  const aktiv = p.aktiveSeiten.filter(s => SLUG.test(s));
  if (p.gewaehlt && aktiv.includes(p.gewaehlt)) return { art: 'buchung', pfad: `/buchen/${p.gewaehlt}` };
  const kandidaten = aktiv.filter(s => s.startsWith(ERSTGESPRAECH_VORSATZ));
  return kandidaten.length === 1 ? { art: 'buchung', pfad: `/buchen/${kandidaten[0]}` } : { art: 'keins' };
}

// ── Startwerte aus der Website übernehmen (website/startwerte-inhalt.json) ────────────────────────────────────────────────────

/**
 * Aus den Startwerten die Änderungen bauen, die FEHLEN (rein): nur Einträge, deren Kennung es im Bestand noch nicht gibt — nie überschreiben. FAQ und Fakten
 * tragen in der Datei keine Kennung: sie bekommen eine aus ihrem Text (`wq-…`/`wf-…`, stabil — ein zweiter Lauf findet sie wieder). Bausteine: nur, was von
 * der Datei abweicht, dazu Kurztext und Rang (sonst hielte die Überlagerung einen alten Preis fest, wenn sich katalog.json ändert). Texte: nur fehlende
 * Schlüssel. Ungültige Einträge landen in `fehler` (mit Satz), nie still.
 */
export function startwerteOps(i: WebsiteInhalt, roh: unknown, katalog: readonly Baustein[]): { ops: WebOp[]; zaehler: Record<WebListe, number>; fehler: string[] } {
  const d = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const ops: WebOp[] = [];
  const fehler: string[] = [];
  const zaehler = Object.fromEntries(WEB_LISTEN.map(l => [l, 0])) as Record<WebListe, number>;
  const vorhanden = (l: WebListe, id: string) => (i[l] as { id: string }[]).some(x => x.id === id) || ops.some(o => o.liste === l && 'id' in o && o.id === id);
  const neu = (l: WebListe, id: string, eintrag: Record<string, unknown>) => {
    if (vorhanden(l, id)) return;
    try { eintragSaeubern(l, id, eintrag); } catch (x) { fehler.push(`${l} ${id}: ${(x as Error).message}`); return; }
    ops.push({ liste: l, art: 'setze', id, eintrag });
    zaehler[l]++;
  };
  const liste = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x.filter(y => y && typeof y === 'object') as Record<string, unknown>[] : []);
  for (const a of liste(d.angebote)) if (typeof a.id === 'string') neu('angebote', a.id, { ...a, sichtbar: true });
  for (const b of liste(d.bausteine)) {
    if (typeof b.id !== 'string') continue;
    const k = katalog.find(x => x.id === b.id);
    neu('bausteine', b.id, {
      ...(typeof b.titel === 'string' && b.titel !== k?.titel ? { titel: b.titel } : {}),
      ...(typeof b.preisNetto === 'number' && b.preisNetto !== k?.preis ? { preisNetto: b.preisNetto } : {}),
      ...(b.kurz ? { kurz: b.kurz } : {}), ...(b.rang !== undefined ? { rang: b.rang } : {}),
    });
  }
  liste(d.faq).forEach((f, n) => neu('faq', `wq-${fingerabdruck(f.frage)}`, { ...f, sichtbar: true, rang: typeof f.rang === 'number' ? f.rang : n + 1 }));
  liste(d.fakten).forEach((f, n) => neu('fakten', `wf-${fingerabdruck([f.titel ?? '', f.text])}`, { ...f, sichtbar: true, rang: typeof f.rang === 'number' ? f.rang : n + 1 }));
  const texte = d.texte && typeof d.texte === 'object' ? d.texte as Record<string, unknown> : {};
  for (const [k, t] of Object.entries(texte)) neu('texte', k, { text: t });
  return { ops, zaehler, fehler };
}
