// ─── Ereignisse — die Quellen (09.10., E1 „Ereignisstelle“; nur Server) ───────────────────────────────────────────────────────
// Je Quelle EIN kleiner Aufruf NACH dem Speichern (die Quelle bleibt, wie sie ist; ein Fehler hier stört sie nie — alles wirft nie):
//   postEreignisse          Gmail-/IMAP-Abgleich: neue EINGEHENDE Nachrichten (keine Rundschreiben, keine automatischen) — person = Postfach
//   whatsappEreignisse      WhatsApp-Webhook: neue eingehende Nachrichten der Business-Nummer
//   auszugEreignisse        Kontoauszug übernommen: Eingänge (Betrag > 0) der letzten `AUSZUG_TAGE` Tage
//   rechnungBezahltEreignis Rechnung „bezahlt“ (Finanzplan)
//   crmEreignisse           CRM-Schreibweg: Deal neu/andere Stufe, Firmen-Lead wird SQL (Diff vorher → nachher)
//   karteiEreignisse        Kartei-Schreibweg: Personen-Lead wird SQL
//   anfrageEreignis         neue Anfrage (Lead)
//   zoeGegebenEreignis      „An ZOE geben“ — und sofort anstoßen (dieselben Sperren wie der Takt)
//   terminAbsagenEreignisse iCloud-Abgleich: Termin mit CRM-Bezug vom Gegenüber abgesagt (Status alt → neu je UID)
// Personen mit Art.-18-Einschränkung lösen nie etwas aus (kein Ereignis); im Bezug stehen nur Kennungen.

import { bereichVon, bereichVonFirma, bereichVonGesellschaft, privatArbeitsEinheit } from '@/lib/einheiten';
import { tagePlus } from '@/lib/zeit';
import { ereignis } from './server';
import { ereignisKennung, type EreignisBereich, type EreignisEingabe } from './typen';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';

/** Bereich eines Postfachs (Register: `privat` | Gesellschaft | `g-…` | null) bzw. einer WhatsApp-Nummer. */
export const bereichAusPostfach = (b: string | null | undefined): EreignisBereich | null => (!b ? null : bereichVon(b));

// ── Post (Gmail, IMAP) ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface NeueNachricht {
  /** Kennung der Nachricht in der Quelle (Gmail-ID bzw. IMAP-Kennung `<pf>:e:<UIDVALIDITY>:<UID>`). */
  id: string;
  /** Absenderadresse (klein) — nur zum Zuordnen, nie gespeichert. */
  von: string;
  /** Gespräch (`gm~<thread>`) — wenn bekannt. */
  gespraech?: string;
}

/** Adresse → Kontakt (alle Adressen, keine Sammeladressen) — mit eingeschränkten, damit sie erkannt (und ausgelassen) werden. */
async function adressenIndex(): Promise<Map<string, Kontakt>> {
  const [{ kontakteFuerVerarbeitung }, { adressIndex }] = await Promise.all([import('@/lib/crm/verarbeitung'), import('@/lib/gmail/zuordnung')]);
  return adressIndex(await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }));
}

async function crmLaden(): Promise<CrmBestand | null> {
  return import('@/lib/crm/speicher').then(m => m.ladeCrm()).catch(() => null);
}

/** Bezug einer Person: Kontakt, Firma, offener Deal (nur Kennungen). Eingeschränkt (Art. 18) → null = kein Ereignis. */
async function personBezug(k: Kontakt | undefined, crm: () => Promise<CrmBestand | null>): Promise<EreignisEingabe['bezug'] | null> {
  if (!k) return {};
  if (k.eingeschraenkt) return null;
  const c = await crm();
  const { OFFENE_STUFEN } = await import('@/lib/crm/pipeline');
  // 29.10. (Kreislauf W-B6): bei mehreren offenen Deals der mit der jüngsten Aktivität (sonst der zuletzt geänderte) — vorher der erste in der Liste.
  const zeit = (x: { letzteAktivitaet?: string; geaendert?: string }) => x.letzteAktivitaet ?? x.geaendert ?? '';
  const deal = c?.chancen.filter(x => OFFENE_STUFEN.includes(x.stufe) && x.kontaktIds.includes(k.id)).sort((a, b) => (zeit(a) < zeit(b) ? 1 : zeit(a) > zeit(b) ? -1 : 0))[0];
  return { kontaktId: k.id, ...(k.firmaId ? { firmaId: k.firmaId } : {}), ...(deal ? { dealId: deal.id } : {}) };
}

/** Gmail/IMAP: neue eingehende Nachrichten einer Person. Wirft nie. */
export async function postEreignisse(person: string, quelle: 'gmail' | 'imap', bereich: string | null | undefined, neu: readonly NeueNachricht[]): Promise<number> {
  try {
    if (!neu.length) return 0;
    const adresse = await adressenIndex();
    let crm: CrmBestand | null | undefined;
    const crmEinmal = async () => (crm === undefined ? (crm = await crmLaden()) : crm);
    const liste: EreignisEingabe[] = [];
    for (const n of neu) {
      const bezug = await personBezug(adresse.get(n.von.trim().toLowerCase()), crmEinmal);
      if (bezug === null) continue;
      liste.push({ id: ereignisKennung(quelle, n.id), art: 'neue-mail', quelle, bezug: { ...bezug, ...(n.gespraech ? { gespraech: n.gespraech } : {}) }, bereich: bereichAusPostfach(bereich), person });
    }
    return (await ereignis(liste)).neu;
  } catch (e) { console.warn(`[ereignisse] Post: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`); return 0; }
}

/** Eingehend und von einem Menschen (rein): im Posteingang, nicht gesendet, kein Rundschreiben, nicht automatisch, nicht von uns. */
export function eingehend(k: { labels: string[]; liste?: boolean; automatisch?: boolean; von: { email: string } }, eigene: ReadonlySet<string>): boolean {
  return k.labels.includes('INBOX') && !k.labels.includes('SENT') && !k.liste && !k.automatisch && !!k.von.email && !eigene.has(k.von.email.toLowerCase());
}

/** Gmail-Abgleich (nur der laufende Abgleich — nie beim vollen Neu-Lesen, sonst wäre jede Mail der letzten 30 Tage „neu“). Wirft nie. */
export async function gmailEreignisse(person: string, koepfe: readonly { id: string; threadId: string; labels: string[]; liste?: boolean; von: { email: string } }[], stand: { email?: string; aliase?: { email: string }[] }): Promise<number> {
  try {
    const eigene = new Set([stand.email ?? '', ...(stand.aliase ?? []).map(a => a.email)].map(a => a.toLowerCase()).filter(Boolean));
    const ein = koepfe.filter(k => eingehend(k, eigene));
    if (!ein.length) return 0;
    const { ladePostfach } = await import('@/lib/postfach/register');
    const bereich = (await ladePostfach(person, 'gmail').catch(() => null))?.bereich ?? null;
    return postEreignisse(person, 'gmail', bereich, ein.map(k => ({ id: k.id, von: k.von.email, gespraech: `gm~${k.threadId}` })));
  } catch { return 0; }
}

