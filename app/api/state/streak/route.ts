// ─── MAKE OS — Der Zähler „Sauber geblieben“ (Modul `serie`, Bestand `streak`) ─
// Ein allgemeiner Zähler je Person: ein Eintrag je Tag, sauber ja/nein, Verlangen 0–10. Er misst Tage seit dem letzten
// Rückfall — ein vergessener Abend nimmt ihn nicht weg (Regel in eintraege.ts). Wovon die Person Abstand hält, steht nirgends
// im Code. Seit 09.10. ein MODUL je Person (lib/gesundheit/module.ts): aus → nichts wird angenommen (409), andere sehen nichts.
//
// GET  ?fuer=<person> → Log + Stand + `modul`; andere lesen nur mit Freigabe UND eingeschaltetem Modul (sonst leer).
// PUT  { datum?, eintrag } → einen Tag setzen (nur die eigene Person; Einwilligung (a), dann Modul an).
//
// Haltung: unterstützend, nie wertend. Ein Rückfall ist ein Datum.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/zoe/raum';
import { saeubereStreak, streakStand, type StreakLog } from '@/lib/gesundheit/eintraege';
import { localDay } from '@/lib/zeit';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';
import { moduleFuer, modulSchreibSperre } from '@/lib/gesundheit/module-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  leseZugriff(req, 'gesundheit', { betroffen: person }); // Lese-Protokoll (Art. 9) — wie das Symptom-Tagebuch
  const modul = (await moduleFuer(person)).serie;
  // Modul aus: eine andere Person bekommt nichts (serverseitig); die eigenen Einträge bleiben lesbar.
  const log = modul || person === personAus(req) ? ((await loadJson<StreakLog>(speicherFuer('streak', person))) ?? {}) : {};
  return NextResponse.json({ person, modul, log, stand: streakStand(log, localDay()) });
}

export async function PUT(req: Request) {
  // Art. 9 (05.10.): erfasst wird nur mit Einwilligung (a) der Person (Bestand: wie bisher, bis sie erklärt).
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let b: { datum?: string; eintrag?: unknown };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!personStreng(req)) return ohnePerson();
  const datum = b.datum && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : localDay();
  const e = saeubereStreak(b.eintrag, new Date().toISOString());
  if (!e) return NextResponse.json({ error: 'eintrag.sauber (true/false) fehlt.' }, { status: 400 });
  const person = personAus(req);
  // Modul je Person (09.10.): ausgeschaltet (oder nie eingeschaltet) → 409, nichts gespeichert.
  { const aus = await modulSchreibSperre(person, 'serie'); if (aus) return aus; }
  const log = await updateJson<StreakLog>(speicherFuer('streak', person), current => ({ ...(current ?? {}), [datum]: e }));
  return NextResponse.json({ ok: true, datum, eintrag: e, stand: streakStand(log, localDay()) });
}
