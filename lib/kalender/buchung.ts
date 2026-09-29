// ─── Kalender — öffentliche Buchungsseiten (rein, getestet, 29.09., Paket K4) ─
// Kevin: „Öffentliche Buchungsseite (‚30 min mit Kevin‘): Link für Externe, Spam-Schutz, Bestätigung,
// Freigabe, erst dann fester Termin; DSGVO-Hinweis.“ Und (29.09.): „Eine Buchung ist im CRM EIN Vorgang.“
//
// Ablauf einer Buchung (Status):
//   vorlaeufig  Platz 30 Minuten reserviert — der Buchende bestätigt auf seiner Status-Seite (Double-Opt-in-Ersatz,
//               solange MAKE OS keine Mail verschickt). Nicht bestätigt → abgelaufen, der Platz ist wieder frei.
//   angefragt   bestätigt vom Buchenden → Anfrage im CRM (lib/crm/anfragen.ts) + Glocke. Platz bleibt gehalten.
//   bestaetigt  Kevin oder Malin haben freigegeben → fester Termin im Zielkalender (iCloud), Aktivität „Termin
//               gebucht“ + Follow-up „Termin vorbereiten“ im CRM (lib/kalender/buchung-ablauf.ts).
//   abgelehnt · abgesagt (vom Buchenden) · abgelaufen — Endzustände; nach der Löschfrist fallen sie weg.
//
// Diese Datei rechnet nur (Säubern, Plätze, Reservieren, Aufräumen, Prüfungen) — ohne Platte, Netz, Uhr.
// Der Speicher liegt in `buchung--<haushalt>` (lib/kalender/buchung-speicher.ts), die Routen unter
// app/api/buchung/[slug] (öffentlich) und app/api/kalender/buchung (Haushalt).

import { freieZeiten, fensterSauber, istFrei, type Belegung, type Fenster, type FreieZeit } from './verfuegbar';
import { tagVon, ausWandzeit } from './zeit';

// ── Texte mit Fassung (Nachweis der Einwilligung) ────────────────────────────

/** Fassung des Einwilligungs- und Hinweistextes — wird mit jeder Buchung gespeichert. Text ändern → Fassung hoch. */
export const EINWILLIGUNG_VERSION = 'buchung-2026-09-29';
/** Wortlaut des Pflicht-Häkchens (so steht er als Nachweis an der Buchung und an der Einwilligung im CRM). */
export const EINWILLIGUNG_WORTLAUT = 'Ich bin einverstanden, dass meine Angaben (Name, E-Mail, Firma, Anliegen) zur Bearbeitung dieser Terminanfrage gespeichert und verarbeitet werden. Die Hinweise zum Datenschutz habe ich gelesen.';
/** Datenschutz-Hinweis auf der Seite (Art. 13 DSGVO, kurz). Verantwortlicher steht an der Buchungsseite. */
export const DATENSCHUTZ_HINWEIS = [
  'Zweck: Ihre Angaben werden nur verwendet, um diese Terminanfrage zu bearbeiten und den Termin vorzubereiten (Art. 6 Abs. 1 lit. b DSGVO, Anbahnung).',
  'Speicherdauer: Nicht bestätigte, abgelehnte oder abgesagte Anfragen werden nach 30 Tagen gelöscht; aus einem vereinbarten Termin entsteht ein Geschäftskontakt.',
  'Es wird keine Werbung verschickt. Sie können jederzeit Auskunft, Berichtigung oder Löschung verlangen — über den Verantwortlichen unten.',
  'Die Seite setzt keine Cookies und lädt nichts von fremden Servern.',
];

// ── Grenzen ─────────────────────────────────────────────────────────────────

export const GRENZEN = { name: 80, email: 160, firma: 160, anliegen: 1000, titel: 80, ort: 300, verantwortlich: 300, kalender: 100, seiten: 30, buchungen: 2000, offeneJeSeite: 60 } as const;
/** So lange hält eine vorläufige Buchung ihren Platz. */
export const RESERVIERT_MIN = 30;
/** Zu schnell ausgefüllt (Sekunden seit dem Laden der Seite) → Maschine. */
export const MIN_AUSFUELLEN_SEK = 3;
/** Formular-Stempel verfällt nach (Sekunden). */
export const MAX_AUSFUELLEN_SEK = 2 * 3600;
/** Standard-Löschfrist in Tagen (einstellbar unter Stammdaten › Datenschutz, Frist „buchungen“). */
export const LOESCHFRIST_TAGE = 30;

