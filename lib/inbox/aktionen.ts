// ─── Inbox 2 — was ein Klick an einem Gespräch tut (Server, 06.10.2026) ─────────────────────────────────────────
// EINE Stelle für alle Quellen. Der Zustand lebt dort, wo er hingehört, und wird zurückgeschrieben:
//   erledigt   Posteingang: Gmail archivieren (Label INBOX weg) · IMAP in den Archiv-Ordner. „Warten auf“: „erledigt bis Nachricht X“
//              im Inbox-Zustand (im Postfach gibt es nichts zu archivieren) — Neues holt das Gespräch zurück.
//   gelesen    Gmail UNREAD weg · IMAP `\Seen`;  ungelesen umgekehrt
//   spaeter    Wiedervorlage (Datum) im Inbox-Zustand
//   zurueck    Wiedervorlage/„erledigt“ weg; archivierte Post wieder in den Posteingang
//   zuordnen   bestätigt die Person zum Gespräch → Verlauf der Kontaktakte (lib/inbox/verlauf.ts); `loesen` nimmt das zurück
//   zulassen / blocken / offen   Screener je Adresse bzw. — WhatsApp — je Telefonnummer (Person)
//   WhatsApp (07.10.): erledigt = „erledigt bis Nachricht X“ (bei Meta gibt es nichts zu archivieren), gelesen = „gelesen bis“ im
//   geteilten Spiegel der Business-Nummer (keine Lesebestätigung an die Person)
// Gesprächs- und Nachrichten-Kennungen kommen NIE aus dem Browser in die Postfächer: das Gespräch wird aus den EIGENEN Spiegeln der
// Person neu gebaut und nur dessen Nachrichten werden angefasst.
// Team-Postfächer (08.10., Lücke 6): Wiedervorlage, erledigt und Zuordnung liegen GEMEINSAM (lib/inbox/teilen-server.ts) — dieselbe
// Aktion wirkt für alle mit Zugang; Archivieren/Gelesen gehen über den Zugang des BESITZERS an das Postfach (es ist dasselbe Postfach
// für alle). Der Screener (zulassen/blocken) bleibt je Person. „Wer kümmert sich“ (`kuemmertSetzen`) nur mit Stand (409).

import { localDay } from '@/lib/zeit';
import { gmailMarkieren } from '@/lib/gmail/aktion';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { imapAktion } from '@/lib/postfach/aktion';
import { stromRoh } from './strom-server';
import { melde } from '@/lib/meldungen/melden';
import { absenderSetzen, gespraechSetzen, ladeInboxZustand } from './zustand';
import { verlaufNachziehen } from './verlauf';
import { teamZustandSetzen } from './teilen-server';
import type { Gespraech, GespraechZustand } from './strom';

export const AKTIONEN = ['erledigt', 'gelesen', 'ungelesen', 'spaeter', 'zurueck', 'zuordnen', 'loesen', 'zulassen', 'blocken', 'offen'] as const;
export type InboxAktion = typeof AKTIONEN[number];
export const istAktion = (v: unknown): v is InboxAktion => (AKTIONEN as readonly string[]).includes(v as string);

export class AktionsFehler extends Error { constructor(message: string, public status = 400) { super(message); } }

