// ─── MAKE OS — Kontakte vom Mac ─────────────────────────────────────────────
// Liest die Kontakte-App via AppleScript. Läuft lokal; braucht einmalig die
// Freigabe (macOS-Popup „Zugriff auf Kontakte"). Es wird nur GELESEN — in die
// Kontakte-App schreibt MAKE OS nie.
//
// Ein Kontakt je Zeile, Felder mit || getrennt. Bewusst schmal: Name, Firma,
// Rolle, erste E-Mail, erste Telefonnummer, Notiz-Anfang. Keine Adressen,
// keine Geburtstage — was wir nicht brauchen, holen wir nicht.

import { NextResponse } from 'next/server';
import { AUF_DEM_MAC, merke, vomMac } from '@/lib/mac';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 2000;

// Listen-Abfragen statt Einzelzugriffen: ein Apple-Event je Feld für ALLE
// Kontakte, nicht eines je Kontakt und Feld. Bei tausend Einträgen ist das
// der Unterschied zwischen Sekunden und Minuten.
const SCRIPT = `
set AppleScript's text item delimiters to "||"
tell application "Contacts"
  set nn to name of people
  set oo to organization of people
  set jj to job title of people
  set ee to value of emails of people
  set pp to value of phones of people
end tell
set out to ""
set n to count of nn
if n > ${MAX} then set n to ${MAX}
repeat with i from 1 to n
  set nm to item i of nn
  if nm is not missing value and nm is not "" then
    set org to item i of oo
    if org is missing value then set org to ""
    set jt to item i of jj
    if jt is missing value then set jt to ""
    -- E-Mails und Telefone kommen als Liste je Person; die erste genügt.
    set em to ""
    try
      set el to item i of ee
      if class of el is list then
        if (count of el) > 0 then set em to item 1 of el
      else
        set em to el
      end if
    end try
    if em is missing value then set em to ""
    set ph to ""
    try
      set pl to item i of pp
      if class of pl is list then
        if (count of pl) > 0 then set ph to item 1 of pl
      else
        set ph to pl
      end if
    end try
    if ph is missing value then set ph to ""
    set out to out & nm & "||" & org & "||" & jt & "||" & em & "||" & ph & "||" & linefeed
  end if
end repeat
return out
`;

function runOsascript(script: string, timeoutMs = 90_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/zsh', ['-l', '-c', '/usr/bin/osascript -'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Zeitüberschreitung — Zugriff auf Kontakte freigeben (Systemeinstellungen → Datenschutz & Sicherheit → Kontakte)'));
    }, timeoutMs);
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.stdin.write(script, 'utf8');
    child.stdin.end();
    child.on('close', code => { clearTimeout(timer); if (code === 0) resolve(stdout); else reject(new Error(stderr.trim() || `Exit ${code}`)); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

const sauber = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ');

/**
 * Geschäftlich oder privat? Deterministische Einschätzung — Firma oder
 * Position gesetzt, oder eine Firmen-Mail (kein Freemail-Anbieter).
 */
const FREEMAIL = /@(gmail|googlemail|web|gmx|t-online|yahoo|hotmail|outlook|live|icloud|me|mac|aol|freenet|posteo|mailbox)\./i;
function einordnen(firma: string, rolle: string, email: string): 'geschaeftlich' | 'privat' | 'unklar' {
  if (firma || rolle) return 'geschaeftlich';
  if (email && !FREEMAIL.test(email)) return 'geschaeftlich';
  if (email) return 'privat';
  return 'unklar';
}

export async function GET() {
  if (!AUF_DEM_MAC) return vomMac('kontakte', { kontakte: [], anzahl: 0, error: 'Kontakte kommen nur vom Mac — noch nichts zugeliefert.' });
  try {
    const stdout = await runOsascript(SCRIPT);
    const kontakte = [];
    let idx = 0;
    for (const line of stdout.split('\n')) {
      const parts = line.split('||');
      if (parts.length < 5) continue;
      const name = sauber(parts[0]);
      if (!name || name === 'missing value') continue;
      const firma = sauber(parts[1]);
      const rolle = sauber(parts[2]);
      const email = sauber(parts[3]).toLowerCase();
      const telefon = sauber(parts[4]);
      // Notizen können lang und sehr privat sein — nur ein kurzer Anriss.
      const notiz = sauber(parts[5]).slice(0, 200);
      kontakte.push({
        id: `mac-${idx++}`,
        name, firma: firma || undefined, rolle: rolle || undefined,
        email: email || undefined, telefon: telefon || undefined,
        notiz: notiz || undefined,
        art: einordnen(firma, rolle, email),
      });
    }
    const zaehl = { geschaeftlich: 0, privat: 0, unklar: 0 };
    kontakte.forEach(k => { zaehl[k.art]++; });
    await merke('kontakte', { kontakte, anzahl: kontakte.length, zaehl });
    return NextResponse.json({ kontakte, anzahl: kontakte.length, zaehl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Kontakte nicht lesbar.' }, { status: 200 });
  }
}
