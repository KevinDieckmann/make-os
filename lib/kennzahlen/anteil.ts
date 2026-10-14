// ─── „n von m“ und „ist von soll“ — nie grün ohne Grundlage (rein, client-sicher) ─────────────────────────────────────────────────
// Unabhängige Abnahme 14.10. (B12, B14): „Business-Ziele im Plan 0 / 0“ und „Rücklage 0 € von 0 € — gedeckt“ standen GRÜN da, obwohl es weder ein
// Ziel noch eine Schätzung gab. EINE Regel für jede Kachel dieser Art: ohne Gesamt bzw. ohne Soll ist der Stand „leer“ — die Ansicht zeigt dann
// einen Leerzustand mit Weg, nie eine grüne Ampel und nie „0 / 0“. Wächter: tests/zahlen-stimmigkeit.test.ts.

export type AnteilStufe = 'leer' | 'gut' | 'achtung';

export interface AnteilStand {
  stufe: AnteilStufe;
  /** „3 / 4“ — bei `leer` ein Strich (nie „0 / 0“). */
  wert: string;
}

/** Erreicht von gesamt (z. B. Ziele im Plan): ohne Gesamt `leer`, sonst grün nur, wenn alle erreicht sind. */
export function anteilStand(erreicht: number, gesamt: number): AnteilStand {
  if (!(gesamt > 0)) return { stufe: 'leer', wert: '—' };
  return { stufe: erreicht >= gesamt ? 'gut' : 'achtung', wert: `${Math.max(0, erreicht)} / ${gesamt}` };
}

export interface DeckungStand {
  stufe: AnteilStufe;
  /** Was zum Soll fehlt (≥ 0). */
  fehlt: number;
}

/** Ist von Soll (z. B. Steuerrücklage): ohne Soll `leer` — „0 € von 0 €“ ist keine Deckung, sondern eine fehlende Schätzung. */
export function deckungStand(ist: number, soll: number): DeckungStand {
  if (!(soll > 0)) return { stufe: 'leer', fehlt: 0 };
  const fehlt = Math.max(0, Math.round((soll - ist) * 100) / 100);
  return { stufe: fehlt > 0 ? 'achtung' : 'gut', fehlt };
}
