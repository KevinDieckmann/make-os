// ─── Gmail — Zuordnung zu Kontakt/Firma/Deal und Verlauf der Kontaktakte (03.10.2026) ──
// „Gehört zu …“: Absender bzw. Empfänger → Kontakt (E-Mail inkl. WEITERER Adressen der Kontakte, `alleAdressen`) → Firma/Deal.
// Zwei Wege, eine Regel:
//   ANZEIGE   `zuordnen` — für die Inbox, mit ALLEN Personen der Kartei (auch eingeschränkte: Auffinden ist keine Verarbeitung);
//             Werbesperre/Einschränkung stehen als `sperre` dabei, die Mail-Ampel (§ 7 UWG) für den Antwort-Hinweis.
//   VERLAUF   `gmailVerlaufSchreiben` — je Mail EINE Zeile im Verlauf der Kontaktakte: Betreff + Link in die Inbox, nie der
//             Text. Eingehend = „Antwort erhalten“ (`antwort` — das vorhandene Wärme-Signal, nichts Neues), gesendet = „E-Mail“.
//             Nur über `kontakteFuerVerarbeitung` (Art. 18: eingeschränkte Personen fehlen) und `ausgenommen` (Werbesperre/
//             Art. 18 → kein Verlauf, wie bei den Signalen aus M365). Idempotent über den Bezug je Mail (`bezugMail`).
// Sammel-/Rollenadressen (info@, noreply@ …) sind nie eine Person.

import type { Aktivitaet, Kontakt } from '@/lib/make-one/crm';
import { anzeigename, istSammelAdresse } from '@/lib/make-one/crm';
import { alleAdressen } from '@/lib/crm/emails';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { kanalStatus } from '@/lib/crm/recht';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { bezugMail, signaleAnwenden, type Signal } from '@/lib/crm/signale';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeCrm } from '@/lib/crm/speicher';
import type { CrmBestand } from '@/lib/crm/typen';
import { adresseKlein } from './mime';
import { istGesendet } from './stand';
import type { Adr, GmailKopf, GmailStand, Zuordnung } from './typen';

/** Die eigenen Adressen des Postfachs (Konto + Aliase) — klein. */
export const eigeneAdressen = (s: Pick<GmailStand, 'email' | 'aliase'>): string[] => Array.from(new Set([s.email, ...(s.aliase ?? []).map(a => a.email)].map(adresseKlein)));

/** Adresse → Kontakt (alle Adressen der Person; Sammeladressen nie). Der erste Treffer gewinnt, eindeutige vor mehrdeutigen sind nicht nötig (eine Adresse = eine Person, Dubletten räumt die Kartei). */
export function adressIndex(kontakte: readonly Kontakt[]): Map<string, Kontakt> {
  const m = new Map<string, Kontakt>();
  for (const k of kontakte) for (const a of alleAdressen(k)) if (!istSammelAdresse(a) && !m.has(a)) m.set(a, k);
  return m;
}

/** Die Gegenseite einer Nachricht: eingehend der Absender, gesendet die Empfänger (An, dann Cc) — ohne die eigenen Adressen. */
export function gegenseite(k: GmailKopf, eigene: readonly string[]): Adr[] {
  const ich = new Set(eigene);
  const vonMir = ich.has(k.von.email) || istGesendet(k);
  return (vonMir ? [...k.an, ...k.cc] : [k.von]).filter(a => !ich.has(a.email));
}

const mailAmpelVon = (k: Kontakt, hatMandat: boolean, hatChance: boolean): Zuordnung['mailAmpel'] => kanalStatus(k, 'mail', { hatMandat, hatChance }).farbe;

/** Zuordnung einer Nachricht für die Anzeige — null, wenn die Gegenseite niemand in der Kartei ist. */
export function zuordnen(k: GmailKopf, eigene: readonly string[], index: Map<string, Kontakt>, crm: Pick<CrmBestand, 'chancen' | 'firmen' | 'mandate'>): Zuordnung | null {
  for (const a of gegenseite(k, eigene)) {
    const c = index.get(a.email);
    if (!c) continue;
    const deal = crm.chancen.find(x => OFFENE_STUFEN.includes(x.stufe) && x.kontaktIds.includes(c.id));
    const firma = c.firmaId ? crm.firmen.find(f => f.id === c.firmaId) : undefined;
    const hatMandat = (crm.mandate ?? []).some(m => m.status === 'aktiv' && m.kontaktIds.includes(c.id));
    return {
      kontaktId: c.id, name: anzeigename(c),
      ...(firma?.name ?? c.firma ? { firma: firma?.name ?? c.firma } : {}), ...(c.firmaId ? { firmaId: c.firmaId } : {}),
      ...(deal ? { dealId: deal.id, dealTitel: deal.titel } : {}),
      ...(c.eingeschraenkt ? { sperre: 'eingeschraenkt' as const } : c.werbesperre ? { sperre: 'werbesperre' as const } : {}),
      mailAmpel: mailAmpelVon(c, hatMandat, !!deal),
      ...(c.anrede ? { anrede: c.anrede } : {}),
    };
  }
  return null;
}

