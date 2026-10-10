// ─── Produkte & Mandate · Leistungstreppe (10.10.) ──────────────────────────────────────────────────────────────────
// Entscheidung 10.10.: die Pakete sauber abbilden und immer visualisieren — wohin wir wollen und warum die Schritte so wichtig sind.
// GET   → Treppe (Stufen mit Stand), Kundenreise (Stationen mit Ist), Zielbild (Ziel/Ist je Stufe, Übergänge), Roadmap, Positionierung,
//         je aktivem Mandat der Fortschritt im Paket (Stufe, Schritt, Lieferobjekte, nächster Schritt, Health-Ampel, nächste Stufe, Report),
//         Kapazität (Aufwand je Woche gegen freie Stunden), offene Dokument-Vorschläge der Person (Feld-Häkchen), ob KI verfügbar ist
//       ?space=privat → 400: Produkte & Mandate sind Business (die Middleware sperrt die Sicht Privat ohnehin für /api/crm)
// PATCH { ops } → Einzel-Schritte (lib/crm/treppe-daten.ts `TreppeOp`), Ändern/Löschen nur mit Stand (409), über den Grenzen 413, Unsinn 400 —
//         nie still gekürzt; nur eine angemeldete Person (Dienstweg 403)
// Zugang: Haushalt des Inhabers (Modul Markttraktion) — auch ein Konto mit `finanzRecht: 'business'` (Produkte sind Business).
// Speicher: `produkt-treppe--<haushalt>` (lib/crm/treppe-server.ts).

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { jsonAntwort } from '@/lib/http/json-antwort';
import { NUR_BUSINESS_TREPPE } from '@/lib/crm/treppe-daten';
import { treppeLage, treppeSchreiben, ladeTreppe, mitStaenden } from '@/lib/crm/treppe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Größe eines Änderungs-Körpers (60 Schritte mit Texten) — darüber 413. */
const MAX_BYTES = 512_000;

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  if (new URL(req.url).searchParams.get('space') === 'privat') return NextResponse.json({ ok: false, fehler: NUR_BUSINESS_TREPPE }, { status: 400 });
  const lage = await treppeLage(zugang.person);
  leseZugriff(req, 'firmen', { anzahl: lage.kunden.length }); // Lese-Protokoll: Mandate (Kunden) und ihr Fortschritt
  return jsonAntwort(req, { ok: true, ...lage });
}

export async function PATCH(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  if (zugang.dienst) return NextResponse.json({ ok: false, fehler: 'Die Leistungstreppe ändert nur eine angemeldete Person.' }, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { ops?: unknown };
  try { b = await jsonBegrenzt(req, MAX_BYTES); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const r = await treppeSchreiben(b.ops, zugang.person, werAus(req));
  if (r.ok) return NextResponse.json({ ok: true, geaendert: r.geaendert, datei: mitStaenden(r.datei) });
  if (r.status === 409) return NextResponse.json({ ok: false, fehler: 'Inzwischen hat jemand anderes geändert — neu geladen, bitte noch einmal.', konflikt: true, konflikte: r.konflikte, datei: mitStaenden(await ladeTreppe()) }, { status: 409 });
  return NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
}
