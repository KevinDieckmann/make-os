// ─── Bausteine bestellen — die Regeln (31.10., rein, client-sicher, getestet) ──────────────────────────────────────────────────────────
// Kevin 31.10.: Bausteine (bezahlte digitale Arbeitspakete der Website) „schnell weg, ohne Arbeit für uns, der Einstieg“ — Bestellung B2B AUF RECHNUNG
// über MAKE OS, Online-Zahlung später. Ablauf:
//   Website (statisch) → GET /api/bestellung?id=… (Titel, Preis, Stempel, Bestellbedingungen, Datenschutzhinweis) → POST /api/bestellung
//   → Eingang: Bestellung im Bestand `baustein-bestellungen`, NACH der Antwort Anfrage im CRM (der EINE Anfrage-Weg), Rechnungs-ENTWURF für die
//     Gesellschaft der Einstellungen (lib/finanzen/rechnung/server.ts `entwurfAusBestellung`), Eingangsbestätigung über den Website-Absender, Glocke
//   → EIN Klick „Freigeben und senden“ (Markttraktion › Marketing › Anfragen, nur Person mit Sitzung): Rechnung STELLEN (Nummer, PDF + E-Rechnung) und
//     die Mail mit Rechnung als Anhang + Download-Links an die bestellende Person. Kein Klick = nichts geht raus (Eiserne Regel 3).
//   → Download: GET /api/baustein/laden?t=…&b=…&d=pdf|xlsx (signiertes Token: Bestell-Kennung + Ablauf 30 Tage, NIE die Adresse; nur solange geliefert).
// Hier nur die reinen Teile: Katalog prüfen, Eingabe prüfen, Bestellbedingungen + Fassung, Datenschutzhinweis, Beträge (über lib/finanzen/ust.ts),
// Texte der Mails, Status, Aufbewahrung. Server: lib/bausteine/server.ts. Keine Namen, keine Marke, keine Preise im Code — Preise nur aus dem Katalog
// (Daten der Website), die Gesellschaft nur aus den Einstellungen, Namen aus der Einrichtung. Hinweis, keine Rechtsberatung — Bedingungen, Hinweis
// und Mails einmal anwaltlich gegenlesen.

import { ausCent, inCent, ustAusNetto } from '@/lib/finanzen/ust';
import { landCode } from '@/lib/finanzen/erechnung/land';
import { ARTEN, DATEI_OK, downloadName, type UnterlageArt } from '@/lib/unterlagen/regeln';

export { ARTEN, ART_NAME, INHALTSTYP, anhangKopf, type UnterlageArt as BausteinArt } from '@/lib/unterlagen/regeln';

/** Bestände (Speicher-Register: Einstellungen = Haushalt, Bestellungen = Dritte). */
export const EINSTELLUNGEN = 'bausteine-einstellungen';
export const BESTELLUNGEN = 'baustein-bestellungen';

/** Die Download-Links der Liefer-Mail gelten so viele Tage ab der Freigabe. */
export const LINK_TAGE = 30;
/** Zahlungsziel, wenn die Einstellungen keins nennen. */
export const ZAHLUNGSZIEL_VORGABE = 14;
/** Regelsatz der Umsatzsteuer auf Bausteine (Kleinunternehmer der Gesellschaft → 0). */
export const UST_SATZ = 19;
/** Kennung eines Bausteins (= Ordnername der Seite auf der Website). */
export const BAUSTEIN_ID_OK = /^[a-z0-9-]{1,60}$/;
/** Kennung einer Bestellung (`bb-<uuid>`). */
export const BESTELL_ID_OK = /^bb-[0-9a-f-]{36}$/;
/** Höchstens so viele Dateien je Baustein, so viele Teile je Paket. */
export const DATEIEN_MAX = 4;
export const PAKET_MAX = 12;
/** Preisgrenze je Baustein (Cent) — Sicherung gegen einen Tippfehler im Katalog (darüber wird der Eintrag verworfen, nie gekürzt). */
export const PREIS_MAX_CENT = 10_000_000;

// ── Katalog (vom Website-Bau geschrieben: unterlagen/bausteine/katalog.json) ───────────────────────────────────────────────────────

