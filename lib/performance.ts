// ─── MAKE OS — vom Wachstums-Score bleibt nur die Namensregel ───────────────────────────────────────────────────────────────────────
// Bis 21.10. rechnete diese Datei den Wachstums-Score (Performance-Index): Gesundheit, Business, Planung, Finanzen, Familie, Agenten in EINER
// Zahl. Kevin 21.10.: „Am Ende müssen wir Privat wie auch im Business einen Score haben, der alles zusammenbringt“ — seitdem gibt es nur noch
// zwei Scores (lib/scores): den Privat-Score je Person und den Business-Score (= Business-Index). Die gemischte Rechnung ist weg; gespeicherte
// Verläufe (`performance`, `performance--<person>`) bleiben liegen und werden nicht mehr geschrieben.

import { speicherFuer } from '@/lib/zoe/raum';

export type Person = string;
/** Der Bestandsname je Person — EINE Regel mit `speicherFuer` (lib/zoe/raum.ts, 09.10.: vorher hier eine zweite Kopie mit festem Namen). */
export const personDatei = (name: string, person: Person) => speicherFuer(name, person);
