// ─── Google — Verbinden starten (03.10.2026) ─────────────────────────────────
// POST { funktionen?: ['kalender'] } → { ok, url } — die Adresse der Google-Anmeldeseite (Authorization-Code + PKCE + state).
// Der Browser leitet dorthin; Google kommt über /api/google/rueckruf zurück. Nur die eigene Person. Scopes je Funktion
// (inkrementell, `include_granted_scopes`): später kommen weitere Funktionen ohne zweite Verbindung dazu.
import { NextResponse } from 'next/server';
import { verbindungStarten, istGoogleFunktion, GoogleVerbindungsFehler, type GoogleFunktion } from '@/lib/google/verbindung';
import { eigenePerson } from '@/lib/google/zugang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true);
  if (z instanceof NextResponse) return z;
  let b: { funktionen?: unknown } = {};
  try { b = await req.json(); } catch { /* ohne Körper: Kalender */ }
  const wunsch = Array.isArray(b.funktionen) ? b.funktionen.filter(istGoogleFunktion) : ['kalender' as GoogleFunktion];
  const funktionen = (wunsch.length ? wunsch : ['kalender' as GoogleFunktion]) as GoogleFunktion[];
  try {
    const { url } = await verbindungStarten(z.person, funktionen);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    if (e instanceof GoogleVerbindungsFehler) return NextResponse.json({ ok: false, code: e.code, fehler: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, fehler: 'Google ließ sich nicht starten.' }, { status: 502 });
  }
}
