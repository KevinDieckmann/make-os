// ─── Fulfillment · Kunde — Server (C2, 10.10.; FULFILLMENT_KONZEPT.md 5.2, 5.4, 5.5, 8.1, 11 „C2“) ─────────────────────────────────────────────────
// Die Signaturen der Schnittstellen sind fest (C0-Stub): `kundeKurzFuer` (C1 Cockpit), `formularAntwortenFuer`/`unterlagenFuer`/`unterlageText` (C3 —
// Unterlagen NUR „freigegeben“), `reportZusatzFuer` (Leistungstreppe), `kundeMorgenlauf`, `kundeFristen`, `kundeAuskunft`, `KUNDE_STAPEL` (Hub-Dateien).
// Dazu die Schreibwege der Routen (intern `/api/fulfillment/kunde{,/datei,/vorschau}`, öffentlich `/api/kunde/kl-…{,/formular,/upload,/puls}`).
//
// Regeln (Entscheidungen 10.10., 23:25; Konzept 5.4):
//   · Kunden-Link kommt AUSGESCHALTET — Umgebung `MAKE_OS_KUNDENLINK=an` UND Instanz-Schalter (nur Inhaber). Aus → jeder öffentliche Weg dieselbe 404.
//   · Token nur im Fragment, im Bestand nur der Hash; das Token steht genau einmal in der Antwort von „Link anlegen“ bzw. „Puls-Anfrage“ — nie gespeichert,
//     nie protokolliert (auch `einmalig` speichert Antworten — deshalb hier ohne).
//   · Uploads: nur sichere Typen am Inhalt, Metadaten weg, verschlüsselt über lib/store/bild-ablage.ts, Status „ungeprüft“ bis ein Mensch freigibt.
//   · Messwerte im Wert-Konto trägt nur MAKE ein (C1) — der Kunde sieht sie, ändern kann er nichts.
//   · Bereich Business: nur Mandate einer Business-Gesellschaft, alle Bestände `IN_BUSINESS`; Privat bekommt nichts.
//   · Nichts geht nach außen ohne Klick: Glocke und Stapel-Vorschläge sind intern; versendet wird nur im Browser per Klick (Inbox).

import { promises as fs } from 'fs';
import path from 'path';
import { loadJson, datenOrdner } from '@/lib/store/local-db';
import { bildAblegen, bildEntfernen, bildOeffnen } from '@/lib/store/bild-ablage';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { localDay, tagVon, tagePlus } from '@/lib/zeit';
import { istBusinessGesellschaft } from '@/lib/einheiten';
import { textNennt, type PersonMerkmale } from '@/lib/crm/person-weitere';
import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { Vorschlag } from '@/lib/zoe/stapel';
import type { Mandat, CrmBestand, FollowUp } from '@/lib/crm/typen';
import { fulfillmentAendern, fulfillmentHaushalt, fulfillmentLesen, fulfillmentSpeicherFuer, eintragStand, UNTERLAGEN_ORDNER } from '../speicher';
import { mandatsEnde, pulsStufe } from '../regeln';
import { STAPEL_GRUPPE, KENNUNG } from '../grenzen';
import { dateinameSaeubern } from '@/lib/dateien/regeln';
import {
  aktiverLink, letzterLink, linkAnwenden, linkOeffentlich, linkStatus, schalterStand, abgelaufeneMarkieren,
  type LinkOeffentlich, type LinkOp, type SchalterStand,
} from './link';
import { formulareDesFalls, formularProzent, formularStandVon, formulareProzent, abschnitteVon, antwortenAnwenden, antwortenCsv, fnv, formularSchluessel } from './formular';
import { anfrageAnlegen, letzterPuls, offeneAnfrage, pulsAnnehmen, pulsHand, pulsListe } from './puls';
import { kundenSicht, kundeTauglich, kundeHinweis, type KundenSicht } from './sicht';
import { reportZusatz } from './report-zusatz';
import { kundenGesperrt } from '../prozesse/bausteine';
import { playbookBaustein } from '../prozesse/onboarding';
import { OB_PLAYBOOK_FORMULAR_ID } from '../prozesse/fall';
import { kundeFristenAnwenden, unterlageDatei, verwaisteDateien, alleTexte } from './fristen';
import { kundeTypErkennen, ohneMetadaten, uploadFrei, UPLOAD_GRENZEN, type KundeDateiTyp } from './upload';
import { aktiveInhalte, AKTIV_TEXT } from '@/lib/dateien/aktive-inhalte';
import { neueLinkKennung, neuesToken, tokenHash, neuePulsAnfrageKennung, neuePulsKennung, neueUnterlageKennung } from './token';
import type {
  Fall, FormularStand, FristenKontext, KundeAuskunft, KundeDatei, KundeKurz, KundenLink, MorgenlaufTeil, Puls, PulsAnfrage, ReportZusatz, Unterlage, VorlagenDatei,
} from '../typen';

// ── Schalter, Mandat, Fall ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Erster Schlüssel: die Umgebung (`MAKE_OS_KUNDENLINK=an`, setzt der Betrieb nach der Prüfung 12.4). */
export const umgebungAn = (env: Record<string, string | undefined> = process.env): boolean => env.MAKE_OS_KUNDENLINK?.trim().toLowerCase() === 'an';
/** Beide Schlüssel (Umgebung + Instanz-Schalter). */
export async function kundenLinkSchalter(h?: string): Promise<SchalterStand> {
  return schalterStand((await fulfillmentLesen('vorlagen', h)).einstellungen, umgebungAn());
}

export class KundeFehler extends Error { constructor(msg: string, public status: 400 | 403 | 404 | 409 | 413 | 415 | 429) { super(msg); } }
export type Ergebnis = { status: number; body: Record<string, unknown> };
const ok = (body: Record<string, unknown> = {}): Ergebnis => ({ status: 200, body: { ok: true, ...body } });
const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}): Ergebnis => ({ status, body: { ok: false, fehler, ...extra } });

async function crmLaden(): Promise<CrmBestand> { const { ladeCrm } = await import('@/lib/crm/speicher'); return ladeCrm(); }
/** Ein Mandat einer Business-Gesellschaft, nicht im Papierkorb — sonst null (Privat bekommt nichts). */
export const businessMandat = (crm: Pick<CrmBestand, 'mandate'>, mandatId: string): Mandat | null =>
  (crm.mandate ?? []).find(m => m.id === mandatId && !m.geloeschtAm && istBusinessGesellschaft(m.gesellschaft)) ?? null;

/** Der Fall eines Mandats — über die Schnittstelle von C1 (`fallLesen`), nie schreibend. */
async function fallVon(mandatId: string): Promise<Fall | null> {
  try { return await (await import('../prozesse/server')).fallLesen(mandatId); } catch { return null; }
}

/** Paketname: das Produkt des Mandats, sonst der Titel der Paket-Vorlage. */
function paketName(m: Mandat, crm: Pick<CrmBestand, 'leistungen'>, fall: Fall | null, v: VorlagenDatei): string | undefined {
  const l = m.leistungId ? (crm.leistungen ?? []).find(x => x.id === m.leistungId) : undefined;
  return l?.name ?? (fall ? v.prozesse.find(p => p.id === fall.vorlageId)?.titel : undefined);
}

/** Der Datenschutzhinweis mit Verantwortlichem (Einrichtung) und wirksamen Fristen. */
async function hinweisLaden(): Promise<ReturnType<typeof kundeHinweis>> {
  const { datenschutzOeffentlichLaden } = await import('@/lib/datenschutz/einrichtung-server');
  const { fristenWirksam, LOESCHFRISTEN_SPEICHER } = await import('@/lib/crm/loeschfristen');
  const [ds, b] = await Promise.all([datenschutzOeffentlichLaden().catch(() => ({ verantwortlich: null, seite: null })), loadJson<{ fristen?: Record<string, number> }>(LOESCHFRISTEN_SPEICHER).catch(() => null)]);
  const f = fristenWirksam(b?.fristen as never);
  return kundeHinweis({ verantwortlich: ds.verantwortlich, seite: ds.seite, mandatsdatenMonate: f['fulfillment-mandatsdaten'], unterlagenTage: f['fulfillment-unterlagen'] });
}

