// ─── WhatsApp — Senden per Einzelklick (07.10.2026) ────────────────────────────────────────────────────────────────────
// POST { gespraech: 'wa~…', art: 'frei', text, anfrageId }                                → freie Nachricht (nur bei offenem 24-h-Fenster)
// POST { gespraech: 'wa~…', art: 'vorlage', vorlage: { name, sprache, parameter[] }, anfrageId } → genehmigte Vorlage (jederzeit)
// NUR die angemeldete Person selbst (`eigenePerson`, Dienstweg 403 — ZOE, Takt und Skripte senden nie) mit Zugang zur Business-Nummer;
// immer EIN Gespräch, nie Listen. Fehler von Meta kommen als deutscher Satz (`fehler`) mit `art` (fenster · vorlage · parameter ·
// nummer · empfaenger · limit · token · gesperrt …); die Antwort trägt nie Schlüssel oder Rohtext von Meta.
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { WhatsappFehler } from '@/lib/whatsapp/graph';
import { eingabePruefen, whatsappSenden } from '@/lib/whatsapp/senden';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 32 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  try {
    const r = await whatsappSenden(z.person, eingabePruefen(b));
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    if (e instanceof WhatsappFehler) return NextResponse.json({ ok: false, art: e.art, fehler: e.message, ...(e.erneuern ? { erneuern: true } : {}) }, { status: e.status });
    console.error(`[whatsapp] Senden: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
    return NextResponse.json({ ok: false, fehler: 'Senden ging nicht — bitte noch einmal.' }, { status: 500 });
  }
}
