// ─── ZOE an Aufgaben (Paket C4, 28.09. spät) — Schreibwege und Werkzeuge ────
// Kevin: „ZOE soll ihre eigenen Aufgaben und Stapel bekommen, die sie abarbeiten kann und wir freigeben.“
// Regeln rein in lib/aufgaben/zoe.ts; der Lauf in lib/zoe/aufgaben-lauf.ts; Route /api/aufgaben/zoe.
//
// Hier: jede Änderung an einer Aufgabe läuft über den EINEN Schreibweg `aufgabenAendern` (Stand je Zeile, 409,
// Verlauf, Änderungsprotokoll, Meldungen) — frisch gelesen, mit dem Stand der gelesenen Zeile; ohne Stand vom
// Browser wird bei „inzwischen geändert“ neu gelesen und neu angewandt (nie still überschrieben).
//   · An ZOE geben / zurückholen (Person, optional Hinweis als Kommentar „Hinweis an ZOE: …“)
//   · Vorschlag freigeben — übernimmt Entwurf, Unteraufgaben, Status, Deadline (nur die Auftraggeberin)
//   · Vorschlag ablehnen — optional Grund, optional „nochmal mit Hinweis“ zurück an ZOE
//   · Werkzeuge fürs Gespräch: `meine_aufgaben` (lesen), `aufgabe_an_zoe` (übergeben) — nur Personen im Haushalt
//     des Inhabers. Das Übernehmen ist bewusst KEIN Werkzeug: Vorschläge mit Bezug „aufgabe“ entscheidet nur
//     /api/zoe/stapel bzw. /api/aufgaben/zoe über `vorschlagFreigeben` — ein eingeschleuster Werkzeug-Aufruf
//     kann so keinen eigenen „Aufgaben-Vorschlag“ in den Stapel legen.
// ZOE versendet nichts und löscht nichts: kein Werkzeug hier schreibt nach außen oder entfernt eine Aufgabe.
// Seit 29.09. (#94–#97): Freigabe vergleicht den Stand beim Vorschlag (`eingabe._stand`) mit dem jetzigen — hat jemand
// Status/Deadline inzwischen geändert, 409 mit Diff statt Überschreiben (außer ausdrücklich `trotzdem`); einzelne Felder
// lassen sich abwählen (Häkchen); eine Deadline in der Vergangenheit wird nicht übernommen; der freigegebene Eintrag trägt
// die Vorher-Werte (`_vorher`, `_nachher`, `_neue`) und Charge (`_charge`, bei Sammelfreigabe `_sammel`) für
// „Charge rückgängig“ (lib/zoe/aufgaben-charge.ts). Schlüssel mit „_“ kommen nie vom Browser.

import type { Task, TasksState, AufgabeKommentar, ZoeAuftrag } from '@/types/tasks';
import { ladeAufgabenSicht, aufgabenAendern, type AufgabenOps } from '@/lib/aufgaben/speicher';
import { AUFGABEN_GRENZEN } from '@/lib/aufgaben/saeubern';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { localDay } from '@/lib/zeit';
import {
  auftraggeberinVon, darfAnZoe, vorschlagAnwenden, vorschlagSauber, vorschlagZeile, zoeAufgaben, standAbweichung, konfliktText, zoeStandLesen,
  ZOE_AUFGABE_WERKZEUG, ZOE_STATUS_LABEL, ZOE_VORSCHLAG_GRENZEN, type ZoeVorschlagInhalt, type ZoeKonflikt, type ZoeStand,
} from '@/lib/aufgaben/zoe';
import { suchPasst } from '@/lib/text/such-norm';
import { hole, entscheide, beanspruche, loslassen, type Vorschlag } from './stapel';
import { notiere } from './protokoll';
import type { Risiko, Vorschau } from './register';
import type { StapelArtFreigabe } from './stapel-arten';
import { neueKennung } from '@/lib/kennung';