export interface BausteinDatei { art: UnterlageArt; datei: string; name: string }
export interface Baustein {
  id: string; titel: string; bereich: string;
  /** Netto in Cent. */
  preis: number;
  /** Seite auf der Website (`/bausteine/<id>/`). */
  seite: string;
  /** Dateien (bei einem Paket leer — geliefert werden die Dateien seiner Teile). */
  dateien: BausteinDatei[];
  /** Ein Paket: die Kennungen seiner Teile (selbst Bausteine mit Dateien). */
  paket?: string[];
  /** Aus der Überlagerung in MAKE OS (Markttraktion › Website, lib/website/regeln.ts `bausteineUeberlagern`) — nie aus katalog.json. */
  kurz?: string;
  rang?: number;
  /** In MAKE OS ausgeblendet: nicht bestellbar, nicht auf der Website — bestehende Bestellungen werden weiter geliefert. */
  ausgeblendet?: boolean;
}

const seiteOk = (x: unknown): x is string => typeof x === 'string' && x.length <= 200 && x.startsWith('/') && !x.startsWith('//') && !/[\s<>"'\\]/.test(x);
const textOk = (x: unknown): string => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '');
const dateiOk = (datei: unknown, art: UnterlageArt): datei is string => typeof datei === 'string' && DATEI_OK.test(datei) && !datei.includes('..') && datei.toLowerCase().endsWith(`.${art}`);

/**
 * Den Katalog prüfen (rein): nur gültige Einträge kommen durch, je verworfenem ein Satz in `fehler` (fürs Log — ein Fehler im Generator soll auffallen,
 * nicht still verschwinden). Doppelte Kennungen: der erste gilt. Ein Paket gilt nur, wenn ALLE seine Teile gültige Bausteine mit Dateien sind (kein Paket
 * im Paket) — sonst würde nach der Freigabe eine unvollständige Lieferung verschickt.
 */
export function katalogPruefen(roh: unknown): { bausteine: Baustein[]; fehler: string[] } {
  const fehler: string[] = [];
  const liste = roh && typeof roh === 'object' && Array.isArray((roh as { bausteine?: unknown }).bausteine) ? (roh as { bausteine: unknown[] }).bausteine : null;
  if (!liste) return { bausteine: [], fehler: roh === null || roh === undefined ? [] : ['katalog.json: „bausteine“ ist keine Liste.'] };
  const einzeln: Baustein[] = [];
  const pakete: { b: Baustein; wo: string }[] = [];
  const ids = new Set<string>();
  liste.forEach((x, i) => {
    const e = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const wo = `Eintrag ${i + 1}${typeof e.id === 'string' ? ` (${e.id.slice(0, 60)})` : ''}`;
    if (typeof e.id !== 'string' || !BAUSTEIN_ID_OK.test(e.id)) { fehler.push(`${wo}: Kennung fehlt oder ist ungültig ([a-z0-9-]{1,60}).`); return; }
    if (ids.has(e.id)) { fehler.push(`${wo}: Kennung doppelt — der erste Eintrag gilt.`); return; }
    const titel = textOk(e.titel);
    if (!titel || titel.length > 200 || /[<>{}]/.test(titel)) { fehler.push(`${wo}: Titel fehlt oder ist ungültig.`); return; }
    const bereich = textOk(e.bereich);
    if (bereich.length > 80 || /[<>{}]/.test(bereich)) { fehler.push(`${wo}: Bereich ist ungültig.`); return; }
    if (typeof e.preis !== 'number' || !Number.isInteger(e.preis) || e.preis <= 0 || e.preis > PREIS_MAX_CENT) { fehler.push(`${wo}: Preis muss netto in ganzen Cent sein (größer 0).`); return; }
    if (!seiteOk(e.seite)) { fehler.push(`${wo}: Seite muss ein Pfad der Website sein (/…).`); return; }
    const basis = { id: e.id, titel, bereich, preis: e.preis, seite: e.seite };
    if (e.paket !== undefined) {
      const p = Array.isArray(e.paket) ? e.paket : null;
      if (!p || p.length < 2 || p.length > PAKET_MAX || !p.every(t => typeof t === 'string' && BAUSTEIN_ID_OK.test(t)) || new Set(p).size !== p.length || p.includes(e.id)) { fehler.push(`${wo}: Paket muss 2 bis ${PAKET_MAX} verschiedene Kennungen anderer Bausteine nennen.`); return; }
      if (Array.isArray(e.dateien) && e.dateien.length) { fehler.push(`${wo}: Ein Paket hat selbst keine Dateien — geliefert werden die Dateien seiner Teile.`); return; }
      ids.add(e.id);
      pakete.push({ b: { ...basis, dateien: [], paket: p as string[] }, wo });
      return;
    }
    const dateien = Array.isArray(e.dateien) ? e.dateien : [];
    if (!dateien.length || dateien.length > DATEIEN_MAX) { fehler.push(`${wo}: 1 bis ${DATEIEN_MAX} Dateien.`); return; }
    const ds: BausteinDatei[] = [];
    for (const d0 of dateien) {
      const d = (d0 && typeof d0 === 'object' ? d0 : {}) as Record<string, unknown>;
      const art = ARTEN.find(a => a === d.art);
      if (!art) { fehler.push(`${wo}: Art einer Datei muss pdf oder xlsx sein.`); return; }
      if (ds.some(y => y.art === art)) { fehler.push(`${wo}: je Art höchstens eine Datei.`); return; }
      if (!dateiOk(d.datei, art)) { fehler.push(`${wo}: Dateiname ungültig (nur A–Z, 0–9, . _ -, keine Pfade, Endung .${art}).`); return; }
      ds.push({ art, datei: d.datei, name: downloadName(d.name, art, d.datei) });
    }
    ids.add(e.id);
    einzeln.push({ ...basis, dateien: ds });
  });
  const gueltige = [...einzeln];
  for (const { b, wo } of pakete) {
    const fehlt = (b.paket ?? []).filter(t => !einzeln.some(x => x.id === t));
    if (fehlt.length) { fehler.push(`${wo}: Teile fehlen oder sind ungültig (${fehlt.join(', ')}).`); continue; }
    gueltige.push(b);
  }
  // Reihenfolge wie im Katalog.
  const ordnung = new Map(liste.map((x, i) => [(x as { id?: unknown })?.id, i] as const));
  return { bausteine: gueltige.sort((a, b) => (ordnung.get(a.id) ?? 0) - (ordnung.get(b.id) ?? 0)), fehler };
}

