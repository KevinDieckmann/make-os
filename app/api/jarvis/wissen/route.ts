// ─── MAKE OS — Das Gehirn (Route) ───────────────────────────────────────────
// GET ohne Frage: der Stand des Bestands — wie viele Notizen, wie viele
// Dubletten übersprungen, wie viel Privates gar nicht erst geöffnet wurde.
// GET mit ?frage=: die Suche, dieselbe, die Jarvis benutzt.

import { NextResponse } from 'next/server';
import { bestand, suche } from '@/lib/jarvis/vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const frage = p.get('frage');
  if (frage) {
    const d = await suche(frage, Math.max(1, Math.min(10, Number(p.get('anzahl')) || 5)));
    return NextResponse.json({ ok: true, ...d });
  }
  const b = await bestand(p.get('frisch') === '1');
  const jeWurzel: Record<string, number> = {};
  for (const n of b.notizen) jeWurzel[n.wurzel] = (jeWurzel[n.wurzel] ?? 0) + 1;
  return NextResponse.json({
    ok: true,
    notizen: b.notizen.length,
    gelesen: b.gelesen,
    dubletten: b.dubletten,
    privatUebersprungen: b.privatUebersprungen,
    dauerMs: b.dauerMs,
    jeWurzel,
    mitStichworten: b.notizen.filter(n => n.stichworte.length).length,
    mitVerweisen: b.notizen.filter(n => n.verweise.length).length,
  });
}