export type ZoeErgebnis<T = Task> = { ok: true; wert: T } | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; konflikt?: boolean; /** Seit dem Vorschlag geändert (#95). */ diff?: ZoeKonflikt[] };
const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string, konflikt = false, diff?: ZoeKonflikt[]): { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; konflikt?: boolean; diff?: ZoeKonflikt[] } => ({ ok: false, status, fehler, ...(konflikt ? { konflikt } : {}), ...(diff?.length ? { diff } : {}) });
const kurz = (t: string, n = 80) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const kennung = (p: string) => neueKennung(p);

type Aenderung = { task: Task; neue?: Task[]; kommentar?: AufgabeKommentar } | { fehler: string; status: 400 | 403 | 404 | 409 | 413; diff?: ZoeKonflikt[] };

/**
 * Eine Aufgabe über den Schreibweg ändern: frisch lesen → `aendern` → schreiben mit dem Stand der gelesenen Zeile.
 * Mit `stand` (vom Browser) genau ein Versuch — veraltet → 409 (`konflikt`). Ohne: bis zu 3 Versuche.
 */
export async function aufgabeZoeAendern(id: string, aendern: (t: Task, state: TasksState) => Aenderung, opt: {
  person: string; zoe?: boolean; stand?: string; jetzt?: string;
}): Promise<ZoeErgebnis> {
  const versuche = opt.stand ? 1 : 3;
  for (let i = 0; i < versuche; i++) {
    const state = await ladeAufgabenSicht(opt.person); // Sichtfilter „nur ich“ (29.09.)
    const t = state.tasks.find(x => x.id === id);
    if (!t) return nein(404, 'Aufgabe nicht gefunden.');
    const stand = fingerabdruck(t as unknown as Record<string, unknown>);
    if (opt.stand && opt.stand !== stand) return nein(409, 'Jemand hat die Aufgabe inzwischen geändert — Stand neu geladen, bitte noch einmal.', true);
    const a = aendern(t, state);
    if ('fehler' in a) return nein(a.status, a.fehler, false, a.diff);
    const jetzt = opt.jetzt ?? new Date().toISOString();
    const ops: AufgabenOps = { tasks: [], projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [] };
    const task = a.kommentar ? { ...a.task, kommentare: [...(t.kommentare ?? []), a.kommentar] } : a.task;
    if (task.kommentare && task.kommentare.length > AUFGABEN_GRENZEN.kommentare) return nein(413, `Abgelehnt: höchstens ${AUFGABEN_GRENZEN.kommentare} Kommentare an einer Aufgabe.`);
    ops.tasks.push({ op: 'upsert', eintrag: task, stand, ...(a.kommentar ? { mitKommentaren: true } : {}) });
    for (const n of a.neue ?? []) ops.tasks.push({ op: 'upsert', eintrag: n });
    // Nur dieser Weg darf `zoe.status` ändern (per PATCH wird es ignoriert, 29.09. #78).
    const r = await aufgabenAendern(ops, { person: opt.person, wer: { art: opt.zoe ? 'zoe' : 'person', person: opt.person }, jetzt, zoeStatus: true });
    if (r.ok) return { ok: true, wert: r.state?.tasks.find(x => x.id === id) ?? task };
    if (r.konflikte?.length && i < versuche - 1) continue;
    if (r.konflikte?.length) return nein(409, r.fehler ?? 'Inzwischen geändert.', true);
    return nein(r.status === 200 ? 409 : r.status, r.fehler ?? 'Nicht gespeichert.');
  }
  return nein(409, 'Inzwischen geändert.', true);
}

const ohneZoe = (t: Task): Task => { const { zoe: _z, ...rest } = t; return rest as Task; };

// ── An ZOE geben / zurückholen ─────────────────────────────────────────────

