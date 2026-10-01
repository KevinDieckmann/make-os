// ─── MAKE OS — Aufgabe anlegen (Agenten, Meeting, Tageslauf, ZOE) ───────────
// Hängt eine gültige Aufgabe an den Aufgaben-Bestand an. Nur auf Klick des Nutzers bzw. im Auftrag einer Person
// (Human-in-the-Loop); der Takt (Dienstweg ohne Person) darf als Systemlauf anlegen.
//
// Seit 28.09. abends: Zugang nur Haushalt des Inhabers (vorher ohne Prüfung), Aufgaben-Space (`spaceId`, sonst aus
// space/einheit/Ort abgeleitet), Projekt fehlt → „Sonstige“ des Space (statt irgendeines ersten Projekts), Liste,
// übergeordnete Aufgabe, CRM-Bezug, Startdatum; Änderungsprotokoll und Meldung bei Zuweisung an jemand anderen.
// Seit 29.09. (Paket T1) über `aufgabenAendern` — dieselben Regeln wie die Aufgaben-Seite (eine Verantwortliche,
// Anlegerin, Datumsprüfung, „nur ich“, Verlauf durch den Server).
// S1 (29.09.): nie still gekürzt — Titel über 300, Einheit über 40, Beschreibung über 4000 Zeichen → 413; ohne
// ausdrückliche Person (Systemlauf) muss `owner` genannt sein (400) — kein Rückfall auf „kevin“ (Regel 5).

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { imHaushaltOderSystemlauf, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { istSpaceId, spaceFuerAltAufgabe, sonstigeProjektId, istOffen } from '@/lib/aufgaben/struktur';
import { bezugSauber, beteiligteSauber, ZuGross } from '@/lib/aufgaben/saeubern';
import { orgZuordnung, aufgabenAendern, keineOps } from '@/lib/aufgaben/speicher';
import { aufgabenSicht } from '@/lib/aufgaben/papierkorb';
import { sichtFuer } from '@/lib/aufgaben/sicht';
import type { Task, TaskStatus } from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';

import { loadJson } from '@/lib/store/local-db';
import type { Meilenstein } from '@/lib/planung/typen';
import { meilensteinAufgabenSpace, meilensteinListeId, meilensteinProjektId } from '@/lib/planung/meilenstein-aufgaben';
import { meilensteinStrukturSichern } from '@/lib/planung/meilenstein-aufgaben-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NewTask {
  title?: string; description?: string; projectId?: string; owner?: Owner; priority?: Priority; dueDate?: string; space?: string; einheit?: string;
  /** Uhrzeit der Deadline „HH:MM“ (29.09., Kalender K1) — nur mit dueDate. */
  dueTime?: string;
  spaceId?: string; listeId?: string; parentId?: string; bezug?: unknown; startDate?: string;
  /** Seit 29.09.: Beteiligte (Speichernamen) und „nur ich“. */
  beteiligte?: unknown; sichtbarkeit?: string;
  /** Seit 30.09.: Aufgabe am Meilenstein — landet in seiner Liste (Space/Projekt/Liste aus lib/planung/meilenstein-aufgaben.ts). */
  meilensteinId?: string;
}
const TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Grenzen wie im Schreibweg (lib/aufgaben/saeubern.ts) — darüber 413 statt still zu kürzen. */
const TITEL_MAX = 300, EINHEIT_MAX = 40, BESCHREIBUNG_MAX = 4000;
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

