// ─── Kalender — Termin anlegen, ändern, löschen (iCloud) ────────────────────
// POST   { titel, kalender? | wer?, start, ende, ganztags?, ort?, notiz?,
//          art?, farbe?, beschaeftigt?, sichtbarkeit?, zone?, wiederholung?, erinnerungenMin?, arbeitsort?, bezug? }
//                                         → { uid, kalender }
// PATCH  { uid, stand?, titel?, start?, ende?, ort?, notiz?, art?, farbe?, beschaeftigt?, sichtbarkeit?, bezug? }
//          Termin-Felder nur für Einzeltermine ohne Teilnehmer; `bezug` (nur Kennungen) geht auch bei Serien —
//          er liegt nie im Termin, nur im Bestand `kalender-bezug` (lib/kalender/bezug.ts).
//          `stand` = ETag, den der Browser zuletzt sah → veraltet: 409 { konflikt, aktuell } („Deine Fassung“ bleibt im Browser).
// DELETE ?uid=…&stand=…                  (dito — die Oberfläche fragt vorher)
// Zeiten als Wandzeit „YYYY-MM-DDTHH:mm(:ss)“ — beim Anlegen in `zone` (Standard Europe/Berlin), sonst Berlin;
// ganztags: Tag, Ende exklusiv. Eingaben prüft lib/kalender/eingabe.ts.
// Seit 29.09. (K1): Build-Kennung (409 `neuLaden`), jede Schreibaktion im Änderungsprotokoll (wer, UID, Aktion,
// Feldnamen — nie Titel), Bezug + Sicherung (Art, privat, wer angelegt hat) im Neben-Bestand.
// Versendet wird nie etwas: MAKE OS legt keine Teilnehmer an und ändert keine Termine mit Einladungen.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { verbunden, anlegen, aendern, loeschen, terminBekannt, KalenderFehler, KalenderKonflikt } from '@/lib/kalender/icloud';
import { ladeEinstellungen, wemGehoert, type Wer } from '@/lib/kalender/einstellungen';
import { anlegenPruefen, aendernPruefen, text } from '@/lib/kalender/eingabe';
import { bezugSetzen, ladeBezuege, BezugZuGross } from '@/lib/kalender/bezug-server';
import { mitBezug, maskieren } from '@/lib/kalender/bezug';
import { wandzeit } from '@/lib/kalender/zeit';
import { ausWandzeitIn, STANDARD_ZONE } from '@/lib/kalender/zeitzone';
import { bauPruefen } from '@/lib/bau/pruefen';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function antwortFehler(e: unknown, person: string) {
  if (e instanceof KalenderKonflikt) {
    // Der aktuelle Termin (mit Bezug, für die Person maskiert) — der Browser behält die eigene Fassung daneben.
    const [einst, bezuege] = await Promise.all([ladeEinstellungen(), ladeBezuege().catch(() => null)]);
    const aktuell = e.aktuell ? maskieren({ ...mitBezug(e.aktuell, bezuege), wer: wemGehoert(einst, e.aktuell.kalender) }, person) : null;
    return NextResponse.json({ ok: false, konflikt: true, fehler: e.message, aktuell }, { status: 409 });
  }
  if (e instanceof KalenderFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
  if (e instanceof BezugZuGross) return NextResponse.json({ ok: false, fehler: e.message }, { status: 413 });
  return NextResponse.json({ ok: false, fehler: 'iCloud nicht erreichbar.' }, { status: 502 });
}

async function vorab(req: Request): Promise<{ person: string } | NextResponse> {
  const z = await kalenderZugang(req);
  if (!z) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  if (!verbunden()) return NextResponse.json({ ok: false, fehler: 'iCloud ist noch nicht verbunden (deploy/icloud-verbinden.sh).' }, { status: 409 });
  return { person: z.person };
}

async function json(req: Request): Promise<Record<string, unknown> | null> {
  try { const b = await req.json(); return b && typeof b === 'object' ? b as Record<string, unknown> : null; } catch { return null; }
}

export async function POST(req: Request) {
  const z = await vorab(req); if (z instanceof NextResponse) return z;
  const b = await json(req);
  if (!b) return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 });
  const p = anlegenPruefen(b);
  if (!p.ok) return NextResponse.json({ ok: false, fehler: p.fehler }, { status: 400 });
  const e = p.e;
  const einst = await ladeEinstellungen();
  // Ohne Angabe: der Kalender der anlegenden Person (Kevin/Malin), sonst Kevins.
  const wer: Wer = e.wer ?? (z.person === 'malin' ? 'malin' : 'kevin');
  const kalender = e.kalender || einst.kalender[wer];
  try {
    const r = await anlegen({
      titel: e.titel, kalender, start: e.start, ende: e.ende, ganztags: e.ganztags,
      ...(e.ort ? { ort: e.ort } : {}), ...(e.notiz ? { notiz: e.notiz } : {}), ...(e.wiederholung ? { wiederholung: e.wiederholung } : {}),
      erinnerungenMin: e.erinnerungenMin, art: e.art, ...(e.farbe ? { farbe: e.farbe } : {}), beschaeftigt: e.beschaeftigt,
      sichtbarkeit: e.sichtbarkeit, zone: e.zone, ...(e.arbeitsort ? { arbeitsort: e.arbeitsort } : {}),
    });
    // Starttag in Berlin (für die Verbindungsprüfung) — bei einer anderen Zone umgerechnet, nie über new Date(wandzeit).
    const tag = e.ganztags || e.zone === STANDARD_ZONE ? e.start.slice(0, 10) : wandzeit(ausWandzeitIn(e.start, e.zone)).slice(0, 10);
    let hinweis: string | undefined;
    try {
      await bezugSetzen(r.uid, { ...e.bezug, von: z.person, tag, ...(e.art !== 'termin' ? { art: e.art } : {}), ...(e.sichtbarkeit === 'privat' ? { privat: true } : {}) });
    } catch { hinweis = 'Termin angelegt — der Bezug zu MAKE OS ließ sich gerade nicht speichern (Art und Sichtbarkeit stehen im Termin).'; }
    await protokolliere('kalender', [{ liste: 'termine', op: 'neu', id: r.uid, felder: ['art', ...(Object.keys(e.bezug))] }], werAus(req));
    return NextResponse.json({ ok: true, ...r, ...(hinweis ? { hinweis } : {}) });
  } catch (err) { return antwortFehler(err, z.person); }
}

