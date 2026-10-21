// ─── Ereignisse — die Quellen der Kundengewinnung (22.10., Vorlagen der Prozesse; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 5.1) ─────────────
// Je Quelle EIN kleiner Aufruf NACH dem Speichern des vorhandenen Schreibwegs (die Quelle bleibt, wie sie ist; alles hier wirft nie):
//   E2  netzwerkenEreignisse    Netzwerken-Erfassung abgeschlossen (lib/crm/netzwerken-server.ts) → `netzwerken-erfasst`; E12: neu angelegt → `neuer-lead`
//   E3  angebotEreignis         „Angebot stellen“ bzw. Antwort (lib/crm/angebot-server.ts) → `angebot-gestellt` · `angebot-antwort` (Stufe = Antwort)
//   E5  buchungEreignis         Buchungsanfrage bestätigt der Gast bzw. Freigabe abgeschlossen (lib/kalender/buchung-ablauf.ts); E12: neue Person → `neuer-lead`
//   E6  einwilligungDiff        Kartei: neue, nicht widerrufene Einwilligung mit vollem Nachweis → `einwilligung-erteilt` (Stufe = Kanal)
//   E7  crmDiffKundengewinnung  CRM: Event in neuem Status → `event-status`, auf „durchgeführt“ → `event-vorbei`
//   E10 netzwerkEreignis        Vernetzen-Runde: „vernetzt“ bzw. „Antwort“ (app/api/crm/netzwerk/route.ts) → `vernetzt` · `linkedin-antwort`
//   E11 crmDiffKundengewinnung  CRM: Kampagne wird aktiv → `kampagne-aktiv`; neues Ergebnis einer Person → `kampagnen-ergebnis`
// Regeln wie in ./quellen.ts: nur Kennungen (nie Namen, Titel, Texte, Beträge, Adressen), eingeschränkte Personen (Art. 18) lösen nie etwas aus, Bereich
// Business (Prozesse hören nie auf Privates), Kennung je Wirkung deterministisch. Die reinen Diffs sind getestet (tests/prozesse-vorlagen-ereignisse.test.ts).

import { ereignis } from './server';
import { ereignisKennung, type EreignisEingabe } from './typen';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import { bereichVonGesellschaft } from '@/lib/einheiten';

const ablegen = async (l: readonly EreignisEingabe[]): Promise<number> => {
  try { return l.length ? (await ereignis(l)).neu : 0; } catch { return 0; }
};
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/;
const k = (v: unknown): string | undefined => (typeof v === 'string' && KENNUNG.test(v) ? v : undefined);

// ── E7 · E11: CRM (rein) ────────────────────────────────────────────────────────────────────────────────────────────────

/** Events und Kampagnen im CRM-Diff (rein): Status-Wechsel eines Events, „durchgeführt“, Kampagne aktiv, neue Ergebnisse. */
export function crmDiffKundengewinnung(vorher: Partial<Pick<CrmBestand, 'events' | 'kampagnen'>>, nachher: Partial<Pick<CrmBestand, 'events' | 'kampagnen'>>): EreignisEingabe[] {
  const raus: EreignisEingabe[] = [];
  const evAlt = new Map((vorher.events ?? []).map(e => [e.id, e.status]));
  for (const e of nachher.events ?? []) {
    const alt = evAlt.get(e.id);
    if (alt === undefined || alt === e.status) continue; // neue Events melden sich über ihr Datum (Auslöser „Datum am Fall“), nicht als Statuswechsel
    raus.push({ id: ereignisKennung('crm', 'event', e.id, e.status), art: 'event-status', quelle: 'crm', stufe: e.status, bereich: 'business', bezug: { eventId: e.id } });
    if (e.status === 'durchgefuehrt') raus.push({ id: ereignisKennung('crm', 'event', e.id, 'vorbei'), art: 'event-vorbei', quelle: 'crm', bereich: 'business', bezug: { eventId: e.id } });
  }
  const kpAlt = new Map((vorher.kampagnen ?? []).map(x => [x.id, x]));
  for (const x of nachher.kampagnen ?? []) {
    const alt = kpAlt.get(x.id);
    if (x.status === 'aktiv' && alt?.status !== 'aktiv') raus.push({ id: ereignisKennung('crm', 'kampagne', x.id, 'aktiv'), art: 'kampagne-aktiv', quelle: 'crm', bereich: 'business', bezug: { kampagneId: x.id } });
    const gesehen = new Set((alt?.ergebnisse ?? []).map(r => `${r.kontaktId}|${r.ergebnis}|${r.am}`));
    for (const r of x.ergebnisse ?? []) {
      if (gesehen.has(`${r.kontaktId}|${r.ergebnis}|${r.am}`)) continue;
      raus.push({ id: ereignisKennung('crm', 'kampagne', x.id, r.kontaktId, r.ergebnis, r.am), art: 'kampagnen-ergebnis', quelle: 'crm', stufe: r.ergebnis, bereich: 'business', bezug: { kampagneId: x.id, kontaktId: r.kontaktId } });
    }
  }
  return raus;
}

