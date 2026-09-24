// ─── MAKE OS — Mail-Inhalt lesen ────────────────────────────────────────────
// Die Liste (/api/apple-mail) liefert nur Absender und Betreff. Für „hol die
// Whoop-Werte aus der Mail" braucht Jarvis den Text selbst.
//
// Gleiche Disziplin wie in der Liste: KEIN `whose`-Filter, der scannt in Mail
// alle Nachrichten und braucht Minuten. Stattdessen die neuesten N greifen und
// in JavaScript filtern.
//
// Read-only: es wird gelesen, nie geantwortet, nie verschoben, nie gelöscht.

import { NextResponse } from 'next/server';
import { AUF_DEM_MAC, nurMac } from '@/lib/mac';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_ACCOUNT = 25;
const TRENN = '<<<MAKE>>>';

/** AppleScript-Zeichenkette einbetten — Anführungszeichen und Backslash escapen. */
const alsText = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Erst der Kopf, dann der Text — und der Text NUR bei Treffern.
 * `content of m` ist teuer: für 25 Mails × mehrere Konten läuft das in den
 * Timeout. Betreff und Absender sind billig, also wird zuerst darauf gefiltert
 * und danach höchstens `anzahl` Nachrichten wirklich geöffnet.
 */
function script(suche: string, anzahl: number, maxLaenge: number): string {
  const filter = suche
    ? `if ((subject of m) contains ${alsText(suche)}) or ((sender of m) contains ${alsText(suche)}) then`
    : 'if true then';
  return `
tell application "Mail"
  set out to ""
  set gefunden to 0
  set gesehen to 0
  ignoring case
    repeat with acct in (every account whose enabled is true)
      if gefunden < ${anzahl} then
        try
          set inb to mailbox "INBOX" of acct
          set n to (count of messages of inb)
          if n > ${MAX_PER_ACCOUNT} then set n to ${MAX_PER_ACCOUNT}
          repeat with i from 1 to n
            if gefunden >= ${anzahl} then exit repeat
            try
              set m to message i of inb
              set gesehen to gesehen + 1
              ${filter}
                set txt to ""
                try
                  set txt to (content of m)
                end try
                if (length of txt) > ${maxLaenge} then set txt to (text 1 thru ${maxLaenge} of txt)
                set out to out & (sender of m) & "||" & (subject of m) & "||" & ((date received of m) as string) & "||" & txt & "${TRENN}"
                set gefunden to gefunden + 1
              end if
            end try
          end repeat
        end try
      end if
    end repeat
  end ignoring
  return (gesehen as text) & "##" & out
end tell
`;
}

function osascript(s: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/zsh', ['-l', '-c', '/usr/bin/osascript -'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Mail antwortet nicht — Node braucht Zugriff auf Mail (Systemeinstellungen → Datenschutz → Automation).'));
    }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.stdin.write(s, 'utf8');
    child.stdin.end();
    child.on('close', code => { clearTimeout(timer); if (code === 0) resolve(stdout); else reject(new Error(stderr.trim() || `Exit ${code}`)); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

export async function GET(req: Request) {
  if (!AUF_DEM_MAC) return nurMac();
  const p = new URL(req.url).searchParams;
  const suche = (p.get('suche') ?? '').toLowerCase().trim();
  const anzahl = Math.min(5, Math.max(1, Number(p.get('anzahl') ?? 1)));
  const maxLaenge = Math.min(6000, Math.max(400, Number(p.get('laenge') ?? 2500)));

  let roh: string;
  try {
    roh = await osascript(script(suche, anzahl, maxLaenge), 90_000);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Mail nicht erreichbar' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [kopf, ...restRoh] = roh.split('##');
  const durchsucht = Number(kopf) || 0;

  const mails = restRoh.join('##').split(TRENN)
    .map(block => {
      const [sender, betreff, datum, ...rest] = block.split('||');
      if (!betreff?.trim()) return null;
      return {
        sender: sender.trim(),
        betreff: betreff.trim(),
        datum: datum?.trim() ?? '',
        text: rest.join('||').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim(),
      };
    })
    .filter((m): m is NonNullable<typeof m> => !!m);

  return NextResponse.json(
    { ok: true, gesucht: suche || null, gefunden: mails.length, durchsucht, mails },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
