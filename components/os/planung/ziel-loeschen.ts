// ─── MAKE OS — Ziel löschen: Bezüge lösen, mit „Rückgängig“ (01.10. · 07.10. Seil) ─────────────
// EINE Stelle für die Liste und das Ziel-Detail. Kevin: „Mehrere Meilensteine zu einem Ziel“ — wer das Ziel löscht, verliert
// nicht die Meilensteine: der Server löst nur ihren Ziel-Bezug (`zielId`, app/api/state/ziele), sie stehen weiter in
// Ziele & Planung (ohne Ziel). Seit 07.10. (Seil) genauso: Unterziele (`oberzielId`), Aufgaben und Projekte, die direkt darauf
// einzahlen (`zielId`) — die Antwort nennt sie (`bezuegeGeloest`). Der Hinweis zählt sie; „Rückgängig“ legt das Ziel wieder an
// und setzt die Bezüge über POST /api/planung/bezuege zurück (nur, wo das Feld noch leer ist).

import type { MutableRefObject } from 'react';
import { ohneStand } from '@/lib/make-one/liste-stand';
import type { Ziel } from '@/lib/planung/typen';
import type { BezuegeGeloest } from '@/lib/planung/bezuege';
import type { PlanungStand } from './usePlanung';
import type { Rueckgaengig } from '../ui';

const zahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Der Satz für den Hinweis: was ohne Ziel weiterläuft. */
export function geloestText(g: readonly BezuegeGeloest[]): string {
  const s = g.reduce((a, x) => ({ ms: a.ms + x.meilensteine.length, z: a.z + x.ziele.length, k: a.k + x.aufgaben.length + x.projekte.length }), { ms: 0, z: 0, k: 0 });
  const teile = [s.ms ? zahl(s.ms, 'Meilenstein', 'Meilensteine') : '', s.z ? zahl(s.z, 'Unterziel', 'Unterziele') : '', s.k ? zahl(s.k, 'Aufgabe/Projekt', 'Aufgaben/Projekte') : ''].filter(Boolean);
  return teile.length ? ` — ${teile.join(', ')} ${s.ms + s.z + s.k === 1 ? 'bleibt' : 'bleiben'} ohne Ziel` : '';
}

/**
 * Löscht das Ziel sofort (abwartbar); `stand` ist der jüngste Stand (das Zurückholen läuft später). `aufgabenNeu` läuft, wenn der
 * Server Aufgaben/Projekte geändert hat (nach dem Löschen und nach „Rückgängig“) — die Aufgaben-Sicht lädt dann neu, sonst gäbe die
 * nächste Änderung an einer dieser Aufgaben 409. Liefert, wie viele Bezüge gelöst wurden.
 */
export async function loescheZiel(stand: MutableRefObject<PlanungStand>, id: string, rueck: Rueckgaengig, o: { aufgabenNeu?: () => void } = {}): Promise<number> {
  const p = stand.current;
  const alt = p.ziele.find(z => z.id === id);
  if (!alt) return 0;
  // Rückfall (ältere Antwort ohne `bezuegeGeloest`): die Meilensteine, die der Browser kennt.
  const kinder = p.ms.filter(m => m.zielId === id).map(m => m.id);
  const r = await p.persistZieleJetzt(p.ziele.filter(z => z.id !== id));
  if (!r.ok) return 0;
  const geloest = r.bezuegeGeloest.length ? r.bezuegeGeloest : kinder.length ? [{ zielId: id, ziele: [], meilensteine: kinder, aufgaben: [], projekte: [] }] : [];
  const aufgabenBetroffen = geloest.some(g => g.aufgaben.length || g.projekte.length);
  if (aufgabenBetroffen) o.aufgabenNeu?.();
  rueck.melden(`Ziel „${alt.titel}“ gelöscht${geloestText(geloest)}`, () => {
    void (async () => {
      const q = stand.current;
      if (q.ziele.some(z => z.id === id)) return;
      const zurueck = await q.persistZieleJetzt([...q.ziele, ohneStand(alt as Ziel & { stand?: string })]);
      if (!zurueck.ok) return;
      for (const g of geloest) {
        await fetch('/api/planung/bezuege', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ art: 'zurueck', geloest: g }) }).catch(() => null);
      }
      await Promise.all([stand.current.msNeuLaden(), geloest.some(g => g.ziele.length) ? stand.current.zieleNeuLaden() : Promise.resolve()]);
      if (aufgabenBetroffen) o.aufgabenNeu?.();
    })();
  });
  return geloest.reduce((n, g) => n + g.meilensteine.length + g.ziele.length + g.aufgaben.length + g.projekte.length, 0);
}
