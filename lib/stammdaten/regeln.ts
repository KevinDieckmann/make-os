// ─── Stammdaten: persönliche Kennungen nur für die Person selbst (08.10. spät, „Datenschutz vor dem Upload“, L27) ─────
// Vorher lieferte `/api/state/stammdaten` Steuer-ID, Sozialversicherungsnummer und IBAN dem ganzen Haushalt aus — verdeckt
// nur in der Oberfläche —, schrieb per PUT ohne Stand und kürzte Werte still auf 400 Zeichen. Jetzt (Trennung serverseitig):
//   • GESCHÜTZTE Felder (`GESCHUETZT`) bekommt nur die Person, der der Satz gehört (`besitzer`); alle anderen bekommen sie
//     gar nicht (Steuer-ID, SV-Nummer) bzw. maskiert wie im CRM (IBAN, `ibanMaskiert`) — `geschuetzt` nennt die verdeckten Felder.
//   • Wem ein Satz gehört: `person` (setzt NUR der Server, beim ersten Schreiben festgehalten — ein späteres Umbenennen ändert
//     den Besitz nie), sonst der Name im Satz passt eindeutig zu einem Konto, sonst der Inhaber (Altbestand).
//   • Schreiben nur als Einzeländerung mit Stand (PATCH, 409), geschützte Felder nur durch die Person selbst (403),
//     über den Grenzen 413 — nie gekürzt.
// Rein (Server UND Browser) — Wächter: tests/vor-upload-datenschutz.test.ts.

import { ibanMaskiert } from '@/lib/crm/zahlung';

export type StammListe = 'firmen' | 'konten' | 'personen' | 'partner';
export const STAMM_LISTEN: readonly StammListe[] = ['firmen', 'konten', 'personen', 'partner'];
export type Satz = Record<string, string> & { id: string };
export interface Stammdaten { firmen: Satz[]; konten: Satz[]; personen: Satz[]; partner: Satz[]; stand?: string }
export const LEER: Stammdaten = { firmen: [], konten: [], personen: [], partner: [] };

/** Persönliche Kennungen je Liste — nur für die Person selbst. Firmen-Steuernummern sind keine persönlichen Kennungen. */
export const GESCHUETZT: Readonly<Record<StammListe, readonly string[]>> = { firmen: [], konten: ['iban'], personen: ['steuerId', 'svNummer'], partner: [] };
/** In welchem Feld der Name steht, der einem Konto entsprechen kann. */
const NAMENSFELD: Readonly<Record<StammListe, string | null>> = { firmen: null, konten: 'inhaber', personen: 'name', partner: null };

/** Grenzen — darüber wird abgelehnt (413), nie gekürzt. */
export const GRENZEN = { saetze: 200, felder: 40, zeichen: 2000, ops: 50 } as const;
/** Felder, die der Browser nie setzt (Server bzw. Ansicht). */
const RESERVIERT = new Set(['id', 'person', 'stand', 'geschuetzt']);
const SCHLUESSEL = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;
export const ID_MUSTER = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;

export const VERBOTEN = 'Nicht gespeichert: Steuer-ID, Sozialversicherungsnummer und IBAN sieht und ändert nur die Person selbst.';

export interface Ctx { konten: readonly { speicher: string; name: string }[]; inhaber: string | null }

const norm = (s: unknown) => String(s ?? '').normalize('NFC').toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim();

const hatWert = (v: unknown) => typeof v === 'string' && v.trim() !== '';
/** Trägt der Satz geschützte Werte? */
export const hatGeschuetztes = (liste: StammListe, s: Partial<Satz> | undefined) => GESCHUETZT[liste].some(f => hatWert(s?.[f]));

/** Welches Konto passt eindeutig zu diesem Namen (ganzer Name, sonst eindeutiger Vorname)? */
export function kontoZuName(name: unknown, ctx: Ctx): string | null {
  const n = norm(name);
  if (!n) return null;
  const voll = ctx.konten.filter(k => norm(k.name) === n);
  if (voll.length === 1) return voll[0].speicher;
  const vor = n.split(' ')[0];
  const treffer = ctx.konten.filter(k => norm(k.name).split(' ')[0] === vor);
  return treffer.length === 1 ? treffer[0].speicher : null;
}

/**
 * Wem der Satz gehört: festgehaltene Person → passender Name → bei einem Altbestand MIT Kennungen der Inhaber.
 * Ein Satz ohne Kennungen und ohne Besitz gehört noch niemandem (`null`) — es gibt nichts zu schützen.
 */
export function besitzer(liste: StammListe, s: Partial<Satz>, ctx: Ctx): string | null {
  if (s.person && ctx.konten.some(k => k.speicher === s.person)) return s.person;
  const feld = NAMENSFELD[liste];
  const name = feld ? kontoZuName(s[feld], ctx) : null;
  if (name) return name;
  return hatGeschuetztes(liste, s) ? ctx.inhaber : null;
}

