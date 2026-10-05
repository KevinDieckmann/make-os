// ─── MAKE OS — Das Haut-Tagebuch ────────────────────────────────────────────
// Schuppenflechte: Juckreiz 0–10, Schub, Stellen, Auslöser — ein Eintrag je
// Tag. Kevin am 29.07.: „Ich merke, wenn mein Stresslevel hoch ist oder ich
// nervös werde, kratze ich." Hier wird das sichtbar, und beim Hautarzt sind es
// Zahlen statt Erinnerung.
//
// GET  ?fuer=kevin|malin  → Log + Trend (Kevins Entscheidung 23.09.: Malin
//                            sieht alles — beide dürfen die Seite der anderen
//                            Person LESEN; geschrieben wird nur die eigene)
// PUT  { datum?, eintrag } → einen Tag setzen

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/zoe/raum';
import { saeubereHaut, hautTrend, type HautLog } from '@/lib/gesundheit/eintraege';
import { localDay } from '@/lib/zeit';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  leseZugriff(req, 'gesundheit', { betroffen: person }); // Lese-Protokoll (Art. 9, 05.10.)
  const log = (await loadJson<HautLog>(speicherFuer('haut', person))) ?? {};
  return NextResponse.json({ person, log, trend: hautTrend(log, localDay()) });
}

export async function PUT(req: Request) {
  // Art. 9 (05.10.): erfasst wird nur mit Einwilligung (a) der Person (Bestand: wie bisher, bis sie erklärt).
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let b: { datum?: string; eintrag?: unknown };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const datum = b.datum && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : localDay();
  const e = saeubereHaut(b.eintrag, new Date().toISOString());
  if (!e) return NextResponse.json({ error: 'eintrag.juckreiz (0–10) fehlt.' }, { status: 400 });
  const person = personAus(req);
  const log = await updateJson<HautLog>(speicherFuer('haut', person), current => ({ ...(current ?? {}), [datum]: e }));
  return NextResponse.json({ ok: true, datum, eintrag: e, trend: hautTrend(log, localDay()) });
}
