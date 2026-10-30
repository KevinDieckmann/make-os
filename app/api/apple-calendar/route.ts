import { NextResponse } from 'next/server';
import { spaceVonKalender } from '@/lib/kalender/space';
import { AUF_DEM_MAC } from '@/lib/mac';
import { kalenderLesen, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { kalenderBereich } from '@/lib/kalender/konto-bereich';
import { verbunden, ladeStand, abgleichen, naechsterVersuchFaellig } from '@/lib/kalender/icloud';
import { spawn } from 'child_process';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { cacheFuerPerson, cacheMitBezug, type CacheEreignis } from '@/lib/kalender/zoe-sicht';
import { ladeBezuege } from '@/lib/kalender/bezug-server';
import type { BezugBestand } from '@/lib/kalender/bezug';
import { EINSTELLUNGEN_LEER, fachKonten, ladeEinstellungen, wemGehoert } from '@/lib/kalender/einstellungen';
import { altwegKalender, altwegSkript, type AltwegKalender } from '@/lib/kalender/apple-altweg';
import { istFach } from '@/lib/make-one/fach-namen';

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

/** „Montag, 5. Oktober 2026 um 09:00:00“ → Berliner Wandzeit — oder null (R-K1 #8: nie „jetzt“ als UTC-Rückfall erfinden). */
function parseGermanDate(str: string): string | null {
  const m = str.trim().match(/(\d+)\.\s+(\S+)\s+(\d{4})\s+um\s+(\d{2}:\d{2}:\d{2})/);
  if (!m) return null;
  const [, day, month, year, time] = m;
  const mm = DE_MONATE[month] ?? '01';
  return `${year}-${mm}-${day.padStart(2, '0')}T${time}`;
}

// ─── Calendar → EventCategory / owner mapping ────────────────────────────────
// 14.10. (Abnahme-Reste 2): keine festen Namen mehr — welche Kalender gelesen werden und wem sie gehören, kommt aus den Kalender-Einstellungen
// (gespeicherter Name gewinnt, sonst „Privat <Vorname>“ aus den Konten) und dem vollen Namen der Person im ersten Fach (lib/kalender/apple-altweg.ts).
async function altweg(): Promise<AltwegKalender> {
  const [einst, voll] = await Promise.all([
    ladeEinstellungen().catch(() => null),
    fachKonten().then(p => p.kevin?.name ?? null).catch(() => null),
  ]);
  return altwegKalender(einst?.kalender ?? EINSTELLUNGEN_LEER.kalender, voll);
}

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

/**
 * Was die Anfrage sehen darf (S1 #1, 29.09.): der Systemlauf ohne Person (Mac-Zulieferer → eigener Server) bekommt den
 * Stand roh; jede Person (Sitzung oder Dienstweg mit Person) nur ihre Sicht — privat/Gesundheit der anderen Person als
 * „Belegt“ (`cacheFuerPerson`, dieselbe Regel wie `fuerZoe`). Vorher gingen Rohtitel und Orte an jede Sitzung im Haushalt.
 */
async function sichtFuer(person: string | null, bereich: 'privat' | 'business' | null = null): Promise<(events: object[]) => object[]> {
  // iCloud je Person (06.10.): Termine aus der EIGENEN Verbindung einer Person gehen auch an den Systemlauf nur als „Belegt“.
  if (person === null && !bereich) return events => (events as CacheEreignis[]).map(e => (e.persoenlich ? cacheFuerPerson(e, '', undefined) : e));
  const einst = await ladeEinstellungen().catch(() => null);
  // Sicht Privat · Business (10.10.): mit `?space=` nur Termine aus Kalendern dieses Bereichs (wie GET /api/kalender, `spaceVonKalender`).
  const imBereich = (e: CacheEreignis) => !bereich || spaceVonKalender(einst, e.calendarName ?? '') === bereich;
  if (person === null) return events => (events as CacheEreignis[]).filter(imBereich).map(e => (e.persoenlich ? cacheFuerPerson(e, '', undefined) : e));
  // 08.10. (Sicht-Prüfung Malin): „privat“/Anleger auch aus der Sicherung in `kalender-bezug` — wie GET /api/kalender und ZOE.
  // Fehlt der Neben-Bestand (Lesefehler), gilt jeder Eintrag mit Eigentümer als privat: lieber „Belegt“ als ein Titel zu viel.
  let bezuege: BezugBestand | null = null, bezugFehlt = false;
  try { bezuege = await ladeBezuege(); } catch { bezugFehlt = true; }
  return events => (events as CacheEreignis[]).filter(imBereich).map(e => {
    const wer = einst && e.calendarName ? wemGehoert(einst, e.calendarName) : istFach(e.owner) ? e.owner : undefined;
    const mit = cacheMitBezug(e, bezuege);
    return cacheFuerPerson(bezugFehlt ? { ...mit, privat: true } : mit, person, wer);
  });
}

export async function GET(req: Request) {
  // Lesen: auch der Systemlauf ohne Person (Zulieferer vom Mac) — Regel 5 gilt über `kalenderLesen` (28.09.).
  const zugang = await kalenderLesen(req);
  if (!zugang) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  // Konten „nur Business“ (Gesamtprüfung 12.10.): immer nur Termine aus Business-Kalendern (`kalenderBereich`).
  const sicht = await sichtFuer(zugang.person, (await kalenderBereich(req, zugang.person)).bereich);
  const force = new URL(req.url).searchParams.get('refresh') === '1';

  // Seit 25.09.: iCloud direkt (Server) — der Abgleich schreibt den calendar-cache.
  if (verbunden()) {
    // Tempo (27.09.): der Seitenpfad wartet nicht auf iCloud. Liegt ein Stand vor, geht er sofort raus und ein fälliger
    // Abgleich läuft im Hintergrund (der Takt hält ihn ohnehin alle 5 Min. frisch). Nur ganz ohne Stand wird gewartet.
    const s0 = await ladeStand();
    let s = s0;
    if (naechsterVersuchFaellig(s0)) { const lauf = abgleichen().catch(() => ladeStand()); if (!s0.at) s = await lauf; else void lauf; }
    const c = await loadJson<CalCache>(CACHE);
    return NextResponse.json(sicht(c?.events ?? []), { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'icloud', ...(c?.at ? { 'X-Stand': c.at } : {}), ...(s.fehler && s.fehlerAt && (!s.at || s.fehlerAt > s.at) ? { 'X-Eingefroren': '1' } : {}) } });
  }

  const cached = await loadJson<CalCache>(CACHE);
  // Auf dem Server gibt es kein osascript: dort gilt, was der Mac zugeliefert hat.
  if (!AUF_DEM_MAC) {
    return NextResponse.json(sicht(cached?.events ?? []), { headers: { 'Cache-Control': 'no-store', 'X-Cache': cached ? 'zulieferung' : 'leer', ...(cached?.at ? { 'X-Stand': cached.at } : { 'X-Nur-Mac': '1' }) } });
  }
  // Frischer Cache → sofort ausliefern (kein zäher osascript-Read)
  if (!force && cached && Date.now() - new Date(cached.at).getTime() < STALE_MS) {
    return NextResponse.json(sicht(cached.events), { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'hit', 'X-Stand': cached.at } });
  }

  try {
    const kal = await altweg();
    const stdout = await runOsascript(altwegSkript(kal.liste));

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
      const endISO   = parseGermanDate(endStr) ?? startISO;
      // Unlesbares Datum: den Termin verwerfen statt ihn auf „jetzt“ (UTC mit „Z“) zu legen (R-K1 #8).
      if (!startISO || !endISO) continue;

      const dedupKey = `${title}|${startISO.substring(0, 16)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const calName = calRaw.replace(/\s+$/, '');
      const mapping = Object.prototype.hasOwnProperty.call(kal.zuordnung, calName) ? kal.zuordnung[calName] : { category: 'joint', owner: 'both' };

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
    return NextResponse.json(sicht(events), { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'fresh', 'X-Stand': new Date().toISOString() } });
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
      return NextResponse.json(sicht(cached.events), { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'stale', 'X-Stand': cached.at, 'X-Grund': kopfTauglich(msg) } });
    }
    return NextResponse.json(
      { error: 'Kein Zugriff auf Apple Kalender' },
      { status: 500 },
    );
  }
}
