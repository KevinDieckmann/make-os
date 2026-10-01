// ─── MAKE OS — Aufgaben-Ebenen: mehrstufige Unteraufgaben (01.10.) ──────────
// Kevin 01.10. (Aufgaben › KD Ventures › Meilensteine › Produkte → HOS): „Wir brauchen hier nochmal Unteraufgaben, also
// bei dem HOS unter Produkten. Da müssen wir nochmal Beschreibungen machen können.“
//
// Bis dahin gab es genau zwei Ebenen (Aufgabe → Unteraufgabe; Enkel hängte die Übernahme an das oberste Elternteil).
// Jetzt: ein Baum über `parentId` (keine Formänderung — das Feld gab es schon) bis `AUFGABEN_EBENEN_MAX` Ebenen
// (Hauptaufgabe = Ebene 1). Jede Ebene ist eine vollwertige Aufgabe (Beschreibung, Notiz, Status, Zuständig, Dateien …).
// Kinder erben den Ort (Space/Projekt/Liste) und die Sichtbarkeit „nur ich“ von der Wurzel; Umhängen zieht den ganzen
// Teilbaum mit.
//
// Hier steht alles REIN (Browser + Server, getestet in tests/aufgaben-ebenen.test.ts). Alle Wege sind kreisfest: ein
// kaputter Bestand (A → B → A) hängt nie, die Übernahme (struktur.ts `uebernehmen`) bricht den Kreis auf.

import type { Task } from '@/types/tasks';

/** Höchstens so viele Ebenen (Hauptaufgabe = 1). Die EINE Grenze — Server, Übernahme und Oberfläche lesen sie hier. */
export const AUFGABEN_EBENEN_MAX = 5;

type MitEltern = Pick<Task, 'id' | 'parentId'>;
type NachId<T extends MitEltern = MitEltern> = ReadonlyMap<string, T>;

/** Kennung → Aufgabe (einmal je Durchlauf bauen, nicht je Zeile). */
export const nachIdKarte = <T extends MitEltern>(tasks: readonly T[]): Map<string, T> => new Map(tasks.map(t => [t.id, t]));

/** Elternteil → direkte Kinder (in Bestandsreihenfolge; sortieren macht der Aufrufer). */
export function kinderKarte<T extends MitEltern>(tasks: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of tasks) if (t.parentId) { const l = m.get(t.parentId); if (l) l.push(t); else m.set(t.parentId, [t]); }
  return m;
}

/**
 * Die Vorfahren von unten nach oben (direktes Elternteil zuerst). Hört auf bei fehlendem Elternteil oder einem Kreis
 * (dann ohne die Wiederholung) — nie eine Endlosschleife.
 */
export function vorfahren<T extends MitEltern>(t: MitEltern, nachId: NachId<T>): T[] {
  const raus: T[] = [];
  const gesehen = new Set<string>([t.id]);
  let p = t.parentId ? nachId.get(t.parentId) : undefined;
  while (p && !gesehen.has(p.id)) {
    raus.push(p); gesehen.add(p.id);
    p = p.parentId ? nachId.get(p.parentId) : undefined;
  }
  return raus;
}

/** Die Kette von oben (Hauptaufgabe) bis zum direkten Elternteil — für Brotkrumen. Leer bei einer Hauptaufgabe. */
export const kette = <T extends MitEltern>(t: MitEltern, nachId: NachId<T>): T[] => vorfahren(t, nachId).reverse();

/** Die Hauptaufgabe (Wurzel) — bei einer Hauptaufgabe sie selbst. */
export function wurzelVon<T extends MitEltern>(t: T, nachId: NachId<T>): T {
  const v = vorfahren(t, nachId);
  return v.length ? v[v.length - 1] : t;
}

/** Ebene einer Aufgabe: Hauptaufgabe = 1, ihre Unteraufgabe = 2 … (fehlendes Elternteil = die Kette endet dort). */
export const ebeneVon = (t: MitEltern, nachId: NachId): number => vorfahren(t, nachId).length + 1;

