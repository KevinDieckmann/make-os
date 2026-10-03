'use client';

// ─── Standard · Ziel-Bezug (03.10., DESIGN_STANDARD.md › Umgestellt: Kern) ───
// Kevins Leitidee „immer der Fokus auf die Ziele“: wo eine Aufgabe (oder ein Termin mit Aufgabe) auf ein Ziel einzahlt, zeigt der Chip es
// ruhig in der Ziel-Farbe der Lichtfäden. Reine Anzeige — gelesen wird die vorhandene Kette Aufgabe → Meilenstein → Ziel
// (lib/aufgaben/ziel-bezug.ts), nichts wird gespeichert, kein Feld kommt dazu.

import { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { FARBE as C } from '@/lib/make-one/design';
import { meilensteineHolen } from '../planung/MeilensteinVerweis';
import { bezugNachListe, bezugVonAufgabe, type ZielBezug, type ZielRoh } from '@/lib/aufgaben/ziel-bezug';
import type { Meilenstein } from '@/lib/planung/typen';
import { Chip } from './knoepfe';

/** Alle Ziele aller Horizonte (nur lesen), 60 Sekunden gemerkt — der Chip steht in jeder Zeile, die Abfrage nur einmal je Seite. */
let zieleLadung: { t: number; p: Promise<ZielRoh[]> } | null = null;
function zieleHolen(): Promise<ZielRoh[]> {
  if (!zieleLadung || Date.now() - zieleLadung.t > 60_000) {
    const p = fetch('/api/state/ziele', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then((d: Record<string, unknown> | null) => {
      const liste: ZielRoh[] = [];
      for (const h of ['jahr', 'quartal', 'monat', 'woche', 'tag']) {
        const l = d?.[h];
        if (Array.isArray(l)) for (const z of l as ZielRoh[]) if (z && typeof z.id === 'string' && !liste.some(x => x.id === z.id)) liste.push({ id: z.id, titel: z.titel, space: z.space, rang: z.rang, erledigt: z.erledigt });
      }
      return liste;
    }).catch(() => { zieleLadung = null; return [] as ZielRoh[]; });
    zieleLadung = { t: Date.now(), p };
  }
  return zieleLadung.p;
}

/**
 * Der Ziel-Bezug zu einer Aufgabe: `bezug(task)` liefert Ziel, Farbe und Meilenstein oder null. Geladen wird nur, wenn `aktiv` (z. B.
 * wenn überhaupt eine Aufgabe in einer Meilenstein-Liste liegt) — der Kopf der Seiten bleibt ohne Zusatz-Abfragen.
 */
export function useZielBezug(aktiv: boolean): (t: { listeId?: string } | undefined | null) => ZielBezug | null {
  const [karte, setKarte] = useState<ReadonlyMap<string, ZielBezug>>(new Map());
  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    void Promise.all([zieleHolen(), meilensteineHolen()]).then(([z, m]) => { if (lebt) setKarte(bezugNachListe(z, m as Meilenstein[])); });
    return () => { lebt = false; };
  }, [aktiv]);
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
