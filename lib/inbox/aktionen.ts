// ─── Inbox 2 — was ein Klick an einem Gespräch tut (Server, 06.10.2026) ─────────────────────────────────────────
// EINE Stelle für alle Quellen. Der Zustand lebt dort, wo er hingehört, und wird zurückgeschrieben:
//   erledigt   Posteingang: Gmail archivieren (Label INBOX weg) · IMAP in den Archiv-Ordner. „Warten auf“: „erledigt bis Nachricht X“
//              im Inbox-Zustand (im Postfach gibt es nichts zu archivieren) — Neues holt das Gespräch zurück.
//   gelesen    Gmail UNREAD weg · IMAP `\Seen`;  ungelesen umgekehrt
//   spaeter    Wiedervorlage (Datum) im Inbox-Zustand
//   zurueck    Wiedervorlage/„erledigt“ weg; archivierte Post wieder in den Posteingang
//   zuordnen   bestätigt die Person zum Gespräch → Verlauf der Kontaktakte (lib/inbox/verlauf.ts); `loesen` nimmt das zurück
//   zulassen / blocken / offen   Screener je Adresse (Person)
// Gesprächs- und Nachrichten-Kennungen kommen NIE aus dem Browser in die Postfächer: das Gespräch wird aus den EIGENEN Spiegeln der
// Person neu gebaut und nur dessen Nachrichten werden angefasst.

import { localDay } from '@/lib/zeit';
import { gmailMarkieren } from '@/lib/gmail/aktion';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { imapAktion } from '@/lib/postfach/aktion';
import { stromRoh } from './strom-server';
import { absenderSetzen, gespraechSetzen, ladeInboxZustand } from './zustand';
import { verlaufNachziehen } from './verlauf';
import type { Gespraech } from './strom';

export const AKTIONEN = ['erledigt', 'gelesen', 'ungelesen', 'spaeter', 'zurueck', 'zuordnen', 'loesen', 'zulassen', 'blocken', 'offen'] as const;
export type InboxAktion = typeof AKTIONEN[number];
export const istAktion = (v: unknown): v is InboxAktion => (AKTIONEN as readonly string[]).includes(v as string);

export class AktionsFehler extends Error { constructor(message: string, public status = 400) { super(message); } }

/** Das Gespräch der Person zu dieser Kennung (aus den eigenen Spiegeln). */
export async function gespraechFinden(person: string, id: string): Promise<Gespraech | null> {
  return (await stromRoh(person)).gespraeche.find(g => g.id === id) ?? null;
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;

export async function aktionAusfuehren(person: string, id: string, aktion: InboxAktion, o: { bis?: string; kontaktId?: string } = {}, schonGefunden?: Gespraech): Promise<{ text: string }> {
  const g = schonGefunden ?? await gespraechFinden(person, id);
  if (!g) throw new AktionsFehler('Dieses Gespräch gibt es nicht (mehr).', 404);
  const heute = localDay();
  switch (aktion) {
    case 'erledigt': {
      if (g.offen && g.fach !== 'warten') {
        if (g.quelle === 'gmail') await gmailMarkieren(person, g.juengste, 'archivieren');
        else if (g.quelle === 'imap') await imapAktion(person, g.postfachId, g.nachrichten, 'erledigt');
      }
      // Auch nach dem Archivieren: „erledigt bis zur jüngsten Nachricht“ — ein Warten-Gespräch verschwindet so, bis Neues kommt.
      await gespraechSetzen(person, id, { erledigt: { bis: g.juengste, am: new Date().toISOString() }, spaeter: null });
      return { text: g.fach === 'warten' ? 'Erledigt — kommt eine Antwort, ist das Gespräch wieder da.' : 'Erledigt — im Postfach archiviert.' };
    }
    case 'gelesen':
    case 'ungelesen': {
      if (g.quelle === 'gmail') await gmailMarkieren(person, g.juengste, aktion);
      else if (g.quelle === 'imap') await imapAktion(person, g.postfachId, g.nachrichten, aktion);
      return { text: aktion === 'gelesen' ? 'Als gelesen markiert.' : 'Als ungelesen markiert.' };
    }
    case 'spaeter': {
      if (!o.bis || !TAG.test(o.bis) || o.bis <= heute) throw new AktionsFehler('Bitte ein Datum ab morgen wählen.');
      await gespraechSetzen(person, id, { spaeter: { bis: o.bis, seit: new Date().toISOString() } });
      return { text: `Wiedervorlage am ${o.bis.slice(8, 10)}.${o.bis.slice(5, 7)}.` };
    }
    case 'zurueck': {
      await gespraechSetzen(person, id, { spaeter: null, erledigt: null });
      if (!g.offen && g.fach !== 'warten') {
        if (g.quelle === 'gmail') await gmailMarkieren(person, g.juengste, 'posteingang');
        else if (g.quelle === 'imap') await imapAktion(person, g.postfachId, g.nachrichten, 'zurueck');
      }
      return { text: 'Wieder in der Inbox.' };
    }
    case 'zuordnen': {
      const kontaktId = o.kontaktId ?? g.zuordnung?.kontaktId;
      if (!kontaktId) throw new AktionsFehler('Zu diesem Gespräch gibt es noch keine Person in der Kartei — erst „Kontakt anlegen“.');
      const k = (await kontakteFuerVerarbeitung()).find(x => x.id === kontaktId);
      if (!k) throw new AktionsFehler('Diese Person gibt es nicht (oder ihre Verarbeitung ist eingeschränkt).', 409);
      if (k.werbesperre) throw new AktionsFehler('Für diese Person gilt eine Werbesperre — kein Eintrag im Verlauf.', 409);
      await gespraechSetzen(person, id, { zuordnung: { kontaktId, am: new Date().toISOString() } });
      const n = await verlaufNachziehen(person, id);
      return { text: n ? `Zugeordnet — ${n} ${n === 1 ? 'Nachricht steht' : 'Nachrichten stehen'} jetzt im Verlauf der Akte.` : 'Zugeordnet.' };
    }
    case 'loesen': {
      await gespraechSetzen(person, id, { zuordnung: null });
      return { text: 'Zuordnung gelöst — neue Nachrichten kommen nicht mehr in den Verlauf (bestehende Zeilen bleiben in der Akte).' };
    }
    case 'zulassen':
    case 'blocken':
    case 'offen': {
      await absenderSetzen(person, g.absender, aktion === 'zulassen' ? 'zugelassen' : aktion === 'blocken' ? 'geblockt' : null);
      return { text: aktion === 'zulassen' ? 'Zugelassen — Post von dieser Adresse kommt direkt in die Fächer.' : aktion === 'blocken' ? 'Geblockt — Post von dieser Adresse erscheint nicht mehr (nichts wird gelöscht).' : 'Entscheidung zurückgenommen.' };
    }
  }
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
