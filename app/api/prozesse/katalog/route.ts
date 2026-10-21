// ─── Prozesse — der Baustein-Katalog für die Werkstatt (Etappe B1, 21.10.) ─────────────────────────────────────────────────────────────────────────────
// GET              der Katalog (Daten, lib/prozesse/baustein-katalog.ts) mit aufgelöster Klasse und KI-Kategorien (vom Werkzeug — nie doppelt gepflegt),
//                  Kategorien der Palette, feste Formatierer.
// GET ?auswahl=1   dazu die Werte der Auswahlquellen (Team, Konten, Stufen, eigene Business-Postfächer, Heads, Skills, Ereignisse, veröffentlichte Prozesse,
//                  Gesellschaften, Datumsfelder, angebundene Modelle der Instanz, Business-Werkzeuge) — nur Business, nur Kennung + Name.
// Tor: `werkstattZugang` (Haushalt des Inhabers, Sicht Privat 403). Lesen schreibt nie.

import { NextResponse } from 'next/server';
import { werkstattZugang } from '@/lib/prozesse/werkstatt-zugang';
import { auswahlListen, katalogAufgeloest, modellOptionenInstanz } from '@/lib/prozesse/werkstatt-server';
import { FORMATIERER, KATALOG_KATEGORIEN } from '@/lib/prozesse/baustein-katalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await werkstattZugang(req);
  if (z instanceof Response) return z;
  const mitAuswahl = new URL(req.url).searchParams.get('auswahl') === '1';
  const [katalog, auswahl, modelle] = await Promise.all([
    katalogAufgeloest(),
    mitAuswahl ? auswahlListen(z.haushalt, z.person) : Promise.resolve(null),
    mitAuswahl ? modellOptionenInstanz().catch(() => []) : Promise.resolve(null),
  ]);
  return NextResponse.json({ ok: true, katalog, kategorien: KATALOG_KATEGORIEN, formatierer: FORMATIERER, ...(auswahl ? { auswahl } : {}), ...(modelle ? { modelle } : {}) });
}
