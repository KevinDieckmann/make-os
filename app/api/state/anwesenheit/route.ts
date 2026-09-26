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
import { personAus, nameVon } from '@/lib/jarvis/raum';
import { istSpace } from '@/lib/make-one/space-regeln';
import { zeitSchluessel } from '@/lib/zeitmessung/bereich';
import { verbucheAnwesenheit } from '@/lib/zeitmessung/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Eintrag { person: string; pfad: string; at: string }
interface Datei { wer: Record<string, Eintrag> }

/** Nach so langer Stille gilt jemand als weg. */
const FRISCH_MS = 90_000;

export async function GET(req: Request) {
  const ich = personAus(req);
  const f = await loadJson<Datei>('anwesenheit');
  const jetzt = Date.now();
  const aktiv = Object.values(f?.wer ?? {})
    .filter(e => jetzt - Date.parse(e.at) < FRISCH_MS)
    .map(e => ({ ...e, name: nameVon(e.person), seitSek: Math.round((jetzt - Date.parse(e.at)) / 1000) }));
  return NextResponse.json({ aktiv, ich }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  let body: { person?: string; pfad?: string; suche?: string; space?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  // Seit den Konten (23.09.): die Person aus der Sitzung, nicht aus der Anfrage.
  const person = personAus(req);
  // Mit Abfrage (Markttraktion: welcher Bereich, welche Person) — so sieht man „Malin ist gerade bei …“.
  const pfad = String(body.pfad ?? '').slice(0, 160);
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
  // Zeit & Fokus (26.09. spät): jeder Ping schreibt die Zeit seit dem letzten dem Bereich gut, in dem man war.
  const suche = String(body.suche ?? '').slice(0, 200);
  const { schluessel } = zeitSchluessel(pfad.split('?')[0], suche || (pfad.includes('?') ? `?${pfad.split('?')[1]}` : ''), istSpace(body.space) ? body.space : null);
  await verbucheAnwesenheit(person, new Date(jetzt).toISOString(), schluessel).catch(() => {});
  return NextResponse.json({ ok: true });
}