/** Was mit einem Baustein geliefert wird: ein Paket → seine Teile, sonst er selbst. Teile, die es im Katalog nicht (mehr) gibt, fehlen. Rein. */
export function teileVon(b: Baustein, katalog: readonly Baustein[]): Baustein[] {
  if (!b.paket) return [b];
  return b.paket.map(id => katalog.find(x => x.id === id && !x.paket)).filter((x): x is Baustein => !!x);
}

// ── Beträge (Cent, über lib/finanzen/ust.ts — dieselbe Rechnung wie die Rechnung selbst) ────────────────────────────────────────────

export interface Betraege { netto: number; ust: number; brutto: number; satz: number }
export function betraege(nettoCent: number, satz: number): Betraege {
  const ust = satz ? inCent(ustAusNetto(ausCent(nettoCent), satz)) : 0;
  return { netto: nettoCent, ust, brutto: nettoCent + ust, satz };
}
const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
export const euro = (cent: number): string => EURO.format((cent || 0) / 100);

// ── Einstellungen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface BausteineEinstellungen {
  /** Kommt AUS — eingeschaltet nur vom Inhaber (Markttraktion › Marketing › Anfragen › Bausteine). */
  aktiv: boolean;
  /** Welche feste Gesellschaft die Rechnung stellt (Kennung aus lib/einheiten.ts) — Pflicht; ohne bleibt alles aus. Nie nach außen gegeben. */
  gesellschaft?: string;
  zahlungszielTage?: number;
  /** Eigener Text der Bestellbedingungen (eine Zeile = ein Punkt, Platzhalter `{zahlungsziel}`) — leer = Vorgabe. */
  bedingungenText?: string;
  geaendert?: string;
  geaendertVon?: string;
}

export const GRENZEN_EINSTELLUNGEN = { bedingungenText: 3000, zeile: 400, zeilen: 12 } as const;

