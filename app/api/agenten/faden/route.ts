// ─── Agenten-Bereich: Threads der Person (08.10. spät, Paket 0 „Vertrag“ — STUB, gebaut in Paket 1) ─────────────────────
// GET `?id=` → `FadenAntwort`, sonst `FadenListeAntwort` (`?agent=head:<id>` filtert). POST `FadenAnfrage` → `FadenSendenAntwort`
// (Head-/Mitarbeiter-Chat synchron, „+ Hintergrundaufgabe jetzt“ mit `hintergrund: true`). Verlauf NUR aus dem Bestand
// `agenten-faeden--<person>` (nie vom Browser), Stand/409, Grenzen 413, `jsonBegrenzt`, `bauPruefen` (über `eigenePerson(req, true)`).
// Nur die Person selbst (`eigenePerson`, Dienstweg 403).
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';

export const dynamic = 'force-dynamic';

const KOMMT = { ok: false, fehler: 'Kommt mit Paket 1 (agenten-kern) — AGENTEN_KONZEPT.md C11.', paket: 1 } as const;
const kommt = () => NextResponse.json({ ...KOMMT, error: KOMMT.fehler }, { status: 501 });

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return kommt();
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return kommt();
}
