// ─── Agenten-Bereich: Skills, eigene Mitarbeiter, Gedächtnis (08.10. spät, Paket 0 „Vertrag“ — STUB, gebaut in Paket 3) ───
// GET `?head=` → `SkillsAntwort`, `?id=` → `SkillAntwort` (mit Anleitung). POST `SkillAnfrage`: anlegen, ändern, Testlauf,
// aktivieren (erst mit ≥ 3 Tests und Testlauf), Import SKILL.md, Mitarbeiter anlegen/ändern, Merksätze. Nur Heads, die die Person
// sehen darf (lib/agenten/sicht.ts); Vorschläge von Agenten kommen NUR über den Stapel (Arten `skill`/`mitarbeiter`/`merksatz`).
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
