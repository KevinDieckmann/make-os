// ─── CRM — Speicher „crm“ (Chancen, Mandate, Leistungen, Events …) ──────────
// Geschäftsdaten, geteilt von Kevin und Malin; kein Haushalt, nichts Privates.
// Zu zweit werden nur Einzeländerungen geschrieben (lib/sync.ts); jede Liste
// hat einen eigenen Säuberer, damit nur durchkommt, was das Modell kennt.

import { AsyncLocalStorage } from 'node:async_hooks';
import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { protokolliere, bestandDiff, listenDiff, type Aenderung, type Wer } from '@/lib/store/aenderungsprotokoll';
import type { Kontakt } from '@/lib/make-one/crm';
import { wendeAn, type ListenOp } from '@/lib/sync';
import { STUFEN, wechsleStufe, erwartetVerschiebung } from './pipeline';
import { firmaIdsErgaenzen } from './firmen-bezug';
import { localDay } from '@/lib/zeit';
import { crmKonflikte, loeschSperren, type CrmKonflikt, type LoeschSperre, type VerweisKontext } from './crm-stand';
import { CRM_LISTEN, type CrmBestand, type CrmListe, type Firma, type FirmaRolle, type Antrag, type AntragArt, type Verarbeitung, type Segment, type SegmentKriterien, type Beitrag, type NewsletterAusgabe, type Kampagne, type Chance, type Mandat, type Leistung, type Event, type Teilnahme, type PowerHourSitzung, type ChancenStufe, type Qual, type Freigabe, type FollowUp } from './typen';
import { wer, BEIDE, verantwortlich } from './team';
import { leadSaeubern } from './lead-form';
import { vernetzenSaeubern } from './netzwerk-form';
import { MARKE_MAX } from './marke';
import { zahlungSaeubern, zahlungZusammenfuehren } from './zahlung';
import { LIFECYCLE_PHASEN } from './lifecycle';
import { BEAN_IDS, istBean } from './bean';
import { mutterPruefen } from './konzern';
import { angebotAusSpeicher, leistungAngebotSaeubern, produktAngebotFehlt, ANGEBOT_GRENZEN } from './angebote';
import { personenSchranke, type PersonSchranke } from './personen-schranke';
import { crmFolgen, geloeschteDeals, karteiBetroffen, kontaktLeadsOhneDeals } from './bestand-folgen';
import type { Temperatur } from './typen';

const TEMPERATUREN: readonly Temperatur[] = ['kalt', 'lau', 'warm', 'heiss'];

export const CRM_SPEICHER = 'crm';
export const leererBestand = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [], followups: [], angebote: [] });

export async function ladeCrm(): Promise<CrmBestand> {
  const roh = { ...leererBestand(), ...((await loadJson<CrmBestand>(CRM_SPEICHER)) ?? {}) };
  // 27.09.: alte Deals und Mandate bekommen die Firmen-Kennung nachgetragen — hier im Speicher, dauerhaft mit der nächsten Änderung (aendereCrm).
  return firmaIdsErgaenzen(roh).bestand;
}

const txt = (v: unknown, n = 300) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
const opt = (v: unknown, n = 300) => { const t = txt(v, n); return t || undefined; };
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const zahl = (v: unknown, min = 0, max = 1e9) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0; };
const aus = <T extends string>(v: unknown, liste: readonly T[], standard: T): T => (liste.includes(v as T) ? (v as T) : standard);
const idOk = (v: unknown) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(v ?? ''));
// Nie abschneiden (28.09.): Listen werden nicht mehr still gekürzt — `crmGrenzen` lehnt vorher mit 413 ab,
// die Säuberer nehmen die Grenze nur noch als Sicherung (derselbe Wert, greift also nie still).
const ids = (v: unknown, max = GRENZE_IDS) => (Array.isArray(v) ? v.map(String).filter(idOk).slice(0, max) : []);
const texte = (v: unknown, n: number, l = 400) => (Array.isArray(v) ? v.map(x => txt(x, l)).filter(Boolean).slice(0, n) : []);
/** Zuständigkeit (lib/crm/team.ts) — nur Team-Kürzel oder „beide“. */
const zst = (o: Record<string, unknown>) => (wer(o.zustaendig) ? { zustaendig: wer(o.zustaendig) } : {});
function freigabe(v: unknown): Freigabe | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const f = v as Record<string, unknown>;
  const an = wer(f.an);
  if (!an || an === BEIDE || !['offen', 'ok', 'aenderung'].includes(String(f.status))) return undefined;
  return { status: f.status as Freigabe['status'], an, ...(wer(f.von) ? { von: wer(f.von) } : {}), ...(opt(f.am, 25) ? { am: opt(f.am, 25) } : {}), ...(opt(f.notiz, 600) ? { notiz: opt(f.notiz, 600) } : {}) };
}
const GES = ['kdv', 'kdc', 'ug', 'offen'] as const;
const ARTEN = ['retainer', 'projekt', 'workshop', 'vermittlung', 'software'] as const;
const Q = ['ja', 'nein', 'unklar'] as const;
const STUFEN_IDS = STUFEN.map(s => s.id) as ChancenStufe[];
/**
 * Deal-Historie (28.09., K4, #83): nie kürzen — vorher schnitt `.slice(-60)` still die ältesten Stufenwechsel ab
 * (Verweildauer, Umwandlung und Zyklus rechnen daraus). Wer über diese Grenze wachsen will, bekommt 413 mit Text.
 */
export const HISTORIE_MAX = 5000;

/**
 * Obergrenzen der Listen in CRM-Einträgen (28.09., Regel „nie abschneiden, ablehnen“). Vorher kürzten die
 * Säuberer still: Kampagnen-Ergebnisse auf 1.000, Kampagnen-Kontakte auf 500, Beitrags-Wirkung auf 200,
 * Personen je Deal/Mandat auf 20, Checklisten auf 60 … Jetzt: hohe Grenze, darüber 413 mit Text (`crmGrenzen`).
 */
const GRENZE_IDS = 500;
export const LISTEN_GRENZEN: Partial<Record<CrmListe, Record<string, number>>> = {
  chancen: { kontaktIds: GRENZE_IDS, personenRollen: GRENZE_IDS },
  mandate: { kontaktIds: GRENZE_IDS, ziele: 500, leistungen: 1000, offen: 1000 },
  leistungen: { lieferumfang: 500, phasen: 500, unterlagen: 500 },
  firmen: { branchen: 100 },
  events: { ablauf: 1000, checkliste: 2000, budget: 1000 },
  sitzungen: { karten: 2000 },
  beitraege: { wirkung: 20000, quellen: 1000 },
  newsletter: { beitragIds: GRENZE_IDS },
  kampagnen: { schritte: 1000, kontaktIds: 20000, ergebnisse: 100000 },
  angebote: { positionen: ANGEBOT_GRENZEN.positionen },
};
const grenzeVon = (liste: CrmListe, feld: string) => LISTEN_GRENZEN[liste]?.[feld] ?? GRENZE_IDS;
/**
 * Werte je Segment-Kriterium (Typ, Kategorie, Label, Kreis …) — in `segmente.kriterien` und `kampagnen.zielgruppe`
 * (28.09. spät): vorher kürzte `strListe` still auf 50, jetzt 413 über `crmGrenzen`, der Säuberer nimmt denselben Wert.
 */
export const KRITERIEN_WERTE_MAX = 500;
/** Wo Segment-Kriterien in einem Eintrag stehen. */
const KRITERIEN_FELD: Partial<Record<CrmListe, string>> = { segmente: 'kriterien', kampagnen: 'zielgruppe' };

/** Überschreitet eine Änderung eine Listen-Grenze? Liefert die Texte (leer = alles gut). Ganze Änderung → 413. */
export function crmGrenzen(ops: ListenOp[]): string[] {
  const raus: string[] = [];
  for (const o of ops) {
    const e = (o.op === 'teil' ? o.felder : o.op === 'upsert' ? o.eintrag : undefined) as Record<string, unknown> | undefined;
    if (!e) continue;
    for (const [feld, max] of Object.entries(LISTEN_GRENZEN[o.liste as CrmListe] ?? {})) {
      const v = e[feld];
      const n = Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
      if (n > max) raus.push(`${o.liste} „${String(e.id ?? o.id ?? '')}“: ${n} Einträge in „${feld}“ — höchstens ${max}. Abgelehnt, nichts gekürzt.`);
    }
    const kf = KRITERIEN_FELD[o.liste as CrmListe];
    const kr = kf ? e[kf] : undefined;
    if (kr && typeof kr === 'object') {
      for (const [feld, v] of Object.entries(kr as Record<string, unknown>)) {
        if (Array.isArray(v) && v.length > KRITERIEN_WERTE_MAX) raus.push(`${o.liste} „${String(e.id ?? o.id ?? '')}“: ${v.length} Werte im Kriterium „${feld}“ — höchstens ${KRITERIEN_WERTE_MAX}. Abgelehnt, nichts gekürzt.`);
      }
    }
  }
  return raus;
}

