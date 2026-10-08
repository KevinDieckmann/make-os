// ─── MAKE OS — Willkommen ───────────────────────────────────────────────────
// Der Gruß, den eine neu eingeladene Person beim allerersten Öffnen sieht (09.10., Onboarding B5: neutral für jede Instanz —
// components/os/Willkommen.tsx). Genau einmal — deshalb steht das Häkchen im Bestand und nicht nur im Browser: ein anderer Browser,
// ein gelöschter Verlauf oder ein zweiter Rechner sollen ihn nicht wiederholen. Ob er erscheint, entscheidet der Server (`zeigen`):
// nur für die Person der Sitzung, nur für ein eingeladenes Konto (nicht den Haupt-Inhaber, der die Instanz eingerichtet hat).

import { jsonBegrenzt, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt, personDerSitzung } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/zoe/raum';
import { ladeKonten } from '@/lib/zugang/konten';
import { hauptInhaber } from '@/lib/zugang/inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Datei { gesehen: Record<string, string> }

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const d = await loadJson<Datei>('willkommen');
  const gesehen = d?.gesehen ?? {};
  // Für die Person der Sitzung: zeigen, solange nicht gesehen — nur eingeladenen Konten (jedes außer dem Haupt-Inhaber). Vorname aus dem Konto.
  const ich = personDerSitzung(req);
  const st = ich ? await ladeKonten() : null;
  const konto = st?.konten.find(k => k.speicher === ich);
  const zeigen = !!konto && !gesehen[konto.speicher] && hauptInhaber(st!)?.speicher !== konto.speicher;
  return NextResponse.json({ gesehen, zeigen, ...(zeigen ? { vorname: (konto!.name ?? '').split(/\s+/)[0] ?? '' } : {}) });
}

/** Als gesehen stempeln — danach kommt der Gruß nie wieder. */
export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  // Die Person kommt aus der Sitzung, nicht aus dem Body (26.09.).
  try { await jsonBegrenzt(req, JSON_GROSS); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
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
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  // Sicht-Prüfung 08.10.: den Gruß einer ANDEREN Person (bzw. aller) setzt nur der Inhaber zurück — sonst nur den eigenen.
  const ich = personAus(req);
  const gewuenscht = new URL(req.url).searchParams.get('person');
  const inhaber = await istInhaber(ich).catch(() => false);
  if (!inhaber && gewuenscht && gewuenscht !== ich) return NextResponse.json({ ok: false, error: 'Nur den eigenen Gruß zurücksetzen.' }, { status: 403 });
  const person = inhaber ? gewuenscht : ich;
  const next = await updateJson<Datei>('willkommen', current => {
    const f = current ?? { gesehen: {} };
    f.gesehen = f.gesehen ?? {};
    if (person) delete f.gesehen[person]; else f.gesehen = {};
    return f;
  });
  return NextResponse.json({ ok: true, gesehen: next.gesehen });
}