/** „An ZOE geben“: `zoe.status = offen`; die gebende Person ist die Auftraggeberin (`zoe.von`), der Hinweis steht in `zoe.hinweis`. */
export async function anZoeGeben(id: string, person: string, opt: { hinweis?: string; stand?: string; durchZoe?: boolean } = {}): Promise<ZoeErgebnis> {
  if (!(await personImHaushaltDesInhabers(person))) return nein(403, 'Nur im Haushalt des Inhabers.');
  const hinweis = (opt.hinweis ?? '').replace(/\u0000/g, '').trim();
  if (hinweis.length > ZOE_VORSCHLAG_GRENZEN.hinweis) return nein(413, `Abgelehnt: der Hinweis an ZOE ist länger als ${ZOE_VORSCHLAG_GRENZEN.hinweis} Zeichen.`);
  const jetzt = new Date().toISOString();
  return aufgabeZoeAendern(id, t => {
    if (!darfAnZoe(t)) return { status: 409, fehler: t.status === 'done' ? 'Die Aufgabe ist erledigt.' : `ZOE hat die Aufgabe schon (${ZOE_STATUS_LABEL[t.zoe!.status]}).` };
    // Nach einer Ablehnung bleibt der alte Vorschlag verknüpft — ZOE liest daraus den Grund.
    const zoe: ZoeAuftrag = { status: 'offen', von: person, ...(hinweis ? { hinweis } : {}), ...(t.zoe?.status === 'abgelehnt' && t.zoe.stapelId ? { stapelId: t.zoe.stapelId } : {}) };
    return { task: { ...t, zoe, updatedAt: jetzt } };
  }, { person, stand: opt.stand, jetzt, zoe: opt.durchZoe });
}

/** Von ZOE zurückholen (nur die Auftraggeberin): ZOE-Feld weg; ein wartender Vorschlag gilt als abgelehnt. */
export async function vonZoeZurueck(id: string, person: string, opt: { stand?: string } = {}): Promise<ZoeErgebnis> {
  let offenerVorschlag: string | undefined;
  const r = await aufgabeZoeAendern(id, t => {
    if (!t.zoe) return { status: 409, fehler: 'Die Aufgabe liegt nicht bei ZOE.' };
    const a = auftraggeberinVon(t);
    if (a && a !== person) return { status: 403, fehler: 'Nur wer die Aufgabe an ZOE gab, holt sie zurück.' };
    if (t.zoe.status === 'in_arbeit') return { status: 409, fehler: 'ZOE arbeitet gerade daran — gleich noch einmal.' };
    offenerVorschlag = t.zoe.status === 'wartet_freigabe' ? t.zoe.stapelId : undefined;
    return { task: ohneZoe({ ...t, updatedAt: new Date().toISOString() }) };
  }, { person, stand: opt.stand });
  if (r.ok && offenerVorschlag) {
    const v = await hole(offenerVorschlag);
    if (v?.status === 'offen') await entscheide(v.id, 'abgelehnt', { grund: 'zurückgeholt', von: person });
  }
  return r;
}

// ── Freigeben / Ablehnen ───────────────────────────────────────────────────

/** Gehört der Vorschlag zu dieser Aufgabe und dieser Person, und ist er noch offen? */
function vorschlagPasst(v: Vorschlag | null, person: string, aufgabeId?: string): string | null {
  if (!v || v.werkzeug !== ZOE_AUFGABE_WERKZEUG || v.bezug?.art !== 'aufgabe') return 'Vorschlag nicht gefunden.';
  if (aufgabeId && v.bezug.id !== aufgabeId) return 'Vorschlag nicht gefunden.';
  if (v.person !== person) return 'Nur wer die Aufgabe an ZOE gab, gibt frei.';
  if (v.status !== 'offen') return `Schon entschieden (${v.status}).`;
  return null;
}

/**
 * Die Vorschläge in die Aufgabe übernehmen (ohne den Stapel-Eintrag zu entscheiden — das tun die Aufrufer).
 * `inhalt` ist die (evtl. geänderte) Eingabe, erneut gesäubert. Die Aufgabe muss auf GENAU diesen Vorschlag warten.
 */
/** Was eine Freigabe an der Aufgabe änderte — für „Charge rückgängig“ (nur Kurzwerte und Längen, nie Texte). */
export interface FreigabeVorher {
  vorher: { status: Task['status']; statusId?: string; completedAt?: string; dueDate?: string; notizLaenge: number };
  nachher: { status: Task['status']; statusId?: string; dueDate?: string; notizLaenge: number };
  neue: string[];
}

