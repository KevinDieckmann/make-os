// ─── MAKE OS — Termine in Apple Kalender anlegen ────────────────────────────
// Erstellt einen oder mehrere Termine (z.B. Reha, Fokuszeit) — damit sich die
// Woche selbst schützt. Nur auf Klick des Nutzers (Human-in-the-Loop). Lokal.

import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_CALENDARS = new Set(['Privat Kevin', 'Kalender', 'Kevin Dieckmann']);

interface NewEvent { title: string; calendar?: string; date: string; startHour: number; startMin?: number; durationMin: number; }

function runOsascript(script: string, timeoutMs = 40_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/zsh', ['-l', '-c', '/usr/bin/osascript -'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('osascript timeout — Kalender-Zugriff freigeben (Systemeinstellungen → Datenschutz → Kalender)')); }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.stdin.write(script, 'utf8'); child.stdin.end();
    child.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `Exit ${code}`)); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

const esc = (s: string) => s.replace(/[\\"\n\r]/g, ' ').slice(0, 120);

function blockFor(e: NewEvent): string | null {
  const m = e.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const cal = e.calendar && ALLOWED_CALENDARS.has(e.calendar) ? e.calendar : 'Privat Kevin';
  const sh = Math.max(0, Math.min(23, Math.floor(e.startHour)));
  const sm = Math.max(0, Math.min(59, Math.floor(e.startMin ?? 0)));
  const dur = Math.max(5, Math.min(600, Math.floor(e.durationMin)));
  return `
  set s to (current date)
  set day of s to 1
  set year of s to ${+y}
  set month of s to ${+mo}
  set day of s to ${+d}
  set hours of s to ${sh}
  set minutes of s to ${sm}
  set seconds of s to 0
  set e to s + (${dur} * minutes)
  tell calendar "${esc(cal)}"
    make new event at end with properties {summary:"${esc(e.title)}", start date:s, end date:e}
  end tell`;
}

export async function POST(req: Request) {
  let payload: { events?: NewEvent[] };
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const list = Array.isArray(payload.events) ? payload.events.slice(0, 30) : [];
  if (!list.length) return NextResponse.json({ ok: false, error: 'Keine Termine übergeben.' }, { status: 400 });

  const blocks = list.map(blockFor).filter(Boolean);
  if (!blocks.length) return NextResponse.json({ ok: false, error: 'Ungültige Termindaten.' }, { status: 400 });

  const script = `tell application "Calendar"\n${blocks.join('\n')}\nend tell\nreturn "ok"`;
  try {
    await runOsascript(script);
    return NextResponse.json({ ok: true, created: blocks.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: 'Konnte nicht eintragen', detail: msg }, { status: 500 });
  }
}
