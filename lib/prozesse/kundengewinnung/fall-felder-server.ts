// ─── Prozesse · Kundengewinnung — die übrigen Fall-Felder der Rauten (22.10. spät, Bausteine mit eigenem Weg; Server) ──────────────────────────────────────
// Die 18 Vorlagen nennen in ihren Rauten Felder des Falls (lib/prozesse/kundengewinnung/felder.ts `KG_FALL_FELDER`). Einige gab der Motor bisher nicht — die
// Raute fiel dann still auf den Vorgabe-Ast (eine fehlende Angabe ist für „gleich“ nie wahr). Hier werden sie gerechnet — NUR aus vorhandenen Lesern (CRM-Bestand,
// Kartei, Leads, Inbox-Spiegel und -Zustand der Person, Ereignisstelle, Läufe), nie gespeichert, nie eine Anfrage an einen Fremddienst, nur Kennungen, Zahlen,
// ja/nein und feste Wörter. Teure Felder (Inbox, Ereignisse, Läufe, Fulfillment) nur, wenn die Definition sie nennt (`brauche`).
//   lead.geantwortet           eine Antwort (Aktivität „antwort“) einer Person des Falls seit dem Start des Laufs (Feinschliff 24.10.)
//   lead.neue-signale          eingehende Aktivität, Zusage zu einem Event, Kampagnen-Reaktion, neuer Deal bzw. gestiegene Temperatur seit dem Start (bzw. seit dem
//                              Parken eines ruhenden Leads); dazu Ereignisse zur Person (lib/ereignisse/server.ts `ereignisseSeit`)
//   lead.waerme-gestiegen      Temperatur jetzt gegen die Temperatur mit dem Verlauf vor dem Start (lib/crm/score.ts `leadScore`)
//   lead.mail-fach             Fach des Gesprächs (lib/inbox/strom-server.ts `stromRoh` → lib/inbox/faecher.ts) — nur Business-Postfächer der Person des Laufs
//   lead.gespraech-zugeordnet  „Zuordnen“ bestätigt (Inbox-Zustand der Person, lib/inbox/zustand.ts)
//   lead.anfrage-kanal         Kanal der jüngsten Anfrage-Aktivität (lib/crm/anfragen.ts `ANFRAGE_KANAELE`), sonst „keiner“
//   lead.buchung-folge         lib/kalender/buchung-ablauf.ts `folgeVorschlag` — deal · qualifizierung · keine
//   lead.nachweis-vollstaendig Newsletter-Einwilligung mit vollem Nachweis (lib/crm/einwilligung.ts)
//   lead.einladungsweg / lead.danke-moeglich / lead.kampagnen-ergebnis   Vorgaben, wenn der Bezug (Event bzw. Kampagne) da ist, aber noch kein Eintrag
//   deal.vertrag-unterschrieben  ohne Mandat: nein
//   mandat.verlaengert         auto ohne Ende des Mandats bzw. ein angenommenes Angebot am Mandat seit dem Vorlauf
//   mandat.ampel-mail          Mail-Ampel des Ansprechpartners (lib/crm/recht.ts)
//   mandat.tage-seit-empfehlung  Tage seit der letzten Empfehlungsfrage (frühere Läufe dieses Prozesses, Nachsorge „Empfehlung“ im Fulfillment); nie gefragt → leer
//   event.mix-erreicht         Mischung grün (lib/crm/eventplanung.ts `mix`)
//   event.quote-48h            eigene Abende: Anteil rechtzeitig nachgefasster Gäste (dieselbe Regel wie lib/crm/traktion.ts `nachfassen_48h`); nichts zu messen → leer
// Dazu Platzhalter für Text-Gerüste (lead.offene-fragen, event.titel, kampagne.titel) — sie gehen nur in Vorschläge, nie in den Lauf.

import type { CrmBestand, Firma } from '@/lib/crm/typen';
import type { Kontakt, Aktivitaet } from '@/lib/make-one/crm';
import type { LeadZeile } from '@/lib/crm/leads';
import type { FallArt } from '../definition';
import type { LaeufeDatei } from '../lauf-typen';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';

type Felder = Record<string, unknown>;

