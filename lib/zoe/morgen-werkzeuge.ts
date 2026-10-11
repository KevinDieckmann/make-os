// ─── Morgen-/Abendlauf: die zwei Werkzeuge, die er vorschlagen darf (Prüf-Funde 11.10.) ──────────────────────────────────────────────
// Vorher stand das Schema von `plan_block` eigens in app/api/zoe/morgen (startMin/dauerMin als beliebige Zahl, ohne Raster) — seit V3 prüft die
// Hülle (`fuehreAus` → `vertragsPruefung`) gegen den Vertrag aus lib/zoe/werkzeug-defs.ts (Raster 15, Fenster 360–1305, Dauer 15–240), und jeder
// Block außerhalb des Rasters fiel still weg. Jetzt: dasselbe Schema wie der Vertrag (EINE Quelle), und ein Wert neben dem Raster wird auf 15 Minuten
// GERUNDET (das Verhalten vor V3) statt verworfen. Was außerhalb des Fensters liegt, lehnt der Vertrag weiter ab (kein stilles Verschieben).

import { werkzeugDefs, type WerkzeugDef } from './werkzeug-defs';

/** Nur diese Werkzeuge darf der Morgenlauf vorschlagen (nichts mit Geld). */
export const MORGEN_ERLAUBT = ['create_task', 'plan_block'] as const;

const CREATE_TASK: WerkzeugDef = {
  name: 'create_task',
  description: 'Schlägt eine Aufgabe vor. Nur für Dinge, die aus der Lage KLAR folgen — eine überfällige Rechnung, ein Termin ohne Vorbereitung, ein Meilenstein ohne nächsten Schritt. Keine Allgemeinplätze.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Imperativ, konkret, unter 80 Zeichen' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      why: { type: 'string', description: 'Ein Satz: woraus folgt das' },
      faellig: { type: 'string', description: 'YYYY-MM-DD (optional)' },
    },
    required: ['title', 'why'],
  },
};

/** Die Werkzeuge des Laufs — `plan_block` mit dem Schema des Vertrags, nur die Beschreibung auf den Lauf zugeschnitten. */
export function morgenWerkzeuge(): WerkzeugDef[] {
  const pb = werkzeugDefs().get('plan_block');
  if (!pb) return [CREATE_TASK];
  return [CREATE_TASK, {
    name: 'plan_block',
    description: 'Schlägt einen Block im Tagesplan vor — Fokuszeit, Routine, Vorbereitung. Nur in freie Zeit; feste Termine stehen im Live-Zustand. Fenster 06:00–22:00, Raster 15 Minuten.',
    input_schema: pb.input_schema,
  }];
}

const rund15 = (v: unknown): unknown => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n / 15) * 15 : v;
};

/** Ein Block aus dem Modell aufs 15-Minuten-Raster (rein): Start und Dauer gerundet, Dauer mindestens 15. Andere Werkzeuge unverändert. */
export function morgenEingabe(werkzeug: string, eingabe: Record<string, unknown>): Record<string, unknown> {
  if (werkzeug !== 'plan_block') return eingabe;
  const start = rund15(eingabe.startMin);
  const dauer = rund15(eingabe.dauerMin);
  return {
    ...eingabe,
    ...(eingabe.startMin !== undefined ? { startMin: start } : {}),
    ...(eingabe.dauerMin !== undefined ? { dauerMin: typeof dauer === 'number' ? Math.max(15, dauer) : dauer } : {}),
  };
}
