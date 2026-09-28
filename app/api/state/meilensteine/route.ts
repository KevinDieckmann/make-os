// ─── MAKE OS — Meilensteine (lokal, pflegbar) ───────────────────────────────
// Vorher eine feste Konstante — jetzt DIE Datenbasis: jeder Meilenstein hat
// Fälligkeit, Messlatte („woran erkennen wir fertig?") und Fortschritt.
// space='business' fließt in Brain + Business-Säule, 'privat' in die
// Gesundheits-Säule — und bleibt aus Business-Kontexten draußen (Privatsphäre).
// Seit 28.09. ist `space` das echte Feld; das Altfeld `bereich` (business | gesundheit)
// wird beim Speichern gespiegelt, damit die älteren Leser weiterlaufen.

import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetztListen } from '@/lib/store/local-db';
import { listePatchen, opsLesen, opsFehler } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import type { Meilenstein } from '@/lib/planung/typen';
import { sauberMeilensteine } from '@/lib/planung/meilensteine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Seit 27.09. zusätzlich (additiv, alte Einträge bleiben gültig): `rang` (Priorität per Pfeil),
// `einheit` (Business-Einheit, nur Bereich Business), `abgeleitetVon`/`angepasst` (aus einem
// Jahresziel mit Termin — lib/planung/kaskade.ts). Der Typ liegt in lib/planung/typen.ts.
export type { Meilenstein };
interface MeilensteinFile { meilensteine: Meilenstein[] }
/** Höchstzahl Meilensteine — darüber wird abgelehnt, nie gekürzt (28.09.). */
const GRENZE = 500;

// Kein Startbestand (28.09., K1): hier standen echte Business- und Gesundheits-Etappen im Code (Regel 1
// „keine echten Daten im Repo“). Ein neuer Haushalt beginnt leer; ein bestehender Bestand wird nie angefasst.

// Säuberung (seit 28.09. mit echtem `space`, `bereich` gespiegelt): lib/planung/meilensteine.ts.
const sauberListe = sauberMeilensteine;

export async function GET() {
  const f = await loadJson<MeilensteinFile>('meilensteine');
  // Jede Zeile trägt ihren Stand — Änderungen kommen als PATCH mit diesem Stand zurück (28.09.).
  return NextResponse.json({ meilensteine: mitStand(Array.isArray(f?.meilensteine) ? f.meilensteine : []) });
}

export async function PUT(req: Request) {
  let body: { meilensteine?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (Array.isArray(body.meilensteine) && body.meilensteine.length > GRENZE) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${GRENZE} Meilensteine.` }, { status: 413 });
  const sauber = sauberListe(body.meilensteine);
  if (!sauber.length) return NextResponse.json({ ok: false, error: 'meilensteine darf nicht leer sein.' }, { status: 400 });
  // Vorher ersetzte jeder PUT die Liste bedingungslos — ein Client mit halbem
  // Stand hätte alle Meilensteine gelöscht.
  const { ok, next, verloren } = await updateGeschuetztListen<MeilensteinFile>(
    'meilensteine', { meilensteine: sauber }, ['meilensteine'],
  );
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: `Abgelehnt: das hätte über die Hälfte von ${verloren} gelöscht.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, meilensteine: next.meilensteine });
}

/**
 * Einzelne Meilensteine ändern — Zwei-Fenster-Fundament. Mit `stand` je Änderung (28.09.):
 * veraltet → 409 mit dem aktuellen Bestand und `konflikte[]`, nichts überschrieben.
 */
export async function PATCH(req: Request) {
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (Array.isArray(body.ops) && body.ops.length > 160) return NextResponse.json({ ok: false, error: 'Abgelehnt: höchstens 160 Änderungen je Aufruf.' }, { status: 413 });
  const ops = opsLesen<Meilenstein>(body.ops, e => sauberListe([e])[0] ?? null, 160);
  if (!ops) return NextResponse.json({ ok: false, error: opsFehler(body.ops, 160) }, { status: Array.isArray(body.ops) ? 413 : 400 });
  const r = await listePatchen<Meilenstein, MeilensteinFile & Record<string, unknown>>('meilensteine', 'meilensteine', ops, 6, undefined, {
    pruefen: (liste, o) => {
      const ids = new Set(liste.map(m => m.id));
      const neu = new Set(o.filter(x => x.op === 'upsert' && !ids.has(x.eintrag!.id)).map(x => x.eintrag!.id)).size;
      return neu && liste.length + neu > GRENZE ? `Abgelehnt: höchstens ${GRENZE} Meilensteine.` : null;
    },
  });
  if (!r.ok) {
    const aktuell = await loadJson<MeilensteinFile>('meilensteine');
    const status = r.fehler?.startsWith('Abgelehnt: höchstens') ? 413 : r.konflikte?.length || r.fehler?.startsWith('Abgelehnt') ? 409 : 400;
    return NextResponse.json({ ok: false, error: r.fehler, konflikte: r.konflikte ?? [], meilensteine: mitStand(Array.isArray(aktuell?.meilensteine) ? aktuell!.meilensteine : []) }, { status });
  }
  return NextResponse.json({ ok: true, angewandt: r.angewandt, meilensteine: mitStand(r.next?.meilensteine ?? []) });
}
