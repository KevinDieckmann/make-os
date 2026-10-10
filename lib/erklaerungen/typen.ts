// ─── Erklärungen (10.10.) — Typen und die reinen Zusammenbau-Funktionen ──────────────────────────────────────────────────
// Kevin 10.10.: „Wenn man auf die einzelnen Sachen klickt, möchte ich, dass die Erklärung dahinter ist und was es bedeutet — mit
// Fallbeispiel. Das will ich überall.“ Die TEXTE sind Daten (lib/erklaerungen/*.ts, ein Schlüssel je Einstellung/Kennzahl/Head), damit
// eine Instanz sie später anpassen kann; der Baustein (components/os/ui/erklaerung.tsx) zeigt nur Abschnitte „Kopf · Text“.
// Rein und client-sicher: kein React, keine Server-Module. Beispiele sind immer ERFUNDEN und neutral — keine echten Namen, Firmen,
// Beträge, keine Gesundheitsangaben einer Person (Plattform-Regel, Wächter tests/erklaerungen.test.ts).

/** Ein Block der aufgeklappten Erklärung: kleine Beschriftung + ein bis zwei Sätze. */
export interface ErklaerAbschnitt { kopf: string; text: string }

/**
 * Eine Einstellung (Schalter, Wahl, Feld): was sie bedeutet, ein erfundenes Fallbeispiel und — bei Ein/Aus — was sich ändert.
 * `daten` nur, wenn Daten das Haus verlassen oder Geld kostet (Kosten und Datenweg), sonst weglassen.
 */
export interface EinstellungsText {
  was: string;
  beispiel: string;
  an?: string;
  aus?: string;
  daten?: string;
}

/** Eine Kennzahl, die nicht aus einem Index-Register kommt (Kapazität, Fokus-Ampel, Scoreboard …): wie gerechnet · Beispiel · was ihr tun könnt. */
export interface KennzahlText { wie: string; beispiel: string; tun?: string }

/** Ein Head (oder Mitarbeiter): was er tut, was er nie tut, ein erfundener Beispiel-Vorschlag. */
export interface AgentText { tut: string; nie: string; beispiel: string }

export const KOPF = {
  was: 'Was es bedeutet',
  beispiel: 'Beispiel',
  an: 'Wenn an',
  aus: 'Wenn aus',
  daten: 'Kosten und Datenweg',
  wie: 'Wie gerechnet',
  tun: 'Was ihr tun könnt',
  tut: 'Was er tut',
  nie: 'Was er nie tut',
  beispielVorschlag: 'Beispiel-Vorschlag',
  warum: 'Warum',
} as const;

/** Die Abschnitte einer Einstellung — leere Felder fallen weg. */
export function einstellungAbschnitte(t: EinstellungsText): ErklaerAbschnitt[] {
  const a: ErklaerAbschnitt[] = [{ kopf: KOPF.was, text: t.was }, { kopf: KOPF.beispiel, text: t.beispiel }];
  if (t.an) a.push({ kopf: KOPF.an, text: t.an });
  if (t.aus) a.push({ kopf: KOPF.aus, text: t.aus });
  if (t.daten) a.push({ kopf: KOPF.daten, text: t.daten });
  return a;
}

/** Die Abschnitte einer Kennzahl ohne Register (von Hand geschrieben). */
export function kennzahlTextAbschnitte(t: KennzahlText): ErklaerAbschnitt[] {
  const a: ErklaerAbschnitt[] = [{ kopf: KOPF.wie, text: t.wie }, { kopf: KOPF.beispiel, text: t.beispiel }];
  if (t.tun) a.push({ kopf: KOPF.tun, text: t.tun });
  return a;
}

/** Die Abschnitte eines Heads oder Mitarbeiters. */
export function agentAbschnitte(t: AgentText): ErklaerAbschnitt[] {
  return [{ kopf: KOPF.tut, text: t.tut }, { kopf: KOPF.nie, text: t.nie }, { kopf: KOPF.beispielVorschlag, text: t.beispiel }];
}