function chance(o: Record<string, unknown>, jetzt: string, person: string): Chance | null {
  if (!idOk(o.id) || !txt(o.titel)) return null;
  const w = (o.wert ?? {}) as Record<string, unknown>;
  const ql = (o.qualifizierung ?? {}) as Record<string, unknown>;
  const ns = o.naechsterSchritt as Record<string, unknown> | undefined;
  const hist = Array.isArray(o.historie) ? (o.historie as Record<string, unknown>[]).map(h => ({ stufe: aus(h.stufe, STUFEN_IDS, 'qualifiziert'), am: txt(h.am, 25), von: txt(h.von, 40) || person })).filter(h => h.am) : [];
  const stufe = aus(o.stufe, STUFEN_IDS, 'qualifiziert');
  return {
    id: String(o.id), titel: txt(o.titel, 160), kontaktIds: ids(o.kontaktIds), ...(opt(o.firma, 160) ? { firma: opt(o.firma, 160) } : {}),
    art: aus(o.art, ARTEN, 'retainer'), ...(idOk(o.leistungId) ? { leistungId: String(o.leistungId) } : {}),
    wert: { betrag: zahl(w.betrag), basis: aus(w.basis, ['monat', 'jahr', 'einmalig'] as const, 'monat'), ...(zahl(w.laufzeitMonate, 0, 120) ? { laufzeitMonate: zahl(w.laufzeitMonate, 0, 120) } : {}) },
    stufe, historie: hist.length ? hist : [{ stufe, am: jetzt, von: person }],
    ...(ns && txt(ns.text) && tag(ns.datum) ? { naechsterSchritt: { text: txt(ns.text, 300), datum: tag(ns.datum)! } } : {}),
    ...(o.quelle ? { quelle: aus(o.quelle, ['empfehlung', 'event', 'content', 'outreach', 'bestand', 'inbound', 'kampagne'] as const, 'outreach') } : {}),
    ...(opt(o.quelleBezug, 80) ? { quelleBezug: opt(o.quelleBezug, 80) } : {}),
    qualifizierung: { schmerz: aus(ql.schmerz, Q, 'unklar') as Qual, entscheider: aus(ql.entscheider, Q, 'unklar') as Qual, budget: aus(ql.budget, Q, 'unklar') as Qual, zeitpunkt: aus(ql.zeitpunkt, Q, 'unklar') as Qual, wirkung: aus(ql.wirkung, Q, 'unklar') as Qual, alternative: aus(ql.alternative, Q, 'unklar') as Qual },
    ...(opt(o.grund, 300) ? { grund: opt(o.grund, 300) } : {}), ...(tag(o.wiedervorlage) ? { wiedervorlage: tag(o.wiedervorlage) } : {}),
    ...(tag(o.erwartetAm) ? { erwartetAm: tag(o.erwartetAm) } : {}),
    // Verschiebungen von „Entscheidung bis“ (28.09., K4) — gesetzt nur in dealRegeln, hier nur durchgereicht.
    ...(tag(o.erwartetUrsprung) ? { erwartetUrsprung: tag(o.erwartetUrsprung) } : {}),
    ...(zahl(o.erwartetVerschoben, 0, 999) ? { erwartetVerschoben: Math.round(zahl(o.erwartetVerschoben, 0, 999)) } : {}),
    gesellschaft: aus(o.gesellschaft, GES, 'offen'), besitzer: wer(o.besitzer) ?? (wer(person) && wer(person) !== BEIDE ? person : verantwortlich('sales')),
    ...(opt(o.selbstauskunft, 300) ? { selbstauskunft: opt(o.selbstauskunft, 300) } : {}),
    angelegt: txt(o.angelegt, 25) || jetzt, geaendert: jetzt, ...(tag(String(o.letzteAktivitaet ?? '').slice(0, 10)) ? { letzteAktivitaet: String(o.letzteAktivitaet).slice(0, 10) } : {}),
    ...(opt(o.notiz, 3000) ? { notiz: opt(o.notiz, 3000) } : {}),
  };
}

function mandat(o: Record<string, unknown>, jetzt: string): Mandat | null {
  if (!idOk(o.id) || !txt(o.kunde) || !txt(o.titel)) return null;
  const h = (o.honorar ?? {}) as Record<string, unknown>;
  const he = (o.health ?? {}) as Record<string, unknown>;
  const hv = (v: unknown) => (v === null || v === undefined || v === '' ? null : zahl(v, 0, 100));
  return {
    id: String(o.id), kunde: txt(o.kunde, 160), kontaktIds: ids(o.kontaktIds), titel: txt(o.titel, 200), art: aus(o.art, ARTEN, 'retainer'),
    ...(idOk(o.leistungId) ? { leistungId: String(o.leistungId) } : {}), ...(idOk(o.chanceId) ? { chanceId: String(o.chanceId) } : {}),
    gesellschaft: aus(o.gesellschaft, GES, 'offen'), status: aus(o.status, ['angebot', 'verhandlung', 'aktiv', 'pausiert', 'beendet'] as const, 'verhandlung'),
    vertragUnterschrieben: o.vertragUnterschrieben === true,
    ...(tag(o.start) ? { start: tag(o.start) } : {}), ...(tag(o.ende) ? { ende: tag(o.ende) } : {}),
    ...(zahl(o.mindestlaufzeitMonate, 0, 120) ? { mindestlaufzeitMonate: zahl(o.mindestlaufzeitMonate, 0, 120) } : {}),
    ...(zahl(o.kuendigungsfristTage, 0, 365) ? { kuendigungsfristTage: zahl(o.kuendigungsfristTage, 0, 365) } : {}),
    verlaengerung: aus(o.verlaengerung, ['auto', 'manuell', 'offen'] as const, 'offen'),
    honorar: { betrag: zahl(h.betrag), basis: aus(h.basis, ['monat', 'einmalig', 'tag'] as const, 'monat'), netto: h.netto !== false },
    ustSatz: [0, 7, 19].includes(Number(o.ustSatz)) ? Number(o.ustSatz) : 19,
    ...(opt(o.planpostenId, 80) ? { planpostenId: opt(o.planpostenId, 80) } : {}),
    rechnungsrhythmus: aus(o.rechnungsrhythmus, ['monatlich', 'quartal', 'einmalig'] as const, 'monatlich'), zahlungszielTage: zahl(o.zahlungszielTage ?? 14, 0, 120),
    ...(tag(o.naechstesReview) ? { naechstesReview: tag(o.naechstesReview) } : {}),
    ziele: Array.isArray(o.ziele) ? (o.ziele as Record<string, unknown>[]).slice(0, grenzeVon('mandate', 'ziele')).map((z, i) => ({ id: txt(z.id, 40) || `z${i}`, text: txt(z.text, 300), ...(opt(z.ziel, 80) ? { ziel: opt(z.ziel, 80) } : {}), ...(opt(z.ist, 80) ? { ist: opt(z.ist, 80) } : {}) })).filter(z => z.text) : [],
    health: { beteiligung: hv(he.beteiligung), umsetzung: hv(he.umsetzung), wirkung: hv(he.wirkung), zahlung: hv(he.zahlung), stimmung: hv(he.stimmung) },
    leistungen: texte(o.leistungen, grenzeVon('mandate', 'leistungen'), 400), offen: texte(o.offen, grenzeVon('mandate', 'offen'), 800), ...(opt(o.phase, 40) ? { phase: opt(o.phase, 40) } : {}),
    ...(opt(o.quelle, 600) ? { quelle: opt(o.quelle, 600) } : {}), ...(opt(o.notiz, 3000) ? { notiz: opt(o.notiz, 3000) } : {}), ...zst(o), geaendert: jetzt,
  };
}

