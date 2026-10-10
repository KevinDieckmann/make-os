// ─── MAKE OS — Aufträge übernehmen (nur für den Arbeiter) ───────────────────
// Der Arbeiter fragt hier nach Arbeit. Das Übernehmen läuft in einem einzigen
// Schreibvorgang, damit zwei Arbeiter nie denselben Auftrag greifen.
// Seit 10.10. (Paket V1, Arbeiter-Wecker — lib/zoe/wecker.ts): mit `wartenMs` ist es eine LANGE Abfrage — ist nichts da, hält die Route die
// Anfrage offen, bis `reihe()` etwas einreiht (dann sofort nehmen) oder die Zeit um ist (höchstens 20 s). `gewartet: true` sagt dem Arbeiter,
// dass er danach keine eigene Pause mehr braucht. Ohne `wartenMs` wie bisher (ein älterer Arbeiter merkt keinen Unterschied).

import { jsonBegrenzt } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { nimm } from '@/lib/zoe/auftraege';
import { aufWecken, weckStand } from '@/lib/zoe/wecker';
import { istDienst } from '@/lib/zugang/dienst';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!istDienst(req)) return NextResponse.json({ ok: false, error: 'Nur der Arbeiter (Dienstschlüssel).' }, { status: 403 });
  let body: { anzahl?: number; pacht?: number; wartenMs?: number };
  try { body = await jsonBegrenzt(req); } catch { body = {}; }
  const anzahl = Math.max(1, Math.min(16, Number(body.anzahl) || 4));
  const pacht = Math.max(60, Math.min(1800, Number(body.pacht) || 300));
  const wartenMs = Math.max(0, Math.min(20_000, Number(body.wartenMs) || 0));
  const stand = weckStand();
  let genommen = await nimm(anzahl, pacht);
  if (!genommen.length && wartenMs > 0) {
    if (await aufWecken(wartenMs, stand, req.signal)) genommen = await nimm(anzahl, pacht);
    return NextResponse.json({ ok: true, auftraege: genommen, gewartet: true });
  }
  return NextResponse.json({ ok: true, auftraege: genommen, ...(wartenMs > 0 ? { gewartet: true } : {}) });
}
