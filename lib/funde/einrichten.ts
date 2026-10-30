// ─── Funde — Kampagne + Segment einrichten, Einstellungen, Fund von Hand, verwerfen (nur Server) ─────────────────────────────
// Die Kampagne entsteht über `planen` (Playbook `homepage-funde`, lib/crm/kampagnen.ts) und ist sofort aktiv; das Segment „Homepage-Funnel“ =
// gespeicherter Filter Herkunft Recherche + Label `homepage-funnel` (alle übernommenen Funde). Beides nur einmal (Kennungen in den Einstellungen).

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
import { PLAYBOOK_ID, SEGMENT_LABEL, istFundBranche, type Fund, type FundBranche, type FundeEinstellungen } from './typen';

export const SEGMENT_ID = 'seg-homepage-funnel';

export async function kampagneEinrichten(person: string, wer: Wer): Promise<{ kampagneId: string; segmentId: string; neu: boolean }> {
  const h = await fundeHaushalt();
  const pb = PLAYBOOKS.find(p => p.id === PLAYBOOK_ID);
  if (!pb) throw new FundeFehler(409, 'Playbook fehlt.');
  const crm = await ladeCrm();
  const heute = localDay(), jetzt = new Date().toISOString();
  let kampagneId = '';
  let neu = false;
  await aendereCrm(c => {
    const segmente = c.segmente.some(s => s.id === SEGMENT_ID) ? c.segmente
      : [...c.segmente, { id: SEGMENT_ID, name: 'Homepage-Funnel', beschreibung: 'Betriebe aus der Kampagne „Homepage“ (übernommene Funde).', kriterien: { herkunft: ['recherche'], label: [SEGMENT_LABEL] }, geaendert: jetzt, geaendertVon: person }];
    const offen = c.kampagnen.find(k => k.playbook === PLAYBOOK_ID && !k.geloeschtAm && !k.archiviertAm && (k.status === 'aktiv' || k.status === 'entwurf'));
    if (offen) { kampagneId = offen.id; return { ...c, segmente }; }
    kampagneId = neueKennung('kp'); neu = true;
    const k = { ...planen(pb, [], { ...crm, segmente }, heute, kampagneId), status: 'aktiv' as const, segmentId: SEGMENT_ID, zustaendig: person, geaendertVon: person };
    return { ...c, segmente, kampagnen: [...c.kampagnen, k] };
  }, wer);
  await aendereFunde(b => ({ ...b, einstellungen: { ...b.einstellungen, kampagneId, segmentId: SEGMENT_ID } }), { h, wer });
  return { kampagneId, segmentId: SEGMENT_ID, neu };
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
    if (x.funde.some(f => f.name.toLowerCase() === e.name.toLowerCase() && f.status !== 'verworfen')) throw new FundeFehler(409, 'Diesen Betrieb gibt es schon als Fund.');
    const site = websiteNormal(e.website);
    const bew = bewerten({ website: eigeneWebsite(site), signale: null, jahrHeute: Number(localDay().slice(0, 4)), gemessenAm: am });
    const bewertung = eigeneWebsite(site) ? { ...bew, punkte: 60, erreichbar: undefined, gruende: ['Von Hand eingetragen — die Website wurde nicht automatisch geprüft.'] } : bew;
    const f: Fund = {
      id: neueKennung('fd'), kampagneId: x.einstellungen.kampagneId as string, quelle: 'hand', name: e.name, branche: e.branche,
      ...(e.strasse || e.plz || e.ort ? { adresse: { ...(e.strasse ? { strasse: e.strasse } : {}), ...(e.plz ? { plz: e.plz } : {}), ...(e.ort ? { ort: e.ort } : {}) } } : {}),
      ...(site ? { website: site } : {}), ...(e.email ? { email: e.email } : {}), ...(e.telefon ? { telefon: e.telefon } : {}),
      bewertung, status: 'vorbereitet', angelegt: am, geaendert: am, von: person,
    };
    f.vorschau = vorschauRegelwerk(f);
    f.entwurf = entwurfBauen(f, ctx);
    neu = f;
    return { ...x, funde: [...x.funde, f] };
  }, { h, wer });
  const f = neu as unknown as Fund;
  const { fundVorschlagLegen } = await import('./uebernehmen');
  await fundVorschlagLegen(f, person);
  return f;
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
