// ─── MAKE OS — Kalender-Agent: Woche schützen ──────────────────────────────
// Liest die echten Termine (übergeben), findet Konflikte (deterministisch in
// JS) und schlägt Schutz-Blöcke vor (Reha + Fokus) via Anthropic. Das Anlegen
// passiert erst auf deinen Klick über /api/apple-calendar/create.

import { NextResponse } from 'next/server';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ev { title?: string; startDate?: string; endDate?: string; calendarName?: string; allDay?: boolean; }
interface Block { title: string; date: string; startHour: number; startMin?: number; durationMin: number; calendar: string; grund?: string; }
interface Conflict { date: string; a: string; b: string; overlap: string; }

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

import { localDay as localKey } from '@/lib/zeit';
import { innenAdresse } from '@/lib/innen';

// Overlap-Erkennung: echte Zeit-Kollisionen (keine Ganztags-Events).
function findConflicts(events: Ev[]): Conflict[] {
  const timed = events
    .filter(e => !e.allDay && e.startDate && e.endDate && e.title)
    .map(e => ({ t: e.title as string, s: new Date(e.startDate as string).getTime(), e: new Date(e.endDate as string).getTime(), day: (e.startDate as string).slice(0, 10) }))
    .filter(e => !isNaN(e.s) && !isNaN(e.e))
    .sort((a, b) => a.s - b.s);
  const out: Conflict[] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (timed[j].s >= timed[i].e) break;
      if (timed[j].day !== timed[i].day) continue;
      const st = new Date(Math.max(timed[i].s, timed[j].s));
      out.push({ date: timed[i].day, a: timed[i].t, b: timed[j].t, overlap: `ab ${String(st.getHours()).padStart(2, '0')}:${String(st.getMinutes()).padStart(2, '0')}` });
    }
  }
  return out;
}

function scheduleText(events: Ev[], from: number): string {
  const lines: string[] = [];
  for (const e of events) {
    if (!e.title || !e.startDate) continue;
    const d = new Date(e.startDate);
    if (isNaN(d.getTime()) || d.getTime() < from) continue;
    const day = e.startDate.slice(0, 10);
    const wd = WEEKDAYS[d.getDay()];
    const time = e.allDay ? 'ganztägig' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    lines.push(`${wd} ${day} ${time} — ${e.title} [${e.calendarName ?? ''}]`);
  }
  return lines.join('\n') || '(keine Termine in den nächsten 7 Tagen)';
}

export async function POST(req: Request) {
  let payload: { events?: Ev[]; today?: string };
  try { payload = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const events = Array.isArray(payload.events) ? payload.events : [];
  const today = payload.today && /^\d{4}-\d{2}-\d{2}$/.test(payload.today) ? payload.today : localKey(new Date());

  const conflicts = findConflicts(events);
  const fromTs = new Date(`${today}T00:00:00`).getTime();

  // Nächste 7 Werk-/Kalendertage als erlaubte Ziel-Daten
  // setDate() statt +i*86400000: sonst kippt der Tag an Zeitumstellungen.
  const days: string[] = [];
  const allowedDates = new Set<string>();
  for (let i = 0; i < 8; i++) {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + i);
    const key = localKey(d);
    allowedDates.add(key);
    days.push(`${WEEKDAYS[d.getDay()]} ${key}`);
  }

  if (!hasAnthropicKey()) return NextResponse.json({ briefing: 'Kein Anthropic-Key hinterlegt — Konflikte sind trotzdem geprüft.', conflicts, vorschlaege: [] });
  const agent = await resolveAgent('kalender');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), briefing: '', conflicts, vorschlaege: [] });

  const system = [
    'Du bist der Kalender-Agent in Kevins MAKE OS. Deine Aufgabe: seine Woche schützen.',
    'Kontext Kevin: Bandscheibenvorfall in Reha → braucht 2 kurze Reha/Physio-/Rücken-Blöcke pro Woche und darf sich nicht überladen. Nordstern: 1 Mio € Umsatz bei KD Ventures → braucht geschützte Deep-Work-/Fokuszeit für POINCAP & Vertrieb (am besten vormittags, 90 Min).',
    'Schlage NUR Blöcke vor, die in freie Lücken passen (keine Kollision mit bestehenden Terminen), an Werktagen, in den nächsten 7 Tagen.',
    'Erlaubte Kalender: "Privat Kevin" (Reha/privat), "Kalender" (gemeinsam/Fokus). Reha → "Privat Kevin". Fokus → "Kalender".',
    'Max. 5 Vorschläge. Konkret, ruhig, kein Startup-Sprech.',
    'Antworte AUSSCHLIESSLICH als JSON, kein Markdown:',
    '{"briefing":"<2-3 Sätze zur Woche: Last, Konflikte, was du schützt>","vorschlaege":[{"title":"...","date":"YYYY-MM-DD","startHour":9,"startMin":0,"durationMin":90,"calendar":"Kalender","grund":"<1 Satz>"}]}',
  ].join('\n');

  const user = [
    `Heute: ${today}`,
    `Erlaubte Ziel-Tage: ${days.join(', ')}`,
    '',
    'Bestehende Termine (nächste 7 Tage):',
    scheduleText(events, fromTs),
    '',
    conflicts.length ? `Erkannte Konflikte:\n${conflicts.map(c => `- ${c.date}: "${c.a}" ⨯ "${c.b}" (${c.overlap})`).join('\n')}` : 'Keine Terminkonflikte erkannt.',
  ].join('\n');

  const r = await askJson<{ briefing?: string; vorschlaege?: Block[] }>({ zweck: 'kalender-analyse', system, user, maxTokens: 4000, model: agent.model });
  if (!r.ok || !r.data) return NextResponse.json({ briefing: r.error ?? 'Analyse gerade nicht möglich — Konflikte sind geprüft.', conflicts, vorschlaege: [] });

  const allowed = new Set(['Privat Kevin', 'Kalender']);
  const vorschlaege = (Array.isArray(r.data.vorschlaege) ? r.data.vorschlaege : []).slice(0, 5)
    // Nur Tage, die wir dem Modell auch angeboten haben. Letzte Verteidigung
    // davor, dass ein halluziniertes/vergangenes Datum in den echten Kalender
    // geschrieben wird.
    .filter(v => v.title && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && allowedDates.has(v.date))
    .map(v => ({ ...v, calendar: allowed.has(v.calendar) ? v.calendar : 'Privat Kevin', startMin: v.startMin ?? 0, durationMin: Math.max(15, Math.min(240, v.durationMin || 60)) }));

  // AUTONOMIE WIRKT: Auf „autonom" trägt der Agent die Blöcke direkt in den
  // echten Kalender ein (Standard bleibt „freigabe" = Knöpfe). Kevin stellt
  // das bewusst unter /os/agenten um — genau dafür ist der Regler da.
  let eingetragen = false;
  if (agent.autonomy === 'autonom' && vorschlaege.length) {
    try {
      const origin = innenAdresse(req);
      const res = await fetch(`${origin}/api/apple-calendar/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' },
        body: JSON.stringify({ events: vorschlaege }),
        signal: AbortSignal.timeout(60_000),
      });
      eingetragen = (await res.json()).ok === true;
    } catch { /* dann bleiben es Vorschläge mit Knöpfen */ }
  }

  return NextResponse.json({ briefing: r.data.briefing ?? '', conflicts, vorschlaege, eingetragen });
}
