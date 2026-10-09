// ─── MAKE OS — Aufgaben-Bestand „tasks“ (Server, 28.09. abends) ─────────────
// Der eine Schreibweg der Aufgaben-Seite (PATCH /api/state/tasks): Einzeländerungen an Aufgaben, Projekten,
// Listen und eigenen Status in EINER Sperre — mit Stand je Eintrag (Fingerabdruck, 409 bei „inzwischen
// geändert“), Übernahme des Altbestands (lib/aufgaben/struktur.ts `uebernehmen`), Massen-Wache,
// Änderungsprotokoll ohne Werte und Meldungen (Zuweisung, Kommentar, Erwähnung — nie an sich selbst).
// Andere Server-Schreiber (Heads, Übergabe, Steuern …) hängen weiter direkt an; ihre Aufgaben bekommen
// Space/Einheit beim nächsten Lesen/Schreiben (idempotent).

import { fingerabdruck, mitStand } from '@/lib/store/fingerabdruck';
import { protokolliere, listenDiff, type Aenderung, type Wer } from '@/lib/store/aenderungsprotokoll';
import { brauchtBestaetigung, MASSEN_GRENZE } from '@/lib/store/massen-wache';
import { ladeCrm } from '@/lib/crm/speicher';
import { melde, type MeldungEingabe } from '@/lib/meldungen/melden';
import { WEG } from '@/lib/wege';
import type { Task, TasksState, Project, AufgabenListe, AufgabenStatus, AufgabeKommentar, AufgabenGruppe, AufgabenVorlage } from '@/types/tasks';
import { uebernehmen, alleSpaces, type AufgabenSpace } from './struktur';
import { taskSauber, projektSauber, listeSauber, statusSauber, gruppeSauber, vorlageSauber, feldWerteTypisieren, auswahlUmbenennungen, kommentareVereinen, AUFGABEN_GRENZEN, ZuGross } from './saeubern';
import { alsStand, orgZuordnung, darfSehen, istNurIch, haushaltsPersonen, nurIchBesitzer } from './sicht';
import { aufgabeImPrivat, listeImPrivat, projektImPrivat, spacesOhnePrivat, statusImPrivat, vorlageImPrivat } from './bereich-sicht';
import { privatAusgeblendetFuer } from '@/lib/zugang/konto-sicht-server';
import { NUR_BUSINESS_PRIVAT } from '@/lib/zugang/konto-sicht';
import { beideAufloesen, anlegerinVon, alleZustaendigen, SYSTEM } from './zustaendig';
import { aufgabePruefen } from './pruefen';
import { archivMarkeSchuetzen } from './archiv-einzeln';
import { aufgabenSicht, projektInPapierkorb, aufgabeInPapierkorb, endgueltigEntfernen, imPapierkorb, fremdeNurIchLoesen } from './papierkorb';
import { aufgabenSchreiben, UMBAU_VERSION } from './umbau';
import { abhaengigAngleichen, kreisBei } from './abhaengig';
import { verlaufFuer, verlaufAnhaengen, type VerlaufWer } from './verlauf';
import { serienBeimErledigen, folgeinstanzenBeimOeffnen, serieUeberspringen } from './serie';
import { berlinerTag } from './wiederholung';
import { followupsNachAufgaben } from '@/lib/crm/followup-aufgabe-server';
import { dateienBereichNachziehen } from './umzug-dateien';
import { elternPruefen, nachIdKarte, kinderKarte, vorfahren } from './ebenen';
import { ortPruefen } from './ziehen';
import { aufgabenBezugPruefen, projektBezugPruefen } from '@/lib/planung/bezuege';
import { zieleFuerBezug } from '@/lib/planung/bezuege-server';
import { MS_LISTE_PRAEFIX } from '@/lib/planung/meilenstein-aufgaben';

export const AUFGABEN_SPEICHER = 'tasks';

