// ─── MAKE OS — ZOE belegt die Woche ──────────────────────────────────────
// POST { woche: 'YYYY-MM-DD' (Montag), hinweis? }
// ZOE plant eine komplette Wochenbelegung: Gesundheits-Routinen, Fokus
// vormittags, Routinen morgens/abends, Aufgaben nach Priorität — um die
// festen Termine HERUM. Das Ergebnis ist ein VORSCHLAG: die Person übernimmt ihn im
// Planer per Klick und schiebt dann zurecht. Nichts wird hier gespeichert.
// S1 (29.09.): nur der Haushalt des Inhabers (`imHaushaltDesInhabers`, sonst 403), geplant wird für die ausdrücklich
// benannte Person (nie der Rückfall auf „kevin“). Kein Gesundheitskontext mehr im Code — optional aus dem eigenen
// Profil der fragenden Person (lib/gesundheit/kontext.ts), nie aus dem der anderen.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey, fremd, FREMD_REGEL } from '@/lib/anthropic';
import { resolveVitals, vitalsHint } from '@/lib/vitals';
import { gesundheitAnKi } from '@/lib/datenschutz/gesundheit-einwilligung';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { nameVon } from '@/lib/zoe/raum';
import { imHaushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { eigenerGesundheitsKontext, KONTEXT_REGEL } from '@/lib/gesundheit/kontext';
import { localDay, tagePlus } from '@/lib/zeit';
import { termineFuerZoe } from '@/lib/kalender/zoe-sicht-server';
import { ausWandzeit, minutenVon } from '@/lib/kalender/zeit';
import { KALENDER_QUELLE } from '@/lib/zoe/fremd';
import { ROUTINE_ITEMS } from '@/lib/make-one/health-data';
import { SAEULE_VON_PROJEKT, SAEULE_LABEL } from '@/lib/make-one/fokus-data';
import { modellSchranke } from '@/lib/zugang/umfang';
import { neueKennung } from '@/lib/kennung';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { sichtbarFuer } from '@/lib/planung/routinen';
interface RoutineDef { label: string; wann: 'morgen' | 'tag' | 'abend'; dauerMin: number; aktiv: boolean; owner?: string }

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Block { date: string; startMin: number; dauerMin: number; titel: string; art: string; taskId?: string }
interface Task { id: string; title: string; status: string; priority: string; dueDate?: string; projectId?: string }

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const ARTEN = new Set(['fokus', 'reha', 'routine', 'pause', 'aufgabe', 'block']);
const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });
  const person = zugang.person;
  const agentCfg = await resolveAgent('planung'); if (!agentCfg.enabled) return NextResponse.json(disabledResponse(agentCfg), { status: 409 });
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let body: { woche?: string; hinweis?: string };
  try { body = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const woche = body.woche ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(woche)) return NextResponse.json({ error: 'woche=YYYY-MM-DD (Montag) nötig.' }, { status: 400 });
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });

  // Die 7 Tage der Zielwoche.
  const tage: string[] = [];
  // Kalendertage rein rechnen (F1 #14) — kein Date aus einer Wandzeit.
  for (let i = 0; i < 7; i++) tage.push(tagePlus(woche, i));
  const tagSet = new Set(tage);

  // Feste Termine (iCloud-Stand, auch die Blöcke — K5) für genau diese Woche (dedupliziert). Seit 29.09. (Paket R-Z, #K4) über denselben
  // Lesepfad wie ZOE (`termineFuerZoe`): für die Person gefiltert — private/Gesundheitstermine der anderen nur „Belegt“
  // (die Zeit blockiert weiter), fremder Haushalt bekommt keine Termine; fremde Titel gekapselt (#K1).
  const [kal, tasksState, ziele, vitals, routinenF, reglerF, eigeneAngaben] = await Promise.all([
    termineFuerZoe(person, tage[0], tagePlus(tage[6], 1)),
    ladeAufgabenSicht(person), // Sichtfilter „nur ich“ (29.09.)
    loadJson<Record<string, { titel: string; fortschritt: number; erledigt?: boolean }[]> & { fokus?: Record<string, string> }>('ziele'),
    // Art. 9 (05.10.): Vitalwerte nur mit Einwilligung (b) der Person an die KI — sonst gar nicht erst lesen.
    gesundheitAnKi(person).then(frei => (frei ? resolveVitals(undefined, person) : null)).catch(() => null),
    loadJson<{ routinen: RoutineDef[] }>('routinen'),
    loadJson<{ regler: Record<string, number> }>('fokus-regler'),
    eigenerGesundheitsKontext(person),
  ]);
  const name = nameVon(person);
  const regler = reglerF?.regler ?? {};
  const gesehen = new Set<string>();
  // KEMARIS/M365: bis zur echten Anbindung keine Termine (Beispieldaten seit 29.09., K5, raus).
  const fest: { date: string; startMin: number; dauerMin: number; titel: string; fremd?: boolean }[] = [];
  const roh = kal.termine.filter(t => !t.ganztags).map(t => ({ t: t.titel, s: t.start, e: t.ende as string | undefined, fremd: !!t.fremd }));
  for (const e of roh) {
    const date = e.s.slice(0, 10);
    if (!tagSet.has(date)) continue;
    const key = `${e.t.toLowerCase().trim()}|${e.s.slice(0, 16)}`;
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    // F1 #14: Berliner Wandzeit — nie über new Date(wandzeit) (hinge an der Zone des Servers); Dauer über den echten
    // Zeitpunkt (`ausWandzeit`, richtig auch an der Zeitumstellung).
    const dauerMin = e.e ? Math.max(15, Math.round((ausWandzeit(e.e).getTime() - ausWandzeit(e.s).getTime()) / 60000)) : 60;
    fest.push({ date, startMin: minutenVon(e.s), dauerMin, titel: e.t, ...(e.fremd ? { fremd: true } : {}) });
  }

  const offen = (tasksState?.tasks ?? []).filter(t => t.status !== 'done');
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  // Fokus-Regler lenkt die Reihenfolge mit — Priorität schlägt ihn aber immer.
  const boost = (t: Task) => regler[SAEULE_VON_PROJEKT[t.projectId ?? ''] ?? ''] ?? 50;
  offen.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || boost(b) - boost(a) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  // Routinen aus dem Planer (Fallback: alte Konstante) — nur aktive.
  // Nur eigene und gemeinsame Routinen dieser Person (`sichtbarFuer`, Praxis-Fund 04.10.).
  const rAlle: RoutineDef[] = sichtbarFuer<RoutineDef>((routinenF?.routinen ?? ROUTINE_ITEMS.map((r): RoutineDef => ({ label: r.label, wann: r.when === 'abend' ? 'abend' : 'morgen', dauerMin: 15, aktiv: true }))).filter(r => r.aktiv), person);
  const rMorgen = rAlle.filter(r => r.wann === 'morgen').map(r => r.label);
  const rTag = rAlle.filter(r => r.wann === 'tag');
  const rAbend = rAlle.filter(r => r.wann === 'abend').map(r => r.label);

  const monatsZiele = (ziele?.monat ?? []).filter(z => !z.erledigt);
  const quartalsZiele = (ziele?.quartal ?? []).filter(z => !z.erledigt);

  const system = [
    FREMD_REGEL,
    '„Belegt“ bei einem festen Termin ist ein privater Termin der anderen Person: die Zeit ist blockiert, sonst nichts.',
    `Du bist ZOE und belegst die Woche von ${name} im Wochenplaner — ein VORSCHLAG, der danach frei zurechtgeschoben wird.`,
    KONTEXT_REGEL,
    'HARTE REGELN:',
    '- Plane NIE über feste Termine (Liste unten). Zeitfenster 06:00–22:00, Raster 15 Minuten.',
    '- Gesundheits-Routinen aus der Routinen-Liste (z. B. Reha, Mobilität) plane als eigene reha-Blöcke ein, wenn es welche gibt — sonst nicht.',
    '- Fokus-Blöcke (90 Min) vormittags, wo frei — dort die wichtigsten Aufgaben als eigene aufgabe-Blöcke (mit taskId!) einplanen, kritische zuerst, Fälligkeiten beachten.',
    '- Morgens ~07:15 Routine-Block „Morgenroutine" (~30 Min), abends ~21:00 „Abendroutine" (~30 Min).',
    '- Pausen (15 Min) zwischen langen Blöcken. Nach 2 Stunden Sitzen: Bewegung.',
    '- Wochenende deutlich leichter: keine Arbeits-Fokusblöcke am Sonntag, Samstag maximal einer.',
    '- Max 8 Blöcke pro Tag. Weniger ist besser als vollgestopft — Ruhe, nicht Takt um des Takts willen.',
    '- Wenn die Recovery niedrig ist, plane spürbar weniger.',
    'arten: fokus | reha | routine | pause | aufgabe | block.',
    'Antworte NUR als JSON: {"begruendung":"<2-3 Sätze: wie du die Woche gedacht hast>","bloecke":[{"date":"YYYY-MM-DD","startMin":435,"dauerMin":90,"titel":"…","art":"fokus","taskId":"nur bei art=aufgabe"}]}',
  ].join('\n');

  const user = [
    `Woche: ${tage[0]} bis ${tage[6]}. Heute ist ${localDay()}.`,
    vitals ? `Recovery ${vitals.rec}%, Schlaf ${vitals.sleep}h${vitalsHint(vitals)}.` : 'Keine Gesundheitswerte (keine Einwilligung) — plane mit mittlerer Last.',
    eigeneAngaben,
    '',
    `FESTE TERMINE (unverrückbar):`,
    // Fremde Titel (Einladung, Abo, Buchungsseite) als Daten gekapselt — nie Anweisung (#K1).
    fest.length ? fest.map(f => `- ${WD[tage.indexOf(f.date)]} ${f.date} ${mm(f.startMin)}–${mm(f.startMin + f.dauerMin)}: ${f.fremd ? fremd(KALENDER_QUELLE, f.titel) : f.titel}`).join('\n') : '(keine)',
    '',
    ziele?.fokus?.woche ? `FOKUS DER WOCHE (dagegen planst du zuerst): ${ziele.fokus.woche}` : '',
    ziele?.fokus?.monat ? `FOKUS DES MONATS: ${ziele.fokus.monat}` : '',
    Object.keys(regler).length
      ? `FOKUS-REGLER (im Haushalt eingestellt, 0–100 — Bereiche mit hohem Wert bekommen MEHR Blöcke/bessere Slots, niedrige treten zurück; kritische Aufgaben schlagen den Regler immer): ${Object.entries(regler).map(([k, v]) => `${SAEULE_LABEL[k] ?? k} ${v}`).join(' · ')}`
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
    body.hinweis ? `\nHinweis von ${name}: ${body.hinweis}` : '',
  ].filter(Boolean).join('\n');

  const r = await askJson<{ begruendung?: string; bloecke?: Block[] }>({ zweck: 'planung-vorschlag', system, user, maxTokens: 6000, timeoutMs: 150_000,
    ki: kiAus(req, vitals || eigeneAngaben ? ['kalender', 'aufgaben', 'gesundheit'] : ['kalender', 'aufgaben']) });
  if (!r.ok || !r.data) return NextResponse.json({ error: r.error ?? 'Kein Vorschlag.' }, { status: 200 });

  // Server-seitige Härtung: Raster, Grenzen, gültige Tage/Arten/taskIds — und
  // NICHTS darf feste Termine überlappen (harte Prüfung, nicht nur Prompt).
  const offenIds = new Set(offen.map(t => t.id));
  let verworfen = 0;
  const bloecke = (Array.isArray(r.data.bloecke) ? r.data.bloecke : [])
    .map(b => ({
      id: neueKennung('pb'),
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