/** IMAP-Abgleich: neue Nachrichten im Posteingang eines Postfachs (nur nach dem ersten Lesen des Ordners). Wirft nie. */
export async function imapEreignisse(person: string, postfach: { id?: string; adresse: string; bereich: string | null }, koepfe: readonly { id: string; labels: string[]; liste?: boolean; automatisch?: boolean; von: { email: string } }[]): Promise<number> {
  try {
    const ein = koepfe.filter(k => eingehend(k, new Set([postfach.adresse.toLowerCase()])));
    if (!ein.length) return 0;
    // E13 (22.10., Kundengewinnung — Vorlage V03 findet sein Gespräch): das Gespräch `im~<postfach>~<Faden>` aus demselben Bündeln wie die Inbox
    // (lib/inbox/strom.ts `imapFaeden` über die Köpfe des Postfachs im Spiegel) — nur die Kennung, nie Betreff oder Adresse. Fehlt etwas: ohne Gespräch.
    const faeden = await imapGespraeche(person, postfach.id).catch(() => null);
    return postEreignisse(person, 'imap', postfach.bereich, ein.map(k => {
      const f = faeden?.get(k.id);
      return { id: k.id, von: k.von.email, ...(f && postfach.id ? { gespraech: `im~${postfach.id}~${f}` } : {}) };
    }));
  } catch { return 0; }
}

/** Faden je Kopf-Kennung eines IMAP-Postfachs (Server) — dieselbe Rechnung wie die Inbox. null ohne Postfach-Kennung. */
async function imapGespraeche(person: string, postfachId: string | undefined): Promise<Map<string, string> | null> {
  if (!postfachId) return null;
  const [{ ladeImapStand }, { imapFaeden }, { kurzHash }] = await Promise.all([import('@/lib/postfach/spiegel'), import('@/lib/inbox/strom'), import('@/lib/postfach/rfc822')]);
  const s = await ladeImapStand(person);
  return imapFaeden(Object.values(s.koepfe).filter(k => k.postfachId === postfachId), kurzHash);
}

// ── WhatsApp ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** WhatsApp: neue eingehende Nachrichten (WAMID + Nummer, die Nummer nur zum Zuordnen). Wirft nie. */
export async function whatsappEreignisse(eingang: readonly { id: string; nummer: string }[], k: { bereich: string; personen: string[] | null }): Promise<number> {
  try {
    if (!eingang.length) return 0;
    const [{ kontakteFuerVerarbeitung }, { telefonIndex }] = await Promise.all([import('@/lib/crm/verarbeitung'), import('@/lib/whatsapp/zuordnung')]);
    const index = telefonIndex(await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }));
    let crm: CrmBestand | null | undefined;
    const crmEinmal = async () => (crm === undefined ? (crm = await crmLaden()) : crm);
    const liste: EreignisEingabe[] = [];
    for (const n of eingang) {
      const bezug = await personBezug(index.get(n.nummer), crmEinmal);
      if (bezug === null) continue;
      // Das Gespräch trägt die Nummer im Schlüssel — es steht NICHT im Ereignis (nur Kennungen); die WAMID reicht zum Finden.
      liste.push({ id: ereignisKennung('wa', n.id), art: 'neue-whatsapp', quelle: 'whatsapp', bezug, bereich: bereichAusPostfach(k.bereich), ...(k.personen?.length ? { personen: k.personen } : {}) });
    }
    return (await ereignis(liste)).neu;
  } catch (e) { console.warn(`[ereignisse] WhatsApp: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`); return 0; }
}

// ── Geld ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein übernommener Kontoauszug zählt nur mit frischen Eingängen — ein nachgeholter Monat löst keine Flut alter „Zahlungseingänge“ aus. */
export const AUSZUG_TAGE = 14;

/** Eingänge eines übernommenen Kontoauszugs (rein): Betrag > 0, nicht älter als `AUSZUG_TAGE` Tage, nur neu angelegte Zeilen. */
export function auszugEingaenge(zeilen: readonly { id: string; datum: string; betrag: number }[], angelegt: ReadonlySet<string>, heute: string): string[] {
  const ab = tagePlus(heute, -AUSZUG_TAGE);
  return zeilen.filter(z => angelegt.has(z.id) && z.betrag > 0 && z.datum >= ab).map(z => z.id);
}

/** Kontoauszug: Zahlungseingänge (Business: Gesellschaft des Kontos; Haushalt: privat — nur mit privatem Finanzzugang sichtbar). Wirft nie. */
export async function auszugEreignisse(ziel: { art: string; ort?: string }, kontoId: string, buchungIds: readonly string[]): Promise<number> {
  try {
    if (!buchungIds.length || (ziel.art !== 'business' && ziel.art !== 'haushalt')) return 0;
    const bereich: EreignisBereich = ziel.art === 'haushalt' ? 'privat' : bereichVonFirma(ziel.ort);
    return (await ereignis(buchungIds.map(id => ({ id: ereignisKennung('bank', id), art: 'zahlungseingang' as const, quelle: 'kontoauszug' as const, bezug: { buchungId: id, kontoId }, bereich })))).neu;
  } catch { return 0; }
}

/** Rechnung bezahlt (Finanzplan): Gesellschaft der Rechnung bestimmt den Bereich, Mandat/CRM-Firma als Bezug. Wirft nie. */
export async function rechnungBezahltEreignis(r: { id: string; firmaId?: string; mandatId?: string }): Promise<number> {
  try {
    let firma: string | undefined;
    if (r.mandatId) firma = (await crmLaden())?.mandate.find(m => m.id === r.mandatId)?.firmaId;
    return (await ereignis({ id: ereignisKennung('rechnung', r.id, 'bezahlt'), art: 'zahlungseingang', quelle: 'finanzplan', bezug: { rechnungId: r.id, ...(r.mandatId ? { mandatId: r.mandatId } : {}), ...(firma ? { firmaId: firma } : {}) }, bereich: bereichVonFirma(r.firmaId) })).neu;
  } catch { return 0; }
}

// ── Bereich eines Mandats-Ereignisses (25.10.) ──────────────────────────────────────────────────────────────────────────────

