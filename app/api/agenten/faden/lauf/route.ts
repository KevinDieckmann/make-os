// ─── Agenten-Bereich: ein Thread-Lauf im Hintergrund (08.10. spät, Paket 0 „Vertrag“ — STUB, gebaut in Paket 1) ──────────
// Der Arbeiter (worker.mjs → Warteschlange `zoe-auftraege`, Name `LAUF_AGENT` = 'faden') ruft diese Route mit der `eingabe`
// eines Auftrags (`LaufAuftrag`: Mitarbeiter-Thread, Skill-Lauf, geplante Hintergrundaufgabe). NUR der Dienstweg MIT Person aus
// dem Haushalt des Inhabers — der Lauf rechnet immer für die AUSLÖSENDE Person (CLAUDE.md Regel 5/7), nie als Systemlauf.
import { NextResponse } from 'next/server';
import { istDienst, nurDienstweg, ohnePerson, nurHaushalt, personImHaushaltDesInhabers } from '@/lib/zugang/tor';

const KOMMT = { ok: false, fehler: 'Kommt mit Paket 1 (agenten-kern) — AGENTEN_KONZEPT.md C11.', paket: 1 } as const;

export async function POST(req: Request) {
  if (!istDienst(req)) return nurDienstweg();
  const person = req.headers.get('x-make-person');
  if (!person) return ohnePerson();
  if (!(await personImHaushaltDesInhabers(person))) return nurHaushalt();
  return NextResponse.json({ ...KOMMT, error: KOMMT.fehler }, { status: 501 });
}
