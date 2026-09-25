// ─── CRM — Events: Kalender-Datei, Checkliste als Aufgaben, Punkte einzeln ──
// GET  ?ics=<eventId> → Kalender-Datei (RFC 5545) zum Herunterladen. Sie ist
//      gästetauglich: kein internes Ziel, keine Gästeliste, keine Notizen.
// POST { aktion: 'checkliste-aufgaben', eventId } → jeder offene
//      Checklistenpunkt ohne Aufgabe wird eine Aufgabe (Speicher „tasks“),
//      deren ID steht danach am Punkt (aufgabeId). Bearbeiter ist, wer den
//      Punkt erledigt (eingetragen, sonst die Event-Zuständigkeit — Kevin,
//      Malin oder beide). Wiederholbar: gleiche ID je Punkt, nie doppelt.
//      Aufgaben, die in der Aufgabenliste schon erledigt sind, haken den
//      Punkt hier ab.
// POST { aktion: 'punkt', eventId, aenderung } → EIN Checklisten-Punkt neu,
//      geändert (Text, Vorlauf, erledigt, wer) oder weg — auf dem aktuellen
//      Stand des Servers, damit Kevin und Malin gleichzeitig verschiedene
//      Punkte bearbeiten können. Die verknüpfte Aufgabe zieht mit, wenn das
//      ohne Risiko geht (lib/crm/eventplanung.ts aufgabeAbgleichen), sonst
//      kommt ein Hinweis zurück.
// POST { aktion: 'aufgabe-status', eventId, punktId, erledigt } → (älterer
//      Weg, bleibt gültig) verknüpfte Aufgabe abhaken oder wieder öffnen.
// Alles nur auf Klick von Kevin oder Malin — hier wird nichts versendet.

import { NextResponse } from 'next/server';
import { updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { icsText, icsDateiname, checklisteAlsAufgaben, punktAendern, aufgabeAbgleichen, type PunktAenderung, type ChecklistenPunkt } from '@/lib/crm/eventplanung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
type Aufgabe = { id: string; status?: string; assignee?: string; dueDate?: string; title?: string } & Record<string, unknown>;
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

/** Nur die bekannten Formen durchlassen — geprüft wird der Inhalt in punktAendern. */
function aenderungAus(v: unknown): PunktAenderung | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  if (a.op === 'neu' && a.punkt && typeof a.punkt === 'object') {
    const p = a.punkt as Record<string, unknown>;
    return { op: 'neu', punkt: { id: String(p.id ?? ''), text: String(p.text ?? ''), tageVorher: Number(p.tageVorher), ...(typeof p.wer === 'string' ? { wer: p.wer } : {}) } };
  }
  if (a.op === 'weg') return { op: 'weg', id: String(a.id ?? '') };
  if (a.op === 'aendern' && a.felder && typeof a.felder === 'object') {
    const f = a.felder as Record<string, unknown>;
    return { op: 'aendern', id: String(a.id ?? ''), felder: {
      ...(typeof f.text === 'string' ? { text: f.text } : {}),
      ...(f.tageVorher !== undefined ? { tageVorher: Number(f.tageVorher) } : {}),
      ...(typeof f.erledigt === 'boolean' ? { erledigt: f.erledigt } : {}),
      ...(typeof f.wer === 'string' || f.wer === null ? { wer: f.wer as string | null } : {}),
    } };
  }
  return null;
}

export async function POST(req: Request) {
  let b: { aktion?: string; eventId?: string; punktId?: string; erledigt?: boolean; aenderung?: unknown };
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
    const jePerson: Record<string, number> = {};
    const erledigtDort = new Set<string>();
    await updateJson<Aufgaben>('tasks', cur => {
      const f: Aufgaben = cur ?? { projects: [], tasks: [] };
      const tasks = [...(f.tasks ?? [])];
      const r = checklisteAlsAufgaben(e, new Set(tasks.map(t => t.id)), person, jetzt);
      angelegt = r.neu.length;
      verknuepft = r.verknuepft;
      for (const a of r.neu) jePerson[a.assignee] = (jePerson[a.assignee] ?? 0) + 1;
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
          geaendert: jetzt, geaendertVon: person,
        })),
      }));
    }
    return NextResponse.json({ ok: true, angelegt, jePerson, verknuepft: zuVerknuepfen, schonDa: zuVerknuepfen - angelegt, abgehakt: erledigtDort.size });
  }

  if (b.aktion === 'punkt') {
    const aenderung = aenderungAus(b.aenderung);
    if (!aenderung) return NextResponse.json({ ok: false, fehler: 'aenderung: { op: neu | aendern | weg, … } nötig.' }, { status: 400 });
    // Auf dem aktuellen Stand anwenden (nicht auf dem oben gelesenen) — sonst ginge eine gleichzeitige Änderung verloren.
    const aus: { r: ReturnType<typeof punktAendern>; ev: typeof e } = { r: null, ev: e };
    await aendereCrm(bestand => {
      const x = bestand.events.find(y => y.id === eventId);
      if (!x) return bestand;
      const r = punktAendern(x.checkliste, aenderung);
      aus.r = r; aus.ev = x;
      if (!r) return bestand;
      return { ...bestand, events: bestand.events.map(y => (y.id === eventId ? { ...y, checkliste: r.liste, geaendert: jetzt, geaendertVon: person } : y)) };
    });
    const r = aus.r;
    if (!r) return NextResponse.json({ ok: false, fehler: 'Punkt nicht gefunden oder ungültig.' }, { status: 400 });
    const vorher: ChecklistenPunkt | undefined = r.vorher, nachher: ChecklistenPunkt | undefined = r.nachher;
    let aufgabe: 'mitgezogen' | 'unveraendert' | null = null;
    let hinweise: string[] = [];
    if (vorher?.aufgabeId && nachher) {
      await updateJson<Aufgaben>('tasks', cur => {
        const f: Aufgaben = cur ?? { projects: [], tasks: [] };
        const tasks = f.tasks ?? [];
        const t = tasks.find(x => x.id === vorher.aufgabeId);
        const a = aufgabeAbgleichen(t, aus.ev, vorher, nachher);
        hinweise = a.hinweise;
        aufgabe = Object.keys(a.patch).length ? 'mitgezogen' : 'unveraendert';
        if (!t || aufgabe === 'unveraendert') return f;
        return { ...f, tasks: tasks.map(x => (x.id === t.id ? { ...x, ...a.patch, updatedAt: jetzt } : x)) };
      });
    } else if (vorher?.aufgabeId && !nachher) hinweise = ['Die verknüpfte Aufgabe bleibt in der Aufgabenliste stehen.'];
    return NextResponse.json({ ok: true, punkt: nachher ?? null, aufgabe, hinweise });
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

  return NextResponse.json({ ok: false, fehler: 'aktion: checkliste-aufgaben, punkt oder aufgabe-status.' }, { status: 400 });
}
