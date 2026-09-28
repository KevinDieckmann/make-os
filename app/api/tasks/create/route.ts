// ─── MAKE OS — Aufgabe anlegen (Agenten, Meeting, Tageslauf, ZOE) ───────────
// Hängt eine gültige Aufgabe an den Aufgaben-Bestand an. Nur auf Klick des Nutzers bzw. im Auftrag einer Person
// (Human-in-the-Loop); der Takt (Dienstweg ohne Person) darf als Systemlauf anlegen.
//
// Seit 28.09. abends: Zugang nur Haushalt des Inhabers (vorher ohne Prüfung), Aufgaben-Space (`spaceId`, sonst aus
// space/einheit/Ort abgeleitet), Projekt fehlt → „Sonstige“ des Space (statt irgendeines ersten Projekts), Liste,
// übergeordnete Aufgabe, CRM-Bezug, Startdatum; Änderungsprotokoll und Meldung bei Zuweisung an jemand anderen.

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { aufgabenSchreiben } from '@/lib/aufgaben/umbau';
import { bauPruefen } from '@/lib/bau/pruefen';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { imHaushaltOderSystemlauf, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { uebernehmen, istSpaceId, spaceFuerAltAufgabe, sonstigeProjektId } from '@/lib/aufgaben/struktur';
import { bezugSauber } from '@/lib/aufgaben/saeubern';
import { orgZuordnung, meldeNeueAufgabe, AUFGABEN_SPEICHER } from '@/lib/aufgaben/speicher';
import { verlaufFuer } from '@/lib/aufgaben/verlauf';
import type { Task, TaskStatus } from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NewTask {
  title?: string; description?: string; projectId?: string; owner?: Owner; priority?: Priority; dueDate?: string; space?: string; einheit?: string;
  spaceId?: string; listeId?: string; parentId?: string; bezug?: unknown; startDate?: string;
}
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

export async function POST(req: Request) {
  const zugang = await imHaushaltOderSystemlauf(req);
  if (!zugang) return NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let body: NewTask;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const title = String(body.title ?? '').trim().slice(0, 300);
  if (!title) return NextResponse.json({ ok: false, error: 'Kein Titel.' }, { status: 400 });
  // Fristen-Plausibilität: kein Datum vor 2020 o. ä. Unsinn.
  const dueDate = body.dueDate && TAG.test(body.dueDate) && body.dueDate >= '2020-01-01' ? body.dueDate : undefined;
  const orgs = await orgZuordnung();
  const now = new Date().toISOString();
  const priority: Priority = (['low', 'medium', 'high', 'critical'] as Priority[]).includes(body.priority as Priority) ? body.priority as Priority : 'medium';
  const assignee: Owner = (['kevin', 'malin', 'both'] as Owner[]).includes(body.owner as Owner) ? body.owner as Owner : (zugang.person === 'malin' ? 'malin' : 'kevin');

  const wer = werAus(req);
  let ergebnis: { id: string; duplikat?: boolean } = { id: '' };
  const angelegt: { t: Task | null } = { t: null };
  await aufgabenSchreiben(cur => {
    const state = uebernehmen(cur && Array.isArray(cur.tasks) ? cur : { projects: cur?.projects ?? [], tasks: [] }, orgs).state;
    // Duplikat-Schutz: gleiche (normalisierte) Überschrift + noch offen → nicht doppelt anlegen (der Papierkorb zählt nicht).
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const vorhanden = state.tasks.find(t => t.status !== 'done' && !t.parentId && !t.geloeschtAm && norm(t.title) === norm(title));
    if (vorhanden) { ergebnis = { id: vorhanden.id, duplikat: true }; angelegt.t = null; return cur; }
    const projekt = state.projects.find(p => p.id === body.projectId && !p.geloeschtAm);
    const eltern = body.parentId ? state.tasks.find(t => t.id === body.parentId && !t.geloeschtAm) : undefined;
    const basis: Task = {
      // Kollisionsfrei: nicht an array.length koppeln (bricht nach Löschungen).
      id: `mtg-${now.replace(/[^0-9]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`,
      projectId: projekt?.id ?? '', title, description: body.description?.trim() || 'Aus Meeting übernommen.',
      status: 'todo' as TaskStatus, priority, assignee, tags: [], dueDate, subTasks: [], dependencies: [],
      // max+1 statt length: nach Löschungen sonst doppelte Sortierwerte.
      sortOrder: state.tasks.reduce((mx, t) => Math.max(mx, t.sortOrder ?? 0), -1) + 1,
      createdAt: now, updatedAt: now,
      ...(body.space === 'privat' || body.space === 'business' ? { space: body.space } : {}),
      ...(typeof body.einheit === 'string' && body.einheit.trim() ? { einheit: body.einheit.trim().slice(0, 40) } : {}),
      ...(body.listeId && KENNUNG.test(body.listeId) ? { listeId: body.listeId } : {}),
      ...(eltern ? { parentId: eltern.id } : {}),
      ...(bezugSauber(body.bezug) ? { bezug: bezugSauber(body.bezug) } : {}),
      ...(body.startDate && TAG.test(body.startDate) ? { startDate: body.startDate } : {}),
      // Verlauf (28.09. spät): „angelegt“ — von der Person, im Auftrag (ZOE) oder als Systemlauf.
      verlauf: verlaufFuer(undefined, { id: '', title, projectId: '', status: 'todo', priority, assignee, tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: now, updatedAt: now },
        { person: zugang.person ?? 'system', ...(wer.art === 'zoe' ? { durch: 'zoe' as const } : wer.art !== 'person' ? { durch: 'system' as const } : {}) }, now),
    };
    if (!dueDate) delete basis.dueDate;
    // Space: ausdrücklich, sonst wie bei Altaufgaben (Privat/Business, Einheit, Ort, Projekt).
    basis.spaceId = istSpaceId(body.spaceId) ? body.spaceId : spaceFuerAltAufgabe(basis, projekt, orgs);
    if (!basis.projectId) basis.projectId = sonstigeProjektId(basis.spaceId);
    const next = uebernehmen({ ...state, tasks: [...state.tasks, basis] }, orgs).state;
    angelegt.t = next.tasks.find(t => t.id === basis.id) ?? basis;
    ergebnis = { id: basis.id };
    return next;
  });
  if (ergebnis.duplikat) return NextResponse.json({ ok: true, id: ergebnis.id, duplikat: true, hinweis: 'Gibt es schon als offene Aufgabe — nicht doppelt angelegt.' });
  await protokolliere(AUFGABEN_SPEICHER, [{ liste: 'tasks', op: 'neu', id: ergebnis.id }], wer);
  if (angelegt.t) await meldeNeueAufgabe(angelegt.t, zugang.person);
  return NextResponse.json({ ok: true, id: ergebnis.id });
}