/** Wer etwas zu einem Mandat erfährt: die zuständige Team-Person, sonst das ganze Team (wie die Leistungstreppe; nie ein fester Name). */
async function empfaenger(m: Pick<Mandat, 'zustaendig'>): Promise<string[]> {
  const { TEAM, BEIDE } = await import('@/lib/crm/team-liste');
  const { zustaendig } = await import('@/lib/crm/team');
  const z = zustaendig(m.zustaendig, 'sales');
  return z && z !== BEIDE && TEAM.some(t => t.id === z) ? [z] : TEAM.map(t => t.id);
}
const fuerPerson = async (m: Pick<Mandat, 'zustaendig'>): Promise<string | undefined> => { const l = await empfaenger(m); return l.length === 1 ? l[0] : undefined; };

const standVon = (f: FormularStand): string => eintragStand(f);
const unterlagenDesLinks = (d: KundeDatei, linkId: string) => d.unterlagen.filter(u => u.linkId === linkId);

// ── Kunden-Sicht (öffentlich + Vorschau, dieselbe) ──────────────────────────────────────────────────────────────────────────────────────

/** Die Sicht für einen Link (`modus`) — bzw. für die Vorschau ohne Link (alle Rechte des aktiven Links, sonst die Vorgabe). */
export async function sichtFuer(e: { mandat: Mandat; modus: 'voll' | 'puls'; link: KundenLink | null; kunde: KundeDatei; vorlagen: VorlagenDatei; crm: CrmBestand; heute: string; anfrage?: PulsAnfrage }): Promise<KundenSicht> {
  const fall = e.modus === 'voll' ? await fallVon(e.mandat.id) : null;
  const rechte = e.link?.rechte ?? { formular: true, upload: true, puls: true };
  const frei = e.link ? uploadFrei(unterlagenDesLinks(e.kunde, e.link.id)).dateien : UPLOAD_GRENZEN.dateienJeLink;
  return kundenSicht({
    modus: e.modus, heute: e.heute, mandat: e.mandat, paket: paketName(e.mandat, e.crm, fall, e.vorlagen), fall, bausteine: e.vorlagen.bausteine, marken: e.vorlagen.marken, rituale: e.vorlagen.rituale,
    kunde: e.kunde, rechte, standVon, datenschutz: await hinweisLaden(), uploadFrei: frei,
    ...(e.anfrage ? { pulsOffen: !e.anfrage.beantwortetAm && e.anfrage.offenBis >= e.heute } : {}),
  });
}

/** „So sieht der Kunde es“ (6.4) — genau die Sicht des aktiven Links (ohne Link: wie ein neuer Link). */
export async function vorschauFuer(mandatId: string, heute = localDay()): Promise<{ sicht: KundenSicht; schalter: SchalterStand } | null> {
  const h = await fulfillmentHaushalt();
  const [crm, kunde, vorlagen] = await Promise.all([crmLaden(), fulfillmentLesen('kunde', h), fulfillmentLesen('vorlagen', h)]);
  const m = businessMandat(crm, mandatId);
  if (!m) return null;
  const link = aktiverLink(kunde, m.id, heute, mandatsEnde(m));
  return { sicht: await sichtFuer({ mandat: m, modus: 'voll', link, kunde, vorlagen, crm, heute }), schalter: schalterStand(vorlagen.einstellungen, umgebungAn()) };
}

// ── Interner Stand eines Mandats (GET /api/fulfillment/kunde?m=) ────────────────────────────────────────────────────────────────────────

export interface InternFormular {
  bausteinId: string; schluessel: string; titel: string; kundeFuellt: boolean; kundeTauglich: boolean; prozent: number; stand: string;
  abschnitte: { schluessel: string; titel: string; fertig: boolean; fragen: { id: string; frage: string; art: string; optionen?: string[] }[] }[];
  antworten: Record<string, string>; geaendertAm?: string; quelle?: FormularStand['quelle']; fassung?: number; aktuelleFassung: number;
}
export interface KundeStand {
  mandat: { id: string; titel: string; kunde: string }; schalter: SchalterStand; fall: boolean;
  link: LinkOeffentlich | null; verlauf: LinkOeffentlich[]; formulare: InternFormular[];
  puls: { liste: Puls[]; offen: { id: string; offenBis: string } | null; schwelle: number; health: number | null };
  unterlagen: Unterlage[]; upload: { dateien: number; bytes: number } | null; kurz: KundeKurz;
}

function internFormulare(fall: Fall | null, v: Pick<VorlagenDatei, 'bausteine' | 'marken'>, kunde: KundeDatei, mandatId: string): InternFormular[] {
  return formulareDesFalls(fall, v.bausteine).map(b => {
    const st = formularStandVon(kunde, mandatId, b.id);
    return {
      bausteinId: b.id, schluessel: formularSchluessel(mandatId, b.id), titel: b.titel, kundeFuellt: b.kundeFuellt === true, kundeTauglich: kundeTauglich(b, v), prozent: formularProzent(b, st), stand: st ? standVon(st) : 'neu',
      abschnitte: abschnitteVon(b).map(a => ({ schluessel: a.schluessel, titel: a.titel, fertig: !!st?.fertig.includes(a.schluessel), fragen: a.fragen.map(q => ({ id: q.id, frage: q.frage, art: q.art, ...(q.optionen?.length ? { optionen: [...q.optionen] } : {}) })) })),
      antworten: { ...(st?.antworten ?? {}) }, ...(st ? { geaendertAm: st.geaendertAm, quelle: st.quelle, fassung: st.fassung } : {}), aktuelleFassung: b.fassung,
    };
  });
}

function kurzAus(kunde: KundeDatei, mandatId: string, schalter: SchalterStand, fall: Fall | null, v: Pick<VorlagenDatei, 'bausteine' | 'marken'>, heute: string, ende: string | null): KundeKurz {
  const akt = aktiverLink(kunde, mandatId, heute, ende);
  const letzter = letzterLink(kunde, mandatId);
  const link: KundeKurz['link'] = !schalter.an ? 'aus' : akt ? 'aktiv' : letzter ? linkStatus(letzter, heute, ende) : 'keiner';
  const p = letzterPuls(kunde, mandatId);
  const formulare = formulareDesFalls(fall, v.bausteine).filter(b => b.kundeFuellt === true && kundeTauglich(b, v));
  // Der Schritt „Kunden-Playbook“ misst NUR das Playbook (das Formular unter dem Schritt, sonst das Playbook der Bibliothek) — nie andere Formulare.
  const pbId = fall?.knoten.find(k => k.id === OB_PLAYBOOK_FORMULAR_ID && k.status !== 'entfaellt')?.bausteinId ?? playbookBaustein(v)?.id;
  const pb = formulare.find(b => b.id === pbId);
  return {
    link, formularProzent: formulareProzent(formulare, kunde, mandatId), playbookProzent: pb ? formularProzent(pb, formularStandVon(kunde, mandatId, pb.id)) : null,
    ungepruefteUnterlagen: kunde.unterlagen.filter(u => u.mandatId === mandatId && u.status === 'ungeprueft').length,
    ...(p ? { letzterPuls: { wert: p.wert, am: tagVon(p.am) } } : {}), pulsOffen: !!offeneAnfrage(kunde, mandatId, heute),
  };
}