/** Wem die Kennungen nach einer Änderung gehören (= wer sie schreiben darf): Besitz des Satzes, sonst die schreibende Person. */
export function besitzNach(liste: StammListe, alt: Partial<Satz> | undefined, neu: Partial<Satz>, ersteller: string | null, ctx: Ctx): string | null {
  if (alt) return besitzer(liste, alt, ctx) ?? ersteller;
  const feld = NAMENSFELD[liste];
  return (feld ? kontoZuName(neu[feld], ctx) : null) ?? ersteller;
}


/** Die Sicht einer Person (null = Systemlauf): geschützte Felder fremder Sätze fehlen bzw. stehen maskiert. */
export function fuerBetrachter<T extends Stammdaten>(d: T, person: string | null, ctx: Ctx): T {
  const raus = { ...d } as T;
  for (const l of STAMM_LISTEN) {
    const felder = GESCHUETZT[l];
    if (!felder.length) continue;
    raus[l] = (d[l] ?? []).map(s => {
      if (person && besitzer(l, s, ctx) === person) return s;
      const verdeckt = felder.filter(f => hatWert(s[f]));
      if (!verdeckt.length) return s;
      const n = { ...s } as Satz;
      for (const f of verdeckt) {
        if (f === 'iban') n[f] = ibanMaskiert(s[f]) ?? '••••';
        else delete n[f];
      }
      n.geschuetzt = verdeckt.join(',');
      return n;
    });
  }
  return raus;
}

export interface SatzFehler { status: 400 | 413; fehler: string }

/** Felder aus dem Browser prüfen: nur Text, bekannte Form, Grenzen → 400/413 (nie kürzen). `null`/'' = Feld leeren. */
export function felderPruefen(roh: unknown): { felder?: Record<string, string | null>; f?: SatzFehler } {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { f: { status: 400, fehler: 'Felder fehlen.' } };
  const raus: Record<string, string | null> = {};
  const eintraege = Object.entries(roh as Record<string, unknown>).filter(([k]) => !RESERVIERT.has(k));
  if (eintraege.length > GRENZEN.felder) return { f: { status: 413, fehler: `Abgelehnt: mehr als ${GRENZEN.felder} Felder. Nichts gespeichert.` } };
  for (const [k, v] of eintraege) {
    if (!SCHLUESSEL.test(k)) return { f: { status: 400, fehler: `Unbekanntes Feld „${k.slice(0, 40)}“.` } };
    if (v === null || v === '') { raus[k] = null; continue; }
    if (typeof v !== 'string') return { f: { status: 400, fehler: `Feld „${k}“: nur Text.` } };
    if (v.length > GRENZEN.zeichen) return { f: { status: 413, fehler: `Abgelehnt: „${k}“ hat mehr als ${GRENZEN.zeichen} Zeichen. Nichts gespeichert, nichts gekürzt.` } };
    raus[k] = v;
  }
  return { felder: raus };
}

/** Felder auf einen Satz legen (`null` entfernt das Feld). */
export function anwenden(alt: Satz, felder: Record<string, string | null>): Satz {
  const n = { ...alt } as Satz;
  for (const [k, v] of Object.entries(felder)) { if (v === null) delete n[k]; else n[k] = v; }
  return n;
}

/** Ändert diese Änderung ein geschütztes Feld? (Gleicher Wert oder die maskierte Ansicht zählt nicht.) */
export function aendertGeschuetztes(liste: StammListe, alt: Partial<Satz> | undefined, felder: Record<string, string | null>): boolean {
  return GESCHUETZT[liste].some(f => {
    if (!(f in felder)) return false;
    const v = felder[f];
    const a = alt?.[f];
    if ((v === null || v === undefined) && !hatWert(a)) return false;
    if (v === a) return false;
    if (f === 'iban' && hatWert(a) && v === ibanMaskiert(a)) return false;
    return true;
  });
}


/**
 * Den Besitz festhalten (nur Listen mit geschützten Feldern), sobald es etwas zu schützen gibt: einmal gesetzt, bleibt er —
 * ein späteres Umbenennen ändert ihn nie (sonst könnte man fremde Kennungen „auf sich“ umbenennen).
 */
export function besitzStempeln(liste: StammListe, n: Satz, alt: Satz | undefined, ersteller: string | null, ctx: Ctx): Satz {
  if (!GESCHUETZT[liste].length) return n;
  if (!alt?.person && !hatGeschuetztes(liste, n) && !hatGeschuetztes(liste, alt)) return n;
  const fest = alt?.person && ctx.konten.some(k => k.speicher === alt.person) ? alt.person : besitzNach(liste, alt, n, ersteller, ctx);
  return fest ? { ...n, person: fest } : n;
}