export async function vorschlagInAufgabe(stapelId: string, inhaltRoh: Record<string, unknown>, person: string, opt: { stand?: string; standBeimVorschlag?: ZoeStand | null; trotzdem?: boolean } = {}): Promise<ZoeErgebnis<{ task: Task; neue: number; inhalt: ZoeVorschlagInhalt; protokoll: FreigabeVorher }>> {
  const aufgabeId = String(inhaltRoh.aufgabeId ?? '');
  const inhalt = vorschlagSauber(inhaltRoh, aufgabeId);
  if (!inhalt) return nein(400, 'Nichts ausgewählt — der Vorschlag wäre leer.');
  const heute = localDay();
  // Deadline in der Vergangenheit (#96): nie still übernehmen — abwählen oder ändern.
  if (inhalt.deadline && inhalt.deadline < heute) return nein(409, `Die vorgeschlagene Deadline ${inhalt.deadline.slice(8, 10)}.${inhalt.deadline.slice(5, 7)}. liegt in der Vergangenheit — bitte abwählen.`);
  const jetzt = new Date().toISOString();
  let neue = 0;
  let protokoll: FreigabeVorher | null = null;
  const r = await aufgabeZoeAendern(aufgabeId, (t, state) => {
    if (t.zoe?.status !== 'wartet_freigabe' || t.zoe.stapelId !== stapelId) return { status: 409, fehler: 'Die Aufgabe wartet nicht (mehr) auf diesen Vorschlag.' };
    const a = auftraggeberinVon(t);
    if (a !== person) return { status: 403, fehler: 'Nur wer die Aufgabe an ZOE gab, gibt frei.' };
    // Stand beim Vorschlag (#95): Status/Deadline inzwischen geändert → nicht überschreiben, sondern zeigen.
    const k = opt.trotzdem ? [] : standAbweichung(opt.standBeimVorschlag ?? null, t, inhalt, state.statusEigen ?? []);
    if (k.length) return { status: 409, fehler: `Inzwischen geändert — ${konfliktText(k)}. Feld abwählen oder „trotzdem übernehmen“.`, diff: k };
    const x = vorschlagAnwenden(t, inhalt, {
      stapelId, jetzt, tag: localDay(), eigene: state.statusEigen ?? [], geschwister: state.tasks, notizMax: AUFGABEN_GRENZEN.notiz,
      neueId: i => `${kennung('t-zoe')}${i}`,
    });
    if (!x.ok) return { status: 413, fehler: x.fehler };
    neue = x.neue.length;
    protokoll = {
      vorher: { status: t.status, ...(t.statusId ? { statusId: t.statusId } : {}), ...(t.completedAt ? { completedAt: t.completedAt } : {}), ...(t.dueDate ? { dueDate: t.dueDate } : {}), notizLaenge: (t.notiz ?? '').trimEnd().length },
      nachher: { status: x.task.status, ...(x.task.statusId ? { statusId: x.task.statusId } : {}), ...(x.task.dueDate ? { dueDate: x.task.dueDate } : {}), notizLaenge: (x.task.notiz ?? '').length },
      neue: x.neue.map(n => n.id),
    };
    return { task: x.task, neue: x.neue };
  }, { person, stand: opt.stand, jetzt });
  return r.ok ? { ok: true, wert: { task: r.wert, neue, inhalt, protokoll: protokoll! } } : r;
}

/**
 * Freigeben (an der Aufgabe und im Stapel): prüfen und beanspruchen (in der Sperre, lib/zoe/stapel.ts `beanspruche`),
 * übernehmen, dann den Stapel-Eintrag entscheiden (mit Person, dauerhaft) und protokollieren. Bleibt offen, wenn
 * nichts übernommen wurde; ein zweiter Klick währenddessen bekommt 409.
 */
