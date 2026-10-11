// ─── MAKE OS — Gesundheits-Tracking (lokal) ─────────────────────────────────
// Log: { "YYYY-MM-DD": ["journal","supps",...] } — welche Routinen an dem Tag
// erledigt wurden. So entstehen Streaks & Verlauf, lokal auf dem Mac.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { bauPruefen } from '@/lib/bau/pruefen';
import { logZusammenfuehren } from '@/lib/gesundheit/zusammenfuehren';
import { localDay } from '@/lib/zeit';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/zoe/raum';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';
import { routineHaken, zaehlerVon } from '@/lib/planung/routinen-haken-server';
import { hakenOpAus } from '@/lib/planung/routinen-person';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type HealthLog = Record<string, string[]>;

export async function GET(req: Request) {
  // Wer welche Routine abgehakt hat, gehört der Person — nicht dem Haushalt.
  // Lesen dürfen sich beide gegenseitig (?fuer=, seit 23.09.).
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  leseZugriff(req, 'gesundheit', { betroffen: person }); // Lese-Protokoll (Art. 9, 05.10.)
  const log = (await loadJson<HealthLog>(speicherFuer('health-log', person))) ?? {};
  // Routinen 2 (10.10.): Zähler je Tag („5 von 8“) — dasselbe Tor wie der Log (die Person selbst oder wer ihre Gesundheit geteilt bekommt).
  return NextResponse.json({ log, zaehler: await zaehlerVon(person) });
}

/**
 * PUT = Altweg (die Online-Version vor dem 09.10. und alte PWA-Tabs schicken den ganzen Log). Prüf-Fund 11.10.: so überschrieb ein alter Tab
 * Haken, die inzwischen per PATCH gesetzt wurden. Darum (1) fremde Bau-Kennung → 409 „neu laden“ (`bauPruefen`), (2) tagesweise
 * ZUSAMMENFÜHREN statt ersetzen: je Tag die Vereinigung aus gespeichertem und geschicktem Stand — ein Haken geht über PUT nie verloren,
 * Tage, die der Körper nicht nennt, bleiben unverändert. Abhaken lösen geht nur über PATCH (die eine Schreibstelle `routineHaken`).
 */
export async function PUT(req: Request) {
  // Art. 9 (05.10.): erfasst wird nur mit Einwilligung (a) der Person (Bestand: wie bisher, bis sie erklärt).
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let body: unknown;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!personStreng(req)) return ohnePerson();
  { const alt = bauPruefen(req); if (alt) return alt; }
  const log = body as HealthLog;
  if (!log || typeof log !== 'object' || Array.isArray(log)) {
    return NextResponse.json({ ok: false, error: 'Ungültiges Log.' }, { status: 400 });
  }
  await updateJson<HealthLog>(speicherFuer('health-log', personAus(req)), bisher => logZusammenfuehren(bisher ?? {}, log));
  return NextResponse.json({ ok: true });
}

/**
 * PATCH { tag?, routine, erledigt } → EINE Routine an EINEM Tag abhaken bzw. lösen (09.10., Ergänzungen & Trinken am Handy). In einer
 * Sperre — anders als PUT schickt der Browser nie den ganzen Bestand (zwei Geräte überschreiben sich so nicht). Nur die eigene Person.
 * Routinen 2 (10.10.): `{ routine, zaehler: 'plus' | 'minus' | n, anzahl? }` zählt („5 von 8 Gläsern“, mehrmals täglich); der Haken im Log
 * steht, sobald das Tagesziel erreicht ist. Geschrieben wird NUR über `routineHaken` (lib/planung/routinen-haken-server.ts) — Zähler und Log in
 * einer Sperre. Antwort zusätzlich `ist`/`ziel`. Eine Kennung, die keine Routine ist, nimmt `erledigt` weiter als einfachen Haken an.
 */
export async function PATCH(req: Request) {
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let b: { tag?: unknown; routine?: unknown; erledigt?: unknown; zaehler?: unknown; anzahl?: unknown };
  try { b = await jsonBegrenzt(req, 4_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const person = personStreng(req);
  if (!person) return ohnePerson();
  const tag = typeof b?.tag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.tag) ? b.tag : b?.tag === undefined ? localDay() : null;
  if (!tag) return NextResponse.json({ ok: false, error: 'tag: bitte als JJJJ-MM-TT.' }, { status: 400 });
  if (typeof b.routine !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(b.routine)) return NextResponse.json({ ok: false, error: 'routine (Kennung) fehlt.' }, { status: 400 });
  const op = hakenOpAus(b);
  if (!op) return NextResponse.json({ ok: false, error: b.zaehler !== undefined || b.anzahl !== undefined ? 'zaehler: „plus“, „minus“ oder eine Zahl 0–99 (anzahl 1–99).' : 'erledigt: true oder false.' }, { status: 400 });
  const r = await routineHaken(person, b.routine, op, tag, { fremdeKennungOk: true });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler }, { status: r.status });
  return NextResponse.json({ ok: true, tag, erledigt: r.erledigt, ist: r.ist, ziel: r.ziel });
}
