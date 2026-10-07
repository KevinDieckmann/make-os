// ─── Inbox 2 — Gespräch im Verlauf der Kontaktakte, NUR nach „Zuordnen“ (Server, 06.10.2026) ───────────────────────
// Kevin 06.10.: „ZOE macht alles nur als Vorschlag — jede Übernahme (Zuordnung, Beleg, Aufgabe, Termin, Antwort) braucht einen Klick.“
// Die Inbox ZEIGT „gehört zu …“, sobald eine Adresse in der Kartei steht. In den Verlauf der Akte kommt ein Gespräch erst, wenn die
// Person „Zuordnen“ klickt (`inbox-zustand--<person>.gespraeche[id].zuordnung`) — danach auch jede neue Nachricht dieses Gesprächs
// (die Entscheidung gilt für das Gespräch). Gilt für ALLE Quellen; Gmail schrieb bis 06.10. automatisch (UPDATES.md).
// Je Nachricht EINE Zeile (Betreff + Link, nie der Text), eingehend „Antwort erhalten“ (`antwort`), gesendet „E-Mail“ (`mail`) bzw.
// bei WhatsApp „WhatsApp-Nachricht“ (`whatsapp`, seit 07.10. abends — vorher stand eine gesendete WhatsApp fälschlich als E-Mail da).
// Nie für eingeschränkte Personen/Werbesperre (`ausgenommen`), nie für Sammeladressen. Idempotent über den Bezug je Nachricht.

import type { Aktivitaet, Kontakt } from '@/lib/make-one/crm';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { bezugMail, signaleAnwenden, type Signal } from '@/lib/crm/signale';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { ladeGmailStand } from '@/lib/gmail/stand';
import { eigeneAdressen, gmailBezug, mailLinkFuer } from '@/lib/gmail/zuordnung';
import { ladePostfaecher } from '@/lib/postfach/register';
import { ladeImapStand } from '@/lib/postfach/spiegel';
import { kurzHash } from '@/lib/postfach/rfc822';
import { gespraechPfad, gespraechTeile, imapFaeden, type StromKopf } from './strom';
import { ladeInboxZustand } from './zustand';

const betreffZeile = (b: string) => b.replace(/\s+/g, ' ').trim().slice(0, 120) || '(kein Betreff)';

/** Die Nachrichten (Köpfe) eines Gesprächs der Person + ihre eigenen Adressen. */
export async function nachrichtenVon(person: string, id: string): Promise<{ koepfe: StromKopf[]; eigene: string[]; postfach: string } | null> {
  const t = gespraechTeile(id);
  if (!t) return null;
  if (t.quelle === 'gmail') {
    const s = await ladeGmailStand(person);
    if (!s) return null;
    const koepfe = Object.values(s.koepfe).filter(k => k.threadId === t.schluessel).sort((a, b) => a.am.localeCompare(b.am));
    return koepfe.length ? { koepfe, eigene: eigeneAdressen(s), postfach: 'gmail' } : null;
  }
  // WhatsApp (07.10.): Köpfe aus dem Spiegel der Business-Nummer — nur mit Zugang (lib/whatsapp/strom.ts).
  if (t.quelle === 'whatsapp') { const { whatsappNachrichtenVon } = await import('@/lib/whatsapp/strom'); return whatsappNachrichtenVon(person, t.postfach, t.schluessel); }
  if (t.quelle !== 'imap') return null;
  const p = (await ladePostfaecher(person)).find(x => x.id === t.postfach && x.quelle === 'imap');
  if (!p) return null;
  const s = await ladeImapStand(person);
  const liste = Object.values(s.koepfe).filter(k => k.postfachId === p.id);
  const faeden = imapFaeden(liste, kurzHash);
  const koepfe = liste.filter(k => faeden.get(k.id) === t.schluessel).sort((a, b) => a.am.localeCompare(b.am));
  return koepfe.length ? { koepfe, eigene: [p.adresse], postfach: p.id } : null;
}

/** Verlaufs-Signale eines bestätigten Gesprächs (rein): nur für die bestätigte Person. */
export function gespraechSignale(person: string, id: string, koepfe: readonly StromKopf[], eigene: readonly string[], kontakt: Kontakt): Signal[] {
  if (ausgenommen(kontakt)) return [];
  const raus: Signal[] = [];
  for (const k of koepfe) {
    const vonMir = k.labels.includes('SENT') || k.ordner === 'g' || eigene.includes(k.von.email);
    const gmail = id.startsWith('gm~');
    // WhatsApp (07.10.): eigener Bezug je Nachricht (WAMID), Text ohne Inhalt — gesendet = eigene Art `whatsapp` (Ansprache wie
    // LinkedIn, „E-Mails & Nachrichten“), eingehend = `antwort` (kanal-neutrales Wärme-Signal, Text „WhatsApp erhalten“).
    const wa = id.startsWith('wa~');
    const bezug = gmail ? gmailBezug(k.id) : bezugMail(`${wa ? 'wa' : 'imap'}-${k.id}`);
    const link = gmail ? mailLinkFuer(k.id) : gespraechPfad(id);
    const a: Aktivitaet = vonMir
      ? { am: k.am, art: wa ? 'whatsapp' : 'mail', text: wa ? 'WhatsApp gesendet' : `E-Mail gesendet · Betreff: ${betreffZeile(k.betreff)}`, von: person, bezug, mailLink: link }
      : { am: k.am, art: 'antwort', text: wa ? 'WhatsApp erhalten' : `Betreff: ${betreffZeile(k.betreff)}`, von: 'system', bezug, mailLink: link };
    // Automatische Antworten (Abwesenheit) sind kein Wärme-Signal.
    if (!vonMir && k.automatisch) continue;
    raus.push({ kontaktId: kontakt.id, aktivitaet: a });
  }
  return raus;
}

/**
 * Den Verlauf für alle bestätigten Gespräche der Person nachziehen (nach „Zuordnen“, nach jedem Abgleich und nach dem Senden).
 * Schreibt nur, wenn etwas fehlt. Liefert die Zahl neuer Zeilen.
 */
export async function verlaufNachziehen(person: string, nur?: string): Promise<number> {
  const z = await ladeInboxZustand(person);
  const bestaetigt = Object.entries(z.gespraeche).filter(([id, g]) => g.zuordnung && (!nur || id === nur));
  if (!bestaetigt.length) return 0;
  const kontakte = await kontakteFuerVerarbeitung();
  const je = new Map(kontakte.map(k => [k.id, k]));
  const signale: Signal[] = [];
  for (const [id, g] of bestaetigt) {
    const k = je.get(g.zuordnung!.kontaktId);
    if (!k) continue;
    const n = await nachrichtenVon(person, id);
    if (n) signale.push(...gespraechSignale(person, id, n.koepfe, n.eigene, k));
  }
  if (!signale.length) return 0;
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
