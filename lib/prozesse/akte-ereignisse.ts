// ─── Prozesse × Fulfillment — der Lauf meldet für die Akte wie ein Fall (29.10., Kreislauf F-B4; rein, nur Server-Aufrufer) ─────────────────────────────
// Vorher meldeten NUR Paket-Fälle (lib/fulfillment/prozesse/fall-server.ts `fallEreignisse`) „Phase begonnen/abgeschlossen“ (`fall-phase`) und „Schritt im Fall
// erledigt“ (`fall-schritt-erledigt`) — Begleit-Vorlagen der Werkstatt griffen darum nur im Onboarding einer Akte. Jetzt meldet der SCHARFE Lauf eines Mandats,
// dessen Akte auf seinen Prozess zeigt (`Fall.ablauf`), dieselben Ereignisse mit DENSELBEN Kennungen-Schemata (lib/ereignisse/quellen.ts `fallDiff` /
// `fallBegleitDiff`): Schritt = Knoten des Prozesses, Phase = Phase des Prozesses, Tag = Tag des Geschehens (nie „heute“ — so meldet ein späterer Blick dasselbe
// Ereignis mit derselben Kennung, die Ereignisstelle nimmt es nur einmal). Nur, was in den letzten `FENSTER_TAGE` geschah (ein alter Lauf flutet nie).
// Welche Schritte zählen: dieselben wie in der Reise (`produktAblaufAnsicht` — kein Auslöser, kein Ende, kein Schloss, nichts Ausgeschaltetes).

import type { ProzessDefinition } from './definition';
import type { ProzessLauf } from './lauf-typen';
import type { EreignisBereich, EreignisEingabe } from '@/lib/ereignisse/typen';
import { ereignisKennung } from '@/lib/ereignisse/typen';
import { phasen, schritteDer } from './fluss';
import { knotenStand } from './lauf-regeln';
import { tagVon } from '@/lib/zeit';

/** Wie weit zurück ein Lauf noch meldet (Tage) — ältere Schritte und Phasen wurden schon gemeldet bzw. sind zu alt, um noch etwas auszulösen. */
export const FENSTER_TAGE = 2;

export interface AkteBasis {
  mandatId: string; firmaId?: string; kontaktId?: string;
  bereich: EreignisBereich; arbeit?: true;
}

/** Die Ereignisse eines Laufs an einer Akte (rein). `jetzt` ISO. Nur scharfe Läufe eines Mandats — sonst leer. */
export function akteEreignisse(l: Pick<ProzessLauf, 'modus' | 'fall' | 'schritte' | 'prozessId' | 'status'>, def: Pick<ProzessDefinition, 'knoten'>, b: AkteBasis, jetzt: string): EreignisEingabe[] {
  if (l.modus !== 'scharf' || l.fall.art !== 'mandat' || l.fall.id !== b.mandatId) return [];
  const ab = new Date(Date.parse(jetzt) - FENSTER_TAGE * 86_400_000).toISOString();
  const stand = knotenStand(l as ProzessLauf);
  const basis = { mandatId: b.mandatId, ...(b.firmaId ? { firmaId: b.firmaId } : {}), ...(b.kontaktId ? { kontaktId: b.kontaktId } : {}) };
  const ber = { bereich: b.bereich, ...(b.arbeit ? { arbeit: b.arbeit } : {}) };
  const raus: EreignisEingabe[] = [];
  for (const p of phasen(def)) {
    const schritte = schritteDer(def, p.id).filter(k => k.form !== 'ausloeser' && k.form !== 'ende' && !k.schloss && !k.deaktiviert);
    if (!schritte.length) continue;
    const st = schritte.map(k => stand[k.id]);
    // Schritt erledigt (Kennung wie `fallDiff`: Mandat, Knoten, Tag der Erledigung).
    for (const [i, k] of schritte.entries()) {
      const s = st[i];
      if (s?.status !== 'erledigt' || !s.bis || s.bis < ab) continue;
      raus.push({ id: ereignisKennung('fall', b.mandatId, k.id, tagVon(s.bis)), art: 'fall-schritt-erledigt', quelle: 'fulfillment', ...ber, bezug: { ...basis, knotenId: k.id } });
    }
    // Phase begonnen (erster Schritt mit Stand) bzw. abgeschlossen (alle zählenden erledigt) — Kennung wie `fallBegleitDiff`, Tag des Geschehens.
    const begonnen = st.filter((x): x is NonNullable<typeof x> => !!x).map(x => x.ab).sort()[0];
    const bezug = { ...basis, vorlageId: l.prozessId, knotenId: p.id };
    if (begonnen && begonnen >= ab) raus.push({ id: ereignisKennung('fall', b.mandatId, 'phase', p.id, 'begonnen', tagVon(begonnen)), art: 'fall-phase', quelle: 'fulfillment', ...ber, stufe: 'begonnen', bezug });
    const zaehlend = st.filter(x => !x || (x.status !== 'uebersprungen' && x.status !== 'abgebrochen' && x.status !== 'abgelaufen'));
    const fertig = zaehlend.length > 0 && zaehlend.every(x => x?.status === 'erledigt');
    const ende = fertig ? zaehlend.map(x => x!.bis ?? x!.ab).sort().at(-1) : undefined;
    if (ende && ende >= ab) raus.push({ id: ereignisKennung('fall', b.mandatId, 'phase', p.id, 'abgeschlossen', tagVon(ende)), art: 'fall-phase', quelle: 'fulfillment', ...ber, stufe: 'abgeschlossen', bezug });
  }
  return raus;
}