// ── Formen ──────────────────────────────────────────────────────────────────

export interface BuchungsSeite {
  id: string;
  /** Öffentlicher Teil der Adresse: lesbarer Vorsatz + Zufall (≥ 96 Bit) — nicht erratbar. */
  slug: string;
  titel: string;
  dauerMin: number;
  /** Für wen gebucht wird (Speichername im Haushalt). Seine Belegung zählt, an ihn geht die Glocke. */
  person: string;
  /** Buchbare Zeiten (Wochentage + Uhrzeiten). */
  fenster: Fenster[];
  /** Wie weit im Voraus buchbar (Tage). */
  tageVoraus: number;
  /** Mindestvorlauf in Minuten (z. B. 1440 = 24 h). */
  vorlaufMin: number;
  maxJeTag: number;
  pufferMin: number;
  rasterMin: number;
  /** Apple-Kalender, in den der feste Termin kommt (Name wie in der Kalender-App). */
  zielKalender: string;
  /** Ort oder Videolink-Text — der Buchende sieht ihn erst nach der Freigabe. */
  ort: string;
  /** Welche freiwilligen Fragen gestellt werden (Name und E-Mail sind immer Pflicht). */
  fragen: { firma: boolean; anliegen: boolean };
  /** Verantwortlicher für den Datenschutz-Hinweis (Name/Firma + Kontakt). */
  verantwortlich: string;
  aktiv: boolean;
  angelegt: string;
  geaendert: string;
  geaendertVon?: string;
}

export type BuchungStatus = 'vorlaeufig' | 'angefragt' | 'bestaetigt' | 'abgelehnt' | 'abgesagt' | 'abgelaufen';
export const OFFEN: readonly BuchungStatus[] = ['vorlaeufig', 'angefragt'];
/** Diese Status halten ihren Platz (vorläufig nur bis `reserviertBis`). */
export const HALTEN: readonly BuchungStatus[] = ['vorlaeufig', 'angefragt', 'bestaetigt'];

export interface Buchung {
  id: string;
  seiteId: string;
  start: string;
  ende: string;
  status: BuchungStatus;
  name: string;
  email: string;
  firma?: string;
  anliegen?: string;
  /** Nachweis: Wortlaut + Fassung + Zeitpunkt des Häkchens. */
  einwilligung: { wortlaut: string; version: string; am: string };
  /** SHA-256 des Status-Tokens — das Token selbst kennt nur der Buchende. */
  tokenHash: string;
  angelegt: string;
  reserviertBis: string;
  /** Wann der Status zuletzt wechselte (Grundlage der Löschfrist). */
  statusAm: string;
  angefragtAm?: string;
  entschiedenAm?: string;
  entschiedenVon?: string;
  grund?: string;
  // ── Verbindungen (ein Vorgang: Buchung → Kontakt → Termin) ──
  kontaktId?: string;
  /** Follow-up „Anfrage beantworten“ (aus der Anfrage). */
  followUpId?: string;
  /** Follow-up „Termin vorbereiten“ (nach der Freigabe). */
  vorbereitenId?: string;
  terminUid?: string;
  terminKalender?: string;
  /** Warum im CRM nichts festgehalten wurde (Werbesperre, Art. 18) — sichtbar für den Haushalt. */
  crmHinweis?: string;
}

export interface BuchungBestand {
  seiten: BuchungsSeite[];
  buchungen: Buchung[];
}
export const LEER: BuchungBestand = { seiten: [], buchungen: [] };

// ── Säubern ─────────────────────────────────────────────────────────────────

const SLUG = /^[a-z0-9-]{1,40}-[a-f0-9]{24}$/;
export const slugOk = (s: unknown): s is string => typeof s === 'string' && SLUG.test(s);
const PERSON = /^[a-z0-9-]{1,40}$/;
const txt = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '');
const zahl = (v: unknown, min: number, max: number, sonst: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : sonst; };

