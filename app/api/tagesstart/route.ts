// ─── MAKE OS — Tagesstart ───────────────────────────────────────────────────
// Einmal pro Tag, beim ersten Öffnen: alles frisch holen und den Morgen-Loop
// laufen lassen. Kevin soll morgens nichts anklicken müssen — er macht auf und
// weiß, wo er steht.
//
// GET  → Status: lief heute schon ein Tagesstart? Was fehlt noch?
// POST → führt ihn aus (Kalender auffrischen + Morgen-Loop) und merkt sich das.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { recentRuns } from '@/lib/agent-log';
import { resolveVitals, localDay } from '@/lib/vitals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StartLog { lastRun?: string }

/** Was ist heute schon passiert und was fehlt? */
async function status(today: string) {
  const start = (await loadJson<StartLog>('tagesstart')) ?? {};
  const vitals = await resolveVitals(today);
  const cal = await loadJson<{ at?: string }>('calendar-cache');
  const calAgeH = cal?.at ? (Date.now() - new Date(cal.at).getTime()) / 3_600_000 : null;
  const loops = await recentRuns('loop-morgen', 5);
  const loopHeute = loops.some(e => e.ts.slice(0, 10) === today);

  return {
    today,
    gelaufen: start.lastRun === today,
    loopHeute,
    vitalsHeute: vitals.heute,
    vitalsStand: vitals.stand,
    kalenderAlterStd: calAgeH == null ? null : Math.round(calAgeH),
    // Was Kevin noch selbst tun muss, damit die Zahlen von heute stimmen.
    offen: [
      !vitals.heute ? 'Morgen-Check: Whoop-Werte eintragen (/os/gesundheit)' : null,
      calAgeH == null || calAgeH > 12 ? 'Kalender auffrischen (/os/kalender öffnen)' : null,
    ].filter(Boolean) as string[],
  };
}

export async function GET() {
  return NextResponse.json(await status(localDay()));
}

export async function POST(req: Request) {
  let body: { force?: boolean } = {};
  try { body = await req.json(); } catch { /* Aufruf ohne Body ist ok */ }
  const today = localDay();
  const st = await status(today);

  // Schon gelaufen und kein ausdrücklicher Neustart → nichts doppelt tun.
  if (st.gelaufen && !body.force) {
    const letzte = (await recentRuns('loop-morgen', 1))[0];
    return NextResponse.json({ ...st, uebersprungen: true, loop: letzte?.payload ?? null });
  }

  const origin = new URL(req.url).origin;
  const schritte: { name: string; ok: boolean; info?: string }[] = [];

  // 1) Kalender auffrischen — nur wenn er wirklich alt ist. Der osascript-Read
  //    ist zäh (bis ~55s), das muss nicht jeden Morgen sein.
  if (st.kalenderAlterStd == null || st.kalenderAlterStd > 12) {
    try {
      const r = await fetch(`${origin}/api/apple-calendar?refresh=1`, { headers: { 'x-make-key': process.env.MAKE_OS_KEY ?? '' }, signal: AbortSignal.timeout(75_000) });
      const d = await r.json();
      schritte.push({ name: 'Kalender', ok: Array.isArray(d), info: Array.isArray(d) ? `${d.length} Termine` : 'Zugriff fehlt' });
    } catch {
      schritte.push({ name: 'Kalender', ok: false, info: 'zu langsam — letzter Stand bleibt' });
    }
  } else {
    schritte.push({ name: 'Kalender', ok: true, info: `Stand ${st.kalenderAlterStd} Std. — frisch genug` });
  }

  // 2) Die volle Kette: Postfächer → Termine → Aufgaben → Lage → Wächter →
  //    Ausrichtung. Ersetzt den einzelnen Morgen-Loop — der Tagesstart IST
  //    jetzt der Einstieg in den Tageslauf.
  let loop: unknown = null;
  try {
    const r = await fetch(`${origin}/api/tageslauf`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' },
      body: JSON.stringify({ art: 'voll' }),
      signal: AbortSignal.timeout(240_000),
    });
    const d = await r.json();
    const lauf = d.lauf as { ausrichtung?: Record<string, unknown>; alarm?: string; schritte?: { name: string; stand: string; kurz: string }[] } | undefined;
    loop = lauf?.ausrichtung ? { ...lauf.ausrichtung, alarm: lauf.alarm } : null;
    schritte.push({ name: 'Tageslauf (volle Kette)', ok: !!lauf?.ausrichtung, info: lauf?.schritte?.map(x => x.name).join(' → ') });
  } catch (err) {
    schritte.push({ name: 'Tageslauf', ok: false, info: err instanceof Error ? err.message : 'Fehler' });
  }

  // 3) Performance-Schnappschuss — nur so entsteht ein Verlauf.
  try {
    await fetch(`${origin}/api/performance`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY ?? '' }, body: '{}', signal: AbortSignal.timeout(20_000) });
    schritte.push({ name: 'Index', ok: true });
  } catch {
    schritte.push({ name: 'Index', ok: false });
  }

  await updateJson<StartLog>('tagesstart', () => ({ lastRun: today }));

  return NextResponse.json({ ...(await status(today)), schritte, loop });
}