/** Alle Nachfahren (Kinder, Enkel …) in Breitenfolge, ohne die Aufgabe selbst. Kreisfest. */
export function nachfahren<T extends MitEltern>(id: string, kinder: ReadonlyMap<string, readonly T[]>): T[] {
  const raus: T[] = [];
  const gesehen = new Set<string>([id]);
  const offen = [id];
  while (offen.length) {
    const p = offen.shift()!;
    for (const k of kinder.get(p) ?? []) {
      if (gesehen.has(k.id)) continue;
      gesehen.add(k.id); raus.push(k); offen.push(k.id);
    }
  }
  return raus;
}
/** Bequem: Nachfahren direkt aus der Liste (baut die Kinder-Karte selbst). */
export const nachfahrenIn = <T extends MitEltern>(id: string, tasks: readonly T[]): T[] => nachfahren(id, kinderKarte(tasks));

/** Höhe des Teilbaums: nur die Aufgabe = 1, mit Kindern = 2 … (kreisfest). */
export function teilbaumHoehe(id: string, kinder: ReadonlyMap<string, readonly MitEltern[]>): number {
  let hoehe = 1;
  const gesehen = new Set<string>([id]);
  let ebene: string[] = [id];
  while (ebene.length) {
    const naechste: string[] = [];
    for (const p of ebene) for (const k of kinder.get(p) ?? []) if (!gesehen.has(k.id)) { gesehen.add(k.id); naechste.push(k.id); }
    if (naechste.length) hoehe++;
    ebene = naechste;
  }
  return hoehe;
}

/** Kann unter `t` noch eine Unteraufgabe entstehen? (Ebene von `t` < Grenze.) */
export const darfUnteraufgabe = (t: MitEltern, nachId: NachId): boolean => ebeneVon(t, nachId) < AUFGABEN_EBENEN_MAX;

/**
 * Würde `elternId` als neues Elternteil von `id` einen Kreis schließen? (Das Elternteil ist die Aufgabe selbst oder einer
 * ihrer Nachfahren.)
 */
export function waereKreis(id: string, elternId: string, nachId: NachId): boolean {
  if (id === elternId) return true;
  const e = nachId.get(elternId);
  if (!e) return false;
  return vorfahren(e, nachId).some(v => v.id === id);
}

export type ElternFehler = { art: 'fehlt' | 'kreis' | 'tiefe'; text: string };

/**
 * Darf `t` (mit seinem ganzen Teilbaum) unter `elternId` hängen? null = ja. Regeln (Server und Oberfläche gleich):
 *  · das Elternteil gibt es (und es liegt nicht im Papierkorb — `aktiv`),
 *  · kein Kreis (nicht unter sich selbst oder einem eigenen Nachfahren),
 *  · Ebene des Elternteils + Höhe des eigenen Teilbaums ≤ `AUFGABEN_EBENEN_MAX`.
 */
export function elternPruefen(
  t: MitEltern, elternId: string, nachId: NachId<MitEltern & { title?: string; geloeschtAm?: string }>,
  kinder: ReadonlyMap<string, readonly MitEltern[]>, aktiv: (x: { geloeschtAm?: string }) => boolean = x => !x.geloeschtAm,
): ElternFehler | null {
  const e = nachId.get(elternId);
  if (!e || !aktiv(e)) return { art: 'fehlt', text: 'Die übergeordnete Aufgabe gibt es nicht (mehr). Nichts gespeichert.' };
  const titel = (x: { title?: string } | undefined, rueck: string) => `„${(x?.title ?? rueck).slice(0, 60)}“`;
  if (waereKreis(t.id, elternId, nachId)) {
    return { art: 'kreis', text: `Abgelehnt: ${titel(nachId.get(t.id), 'die Aufgabe')} kann nicht unter ${elternId === t.id ? 'sich selbst' : `ihrer eigenen Unteraufgabe ${titel(e, elternId)}`} liegen. Nichts gespeichert.` };
  }
  const tiefe = ebeneVon(e, nachId) + teilbaumHoehe(t.id, kinder);
  if (tiefe > AUFGABEN_EBENEN_MAX) {
    return { art: 'tiefe', text: `Abgelehnt: höchstens ${AUFGABEN_EBENEN_MAX} Ebenen — unter ${titel(e, elternId)} wären es ${tiefe}. Nichts gespeichert.` };
  }
  return null;
}

/**
 * Wählbare neue Elternteile für `t` (Oberfläche „in Unteraufgabe umwandeln“): gleicher Space + Projekt, nicht `t` selbst,
 * kein Nachfahre, offen, und der Teilbaum passt unter die Grenze. `passt` filtert zusätzlich (z. B. Sichtbarkeit).
 */