function leistung(o: Record<string, unknown>, jetzt: string): Leistung | null {
  if (!idOk(o.id) || !txt(o.name)) return null;
  const p = (o.preis ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id), name: txt(o.name, 160), typ: aus(o.typ, ['diagnose', 'workshop', 'retainer', 'sprint', 'vermittlung', 'software'] as const, 'retainer'),
    stufe: aus(o.stufe, ['einstieg', 'kern', 'premium'] as const, 'kern'),
    // Planung (27.09.): Basis, Laufzeit und Aufwand sind die Felder, die der Szenario-Baukasten aus dem Produkt zieht.
    preis: { betrag: zahl(p.betrag), ...(zahl(p.bis) ? { bis: zahl(p.bis) } : {}), einheit: txt(p.einheit, 80) || 'Monat netto', ...(['monat', 'jahr', 'einmalig'].includes(p.basis as string) ? { basis: p.basis as 'monat' | 'jahr' | 'einmalig' } : {}) },
    ...(zahl(o.laufzeitMonate, 0, 600) ? { laufzeitMonate: zahl(o.laufzeitMonate, 0, 600) } : {}),
    ...(o.aufwand && typeof o.aufwand === 'object' ? (() => { const a = o.aufwand as Record<string, unknown>; const anteil = zahl(a.anteil, 0, 1); const stunden = zahl(a.stunden, 0, 100000); return anteil || stunden ? { aufwand: { ...(anteil ? { anteil } : {}), ...(stunden ? { stunden } : {}) } } : {}; })() : {}),
    ...(opt(o.beschreibung, 1500) ? { beschreibung: opt(o.beschreibung, 1500) } : {}), lieferumfang: texte(o.lieferumfang, grenzeVon('leistungen', 'lieferumfang'), 300),
    ...(opt(o.grenzen, 600) ? { grenzen: opt(o.grenzen, 600) } : {}), ...(opt(o.ergebnis, 600) ? { ergebnis: opt(o.ergebnis, 600) } : {}),
    gesellschaft: aus(o.gesellschaft, GES, 'offen'), status: aus(o.status, ['aktiv', 'entwurf', 'eingestellt'] as const, 'entwurf'),
    ...(opt(o.quelle, 600) ? { quelle: opt(o.quelle, 600) } : {}),
    ...(opt(o.linie, 80) ? { linie: opt(o.linie, 80) } : {}),
    ...(Array.isArray(o.phasen) && o.phasen.length ? { phasen: (o.phasen as Record<string, unknown>[]).slice(0, grenzeVon('leistungen', 'phasen')).map((x, i) => ({ id: txt(x.id, 40) || `p${i}`, name: txt(x.name, 80), ...(zahl(x.dauerTage, 0, 730) ? { dauerTage: zahl(x.dauerTage, 0, 730) } : {}), ...(opt(x.beschreibung, 400) ? { beschreibung: opt(x.beschreibung, 400) } : {}) })).filter(x => x.name) } : {}),
    // Angebotstexte (28.09.): Leistungstext ist Pflicht für „aktiv“ — die Regel prüft `regelnAbgelehnt`.
    ...(leistungAngebotSaeubern(o.angebot) ? { angebot: leistungAngebotSaeubern(o.angebot) } : {}),
    ...(Array.isArray(o.unterlagen) && o.unterlagen.length ? { unterlagen: (o.unterlagen as Record<string, unknown>[]).slice(0, grenzeVon('leistungen', 'unterlagen')).map((x, i) => ({ id: txt(x.id, 40) || `u${i}`, titel: txt(x.titel, 120), art: aus(x.art, ['angebot', 'vertrag', 'deck', 'onepager', 'sonstiges'] as const, 'sonstiges'), ...(unterlageLink(x.url) ? { url: unterlageLink(x.url)! } : {}) })).filter(x => x.titel) } : {}),
    geaendert: jetzt,
  };
}

/** Nur https-Links oder Notizen im Brain (/os/wissen?n=…) — nie javascript: o. Ä. */
export function unterlageLink(v: unknown): string | undefined {
  const t = String(v ?? '').trim().slice(0, 500);
  return /^https:\/\/[^\s]+$/i.test(t) || /^\/os\/wissen\?n=[^\s]+$/.test(t) ? t : undefined;
}

const ROLLEN: FirmaRolle[] = ['zielkunde', 'kunde', 'ex_kunde', 'partner', 'dienstleister', 'investor', 'netzwerk', 'wettbewerb', 'offen'];
function firma(o: Record<string, unknown>, jetzt: string): Firma | null {
  if (!/^f-[a-z0-9-]{2,60}$/.test(String(o.id ?? '')) || !txt(o.name)) return null;
  const f = (n: keyof Firma, l = 200) => (opt(o[n], l) ? { [n]: opt(o[n], l) } : {});
  return {
    id: String(o.id), name: txt(o.name, 160), ...f('domain', 120), ...f('webseite'), ...f('branche', 160), ...f('mitarbeiter', 40), ...f('umsatz', 60), ...f('stadt', 80),
    ...(Array.isArray(o.branchen) && (o.branchen as unknown[]).some(x => txt(x, 60)) ? { branchen: Array.from(new Set((o.branchen as unknown[]).map(x => txt(x, 60)).filter(Boolean))).slice(0, grenzeVon('firmen', 'branchen')) } : {}),
    ...f('gegruendet', 20), ...f('linkedin'), ...f('telefon', 60), ...f('email', 160), ...f('rechtsform', 80),
    rolle: aus(o.rolle, ROLLEN, 'offen'), ...(o.rolleVonHand === true ? { rolleVonHand: true } : {}), ...(leadSaeubern(o.lead) ? { lead: leadSaeubern(o.lead) } : {}), ...f('marktinfo', 800), ...f('notiz', 3000), ...(zahlungSaeubern(o.zahlung) ? { zahlung: zahlungSaeubern(o.zahlung) } : {}),
    ...(istBean(o.bean) ? { bean: o.bean } : {}),
    // Mutterfirma (28.09., #7): Kennungsform und nie sie selbst; Kreis und tote Mutter prüft `mutterPruefen` gegen die ganze Liste.
    ...(/^f-[a-z0-9-]{2,63}$/.test(String(o.mutterId ?? '')) && o.mutterId !== o.id ? { mutterId: String(o.mutterId) } : {}),
    geaendert: jetzt,
  } as Firma;
}

function event(o: Record<string, unknown>, jetzt: string): Event | null {
  if (!idOk(o.id) || !txt(o.titel) || !tag(o.datum)) return null;
  return {
    id: String(o.id), titel: txt(o.titel, 160), format: aus(o.format, ['stammtisch', 'workshop', 'dinner', 'webinar', 'messe', 'sonstig'] as const, 'sonstig'),
    ziel: txt(o.ziel, 400), ...(opt(o.zielgruppe, 300) ? { zielgruppe: opt(o.zielgruppe, 300) } : {}), datum: tag(o.datum)!,
    ...(/^\d{2}:\d{2}$/.test(String(o.uhrzeit ?? '')) ? { uhrzeit: String(o.uhrzeit) } : {}), ...(opt(o.ort, 200) ? { ort: opt(o.ort, 200) } : {}),
    ...(zahl(o.kapazitaet, 0, 5000) ? { kapazitaet: zahl(o.kapazitaet, 0, 5000) } : {}), ...(zahl(o.kostenEuro, 0, 1e7) ? { kostenEuro: zahl(o.kostenEuro, 0, 1e7) } : {}),
    ...(opt(o.coHost, 160) ? { coHost: opt(o.coHost, 160) } : {}),
    status: aus(o.status, ['idee', 'geplant', 'einladung', 'durchgefuehrt', 'abgesagt'] as const, 'idee'),
    ...(opt(o.notiz, 3000) ? { notiz: opt(o.notiz, 3000) } : {}),
    ...(Array.isArray(o.ablauf) ? { ablauf: (o.ablauf as Record<string, unknown>[]).slice(0, grenzeVon('events', 'ablauf')).map(a => ({ zeit: txt(a.zeit, 5), punkt: txt(a.punkt, 200) })).filter(a => a.punkt) } : {}),
    ...(Array.isArray(o.checkliste) ? { checkliste: (o.checkliste as Record<string, unknown>[]).slice(0, grenzeVon('events', 'checkliste')).map((c, i) => ({ id: txt(c.id, 40) || `cl${i}`, text: txt(c.text, 200), tageVorher: zahl(c.tageVorher, -30, 120), erledigt: c.erledigt === true, ...(opt(c.aufgabeId, 80) ? { aufgabeId: opt(c.aufgabeId, 80) } : {}), ...(wer(c.wer) ? { wer: wer(c.wer) } : {}) })).filter(c => c.text) } : {}),
    ...(Array.isArray(o.budget) ? { budget: (o.budget as Record<string, unknown>[]).slice(0, grenzeVon('events', 'budget')).map((b, i) => ({ id: txt(b.id, 40) || `b${i}`, posten: txt(b.posten, 120), betrag: zahl(b.betrag, 0, 1e6) })).filter(b => b.posten) } : {}),
    ...(o.mixZiel && typeof o.mixZiel === 'object' ? { mixZiel: { zielkunden: zahl((o.mixZiel as Record<string, unknown>).zielkunden, 0, 100), kunden: zahl((o.mixZiel as Record<string, unknown>).kunden, 0, 100) } } : {}),
    ...(idOk(o.segmentId) ? { segmentId: String(o.segmentId) } : {}), ...(opt(o.vorlage, 40) ? { vorlage: opt(o.vorlage, 40) } : {}),
    ...zst(o), geaendert: jetzt,
  };
}

