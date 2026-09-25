// ─── Autonomie der Heads: interne Kleinigkeiten selbst (Kevin, 25.09.) ──────
// „Interne Kleinigkeiten selbst — Daten pflegen, nächsten Schritt an der
// Person setzen, Aufgaben für euch anlegen: automatisch, mit Protokoll und
// Rücknahme. Alles mit Kontakt nach außen bleibt zur Freigabe.“
// Risiko-Stufen nach dem OpenAI-Leitfaden: was nur MAKE OS verändert und sich
// zurücknehmen lässt, darf der Head selbst; was nach außen wirkt, nie.
//   automatisch   ohne Entwurf, ohne Kampagne, kein Merksatz, keine Werbesperre
//     → mit Person und Frist, und an der Person steht noch KEIN nächster
//       Schritt: der Vorschlag wird ihr nächster Schritt (Power Hour)
//     → sonst: eine Aufgabe für die Person, für die er ist
//   zur Freigabe  alles mit Entwurf (Text nach außen), Kampagnen (viele
//                 Personen), Merksätze (ändern die Regeln des Heads)
// Rücknahme: Der nächste Schritt wird nur zurückgesetzt, wenn er noch so
// steht, wie der Head ihn gesetzt hat; die Aufgabe nur gelöscht, wenn sie
// noch offen und unverändert ist. Eine Rücknahme zählt als Ablehnung
// („passt nicht“) — daraus lernt der Head.

import type { Kontakt } from '@/lib/make-one/crm';
import type { HeadVorschlag } from './stand';

export type AutoWirkung = 'schritt' | 'aufgabe';

/**
 * Modi ohne Selbst-Übernahme: Die Power Hour und das Event-Nachfassen SIND
 * schon die Liste der Handlungen — würde der Head daraus nächste Schritte
 * setzen, kämen dieselben Personen morgen als „Zusage“ ganz nach oben und die
 * Liste schaukelte sich selbst hoch. Fragen erzeugen nie etwas.
 */
export const OHNE_AUTO_MODI = new Set(['power_hour', 'nachfassen', 'frage', 'netzwerk']);
/** Meta-Arten („pflegen“, „schärfen“) werden Aufgaben, nie ein nächster Schritt an einer Person. */
const NUR_AUFGABE = new Set(['daten_pflegen', 'ziel_schaerfen', 'positionierung_schaerfen', 'liste_bereinigen', 'format_anpassen']);

/** Was der Head mit diesem Vorschlag selbst tun darf — null = zur Freigabe. */
export function automatisch(v: HeadVorschlag, k: Kontakt | undefined): AutoWirkung | null {
  if (v.status !== 'offen' || v.entwurf || v.kampagne || v.art === 'merken') return null;
  if (v.kontakt_id) {
    if (!k || k.werbesperre) return null;
    return v.frist && !k.naechsterSchritt && !NUR_AUFGABE.has(v.art) ? 'schritt' : 'aufgabe';
  }
  return 'aufgabe';
}

export const aufgabeIdFuer = (v: Pick<HeadVorschlag, 'id'>) => `hd-${v.id}`;

/** Die Aufgabe zu einem Vorschlag — dieselbe Form wie beim Annehmen von Hand. */
export function aufgabeAus(v: HeadVorschlag, headName: string, agentId: string, bearbeiter: string, jetzt: string): Record<string, unknown> {
  return {
    id: aufgabeIdFuer(v), title: v.titel.slice(0, 200),
    description: `Vorschlag des ${headName}: ${v.begruendung}${v.belege?.length ? `\n\nBelege: ${v.belege.join(' | ')}` : ''}`,
    status: 'todo', priority: v.prioritaet === 'hoch' ? 'high' : v.prioritaet === 'niedrig' ? 'low' : 'medium',
    assignee: bearbeiter, tags: [agentId, 'markttraktion'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, ...(v.frist ? { dueDate: v.frist } : {}),
  };
}

/** Darf zurückgenommen werden, ohne etwas zu überschreiben, das inzwischen jemand geändert hat? */
export function ruecknehmbar(v: HeadVorschlag, k: Kontakt | undefined, aufgabe: { status?: string; createdAt?: string; updatedAt?: string } | undefined): boolean {
  const r = v.auto?.rueckgaengig;
  if (!r) return false;
  if (r.art === 'schritt') return !!k && k.naechsterSchritt?.text === v.titel.slice(0, 300) && k.naechsterSchritt?.datum === v.frist;
  return !aufgabe || (aufgabe.status === 'todo' && aufgabe.updatedAt === aufgabe.createdAt);
}