/** Lesbarer Vorsatz der Adresse aus dem Titel („30 min mit Kevin“ → „30-min-mit-kevin“). */
export function slugVorsatz(titel: string): string {
  const s = titel.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return s || 'termin';
}

/**
 * Buchungsseite aus einer Eingabe säubern. Feste Felder (id, slug, angelegt) kommen aus `alt` bzw. vom Server.
 * Liefert den Fehlertext statt still zu kürzen (Regel „nie abschneiden, ablehnen“).
 */
export function seiteSauber(roh: Record<string, unknown>, fest: Pick<BuchungsSeite, 'id' | 'slug' | 'angelegt'>, person: string, jetzt: string): { ok: true; seite: BuchungsSeite } | { ok: false; fehler: string } {
  const titel = txt(roh.titel);
  if (!titel) return { ok: false, fehler: 'Titel fehlt.' };
  if (titel.length > GRENZEN.titel) return { ok: false, fehler: `Titel höchstens ${GRENZEN.titel} Zeichen.` };
  const fuer = txt(roh.person);
  if (!PERSON.test(fuer)) return { ok: false, fehler: 'Für wen ist die Seite?' };
  const fenster = fensterSauber(roh.fenster);
  if (!fenster || !fenster.length) return { ok: false, fehler: 'Buchbare Zeiten: mindestens ein Fenster mit Wochentagen und Uhrzeiten (bis nach von).' };
  const ort = txt(roh.ort), kal = txt(roh.zielKalender), verantwortlich = txt(roh.verantwortlich);
  if (ort.length > GRENZEN.ort) return { ok: false, fehler: `Ort höchstens ${GRENZEN.ort} Zeichen.` };
  if (kal.length > GRENZEN.kalender) return { ok: false, fehler: 'Kalendername zu lang.' };
  if (!kal) return { ok: false, fehler: 'Zielkalender fehlt (Name wie in der Kalender-App).' };
  if (verantwortlich.length > GRENZEN.verantwortlich) return { ok: false, fehler: `Verantwortlicher höchstens ${GRENZEN.verantwortlich} Zeichen.` };
  const f = (roh.fragen && typeof roh.fragen === 'object' ? roh.fragen : {}) as Record<string, unknown>;
  return {
    ok: true,
    seite: {
      id: fest.id, slug: fest.slug, titel, person: fuer, fenster,
      dauerMin: zahl(roh.dauerMin, 10, 240, 30),
      tageVoraus: zahl(roh.tageVoraus, 1, 60, 14),
      vorlaufMin: zahl(roh.vorlaufMin, 0, 60 * 24 * 14, 1440),
      maxJeTag: zahl(roh.maxJeTag, 1, 20, 4),
      pufferMin: zahl(roh.pufferMin, 0, 120, 15),
      rasterMin: [15, 30, 60].includes(Number(roh.rasterMin)) ? Number(roh.rasterMin) : 30,
      zielKalender: kal, ort, verantwortlich,
      fragen: { firma: f.firma !== false, anliegen: f.anliegen !== false },
      aktiv: roh.aktiv !== false,
      angelegt: fest.angelegt, geaendert: jetzt, geaendertVon: person,
    },
  };
}

/** Bestand beim Lesen säubern (fremde/kaputte Einträge fallen nicht still weg — sie bleiben, wie sie sind; nur die Form wird gesichert). */
export function bestandSauber(roh: Partial<BuchungBestand> | null | undefined): BuchungBestand {
  return {
    seiten: Array.isArray(roh?.seiten) ? roh!.seiten : [],
    buchungen: Array.isArray(roh?.buchungen) ? roh!.buchungen : [],
  };
}

// ── Plätze ──────────────────────────────────────────────────────────────────

/** Hält diese Buchung (noch) ihren Platz? Vorläufige nur bis `reserviertBis`. */
export function haeltPlatz(b: Buchung, jetztIso: string): boolean {
  if (!HALTEN.includes(b.status)) return false;
  return b.status !== 'vorlaeufig' || b.reserviertBis > jetztIso;
}

