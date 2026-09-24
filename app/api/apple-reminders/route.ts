// ─── MAKE OS — Apple Erinnerungen (iCloud, geteilt mit Malin) ────────────────
// Liest offene Erinnerungen je Liste via AppleScript. KEIN `whose`-Filter
// (zu langsam) — stattdessen die ersten N je Liste durchgehen und im Loop
// prüfen. Läuft lokal auf dem Mac; braucht einmalig die Zugriffs-Freigabe
// (macOS-Popup „Zugriff auf Erinnerungen").

import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_LIST = 40;

const SCRIPT = `
tell application "Reminders"
  set out to ""
  repeat with l in lists
    set lname to name of l
    set rs to reminders of l
    set n to (count of rs)
    if n > ${MAX_PER_LIST} then set n to ${MAX_PER_LIST}
    repeat with i from 1 to n
      set r to item i of rs
      try
        if (completed of r) is false then
          set dd to ""
          try
            set dd to (due date of r) as string
          end try
          set pr to 0
          try
            set pr to priority of r
          end try
          set out to out & lname & "||" & (name of r) & "||" & dd & "||" & pr & linefeed
        end if
      end try
    end repeat
  end repeat
  return out
end tell
`;

function runOsascript(script: string, timeoutMs = 45_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/zsh', ['-l', '-c', '/usr/bin/osascript -'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('osascript timeout — Zugriff auf Erinnerungen freigeben (Systemeinstellungen → Datenschutz → Erinnerungen)')); }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.stdin.write(script, 'utf8');
    child.stdin.end();
    child.on('close', (code) => { clearTimeout(timer); if (code === 0) resolve(stdout); else reject(new Error(stderr.trim() || `Exit ${code}`)); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function parseDate(s: string): string | undefined {
  const t = s.trim();
  if (!t || t === 'missing value') return undefined;
  const d = new Date(t);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function GET() {
  try {
    const stdout = await runOsascript(SCRIPT);
    const items: object[] = [];
    let idx = 0;
    for (const line of stdout.split('\n')) {
      const parts = line.split('||');
      if (parts.length < 2) continue;
      const [list, title, dueStr, prio] = parts;
      if (!title?.trim()) continue;
      items.push({
        id: `reminder-${idx++}`,
        list: list.trim(),
        title: title.trim(),
        due: parseDate(dueStr ?? ''),
        priority: Number((prio ?? '0').trim()) || 0,
        source: 'apple-reminders',
      });
    }
    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Kein Zugriff auf Erinnerungen', detail: msg }, { status: 500 });
  }
}
