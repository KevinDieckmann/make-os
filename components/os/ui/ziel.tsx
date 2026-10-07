'use client';

// ─── Standard · Ziel-Bezug (03.10., DESIGN_STANDARD.md › Umgestellt: Kern) ───
// Kevins Leitidee „immer der Fokus auf die Ziele“: wo eine Aufgabe (oder ein Termin mit Aufgabe) auf ein Ziel einzahlt, zeigt der Chip es
// ruhig in der Ziel-Farbe der Lichtfäden (vom Server, nie im Browser gerechnet). Reine Anzeige — gelesen wird das wirksame Ziel
// (lib/aufgaben/ziel-bezug.ts `zielVonAufgabe`: Meilenstein-Liste → eigenes „zahlt ein auf“ → Hauptaufgabe → Projekt; 07.10. Seil).

import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { FARBE as C } from '@/lib/make-one/design';
import { useZieleUndMeilensteine } from '@/lib/planung/ziele-client';
import { bezugNachListe, bezugVonAufgabe, type AufgabeZielRoh, type ZielBezug } from '@/lib/aufgaben/ziel-bezug';
import { Chip } from './knoepfe';

/**
 * Der Ziel-Bezug zu einer Aufgabe: `bezug(task)` liefert Ziel, Farbe (vom Server) und — über einen Meilenstein — dessen Titel, oder null.
 * Geladen wird nur, wenn `aktiv` (z. B. wenn überhaupt eine Aufgabe einen Bezug haben kann) — über den EINEN Zwischenspeicher der
 * Planungsdaten (lib/planung/ziele-client.ts). Mit `bestand` (Aufgaben + Projekte) zählen auch direkte Bezüge, Hauptaufgaben und Projekte.
 */
export function useZielBezug(aktiv: boolean, bestand?: { tasks: readonly AufgabeZielRoh[]; projects?: readonly { id: string; zielId?: string }[] }): (t: AufgabeZielRoh | { listeId?: string } | undefined | null) => ZielBezug | null {
  const daten = useZieleUndMeilensteine(aktiv);
  const karte = useMemo(() => (daten ? bezugNachListe(daten.ziele, daten.meilensteine) : new Map<string, ZielBezug>()), [daten]);
  const extra = useMemo(() => (daten && bestand ? {
    ziele: new Map(daten.ziele.map(z => [z.id, z])),
    nachId: new Map(bestand.tasks.map(t => [t.id, t])),
    projekte: new Map((bestand.projects ?? []).map(p => [p.id, p])),
  } : undefined), [daten, bestand]);
  return useMemo(() => (t: AufgabeZielRoh | { listeId?: string } | undefined | null) => bezugVonAufgabe(t, karte, extra), [karte, extra]);
}

const UEBER: Record<ZielBezug['ueber'], string> = { meilenstein: '', aufgabe: 'direkt verknüpft', eltern: 'über die Hauptaufgabe', projekt: 'über das Projekt' };

/** Chip „Ziel · <Titel>“ in der Ziel-Farbe; `titel` am Handy gekürzt (CSS `.ui-ziel-text`). */
export function ZielChip({ bezug, mitMeilenstein }: { bezug: ZielBezug; mitMeilenstein?: boolean }) {
  const titel = bezug.meilensteinTitel
    ? `Zahlt auf das Ziel „${bezug.zielTitel}“ ein — über den Meilenstein „${bezug.meilensteinTitel}“`
    : `Zahlt auf das Ziel „${bezug.zielTitel}“ ein — ${UEBER[bezug.ueber]}`;
  return (
    <span title={titel} style={{ display: 'inline-flex', minWidth: 0, maxWidth: '100%' }}>
      <Chip farbe={bezug.farbe}>
        <Target size={12} strokeWidth={2.2} aria-hidden style={{ flex: '0 0 auto' }} />
        <span className="ui-ziel-text">{bezug.zielTitel}</span>
        {mitMeilenstein && bezug.meilensteinTitel && <span style={{ color: C.inkDim, fontWeight: 500 }}>· {bezug.meilensteinTitel}</span>}
      </Chip>
    </span>
  );
}
