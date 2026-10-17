// ─── Produkte & Mandate · Mandat anlegen mit Lead / Firma zuordnen — der Ablauf (Server, 10.10.) ──────────────────────────
// Route: POST /api/crm/lead `{ aktion: 'mandat-neu', … }` bzw. `{ aktion: 'mandat-firma', mandatId, firma, person? }` — dieselbe Stelle wie
// „Mandat anlegen“ aus einem gewonnenen Deal, die Folgen in der Kartei teilen sich beide (`personenWerdenKunde`). Reihenfolge (nie verschachtelt,
// erst prüfen, dann schreiben — eine abgelehnte Person hinterlässt keine neue Firma):
//   1. Person prüfen: vorhandene muss verarbeitet werden dürfen (Art. 18 → 409); eine neue darf keine eingeschränkte Person treffen und keine
//      Dublette sein (409 mit der vorhandenen Person — die Oberfläche bietet sie zur Wahl an)
//   2. Firma: vorhandene Kennung (muss es geben) oder Name → `firmaSichern` (vorhanden verknüpfen, neu, aus dem Papierkorb — nie doppelt)
//   3. neue Person über den EINEN Weg „Person anlegen“ (`personAnlegen`, Weg Firmenkarte: Station bei der Firma, Datenschutz-Stempel, Sperrliste)
//   4. Mandat (in EINER CRM-Sperre mit der Folge an der Firma: Rolle Kunde, Lead → Kunde) bzw. beim Zuordnen: Firma + Person am Mandat
//   5. Kartei: Personen → Lebensphase Kunde (Phase gehoben), wie beim Mandat aus dem Deal
//   6. optional: Stufe der Leistungstreppe am Fortschritt des neuen Mandats
// Bestehende Daten bleiben, wie sie sind — zugeordnet wird nur auf Klick.

import type { Kontakt } from '@/lib/make-one/crm';
import { aendereCrm, ladeCrm } from './speicher';
import { aendereKontakte } from './kartei-schreiben';
import { kontakteFuerVerarbeitung } from './verarbeitung';
import { trifftEingeschraenkte } from './netzwerken';
import { phaseHeben } from './lifecycle';
import { EINGESCHRAENKT_FEHLER } from './einschraenkung';
import { eingabeSaeubern, dublettePruefen, dublettenText } from './person-anlegen';
import { firmaSichern, personAnlegen } from './person-anlegen-server';
import { mandatEntwurf, firmaWirdKunde, firmaWirdExKunde, zuordnenFolge, firmaWahlAus, personWahlAus, type MandatEingabe, type FirmaWahl, type PersonWahl } from './mandat-anlegen';
import { anzeigename } from '@/lib/make-one/crm';
import { neueKennung, neueKontaktKennung } from '@/lib/kennung';
import { tagVon } from '@/lib/zeit';
import { wer as teamWer } from './team';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { Firma, Mandat } from './typen';

export type MandatErgebnis =
  | { ok: true; mandatId: string; firmaId: string; kontaktId: string; firmaNeu: boolean; personNeu: boolean; hinweise: string[] }
  | { ok: false; status: number; fehler: string; dublette?: { id: string; name: string }; eingeschraenkt?: true };

/** Personen eines neuen Mandats werden Kunden (Lebensphase, Stufe „gewonnen“, Lifecycle gehoben) — eingeschränkte (Art. 18) bleiben unberührt. */
export async function personenWerdenKunde(ids: readonly string[], jetzt: string, wer?: Wer): Promise<void> {
  const menge = new Set(ids);
  if (!menge.size) return;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => {
    if (!menge.has(k.id) || k.eingeschraenkt) return k;
    const phase = phaseHeben(k.phase, 'kunde');
    return { ...k, lebensphase: 'kunde', stufe: 'gewonnen', ...(phase ? { phase } : {}), geaendertAm: tagVon(jetzt) };
  }) }), wer);
}

/** Personen eines beendeten/pausierten Mandats (Firma zuordnen, 11.10.): höchstens Ex-Kunde — nie aus „Kunde“ zurück, nie eingeschränkte. */
export async function personenWerdenExKunde(ids: readonly string[], jetzt: string, wer?: Wer): Promise<void> {
  const menge = new Set(ids);
  if (!menge.size) return;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => {
    if (!menge.has(k.id) || k.eingeschraenkt || k.lebensphase === 'kunde' || k.lebensphase === 'ex_kunde') return k;
    return { ...k, lebensphase: 'ex_kunde', geaendertAm: tagVon(jetzt) };
  }) }), wer);
}

