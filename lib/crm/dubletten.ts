// ─── CRM — Dubletten finden und zusammenführen (rein, getestet) ─────────────
// Die Masterdatei enthält Menschen doppelt (zwei Mailadressen, HubSpot und
// Apple). Erkannt wird über gleichen Namen UND ein zweites Merkmal (Firma,
// Domain, LinkedIn, Telefon) — Namensgleichheit allein ist kein Beweis.
// Zusammenführen ist eine bewusste Handlung: der behaltene Eintrag bekommt
// alles, was ihm fehlt, den ganzen Verlauf beider, alle Einwilligungen; eine
// Werbesperre des anderen gilt weiter (Sperre gewinnt immer).
//
// Ablaufprüfung 28.09.: vor dem Zusammenführen zeigt `wasWandert` (rein), was vom weggefallenen Eintrag zum
// behaltenen wandert; `zusammenfuehrenPruefen` lehnt ab statt still zu kürzen (private Notizen zweier Personen,
// zusammen zu lange Notiz). „Rückgängig“: lib/crm/zusammenfuehren-lauf.ts (Server).

import { anzeigename, istSammelAdresse, normTelefon, privatNotizVerfasser, STUFEN, VON_HAND_MAX, type Aktivitaet, type Kontakt } from '@/lib/make-one/crm';
import { suchNorm } from '@/lib/text/such-norm';
import { netzwerkVereinen } from './netzwerk-form';
import { markenMit, ohneMarkierte } from './aktivitaet-marke';
import type { CrmBestand } from './typen';
import { personUmbiegen } from './person-verweise';
import { alleAdressen, emailsVereinen, hauptAdresse } from './emails';
import { stationenVereinen, hauptStation } from './stationen';
import { mehrfachVereinen } from './mehrfach';
import { tagVon } from '@/lib/zeit';

/** Höchstlänge der privaten Notiz (wie `saeubereKontakt`) — zusammen länger → Ablehnung statt Kürzung. */
export const PRIVAT_NOTIZ_MAX = 2000;

// K2 (28.09.): NFC zuerst und dieselbe Umlaut-Regel wie die Suche („Müller“ NFC/NFD = „Mueller“), EINE Telefon-Normalisierung
// (`normTelefon`, E.164-nah) wie der Import — vorher wurde „0049 30 …“ hier zu „049…“ und fand „030 …“ nicht.
const n = (t?: string) => suchNorm(t).replace(/[^a-z0-9]/g, '');
const domain = (k: Kontakt) => n((k.email ?? '').split('@')[1] ?? k.firmaDomain ?? '');
const tel = normTelefon;
/** Persönliche Adressen (alle, 28.09. #11) — Sammeladressen (info@ …) sind kein Beweis. */
const persoenlich = (k: Kontakt) => alleAdressen(k).filter(a => !istSammelAdresse(a));
const gemeinsameAdresse = (a: Kontakt, b: Kontakt) => { const x = new Set(persoenlich(a)); return persoenlich(b).some(m => x.has(m)); };

/**
 * Paare, die vermutlich derselbe Mensch sind: gleicher Name UND ein zweites Merkmal (Firma, Domain, LinkedIn,
 * Telefon, eine gemeinsame Adresse) — oder, seit 28.09. (#11), eine gemeinsame persönliche Adresse (egal unter
 * welcher: Haupt-, weitere oder alte Adresse), auch bei abweichend geschriebenem Namen.
 */
