// ─── MAKE OS — Aufgaben-Bestand (Speicher „tasks“) ──────────────────────────
// GET   → { state: { projects, tasks, listen, statusEigen, gruppen, vorlagen } (jede Zeile mit `stand`), spaces }
// PATCH → Einzeländerungen: { ops: [{ op: 'upsert', task|eintrag, stand? } | { op: 'delete', id, stand? }],
//          struktur?: { projekte?, listen?, status?, gruppen?, vorlagen? } (dieselbe Form), massenAenderung?, massenLoeschung? }
//          Kreis in „wartet auf“ → 409 mit `kreis`; der Verlauf je Aufgabe entsteht hier (lib/aufgaben/verlauf.ts).
//          Wiederkehrende Aufgabe erledigt → nächste Instanz im selben Schreibvorgang, Antwort `serien: [id]` (lib/aufgaben/serie.ts).
// PUT   → ganzer Stand — NUR beim leeren Erststart (29.09., A2); liegt schon etwas im Bestand → 409 `{ neuLaden: true }`.
//
// Seit 29.09. (A2/A7, Kevin: „Alle Infos müssen immer sauber gespeichert werden“):
//   · Build-Kennung: PATCH/PUT aus einem alten Tab (fremde/fehlende `x-make-bau`) → 409 `{ neuLaden: true }` (lib/bau).
//   · Upsert ohne Stand über einen bestehenden Eintrag = Teil-Merge (fehlende Felder bleiben).
//   · Paket T1 (29.09.): Sichtfilter „nur ich“ je Person (fremde „nur ich“-Aufgaben lesen: nie; schreiben: 404),
//     ETag/304 für GET, Prüfregeln (Datum, eine Verantwortliche, Start ≤ Deadline) → 400, Server-Zeitstempel.
//   · Papierkorb: GET liefert ihn nur mit `?papierkorb=1` (die Aufgaben-Seite); alle anderen Leser sehen ihn nie.
//     `delete` auf einen Eintrag außerhalb des Papierkorbs legt hinein, auf einen Papierkorb-Eintrag ist es endgültig
//     (samt Dateien, lib/aufgaben/papierkorb.ts).
//
// Seit 28.09. abends (Aufgaben wie Monday/ClickUp, AUFGABEN_PLAN.md):
//   · Zugang nur Haushalt des Inhabers — lesen auch der Systemlauf (Dienstweg ohne Person), schreiben nur
//     eine Person dieses Haushalts (vorher fehlte die Prüfung ganz).
//   · Stand je Zeile: veraltet → 409 mit `konflikte[]` und dem aktuellen Bestand, nichts überschrieben.
//   · Grenzen → 413 statt still kürzen; Änderungsprotokoll ohne Werte; Meldungen bei Zuweisung/Kommentar.
//   · Übernahme des Altbestands (Space, Unteraufgaben, Sonstige) beim Lesen und in jeder Schreibsperre.
// Die Logik liegt in lib/aufgaben/speicher.ts (Server) und lib/aufgaben/struktur.ts (rein).