/** Buchungen als Belegung der Seiten-Person (gehaltene Plätze aller Seiten dieser Person). */
export function buchungenAlsBelegung(bestand: BuchungBestand, person: string, jetztIso: string): Belegung[] {
  const seitenDerPerson = new Set(bestand.seiten.filter(s => s.person === person).map(s => s.id));
  return bestand.buchungen.filter(b => seitenDerPerson.has(b.seiteId) && haeltPlatz(b, jetztIso)).map(b => ({ wer: person, start: b.start, ende: b.ende, art: 'belegt' as const }));
}

/**
 * Freie Plätze einer Seite: Arbeitszeit = die Fenster der Seite, Belegung = Termine der Person (+ gemeinsame) und
 * gehaltene Buchungen; Feiertage gesperrt; höchstens `maxJeTag` je Tag abzüglich gehaltener Buchungen dieser Seite.
 * Liefert nur Zeiten — nie Titel, nie Namen.
 */
export function plaetzeFuerSeite(seite: BuchungsSeite, belegungen: readonly Belegung[], bestand: BuchungBestand, jetzt: Date, feiertage: Readonly<Record<string, string>>, heute: string): FreieZeit[] {
  const jetztIso = jetzt.toISOString();
  const bereitsJeTag: Record<string, number> = {};
  for (const b of bestand.buchungen) if (b.seiteId === seite.id && haeltPlatz(b, jetztIso)) bereitsJeTag[tagVon(b.start)] = (bereitsJeTag[tagVon(b.start)] ?? 0) + 1;
  return freieZeiten({
    personen: [seite.person],
    belegungen: [...belegungen, ...buchungenAlsBelegung(bestand, seite.person, jetztIso)],
    arbeitszeiten: { [seite.person]: seite.fenster },
    dauerMin: seite.dauerMin,
    von: heute,
    tage: seite.tageVoraus,
    jetzt, vorlaufMin: seite.vorlaufMin, pufferMin: seite.pufferMin, rasterMin: seite.rasterMin,
    feiertage, feiertageSperren: true,
    maxJeTag: seite.maxJeTag, bereitsJeTag,
  });
}

// ── Eingabe des Buchenden ─────────────────────────────────────────────────────

export interface BuchungEingabe { start: string; name: string; email: string; firma?: string; anliegen?: string; einwilligung: boolean; /** Honigtopf — Menschen sehen das Feld nicht. */ webseite?: string }
const MAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/i;
const WAND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/;

/**
 * Prüft die Eingabe des Buchenden (Pflichtfelder, Längen, Häkchen, Honigtopf). Zu lange Felder → Fehler (nie kürzen).
 * `falle: true` = Honigtopf gefüllt (die Route antwortet dann wie bei jedem anderen Fehler, ohne zu verraten, warum).
 */
export function eingabePruefen(roh: Record<string, unknown>, seite: Pick<BuchungsSeite, 'fragen'>): { ok: true; e: BuchungEingabe } | { ok: false; fehler: string; falle?: boolean; status: 400 | 413 } {
  if (txt(roh.webseite)) return { ok: false, fehler: 'Buchung nicht angenommen.', falle: true, status: 400 };
  const name = txt(roh.name), email = txt(roh.email).toLowerCase(), firma = txt(roh.firma), anliegen = typeof roh.anliegen === 'string' ? roh.anliegen.replace(/\u0000/g, '').trim() : '';
  const start = txt(roh.start);
  if (name.length > GRENZEN.name || email.length > GRENZEN.email || firma.length > GRENZEN.firma || anliegen.length > GRENZEN.anliegen) return { ok: false, fehler: 'Eine Angabe ist zu lang.', status: 413 };
  if (!name) return { ok: false, fehler: 'Bitte Ihren Namen angeben.', status: 400 };
  if (!MAIL.test(email)) return { ok: false, fehler: 'Bitte eine gültige E-Mail-Adresse angeben.', status: 400 };
  if (!WAND.test(start)) return { ok: false, fehler: 'Bitte einen Termin wählen.', status: 400 };
  if (roh.einwilligung !== true) return { ok: false, fehler: 'Bitte der Verarbeitung Ihrer Angaben zustimmen (Pflicht).', status: 400 };
  return { ok: true, e: { start, name, email, ...(seite.fragen.firma && firma ? { firma } : {}), ...(seite.fragen.anliegen && anliegen ? { anliegen } : {}), einwilligung: true } };
}