export function dubletten(kontakte: Kontakt[]): [Kontakt, Kontakt][] {
  const je = new Map<string, Kontakt[]>();
  for (const k of kontakte) { const key = n(`${k.vorname}${k.nachname}`); if (key.length >= 5) je.set(key, [...(je.get(key) ?? []), k]); }
  const paare: [Kontakt, Kontakt][] = [];
  const gesehen = new Set<string>();
  const paar = (a: Kontakt, b: Kontakt) => { const s = [a.id, b.id].sort().join('|'); if (a.id === b.id || gesehen.has(s)) return; gesehen.add(s); paare.push([a, b]); };
  for (const l of Array.from(je.values())) {
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const a = l[i], b = l[j];
      const zweites = (n(a.firma) && n(a.firma) === n(b.firma)) || (domain(a) && domain(a) === domain(b)) || (n(a.linkedin) && n(a.linkedin) === n(b.linkedin)) || (tel(a.telefon) && tel(a.telefon) === tel(b.telefon)) || gemeinsameAdresse(a, b);
      if (zweites) paar(a, b);
    }
  }
  const jeAdresse = new Map<string, Kontakt[]>();
  for (const k of kontakte) for (const m of persoenlich(k)) jeAdresse.set(m, [...(jeAdresse.get(m) ?? []), k]);
  for (const l of Array.from(jeAdresse.values())) for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) paar(l[i], l[j]);
  return paare;
}

/** Felder, die `zusammenfuehren` eigens behandelt — die allgemeine Lückenfüllung lässt sie aus. */
const EIGENS: readonly string[] = ['id', 'aktivitaeten', 'geloeschteAktivitaeten', 'einwilligungen', 'werbesperre', 'stufe', 'importiertAm', 'geaendertAm', 'stand',
  'privatNotiz', 'privatNotizVon', 'netzwerk', 'vonHand', 'lead', 'zahlung', 'stationen', 'emails', 'email', 'firmaId', 'position', 'firma', 'typ', 'typen', 'kategorie', 'kategorien', 'labels',
  // U2 (28.09.): Datenschutz-Felder mit eigenen Regeln (unten).
  'eingeschraenkt', 'geprueftAm', 'geprueftVon', 'hinweisBeiErhebung', 'loeschfristVerlaengert',
  // Netzwerken (03.10.): Server-Felder mit eigener Regel (unten).
  'rechtsgrundlageNotiz', 'kennengelerntFuer', 'datenschutzInformiertAm'];

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
  const stufen = luecken(a.stufen, b.stufen);
  return { ...out, kriterien, ...(antworten ? { antworten } : {}), ...(stufen ? { stufen } : {}) };
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

/**
 * Darf zusammengeführt werden? Liefert den Grund der Ablehnung oder null (28.09., Ablaufprüfung h):
 * private Notizen zweier Personen passen nicht in ein Feld; schrieb dieselbe Person beide, dürfen sie zusammen
 * nicht über `PRIVAT_NOTIZ_MAX` kommen — nie still kürzen.
 */
export function zusammenfuehrenPruefen(a: Kontakt, b: Kontakt): string | null {
  if (privatNotizKonflikt(a, b)) return 'Beide Einträge haben eine private Notiz von verschiedenen Personen. Bitte zuerst eine davon übertragen oder leeren — sonst ginge sie beim Zusammenführen verloren.';
  if (a.privatNotiz && b.privatNotiz && a.privatNotiz !== b.privatNotiz && `${a.privatNotiz} · ${b.privatNotiz}`.length > PRIVAT_NOTIZ_MAX) return `Die privaten Notizen beider Einträge wären zusammen länger als ${PRIVAT_NOTIZ_MAX.toLocaleString('de-DE')} Zeichen — bitte eine kürzen, dann zusammenführen. Nichts wurde gekürzt.`;
  return null;
}

