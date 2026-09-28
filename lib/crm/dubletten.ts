// ─── CRM — Dubletten finden und zusammenführen (rein, getestet) ─────────────
// Die Masterdatei enthält Menschen doppelt (zwei Mailadressen, HubSpot und
// Apple). Erkannt wird über gleichen Namen UND ein zweites Merkmal (Firma,
// Domain, LinkedIn, Telefon) — Namensgleichheit allein ist kein Beweis.
// Zusammenführen ist eine bewusste Handlung: der behaltene Eintrag bekommt
// alles, was ihm fehlt, den ganzen Verlauf beider, alle Einwilligungen; eine
// Werbesperre des anderen gilt weiter (Sperre gewinnt immer).

import { anzeigename, privatNotizVerfasser, STUFEN, VON_HAND_MAX, type Aktivitaet, type Kontakt } from '@/lib/make-one/crm';
import { netzwerkVereinen } from './netzwerk-form';
import { markenMit, ohneMarkierte } from './aktivitaet-marke';
import type { CrmBestand } from './typen';
import { personUmbiegen } from './person-verweise';

const n = (t?: string) => (t ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
const domain = (k: Kontakt) => n((k.email ?? '').split('@')[1] ?? k.firmaDomain ?? '');
const tel = (t?: string) => (t ?? '').replace(/[^0-9]/g, '').replace(/^49/, '0').replace(/^00/, '0');

export function dubletten(kontakte: Kontakt[]): [Kontakt, Kontakt][] {
  const je = new Map<string, Kontakt[]>();
  for (const k of kontakte) { const key = n(`${k.vorname}${k.nachname}`); if (key.length >= 5) je.set(key, [...(je.get(key) ?? []), k]); }
  const paare: [Kontakt, Kontakt][] = [];
  for (const l of Array.from(je.values())) {
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const a = l[i], b = l[j];
      const zweites = (n(a.firma) && n(a.firma) === n(b.firma)) || (domain(a) && domain(a) === domain(b)) || (n(a.linkedin) && n(a.linkedin) === n(b.linkedin)) || (tel(a.telefon) && tel(a.telefon) === tel(b.telefon));
      if (zweites) paare.push([a, b]);
    }
  }
  return paare;
}

/** Felder, die `zusammenfuehren` eigens behandelt — die allgemeine Lückenfüllung lässt sie aus. */
const EIGENS: readonly string[] = ['id', 'aktivitaeten', 'geloeschteAktivitaeten', 'einwilligungen', 'werbesperre', 'stufe', 'importiertAm', 'geaendertAm', 'stand',
  'privatNotiz', 'privatNotizVon', 'netzwerk', 'vonHand', 'lead', 'zahlung'];

const leer = (v: unknown) => v === undefined || v === null || v === '';

/** Leere Felder von `a` aus `b` füllen (flach) — `a` gewinnt, wo es etwas hat. */
function luecken<T extends object>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a } as Record<string, unknown>;
  for (const [f, v] of Object.entries(b)) if (!leer(v) && leer(out[f])) out[f] = v;
  return out as T;
}

/** Lead vereinen: a gewinnt; Kriterien, die bei a „unklar“ sind, nimmt b, wenn b es weiß; Antworten füllen Lücken. */
function leadVereinen(a: Kontakt['lead'], b: Kontakt['lead']): Kontakt['lead'] {
  if (!a || !b) return a ?? b;
  const out = luecken(a, b)!;
  const kriterien = { ...a.kriterien };
  for (const [f, v] of Object.entries(b.kriterien ?? {}) as [keyof typeof kriterien, typeof kriterien[keyof typeof kriterien]][]) if (kriterien[f] === undefined || (kriterien[f] === 'unklar' && v !== 'unklar')) kriterien[f] = v;
  const antworten = luecken(a.antworten, b.antworten);
  return { ...out, kriterien, ...(antworten ? { antworten } : {}) };
}

/**
 * b in a zusammenführen. Liefert den neuen Eintrag für a; b wird danach gelöscht.
 * Regeln (28.09., F2):
 * - Stammdaten: a gewinnt, leere Felder füllt b (auch `phase`, `bean`, `lead`-Felder, `zahlung`-Felder inkl. IBAN).
 * - Private Notiz NUR paarweise: hat a eine, bleibt a's Paar (Notiz + Verfasser); hat nur b eine, kommt b's Paar —
 *   nie a's Text mit b's Verfasser. Schrieb dieselbe Person beide, werden die Texte aneinandergehängt.
 * - `netzwerk` über `netzwerkVereinen` (der weitere Schritt je Profil gewinnt), `vonHand` vereinigt.
 * - Verlauf: beide ohne Doppelte (gleiche Fassung = ein Eintrag), Löschmarken beider vereinigt und angewandt.
 */