export function elternKandidaten<T extends MitEltern & Pick<Task, 'spaceId' | 'projectId' | 'status' | 'title'> & { geloeschtAm?: string }>(t: T, tasks: readonly T[], passt: (x: T) => boolean = () => true): T[] {
  const nachId = nachIdKarte(tasks), kinder = kinderKarte(tasks);
  const hoehe = teilbaumHoehe(t.id, kinder);
  return tasks.filter(x => x.id !== t.id && x.id !== t.parentId && x.spaceId === t.spaceId && x.projectId === t.projectId
    && x.status !== 'done' && x.status !== 'cancelled' && !x.geloeschtAm && passt(x)
    && !waereKreis(t.id, x.id, nachId) && ebeneVon(x, nachId) + hoehe <= AUFGABEN_EBENEN_MAX);
}

/** Anzeige-Pfad eines Kandidaten („Produkte › HOS“) — damit gleichnamige Aufgaben unterscheidbar sind. */
export const pfadText = (t: MitEltern & { title: string }, nachId: NachId<MitEltern & { title: string }>): string => [...kette(t, nachId).map(x => x.title), t.title].join(' › ');

/**
 * Anteil fertig (0–1) einer Aufgabe, rekursiv (Meilenstein-Regel, 30.09. → 01.10. für alle Ebenen): erledigt = 1;
 * sonst Mittel der zählenden Kinder (abgebrochene zählen nicht); ohne zählende Kinder 0.
 * Für eine Ebene ist das genau die alte Regel „Anteil erledigter Unteraufgaben“.
 */
export function anteilFertig<T extends MitEltern & Pick<Task, 'status'>>(t: T, kinder: ReadonlyMap<string, readonly T[]>, gesehen: Set<string> = new Set()): number {
  if (t.status === 'done') return 1;
  if (gesehen.has(t.id)) return 0;
  gesehen.add(t.id);
  const k = (kinder.get(t.id) ?? []).filter(x => x.status !== 'cancelled');
  if (!k.length) return 0;
  return k.reduce((s, x) => s + anteilFertig(x, kinder, gesehen), 0) / k.length;
}

/**
 * Den Bestand ordnen (Übernahme): Kreise aufbrechen und zu tiefe Ketten kappen — rein, nie Verlust. Liefert je Aufgabe das
 * gültige Elternteil (`undefined` = Hauptaufgabe), nur für die, die sich ändern.
 *  · Fehlendes Elternteil → Hauptaufgabe (wie bisher).
 *  · Kreis (A → B → A): das Mitglied mit der kleinsten Kennung wird Hauptaufgabe (deterministisch), die übrigen bleiben darunter.
 *  · Tiefer als die Grenze: die Aufgabe hängt an ihrem Vorfahren auf Ebene `AUFGABEN_EBENEN_MAX − 1` (bleibt im selben Ast).
 */
export function elternOrdnen(tasks: readonly MitEltern[]): Map<string, string | undefined> {
  const nachId = nachIdKarte(tasks);
  const eltern = new Map<string, string | undefined>(tasks.map(t => [t.id, t.parentId && nachId.has(t.parentId) && t.parentId !== t.id ? t.parentId : undefined]));
  // Kreise aufbrechen.
  const fertig = new Set<string>();
  for (const t of tasks) {
    if (fertig.has(t.id)) continue;
    const weg: string[] = [];
    const imWeg = new Set<string>();
    let p: string | undefined = t.id;
    while (p && !fertig.has(p) && !imWeg.has(p)) { weg.push(p); imWeg.add(p); p = eltern.get(p); }
    if (p && imWeg.has(p)) {
      const kreis = weg.slice(weg.indexOf(p));
      const kopf = [...kreis].sort()[0];
      eltern.set(kopf, undefined);
    }
    for (const x of weg) fertig.add(x);
  }
  // Zu tief → am Vorfahren der vorletzten erlaubten Ebene einhängen.
  const ebene = new Map<string, number>();
  const ebeneVonId = (id: string): number => {
    const bekannt = ebene.get(id);
    if (bekannt) return bekannt;
    const kette: string[] = [];
    let x: string | undefined = id;
    while (x && !ebene.has(x)) { kette.push(x); x = eltern.get(x); }
    let n = x ? ebene.get(x)! : 0;
    for (let i = kette.length - 1; i >= 0; i--) {
      const k = kette[i];
      n++;
      if (n > AUFGABEN_EBENEN_MAX) {
        // Den Vorfahren auf Ebene MAX − 1 suchen: die Kette hinauf, bis die Ebene passt.
        let v = eltern.get(k);
        while (v && (ebene.get(v) ?? 0) > AUFGABEN_EBENEN_MAX - 1) v = eltern.get(v);
        eltern.set(k, v);
        n = v ? (ebene.get(v) ?? 0) + 1 : 1;
      }
      ebene.set(k, n);
    }
    return ebene.get(id)!;
  };
  for (const t of tasks) ebeneVonId(t.id);
  const raus = new Map<string, string | undefined>();
  for (const t of tasks) if ((eltern.get(t.id) ?? undefined) !== (t.parentId ?? undefined)) raus.set(t.id, eltern.get(t.id));
  return raus;
}

