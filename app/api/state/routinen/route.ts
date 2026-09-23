// ─── MAKE OS — Routinen (lokal) ─────────────────────────────────────────────
// DIE Quelle für positive Routinen — Gesundheit, Leben, Business. Der
// Routine-Planer pflegt sie, und alles andere greift darauf zu: der
// Wochenplaner (Leiste + Jarvis-Vorschlag), die Tagesplanung, das
// Gesundheits-Cockpit (Häkchen) und der MAKE Score (Routinen-Quote).
// Erststart wird aus den bisherigen ROUTINE_ITEMS geseedet — gleiche ids,
// damit Streak und Verlauf nahtlos weiterlaufen.

import { NextResponse } from 'next/server';
import { loadJson, updateJson, updateGeschuetzt } from '@/lib/store/local-db';
import { listePatchen, opsLesen } from '@/lib/store/patch-liste';
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

/** Eine Routine, geprüft — von PUT und PATCH gemeinsam benutzt. */
function sauberRoutine(roh: unknown): Routine | null {
  const r = (roh ?? {}) as Partial<Routine>;
  const label = String(r.label ?? '').slice(0, 120);
  if (!label) return null;
  return {
    id: r.id || `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    label,
    wann: (['morgen', 'tag', 'abend'] as const).includes(r.wann as Routine['wann']) ? r.wann as Routine['wann'] : 'morgen',
    kategorie: (['gesundheit', 'leben', 'business'] as const).includes(r.kategorie as Routine['kategorie']) ? r.kategorie as Routine['kategorie'] : 'leben',
    dauerMin: Math.max(5, Math.min(120, Math.round(Number(r.dauerMin)) || 15)),
    aktiv: r.aktiv !== false,
  };
}

export async function PUT(req: Request) {
  let body: { routinen?: Routine[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.routinen)) return NextResponse.json({ ok: false, error: 'routinen fehlt.' }, { status: 400 });

  const sauber = body.routinen.slice(0, 40).map(sauberRoutine).filter((r): r is Routine => !!r);

  const { ok, next } = await updateGeschuetzt<RoutinenFile>('routinen', { routinen: sauber }, s => s.routinen?.length ?? 0, 4);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das haette ueber die Haelfte der Routinen geloescht.' }, { status: 409 });
  return NextResponse.json({ ok: true, routinen: next.routinen });
}

/** Einzelne Routinen ändern — Zwei-Fenster-Fundament. */
export async function PATCH(req: Request) {
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const ops = opsLesen<Routine>(body.ops, sauberRoutine, 40);
  if (!ops) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });
  const r = await listePatchen<Routine, RoutinenFile & Record<string, unknown>>('routinen', 'routinen', ops, 4);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler }, { status: r.fehler?.startsWith('Abgelehnt') ? 409 : 400 });
  return NextResponse.json({ ok: true, angewandt: r.angewandt, routinen: r.next?.routinen });
}
