// ─── Funde — Kampagne + Segment einrichten, Einstellungen, Fund von Hand, verwerfen (nur Server) ─────────────────────────────
// Die Kampagne entsteht über `planen` (Playbook `homepage-funde`, lib/crm/kampagnen.ts) und ist sofort aktiv; das Segment „Homepage-Funnel“ =
// gespeicherter Filter Herkunft Recherche + Label `homepage-funnel` (alle übernommenen Funde). Beides nur einmal (Kennungen in den Einstellungen).

import { gleicherBetrieb } from '@/lib/crm/betrieb';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { aendereCrm, ladeCrm } from '@/lib/crm/speicher';
import { PLAYBOOKS, planen } from '@/lib/crm/kampagnen';
import { aendereFunde, fundeHaushalt, ladeFunde, FundeFehler, einstellungenSaeubern } from './speicher';
import { vorschauRegelwerk } from './vorschau';
import { entwurfBauen } from './entwurf';
import { bewerten, eigeneWebsite, websiteNormal } from './bewertung';
import { fundKontext } from './kontext';
import { telefonFelder } from './telefon';
import { steckbriefSaeubern } from '@/lib/crm/icp-firma';
import { PROFIL_HOMEPAGE, istFundBranche, istIcpBranche, kampagneVon, profilFuer, type Fund, type FundBranche, type FundProfil, type FundeEinstellungen } from './typen';

export const SEGMENT_ID = PROFIL_HOMEPAGE.segmentId;

/** Kampagne + Segment eines Profils (Vorgabe Homepage) — einmal; eine offene Kampagne des Playbooks wird weiterbenutzt. */
export async function kampagneEinrichten(person: string, wer: Wer, profil: FundProfil = PROFIL_HOMEPAGE): Promise<{ kampagneId: string; segmentId: string; neu: boolean }> {
  const h = await fundeHaushalt();
  const pb = PLAYBOOKS.find(p => p.id === profil.playbook);
  if (!pb) throw new FundeFehler(409, 'Playbook fehlt.');
  const crm = await ladeCrm();
  const heute = localDay(), jetzt = new Date().toISOString();
  let kampagneId = '';
  let neu = false;
  await aendereCrm(c => {
    const segmente = c.segmente.some(s => s.id === profil.segmentId) ? c.segmente
      : [...c.segmente, { id: profil.segmentId, name: profil.segmentName, beschreibung: profil.beschreibung, kriterien: { herkunft: ['recherche'], label: [profil.label] }, geaendert: jetzt, geaendertVon: person }];
    const offen = c.kampagnen.find(k => k.playbook === profil.playbook && !k.geloeschtAm && !k.archiviertAm && (k.status === 'aktiv' || k.status === 'entwurf'));
    if (offen) { kampagneId = offen.id; return { ...c, segmente }; }
    kampagneId = neueKennung('kp'); neu = true;
    const k = { ...planen(pb, [], { ...crm, segmente }, heute, kampagneId), status: 'aktiv' as const, segmentId: profil.segmentId, zustaendig: person, geaendertVon: person };
    return { ...c, segmente, kampagnen: [...c.kampagnen, k] };
  }, wer);
  await aendereFunde(b => ({ ...b, einstellungen: profil.id === 'startup' ? { ...b.einstellungen, kampagneStartupId: kampagneId } : profil.id === 'scaleup' ? { ...b.einstellungen, kampagneScaleupId: kampagneId } : profil.id === 'unternehmer' ? { ...b.einstellungen, kampagneUnternehmerId: kampagneId } : { ...b.einstellungen, kampagneId, segmentId: profil.segmentId } }), { h, wer });
  return { kampagneId, segmentId: profil.segmentId, neu };
}