function teilnahme(o: Record<string, unknown>, jetzt: string): Teilnahme | null {
  if (!idOk(o.id) || !idOk(o.eventId) || !/^c-[a-z0-9-]{4,60}$/.test(String(o.kontaktId ?? ''))) return null;
  return {
    id: String(o.id), eventId: String(o.eventId), kontaktId: String(o.kontaktId),
    status: aus(o.status, ['vorgemerkt', 'eingeladen', 'zugesagt', 'abgesagt', 'da', 'no_show'] as const, 'vorgemerkt'),
    ...(opt(o.notiz, 1500) ? { notiz: opt(o.notiz, 1500) } : {}), ...(tag(o.followUpAm) ? { followUpAm: tag(o.followUpAm) } : {}),
    ...(['gast', 'co_host', 'speaker'].includes(String(o.rolle)) ? { rolle: o.rolle as Teilnahme['rolle'] } : {}),
    ...(typeof o.fotofreigabe === 'boolean' ? { fotofreigabe: o.fotofreigabe } : {}), ...(tag(o.eingeladenAm) ? { eingeladenAm: tag(o.eingeladenAm) } : {}),
    ...(['persoenlich', 'telefon', 'mail', 'linkedin'].includes(String(o.einladungsweg)) ? { einladungsweg: o.einladungsweg as Teilnahme['einladungsweg'] } : {}),
    ...(wer(o.einladenDurch) && wer(o.einladenDurch) !== BEIDE ? { einladenDurch: wer(o.einladenDurch) } : {}),
    ...(wer(o.eingechecktVon) && wer(o.eingechecktVon) !== BEIDE ? { eingechecktVon: wer(o.eingechecktVon) } : {}),
    // „Kein Nachfassen“ (Tag) — fiel hier vorher weg, und der Gast kam beim nächsten Speichern wieder ins Nachfassen (F1).
    ...(tag(o.nachfassenVerzichtet) ? { nachfassenVerzichtet: tag(o.nachfassenVerzichtet) } : {}),
    geaendert: jetzt,
  };
}

function sitzung(o: Record<string, unknown>, person: string): PowerHourSitzung | null {
  if (!idOk(o.id) || !tag(o.datum)) return null;
  const z = (o.ziel ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id), person: txt(o.person, 40) || person, datum: tag(o.datum)!, start: txt(o.start, 25), ...(opt(o.ende, 25) ? { ende: opt(o.ende, 25) } : {}),
    ziel: { gespraeche: zahl(z.gespraeche, 0, 50), termine: zahl(z.termine, 0, 20) },
    karten: Array.isArray(o.karten) ? (o.karten as Record<string, unknown>[]).slice(0, grenzeVon('sitzungen', 'karten')).map(k => ({ kontaktId: txt(k.kontaktId, 80), kategorie: txt(k.kategorie, 20), ...(opt(k.ergebnis, 20) ? { ergebnis: opt(k.ergebnis, 20) } : {}), ...(opt(k.notiz, 600) ? { notiz: opt(k.notiz, 600) } : {}) })) : [],
    ...(opt(o.gelernt, 600) ? { gelernt: opt(o.gelernt, 600) } : {}),
  };
}

