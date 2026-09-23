// ─── MAKE OS — Zurufe ───────────────────────────────────────────────────────
// Kevins Ansage: „Bau zwischendrin unregelmäßig schöne Nachrichten für die
// Person ein und gib Mindset mit. Und bei Malin immer mal wieder, dass Kevin
// an sie denkt, dass er sie liebt und froh ist, sie zu haben — damit sie
// unregelmäßig was von mir hört."
//
// Zwei Regeln, damit daraus keine Werbebanner werden:
//   · UNREGELMÄSSIG heißt wirklich unregelmäßig — kein fester Takt, den man
//     nach drei Tagen ignoriert.
//   · Jeder Zuruf wird erst wieder gezeigt, wenn alle anderen dran waren.
//
// Die Liebeszeilen sind in Kevins Stimme geschrieben und für Malin gedacht.
// Sie sagen nichts, was er nicht so sagen würde.

export type ZurufArt = 'liebe' | 'mindset' | 'ruhe';

export interface Zuruf {
  id: string;
  art: ZurufArt;
  /** Für wen — 'malin', 'kevin' oder beide. */
  fuer: 'malin' | 'kevin' | 'beide';
  text: string;
  /** Wer spricht. Leer = das System selbst. */
  von?: string;
}

export const ZURUFE: Zuruf[] = [
  // ── Von Kevin für Malin ───────────────────────────────────────────────────
  { id: 'l1', art: 'liebe', fuer: 'malin', von: 'Kevin', text: 'Ich denke gerade an dich. Nur damit du es weißt.' },
  { id: 'l2', art: 'liebe', fuer: 'malin', von: 'Kevin', text: 'Ich bin froh, dass du da bist. Nicht nur heute.' },
  { id: 'l3', art: 'liebe', fuer: 'malin', von: 'Kevin', text: 'Ohne dich wäre das hier alles nur Arbeit. Mit dir ist es unseres.' },
  { id: 'l4', art: 'liebe', fuer: 'malin', von: 'Kevin', text: 'Ich liebe dich. Und ich weiß, wie viel du hier trägst.' },
  { id: 'l5', art: 'liebe', fuer: 'malin', von: 'Kevin', text: 'Egal wie der Tag läuft — wir kriegen das zusammen hin.' },
  { id: 'l6', art: 'liebe', fuer: 'malin', von: 'Kevin', text: 'Danke, dass du die Zahlen im Griff hast, wenn ich woanders bin.' },
  { id: 'l7', art: 'liebe', fuer: 'malin', von: 'Kevin', text: 'Wenn du das hier liest: Ich hab dich lieb, Schatz.' },
  { id: 'l8', art: 'liebe', fuer: 'malin', von: 'Kevin', text: 'Wir bauen das für uns beide. Vergiss das nicht, wenn es gerade viel ist.' },

  // ── Haltung, für beide ────────────────────────────────────────────────────
  { id: 'm1', art: 'mindset', fuer: 'beide', text: 'Das Wichtigste zuerst. Der Rest wartet — er hat es bisher immer getan.' },
  { id: 'm2', art: 'mindset', fuer: 'beide', text: 'Eine Sache zu Ende bringen schlägt fünf Sachen anfangen.' },
  { id: 'm3', art: 'mindset', fuer: 'beide', text: 'Was du heute aufschreibst, musst du morgen nicht mehr im Kopf tragen.' },
  { id: 'm4', art: 'mindset', fuer: 'beide', text: 'Zahlen lügen nicht, aber sie erklären auch nichts. Frag nach dem Warum.' },
  { id: 'm5', art: 'mindset', fuer: 'beide', text: 'Ein System, das nur läuft, wenn du gut drauf bist, ist kein System.' },
  { id: 'm6', art: 'mindset', fuer: 'beide', text: 'Delegieren heißt nicht abgeben, sondern jemandem zutrauen.' },
  { id: 'm7', art: 'mindset', fuer: 'beide', text: 'Der beste Zeitpunkt für die unangenehme Aufgabe war heute Morgen. Der zweitbeste ist jetzt.' },
  { id: 'm8', art: 'mindset', fuer: 'kevin', text: 'Rechtssicher vor Umsatz. Ein Fundament, das wackelt, trägt kein Wachstum.' },
  { id: 'm9', art: 'mindset', fuer: 'kevin', text: 'Du baust hier etwas, das in Jahren noch stehen soll. Bau entsprechend.' },

  // ── Ruhe und Körper ───────────────────────────────────────────────────────
  { id: 'r1', art: 'ruhe', fuer: 'beide', text: 'Kurz aufstehen, Fenster auf, zwei Minuten. Der Bildschirm läuft nicht weg.' },
  { id: 'r2', art: 'ruhe', fuer: 'kevin', text: 'Rücken. Du weißt, was jetzt dran wäre.' },
  { id: 'r3', art: 'ruhe', fuer: 'beide', text: 'Wenn du seit zwei Stunden sitzt: Das hier ist dein Zeichen.' },
  { id: 'r4', art: 'ruhe', fuer: 'beide', text: 'Feierabend ist auch eine Entscheidung. Triff sie bewusst.' },
];

/** Die Zurufe, die für diese Person infrage kommen. */
export const zurufeFuer = (person: string) =>
  ZURUFE.filter(z => z.fuer === 'beide' || z.fuer === person);

/**
 * Der nächste Zuruf: bevorzugt einer, der noch nie dran war. Sind alle durch,
 * fängt die Runde von vorn an — der am längsten zurückliegende zuerst.
 */
export function naechsterZuruf(
  person: string,
  gezeigt: Record<string, string>,
): Zuruf | null {
  const pool = zurufeFuer(person);
  if (!pool.length) return null;
  const frisch = pool.filter(z => !gezeigt[z.id]);
  const kandidaten = frisch.length
    ? frisch
    : pool.slice().sort((a, b) => (gezeigt[a.id] ?? '').localeCompare(gezeigt[b.id] ?? ''));
  // Etwas Zufall, damit es sich nicht wie eine Liste anfühlt.
  const fenster = kandidaten.slice(0, Math.min(4, kandidaten.length));
  return fenster[Math.floor(Math.random() * fenster.length)] ?? null;
}

/** Unregelmäßiger Abstand: zwischen gut einer und knapp vier Stunden. */
export const naechsterAbstandMs = () => (70 + Math.random() * 160) * 60_000;
