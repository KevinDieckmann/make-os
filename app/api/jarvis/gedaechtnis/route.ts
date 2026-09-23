// ─── MAKE OS — Jarvis' Gedächtnis (Route) ───────────────────────────────────
// GET zeigt, was er sich gemerkt hat. DELETE wirft einen Fakt raus.
// Kevins Bedingung: sofort merken, dafür sichtbar und jederzeit löschbar.

import { NextResponse } from 'next/server';
import { lies, vergiss, type FaktArt } from '@/lib/jarvis/gedaechtnis';
import { personAus } from '@/lib/jarvis/raum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  // Nach Raum gefiltert: die Liste zeigt nur den eigenen und den gemeinsamen
  // Bestand. Ohne das sähe Kevin in der Oberfläche, was Malin Jarvis erzählt
  // hat — obwohl Jarvis es ihm im Gespräch korrekt verschweigt.
  const fakten = await lies({
    thema: p.get('thema') ?? undefined,
    art: (p.get('art') as FaktArt) ?? undefined,
    raum: personAus(req),
    anzahl: Math.max(1, Math.min(500, Number(p.get('anzahl')) || 200)),
  });
  return NextResponse.json({ ok: true, fakten });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ ok: false, error: 'Keine id.' }, { status: 400 });
  const weg = await vergiss(id);
  return NextResponse.json({ ok: weg, ...(weg ? {} : { error: 'Nicht gefunden.' }) });
}
