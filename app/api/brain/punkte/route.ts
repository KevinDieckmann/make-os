// ─── MAKE OS — Brain-Kugel: GET /api/brain/punkte (05.10.2026) ───────────────
// Die Punkte der Brain-Kugel für die angemeldete Person — EINE Lese-Route, eine Quelle (lib/brain/kugel-server.ts).
//   GET → { ok, punkte: [{ id, art, bereich, titel, datum, links }], gekuerzt, deckel, jeArt, sicht }
// Zugang: angemeldete Person im Haushalt des Inhabers (`imHaushaltDesInhabers`, streng, Regel 5); fremder Haushalt,
// Konto ohne Haushalt und der Dienstweg → 403 (kein Hintergrundlauf braucht die Kugel).
// Sicht serverseitig (Plattform-Regel): „nur ich“, eigene Ziele und private Notizen/Termine der ANDEREN Person kommen nie
// an; eine Rolle ohne Privatzugang (`finanzRecht: 'business'` → `planZugangFuer(...).sicht === 'business'`) bekommt nichts
// aus dem Privat-Space. Die Antwort trägt nur Kennung, Art, Bereich, Titel (gekürzt), Datum und Verknüpfungs-Kennungen —
// keine Inhalte. Höchstens `PUNKTE_DECKEL` Punkte, die ältesten fallen zuerst weg — `gekuerzt` sagt, wie viele (nie still).
// Wächter: tests/brain-kugel.test.ts. Keine Personendaten in Logs.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { planZugangFuer } from '@/lib/finanzen/haushalt/zugriff';
import { jsonAntwort } from '@/lib/http/json-antwort';
import { localDay } from '@/lib/zeit';
import { brainPunkteLaden } from '@/lib/brain/kugel-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GESPERRT = { ok: false, fehler: 'Die Brain-Kugel gibt es nur für eine angemeldete Person im Haushalt des Inhabers.' } as const;

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang || zugang.dienst) return NextResponse.json(GESPERRT, { status: 403 });
  const person = zugang.person;
  // Privates nur mit Privatzugang — entschieden aus dem Konto, nie aus der Anfrage.
  const privat = (await istInhaber(person)) || (await planZugangFuer(person))?.sicht === 'privat';
  try {
    const k = await brainPunkteLaden({ person, privat }, localDay());
    return jsonAntwort(req, { ok: true, sicht: privat ? 'voll' : 'business', ...k });
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Die Brain-Kugel konnte nicht geladen werden.' }, { status: 500 });
  }
}