const ANTRAEGE: AntragArt[] = ['auskunft', 'berichtigung', 'loeschung', 'einschraenkung', 'uebertragbarkeit', 'widerspruch'];
function antrag(o: Record<string, unknown>, jetzt: string, person: string): Antrag | null {
  if (!idOk(o.id) || !txt(o.name) || !tag(o.eingang)) return null;
  const eingang = tag(o.eingang)!;
  // Art.-15-Frist „+1 Monat“ mit Kappung am Monatsende (28.09., K3 · #77): 31.01. → 28./29.02., nicht 03.03.
  const d = new Date(`${eingang}T12:00:00Z`); const tagNr = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(Math.min(tagNr, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return {
    id: String(o.id), art: aus(o.art, ANTRAEGE, 'auskunft'), name: txt(o.name, 160), ...(opt(o.email, 160) ? { email: opt(o.email, 160) } : {}),
    ...(/^c-[a-z0-9-]{4,60}$/.test(String(o.kontaktId ?? '')) ? { kontaktId: String(o.kontaktId) } : {}),
    eingang, frist: tag(o.frist) ?? d.toISOString().slice(0, 10), status: o.status === 'erledigt' ? 'erledigt' : 'offen',
    ...(opt(o.ergebnis, 600) ? { ergebnis: opt(o.ergebnis, 600) } : {}), ...(tag(o.erledigtAm) ? { erledigtAm: tag(o.erledigtAm) } : {}), von: txt(o.von, 40) || person, geaendert: jetzt,
  };
}
function verarbeitung(o: Record<string, unknown>, jetzt: string): Verarbeitung | null {
  if (!idOk(o.id) || !txt(o.name)) return null;
  return {
    id: String(o.id), name: txt(o.name, 160), zweck: txt(o.zweck, 1500), personen: txt(o.personen, 600), daten: txt(o.daten, 800), rechtsgrundlage: txt(o.rechtsgrundlage, 300),
    empfaenger: txt(o.empfaenger, 800), drittland: txt(o.drittland, 300), loeschfrist: txt(o.loeschfrist, 300), toms: txt(o.toms, 1500), verantwortlich: txt(o.verantwortlich, 200), stand: jetzt.slice(0, 10),
  };
}

const strListe = (v: unknown, n = KRITERIEN_WERTE_MAX, l = 40) => (Array.isArray(v) ? v.map(x => txt(x, l)).filter(Boolean).slice(0, n) : undefined);
function segment(o: Record<string, unknown>, jetzt: string): Segment | null {
  if (!idOk(o.id) || !txt(o.name)) return null;
  const k = (o.kriterien ?? {}) as Record<string, unknown>;
  const kr: SegmentKriterien = {};
  for (const f of ['lebensphase', 'kreis', 'prio', 'firmaRolle', 'herkunft'] as const) { const l = strListe(k[f]); if (l?.length) kr[f] = l; }
  // Typ/Kategorie/Label „enthält einen von“ (28.09.) — freie Werte aus den Wertelisten.
  for (const f of ['typ', 'kategorie', 'label'] as const) { const l = strListe(k[f], KRITERIEN_WERTE_MAX, 80); if (l?.length) kr[f] = l; }
  for (const f of ['branche', 'stadt', 'stichwort'] as const) { const t = opt(k[f], 80); if (t) kr[f] = t; }
  if (['mail', 'telefon', 'linkedin', 'newsletter', 'einladung'].includes(String(k.kanal))) kr.kanal = k.kanal as SegmentKriterien['kanal'];
  if (typeof k.mitChance === 'boolean') kr.mitChance = k.mitChance;
  if (zahl(k.ohneKontaktSeitTagen, 0, 3650)) kr.ohneKontaktSeitTagen = zahl(k.ohneKontaktSeitTagen, 0, 3650);
  // Temperatur (27.09.), Lifecycle (28.09.) und BEAN (28.09.): nur bekannte Werte in fester Reihenfolge — vorher fielen sie hier beim Speichern weg.
  const temperatur = TEMPERATUREN.filter(t => Array.isArray(k.temperatur) && (k.temperatur as unknown[]).includes(t));
  if (temperatur.length) kr.temperatur = temperatur;
  const lifecycle = LIFECYCLE_PHASEN.filter(p => Array.isArray(k.lifecycle) && (k.lifecycle as unknown[]).includes(p));
  if (lifecycle.length) kr.lifecycle = lifecycle;
  const bean = BEAN_IDS.filter(b => Array.isArray(k.bean) && (k.bean as unknown[]).includes(b));
  if (bean.length) kr.bean = bean;
  return { id: String(o.id), name: txt(o.name, 120), ...(opt(o.beschreibung, 400) ? { beschreibung: opt(o.beschreibung, 400) } : {}), kriterien: kr, geaendert: jetzt };
}
function beitrag(o: Record<string, unknown>, jetzt: string): Beitrag | null {
  if (!idOk(o.id) || !txt(o.titel)) return null;
  return {
    id: String(o.id), titel: txt(o.titel, 200), kanal: aus(o.kanal, ['linkedin', 'newsletter', 'blog', 'podcast', 'vortrag', 'sonstig'] as const, 'linkedin'),
    ...(opt(o.saeule, 60) ? { saeule: opt(o.saeule, 60) } : {}), status: aus(o.status, ['idee', 'entwurf', 'geplant', 'veroeffentlicht'] as const, 'idee'),
    ...(tag(o.datum) ? { datum: tag(o.datum) } : {}), ...(opt(o.text, 8000) ? { text: opt(o.text, 8000) } : {}), ...(unterlageLink(o.link) ? { link: unterlageLink(o.link)! } : {}),
    wirkung: Array.isArray(o.wirkung) ? (o.wirkung as Record<string, unknown>[]).slice(0, grenzeVon('beitraege', 'wirkung')).map(w => ({ kontaktId: txt(w.kontaktId, 80), art: aus(w.art, ['reaktion', 'gespraech', 'anfrage'] as const, 'reaktion'), am: tag(w.am) ?? jetzt.slice(0, 10), ...(opt(w.notiz, 300) ? { notiz: opt(w.notiz, 300) } : {}) })).filter(w => /^c-/.test(w.kontaktId)) : [],
    quellen: strListe(o.quellen, grenzeVon('beitraege', 'quellen'), 80) ?? [], ...zst(o),
    ...(wer(o.stimme) || o.stimme === 'marke' ? { stimme: o.stimme === 'marke' ? 'marke' : wer(o.stimme) } : {}),
    ...(freigabe(o.freigabe) ? { freigabe: freigabe(o.freigabe) } : {}), geaendert: jetzt,
  };
}
function ausgabe(o: Record<string, unknown>, jetzt: string): NewsletterAusgabe | null {
  if (!idOk(o.id) || !txt(o.titel)) return null;
  const n = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : zahl(v, 0, 1e6));
  return {
    id: String(o.id), titel: txt(o.titel, 200), ...(tag(o.datum) ? { datum: tag(o.datum) } : {}), status: aus(o.status, ['entwurf', 'bereit', 'versendet'] as const, 'entwurf'),
    inhalt: txt(o.inhalt, 20000), beitragIds: ids(o.beitragIds, grenzeVon('newsletter', 'beitragIds')),
    ...(n(o.empfaenger) !== undefined ? { empfaenger: n(o.empfaenger) } : {}), ...(n(o.antworten) !== undefined ? { antworten: n(o.antworten) } : {}), ...(n(o.abmeldungen) !== undefined ? { abmeldungen: n(o.abmeldungen) } : {}),
    ...zst(o), ...(freigabe(o.freigabe) ? { freigabe: freigabe(o.freigabe) } : {}),
    geaendert: jetzt,
  };
}

function kriterien(v: unknown): SegmentKriterien {
  const r = segment({ id: 'x-tmp', name: 'x', kriterien: v }, '');
  return r?.kriterien ?? {};
}
function kampagne(o: Record<string, unknown>, jetzt: string): Kampagne | null {
  if (!idOk(o.id) || !txt(o.name)) return null;
  return {
    id: String(o.id), name: txt(o.name, 160), playbook: txt(o.playbook, 40) || 'eigen', ziel: txt(o.ziel, 600),
    zielgruppe: kriterien(o.zielgruppe), ...(idOk(o.segmentId) ? { segmentId: String(o.segmentId) } : {}),
    kanal: aus(o.kanal, ['persoenlich', 'telefon', 'mail', 'linkedin', 'event', 'mix'] as const, 'persoenlich'),
    status: aus(o.status, ['entwurf', 'aktiv', 'abgeschlossen', 'abgebrochen'] as const, 'entwurf'),
    ...(tag(o.start) ? { start: tag(o.start) } : {}), ...(tag(o.ende) ? { ende: tag(o.ende) } : {}),
    schritte: Array.isArray(o.schritte) ? (o.schritte as Record<string, unknown>[]).slice(0, grenzeVon('kampagnen', 'schritte')).map((x, i) => ({ id: txt(x.id, 40) || `s${i}`, text: txt(x.text, 240), tag: zahl(x.tag, -60, 365), erledigt: x.erledigt === true, ...(opt(x.aufgabeId, 80) ? { aufgabeId: opt(x.aufgabeId, 80) } : {}) })).filter(x => x.text) : [],
    kontaktIds: Array.isArray(o.kontaktIds) ? (o.kontaktIds as unknown[]).map(String).filter(x => /^c-[a-z0-9-]{4,60}$/.test(x)).slice(0, grenzeVon('kampagnen', 'kontaktIds')) : [],
    ergebnisse: Array.isArray(o.ergebnisse) ? (o.ergebnisse as Record<string, unknown>[]).slice(0, grenzeVon('kampagnen', 'ergebnisse')).map(e => ({ kontaktId: txt(e.kontaktId, 80), ergebnis: aus(e.ergebnis, ['angesprochen', 'reagiert', 'gespraech', 'chance', 'kein_interesse'] as const, 'angesprochen'), am: tag(e.am) ?? jetzt.slice(0, 10), ...(wer(e.von) && wer(e.von) !== BEIDE ? { von: wer(e.von) } : {}) })).filter(e => /^c-/.test(e.kontaktId)) : [],
    von: aus(o.von, ['hand', 'head-sales', 'head-marketing'] as const, 'hand'), ...(opt(o.notiz, 3000) ? { notiz: opt(o.notiz, 3000) } : {}), ...zst(o), geaendert: jetzt,
    ...(vernetzenSaeubern(o.vernetzen) ? { vernetzen: vernetzenSaeubern(o.vernetzen) } : {}),
  };
}

const firmaId = (v: unknown) => (typeof v === 'string' && /^f-[a-z0-9-]{2,63}$/.test(v) ? v : undefined);
const DEAL_ROLLEN = ['entscheider', 'fuersprecher', 'nutzer', 'blocker'] as const;
/** Die Felder vom 27.09. je Liste — hier an einer Stelle, statt in jedem Säuberer. */
function zusatz(liste: CrmListe, o: Record<string, unknown>): Record<string, unknown> {
  switch (liste) {
    case 'chancen': {
      const rollen = o.personenRollen && typeof o.personenRollen === 'object'
        ? Object.fromEntries(Object.entries(o.personenRollen as Record<string, unknown>).filter(([k, v]) => idOk(k) && (DEAL_ROLLEN as readonly string[]).includes(String(v))).slice(0, grenzeVon('chancen', 'personenRollen')))
        : undefined;
      return { ...(firmaId(o.firmaId) ? { firmaId: firmaId(o.firmaId) } : {}), ...(rollen && Object.keys(rollen).length ? { personenRollen: rollen } : {}) };
    }
    case 'mandate': return firmaId(o.firmaId) ? { firmaId: firmaId(o.firmaId) } : {};
    // Marke (27.09.): durchreichen, wenn gesetzt — ohne Eintrag gilt Make.One abgeleitet (lib/crm/events.ts markeVon), nichts wird zurückgeschrieben.
    case 'events': return { ...(opt(o.kalenderUid, 120) ? { kalenderUid: opt(o.kalenderUid, 120) } : {}), ...(opt(o.marke, MARKE_MAX) ? { marke: opt(o.marke, MARKE_MAX) } : {}) };
    case 'kampagnen': case 'beitraege': return zahl(o.kostenEuro, 0, 1e7) ? { kostenEuro: zahl(o.kostenEuro, 0, 1e7) } : {};
    case 'newsletter': return wer(o.stimme) || o.stimme === 'marke' ? { stimme: String(o.stimme) } : {};
    case 'teilnahmen': {
      const f = o.feedback as Record<string, unknown> | undefined;
      if (!f || typeof f !== 'object') return {};
      const note = Number(f.note);
      const fb = { ...(Number.isFinite(note) && note >= 1 && note <= 5 ? { note: Math.round(note) } : {}), ...(opt(f.text, 600) ? { text: opt(f.text, 600) } : {}), ...(opt(f.am, 25) ? { am: opt(f.am, 25) } : {}) };
      return Object.keys(fb).length ? { feedback: fb } : {};
    }
    default: return {};
  }
}

const FU_BEZUG = ['kontakt', 'firma', 'chance', 'mandat', 'event'] as const;
const FU_ART = ['anruf', 'mail', 'linkedin', 'termin', 'nachricht', 'sonstig'] as const;
const FU_STATUS = ['offen', 'erledigt', 'verpasst', 'abgesagt'] as const;
const FU_QUELLE = ['hand', 'regel', 'kadenz', 'kampagne', 'event', 'head', 'zoe', 'deal'] as const;
function followup(o: Record<string, unknown>, jetzt: string, person: string): FollowUp | null {
  const bz = (o.bezug ?? {}) as Record<string, unknown>;
  if (!idOk(o.id) || !idOk(bz.id) || !txt(o.text) || !tag(o.faellig)) return null;
  const status = aus(o.status, FU_STATUS, 'offen');
  return {
    id: String(o.id), bezug: { art: aus(bz.art, FU_BEZUG, 'kontakt'), id: String(bz.id) },
    ...(idOk(o.kontaktId) ? { kontaktId: String(o.kontaktId) } : {}),
    art: aus(o.art, FU_ART, 'sonstig'), text: txt(o.text, 300), faellig: tag(o.faellig)!,
    ...(typeof o.uhrzeit === 'string' && /^\d{2}:\d{2}$/.test(o.uhrzeit) ? { uhrzeit: o.uhrzeit } : {}),
    zustaendig: wer(o.zustaendig) ?? (wer(person) && wer(person) !== BEIDE ? person : verantwortlich('sales')),
    status, ...(opt(o.ergebnis, 60) ? { ergebnis: opt(o.ergebnis, 60) } : {}), ...(opt(o.notiz, 1000) ? { notiz: opt(o.notiz, 1000) } : {}),
    quelle: aus(o.quelle, FU_QUELLE, 'hand'), ...(opt(o.aufgabeId, 80) ? { aufgabeId: opt(o.aufgabeId, 80) } : {}),
    ...(zahl(o.verschoben, 0, 99) ? { verschoben: zahl(o.verschoben, 0, 99) } : {}),
    ...(status === 'erledigt' ? { erledigtAm: opt(o.erledigtAm, 25) ?? jetzt } : {}),
    angelegt: txt(o.angelegt, 25) || jetzt, geaendert: jetzt,
  };
}

/** Geprüfter Eintrag — mit „geaendertVon“, wo die Liste ein „geaendert“ führt (für „Zuletzt im Team“). */
export function saeubern(liste: CrmListe, roh: Record<string, unknown>, jetzt: string, person: string): Record<string, unknown> | null {
  const e = saeubernRoh(liste, roh, jetzt, person);
  if (!e) return e;
  const mit = { ...e, ...zusatz(liste, roh) };
  return 'geaendert' in mit && liste !== 'antraege' && liste !== 'verarbeitungen' ? { ...mit, geaendertVon: person } : mit;
}
function saeubernRoh(liste: CrmListe, roh: Record<string, unknown>, jetzt: string, person: string): Record<string, unknown> | null {
  switch (liste) {
    case 'firmen': return firma(roh, jetzt) as unknown as Record<string, unknown>;
    case 'antraege': return antrag(roh, jetzt, person) as unknown as Record<string, unknown>;
    case 'verarbeitungen': return verarbeitung(roh, jetzt) as unknown as Record<string, unknown>;
    case 'segmente': return segment(roh, jetzt) as unknown as Record<string, unknown>;
    case 'beitraege': return beitrag(roh, jetzt) as unknown as Record<string, unknown>;
    case 'newsletter': return ausgabe(roh, jetzt) as unknown as Record<string, unknown>;
    case 'kampagnen': return kampagne(roh, jetzt) as unknown as Record<string, unknown>;
    case 'chancen': return chance(roh, jetzt, person) as unknown as Record<string, unknown>;
    case 'mandate': return mandat(roh, jetzt) as unknown as Record<string, unknown>;
    case 'leistungen': return leistung(roh, jetzt) as unknown as Record<string, unknown>;
    case 'events': return event(roh, jetzt) as unknown as Record<string, unknown>;
    case 'teilnahmen': return teilnahme(roh, jetzt) as unknown as Record<string, unknown>;
    case 'sitzungen': return sitzung(roh, person) as unknown as Record<string, unknown>;
    case 'followups': return followup(roh, jetzt, person) as unknown as Record<string, unknown>;
    // Angebote (28.09.) schreibt nur /api/crm/angebot (lib/crm/angebot-server.ts) — hier nur die Form halten.
    case 'angebote': return angebotAusSpeicher(roh) as unknown as Record<string, unknown>;
  }
}

/**
 * Regeln, die eine GANZE Änderung ablehnen (409, 28.09.):
 *  · Angebote nur über /api/crm/angebot — Entwurf, Stellen (Nummer, PDF), Annahme, Ablehnung, Version.
 *  · Ein Produkt geht erst mit Leistungstext (Angebotstexte) auf „aktiv“; ein aktives verliert ihn nicht.
 *    Bestehende aktive Produkte ohne Text bleiben aktiv (das Tool markiert „Text fehlt“).
 */
export function regelnAbgelehnt(b: CrmBestand, ops: ListenOp[]): string[] {
  const raus: string[] = [];
  for (const o of ops) {
    if (o.liste === 'angebote') { raus.push('Angebote werden nur im Angebots-Tool geändert (/api/crm/angebot).'); continue; }
    if (o.liste !== 'leistungen' || o.op === 'delete') continue;
    const id = String(o.op === 'teil' ? o.id : (o.eintrag as { id?: unknown } | undefined)?.id ?? '');
    const alt = b.leistungen.find(l => l.id === id);
    const roh = ((o.op === 'teil' ? o.felder : o.eintrag) ?? {}) as Record<string, unknown>;
    const status = 'status' in roh ? String(roh.status) : alt?.status;
    const angebot = 'angebot' in roh ? leistungAngebotSaeubern(roh.angebot) : alt?.angebot;
    const name = String(roh.name ?? alt?.name ?? id);
    const fehlt = produktAngebotFehlt({ angebot });
    if (status === 'aktiv' && alt?.status !== 'aktiv' && fehlt.length) raus.push(`„${name}“ kann erst aktiv gehen, wenn die Angebotstexte stehen — für Angebote fehlt: ${fehlt.join(', ')}.`);
    else if (status === 'aktiv' && alt?.status === 'aktiv' && !produktAngebotFehlt(alt).length && fehlt.length) raus.push(`„${name}“ ist aktiv — der Leistungstext bleibt Pflicht. Erst auf Entwurf stellen, dann leeren.`);
  }
  return raus;
}

/**
 * Stufenwechsel am Deal gelten nur mit Regel (27.09., bis dahin prüfte nur der Browser):
 * verloren braucht einen Grund, geparkt eine Wiedervorlage, eine offene Zielstufe einen
 * nächsten Schritt mit Datum; die Historie hängt der SERVER an — was der Browser mitschickt,
 * zählt nicht. Ein abgelehnter Wechsel wird übersprungen und als Fehler zurückgegeben.
 */
export function dealRegeln(b: CrmBestand, ops: ListenOp[], jetzt: string, person: string): { ops: ListenOp[]; fehler: string[]; grenze: string[] } {
  const fehler: string[] = [];
  const grenze: string[] = [];
  const raus: ListenOp[] = [];
  for (const o of ops) {
    if (o.liste !== 'chancen') { raus.push(o); continue; }
    if (o.op === 'delete') {
      // Sperre statt Löschen (Konzept): ein Deal mit Geschichte wird verloren oder geparkt — löschen nur eine Fehlanlage.
      const alt = b.chancen.find(c => c.id === String(o.id));
      if (alt && !(alt.historie.length <= 1 && !alt.wert.betrag && !(alt.notiz ?? '').trim())) { fehler.push(`„${alt.titel}“: Deals mit Geschichte werden nicht gelöscht — als verloren oder geparkt markieren.`); continue; }
      // Fehlanlage weg (28.09. spät): der Lead, der per `chanceId` darauf zeigte, geht in derselben Sperre zurück auf
      // Qualifizierung (`crmFolgen` am Ende von `wendeCrmAn`; Personen-Leads der Kartei über `aendereCrm`).
      raus.push(o); continue;
    }
    const roh = (o.op === 'teil' ? o.felder : o.eintrag) ?? {};
    const id = String(o.op === 'teil' ? o.id : o.eintrag?.id ?? '');
    const alt = b.chancen.find(c => c.id === id);
    // Neue Deals entstehen nur über /api/crm/deal (Prüfbericht 27.09., Punkt 4) — ein Upsert ohne Bestand wird abgelehnt.
    if (!alt) { fehler.push(`Deal „${String(roh.titel ?? id)}“: neue Deals nur über den Anlage-Dialog (/api/crm/deal).`); continue; }
    // Felder, die nur der Server setzt — was der Browser dazu schickt, zählt nicht:
    // „letzteAktivitaet“ (Aktivität, Stufenwechsel) — sonst ließe sich die Ampel „hängt“ von Hand grün stellen (Punkt 23);
    // Verschiebungen von „Entscheidung bis“ (28.09., K4, #84) — `erwartetVerschiebung` zählt sie aus dem alten und dem neuen Datum.
    const { letzteAktivitaet: _la, erwartetUrsprung: _eu, erwartetVerschoben: _ev, ...rest } = roh as Record<string, unknown>;
    const felder: Record<string, unknown> = { ...rest, ...erwartetVerschiebung(alt, rest), ...(o.op === 'upsert' && alt.letzteAktivitaet ? { letzteAktivitaet: alt.letzteAktivitaet } : {}) };
    const mit = (f: Record<string, unknown>): ListenOp => (o.op === 'teil' ? { ...o, felder: f } : { ...o, eintrag: f });
    const ziel = typeof felder.stufe === 'string' ? (felder.stufe as ChancenStufe) : undefined;
    if (!ziel || ziel === alt.stufe) {
      // Kein Stufenwechsel: die Historie darf der Browser nicht umschreiben.
      if ('historie' in felder) { const { historie: _h, ...ohne } = felder; raus.push(mit({ ...ohne, historie: alt.historie })); }
      else raus.push(mit(felder));
      continue;
    }
    if (alt.historie.length >= HISTORIE_MAX) { grenze.push(`„${alt.titel}“: die Historie hat ${alt.historie.length} Stufenwechsel — mehr als ${HISTORIE_MAX} nimmt der Deal nicht auf. Bitte einen neuen Deal anlegen.`); continue; }
    const r = wechsleStufe(alt, ziel, person, jetzt, { grund: typeof felder.grund === 'string' ? felder.grund : undefined, wiedervorlage: typeof felder.wiedervorlage === 'string' ? felder.wiedervorlage : undefined });
    if (!r.ok) { fehler.push(`„${alt.titel}“: ${r.fehler}`); continue; }
    const offenZiel = STUFEN.find(s => s.id === ziel)?.offen;
    const schritt = (felder.naechsterSchritt as { text?: string; datum?: string } | undefined) ?? alt.naechsterSchritt;
    const heuteTag = localDay(new Date(jetzt));
    if (offenZiel && !(schritt?.text && schritt.datum && schritt.datum >= heuteTag)) {
      fehler.push(schritt?.datum && schritt.datum < heuteTag ? `„${alt.titel}“: der nächste Schritt vom ${schritt.datum} ist überfällig — erst ein neues Datum setzen, dann die Stufe wechseln.` : `„${alt.titel}“: Für ${STUFEN.find(s => s.id === ziel)?.label} braucht es einen nächsten Schritt mit Datum.`);
      continue;
    }
    const neuFelder = { ...felder, stufe: ziel, historie: r.chance.historie, letzteAktivitaet: r.chance.letzteAktivitaet, ...(r.chance.grund ? { grund: r.chance.grund } : {}), ...(r.chance.wiedervorlage ? { wiedervorlage: r.chance.wiedervorlage } : {}) };
    raus.push(mit(neuFelder));
  }
  return { ops: raus, fehler, grenze };
}

export interface CrmAnwendung {
  bestand: CrmBestand; angewandt: number;
  /** Einzeln abgelehnte Deal-Änderungen (Stufenregeln) — der Rest gilt. */
  fehler: string[];
  /** 409 (28.09., K4): veralteter Stand — die GANZE Änderung ist abgelehnt, der Bestand unverändert. */
  konflikte: CrmKonflikt[];
  /** 409 (28.09., K4): Löschen trotz Verweisen — die GANZE Änderung ist abgelehnt. */
  sperren: LoeschSperre[];
  /** 413 (28.09., K4): über eine Grenze (Deal-Historie) — die GANZE Änderung ist abgelehnt. */
  grenze: string[];
  /**
   * 409 (28.09.): gegen eine Regel (Angebote nur übers Tool, Produkt ohne Leistungstext nicht aktiv; seit 28.09. spät
   * auch neue Verweise auf gesperrte Personen, `personenSchranke`) — die GANZE Änderung ist abgelehnt.
   */
  abgelehnt?: string[];
}

/**
 * Die Personen der Kartei für die Schranke — `aendereCrm` legt sie für die Dauer der Änderung hier ab (gelesen IN der
 * CRM-Sperre), damit `wendeCrmAn` sie findet, ohne dass jede Route sie laden und durchreichen muss.
 */
const personenImLauf = new AsyncLocalStorage<readonly PersonSchranke[]>();

/**
 * Eine Änderung aus Einzel-Ops auf den Bestand anwenden — alle Prüfungen gegen den Bestand IN der Sperre.
 * `personen` (Kartei) nur für Aufrufe außerhalb von `aendereCrm` (Tests); sonst gilt die Kartei aus der laufenden
 * Änderung. Ohne beides prüft die Personen-Schranke nicht.
 */
export function wendeCrmAn(b: CrmBestand, roh: ListenOp[], jetzt: string, person: string, kontext?: VerweisKontext, personen?: readonly PersonSchranke[]): CrmAnwendung {
  let angewandt = 0;
  // Erst Stand und Verweise (gegen den Bestand IN der Sperre), dann die Regeln — ein Konflikt lehnt alles ab.
  const konflikte = crmKonflikte(b, roh);
  if (konflikte.length) return { bestand: b, angewandt: 0, fehler: [], konflikte, sperren: [], grenze: [] };
  const sperren = loeschSperren(b, roh, kontext);
  if (sperren.length) return { bestand: b, angewandt: 0, fehler: [], konflikte: [], sperren, grenze: [] };
  // Nie abschneiden (28.09.): zu lange Listen → die ganze Änderung wird abgelehnt (413).
  const zuLang = crmGrenzen(roh);
  if (zuLang.length) return { bestand: b, angewandt: 0, fehler: [], konflikte: [], sperren: [], grenze: zuLang };
  // Gesperrte Personen (28.09. spät): neue Verweise auf Art.-18-Personen nie, Werbesperre nicht in Kampagne/Einladung.
  const abgelehnt = [...regelnAbgelehnt(b, roh), ...personenSchranke(b, roh, personen ?? personenImLauf.getStore() ?? [])];
  if (abgelehnt.length) return { bestand: b, angewandt: 0, fehler: [], konflikte: [], sperren: [], grenze: [], abgelehnt };
  const { ops: regelOps, fehler, grenze } = dealRegeln(b, roh, jetzt, person);
  if (grenze.length) return { bestand: b, angewandt: 0, fehler, konflikte: [], sperren: [], grenze };
  const ops = firmenZusammenfuehren(b, ibanSchuetzen(b, regelOps));
  const neu = { ...b };
  for (const l of CRM_LISTEN) {
    const eigene = ops.filter(o => o.liste === l);
    if (!eigene.length) continue;
    const r = wendeAn(b[l] as unknown as Record<string, unknown>[], eigene, 'id', roh => saeubern(l, roh, jetzt, person));
    (neu as Record<string, unknown>)[l] = r.liste;
    angewandt += r.angewandt;
  }
  // Mutterfirmen (28.09., #7): tote Mutter oder Kreis → nur diese Änderung zurück, mit Fehlertext.
  if (neu.firmen !== b.firmen) {
    const m = mutterPruefen(b.firmen, neu.firmen);
    if (m.fehler.length) { neu.firmen = m.firmen; fehler.push(...m.fehler); }
  }
  // Folgen in derselben Sperre (28.09. spät, lib/crm/bestand-folgen.ts): gelöschter Deal → Firmen-Lead zurück auf
  // Qualifizierung; umbenannte Firma → Anzeigename an Mandaten/Deals. Personen-Leads führt `aendereCrm` nach.
  return { bestand: crmFolgen(b, neu, jetzt, person), angewandt, fehler, konflikte: [], sperren: [], grenze: [] };
}

/**
 * IBAN der Firmen (28.09., H4): der Browser kennt sie nur maskiert. Ein maskierter, leerer oder
 * fehlender Wert heißt „unverändert“, nur eine neue gültige IBAN ersetzt, Entfernen nur mit
 * `ibanEntfernen: true` (lib/crm/zahlung.ts `zahlungZusammenfuehren`). Gilt für `teil` und `upsert`.
 */
function ibanSchuetzen(b: CrmBestand, ops: ListenOp[]): ListenOp[] {
  return ops.map(o => {
    if (o.liste !== 'firmen') return o;
    const id = o.op === 'teil' ? o.id : (o.eintrag as { id?: unknown } | undefined)?.id;
    const alt = b.firmen.find(f => f.id === id)?.zahlung;
    if (o.op === 'teil' && o.felder && 'zahlung' in o.felder) return { ...o, felder: { ...o.felder, zahlung: zahlungZusammenfuehren(o.felder.zahlung, alt) } };
    if (o.op === 'upsert' && o.eintrag && alt?.iban) return { ...o, eintrag: { ...o.eintrag, zahlung: zahlungZusammenfuehren((o.eintrag as Record<string, unknown>).zahlung, alt) } };
    return o;
  });
}

const leerWert = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
/**
 * Eine Firma „anlegen“, die es schon gibt (28.09., Prüfbericht F1): Die Kennung entsteht aus dem Namen
 * ohne Rechtsform (`firmenId`) — „Muster GmbH“ nach „Muster“ trifft denselben Eintrag. Ein `upsert` mit
 * bestehender Kennung ersetzt deshalb nie, sondern führt zusammen: nur leere Felder werden gefüllt;
 * Lead, Zahlung, BEAN, Notiz, Domain, Branchen, Rolle (auch `rolleVonHand`) und Name bleiben, wie sie sind.
 * Ändern geht über `teil` (Firmen-Karte, Matrix).
 */
export function firmaZusammenfuehren(alt: Firma, neu: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...alt };
  for (const [f, v] of Object.entries(neu)) if (f !== 'id' && leerWert(out[f]) && !leerWert(v)) out[f] = v;
  return out;
}
function firmenZusammenfuehren(b: CrmBestand, ops: ListenOp[]): ListenOp[] {
  return ops.map(o => {
    if (o.liste !== 'firmen' || o.op !== 'upsert' || !o.eintrag) return o;
    const alt = b.firmen.find(f => f.id === o.eintrag!.id);
    return alt ? { ...o, eintrag: firmaZusammenfuehren(alt, o.eintrag) } : o;
  });
}

