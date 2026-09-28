// ─── MAKE OS — Aufgaben-Bestand „tasks“ (Server, 28.09. abends) ─────────────
// Der eine Schreibweg der Aufgaben-Seite (PATCH /api/state/tasks): Einzeländerungen an Aufgaben, Projekten,
// Listen und eigenen Status in EINER Sperre — mit Stand je Eintrag (Fingerabdruck, 409 bei „inzwischen
// geändert“), Übernahme des Altbestands (lib/aufgaben/struktur.ts `uebernehmen`), Massen-Wache,
// Änderungsprotokoll ohne Werte und Meldungen (Zuweisung, Kommentar, Erwähnung — nie an sich selbst).
// Andere Server-Schreiber (Heads, Übergabe, Steuern …) hängen weiter direkt an; ihre Aufgaben bekommen
// Space/Einheit beim nächsten Lesen/Schreiben (idempotent).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck, mitStand } from '@/lib/store/fingerabdruck';
import { protokolliere, listenDiff, type Aenderung, type Wer } from '@/lib/store/aenderungsprotokoll';
import { brauchtBestaetigung, MASSEN_GRENZE } from '@/lib/store/massen-wache';
import { ladeKonten } from '@/lib/zugang/konten';
import { ladeCrm } from '@/lib/crm/speicher';
import { melde, type MeldungEingabe } from '@/lib/meldungen/melden';
import { WEG } from '@/lib/wege';
import type { Task, TasksState, Project, AufgabenListe, AufgabenStatus, AufgabeKommentar, AufgabenGruppe, AufgabenVorlage } from '@/types/tasks';
import { uebernehmen, alleSpaces, zustaendigeVon, type AufgabenSpace } from './struktur';
import { taskSauber, projektSauber, listeSauber, statusSauber, gruppeSauber, vorlageSauber, feldWerteTypisieren, kommentareVereinen, AUFGABEN_GRENZEN, ZuGross } from './saeubern';
import { abhaengigAngleichen, kreisBei } from './abhaengig';
import { verlaufFuer, verlaufAnhaengen, type VerlaufWer } from './verlauf';
import { serienBeimErledigen } from './serie';
import { berlinerTag } from './wiederholung';

export const AUFGABEN_SPEICHER = 'tasks';

/** Orte von Hand (Board › Ort) — entscheiden bei Altaufgaben mit, ob sie im Business liegen. */
export async function orgZuordnung(): Promise<Record<string, string>> {
  const f = await loadJson<{ orgs?: Record<string, string> }>('ordnung');
  return f?.orgs && typeof f.orgs === 'object' ? f.orgs : {};
}