// ── E6: Kartei (rein) ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Voller Nachweis einer Einwilligung (wie lib/crm/einwilligung.ts `nachweisLuecken`, hier nur die vier Pflichtangaben — rein, ohne Import-Kreis). */
const nachweisVoll = (e: { zeitpunkt?: string; erfasstVon?: string; wortlaut?: string; belegRef?: string }) => !!(e.zeitpunkt && e.erfasstVon && e.wortlaut && e.belegRef);

/** Neue, nicht widerrufene Einwilligungen mit vollem Nachweis (rein) — je Person und Kanal; eingeschränkte Personen nie. */
export function einwilligungDiff(vorher: readonly Pick<Kontakt, 'id' | 'einwilligungen'>[] | null | undefined, nachher: readonly Pick<Kontakt, 'id' | 'einwilligungen' | 'firmaId' | 'eingeschraenkt'>[] | null | undefined): EreignisEingabe[] {
  if (!nachher?.length) return [];
  const alt = new Map((vorher ?? []).map(x => [x.id, new Set((x.einwilligungen ?? []).filter(e => !e.widerrufenAm && nachweisVoll(e)).map(e => e.kanal))]));
  const raus: EreignisEingabe[] = [];
  for (const p of nachher) {
    if (p.eingeschraenkt) continue;
    const war = alt.get(p.id) ?? new Set<string>();
    for (const e of p.einwilligungen ?? []) {
      if (e.widerrufenAm || !nachweisVoll(e) || war.has(e.kanal)) continue;
      war.add(e.kanal);
      raus.push({ id: ereignisKennung('kartei', 'einwilligung', p.id, e.kanal, (e.zeitpunkt ?? e.erteiltAm).slice(0, 19)), art: 'einwilligung-erteilt', quelle: 'kartei', stufe: e.kanal, bereich: 'business', bezug: { kontaktId: p.id, ...(p.firmaId ? { firmaId: p.firmaId } : {}) } });
    }
  }
  return raus;
}

// ── Aufrufe aus den Schreibwegen (wirft nie) ────────────────────────────────────────────────────────────────────────────

/** E2 (+ E12): eine Netzwerken-Erfassung ist abgeschlossen — Kennung = die Erfassung; eine NEU angelegte Person ist auch ein neuer Lead. */
export async function netzwerkenEreignisse(a: { erfassungId: string; kontaktId: string; firmaId?: string; eventId?: string; person?: string; neuAngelegt?: boolean; eingeschraenkt?: boolean }): Promise<number> {
  if (a.eingeschraenkt || !k(a.erfassungId) || !k(a.kontaktId)) return 0;
  const bezug = { kontaktId: a.kontaktId, ...(k(a.firmaId) ? { firmaId: a.firmaId } : {}), ...(k(a.eventId) ? { eventId: a.eventId } : {}) };
  const l: EreignisEingabe[] = [{ id: ereignisKennung('netzwerken', a.erfassungId), art: 'netzwerken-erfasst', quelle: 'netzwerken', bereich: 'business', bezug, ...(a.person ? { person: a.person } : {}) }];
  if (a.neuAngelegt) l.push({ id: ereignisKennung('netzwerken', a.erfassungId, 'lead'), art: 'neuer-lead', quelle: 'netzwerken', bereich: 'business', bezug });
  return ablegen(l);
}

