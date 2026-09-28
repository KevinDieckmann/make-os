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
// POST { aktion: 'nachfassen', eventId, teilnahmeId, ergebnis } → (Brücke,
//      lib/crm/event-bruecke.ts) Teilnahme.followUpAm = heute; bei „gespraech“
//      oder „termin“ rückt der Lead der Firma (ohne Firma: der Person) auf
//      „Im Gespräch“, wenn er darunter liegt. Die Aktivität an der Person
//      schreibt die Oberfläche über den bestehenden Weg /api/crm/aktivitaet.
// POST { aktion: 'liquiplan', eventId } → Budget als Planposten „Event: <Titel>“
//      in den Liquiditätsplan (Speicher „liquiplan“), Kennung ev-<eventId>:
//      einmal angelegt, danach nur Betrag und Datum nachgezogen — nie doppelt.
// GET  ?liquiplan=<eventId> → wo das Event im Plan steht (fehlt · ok · abweichend).
// POST { aktion: 'loeschen', eventId } → Event löschen MIT Kaskade (28.09., W6): Teilnahmen weg, offene
//      Follow-ups des Events abgesagt — in einer Sperre (lib/crm/crm-stand.ts loeschKaskade).
// Alles nur auf Klick von Kevin oder Malin — hier wird nichts versendet.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/zoe/raum';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { localDay } from '@/lib/zeit';
import type { Planposten } from '@/lib/make-one/liquiditaet';
import { ladeCrm, aendereCrm, wendeCrmAn, type CrmAnwendung } from '@/lib/crm/speicher';
import { loeschKaskade } from '@/lib/crm/crm-stand';
import type { ListenOp } from '@/lib/sync';
import { icsText, icsDateiname, checklisteAlsAufgaben, punktAendern, aufgabeAbgleichen, type PunktAenderung, type ChecklistenPunkt } from '@/lib/crm/eventplanung';
import { hebtLead, planpostenAusEvent, planpostenId, liquiplanStand, type NachfassErgebnis } from '@/lib/crm/event-bruecke';
import { leadHebenNachGespraech } from '@/lib/crm/lead-heben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
type Liquiplan = { posten: Planposten[] };
const NACHFASS: NachfassErgebnis[] = ['gespraech', 'termin', 'erledigt'];

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const q = new URL(req.url).searchParams;
  const liqui = q.get('liquiplan');
  if (liqui !== null) {
    // (Haushalts-Schutz steht oben für die ganze Route.)
    if (!ID.test(liqui)) return NextResponse.json({ ok: false, fehler: 'liquiplan=<Event-ID> nötig.' }, { status: 400 });
    const e = (await ladeCrm()).events.find(x => x.id === liqui);
    if (!e) return NextResponse.json({ ok: false, fehler: 'Event nicht gefunden.' }, { status: 404 });
    const posten = (await loadJson<Liquiplan>('liquiplan'))?.posten ?? [];
    return NextResponse.json({ ok: true, ...liquiplanStand(e, posten.find(p => p.id === planpostenId(e.id)) ?? null, localDay()) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const id = q.get('ics') ?? '';
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
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { aktion?: string; eventId?: string; punktId?: string; erledigt?: boolean; aenderung?: unknown; teilnahmeId?: string; ergebnis?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const eventId = String(b.eventId ?? '');
  if (!ID.test(eventId)) return NextResponse.json({ ok: false, fehler: 'eventId nötig.' }, { status: 400 });
  const crm = await ladeCrm();
  const e = crm.events.find(x => x.id === eventId);
  if (!e) return NextResponse.json({ ok: false, fehler: 'Event nicht gefunden.' }, { status: 404 });
  const person = personAus(req);
  const jetzt = new Date().toISOString();
  const heute = localDay();

  if (b.aktion === 'loeschen') {
    // Serverweg (28.09., W6): Event + Kaskade (Teilnahmen weg, offene Follow-ups des Events abgesagt) in EINER Sperre —
    // vorher löschte der Browser Teilnahme für Teilnahme und dann das Event (halbe Stände bei Abbruch, Follow-ups blieben).
    const halter: { r?: CrmAnwendung; ops?: ListenOp[] } = {};
    await aendereCrm(cur => {
      const ops: ListenOp[] = [{ liste: 'events', op: 'delete', id: eventId }];
      halter.ops = [...ops, ...loeschKaskade(cur, ops, jetzt)];
      halter.r = wendeCrmAn(cur, halter.ops, jetzt, person);
      return halter.r.bestand;
    });
    const r = halter.r!;
    if (r.sperren.length) return NextResponse.json({ ok: false, fehler: r.sperren.map(x => x.text).join(' · '), sperren: r.sperren }, { status: 409 });
    if (r.konflikte.length) return NextResponse.json({ ok: false, fehler: 'Wurde inzwischen geändert — bitte noch einmal.' }, { status: 409 });
    if (r.grenze.length) return NextResponse.json({ ok: false, fehler: r.grenze.join(' · ') }, { status: 413 });
    if (r.abgelehnt?.length) return NextResponse.json({ ok: false, fehler: r.abgelehnt.join(' · ') }, { status: 409 });
    const ops = halter.ops ?? [];
    const teilnahmen = ops.filter(o => o.liste === 'teilnahmen').length, abgesagt = ops.filter(o => o.liste === 'followups').length;
    return NextResponse.json({ ok: true, teilnahmen, abgesagt, text: `Event gelöscht${teilnahmen ? ` · ${teilnahmen} Teilnahme${teilnahmen === 1 ? '' : 'n'} entfernt` : ''}${abgesagt ? ` · ${abgesagt} offene${abgesagt === 1 ? 's' : ''} Follow-up${abgesagt === 1 ? '' : 's'} abgesagt` : ''}.` });
  }

  if (b.aktion === 'nachfassen') {
    const teilnahmeId = String(b.teilnahmeId ?? '');
    const ergebnis = NACHFASS.includes(b.ergebnis as NachfassErgebnis) ? (b.ergebnis as NachfassErgebnis) : null;
    const t = crm.teilnahmen.find(x => x.id === teilnahmeId && x.eventId === eventId);
    if (!t || !ergebnis) return NextResponse.json({ ok: false, fehler: 'teilnahmeId und ergebnis (gespraech | termin | erledigt) nötig.' }, { status: 400 });
    if (t.status !== 'da') return NextResponse.json({ ok: false, fehler: 'Nachgefasst wird nur, wer da war.' }, { status: 400 });
    // 1 · Nachgefasst am Gast — bleibt beim ersten Datum, wenn schon eins steht.
    const followUpAm = t.followUpAm ?? heute;
    // Auch ein echtes Event-Follow-up zu diesem Gast gilt damit als erledigt (27.09.) — sonst stand er doppelt in der Follow-up-Liste.
    await aendereCrm(c => ({ ...c,
      teilnahmen: c.teilnahmen.map(x => (x.id === t.id ? { ...x, followUpAm, nachfassenVerzichtet: undefined, geaendert: jetzt, geaendertVon: person } : x)),
      followups: (c.followups ?? []).map(f => (f.status === 'offen' && f.bezug.art === 'event' && f.bezug.id === eventId && f.kontaktId === t.kontaktId ? { ...f, status: 'erledigt' as const, erledigtAm: jetzt, ergebnis: ergebnis === 'erledigt' ? undefined : ergebnis, geaendert: jetzt, geaendertVon: person } : f)),
    }));
    // 2 · Lead heben (Firma, ohne Firma die Person) — nur bei Gespräch oder Termin; derselbe Weg wie beim Erledigen eines Follow-ups (lib/crm/lead-heben.ts).
    const lead = hebtLead(ergebnis) ? await leadHebenNachGespraech(t.kontaktId, jetzt, person, heute, werAus(req)) : null;
    return NextResponse.json({ ok: true, followUpAm, lead });
  }

  if (b.aktion === 'liquiplan') {

    const p = planpostenAusEvent(e, heute);
    if (!p) return NextResponse.json({ ok: false, fehler: liquiplanStand(e, null, heute).hinweis }, { status: 400 });
    let neu = false;
    const stand = await updateJson<Liquiplan>('liquiplan', cur => {
      const l = cur?.posten ?? [];
      const alt = l.find(x => x.id === p.id);
      neu = !alt;
      // Vorhanden: Betrag, Datum und Sicherheit nachziehen; der Stempel „übernommen am“ bleibt der erste.
      return { posten: alt ? l.map(x => (x.id === p.id ? { ...x, ...p, notiz: alt.notiz ?? p.notiz } : x)) : [...l, p] };
    });
    const posten = stand.posten.find(x => x.id === p.id) ?? p;
    return NextResponse.json({ ok: true, neu, ...liquiplanStand(e, posten, heute) });
  }

  if (b.aktion === 'checkliste-aufgaben') {
    let angelegt = 0;
    let verknuepft: Record<string, string> = {};
    const jePerson: Record<string, number> = {};
    const erledigtDort = new Set<string>();
    // Über den Schreibweg (29.09., Paket T1): Anlegerin, Verlauf „durch System“ im Auftrag der Person, Meldungen (gebündelt).
    await systemAufgabenAendern(stand => {
      const tasks = stand.tasks;
      const r = checklisteAlsAufgaben(e, new Set(tasks.map(t => t.id)), person, jetzt);
      angelegt = r.neu.length;
      verknuepft = r.verknuepft;
      for (const k of Object.keys(jePerson)) delete jePerson[k];
      for (const a of r.neu) jePerson[a.assignee] = (jePerson[a.assignee] ?? 0) + 1;
      // Rückweg: in der Aufgabenliste erledigt → Punkt hier abhaken.
      erledigtDort.clear();
      const status = new Map(tasks.map(t => [t.id, t.status]));
      for (const p of e.checkliste ?? []) if (!p.erledigt && p.aufgabeId && status.get(p.aufgabeId) === 'done') erledigtDort.add(p.id);
      return { neu: r.neu as unknown as Record<string, unknown>[] };
    }, { person, wer: { art: 'system', person }, jetzt });
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
      await systemAufgabenAendern(stand => {
        const t = stand.tasks.find(x => x.id === vorher.aufgabeId);
        const a = aufgabeAbgleichen(t, aus.ev, vorher, nachher);
        hinweise = a.hinweise;
        aufgabe = Object.keys(a.patch).length ? 'mitgezogen' : 'unveraendert';
        if (!t || aufgabe === 'unveraendert') return {};
        return { teile: [{ id: t.id, felder: a.patch }] };
      }, { person, wer: { art: 'system', person }, jetzt });
    } else if (vorher?.aufgabeId && !nachher) hinweise = ['Die verknüpfte Aufgabe bleibt in der Aufgabenliste stehen.'];
    return NextResponse.json({ ok: true, punkt: nachher ?? null, aufgabe, hinweise });
  }

  if (b.aktion === 'aufgabe-status') {
    const p = (e.checkliste ?? []).find(x => x.id === String(b.punktId ?? ''));
    if (!p?.aufgabeId) return NextResponse.json({ ok: true, geaendert: false });
    const ziel = b.erledigt === true ? 'done' : 'todo';
    let geaendert = false;
    await systemAufgabenAendern(stand => {
      const t = stand.tasks.find(x => x.id === p.aufgabeId);
      geaendert = !!t && t.status !== ziel && !(ziel === 'todo' && t.status !== 'done');
      return geaendert && t ? { teile: [{ id: t.id, felder: { status: ziel } }] } : {};
    }, { person, wer: { art: 'system', person }, jetzt });
    return NextResponse.json({ ok: true, geaendert });
  }

  return NextResponse.json({ ok: false, fehler: 'aktion: checkliste-aufgaben, punkt, aufgabe-status, nachfassen oder liquiplan.' }, { status: 400 });
}