/**
 * Nur die Aufgaben, deren Vorfahren ALLE in `bleibt` stehen (Papierkorb, Archiv „Neu anfangen“): eine Unteraufgabe unter
 * etwas Ausgeblendetem sieht niemand — auf jeder Ebene (vorher: nur das direkte Elternteil). `tasks` = die schon
 * gefilterte Liste, `bleibt` = deren Kennungen. Kreisfest.
 */
export function mitVerbliebenenVorfahren<T extends MitEltern>(tasks: readonly T[], bleibt: ReadonlySet<string>): T[] {
  if (!tasks.some(t => t.parentId)) return [...tasks];
  const nachId = nachIdKarte(tasks);
  const urteil = new Map<string, boolean>();
  const ok = (t: MitEltern): boolean => {
    if (!t.parentId) return true;
    const c = urteil.get(t.id);
    if (c !== undefined) return c;
    urteil.set(t.id, true); // Kreisschutz: ein Kreis blendet nicht aus (die Übernahme bricht ihn ohnehin auf)
    const e = bleibt.has(t.parentId) ? nachId.get(t.parentId) : undefined;
    const r = !!e && ok(e);
    urteil.set(t.id, r);
    return r;
  };
  return tasks.filter(t => ok(t));
}

/**
 * Elternteil aus einer freien Angabe (ZOE `create_task.unter`): Kennung, Titel oder Pfad „Produkte › HOS“ (auch „>“ oder
 * „/“). Nur offene Aufgaben; genauer Titel vor Teiltreffer; mehrdeutig → Fehler mit den Pfaden (ZOE fragt nach). Rein.
 */
export function elternAusText<T extends MitEltern & Pick<Task, 'title' | 'status'>>(tasks: readonly T[], angabe: string): { id: string } | { fehler: string } {
  const roh = angabe.trim();
  if (!roh) return { fehler: 'Keine übergeordnete Aufgabe angegeben.' };
  const direkt = tasks.find(t => t.id === roh);
  if (direkt) return { id: direkt.id };
  const norm = (s: string) => s.toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim();
  const teile = roh.split(/\s*(?:›|>|\/)\s*/).map(norm).filter(Boolean);
  const nachId = nachIdKarte(tasks);
  const offen = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  // Der Pfad muss (von unten gelesen) zur Kette passen: letztes Stück = die Aufgabe, davor ihre Vorfahren in Reihenfolge.
  const passtPfad = (t: T, genau: boolean) => {
    const namen = [...kette(t, nachId).map(x => norm(x.title)), norm(t.title)];
    const letzt = teile[teile.length - 1];
    if (genau ? namen[namen.length - 1] !== letzt : !namen[namen.length - 1].includes(letzt)) return false;
    let i = namen.length - 2;
    for (let k = teile.length - 2; k >= 0; k--) {
      while (i >= 0 && !namen[i].includes(teile[k])) i--;
      if (i < 0) return false;
      i--;
    }
    return true;
  };
  const treffer = offen.filter(t => passtPfad(t, true));
  const liste = treffer.length ? treffer : offen.filter(t => passtPfad(t, false));
  if (liste.length === 1) return { id: liste[0].id };
  if (!liste.length) return { fehler: `Keine offene Aufgabe passt zu „${roh.slice(0, 80)}“.` };
  return { fehler: `Mehrdeutig — ${liste.length} Aufgaben passen: ${liste.slice(0, 5).map(t => `„${pfadText(t, nachId)}“`).join(', ')}. Bitte mit Pfad („Hauptaufgabe › Unteraufgabe“) angeben.` };
}
