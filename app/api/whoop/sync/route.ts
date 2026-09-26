// ─── MAKE OS — Whoop-Sync ───────────────────────────────────────────────────
// POST → holt die letzte Recovery + den letzten Schlaf von der Whoop-API und
// schreibt sie als heutige Vitalwerte (vitals-Store) — der Morgen-Check füllt
// sich selbst. Läuft erst, wenn Whoop unter /os/verbindungen verbunden ist;
// bis dahin antwortet die Route ehrlich, was fehlt.

import { NextResponse } from 'next/server';
import { gueltigesToken, PROVIDER, konfiguriert } from '@/lib/oauth';
import { updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API = 'https://api.prod.whoop.com/developer/v1';

export async function POST(req: Request) {
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, error: 'Nur für den Inhaber.' }, { status: 403 });
  if (!konfiguriert(PROVIDER.whoop)) {
    return NextResponse.json({ error: 'Whoop ist nicht konfiguriert — Client-ID/Secret in .env.local, dann /os/verbindungen.' }, { status: 200 });
  }
  const token = await gueltigesToken('whoop');
  if (!token) return NextResponse.json({ error: 'Whoop ist nicht verbunden — unter /os/verbindungen einmal „Verbinden" klicken.' }, { status: 200 });

  const hole = async (pfad: string) => {
    const r = await fetch(`${API}${pfad}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Whoop ${pfad}: ${r.status}`);
    return r.json();
  };

  try {
    const [rec, schlaf] = await Promise.all([
      hole('/recovery?limit=1'),
      hole('/activity/sleep?limit=1'),
    ]);
    const r0 = rec?.records?.[0]?.score ?? {};
    const s0 = schlaf?.records?.[0] ?? {};
    const schlafMs = s0?.score?.stage_summary
      ? ['total_light_sleep_time_milli', 'total_slow_wave_sleep_time_milli', 'total_rem_sleep_time_milli']
          .reduce((sum, k) => sum + (Number(s0.score.stage_summary[k]) || 0), 0)
      : 0;

    const vitals: Record<string, number> = {};
    if (isFinite(Number(r0.recovery_score))) vitals.rec = Math.round(Number(r0.recovery_score));
    if (isFinite(Number(r0.hrv_rmssd_milli))) vitals.hrv = Math.round(Number(r0.hrv_rmssd_milli));
    if (isFinite(Number(r0.resting_heart_rate))) vitals.rhr = Math.round(Number(r0.resting_heart_rate));
    if (schlafMs > 0) vitals.sleep = Math.round((schlafMs / 3_600_000) * 10) / 10;
    if (!Object.keys(vitals).length) return NextResponse.json({ error: 'Whoop hat keine verwertbaren Werte geliefert.' }, { status: 200 });

    const heute = localDay();
    // In den Bestand der anfragenden Person — nicht immer in Kevins (26.09.).
    const { personAus, speicherFuer } = await import('@/lib/jarvis/raum');
    await updateJson<Record<string, Record<string, unknown>>>(speicherFuer('vitals', personAus(req)), current => {
      const log = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
      return { ...log, [heute]: { ...(log[heute] ?? {}), ...vitals, note: String((log[heute] as { note?: string } | undefined)?.note ?? '') || undefined } };
    });
    return NextResponse.json({ ok: true, heute, vitals });
  } catch (err) {
    return NextResponse.json({ error: `Whoop-Abruf fehlgeschlagen: ${err instanceof Error ? err.message.slice(0, 120) : 'Fehler'}` }, { status: 200 });
  }
}
