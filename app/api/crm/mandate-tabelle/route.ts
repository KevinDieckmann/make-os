// ─── Mandate als Tabelle einfügen (09.10., ONBOARDING_PLAN.md › B9 c / L28) ─────────────────────────────────────────────────────
// GET  → { laeufe } — die letzten Einfügungen (Kennung, Zeitpunkt, Status, Anzahlen; keine Namen) für „Rückgängig“ nach dem Neuladen.
// POST { aktion: 'vorschau', zeilen: [{ quelle, werte: { kunde, produkt, honorar, start, laufzeit, gesellschaft, … } }], gesellschaft? }
//        → Vorschau je Zeile (neu · geändert · gleich · übersprungen · Fehler) mit Firmen-Zuordnung, `basis` — schreibt nichts.
//      { aktion: 'uebernehmen', …, basis, auswahl? } → Firmen über `firmaSichern`, Mandate über den CRM-Schreibweg (alles oder nichts); 409 bei
//        veralteter Vorschau. { aktion: 'zurueck', laufId } → nur Unverändertes (Mandate, dann die vom Lauf angelegten Firmen ohne Verweise).
// Regeln: lib/crm/mandate-tabelle.ts (rein) + lib/crm/mandate-tabelle-server.ts. Zugang wie der CRM-Bestand (Haushalt des Inhabers); schreiben
// nur von Hand (Dienstweg 403 — viele Mandate auf einmal entscheidet ein Mensch), Bau-Kennung, Körper ≤ 20 MB (`jsonBegrenzt`).

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { mandatLaeufe, mandateTabelleUebernehmen, mandateTabelleVorschau, mandateTabelleZurueck } from '@/lib/crm/mandate-tabelle-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Nur im Haushalt des Inhabers.' };

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  return NextResponse.json({ ok: true, laeufe: await mandatLaeufe() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  if (zugang.dienst) return NextResponse.json({ ok: false, fehler: 'Mandate aus einer Tabelle übernimmt nur eine angemeldete Person, nicht der Dienstweg.' }, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return NextResponse.json({ ok: false, fehler: 'Kein JSON-Objekt.' }, { status: 400 });
  const r = b.aktion === 'vorschau' ? await mandateTabelleVorschau(b)
    : b.aktion === 'uebernehmen' ? await mandateTabelleUebernehmen(b, zugang.person, werAus(req))
    : b.aktion === 'zurueck' ? await mandateTabelleZurueck(b.laufId, zugang.person, werAus(req))
    : null;
  if (!r) return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion (vorschau, uebernehmen, zurueck).' }, { status: 400 });
  return NextResponse.json(r, { status: r.ok ? 200 : r.status });
}