/** E3: Angebot gestellt bzw. Antwort (angenommen · abgelehnt) — Bereich aus der Gesellschaft des Angebots. */
export async function angebotEreignis(art: 'gestellt' | 'antwort', a: { angebotId: string; dealId?: string; kontaktId?: string; firmaId?: string; gesellschaft?: string; antwort?: string }): Promise<number> {
  if (!k(a.angebotId)) return 0;
  const bereich = bereichVonGesellschaft(a.gesellschaft ?? 'offen');
  if (bereich === 'privat') return 0;
  const bezug = { angebotId: a.angebotId, ...(k(a.dealId) ? { dealId: a.dealId } : {}), ...(k(a.kontaktId) ? { kontaktId: a.kontaktId } : {}), ...(k(a.firmaId) ? { firmaId: a.firmaId } : {}) };
  const antwort = art === 'antwort' && (a.antwort === 'angenommen' || a.antwort === 'abgelehnt') ? a.antwort : undefined;
  if (art === 'antwort' && !antwort) return 0;
  return ablegen([{ id: ereignisKennung('crm', 'angebot', a.angebotId, art === 'gestellt' ? 'gestellt' : antwort!), art: art === 'gestellt' ? 'angebot-gestellt' : 'angebot-antwort', quelle: 'crm', bereich: 'business', bezug, ...(antwort ? { stufe: antwort } : {}) }]);
}

/** E5 (+ E12): Buchung angefragt (der Gast hat bestätigt) bzw. bestätigt (Freigabe abgeschlossen) — für die Person der Buchungsseite. */
export async function buchungEreignis(art: 'angefragt' | 'bestaetigt', a: { buchungId: string; person?: string; kontaktId?: string; firmaId?: string; neuePerson?: boolean; terminUid?: string }): Promise<number> {
  if (!k(a.buchungId)) return 0;
  const bezug = { terminBuchungId: a.buchungId, ...(k(a.kontaktId) ? { kontaktId: a.kontaktId } : {}), ...(k(a.firmaId) ? { firmaId: a.firmaId } : {}), ...(a.terminUid ? { terminUid: a.terminUid } : {}) };
  const l: EreignisEingabe[] = [{ id: ereignisKennung('buchung', a.buchungId, art), art: art === 'angefragt' ? 'buchung-angefragt' : 'buchung-bestaetigt', quelle: 'buchung', bereich: 'business', bezug, ...(a.person ? { person: a.person } : {}) }];
  if (art === 'bestaetigt' && a.neuePerson && k(a.kontaktId)) l.push({ id: ereignisKennung('buchung', a.buchungId, 'lead'), art: 'neuer-lead', quelle: 'buchung', bereich: 'business', bezug: { kontaktId: a.kontaktId!, ...(k(a.firmaId) ? { firmaId: a.firmaId } : {}) } });
  return ablegen(l);
}

/** E10: Vernetzen-Runde — „vernetzt“ bzw. „Antwort“ (ja · gespraech · kein_interesse) einer Person; nur für die Person des Profils. */
export async function netzwerkEreignis(art: 'vernetzt' | 'antwort', a: { kontaktId: string; firmaId?: string; person: string; tag: string; antwort?: string; kampagneId?: string; eingeschraenkt?: boolean }): Promise<number> {
  if (a.eingeschraenkt || !k(a.kontaktId)) return 0;
  const antwort = art === 'antwort' && ['ja', 'gespraech', 'kein_interesse'].includes(a.antwort ?? '') ? a.antwort : undefined;
  if (art === 'antwort' && !antwort) return 0;
  const bezug = { kontaktId: a.kontaktId, ...(k(a.firmaId) ? { firmaId: a.firmaId } : {}), ...(k(a.kampagneId) ? { kampagneId: a.kampagneId } : {}) };
  return ablegen([{ id: ereignisKennung('kartei', 'netzwerk', a.kontaktId, a.person, art, a.tag), art: art === 'vernetzt' ? 'vernetzt' : 'linkedin-antwort', quelle: 'kartei', bereich: 'business', bezug, person: a.person, ...(antwort ? { stufe: antwort } : {}) }]);
}

/** E6 aus dem Kartei-Schreibweg (lib/ereignisse/quellen.ts `karteiEreignisse` ruft es mit). */
export async function einwilligungEreignisse(vorher: readonly Kontakt[], nachher: readonly Kontakt[]): Promise<number> {
  return ablegen(einwilligungDiff(vorher, nachher));
}
