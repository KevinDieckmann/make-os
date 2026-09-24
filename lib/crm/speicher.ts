// ─── CRM — Speicher „crm“ (Chancen, Mandate, Leistungen, Events …) ──────────
// Geschäftsdaten, geteilt von Kevin und Malin; kein Haushalt, nichts Privates.
// Zu zweit werden nur Einzeländerungen geschrieben (lib/sync.ts); jede Liste
// hat einen eigenen Säuberer, damit nur durchkommt, was das Modell kennt.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { wendeAn, type ListenOp } from '@/lib/sync';
import { STUFEN } from './pipeline';
import { CRM_LISTEN, type CrmBestand, type CrmListe, type Firma, type FirmaRolle, type Antrag, type AntragArt, type Verarbeitung, type Segment, type SegmentKriterien, type Beitrag, type NewsletterAusgabe, type Chance, type Mandat, type Leistung, type Event, type Teilnahme, type PowerHourSitzung, type ChancenStufe, type Qual } from './typen';

export const CRM_SPEICHER = 'crm';
export const leererBestand = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [] });

export async function ladeCrm(): Promise<CrmBestand> {
  return { ...leererBestand(), ...((await loadJson<CrmBestand>(CRM_SPEICHER)) ?? {}) };
}

const txt = (v: unknown, n = 300) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
const opt = (v: unknown, n = 300) => { const t = txt(v, n); return t || undefined; };
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const zahl = (v: unknown, min = 0, max = 1e9) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0; };
const aus = <T extends string>(v: unknown, liste: readonly T[], standard: T): T => (liste.includes(v as T) ? (v as T) : standard);
const idOk = (v: unknown) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(v ?? ''));
const ids = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(idOk).slice(0, 20) : []);
const texte = (v: unknown, n = 30, l = 400) => (Array.isArray(v) ? v.map(x => txt(x, l)).filter(Boolean).slice(0, n) : []);
const GES = ['kdv', 'kdc', 'ug', 'offen'] as const;
const ARTEN = ['retainer', 'projekt', 'workshop', 'vermittlung', 'software'] as const;
const Q = ['ja', 'nein', 'unklar'] as const;
const STUFEN_IDS = STUFEN.map(s => s.id) as ChancenStufe[];

function chance(o: Record<string, unknown>, jetzt: string, person: string): Chance | null {
  if (!idOk(o.id) || !txt(o.titel)) return null;
  const w = (o.wert ?? {}) as Record<string, unknown>;
  const ql = (o.qualifizierung ?? {}) as Record<string, unknown>;
  const ns = o.naechsterSchritt as Record<string, unknown> | undefined;
  const hist = Array.isArray(o.historie) ? (o.historie as Record<string, unknown>[]).slice(-60).map(h => ({ stufe: aus(h.stufe, STUFEN_IDS, 'qualifiziert'), am: txt(h.am, 25), von: txt(h.von, 40) || person })).filter(h => h.am) : [];
  const stufe = aus(o.stufe, STUFEN_IDS, 'qualifiziert');
  return {
    id: String(o.id), titel: txt(o.titel, 160), kontaktIds: ids(o.kontaktIds), ...(opt(o.firma, 160) ? { firma: opt(o.firma, 160) } : {}),
    art: aus(o.art, ARTEN, 'retainer'), ...(idOk(o.leistungId) ? { leistungId: String(o.leistungId) } : {}),
    wert: { betrag: zahl(w.betrag), basis: aus(w.basis, ['monat', 'jahr', 'einmalig'] as const, 'monat'), ...(zahl(w.laufzeitMonate, 0, 120) ? { laufzeitMonate: zahl(w.laufzeitMonate, 0, 120) } : {}) },
    stufe, historie: hist.length ? hist : [{ stufe, am: jetzt, von: person }],
    ...(ns && txt(ns.text) && tag(ns.datum) ? { naechsterSchritt: { text: txt(ns.text, 300), datum: tag(ns.datum)! } } : {}),
    ...(o.quelle ? { quelle: aus(o.quelle, ['empfehlung', 'event', 'content', 'outreach', 'bestand', 'inbound'] as const, 'outreach') } : {}),
    ...(opt(o.quelleBezug, 80) ? { quelleBezug: opt(o.quelleBezug, 80) } : {}),
    qualifizierung: { schmerz: aus(ql.schmerz, Q, 'unklar') as Qual, entscheider: aus(ql.entscheider, Q, 'unklar') as Qual, budget: aus(ql.budget, Q, 'unklar') as Qual, zeitpunkt: aus(ql.zeitpunkt, Q, 'unklar') as Qual, wirkung: aus(ql.wirkung, Q, 'unklar') as Qual, alternative: aus(ql.alternative, Q, 'unklar') as Qual },
    ...(opt(o.grund, 300) ? { grund: opt(o.grund, 300) } : {}), ...(tag(o.wiedervorlage) ? { wiedervorlage: tag(o.wiedervorlage) } : {}),
    ...(tag(o.erwartetAm) ? { erwartetAm: tag(o.erwartetAm) } : {}),
    gesellschaft: aus(o.gesellschaft, GES, 'offen'), besitzer: txt(o.besitzer, 40) || person,
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
    ziele: Array.isArray(o.ziele) ? (o.ziele as Record<string, unknown>[]).slice(0, 12).map((z, i) => ({ id: txt(z.id, 40) || `z${i}`, text: txt(z.text, 300), ...(opt(z.ziel, 80) ? { ziel: opt(z.ziel, 80) } : {}), ...(opt(z.ist, 80) ? { ist: opt(z.ist, 80) } : {}) })).filter(z => z.text) : [],
    health: { beteiligung: hv(he.beteiligung), umsetzung: hv(he.umsetzung), wirkung: hv(he.wirkung), zahlung: hv(he.zahlung), stimmung: hv(he.stimmung) },
    leistungen: texte(o.leistungen, 30, 400), offen: texte(o.offen, 30, 800),
    ...(opt(o.quelle, 600) ? { quelle: opt(o.quelle, 600) } : {}), ...(opt(o.notiz, 3000) ? { notiz: opt(o.notiz, 3000) } : {}), geaendert: jetzt,
  };
}

