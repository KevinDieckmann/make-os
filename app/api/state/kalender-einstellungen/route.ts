// ─── MAKE OS — Kalender-Einstellungen ───────────────────────────────────────
// Kevins Ansage: „Man soll sich jeweils die andere Sicht angucken können, also
// Malin oder Kevin. Und man soll selber Termine einstellen können — mit
// Routine und Fokus und Termin und Aufgabe. Bau auch sofort die Einstellungen
// dahinter."
//
// Hier steht, welcher Apple-Kalender zu wem gehört und wie lange die Arten
// standardmäßig dauern. Ohne diese Zuordnung landet jeder Termin im selben
// Kalender — dann sieht niemand, wem er gehört.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Datei {
  /** Welcher Apple-Kalender gehört wem. Namen wie in der Kalender-App. */
  kalender: { kevin: string; malin: string; beide: string };
  /** Standarddauer je Art in Minuten. */
  dauer: { termin: number; fokus: number; routine: number; aufgabe: number; reha: number };
  /** Arbeitsfenster — außerhalb schlägt das System nichts vor. */
  vonStunde: number;
  bisStunde: number;
  /** Welche Sicht beim Öffnen steht. */
  standardSicht: 'alle' | string | 'beide';
}

const LEER: Datei = {
  kalender: { kevin: 'Privat Kevin', malin: 'Malin', beide: 'Kalender' },
  dauer: { termin: 60, fokus: 90, routine: 30, aufgabe: 45, reha: 30 },
  vonStunde: 7,
  bisStunde: 20,
  standardSicht: 'alle',
};

const zahl = (v: unknown, min: number, max: number, sonst: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : sonst;
};
const text = (v: unknown, sonst: string) => String(v ?? '').trim().slice(0, 60) || sonst;

function sauber(d: Partial<Datei> | null): Datei {
  const sicht = ['alle', 'kevin', 'malin', 'beide'].includes(String(d?.standardSicht))
    ? d!.standardSicht! : LEER.standardSicht;
  return {
    kalender: {
      kevin: text(d?.kalender?.kevin, LEER.kalender.kevin),
      malin: text(d?.kalender?.malin, LEER.kalender.malin),
      beide: text(d?.kalender?.beide, LEER.kalender.beide),
    },
    dauer: {
      termin: zahl(d?.dauer?.termin, 5, 600, LEER.dauer.termin),
      fokus: zahl(d?.dauer?.fokus, 5, 600, LEER.dauer.fokus),
      routine: zahl(d?.dauer?.routine, 5, 600, LEER.dauer.routine),
      aufgabe: zahl(d?.dauer?.aufgabe, 5, 600, LEER.dauer.aufgabe),
      reha: zahl(d?.dauer?.reha, 5, 600, LEER.dauer.reha),
    },
    vonStunde: zahl(d?.vonStunde, 0, 23, LEER.vonStunde),
    bisStunde: zahl(d?.bisStunde, 1, 24, LEER.bisStunde),
    standardSicht: sicht,
  };
}

export async function GET() {
  return NextResponse.json(sauber(await loadJson<Datei>('kalender-einstellungen')));
}

export async function PUT(req: Request) {
  let body: Partial<Datei>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const next = await updateJson<Datei>('kalender-einstellungen', current => sauber({ ...sauber(current ?? LEER), ...body }));
  return NextResponse.json({ ok: true, ...next });
}
