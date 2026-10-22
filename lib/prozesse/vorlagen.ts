// ─── Prozesse — Fulfillment-Vorlagen als Prozesse der Landkarte (Etappe A, 21.10.; ANALYSE_100.md Punkte 2, 4, 27) ──────────────────────────────
// Die Vorlagen aus dem Fulfillment-Bestand stehen auf der Landkarte neben den System-Prozessen — dasselbe Modell (`ProzessDef`), nichts kopiert:
//   · Paket (`art: 'paket'`) → Phasen und Schritte aus dem Editor-Modell (lib/fulfillment/prozesse/editor.ts `editorModell` — dieselben Formen, Zweige und
//     Abstimmungspunkte wie im Prozess-Editor); der Drill-down bietet „Im Editor öffnen“.
//   · Landkarte (`art: 'landkarte'`, das Hochhaus) → EINE Kachel „Fulfillment-Landkarte“, Ebene 2 zeigt Dach, Etagen und Fundament; „Im Hochhaus öffnen“
//     führt in den vorhandenen Drill-down (E1).
//   · Ablauf (`art: 'ablauf'`) → Stufen als Phasen; die Stufe der Fliege aus dem Kreislauf-Bezug der Knoten (sonst Fulfillment).
// Rein (Server UND Browser). Die Zahl der Fälle je Knoten rechnet der Server mit `kundenJeKnoten` (lib/prozesse/server.ts).

import type { ProzessKnoten, ProzessVorlage } from '@/lib/fulfillment/typen';
import type { KreislaufId } from '@/lib/crm/planung';
import { kinderVon } from '@/lib/fulfillment/regeln';
import { editorModell } from '@/lib/fulfillment/prozesse/editor';
import { flussFormVon } from '@/lib/fulfillment/prozesse/reise-bild';
import { bestaetigungTitel } from '@/lib/fulfillment/prozesse/darstellung';
import { WEG } from '@/lib/wege';
import type { KernStufe, ProzessDef, ProzessPhase, ProzessSchritt } from './typen';

/** Welche Stufe der Fliege ein Kreislauf-Bezug meint (lib/crm/planung.ts `KreislaufId`). */
export const STUFE_VON_KREISLAUF: Readonly<Record<KreislaufId, KernStufe>> = {
  kanaele: 'marketing', leads: 'sales', deals: 'sales', followup: 'sales', fulfillment: 'fulfillment', nachher: 'ausbau', wiederkauf: 'ausbau',
};

const VORLAGEN_STECKBRIEF = { eingang: 'Mandat mit Produkt und Zielen', ergebnis: 'Phasen erledigt, Abstimmungspunkte bestätigt', empfaenger: 'Kunde', eigner: 'Head of Kundenerfolg' };

/** Die Phasen eines Pakets wie im Editor: je Phase ihre Schritte (Gruppen aufgelöst), Zweige, Abstimmungspunkt. */
function paketPhasen(v: ProzessVorlage): ProzessPhase[] {
  const m = editorModell(v);
  return m.phasen.map(p => ({
    id: p.id, titel: p.titel,
    schritte: p.abschnitte.flatMap(a => a.knoten).map((k): ProzessSchritt => ({
      id: k.id, titel: k.titel, form: flussFormVon(k.form),
      ...(k.zweige?.ja ? { ja: k.zweige.ja } : {}), ...(k.zweige?.nein ? { nein: k.zweige.nein } : {}),
      ...(k.zustaendig === 'kunde' ? { wer: 'Kunde' } : k.zustaendig === 'beide' ? { wer: 'gemeinsam' } : {}),
    })),
    ...(p.abstimmung ? { abstimmung: bestaetigungTitel(p.abstimmung.nr, p.abstimmung.titel || undefined) } : {}),
  }));
}

/** Kinder der Wurzel als Phasen, deren Kinder als Schritte (Hochhaus, Abläufe) — Bausteine zählen nicht. */
function baumPhasen(v: ProzessVorlage): ProzessPhase[] {
  const w = v.knoten.find(k => !k.elternId);
  if (!w) return [];
  return kinderVon(w.id, v.knoten).map(p => ({
    id: p.id, titel: p.titel,
    schritte: kinderVon(p.id, v.knoten).filter(k => !k.bausteinId).map((k): ProzessSchritt => ({ id: k.id, titel: k.titel, form: k.form ? flussFormVon(k.form) : 'schritt' })),
  }));
}

function stufeVonAblauf(kn: readonly ProzessKnoten[]): KernStufe {
  for (const k of kn) for (const id of k.kreislauf ?? []) if (STUFE_VON_KREISLAUF[id]) return STUFE_VON_KREISLAUF[id];
  return 'fulfillment';
}

/** Eine Vorlage aus dem Fulfillment als Prozess der Landkarte (Quelle „Vorlage“). Ohne Wurzel: null. */
export const prozessAusVorlage = (v: ProzessVorlage): ProzessDef | null => prozessAusVorlageMit(v, false);
/** Dasselbe mit der Marke der Werkstatt (E4, 22.10.): `inWerkstatt` = das Paket wird in der Werkstatt bearbeitet — der Link führt dorthin. */
export function prozessAusVorlageMit(v: ProzessVorlage, inWerkstatt: boolean): ProzessDef | null {
  if (!v.knoten.some(k => !k.elternId)) return null;
  if (v.art === 'landkarte') {
    return {
      id: v.id, titel: v.titel || 'Fulfillment-Landkarte', quelle: 'vorlage', band: 'kern', stufe: 'fulfillment', hochhaus: true,
      steckbrief: { ausloeser: 'Ein Kunde ist in Lieferung', ...VORLAGEN_STECKBRIEF, ergebnis: 'Jeder Kunde steht auf seiner Etage' },
      phasen: baumPhasen(v),
      // Keine eigene Zahl an der Kachel: alle Fälle stehen schon an „Lieferung“ (Punkt 24 — jede Information nur einmal); die Etagen zählen in Ebene 2.
      link: { href: WEG.fulfillment('prozesse'), text: 'Im Hochhaus öffnen' },
    };
  }
  if (v.art === 'paket') {
    return {
      id: v.id, titel: v.titel, quelle: 'vorlage', band: 'kern', stufe: 'fulfillment',
      steckbrief: { ausloeser: v.zusatz ? 'Zusatzmodul an einem laufenden Fall' : 'Fall startet aus diesem Paket', ...VORLAGEN_STECKBRIEF },
      phasen: paketPhasen(v),
      editor: WEG.fulfillment('prozesse', { e: v.id }),
      // E4 (22.10.): ein Paket mit Marke `werkstatt:` bearbeitet nur die Werkstatt.
      link: inWerkstatt ? { href: WEG.prozesse({ p: v.id, ansicht: 'werkstatt' }), text: 'In der Werkstatt öffnen' } : { href: WEG.fulfillment('prozesse', { e: v.id }), text: 'Im Editor öffnen' },
    };
  }
  return {
    id: v.id, titel: v.titel, quelle: 'vorlage', band: 'kern', stufe: stufeVonAblauf(v.knoten),
    steckbrief: { ausloeser: 'Ablauf aus der Bibliothek', eingang: 'Fall bzw. Kontakt', ergebnis: 'Stufen des Ablaufs durchlaufen', empfaenger: 'Kunde', eigner: 'Head of Kundenerfolg' },
    phasen: baumPhasen(v),
    link: { href: WEG.fulfillment('prozesse'), text: 'Fulfillment › Übersicht' },
  };
}