/**
 * Bereich (und Arbeits-Marke) eines Ereignisses an einem Mandat bzw. Fall: Business wie bisher (`bereichVonGesellschaft`); ein Mandat der Privat-Arbeits-Einheit
 * (Selbstständigkeit — Arbeit, kein privater Lebensbereich) bleibt `privat`, trägt aber `arbeit: true` — produkt-gebundene Prozesse und Begleit-Prozesse am Fall
 * dürfen darauf hören, sonst nichts. EINE Stelle für alle Mandats- und Fall-Ereignisse; nie für Gesundheit, Familie, Finanzen.
 */
export function mandatEreignisBereich(g: string | null | undefined): { bereich: EreignisBereich; arbeit?: true } {
  const b = bereichVonGesellschaft(g);
  return b === 'privat' && privatArbeitsEinheit(g ?? undefined) ? { bereich: b, arbeit: true } : { bereich: b };
}

// ── CRM und Kartei ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Was sich im CRM geändert hat (rein): Deal neu bzw. in einer anderen Stufe, Firmen-Lead neu auf SQL — seit 21.10. (Prozesse C1, E4) auch Mandat neu
 * angelegt bzw. neu auf „beendet“ (nur, wenn beide Stände Mandate tragen; Bereich aus der Gesellschaft — die Selbstständigkeit gehört zu Privat).
 */
type CrmFuerDiff = Pick<CrmBestand, 'chancen' | 'firmen'> & Partial<Pick<CrmBestand, 'mandate'>>;
export function crmDiff(vorher: CrmFuerDiff, nachher: CrmFuerDiff): EreignisEingabe[] {
  const raus: EreignisEingabe[] = [];
  const alt = new Map(vorher.chancen.map(c => [c.id, c.stufe]));
  for (const c of nachher.chancen) {
    if (alt.get(c.id) === c.stufe) continue;
    raus.push({ id: ereignisKennung('crm', 'deal', c.id, c.stufe), art: 'deal-stufe', quelle: 'crm', stufe: c.stufe, bereich: bereichVonGesellschaft(c.gesellschaft),
      bezug: { dealId: c.id, ...(c.firmaId ? { firmaId: c.firmaId } : {}), ...(c.kontaktIds[0] ? { kontaktId: c.kontaktIds[0] } : {}) } });
  }
  const leadAlt = new Map(vorher.firmen.map(f => [f.id, f.lead?.status]));
  for (const f of nachher.firmen) {
    if (f.lead?.status !== 'sql' || leadAlt.get(f.id) === 'sql') continue;
    raus.push({ id: ereignisKennung('crm', 'lead', f.id, 'sql'), art: 'lead-sql', quelle: 'crm', bereich: 'business', bezug: { firmaId: f.id } });
  }
  if (vorher.mandate && nachher.mandate) {
    const mAlt = new Map(vorher.mandate.map(m => [m.id, m]));
    for (const m of nachher.mandate) {
      if (m.geloeschtAm) continue;
      const a = mAlt.get(m.id);
      const bezug = { mandatId: m.id, ...(m.firmaId ? { firmaId: m.firmaId } : {}), ...(m.kontaktIds?.[0] ? { kontaktId: m.kontaktIds[0] } : {}), ...(m.chanceId ? { dealId: m.chanceId } : {}) };
      if (!a) raus.push({ id: ereignisKennung('crm', 'mandat', m.id, 'angelegt'), art: 'mandat-angelegt', quelle: 'crm', ...mandatEreignisBereich(m.gesellschaft), bezug });
      else if (m.status === 'beendet' && a.status !== 'beendet') raus.push({ id: ereignisKennung('crm', 'mandat', m.id, 'beendet', (m.ende ?? '').slice(0, 10)), art: 'mandat-beendet', quelle: 'crm', ...mandatEreignisBereich(m.gesellschaft), bezug });
      // Zusatzmodul gebucht (22.10., Prozesse × Fulfillment): ein NEUER Eintrag in `zusatz` an einem bestehenden, nicht beendeten Mandat — je Modul einmal
      // (Kennung aus dem Modul `mz-…`). Beim Anlegen des Mandats nicht: dann liest der Motor die Zusatzmodule über „mandat-angelegt“ selbst.
      if (a && m.status !== 'beendet' && m.zusatz?.length) {
        const vorher = new Set((a.zusatz ?? []).map(z => z.id));
        for (const z of m.zusatz) {
          if (vorher.has(z.id)) continue;
          raus.push({ id: ereignisKennung('crm', 'mandat', m.id, 'zusatz', z.id), art: 'zusatz-gebucht', quelle: 'crm', ...mandatEreignisBereich(m.gesellschaft), bezug: { ...bezug, leistungId: z.leistungId } });
        }
      }
    }
  }
  return raus;
}

/** Nach dem Speichern des CRM (lib/crm/speicher.ts `crmSchreiben`). Wirft nie. */
export async function crmEreignisse(vorher: CrmFuerDiff & Partial<Pick<CrmBestand, 'events' | 'kampagnen'>>, nachher: CrmFuerDiff & Partial<Pick<CrmBestand, 'events' | 'kampagnen'>>): Promise<number> {
  try {
    // Kundengewinnung (22.10., E7/E11): Events und Kampagnen — eigener Block in ./quellen-kundengewinnung.ts.
    const { crmDiffKundengewinnung } = await import('./quellen-kundengewinnung');
    const l = [...crmDiff(vorher, nachher), ...crmDiffKundengewinnung(vorher, nachher)];
    const n = l.length ? (await ereignis(l)).neu : 0;
    // 29.10. (Kreislauf, Kevin): Mandat beendet → sein Fall wird sofort abgeschlossen (+ Ereignis `fall-abgeschlossen`). Idempotent; das Netz im Fulfillment-Morgenlauf
    // holt nach, was hier nicht schreiben konnte (`mandatsendeNetz`).
    const beendet = l.filter(e => e.art === 'mandat-beendet' && e.bezug.mandatId).map(e => e.bezug.mandatId!);
    if (beendet.length) {
      const { fallNachMandatsende } = await import('@/lib/fulfillment/prozesse/fall-server');
      for (const id of beendet) await fallNachMandatsende(id).catch(() => false);
    }
    return n;
  } catch { return 0; }
}