/** Einstellungen ändern (nur Gebiete, Branchen, Menge, Absender, Gesellschaft, Produkt — das Risiko hat einen eigenen Weg). */
export async function einstellungenAendern(teil: Partial<FundeEinstellungen>, wer: Wer): Promise<FundeEinstellungen> {
  const b = await aendereFunde(x => {
    const e = { ...x.einstellungen };
    if (teil.stadt !== undefined) e.stadt = teil.stadt;
    if (teil.gebiete !== undefined) { e.gebiete = teil.gebiete; e.gebietIndex = 0; }
    if (teil.branchen !== undefined) e.branchen = teil.branchen;
    if (teil.jeAbend !== undefined) e.jeAbend = teil.jeAbend;
    if (teil.absender !== undefined) e.absender = teil.absender;
    if (teil.gesellschaft !== undefined) e.gesellschaft = teil.gesellschaft;
    if (teil.produktId !== undefined) e.produktId = teil.produktId;
    if (teil.arten !== undefined) { if (teil.arten.length) e.arten = teil.arten; else delete e.arten; }
    if (teil.nurMitMail !== undefined) { if (teil.nurMitMail) e.nurMitMail = true; else delete e.nurMitMail; }
    if (teil.nurMitTelefon !== undefined) { if (teil.nurMitTelefon) e.nurMitTelefon = true; else delete e.nurMitTelefon; }
    const s = einstellungenSaeubern(e);
    if (teil.branchen !== undefined && !s.branchen.length) throw new FundeFehler(400, 'Mindestens eine Branche wählen.');
    return { ...x, einstellungen: s };
  }, { wer });
  return b.einstellungen;
}

/** „Eigenes Risiko“ an/aus — nur der Inhaber (die Route prüft), immer mit Person und Zeit; aus = sofort keine Mail mehr. */
export async function risikoSetzen(an: boolean, person: string, wer: Wer): Promise<FundeEinstellungen> {
  const b = await aendereFunde(x => {
    const { eigenesRisiko: _r, ...rest } = x.einstellungen;
    return { ...x, einstellungen: an ? { ...rest, eigenesRisiko: { an: true, seit: new Date().toISOString(), von: person } } : rest };
  }, { wer });
  return b.einstellungen;
}

export interface HandEingabe { name: string; branche: FundBranche; strasse?: string; plz?: string; ort?: string; website?: string; email?: string; telefon?: string }

export function handEingabeSaeubern(roh: unknown): HandEingabe {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  const t = (k: string, n: number) => { const v = typeof o[k] === 'string' ? (o[k] as string).replace(/[\u0000-\u001f]/g, ' ').trim() : ''; if (v.length > n) throw new FundeFehler(413, `Zu lang: ${k} — nichts gespeichert.`); return v || undefined; };
  const name = t('name', 120);
  if (!name) throw new FundeFehler(400, 'Name des Betriebs fehlt.');
  if (!istFundBranche(o.branche)) throw new FundeFehler(400, 'Branche wählen.');
  const email = t('email', 160)?.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FundeFehler(400, 'Die Mail-Adresse sieht unvollständig aus.');
  const website = t('website', 300);
  if (website && !websiteNormal(website)) throw new FundeFehler(400, 'Die Website-Adresse sieht ungültig aus.');
  return { name, branche: o.branche, ...(t('strasse', 120) ? { strasse: t('strasse', 120) } : {}), ...(t('plz', 10) ? { plz: t('plz', 10) } : {}), ...(t('ort', 80) ? { ort: t('ort', 80) } : {}), ...(website ? { website } : {}), ...(email ? { email } : {}), ...(t('telefon', 60) ? { telefon: t('telefon', 60) } : {}) };
}

/**
 * Fund von Hand (z. B. auf Google Maps gesehen — die Person trägt ihn selbst ein; MAKE OS fragt Google nicht ab). Bewertung ohne Netz
 * (die Website prüft erst der nächste Abendlauf nicht — von Hand zählt, was die Person sieht: ohne Website 100, sonst „von Hand“ 60).
 */