function leistung(o: Record<string, unknown>, jetzt: string): Leistung | null {
  if (!idOk(o.id) || !txt(o.name)) return null;
  const p = (o.preis ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id), name: txt(o.name, 160), typ: aus(o.typ, ['diagnose', 'workshop', 'retainer', 'sprint', 'vermittlung', 'software'] as const, 'retainer'),
    stufe: aus(o.stufe, ['einstieg', 'kern', 'premium'] as const, 'kern'),
    preis: { betrag: zahl(p.betrag), ...(zahl(p.bis) ? { bis: zahl(p.bis) } : {}), einheit: txt(p.einheit, 80) || 'Monat netto' },
    ...(opt(o.beschreibung, 1500) ? { beschreibung: opt(o.beschreibung, 1500) } : {}), lieferumfang: texte(o.lieferumfang, 20, 300),
    ...(opt(o.grenzen, 600) ? { grenzen: opt(o.grenzen, 600) } : {}), ...(opt(o.ergebnis, 600) ? { ergebnis: opt(o.ergebnis, 600) } : {}),
    gesellschaft: aus(o.gesellschaft, GES, 'offen'), status: aus(o.status, ['aktiv', 'entwurf', 'eingestellt'] as const, 'entwurf'),
    ...(opt(o.quelle, 600) ? { quelle: opt(o.quelle, 600) } : {}), geaendert: jetzt,
  };
}

const ROLLEN: FirmaRolle[] = ['zielkunde', 'kunde', 'ex_kunde', 'partner', 'dienstleister', 'investor', 'netzwerk', 'wettbewerb', 'offen'];
function firma(o: Record<string, unknown>, jetzt: string): Firma | null {
  if (!/^f-[a-z0-9-]{2,60}$/.test(String(o.id ?? '')) || !txt(o.name)) return null;
  const f = (n: keyof Firma, l = 200) => (opt(o[n], l) ? { [n]: opt(o[n], l) } : {});
  return {
    id: String(o.id), name: txt(o.name, 160), ...f('domain', 120), ...f('webseite'), ...f('branche', 160), ...f('mitarbeiter', 40), ...f('umsatz', 60), ...f('stadt', 80),
    ...f('gegruendet', 20), ...f('linkedin'), ...f('telefon', 60), ...f('email', 160), ...f('rechtsform', 80),
    rolle: aus(o.rolle, ROLLEN, 'offen'), ...(o.rolleVonHand === true ? { rolleVonHand: true } : {}), ...f('marktinfo', 800), ...f('notiz', 3000), geaendert: jetzt,
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
    ...(Array.isArray(o.ablauf) ? { ablauf: (o.ablauf as Record<string, unknown>[]).slice(0, 30).map(a => ({ zeit: txt(a.zeit, 5), punkt: txt(a.punkt, 200) })).filter(a => a.punkt) } : {}),
    ...(Array.isArray(o.checkliste) ? { checkliste: (o.checkliste as Record<string, unknown>[]).slice(0, 60).map((c, i) => ({ id: txt(c.id, 40) || `cl${i}`, text: txt(c.text, 200), tageVorher: zahl(c.tageVorher, -30, 120), erledigt: c.erledigt === true, ...(opt(c.aufgabeId, 80) ? { aufgabeId: opt(c.aufgabeId, 80) } : {}) })).filter(c => c.text) } : {}),
    ...(Array.isArray(o.budget) ? { budget: (o.budget as Record<string, unknown>[]).slice(0, 40).map((b, i) => ({ id: txt(b.id, 40) || `b${i}`, posten: txt(b.posten, 120), betrag: zahl(b.betrag, 0, 1e6) })).filter(b => b.posten) } : {}),
    ...(o.mixZiel && typeof o.mixZiel === 'object' ? { mixZiel: { zielkunden: zahl((o.mixZiel as Record<string, unknown>).zielkunden, 0, 100), kunden: zahl((o.mixZiel as Record<string, unknown>).kunden, 0, 100) } } : {}),
    ...(idOk(o.segmentId) ? { segmentId: String(o.segmentId) } : {}), ...(opt(o.vorlage, 40) ? { vorlage: opt(o.vorlage, 40) } : {}),
    geaendert: jetzt,
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
    geaendert: jetzt,
  };
}