/** Abbruch in der Sperre — nichts wird geschrieben, `erg` trägt den Grund. */
const ABBRUCH = Symbol('aufgaben-abbruch');
/** JSON mit sortierten Schlüsseln — gleiche Inhalte, gleiche Zeichenkette (Reihenfolge der Felder egal). */
function stabil(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stabil).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x as object).filter(k => (x as Record<string, unknown>)[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stabil((x as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(x) ?? 'null';
}
/** Nichts zu tun (Server-Schreiber ohne Änderung) — nichts wird geschrieben, `erg` ist ok. */
const NICHTS_ZU_TUN = Symbol('aufgaben-nichts');

/**
 * Felder, die NUR der Server setzt (29.09., #12/#14/#20/#78): `createdAt` nur beim Anlegen, `updatedAt` = jetzt (nur bei
 * einer echten Änderung), `completedAt` beim Übergang nach „erledigt“ (Server-Zeit; bleibt, solange erledigt; sonst weg),
 * `angelegtVon` (neu: die schreibende Person; alt: gespeichert bzw. aus dem Verlauf), `zoe.status` per PATCH nur, wenn
 * unverändert (Änderung nur über /api/aufgaben/zoe). Sichtbarkeit „haushalt“ wird nicht gespeichert (fehlt = haushalt).
 */
export function serverFelder(n0: Task, alt: Task | undefined, o: { person: string; echtePerson: boolean; jetzt: string; zoeStatus: boolean }): Task {
  const n: Task = { ...n0 };
  if (alt) n.createdAt = alt.createdAt; else n.createdAt = o.jetzt;
  const anlegerin = alt ? (alt.angelegtVon ?? anlegerinVon(alt)) : (o.echtePerson ? o.person : undefined);
  if (anlegerin) n.angelegtVon = anlegerin; else delete n.angelegtVon;
  if (n.sichtbarkeit !== 'nur-ich') delete n.sichtbarkeit;
  if (n.status === 'done') n.completedAt = alt?.status === 'done' && alt.completedAt ? alt.completedAt : o.jetzt;
  else delete n.completedAt;
  if (!o.zoeStatus && (n.zoe?.status ?? null) !== (alt?.zoe?.status ?? null)) {
    if (alt?.zoe) n.zoe = alt.zoe; else delete n.zoe;
  }
  // updatedAt: nur bei einer echten Änderung neu (sonst bleibt der Stand gleich und nichts wird geschrieben).
  const ohneZeit = (t: Task) => { const { updatedAt: _u, verlauf: _v, ...r } = t; return stabil(r); };
  n.updatedAt = alt && ohneZeit(alt) === ohneZeit(n) ? alt.updatedAt : o.jetzt;
  return n;
}
const leer = (): TasksState => ({ projects: [], tasks: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
// Lesen (übernommen, mit/ohne Papierkorb) liegt leichtgewichtig in ./sicht — hier weitergereicht für bestehende Aufrufer.
export { orgZuordnung, ladeAufgaben, ladeAufgabenSicht, ladeAufgabenUngefiltert } from './sicht';

/**
 * Spaces für die Oberfläche: fest + Mandanten aus dem CRM (aktiv, Archiv). Mit `person` (09.10., E4): ein Konto „nur Business“ bekommt
 * die Spaces des Privat-Bereichs (Privat, Privat-Einheiten wie die Selbstständigkeit) gar nicht — die Leiste zeigt sie dann nicht.
 */
export async function spacesFuer(state: TasksState, person?: string | null): Promise<AufgabenSpace[]> {
  const alle = alleSpaces(await ladeCrm(), state.tasks);
  return person && (await privatAusgeblendetFuer(person)) ? spacesOhnePrivat(alle) : alle;
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
export interface Op<E> {
  op: 'upsert' | 'delete'; eintrag?: E; id?: string; stand?: string;
  /** Nur Aufgaben: kamen Kommentare mit? Fehlen sie, bleiben die gespeicherten. */
  mitKommentaren?: boolean;
  /**
   * Upsert OHNE Stand (29.09., A2): welche Felder wirklich mitkamen (`gesetzt`) bzw. ausdrücklich geleert wurden (`leer`:
   * null oder ''). Ohne Stand ist ein Upsert über einen bestehenden Eintrag nur ein Teil-Merge — fehlende Felder bleiben
   * (vorher ersetzte ein altes Fenster so die ganze Aufgabe).
   */
  felder?: { gesetzt: string[]; leer: string[] };
}
export interface AufgabenOps { tasks: Op<Task>[]; projects: Op<Project>[]; listen: Op<AufgabenListe>[]; statusEigen: Op<AufgabenStatus>[]; gruppen: Op<AufgabenGruppe>[]; vorlagen: Op<AufgabenVorlage>[] }
const leereOps = (): AufgabenOps => ({ tasks: [], projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] });
export interface Konflikt { liste: ListenArt; id: string; grund: 'inzwischen geändert' | 'inzwischen gelöscht'; aktuell?: unknown }

export type LeseErgebnis = { ok: true; ops: AufgabenOps } | { ok: false; status: 400 | 413; fehler: string };

/**
 * Seit 06.10. (Umbau v3, Malins Bauplan-Karte): Projekt › Liste › Aufgabe › Unteraufgabe — Gruppen werden nicht mehr angelegt,
 * geändert oder an Listen gehängt. Der Typ bleibt zum LESEN (Altbestand); jede neue Gruppen-Änderung lehnt der Server ab.
 */
export const GRUPPEN_ABGELEHNT = 'Abgelehnt: Gruppen gibt es seit dem 06.10. nicht mehr — Projekt › Liste › Aufgabe › Unteraufgabe. Bitte eine Liste anlegen (unten im Projekt „+ Neue Liste“). Nichts gespeichert.';

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
        if (o.op === 'delete' && typeof o.id === 'string') {
          // Nie still kürzen (29.09.): eine zu lange Kennung wäre gekürzt eine ANDERE — ablehnen mit Grund.
          if (o.id.length > 80 || !o.id) return { ok: false, status: 400, fehler: `Abgelehnt: Löschen mit einer Kennung von ${o.id.length} Zeichen — gültig sind 1 bis 80. Nichts gespeichert.` };
          (ops[art] as Op<unknown>[]).push({ op: 'delete', id: o.id, ...(stand ? { stand } : {}) });
          continue;
        }
        if (o.op !== 'upsert') continue;
        const rohE = (o.eintrag ?? o.task) as Record<string, unknown> | undefined;
        const e = (SAEUBERER[art] as (x: unknown) => unknown)(rohE);
        if (!e) continue;
        const s = stand ?? (typeof rohE?.stand === 'string' ? rohE.stand : undefined);
        const felder = !s && rohE ? {
          gesetzt: Object.keys(rohE).filter(k => k !== 'stand' && rohE[k] !== null && rohE[k] !== ''),
          leer: Object.keys(rohE).filter(k => rohE[k] === null || rohE[k] === ''),
        } : undefined;
        (ops[art] as Op<unknown>[]).push({ op: 'upsert', eintrag: e, ...(s ? { stand: s } : {}), ...(felder ? { felder } : {}), ...(art === 'tasks' ? { mitKommentaren: !!rohE && 'kommentare' in rohE } : {}) });
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
  if (ops.gruppen.length || ops.listen.some(o => o.op === 'upsert' && !!o.eintrag?.gruppeId)) return { ok: false, status: 400, fehler: GRUPPEN_ABGELEHNT };
  if (!n) return { ok: false, status: 400, fehler: 'Keine gültigen Änderungen.' };
  return { ok: true, ops };
}

export interface SchreibErgebnis {
  ok: boolean;
  status: 200 | 400 | 403 | 404 | 409 | 413;
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
  /** Endgültig gelöscht (29.09., Papierkorb): ihre Dateien entfernt der Aufrufer (`papierkorbDateienEntfernen`). */
  entfernt?: { aufgaben: string[]; projekte: string[] };
  state?: TasksState;
}

interface Optionen {
  /** Die schreibende Person (Speichername) — „system“ für Systemläufe ohne Person. */
  person: string; wer?: Wer; massenAenderung?: boolean; massenLoeschung?: boolean; orgs?: Record<string, string>; jetzt?: string;
  /** Haushalt der Person — dann gehen beim endgültigen Löschen auch die Dateien. */ haushalt?: string;
  /**
   * Server-Schreiber (Heads, Finanzchef, Steuern, Löschfristen, Belege, Events — 29.09.): der Sichtfilter „nur ich“ gilt
   * nicht (sie schreiben ihre eigenen Aufgaben per Kennung), Verlauf mit `durch: 'system'`.
   */
  system?: boolean;
  /** Nur die ZOE-Wege (lib/zoe/aufgaben-werkzeuge.ts) dürfen `zoe.status` ändern — per PATCH wird eine Änderung ignoriert. */
  zoeStatus?: boolean;
}

/** Änderungen, die ERST in der Sperre aus dem aktuellen Stand berechnet werden (Server-Schreiber: anlegen/erledigen je Kennung). */
export type OpsRechnen = (stand: TasksState) => AufgabenOps;
export const keineOps = leereOps;
/** Eine Aufgabe als Teil-Änderung ohne Stand (nur die genannten Felder; `null` leert) — für Server-Schreiber. */
export function teilOp(id: string, basis: Task, felder: Partial<Record<keyof Task, unknown>>): Op<Task> {
  const gesetzt = Object.keys(felder).filter(k => felder[k as keyof Task] !== null && felder[k as keyof Task] !== undefined);
  const leer = Object.keys(felder).filter(k => felder[k as keyof Task] === null);
  const e = { ...basis, id } as Task;
  for (const k of gesetzt) (e as unknown as Record<string, unknown>)[k] = felder[k as keyof Task];
  return { op: 'upsert', eintrag: e, felder: { gesetzt, leer } };
}

/** Teil-Merge (29.09., A2): nur die Felder, die mitkamen, ersetzen; ausdrücklich geleerte fallen weg; alles andere bleibt. */
export function teilMerge<T extends object>(alt: T, neu: T, felder: { gesetzt: readonly string[]; leer: readonly string[] }): T {
  const n = { ...alt } as Record<string, unknown>;
  const q = neu as Record<string, unknown>;
  for (const k of felder.gesetzt) if (k !== 'id' && k in q) n[k] = q[k];
  for (const k of felder.leer) if (k !== 'id' && !(k in q)) delete n[k];
  return n as T;
}

/** Antwort, wenn ein Konto „nur Business“ etwas in den Privat-Bereich legen will (09.10., E4) — der Satz steht seit E4-Rest in der Konto-Sicht. */
export { NUR_BUSINESS_PRIVAT };

/**
 * Berührt eine Änderung VORHANDENES im Privat-Bereich (Aufgabe samt Kette, Projekt, Liste, eigener Status, Vorlage)? Dann gibt es das
 * für ein Konto „nur Business“ nicht — der Satz für die 404-Antwort, sonst null (rein).
 */
function privatBeruehrt(vorher: TasksState, ops: AufgabenOps, alleVorher: ReadonlyMap<string, Task>): string | null {
  const id = (o: { op: string; id?: string; eintrag?: { id: string } }) => (o.op === 'delete' ? o.id! : o.eintrag!.id);
  const projekte = new Map(vorher.projects.map(p => [p.id, p]));
  for (const o of ops.tasks) { const t = alleVorher.get(id(o)); if (t && aufgabeImPrivat(t, alleVorher)) return 'Aufgabe nicht gefunden.'; }
  for (const o of ops.projects) { const p = projekte.get(id(o)); if (p && projektImPrivat(p)) return 'Projekt nicht gefunden.'; }
  for (const o of ops.listen) { const l = (vorher.listen ?? []).find(x => x.id === id(o)); if (l && listeImPrivat(l, projekte)) return 'Liste nicht gefunden.'; }
  for (const o of ops.statusEigen) { const s = (vorher.statusEigen ?? []).find(x => x.id === id(o)); if (s && statusImPrivat(s)) return 'Status nicht gefunden.'; }
  for (const o of ops.vorlagen) { const v = (vorher.vorlagen ?? []).find(x => x.id === id(o)); if (v && vorlageImPrivat(v)) return 'Vorlage nicht gefunden.'; }
  return null;
}

/** Liegt nach der Änderung eines der geschriebenen Elemente im Privat-Bereich? (rein; für Konten „nur Business“ → 403) */
function nachPrivat(nachher: TasksState, ops: AufgabenOps, nachId: ReadonlyMap<string, Task>): boolean {
  const ups = <E extends { id: string }>(l: readonly Op<E>[]) => new Set(l.filter(o => o.op === 'upsert' && o.eintrag).map(o => o.eintrag!.id));
  const t = ups(ops.tasks), p = ups(ops.projects), l = ups(ops.listen), s = ups(ops.statusEigen), v = ups(ops.vorlagen);
  const projekte = new Map(nachher.projects.map(x => [x.id, x]));
  return nachher.tasks.some(x => t.has(x.id) && aufgabeImPrivat(x, nachId))
    || nachher.projects.some(x => p.has(x.id) && projektImPrivat(x))
    || (nachher.listen ?? []).some(x => l.has(x.id) && listeImPrivat(x, projekte))
    || (nachher.statusEigen ?? []).some(x => s.has(x.id) && statusImPrivat(x))
    || (nachher.vorlagen ?? []).some(x => v.has(x.id) && vorlageImPrivat(x));
}

/** Änderungen in EINER Sperre anwenden (Stand-Prüfung, Übernahme, Grenzen, Massen-Wache), danach Protokoll + Meldungen. */
export async function aufgabenAendern(opsOderRechnen: AufgabenOps | OpsRechnen, opt: Optionen): Promise<SchreibErgebnis> {
  const orgs = opt.orgs ?? await orgZuordnung();
  const jetzt = opt.jetzt ?? new Date().toISOString();
  const personenListe = await haushaltsPersonen();
  const personen = personenListe.map(p => p.speicher);
  const echtePerson = !!opt.person && opt.person !== SYSTEM;
  let ops: AufgabenOps = typeof opsOderRechnen === 'function' ? leereOps() : opsOderRechnen;
  // Bezüge (07.10., Seil): genannte Ziele aus dem geteilten Bestand — nur geladen, wenn eine Änderung ein Ziel nennen kann.
  const nenntZiel = typeof opsOderRechnen === 'function' || [...ops.tasks, ...ops.projects].some(o => o.op === 'upsert' && !!(o.eintrag as { zielId?: string } | undefined)?.zielId);
  const zieleBezug = nenntZiel ? await zieleFuerBezug() : null;
  // Eigene Ziele nur geteilt (08.10., Gegenprüfung): die Liste eines Meilensteins an einem nicht geteilten eigenen Ziel einer anderen
  // Person (Altbestand) ist für die schreibende Person nur neutral benannt — ändern/löschen darf sie sie nicht (404, wie „nur ich“).
  // Unlesbar (`null`) → jede Meilenstein-Liste gilt als verborgen (nie auf Verdacht schreiben lassen).
  const listenOps = typeof opsOderRechnen === 'function' || ops.listen.length > 0;
  const verborgeneListen = !opt.system && listenOps
    ? await (await import('@/lib/planung/eigene-ziele-sicht-server')).verborgeneMeilensteinListenFuer(echtePerson ? opt.person : null)
    : new Set<string>();
  const listeVerborgen = (id: string) => (verborgeneListen === null ? id.startsWith(MS_LISTE_PRAEFIX) : verborgeneListen.has(id));
  // EINE Konto-Sicht (09.10., E4 — Kevin: „Ja, Privates bleibt privat“): ein Konto „nur Business“ schreibt nie in den Privat-Bereich.
  // Vorhandenes dort gibt es für es nicht (404, wie „nur ich“), Neues dorthin (anlegen, verschieben, umhängen) → 403. Server-Schreiber
  // (`system`) und Systemläufe ohne Person sind ausgenommen — sie haben keine Konto-Sicht.
  const ohnePrivat = !opt.system && echtePerson && await privatAusgeblendetFuer(opt.person);
  let erg: SchreibErgebnis = { ok: false, status: 409, angewandt: 0, zeilen: [] };
  let vorher: TasksState = leer();
  let nachher: TasksState = leer();
  const neueKommentare: { task: Task; k: AufgabeKommentar }[] = [];

  try {
  await aufgabenSchreiben(roh => {
    neueKommentare.length = 0;
    const basis = uebernehmen(alsStand(roh), orgs, personen);
    vorher = basis.state;
    // Hinweis-Liste der Übernahme (29.09.): „both“ ohne bekannte Anlegerin → erste Person verantwortlich (nur Kennungen).
    if (basis.geraten.length && (roh?.umbauVersion ?? 0) < UMBAU_VERSION) console.info(`[aufgaben] Übernahme „both“ ohne bekannte Anlegerin — ${personen[0]} verantwortlich (bitte prüfen): ${basis.geraten.join(', ')}`);
    if (typeof opsOderRechnen === 'function') {
      ops = opsOderRechnen(vorher);
      if (!Object.values(ops).some(l => (l as unknown[]).length)) { erg = { ok: true, status: 200, angewandt: 0, zeilen: [], state: vorher }; throw NICHTS_ZU_TUN; }
    }
    // „nur ich“ (29.09.): eine fremde „nur ich“-Aufgabe gibt es für die schreibende Person nicht → 404 (auch löschen).
    if (!opt.system) {
      const alleVorher = new Map(vorher.tasks.map(t => [t.id, t]));
      for (const o of ops.tasks) {
        const id = o.op === 'delete' ? o.id! : o.eintrag!.id;
        const alt = alleVorher.get(id);
        if (alt && !darfSehen(alt, echtePerson ? opt.person : null, alleVorher)) { erg = { ok: false, status: 404, fehler: 'Aufgabe nicht gefunden.', angewandt: 0, zeilen: [] }; throw ABBRUCH; }
      }
      for (const o of ops.listen) {
        if (listeVerborgen(o.op === 'delete' ? o.id! : o.eintrag!.id)) { erg = { ok: false, status: 404, fehler: 'Liste nicht gefunden.', angewandt: 0, zeilen: [] }; throw ABBRUCH; }
      }
      if (ohnePrivat) {
        const grund = privatBeruehrt(vorher, ops, alleVorher);
        if (grund) { erg = { ok: false, status: 404, fehler: grund, angewandt: 0, zeilen: [] }; throw ABBRUCH; }
      }
    }
    // Gruppen (Umbau v3, 06.10.): auch Server-Schreiber legen keine mehr an.
    if (ops.gruppen.length || ops.listen.some(o => o.op === 'upsert' && !!o.eintrag?.gruppeId)) { erg = { ok: false, status: 400, fehler: GRUPPEN_ABGELEHNT, angewandt: 0, zeilen: [] }; throw ABBRUCH; }
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
      if (stand === undefined) return true; // ohne Stand: Teil-Merge (ZOE, Server-Schreiber)
      const alt = (listen[art] as Map<string, unknown>).get(id);
      if (!alt) { konflikte.push({ liste: art, id, grund: 'inzwischen gelöscht' }); return false; }
      if (fingerabdruck(alt as Record<string, unknown>) !== stand) { konflikte.push({ liste: art, id, grund: 'inzwischen geändert', aktuell: alt }); return false; }
      return true;
    };
    // Papierkorb (29.09.): Löschen einer Aufgabe/eines Projekts, die NICHT im Papierkorb liegen, legt hinein (samt Kette);
    // Löschen eines Papierkorb-Eintrags ist endgültig (samt Kette, danach die Dateien).
    const papierkorb: { art: 'projekt' | 'aufgabe'; id: string; endgueltig: boolean }[] = [];
    // Struktur zuerst, damit neue Aufgaben ihr neues Projekt/ihre neue Liste schon finden.
    for (const art of LISTEN_ARTEN) {
      const m = listen[art] as Map<string, unknown>;
      for (const o of ops[art] as Op<{ id: string }>[]) {
        const id = o.op === 'delete' ? o.id! : o.eintrag!.id;
        if (!pruefe(art, id, o.stand)) continue;
        if (o.op === 'delete') {
          if (art === 'tasks' || art === 'projects') {
            const alt = m.get(id) as { geloeschtAm?: string } | undefined;
            if (alt) { papierkorb.push({ art: art === 'tasks' ? 'aufgabe' : 'projekt', id, endgueltig: imPapierkorb(alt) }); angewandt++; }
            continue;
          }
          if (m.delete(id)) angewandt++;
          continue;
        }
        let e = o.eintrag as unknown;
        const altRoh = m.get(id);
        // Ohne Stand über einen bestehenden Eintrag: nur Teil-Merge — ein altes Fenster ersetzt nie die ganze Zeile.
        if (altRoh && !o.stand && o.felder) e = teilMerge(altRoh as object, e as object, o.felder);
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
          // Uhrzeit nur mit Deadline (29.09., Kalender K1): wer die Deadline leert, leert die Uhrzeit mit.
          if (n.dueTime && !n.dueDate) delete n.dueTime;
          // ZOE-Auftraggeberin (C4): wer sie ändert, IST sie — der Server setzt die schreibende Person, nie eine behauptete.
          if (n.zoe?.von && n.zoe.von !== alt?.zoe?.von) n = { ...n, zoe: { ...n.zoe, von: opt.person } };
          // Eigene Felder typgerecht gegen die Definitionen des Projekts — geprüft wird nur, was neu gesetzt wird (A6).
          const defs = listen.projects.get(n.projectId)?.felder;
          const felder = feldWerteTypisieren(n.felder, defs, alt?.felder);
          if (felder) n.felder = felder; else delete n.felder;
          // Eigener Status neu gesetzt → `status` bekommt seinen Grundstatus (alle Leser verstehen „erledigt“).
          if (n.statusId && n.statusId !== alt?.statusId) {
            const s = listen.statusEigen.get(n.statusId);
            if (s && s.spaceId === n.spaceId && n.status !== s.basis) n.status = s.basis;
          }
          // ── Paket T1 (29.09.): Server-Felder, eine Verantwortliche, „nur ich“, Prüfregeln ──
          // Archiv-Marke (04.10.): der Browser setzt/löst nur das Einzel-Archiv; Läufe von „Neu anfangen“ bleiben, wie gespeichert.
          n = archivMarkeSchuetzen(n, alt);
          n = serverFelder(n, alt, { person: opt.person, echtePerson, jetzt, zoeStatus: !!opt.zoeStatus });
          if (n.sichtbarkeit === 'nur-ich' && !istNurIch(alt)) {
            // Auf „nur ich“ stellen darf nur die Anlegerin (unbekannt → wer es tut, wird es).
            if (n.angelegtVon && n.angelegtVon !== opt.person) { erg = { ok: false, status: 400, fehler: 'Auf „nur ich“ stellen kann nur, wer die Aufgabe angelegt hat. Nichts gespeichert.', angewandt: 0, zeilen: [] }; throw ABBRUCH; }
            if (!n.angelegtVon && echtePerson) n = { ...n, angelegtVon: opt.person };
            if (!n.angelegtVon) { erg = { ok: false, status: 400, fehler: '„Nur ich“ braucht eine Person — ein Systemlauf kann das nicht setzen. Nichts gespeichert.', angewandt: 0, zeilen: [] }; throw ABBRUCH; }
          }
          n = beideAufloesen(n, personen, echtePerson ? opt.person : null).task;
          const grund = aufgabePruefen(n, alt, { personen });
          if (grund) { erg = { ok: false, status: 400, fehler: grund, angewandt: 0, zeilen: [] }; throw ABBRUCH; }
          for (const c of k.neue) neueKommentare.push({ task: n, k: c });
          e = n;
        }
        if (art === 'projects' && altRoh) {
          // Umbenannte Auswahl-Werte (A6): an allen Aufgaben des Projekts mitziehen — in derselben Sperre.
          const um = auswahlUmbenennungen((altRoh as Project).felder, (e as Project).felder);
          if (um.length) {
            for (const [tid, t] of listen.tasks) {
              if (t.projectId !== id || !t.felder) continue;
              let f: Task['felder'] = t.felder;
              for (const u of um) if (f?.[u.feldId] === u.von) f = { ...f, [u.feldId]: u.nach };
              if (f !== t.felder) listen.tasks.set(tid, { ...t, felder: f, updatedAt: jetzt });
            }
          }
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

    let roh2: TasksState = {
      ...vorher, tasks: Array.from(listen.tasks.values()), projects: Array.from(listen.projects.values()), listen: Array.from(listen.listen.values()),
      statusEigen: Array.from(listen.statusEigen.values()), gruppen: Array.from(listen.gruppen.values()), vorlagen: Array.from(listen.vorlagen.values()),
    };
    // Papierkorb: erst hineinlegen, dann endgültig entfernen (Ketten über die reinen Regeln in lib/aufgaben/papierkorb.ts).
    const entfernt = { aufgaben: [] as string[], projekte: [] as string[] };
    // „Nur diese löschen“ einer laufenden Serie (#29): Tag → `ausnahmen`, die nächste Instanz entsteht sofort.
    const uebersprungen: Task[] = [];
    for (const p of papierkorb.filter(x => !x.endgueltig && x.art === 'aufgabe')) {
      const t = roh2.tasks.find(x => x.id === p.id);
      const r = t ? serieUeberspringen(t, roh2.tasks, berlinerTag(new Date(jetzt)), jetzt) : null;
      if (!r) continue;
      roh2 = { ...roh2, tasks: [...roh2.tasks.map(x => (x.id === p.id ? r.geloescht : x)), ...r.neu] };
      uebersprungen.push(...r.neu);
    }
    // Sicht-Prüfung 08.10.: fremde „nur ich“-Aufgaben gehen nie mit in die Kette einer Person (weder Papierkorb noch endgültig).
    if (!opt.system && echtePerson) for (const p of papierkorb) roh2 = fremdeNurIchLoesen(roh2, p.art, p.id, opt.person, jetzt);
    for (const p of papierkorb.filter(x => !x.endgueltig)) roh2 = p.art === 'projekt' ? projektInPapierkorb(roh2, p.id, jetzt) : aufgabeInPapierkorb(roh2, p.id, jetzt);
    for (const p of papierkorb.filter(x => x.endgueltig)) {
      const r = endgueltigEntfernen(roh2, p.art, p.id);
      roh2 = r.state; entfernt.aufgaben.push(...r.aufgaben); entfernt.projekte.push(...r.projekte);
    }
    for (const [art, max, was] of [['tasks', AUFGABEN_GRENZEN.aufgaben, 'Aufgaben'], ['projects', AUFGABEN_GRENZEN.projekte, 'Projekte'], ['listen', AUFGABEN_GRENZEN.listen, 'Listen'], ['statusEigen', AUFGABEN_GRENZEN.status, 'eigene Status'], ['gruppen', AUFGABEN_GRENZEN.gruppen, 'Gruppen'], ['vorlagen', AUFGABEN_GRENZEN.vorlagen, 'Vorlagen']] as const) {
      const n = (roh2[art] ?? []).length;
      if (n > max && n > (vorher[art] ?? []).length) { erg = { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${max} ${was}.`, angewandt: 0, zeilen: [] }; throw ABBRUCH; }
    }
    // Mehrstufige Unteraufgaben (01.10.): wer ein (neues) Elternteil bekommt, wird gegen den ENDSTAND dieser Änderung geprüft
    // (so dürfen Eltern und Kinder in einem Paket kommen) — Elternteil vorhanden und nicht im Papierkorb/Archiv, kein Kreis,
    // höchstens AUFGABEN_EBENEN_MAX Ebenen samt eigenem Teilbaum. Die Übernahme würde es sonst still „reparieren“.
    {
      const nachIdE = nachIdKarte(roh2.tasks), kinderE = kinderKarte(roh2.tasks), altE = nachIdKarte(vorher.tasks);
      for (const o of ops.tasks) {
        if (o.op !== 'upsert') continue;
        const t = nachIdE.get(o.eintrag!.id);
        const alt = t ? altE.get(t.id) : undefined;
        if (!t?.parentId || (alt && alt.parentId === t.parentId)) continue;
        const f = elternPruefen(t, t.parentId, nachIdE, kinderE, x => !x.geloeschtAm && !(x as Task).archiviertAm);
        if (!f) continue;
        erg = f.art === 'kreis'
          ? { ok: false, status: 409, fehler: f.text, kreis: [t.id, ...vorfahren(nachIdE.get(t.parentId)!, nachIdE).map(x => x.id).filter(x => x !== t.id)].slice(0, 10), angewandt: 0, zeilen: [] }
          : { ok: false, status: 400, fehler: f.text, angewandt: 0, zeilen: [] };
        throw ABBRUCH;
      }
      // Ort (06.10., Ziehen & Ablegen, Umwandeln): wer Liste, Projekt oder Elternteil WECHSELT, bleibt im Space, und die Liste
      // gehört zum Projekt (lib/aufgaben/ziehen.ts `ortPruefen`). Server-Schreiber setzen ihren Ort selbst (ausgenommen).
      if (!opt.system) {
        for (const o of ops.tasks) {
          if (o.op !== 'upsert') continue;
          const t = nachIdE.get(o.eintrag!.id);
          if (!t) continue;
          const grund = ortPruefen(t, altE.get(t.id), { projekte: roh2.projects, listen: roh2.listen ?? [], nachId: nachIdE });
          if (grund) { erg = { ok: false, status: 400, fehler: grund, angewandt: 0, zeilen: [] }; throw ABBRUCH; }
        }
      }
    }
    const loesch = ops.tasks.filter(o => o.op === 'delete').length;
    if (vorher.tasks.length >= 10 && loesch > vorher.tasks.length / 2 && !opt.massenLoeschung) {
      erg = { ok: false, status: 409, massenLoeschung: true, fehler: 'Abgelehnt: das hätte über die Hälfte der Aufgaben gelöscht. Wenn das so gewollt ist, noch einmal mit ausdrücklicher Bestätigung schicken.', angewandt: 0, zeilen: [] };
      throw ABBRUCH;
    }
    nachher = uebernehmen(roh2, orgs, personen).state;
    // Kreise („A wartet auf B wartet auf A“) — keine der Aufgaben könnte je fertig werden: ablehnen.
    const upserts = ops.tasks.filter(o => o.op === 'upsert').map(o => o.eintrag!.id);
    const kreis = kreisBei(nachher.tasks, upserts);
    if (kreis) {
      const titel = (id: string) => nachher.tasks.find(t => t.id === id)?.title ?? id;
      erg = { ok: false, status: 409, kreis, fehler: `Abgelehnt: „${titel(kreis[0])}“ würde über ${kreis.length - 1 === 1 ? 'eine Abhängigkeit' : `${kreis.length - 1} Abhängigkeiten`} auf sich selbst warten. Nichts gespeichert.`, angewandt: 0, zeilen: [] };
      throw ABBRUCH;
    }
    // Bezüge (07.10., Seil — lib/planung/bezuege.ts): nur NEU gesetzte „wartet auf“/„zahlt ein auf“ — Privat und Business bleiben
    // getrennt, eine geteilte Aufgabe wartet nie auf eine „nur ich“-Aufgabe, das Ziel steht im geteilten Bestand. Sonst 400, nichts gespeichert.
    {
      const nachIdB = new Map(nachher.tasks.map(t => [t.id, t]));
      const vorIdB = new Map(vorher.tasks.map(t => [t.id, t]));
      const grund = aufgabenBezugPruefen(nachIdB, upserts, vorIdB, { besitzer: t => nurIchBesitzer(t as Task, nachIdB), ziele: zieleBezug })
        ?? projektBezugPruefen(nachher.projects, ops.projects.filter(o => o.op === 'upsert').map(o => o.eintrag!.id), new Map(vorher.projects.map(p => [p.id, p.zielId])), zieleBezug);
      if (grund) { erg = { ok: false, status: 400, fehler: grund, angewandt: 0, zeilen: [] }; throw ABBRUCH; }
    }
    // Paket C3: wiederkehrende Aufgabe erledigt → nächste Instanz (idempotent, höchstens eine offene je Serie).
    // „nur ich“: auch eine NEUE Aufgabe unter einer fremden „nur ich“-Aufgabe gibt es nicht (Unteraufgaben erben).
    if (!opt.system) {
      const nachId = new Map(nachher.tasks.map(t => [t.id, t]));
      for (const id of upserts) { const t = nachId.get(id); if (t && !darfSehen(t, echtePerson ? opt.person : null, nachId)) { erg = { ok: false, status: 404, fehler: 'Aufgabe nicht gefunden.', angewandt: 0, zeilen: [] }; throw ABBRUCH; } }
      // Konto „nur Business“ (09.10., E4): nichts landet durch diese Änderung im Privat-Bereich (neu, verschoben, umgehängt) → 403.
      if (ohnePrivat && nachPrivat(nachher, ops, nachId)) { erg = { ok: false, status: 403, fehler: NUR_BUSINESS_PRIVAT, angewandt: 0, zeilen: [] }; throw ABBRUCH; }
    }
    // Zuständig für eine Privat-Aufgabe wird kein Konto „nur Business“ (es sähe sie nie) — nur neu gesetzte Personen zählen (09.10., E4).
    // Server-Schreiber setzen ihre Zuständigen selbst (ausgenommen, wie beim Ort); Meldungen erreichen das Konto ohnehin nie.
    if (!opt.system) {
      const nurBusiness = new Set(personenListe.filter(p => p.nurBusiness).map(p => p.speicher));
      if (nurBusiness.size) {
        const nachId = new Map(nachher.tasks.map(t => [t.id, t]));
        const vorId = new Map(vorher.tasks.map(t => [t.id, t]));
        for (const id of upserts) {
          const t = nachId.get(id);
          if (!t || !aufgabeImPrivat(t, nachId)) continue;
          const a = vorId.get(id);
          const neu = [t.assignee, ...(t.beteiligte ?? [])].filter(p => nurBusiness.has(p) && p !== a?.assignee && !(a?.beteiligte ?? []).includes(p));
          if (neu.length) { erg = { ok: false, status: 400, fehler: 'Diese Person sieht den Privat-Bereich nicht (Konto „nur Business“) — sie kann für eine Privat-Aufgabe nicht zuständig oder beteiligt sein. Nichts gespeichert.', angewandt: 0, zeilen: [] }; throw ABBRUCH; }
        }
      }
    }
    const serien = [...uebersprungen, ...serienBeimErledigen(vorher.tasks, nachher.tasks, upserts, berlinerTag(new Date(jetzt)), jetzt)];
    if (serien.length) nachher = { ...nachher, tasks: [...nachher.tasks, ...serien.filter(x => !nachher.tasks.some(y => y.id === x.id))] };
    // Wieder geöffnet (#12): die gerade erzeugte, unberührte Folgeinstanz geht weg — nie zwei offene Instanzen.
    const zurueck = folgeinstanzenBeimOeffnen(vorher.tasks, nachher.tasks, upserts);
    if (zurueck.length) { const w = new Set(zurueck); nachher = { ...nachher, tasks: nachher.tasks.filter(t => !w.has(t.id)) }; }
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
    erg = {
      ok: true, status: 200, angewandt, zeilen, state: nachher, ...(serien.length || zurueck.length ? { serien: [...serien.map(t => t.id), ...zurueck] } : {}),
      ...(entfernt.aufgaben.length || entfernt.projekte.length ? { entfernt } : {}),
    };
    return nachher;
  }, jetzt);
  } catch (e) {
    // Abgelehnt: nichts geschrieben (aufgabenSchreiben schreibt nicht, wenn die Änderung wirft).
    if (e === NICHTS_ZU_TUN) return erg;
    if (e !== ABBRUCH) throw e;
  }

  if (!erg.ok) return erg;
  // Protokoll: nur Kennungen und Feldnamen, nie Werte (lib/store/aenderungsprotokoll.ts).
  const aenderungen: Aenderung[] = [];
  for (const art of LISTEN_ARTEN) aenderungen.push(...listenDiff((vorher[art] ?? []) as { id: string }[], (nachher[art] ?? []) as { id: string }[], art));
  await protokolliere(AUFGABEN_SPEICHER, aenderungen, opt.wer);
  await meldungenNachSchreiben(aufgabenSicht(vorher), aufgabenSicht(nachher), neueKommentare, echtePerson ? opt.person : SYSTEM, personenListe);
  // Follow-up = Aufgabe (29.09., #99): erledigte Aufgaben erledigen ihre verknüpften CRM-Follow-ups (idempotent, wirft nie).
  await followupsNachAufgaben(vorher, nachher, echtePerson ? opt.person : SYSTEM);
  // Umzug Privat ↔ Business (29.09., #4): der Bereich der Dateien an umgezogenen Aufgaben zieht mit.
  await dateienBereichNachziehen(vorher, nachher, opt.haushalt, echtePerson ? opt.person : SYSTEM);
  if (erg.entfernt && opt.haushalt) await papierkorbDateienEntfernen(opt.haushalt, opt.person, erg.entfernt);
  // Meilensteine (30.09.): Aufgaben in einer Meilenstein-Liste geändert → Fortschritt von Meilenstein und Ziel nachziehen
  // (lib/planung/meilenstein-aufgaben-server.ts; wirft nie, schreibt nur bei echter Änderung).
  try { await (await import('@/lib/planung/meilenstein-aufgaben-server')).nachAufgabenSchreiben(vorher, nachher, echtePerson ? opt.person : SYSTEM); }
  catch (e) { console.error('[aufgaben] Meilenstein-Fortschritt nicht nachgezogen —', e instanceof Error ? e.message : e); }
  return erg;
}

/**
 * Dateien endgültig gelöschter Projekte/Aufgaben entfernen (29.09., Papierkorb). Solange ein Eintrag im Papierkorb
 * liegt, bleiben seine Dateien — erst hier gehen sie. Ein Fehler bricht nichts (der Bestand ist schon geschrieben);
 * übrig gebliebene meldet die Verbindungsprüfung (`aufgaben-datei-verweis-tot`).
 */
export async function papierkorbDateienEntfernen(haushalt: string, person: string, entfernt: { aufgaben: readonly string[]; projekte: readonly string[] }): Promise<number> {
  try {
    const { aufgabenDateienListe, aufgabenDateiEntfernen } = await import('@/lib/dateien/aufgaben-ablage');
    const a = new Set(entfernt.aufgaben), p = new Set(entfernt.projekte);
    const weg = (await aufgabenDateienListe(haushalt)).filter(e => p.has(e.projektId) || (!!e.aufgabeId && a.has(e.aufgabeId)));
    let n = 0;
    for (const e of weg) {
      try { if (await aufgabenDateiEntfernen(haushalt, person, e.id)) n++; }
      catch (err) { console.error('[aufgaben/papierkorb] Datei nicht entfernt —', err instanceof Error ? err.message : err); }
    }
    return n;
  } catch (e) {
    console.error('[aufgaben/papierkorb] Dateien nicht entfernt —', e instanceof Error ? e.message : e);
    return 0;
  }
}

// ── Meldungen ──────────────────────────────────────────────────────────────

/** Personen des Haushalts des Inhabers (Speichername + Anzeigename) — für „beide“ und für Texte. */
export async function haushaltPersonen(): Promise<{ speicher: string; name: string; nurBusiness?: true }[]> {
  return haushaltsPersonen();
}

const kurzTitel = (t: string) => (t.length > 80 ? `${t.slice(0, 79)}…` : t);
const vorname = (n: string | undefined, rueck: string) => (n ?? '').trim().split(/\s+/)[0] || rueck;

/**
 * Wer bekommt eine Meldung? (rein, testbar)
 *  · Neu verantwortlich (auch neu angelegt für jemand anderen) → „zuweisung“; neu beteiligt (29.09.) → „zuweisung“
 *    („… hat dich an „X“ beteiligt“). Mehrere Zuweisungen an dieselbe Person in EINEM Schreibvorgang werden zu EINER
 *    Meldung gebündelt („Kevin hat dir 5 Aufgaben zugewiesen“, #42).
 *  · Neuer Kommentar → Erwähnte „erwaehnung“, übrige Zuständige (verantwortlich + beteiligt) „kommentar“.
 *  · Nie an die schreibende Person selbst, nie über erledigte/abgebrochene Aufgaben (Zuweisung), nie über eine Aufgabe,
 *    die die Empfängerin nicht sehen darf („nur ich“; Privat-Bereich für ein Konto „nur Business“, 09.10.).
 */
export function meldungenBerechnen(
  vorher: TasksState, nachher: TasksState, neueKommentare: readonly { task: Task; k: AufgabeKommentar }[], person: string,
  personen: readonly { speicher: string; name: string; nurBusiness?: boolean }[],
): MeldungEingabe[] {
  const alle = personen.map(p => p.speicher);
  const ichName = person === SYSTEM ? 'MAKE OS' : vorname(personen.find(p => p.speicher === person)?.name, person);
  const bekannt = new Set(alle);
  const raus: MeldungEingabe[] = [];
  const alt = new Map(vorher.tasks.map(t => [t.id, t]));
  const nachId = new Map(nachher.tasks.map(t => [t.id, t]));
  // „nur ich“ — und Konten „nur Business“ (09.10., E4) erfahren nie etwas über eine Aufgabe im Privat-Bereich.
  const nurBusiness = new Set(personen.filter(p => p.nurBusiness).map(p => p.speicher));
  const sieht = (t: Task, an: string) => darfSehen(t, an, nachId) && !(nurBusiness.has(an) && aufgabeImPrivat(t, nachId));
  const zuweisungen = new Map<string, MeldungEingabe[]>();
  const merke = (m: MeldungEingabe) => zuweisungen.set(m.an, [...(zuweisungen.get(m.an) ?? []), m]);
  for (const t of nachher.tasks) {
    const a = alt.get(t.id);
    if (t.status === 'done' || t.status === 'cancelled') continue;
    const vorherVerantwortlich = new Set(a ? (a.assignee === 'both' ? alle : [a.assignee]) : []);
    const vorherDabei = new Set(a ? alleZustaendigen(a, alle) : []);
    const jetztVerantwortlich = t.assignee === 'both' ? alle : [t.assignee];
    for (const an of jetztVerantwortlich) {
      if (an === person || vorherVerantwortlich.has(an) || !bekannt.has(an) || !sieht(t, an)) continue;
      merke({ an, art: 'zuweisung', titel: `${ichName} hat dir „${kurzTitel(t.title)}“ zugewiesen`, link: WEG.aufgabe(t.id), von: person, bezug: { art: 'aufgabe', id: t.id } });
    }
    for (const an of t.beteiligte ?? []) {
      if (an === person || vorherDabei.has(an) || !bekannt.has(an) || !sieht(t, an)) continue;
      merke({ an, art: 'zuweisung', titel: `${ichName} hat dich an „${kurzTitel(t.title)}“ beteiligt`, link: WEG.aufgabe(t.id), von: person, bezug: { art: 'aufgabe', id: t.id } });
    }
  }
  for (const [an, l] of Array.from(zuweisungen.entries())) {
    if (l.length === 1) { raus.push(l[0]); continue; }
    raus.push({ an, art: 'zuweisung', titel: `${ichName} hat dir ${l.length} Aufgaben zugewiesen`, link: WEG.aufgaben({}), von: person });
  }
  for (const { task, k } of neueKommentare) {
    const erwaehnt = new Set((k.erwaehnt ?? []).filter(p => bekannt.has(p)));
    for (const an of Array.from(erwaehnt)) {
      if (an === person || !sieht(task, an)) continue;
      raus.push({ an, art: 'erwaehnung', titel: `${ichName} hat dich bei „${kurzTitel(task.title)}“ erwähnt`, link: WEG.aufgabe(task.id), von: person, bezug: { art: 'aufgabe', id: task.id } });
    }
    for (const an of alleZustaendigen(task, alle)) {
      if (an === person || erwaehnt.has(an) || !bekannt.has(an) || !sieht(task, an)) continue;
      raus.push({ an, art: 'kommentar', titel: `${ichName} hat „${kurzTitel(task.title)}“ kommentiert`, link: WEG.aufgabe(task.id), von: person, bezug: { art: 'aufgabe', id: task.id } });
    }
  }
  return raus;
}

async function meldungenNachSchreiben(vorher: TasksState, nachher: TasksState, neueKommentare: { task: Task; k: AufgabeKommentar }[], person: string, personen?: readonly { speicher: string; name: string; nurBusiness?: boolean }[]) {
  try {
    const liste = meldungenBerechnen(vorher, nachher, neueKommentare, person, personen ?? await haushaltPersonen());
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
