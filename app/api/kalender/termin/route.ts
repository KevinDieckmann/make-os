// ─── Kalender — Termin anlegen, ändern, löschen (iCloud) ────────────────────
// POST   { titel, kalender? | wer?, start, ende, ganztags?, ort?, notiz? } → { uid, kalender }
// PATCH  { uid, start?, ende?, titel?, ort?, notiz? }   (nur Einzeltermine ohne Teilnehmer)
// DELETE ?uid=…                                          (dito — die Oberfläche fragt vorher)
// Zeiten als Berliner Wandzeit „YYYY-MM-DDTHH:mm(:ss)“; ganztags: Tag, Ende exklusiv.
// Versendet wird nie etwas: MAKE OS legt keine Teilnehmer an und ändert
// keine Termine mit Einladungen.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { verbunden, anlegen, aendern, loeschen, KalenderFehler } from '@/lib/kalender/icloud';
import { ladeEinstellungen, type Wer } from '@/lib/kalender/einstellungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WAND = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
const wand = (v: unknown) => (typeof v === 'string' && WAND.test(v) ? (v.length === 10 ? `${v}T00:00:00` : v.length === 16 ? `${v}:00` : v) : undefined);
const txt = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, n) : undefined);

function antwortFehler(e: unknown) {
  if (e instanceof KalenderFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
  return NextResponse.json({ ok: false, fehler: 'iCloud nicht erreichbar.' }, { status: 502 });
}

async function vorab(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  if (!verbunden()) return NextResponse.json({ ok: false, fehler: 'iCloud ist noch nicht verbunden (deploy/icloud-verbinden.sh).' }, { status: 409 });
  return null;
}

export async function POST(req: Request) {
  const nein = await vorab(req); if (nein) return nein;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const titel = txt(b.titel, 300);
  const ganztags = b.ganztags === true;
  const start = wand(b.start), ende = wand(b.ende);
  if (!titel) return NextResponse.json({ ok: false, fehler: 'Titel fehlt.' }, { status: 400 });
  if (!start || !ende || ende <= start) return NextResponse.json({ ok: false, fehler: 'Start und Ende fehlen oder passen nicht.' }, { status: 400 });
  const einst = await ladeEinstellungen();
  const wer = (['kevin', 'malin', 'beide'] as Wer[]).find(w => w === b.wer);
  const kalender = txt(b.kalender, 100) || einst.kalender[wer ?? 'kevin'];
  try {
    const r = await anlegen({ titel, kalender, start, ende, ganztags, ort: txt(b.ort, 300), notiz: txt(b.notiz, 2000) });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return antwortFehler(e); }
}

export async function PATCH(req: Request) {
  const nein = await vorab(req); if (nein) return nein;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const uid = txt(b.uid, 300);
  if (!uid) return NextResponse.json({ ok: false, fehler: 'uid fehlt.' }, { status: 400 });
  const start = b.start !== undefined ? wand(b.start) : undefined;
  const ende = b.ende !== undefined ? wand(b.ende) : undefined;
  if ((b.start !== undefined && !start) || (b.ende !== undefined && !ende)) return NextResponse.json({ ok: false, fehler: 'Zeit im falschen Format.' }, { status: 400 });
  try {
    await aendern(uid, {
      ...(start ? { start } : {}), ...(ende ? { ende } : {}),
      ...(b.titel !== undefined ? { titel: txt(b.titel, 300) ?? '' } : {}),
      ...(b.ort !== undefined ? { ort: txt(b.ort, 300) || null } : {}),
      ...(b.notiz !== undefined ? { notiz: txt(b.notiz, 2000) || null } : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (e) { return antwortFehler(e); }
}

export async function DELETE(req: Request) {
  const nein = await vorab(req); if (nein) return nein;
  const uid = txt(new URL(req.url).searchParams.get('uid'), 300);
  if (!uid) return NextResponse.json({ ok: false, fehler: 'uid fehlt.' }, { status: 400 });
  try { await loeschen(uid); return NextResponse.json({ ok: true }); } catch (e) { return antwortFehler(e); }
}