/** Was vom weggefallenen Eintrag `b` zum behaltenen wandert — für die Bestätigung vor dem Zusammenführen (Anzahlen). */
export interface Wanderung { deals: number; aktivitaeten: number; followups: number; dateien: number; einwilligungen: number; kampagnen: number }
export function wasWandert(crm: Pick<CrmBestand, 'chancen' | 'followups' | 'kampagnen'>, b: Kontakt, dateien = 0): Wanderung {
  return {
    deals: crm.chancen.filter(c => c.kontaktIds.includes(b.id)).length,
    aktivitaeten: (b.aktivitaeten ?? []).filter(x => x.art !== 'system').length,
    followups: (crm.followups ?? []).filter(f => f.kontaktId === b.id || (f.bezug.art === 'kontakt' && f.bezug.id === b.id)).length,
    dateien,
    einwilligungen: (b.einwilligungen ?? []).length,
    kampagnen: (crm.kampagnen ?? []).filter(k => k.kontaktIds.includes(b.id)).length,
  };
}
/** „2 Deals · 14 Aktivitäten · keine Dateien …“ — für die Rückfrage. */
export function wanderungText(w: Wanderung): string {
  const t = (n: number, eins: string, viele: string) => `${n || 'keine'} ${n === 1 ? eins : viele}`;
  return [t(w.deals, 'Deal', 'Deals'), t(w.aktivitaeten, 'Aktivität', 'Aktivitäten'), t(w.followups, 'Follow-up', 'Follow-ups'), t(w.dateien, 'Datei', 'Dateien'), t(w.einwilligungen, 'Einwilligung', 'Einwilligungen'), t(w.kampagnen, 'Kampagne', 'Kampagnen')].join(' · ');
}