type Kartei = { kontakte?: Kontakt[] } & Record<string, unknown>;
const personVon = (w?: Wer) => (w?.person && /^[a-z0-9-]{1,40}$/.test(w.person) ? w.person : undefined);

/**
 * Der gemeinsame Kern von `aendereCrm`/`aendereCrmAsync` — alles IN der Sperre des CRM-Bestands:
 *  · die Kartei lesen und für die Personen-Schranke ablegen (`personenImLauf`, lib/crm/personen-schranke.ts);
 *  · Folgen für JEDEN Schreibweg (`crmFolgen`, idempotent): gelöschter Deal → Firmen-Lead zurück, umbenannte Firma →
 *    Anzeigenamen an Mandaten/Deals;
 *  · Personen-Leads auf gelöschte Deals in der Kartei zurücksetzen — ein anderer Bestand, deshalb `updateJson('kontakte')`
 *    INNEN (Regel „zwei Bestände in einer Sperre“; nie umgekehrt die CRM-Sperre aus einer Kartei-Sperre nehmen).
 */
async function crmSchreiben(mut: (b: CrmBestand) => CrmBestand | Promise<CrmBestand>, protokollWer?: Wer): Promise<CrmBestand> {
  // Änderungsprotokoll (28.09., K1 #44): was sich je Liste geändert hat (Kennung + Feldnamen, nie Werte) — für JEDEN
  // Schreibweg über diese Stelle. Wer: ausdrücklich übergeben, sonst aus der laufenden Anfrage (lib/store/aenderungsprotokoll.ts).
  let aenderungen: Aenderung[] = [];
  let karteiAenderungen: Aenderung[] = [];
  const person = personVon(protokollWer);
  const fertig = await updateJsonAsync<CrmBestand>(CRM_SPEICHER, async cur => {
    // Die nachgetragenen Firmen-Kennungen (ladeCrm) werden hier mit der nächsten Schreibung dauerhaft (Prüfbericht 27.09., Punkt 11).
    const basis = firmaIdsErgaenzen({ ...leererBestand(), ...(cur ?? {}) }).bestand;
    const kontakte = (await loadJson<Kartei>('kontakte'))?.kontakte ?? [];
    const roh = await personenImLauf.run(kontakte, () => mut(basis));
    const jetzt = new Date().toISOString();
    const neu = roh === basis ? roh : crmFolgen(basis, roh, jetzt, person);
    const weg = geloeschteDeals(basis, neu);
    if (karteiBetroffen(kontakte, weg)) {
      await updateJson<Kartei>('kontakte', k => {
        const vorher = k?.kontakte ?? [];
        const r = kontaktLeadsOhneDeals(vorher, weg, jetzt, localDay(new Date(jetzt)), person);
        if (!r.geaendert.length) return k ?? { kontakte: [] };
        karteiAenderungen = listenDiff(vorher, r.kontakte);
        return { ...(k ?? {}), kontakte: r.kontakte };
      });
    }
    aenderungen = bestandDiff(cur as unknown as Record<string, unknown>, neu as unknown as Record<string, unknown>);
    return neu;
  });
  await protokolliere(CRM_SPEICHER, aenderungen, protokollWer);
  if (karteiAenderungen.length) await protokolliere('kontakte', karteiAenderungen, protokollWer);
  return fertig;
}

