// ─── MAKE OS — Gesundheits-Tracking (lokal) ─────────────────────────────────
// Log: { "YYYY-MM-DD": ["journal","supps",...] } — welche Routinen an dem Tag
// erledigt wurden. So entstehen Streaks & Verlauf, lokal auf dem Mac.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, saveJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/zoe/raum';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';

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
  return NextResponse.json({ log });
}

export async function PUT(req: Request) {
  // Art. 9 (05.10.): erfasst wird nur mit Einwilligung (a) der Person (Bestand: wie bisher, bis sie erklärt).
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let body: unknown;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!personStreng(req)) return ohnePerson();
  const log = body as HealthLog;
  if (!log || typeof log !== 'object' || Array.isArray(log)) {
    return NextResponse.json({ ok: false, error: 'Ungültiges Log.' }, { status: 400 });
  }
  // Schrumpf-Wächter: verliert der neue Bestand mehr als die Hälfte der Tage,
  // ist das fast immer ein Client-Fehler — nicht still überschreiben.
  const speicher = speicherFuer('health-log', personAus(req));
  const bisher = (await loadJson<Record<string, unknown>>(speicher)) ?? {};
  const alt = Object.keys(bisher).length;
  const neu = Object.keys(log).length;
  if (alt >= 6 && neu < alt / 2) {
    return NextResponse.json({ ok: false, error: `Verweigert: der neue Stand hätte ${neu} statt ${alt} Tagen — sieht nach Datenverlust aus. Sicherung liegt unter .data/backup/.` }, { status: 409 });
  }
  await saveJson(speicher, log);
  return NextResponse.json({ ok: true });
}

/**
 * PATCH { tag?, routine, erledigt } → EINE Routine an EINEM Tag abhaken bzw. lösen (09.10., Ergänzungen & Trinken am Handy). In einer
 * Sperre — anders als PUT schickt der Browser nie den ganzen Bestand (zwei Geräte überschreiben sich so nicht). Nur die eigene Person.
 */
export async function PATCH(req: Request) {
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let b: { tag?: unknown; routine?: unknown; erledigt?: unknown };
  try { b = await jsonBegrenzt(req, 4_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const person = personStreng(req);
  if (!person) return ohnePerson();
  const tag = typeof b?.tag === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.tag) ? b.tag : b?.tag === undefined ? localDay() : null;
  if (!tag) return NextResponse.json({ ok: false, error: 'tag: bitte als JJJJ-MM-TT.' }, { status: 400 });
  if (typeof b.routine !== 'string' || !/^[A-Za-z0-9_-]{1,60}$/.test(b.routine)) return NextResponse.json({ ok: false, error: 'routine (Kennung) fehlt.' }, { status: 400 });
  if (typeof b.erledigt !== 'boolean') return NextResponse.json({ ok: false, error: 'erledigt: true oder false.' }, { status: 400 });
  const routine = b.routine, an = b.erledigt;
  const log = await updateJson<HealthLog>(speicherFuer('health-log', person), cur => {
    const l = cur ?? {};
    const liste = new Set(l[tag] ?? []);
    if (an) liste.add(routine); else liste.delete(routine);
    const neu = { ...l };
    if (liste.size) neu[tag] = [...liste]; else delete neu[tag];
    return neu;
  });
  return NextResponse.json({ ok: true, tag, erledigt: log[tag] ?? [] });
}