function sitzung(o: Record<string, unknown>, person: string): PowerHourSitzung | null {
  if (!idOk(o.id) || !tag(o.datum)) return null;
  const z = (o.ziel ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id), person: txt(o.person, 40) || person, datum: tag(o.datum)!, start: txt(o.start, 25), ...(opt(o.ende, 25) ? { ende: opt(o.ende, 25) } : {}),
    ziel: { gespraeche: zahl(z.gespraeche, 0, 50), termine: zahl(z.termine, 0, 20) },
    karten: Array.isArray(o.karten) ? (o.karten as Record<string, unknown>[]).slice(0, 30).map(k => ({ kontaktId: txt(k.kontaktId, 80), kategorie: txt(k.kategorie, 20), ...(opt(k.ergebnis, 20) ? { ergebnis: opt(k.ergebnis, 20) } : {}), ...(opt(k.notiz, 600) ? { notiz: opt(k.notiz, 600) } : {}) })) : [],
    ...(opt(o.gelernt, 600) ? { gelernt: opt(o.gelernt, 600) } : {}),
  };
}

const ANTRAEGE: AntragArt[] = ['auskunft', 'berichtigung', 'loeschung', 'einschraenkung', 'uebertragbarkeit', 'widerspruch'];
function antrag(o: Record<string, unknown>, jetzt: string, person: string): Antrag | null {
  if (!idOk(o.id) || !txt(o.name) || !tag(o.eingang)) return null;
  const eingang = tag(o.eingang)!;
  const d = new Date(`${eingang}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1);
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

const strListe = (v: unknown, n = 12, l = 40) => (Array.isArray(v) ? v.map(x => txt(x, l)).filter(Boolean).slice(0, n) : undefined);
function segment(o: Record<string, unknown>, jetzt: string): Segment | null {
  if (!idOk(o.id) || !txt(o.name)) return null;
  const k = (o.kriterien ?? {}) as Record<string, unknown>;
  const kr: SegmentKriterien = {};
  for (const f of ['lebensphase', 'kreis', 'prio', 'firmaRolle', 'herkunft'] as const) { const l = strListe(k[f]); if (l?.length) kr[f] = l; }
  for (const f of ['branche', 'stadt', 'stichwort'] as const) { const t = opt(k[f], 80); if (t) kr[f] = t; }
  if (['mail', 'telefon', 'linkedin', 'newsletter', 'einladung'].includes(String(k.kanal))) kr.kanal = k.kanal as SegmentKriterien['kanal'];
  if (typeof k.mitChance === 'boolean') kr.mitChance = k.mitChance;
  if (zahl(k.ohneKontaktSeitTagen, 0, 3650)) kr.ohneKontaktSeitTagen = zahl(k.ohneKontaktSeitTagen, 0, 3650);
  return { id: String(o.id), name: txt(o.name, 120), ...(opt(o.beschreibung, 400) ? { beschreibung: opt(o.beschreibung, 400) } : {}), kriterien: kr, geaendert: jetzt };
}
function beitrag(o: Record<string, unknown>, jetzt: string): Beitrag | null {
  if (!idOk(o.id) || !txt(o.titel)) return null;
  return {
    id: String(o.id), titel: txt(o.titel, 200), kanal: aus(o.kanal, ['linkedin', 'newsletter', 'blog', 'podcast', 'vortrag', 'sonstig'] as const, 'linkedin'),
    ...(opt(o.saeule, 60) ? { saeule: opt(o.saeule, 60) } : {}), status: aus(o.status, ['idee', 'entwurf', 'geplant', 'veroeffentlicht'] as const, 'idee'),
    ...(tag(o.datum) ? { datum: tag(o.datum) } : {}), ...(opt(o.text, 8000) ? { text: opt(o.text, 8000) } : {}), ...(opt(o.link, 400) ? { link: opt(o.link, 400) } : {}),
    wirkung: Array.isArray(o.wirkung) ? (o.wirkung as Record<string, unknown>[]).slice(0, 200).map(w => ({ kontaktId: txt(w.kontaktId, 80), art: aus(w.art, ['reaktion', 'gespraech', 'anfrage'] as const, 'reaktion'), am: tag(w.am) ?? jetzt.slice(0, 10), ...(opt(w.notiz, 300) ? { notiz: opt(w.notiz, 300) } : {}) })).filter(w => /^c-/.test(w.kontaktId)) : [],
    quellen: strListe(o.quellen, 30, 80) ?? [], geaendert: jetzt,
  };
}
function ausgabe(o: Record<string, unknown>, jetzt: string): NewsletterAusgabe | null {
  if (!idOk(o.id) || !txt(o.titel)) return null;
  const n = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : zahl(v, 0, 1e6));
  return {
    id: String(o.id), titel: txt(o.titel, 200), ...(tag(o.datum) ? { datum: tag(o.datum) } : {}), status: aus(o.status, ['entwurf', 'bereit', 'versendet'] as const, 'entwurf'),
    inhalt: txt(o.inhalt, 20000), beitragIds: ids(o.beitragIds),
    ...(n(o.empfaenger) !== undefined ? { empfaenger: n(o.empfaenger) } : {}), ...(n(o.antworten) !== undefined ? { antworten: n(o.antworten) } : {}), ...(n(o.abmeldungen) !== undefined ? { abmeldungen: n(o.abmeldungen) } : {}),
    geaendert: jetzt,
  };
}

export function saeubern(liste: CrmListe, roh: Record<string, unknown>, jetzt: string, person: string): Record<string, unknown> | null {
  switch (liste) {
    case 'firmen': return firma(roh, jetzt) as unknown as Record<string, unknown>;
    case 'antraege': return antrag(roh, jetzt, person) as unknown as Record<string, unknown>;
    case 'verarbeitungen': return verarbeitung(roh, jetzt) as unknown as Record<string, unknown>;
    case 'segmente': return segment(roh, jetzt) as unknown as Record<string, unknown>;
    case 'beitraege': return beitrag(roh, jetzt) as unknown as Record<string, unknown>;
    case 'newsletter': return ausgabe(roh, jetzt) as unknown as Record<string, unknown>;
    case 'chancen': return chance(roh, jetzt, person) as unknown as Record<string, unknown>;
    case 'mandate': return mandat(roh, jetzt) as unknown as Record<string, unknown>;
    case 'leistungen': return leistung(roh, jetzt) as unknown as Record<string, unknown>;
    case 'events': return event(roh, jetzt) as unknown as Record<string, unknown>;
    case 'teilnahmen': return teilnahme(roh, jetzt) as unknown as Record<string, unknown>;
    case 'sitzungen': return sitzung(roh, person) as unknown as Record<string, unknown>;
  }
}

export function wendeCrmAn(b: CrmBestand, ops: ListenOp[], jetzt: string, person: string): { bestand: CrmBestand; angewandt: number } {
  let angewandt = 0;
  const neu = { ...b };
  for (const l of CRM_LISTEN) {
    const eigene = ops.filter(o => o.liste === l);
    if (!eigene.length) continue;
    const r = wendeAn(b[l] as unknown as Record<string, unknown>[], eigene, 'id', roh => saeubern(l, roh, jetzt, person));
    (neu as Record<string, unknown>)[l] = r.liste;
    angewandt += r.angewandt;
  }
  return { bestand: neu, angewandt };
}

export async function aendereCrm(mut: (b: CrmBestand) => CrmBestand): Promise<CrmBestand> {
  return updateJson<CrmBestand>(CRM_SPEICHER, cur => mut({ ...leererBestand(), ...(cur ?? {}) }));
}

/** Kunden-Sicht aus den Mandaten — für Score, Jarvis-Kontext und Loops (vorher eigener Speicher „kunden“). */
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