/** Schritt 1: die Person prüfen, bevor irgendetwas geschrieben wird. */
async function personPruefen(p: PersonWahl, firmaName: string | undefined): Promise<{ ok: true; id?: string } | Extract<MandatErgebnis, { ok: false }>> {
  const alle = await kontakteFuerVerarbeitung({ mitEingeschraenkten: true });
  if ('id' in p) {
    const k = alle.find(x => x.id === p.id);
    if (!k) return { ok: false, status: 404, fehler: 'Diese Person gibt es nicht (mehr) — bitte neu wählen.' };
    if (k.eingeschraenkt) return { ok: false, status: 409, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true };
    return { ok: true, id: k.id };
  }
  const e = eingabeSaeubern({ ...p.neu, ...(firmaName ? { firma: firmaName } : {}) });
  if (!e.ok) return { ok: false, status: e.status, fehler: e.fehler };
  const merkmale = { vorname: e.e.vorname, nachname: e.e.nachname, firma: e.e.firma, email: e.e.email, telefon: e.e.telefon, mobil: e.e.mobil };
  if (trifftEingeschraenkte({ kontakt: merkmale }, alle, '')) return { ok: false, status: 409, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true };
  const d = dublettePruefen(merkmale, alle, '');
  if (d.gleich) return { ok: false, status: 409, fehler: dublettenText(d.gleich), dublette: { id: d.gleich.kontakt.id, name: anzeigename(d.gleich.kontakt) } };
  return { ok: true };
}

/** Schritt 2: die Firma — vorhandene Kennung oder per Name gesichert (nie doppelt). */
async function firmaHolen(f: FirmaWahl, wer?: Wer): Promise<{ ok: true; firma: Firma; neu: boolean; hinweis?: string } | Extract<MandatErgebnis, { ok: false }>> {
  if ('id' in f) {
    const firma = (await ladeCrm()).firmen.find(x => x.id === f.id);
    return firma ? { ok: true, firma, neu: false } : { ok: false, status: 404, fehler: 'Diese Firma gibt es nicht (mehr) — bitte neu wählen.' };
  }
  const plan = await firmaSichern(f.name, {}, wer);
  if (!plan) return { ok: false, status: 400, fehler: 'Name der Firma fehlt.' };
  return { ok: true, firma: plan.firma, neu: plan.art !== 'vorhanden', ...(plan.art === 'zurueck' ? { hinweis: `Die Firma „${plan.firma.name}“ lag im Papierkorb — sie ist zurückgeholt.` } : {}) };
}

/** Schritt 3: die Person — vorhanden oder über den EINEN Weg „Person anlegen“ an der Firma (Weg Firmenkarte: keine zweite Firma). */
async function personHolen(p: PersonWahl, firma: Firma, person: string, wer?: Wer): Promise<{ ok: true; id: string; neu: boolean; hinweise: string[] } | Extract<MandatErgebnis, { ok: false }>> {
  if ('id' in p) return { ok: true, id: p.id, neu: false, hinweise: [] };
  const e = eingabeSaeubern({ ...p.neu, firmaId: firma.id });
  if (!e.ok) return { ok: false, status: e.status, fehler: e.fehler };
  const r = await personAnlegen(e.e, { weg: 'firmenkarte', person, wer, id: neueKontaktKennung() });
  if (!r.ok) return { ok: false, status: r.status, fehler: r.fehler, ...(r.dublette ? { dublette: r.dublette } : {}), ...(r.eingeschraenkt ? { eingeschraenkt: true as const } : {}) };
  return { ok: true, id: r.kontaktId, neu: r.neu, hinweise: r.hinweise };
}

/** „+ Mandat“ mit Lead: Firma + Ansprechperson (vorhanden oder neu), dann das Mandat und die Folgen — siehe Kopf. */
export async function mandatMitLeadAnlegen(e: MandatEingabe, person: string, wer?: Wer, jetzt = new Date().toISOString()): Promise<MandatErgebnis> {
  const crm = await ladeCrm();
  const leistung = e.leistungId ? crm.leistungen.find(l => l.id === e.leistungId) : undefined;
  if (e.leistungId && !leistung) return { ok: false, status: 404, fehler: 'Dieses Produkt gibt es nicht (mehr).' };
  const vorab = 'id' in e.firma ? crm.firmen.find(f => f.id === (e.firma as { id: string }).id)?.name : e.firma.name;
  const pp = await personPruefen(e.person, vorab);
  if (!pp.ok) return pp;
  const f = await firmaHolen(e.firma, wer);
  if (!f.ok) return f;
  const p = await personHolen(e.person, f.firma, person, wer);
  if (!p.ok) return p;
  const zustaendig = e.zustaendig && teamWer(e.zustaendig) ? e.zustaendig : undefined;
  const m = mandatEntwurf({ id: neueKennung('m'), firma: f.firma, kontaktIds: [p.id], gesellschaft: e.gesellschaft, ...(e.titel ? { titel: e.titel } : {}), leistung: leistung ?? null, ...(zustaendig ? { zustaendig } : {}), jetzt, person });
  await aendereCrm(b => ({ ...b, mandate: [...b.mandate, m], firmen: b.firmen.map(x => (x.id === f.firma.id ? firmaWirdKunde(x) : x)) }), wer);
  await personenWerdenKunde([p.id], jetzt, wer);
  const hinweise = [...(f.hinweis ? [f.hinweis] : []), ...p.hinweise];
  if (e.stufeId) {
    const { treppeKundeStufe } = await import('./treppe-server');
    const ok = await treppeKundeStufe(m.id, e.stufeId, person).catch(() => false);
    if (!ok) hinweise.push('Die Stufe der Leistungstreppe ließ sich nicht setzen — im Mandat unter „Fortschritt der Leistung“ wählen.');
  }
  return { ok: true, mandatId: m.id, firmaId: f.firma.id, kontaktId: p.id, firmaNeu: f.neu, personNeu: p.neu, hinweise };
}

