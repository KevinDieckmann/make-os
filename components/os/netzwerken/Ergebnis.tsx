'use client';

// ─── Netzwerken — Ergebnis einer Erfassung: Kennungen → Sprünge und „Ohne Termin abschließen“ (03.10.) ───
// Vorher endete die Fertig-Seite bei „Zur Person“ — der Termin, der Deal, das Follow-up und das Event waren nicht erreichbar,
// obwohl der Server sie angelegt hatte. Der Server liefert jetzt alle Kennungen (`terminUid`, `dealId`, `followupId`, `eventId`);
// `ergebnisLinks` (lib/crm/netzwerken.ts) macht daraus die Sprünge — dieselbe Liste wie im Abendbericht.
// Angezeigt werden sie als `LinkChips` (bausteine.tsx) auf der Fertig-Seite (Erfassen) und im Abendbericht (Heute).

import { ergebnisLinks, type ErgebnisLink } from '@/lib/crm/netzwerken';
import type { NetzwerkSchritt } from '@/lib/crm/typen';
import { Gross } from './bausteine';
import type { QueueStand } from './useNetzwerken';
import type { WarteEintrag } from '@/lib/netzwerken/warteschlange';

/** Sprünge aus der Antwort des Servers auf eine Erfassung — Termin, Deal, Follow-up, Angebot, Make.One-Gästeliste, Aufgabe, Event. `erfassungId` ergibt die festen Kennungen von Aufgabe und Angebot. */
export function linksAusAntwort(a: QueueStand['antworten'][string] | undefined, schritt: NetzwerkSchritt | undefined, erfassungId?: string): ErgebnisLink[] {
  if (!a) return [];
  const s = schritt ?? 'nur-kontakt';
  return ergebnisLinks({
    schritt: s, ...(erfassungId ? { erfassungId } : {}), ...(a.kontaktId ? { kontaktId: a.kontaktId } : {}), ...(a.eventId ? { eventId: a.eventId, ...(a.eventBesuch ? { besuch: true } : {}) } : {}),
    ...(a.terminUid ? { terminId: a.terminUid } : {}), ...(a.terminTag ? { terminAm: a.terminTag } : {}), ...(a.dealId ? { dealId: a.dealId } : {}), ...(a.followupId ? { followupId: a.followupId } : {}),
    ...(a.angebotId ? { angebotId: a.angebotId } : {}), ...(a.makeoneEventId ? { makeoneEventId: a.makeoneEventId } : {}),
    // Make.One ohne Event (und ohne Werbesperre) legt eine Aufgabe an — der Server nennt dann weder Event noch Hinweis „Werbesperre“.
    aufgabe: s === 'andere' || (s === 'makeone' && !a.makeoneEventId && !(a.hinweise ?? []).some(h => h.startsWith('Werbesperre'))),
  });
}

/** „Ohne Termin abschließen (stattdessen Follow-up)“ — nur, wenn der Termin ging nicht (kein Kalender, iCloud weg), die Person aber erfasst ist. */
export function OhneTerminKnopf({ e, onOhneTermin }: { e: WarteEintrag; onOhneTermin: (id: string) => void }) {
  if (!e.teilweise) return null;
  return <Gross ton="warn" onClick={() => onOhneTermin(e.id)} kleinerAbstand>Ohne Termin abschließen (stattdessen Follow-up)</Gross>;
}