export async function POST(req: Request) {
  const zugang = await imHaushaltOderSystemlauf(req);
  if (!zugang) return NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let body: NewTask;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 });
  try { beteiligteSauber(body.beteiligte); } catch (e) { if (e instanceof ZuGross) return NextResponse.json({ ok: false, error: e.message }, { status: 413 }); throw e; }
  const title = String(body.title ?? '').trim();
  if (!title) return NextResponse.json({ ok: false, error: 'Kein Titel.' }, { status: 400 });
  if (title.length > TITEL_MAX) return NextResponse.json({ ok: false, error: `Titel höchstens ${TITEL_MAX} Zeichen.` }, { status: 413 });
  const einheit = typeof body.einheit === 'string' ? body.einheit.trim() : '';
  if (einheit.length > EINHEIT_MAX) return NextResponse.json({ ok: false, error: `Einheit höchstens ${EINHEIT_MAX} Zeichen.` }, { status: 413 });
  const beschreibung = typeof body.description === 'string' ? body.description.trim() : '';
  if (beschreibung.length > BESCHREIBUNG_MAX) return NextResponse.json({ ok: false, error: `Beschreibung höchstens ${BESCHREIBUNG_MAX} Zeichen.` }, { status: 413 });
  // Fristen-Plausibilität: kein Datum vor 2020 o. ä. Unsinn.
  const dueDate = body.dueDate && TAG.test(body.dueDate) && body.dueDate >= '2020-01-01' ? body.dueDate : undefined;
  const orgs = await orgZuordnung();
  const now = new Date().toISOString();
  const priority: Priority = (['low', 'medium', 'high', 'critical'] as Priority[]).includes(body.priority as Priority) ? body.priority as Priority : 'medium';
  const owner = (['kevin', 'malin', 'both'] as Owner[]).includes(body.owner as Owner) ? body.owner as Owner : null;
  // Ohne `owner`: die anlegende Person selbst (Sitzung bzw. Dienstweg mit Person) — ein Systemlauf muss sie nennen.
  if (!owner && !zugang.person) return NextResponse.json({ ok: false, error: 'owner fehlt (Systemlauf ohne Person).' }, { status: 400 });
  const assignee: Owner = owner ?? (zugang.person as Owner);

  // Aufgabe am Meilenstein (30.09.): seine Liste sichern (idempotent) und dort anlegen — Space/Projekt/Liste kommen von ihm.
  if (body.meilensteinId !== undefined) {
    const ms = typeof body.meilensteinId === 'string' ? ((await loadJson<{ meilensteine?: Meilenstein[] }>('meilensteine'))?.meilensteine ?? []).find(m => m.id === body.meilensteinId) : undefined;
    if (!ms) return NextResponse.json({ ok: false, error: 'Diesen Meilenstein gibt es nicht (mehr).' }, { status: 404 });
    await meilensteinStrukturSichern([ms.id], { person: zugang.person });
    const sp = meilensteinAufgabenSpace(ms);
    body.spaceId = sp; body.projectId = meilensteinProjektId(sp); body.listeId = meilensteinListeId(ms.id);
  }
  const wer = werAus(req);
  let ergebnis: { id: string; duplikat?: boolean } = { id: '' };
  // Über den EINEN Schreibweg (29.09., Paket T1): Server-Felder (Anlegerin, Zeitstempel), eine Verantwortliche („both“ →
  // Anlegerin + Beteiligte), Prüfregeln (Datum, Person), Verlauf „angelegt“, Protokoll, Meldungen (gebündelt).
  const r = await aufgabenAendern(state0 => {
    const state = sichtFuer(aufgabenSicht(state0), zugang.person);
    // Duplikat-Schutz: gleiche (normalisierte) Überschrift + noch offen → nicht doppelt anlegen (der Papierkorb zählt nicht).
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    // Am Meilenstein (30.09.) nur in seiner Liste prüfen — sonst landete „Vertrag prüfen“ bei einer gleichnamigen Aufgabe woanders.
    const vorhanden = state.tasks.find(t => istOffen(t) && !t.parentId && norm(t.title) === norm(title) && (body.meilensteinId === undefined || t.listeId === body.listeId));
    if (vorhanden) { ergebnis = { id: vorhanden.id, duplikat: true }; return keineOps(); }
    const projekt = state.projects.find(p => p.id === body.projectId);
    const eltern = body.parentId ? state.tasks.find(t => t.id === body.parentId) : undefined;
    const basis: Task = {
      // Kollisionsfrei: nicht an array.length koppeln (bricht nach Löschungen).
      id: `mtg-${now.replace(/[^0-9]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`,
      projectId: projekt?.id ?? '', title, description: beschreibung || (body.meilensteinId !== undefined ? '' : 'Aus Meeting übernommen.'),
      status: 'todo' as TaskStatus, priority, assignee, tags: [], dueDate, subTasks: [], dependencies: [],
      // max+1 statt length: nach Löschungen sonst doppelte Sortierwerte.
      sortOrder: state0.tasks.reduce((mx, t) => Math.max(mx, t.sortOrder ?? 0), -1) + 1,
      createdAt: now, updatedAt: now,
      ...(body.space === 'privat' || body.space === 'business' ? { space: body.space } : {}),
      ...(einheit ? { einheit } : {}),
      ...(body.listeId && KENNUNG.test(body.listeId) ? { listeId: body.listeId } : {}),
      ...(eltern ? { parentId: eltern.id } : {}),
      ...(bezugSauber(body.bezug) ? { bezug: bezugSauber(body.bezug) } : {}),
      ...(body.startDate && TAG.test(body.startDate) ? { startDate: body.startDate } : {}),
      ...(beteiligteSauber(body.beteiligte) ? { beteiligte: beteiligteSauber(body.beteiligte) } : {}),
      ...(body.sichtbarkeit === 'nur-ich' ? { sichtbarkeit: 'nur-ich' as const } : {}),
    };
    if (!dueDate) delete basis.dueDate;
    if (dueDate && typeof body.dueTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.dueTime)) basis.dueTime = body.dueTime;
    // Space: ausdrücklich, sonst wie bei Altaufgaben (Privat/Business, Einheit, Ort, Projekt).
    basis.spaceId = istSpaceId(body.spaceId) ? body.spaceId : spaceFuerAltAufgabe(basis, projekt, orgs);
    if (!basis.projectId) basis.projectId = sonstigeProjektId(basis.spaceId);
    ergebnis = { id: basis.id };
    return { ...keineOps(), tasks: [{ op: 'upsert', eintrag: basis }] };
  }, { person: zugang.person ?? 'system', wer, orgs, jetzt: now });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler }, { status: r.status });
  if (ergebnis.duplikat) return NextResponse.json({ ok: true, id: ergebnis.id, duplikat: true, hinweis: 'Gibt es schon als offene Aufgabe — nicht doppelt angelegt.' });
  return NextResponse.json({ ok: true, id: ergebnis.id });
}
