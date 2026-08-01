// ─── MAKE OS — Routinen (lokal) ─────────────────────────────────────────────
// DIE Quelle für positive Routinen — Gesundheit, Leben, Business. Der
// Routine-Planer pflegt sie, und alles andere greift darauf zu: der
// Wochenplaner (Leiste + Jarvis-Vorschlag), die Tagesplanung, das
// Gesundheits-Cockpit (Häkchen) und der MAKE Score (Routinen-Quote).
// Erststart wird aus den bisherigen ROUTINE_ITEMS geseedet — gleiche ids,
// damit Streak und Verlauf nahtlos weiterlaufen.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { ROUTINE_ITEMS } from '@/lib/make-one/health-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface Routine {
  id: string;
  label: string;
  wann: 'morgen' | 'tag' | 'abend';
  kategorie: 'gesundheit' | 'leben' | 'business';
  dauerMin: number;
  aktiv: boolean;
}
interface RoutinenFile { routinen: Routine[] }

const seed = (): Routine[] => ROUTINE_ITEMS.map(r => ({
  id: r.id,
  label: r.label,
  wann: (r.when === 'abend' ? 'abend' : 'morgen') as Routine['wann'],
  kategorie: 'gesundheit',
  dauerMin: 15,
  aktiv: true,
}));

export async function GET() {
  const f = await loadJson<RoutinenFile>('routinen');
  if (!f || !Array.isArray(f.routinen) || !f.routinen.length) {
    const next = await updateJson<RoutinenFile>('routinen', () => ({ routinen: seed() }));
    return NextResponse.json({ routinen: next.routinen });
  }
  return NextResponse.json({ routinen: f.routinen });
}

export async function PUT(req: Request) {
  let body: { routinen?: Routine[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.routinen)) return NextResponse.json({ ok: false, error: 'routinen fehlt.' }, { status: 400 });

  const sauber: Routine[] = body.routinen.slice(0, 40).map(r => ({
    id: r.id || `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    label: String(r.label ?? '').slice(0, 120),
    wann: (['morgen', 'tag', 'abend'] as const).includes(r.wann) ? r.wann : 'morgen',
    kategorie: (['gesundheit', 'leben', 'business'] as const).includes(r.kategorie) ? r.kategorie : 'leben',
    dauerMin: Math.max(5, Math.min(120, Math.round(Number(r.dauerMin)) || 15)),
    aktiv: r.aktiv !== false,
  })).filter(r => r.label);

  const next = await updateJson<RoutinenFile>('routinen', () => ({ routinen: sauber }));
  return NextResponse.json({ ok: true, routinen: next.routinen });
}
