// ─── MAKE OS — Kompass-Zustand ──────────────────────────────────────────────
// Die Lage, in der das System läuft, plus die Regler, die davon abweichen.
// Bewusst schlank: Modi liegen im Code, hier steht nur, was Kevin & Malin
// davon abweichend eingestellt haben.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { imHaushaltDesInhabers, imHaushaltOderSystemlauf } from '@/lib/zugang/haushalt-inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface KompassFile {
  modus: string;
  eigene: Record<string, number>;
  /** Wann zuletzt die Lage gewechselt wurde — für den Verlauf. */
  seit?: string;
}

const MODI = new Set(['aufbau', 'ernte', 'schutz', 'feuer']);
const REGLER = new Set([
  'fokus-health', 'fokus-business', 'fokus-planning', 'fokus-finance', 'fokus-social', 'fokus-schwelle',
  'tageslast', 'kritisch-grenze', 'vorschau-tage', 'wochenlast',
  'tuersteher', 'triage-tiefe',
  'agenten-leine', 'auto-takt', 'nachtruhe-ab', 'tagesstart-auto',
  'schutzzeit', 'recovery-gruen', 'runway-warnung',
  // 'koerper-an-agenten' entfällt seit 05.10. — ersetzt durch die Art.-9-Einwilligung (b) je Person (System › Datenschutz).
]);

// Der Kompass stellt das System des Haushalts ein (05.10., DSGVO-Prüfung): lesen nur im Haushalt des Inhabers bzw. der
// Systemlauf ohne Person, ändern nur eine Person dieses Haushalts — ein Konto aus einem anderen Haushalt → 403.
const GESPERRT = () => NextResponse.json({ ok: false, error: 'Nur im Haushalt des Inhabers.' }, { status: 403 });

export async function GET(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return GESPERRT();
  const f = await loadJson<KompassFile>('kompass');
  return NextResponse.json({
    modus: f?.modus && MODI.has(f.modus) ? f.modus : 'aufbau',
    // Nur bekannte Regler — ein alter Wert „koerper-an-agenten“ bleibt im Bestand liegen, wirkt aber nirgends mehr.
    eigene: f?.eigene && typeof f.eigene === 'object' ? Object.fromEntries(Object.entries(f.eigene).filter(([k]) => REGLER.has(k))) : {},
    seit: f?.seit ?? null,
  });
}

export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return GESPERRT();
  let body: Partial<KompassFile> & { zuruecksetzen?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  const next = await updateJson<KompassFile>('kompass', current => {
    const modusNeu = body.modus && MODI.has(body.modus) ? body.modus : (current?.modus ?? 'aufbau');
    // Lagewechsel oder Zurücksetzen räumt die eigenen Werte weg — sonst wäre
    // die neue Lage nicht wirklich neu.
    const wechsel = !!body.modus && body.modus !== current?.modus;
    const eigene: Record<string, number> = wechsel || body.zuruecksetzen ? {} : { ...(current?.eigene ?? {}) };

    if (body.eigene && typeof body.eigene === 'object' && !body.zuruecksetzen) {
      for (const [k, v] of Object.entries(body.eigene)) {
        if (!REGLER.has(k)) continue;
        if (v === null) { delete eigene[k]; continue; }
        const n = Number(v);
        if (Number.isFinite(n)) eigene[k] = Math.round(n);
      }
    }

    return {
      modus: modusNeu,
      eigene,
      seit: wechsel ? new Date().toISOString() : (current?.seit ?? new Date().toISOString()),
    };
  });

  return NextResponse.json({ ok: true, ...next });
}