/**
 * „Firma zuordnen“ für ein bestehendes Mandat ohne Firma (nur auf Klick): Firma (vorhanden oder neu) + optional eine Ansprechperson. Der
 * Anzeigename des Mandats wird der Firmenname; alles andere am Mandat bleibt. Dieselben Folgen wie beim Anlegen.
 */
export async function mandatFirmaZuordnen(mandatId: string, firmaRoh: unknown, personRoh: unknown, person: string, wer?: Wer, jetzt = new Date().toISOString()): Promise<MandatErgebnis> {
  const fw = firmaWahlAus(firmaRoh);
  if (!fw.ok) return fw;
  const pw = personRoh === undefined || personRoh === null ? null : personWahlAus(personRoh);
  if (pw && !pw.ok) return pw;
  const crm = await ladeCrm();
  const alt = crm.mandate.find(x => x.id === mandatId);
  if (!alt) return { ok: false, status: 404, fehler: 'Dieses Mandat gibt es nicht (mehr).' };
  if (alt.firmaId && crm.firmen.some(x => x.id === alt.firmaId)) return { ok: false, status: 409, fehler: 'Dieses Mandat hängt schon an einer Firma.' };
  const vorab = 'id' in fw.wahl ? crm.firmen.find(x => x.id === (fw.wahl as { id: string }).id)?.name : fw.wahl.name;
  if (pw) { const pp = await personPruefen(pw.wahl, vorab); if (!pp.ok) return pp; }
  const f = await firmaHolen(fw.wahl, wer);
  if (!f.ok) return f;
  const p = pw ? await personHolen(pw.wahl, f.firma, person, wer) : null;
  if (p && !p.ok) return p;
  const kontaktId = p && p.ok ? p.id : undefined;
  let schon = false;
  await aendereCrm(b => {
    const m = b.mandate.find(x => x.id === mandatId);
    if (!m || (m.firmaId && b.firmen.some(x => x.id === m.firmaId))) { schon = true; return b; }
    const neu: Mandat = { ...m, kunde: f.firma.name, firmaId: f.firma.id, kontaktIds: kontaktId && !m.kontaktIds.includes(kontaktId) ? [...m.kontaktIds, kontaktId] : m.kontaktIds, geaendert: jetzt, geaendertVon: person };
    // Prüf-Fund 11.10.: nur ein AKTIVES Mandat macht Kunden; beendet/pausiert höchstens Ex-Kunden (zuordnenFolge).
    const folge = zuordnenFolge(m.status);
    return { ...b, mandate: b.mandate.map(x => (x.id === mandatId ? neu : x)), firmen: b.firmen.map(x => (x.id !== f.firma.id || !folge ? x : folge === 'kunde' ? firmaWirdKunde(x) : firmaWirdExKunde(x))) };
  }, wer);
  if (schon) return { ok: false, status: 409, fehler: 'Inzwischen hängt das Mandat an einer Firma — neu geladen.' };
  const folge = zuordnenFolge(alt.status);
  if (kontaktId && folge === 'kunde') await personenWerdenKunde([kontaktId], jetzt, wer);
  else if (kontaktId && folge === 'ex_kunde') await personenWerdenExKunde([kontaktId], jetzt, wer);
  return { ok: true, mandatId, firmaId: f.firma.id, kontaktId: kontaktId ?? '', firmaNeu: f.neu, personNeu: !!(p && p.ok && p.neu), hinweise: [...(f.hinweis ? [f.hinweis] : []), ...(p && p.ok ? p.hinweise : [])] };
}
