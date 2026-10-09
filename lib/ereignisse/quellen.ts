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

import { bereichVon, bereichVonFirma, bereichVonGesellschaft } from '@/lib/einheiten';
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
  const deal = c?.chancen.find(x => OFFENE_STUFEN.includes(x.stufe) && x.kontaktIds.includes(k.id));
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
export async function imapEreignisse(person: string, postfach: { adresse: string; bereich: string | null }, koepfe: readonly { id: string; labels: string[]; liste?: boolean; automatisch?: boolean; von: { email: string } }[]): Promise<number> {
  try {
    const ein = koepfe.filter(k => eingehend(k, new Set([postfach.adresse.toLowerCase()])));
    return ein.length ? postEreignisse(person, 'imap', postfach.bereich, ein.map(k => ({ id: k.id, von: k.von.email }))) : 0;
  } catch { return 0; }
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

// ── CRM und Kartei ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was sich im CRM geändert hat (rein): Deal neu bzw. in einer anderen Stufe, Firmen-Lead neu auf SQL. */
export function crmDiff(vorher: Pick<CrmBestand, 'chancen' | 'firmen'>, nachher: Pick<CrmBestand, 'chancen' | 'firmen'>): EreignisEingabe[] {
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
  return raus;
}

/** Nach dem Speichern des CRM (lib/crm/speicher.ts `crmSchreiben`). Wirft nie. */
export async function crmEreignisse(vorher: Pick<CrmBestand, 'chancen' | 'firmen'>, nachher: Pick<CrmBestand, 'chancen' | 'firmen'>): Promise<number> {
  try { const l = crmDiff(vorher, nachher); return l.length ? (await ereignis(l)).neu : 0; } catch { return 0; }
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
    const l = karteiDiffSql(liste(vorher), liste(nachher));
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
