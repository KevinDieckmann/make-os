// ─── Agenten-Bereich: Heads und Überblick der Person (08.10. spät, Paket 0 „Vertrag“ — STUB, gebaut in Paket 1) ─────────
// GET → `AgentenAntwort` (lib/agenten/typen.ts): ZOE, die Heads, die die Person sehen darf (serverseitig gefiltert:
// lib/agenten/sicht.ts), Überblick über dem ZOE-Chat (Antwort 1). Nur die Person selbst (`eigenePerson`, Dienstweg 403),
// keine Personen-Parameter. Beispiel-Antworten für die Oberfläche: tests/fixtures/agenten-api.ts.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';

export const dynamic = 'force-dynamic';

const KOMMT = { ok: false, fehler: 'Kommt mit Paket 1 (agenten-kern) — AGENTEN_KONZEPT.md C11.', paket: 1 } as const;

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return NextResponse.json({ ...KOMMT, error: KOMMT.fehler }, { status: 501 });
}