export async function vorschlagFreigeben(stapelId: string, person: string, opt: { stand?: string; aufgabeId?: string; eingabe?: Record<string, unknown> | null; trotzdem?: boolean; sammel?: string } = {}): Promise<ZoeErgebnis<{ task: Task; text: string }>> {
  const a = await beanspruche(stapelId, person, v => {
    const falsch = vorschlagPasst(v, person, opt.aufgabeId);
    return falsch ? { status: falsch.startsWith('Schon') ? 409 : falsch.startsWith('Nur') ? 403 : 404, fehler: falsch } : null;
  });
  if (!a.ok) return nein(a.status, a.fehler);
  const v = a.v;
  // „Ändern & freigeben“ bzw. Häkchen (#94): geänderte/abgewählte Felder ja, aber immer für DIESE Aufgabe und erneut
  // gesäubert. Schlüssel mit „_“ (Stand, Charge) kommen nur aus dem gespeicherten Eintrag, nie aus der Eingabe.
  const vomBrowser = Object.fromEntries(Object.entries(opt.eingabe ?? {}).filter(([k]) => !k.startsWith('_')));
  const eingabe = { ...v.eingabe, ...vomBrowser, aufgabeId: v.bezug!.id };
  let r: Awaited<ReturnType<typeof vorschlagInAufgabe>>;
  try { r = await vorschlagInAufgabe(v.id, eingabe, person, { stand: opt.stand, standBeimVorschlag: zoeStandLesen(v.eingabe._stand), trotzdem: opt.trotzdem }); }
  catch (e) { await loslassen(v.id); throw e; }
  if (!r.ok) { await loslassen(v.id); return r; }
  const text = uebernommenText(r.wert.task, r.wert.inhalt, r.wert.neue);
  const p = r.wert.protokoll;
  await entscheide(v.id, 'freigegeben', {
    ergebnis: text, von: person, ausArbeit: true,
    eingabe: {
      ...r.wert.inhalt, ...(v.eingabe._stand ? { _stand: v.eingabe._stand } : {}), ...(typeof v.eingabe._charge === 'string' ? { _charge: v.eingabe._charge } : {}),
      ...(opt.sammel ? { _sammel: opt.sammel } : {}), _vorher: p.vorher, _nachher: p.nachher, _neue: p.neue,
    } as unknown as Record<string, unknown>,
  });
  await notiere({ werkzeug: ZOE_AUFGABE_WERKZEUG, gruppe: 'aufgaben', risiko: 'freigabe', eingabe: { aufgabeId: r.wert.task.id }, ergebnis: text, ok: true, quelle: 'stapel', person, ruecknahme: null });
  return { ok: true, wert: { task: r.wert.task, text } };
}

const uebernommenText = (t: Task, v: ZoeVorschlagInhalt, neue: number) =>
  `Übernommen in „${kurz(t.title)}“: ${vorschlagZeile(v)}${neue && v.unteraufgaben && neue !== v.unteraufgaben.length ? ` (${neue} angelegt)` : ''}.`;

/** Längster Ablehnungs-Grund — darüber 413 (wie /api/zoe/stapel), nie gekürzt. */
export const ABLEHN_GRUND_MAX = 400;

/**
 * Ablehnen (Route): Stapel-Eintrag „abgelehnt“ mit Grund, Aufgabe → abgelehnt — oder mit `nochmal` gleich wieder
 * an ZOE (offen, der alte Vorschlag bleibt verknüpft, ein Hinweis wird Kommentar).
 */
export async function vorschlagAblehnen(stapelId: string, person: string, opt: { grund?: string; nochmal?: boolean; hinweis?: string; aufgabeId?: string } = {}): Promise<ZoeErgebnis> {
  const v = await hole(stapelId);
  const falsch = vorschlagPasst(v, person, opt.aufgabeId);
  if (falsch) return nein(falsch.startsWith('Schon') ? 409 : falsch.startsWith('Nur') ? 403 : 404, falsch);
  const grund = (opt.grund ?? '').replace(/\u0000/g, '').trim();
  // Nie still kürzen (29.09.): ein zu langer Grund wird abgelehnt, nicht abgeschnitten.
  if (grund.length > ABLEHN_GRUND_MAX) return nein(413, `Abgelehnt: der Grund ist länger als ${ABLEHN_GRUND_MAX} Zeichen.`);
  const raus = await entscheide(v!.id, 'abgelehnt', { ...(grund ? { grund } : {}), von: person, zurueck: !!opt.nochmal });
  if (!raus) return nein(409, 'Schon entschieden oder gerade in Arbeit.');
  const r = await nachAblehnen(v!, person);
  if (!r.ok || !opt.nochmal) return r;
  return anZoeGeben(v!.bezug!.id, person, { hinweis: opt.hinweis });
}

