// ─── Agenten-Bereich: Heads und Überblick der Person (09.10., Paket 1 „Kern“) ──────────────────────────────────────────────────
// GET → `AgentenAntwort` (lib/agenten/typen.ts): ZOE, die Heads, die die Person sehen darf (serverseitig gefiltert:
// lib/agenten/sicht.ts), Überblick über dem ZOE-Chat (Antwort 1: passiert seit dem letzten Besuch, in Arbeit je Head, Freigaben als
// Zahl, Jahresziele, Kurz-Briefing regelbasiert). `?seit=<ISO>` = letzter Besuch (der Browser merkt ihn sich; Lesen schreibt nie),
// ohne Angabe die letzten 24 Stunden. Nur die Person selbst (`eigenePerson`, Dienstweg 403), keine Personen-Parameter.
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/zugang/tor';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';
import { agentenAntwort } from '@/lib/agenten/faeden-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const roh = new URL(req.url).searchParams.get('seit');
  const t = roh ? Date.parse(roh) : NaN;
  const seit = new Date(Number.isFinite(t) && t <= Date.now() ? t : Date.now() - 24 * 3_600_000).toISOString();
  try {
    return NextResponse.json(await agentenAntwort(z.person, seit), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const fehler = `Agenten-Bereich gerade nicht lesbar (${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}).`;
    return NextResponse.json({ ok: false, fehler, error: fehler }, { status: 500 });
  }
}
