// ─── MAKE OS — Routinen (lokal) ─────────────────────────────────────────────
// DIE Quelle für positive Routinen — Gesundheit, Leben, Business. Der
// Routine-Planer pflegt sie, und alles andere greift darauf zu: der
// Wochenplaner (Leiste + ZOE-Vorschlag), die Tagesplanung, das
// Gesundheits-Cockpit (Häkchen), das Home-Widget „Routinen heute“ und der
// MAKE Score (Routinen-Quote). Erststart wird aus den bisherigen
// ROUTINE_ITEMS geseedet — gleiche ids, damit Streak und Verlauf weiterlaufen.
//
// Seit 27.09. (Malins Rückmeldung) trägt eine Routine zusätzlich `space`
// (privat/business), `owner` (Person oder „beide“), `rhythmus` + `naechstesMal`
// und `rang` — alles additiv, gesäubert in lib/planung/routinen.ts. Im selben
// Bestand liegen die `bloecke`: die Wochenvorlage je Person (wann Privat, wann
// Arbeit). GET liefert beides; PUT { routinen } oder { bloecke } setzt eine
// Liste ganz, PATCH { ops } ändert einzelne Routinen.

import { NextResponse } from 'next/server';
import { loadJson, updateJson, updateGeschuetzt } from '@/lib/store/local-db';
import { listePatchen, opsLesen } from '@/lib/store/patch-liste';
import { ROUTINE_ITEMS } from '@/lib/make-one/health-data';
import { sauberRoutine, sauberBlock } from '@/lib/planung/routinen';
import type { Block, Routine, RoutinenDatei } from '@/lib/planung/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type { Routine, Block };

const seed = (): Routine[] => ROUTINE_ITEMS.map(r => ({
  id: r.id,
  label: r.label,
  wann: (r.when === 'abend' ? 'abend' : 'morgen') as Routine['wann'],
  kategorie: 'gesundheit',
  dauerMin: 15,
  aktiv: true,
}));

const bloeckeVon = (f: RoutinenDatei | null | undefined): Block[] => (Array.isArray(f?.bloecke) ? f!.bloecke : []);

export async function GET() {
  const f = await loadJson<RoutinenDatei>('routinen');
  if (!f || !Array.isArray(f.routinen) || !f.routinen.length) {
    const next = await updateJson<RoutinenDatei>('routinen', cur => ({ ...(cur ?? {}), routinen: seed() }));
    return NextResponse.json({ routinen: next.routinen, bloecke: bloeckeVon(next) });
  }
  return NextResponse.json({ routinen: f.routinen, bloecke: bloeckeVon(f) });
}

export async function PUT(req: Request) {
  let body: { routinen?: unknown; bloecke?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  if (Array.isArray(body.bloecke)) {
    const sauber = body.bloecke.slice(0, 120).map(sauberBlock).filter((b): b is Block => !!b);
    // Blöcke sind die Wochenvorlage — Schrumpf-Schutz wie bei den Routinen, ab 8 Einträgen.
    let abgelehnt = false;
    const next = await updateJson<RoutinenDatei>('routinen', cur => {
      const alt = bloeckeVon(cur).length;
      if (alt >= 8 && sauber.length < alt / 2) { abgelehnt = true; return cur ?? { routinen: seed() }; }
      return { ...(cur ?? { routinen: seed() }), bloecke: sauber };
    });
    if (abgelehnt) return NextResponse.json({ ok: false, error: 'Abgelehnt: das hätte über die Hälfte der Blöcke gelöscht.' }, { status: 409 });
    return NextResponse.json({ ok: true, bloecke: bloeckeVon(next) });
  }

  if (!Array.isArray(body.routinen)) return NextResponse.json({ ok: false, error: 'routinen oder bloecke fehlt.' }, { status: 400 });
  const sauber = body.routinen.slice(0, 60).map(sauberRoutine).filter((r): r is Routine => !!r);
  const bisher = await loadJson<RoutinenDatei>('routinen');
  const { ok, next } = await updateGeschuetzt<RoutinenDatei>('routinen', { ...(bisher ?? {}), routinen: sauber }, s => s.routinen?.length ?? 0, 4);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das haette ueber die Haelfte der Routinen geloescht.' }, { status: 409 });
  return NextResponse.json({ ok: true, routinen: next.routinen, bloecke: bloeckeVon(next) });
}

/** Einzelne Routinen ändern — Zwei-Fenster-Fundament. */
export async function PATCH(req: Request) {
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const ops = opsLesen<Routine>(body.ops, sauberRoutine, 60);
  if (!ops) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });
  const r = await listePatchen<Routine, RoutinenDatei & Record<string, unknown>>('routinen', 'routinen', ops, 4);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler }, { status: r.fehler?.startsWith('Abgelehnt') ? 409 : 400 });
  return NextResponse.json({ ok: true, angewandt: r.angewandt, routinen: r.next?.routinen, bloecke: bloeckeVon(r.next) });
}