export interface KgFallEingabe {
  art: FallArt;
  fallId?: string;
  crm: CrmBestand;
  /** Die Kartei MIT eingeschränkten Personen (nur zum Erkennen — verarbeitet wird hier niemand außer dem Fall). */
  kontakte: readonly Kontakt[];
  kontakt: Kontakt | null;
  /** Alle Personen, deren Verlauf zum Fall gehört (Lead einer Firma: ihre aktiven Personen). */
  personen: readonly Kontakt[];
  lead?: LeadZeile;
  /** Daten des Laufs (`bezug.*` aus dem Ereignis bzw. der Schleife) — nur Kennungen. */
  daten: Readonly<Record<string, string>>;
  lauf?: { id: string; prozessId: string; start: string; person: string | null };
  /** Felder, die die Definition nennt (lib/prozesse/kundengewinnung/raute-felder.ts) — teure nur dann; ohne Angabe nur die günstigen. */
  brauche?: ReadonlySet<string> | null;
  h?: string;
  jetzt: Date;
  hat: { hatMandat: boolean; hatChance: boolean };
}
export interface KgFallFelder { daten: Felder; platzhalter: Felder }

const TEMP_RANG: Readonly<Record<string, number>> = { kalt: 0, lau: 1, warm: 2, heiss: 3 };
const SIGNAL_ARTEN = new Set<Aktivitaet['art']>(['antwort', 'termin', 'gespraech', 'event']);
const KAMPAGNE_SIGNAL = new Set(['reagiert', 'gespraech', 'chance']);
/** Ab `seit` (ISO bzw. Tag) — ein reiner Tag zählt ab dem Tag. */
const ab = (x: string | undefined, seit: string): boolean => !!x && (x.length <= 10 ? x >= seit.slice(0, 10) : x >= seit);

/** Gab es ein Signal der Personen seit `seit`? (rein) — eingehende Aktivitäten, Gespräch am Telefon, Zusage, Kampagnen-Reaktion, neuer Deal. */
export function signaleSeit(personen: readonly Kontakt[], crm: Pick<CrmBestand, 'teilnahmen' | 'kampagnen' | 'chancen'>, seit: string): boolean {
  const ids = new Set(personen.map(k => k.id));
  if (personen.some(k => (k.aktivitaeten ?? []).some(a => ab(a.am, seit) && (SIGNAL_ARTEN.has(a.art) || (a.art === 'anruf' && (a.ergebnis === 'gespraech' || a.ergebnis === 'termin')))))) return true;
  if (crm.teilnahmen.some(t => ids.has(t.kontaktId) && (t.status === 'zugesagt' || t.status === 'da') && ab(t.geaendert, seit))) return true;
  if ((crm.kampagnen ?? []).some(c => (c.ergebnisse ?? []).some(r => ids.has(r.kontaktId) && KAMPAGNE_SIGNAL.has(r.ergebnis) && ab(r.am, seit)))) return true;
  return crm.chancen.some(c => c.kontaktIds.some(id => ids.has(id)) && ab(c.angelegt, seit));
}

/** Hat eine Person des Falls seit `seit` geantwortet? (rein) — nur die Aktivität „antwort“ (eingehende Mail, WhatsApp, LinkedIn), nur Kennungen gelesen. */
export function geantwortetSeit(personen: readonly Kontakt[], seit: string): boolean {
  return personen.some(k => (k.aktivitaeten ?? []).some(a => a.art === 'antwort' && ab(a.am, seit)));
}

/** Der Kanal der jüngsten Anfrage der Personen (rein) — „keiner“ ohne Anfrage. */
export async function anfrageKanal(personen: readonly Kontakt[]): Promise<string> {
  const [{ istAnfrage, ANFRAGE_PRAEFIX }, { ANFRAGE_KANAELE }] = await Promise.all([import('@/lib/crm/marketing'), import('@/lib/crm/anfragen')]);
  const a = personen.flatMap(k => (k.aktivitaeten ?? []).filter(istAnfrage)).sort((x, y) => (x.am < y.am ? 1 : -1))[0];
  if (!a) return 'keiner';
  const label = (a.text ?? '').slice(ANFRAGE_PRAEFIX.length).split(':')[0].trim();
  return ANFRAGE_KANAELE.find(k => k.label === label)?.id ?? 'keiner';
}