export async function aendereCrm(mut: (b: CrmBestand) => CrmBestand, protokollWer?: Wer): Promise<CrmBestand> {
  return crmSchreiben(mut, protokollWer);
}

/**
 * Wie `aendereCrm`, aber die Änderung darf warten (28.09., Angebot stellen): PDF erzeugen und in der Dateiablage
 * ablegen passiert IN der Sperre des CRM-Bestands (die Ablage ist ein anderer Bestand, `updateJsonAsync`-Regel) —
 * so ist die Nummer lückenlos und parallel sicher. Wirft `mut`, wird nichts geschrieben.
 */
export async function aendereCrmAsync(mut: (b: CrmBestand) => Promise<CrmBestand>, protokollWer?: Wer): Promise<CrmBestand> {
  return crmSchreiben(mut, protokollWer);
}

/** Kunden-Sicht aus den Mandaten — für Score, ZOE-Kontext und Loops (vorher eigener Speicher „kunden“). */
export function kundenAusMandaten(b: CrmBestand): { kunden: { name: string; status: 'aktiv' | 'gespraech' | 'ruht'; cashflow?: number }[] } {
  const je = new Map<string, { name: string; status: 'aktiv' | 'gespraech' | 'ruht'; cashflow: number }>();
  const rang = { aktiv: 0, gespraech: 1, ruht: 2 } as const;
  for (const m of b.mandate) {
    const s = m.status === 'aktiv' ? 'aktiv' : m.status === 'angebot' || m.status === 'verhandlung' ? 'gespraech' : 'ruht';
    const alt = je.get(m.kunde) ?? { name: m.kunde, status: s, cashflow: 0 };
    je.set(m.kunde, { name: m.kunde, status: rang[s] < rang[alt.status] ? s : alt.status, cashflow: alt.cashflow + (m.status === 'aktiv' && m.honorar.basis === 'monat' ? m.honorar.betrag : 0) });
  }
  return { kunden: Array.from(je.values()).map(k => ({ name: k.name, status: k.status, ...(k.cashflow ? { cashflow: k.cashflow } : {}) })) };
}
