// ─── MAKE OS — Tagesvitalwerte speichern (lokal, privat) ────────────────────
// Log: { "YYYY-MM-DD": { rec, sleep, hrv, rhr, note } }
// GET            → komplettes Log + die aktuell gültigen Werte
// PUT { date, vitals } → einen Tag setzen (ohne die anderen zu verlieren)

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/jarvis/raum';
import { resolveVitals, localDay, type VitalsLog, type DayVitals } from '@/lib/vitals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const num = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v);
  if (!isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, n));
};

export async function GET(req: Request) {
  // Körperwerte sind persönlich: Kevin und Malin schreiben in getrennte
  // Speicher. Vorher hätte ihr Morgen-Check seinen überschrieben.
  // Lesen dürfen sich beide gegenseitig (?fuer=, seit 23.09.).
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  const log = (await loadJson<VitalsLog>(speicherFuer('vitals', person))) ?? {};
  // Auch der Rückfallwert gehört der Person: resolveVitals nimmt für Kevin
  // seinen Whoop-Export als Ausgangspunkt und für Malin ehrlich Null. Ohne
  // das stand bei ihr Kevins Recovery von 81 % als ihr eigener Wert.
  const aktuell = await resolveVitals(undefined, person);
  return NextResponse.json({ log, aktuell });
}

export async function PUT(req: Request) {
  let body: { date?: string; vitals?: DayVitals };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : localDay();
  const v = body.vitals ?? {};

  // Nur plausible Werte übernehmen — ein Tippfehler soll die Tagesform nicht kippen.
  const clean: DayVitals = {
    rec: num(v.rec, 0, 100),
    sleep: num(v.sleep, 0, 24),
    hrv: num(v.hrv, 0, 300),
    rhr: num(v.rhr, 20, 200),
    note: typeof v.note === 'string' ? v.note.slice(0, 400) : undefined,
  };
  // Leere Felder nicht speichern (sonst überschreibt ein leeres Formular gute Werte).
  (Object.keys(clean) as (keyof DayVitals)[]).forEach(k => { if (clean[k] === undefined) delete clean[k]; });

  if (!Object.keys(clean).length) {
    return NextResponse.json({ ok: false, error: 'Keine gültigen Werte übergeben.' }, { status: 400 });
  }

  // Serialisiert lesen-ändern-schreiben: sonst überschreibt ein paralleler
  // Schreiber die anderen Tage.
  const person = personAus(req);
  await updateJson<VitalsLog>(speicherFuer('vitals', person), current => {
    const log = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    return { ...log, [date]: { ...(log[date] ?? {}), ...clean } };
  });

  // Verbindung zum Journal: Stimmung/Energie/Stress gehören fachlich dorthin
  // (Trends, Säule „Beziehung & Ruhe"). Kevin soll sie aber im Morgen-Check
  // miterfassen können, statt sich an zwei Stellen einzutragen.
  const b = body as { mood?: number; energy?: number; stress?: number };
  const jrnl: Record<string, number> = {};
  const j1 = num(b.mood, 1, 5); if (j1 !== undefined) jrnl.mood = j1;
  const j2 = num(b.energy, 1, 5); if (j2 !== undefined) jrnl.energy = j2;
  const j3 = num(b.stress, 1, 5); if (j3 !== undefined) jrnl.stress = j3;
  if (Object.keys(jrnl).length) {
    await updateJson<Record<string, Record<string, unknown>>>(speicherFuer('journal', person), current => {
      const log = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
      // Vorhandenen Freitext des Tages nicht anfassen.
      return { ...log, [date]: { ...(log[date] ?? {}), ...jrnl, at: new Date().toISOString() } };
    });
  }

  // Auch der Rückfallwert gehört der Person: resolveVitals nimmt für Kevin
  // seinen Whoop-Export als Ausgangspunkt und für Malin ehrlich Null. Ohne
  // das stand bei ihr Kevins Recovery von 81 % als ihr eigener Wert.
  const aktuell = await resolveVitals(undefined, person);
  return NextResponse.json({ ok: true, date, aktuell });
}