/** Temperatur mit dem Verlauf bis `bis` (exklusiv) bzw. mit allem (rein über leadScore). */
async function temperatur(personen: readonly Kontakt[], lead: Kontakt['lead'], crm: CrmBestand, heute: string, bis?: string): Promise<number> {
  const { leadScore, scoringKontext } = await import('@/lib/crm/score');
  const p = bis ? personen.map(k => ({ ...k, aktivitaeten: (k.aktivitaeten ?? []).filter(a => a.am < bis) })) : [...personen];
  return TEMP_RANG[leadScore(p, lead, heute, undefined, scoringKontext(crm)).temperatur] ?? 0;
}

/** Felder einer Person bzw. eines Leads (Fall „Lead“ bzw. „Firma“). */
async function leadFelder(x: KgFallEingabe, firma: Firma | undefined): Promise<KgFallFelder> {
  const d: Felder = {}, p: Felder = {};
  const heute = localDay(x.jetzt);
  const k = x.kontakt;
  const leadObj = firma?.lead ?? k?.lead;
  const braucht = (f: string) => !x.brauche || x.brauche.has(f);
  const personen = x.personen.length ? x.personen : k ? [k] : [];
  d['lead.anfrage-kanal'] = await anfrageKanal(personen);
  // Folge einer Buchung (dieselbe Regel wie die Buchungsfreigabe): Deal, Qualifizierung oder keine.
  const { folgeVorschlag } = await import('@/lib/kalender/buchung-ablauf');
  const firmaDesKontakts = k?.firmaId ? x.crm.firmen.find(f => f.id === k.firmaId) : undefined;
  d['lead.buchung-folge'] = (k ? folgeVorschlag(k, firmaDesKontakts?.lead, x.crm.chancen)?.art : null) ?? 'keine';
  // Newsletter: nur eine nicht widerrufene Einwilligung mit vollem Nachweis (Zeitpunkt, wer, Wortlaut, Beleg).
  const { nachweisVollstaendig } = await import('@/lib/crm/einwilligung');
  d['lead.nachweis-vollstaendig'] = !!k && (k.einwilligungen ?? []).some(e => e.kanal === 'newsletter' && !e.widerrufenAm && nachweisVollstaendig(e));
  // Seit wann „neu“: der Start des Laufs — bei einem ruhenden Lead das Parken (die letzte Änderung am Lead), wenn es früher war.
  const start = x.lauf?.start ?? new Date(x.jetzt.getTime() - 30 * 86_400_000).toISOString();
  const geparkt = leadObj?.status === 'ruht' && leadObj.geaendert ? leadObj.geaendert : undefined;
  const seit = geparkt && geparkt < start ? geparkt : start;
  // Feinschliff 24.10.: „hat geantwortet“ — nur die Antwort selbst (Aktivität „antwort“: eingehende Mail, WhatsApp, LinkedIn), seit dem Start des Laufs.
  if (braucht('lead.geantwortet')) d['lead.geantwortet'] = geantwortetSeit(personen, start);
  if (braucht('lead.neue-signale') || braucht('lead.waerme-gestiegen')) {
    const jetzt = await temperatur(personen, leadObj, x.crm, heute);
    if (braucht('lead.waerme-gestiegen')) d['lead.waerme-gestiegen'] = jetzt > await temperatur(personen, leadObj, x.crm, heute, x.lauf?.start ?? start);
    if (braucht('lead.neue-signale')) {
      let neu = signaleSeit(personen, x.crm, seit) || jetzt > await temperatur(personen, leadObj, x.crm, heute, seit);
      if (!neu && x.brauche?.has('lead.neue-signale') && x.lauf?.person) {
        const { ereignisseSeit } = await import('@/lib/ereignisse/server');
        const ids = new Set(personen.map(y => y.id));
        const SIGNAL = new Set(['neue-mail', 'neue-whatsapp', 'linkedin-antwort', 'buchung-angefragt', 'netzwerken-erfasst', 'angebot-antwort', 'kampagnen-ergebnis']);
        neu = (await ereignisseSeit(x.lauf.person, seit, x.jetzt)).some(e => SIGNAL.has(e.art) && ((!!e.bezug.kontaktId && ids.has(e.bezug.kontaktId)) || (!!firma && e.bezug.firmaId === firma.id)));
      }
      d['lead.neue-signale'] = neu;
    }
  }
  // Inbox (nur, wenn die Definition danach fragt): Fach und „zugeordnet“ des Gesprächs aus dem Ereignis — nur Spiegel und Zustand der Person des Laufs.
  const g = x.daten['bezug.gespraech'];
  if (x.lauf?.person && (x.brauche?.has('lead.gespraech-zugeordnet') || x.brauche?.has('lead.mail-fach'))) {
    if (g && x.brauche?.has('lead.gespraech-zugeordnet')) {
      const { ladeInboxZustand } = await import('@/lib/inbox/zustand');
      const z = await ladeInboxZustand(x.lauf.person).catch(() => null);
      if (z) d['lead.gespraech-zugeordnet'] = !!z.gespraeche[g]?.zuordnung;
    }
    if (x.brauche?.has('lead.mail-fach')) {
      const { stromRoh } = await import('@/lib/inbox/strom-server');
      const r = await stromRoh(x.lauf.person, heute).catch(() => null);
      const { alleAdressen } = await import('@/lib/crm/emails');
      const adressen = new Set(k ? alleAdressen(k).map(a => a.toLowerCase()) : []);
      const gs = r?.gespraeche.find(y => y.id === g)
        ?? r?.gespraeche.filter(y => !y.vonUns && ((!!k && y.zuordnung?.kontaktId === k.id) || adressen.has((y.gegenueber?.email ?? '').toLowerCase()))).sort((a, b) => (a.am < b.am ? 1 : -1))[0];
      if (gs) { d['lead.mail-fach'] = gs.fach; if (!('lead.gespraech-zugeordnet' in d)) d['lead.gespraech-zugeordnet'] = !!gs.zugeordnet; }
    }
  }
  // Bezug Event bzw. Kampagne (aus der Schleife): Vorgaben, solange es noch keinen Eintrag gibt — der Eintrag selbst setzt der Motor darüber (lauf-server.ts).
  const eventId = x.daten['bezug.eventid'];
  if (eventId && k) {
    const { kanalStatus } = await import('@/lib/crm/recht');
    const { einladungswegAus } = await import('@/lib/crm/eventplanung');
    d['lead.einladungsweg'] = einladungswegAus(kanalStatus(k, 'einladung', x.hat).farbe);
    d['lead.danke-moeglich'] = false;
    const e = x.crm.events.find(y => y.id === eventId);
    if (e) { p['event.titel'] = e.titel; p['event.datum'] = e.datum; }
  }
  const kampagneId = x.daten['bezug.kampagneid'];
  if (kampagneId) {
    d['lead.kampagnen-ergebnis'] = 'offen';
    const c = (x.crm.kampagnen ?? []).find(y => y.id === kampagneId);
    if (c) p['kampagne.titel'] = c.name;
  }
  if (x.lead) {
    const { fehltBisSqlZeile } = await import('@/lib/crm/leads');
    const fehlt = fehltBisSqlZeile(x.lead);
    if (fehlt.length) p['lead.offene-fragen'] = fehlt.slice(0, 6).join(' · ');
  }
  return { daten: d, platzhalter: p };
}

