// ─── MAKE OS — Arbeitsplatz ─────────────────────────────────────────────────
// Kevins Ansage: „Oben einen Wechsel für Malin und für Kevin, sodass jeder in
// seinem eigenen Workspace arbeiten kann." Und: „Einen privaten Modus und
// einen Businessmodus — das müssen wir ganz bewusst umstellen. Bei Privat ist
// nur noch ein Bereich sichtbar: Gesundheit, Fokus, Planung. Kein Business."
//
// Der Arbeitsplatz ist der Schalter davor: WER arbeitet und in WELCHEM Leben.
// Wenn die Software später auf dem Server läuft, hängt daran die Trennung —
// bis dahin trennt sie die Sicht.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Person = string;
export type Modus = 'privat' | 'business' | 'alles';

interface Datei { person: Person; modus: Modus; gewechselt: string }

// Ohne Eintrag keine Person (30.10., neutral — vorher eine feste): die Wahl gehört der Instanz, nicht dem Code.
const LEER: Datei = { person: '', modus: 'alles', gewechselt: '' };

function sauber(d: Partial<Datei> | null): Datei {
  return {
    // Ein Speichername (Konto) — vorher nur zwei feste. Gespeicherte Werte lesen sich bit-gleich.
    person: typeof d?.person === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(d.person) ? d.person : '',
    modus: d?.modus === 'privat' ? 'privat' : d?.modus === 'business' ? 'business' : 'alles',
    gewechselt: typeof d?.gewechselt === 'string' ? d.gewechselt : '',
  };
}

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  return NextResponse.json(sauber(await loadJson<Datei>('arbeitsplatz')));
}

export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  let body: Partial<Datei>;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const next = await updateJson<Datei>('arbeitsplatz', current => ({
    ...sauber({ ...sauber(current ?? LEER), ...body }),
    gewechselt: new Date().toISOString(),
  }));
  return NextResponse.json({ ok: true, ...next });
}