/** Zahlungsziel aus den Einstellungen (0–90 Tage), sonst die Vorgabe. */
export const zahlungszielVon = (e: Pick<BausteineEinstellungen, 'zahlungszielTage'>): number =>
  typeof e.zahlungszielTage === 'number' && Number.isInteger(e.zahlungszielTage) && e.zahlungszielTage >= 0 && e.zahlungszielTage <= 90 ? e.zahlungszielTage : ZAHLUNGSZIEL_VORGABE;

/** Die Vorgabe der Bestellbedingungen — kurz, ohne Namen und ohne Beträge. Hinweis, keine Rechtsberatung. */
export const BEDINGUNGEN_VORGABE: readonly string[] = [
  'Bestellung nur für Unternehmer im Sinne des § 14 BGB — nicht für Verbraucher.',
  'Lieferung: Sie bekommen die Dateien als Download-Link per E-Mail, nachdem wir die Bestellung kurz geprüft haben (meist am selben Werktag). Die Links gelten 30 Tage; danach schicken wir auf Nachricht neue.',
  'Preis: wie auf der Seite angegeben, netto zuzüglich Umsatzsteuer. Die Rechnung kommt mit der Lieferung und ist innerhalb von {zahlungsziel} Tagen ohne Abzug zahlbar.',
  'Nutzung: Sie erhalten ein einfaches, unbefristetes Recht, die Inhalte in Ihrem eigenen Unternehmen zu nutzen und anzupassen. Weitergabe, Weiterverkauf und Veröffentlichung sind nicht erlaubt.',
  'Lehnen wir eine Bestellung ab, kommt kein Vertrag zustande und es entstehen keine Kosten.',
];

