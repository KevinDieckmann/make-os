// ─── Regelwerk-Rückfall für Morgen- und Abendlauf (27.09.) ──────────────────
// Ohne KI (kein Schlüssel oder Guthaben leer) fällt der Lauf nicht aus, er wird
// Regelwerk: ein ehrlicher Lagesatz aus den Zahlen, die ohnehin da sind. Er
// stapelt nichts (Vorschläge ohne Herleitung wären Arbeit für Kevin), aber der
// Takt bekommt einen Erfolg statt eines Fehlschlags — und die Nachricht sagt,
// was liegt. Rein und getestet.

import type { Brain } from '@/lib/brain';

export type Tageszeit = 'morgen' | 'abend';

/** Der Tag eines Kalendereintrags — die Quellen nennen das Feld verschieden. */
const tagVon = (e: unknown): string => { const x = e as { date?: string; datum?: string; tag?: string; start?: string }; return String(x.date ?? x.datum ?? x.tag ?? x.start ?? '').slice(0, 10); };

export function regelBericht(b: Pick<Brain, 'tasks' | 'kalender' | 'geld' | 'shields' | 'heute'>, zeit: Tageszeit): string {
  const teile: string[] = [];
  const t = b.tasks;
  const n = (k: number, e: string, m: string) => `${k} ${k === 1 ? e : m}`;
  if (zeit === 'morgen') {
    if (t.overdue.length) teile.push(`${n(t.overdue.length, 'Aufgabe', 'Aufgaben')} überfällig`);
    if (t.dueToday.length) teile.push(`${t.dueToday.length} heute fällig`);
    if (t.kritisch.length) teile.push(`${t.kritisch.length} kritisch`);
    if (!b.kalender.stale && b.kalender.heute.length) teile.push(`${n(b.kalender.heute.length, 'Termin', 'Termine')} heute`);
  } else {
    if (t.overdue.length) teile.push(`${t.overdue.length} überfällig geblieben — auf morgen datieren oder streichen`);
    if (!b.kalender.stale && b.kalender.woche.some(e => tagVon(e) > b.heute)) teile.push('morgen steht ein Termin — abends kurz vorbereiten');
  }
  if (b.geld.ueberfaelligeForderungen > 0) teile.push(`${n(b.geld.ueberfaelligeForderungen, 'überfällige Forderung', 'überfällige Forderungen')}`);
  if (b.shields.length) teile.push(`${n(b.shields.length, 'Frühwarnung', 'Frühwarnungen')} aktiv`);
  const kopf = zeit === 'morgen' ? 'Ohne KI (Regelwerk): ' : 'Tagesabschluss ohne KI (Regelwerk): ';
  return kopf + (teile.length ? `${teile.join(' · ')}.` : zeit === 'morgen' ? 'nichts Dringendes in den Zahlen — der Tag ist frei von meiner Seite.' : 'nichts blieb liegen, das morgen drängt.');
}