/** Nach dem Ablehnen im Stapel (auch aus /api/zoe/stapel): die Aufgabe, die auf diesen Vorschlag wartete → abgelehnt. */
export async function nachAblehnen(v: Pick<Vorschlag, 'id' | 'bezug' | 'werkzeug'>, person: string): Promise<ZoeErgebnis> {
  if (v.werkzeug !== ZOE_AUFGABE_WERKZEUG || v.bezug?.art !== 'aufgabe') return nein(400, 'Kein Aufgaben-Vorschlag.');
  return aufgabeZoeAendern(v.bezug.id, t => {
    if (t.zoe?.status !== 'wartet_freigabe' || t.zoe.stapelId !== v.id) return { status: 409, fehler: 'Die Aufgabe wartet nicht (mehr) auf diesen Vorschlag.' };
    return { task: { ...t, zoe: { ...t.zoe, status: 'abgelehnt', stapelId: v.id }, updatedAt: new Date().toISOString() } };
  }, { person });
}

/** Die Art „aufgabe“ im Freigabe-Stapel (lib/zoe/stapel-arten.ts): Freigeben übernimmt, Ablehnen stellt die Aufgabe um. */
export const AUFGABE_STAPEL_ART: StapelArtFreigabe = {
  freigeben: async (v, person, opt) => {
    const r = await vorschlagFreigeben(v.id, person, { eingabe: opt.eingabe, ...(opt.sammel ? { sammel: opt.sammel } : {}) });
    return r.ok ? { ok: true, text: r.wert.text } : { ok: false, status: r.status, fehler: r.fehler };
  },
  nachAblehnen: (v, person) => nachAblehnen(v, person),
};

// ── Werkzeuge (Register-Einträge in register.ts/werkzeuge.ts per Spread) ──────

type Lauf = (input: Record<string, unknown>, origin: string, person?: string) => Promise<string>;
const KEINE_PERSON = 'Nicht ausgeführt: Dieses Werkzeug braucht eine angemeldete Person (kein Systemlauf).';
const NUR_HAUSHALT = 'Nicht ausgeführt: Aufgaben gehören zum Haushalt des Inhabers — für dieses Konto nicht verfügbar.';
const imHaushalt = (lauf: Lauf): Lauf => async (input, origin, person) => {
  if (!person) return KEINE_PERSON;
  if (!(await personImHaushaltDesInhabers(person))) return NUR_HAUSHALT;
  return lauf(input, origin, person);
};

/** Was liegt bei ZOE — nur die eigenen Aufträge, nur Titel/Status/Deadline (keine Notizen). */
async function meineAufgaben(_i: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const s = zoeAufgaben(await ladeAufgabenSicht(person ?? null), { auftraggeberin: person });
  if (!s.alle.length) return 'Bei ZOE liegt keine Aufgabe dieser Person.';
  const zeile = (t: Task) => `- „${kurz(t.title, 100)}“ [${t.id}] · ${ZOE_STATUS_LABEL[t.zoe!.status]}${t.dueDate ? ` · fällig ${t.dueDate.slice(0, 10)}` : ''}`;
  const block = (titel: string, l: Task[]) => (l.length ? [`${titel} (${l.length}):`, ...l.slice(0, 20).map(zeile), ...(l.length > 20 ? [`… und ${l.length - 20} weitere`] : [])] : []);
  return [
    ...block('Wartet auf Freigabe', s.wartet), ...block('Bei ZOE (noch nicht bearbeitet)', s.offen), ...block('ZOE arbeitet', s.inArbeit),
    ...block('Abgelehnt', s.abgelehnt), ...block('Zuletzt freigegeben', s.freigegeben.slice(0, 5)),
    'Vorschläge gibt nur die Auftraggeberin frei — unter Aufgaben › ZOE oder im Stapel. ZOE übernimmt nichts selbst.',
  ].join('\n');
}