/** Abbruch in der Sperre — nichts wird geschrieben, `erg` trägt den Grund. */
const ABBRUCH = Symbol('aufgaben-abbruch');
const leer = (): TasksState => ({ projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
const alsStand = (roh: TasksState | null | undefined): TasksState => (roh && Array.isArray(roh.tasks) ? roh : { ...leer(), ...(roh ?? {}), tasks: [] });

/** Den Bestand lesen — übernommen (Space, Unteraufgaben …), noch nicht gespeichert. */
export async function ladeAufgaben(orgs?: Record<string, string>): Promise<TasksState> {
  const roh = await loadJson<TasksState>(AUFGABEN_SPEICHER);
  return uebernehmen(alsStand(roh), orgs ?? await orgZuordnung()).state;
}

/** Spaces für die Oberfläche: fest + Mandanten aus dem CRM (aktiv, Archiv). */
export async function spacesFuer(state: TasksState): Promise<AufgabenSpace[]> {
  return alleSpaces(await ladeCrm(), state.tasks);
}

/** So geht der Bestand an den Browser: jede Zeile mit `stand`. */
export function fuerBrowser(state: TasksState) {
  return {
    projects: mitStand(state.projects), tasks: mitStand(state.tasks), listen: mitStand(state.listen ?? []), statusEigen: mitStand(state.statusEigen ?? []),
    gruppen: mitStand(state.gruppen ?? []), vorlagen: mitStand(state.vorlagen ?? []),
  };
}

// ── Änderungen ─────────────────────────────────────────────────────────────

export type ListenArt = 'tasks' | 'projects' | 'listen' | 'statusEigen' | 'gruppen' | 'vorlagen';
/** Alle Listen des Bestands — Reihenfolge beim Anwenden: Struktur zuerst, Aufgaben zuletzt. */
export const LISTEN_ARTEN: readonly ListenArt[] = ['projects', 'gruppen', 'listen', 'statusEigen', 'vorlagen', 'tasks'];
export interface Op<E> { op: 'upsert' | 'delete'; eintrag?: E; id?: string; stand?: string; /** Nur Aufgaben: kamen Kommentare mit? Fehlen sie, bleiben die gespeicherten. */ mitKommentaren?: boolean }
export interface AufgabenOps { tasks: Op<Task>[]; projects: Op<Project>[]; listen: Op<AufgabenListe>[]; statusEigen: Op<AufgabenStatus>[]; gruppen: Op<AufgabenGruppe>[]; vorlagen: Op<AufgabenVorlage>[] }
const leereOps = (): AufgabenOps => ({ tasks: [], projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
export interface Konflikt { liste: ListenArt; id: string; grund: 'inzwischen geändert' | 'inzwischen gelöscht'; aktuell?: unknown }

export type LeseErgebnis = { ok: true; ops: AufgabenOps } | { ok: false; status: 400 | 413; fehler: string };

const SAEUBERER = { tasks: taskSauber, projects: projektSauber, listen: listeSauber, statusEigen: statusSauber, gruppen: gruppeSauber, vorlagen: vorlageSauber } as const;
const GRENZE: Record<ListenArt, number> = { tasks: AUFGABEN_GRENZEN.ops, projects: AUFGABEN_GRENZEN.ops, listen: AUFGABEN_GRENZEN.ops, statusEigen: AUFGABEN_GRENZEN.ops, gruppen: AUFGABEN_GRENZEN.ops, vorlagen: AUFGABEN_GRENZEN.ops };

/**
 * Rohe Änderungen lesen: `ops` (Aufgaben, alt: `{ op, task }`), `struktur.{projekte,listen,status,gruppen,vorlagen}` und das alte
 * Feld `projekte` (ganze Liste — nur noch als Upserts, nie als Löschung). Mehr als die Grenze → 413, nie gekürzt.
 */
export function opsLesen(body: Record<string, unknown>): LeseErgebnis {
  const ops: AufgabenOps = leereOps();
  const struktur = (body.struktur && typeof body.struktur === 'object' ? body.struktur : {}) as Record<string, unknown>;
  const quellen: [ListenArt, unknown][] = [['tasks', body.ops], ['projects', struktur.projekte], ['listen', struktur.listen], ['statusEigen', struktur.status], ['gruppen', struktur.gruppen], ['vorlagen', struktur.vorlagen]];
  try {
    for (const [art, roh] of quellen) {
      if (roh === undefined) continue;
      if (!Array.isArray(roh)) return { ok: false, status: 400, fehler: `${art}: Liste von Änderungen erwartet.` };
      if (roh.length > GRENZE[art]) return { ok: false, status: 413, fehler: `Abgelehnt: ${roh.length} Änderungen auf einmal — höchstens ${GRENZE[art]}. Nichts gespeichert; bitte in Teilen schicken.` };
      for (const o of roh as Record<string, unknown>[]) {
        if (!o || typeof o !== 'object') continue;
        const stand = typeof o.stand === 'string' && o.stand ? o.stand : undefined;
        if (o.op === 'delete' && typeof o.id === 'string') { (ops[art] as Op<unknown>[]).push({ op: 'delete', id: o.id.slice(0, 80), ...(stand ? { stand } : {}) }); continue; }
        if (o.op !== 'upsert') continue;
        const rohE = (o.eintrag ?? o.task) as Record<string, unknown> | undefined;
        const e = (SAEUBERER[art] as (x: unknown) => unknown)(rohE);
        if (!e) continue;
        const s = stand ?? (typeof rohE?.stand === 'string' ? rohE.stand : undefined);
        (ops[art] as Op<unknown>[]).push({ op: 'upsert', eintrag: e, ...(s ? { stand: s } : {}), ...(art === 'tasks' ? { mitKommentaren: !!rohE && 'kommentare' in rohE } : {}) });
      }
    }
    if (Array.isArray(body.projekte)) {
      if (body.projekte.length > AUFGABEN_GRENZEN.projekte) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${AUFGABEN_GRENZEN.projekte} Projekte.` };
      for (const p of body.projekte) { const e = projektSauber(p); if (e) ops.projects.push({ op: 'upsert', eintrag: e }); }
    }
  } catch (e) {
    if (e instanceof ZuGross) return { ok: false, status: 413, fehler: e.message };
    throw e;
  }
  const n = Object.values(ops).reduce((s, l) => s + (l as unknown[]).length, 0);
  if (!n) return { ok: false, status: 400, fehler: 'Keine gültigen Änderungen.' };
  return { ok: true, ops };
}

export interface SchreibErgebnis {
  ok: boolean;
  status: 200 | 403 | 409 | 413;
  fehler?: string;
  konflikte?: Konflikt[];
  massenAenderung?: boolean; massenLoeschung?: boolean; anzahl?: number; grenze?: number;
  /** Abgelehnter Kreis in den Abhängigkeiten (Kennungen der Kette). */
  kreis?: string[];
  angewandt: number;
  /** Neuer Stand je geschriebener Zeile — der Browser trägt ihn nach. */
  zeilen: { liste: ListenArt; id: string; stand: string; /** Nur Aufgaben: der Verlauf, wie er jetzt gespeichert ist (der Browser trägt ihn nach). */ verlauf?: Task['verlauf'] }[];
  /** Paket C3: neu entstandene Instanzen wiederkehrender Aufgaben (Kennungen) — der Browser lädt dann den Stand nach. */
  serien?: string[];
  state?: TasksState;
}

interface Optionen { person: string; wer?: Wer; massenAenderung?: boolean; massenLoeschung?: boolean; orgs?: Record<string, string>; jetzt?: string }

/** Änderungen in EINER Sperre anwenden (Stand-Prüfung, Übernahme, Grenzen, Massen-Wache), danach Protokoll + Meldungen. */
export async function aufgabenAendern(ops: AufgabenOps, opt: Optionen): Promise<SchreibErgebnis> {
  const orgs = opt.orgs ?? await orgZuordnung();
  const jetzt = opt.jetzt ?? new Date().toISOString();
  let erg: SchreibErgebnis = { ok: false, status: 409, angewandt: 0, zeilen: [] };
  let vorher: TasksState = leer();
  let nachher: TasksState = leer();
  const neueKommentare: { task: Task; k: AufgabeKommentar }[] = [];

  try {
  await updateJson<TasksState>(AUFGABEN_SPEICHER, roh => {
    neueKommentare.length = 0;
    const basis = uebernehmen(alsStand(roh), orgs);
    vorher = basis.state;
    const konflikte: Konflikt[] = [];
    let angewandt = 0;
    const listen = {
      tasks: new Map(vorher.tasks.map(x => [x.id, x])),
      projects: new Map(vorher.projects.map(x => [x.id, x])),
      listen: new Map((vorher.listen ?? []).map(x => [x.id, x])),
      statusEigen: new Map((vorher.statusEigen ?? []).map(x => [x.id, x])),
      gruppen: new Map((vorher.gruppen ?? []).map(x => [x.id, x])),
      vorlagen: new Map((vorher.vorlagen ?? []).map(x => [x.id, x])),
    };
    const pruefe = (art: ListenArt, id: string, stand: string | undefined): boolean => {
      if (stand === undefined) return true; // ohne Stand: wie bisher (ZOE, alte Fenster)
      const alt = (listen[art] as Map<string, unknown>).get(id);
      if (!alt) { konflikte.push({ liste: art, id, grund: 'inzwischen gelöscht' }); return false; }
      if (fingerabdruck(alt as Record<string, unknown>) !== stand) { konflikte.push({ liste: art, id, grund: 'inzwischen geändert', aktuell: alt }); return false; }
      return true;
    };
    // Struktur zuerst, damit neue Aufgaben ihr neues Projekt/ihre neue Liste schon finden.
    for (const art of LISTEN_ARTEN) {
      const m = listen[art] as Map<string, unknown>;
      for (const o of ops[art] as Op<{ id: string }>[]) {
        const id = o.op === 'delete' ? o.id! : o.eintrag!.id;
        if (!pruefe(art, id, o.stand)) continue;
        if (o.op === 'delete') { if (m.delete(id)) angewandt++; continue; }
        let e = o.eintrag as unknown;
        if (art === 'tasks') {
          const alt = listen.tasks.get(id);
          const t = e as Task;
          const k = o.mitKommentaren ? kommentareVereinen(alt?.kommentare, t.kommentare, opt.person, jetzt) : { kommentare: alt?.kommentare, neue: [] };
          let n: Task = { ...t, ...(k.kommentare ? { kommentare: k.kommentare } : {}) };
          if (!k.kommentare) delete n.kommentare;
          // Verlauf gehört dem Server: der gespeicherte bleibt, neue Einträge kommen nach der Übernahme dazu.
          if (alt?.verlauf) n.verlauf = alt.verlauf; else delete n.verlauf;
          // „Wartet auf“: wer sich geändert hat (abhaengigVon oder das alte dependencies), gewinnt.
          n = abhaengigAngleichen(n, alt ?? null);
          // Eigene Felder typgerecht gegen die Definitionen des Projekts.
          const defs = listen.projects.get(n.projectId)?.felder;
          const felder = feldWerteTypisieren(n.felder, defs);
          if (felder) n.felder = felder; else delete n.felder;
          if (!alt) { n.createdAt = n.createdAt || jetzt; }
          // Eigener Status neu gesetzt → `status` bekommt seinen Grundstatus (alle Leser verstehen „erledigt“).
          if (n.statusId && n.statusId !== alt?.statusId) {
            const s = listen.statusEigen.get(n.statusId);
            if (s && s.spaceId === n.spaceId && n.status !== s.basis) { n.status = s.basis; if (s.basis === 'done') n.completedAt = n.completedAt ?? jetzt; else delete n.completedAt; }
          }
          for (const c of k.neue) neueKommentare.push({ task: n, k: c });
          e = n;
        }
        m.set(id, e); angewandt++;
      }
    }
    // Neue Bedeutung eines eigenen Status → seine Aufgaben tragen den neuen Grundstatus (statt ihn zu verlieren).
    for (const o of ops.statusEigen) {
      if (o.op !== 'upsert' || !o.eintrag) continue;
      const alt = (vorher.statusEigen ?? []).find(x => x.id === o.eintrag!.id);
      if (!alt || alt.basis === o.eintrag.basis) continue;
      for (const [id, t] of listen.tasks) if (t.statusId === alt.id && t.status === alt.basis) listen.tasks.set(id, { ...t, status: o.eintrag.basis, updatedAt: jetzt });
    }
    if (konflikte.length) { erg = { ok: false, status: 409, fehler: 'Jemand hat inzwischen geändert — Stand neu geladen, bitte noch einmal.', konflikte, angewandt: 0, zeilen: [], state: vorher }; throw ABBRUCH; }

    const roh2: TasksState = {
      ...vorher, tasks: Array.from(listen.tasks.values()), projects: Array.from(listen.projects.values()), listen: Array.from(listen.listen.values()),
      statusEigen: Array.from(listen.statusEigen.values()), gruppen: Array.from(listen.gruppen.values()), vorlagen: Array.from(listen.vorlagen.values()),
    };
    for (const [art, max, was] of [['tasks', AUFGABEN_GRENZEN.aufgaben, 'Aufgaben'], ['projects', AUFGABEN_GRENZEN.projekte, 'Projekte'], ['listen', AUFGABEN_GRENZEN.listen, 'Listen'], ['statusEigen', AUFGABEN_GRENZEN.status, 'eigene Status'], ['gruppen', AUFGABEN_GRENZEN.gruppen, 'Gruppen'], ['vorlagen', AUFGABEN_GRENZEN.vorlagen, 'Vorlagen']] as const) {
      const n = (roh2[art] ?? []).length;
      if (n > max && n > (vorher[art] ?? []).length) { erg = { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${max} ${was}.`, angewandt: 0, zeilen: [] }; throw ABBRUCH; }
    }
    const loesch = ops.tasks.filter(o => o.op === 'delete').length;
    if (vorher.tasks.length >= 10 && loesch > vorher.tasks.length / 2 && !opt.massenLoeschung) {
      erg = { ok: false, status: 409, massenLoeschung: true, fehler: 'Abgelehnt: das hätte über die Hälfte der Aufgaben gelöscht. Wenn das so gewollt ist, noch einmal mit ausdrücklicher Bestätigung schicken.', angewandt: 0, zeilen: [] };
      throw ABBRUCH;
    }
    nachher = uebernehmen(roh2, orgs).state;
    // Kreise („A wartet auf B wartet auf A“) — keine der Aufgaben könnte je fertig werden: ablehnen.
    const upserts = ops.tasks.filter(o => o.op === 'upsert').map(o => o.eintrag!.id);
    const kreis = kreisBei(nachher.tasks, upserts);
    if (kreis) {
      const titel = (id: string) => nachher.tasks.find(t => t.id === id)?.title ?? id;
      erg = { ok: false, status: 409, kreis, fehler: `Abgelehnt: „${titel(kreis[0])}“ würde über ${kreis.length - 1 === 1 ? 'eine Abhängigkeit' : `${kreis.length - 1} Abhängigkeiten`} auf sich selbst warten. Nichts gespeichert.`, angewandt: 0, zeilen: [] };
      throw ABBRUCH;
    }
    // Paket C3: wiederkehrende Aufgabe erledigt → nächste Instanz (idempotent, höchstens eine offene je Serie).
    const serien = serienBeimErledigen(vorher.tasks, nachher.tasks, upserts, berlinerTag(new Date(jetzt)), jetzt);
    if (serien.length) nachher = { ...nachher, tasks: [...nachher.tasks, ...serien] };
    const serienIds = new Set(serien.map(t => t.id));
    // Verlauf je Aufgabe: nach der Übernahme, damit abgeleitete Felder (Status, Ort) stimmen.
    const altNach = new Map(vorher.tasks.map(t => [t.id, t]));
    const wer: VerlaufWer = { person: opt.person, ...(opt.wer?.art === 'zoe' ? { durch: 'zoe' as const } : opt.wer && opt.wer.art !== 'person' ? { durch: 'system' as const } : {}) };
    const hier = new Set([...upserts, ...serienIds]);
    nachher = { ...nachher, tasks: nachher.tasks.map(t => {
      if (!hier.has(t.id)) return t;
      const eintraege = verlaufFuer(altNach.get(t.id), t, serienIds.has(t.id) ? { person: opt.person, durch: 'system' } : wer, jetzt, nachher.statusEigen ?? []);
      if (!eintraege.length) return t;
      const verlauf = verlaufAnhaengen(t.verlauf, eintraege);
      return verlauf ? { ...t, verlauf } : t;
    }) };
    const pruef = brauchtBestaetigung(vorher.tasks, nachher.tasks, opt.massenAenderung === true);
    if (pruef.noetig) {
      erg = { ok: false, status: 409, massenAenderung: true, anzahl: pruef.anzahl, grenze: MASSEN_GRENZE, fehler: `Abgelehnt: das hätte ${pruef.anzahl} Aufgaben auf einmal erledigt. Wenn das so gewollt ist, noch einmal mit ausdrücklicher Bestätigung schicken.`, angewandt: 0, zeilen: [] };
      throw ABBRUCH;
    }
    const zeilen: SchreibErgebnis['zeilen'] = [];
    for (const art of LISTEN_ARTEN) {
      const alt = new Map(((vorher[art] ?? []) as { id: string }[]).map(x => [x.id, fingerabdruck(x as Record<string, unknown>)]));
      for (const x of (nachher[art] ?? []) as { id: string }[]) {
        const s = fingerabdruck(x as Record<string, unknown>);
        if (alt.get(x.id) !== s) zeilen.push({ liste: art, id: x.id, stand: s, ...(art === 'tasks' && (x as Task).verlauf ? { verlauf: (x as Task).verlauf } : {}) });
      }
    }
    erg = { ok: true, status: 200, angewandt, zeilen, state: nachher, ...(serien.length ? { serien: serien.map(t => t.id) } : {}) };
    return nachher;
  });
  } catch (e) {
    // Abgelehnt: nichts geschrieben (updateJson schreibt nicht, wenn die Änderung wirft).
    if (e !== ABBRUCH) throw e;
  }

  if (!erg.ok) return erg;
  // Protokoll: nur Kennungen und Feldnamen, nie Werte (lib/store/aenderungsprotokoll.ts).
  const aenderungen: Aenderung[] = [];
  for (const art of LISTEN_ARTEN) aenderungen.push(...listenDiff((vorher[art] ?? []) as { id: string }[], (nachher[art] ?? []) as { id: string }[], art));
  await protokolliere(AUFGABEN_SPEICHER, aenderungen, opt.wer);
  await meldungenNachSchreiben(vorher, nachher, neueKommentare, opt.person);
  return erg;
}

