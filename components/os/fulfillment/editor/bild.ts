// ─── Fulfillment · Prozess-Editor — vom Editor-Modell zur Zeichnung (17.10.) ──────────────────────────────────────────────────────────────
// Der Editor zeichnet mit DENSELBEN Bauteilen wie die Ansicht (components/os/ui/reise/{ReiseBild,Fluss}.tsx — kein zweites Darstellungs-Bauteil).
// Hier steht nur die Übersetzung: Editor-Knoten → Fluss-Knoten (Form, Satz darunter), Editor-Phasen → Spalten der Reise (höchstens vier Kästchen, Raute,
// Band „Kunde“), und die Reihenfolge der Schritte einer Phase (für Pfeiltasten und „nach oben/unten“). Rein, ohne Daten-Importe.

import type { EditorKnoten, EditorModell, EditorPhase } from '@/lib/fulfillment/prozesse/editor';
import { flussFormVon, KAESTCHEN_MAX, type FlussKnoten } from '@/lib/fulfillment/prozesse/reise-bild';
import type { BildSpalte } from '@/lib/reise/bild';
import { bestaetigungTitel } from '@/lib/fulfillment/prozesse/darstellung';
import type { KnotenForm } from '@/lib/fulfillment/typen';

/** Die Form, mit der ein Baustein in den Fluss bzw. auf die Fläche kommt (Mail → Nachricht, Ritual → Termin, Freigabe → Abstimmung). */
export const formFuerBaustein = (art: string): KnotenForm => (art === 'mail' ? 'nachricht' : art === 'ritual' ? 'termin' : art === 'freigabe' ? 'abstimmung' : 'schritt');

const tage = (n: number) => `${n} Tag${n === 1 ? '' : 'e'}`;

/** Der kurze Satz unter einem Knoten im Editor: Frist, wer es macht, Bausteine. */
export function knotenUnter(k: EditorKnoten): string | undefined {
  const t = [
    k.frist !== undefined ? `Frist ${tage(k.frist)}` : null,
    k.zustaendig === 'kunde' ? 'macht der Kunde' : k.zustaendig === 'beide' ? 'gemeinsam' : null,
    k.bausteine.length ? `${k.bausteine.length} Baustein${k.bausteine.length === 1 ? '' : 'e'}` : null,
  ].filter(Boolean).join(' · ');
  return t || undefined;
}

/** Ein Editor-Knoten als Fluss-Knoten (dieselbe Zeichnung wie im Fall; Zustand im Editor immer „offen“). */
export function alsFlussKnoten(k: EditorKnoten): FlussKnoten {
  const unter = knotenUnter(k);
  return { id: k.id, titel: k.titel, form: flussFormVon(k.form), zustand: 'offen', ...(k.form === 'entscheidung' ? { entscheid: true as const } : {}), ...(unter ? { unter } : {}), knoten: true };
}

/** Die Schritte einer Phase in Lese-Reihenfolge — ohne Nein-Zweige (die stehen neben ihrer Entscheidung) — mit ihrem Abschnitt. */
export function flacheSchritte(p: EditorPhase): { knoten: EditorKnoten; abschnitt: string }[] {
  return p.abschnitte.flatMap(a => a.knoten.filter(k => !k.neinVon).map(k => ({ knoten: k, abschnitt: a.schluessel })));
}

/** Die Phasen des Editors als Spalten der Reise: Kästchen (höchstens vier, Rest „+n“), Raute am Ende, Band „Kunde“ (sieht er die Phase, was macht er). */
export function editorSpalten(m: EditorModell): BildSpalte[] {
  return m.phasen.map(p => {
    const alle = flacheSchritte(p).map(x => x.knoten);
    const zeigen = alle.slice(0, KAESTCHEN_MAX);
    const beimKunden = alle.filter(k => k.zustaendig === 'kunde' || k.zustaendig === 'beide').length;
    return {
      id: p.id, nr: p.nr, titel: p.titel, zustand: 'offen' as const,
      unter: alle.length ? `${alle.length} Schritt${alle.length === 1 ? '' : 'e'}` : 'noch leer',
      kaestchen: zeigen.map(k => ({ id: k.id, titel: k.titel, form: flussFormVon(k.form), zustand: 'offen' as const })),
      mehr: alle.length - zeigen.length,
      ...(p.abstimmung ? { raute: { titel: bestaetigungTitel(p.abstimmung.nr, p.abstimmung.titel || undefined), gegeben: false } } : {}),
      band: { ...(beimKunden ? { text: `${beimKunden} beim Kunden` } : { text: p.kundeSichtbar ? 'sieht die Phase' : '' }), intern: !p.kundeSichtbar },
    };
  });
}