/** Zeitprüfung des Formulars: `geladenMs` aus dem signierten Stempel. */
export function ausfuellZeitOk(geladenMs: number, jetztMs: number): boolean {
  const sek = (jetztMs - geladenMs) / 1000;
  return Number.isFinite(sek) && sek >= MIN_AUSFUELLEN_SEK && sek <= MAX_AUSFUELLEN_SEK;
}

// ── Reservieren (in EINER Sperre auf dem frischen Bestand) ────────────────────

export type ReservierFehler = { ok: false; status: 404 | 409 | 413 | 429; fehler: string };
export interface Reservierung { ok: true; bestand: BuchungBestand; buchung: Buchung }

/**
 * Einen Platz vorläufig reservieren. Prüft auf dem Stand IN der Sperre: Seite aktiv, Platz frei (inkl. gehaltener
 * Buchungen — so gibt es keine Doppelbuchung), dieselbe E-Mail nicht schon offen auf dieser Seite, Grenzen.
 */
export function reservieren(bestand: BuchungBestand, seiteId: string, e: BuchungEingabe, belegungen: readonly Belegung[], feiertage: Readonly<Record<string, string>>, ctx: { id: string; tokenHash: string; jetzt: Date; heute: string }): Reservierung | ReservierFehler {
  const seite = bestand.seiten.find(s => s.id === seiteId && s.aktiv);
  if (!seite) return { ok: false, status: 404, fehler: 'Diese Buchungsseite gibt es nicht (mehr).' };
  const jetztIso = ctx.jetzt.toISOString();
  if (bestand.buchungen.length >= GRENZEN.buchungen) return { ok: false, status: 413, fehler: 'Gerade sind keine Buchungen möglich.' };
  const offeneSeite = bestand.buchungen.filter(b => b.seiteId === seite.id && OFFEN.includes(b.status) && haeltPlatz(b, jetztIso));
  if (offeneSeite.length >= GRENZEN.offeneJeSeite) return { ok: false, status: 429, fehler: 'Gerade sind zu viele Anfragen offen — bitte später noch einmal.' };
  if (offeneSeite.some(b => b.email === e.email)) return { ok: false, status: 409, fehler: 'Mit dieser E-Mail-Adresse ist schon eine Anfrage offen — bitte den Status-Link dieser Anfrage nutzen.' };
  const ende = ausWandzeit(e.start).getTime() + seite.dauerMin * 60_000;
  const plaetze = plaetzeFuerSeite(seite, belegungen, bestand, ctx.jetzt, feiertage, ctx.heute);
  const passend = plaetze.find(p => p.start === e.start);
  if (!passend || !istFrei(passend.start, passend.ende, plaetze) || ausWandzeit(passend.ende).getTime() !== ende) return { ok: false, status: 409, fehler: 'Dieser Termin ist gerade nicht mehr frei — bitte einen anderen wählen.' };
  const buchung: Buchung = {
    id: ctx.id, seiteId: seite.id, start: passend.start, ende: passend.ende, status: 'vorlaeufig',
    name: e.name, email: e.email, ...(e.firma ? { firma: e.firma } : {}), ...(e.anliegen ? { anliegen: e.anliegen } : {}),
    einwilligung: { wortlaut: EINWILLIGUNG_WORTLAUT, version: EINWILLIGUNG_VERSION, am: jetztIso },
    tokenHash: ctx.tokenHash, angelegt: jetztIso, reserviertBis: new Date(ctx.jetzt.getTime() + RESERVIERT_MIN * 60_000).toISOString(), statusAm: jetztIso,
  };
  return { ok: true, bestand: { ...bestand, buchungen: [...bestand.buchungen, buchung] }, buchung };
}

// ── Statuswechsel ─────────────────────────────────────────────────────────────

/** Abgelaufenes nachziehen (ohne zu löschen): vorläufig über der Reservierung, angefragt nach Terminende. */
export function ablaufNachziehen(bestand: BuchungBestand, jetzt: Date): { bestand: BuchungBestand; n: number } {
  const jetztIso = jetzt.toISOString();
  let n = 0;
  const buchungen = bestand.buchungen.map(b => {
    if (b.status === 'vorlaeufig' && b.reserviertBis <= jetztIso) { n++; return { ...b, status: 'abgelaufen' as const, statusAm: b.reserviertBis }; }
    if (b.status === 'angefragt' && ausWandzeit(b.ende).getTime() <= jetzt.getTime()) { n++; return { ...b, status: 'abgelaufen' as const, statusAm: jetztIso }; }
    return b;
  });
  return { bestand: n ? { ...bestand, buchungen } : bestand, n };
}

