// ─── Prozesse × Fulfillment — ein Paket in der Werkstatt bearbeiten (22.10., Fulfillment in die Werkstatt E2) ──────────────────────────────────────────────
// Rein und client-sicher. Jede Änderung läuft durch die Regeln des Fulfillment-Editors (lib/fulfillment/prozesse/editor.ts `editorAnwenden` — Ebenen, Sammel-
// Teilprozess bei Bausteinen, Papierkorb mit Zurückholen, Zweige nur Entscheidung/Erinnerung, Kreise nur über Erinnerung → Entscheidung, Bestätigungen je Phase):
// dieselbe Struktur wie bisher, nichts nachgebaut. Hier nur: die lokale Datei bauen und Verschiebe-Ziele ausrechnen. Gespeichert wird der ganze Entwurf
// (lib/prozesse/fulfillment-entwurf.ts prüft ihn auf dem Server noch einmal).

import type { Baustein, ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';
import { editorAnwenden, editorModell, FORM_VORGABE, type EditorOp } from '@/lib/fulfillment/prozesse/editor';
import { fnv } from '@/lib/fulfillment/prozesse/pruefen';
import type { BibliothekKurz } from './fulfillment-modus';

export type { EditorOp };
export { FORM_VORGABE };

/** Die Formen, die die Palette im Paket anbietet (die Bestätigung hängt an der Phase, nicht am Schritt — wie im Editor des Fulfillments). */
export const PALETTE_FORMEN = ['schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin'] as const;

/** Die lokale Datei für die Regeln des Editors: nur dieses Paket und die Bibliothek in Kürze (die Regeln brauchen nur Kennung, Titel und Art). */
function lokaleDatei(v: ProzessVorlage, bibliothek: readonly BibliothekKurz[]): VorlagenDatei {
  return {
    version: 1, prozesse: [v], rituale: [], zuordnung: {}, agentZusatz: {}, importLaeufe: [], marken: {},
    einstellungen: { kundenLink: { an: false }, pulsSchwelle: 6, willkommenStunden: 24, nachsorgeTage: [] },
    bausteine: bibliothek.map(b => ({ id: b.id, titel: b.titel, art: b.art, gliederung: [], platzhalter: [], tags: [], wer: 'intern', kundeSichtbar: false, fassung: 1, geaendert: '', geaendertVon: '' }) as unknown as Baustein),
  };
}
const standLokal = (x: object): string => fnv(JSON.stringify(x));

export type BearbeitenErgebnis = { ok: true; vorlage: ProzessVorlage } | { ok: false; fehler: string };
/** Änderungen (Ops des Editors) auf die Fassung anwenden — alles oder nichts, mit dem Satz des Editors bei einer Ablehnung. */
export function paketBearbeiten(v: ProzessVorlage, bibliothek: readonly BibliothekKurz[], ops: readonly EditorOp[], k: { person: string; jetzt: string; neueId: (p: string) => string }): BearbeitenErgebnis {
  const r = editorAnwenden(lokaleDatei(v, bibliothek), { vorlageId: v.id, stand: standLokal(v), ops }, { person: k.person, jetzt: k.jetzt, standVon: standLokal, neueId: k.neueId });
  if (!r.ok) return { ok: false, fehler: r.fehler };
  const neu = r.datei.prozesse.find(p => p.id === v.id);
  return neu ? { ok: true, vorlage: neu } : { ok: false, fehler: 'Das Paket fehlt nach der Änderung.' };
}

/** Wohin ein Schritt beim Hoch-/Runterschieben kommt (in seinem Abschnitt der Phase) — null, wenn er schon oben bzw. unten steht. */
export function schrittVerschieben(v: ProzessVorlage, id: string, richtung: 'hoch' | 'runter'): EditorOp | null {
  for (const p of editorModell(v).phasen) for (const a of p.abschnitte) {
    const i = a.knoten.findIndex(k => k.id === id);
    if (i < 0) continue;
    const n = a.knoten[richtung === 'hoch' ? i - 1 : i + 1];
    if (!n) return null;
    return { op: 'schritt-schieben', id, ziel: richtung === 'hoch' ? { phaseId: p.id, vor: n.id } : { phaseId: p.id, nach: n.id } };
  }
  return null;
}
/** Wohin eine Phase beim Verschieben kommt (`nach` = die Phase davor, null = an den Anfang) — null an der Grenze. */
export function phaseVerschieben(v: ProzessVorlage, id: string, richtung: 'hoch' | 'runter'): EditorOp | null {
  const ps = editorModell(v).phasen.map(p => p.id);
  const i = ps.indexOf(id);
  if (i < 0) return null;
  if (richtung === 'hoch') return i === 0 ? null : { op: 'phase-schieben', id, nach: i >= 2 ? ps[i - 2] : null };
  return i === ps.length - 1 ? null : { op: 'phase-schieben', id, nach: ps[i + 1] };
}
/** Die Schritte derselben Phase (für „Ja → weiter bei …“) — ohne den Schritt selbst. */
export function schritteDerPhase(v: ProzessVorlage, id: string): { id: string; titel: string }[] {
  for (const p of editorModell(v).phasen) {
    const l = p.abschnitte.flatMap(a => a.knoten);
    if (l.some(k => k.id === id)) return l.filter(k => k.id !== id).map(k => ({ id: k.id, titel: k.titel }));
  }
  return [];
}
