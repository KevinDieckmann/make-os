// ─── MAKE OS — Demo-Instanz: ein Beispiel-Ablauf für den Prozess-Editor (17.10.; DESIGN_STANDARD.md › Prozess-Visualisierung › Editor) ─────────────
// Kevin 17.10. (Antwort auf die Fragen des Editor-Agenten): die Demo bekommt einen Beispiel-Ablauf mit Entscheidung (ja/nein) und Erinnerung in einer Paket-
// Vorlage, damit man den Editor vorführen kann. Gesät NUR über die Editor-Route (`/api/fulfillment/editor`, wie im Browser): „+ Neuer Ablauf“ (POST
// `neu`), dann EINE Änderung mit Schritten, Nachricht, Entscheidung samt Nein-Erinnerung, Termin, Abstimmungspunkt und einer zweiten Phase (PATCH mit Stand).
// Erfunden und neutral (Wächter tests/demo.test.ts liest jede Datei der Demo); keine Namen, keine Beträge.

import type { FulfillmentSaatKontext, SaatSchritt } from './saat-fulfillment';
import { neueKennung } from '@/lib/kennung';

/** Der Titel des Beispiel-Ablaufs (auch für den Wächter: genau einer). */
// 19.10. (Rundgang B13): vorher „Vom Angebot zum Start“ mit „Angebot angenommen?“ — ein Fall gehört zu einem laufenden Mandat, dort ist diese Frage erledigt
// (lib/fulfillment/regeln.ts `angebotAngenommenWirksam`). Das Beispiel zeigt Entscheidung und Erinnerung deshalb an einer Frage, die im Mandat offen sein kann.
export const EDITOR_BEISPIEL_TITEL = 'Beispiel · Vom Konzept zum Start';

interface KnotenJ { id: string; elternId?: string; titel: string }

export async function editorBeispielSaeen(k: FulfillmentSaatKontext): Promise<SaatSchritt[]> {
  const L = k.inhaber;
  const editor = (methode: 'POST' | 'PATCH', body: unknown) => k.rufe(k.routen.editor(), methode, '/api/fulfillment/editor', L, body);
  // 1) „+ Neuer Ablauf“ — eine leere Paket-Vorlage mit Start und einer Phase.
  const neu = await editor('POST', { aktion: 'neu', titel: EDITOR_BEISPIEL_TITEL, phase: 'Konzept', anfrageId: 'demo-editor-beispiel' });
  const vorlageId = neu.vorlageId as string;
  const knoten = ((neu.vorlage as { knoten?: KnotenJ[] } | undefined)?.knoten ?? []);
  const wurzel = knoten.find(x => !x.elternId);
  const konzept = knoten.find(x => x.elternId === wurzel?.id);
  if (!vorlageId || !konzept) return [{ name: 'Fulfillment: Beispiel-Ablauf im Editor', anzahl: 0 }];
  // 2) Der Ablauf, wie man ihn im Editor zieht: Schritt → Nachricht → Entscheidung (nein: Erinnerung, danach zurück) → Termin; Abstimmungspunkt am Ende der
  //    Phase; eine zweite Phase „Start“ mit Nachricht und Schritt. Neue Knoten bringen ihre Kennung mit (`fk-<uuid>`, wie der Browser).
  const id = () => neueKennung('fk');
  const [bedarf, senden, angenommen, erinnern, termin, start, willkommen, zugaenge] = [id(), id(), id(), id(), id(), id(), id(), id()];
  const ops = [
    { op: 'schritt-neu', id: bedarf, ziel: { phaseId: konzept.id }, form: 'schritt', titel: 'Bedarf aufnehmen', frist: 2, zustaendig: 'intern' },
    { op: 'schritt-neu', id: senden, ziel: { phaseId: konzept.id, nach: bedarf }, form: 'nachricht', titel: 'Konzept senden', frist: 3, kundeSichtbar: true },
    { op: 'schritt-neu', id: angenommen, ziel: { phaseId: konzept.id, nach: senden }, form: 'entscheidung', titel: 'Konzept freigegeben?', frist: 7, zustaendig: 'kunde', kundeSichtbar: true },
    { op: 'nein-erinnerung', id: erinnern, entscheidungId: angenommen, titel: 'Nach einer Woche nachfassen' },
    { op: 'schritt-neu', id: termin, ziel: { phaseId: konzept.id, nach: angenommen }, form: 'termin', titel: 'Start-Termin vereinbaren', zustaendig: 'beide', kundeSichtbar: true },
    { op: 'abstimmung', phaseId: konzept.id, an: true, titel: 'Konzept bestätigt', wer: 'beide' },
    { op: 'phase-neu', id: start, titel: 'Start', nach: konzept.id },
    { op: 'schritt-neu', id: willkommen, ziel: { phaseId: start }, form: 'nachricht', titel: 'Willkommen senden', frist: 1, kundeSichtbar: true },
    { op: 'schritt-neu', id: zugaenge, ziel: { phaseId: start, nach: willkommen }, form: 'schritt', titel: 'Zugänge einrichten', frist: 5 },
  ];
  await editor('PATCH', { vorlageId, stand: neu.stand, ops });
  return [{ name: 'Fulfillment: Beispiel-Ablauf im Editor', anzahl: ops.length }];
}