import { NextResponse } from 'next/server';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { etagAus, unveraendert, jsonAntwort } from '@/lib/http/json-antwort';
import { sichtFuer } from '@/lib/aufgaben/sicht';
import { protokolliereBestand, werAus } from '@/lib/store/aenderungsprotokoll';
import { brauchtBestaetigung, MASSEN_GRENZE } from '@/lib/store/massen-wache';
import { imHaushaltDesInhabers, imHaushaltOderSystemlauf, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { bauPruefen } from '@/lib/bau/pruefen';
import { NEU_LADEN_TEXT } from '@/lib/bau/kennung';
import { aufgabenSicht } from '@/lib/aufgaben/papierkorb';
import { aufgabenSchreiben } from '@/lib/aufgaben/umbau';
import { zuGross } from '@/lib/zugang/umfang';
import { uebernehmen } from '@/lib/aufgaben/struktur';
import { taskSauber, projektSauber, listeSauber, statusSauber, gruppeSauber, vorlageSauber, AUFGABEN_GRENZEN, ZuGross } from '@/lib/aufgaben/saeubern';
import { ladeAufgaben, spacesFuer, fuerBrowser, opsLesen, aufgabenAendern, orgZuordnung, AUFGABEN_SPEICHER } from '@/lib/aufgaben/speicher';
import type { Task, TasksState, Project, AufgabenListe, AufgabenStatus, AufgabenGruppe, AufgabenVorlage } from '@/types/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GESPERRT = () => NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });
/** Größter Body, den die Route liest (ganzer Stand beim PUT). */
const MAX_BYTES = 20 * 1024 * 1024;

export async function GET(req: Request) {
  const zugang = await imHaushaltOderSystemlauf(req);
  if (!zugang) return GESPERRT();
  const mitPapierkorb = new URL(req.url).searchParams.get('papierkorb') === '1';
  // ETag/304 (29.09., #86): Stand von Aufgaben, CRM (Mandanten-Spaces), Orten und Konten (Übernahme) + Person (Sichtfilter
  // „nur ich“ je Person) + Papierkorb ja/nein. Unverändert → 304 ohne Lesen, Übernahme und Fingerabdrücke.
  const etag = etagAus('aufgaben1', zugang.person ?? 'system', mitPapierkorb ? 'korb' : 'sicht', await speicherStand([AUFGABEN_SPEICHER, 'crm', 'ordnung', 'konten']));
  const nichts = unveraendert(req, etag);
  if (nichts) return nichts;
  const roh = await loadJson<TasksState>(AUFGABEN_SPEICHER);
  if (!roh) return jsonAntwort(req, { state: null, spaces: await spacesFuer({ projects: [], tasks: [] }) }, etag);
  const voll = await ladeAufgaben();
  // Sichtfilter „nur ich“ (29.09.): jede Person sieht nur ihre eigenen „nur ich“-Aufgaben; der Systemlauf keine.
  const state = sichtFuer(mitPapierkorb ? voll : aufgabenSicht(voll), zugang.person);
  return jsonAntwort(req, { state: fuerBrowser(state), spaces: await spacesFuer(state) }, etag);
}

async function body(req: Request): Promise<Record<string, unknown> | NextResponse> {
  if (zuGross(req, MAX_BYTES)) return NextResponse.json({ ok: false, error: 'Abgelehnt: zu groß.' }, { status: 413 });
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 });
  } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
}

export async function PATCH(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return GESPERRT();
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  const b = await body(req);
  if (b instanceof NextResponse) return b;
  const gelesen = opsLesen(b);
  if (!gelesen.ok) return NextResponse.json({ ok: false, error: gelesen.fehler }, { status: gelesen.status });
  const haushalt = (await haushaltFuer(zugang.person))?.haushalt;
  const r = await aufgabenAendern(gelesen.ops, { person: zugang.person, wer: werAus(req), massenAenderung: b.massenAenderung === true, massenLoeschung: b.massenLoeschung === true, ...(haushalt ? { haushalt } : {}) });
  if (r.ok) return NextResponse.json({ ok: true, angewandt: r.angewandt, zeilen: r.zeilen, ...(r.serien?.length ? { serien: r.serien } : {}) });
  const aktuell = r.konflikte?.length ? sichtFuer(r.state ?? await ladeAufgaben(), zugang.person) : null;
  return NextResponse.json({
    ok: false, error: r.fehler, ...(r.konflikte ? { konflikte: r.konflikte } : {}),
    ...(r.massenAenderung ? { massenAenderung: true, anzahl: r.anzahl, grenze: r.grenze } : {}),
    ...(r.massenLoeschung ? { massenLoeschung: true } : {}),
    ...(r.kreis ? { kreis: r.kreis } : {}),
    ...(aktuell ? { state: fuerBrowser(aktuell) } : {}),
  }, { status: r.status });
}

/**
 * Ganzer Stand — NUR beim leeren Erststart (29.09., A2). Liegt schon etwas im Bestand, ersetzte ein PUT aus einem alten
 * Fenster die ganze Liste: 409 `{ neuLaden: true }`. Mit Schrumpf-Wächter und Massen-Wache in der Sperre; zu viel → 413.
 * Die Übernahme läuft auch hier — der gespeicherte Stand hat danach Spaces, Unteraufgaben, Sonstige.
 */