/** Tage seit der letzten Empfehlungsfrage zu einem Mandat — frühere Läufe dieses Prozesses (mit Aufgabe) und die Nachsorge „Empfehlung“ des Fulfillments. */
async function tageSeitEmpfehlung(x: KgFallEingabe, mandatId: string): Promise<number | undefined> {
  const daten: string[] = [];
  if (x.lauf && x.h) {
    const { laeufeLesen } = await import('../lauf-server');
    const d: LaeufeDatei | null = await laeufeLesen(x.h).catch(() => null);
    for (const l of d?.laeufe ?? []) if (l.id !== x.lauf.id && l.prozessId === x.lauf.prozessId && l.fall.id === mandatId && l.schritte.some(s => s.wirkung?.some(w => w.art === 'aufgabe'))) daten.push(l.start.slice(0, 10));
  }
  try {
    const [{ fulfillmentLesen }, { markeNachsorge }] = await Promise.all([import('@/lib/fulfillment/speicher'), import('@/lib/fulfillment/prozesse/wirkung')]);
    const [faelle, vorlagen] = await Promise.all([fulfillmentLesen('faelle', x.h), fulfillmentLesen('vorlagen', x.h)]);
    const tage = [...(vorlagen.einstellungen.nachsorgeTage ?? [])].sort((a, b) => a - b);
    // Dieselbe Zuordnung wie lib/fulfillment/prozesse/wirkung.ts `nachsorgeFaellig`: erste Stufe Check-in, letzte nächste Stufe, dazwischen Empfehlung.
    const empfehlung = tage.filter((_, i) => i !== 0 && i !== tage.length - 1);
    const marken = faelle.faelle[mandatId]?.marken ?? {};
    for (const t of empfehlung) { const v = marken[markeNachsorge(mandatId, t)]; if (typeof v === 'string' && v) daten.push(v.slice(0, 10)); }
  } catch { /* ohne Fulfillment zählen nur die Läufe */ }
  const letzte = daten.sort().at(-1);
  if (!letzte) return undefined;
  return Math.max(0, Math.round((Date.parse(localDay(x.jetzt)) - Date.parse(letzte)) / 86_400_000));
}

