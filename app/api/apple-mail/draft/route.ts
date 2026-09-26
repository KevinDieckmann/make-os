// ─── MAKE OS — Antwort als Entwurf in Apple Mail öffnen ─────────────────────
// Erstellt ein SICHTBARES Kompositionsfenster in Mail.app (kein automatischer
// Versand!). Kevin prüft und sendet selbst — sauberes Human-in-the-Loop.

import { NextResponse } from 'next/server';
import { AUF_DEM_MAC, nurMac } from '@/lib/mac';
import { spawn } from 'child_process';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Für AppleScript-String-Literale sicher escapen (Backslash, Quote, Newline→\n).
const asEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '').replace(/\n/g, '\\n');

function runOsascript(script: string, timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/zsh', ['-l', '-c', '/usr/bin/osascript -'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('osascript timeout — Mail-Zugriff freigeben')); }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.stdin.write(script, 'utf8'); child.stdin.end();
    child.on('close', (code) => { clearTimeout(timer); if (code === 0) resolve(stdout); else reject(new Error(stderr.trim() || `Exit ${code}`)); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

export async function POST(req: Request) {
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, error: 'Nur für den Inhaber.' }, { status: 403 });
  if (!AUF_DEM_MAC) return nurMac();
  let p: { to?: string; subject?: string; body?: string };
  try { p = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const to = (p.to ?? '').trim();
  const subject = (p.subject ?? '').trim();
  const body = (p.body ?? '').trim();
  if (!body) return NextResponse.json({ ok: false, error: 'Kein Text zum Öffnen.' }, { status: 400 });

  const recipient = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
    ? `\n  tell msg\n    make new to recipient at end with properties {address:"${asEsc(to)}"}\n  end tell`
    : '';

  const script = `
tell application "Mail"
  set msg to make new outgoing message with properties {subject:"${asEsc(subject)}", content:"${asEsc(body)}", visible:true}${recipient}
  activate
end tell
return "ok"
`;

  try {
    await runOsascript(script);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: 'Konnte den Entwurf nicht öffnen', detail: msg }, { status: 500 });
  }
}