/** Kartei (rein): Personen-Leads, die neu auf SQL stehen — eingeschränkte nie. */
export function karteiDiffSql(vorher: readonly Pick<Kontakt, 'id' | 'lead'>[] | null | undefined, nachher: readonly Pick<Kontakt, 'id' | 'lead' | 'firmaId' | 'eingeschraenkt'>[] | null | undefined): EreignisEingabe[] {
  if (!nachher?.length) return [];
  const alt = new Map((vorher ?? []).map(k => [k.id, k.lead?.status]));
  return nachher.filter(k => k.lead?.status === 'sql' && alt.get(k.id) !== 'sql' && !k.eingeschraenkt)
    .map(k => ({ id: ereignisKennung('crm', 'lead', k.id, 'sql'), art: 'lead-sql' as const, quelle: 'kartei' as const, bereich: 'business' as const, bezug: { kontaktId: k.id, ...(k.firmaId ? { firmaId: k.firmaId } : {}) } }));
}

/** Nach dem Speichern der Kartei (lib/crm/kartei-schreiben.ts). Wirft nie. */
export async function karteiEreignisse(vorher: unknown, nachher: unknown): Promise<number> {
  try {
    const liste = (b: unknown) => (b && typeof b === 'object' && Array.isArray((b as { kontakte?: unknown }).kontakte) ? (b as { kontakte: Kontakt[] }).kontakte : []);
    // Kundengewinnung (22.10., E6): neue Einwilligung mit vollem Nachweis — eigener Block in ./quellen-kundengewinnung.ts.
    const { einwilligungDiff } = await import('./quellen-kundengewinnung');
    const l = [...karteiDiffSql(liste(vorher), liste(nachher)), ...einwilligungDiff(liste(vorher), liste(nachher))];
    return l.length ? (await ereignis(l)).neu : 0;
  } catch { return 0; }
}

/** Neue Anfrage (/api/crm/anfrage): ein neuer Lead (Kennung = das Follow-up der Anfrage). Wirft nie. */
export async function anfrageEreignis(a: { followUpId: string; kontaktId: string; firmaId?: string; eingeschraenkt?: boolean }): Promise<number> {
  try {
    if (a.eingeschraenkt) return 0;
    return (await ereignis({ id: ereignisKennung('crm', 'anfrage', a.followUpId), art: 'neuer-lead', quelle: 'anfrage', bereich: 'business', bezug: { kontaktId: a.kontaktId, followupId: a.followUpId, ...(a.firmaId ? { firmaId: a.firmaId } : {}) } })).neu;
  } catch { return 0; }
}

// ── Kreislauf Werkstatt (29.10.): neuer Lead von Hand bzw. aus dem Formular, Lead wird MQL ─────────────────────────────────────────────────────

/**
 * Neuer Lead (29.10.): eine Person wurde von Hand in der Kartei angelegt (`weg` „kartei“) bzw. kam aus dem Formular „Angebot anfordern“ („vertrieb“) — nie beim
 * Massen-Import, nie aus anderen Wegen (Firmenkarte beim Mandat, Netzwerken, Prospecting haben eigene Ereignisse bzw. Läufe). Eingeschränkte nie. Wirft nie.
 */
export async function personNeuEreignis(k: { id: string; firmaId?: string; eingeschraenkt?: unknown }, weg: string): Promise<number> {
  try {
    if (k.eingeschraenkt || (weg !== 'kartei' && weg !== 'vertrieb')) return 0;
    return (await ereignis({ id: ereignisKennung('crm', 'person', k.id, 'neu'), art: 'neuer-lead', quelle: weg === 'vertrieb' ? 'anfrage' : 'kartei', bereich: 'business', stufe: weg,
      bezug: { kontaktId: k.id, ...(k.firmaId ? { firmaId: k.firmaId } : {}) } })).neu;
  } catch { return 0; }
}

/** Neu MQL (rein): Leads, die jetzt MQL sind und es vorher nicht waren — als Ereignisse (Firma bzw. Person). */
export function mqlDiff(vorher: ReadonlySet<string>, jetzt: readonly { id: string; art: 'firma' | 'person'; firmaId?: string }[]): EreignisEingabe[] {
  return jetzt.filter(z => !vorher.has(z.id)).map(z => ({
    id: ereignisKennung('crm', 'lead', z.id, 'mql'), art: 'lead-mql' as const, quelle: (z.art === 'firma' ? 'crm' : 'kartei') as 'crm' | 'kartei', bereich: 'business' as const,
    bezug: z.art === 'firma' ? { firmaId: z.id } : { kontaktId: z.id, ...(z.firmaId ? { firmaId: z.firmaId } : {}) },
  }));
}
/** Die MQL-Leads des letzten Blicks (nur im Prozess — beim ersten Blick nach dem Start nur gemerkt: nie eine Flut über Altbestand). */
let mqlStand: { ids: Set<string>; am: number } | null = null;
const MQL_ABSTAND_MS = 60_000;
/**
 * Lead wird MQL (29.10.): die Regel ist abgeleitet (`mqlErreicht`, lib/crm/leads.ts — nur Marketing-Herkunft), darum kein Feld-Diff: die Leads rechnen und mit dem
 * letzten Blick vergleichen. NUR im Takt des Lauf-Motors, und nur, wenn sich Kartei oder CRM geändert haben (dort gemerkt) — nie im Lese- oder Schreibpfad; dazu
 * höchstens einmal je Minute (außer `sofort`). Eingeschränkte Personen fehlen (`kontakteFuerVerarbeitung`). Wirft nie.
 */
export async function mqlEreignisse(o: { sofort?: boolean; jetzt?: Date } = {}): Promise<number> {
  try {
    const jetzt = o.jetzt ?? new Date();
    if (!o.sofort && mqlStand && jetzt.getTime() - mqlStand.am < MQL_ABSTAND_MS) return 0;
    const [crm, { kontakteFuerVerarbeitung }, { leads, mqlErreicht }, { localDay }] = await Promise.all([crmLaden(), import('@/lib/crm/verarbeitung'), import('@/lib/crm/leads'), import('@/lib/zeit')]);
    if (!crm) return 0;
    const jetztMql = leads(await kontakteFuerVerarbeitung(), crm, localDay(jetzt)).filter(mqlErreicht).map(z => ({ id: z.id, art: z.art, ...(z.firmaId ? { firmaId: z.firmaId } : {}) }));
    const vorher = mqlStand;
    mqlStand = { ids: new Set(jetztMql.map(z => z.id)), am: jetzt.getTime() };
    if (!vorher) return 0;
    const l = mqlDiff(vorher.ids, jetztMql);
    return l.length ? (await ereignis(l, { jetzt })).neu : 0;
  } catch { return 0; }
}
/** Nur für Tests: den letzten Blick vergessen. */
export const _mqlStandLeeren = () => { mqlStand = null; };

