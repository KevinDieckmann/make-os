// ─── MAKE OS — Arbeitsplatz ─────────────────────────────────────────────────
// Kevins Ansage: „Oben einen Wechsel für Malin und für Kevin, sodass jeder in
// seinem eigenen Workspace arbeiten kann." Und: „Einen privaten Modus und
// einen Businessmodus — das müssen wir ganz bewusst umstellen. Bei Privat ist
// nur noch ein Bereich sichtbar: Gesundheit, Fokus, Planung. Kein Business."
//
// Der Arbeitsplatz ist der Schalter davor: WER arbeitet und in WELCHEM Leben.
// Wenn die Software später auf dem Server läuft, hängt daran die Trennung —
// bis dahin trennt sie die Sicht.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Person = string;
export type Modus = 'privat' | 'business' | 'alles';

interface Datei { person: Person; modus: Modus; gewechselt: string }

const LEER: Datei = { person: 'kevin', modus: 'alles', gewechselt: '' };

function sauber(d: Partial<Datei> | null): Datei {
  return {
    person: d?.person === 'malin' ? 'malin' : 'kevin',
    modus: d?.modus === 'privat' ? 'privat' : d?.modus === 'business' ? 'business' : 'alles',
    gewechselt: typeof d?.gewechselt === 'string' ? d.gewechselt : '',
  };
}

export async function GET() {
  return NextResponse.json(sauber(await loadJson<Datei>('arbeitsplatz')));
}

export async function PUT(req: Request) {
  let body: Partial<Datei>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const next = await updateJson<Datei>('arbeitsplatz', current => ({
    ...sauber({ ...sauber(current ?? LEER), ...body }),
    gewechselt: new Date().toISOString(),
  }));
  return NextResponse.json({ ok: true, ...next });
}
