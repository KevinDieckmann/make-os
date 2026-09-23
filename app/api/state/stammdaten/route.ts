// ─── MAKE OS — Stammdaten ───────────────────────────────────────────────────
// Firmen, Konten, Personen, Ansprechpartner. Bleibt auf dem Rechner: kein
// Cloud-Dienst, keine offene Datenbank — das war der Grund, das hier zu bauen.
//
// Geschützt gespeichert: fällt eine der vier Listen plötzlich auf weniger als
// die Hälfte, wird der Schreibvorgang abgelehnt und der alte Stand behalten.

import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetztListen } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Satz = Record<string, string> & { id: string };
interface Stammdaten {
  firmen: Satz[];
  konten: Satz[];
  personen: Satz[];
  partner: Satz[];
  stand?: string;
}

const LEER: Stammdaten = { firmen: [], konten: [], personen: [], partner: [] };
const LISTEN = ['firmen', 'konten', 'personen', 'partner'] as const;

function saeubern(x: unknown): Satz[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map(e => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(e)) {
        if (typeof v === 'string') out[k] = v.slice(0, 400);
      }
      if (!out.id) out.id = `s${Math.abs(hash(JSON.stringify(e)))}`;
      return out as Satz;
    })
    .slice(0, 200);
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export async function GET() {
  const d = await loadJson<Stammdaten>('stammdaten');
  return NextResponse.json({ ...LEER, ...(d ?? {}) });
}

export async function PUT(req: Request) {
  let body: Partial<Stammdaten>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, grund: 'kein JSON' }, { status: 400 }); }

  const neu: Stammdaten = {
    firmen: saeubern(body.firmen),
    konten: saeubern(body.konten),
    personen: saeubern(body.personen),
    partner: saeubern(body.partner),
    stand: new Date().toISOString(),
  };

  // Schwelle 2 statt der üblichen 3: Stammdaten-Listen sind kurz (zwei Firmen,
  // zwei Personen). Mit der Standard-Schwelle würde der Wächter hier nie
  // greifen — und genau diese Listen darf man nicht versehentlich leeren.
  const { ok, next, verloren } = await updateGeschuetztListen<Stammdaten>('stammdaten', neu, [...LISTEN], 2);
  if (!ok) {
    return new NextResponse(
      `Nicht gespeichert: ${verloren} wäre stark geschrumpft. Der alte Stand bleibt stehen.`,
      { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
  return NextResponse.json({ ok: true, stand: next.stand });
}