// ── „An ZOE geben“ ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * „An ZOE geben“: Ereignis für die Auftraggeberin und SOFORT anstoßen (statt am nächsten Morgen) — mit denselben Sperren wie der Takt
 * (Nachtruhe, Business-frei der Aufgabe, Hintergrund-KI, Not-Aus, Höchstzahl). Kennung je Übergabe (Zeitpunkt), damit „zurückholen und
 * wieder geben“ wieder anstößt. Wirft nie.
 */
export async function zoeGegebenEreignis(aufgabeId: string, person: string, jetzt = new Date()): Promise<number> {
  try {
    const stempel = jetzt.toISOString().replace(/\D/g, '').slice(0, 14);
    const r = await ereignis({ id: ereignisKennung('aufgabe', aufgabeId, 'zoe', stempel), art: 'aufgabe-zoe', quelle: 'aufgaben', bereich: null, person, bezug: { aufgabeId } }, { jetzt });
    if (!r.neu) return 0;
    return await import('./takt').then(m => m.ereignisseAnstossen(jetzt));
  } catch { return 0; }
}

// ── Kalender ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Objekt im iCloud-Stand, so weit die Absage-Erkennung es braucht. */
export interface KalObjekt { href: string; ics: string }

/**
 * Termine mit CRM-Bezug, die seit dem letzten Stand vom Gegenüber abgesagt wurden (rein): STATUS:CANCELLED, ohne dass wir einladen —
 * oder wir laden ein und JEDER Gast hat abgesagt. `absage(ics)` liefert diese Lage (lib/kalender/ics.ts `vomGegenueberAbgesagt`).
 */
