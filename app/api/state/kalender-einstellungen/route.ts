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
import { EINSTELLUNGEN_LEER, einstellungenSauber, type KalenderEinstellungen } from '@/lib/kalender/einstellungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Datei = KalenderEinstellungen;
const LEER = EINSTELLUNGEN_LEER;
const sauber = einstellungenSauber;

export async function GET() {
  return NextResponse.json(sauber(await loadJson<Datei>('kalender-einstellungen')));
}

export async function PUT(req: Request) {
  let body: Partial<Datei> & { teil?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // F2 N7: `{ teil }` = nur die geänderten Felder, gelegt auf den aktuellen Stand (in der Schreibsperre). Ohne `teil` wie bisher.
  const teil = body.teil && typeof body.teil === 'object' && !Array.isArray(body.teil) ? body.teil as Partial<Datei> : null;
  const next = await updateJson<Datei>('kalender-einstellungen', current => sauber({ ...sauber(current ?? LEER), ...(teil ?? body) }));
  return NextResponse.json({ ok: true, ...next });
}
