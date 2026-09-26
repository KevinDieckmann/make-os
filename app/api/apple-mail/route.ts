import { NextResponse } from 'next/server';
import { AUF_DEM_MAC, merke, vomMac } from '@/lib/mac';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';
import { spawn } from 'child_process';

// ─── AppleScript — liest die neuesten Mails je aktivem Postfach ──────────────
// Wichtig: KEIN `whose date received >= ...`-Filter — der scannt in Mail alle
// Nachrichten und ist brutal langsam (>2 min). Stattdessen die neuesten N
// Nachrichten direkt greifen (message i of inbox ist newest-first). `read`
// ist ein reserviertes Kommando → `(read status of m)` klammern.

const MAX_PER_ACCOUNT = 25;

const SCRIPT = `
tell application "Mail"
  set out to ""
  repeat with acct in (every account whose enabled is true)
    try
      set inb to mailbox "INBOX" of acct
      set acctName to name of acct
      set n to (count of messages of inb)
      if n > ${MAX_PER_ACCOUNT} then set n to ${MAX_PER_ACCOUNT}
      repeat with i from 1 to n
        try
          set m to message i of inb
          set out to out & acctName & "||" & i & "||" & (sender of m) & "||" & (subject of m) & "||" & ((date received of m) as string) & "||" & ((read status of m) as text) & linefeed
        end try
      end repeat
    end try
  end repeat
  return out
end tell
`;

function runOsascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/zsh', ['-l', '-c', '/usr/bin/osascript -'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('osascript timeout — grant Mail access to Node.js in Systemeinstellungen → Datenschutz → Mail'));
    }, 60_000);

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.stdin.write(script, 'utf8');
    child.stdin.end();

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `Exit ${code}`));
    });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// ─── Simple date parser — Apple Mail returns locale-formatted strings ─────────

const DE_MONTHS: Record<string, number> = {
  januar: 0, februar: 1, 'märz': 2, maerz: 2, april: 3, mai: 4, juni: 5,
  juli: 6, august: 7, september: 8, oktober: 9, november: 10, dezember: 11,
};

function parseAppleDate(str: string): string {
  const s = str.trim();
  // Apple Mail (de): "Mittwoch, 30. Juli 2026 um 17:24:03"
  const m = s.match(/(\d{1,2})\.\s+([A-Za-zäöüÄÖÜ]+)\s+(\d{4})\s+um\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (m) {
    const mon = DE_MONTHS[m[2].toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(+m[3], mon, +m[1], +m[4], +m[5], +m[6]);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

// ─── Route handler ────────────────────────────────────────────────────────────

// Ohne diese Zeile würde Next die Route beim Bauen vorberechnen — im
// Produktionsbetrieb käme dann ein eingefrorenes Postfach vom Build-Zeitpunkt.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Kevins Postfach: nur der Inhaber (26.09.).
  if (!(await nurInhaber(req))) return NextResponse.json({ error: 'Das Postfach gehört dem Inhaber.' }, { status: 403 });
  if (!AUF_DEM_MAC) return vomMac('mail', []);
  try {
    const stdout = await runOsascript(SCRIPT);

    const messages: object[] = [];
    let idx = 0;

    for (const line of stdout.split('\n')) {
      const parts = line.split('||');
      if (parts.length < 6) continue;

      const [account, mbIndex, sender, subject, dateStr, readStr] = parts;
      if (!subject?.trim()) continue;

      messages.push({
        id:         `apple-mail-${idx++}`,
        account:    account.trim(),
        mbIndex:    Number(mbIndex.trim()) || 0,
        sender:     sender.trim(),
        subject:    subject.trim(),
        receivedAt: parseAppleDate(dateStr),
        isRead:     readStr.trim() === 'true',
        source:     'apple-mail',
      });
    }

    // newest first
    (messages as Array<{ receivedAt: string }>).sort((a, b) =>
      b.receivedAt.localeCompare(a.receivedAt),
    );

    await merke('mail', messages.slice(0, 50));
    return NextResponse.json(messages.slice(0, 50), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Apple Mail API]', msg);
    return NextResponse.json(
      { error: 'Kein Zugriff auf Apple Mail' },
      { status: 500 },
    );
  }
}