export function absagenAus(alt: ReadonlyMap<string, KalObjekt>, neu: readonly { kal: string; o: KalObjekt }[], bezugVon: (kal: string, uid: string) => { uid: string; bezug: Record<string, unknown> } | null, absage: (ics: string) => { uid?: string; abgesagt: boolean }): EreignisEingabe[] {
  const raus: EreignisEingabe[] = [];
  for (const { kal, o } of neu) {
    const vorher = alt.get(`${kal}|${o.href}`);
    if (!vorher || vorher.ics === o.ics) continue;
    const n = absage(o.ics);
    if (!n.abgesagt || !n.uid || absage(vorher.ics).abgesagt) continue;
    const b = bezugVon(kal, n.uid);
    if (!b) continue;
    const s = (x: unknown) => (typeof x === 'string' && x ? x : undefined);
    const gaeste = Array.isArray(b.bezug.gastKontakte) ? (b.bezug.gastKontakte as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const kontaktId = s(b.bezug.kontaktId) ?? gaeste[0];
    const bezug = { terminUid: b.uid, ...(kontaktId ? { kontaktId } : {}), ...(s(b.bezug.firmaId) ? { firmaId: s(b.bezug.firmaId) } : {}), ...(s(b.bezug.dealId) ? { dealId: s(b.bezug.dealId) } : {}), ...(s(b.bezug.mandatId) ? { mandatId: s(b.bezug.mandatId) } : {}) };
    if (Object.keys(bezug).length < 2) continue; // nur Termine mit CRM-Bezug
    const von = s(b.bezug.von);
    raus.push({ id: ereignisKennung('kalender', n.uid, 'abgesagt'), art: 'termin-abgesagt', quelle: 'kalender', bereich: 'business', bezug, ...(von ? { person: von } : {}) });
  }
  return raus;
}

/** Nach dem iCloud-Abgleich (lib/kalender/icloud.ts `abgleichen`). Wirft nie. */
export async function terminAbsagenEreignisse(alt: { kalender: { id: string }[]; objekte: Record<string, KalObjekt[] | undefined>; adressen?: string[] } | null, neu: { kalender: { id: string }[]; objekte: Record<string, KalObjekt[] | undefined>; adressen?: string[] }): Promise<number> {
  try {
    if (!alt) return 0;
    const [{ kalenderKennung, terminSchluessel }, { ladeBezuege }, { vomGegenueberAbgesagt }] = await Promise.all([import('@/lib/kalender/bezug'), import('@/lib/kalender/bezug-server'), import('@/lib/kalender/ics')]);
    const altKarte = new Map<string, KalObjekt>();
    for (const k of alt.kalender) for (const o of alt.objekte[k.id] ?? []) altKarte.set(`${k.id}|${o.href}`, o);
    const neuListe = neu.kalender.flatMap(k => (neu.objekte[k.id] ?? []).map(o => ({ kal: k.id, o })));
    const bezuege = (await ladeBezuege()).bezuege as unknown as Record<string, Record<string, unknown>>;
    const ich = (neu.adressen ?? []).map(a => a.toLowerCase());
    const l = absagenAus(altKarte, neuListe, (kal, uid) => {
      const key = terminSchluessel(kalenderKennung(kal), uid);
      const b = bezuege[key] ?? bezuege[uid];
      return b ? { uid: key, bezug: b } : null;
    }, ics => vomGegenueberAbgesagt(ics, ich));
    return l.length ? (await ereignis(l)).neu : 0;
  } catch (e) { console.warn(`[ereignisse] Kalender: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`); return 0; }
}

// ── Prozesse C1 (21.10., „Laufen intern“ — VORLAGEN_KUNDENGEWINNUNG.md 5.1 E1/E8/E9, ANALYSE_100 Punkt 33) ─────────────────────────────────────────
// Aus VORHANDENEN Schreibwegen (nie eine neue Abfrage), nach dem Speichern, wirft nie, nur Kennungen.

/** Rechnung gestellt (Rechnungswesen „Rechnung stellen“) — Bereich aus der Gesellschaft der Rechnung, Mandat/Kunde/Kontakt als Bezug. Wirft nie. */
export async function rechnungGestelltEreignis(r: { id: string; firmaId?: string; mandatId?: string; kundeFirmaId?: string; kontaktId?: string }): Promise<number> {
  try {
    return (await ereignis({ id: ereignisKennung('rechnung', r.id, 'gestellt'), art: 'rechnung-gestellt', quelle: 'rechnung', bereich: bereichVonFirma(r.firmaId),
      bezug: { rechnungId: r.id, ...(r.mandatId ? { mandatId: r.mandatId } : {}), ...(r.kundeFirmaId ? { firmaId: r.kundeFirmaId } : {}), ...(r.kontaktId ? { kontaktId: r.kontaktId } : {}) } })).neu;
  } catch { return 0; }
}

/** Ein Termin des Kalender-Spiegels (calendar-cache) mit CRM-Bezug, wie ihn der Signal-Lauf schon liest. */
export interface TerminMitBezug { id: string; ende?: string; ganztags?: boolean; abgesagt?: boolean; privat?: boolean; kontaktIds: readonly string[]; dealId?: string; firmaId?: string; mandatId?: string; von?: string }

/**
 * Termine mit CRM-Bezug, die gerade vorbei sind (rein, E1): Ende ≤ jetzt und höchstens `fensterStunden` her (ältere wurden schon gemeldet bzw. sind
 * zu alt, um noch etwas auszulösen) — nie abgesagte, nie ganztägige. Kennung `kalender:<termin>:vorbei` (dieselbe bei jedem Lauf → kein Doppel).
 */
export function terminVorbeiAus(termine: readonly TerminMitBezug[], jetzt: Date, endeMs: (wand: string) => number, fensterStunden = 72): EreignisEingabe[] {
  const raus: EreignisEingabe[] = [];
  const t = jetzt.getTime();
  for (const x of termine) {
    if (x.abgesagt || x.ganztags || !x.ende || !x.kontaktIds.length) continue;
    const e = endeMs(x.ende);
    if (!Number.isFinite(e) || e > t || t - e > fensterStunden * 3_600_000) continue;
    raus.push({
      id: ereignisKennung('kalender', x.id, 'vorbei'), art: 'termin-vorbei', quelle: 'kalender', bereich: x.privat ? 'privat' : 'business',
      bezug: { terminUid: x.id, kontaktId: x.kontaktIds[0], ...(x.dealId ? { dealId: x.dealId } : {}), ...(x.firmaId ? { firmaId: x.firmaId } : {}), ...(x.mandatId ? { mandatId: x.mandatId } : {}) },
      ...(x.von && /^[a-z0-9-]{1,40}$/.test(x.von) && x.von !== 'system' ? { person: x.von } : {}),
    });
  }
  return raus;
}
/** Nach dem CRM-Signal-Lauf (lib/crm/signale-server.ts). Wirft nie. */
export async function terminVorbeiEreignisse(termine: readonly TerminMitBezug[], jetzt = new Date()): Promise<number> {
  try {
    const { terminMs } = await import('@/lib/crm/signale');
    const l = terminVorbeiAus(termine, jetzt, terminMs);
    return l.length ? (await ereignis(l, { jetzt })).neu : 0;
  } catch { return 0; }
}

/**
 * Eigene Mail an Kontakte gesendet (E8 „antwort-gesendet“): Adressen → Kontakte (alle Adressen, keine Sammeladressen, eingeschränkte nie), Bereich des
 * Postfachs, `person` = wer gesendet hat. Wirft nie.
 */
export async function antwortGesendetEreignis(a: { person: string; quelle: 'gmail' | 'imap'; nachricht: string; an: readonly string[]; postfach: string; gespraech?: string }): Promise<number> {
  try {
    if (!a.an.length) return 0;
    const adresse = await adressenIndex();
    const { ladePostfach } = await import('@/lib/postfach/register');
    const bereich = (await ladePostfach(a.person, a.postfach).catch(() => null))?.bereich ?? null;
    let crm: CrmBestand | null | undefined;
    const crmEinmal = async () => (crm === undefined ? (crm = await crmLaden()) : crm);
    const liste: EreignisEingabe[] = [];
    const gesehen = new Set<string>();
    for (const m of a.an) {
      const k = adresse.get(m.trim().toLowerCase());
      if (!k || gesehen.has(k.id)) continue;
      gesehen.add(k.id);
      const bezug = await personBezug(k, crmEinmal);
      if (bezug === null) continue;
      liste.push({ id: ereignisKennung('antwort', a.quelle, a.nachricht, k.id), art: 'antwort-gesendet', quelle: a.quelle, bereich: bereichAusPostfach(bereich), person: a.person, bezug: { ...bezug, ...(a.gespraech ? { gespraech: a.gespraech } : {}) } });
    }
    return liste.length ? (await ereignis(liste)).neu : 0;
  } catch { return 0; }
}

/** Eigene WhatsApp-Nachricht an eine zugeordnete Akte gesendet (E8). Wirft nie. */
export async function whatsappGesendetEreignis(a: { person: string; wamid: string; kontaktId?: string; bereich: string }): Promise<number> {
  try {
    if (!a.kontaktId) return 0;
    const k = (await (await import('@/lib/crm/verarbeitung')).kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(x => x.id === a.kontaktId);
    const bezug = await personBezug(k, () => crmLaden());
    if (!bezug || !k) return 0;
    return (await ereignis({ id: ereignisKennung('antwort', 'wa', a.wamid), art: 'antwort-gesendet', quelle: 'whatsapp', bereich: bereichAusPostfach(a.bereich), person: a.person, bezug })).neu;
  } catch { return 0; }
}

/**
 * Follow-up erledigt (E8, /api/crm/followup) — Bezug Kontakt/Deal/Mandat/Firma aus dem Follow-up; Bereich aus der Gesellschaft des Deals bzw. Mandats
 * (die Selbstständigkeit gehört zu Privat), sonst Business. Eingeschränkte Personen nie. Wirft nie.
 */
export async function followupErledigtEreignis(f: { id: string; kontaktId?: string; bezug?: { art: string; id: string } }): Promise<number> {
  try {
    const b = f.bezug;
    if (f.kontaktId) {
      const k = (await (await import('@/lib/crm/verarbeitung')).kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(x => x.id === f.kontaktId);
      if (k?.eingeschraenkt) return 0;
    }
    let bereich: EreignisBereich = 'business';
    if (b?.art === 'chance' || b?.art === 'mandat') {
      const c = await crmLaden();
      const g = b.art === 'chance' ? c?.chancen.find(x => x.id === b.id)?.gesellschaft : c?.mandate.find(x => x.id === b.id)?.gesellschaft;
      if (g) bereich = bereichVonGesellschaft(g);
    }
    const bezug = {
      followupId: f.id, ...(f.kontaktId ? { kontaktId: f.kontaktId } : {}),
      ...(b?.art === 'chance' ? { dealId: b.id } : b?.art === 'mandat' ? { mandatId: b.id } : b?.art === 'firma' ? { firmaId: b.id } : {}),
    };
    return (await ereignis({ id: ereignisKennung('crm', 'followup', f.id, 'erledigt'), art: 'followup-erledigt', quelle: 'crm', bereich, bezug })).neu;
  } catch { return 0; }
}

/**
 * Fulfillment-Fall (rein, nach dem Schreiben des Falls): Schritte, die neu auf „erledigt“ stehen (Kennung mit dem Tag der Erledigung — ein wieder
 * geöffneter und erneut erledigter Schritt meldet sich erneut), und Ziele des Wert-Kontos, deren Erreichung mit dieser Messung 100 % erreicht.
 */
export function fallDiff(vorher: { knoten: readonly { id: string; status: string }[]; wertKonto?: Record<string, unknown>; status?: string }, nachher: { knoten: readonly { id: string; status: string; erledigtAm?: string }[]; wertKonto?: Record<string, unknown>; status?: string; geaendert?: string; vorlageId?: string }, m: { id: string; firmaId?: string; gesellschaft: string; kontaktIds?: readonly string[] }, erreichung: (e: unknown) => number | null, abschluss: 'mandatsende' | 'hand' = 'hand'): EreignisEingabe[] {
  const alt = new Map(vorher.knoten.map(k => [k.id, k.status]));
  const bereich = mandatEreignisBereich(m.gesellschaft);
  const basis = { mandatId: m.id, ...(m.firmaId ? { firmaId: m.firmaId } : {}), ...(m.kontaktIds?.[0] ? { kontaktId: m.kontaktIds[0] } : {}) };
  const raus: EreignisEingabe[] = [];
  for (const k of nachher.knoten) {
    if (k.status !== 'erledigt' || alt.get(k.id) === 'erledigt') continue;
    raus.push({ id: ereignisKennung('fall', m.id, k.id, (k.erledigtAm ?? '').slice(0, 10)), art: 'fall-schritt-erledigt', quelle: 'fulfillment', ...bereich, bezug: { ...basis, knotenId: k.id } });
  }
  for (const [ziel, e] of Object.entries(nachher.wertKonto ?? {})) {
    const jetzt = erreichung(e), vorhin = erreichung(vorher.wertKonto?.[ziel]);
    if (jetzt === 100 && vorhin !== 100) raus.push({ id: ereignisKennung('fall', m.id, 'ziel', ziel), art: 'ziel-erreicht', quelle: 'fulfillment', ...bereich, bezug: { ...basis } });
  }
  // 29.10. (Kreislauf, Kevin: „Mandat beendet → Fall automatisch abschließen“): der Fall steht neu auf „abgeschlossen“ → `fall-abgeschlossen` (Stufe: durch das
  // Mandatsende bzw. von Hand) — daran starten Nachsorge und Verlängerung in der Werkstatt. Kennung mit dem Tag (wieder geöffnet und erneut geschlossen = neu).
  if (nachher.status === 'abgeschlossen' && vorher.status !== undefined && vorher.status !== 'abgeschlossen') {
    raus.push({ id: ereignisKennung('fall', m.id, 'abgeschlossen', (nachher.geaendert ?? '').slice(0, 10)), art: 'fall-abgeschlossen', quelle: 'fulfillment', ...bereich, stufe: abschluss,
      bezug: { ...basis, ...(nachher.vorlageId ? { vorlageId: nachher.vorlageId } : {}) } });
  }
  return raus;
}
/**
 * Nach dem Schreiben eines Fulfillment-Falls (lib/fulfillment/prozesse/fall-server.ts — die Ausführung bleibt unberührt). Wirft nie. `wirksam` (22.10., B1): die
 * Fälle vorher/nachher MIT abgeleitetem Onboarding (`fallWirksam`) — daraus die Begleit-Ereignisse (Phase, wartet auf Kunde, Bestätigung); ohne `wirksam` wie bisher.
 */
export async function fallEreignisse(vorher: Parameters<typeof fallDiff>[0], nachher: Parameters<typeof fallDiff>[1], m: Parameters<typeof fallDiff>[2], wirksam?: { vorher: FallFuerBegleitung; nachher: FallFuerBegleitung; heute: string }, abschluss: 'mandatsende' | 'hand' = 'hand'): Promise<number> {
  try {
    const { zielErreichung } = await import('@/lib/fulfillment/prozesse/wert');
    const l = fallDiff(vorher, nachher, m, e => zielErreichung(e as never), abschluss);
    if (wirksam) {
      const [{ phasenStaende }, { aktiveKnoten }] = await Promise.all([import('@/lib/fulfillment/regeln'), import('@/lib/fulfillment/prozesse/ausfuehrung')]);
      const r = { phasenStaende, aktiveKnoten };
      l.push(...fallBegleitDiff(fallBegleitStand(wirksam.vorher, r), fallBegleitStand(wirksam.nachher, r), m, wirksam.heute));
    }
    return l.length ? (await ereignis(l)).neu : 0;
  } catch { return 0; }
}

// ── Begleit-Prozesse am Fall (22.10., Fulfillment in die Werkstatt B1) ────────────────────────────────────────────────────────────────────────────
// Ereignisse, auf die Begleit-Prozesse der Werkstatt (Lauf-Motor) DANEBEN starten — die Pakete bleiben im Fulfillment-Ausführer. Nur Kennungen; keine zweite
// Fristenrechnung: Phasen aus `phasenStaende`, aktuelle Schritte aus `aktiveKnoten`, Hänger aus `wasHaengt` (dieselbe Rechnung wie Cockpit und „Heute im Fulfillment“).

export type FallFuerBegleitung = Pick<import('@/lib/fulfillment/typen').Fall, 'knoten' | 'freigaben' | 'status' | 'startAm' | 'gestartetAm' | 'vorlageId'> & Partial<Pick<import('@/lib/fulfillment/typen').Fall, 'zusaetze'>>;
/** Was die Begleit-Ereignisse an einem Fall vergleichen (rein gerechnet, nie gespeichert). */
export interface FallBegleitStand {
  vorlageId?: string;
  /** Gegebene Bestätigungen (Kennungen F0 …). */
  freigaben: readonly string[];
  /** Phase → Zustand (`phasenStaende`: fertig · jetzt · laeuft · offen). */
  phasen: ReadonlyMap<string, string>;
  /** Die aktuellen Schritte (`aktiveKnoten`) und ob der Kunde dran ist. */
  aktiv: readonly { id: string; kunde: boolean }[];
  knoten: readonly { id: string; status: string; freigabe?: string }[];
}
/** Der Stand eines Falls für die Begleit-Ereignisse (rein) — mit DENSELBEN Regeln wie Reise und Ausführung (hier hereingereicht, damit es rein bleibt). */
export function fallBegleitStand(f: FallFuerBegleitung, r: { phasenStaende: (f: FallFuerBegleitung) => ReadonlyMap<string, string>; aktiveKnoten: (f: FallFuerBegleitung) => readonly { knoten: { id: string; zustaendig?: string; status: string } }[] }): FallBegleitStand {
  return {
    vorlageId: f.vorlageId, freigaben: Object.keys(f.freigaben ?? {}), phasen: r.phasenStaende(f),
    aktiv: r.aktiveKnoten(f).map(a => ({ id: a.knoten.id, kunde: a.knoten.zustaendig === 'kunde' || a.knoten.status === 'wartet_kunde' })),
    knoten: f.knoten.map(k => ({ id: k.id, status: k.status, ...(k.freigabe ? { freigabe: k.freigabe } : {}) })),
  };
}
type MandatBasis = { id: string; firmaId?: string; gesellschaft: string; kontaktIds?: readonly string[] };
const begleitBasis = (m: MandatBasis, vorlageId?: string) => ({
  ...mandatEreignisBereich(m.gesellschaft),
  bezug: { mandatId: m.id, ...(m.firmaId ? { firmaId: m.firmaId } : {}), ...(m.kontaktIds?.[0] ? { kontaktId: m.kontaktIds[0] } : {}), ...(vorlageId ? { vorlageId } : {}) },
});

/**
 * Die Begleit-Ereignisse eines Schreibvorgangs am Fall (rein): Phase „jetzt“ neu → `fall-phase`/begonnen, „fertig“ neu → abgeschlossen; ein Schritt des Kunden wird
 * aktuell bzw. steht neu auf „wartet auf Kunde“ → `fall-wartet-kunde`; eine Bestätigung ist neu gegeben → `abstimmung-bestaetigt` (an der Phase, die sie trägt).
 * Kennungen mit dem Tag (Phase, wartet) bzw. je Bestätigung einmal — dieselbe Kennung = dasselbe Ereignis.
 */
export function fallBegleitDiff(vorher: FallBegleitStand, nachher: FallBegleitStand, m: MandatBasis, heute: string): EreignisEingabe[] {
  const { bereich, arbeit, bezug } = begleitBasis(m, nachher.vorlageId);
  const ab = arbeit ? { arbeit } : {};
  const raus: EreignisEingabe[] = [];
  for (const [ph, z] of nachher.phasen) {
    const war = vorher.phasen.get(ph);
    const stufe = z === 'jetzt' && war !== 'jetzt' && war !== 'fertig' ? 'begonnen' : z === 'fertig' && war !== 'fertig' ? 'abgeschlossen' : null;
    if (stufe) raus.push({ id: ereignisKennung('fall', m.id, 'phase', ph, stufe, heute), art: 'fall-phase', quelle: 'fulfillment', bereich, ...ab, stufe, bezug: { ...bezug, knotenId: ph } });
  }
  const warKunde = new Set([...vorher.aktiv.filter(a => a.kunde).map(a => a.id), ...vorher.knoten.filter(k => k.status === 'wartet_kunde').map(k => k.id)]);
  const jetztKunde = new Set([...nachher.aktiv.filter(a => a.kunde).map(a => a.id), ...nachher.knoten.filter(k => k.status === 'wartet_kunde').map(k => k.id)]);
  for (const id of jetztKunde) {
    if (warKunde.has(id)) continue;
    raus.push({ id: ereignisKennung('fall', m.id, 'kunde', id, heute), art: 'fall-wartet-kunde', quelle: 'fulfillment', bereich, ...ab, stufe: 'begonnen', bezug: { ...bezug, knotenId: id } });
  }
  const gegeben = new Set(vorher.freigaben);
  for (const f of nachher.freigaben) {
    if (gegeben.has(f)) continue;
    const phase = nachher.knoten.find(k => k.freigabe === f)?.id;
    raus.push({ id: ereignisKennung('fall', m.id, 'freigabe', f), art: 'abstimmung-bestaetigt', quelle: 'fulfillment', bereich, ...ab, bezug: { ...bezug, freigabeId: f, ...(phase ? { knotenId: phase } : {}) } });
  }
  return raus;
}

/** Ein Hänger des Cockpits, wie ihn die Ereignisse brauchen (nur Kennungen und die Art). */
export interface HaengerKurz { art: string; knotenId?: string; seit?: string }
/**
 * Hänger → `fall-haengt` (rein): je Hänger GENAU einmal — die Kennung trägt Art, Knoten und `seit` (ein neuer Report, eine neue Frist bzw. ein neuer Puls ist ein
 * neuer Hänger). Stufe = Art des Hängers (willkommen · freigabe · wartet · faellig · puls · report · art14).
 */
export function haengerEreignisse(zeilen: readonly { m: MandatBasis; vorlageId?: string; haengt: readonly HaengerKurz[] }[]): EreignisEingabe[] {
  const raus: EreignisEingabe[] = [];
  for (const z of zeilen) {
    const { bereich, arbeit, bezug } = begleitBasis(z.m, z.vorlageId);
    for (const h of z.haengt) {
      raus.push({
        id: ereignisKennung('fall', z.m.id, 'haengt', h.art, h.knotenId ?? '-', (h.seit ?? '-').slice(0, 10)), art: 'fall-haengt', quelle: 'fulfillment', bereich, ...(arbeit ? { arbeit } : {}), stufe: h.art,
        bezug: { ...bezug, ...(h.knotenId ? { knotenId: h.knotenId } : {}) },
      });
    }
  }
  return raus;
}
/** Morgenlauf (lib/fulfillment/prozesse/server.ts `prozesseMorgenlauf`): die Hänger aller laufenden Fälle als Ereignisse. Wirft nie. */
export async function fallHaengtEreignisse(zeilen: Parameters<typeof haengerEreignisse>[0]): Promise<number> {
  try {
    const l = haengerEreignisse(zeilen);
    return l.length ? (await ereignis(l)).neu : 0;
  } catch { return 0; }
}

/** Was der Kunde geliefert hat — nur die Art und die Kennung des Eintrags (Formular: Baustein, Unterlage: `ud-…`, Puls: `kp-…`). */
export type KundeGeliefert = 'formular' | 'unterlage' | 'puls';
/** Der Kunde hat geliefert (Kunden-Link bzw. Formular gemeinsam im Kick-off) → `kunde-geliefert` — beendet z. B. die Erinnerungskette „Unterlagen fehlen“. Wirft nie. */
export async function kundeGeliefertEreignis(m: MandatBasis, was: KundeGeliefert, eintragId: string, vorlageId?: string): Promise<number> {
  try {
    const { bereich, arbeit, bezug } = begleitBasis(m, vorlageId);
    return (await ereignis({ id: ereignisKennung('fall', m.id, 'geliefert', was, eintragId), art: 'kunde-geliefert', quelle: 'fulfillment', bereich, ...(arbeit ? { arbeit } : {}), stufe: was, bezug })).neu;
  } catch { return 0; }
}
