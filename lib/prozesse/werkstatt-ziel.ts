// ─── Prozesse · Werkstatt — was ein Link mit Schritt bzw. Phase wählt (Feinschliff 1, 23.10.; Sichtprüfung 22.10.) ──────────────────────────────────────
// Befund: `/os/prozesse?p=…&ph=…&s=<knoten>&ansicht=werkstatt` zeigte den Schritt nur in den Brotkrumen. Die Werkstatt (components/os/prozesse/Werkstatt.tsx)
// fragt hier, was die Adresse (lib/prozesse/adresse.ts) meint: einen Schritt (wählen, Panel zeigt seine Einstellungen, Kamera hin) bzw. eine Phase (Rahmen
// wählen und einpassen) — und ob dafür eine zugeklappte Phase aufgehen muss. Ein Schritt, den es im Entwurf nicht (mehr) gibt (die Landkarte zeigt die
// veröffentlichte Version), fällt auf seine Phase zurück, sonst auf nichts. Rein (Server UND Browser); Tests: tests/feinschliff-1.test.ts.

import { alleSchritte, phasen } from './fluss';
import type { ProzessDefinition } from './definition';

export type WerkstattZiel =
  | { art: 'schritt'; id: string; phase: string; aufklappen: boolean }
  | { art: 'phase'; id: string; phase: string; aufklappen: boolean };

/** Was die Adresse wählt — `zu` = die gerade zugeklappten Phasen (Merker und Übersicht). Null: nichts (bzw. nichts Bekanntes). */
export function werkstattZiel(d: Pick<ProzessDefinition, 'knoten'>, adr: { ph?: string | null; s?: string | null }, zu: ReadonlySet<string> = new Set()): WerkstattZiel | null {
  if (adr.s) {
    const t = alleSchritte(d).find(x => x.schritt.id === adr.s);
    if (t) return { art: 'schritt', id: t.schritt.id, phase: t.phase.id, aufklappen: zu.has(t.phase.id) };
  }
  if (adr.ph && phasen(d).some(p => p.id === adr.ph)) return { art: 'phase', id: adr.ph, phase: adr.ph, aufklappen: zu.has(adr.ph) };
  return null;
}