/** Text der Einstellung prüfen: `''` = Vorgabe, `null` = zu lang bzw. ungültig (Grund in `fehler`). Rein. */
export function bedingungenTextPruefen(roh: unknown): { ok: true; text: string } | { ok: false; status: 400 | 413; fehler: string } {
  if (roh === undefined || roh === null || roh === '') return { ok: true, text: '' };
  if (typeof roh !== 'string') return { ok: false, status: 400, fehler: 'Bedingungen: Text erwartet.' };
  const t = roh.normalize('NFC').replace(/\r\n?/g, '\n');
  if (t.length > GRENZEN_EINSTELLUNGEN.bedingungenText) return { ok: false, status: 413, fehler: `Bedingungen: höchstens ${GRENZEN_EINSTELLUNGEN.bedingungenText} Zeichen — nichts gekürzt.` };
  const zeilen = t.split('\n').map(z => z.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (zeilen.length > GRENZEN_EINSTELLUNGEN.zeilen) return { ok: false, status: 413, fehler: `Bedingungen: höchstens ${GRENZEN_EINSTELLUNGEN.zeilen} Punkte.` };
  if (zeilen.some(z => z.length > GRENZEN_EINSTELLUNGEN.zeile)) return { ok: false, status: 413, fehler: `Bedingungen: je Punkt höchstens ${GRENZEN_EINSTELLUNGEN.zeile} Zeichen.` };
  if (zeilen.some(z => /[<>]/.test(z))) return { ok: false, status: 400, fehler: 'Bedingungen: ohne < und >.' };
  return { ok: true, text: zeilen.join('\n') };
}

/** Die Zeilen der Bestellbedingungen, wie die Website sie zeigt (Platzhalter gefüllt). Rein. */
export function bedingungenZeilen(e: Pick<BausteineEinstellungen, 'bedingungenText' | 'zahlungszielTage'>): string[] {
  const roh = e.bedingungenText?.trim() ? e.bedingungenText.split('\n').map(z => z.trim()).filter(Boolean) : [...BEDINGUNGEN_VORGABE];
  const ziel = String(zahlungszielVon(e));
  return roh.map(z => z.split('{zahlungsziel}').join(ziel));
}

/** FNV-1a (32 Bit) als Hex — rein, Server und Browser gleich. */
function fnv(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
/** Fassung der Bedingungen = Fingerabdruck des gezeigten Textes: jede Änderung (auch des Zahlungsziels) ist eine neue Fassung (POST mit alter → 409). */
export const bedingungenFassung = (zeilen: readonly string[]): string => `bb-${fnv(zeilen.join('\n'))}`;

// ── Datenschutzhinweis (Art. 13) ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Hinweis über dem Absenden. Verantwortlicher und Vertragspartner NIE fest im Code — aus der Einrichtung bzw. dem Gesellschafts-Register (Firmierung).
 * Hinweis, keine Rechtsberatung.
 */
export function bestellHinweis(verantwortlich: string, link: string | null, vertragspartner: string | null): string[] {
  return [
    ...(vertragspartner ? [`Vertragspartner und Rechnungssteller: ${vertragspartner}.`] : []),
    `Verantwortlich für Ihre Daten: ${verantwortlich}.`,
    'Wofür: Wir bearbeiten Ihre Bestellung, schicken Ihnen Eingangsbestätigung, Rechnung und Download-Links und legen Sie in unserem Kundensystem an (Art. 6 Abs. 1 lit. b DSGVO — Vertrag). Werbung schicken wir Ihnen damit nicht.',
    'Was wir speichern: Name, Firma, Anschrift, USt-IdNr. (falls angegeben), E-Mail-Adresse, Telefon (falls angegeben), was Sie bestellt haben, wann und dass Sie den Bestellbedingungen zugestimmt haben.',
    'Speicherdauer: Rechnung und Bestellung bewahren wir so lange auf, wie es das Handels- und Steuerrecht verlangt (bis zu 10 Jahre, § 147 AO, § 257 HGB); eine abgelehnte Bestellung löschen wir nach 90 Tagen.',
    `Sie haben das Recht auf Auskunft, Berichtigung, Löschung (soweit keine Aufbewahrungspflicht besteht), Einschränkung, Widerspruch und Beschwerde bei einer Aufsichtsbehörde${link ? ` — mehr in der Datenschutzerklärung (${link})` : ''}.`,
  ];
}

// ── Eingabe der Bestellung ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const GRENZEN = { vorname: 60, nachname: 60, firma: 120, strasse: 120, plz: 12, ort: 80, land: 60, ustid: 20, email: 160, telefon: 40, koerper: 8 * 1024 } as const;

export interface Besteller {
  vorname: string; nachname: string; firma: string; strasse: string; plz: string; ort: string;
  /** Ländercode (ISO 3166-1 alpha-2), Vorgabe DE. */
  land: string;
  ustid?: string; email: string; telefon?: string;
}

const EMAIL_OK = /^[^\s@<>"',;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
const TELEFON_OK = /^\+?[\d ()/-]{6,30}$/;
const USTID_OK = /^[A-Z]{2}[A-Z0-9]{2,13}$/;
// eslint-disable-next-line no-control-regex
const STEUER = /[\u0000-\u001F\u007F]/;
const feld = (x: unknown): string => (typeof x === 'string' ? x.normalize('NFC').replace(/\s+/g, ' ').trim() : '');

export type EingabePruefung = { ok: true; besteller: Besteller } | { ok: false; status: 400 | 413; fehler: string };

/**
 * Die Eingabe prüfen (rein). Pflicht: Vorname, Nachname, Firma, Straße, PLZ, Ort, E-Mail (B2B, Rechnungsanschrift § 14 Abs. 4 UStG). Zu lang → 413
 * (nie gekürzt), unförmig → 400. Die Haken (Unternehmer, Bedingungen) und die Fassung prüft die Route.
 */
export function eingabePruefen(b: Record<string, unknown>): EingabePruefung {
  const roh = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
  for (const k of ['vorname', 'nachname', 'firma', 'strasse', 'plz', 'ort', 'land', 'ustid', 'email', 'telefon'] as const) {
    if (roh(k).trim().length > GRENZEN[k]) return { ok: false, status: 413, fehler: 'Eine Angabe ist zu lang.' };
    if (b[k] !== undefined && b[k] !== null && typeof b[k] !== 'string') return { ok: false, status: 400, fehler: 'Eine Angabe hat die falsche Form.' };
    // Zeilenumbrüche und Steuerzeichen nie — eine Angabe ist genau eine Zeile (sie steht so auf der Rechnung).
    if (/[\r\n]/.test(roh(k)) || STEUER.test(roh(k).replace(/\t/g, ' '))) return { ok: false, status: 400, fehler: 'Eine Angabe enthält Zeichen, die wir nicht annehmen.' };
  }
  const e = {
    vorname: feld(b.vorname), nachname: feld(b.nachname), firma: feld(b.firma), strasse: feld(b.strasse), plz: feld(b.plz), ort: feld(b.ort),
    land: feld(b.land) || 'DE', ustid: feld(b.ustid).replace(/\s/g, '').toUpperCase(), email: feld(b.email).toLowerCase(), telefon: feld(b.telefon),
  };
  if (!e.vorname || !e.nachname) return { ok: false, status: 400, fehler: 'Bitte Vor- und Nachnamen angeben.' };
  if (!e.firma) return { ok: false, status: 400, fehler: 'Bitte die Firma angeben — wir liefern nur an Unternehmen.' };
  if (!e.strasse || !e.plz || !e.ort) return { ok: false, status: 400, fehler: 'Bitte die vollständige Rechnungsanschrift angeben (Straße, PLZ, Ort).' };
  if ([e.vorname, e.nachname, e.firma, e.strasse, e.plz, e.ort].some(x => /[<>{}]/.test(x))) return { ok: false, status: 400, fehler: 'Eine Angabe enthält Zeichen, die wir nicht annehmen.' };
  const land = landCode(e.land);
  if (!land) return { ok: false, status: 400, fehler: 'Bitte das Land als Ländercode angeben (z. B. DE).' };
  if (e.ustid && !USTID_OK.test(e.ustid)) return { ok: false, status: 400, fehler: 'Die USt-IdNr. sieht nicht richtig aus (z. B. DE123456789).' };
  if (!EMAIL_OK.test(e.email)) return { ok: false, status: 400, fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' };
  if (e.telefon && !TELEFON_OK.test(e.telefon)) return { ok: false, status: 400, fehler: 'Die Telefonnummer sieht nicht richtig aus.' };
  return { ok: true, besteller: { vorname: e.vorname, nachname: e.nachname, firma: e.firma, strasse: e.strasse, plz: e.plz, ort: e.ort, land, ...(e.ustid ? { ustid: e.ustid } : {}), email: e.email, ...(e.telefon ? { telefon: e.telefon } : {}) } };
}

/** Lieferung ins Ausland: die Steuer vor dem Freigeben prüfen (EU mit USt-IdNr. → Reverse Charge statt 19 %). Rein. */
export const auslandPruefen = (b: Pick<Besteller, 'land'>): boolean => b.land !== 'DE';

// ── Bestellung (Bestand) ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export type BestellStatus = 'neu' | 'geliefert' | 'abgelehnt';
/** Wie die Oberfläche den Stand zeigt: `storniert`, sobald die gestellte Rechnung storniert ist (abgeleitet, nie gespeichert). */
export type WirksamerStatus = BestellStatus | 'storniert';

export interface Bestellung {
  id: string;
  /** Eingang (ISO). */
  am: string;
  bausteinId: string;
  /** Momentaufnahme aus dem Katalog beim Eingang. */
  titel: string;
  preisCent: number;
  ustSatz: number;
  /** Kennungen der gelieferten Bausteine (ein Paket: seine Teile). */
  teile: string[];
  besteller: Besteller;
  /** Bestätigt: Bestellung als Unternehmer, Bestellbedingungen in dieser Fassung gelesen (Nachweis). */
  unternehmer: true;
  bedingungen: { fassung: string; am: string };
  status: BestellStatus;
  /** Kartei (nach dem Eingang über den Anfrage-Weg). */
  kontaktId?: string;
  /** Firma der NEU angelegten Person (Rechnung hängt dann auch an ihr). */
  kundeFirmaId?: string;
  /** Die vorhandene Person war schon in der Kartei — Adresse unbestätigt (bitte vor dem Freigeben prüfen). */
  unbestaetigt?: true;
  /** Rechnungs-Entwurf bzw. gestellte Rechnung (`entwurfAusBestellung`). */
  rechnungId?: string;
  /** Was beim Vorbereiten nicht ging (ohne Adresse) — die Freigabe versucht es noch einmal. */
  problem?: string;
  /** Eingangsbestätigung: gesendet bzw. warum nicht (nie die Adresse). */
  bestaetigung?: { am: string; ok: boolean; grund?: string };
  /** Freigabe läuft (gegen den Doppelklick; verwaist nach 10 Min.). */
  inArbeit?: { am: string; von: string };
  /** Liefer-Mail gesendet (vor dem Status „geliefert“ festgehalten — ein zweiter Klick sendet nie doppelt). */
  versandt?: { am: string; von: string; ueber: string };
  geliefert?: { am: string; von: string; ueber: string };
  abgelehnt?: { am: string; von: string; grund?: string; absage?: boolean };
  /** Art. 17 (Aufbewahrungspflicht): Telefon und Kartei-Bezug getilgt, die Rechnungsdaten bleiben. */
  getilgtAm?: string;
  /**
   * 02.11. (Prüfung A): feste Kennungen der Anfrage im CRM (ein zweiter Versuch legt nichts doppelt an), das Follow-up „Anfrage beantworten“ der
   * Bestellung (Fund 11: bei Lieferung bzw. Ablehnung geschlossen) und wann die Glocke „Neue Bestellung“ ging (genau einmal, Fund 3).
   */
  anfrageIds?: { kontakt: string; followUp: string };
  followUpId?: string;
  eingangGemeldet?: string;
}
export interface BestellDatei { bestellungen: Bestellung[] }

export function wirksamerStatus(b: Pick<Bestellung, 'status'>, rechnungStatus?: string): WirksamerStatus {
  return b.status === 'geliefert' && rechnungStatus === 'storniert' ? 'storniert' : b.status;
}

/** Eine Freigabe gilt als verwaist nach so vielen Minuten (dann darf sie neu beginnen). */
export const IN_ARBEIT_MIN = 10;
export const inArbeitLaeuft = (b: Pick<Bestellung, 'inArbeit'>, jetzt: Date): boolean =>
  !!b.inArbeit && jetzt.getTime() - Date.parse(b.inArbeit.am) < IN_ARBEIT_MIN * 60_000;

/** Aufbewahrung: abgelehnte Bestellungen 90 Tage, gelieferte 6 Jahre ab Jahresende (§ 257 Abs. 4 HGB — die Rechnung selbst bleibt im Finanzplan). */
export const ABGELEHNT_TAGE = 90;
export const GELIEFERT_JAHRE = 6;
/** Was nach der Frist wegfällt (rein, beim Schreiben angewendet — rollend). Neue Bestellungen bleiben, bis jemand entscheidet. */
export function nachFrist(liste: readonly Bestellung[], jetzt: Date): Bestellung[] {
  const t = jetzt.getTime();
  return liste.filter(b => {
    if (b.status === 'abgelehnt') return t - Date.parse(b.abgelehnt?.am ?? b.am) < ABGELEHNT_TAGE * 86_400_000;
    if (b.status === 'geliefert') { const j = Number((b.geliefert?.am ?? b.am).slice(0, 4)); return jetzt.getUTCFullYear() <= j + GELIEFERT_JAHRE; }
    return true;
  });
}

// ── Texte an den Gast (immer dieselben) ────────────────────────────────────────────────────────────────────────────────────────────

export const BESTELL_TEXT = 'Danke für Ihre Bestellung. Sie bekommen gleich eine Eingangsbestätigung per E-Mail. Rechnung und Download-Link schicken wir Ihnen nach kurzer Prüfung, meist am selben Werktag.';
export const NICHT_DA_TEXT = 'Diesen Baustein kann man hier gerade nicht bestellen.';
export const NICHT_ANGENOMMEN = 'Das hat leider nicht geklappt. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.';
export const FASSUNG_ALT = 'Die Bestellbedingungen haben sich geändert. Bitte laden Sie die Seite neu.';

interface MailFuss { marke: string; verantwortlich: string; datenschutzLink: string | null }
const fuss = (w: MailFuss): string[] => [
  '',
  'Viele Grüße',
  w.marke,
  '',
  '—',
  `Absender: ${w.marke} · Verantwortlich: ${w.verantwortlich}`,
  `Datenschutz: Wir nutzen Ihre Angaben für Ihre Bestellung (Art. 6 Abs. 1 lit. b DSGVO); Werbung schicken wir Ihnen damit nicht.${w.datenschutzLink ? ` Mehr: ${w.datenschutzLink}` : ''}`,
];

/**
 * Eingangsbestätigung — fester Text, nur Vorname (geprüft), Titel und Beträge aus dem Katalog. KEINE Angaben aus dem Formular außer dem Vornamen
 * (Firma/Anschrift nicht): so lässt sich die Mail nicht als Träger für fremden Text an fremde Adressen missbrauchen.
 */
export function eingangMail(w: MailFuss & { vorname?: string; titel: string; b: Betraege }): { betreff: string; text: string } {
  return {
    betreff: `Ihre Bestellung: ${w.titel} — ${w.marke}`,
    text: [
      w.vorname ? `Guten Tag ${w.vorname},` : 'Guten Tag,',
      '',
      `danke, Ihre Bestellung „${w.titel}“ ist eingegangen. Rechnung und Download-Link schicken wir Ihnen nach kurzer Prüfung, meist am selben Werktag.`,
      '',
      `Betrag: ${euro(w.b.netto)} netto${w.b.satz ? ` zzgl. ${w.b.satz} % Umsatzsteuer (${euro(w.b.ust)}) = ${euro(w.b.brutto)}` : ''}. Die Rechnung kommt mit der Lieferung.`,
      '',
      'Sie haben nichts bestellt? Dann ignorieren Sie diese Mail und schreiben Sie uns kurz — wir löschen Ihre Angaben.',
      ...fuss(w),
    ].join('\n'),
  };
}

/** Die Liefer-Mail — fester Text: Rechnung im Anhang, je Datei ein Link, Gültigkeit, Zahlungsziel. Keine KI. */
export function lieferMail(w: MailFuss & { vorname?: string; titel: string; nummer: string; faellig: string; links: { titel: string; name: string; art: UnterlageArt; link: string }[] }): { betreff: string; text: string } {
  const mehrere = new Set(w.links.map(l => l.titel)).size > 1;
  return {
    betreff: `Ihr Baustein: ${w.titel} — Rechnung ${w.nummer}`,
    text: [
      w.vorname ? `Guten Tag ${w.vorname},` : 'Guten Tag,',
      '',
      `vielen Dank für Ihre Bestellung „${w.titel}“. Hier sind Ihre Dateien:`,
      '',
      ...w.links.flatMap(l => [`${mehrere ? `${l.titel} — ` : ''}${l.name} (${l.art === 'pdf' ? 'PDF' : 'Excel'}):`, l.link, '']),
      `Die Links gelten ${LINK_TAGE} Tage. Brauchen Sie danach einen neuen, antworten Sie einfach auf diese Mail.`,
      '',
      `Die Rechnung ${w.nummer} hängt an dieser Mail. Bitte überweisen Sie den Betrag bis ${tagDe(w.faellig)} auf das Konto, das auf der Rechnung steht.`,
      ...fuss(w),
    ].join('\n'),
  };
}

/** Neutrale Absage (nur auf Klick) — keine Gründe, keine Kosten. */
export function absageMail(w: MailFuss & { vorname?: string; titel: string }): { betreff: string; text: string } {
  return {
    betreff: `Ihre Bestellung: ${w.titel} — ${w.marke}`,
    text: [
      w.vorname ? `Guten Tag ${w.vorname},` : 'Guten Tag,',
      '',
      `danke für Ihr Interesse. Ihre Bestellung „${w.titel}“ können wir leider nicht annehmen. Es kommt kein Vertrag zustande und es entstehen Ihnen keine Kosten.`,
      '',
      'Bei Fragen antworten Sie einfach auf diese Mail.',
      ...fuss(w),
    ].join('\n'),
  };
}

const tagDe = (t: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t);

/** Kleine Seite, wenn ein Link nicht (mehr) gilt — ohne Skript, ohne fremde Quellen. Rein. */
export function linkSeite(o: { abgelaufen: boolean }): string {
  const satz = o.abgelaufen ? 'Der Link ist abgelaufen' : 'Dieser Link ist nicht gültig';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${satz}</title>`
    + '<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:48px 16px}main{max-width:560px;margin:0 auto}h1{font-size:20px}</style>'
    + `</head><body><main><h1>${satz}</h1><p>Schreiben Sie uns, wir schicken einen neuen Link — antworten Sie einfach auf die Mail mit Ihrer Rechnung.</p></main></body></html>`;
}

/** Text der Anfrage im CRM (nach „Anfrage über Website: “) — Titel und Preis aus dem Katalog. */
export const anfrageText = (titel: string, nettoCent: number): string => `Baustein „${titel}“ bestellt (${euro(nettoCent)} netto)`;
