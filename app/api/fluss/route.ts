// ─── MAKE OS — Überblick „Für dich“: GET /api/fluss (04.10.2026 abends) ──────
// Die Reihe eines Bereichs für die angemeldete Person: Ist (letzte 3 Monate), heute, Prognose (nur aus echten Daten), Zeilen.
//   GET ?bereich=markttraktion|finanzen-privat|finanzen-business|planung|aufgaben|kalender|gesundheit|familie|netzwerken|inbox
//       &space=privat|business (nur Planung)
//   → { ok, fluss: FlussReihe | null }
// Zugang: angemeldete Person im Haushalt des Inhabers (`imHaushaltDesInhabers`); der Dienstweg ist gesperrt (403) — die Reihe
// hängt an der Person (Privat-Regel). Gefiltert wird NUR hier auf dem Server (lib/fluss/server.ts), die Oberfläche zeigt, was
// kommt. Gemerkt je Person, Bereich, Space und Tag (60 s, ungültig bei jeder Schreibung). Keine Personendaten in Logs.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { localDay } from '@/lib/zeit';
import { merken } from '@/lib/store/memo';
import { istFlussBereich } from '@/lib/fluss/modell';
import { flussLaden } from '@/lib/fluss/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang || zugang.dienst) return NextResponse.json({ ok: false, fehler: 'Überblick nur für eine angemeldete Person im Haushalt des Inhabers.' }, { status: 403 });
  const p = new URL(req.url).searchParams;
  const bereich = p.get('bereich');
  if (!istFlussBereich(bereich)) return NextResponse.json({ ok: false, fehler: 'Unbekannter Bereich.' }, { status: 400 });
  const sp = p.get('space');
  const space = sp === 'privat' || sp === 'business' ? sp : null;
  const heute = localDay();
  const person = zugang.person;
  try {
    const fluss = await merken(`fluss:${person}:${bereich}:${space ?? 'alle'}:${heute}`, 60_000, () => flussLaden({ bereich, person, heute, space }));
    return NextResponse.json({ ok: true, fluss });
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Der Überblick konnte nicht gerechnet werden.' }, { status: 500 });
  }
}