/** Link zur Mail in der Inbox — nur die Nachrichten-Kennung, nie Betreff oder Adresse. */
export const mailLinkFuer = (id: string): string => `/os/inbox?offen=gmail-${id}`;
/** Bezug der Verlaufszeile je Nachricht (stabil → idempotent). */
export const gmailBezug = (id: string): string => bezugMail(`gmail-${id}`);

const betreffZeile = (b: string) => b.replace(/\s+/g, ' ').trim().slice(0, 120) || '(kein Betreff)';

/**
 * Verlaufs-Signale zu den Nachrichten (rein): je Nachricht und Gegenseite-Kontakt eine Zeile. `person` = wem das Postfach
 * gehört (bei gesendeten Mails `von`). Eingeschränkte/gesperrte Personen und Sammeladressen: nichts.
 */
export function verlaufSignale(person: string, koepfe: readonly GmailKopf[], eigene: readonly string[], kontakte: readonly Kontakt[]): Signal[] {
  const index = adressIndex(kontakte.filter(k => !ausgenommen(k)));
  const raus: Signal[] = [];
  for (const k of koepfe) {
    const vonMir = istGesendet(k) || eigene.includes(k.von.email);
    const gesehen = new Set<string>();
    for (const a of gegenseite(k, eigene)) {
      const c = index.get(a.email);
      if (!c || gesehen.has(c.id)) continue;
      gesehen.add(c.id);
      const aktivitaet: Aktivitaet = vonMir
        ? { am: k.am, art: 'mail', text: `E-Mail gesendet · Betreff: ${betreffZeile(k.betreff)}`, von: person, bezug: gmailBezug(k.id), mailLink: mailLinkFuer(k.id) }
        : { am: k.am, art: 'antwort', text: `Betreff: ${betreffZeile(k.betreff)}`, von: 'system', bezug: gmailBezug(k.id), mailLink: mailLinkFuer(k.id) };
      raus.push({ kontaktId: c.id, aktivitaet });
    }
  }
  return raus;
}

/**
 * Den Verlauf der Kontaktakten nachziehen (nach jedem Abgleich): nur Nachrichten, deren Zeile noch fehlt — geschrieben wird nur,
 * wenn etwas Neues da ist. Gibt die Zahl neuer Zeilen zurück.
 */
export async function gmailVerlaufSchreiben(person: string, s: GmailStand): Promise<number> {
  const koepfe = Object.values(s.koepfe);
  if (!koepfe.length) return 0;
  const kontakte = await kontakteFuerVerarbeitung();
  const signale = verlaufSignale(person, koepfe, eigeneAdressen(s), kontakte);
  if (!signale.length) return 0;
  // Vorab prüfen, ob etwas fehlt — die Kartei wird nur dann gesperrt und geschrieben.
  const hat = new Map(kontakte.map(k => [k.id, new Set((k.aktivitaeten ?? []).map(a => a.bezug).filter(Boolean))]));
  if (signale.every(x => hat.get(x.kontaktId)?.has(x.aktivitaet.bezug))) return 0;
  let neu = 0;
  await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
    const f = cur ?? { kontakte: [] };
    const r = signaleAnwenden(f.kontakte, signale);
    neu = r.neu;
    return r.neu ? { ...f, kontakte: r.kontakte } : f;
  }, { art: 'system' });
  return neu;
}

/** Die Zuordnungen für eine Liste von Nachrichten (eine Sicht auf die Kartei und das CRM). */
export async function zuordnungenFuer(koepfe: readonly GmailKopf[], s: Pick<GmailStand, 'email' | 'aliase'>): Promise<Record<string, Zuordnung>> {
  const [kontakte, crm] = await Promise.all([kontakteFuerVerarbeitung({ mitEingeschraenkten: true }), ladeCrm()]);
  const index = adressIndex(kontakte);
  const eigene = eigeneAdressen(s);
  const raus: Record<string, Zuordnung> = {};
  for (const k of koepfe) { const z = zuordnen(k, eigene, index, crm); if (z) raus[k.id] = z; }
  return raus;
}