/** Im Gespräch: „gib das an dich“ — per Kennung oder eindeutigem Titel einer offenen Aufgabe. */
async function aufgabeAnZoe(input: Record<string, unknown>, _o: string, person?: string): Promise<string> {
  const frage = String(input.aufgabe ?? '').trim();
  if (!frage) return 'Fehlgeschlagen: aufgabe fehlt (Kennung oder Titel).';
  const state = await ladeAufgabenSicht(person ?? null);
  const offen = state.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const klein = frage.toLowerCase();
  const genau = offen.filter(t => t.id === frage || t.title.toLowerCase() === klein);
  // Normalisiert (#58): „mueller“ findet „Müller“, auch in der Beschreibung.
  const treffer = genau.length ? genau : offen.filter(t => suchPasst([t.title, t.description], frage));
  if (!treffer.length) return `Nicht ausgeführt: keine offene Aufgabe „${kurz(frage, 60)}“ gefunden.`;
  if (treffer.length > 1) return `Nicht ausgeführt: mehrdeutig — ${treffer.slice(0, 5).map(t => `„${kurz(t.title, 60)}“ [${t.id}]`).join(', ')}. Bitte die Kennung nennen.`;
  const r = await anZoeGeben(treffer[0].id, person!, { hinweis: typeof input.hinweis === 'string' ? input.hinweis : undefined, durchZoe: true });
  if (!r.ok) return `Nicht ausgeführt: ${r.fehler}`;
  return `„${kurz(treffer[0].title)}“ liegt jetzt bei ZOE (offen). Sie bereitet beim nächsten Lauf einen Vorschlag vor — übernommen wird erst nach Freigabe.`;
}

export const AUFGABEN_WERKZEUGE: Record<string, { gruppe: string; lauf: Lauf }> = {
  meine_aufgaben: { gruppe: 'aufgaben', lauf: imHaushalt(meineAufgaben) },
  aufgabe_an_zoe: { gruppe: 'aufgaben', lauf: imHaushalt(aufgabeAnZoe) },
};

const schlicht = (titel: string, nachher: (i: Record<string, unknown>) => string) => async (i: Record<string, unknown>): Promise<Vorschau> => ({ titel, nachher: nachher(i) });

export const AUFGABEN_REGISTER: Record<string, { gruppe: string; risiko: Risiko; vorschau: (i: Record<string, unknown>) => Promise<Vorschau> }> = {
  meine_aufgaben: { gruppe: 'aufgaben', risiko: 'frei', vorschau: schlicht('Eigene ZOE-Aufgaben lesen', () => 'Titel und Status') },
  aufgabe_an_zoe: { gruppe: 'aufgaben', risiko: 'frei', vorschau: schlicht('Aufgabe an ZOE geben', i => `„${String(i.aufgabe ?? '').slice(0, 120)}“`) },
};

/** Werkzeug-Beschreibungen fürs Gespräch (app/api/kimmi) — nur für Personen im Haushalt des Inhabers anbieten. */
export const AUFGABEN_WERKZEUG_DEFS = [
  {
    name: 'meine_aufgaben',
    description: 'Zeigt, welche Aufgaben die Person an dich (ZOE) gegeben hat und wo sie stehen: bei dir, in Arbeit, wartet auf Freigabe, abgelehnt, freigegeben. Nutze das bei „was liegt bei dir?“ oder „was wartet auf meine Freigabe?“.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'aufgabe_an_zoe',
    description: 'Gibt eine bestehende, offene Aufgabe an dich (ZOE): du bereitest beim nächsten Lauf einen Vorschlag vor (Entwurf/Recherche-Notiz, Unteraufgaben, Status/Deadline), der in den Stapel geht. Übernommen wird erst nach Freigabe der Person. Nur auf ausdrücklichen Wunsch („gib das an dich“, „bereite X vor“).',
    input_schema: {
      type: 'object',
      properties: {
        aufgabe: { type: 'string', description: 'Kennung oder genauer Titel der Aufgabe' },
        hinweis: { type: 'string', description: 'Worauf du achten sollst (optional, ein Satz)' },
      },
      required: ['aufgabe'],
    },
  },
] as const;