export async function fundVonHand(e: HandEingabe, person: string, wer: Wer): Promise<Fund> {
  const h = await fundeHaushalt();
  const am = new Date().toISOString();
  let neu: Fund | null = null;
  const b0 = await ladeFunde(h);
  if (!b0.einstellungen.kampagneId) throw new FundeFehler(409, 'Erst die Kampagne einrichten.');
  const ctx = await fundKontext(b0.einstellungen, h);
  await aendereFunde(x => {
    // Derselbe Betrieb (Name + Adresse, Domain) — gleicher Name an anderer Adresse ist erlaubt (01.11., Welle A).
    const kand = { name: e.name, ...(e.strasse || e.plz ? { adresse: { ...(e.strasse ? { strasse: e.strasse } : {}), ...(e.plz ? { plz: e.plz } : {}) } } : {}), ...(e.website ? { webseite: e.website } : {}), ...(e.email ? { email: e.email } : {}) };
    if (x.funde.some(f => f.status !== 'verworfen' && gleicherBetrieb({ name: f.name, ...(f.osmId ? { osmId: f.osmId } : {}), ...(f.adresse ? { adresse: f.adresse } : {}), ...(f.website ? { webseite: f.website } : {}), ...(f.email ? { email: f.email } : {}) }, kand) !== 'nein')) throw new FundeFehler(409, 'Diesen Betrieb gibt es schon als Fund.');
    const site = websiteNormal(e.website);
    const bew = bewerten({ website: eigeneWebsite(site), signale: null, jahrHeute: Number(localDay().slice(0, 4)), gemessenAm: am });
    const bewertung = eigeneWebsite(site) ? { ...bew, punkte: 60, erreichbar: undefined, gruende: ['Von Hand eingetragen — die Website wurde nicht automatisch geprüft.'] } : bew;
    const f: Fund = {
      id: neueKennung('fd'), kampagneId: x.einstellungen.kampagneId as string, quelle: 'hand', name: e.name, branche: e.branche,
      ...(e.strasse || e.plz || e.ort ? { adresse: { ...(e.strasse ? { strasse: e.strasse } : {}), ...(e.plz ? { plz: e.plz } : {}), ...(e.ort ? { ort: e.ort } : {}) } } : {}),
      ...(site ? { website: site } : {}), ...(e.email ? { email: e.email } : {}), ...telefonFelder(e.telefon),
      bewertung, status: 'vorbereitet', angelegt: am, geaendert: am, von: person,
    };
    if (!istIcpBranche(f.branche)) f.vorschau = vorschauRegelwerk(f);
    f.entwurf = entwurfBauen(f, ctx);
    neu = f;
    return { ...x, funde: [...x.funde, f] };
  }, { h, wer });
  const f = neu as unknown as Fund;
  const { fundVorschlagLegen } = await import('./uebernehmen');
  await fundVorschlagLegen(f, person);
  return f;
}