export async function PUT(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return GESPERRT();
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  const b = await body(req);
  if (b instanceof NextResponse) return b;
  if (!Array.isArray(b.tasks) || !Array.isArray(b.projects)) return NextResponse.json({ ok: false, error: 'Ungültiger Zustand: tasks/projects fehlen.' }, { status: 400 });
  if (b.tasks.length > AUFGABEN_GRENZEN.aufgaben) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${AUFGABEN_GRENZEN.aufgaben} Aufgaben.` }, { status: 413 });
  if (b.projects.length > AUFGABEN_GRENZEN.projekte) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${AUFGABEN_GRENZEN.projekte} Projekte.` }, { status: 413 });
  let tasks: Task[], projects: Project[], listen: AufgabenListe[] | undefined, statusEigen: AufgabenStatus[] | undefined;
  let gruppen: AufgabenGruppe[] | undefined, vorlagen: AufgabenVorlage[] | undefined;
  try {
    tasks = b.tasks.map(taskSauber).filter((t): t is Task => !!t);
    projects = b.projects.map(projektSauber).filter((p): p is Project => !!p);
    listen = Array.isArray(b.listen) ? b.listen.map(listeSauber).filter((l): l is AufgabenListe => !!l) : undefined;
    statusEigen = Array.isArray(b.statusEigen) ? b.statusEigen.map(statusSauber).filter((s): s is AufgabenStatus => !!s) : undefined;
    gruppen = Array.isArray(b.gruppen) ? b.gruppen.map(gruppeSauber).filter((g): g is AufgabenGruppe => !!g) : undefined;
    vorlagen = Array.isArray(b.vorlagen) ? b.vorlagen.map(vorlageSauber).filter((v): v is AufgabenVorlage => !!v) : undefined;
  } catch (e) {
    if (e instanceof ZuGross) return NextResponse.json({ ok: false, error: e.message }, { status: 413 });
    throw e;
  }
  const orgs = await orgZuordnung();
  let abgelehnt = false;
  let massen = 0;
  let nichtLeer = false;
  let vorher: TasksState | null = null;
  const next = await aufgabenSchreiben(current => {
    vorher = current;
    // Nur der Erststart darf den ganzen Stand schreiben — sonst wäre es ein altes Fenster, das alles ersetzt.
    if (current && ((current.tasks?.length ?? 0) > 0 || (current.projects?.length ?? 0) > 0)) { nichtLeer = true; return current; }
    const alt = current?.tasks?.length ?? 0;
    // Ab 10 Aufgaben: die Hälfte auf einmal zu verlieren ist fast immer ein Fehler — ablehnen, bis bestätigt.
    if (alt >= 10 && tasks.length < alt / 2 && b.massenLoeschung !== true) { abgelehnt = true; return current as TasksState; }
    const pruef = brauchtBestaetigung(current?.tasks ?? [], tasks, b.massenAenderung === true);
    if (pruef.noetig) { massen = pruef.anzahl; return current as TasksState; }
    // Der Verlauf gehört dem Server (die Säuberung verwirft ihn) — der gespeicherte bleibt je Aufgabe stehen.
    const verlauf = new Map((current?.tasks ?? []).filter(t => t.verlauf?.length).map(t => [t.id, t.verlauf]));
    const mitVerlauf = tasks.map(t => (verlauf.has(t.id) ? { ...t, verlauf: verlauf.get(t.id) } : t));
    return uebernehmen({
      projects, tasks: mitVerlauf, listen: listen ?? current?.listen ?? [], statusEigen: statusEigen ?? current?.statusEigen ?? [],
      gruppen: gruppen ?? current?.gruppen ?? [], vorlagen: vorlagen ?? current?.vorlagen ?? [],
    }, orgs).state;
  });
  if (nichtLeer) return NextResponse.json({ ok: false, neuLaden: true, error: `Ganzer Stand nur beim Erststart. ${NEU_LADEN_TEXT}` }, { status: 409 });
  if (abgelehnt) return NextResponse.json({ ok: false, massenLoeschung: true, error: 'Abgelehnt: das hätte über die Hälfte der Aufgaben gelöscht. Wenn das so gewollt ist, noch einmal mit ausdrücklicher Bestätigung schicken.' }, { status: 409 });
  if (massen) return NextResponse.json({ ok: false, massenAenderung: true, anzahl: massen, grenze: MASSEN_GRENZE, error: `Abgelehnt: das hätte ${massen} Aufgaben auf einmal erledigt. Wenn das so gewollt ist, noch einmal mit ausdrücklicher Bestätigung schicken.` }, { status: 409 });
  await protokolliereBestand(AUFGABEN_SPEICHER, vorher, next, werAus(req));
  return NextResponse.json({ ok: true });
}
