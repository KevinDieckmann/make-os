// ─── Agenten-Bereich: Kosten je Auftrag aus der Lauf-Spur (10.10., Paket V1 „Messen & sparen“, AGENTEN_KONZEPT_V2.md C9) ──────────────
// GET → `KostenAntwort` (lib/agenten/spur.ts): die EIGENEN Ketten der Person (je Auftrag: wann, welche Agenten, Dauer, Kosten, Werkzeuge,
// Cache-Quote, Ausgang), Summen 7/30 Tage und „Zeit bis zum ersten Wort“ von ZOE; ein Inhaber zusätzlich die Summen der Instanz je Bereich
// — nur Zahlen, ohne Personen, Agenten oder Kennungen anderer. Nur Metadaten, nie Inhalte.
// Trennung serverseitig (Plattform-Regel): welche Bereiche, entscheidet die EINE Konto-Sicht (lib/zugang/konto-sicht.ts) — ein Konto „nur
// Business“ bekommt den Privat-Bestand gar nicht erst geladen; `?space=privat|business` schränkt weiter ein (nie aus). Nur die Person selbst
// (`eigenePerson`: Sitzung, Haushalt des Inhabers; Dienstweg 403), keine Personen-Parameter.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';
import { sichtBereichAus } from '@/lib/agenten/sicht';
import { kontoSicht } from '@/lib/zugang/konto-sicht-server';
import { kostenSicht, SPUR_BEREICHE, type SpurBereich } from '@/lib/agenten/spur';
import { spurLesen } from '@/lib/agenten/spur-server';
import { usdEurKurs } from '@/lib/ki/kosten';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const nein = (status: number, fehler: string) => NextResponse.json({ ok: false, fehler, error: fehler }, { status });

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const space = sichtBereichAus(new URL(req.url).searchParams.get('space'));
  if (space === undefined) return nein(400, 'space ist privat oder business.');
  const k = await kontoSicht(z.person).catch(() => null);
  if (!k || !k.imHaushalt) return NextResponse.json(AGENTEN_NUR_SELBST, { status: 403 });
  // Bereiche des Kontos (Privat nur mit Privat-Bereich), dann die Sicht — die andere Sicht wird nicht gelesen.
  const erlaubt = SPUR_BEREICHE.filter(b => (b === 'privat' ? k.privat : k.business));
  const bereiche: SpurBereich[] = space ? erlaubt.filter(b => b === space) : erlaubt;
  const jetzt = new Date();
  const eintraege = bereiche.length ? await spurLesen({ bereiche, monate: 2, jetzt }) : [];
  return NextResponse.json(kostenSicht(eintraege, { person: z.person, bereiche, inhaber: k.inhaber, jetzt, kurs: usdEurKurs() }), { headers: { 'Cache-Control': 'no-store' } });
}