/** Anreicherung aus der Datei säubern: Inhaber (≤ 120, ohne Ziffern/Klammern), Instagram-Handle, Quellen (nur http(s), ≤ 10). Rein. */
export function anreicherungAus(x: Record<string, unknown>): Pick<Fund, 'inhaber' | 'inhaberArt' | 'instagram' | 'quellen'> {
  const aus: Pick<Fund, 'inhaber' | 'inhaberArt' | 'instagram' | 'quellen'> = {};
  const inh = typeof x.inhaber === 'string' ? x.inhaber.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (inh && inh.length <= 120 && !/[0-9(){}[\]@]/.test(inh)) { aus.inhaber = inh; aus.inhaberArt = x.inhaberArt === 'firma' ? 'firma' : x.inhaberArt === 'person' ? 'person' : /\b(GmbH|UG|AG|KG|OHG|GbR|e\.\s?V\.|mbH|Ltd|SE)\b/i.test(inh) ? 'firma' : 'person'; }
  const ig = typeof x.instagram === 'string' ? x.instagram.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '') : '';
  if (/^[A-Za-z0-9_.]{2,30}$/.test(ig)) aus.instagram = ig;
  const q = x.quellen && typeof x.quellen === 'object' ? x.quellen as Record<string, unknown> : {};
  const quellen = Object.fromEntries(Object.entries(q).filter(([k, v]) => /^[a-z]{2,20}$/i.test(k) && typeof v === 'string' && /^https?:\/\/[^\s<>"]{4,300}$/.test(v)).slice(0, 10)) as Record<string, string>;
  if (Object.keys(quellen).length) aus.quellen = quellen;
  return aus;
}

/** Niveau-Analyse aus der Datei säubern (nur Form, Längen gedeckelt). Rein. */
export function analyseAus(roh: unknown, am: string): Fund['analyse'] | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  if (!o || typeof o.niveau !== 'number' || !Number.isFinite(o.niveau)) return undefined;
  const saetze = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => x.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 200)).slice(0, n) : []);
  const zahl = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(0, v))) : 0);
  const t = o.teile && typeof o.teile === 'object' ? o.teile as Record<string, unknown> : {};
  const l = o.leistung && typeof o.leistung === 'object' ? o.leistung as Record<string, unknown> : null;
  return {
    niveau: zahl(o.niveau, 100), teile: { technik: zahl(t.technik, 35), gaeste: zahl(t.gaeste, 35), auffindbar: zahl(t.auffindbar, 15), recht: zahl(t.recht, 15) },
    ...(typeof o.design === 'number' && o.design >= 1 && o.design <= 5 ? { design: Math.round(o.design) } : {}),
    luecken: saetze(o.luecken, 15), aufhaenger: saetze(o.aufhaenger, 3),
    gemessenAm: typeof o.gemessenAm === 'string' && !Number.isNaN(Date.parse(o.gemessenAm)) ? o.gemessenAm.slice(0, 30) : am,
    ...(l ? { leistung: { ...(typeof l.lcpMs === 'number' ? { lcpMs: zahl(l.lcpMs, 120_000) } : {}), ...(typeof l.gewichtKb === 'number' ? { gewichtKb: zahl(l.gewichtKb, 1_000_000) } : {}), ...(typeof l.anfragen === 'number' ? { anfragen: zahl(l.anfragen, 10_000) } : {}), quelle: l.quelle === 'pagespeed' ? 'pagespeed' : 'chrome' } } : {}),
  };
}

/** ICP-Bewertung aus der Datei säubern (Profil Start-ups; nur Form). Rein. */
export function icpAus(roh: unknown, am: string): Fund['icp'] | undefined {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  if (!o || typeof o.score !== 'number' || !Number.isFinite(o.score)) return undefined;
  const saetze = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => x.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 240)).slice(0, n) : []);
  const score = Math.round(Math.min(100, Math.max(0, o.score)));
  return {
    score, stufe: score >= 70 ? 'A' : score >= 50 ? 'B' : 'C', einstieg: o.einstieg === 'sichtbarkeit' ? 'sichtbarkeit' : o.einstieg === 'struktur' ? 'struktur' : 'vertrieb',
    zielgruppe: o.zielgruppe === 'scaleup' ? 'scaleup' : o.zielgruppe === 'unternehmer' ? 'unternehmer' : 'startup',
    ...(o.vertriebsleitung === 'ja' || o.vertriebsleitung === 'nein' || o.vertriebsleitung === 'unbekannt' ? { vertriebsleitung: o.vertriebsleitung } : {}),
    ...(typeof o.prioritaet === 'number' && Number.isFinite(o.prioritaet) ? { prioritaet: Math.round(Math.min(100, Math.max(0, o.prioritaet))) } : {}),
    ...(typeof o.mitarbeitende === 'number' && Number.isFinite(o.mitarbeitende) && o.mitarbeitende > 0 ? { mitarbeitende: Math.round(Math.min(1e6, o.mitarbeitende)) } : {}),
    ...(typeof o.ausschluss === 'string' && o.ausschluss ? { ausschluss: o.ausschluss.slice(0, 200) } : {}),
    gruende: saetze(o.gruende, 10), aufhaenger: saetze(o.aufhaenger, 3),
    gemessenAm: typeof o.gemessenAm === 'string' && !Number.isNaN(Date.parse(o.gemessenAm)) ? o.gemessenAm.slice(0, 30) : am,
  };
}

