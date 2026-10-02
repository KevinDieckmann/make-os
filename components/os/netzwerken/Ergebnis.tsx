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

/** Sprünge aus der Antwort des Servers auf eine Erfassung. */
export function linksAusAntwort(a: QueueStand['antworten'][string] | undefined, schritt: NetzwerkSchritt | undefined): ErgebnisLink[] {
  if (!a) return [];
  return ergebnisLinks({
    schritt: schritt ?? 'nur-kontakt', ...(a.kontaktId ? { kontaktId: a.kontaktId } : {}), ...(a.eventId ? { eventId: a.eventId } : {}),
    ...(a.terminUid ? { terminId: a.terminUid } : {}), ...(a.terminTag ? { terminAm: a.terminTag } : {}), ...(a.dealId ? { dealId: a.dealId } : {}), ...(a.followupId ? { followupId: a.followupId } : {}),
  });
}

/** „Ohne Termin abschließen (stattdessen Follow-up)“ — nur, wenn der Termin ging nicht (kein Kalender, iCloud weg), die Person aber erfasst ist. */
export function OhneTerminKnopf({ e, onOhneTermin }: { e: WarteEintrag; onOhneTermin: (id: string) => void }) {
  if (!e.teilweise) return null;
  return <Gross ton="warn" onClick={() => onOhneTermin(e.id)} kleinerAbstand>Ohne Termin abschließen (stattdessen Follow-up)</Gross>;
}
