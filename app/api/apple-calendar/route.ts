import { NextResponse } from 'next/server';
import { AUF_DEM_MAC } from '@/lib/mac';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { verbunden, frischerStand } from '@/lib/kalender/icloud';
import { spawn } from 'child_process';
import { loadJson, saveJson } from '@/lib/store/local-db';

// Apple Kalender via osascript ist zäh (whose-Datumsfilter) und wird unter Last
// >60s → Timeout. Deshalb Cache: frische Reads werden gespeichert, bei
// Langsamkeit/Fehler servieren wir den letzten guten Stand statt zu hängen.
import { kopfTauglich } from '@/lib/kopf-tauglich';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CACHE = 'calendar-cache';
const STALE_MS = 15 * 60 * 1000; // 15 Min
interface CalCache { events: object[]; at: string; }

// ─── German month names → zero-padded number ─────────────────────────────────

const DE_MONATE: Record<string, string> = {
  Januar: '01', Februar: '02', März: '03', April: '04',
  Mai: '05', Juni: '06', Juli: '07', August: '08',
  September: '09', Oktober: '10', November: '11', Dezember: '12',
};

function parseGermanDate(str: string): string {
  const m = str.trim().match(/(\d+)\.\s+(\S+)\s+(\d{4})\s+um\s+(\d{2}:\d{2}:\d{2})/);
  if (!m) return new Date().toISOString();
  const [, day, month, year, time] = m;
  const mm = DE_MONATE[month] ?? '01';
  return `${year}-${mm}-${day.padStart(2, '0')}T${time}`;
}

// ─── Calendar → EventCategory / owner mapping ────────────────────────────────

const CAL_MAP: Record<string, { category: string; owner: string }> = {
  'Privat Kevin':    { category: 'private-kevin', owner: 'kevin' },
  'Privat Malin':    { category: 'private-malin', owner: 'malin' },
  'Kevin Dieckmann': { category: 'holding',        owner: 'kevin' },
  'Kalender':        { category: 'joint',          owner: 'both'  },
};

// ─── AppleScript (piped via stdin) ───────────────────────────────────────────

const SCRIPT = `
tell application "Calendar"
  set startDate to (current date) - (1 * days)
  set endDate to (current date) + (21 * days)
  set out to ""
  set calNames to {"Privat Kevin", "Privat Malin ", "Kevin Dieckmann", "Kalender"}
  repeat with calName in calNames
    try
      set cal to calendar calName
      set evts to (every event of cal whose start date >= startDate and start date <= endDate)
      repeat with ev in evts
        set evLoc to ""
        try
          set evLoc to location of ev
          if evLoc is missing value then set evLoc to ""
        end try
        set out to out & calName & "||" & (summary of ev) & "||" & ((start date of ev) as string) & "||" & ((end date of ev) as string) & "||" & (allday event of ev) & "||" & evLoc & linefeed
      end repeat
    end try
  end repeat
  return out
end tell
`;

// ─── osascript runner (stdin, avoids temp-file + different TCC path) ─────────

function runOsascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use login shell so the process inherits the user session's TCC grants
    const child = spawn('/bin/zsh', ['-l', '-c', '/usr/bin/osascript -'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('osascript timeout (>60 s) — grant Calendar access to Node.js in Systemeinstellungen → Datenschutz → Kalender'));
    }, 60_000);

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    child.stdin.write(script, 'utf8');
    child.stdin.end();

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `osascript exit ${code}`));
    });

    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const force = new URL(req.url).searchParams.get('refresh') === '1';

  // Seit 25.09.: iCloud direkt (Server) — der Abgleich schreibt den calendar-cache.
  if (verbunden()) {
    const s = await frischerStand();
    const c = await loadJson<CalCache>(CACHE);
    return NextResponse.json(c?.events ?? [], { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'icloud', ...(c?.at ? { 'X-Stand': c.at } : {}), ...(s.fehler && s.fehlerAt && (!s.at || s.fehlerAt > s.at) ? { 'X-Eingefroren': '1' } : {}) } });
  }

  const cached = await loadJson<CalCache>(CACHE);
  // Auf dem Server gibt es kein osascript: dort gilt, was der Mac zugeliefert hat.
  if (!AUF_DEM_MAC) {
    return NextResponse.json(cached?.events ?? [], { headers: { 'Cache-Control': 'no-store', 'X-Cache': cached ? 'zulieferung' : 'leer', ...(cached?.at ? { 'X-Stand': cached.at } : { 'X-Nur-Mac': '1' }) } });
  }
  // Frischer Cache → sofort ausliefern (kein zäher osascript-Read)
  if (!force && cached && Date.now() - new Date(cached.at).getTime() < STALE_MS) {
    return NextResponse.json(cached.events, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'hit', 'X-Stand': cached.at } });
  }

  try {
    const stdout = await runOsascript(SCRIPT);

    const seen = new Set<string>();
    const events: object[] = [];
    let idx = 0;
    const now = new Date().toISOString();

    for (const line of stdout.split('\n')) {
      const parts = line.split('||');
      if (parts.length < 5) continue;

      const calRaw   = parts[0].trim();
      const title    = parts[1].trim();
      const startStr = parts[2].trim();
      const endStr   = parts[3].trim();
      const allDay   = parts[4].trim() === 'true';
      const location = parts[5]?.trim() || undefined;

      if (!title) continue;

      const startISO = parseGermanDate(startStr);
      const endISO   = parseGermanDate(endStr);

      const dedupKey = `${title}|${startISO.substring(0, 16)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const calName = calRaw.replace(/\s+$/, '');
      const mapping = CAL_MAP[calName] ?? { category: 'joint', owner: 'both' };

      events.push({
        id:           `apple-${idx++}`,
        title,
        category:     mapping.category,
        owner:        mapping.owner,
        startDate:    startISO,
        endDate:      endISO,
        allDay,
        location,
        source:       'apple-calendar',
        calendarName: calName,
        createdAt:    now,
        updatedAt:    now,
      });
    }

    (events as Array<{ startDate: string }>).sort((a, b) => a.startDate.localeCompare(b.startDate));

    await saveJson<CalCache>(CACHE, { events, at: new Date().toISOString() });
    return NextResponse.json(events, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'fresh', 'X-Stand': new Date().toISOString() } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Apple Calendar API]', msg);
    // Lieber letzten guten Stand als einen Fehler: Cache servieren, wenn vorhanden
    if (cached) {
      // Eingefroren: der Kalender war nicht erreichbar. Die Ansicht MUSS das
      // kennzeichnen können — sonst sehen alte Termine aus wie aktuelle.
      // kopfTauglich: HTTP-Header dürfen nur Latin-1. Eine deutsche
      // Fehlermeldung mit Gedankenstrich („—", U+2014) lässt Response.json
      // werfen — und dann antwortet die Route mit 500, obwohl der Cache noch
      // da war. Genau das ist am 07.09. passiert: der Kalender fiel aus, und
      // ausgerechnet der Rettungsweg stürzte am Fehlertext ab.
      return NextResponse.json(cached.events, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'stale', 'X-Stand': cached.at, 'X-Grund': kopfTauglich(msg) } });
    }
    return NextResponse.json(
      { error: 'Kein Zugriff auf Apple Kalender' },
      { status: 500 },
    );
  }
}