/** Die übrigen Fall-Felder der Vorlagen (Kundengewinnung) für einen Fall — günstige immer, teure nur bei Bedarf. Wirft nie (Fehler → das Feld fehlt). */
export async function kgFallFelder(x: KgFallEingabe): Promise<KgFallFelder> {
  try {
    const heute = localDay(x.jetzt);
    switch (x.art) {
      case 'lead': case 'firma': {
        const firma = x.fallId?.startsWith('f-') ? x.crm.firmen.find(f => f.id === x.fallId) : undefined;
        return await leadFelder(x, firma);
      }
      case 'deal': {
        const m = x.crm.mandate.find(y => y.chanceId === x.fallId && !y.geloeschtAm);
        return { daten: m ? {} : { 'deal.vertrag-unterschrieben': false }, platzhalter: {} };
      }
      case 'mandat': {
        const m = x.crm.mandate.find(y => y.id === x.fallId && !y.geloeschtAm);
        if (!m) return { daten: {}, platzhalter: {} };
        const { kanalStatus } = await import('@/lib/crm/recht');
        const d: Felder = { 'mandat.ampel-mail': x.kontakt && !x.kontakt.werbesperre && !x.kontakt.eingeschraenkt ? kanalStatus(x.kontakt, 'mail', x.hat).farbe : 'rot' };
        // Verlängerung gesichert: verlängert sich von selbst (ohne festes Ende) bzw. ein angenommenes Angebot am Mandat seit dem Vorlauf (180 Tage vor dem Ende).
        const ab = m.ende ? tagPlus(m.ende.slice(0, 10), -180) : (x.lauf?.start ?? '').slice(0, 10);
        const angebot = (x.crm.angebote ?? []).some(a => a.mandatId === m.id && a.status === 'angenommen' && !!a.angenommenAm && a.angenommenAm.slice(0, 10) >= ab);
        d['mandat.verlaengert'] = m.status === 'aktiv' && (angebot || (m.verlaengerung === 'auto' && !m.ende));
        if (x.brauche?.has('mandat.tage-seit-empfehlung')) { const t = await tageSeitEmpfehlung(x, m.id); if (t !== undefined) d['mandat.tage-seit-empfehlung'] = t; }
        return { daten: d, platzhalter: {} };
      }
      case 'event': {
        const e = x.crm.events.find(y => y.id === x.fallId);
        if (!e) return { daten: {}, platzhalter: {} };
        const [{ mix }, { istNetzwerkenEvent }, { followUpBis }] = await Promise.all([import('@/lib/crm/eventplanung'), import('@/lib/crm/marke'), import('@/lib/crm/events')]);
        const d: Felder = { 'event.mix-erreicht': mix(e, x.crm.teilnahmen, [...x.kontakte], x.crm.firmen).ampel === 'gruen' };
        if (!istNetzwerkenEvent(e)) {
          // Eigene Abende: dieselbe Regel wie die Kennzahl „Nachgefasst binnen 48 h“ (Gäste „da“, deren Frist abgelaufen ist oder die schon nachgefasst sind).
          const bis = followUpBis(e, x.crm.wertelisten);
          const gaeste = x.crm.teilnahmen.filter(t => t.eventId === e.id && t.status === 'da' && (t.followUpAm || bis < heute));
          if (gaeste.length) d['event.quote-48h'] = Math.round((gaeste.filter(t => t.followUpAm && t.followUpAm.slice(0, 10) <= bis).length / gaeste.length) * 100);
        }
        return { daten: d, platzhalter: {} };
      }
    }
  } catch (e) {
    console.warn(`[prozesse/fall-felder] ${e instanceof Error ? e.message.slice(0, 160) : 'Fehler'}`);
  }
  return { daten: {}, platzhalter: {} };
}