export async function kundeStand(mandatId: string, heute = localDay()): Promise<KundeStand | null> {
  const h = await fulfillmentHaushalt();
  const [crm, kunde, vorlagen] = await Promise.all([crmLaden(), fulfillmentLesen('kunde', h), fulfillmentLesen('vorlagen', h)]);
  const m = businessMandat(crm, mandatId);
  if (!m) return null;
  const fall = await fallVon(m.id);
  const ende = mandatsEnde(m);
  const schalter = schalterStand(vorlagen.einstellungen, umgebungAn());
  const akt = aktiverLink(kunde, m.id, heute, ende);
  const offen = offeneAnfrage(kunde, m.id, heute);
  return {
    mandat: { id: m.id, titel: m.titel, kunde: m.kunde }, schalter, fall: !!fall,
    link: akt ? linkOeffentlich(akt, heute, ende) : null,
    verlauf: kunde.links.filter(l => l.mandatId === m.id).sort((a, b) => (a.erstelltAm < b.erstelltAm ? 1 : -1)).slice(0, 5).map(l => linkOeffentlich(l, heute, ende)),
    formulare: internFormulare(fall, vorlagen, kunde, m.id),
    puls: { liste: pulsListe(kunde, m.id).slice(0, 26), offen: offen ? { id: offen.id, offenBis: offen.offenBis } : null, schwelle: vorlagen.einstellungen.pulsSchwelle, health: m.health?.stimmung ?? null },
    unterlagen: kunde.unterlagen.filter(u => u.mandatId === m.id).sort((a, b) => (a.am < b.am ? 1 : -1)),
    upload: akt ? uploadFrei(unterlagenDesLinks(kunde, akt.id)) : null,
    kurz: kurzAus(kunde, m.id, schalter, fall, vorlagen, heute, ende),
  };
}

// ── Interne Aktionen (POST /api/fulfillment/kunde) ─────────────────────────────────────────────────────────────────────────────────────

const wer = (person: string): Wer => ({ art: 'person', person });

/** Instanz-Schalter umlegen — nur der Inhaber (die Route prüft `inhaber: true`). */
export async function schalterSetzen(an: boolean, person: string, jetzt = new Date()): Promise<Ergebnis> {
  const r = await fulfillmentAendern('vorlagen', d => ({ ok: true, datei: { ...d, einstellungen: { ...d.einstellungen, kundenLink: { an, am: localDay(jetzt), von: person } } }, geaendert: ['einstellungen'] }), wer(person));
  if (!r.ok) return nein(r.status, r.fehler);
  return ok({ schalter: schalterStand(r.datei.einstellungen, umgebungAn()) });
}

/** Puls-Schwelle (0–10): bis zu diesem Wert gilt ein Puls als „braucht Aufmerksamkeit“. */
export async function pulsSchwelleSetzen(wert: unknown, person: string): Promise<Ergebnis> {
  if (typeof wert !== 'number' || !Number.isInteger(wert) || wert < 0 || wert > 10) return nein(400, 'Schwelle: eine ganze Zahl von 0 bis 10.');
  const r = await fulfillmentAendern('vorlagen', d => ({ ok: true, datei: { ...d, einstellungen: { ...d.einstellungen, pulsSchwelle: wert } }, geaendert: ['einstellungen'] }), wer(person));
  return r.ok ? ok({ schwelle: wert }) : nein(r.status, r.fehler);
}

async function mandatMitFall(mandatId: string): Promise<{ m: Mandat; fall: Fall | null; crm: CrmBestand } | Ergebnis> {
  if (typeof mandatId !== 'string' || !mandatId) return nein(400, 'mandatId fehlt.');
  const crm = await crmLaden();
  const m = businessMandat(crm, mandatId);
  if (!m) return nein(404, 'Dieses Mandat gibt es nicht (mehr) — oder es gehört nicht zum Business.');
  return { m, fall: await fallVon(m.id), crm };
}

