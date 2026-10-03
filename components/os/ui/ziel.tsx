'use client';

// ─── Standard · Ziel-Bezug (03.10., DESIGN_STANDARD.md › Umgestellt: Kern) ───
// Kevins Leitidee „immer der Fokus auf die Ziele“: wo eine Aufgabe (oder ein Termin mit Aufgabe) auf ein Ziel einzahlt, zeigt der Chip es
// ruhig in der Ziel-Farbe der Lichtfäden (vom Server, nie im Browser gerechnet). Reine Anzeige — gelesen wird die vorhandene
// Kette Aufgabe → Meilenstein → Ziel (lib/aufgaben/ziel-bezug.ts), nichts wird gespeichert, kein Feld kommt dazu.

import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { FARBE as C } from '@/lib/make-one/design';
import { useZieleUndMeilensteine } from '@/lib/planung/ziele-client';
import { bezugNachListe, bezugVonAufgabe, type ZielBezug } from '@/lib/aufgaben/ziel-bezug';
import { Chip } from './knoepfe';

/**
 * Der Ziel-Bezug zu einer Aufgabe: `bezug(task)` liefert Ziel, Farbe (vom Server) und Meilenstein oder null. Geladen wird nur,
 * wenn `aktiv` (z. B. wenn überhaupt eine Aufgabe in einer Meilenstein-Liste liegt) — über den EINEN Zwischenspeicher der
 * Planungsdaten (lib/planung/ziele-client.ts), der Kopf der Seiten bleibt ohne Zusatz-Abfragen.
 */
export function useZielBezug(aktiv: boolean): (t: { listeId?: string } | undefined | null) => ZielBezug | null {
  const daten = useZieleUndMeilensteine(aktiv);
  const karte = useMemo(() => (daten ? bezugNachListe(daten.ziele, daten.meilensteine) : new Map<string, ZielBezug>()), [daten]);
  return useMemo(() => (t: { listeId?: string } | undefined | null) => bezugVonAufgabe(t, karte), [karte]);
}

/** Chip „Ziel · <Titel>“ in der Ziel-Farbe; `titel` am Handy gekürzt (CSS `.ui-ziel-text`). */
export function ZielChip({ bezug, mitMeilenstein }: { bezug: ZielBezug; mitMeilenstein?: boolean }) {
  return (
    <span title={`Zahlt auf das Ziel „${bezug.zielTitel}“ ein — über den Meilenstein „${bezug.meilensteinTitel}“`} style={{ display: 'inline-flex', minWidth: 0, maxWidth: '100%' }}>
      <Chip farbe={bezug.farbe}>
        <Target size={12} strokeWidth={2.2} aria-hidden style={{ flex: '0 0 auto' }} />
        <span className="ui-ziel-text">{bezug.zielTitel}</span>
        {mitMeilenstein && <span style={{ color: C.inkDim, fontWeight: 500 }}>· {bezug.meilensteinTitel}</span>}
      </Chip>
    </span>
  );
}
