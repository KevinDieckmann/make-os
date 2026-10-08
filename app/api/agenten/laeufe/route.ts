// ─── Agenten-Bereich: Hintergrundaufgaben und „Als Nächstes“ (08.10. spät, Paket 0 „Vertrag“ — STUB, gebaut in Paket 3) ──
// GET → `LaeufeAntwort`: Läuft/Fertig/Fehler (Lesemodell aus Warteschlange, Threads, Head-/Finanzchef-Berichten, Takt — nur
// eigene und Systemläufe), „Als Nächstes“ (dieselben Zeitplan-Regeln wie der Takt, keine zweite Planung) und die geplanten
// Hintergrundaufgaben. POST `LaeufeAnfrage`: planen (geplant/wiederkehrend), ändern, löschen, abbrechen, neu starten.
// Nur die Person selbst (`eigenePerson`, Dienstweg 403).
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';

export const dynamic = 'force-dynamic';

const KOMMT = { ok: false, fehler: 'Kommt mit Paket 3 (agenten-skills) — AGENTEN_KONZEPT.md C11.', paket: 3 } as const;
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
