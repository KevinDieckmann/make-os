// ─── MAKE OS — Termin in Apple Kalender schreiben ───────────────────────────
// Kevins Ansage: „Wenn ich einen Block anlege, soll sofort der Termin bei
// Apple entstehen — perfekte Synchronisation."
//
// Bewusst eng gehalten:
// • Es wird NUR angelegt und gelöscht, nie etwas Fremdes verändert.
// • Nur in den Kalender, der in den Einstellungen steht — kein Raten.
// • Das Datum wird aus Bestandteilen gebaut, nicht aus einem Text geparst:
//   AppleScript liest Datumstexte je nach Systemsprache anders, und ein
//   Termin am falschen Tag ist schlimmer als gar keiner.
//
// Die Antwort enthält die UID des Termins. Damit kann MAKE OS ihn später
// wiederfinden und mitlöschen, wenn der Block im Planer verschwindet.

import { NextResponse } from 'next/server';
import { AUF_DEM_MAC, nurMac } from '@/lib/mac';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { verbunden, anlegen, loeschen, frischerStand, KalenderFehler } from '@/lib/kalender/icloud';
import { ladeEinstellungen } from '@/lib/kalender/einstellungen';
import { wandAus } from '@/lib/kalender/zeit';
import { spawn } from 'child_process';
import { loadJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function osascript(script: string, timeoutMs = 45_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/osascript', ['-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Kalender antwortet nicht.')); }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.stdin.write(script, 'utf8');
    child.stdin.end();
    child.on('close', c => { clearTimeout(timer); if (c === 0) resolve(out.trim()); else reject(new Error(err.trim() || `Exit ${c}`)); });
    child.on('error', e => { clearTimeout(timer); reject(e); });
  });
}

const alsText = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Datum aus Bestandteilen setzen — sprachunabhängig und damit verlässlich. */
function datumBlock(name: string, jahr: number, monat: number, tag: number, minuten: number) {
  return [
    `set ${name} to current date`,
    `set year of ${name} to ${jahr}`,
    `set month of ${name} to ${monat}`,
    `set day of ${name} to ${tag}`,
    `set hours of ${name} to ${Math.floor(minuten / 60)}`,
    `set minutes of ${name} to ${minuten % 60}`,
    `set seconds of ${name} to 0`,
  ].join('\n  ');
}

async function zielKalender(): Promise<string> {
  const e = await loadJson<{ appleKalender?: string }>('kalender-einstellungen');
  return e?.appleKalender?.trim() || 'Privat Kevin';
}

/** Wessen Kalender: die Person, die plant (Malin → ihr Kalender), sonst Kevins. */
async function kalenderFuer(person: string): Promise<string> {
  const e = await ladeEinstellungen();
  return person === 'malin' ? e.kalender.malin : e.kalender.kevin;
}
const fehlerText = (e: unknown) => (e instanceof KalenderFehler ? e.message : 'iCloud nicht erreichbar.');