/** Das Gespräch der Person zu dieser Kennung (aus den eigenen Spiegeln). */
export async function gespraechFinden(person: string, id: string): Promise<Gespraech | null> {
  return (await stromRoh(person)).gespraeche.find(g => g.id === id) ?? null;
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Wohin der Zustand eines Gesprächs gehört: Team-Postfach → gemeinsam, sonst je Person. */
async function zustandSetzen(person: string, g: Gespraech, teil: { [K in keyof GespraechZustand]?: GespraechZustand[K] | null }): Promise<void> {
  if (g.team?.postfach) await teamZustandSetzen(g.id, teil);
  else await gespraechSetzen(person, g.id, teil);
}
/** Wessen Zugang ans Postfach geht: beim Team-Postfach der Besitzer (Abgleich und Zurückschreiben laufen nur über ihn). */
const postfachPerson = (person: string, g: Gespraech) => g.team?.postfach?.besitzer ?? person;

export async function aktionAusfuehren(person: string, id: string, aktion: InboxAktion, o: { bis?: string; kontaktId?: string } = {}, schonGefunden?: Gespraech): Promise<{ text: string }> {
  const g = schonGefunden ?? await gespraechFinden(person, id);
  if (!g) throw new AktionsFehler('Dieses Gespräch gibt es nicht (mehr).', 404);
  const heute = localDay();
  const pp = postfachPerson(person, g);
  switch (aktion) {
    case 'erledigt': {
      if (g.offen && g.fach !== 'warten') {
        if (g.quelle === 'gmail') await gmailMarkieren(person, g.juengste, 'archivieren');
        else if (g.quelle === 'imap') await imapAktion(pp, g.postfachId, g.nachrichten, 'erledigt');
      }
      // Auch nach dem Archivieren: „erledigt bis zur jüngsten Nachricht“ — ein Warten-Gespräch verschwindet so, bis Neues kommt.
      await zustandSetzen(person, g, { erledigt: { bis: g.juengste, am: new Date().toISOString() }, spaeter: null });
      return { text: g.fach === 'warten' ? 'Erledigt — kommt eine Antwort, ist das Gespräch wieder da.' : g.quelle === 'whatsapp' ? 'Erledigt — schreibt die Person wieder, ist das Gespräch wieder da.' : 'Erledigt — im Postfach archiviert.' };
    }
    case 'gelesen':
    case 'ungelesen': {
      if (g.quelle === 'gmail') await gmailMarkieren(person, g.juengste, aktion);
      else if (g.quelle === 'imap') await imapAktion(pp, g.postfachId, g.nachrichten, aktion);
      // WhatsApp (07.10.): „gelesen bis“ im Spiegel der Business-Nummer (geteiltes Postfach) — keine Lesebestätigung an die Person.
      else if (g.quelle === 'whatsapp' && g.whatsapp) { const { whatsappGelesen } = await import('@/lib/whatsapp/aktion'); await whatsappGelesen(person, g.whatsapp.nummer, aktion === 'gelesen'); }
      return { text: aktion === 'gelesen' ? 'Als gelesen markiert.' : 'Als ungelesen markiert.' };
    }
    case 'spaeter': {
      if (!o.bis || !TAG.test(o.bis) || o.bis <= heute) throw new AktionsFehler('Bitte ein Datum ab morgen wählen.');
      await zustandSetzen(person, g, { spaeter: { bis: o.bis, seit: new Date().toISOString() } });
      return { text: `Wiedervorlage am ${o.bis.slice(8, 10)}.${o.bis.slice(5, 7)}.` };
    }
    case 'zurueck': {
      await zustandSetzen(person, g, { spaeter: null, erledigt: null });
      if (!g.offen && g.fach !== 'warten') {
        if (g.quelle === 'gmail') await gmailMarkieren(person, g.juengste, 'posteingang');
        else if (g.quelle === 'imap') await imapAktion(pp, g.postfachId, g.nachrichten, 'zurueck');
      }
      return { text: 'Wieder in der Inbox.' };
    }
    case 'zuordnen': {
      const kontaktId = o.kontaktId ?? g.zuordnung?.kontaktId;
      if (!kontaktId) throw new AktionsFehler('Zu diesem Gespräch gibt es noch keine Person in der Kartei — erst „Kontakt anlegen“.');
      const k = (await kontakteFuerVerarbeitung()).find(x => x.id === kontaktId);
      if (!k) throw new AktionsFehler('Diese Person gibt es nicht (oder ihre Verarbeitung ist eingeschränkt).', 409);
      if (k.werbesperre) throw new AktionsFehler('Für diese Person gilt eine Werbesperre — kein Eintrag im Verlauf.', 409);
      await zustandSetzen(person, g, { zuordnung: { kontaktId, am: new Date().toISOString() } });
      // Team-Postfach: der Verlauf kommt aus dem Spiegel des Besitzers.
      const n = await verlaufNachziehen(pp, id);
      return { text: n ? `Zugeordnet — ${n} ${n === 1 ? 'Nachricht steht' : 'Nachrichten stehen'} jetzt im Verlauf der Akte.` : 'Zugeordnet.' };
    }
    case 'loesen': {
      await zustandSetzen(person, g, { zuordnung: null });
      return { text: 'Zuordnung gelöst — neue Nachrichten kommen nicht mehr in den Verlauf (bestehende Zeilen bleiben in der Akte).' };
    }
    case 'zulassen':
    case 'blocken':
    case 'offen': {
      await absenderSetzen(person, g.absender, aktion === 'zulassen' ? 'zugelassen' : aktion === 'blocken' ? 'geblockt' : null);
      const wa = g.quelle === 'whatsapp';
      return { text: aktion === 'zulassen' ? (wa ? 'Zugelassen — WhatsApp von dieser Nummer kommt direkt in die Fächer.' : 'Zugelassen — Post von dieser Adresse kommt direkt in die Fächer.')
        : aktion === 'blocken' ? (wa ? 'Geblockt — WhatsApp von dieser Nummer erscheint nicht mehr (nichts wird gelöscht, die Person erfährt nichts).' : 'Geblockt — Post von dieser Adresse erscheint nicht mehr (nichts wird gelöscht).')
        : 'Entscheidung zurückgenommen.' };
    }
  }
}

/**
 * „Wer kümmert sich“ (08.10.) — nur Gespräche eines Team-Postfachs und der WhatsApp-Business-Nummer; `wer` muss Zugang haben (die
 * Liste `team.personen` des Gesprächs), `null` nimmt die Zuständigkeit weg. Nur mit dem Stand, den die Person gesehen hat — sonst 409
 * (`TeamKonflikt` mit dem aktuellen Zustand). Meldet der neuen Person (neutral, ohne Betreff).
 */
export async function kuemmertSetzen(person: string, id: string, wer: string | null, stand: string): Promise<{ text: string; stand: string }> {
  const g = await gespraechFinden(person, id);
  if (!g) throw new AktionsFehler('Dieses Gespräch gibt es nicht (mehr).', 404);
  if (!g.team) throw new AktionsFehler('„Wer kümmert sich“ gibt es nur in Team-Postfächern und bei WhatsApp — eigene Gespräche lassen sich übergeben.', 400);
  if (wer !== null && !g.team.personen.some(p => p.speicher === wer)) throw new AktionsFehler('Diese Person hat keinen Zugang zu diesem Postfach.', 400);
  const r = await teamZustandSetzen(id, { kuemmert: wer ? { person: wer, seit: new Date().toISOString(), von: person } : null }, stand);
  const name = g.team.personen.find(p => p.speicher === wer)?.name;
  if (wer && wer !== person) {
    const ich = g.team.personen.find(p => p.speicher === person)?.name ?? person;
    await melde({ an: wer, art: 'postfach', titel: `${ich} bittet dich, dich um ${g.quelle === 'whatsapp' ? 'ein WhatsApp-Gespräch' : 'ein Gespräch im Team-Postfach'} zu kümmern.`, link: `/os/inbox?offen=${id}`, von: person });
  }
  return { text: wer ? (wer === person ? 'Du kümmerst dich.' : `${name ?? wer} kümmert sich.`) : 'Niemand ist mehr eingetragen.', stand: r.stand };
}

/** Mehrere Gespräche am Stück erledigen (Info & Rundschreiben „alle erledigen“). Fehler je Gespräch werden gezählt, nie still. */
export async function alleErledigen(person: string, ids: readonly string[]): Promise<{ erledigt: number; fehler: number }> {
  let ok = 0, fehler = 0;
  const alle = new Map((await stromRoh(person)).gespraeche.map(g => [g.id, g]));
  for (const id of ids.slice(0, 200)) {
    const g = alle.get(id);
    if (!g) { fehler++; continue; }
    try { await aktionAusfuehren(person, id, 'erledigt', {}, g); ok++; } catch { fehler++; }
  }
  return { erledigt: ok, fehler };
}

/** Screener-Liste der Person (für „Postfächer & Absender“). */
export async function absenderListe(person: string): Promise<{ adresse: string; status: 'zugelassen' | 'geblockt'; seit: string }[]> {
  const z = await ladeInboxZustand(person);
  return Object.entries(z.absender).map(([adresse, v]) => ({ adresse, ...v })).sort((a, b) => b.seit.localeCompare(a.seit));
}

/** Screener-Entscheidung zu einer Adresse direkt (Liste in den Einstellungen). */
export async function absenderEntscheiden(person: string, adresse: string, status: 'zugelassen' | 'geblockt' | null): Promise<void> {
  await absenderSetzen(person, adresse, status);
}
