// ─── Markttraktion · Planung (Schnellknopf „Planung“, 10.10.) ───────────────────────────────────────────────────
// Kevin: „Umsatzziele auf einzelne Aktivitäten runterplanen — Sales, Marketing, was auch immer — mit Kapa und allem, was dazugehört.“
// GET   ?kanal=<lk-…|ohne>  → Leadkanäle (mit Plan/Ist je Quote), der Kreislauf, Umsatzziele mit Rückwärts-Trichter, Wochenziele,
//                             Bedarf gegen Kapazität, Challenges (Fortschritt aus echten Aktivitäten, Vorschläge aus den Lücken)
//       ?space=privat       → 400: die Markttraktion gehört zu Business, der Privat-Bereich bekommt hier nichts
// PATCH { ops }              → Einzel-Schritte (lib/crm/planung-daten.ts `PlanungOp`), Ändern/Löschen nur mit Stand des Eintrags (409),
//                             über den Grenzen 413, Unsinn 400 — nie still gekürzt; nur eine angemeldete Person (Dienstweg 403)
// Zugang: Haushalt des Inhabers (Modul Markttraktion) — auch ein Konto mit `finanzRecht: 'business'` (die Planung ist Business).
// Speicher: `markttraktion-planung--<haushalt>` (lib/crm/planung-server.ts).

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { jsonAntwort } from '@/lib/http/json-antwort';
import { KANAL_ID, NUR_BUSINESS } from '@/lib/crm/planung-daten';
import { planungLage, planungSchreiben, ladePlanung, mitStaenden } from '@/lib/crm/planung-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Größe eines Änderungs-Körpers (60 Schritte mit Text) — darüber 413. */
const MAX_BYTES = 256_000;

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  const u = new URL(req.url);
  if (u.searchParams.get('space') === 'privat') return NextResponse.json({ ok: false, fehler: NUR_BUSINESS }, { status: 400 });
  const k = u.searchParams.get('kanal');
  const filter = k === 'ohne' ? 'ohne' : k && KANAL_ID.test(k) ? k : null;
  const lage = await planungLage(zugang.person, filter);
  leseZugriff(req, 'firmen', { anzahl: lage.kreislauf.kunden.length }); // Lese-Protokoll: Kunden (Mandate) und Kennzahlen der Markttraktion
  return jsonAntwort(req, { ok: true, filter, ...lage });
}

export async function PATCH(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  if (zugang.dienst) return NextResponse.json({ ok: false, fehler: 'Die Planung ändert nur eine angemeldete Person.' }, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { ops?: unknown };
  try { b = await jsonBegrenzt(req, MAX_BYTES); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const r = await planungSchreiben(b.ops, zugang.person, werAus(req));
  if (r.ok) return NextResponse.json({ ok: true, geaendert: r.geaendert, datei: mitStaenden(r.datei) });
  if (r.status === 409) return NextResponse.json({ ok: false, fehler: 'Inzwischen hat jemand anderes geändert — neu geladen, bitte noch einmal.', konflikt: true, konflikte: r.konflikte, datei: mitStaenden(await ladePlanung()) }, { status: 409 });
  return NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
}
