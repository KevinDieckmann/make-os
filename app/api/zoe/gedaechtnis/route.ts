// ─── MAKE OS — ZOE' Gedächtnis (Route) ───────────────────────────────────
// GET zeigt, was er sich gemerkt hat. DELETE wirft einen Fakt raus.
// Bedingung: sofort merken, dafür sichtbar und jederzeit löschbar.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { lies, vergiss, type FaktArt } from '@/lib/zoe/gedaechtnis';
import { personAus } from '@/lib/zoe/raum';
import { bereichAus } from '@/lib/zoe/bereich';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const p = new URL(req.url).searchParams;
  // Sicht Privat/Business (09.10. spät): `?space=privat|business` → nur Merksätze dieses Bereichs und die neutralen; ohne bzw. `alles` → alle.
  const space = p.get('space');
  if (space && space !== 'alles' && !bereichAus(space)) return NextResponse.json({ ok: false, error: 'space ist privat, business oder alles.' }, { status: 400 });
  // Nach Raum gefiltert: die Liste zeigt nur den eigenen und den gemeinsamen
  // Bestand. Ohne das sähe eine Person in der Oberfläche, was eine andere ZOE
  // erzählt hat — obwohl ZOE es ihr im Gespräch korrekt verschweigt.
  const fakten = await lies({
    thema: p.get('thema') ?? undefined,
    art: (p.get('art') as FaktArt) ?? undefined,
    raum: personAus(req),
    anzahl: Math.max(1, Math.min(500, Number(p.get('anzahl')) || 200)),
    bereich: bereichAus(space),
  });
  return NextResponse.json({ ok: true, fakten });
}

export async function DELETE(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ ok: false, error: 'Keine id.' }, { status: 400 });
  // Nur Fakten des eigenen oder gemeinsamen Raums (26.09.).
  const eigene = await lies({ raum: personAus(req), anzahl: 500 });
  if (!eigene.some(f => f.id === id)) return NextResponse.json({ ok: false, error: 'Nicht gefunden.' });
  const weg = await vergiss(id);
  return NextResponse.json({ ok: weg, ...(weg ? {} : { error: 'Nicht gefunden.' }) });
}