/**
 * Löschfrist: Endzustände (abgelehnt, abgesagt, abgelaufen), deren Statuswechsel älter als `tage` ist, und
 * bestätigte Buchungen `tage` nach dem Termin fallen weg. Im CRM bleiben Anfrage und Aktivität (dort gilt die
 * Löschfrist der Kartei). Liefert die entfernten Kennungen (fürs Protokoll, ohne Inhalte).
 */
export function loeschfristAnwenden(bestand: BuchungBestand, jetzt: Date, tage = LOESCHFRIST_TAGE): { bestand: BuchungBestand; entfernt: string[] } {
  const grenze = jetzt.getTime() - tage * 86_400_000;
  const entfernt: string[] = [];
  const bleiben = bestand.buchungen.filter(b => {
    const weg = b.status === 'bestaetigt' ? ausWandzeit(b.ende).getTime() < grenze
      : ['abgelehnt', 'abgesagt', 'abgelaufen'].includes(b.status) ? Date.parse(b.statusAm) < grenze : false;
    if (weg) entfernt.push(b.id);
    return !weg;
  });
  return { bestand: entfernt.length ? { ...bestand, buchungen: bleiben } : bestand, entfernt };
}

/** Was der Buchende auf seiner Status-Seite sieht — ohne Namen anderer, ohne Termininhalte; Ort erst nach Freigabe. */
export interface StatusSicht { status: BuchungStatus; titel: string; start: string; ende: string; reserviertBis?: string; ort?: string; grund?: string; verantwortlich?: string }
export function statusSicht(b: Buchung, seite: BuchungsSeite | undefined): StatusSicht {
  return {
    status: b.status, titel: seite?.titel ?? 'Termin', start: b.start, ende: b.ende,
    ...(b.status === 'vorlaeufig' ? { reserviertBis: b.reserviertBis } : {}),
    ...(b.status === 'bestaetigt' && seite?.ort ? { ort: seite.ort } : {}),
    ...(b.status === 'abgelehnt' && b.grund ? { grund: b.grund } : {}),
    ...(seite?.verantwortlich ? { verantwortlich: seite.verantwortlich } : {}),
  };
}

/** Öffentliche Sicht einer Seite: Titel, Dauer, Fragen, Hinweise — nie Person, Kalender, Ort, Buchungen. */
export interface OeffentlicheSeite { titel: string; dauerMin: number; fragen: BuchungsSeite['fragen']; verantwortlich: string; hinweis: string[]; einwilligung: { wortlaut: string; version: string } }
export function oeffentlich(seite: BuchungsSeite): OeffentlicheSeite {
  return { titel: seite.titel, dauerMin: seite.dauerMin, fragen: seite.fragen, verantwortlich: seite.verantwortlich, hinweis: DATENSCHUTZ_HINWEIS, einwilligung: { wortlaut: EINWILLIGUNG_WORTLAUT, version: EINWILLIGUNG_VERSION } };
}

/** Vor- und Nachname aus einer Namenszeile (letztes Wort = Nachname). */
export function nameTeilen(name: string): { vorname: string; nachname: string } {
  const t = name.trim().split(/\s+/).filter(Boolean);
  if (t.length <= 1) return { vorname: t[0] ?? '', nachname: '' };
  return { vorname: t.slice(0, -1).join(' '), nachname: t[t.length - 1] };
}

/** Marke im Termin (Notiz), an der ein angelegter Termin wiedererkannt wird — idempotente Freigabe. */
export const terminMarke = (buchungId: string) => `MAKE-OS-Buchung ${buchungId}`;

/** Tag „Termin vorbereiten“: der Werktag davor bzw. heute, wenn das schon vorbei ist. */
export function vorbereitenTag(start: string, heute: string): string {
  const d = new Date(`${tagVon(start)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const t = d.toISOString().slice(0, 10);
  return t < heute ? heute : t;
}
