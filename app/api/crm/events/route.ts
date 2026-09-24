// ─── CRM — Events: Kalender-Datei und Checkliste als Aufgaben ───────────────
// GET  ?ics=<eventId> → Kalender-Datei (RFC 5545) zum Herunterladen. Sie ist
//      gästetauglich: kein internes Ziel, keine Gästeliste, keine Notizen.
// POST { aktion: 'checkliste-aufgaben', eventId } → jeder offene
//      Checklistenpunkt ohne Aufgabe wird eine Aufgabe (Speicher „tasks“),
//      deren ID steht danach am Punkt (aufgabeId). Wiederholbar: gleiche ID je
//      Punkt, nie doppelt. Aufgaben, die in der Aufgabenliste schon erledigt
//      sind, haken den Punkt hier ab.
// POST { aktion: 'aufgabe-status', eventId, punktId, erledigt } → Punkt in der
//      Checkliste abgehakt (oder wieder geöffnet): die verknüpfte Aufgabe zieht mit.
// Beides nur auf Klick von Kevin oder Malin — hier wird nichts versendet.

import { NextResponse } from 'next/server';
import { updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { icsText, icsDateiname, checklisteAlsAufgaben } from '@/lib/crm/eventplanung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
type Aufgabe = { id: string; status?: string } & Record<string, unknown>;
type Aufgaben = { tasks?: Aufgabe[] } & Record<string, unknown>;

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('ics') ?? '';
  if (!ID.test(id)) return NextResponse.json({ ok: false, fehler: 'ics=<Event-ID> nötig.' }, { status: 400 });
  const e = (await ladeCrm()).events.find(x => x.id === id);
  if (!e) return NextResponse.json({ ok: false, fehler: 'Event nicht gefunden.' }, { status: 404 });
  return new Response(icsText(e), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${icsDateiname(e)}"`, 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: Request) {
  let b: { aktion?: string; eventId?: string; punktId?: string; erledigt?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const eventId = String(b.eventId ?? '');
  if (!ID.test(eventId)) return NextResponse.json({ ok: false, fehler: 'eventId nötig.' }, { status: 400 });
  const e = (await ladeCrm()).events.find(x => x.id === eventId);
  if (!e) return NextResponse.json({ ok: false, fehler: 'Event nicht gefunden.' }, { status: 404 });
  const person = personAus(req);
  const jetzt = new Date().toISOString();

  if (b.aktion === 'checkliste-aufgaben') {
    let angelegt = 0;
    let verknuepft: Record<string, string> = {};
    const erledigtDort = new Set<string>();
    await updateJson<Aufgaben>('tasks', cur => {
      const f: Aufgaben = cur ?? { projects: [], tasks: [] };
      const tasks = [...(f.tasks ?? [])];
      const r = checklisteAlsAufgaben(e, new Set(tasks.map(t => t.id)), person, jetzt);
      angelegt = r.neu.length;
      verknuepft = r.verknuepft;
      // Rückweg: in der Aufgabenliste erledigt → Punkt hier abhaken.
      const status = new Map(tasks.map(t => [t.id, t.status]));
      for (const p of e.checkliste ?? []) if (!p.erledigt && p.aufgabeId && status.get(p.aufgabeId) === 'done') erledigtDort.add(p.id);
      return r.neu.length ? { ...f, tasks: [...tasks, ...r.neu] } : f;
    });
    const zuVerknuepfen = Object.keys(verknuepft).length;
    if (zuVerknuepfen || erledigtDort.size) {
      await aendereCrm(bestand => ({
        ...bestand,
        events: bestand.events.map(x => (x.id !== eventId ? x : {
          ...x,
          checkliste: (x.checkliste ?? []).map(p => (!p.aufgabeId && verknuepft[p.id] ? { ...p, aufgabeId: verknuepft[p.id] } : erledigtDort.has(p.id) ? { ...p, erledigt: true } : p)),
          geaendert: jetzt,
        })),
      }));
    }
    return NextResponse.json({ ok: true, angelegt, verknuepft: zuVerknuepfen, schonDa: zuVerknuepfen - angelegt, abgehakt: erledigtDort.size });
  }

  if (b.aktion === 'aufgabe-status') {
    const p = (e.checkliste ?? []).find(x => x.id === String(b.punktId ?? ''));
    if (!p?.aufgabeId) return NextResponse.json({ ok: true, geaendert: false });
    const ziel = b.erledigt === true ? 'done' : 'todo';
    let geaendert = false;
    await updateJson<Aufgaben>('tasks', cur => {
      const f: Aufgaben = cur ?? { projects: [], tasks: [] };
      const tasks = (f.tasks ?? []).map(t => {
        if (t.id !== p.aufgabeId || t.status === ziel || (ziel === 'todo' && t.status !== 'done')) return t;
        geaendert = true;
        return { ...t, status: ziel, updatedAt: jetzt };
      });
      return geaendert ? { ...f, tasks } : f;
    });
    return NextResponse.json({ ok: true, geaendert });
  }

  return NextResponse.json({ ok: false, fehler: 'aktion: checkliste-aufgaben oder aufgabe-status.' }, { status: 400 });
}
