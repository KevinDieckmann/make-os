'use client';

// ─── Fulfillment · Prozess-Editor — Ziehen & Ablegen (17.10.) ─────────────────────────────────────────────────────────────────────────────
// Ohne Bibliothek, mit Pointer-Events (Vorbild: components/os/aufgaben/Ziehen.tsx):
//   · Maus und Trackpad: greifen und ziehen ab 5 px Bewegung — ein Klick ohne Bewegung wählt nur aus.
//   · Finger/Stift: LANGE DRÜCKEN (0,45 s, kaum bewegen), dann ziehen; wer vorher wischt, scrollt wie immer. Während des Ziehens scrollt die Seite nicht,
//     am Rand rollt sie mit. Escape bricht ab.
//   · Was gezogen wird: ein neuer Knoten aus der Palette, ein Schritt im Fluss, eine Phase in der Reise.
//   · Wohin (Markierung im DOM, `data-ff-ziel`): ein Schritt (obere Hälfte = davor, untere = dahinter), eine Gruppe (ans Ende), „nach der Gruppe“, der Start
//     (an den Anfang), das Ende der Phase, der freie Nein-Platz einer Entscheidung, eine Phasen-Pille (Phase: davor/dahinter; Schritt: ans Ende dieser Phase).
//   · Ungültiges zeigt sich rot mit Satz und wird nicht abgelegt — die Regeln prüft der Server noch einmal (lib/fulfillment/prozesse/editor.ts).
// Die Tastatur-Alternative steht am Knoten (Alt+Pfeile, Entf, Enter) und im Seitenfeld („Einfügen nach …“, „Verschieben nach …“).
// Seit 17.10. liegt die Bedienung selbst (Maus ab 5 px, Finger 0,45 s, Escape, Rand-Rollen, Anzeige) EINMAL in components/os/ui/reise/ziehen.tsx
// (`useReiseZiehen`) — Planung › Ziel nutzt sie für die Meilensteine; hier stehen nur die Quellen und Ziele des Editors.

import type { KnotenForm } from '@/lib/fulfillment/typen';
import type { EditorZiel } from '@/lib/fulfillment/prozesse/editor';
import { useReiseZiehen, stufenZielBei, MAUS_AB_PX, LANG_MS, type ZiehTreffer } from '../../ui/reise/ziehen';

export { MAUS_AB_PX, LANG_MS };

export type ZiehQuelle =
  | { art: 'neu'; form: KnotenForm | 'baustein'; titel: string }
  | { art: 'schritt'; id: string; titel: string; phaseId: string }
  | { art: 'phase'; id: string; titel: string };
export type ZiehZiel =
  | { art: 'fluss'; ziel: EditorZiel; text: string }
  | { art: 'nein'; entscheidungId: string; text: string }
  | { art: 'phase'; nach: string | null; text: string }
  | { art: 'in-phase'; phaseId: string; text: string };

/** Das Ziel unter dem Zeiger — aus den Markierungen `data-ff-ziel` (rein aus dem DOM gelesen, keine Rechnung). */
function zielBei(x: number, y: number, q: ZiehQuelle): ZiehTreffer<ZiehZiel> | null {
  if (q.art === 'phase') {
    const t = stufenZielBei(x, y, q.id);
    return t ? { ...t, ziel: { art: 'phase', ...t.ziel } } : null;
  }
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const z = el?.closest<HTMLElement>('[data-ff-ziel]');
  if (!z) return null;
  const rect = z.getBoundingClientRect();
  const art = z.getAttribute('data-ff-ziel');
  const id = z.getAttribute('data-ff-id') ?? '';
  const phaseId = z.getAttribute('data-ff-phase') ?? '';
  const titel = z.getAttribute('data-ff-titel') ?? '';
  if (art === 'phase') return { ziel: { art: 'in-phase', phaseId: id, text: `ans Ende von „${titel}“` }, rect };
  if (art === 'schritt') {
    if (q.art === 'schritt' && id === q.id) return null;
    const oben = y < rect.top + rect.height / 2;
    return { ziel: { art: 'fluss', ziel: { phaseId, ...(oben ? { vor: id } : { nach: id }) }, text: oben ? `vor „${titel}“` : `hinter „${titel}“` }, rect, linie: oben ? 'oben' : 'unten' };
  }
  if (art === 'gruppe') return { ziel: { art: 'fluss', ziel: { phaseId, inGruppe: id }, text: `in „${titel}“` }, rect };
  if (art === 'nachgruppe') return { ziel: { art: 'fluss', ziel: { phaseId, nachGruppe: id }, text: `hinter „${titel}“` }, rect };
  if (art === 'anfang') return { ziel: { art: 'fluss', ziel: { phaseId, anfang: true }, text: 'an den Anfang' }, rect };
  if (art === 'ende') return { ziel: { art: 'fluss', ziel: { phaseId }, text: 'ans Ende der Phase' }, rect };
  if (art === 'nein') return { ziel: { art: 'nein', entscheidungId: id, text: `als Nein-Zweig von „${titel}“` }, rect };
  return null;
}

const sameQuelle = (a: ZiehQuelle, b: ZiehQuelle) => a.art === b.art && (a.art === 'neu' ? a.form === (b as typeof a).form : a.id === (b as { id: string }).id);

/** Ziehen im Editor: `griff(quelle)` auf das Ziehbare legen; `pruefen` sagt, was nicht geht (Satz), `ablegen` führt aus. */
export function useEditorZiehen({ pruefen, ablegen, aus }: { pruefen: (q: ZiehQuelle, z: ZiehZiel) => string | null; ablegen: (q: ZiehQuelle, z: ZiehZiel) => void; aus?: boolean }) {
  return useReiseZiehen<ZiehQuelle, ZiehZiel>({ zielBei, pruefen, ablegen, gleich: sameQuelle, aus });
}