/**
 * Kevin 28.09.: Beim Zusammenführen darf keine private Notiz verloren gehen.
 * Haben beide Einträge eine private Notiz von VERSCHIEDENEN Personen, passt das
 * nicht in ein Feld (privatNotiz gehört genau einer Person) — dann wird nicht
 * zusammengeführt, bis eine Notiz übertragen oder geleert ist.
 */
export function privatNotizKonflikt(a: Pick<Kontakt, 'privatNotiz' | 'privatNotizVon'>, b: Pick<Kontakt, 'privatNotiz' | 'privatNotizVon'>): boolean {
  return !!a.privatNotiz && !!b.privatNotiz && privatNotizVerfasser(a as Kontakt) !== privatNotizVerfasser(b as Kontakt);
}

export function zusammenfuehren(a: Kontakt, b: Kontakt, von: string, jetzt: string): Kontakt {
  const out: Kontakt = { ...a };
  for (const f of Object.keys(b) as (keyof Kontakt)[]) {
    if (EIGENS.includes(f)) continue;
    const v = b[f];
    if (!leer(v) && leer(out[f])) (out as unknown as Record<string, unknown>)[f] = v;
  }
  // Zweite Mailadresse nicht verlieren.
  if (b.email && a.email && b.email !== a.email) out.notiz = [a.notiz, `Weitere Mail: ${b.email}`].filter(Boolean).join(' · ').slice(0, 2000);

  // Private Notiz: nur als Paar.
  delete out.privatNotiz; delete out.privatNotizVon;
  const pa = privatNotizVerfasser(a), pb = privatNotizVerfasser(b);
  if (a.privatNotiz) {
    out.privatNotiz = pa === pb && b.privatNotiz && b.privatNotiz !== a.privatNotiz ? `${a.privatNotiz} · ${b.privatNotiz}`.slice(0, 2000) : a.privatNotiz;
    if (a.privatNotizVon) out.privatNotizVon = a.privatNotizVon;
  } else if (b.privatNotiz) {
    out.privatNotiz = b.privatNotiz;
    if (b.privatNotizVon) out.privatNotizVon = b.privatNotizVon;
  }

  const netz = netzwerkVereinen(a.netzwerk, b.netzwerk);
  if (netz) out.netzwerk = netz; else delete out.netzwerk;
  const vonHand = Array.from(new Set([...(a.vonHand ?? []), ...(b.vonHand ?? [])])).slice(0, VON_HAND_MAX);
  if (vonHand.length) out.vonHand = vonHand; else delete out.vonHand;
  const lead = leadVereinen(a.lead, b.lead);
  if (lead) out.lead = lead; else delete out.lead;
  const zahlung = luecken(a.zahlung, b.zahlung);
  if (zahlung) out.zahlung = zahlung; else delete out.zahlung;

  // Verlauf: Löschmarken beider gelten, jede Fassung nur einmal.
  const marken = markenMit(a.geloeschteAktivitaeten, b.geloeschteAktivitaeten ?? []);
  const schluessel = (x: Aktivitaet) => `${x.am}|${x.art}|${x.von}|${x.bezug ?? ''}|${x.text ?? ''}`;
  const gesehen = new Set<string>();
  const verlauf = ohneMarkierte([...(a.aktivitaeten ?? []), ...(b.aktivitaeten ?? [])], marken).filter(x => { const s = schluessel(x); if (gesehen.has(s)) return false; gesehen.add(s); return true; });
  out.aktivitaeten = [...verlauf, { am: jetzt, art: 'system' as const, text: `Zusammengeführt mit ${anzeigename(b)} (${b.email ?? b.id})`, von }].sort((x, y) => x.am.localeCompare(y.am));
  if (marken?.length) out.geloeschteAktivitaeten = marken; else delete out.geloeschteAktivitaeten;

  out.einwilligungen = [...(a.einwilligungen ?? []), ...(b.einwilligungen ?? [])];
  if (!out.einwilligungen.length) delete out.einwilligungen;
  if (b.werbesperre && !a.werbesperre) out.werbesperre = b.werbesperre;
  // Die weiter fortgeschrittene Stufe gewinnt; letzter Kontakt der jüngere.
  if (STUFEN.indexOf(b.stufe) > STUFEN.indexOf(a.stufe) && !['verloren', 'ruht'].includes(b.stufe)) out.stufe = b.stufe;
  if ((b.letzterKontakt ?? '') > (a.letzterKontakt ?? '')) out.letzterKontakt = b.letzterKontakt;
  delete out.stand;
  out.geaendertAm = jetzt.slice(0, 10);
  return out;
}

/** Verweise im CRM von b auf a umbiegen — ALLE Listen, eine Stelle (lib/crm/person-verweise.ts, 27.09.). */
export function verweiseUmbiegen(crm: CrmBestand, altId: string, neuId: string): CrmBestand {
  return personUmbiegen(crm, altId, neuId);
}