// ── Meldungen ──────────────────────────────────────────────────────────────

/** Personen des Haushalts des Inhabers (Speichername + Anzeigename) — für „beide“ und für Texte. */
export async function haushaltPersonen(): Promise<{ speicher: string; name: string }[]> {
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  if (!inhaber) return [];
  return konten.filter(k => k.speicher === inhaber.speicher || (!!inhaber.haushalt && k.haushalt === inhaber.haushalt)).map(k => ({ speicher: k.speicher, name: k.name }));
}

const kurzTitel = (t: string) => (t.length > 80 ? `${t.slice(0, 79)}…` : t);
const vorname = (n: string | undefined, rueck: string) => (n ?? '').trim().split(/\s+/)[0] || rueck;

/**
 * Wer bekommt eine Meldung? Neu zugewiesen (auch neu angelegt für jemand anderen) → „zuweisung“; neuer Kommentar →
 * Erwähnte „erwaehnung“, übrige Zuständige „kommentar“. Nie an die schreibende Person selbst. Rein (testbar).
 */
export function meldungenBerechnen(
  vorher: TasksState, nachher: TasksState, neueKommentare: readonly { task: Task; k: AufgabeKommentar }[], person: string,
  personen: readonly { speicher: string; name: string }[],
): MeldungEingabe[] {
  const alle = personen.map(p => p.speicher);
  const ichName = vorname(personen.find(p => p.speicher === person)?.name, person);
  const bekannt = new Set(alle);
  const raus: MeldungEingabe[] = [];
  const alt = new Map(vorher.tasks.map(t => [t.id, t]));
  for (const t of nachher.tasks) {
    const a = alt.get(t.id);
    if (a && a.assignee === t.assignee) continue;
    if (t.status === 'done') continue;
    const vorherHatte = new Set(a ? zustaendigeVon(a.assignee, alle) : []);
    for (const an of zustaendigeVon(t.assignee, alle)) {
      if (an === person || vorherHatte.has(an) || !bekannt.has(an)) continue;
      raus.push({ an, art: 'zuweisung', titel: `${ichName} hat dir „${kurzTitel(t.title)}“ zugewiesen`, link: WEG.aufgabe(t.id), von: person, bezug: { art: 'aufgabe', id: t.id } });
    }
  }
  for (const { task, k } of neueKommentare) {
    const erwaehnt = new Set((k.erwaehnt ?? []).filter(p => bekannt.has(p)));
    for (const an of erwaehnt) {
      if (an === person) continue;
      raus.push({ an, art: 'erwaehnung', titel: `${ichName} hat dich bei „${kurzTitel(task.title)}“ erwähnt`, link: WEG.aufgabe(task.id), von: person, bezug: { art: 'aufgabe', id: task.id } });
    }
    for (const an of zustaendigeVon(task.assignee, alle)) {
      if (an === person || erwaehnt.has(an) || !bekannt.has(an)) continue;
      raus.push({ an, art: 'kommentar', titel: `${ichName} hat „${kurzTitel(task.title)}“ kommentiert`, link: WEG.aufgabe(task.id), von: person, bezug: { art: 'aufgabe', id: task.id } });
    }
  }
  return raus;
}

async function meldungenNachSchreiben(vorher: TasksState, nachher: TasksState, neueKommentare: { task: Task; k: AufgabeKommentar }[], person: string) {
  try {
    const liste = meldungenBerechnen(vorher, nachher, neueKommentare, person, await haushaltPersonen());
    for (const m of liste) await melde(m);
  } catch (e) {
    // Eine Meldung darf nie einen Schreibweg brechen (er ist schon geschehen).
    console.error('[aufgaben] Meldung nicht abgelegt —', e instanceof Error ? e.message : e);
  }
}

/** Für /api/tasks/create: nach dem Anlegen dieselben Meldungen (Zuweisung an jemand anderen). */
export async function meldeNeueAufgabe(t: Task, person: string | null): Promise<void> {
  if (!person) return;
  await meldungenNachSchreiben({ ...leer(), tasks: [] }, { ...leer(), tasks: [t] }, [], person);
}

export { ZuGross };
