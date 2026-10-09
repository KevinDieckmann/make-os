// ─── MAKE OS — Das Symptom-Tagebuch (Modul `haut`, Bestand `haut`) ──────────
// Ein allgemeiner Tracker je Person: Wert 0–10, Schub, Stellen, Auslöser — ein Eintrag je Tag. Wie der Regler
// heißt, legt die Person in ihrem Körper-Profil fest (08.10. abends: keine Inhalte einer Person im Code). Seit 09.10.
// ein MODUL je Person (lib/gesundheit/module.ts): aus → nichts wird angenommen (409), andere sehen nichts.
//
// GET  ?fuer=<person>  → Log + Trend + `modul` (an/aus). Wer die Gesundheit der Person sehen darf, liest mit — aber nur,
//                        solange ihr Modul an ist (sonst leer). Die eigene Person bekommt ihre Einträge immer.
// PUT  { datum?, eintrag } → einen Tag setzen (nur die eigene Person; Einwilligung (a), dann Modul an)

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/zoe/raum';
import { saeubereHaut, hautTrend, type HautLog } from '@/lib/gesundheit/eintraege';
import { localDay } from '@/lib/zeit';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';
import { moduleFuer, modulSchreibSperre } from '@/lib/gesundheit/module-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  leseZugriff(req, 'gesundheit', { betroffen: person }); // Lese-Protokoll (Art. 9, 05.10.)
  const modul = (await moduleFuer(person)).haut;
  // Modul aus: eine andere Person bekommt nichts (serverseitig, nicht nur ausgeblendet); die eigenen Einträge bleiben lesbar.
  const log = modul || person === personAus(req) ? ((await loadJson<HautLog>(speicherFuer('haut', person))) ?? {}) : {};
  return NextResponse.json({ person, modul, log, trend: hautTrend(log, localDay()) });
}

export async function PUT(req: Request) {
  // Art. 9 (05.10.): erfasst wird nur mit Einwilligung (a) der Person (Bestand: wie bisher, bis sie erklärt).
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let b: { datum?: string; eintrag?: unknown };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!personStreng(req)) return ohnePerson();
  const datum = b.datum && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : localDay();
  const e = saeubereHaut(b.eintrag, new Date().toISOString());
  if (!e) return NextResponse.json({ error: 'eintrag.juckreiz (0–10) fehlt.' }, { status: 400 });
  const person = personAus(req);
  // Modul je Person (09.10.): ausgeschaltet (oder nie eingeschaltet) → 409, nichts gespeichert.
  { const aus = await modulSchreibSperre(person, 'haut'); if (aus) return aus; }
  const log = await updateJson<HautLog>(speicherFuer('haut', person), current => ({ ...(current ?? {}), [datum]: e }));
  return NextResponse.json({ ok: true, datum, eintrag: e, trend: hautTrend(log, localDay()) });
}