export async function PATCH(req: Request) {
  const z = await vorab(req); if (z instanceof NextResponse) return z;
  const b = await json(req);
  if (!b) return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 });
  const p = aendernPruefen(b);
  if (!p.ok) return NextResponse.json({ ok: false, fehler: p.fehler }, { status: 400 });
  const { uid, stand, termin, bezug } = p.e;
  const felder = Object.keys(termin);
  if (!felder.length && !bezug) return NextResponse.json({ ok: true });
  try {
    if (felder.length) await aendern(uid, termin, { ...(stand ? { stand } : {}) });
    else if (!(await terminBekannt(uid))) return NextResponse.json({ ok: false, fehler: 'Termin nicht gefunden — vielleicht gerade in Apple gelöscht.' }, { status: 404 });
    // Sicherung (Art, privat) und Bezüge nachziehen — Kennungen nie in den Termin.
    const teil: Record<string, unknown> = {
      ...(bezug ?? {}),
      ...(termin.art !== undefined ? { art: termin.art === 'termin' ? null : termin.art } : {}),
      ...(termin.sichtbarkeit !== undefined ? { privat: termin.sichtbarkeit === 'privat' ? true : null } : {}),
      ...(termin.start ? { tag: termin.start.slice(0, 10) } : {}),
    };
    if (Object.keys(teil).length) await bezugSetzen(uid, teil);
    await protokolliere('kalender', [{ liste: 'termine', op: 'geaendert', id: uid, felder: [...felder, ...Object.keys(bezug ?? {})] }], werAus(req));
    return NextResponse.json({ ok: true });
  } catch (err) { return antwortFehler(err, z.person); }
}

export async function DELETE(req: Request) {
  const z = await vorab(req); if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const uid = text(q.get('uid'), 300);
  if (!uid) return NextResponse.json({ ok: false, fehler: 'uid fehlt.' }, { status: 400 });
  const stand = text(q.get('stand'), 200);
  try {
    await loeschen(uid, { ...(stand ? { stand } : {}) });
    await bezugSetzen(uid, null).catch(() => { /* die Verbindungsprüfung meldet den Rest (termin-uid-tot) */ });
    await protokolliere('kalender', [{ liste: 'termine', op: 'geloescht', id: uid }], werAus(req));
    return NextResponse.json({ ok: true });
  } catch (err) { return antwortFehler(err, z.person); }
}