/** Pfad des Links — das Token steht NUR im Fragment. */
const linkPfad = (id: string, token: string, art: 'link' | 'puls' = 'link') => `/kunde/${id}#${art === 'link' ? 't' : 'p'}=${token}`;
const mitAdresse = (pfad: string) => { const a = process.env.MAKE_OS_ADRESSE?.trim().replace(/\/+$/, ''); return a && /^https?:\/\//.test(a) ? `${a}${pfad}` : undefined; };

/** Neuen Kunden-Link anlegen (widerruft den bisherigen). Das Token steht NUR in dieser Antwort — danach nie wieder. */
export async function linkAnlegen(mandatId: string, rechte: unknown, person: string, jetzt = new Date()): Promise<Ergebnis> {
  const heute = localDay(jetzt);
  const s = await kundenLinkSchalter();
  if (!s.an) return nein(409, s.grund === 'betrieb' ? 'Der Kunden-Link ist im Betrieb ausgeschaltet (MAKE_OS_KUNDENLINK) — erst nach der Prüfung einschalten.' : 'Der Kunden-Link ist ausgeschaltet — der Inhaber schaltet ihn unter Fulfillment › Fall › Kunde & Reports ein.', { aus: true, grund: s.grund });
  const x = await mandatMitFall(mandatId);
  if ('status' in x) return x;
  if (!x.fall) return nein(409, 'Erst den Fall starten (Kundenonboarding) — der Kunden-Link zeigt den Stand des Falls.');
  const id = neueLinkKennung();
  const token = neuesToken();
  const op: LinkOp = { op: 'anlegen', mandatId: x.m.id, id, tokenHash: tokenHash(token), ...(rechte && typeof rechte === 'object' ? { rechte: rechte as Partial<KundenLink['rechte']> } : {}), hinweisFassung: (await hinweisLaden()).fassung };
  const r = await fulfillmentAendern('kunde', d => linkAnwenden(d, op, { heute, jetzt: jetzt.toISOString(), person, mandatEnde: mandatsEnde(x.m) }), wer(person));
  if (!r.ok) return nein(r.status, r.fehler);
  const l = r.datei.links.find(y => y.id === id)!;
  const pfad = linkPfad(id, token);
  const url = mitAdresse(pfad);
  return ok({ link: linkOeffentlich(l, heute, mandatsEnde(x.m)), token, pfad, ...(url ? { url } : {}) });
}

/** Link widerrufen, verlängern, Rechte ändern. */
export async function linkAendern(art: 'widerrufen' | 'verlaengern' | 'rechte', roh: { linkId?: unknown; tage?: unknown; rechte?: unknown }, person: string, jetzt = new Date()): Promise<Ergebnis> {
  const id = typeof roh.linkId === 'string' && KENNUNG.kundenLink.test(roh.linkId) ? roh.linkId : null;
  if (!id) return nein(400, 'linkId fehlt.');
  const h = await fulfillmentHaushalt();
  const kunde = await fulfillmentLesen('kunde', h);
  const l = kunde.links.find(y => y.id === id);
  if (!l) return nein(404, 'Diesen Kunden-Link gibt es nicht (mehr).');
  const crm = await crmLaden();
  const m = businessMandat(crm, l.mandatId);
  if (!m) return nein(404, 'Das Mandat dieses Links gibt es nicht (mehr).');
  const op: LinkOp = art === 'widerrufen' ? { op: 'widerrufen', id } : art === 'verlaengern' ? { op: 'verlaengern', id, ...(typeof roh.tage === 'number' ? { tage: roh.tage } : {}) } : { op: 'rechte', id, rechte: (roh.rechte ?? {}) as Partial<KundenLink['rechte']> };
  const heute = localDay(jetzt);
  const r = await fulfillmentAendern('kunde', d => linkAnwenden(d, op, { heute, jetzt: jetzt.toISOString(), person, mandatEnde: mandatsEnde(m) }), wer(person), h);
  if (!r.ok) return nein(r.status, r.fehler);
  return ok({ link: linkOeffentlich(r.datei.links.find(y => y.id === id)!, heute, mandatsEnde(m)) });
}

/** Puls-Anfrage mit eigenem Token (5.5) — nur bei eingeschaltetem Link mit Recht „Puls“. Token genau einmal in der Antwort. */
export async function pulsAnfrageAnlegen(mandatId: string, person: string, jetzt = new Date()): Promise<Ergebnis> {
  const heute = localDay(jetzt);
  const s = await kundenLinkSchalter();
  if (!s.an) return nein(409, 'Der Kunden-Link ist ausgeschaltet — ohne ihn gibt es keinen Puls-Link.', { aus: true, grund: s.grund });
  const x = await mandatMitFall(mandatId);
  if ('status' in x) return x;
  const h = await fulfillmentHaushalt();
  const link = aktiverLink(await fulfillmentLesen('kunde', h), x.m.id, heute, mandatsEnde(x.m));
  if (!link) return nein(409, 'Es gibt keinen aktiven Kunden-Link für dieses Mandat — erst einen anlegen.');
  if (!link.rechte.puls) return nein(409, 'Am Kunden-Link ist der Puls ausgeschaltet.');
  const token = neuesToken();
  const id = neuePulsAnfrageKennung();
  const r = await fulfillmentAendern('kunde', d => anfrageAnlegen(d, { id, mandatId: x.m.id, tokenHash: tokenHash(token, 'puls'), jetzt: jetzt.toISOString(), heute }), wer(person), h);
  if (!r.ok) return nein(r.status, r.fehler);
  const a = r.datei.pulsAnfragen.find(y => y.id === id)!;
  const pfad = linkPfad(link.id, token, 'puls');
  const url = mitAdresse(pfad);
  return ok({ anfrage: { id: a.id, offenBis: a.offenBis }, pfad, ...(url ? { url } : {}) });
}

/** Puls von Hand (z. B. im Wochen-Check erfragt). */
export async function pulsHandEintragen(mandatId: string, wert: unknown, satz: unknown, person: string, jetzt = new Date()): Promise<Ergebnis> {
  const x = await mandatMitFall(mandatId);
  if ('status' in x) return x;
  const id = neuePulsKennung();
  const r = await fulfillmentAendern('kunde', d => pulsHand(d, { mandatId: x.m.id, id, wert, satz, am: jetzt.toISOString() }), wer(person));
  if (!r.ok) return nein(r.status, r.fehler);
  // Prüf-Fund 11.10.: auch ein Puls von Hand unter der Schwelle löst Glocke + Vorschlag „Gespräch anbieten“ aus (die Marke verhindert Doppelte).
  const neu = r.datei.puls.find(p => p.id === id);
  if (neu && pulsStufe(neu.wert, (await fulfillmentLesen('vorlagen')).einstellungen.pulsSchwelle) === 'kritisch') await pulsAufmerksamkeit(x.m, neu, localDay(jetzt)).catch(() => { /* Morgenlauf holt es nach */ });
  return ok({ puls: pulsListe(r.datei, x.m.id)[0] });
}

/** „In die Health übernehmen“: `Mandat.health.stimmung = Wert × 10` über den CRM-Schreibweg mit Stand (die Zufriedenheits-Ampel rechnet unverändert). */
export async function pulsUebernehmen(mandatId: string, pulsId: unknown, person: string, jetzt = new Date()): Promise<Ergebnis> {
  const x = await mandatMitFall(mandatId);
  if ('status' in x) return x;
  const p = (await fulfillmentLesen('kunde')).puls.find(y => y.id === pulsId && y.mandatId === x.m.id);
  if (!p) return nein(404, 'Diesen Puls gibt es nicht (mehr).');
  const { aendereCrm, wendeCrmAn } = await import('@/lib/crm/speicher');
  const { standVon: crmStand } = await import('@/lib/crm/crm-stand');
  const stimmung = p.wert * 10;
  const ops = [{ liste: 'mandate' as const, op: 'teil' as const, id: x.m.id, felder: { health: { ...x.m.health, stimmung } }, stand: crmStand(x.m) }];
  const halter: { r?: ReturnType<typeof wendeCrmAn> } = {};
  await aendereCrm(cur => { halter.r = wendeCrmAn(cur, ops, jetzt.toISOString(), person); return halter.r.bestand; }, wer(person));
  const r = halter.r!;
  if (r.konflikte.length) return nein(409, 'Das Mandat wurde inzwischen geändert — bitte neu laden und noch einmal.');
  if (r.fehler.length || r.sperren.length || r.grenze.length || !r.angewandt) return nein(409, r.fehler[0] ?? 'Nicht übernommen.');
  return ok({ stimmung });
}

/** Status einer Unterlage (ungeprüft → freigegeben/gesperrt), Zweck, Beleg — erst „freigegeben“ sieht die Analyse (KI). */
export async function unterlageAendern(roh: { id?: unknown; status?: unknown; zweck?: unknown; beleg?: unknown }, person: string): Promise<Ergebnis> {
  const id = typeof roh.id === 'string' && KENNUNG.unterlage.test(roh.id) ? roh.id : null;
  if (!id) return nein(400, 'Unzulässige Kennung.');
  const status = roh.status === undefined ? undefined : (['ungeprueft', 'freigegeben', 'gesperrt'] as const).find(s => s === roh.status);
  const zweck = roh.zweck === undefined ? undefined : (['register', 'playbook', 'notiz', 'sonstig'] as const).find(s => s === roh.zweck);
  if ((roh.status !== undefined && !status) || (roh.zweck !== undefined && !zweck) || (roh.beleg !== undefined && typeof roh.beleg !== 'boolean')) return nein(400, 'Status: ungeprueft, freigegeben, gesperrt · Zweck: register, playbook, notiz, sonstig · Beleg: an/aus.');
  const crm = await crmLaden();
  const r = await fulfillmentAendern('kunde', d => {
    const i = d.unterlagen.findIndex(u => u.id === id);
    if (i < 0 || !businessMandat(crm, d.unterlagen[i].mandatId)) return { ok: false, status: 404, fehler: 'Diese Unterlage gibt es nicht (mehr).' };
    const alt = d.unterlagen[i];
    const neu: Unterlage = { ...alt, ...(status ? { status } : {}), ...(zweck ? { zweck } : {}) };
    if (roh.beleg === true) neu.beleg = true;
    if (roh.beleg === false) delete neu.beleg;
    const unterlagen = [...d.unterlagen]; unterlagen[i] = neu;
    return { ok: true, datei: { ...d, unterlagen }, geaendert: [id] };
  }, wer(person));
  return r.ok ? ok({ unterlage: r.datei.unterlagen.find(u => u.id === id) }) : nein(r.status, r.fehler);
}

/** Antworten intern eintragen (z. B. im Kick-off gemeinsam ausgefüllt) — dieselben Regeln wie über den Link. */
export async function formularIntern(roh: { mandatId?: unknown; bausteinId?: unknown; antworten?: unknown; stand?: unknown; abschnitt?: unknown; fertig?: unknown }, person: string, jetzt = new Date()): Promise<Ergebnis> {
  const x = await mandatMitFall(String(roh.mandatId ?? ''));
  if ('status' in x) return x;
  const v = await fulfillmentLesen('vorlagen');
  const b = formulareDesFalls(x.fall, v.bausteine).find(y => y.id === roh.bausteinId);
  if (!b) return nein(404, 'Dieses Formular gehört nicht (mehr) zum Fall.');
  const r = await fulfillmentAendern('kunde', d => antwortenAnwenden(d, {
    mandatId: x.m.id, baustein: b, antworten: (roh.antworten ?? {}) as Record<string, unknown>, ...(typeof roh.stand === 'string' ? { stand: roh.stand } : {}),
    ...(typeof roh.abschnitt === 'string' ? { abschnitt: roh.abschnitt, fertig: roh.fertig === true } : {}), quelle: 'intern', jetzt: jetzt.toISOString(),
  }, standVon), wer(person));
  if (!r.ok) return nein(r.status, r.fehler, r.konflikte ? { konflikte: r.konflikte } : {});
  const st = formularStandVon(r.datei, x.m.id, b.id);
  return ok({ stand: st ? standVon(st) : 'neu', prozent: formularProzent(b, st) });
}

/** Antworten exportieren (das Playbook gehört dem Kunden, Konzept 5.4) — CSV oder PDF; nur kundentaugliche Formulare. */
export async function antwortenExport(mandatId: string, format: 'csv' | 'pdf', jetzt = new Date()): Promise<{ name: string; typ: string; bytes: Buffer } | Ergebnis> {
  const x = await mandatMitFall(mandatId);
  if ('status' in x) return x;
  const [v, kunde] = await Promise.all([fulfillmentLesen('vorlagen'), fulfillmentLesen('kunde')]);
  const liste = formulareDesFalls(x.fall, v.bausteine).filter(b => kundeTauglich(b, v))
    .map(b => ({ titel: b.titel, fragen: b.fragen ?? [], antworten: formularStandVon(kunde, x.m.id, b.id)?.antworten ?? {} }));
  if (!liste.length) return nein(404, 'Dieser Fall hat (noch) kein Formular mit Antworten.');
  const stamm = `Antworten-${x.m.kunde.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'Kunde'}-${localDay(jetzt)}`;
  if (format === 'csv') return { name: `${stamm}.csv`, typ: 'text/csv; charset=utf-8', bytes: Buffer.from(antwortenCsv(liste), 'utf8') };
  const { antwortenPdf } = await import('./export-pdf');
  return { name: `${stamm}.pdf`, typ: 'application/pdf', bytes: Buffer.from(await antwortenPdf({ firma: x.m.kunde, mandat: x.m.titel, stand: localDay(jetzt), formulare: liste }, { erstellt: jetzt })) };
}

// ── Unterlagen: ablegen, lesen, entfernen ────────────────────────────────────────────────────────────────────────────────────────────────

/** Eine Datei prüfen (Typ am Inhalt, Metadaten weg) — Fehler mit Status 413/415. */
export function dateiPruefen(nameRoh: string, bytes: Buffer): { ok: true; name: string; typ: KundeDateiTyp; bytes: Buffer } | { ok: false; status: 400 | 413 | 415; fehler: string } {
  if (!bytes.length) return { ok: false, status: 400, fehler: 'Die Datei ist leer.' };
  if (bytes.length > UPLOAD_GRENZEN.dateiBytes) return { ok: false, status: 413, fehler: `Datei zu groß (höchstens ${UPLOAD_GRENZEN.dateiBytes / 1024 / 1024} MB).` };
  const name = dateinameSaeubern(nameRoh, 'pdf');
  const typ = kundeTypErkennen(name, bytes);
  if (!typ) return { ok: false, status: 415, fehler: 'Nur PDF, Bilder (PNG, JPG, WEBP, HEIC), Word, Excel oder PowerPoint ohne Makros — und der Inhalt muss zur Endung passen.' };
  // Aktive Inhalte (Makros, eingebettete Objekte, externe Verweise, PDF-Skripte) → 415 (Prüf-Fund 11.10.; dieselbe Regel wie die Aufgaben-Ablage).
  if (aktiveInhalte(typ, bytes)) return { ok: false, status: 415, fehler: AKTIV_TEXT };
  const sauber = ohneMetadaten(typ, new Uint8Array(bytes));
  if (!sauber) return { ok: false, status: 415, fehler: 'Das Bild ließ sich nicht sicher prüfen — bitte als PDF oder JPG senden.' };
  return { ok: true, name, typ, bytes: Buffer.from(sauber) };
}

/**
 * Unterlage ablegen: erst die Datei (verschlüsselt), dann der Eintrag — scheitert der Eintrag (Grenze, Kontingent), wird die Datei wieder entfernt.
 * `link` = über den Kunden-Link (Kontingent je Link: 20 Dateien, 200 MB — in derselben Sperre geprüft).
 */
export async function unterlageAblegen(e: { mandatId: string; name: string; typ: string; bytes: Buffer; herkunft: Unterlage['herkunft']; linkId?: string; von?: string; zweck?: Unterlage['zweck']; jetzt?: Date }): Promise<Ergebnis> {
  const jetzt = e.jetzt ?? new Date();
  const id = neueUnterlageKennung();
  const datei = unterlageDatei(id);
  await bildAblegen(UNTERLAGEN_ORDNER, datei, e.bytes);
  const r = await fulfillmentAendern('kunde', d => {
    if (e.linkId) {
      const frei = uploadFrei(unterlagenDesLinks(d, e.linkId));
      if (frei.dateien < 1) return { ok: false, status: 413, fehler: `Über diesen Link gehen höchstens ${UPLOAD_GRENZEN.dateienJeLink} Dateien.` };
      if (frei.bytes < e.bytes.length) return { ok: false, status: 413, fehler: `Über diesen Link gehen höchstens ${UPLOAD_GRENZEN.bytesJeLink / 1024 / 1024} MB.` };
    }
    const u: Unterlage = { id, mandatId: e.mandatId, name: e.name, typ: e.typ, groesse: e.bytes.length, am: jetzt.toISOString(), herkunft: e.herkunft, ...(e.linkId ? { linkId: e.linkId } : {}), ...(e.von ? { von: e.von } : {}), zweck: e.zweck ?? 'sonstig', status: 'ungeprueft' };
    let links = d.links;
    if (e.linkId) links = d.links.map(l => (l.id === e.linkId ? { ...l, zuletztAm: localDay(jetzt) } : l));
    return { ok: true, datei: { ...d, links, unterlagen: [...d.unterlagen, u] }, geaendert: [id] };
  }, e.von ? wer(e.von) : { art: 'system' });
  if (!r.ok) { await bildEntfernen(UNTERLAGEN_ORDNER, datei); return nein(r.status, r.fehler); }
  return ok({ unterlage: r.datei.unterlagen.find(u => u.id === id) });
}

/** Unterlage lesen (Download intern). null = unbekannt bzw. Mandat nicht Business. */
export async function unterlageLesen(id: string): Promise<{ eintrag: Unterlage; bytes: Buffer } | null> {
  if (!KENNUNG.unterlage.test(id)) return null;
  const [kunde, crm] = await Promise.all([fulfillmentLesen('kunde'), crmLaden()]);
  const u = kunde.unterlagen.find(x => x.id === id);
  if (!u || !businessMandat(crm, u.mandatId)) return null;
  const bytes = await bildOeffnen(UNTERLAGEN_ORDNER, unterlageDatei(id));
  return bytes ? { eintrag: u, bytes } : null;
}

/** Unterlage entfernen — nicht, wenn sie als Beleg übernommen wurde (409). */
export async function unterlageEntfernen(id: string, person: string): Promise<Ergebnis> {
  if (!KENNUNG.unterlage.test(id)) return nein(400, 'Unzulässige Kennung.');
  const crm = await crmLaden();
  const r = await fulfillmentAendern('kunde', d => {
    const u = d.unterlagen.find(x => x.id === id);
    if (!u || !businessMandat(crm, u.mandatId)) return { ok: false, status: 404, fehler: 'Diese Unterlage gibt es nicht (mehr).' };
    if (u.beleg) return { ok: false, status: 409, fehler: 'Diese Unterlage ist als Beleg übernommen und bleibt (§ 257 HGB) — erst „Beleg“ lösen.' };
    return { ok: true, datei: { ...d, unterlagen: d.unterlagen.filter(x => x.id !== id) }, geaendert: [id] };
  }, wer(person));
  if (!r.ok) return nein(r.status, r.fehler);
  await bildEntfernen(UNTERLAGEN_ORDNER, unterlageDatei(id));
  return ok();
}

// ── Öffentliche Aktionen (Kunden-Link; die Route hat Link, Token und Recht schon geprüft) ──────────────────────────────────────────────

export interface Zugriff { art: 'voll' | 'puls'; link: KundenLink; mandat: Mandat; anfrage?: PulsAnfrage; kunde: KundeDatei; vorlagen: VorlagenDatei; crm: CrmBestand; heute: string }

/** Antworten über den Link — nur Formulare, die der Kunde füllt und die für Kunden taugen. */
export async function formularKunde(z: Zugriff, roh: Record<string, unknown>, jetzt = new Date()): Promise<Ergebnis> {
  const fall = await fallVon(z.mandat.id);
  const b = formulareDesFalls(fall, z.vorlagen.bausteine).filter(x => x.kundeFuellt === true && kundeTauglich(x, z.vorlagen)).find(x => formularSchluessel(z.mandat.id, x.id) === roh.formular);
  // 409 (nicht 404): der Link selbst ist gültig — die 404 bleibt dem einen Satz „nicht (mehr) gültig“ vorbehalten.
  if (!b) return nein(409, 'Dieses Formular gibt es hier nicht (mehr) — bitte neu laden.', { neuLaden: true });
  const heute = localDay(jetzt);
  const r = await fulfillmentAendern('kunde', d => {
    const a = antwortenAnwenden(d, {
      mandatId: z.mandat.id, baustein: b, antworten: (roh.antworten ?? {}) as Record<string, unknown>, ...(typeof roh.stand === 'string' ? { stand: roh.stand } : {}),
      ...(typeof roh.abschnitt === 'string' ? { abschnitt: roh.abschnitt, fertig: roh.fertig === true } : {}), quelle: 'kunde', jetzt: jetzt.toISOString(),
    }, standVon);
    if (!a.ok || !a.geaendert.length) return a;
    const g = linkAnwenden(a.datei, { op: 'gesehen', id: z.link.id }, { heute, jetzt: jetzt.toISOString(), person: 'kunde', mandatEnde: mandatsEnde(z.mandat) });
    return g.ok ? { ok: true, datei: g.datei, geaendert: a.geaendert } : a;
  }, { art: 'system' });
  if (!r.ok) return nein(r.status, r.fehler, r.status === 409 ? { neuLaden: true } : {});
  const st = formularStandVon(r.datei, z.mandat.id, b.id);
  return ok({ stand: st ? standVon(st) : 'neu', prozent: formularProzent(b, st) });
}

/** Upload über den Link — Meldung NEUTRAL an die zuständige Person (ohne Dateinamen). */
export async function uploadKunde(z: Zugriff, nameRoh: string, bytes: Buffer, zweck?: unknown): Promise<Ergebnis> {
  const p = dateiPruefen(nameRoh, bytes);
  if (!p.ok) return nein(p.status, p.fehler);
  const r = await unterlageAblegen({ mandatId: z.mandat.id, name: p.name, typ: p.typ, bytes: p.bytes, herkunft: 'kunde', linkId: z.link.id, zweck: zweck === 'register' || zweck === 'playbook' ? zweck : 'sonstig' });
  if (r.status !== 200) return r;
  try {
    const { melde } = await import('@/lib/meldungen/melden');
    const { WEG } = await import('@/lib/wege');
    // Bezug je Link (Prüf-Fund 11.10.): mehrere Uploads über denselben Link = EINE ungelesene Glocke (die neuere ersetzt die ältere).
    for (const an of await empfaenger(z.mandat)) await melde({ an, art: 'produkte', titel: `Neue Unterlagen zu „${z.mandat.titel}“ eingegangen`, link: WEG.fall(z.mandat.id, 'kunde'), bezug: { art: 'kunden-link', id: z.link.id } });
  } catch { /* Meldung ist Zugabe */ }
  const frei = uploadFrei(unterlagenDesLinks((await fulfillmentLesen('kunde')), z.link.id));
  return ok({ eingegangen: true, frei: frei.dateien });
}

/** Puls über den Link — eine Antwort je Anfrage. Wert ≤ Schwelle → neutrale Glocke + Stapel-Vorschlag „Gespräch anbieten“. */
export async function pulsKunde(z: Zugriff, roh: Record<string, unknown>, jetzt = new Date()): Promise<Ergebnis> {
  const heute = localDay(jetzt);
  const anfrage = z.anfrage ?? offeneAnfrage(z.kunde, z.mandat.id, heute);
  if (!anfrage) return nein(409, 'Gerade ist keine Rückfrage offen — danke trotzdem!');
  const id = neuePulsKennung();
  let neu: Puls | undefined;
  const r = await fulfillmentAendern('kunde', d => {
    const a = pulsAnnehmen(d, { anfrageId: anfrage.id, id, wert: roh.wert, satz: roh.satz, jetzt: jetzt.toISOString(), heute });
    if (!a.ok) return a;
    neu = a.puls;
    const g = linkAnwenden(a.datei, { op: 'gesehen', id: z.link.id }, { heute, jetzt: jetzt.toISOString(), person: 'kunde', mandatEnde: mandatsEnde(z.mandat) });
    return g.ok ? { ok: true, datei: g.datei, geaendert: a.geaendert } : a;
  }, { art: 'system' });
  if (!r.ok) return nein(r.status === 404 ? 409 : r.status, r.fehler);
  if (neu && pulsStufe(neu.wert, z.vorlagen.einstellungen.pulsSchwelle) === 'kritisch') await pulsAufmerksamkeit(z.mandat, neu, heute).catch(() => { /* Morgenlauf holt es nach */ });
  return ok({ danke: true });
}

const PULS_WERKZEUG = 'fulfillment_puls_gespraech';
const pulsMarke = (pulsId: string) => `puls-gespraech:${pulsId}`;
/** Glocke (ohne Wert) + Stapel-Vorschlag „Gespräch anbieten“; die Marke verhindert Doppelte (auch im Morgenlauf). */
async function pulsAufmerksamkeit(m: Mandat, p: Puls, heute: string): Promise<boolean> {
  const v = await fulfillmentLesen('vorlagen');
  if (v.marken[pulsMarke(p.id)]) return false;
  const { lege } = await import('@/lib/zoe/stapel');
  const { melde } = await import('@/lib/meldungen/melden');
  const { WEG } = await import('@/lib/wege');
  const person = await fuerPerson(m);
  await lege({
    werkzeug: PULS_WERKZEUG, gruppe: STAPEL_GRUPPE, titel: `Gespräch anbieten: ${m.kunde}`, nachher: 'Follow-up „Gespräch anbieten“ am Mandat (in zwei Tagen fällig)',
    eingabe: { mandatId: m.id, pulsId: p.id }, anlass: 'Der Kunden-Puls liegt unter der Schwelle', quelle: 'lauf', bezug: { art: 'fulfillment', id: `k:puls:${p.id}` }, ...(person ? { person } : {}),
  });
  for (const an of await empfaenger(m)) await melde({ an, art: 'produkte', titel: `Kunden-Puls zu „${m.titel}“ braucht Aufmerksamkeit`, link: WEG.fall(m.id, 'kunde') });
  await fulfillmentAendern('vorlagen', d => ({ ok: true, datei: { ...d, marken: { ...d.marken, [pulsMarke(p.id)]: heute } }, geaendert: ['marken'] }), { art: 'system' });
  return true;
}

// ── Schnittstellen für die anderen Pakete (feste Signaturen aus C0) ─────────────────────────────────────────────────────────────────────

/**
 * Kurzform je Mandat für Cockpit und Fall (Link-Stand, Formular in %, ungeprüfte Unterlagen, Puls) — Schlüssel = Mandat-Kennung.
 * Liest NUR rohe Bestände (Regel „Kurzfassungen lesen roh“, 11.10.): nie `fallLesen`/`fallVon` — `fallLesen` ruft über `fallUmfeld` genau diese
 * Funktion; das war eine Endlos-Schleife (Speicherfehler beim Zusammenführen). Für die Formulare genügt der gespeicherte Fall: die Ableitung
 * (`fallWirksam`) ändert nur den Status der Onboarding-Schritte, nie welche Knoten einen Baustein tragen oder „entfällt“ sind.
 * Wächter: tests/fulfillment-zusammen.test.ts.
 */
export async function kundeKurzFuer(mandatIds: readonly string[]): Promise<Record<string, KundeKurz>> {
  const h = await fulfillmentHaushalt();
  const [kunde, vorlagen, crm, faelle] = await Promise.all([fulfillmentLesen('kunde', h), fulfillmentLesen('vorlagen', h), crmLaden(), fulfillmentLesen('faelle', h)]);
  const schalter = schalterStand(vorlagen.einstellungen, umgebungAn());
  const heute = localDay();
  const raus: Record<string, KundeKurz> = {};
  for (const id of mandatIds) {
    const m = businessMandat(crm, id);
    const fall = m ? faelle.faelle[id] ?? null : null;
    raus[id] = kurzAus(kunde, id, schalter, fall, vorlagen, heute, m ? mandatsEnde(m) : null);
  }
  return raus;
}

/** Formular-Antworten eines Mandats (Playbook, Workbooks) — für die Analyse (C3) nur lesend. Nur Business-Mandate. */
export async function formularAntwortenFuer(mandatId: string): Promise<FormularStand[]> {
  if (!businessMandat(await crmLaden(), mandatId)) return [];
  return (await fulfillmentLesen('kunde')).formulare.filter(f => f.mandatId === mandatId);
}

/** Unterlagen eines Mandats — NUR „freigegeben“ (nie ungeprüfte; Abschnitt 5.4) — für die Analyse (C3). */
export async function unterlagenFuer(mandatId: string): Promise<Unterlage[]> {
  if (!businessMandat(await crmLaden(), mandatId)) return [];
  return (await fulfillmentLesen('kunde')).unterlagen.filter(u => u.mandatId === mandatId && u.status === 'freigegeben');
}

/** Höchstens so viele Zeichen gibt `unterlageText` zurück — darüber `gekuerzt: true` (ausdrücklich, nie still). */
export const UNTERLAGE_ZEICHEN = 30_000;
/** Text einer freigegebenen Unterlage (für `fremd()` in der Analyse) — ohne Freigabe oder unbekannt: Fehler. */
export async function unterlageText(mandatId: string, unterlageId: string): Promise<{ ok: true; text: string; gekuerzt?: boolean } | { ok: false; fehler: string }> {
  const u = (await unterlagenFuer(mandatId)).find(x => x.id === unterlageId);
  if (!u) return { ok: false, fehler: 'Diese Unterlage ist nicht freigegeben (oder gibt es nicht).' };
  const bytes = await bildOeffnen(UNTERLAGEN_ORDNER, unterlageDatei(u.id));
  if (!bytes) return { ok: false, fehler: 'Die Datei fehlt oder lässt sich nicht öffnen.' };
  try {
    const { textAuslesen } = await import('@/lib/dateien/text-auslesen');
    const a = await textAuslesen(bytes, u.typ);
    if (!a || !a.text.trim()) return { ok: false, fehler: 'In dieser Datei steht kein lesbarer Text (z. B. ein Foto).' };
    return a.text.length > UNTERLAGE_ZEICHEN ? { ok: true, text: a.text.slice(0, UNTERLAGE_ZEICHEN), gekuerzt: true } : { ok: true, text: a.text };
  } catch { return { ok: false, fehler: 'Die Datei ließ sich nicht lesen.' }; }
}

/** Zusatz zum 2-Wochen-Report (5.2) — ohne Fall null, dann bleibt der Report Byte für Byte wie heute. Wirft nie. */
export async function reportZusatzFuer(mandatId: string, heute: string): Promise<ReportZusatz | null> {
  try {
    const fall = await fallVon(mandatId);
    if (!fall) return null;
    const h = await fulfillmentHaushalt();
    const [crm, kunde, vorlagen] = await Promise.all([crmLaden(), fulfillmentLesen('kunde', h), fulfillmentLesen('vorlagen', h)]);
    const m = businessMandat(crm, mandatId);
    if (!m) return null;
    const link = schalterStand(vorlagen.einstellungen, umgebungAn()).an ? aktiverLink(kunde, m.id, heute, mandatsEnde(m)) : null;
    return reportZusatz(fall, m, kunde, heute, !!link?.rechte.puls, kundenGesperrt(vorlagen.bausteine, vorlagen));
  } catch (e) {
    console.error('[fulfillment] Report-Zusatz:', e instanceof Error ? e.message.slice(0, 160) : e);
    return null;
  }
}

/** Morgenlauf: abgelaufene Links markieren; Puls ≤ Schwelle (über den Link oder von Hand, letzte 14 Tage) ohne Vorschlag → Vorschlag „Gespräch anbieten“. */
export async function kundeMorgenlauf(h: string, heute: string): Promise<MorgenlaufTeil> {
  const [kunde, vorlagen] = await Promise.all([fulfillmentLesen('kunde', h), fulfillmentLesen('vorlagen', h)]);
  if (!kunde.links.length && !kunde.puls.length) return { vorschlaege: 0 };
  const crm = await crmLaden();
  const ende = (id: string) => { const m = (crm.mandate ?? []).find(x => x.id === id); return m ? mandatsEnde(m) : null; };
  const markiert = abgelaufeneMarkieren(kunde, heute, ende);
  if (markiert.n) await fulfillmentAendern('kunde', d => { const x = abgelaufeneMarkieren(d, heute, ende); return { ok: true, datei: x.datei, geaendert: [] }; }, { art: 'system' }, h);
  let vorschlaege = 0;
  const grenze = tagePlus(heute, -14);
  for (const p of kunde.puls) {
    if (tagVon(p.am) < grenze || vorlagen.marken[pulsMarke(p.id)]) continue;
    if (pulsStufe(p.wert, vorlagen.einstellungen.pulsSchwelle) !== 'kritisch') continue;
    const m = businessMandat(crm, p.mandatId);
    if (m && await pulsAufmerksamkeit(m, p, heute)) vorschlaege++;
  }
  return { vorschlaege, ...(markiert.n ? { info: `${markiert.n} Kunden-Link${markiert.n === 1 ? '' : 's'} abgelaufen` } : {}) };
}

/** Löschfristen (8.1): Antworten und Puls-Sätze 12 Monate, Unterlagen 90 Tage nach Mandatsende (außer Beleg), verwaiste Dateien — Zähler je Name. */
export async function kundeFristen(k: FristenKontext): Promise<Record<string, number>> {
  const h = await fulfillmentHaushalt();
  const name = fulfillmentSpeicherFuer('kunde', h);
  const zaehler: Record<string, number> = {};
  if ((await loadJson<unknown>(name)) !== null) {
    const { ladeCrmMitPapierkorb } = await import('@/lib/crm/speicher');
    const crm = await ladeCrmMitPapierkorb();
    const mandate = new Map((crm.mandate ?? []).map(m => [m.id, m]));
    // Ohne ein einziges Mandat im CRM (Bestand fehlt/leer) gilt nichts als verwaist — nie alles löschen, weil das CRM nicht lesbar war.
    const endeVon = (id: string) => { const m = mandate.get(id); return m ? { bekannt: true, ende: mandatsEnde(m) } : { bekannt: mandate.size === 0, ende: null }; };
    let weg: string[] = [];
    const r = await fulfillmentAendern('kunde', d => {
      const x = kundeFristenAnwenden(d, endeVon, { heute: k.heute, mandatsdatenMonate: k.fristen.mandatsdatenMonate, unterlagenTage: k.fristen.unterlagenTage });
      weg = x.dateienWeg;
      Object.assign(zaehler, x.zaehler);
      return { ok: true, datei: x.datei, geaendert: [] };
    }, { art: 'system' }, h);
    if (r.ok) for (const d of weg) await bildEntfernen(UNTERLAGEN_ORDNER, d);
    else for (const z of Object.keys(zaehler)) delete zaehler[z];
  }
  // Verwaiste Dateien (Art. 17 entfernt nur die Metadaten): Namen, die in keinem Fulfillment-Bestand mehr vorkommen, älter als ein Tag.
  const ordner = path.join(datenOrdner(), UNTERLAGEN_ORDNER);
  // Nur Namen, die die Ablage selbst vergibt (`BILD_NAME`) — alles andere gehört nicht uns und würde `bildEntfernen` ablehnen (ganzer Lauf scheitert).
  const { BILD_NAME } = await import('@/lib/store/datei-huelle.mjs');
  const namen = (await fs.readdir(ordner).catch(() => [] as string[])).filter(n => BILD_NAME.test(n));
  if (namen.length) {
    const bekannt = new Set<string>();
    // Prüf-Fund 11.10.: ein UNLESBARER Bestand bricht die Prüfung ab (vorher galt er als leer — und jede Datei als verwaist). Ebenso ein Bestand,
    // der beschädigt beiseitegelegt wurde (`<name>.json.corrupt-…` — er nennt vielleicht Dateien). Fehlt er einfach, ist er leer.
    let lesbar = true;
    const namenB = (['kunde', 'faelle', 'dossiers', 'vorlagen'] as const).map(art => fulfillmentSpeicherFuer(art, h));
    for (const n of namenB) {
      try { alleTexte(await loadJson<unknown>(n), bekannt); } catch { lesbar = false; break; }
    }
    // Erst NACH dem Lesen nachsehen — `loadJson` legt einen beschädigten Bestand beim Lesen beiseite und meldet „leer“. Eine solche Kopie der
    // letzten 30 Tage hält die Prüfung an (Zeit zum Wiederherstellen); danach läuft sie wieder (Art. 17 braucht das Entfernen verwaister Dateien).
    if (lesbar) {
      const beiseite = await fs.readdir(datenOrdner()).catch(() => null);
      const frisch = (x: string, n: string) => x.startsWith(`${n}.json.corrupt-`) && k.jetzt.getTime() - Number(x.slice(`${n}.json.corrupt-`.length)) < 30 * 86_400_000;
      if (!beiseite || beiseite.some(x => namenB.some(n => frisch(x, n)))) lesbar = false;
    }
    if (!lesbar) {
      if (Object.keys(zaehler).length) await protokolliere(name, [{ op: 'geaendert', id: 'loeschfristen', felder: Object.keys(zaehler) }], { art: 'system' }).catch(() => {});
      return zaehler;
    }
    const jetzt = k.jetzt.getTime();
    const dateien = await Promise.all(namen.map(async n => ({ name: n, alt: jetzt - ((await fs.stat(path.join(ordner, n)).catch(() => null))?.mtimeMs ?? jetzt) > 86_400_000 })));
    const verwaist = verwaisteDateien(dateien, bekannt);
    for (const d of verwaist) await bildEntfernen(UNTERLAGEN_ORDNER, d);
    if (verwaist.length) zaehler['fulfillment-unterlagen-verwaist'] = verwaist.length;
  }
  if (Object.keys(zaehler).length) await protokolliere(name, [{ op: 'geaendert', id: 'loeschfristen', felder: Object.keys(zaehler) }], { art: 'system' }).catch(() => {});
  return zaehler;
}

/** Art. 15: Antworten, Puls-Sätze und Unterlagen-Metadaten, die die Person nennen. */
export async function kundeAuskunft(m: PersonMerkmale): Promise<KundeAuskunft[]> {
  const d = await fulfillmentLesen('kunde');
  const raus: KundeAuskunft[] = [];
  for (const f of d.formulare) for (const a of Object.values(f.antworten)) if (textNennt(a, m)) raus.push({ mandatId: f.mandatId, art: 'formular', am: f.geaendertAm, text: a });
  for (const p of d.puls) if (p.satz && textNennt(p.satz, m)) raus.push({ mandatId: p.mandatId, art: 'puls', am: p.am, text: p.satz });
  for (const u of d.unterlagen) if (textNennt(u.name, m)) raus.push({ mandatId: u.mandatId, art: 'unterlage', am: u.am, text: `${u.name} (${u.typ}, ${Math.round(u.groesse / 1024)} KB, ${u.herkunft === 'kunde' ? 'über den Kunden-Link' : 'intern abgelegt'})` });
  return raus;
}

/** Follow-up „Gespräch anbieten“ am Mandat (idempotent über die Kennung `fu-kp-<fnv>`). */
function gespraechFollowup(b: CrmBestand, m: Mandat, pulsId: string, person: string, jetzt: Date, zustaendigFuer: string): CrmBestand {
  const id = `fu-kp-${fnv(pulsId)}`;
  if ((b.followups ?? []).some(f => f.id === id)) return b;
  const iso = jetzt.toISOString();
  const fu = {
    id, bezug: { art: 'mandat', id: m.id }, ...(m.kontaktIds[0] ? { kontaktId: m.kontaktIds[0] } : {}), art: 'termin', text: 'Gespräch anbieten (Kunden-Puls)',
    faellig: tagePlus(localDay(jetzt), 2), zustaendig: zustaendigFuer, status: 'offen', quelle: 'head', angelegt: iso, geaendert: iso, geaendertVon: person,
  } as FollowUp;
  return { ...b, followups: [...(b.followups ?? []), fu] };
}

/** Freigabe-Stapel, Präfix `k:` (Puls schlecht → Gespräch anbieten) — von lib/fulfillment/stapel.ts verteilt. */
export const KUNDE_STAPEL: StapelArtFreigabe = {
  freigeben: async (vIn, person) => {
    const { beanspruche, entscheide, loslassen } = await import('@/lib/zoe/stapel');
    const { personImHaushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    if (!(await personImHaushaltDesInhabers(person))) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
    const a = await beanspruche(vIn.id, person, v => {
      if (v.bezug?.art !== 'fulfillment' || !v.bezug.id.startsWith('k:puls:') || v.werkzeug !== PULS_WERKZEUG) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
      if (v.person && v.person !== person) return { status: 403, fehler: 'Nur die Person, für die der Vorschlag vorbereitet wurde, gibt ihn frei.' };
      return null;
    });
    if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
    const v: Vorschlag = a.v;
    try {
      const mandatId = String(v.eingabe.mandatId ?? ''), pulsId = String(v.eingabe.pulsId ?? '');
      const { aendereCrm } = await import('@/lib/crm/speicher');
      const crm = await crmLaden();
      const m = businessMandat(crm, mandatId);
      if (!m || !KENNUNG.puls.test(pulsId)) { await loslassen(v.id); return { ok: false, status: 404, fehler: 'Dieses Mandat gibt es nicht (mehr).' }; }
      const { zustaendig } = await import('@/lib/crm/team');
      await aendereCrm(b => gespraechFollowup(b, m, pulsId, person, new Date(), zustaendig(m.zustaendig, 'sales')), { art: 'person', person });
      const text = 'Follow-up „Gespräch anbieten (Kunden-Puls)“ am Mandat angelegt — in zwei Tagen fällig.';
      await entscheide(v.id, 'freigegeben', { ergebnis: text, von: person, ausArbeit: true });
      return { ok: true, text };
    } catch (e) {
      await loslassen(v.id);
      throw e;
    }
  },
};
