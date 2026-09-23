// ─── MAKE OS — Anwesenheit ──────────────────────────────────────────────────
// Wer ist gerade wo. Das schließt die Lücke, die das Zwei-Fenster-Fundament
// offen lässt: Einzel-Änderungen verhindern, dass Kevin und Malin sich
// gegenseitig ganze Listen überschreiben — aber wenn beide DIESELBE Aufgabe
// im selben Moment ändern, gewinnt weiterhin der letzte Klick.
//
// Statt dafür eine Sperre zu bauen (die zu zweit mehr nervt als hilft), machen
// wir es sichtbar: „Malin ist gerade in den Aufgaben." Dann fasst man es
// entweder nicht an oder ruft kurz rüber.
//
// Bewusst flüchtig: nur der letzte Stand je Person, nichts wird mitgeschrieben.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Eintrag { person: string; pfad: string; at: string }
interface Datei { wer: Record<string, Eintrag> }

/** Nach so langer Stille gilt jemand als weg. */
const FRISCH_MS = 90_000;

export async function GET() {
  const f = await loadJson<Datei>('anwesenheit');
  const jetzt = Date.now();
  const aktiv = Object.values(f?.wer ?? {})
    .filter(e => jetzt - Date.parse(e.at) < FRISCH_MS)
    .map(e => ({ ...e, seitSek: Math.round((jetzt - Date.parse(e.at)) / 1000) }));
  return NextResponse.json({ aktiv }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  let body: { person?: string; pfad?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const person = body.person === 'malin' ? 'malin' : 'kevin';
  const pfad = String(body.pfad ?? '').slice(0, 80);
  if (!pfad.startsWith('/os')) return NextResponse.json({ ok: true, ignoriert: true });

  const jetzt = Date.now();
  await updateJson<Datei>('anwesenheit', current => {
    const f = current ?? { wer: {} };
    f.wer = f.wer ?? {};
    f.wer[person] = { person, pfad, at: new Date().toISOString() };
    // Alte Einträge wegräumen, damit die Datei nicht wächst.
    for (const [k, e] of Object.entries(f.wer)) {
      if (jetzt - Date.parse(e.at) > 10 * 60_000) delete f.wer[k];
    }
    return f;
  });
  return NextResponse.json({ ok: true });
}
