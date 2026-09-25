// ─── MAKE OS — Bauplan speichern (lokal) ────────────────────────────────────
// GET    → alle Punkte (beim Erststart mit dem Startbestand gefüllt)
// PUT    → komplette Liste ersetzen (UI-Änderungen)
// POST   → EINEN Punkt anhängen — dafür gedacht, dass ich unterwegs etwas
//          eintrage, ohne die Liste zu überschreiben.

import { NextResponse } from 'next/server';
import { loadJson, updateJson, updateGeschuetzt } from '@/lib/store/local-db';
import { SEED, type BacklogItem } from '@/lib/make-one/backlog-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Seit 25.09. trägt die Datei auch die Etappen der Planung (lib/bauplan) — jeder Schreibweg behält sie.
interface BacklogFile { items: BacklogItem[]; etappen?: unknown[] }

const seeded = (): BacklogItem[] => {
  const now = new Date().toISOString();
  return SEED.map(s => ({ ...s, angelegt: now }));
};

export async function GET() {
  const file = await loadJson<BacklogFile>('backlog');
  // Erststart: mit dem, was aus Audit/Review/Gesprächen bekannt ist.
  if (!file || !Array.isArray(file.items) || !file.items.length) {
    const items = seeded();
    await updateJson<BacklogFile>('backlog', () => ({ items }));
    return NextResponse.json({ items });
  }
  return NextResponse.json({ items: file.items });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const b = body as { items?: BacklogItem[] };
  if (!b || !Array.isArray(b.items)) return NextResponse.json({ ok: false, error: 'items fehlt.' }, { status: 400 });
  const etappen = (await loadJson<BacklogFile>('backlog'))?.etappen;
  const { ok } = await updateGeschuetzt<BacklogFile>('backlog', { items: b.items!, ...(etappen ? { etappen } : {}) }, s => s.items?.length ?? 0);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das haette ueber die Haelfte der Bauplan-Punkte geloescht.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}

/** Einen Punkt anhängen — ohne die übrigen anzufassen. */
export async function POST(req: Request) {
  let body: Partial<BacklogItem>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const titel = (body.titel ?? '').trim();
  if (!titel) return NextResponse.json({ ok: false, error: 'Kein Titel.' }, { status: 400 });

  const item: BacklogItem = {
    id: body.id?.trim() || `bl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    titel,
    warum: (body.warum ?? '').trim(),
    kategorie: (['anbindung', 'agent', 'qualitaet', 'idee'] as const).includes(body.kategorie as never) ? body.kategorie! : 'idee',
    status: (['offen', 'laufend', 'erledigt'] as const).includes(body.status as never) ? body.status! : 'offen',
    prio: ([1, 2, 3] as const).includes(body.prio as never) ? body.prio! : 2,
    block: (['frei', 'kevin', 'extern'] as const).includes(body.block as never) ? body.block! : 'frei',
    brauche: body.brauche?.trim() || undefined,
    quelle: body.quelle?.trim() || undefined,
    phase: body.phase?.trim() || undefined,
    angelegt: new Date().toISOString(),
  };

  const next = await updateJson<BacklogFile>('backlog', current => {
    const items = Array.isArray(current?.items) && current.items.length ? current.items : seeded();
    // Gleiche id → aktualisieren statt doppelt anlegen.
    const i = items.findIndex(x => x.id === item.id);
    if (i >= 0) { const copy = [...items]; copy[i] = { ...copy[i], ...item, angelegt: copy[i].angelegt }; return { ...(current ?? {}), items: copy }; }
    return { ...(current ?? {}), items: [...items, item] };
  });

  return NextResponse.json({ ok: true, id: item.id, anzahl: next.items.length });
}
