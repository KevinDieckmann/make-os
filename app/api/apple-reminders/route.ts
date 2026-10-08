// ─── MAKE OS — Apple Erinnerungen (iCloud, geteilt mit Malin) ────────────────
// Liest die Erinnerungen je Liste via AppleScript (seit 08.10. auch erledigte, gekennzeichnet — der Kalender zeigt sie nicht,
// die einmalige Übernahme als Aufgaben nimmt sie nur auf Wunsch). KEIN `whose`-Filter (zu langsam) — stattdessen die ersten N
// je Liste durchgehen. Läuft lokal auf dem Mac; braucht einmalig die Zugriffs-Freigabe (macOS-Popup „Zugriff auf Erinnerungen").
// Auf dem Server liefert die Route den zugelieferten Spiegel — bzw. nichts mehr, sobald der Zulieferer aus ist (lib/mac.ts `vomMac`).

import { NextResponse } from 'next/server';
import { AUF_DEM_MAC, merke, vomMac } from '@/lib/mac';
import { imHaushaltOderSystemlauf } from '@/lib/zugang/haushalt-inhaber';
import { skriptZeileLesen, SKRIPT_SATZ } from '@/lib/zulieferer/erinnerungen';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_LIST = 40;

// Seit 08.10. (Lücke 10 — einmalige Übernahme als Aufgaben, lib/zulieferer/erinnerungen.ts): zusätzlich die Apple-Kennung (`id`,
// „x-apple-reminder://…“ → feste Aufgaben-Kennung), die Notiz (`body`), erledigt ja/nein und die Fälligkeit als Wandzeit aus den
// Datumsteilen („JJJJ-MM-TTTHH:MM“) — `(due date) as string` hängt von der Sprache des Macs ab und war oft nicht lesbar.
// Felder mit Steuerzeichen getrennt (US = 31, RS = 30), damit Notizen Zeilenumbrüche haben dürfen.
const SCRIPT = `
set US to (character id 31)
set RS to (character id 30)
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
        set erl to (completed of r)
        set rid to ""
        try
          set rid to (id of r) as string
        end try
        set dd to ""
        try
          set d to due date of r
          if d is not missing value then
            set dd to ((year of d) as string) & "-" & (text -2 thru -1 of ("0" & ((month of d) as integer))) & "-" & (text -2 thru -1 of ("0" & (day of d))) & "T" & (text -2 thru -1 of ("0" & (hours of d))) & ":" & (text -2 thru -1 of ("0" & (minutes of d)))
          end if
        end try
        set bd to ""
        try
          set b to body of r
          if b is not missing value then set bd to b
        end try
        set pr to 0
        try
          set pr to priority of r
        end try
        set out to out & lname & US & (name of r) & US & dd & US & pr & US & rid & US & bd & US & (erl as string) & RS
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

export async function GET(req: Request) {
  // Auch der Systemlauf ohne Person (Zulieferer vom Mac, 28.09.) — Personen nur aus dem Haushalt des Inhabers.
  if (!(await imHaushaltOderSystemlauf(req))) return NextResponse.json({ error: 'Erinnerungen gehören zum Haushalt des Inhabers.' }, { status: 403 });
  if (!AUF_DEM_MAC) return vomMac('erinnerungen', []);
  try {
    const stdout = await runOsascript(SCRIPT);
    const items: object[] = [];
    let idx = 0;
    for (const zeile of stdout.split(SKRIPT_SATZ)) {
      const e = skriptZeileLesen(zeile, idx);
      if (!e) continue;
      idx++;
      items.push(e);
    }
    await merke('erinnerungen', items);
    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Kein Zugriff auf Erinnerungen', detail: msg }, { status: 500 });
  }
}
