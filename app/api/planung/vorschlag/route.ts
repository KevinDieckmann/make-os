// ─── MAKE OS — Jarvis belegt die Woche ──────────────────────────────────────
// POST { woche: 'YYYY-MM-DD' (Montag), hinweis? }
// Jarvis plant eine komplette Wochenbelegung: Reha täglich (Bandscheibe!),
// Fokus vormittags, Routinen morgens/abends, Aufgaben nach Priorität — um die
// festen Termine HERUM. Das Ergebnis ist ein VORSCHLAG: Kevin übernimmt ihn im
// Planer per Klick und schiebt dann zurecht. Nichts wird hier gespeichert.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveVitals, vitalsHint } from '@/lib/vitals';
import { localDay } from '@/lib/zeit';
import { ROUTINE_ITEMS } from '@/lib/make-one/health-data';
import { SAEULE_VON_PROJEKT, SAEULE_LABEL } from '@/lib/make-one/fokus-data';
interface RoutineDef { label: string; wann: 'morgen' | 'tag' | 'abend'; dauerMin: number; aktiv: boolean }

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Block { date: string; startMin: number; dauerMin: number; titel: string; art: string; taskId?: string }
interface CalEvent { title?: string; startDate?: string; endDate?: string; allDay?: boolean }
interface KemEvent { title?: string; start?: string; end?: string }
interface Task { id: string; title: string; status: string; priority: string; dueDate?: string; projectId?: string }

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const ARTEN = new Set(['fokus', 'reha', 'routine', 'pause', 'aufgabe', 'block']);
const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export async function POST(req: Request) {
  let body: { woche?: string; hinweis?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const woche = body.woche ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(woche)) return NextResponse.json({ error: 'woche=YYYY-MM-DD (Montag) nötig.' }, { status: 400 });
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });

  // Die 7 Tage der Zielwoche.
  const tage: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${woche}T12:00:00`); d.setDate(d.getDate() + i);
    tage.push(localDay(d));
  }
  const tagSet = new Set(tage);

  // Feste Termine beider Kalender für genau diese Woche (dedupliziert).
  const [cal, kem, tasksState, ziele, vitals, routinenF, reglerF] = await Promise.all([
    loadJson<{ events: CalEvent[] }>('calendar-cache'),
    loadJson<{ events: KemEvent[] }>('kemaris-calendar'),
    loadJson<{ tasks: Task[] }>('tasks'),
    loadJson<Record<string, { titel: string; fortschritt: number; erledigt?: boolean }[]> & { fokus?: Record<string, string> }>('ziele'),
    resolveVitals(),
    loadJson<{ routinen: RoutineDef[] }>('routinen'),
    loadJson<{ regler: Record<string, number> }>('fokus-regler'),
  ]);
  const regler = reglerF?.regler ?? {};
  const gesehen = new Set<string>();
  const fest: { date: string; startMin: number; dauerMin: number; titel: string }[] = [];
  const roh = [
    ...(cal?.events ?? []).filter(e => !e.allDay && e.startDate).map(e => ({ t: e.title ?? '', s: e.startDate!, e: e.endDate })),
    ...(kem?.events ?? []).filter(e => e.start).map(e => ({ t: e.title ?? '', s: e.start!, e: e.end })),
  ];
  for (const e of roh) {
    const date = e.s.slice(0, 10);
    if (!tagSet.has(date)) continue;
    const key = `${e.t.toLowerCase().trim()}|${e.s.slice(0, 16)}`;
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    const s = new Date(e.s), en = e.e ? new Date(e.e) : null;
    fest.push({ date, startMin: s.getHours() * 60 + s.getMinutes(), dauerMin: en ? Math.max(15, Math.round((en.getTime() - s.getTime()) / 60000)) : 60, titel: e.t });
  }

  const offen = (tasksState?.tasks ?? []).filter(t => t.status !== 'done');
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  // Fokus-Regler lenkt die Reihenfolge mit — Priorität schlägt ihn aber immer.
  const boost = (t: Task) => regler[SAEULE_VON_PROJEKT[t.projectId ?? ''] ?? ''] ?? 50;
  offen.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || boost(b) - boost(a) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  // Routinen aus dem Planer (Fallback: alte Konstante) — nur aktive.
  const rAlle: RoutineDef[] = (routinenF?.routinen ?? ROUTINE_ITEMS.map(r => ({ label: r.label, wann: (r.when === 'abend' ? 'abend' : 'morgen') as RoutineDef['wann'], dauerMin: 15, aktiv: true }))).filter(r => r.aktiv);
  const rMorgen = rAlle.filter(r => r.wann === 'morgen').map(r => r.label);
  const rTag = rAlle.filter(r => r.wann === 'tag');
  const rAbend = rAlle.filter(r => r.wann === 'abend').map(r => r.label);

  const monatsZiele = (ziele?.monat ?? []).filter(z => !z.erledigt);
  const quartalsZiele = (ziele?.quartal ?? []).filter(z => !z.erledigt);

  const system = [
    'Du bist JARVIS und belegst Kevins Woche im Wochenplaner — ein VORSCHLAG, den er danach frei zurechtschiebt.',
    'HARTE REGELN:',
    '- Plane NIE über feste Termine (Liste unten). Zeitfenster 06:00–22:00, Raster 15 Minuten.',
    '- REHA TÄGLICH mindestens 30 Min (Bandscheibenvorfall — nicht verhandelbar). Nach der Reha nichts Schweres.',
    '- Fokus-Blöcke (90 Min) vormittags, wo frei — dort die wichtigsten Aufgaben als eigene aufgabe-Blöcke (mit taskId!) einplanen, kritische zuerst, Fälligkeiten beachten.',
    '- Morgens ~07:15 Routine-Block „Morgenroutine" (~30 Min), abends ~21:00 „Abendroutine" (~30 Min).',
    '- Pausen (15 Min) zwischen langen Blöcken. Nach 2 Stunden Sitzen: Bewegung.',
    '- Wochenende deutlich leichter: keine Arbeits-Fokusblöcke am Sonntag, Samstag maximal einer.',
    '- Max 8 Blöcke pro Tag. Weniger ist besser als vollgestopft — Kevin will Ruhe, nicht Takt um des Takts willen.',
    '- Wenn die Recovery niedrig ist, plane spürbar weniger.',
    'arten: fokus | reha | routine | pause | aufgabe | block.',
    'Antworte NUR als JSON: {"begruendung":"<2-3 Sätze: wie du die Woche gedacht hast>","bloecke":[{"date":"YYYY-MM-DD","startMin":435,"dauerMin":90,"titel":"…","art":"fokus","taskId":"nur bei art=aufgabe"}]}',
  ].join('\n');

  const user = [
    `Woche: ${tage[0]} bis ${tage[6]}. Heute ist ${localDay()}.`,
    `Recovery ${vitals.rec}%, Schlaf ${vitals.sleep}h${vitalsHint(vitals)}.`,
    '',
    `FESTE TERMINE (unverrückbar):`,
    fest.length ? fest.map(f => `- ${WD[tage.indexOf(f.date)]} ${f.date} ${mm(f.startMin)}–${mm(f.startMin + f.dauerMin)}: ${f.titel}`).join('\n') : '(keine)',
    '',
    ziele?.fokus?.woche ? `FOKUS DER WOCHE (dagegen planst du zuerst): ${ziele.fokus.woche}` : '',
    ziele?.fokus?.monat ? `FOKUS DES MONATS: ${ziele.fokus.monat}` : '',
    Object.keys(regler).length
      ? `FOKUS-REGLER (von Kevin selbst eingestellt, 0–100 — Bereiche mit hohem Wert bekommen MEHR Blöcke/bessere Slots, niedrige treten zurück; kritische Aufgaben schlagen den Regler immer): ${Object.entries(regler).map(([k, v]) => `${SAEULE_LABEL[k] ?? k} ${v}`).join(' · ')}`
      : '',
    `MONATSZIELE: ${monatsZiele.map(z => `${z.titel} (${z.fortschritt}%)`).join(' · ') || '(keine gepflegt)'}`,
    `QUARTALSZIELE: ${quartalsZiele.map(z => `${z.titel} (${z.fortschritt}%)`).join(' · ') || '(keine gepflegt)'}`,
    '',
    'OFFENE AUFGABEN (nach Priorität, mit id für taskId):',
    offen.slice(0, 14).map(t => {
      const s = SAEULE_VON_PROJEKT[t.projectId ?? ''];
      return `- [${t.id}] ${t.title} (${t.priority}${t.dueDate ? `, fällig ${t.dueDate}` : ''}${s ? `, Bereich ${SAEULE_LABEL[s]}, Regler ${regler[s] ?? 50}` : ''})`;
    }).join('\n') || '(keine)',
    '',
    `ROUTINEN (Inhalt der Routine-Blöcke): morgens ${rMorgen.join(', ') || '—'} · abends ${rAbend.join(', ') || '—'}${rTag.length ? ` · tagsüber als EIGENE kleine Blöcke einplanen: ${rTag.map(r => `${r.label} (${r.dauerMin}m)`).join(', ')}` : ''}`,
    body.hinweis ? `\nKevins Hinweis: ${body.hinweis}` : '',
  ].filter(Boolean).join('\n');

  const r = await askJson<{ begruendung?: string; bloecke?: Block[] }>({ system, user, maxTokens: 6000, timeoutMs: 150_000 });
  if (!r.ok || !r.data) return NextResponse.json({ error: r.error ?? 'Kein Vorschlag.' }, { status: 200 });

  // Server-seitige Härtung: Raster, Grenzen, gültige Tage/Arten/taskIds — und
  // NICHTS darf feste Termine überlappen (harte Prüfung, nicht nur Prompt).
  const offenIds = new Set(offen.map(t => t.id));
  let verworfen = 0;
  const bloecke = (Array.isArray(r.data.bloecke) ? r.data.bloecke : [])
    .map(b => ({
      id: `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      date: String(b.date ?? ''),
      startMin: Math.max(6 * 60, Math.min(22 * 60 - 15, Math.round(Number(b.startMin) / 15) * 15)),
      dauerMin: Math.max(15, Math.min(240, Math.round(Number(b.dauerMin) / 15) * 15 || 60)),
      titel: String(b.titel ?? '').slice(0, 120) || 'Block',
      art: ARTEN.has(String(b.art)) ? String(b.art) as Block['art'] : 'block',
      taskId: b.taskId && offenIds.has(String(b.taskId)) ? String(b.taskId) : undefined,
    }))
    .filter(b => {
      if (!tagSet.has(b.date)) { verworfen++; return false; }
      const ende = b.startMin + b.dauerMin;
      const kollidiert = fest.some(f => f.date === b.date && b.startMin < f.startMin + f.dauerMin && f.startMin < ende);
      if (kollidiert) { verworfen++; return false; }
      return true;
    })
    .slice(0, 60);

  return NextResponse.json({ begruendung: r.data.begruendung ?? '', bloecke, verworfen });
}
