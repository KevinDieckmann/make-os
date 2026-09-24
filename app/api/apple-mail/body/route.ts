// ─── MAKE OS — Apple Mail: vollen Nachrichtentext bei Bedarf laden ───────────
// Die Liste lädt nur Metadaten (schnell). Beim Öffnen einer Mail holen wir hier
// den Body per AppleScript nach — via Postfach-Name + Index (mbIndex).

import { NextResponse } from 'next/server';
import { AUF_DEM_MAC, nurMac } from '@/lib/mac';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function runOsascript(script: string, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/zsh', ['-l', '-c', '/usr/bin/osascript -'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('osascript timeout')); }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.stdin.write(script, 'utf8');
    child.stdin.end();
    child.on('close', (code) => { clearTimeout(timer); if (code === 0) resolve(stdout); else reject(new Error(stderr.trim() || `Exit ${code}`)); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

export async function GET(req: Request) {
  if (!AUF_DEM_MAC) return nurMac();
  const url = new URL(req.url);
  const account = (url.searchParams.get('account') ?? '').trim();
  const index = Number(url.searchParams.get('index'));

  // Harte Validierung: nur saubere Kontonamen, ganzzahliger Index — kein AppleScript-Injection-Risiko.
  if (!account || /["\\\n\r]/.test(account) || !Number.isInteger(index) || index < 1) {
    return NextResponse.json({ error: 'Ungültige Parameter (account/index).' }, { status: 400 });
  }

  const script = `
tell application "Mail"
  set m to message ${index} of mailbox "INBOX" of account "${account}"
  return (content of m)
end tell
`;

  try {
    const body = await runOsascript(script);
    return NextResponse.json(
      { body: body.slice(0, 8000) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Body konnte nicht geladen werden', detail: msg }, { status: 500 });
  }
}