export function zusammenfuehren(a: Kontakt, b: Kontakt, von: string, jetzt: string): Kontakt {
  const out: Kontakt = { ...a };
  for (const f of Object.keys(b) as (keyof Kontakt)[]) {
    if (EIGENS.includes(f)) continue;
    const v = b[f];
    if (!leer(v) && leer(out[f])) (out as unknown as Record<string, unknown>)[f] = v;
  }
  // Adressen (28.09., #11): alle Adressen beider, keine doppelt — die Haupt-Adresse von a bleibt (hat a keine, die von b).
  // Vorher landete die zweite Adresse als Text „Weitere Mail: …“ in der Notiz.
  const emails = emailsVereinen(a, b);
  if (emails) { out.emails = emails; const h = hauptAdresse(emails); if (h) out.email = h.adresse; else delete out.email; }
  else if (!a.email && b.email) out.email = b.email;
  // Typ, Kategorie, Labels (28.09.): Vereinigung ohne Doppelte — der erste Wert von a bleibt der erste.
  delete out.typ; delete out.typen; delete out.kategorie; delete out.kategorien; delete out.labels;
  Object.assign(out, mehrfachVereinen(a, b));
  // Stationen (28.09., #2/#3): beide Beschäftigungshistorien, dieselbe laufende Firma nur einmal; die Hauptstation von a
  // bleibt (hat a keine Firma, die von b). `firmaId`/`position`/`firma` folgen der Hauptstation.
  const stationen = stationenVereinen(a, b);
  if (stationen) {
    const h = hauptStation(stationen);
    const trivial = stationen.length === 1 && !a.stationen && !b.stationen && !!h && !h.von && !h.bis && !h.art;
    if (trivial) delete out.stationen; else out.stationen = stationen;
    if (h) { out.firmaId = h.firmaId; if (h.rolle) out.position = h.rolle; else if (!out.position && b.position) out.position = b.position; if (h.firmaId === b.firmaId && h.firmaId !== a.firmaId && b.firma) out.firma = b.firma; else if (!out.firma && b.firma) out.firma = b.firma; }
    else { if (!out.position && b.position) out.position = b.position; if (!out.firma && b.firma) out.firma = b.firma; }
  } else { if (!out.position && b.position) out.position = b.position; if (!out.firma && b.firma) out.firma = b.firma; }

  // Private Notiz: nur als Paar.
  delete out.privatNotiz; delete out.privatNotizVon;
  const pa = privatNotizVerfasser(a), pb = privatNotizVerfasser(b);
  if (a.privatNotiz) {
    // Nie gekürzt (28.09., h): zu lang lehnt `zusammenfuehrenPruefen` vorher ab.
    out.privatNotiz = pa === pb && b.privatNotiz && b.privatNotiz !== a.privatNotiz ? `${a.privatNotiz} · ${b.privatNotiz}` : a.privatNotiz;
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
  // U2 (28.09.): Einschränkung (Art. 18) gilt weiter, wenn einer von beiden sie trägt (die Route lehnt das Zusammenführen
  // vorher ab — hier nur die Sicherung). Einwilligungen samt vollem Nachweis bleiben oben vollständig (beide Listen).
  const einsch = a.eingeschraenkt ?? b.eingeschraenkt;
  if (einsch) out.eingeschraenkt = einsch; else delete out.eingeschraenkt;
  // „Geprüft“ nur, wenn BEIDE geprüft sind — dann das ältere Datum (die Daten der anderen Hälfte hat sonst niemand gesehen).
  delete out.geprueftAm; delete out.geprueftVon;
  if (a.geprueftAm && b.geprueftAm) { const aelter = a.geprueftAm <= b.geprueftAm ? a : b; out.geprueftAm = aelter.geprueftAm; if (aelter.geprueftVon) out.geprueftVon = aelter.geprueftVon; }
  // Hinweis bei Erhebung: erteilt ist erteilt — der frühere Vermerk.
  const hinweis = [a.hinweisBeiErhebung, b.hinweisBeiErhebung].filter((x): x is NonNullable<typeof x> => !!x).sort((x, y) => x.am.localeCompare(y.am))[0];
  if (hinweis) out.hinweisBeiErhebung = hinweis; else delete out.hinweisBeiErhebung;
  // Netzwerken (03.10.): „für Kunden kennengelernt“ geht nie verloren (Übermittlung bleibt nachvollziehbar), Datenschutzhinweis: der frühere
  // Tag (informiert ist informiert), Verweis auf die Interessenabwägung: der der behaltenen Person, sonst der andere.
  const kf = [...(a.kennengelerntFuer ?? []), ...(b.kennengelerntFuer ?? [])].filter((x, i, l) => l.findIndex(y => y.firmaId === x.firmaId && y.eventId === x.eventId) === i);
  if (kf.length) out.kennengelerntFuer = kf; else delete out.kennengelerntFuer;
  const info = [a.datenschutzInformiertAm, b.datenschutzInformiertAm].filter((x): x is string => !!x).sort()[0];
  if (info) out.datenschutzInformiertAm = info; else delete out.datenschutzInformiertAm;
  const rn = a.rechtsgrundlageNotiz ?? b.rechtsgrundlageNotiz;
  if (rn) out.rechtsgrundlageNotiz = rn; else delete out.rechtsgrundlageNotiz;
  // Fristverlängerung: die längere gilt.
  const frist = [a.loeschfristVerlaengert, b.loeschfristVerlaengert].filter((x): x is NonNullable<typeof x> => !!x).sort((x, y) => y.bis.localeCompare(x.bis))[0];
  if (frist) out.loeschfristVerlaengert = frist; else delete out.loeschfristVerlaengert;
  // Die weiter fortgeschrittene Stufe gewinnt; letzter Kontakt der jüngere.
  if (STUFEN.indexOf(b.stufe) > STUFEN.indexOf(a.stufe) && !['verloren', 'ruht'].includes(b.stufe)) out.stufe = b.stufe;
  if ((b.letzterKontakt ?? '') > (a.letzterKontakt ?? '')) out.letzterKontakt = b.letzterKontakt;
  delete out.stand;
  // Berliner Tag (28.09., h) — `jetzt.slice(0, 10)` war nachts der UTC-Vortag.
  out.geaendertAm = tagVon(jetzt);
  return out;
}

/** Verweise im CRM von b auf a umbiegen — ALLE Listen, eine Stelle (lib/crm/person-verweise.ts, 27.09.). */
export function verweiseUmbiegen(crm: CrmBestand, altId: string, neuId: string): CrmBestand {
  return personUmbiegen(crm, altId, neuId);
}