/** Höchstens so viele Funde je Import-Datei — darüber 413 (nie kürzen). */
export const IMPORT_MAX = 200;
export const IMPORT_FORMAT = 'make-os-funde';

/** Eine Bewertung aus der Datei säubern (nur Form: Punkte 0–100, höchstens 5 Gründe à 200 Zeichen). Rein. */
function bewertungAus(roh: unknown, am: string): Fund['bewertung'] | null {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : null;
  if (!o || typeof o.punkte !== 'number' || !Number.isFinite(o.punkte) || typeof o.website !== 'boolean') return null;
  const gruende = Array.isArray(o.gruende) ? o.gruende.filter((x): x is string => typeof x === 'string').map(x => x.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 200)).slice(0, 5) : [];
  const b = (k: string) => (typeof o[k] === 'boolean' ? { [k]: o[k] as boolean } : {});
  return {
    punkte: Math.round(Math.min(100, Math.max(0, o.punkte))), website: o.website, gruende: gruende.length ? gruende : ['Aus einer Recherche übernommen.'],
    ...b('erreichbar'), ...b('https'), ...b('mobil'), ...b('impressum'),
    ...(typeof o.jahr === 'number' && o.jahr > 1990 && o.jahr < 2100 ? { jahr: Math.round(o.jahr) } : {}),
    gemessenAm: typeof o.gemessenAm === 'string' && !Number.isNaN(Date.parse(o.gemessenAm)) ? o.gemessenAm.slice(0, 30) : am,
  };
}

/**
 * Funde aus einer Recherche-Datei übernehmen (nur Inhaber — die Route prüft): `{ format: 'make-os-funde', funde: [...] }`. Je Eintrag dieselbe Säuberung
 * wie „Fund von Hand“ (+ OSM-Kennung, Gebiet, Art, Öffnungszeiten, Bewertung der Datei). Übersprungen: schon Fund/bekannt, Firma steht in der Kartei,
 * Adresse gehört einer Person der Kartei, Sperrliste. Danach je Fund ein Vorschlag im ZOE-Stapel — nichts in der Kartei, nichts gesendet.
 * Die Datei selbst liegt nie im Repo (echte Betriebe = Instanz-Daten).
 */