export async function POST(req: Request) {
  const wer = await kalenderZugang(req);
  if (!wer) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  if (verbunden()) {
    // iCloud (Server): dieselben Eingaben wie am Mac, gleiche Antwort ({ ok, uid, kalender }).
    let b: { titel?: string; date?: string; startMin?: number; dauerMin?: number; notiz?: string };
    try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein JSON.' }, { status: 400 }); }
    const titel = String(b.titel ?? '').trim().slice(0, 200);
    const date = String(b.date ?? ''), startMin = Number(b.startMin), dauerMin = Number(b.dauerMin);
    if (!titel || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isFinite(startMin) || startMin < 0 || startMin > 1440 || !isFinite(dauerMin) || dauerMin < 5 || dauerMin > 720) {
      return NextResponse.json({ ok: false, error: 'Titel, Tag oder Zeit fehlen oder passen nicht.' }, { status: 400 });
    }
    try {
      const r = await anlegen({ titel, kalender: await kalenderFuer(wer.person), start: wandAus(date, startMin), ende: wandAus(date, startMin + dauerMin), notiz: b.notiz ? String(b.notiz).slice(0, 500) : undefined });
      return NextResponse.json({ ok: true, uid: r.uid, kalender: r.kalender });
    } catch (e) { return NextResponse.json({ ok: false, error: fehlerText(e) }, { status: 200 }); }
  }
  if (!AUF_DEM_MAC) return nurMac();
  let body: { titel?: string; date?: string; startMin?: number; dauerMin?: number; notiz?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein JSON.' }, { status: 400 }); }

  const titel = String(body.titel ?? '').trim().slice(0, 200);
  const date = String(body.date ?? '');
  const startMin = Number(body.startMin);
  const dauerMin = Number(body.dauerMin);

  if (!titel) return NextResponse.json({ ok: false, error: 'Titel fehlt.' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, error: 'date muss YYYY-MM-DD sein.' }, { status: 400 });
  if (!isFinite(startMin) || startMin < 0 || startMin > 24 * 60) return NextResponse.json({ ok: false, error: 'startMin außerhalb des Tages.' }, { status: 400 });
  if (!isFinite(dauerMin) || dauerMin < 5 || dauerMin > 12 * 60) return NextResponse.json({ ok: false, error: 'dauerMin muss 5–720 sein.' }, { status: 400 });

  const [jahr, monat, tag] = date.split('-').map(Number);
  const kalender = await zielKalender();

  const script = `
tell application "Calendar"
  ${datumBlock('startD', jahr, monat, tag, startMin)}
  ${datumBlock('endeD', jahr, monat, tag, Math.min(24 * 60 - 1, startMin + dauerMin))}
  tell calendar ${alsText(kalender)}
    set neuerTermin to make new event with properties {summary:${alsText(titel)}, start date:startD, end date:endeD${body.notiz ? `, description:${alsText(String(body.notiz).slice(0, 500))}` : ''}}
    return uid of neuerTermin
  end tell
end tell`;

  try {
    const uid = await osascript(script);
    return NextResponse.json({ ok: true, uid, kalender });
  } catch (err) {
    const m = err instanceof Error ? err.message : 'Fehler';
    // Der häufigste Fall: der Kalendername stimmt nicht mehr.
    const klar = /Can.t get calendar/i.test(m)
      ? `Kalender „${kalender}" gibt es nicht — unter Kalender-Einstellungen den richtigen wählen.`
      : m.slice(0, 220);
    return NextResponse.json({ ok: false, error: klar }, { status: 200 });
  }
}

/** Termin wieder entfernen — wenn der Block im Planer gelöscht wird. */
export async function DELETE(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const uid = new URL(req.url).searchParams.get('uid') ?? '';
  if (!uid) return NextResponse.json({ ok: false, error: 'uid fehlt.' }, { status: 400 });
  if (verbunden()) {
    try { await loeschen(uid); return NextResponse.json({ ok: true, geloescht: 1 }); } catch (e) { return NextResponse.json({ ok: false, error: fehlerText(e) }, { status: 200 }); }
  }
  if (!AUF_DEM_MAC) return nurMac();
  const kalender = await zielKalender();
  const script = `
tell application "Calendar"
  tell calendar ${alsText(kalender)}
    set treffer to (every event whose uid is ${alsText(uid)})
    repeat with e in treffer
      delete e
    end repeat
    return (count of treffer) as text
  end tell
end tell`;
  try {
    const n = await osascript(script);
    return NextResponse.json({ ok: true, geloescht: Number(n) || 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'Fehler' }, { status: 200 });
  }
}

/** Welche Kalender beschreibbar sind — für die Auswahl in den Einstellungen. */
export async function GET(req: Request) {
  const wer = await kalenderZugang(req);
  if (!wer) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  if (verbunden()) {
    const st = await frischerStand();
    return NextResponse.json({ ok: true, kalender: st.kalender.filter(k => k.schreibbar).map(k => k.name), gewaehlt: await kalenderFuer(wer.person) });
  }
  if (!AUF_DEM_MAC) return nurMac();
  try {
    const roh = await osascript(`
tell application "Calendar"
  set out to ""
  repeat with c in calendars
    try
      if writable of c then set out to out & (name of c) & linefeed
    end try
  end repeat
  return out
end tell`);
    const namen = Array.from(new Set(roh.split('\n').map(s => s.trim()).filter(Boolean)));
    return NextResponse.json({ ok: true, kalender: namen, gewaehlt: await zielKalender() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'Fehler' }, { status: 200 });
  }
}
