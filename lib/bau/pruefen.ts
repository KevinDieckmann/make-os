// ─── Build-Kennung prüfen (Server, 29.09., A2) — siehe lib/bau/kennung.ts ───
// In jede schreibende Route, die geteilte Bestände ändert (Aufgaben, CRM, Kartei, Angebote …), direkt nach der
// Zugangsprüfung: `const alt = bauPruefen(req); if (alt) return alt;`

import { NextResponse } from 'next/server';
import { istDienst } from '@/lib/zugang/dienst';
import { BAU_KOPF, NEU_LADEN_TEXT, bauKennung } from './kennung';

/** Kommt die Anfrage aus einem anderen Bau (oder ohne Kennung)? Dienstweg und Läufe ohne eigene Kennung: nie. */
export function bauFremd(req: Request): boolean {
  const eigen = bauKennung();
  if (!eigen || istDienst(req)) return false;
  return req.headers.get(BAU_KOPF) !== eigen;
}

/** 409 `{ neuLaden: true }` für fremde Baue — sonst null. */
export function bauPruefen(req: Request): NextResponse | null {
  if (!bauFremd(req)) return null;
  return NextResponse.json({ ok: false, neuLaden: true, error: NEU_LADEN_TEXT, fehler: NEU_LADEN_TEXT }, { status: 409 });
}