export async function fundeImportieren(roh: unknown, person: string, wer: Wer): Promise<{ neu: number; uebersprungen: { name: string; grund: string }[] }> {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  if (o.format !== IMPORT_FORMAT || !Array.isArray(o.funde)) throw new FundeFehler(400, `Keine Funde-Datei (erwartet „format: ${IMPORT_FORMAT}“).`);
  if (o.funde.length > IMPORT_MAX) throw new FundeFehler(413, `Höchstens ${IMPORT_MAX} Funde je Datei — nichts übernommen.`);
  const h = await fundeHaushalt();
  // Profile der ICP-Recherche (Start-ups, Scale-ups): je eine eigene Kampagne — beim ersten Import angelegt (der Import ist Inhaber-Sache).
  // Homepage-Funde brauchen die eingerichtete Kampagne.
  const branchen = new Set(o.funde.map(x => (x && typeof x === 'object' ? (x as Record<string, unknown>).branche : null)).filter(istFundBranche));
  for (const b of branchen) if (istIcpBranche(b) && !kampagneVon((await ladeFunde(h)).einstellungen, profilFuer(b))) await kampagneEinrichten(person, wer, profilFuer(b));
  const b0 = await ladeFunde(h);
  if ([...branchen].some(b => !istIcpBranche(b)) && !b0.einstellungen.kampagneId) throw new FundeFehler(409, 'Erst die Kampagne einrichten.');
  const kampagneFuer = (b: FundBranche) => kampagneVon(b0.einstellungen, profilFuer(b)) as string;
  const ctx = await fundKontext(b0.einstellungen, h);
  const am = new Date().toISOString();
  const [{ ladeCrm }, { betriebBekannt }, { betriebGesperrt }, { sperrlisteLaden, sperrTreffer }, { kontakteFuerVerarbeitung }, { alleAdressen }, { alsBetrieb }] = await Promise.all([
    import('@/lib/crm/speicher'), import('@/lib/crm/betrieb'), import('@/lib/crm/betrieb-sperre'), import('@/lib/crm/sperrliste'), import('@/lib/crm/verarbeitung'), import('@/lib/crm/emails'), import('./lauf'),
  ]);
  const [crm, kontakte, sperre] = await Promise.all([ladeCrm(), kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), sperrlisteLaden()]);
  const adressen = new Set(kontakte.flatMap(k => alleAdressen(k)));
  const uebersprungen: { name: string; grund: string }[] = [];
  const kandidaten: Fund[] = [];
  for (const e of o.funde) {
    const x = e && typeof e === 'object' ? e as Record<string, unknown> : {};
    let ein: HandEingabe;
    try { ein = handEingabeSaeubern({ ...x, ...(x.adresse && typeof x.adresse === 'object' ? { strasse: [(x.adresse as Record<string, unknown>).strasse, (x.adresse as Record<string, unknown>).hausnummer].filter(v => typeof v === 'string').join(' ') || undefined, plz: (x.adresse as Record<string, unknown>).plz, ort: (x.adresse as Record<string, unknown>).ort ?? (istFundBranche(x.branche) && istIcpBranche(x.branche) ? undefined : 'Berlin') } : {}) }); }
    catch (err) { uebersprungen.push({ name: String(x.name ?? '?').slice(0, 80), grund: err instanceof Error ? err.message : 'ungültig' }); continue; }
    const osmId = typeof x.osmId === 'string' && /^[nwr]\d{1,15}$/.test(x.osmId) ? x.osmId : undefined;
    const weg = (grund: string) => uebersprungen.push({ name: ein.name, grund });
    const adr = x.adresse && typeof x.adresse === 'object' ? x.adresse as Record<string, unknown> : null;
    const kand = alsBetrieb({ name: ein.name, ...(osmId ? { osmId } : {}), adresse: { ...(adr && typeof adr.strasse === 'string' ? { strasse: adr.strasse } : ein.strasse ? { strasse: ein.strasse } : {}), ...(adr && typeof adr.hausnummer === 'string' ? { hausnummer: adr.hausnummer } : {}), ...(ein.plz ? { plz: ein.plz } : {}) }, website: ein.website, email: ein.email });
    if (betriebBekannt(crm.firmen.filter(f => !f.geloeschtAm), kand)) { weg('Firma steht schon in der Kartei'); continue; }
    if (betriebGesperrt(sperre, kand)) { weg('Sperrliste'); continue; }
    if (ein.email && adressen.has(ein.email)) { weg('Adresse gehört schon einer Person der Kartei'); continue; }
    if (sperrTreffer(sperre, { firma: ein.name, ...(ein.email ? { email: ein.email } : {}) } as never)) { weg('Sperrliste'); continue; }
    if (x.geschlossen === true) { weg('laut Recherche dauerhaft geschlossen'); continue; }
    const site = websiteNormal(ein.website);
    const zusatz = anreicherungAus(x);
    const analyse = analyseAus(x.analyse, am);
    const icp = icpAus(x.icp, am);
    const steckbrief = steckbriefSaeubern(x.steckbrief);
    const thema = typeof x.thema === 'string' && x.thema.trim() ? x.thema.replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 120) : undefined;
    const bewertung = bewertungAus(x.bewertung, am) ?? bewerten({ website: eigeneWebsite(site), signale: null, jahrHeute: Number(localDay().slice(0, 4)), gemessenAm: am });
    const t = (k: string, n: number) => (typeof x[k] === 'string' && (x[k] as string).trim() ? (x[k] as string).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : undefined);
    const f: Fund = {
      id: neueKennung('fd'), kampagneId: kampagneFuer(ein.branche), quelle: osmId ? 'osm' : 'hand', ...(osmId ? { osmId } : {}), name: ein.name, branche: ein.branche,
      ...(t('kategorie', 60) ? { kategorie: t('kategorie', 60) } : {}), ...(t('gebiet', 80) ? { gebiet: t('gebiet', 80) } : {}), ...(t('oeffnungszeiten', 200) ? { oeffnungszeiten: t('oeffnungszeiten', 200) } : {}),
      ...(ein.strasse || ein.plz || ein.ort ? { adresse: { ...(ein.strasse ? { strasse: ein.strasse } : {}), ...(ein.plz ? { plz: ein.plz } : {}), ...(ein.ort ? { ort: ein.ort } : {}) } } : {}),
      ...(site ? { website: site } : {}), ...(ein.email ? { email: ein.email } : {}), ...telefonFelder(typeof x.mobil === 'string' ? x.mobil.slice(0, 60) : undefined, ein.telefon),
      ...zusatz, bewertung, ...(analyse ? { analyse } : {}), ...(icp ? { icp } : {}), ...(steckbrief ? { steckbrief } : {}), ...(thema ? { thema } : {}), status: 'vorbereitet', angelegt: am, geaendert: am, von: person,
    };
    // Profile der ICP-Recherche: kein Website-Entwurf (es geht um Vertrieb/Sichtbarkeit, nicht um eine neue Seite).
    if (!istIcpBranche(f.branche)) f.vorschau = vorschauRegelwerk(f);
    f.entwurf = entwurfBauen(f, ctx);
    kandidaten.push(f);
  }
  const neu: Fund[] = [];
  await aendereFunde(b => {
    const bekannt = new Set([...b.bekannt, ...b.funde.map(f => f.osmId).filter((v): v is string => !!v)]);
    // Schon als Fund da: dieselbe OSM-ID bzw. derselbe Betrieb (Domain, Name + Adresse) — gleicher Name an anderer Adresse ist ein anderer Betrieb (01.11.).
    const da = b.funde.filter(f => f.status !== 'verworfen').map(alsBetrieb);
    for (const f of kandidaten) {
      if ((f.osmId && bekannt.has(f.osmId)) || betriebBekannt(da, alsBetrieb(f))) { uebersprungen.push({ name: f.name, grund: 'schon als Fund bekannt' }); continue; }
      da.push(alsBetrieb(f)); if (f.osmId) bekannt.add(f.osmId);
      neu.push(f);
    }
    return { ...b, funde: [...b.funde, ...neu] };
  }, { h, wer });
  const { fundVorschlagLegen } = await import('./uebernehmen');
  for (const f of neu) await fundVorschlagLegen(f, person);
  return { neu: neu.length, uebersprungen };
}

