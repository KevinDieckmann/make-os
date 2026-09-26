// ─── MAKE OS — Willkommen ───────────────────────────────────────────────────
// Der Gruß, den Malin beim allerersten Öffnen sieht. Genau einmal — deshalb
// steht das Häkchen im Bestand und nicht nur im Browser: ein anderer Browser,
// ein gelöschter Verlauf oder ein zweiter Rechner sollen ihn nicht wiederholen.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Datei { gesehen: Record<string, string> }

export async function GET() {
  const d = await loadJson<Datei>('willkommen');
  return NextResponse.json({ gesehen: d?.gesehen ?? {} });
}

/** Als gesehen stempeln — danach kommt der Gruß nie wieder. */
export async function POST(req: Request) {
  // Die Person kommt aus der Sitzung, nicht aus dem Body (26.09.).
  try { await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const person = personAus(req);
  const next = await updateJson<Datei>('willkommen', current => {
    const f = current ?? { gesehen: {} };
    f.gesehen = f.gesehen ?? {};
    if (!f.gesehen[person]) f.gesehen[person] = new Date().toISOString();
    return f;
  });
  return NextResponse.json({ ok: true, gesehen: next.gesehen });
}

/** Zurücksetzen — damit der Gruß erneut gezeigt werden kann (?person=malin). */
export async function DELETE(req: Request) {
  const person = new URL(req.url).searchParams.get('person');
  const next = await updateJson<Datei>('willkommen', current => {
    const f = current ?? { gesehen: {} };
    f.gesehen = f.gesehen ?? {};
    if (person) delete f.gesehen[person]; else f.gesehen = {};
    return f;
  });
  return NextResponse.json({ ok: true, gesehen: next.gesehen });
}
