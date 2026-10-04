'use client';

// ─── Kartei · Person löschen (Art. 17) — EIN Weg für Zeile und Karteikarte (04.10.) ──────────────────────────────────────
// Kevin 04.10.: „alles anpassbar“ — auch eine Person lässt sich aus der Liste heraus löschen (Wischen/Knopf am Rand). Der Weg
// bleibt der DSGVO-Weg (POST /api/crm/datenschutz: Löschprotokoll ohne Personendaten, Folgen in Deals/Aufgaben/Apple, Art. 19):
// Rückfrage („besser oft: Werbesperre“) → Grund fürs Protokoll → Ergebnis als Hinweis zum Abarbeiten. Eine eingeschränkte
// Person (Art. 18) wird nicht gelöscht — sie heißt „aufbewahren“. Kein Papierkorb: Art. 17 verlangt, dass die Daten gehen.

import type { ReactNode } from 'react';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { useRueckfrage } from '../../ui';
import { useNachfrage } from '../Nachfrage';
import type { CrmApi } from '../daten';

export interface LoeschAntwort { dealsOhnePerson?: { id: string; titel: string }[]; aufgabenPruefen?: string[]; vollstaendig?: boolean; hinweis?: string; warnung?: string; inApple?: number; uebergaben?: string[] }

/**
 * Ergebnis des Löschens (Art. 17) als Hinweis zum Abarbeiten (W3, 28.09.): Deals, an denen nur diese Person hing,
 * und Aufgaben, die sie nur beim Namen nennen (nicht geändert). Nichts offen → null.
 */
export function loeschErgebnis(r: LoeschAntwort): string | null {
  const deals = r.dealsOhnePerson ?? [];
  const aufgaben = r.aufgabenPruefen ?? [];
  const teile = [
    // Paket D-C (#21): nicht alle Bestände bestätigt — das Löschprotokoll steht auf „unvollständig“, MAKE OS holt es nach.
    r.vollstaendig === false ? (r.hinweis ?? 'Nicht alle Bestände bestätigt — wird automatisch nachgeholt.') : '',
    r.warnung ?? '',
    deals.length ? `${deals.length === 1 ? '1 Deal hat' : `${deals.length} Deals haben`} jetzt keine Person mehr: ${deals.slice(0, 5).map(d => `„${d.titel}“`).join(', ')}${deals.length > 5 ? ' …' : ''} — unter Deals eine Person zuordnen oder den Deal schließen.` : '',
    // Art. 19 (03.10.): an Kunden übergeben — der Empfänger muss von der Löschung erfahren.
    ...(r.uebergaben ?? []),
    aufgaben.length ? `${aufgaben.length === 1 ? '1 Aufgabe nennt' : `${aufgaben.length} Aufgaben nennen`} den Namen noch (nicht geändert) — bitte unter Aufgaben prüfen.` : '',
    // K2 (29.09.): Kalender/Erinnerungen/Kontakte sind Spiegel aus Apple — dort löschen, sonst kommt es mit dem Abgleich zurück.
    r.inApple ? `${r.inApple === 1 ? '1 Eintrag in Apple oder Google (Kalender, Erinnerungen, Kontakte oder Gmail) nennt' : `${r.inApple} Einträge in Apple oder Google (Kalender, Erinnerungen, Kontakte oder Gmail) nennen`} die Person — bitte dort löschen (MAKE OS spiegelt nur).` : '',
  ].filter(Boolean);
  return teile.length ? `Gelöscht.\n${teile.join('\n')}` : null;
}

/** `loeschen(k)` führt den ganzen Art.-17-Weg; `dialog` einmal einhängen (Rückfrage + Grund). `nachher` z. B. Auswahl schließen. */
export function useArt17(api: CrmApi): { loeschen: (k: Kontakt, nachher?: () => void) => Promise<void>; dialog: ReactNode } {
  const { bestaetigen, dialog: rueckfrage } = useRueckfrage();
  const { frage, dialog: nachfrage } = useNachfrage();
  const loeschen = async (k: Kontakt, nachher?: () => void) => {
    if (k.eingeschraenkt) { api.setFehler(`${anzeigename(k)}: Löschen erst nach dem Aufheben der Einschränkung (Art. 18) — sie heißt „aufbewahren“.`); return; }
    if (!(await bestaetigen({ titel: `${anzeigename(k)} endgültig löschen (Art. 17)?`, text: 'Die Person geht ganz — mit Verlauf, Einwilligungen und Notizen; nur ein Löschprotokoll ohne Personendaten bleibt. Besser oft: Werbesperre (dann bleibt „nicht anschreiben“ erhalten) oder Archivieren (nur aus der Liste ausblenden).', ja: 'Endgültig löschen', gefahr: true }))) return;
    const grund = await frage('Grund für das Löschprotokoll', { vorgabe: 'Löschverlangen Art. 17', hinweis: 'Ohne Personendaten — der Eintrag bleibt als Nachweis.' });
    if (grund === null) return;
    const r = await fetch('/api/crm/datenschutz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, grund }) }).then(x => x.json()).catch(() => null) as ({ ok?: boolean; fehler?: string } & LoeschAntwort) | null;
    if (!r?.ok) { api.setFehler(r?.fehler ?? 'Nicht gelöscht.'); return; }
    nachher?.();
    // W3 (28.09.): was jetzt zu tun ist — Deals ohne Person, Aufgaben, die den Namen noch nennen.
    const text = loeschErgebnis(r);
    await api.laden(true);
    if (text) api.setHinweis(text);
  };
  return { loeschen, dialog: <>{rueckfrage}{nachfrage}</> };
}