/** Verwerfen (bleibt bekannt, kommt nie wieder). */
export async function fundVerwerfen(id: string, grund: string, person: string, wer: Wer): Promise<void> {
  let vorschlagId: string | undefined;
  await aendereFunde(b => {
    const f = b.funde.find(x => x.id === id);
    if (!f) throw new FundeFehler(404, 'Diesen Fund gibt es nicht (mehr).');
    if (f.status !== 'neu' && f.status !== 'vorbereitet') throw new FundeFehler(409, 'Schon übernommen — in der Markttraktion weiterbearbeiten.');
    vorschlagId = f.vorschlagId;
    return { ...b, funde: b.funde.map(x => (x.id === id ? { ...x, status: 'verworfen', grund: grund.slice(0, 200) || 'Von Hand verworfen', geaendert: new Date().toISOString(), von: person } : x)), bekannt: f.osmId ? [...new Set([...b.bekannt, f.osmId])] : b.bekannt };
  }, { wer });
  // Der offene Vorschlag im Stapel ist damit entschieden (ein schon entschiedener bleibt, wie er ist).
  if (vorschlagId) { const { entscheide } = await import('@/lib/zoe/stapel'); await entscheide(vorschlagId, 'abgelehnt', { grund: 'Fund verworfen', von: person }).catch(() => null); }
}

export { istFundBranche };
