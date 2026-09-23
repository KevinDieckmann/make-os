// ─── MAKE OS — Whoop-Export einlesen ────────────────────────────────────────
// Kevins Ansage: „Zieh dir die neuesten Whoop-Werte, dann haben wir die Daten
// sauber drin für Gesundheit."
//
// Die Whoop-Mail meldet nur, dass ein Export bereitsteht — die Zahlen stecken
// im ZIP dahinter. Diese Route nimmt daraus die Datei
// „physiologische_zyklen.csv" und schreibt jeden Tag in den Vitalwerte-Bestand.
//
// Warum CSV statt API: die Whoop-API braucht eine App-Registrierung und liegt
// im Bauplan. Bis dahin ist der Export der Weg, der ohne Zugangsdaten
// funktioniert — und er liefert die volle Historie, nicht nur heute.
//
// Bestehende Tage werden ERGÄNZT, nicht ersetzt: was Kevin von Hand eingetragen
// hat (etwa eine Notiz), bleibt stehen.

import { NextResponse } from 'next/server';
import { updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Tag { rec?: number; sleep?: number; hrv?: number; rhr?: number; note?: string }
type Log = Record<string, Tag>;

/** Spalten des deutschen Exports → unsere Felder. */
const SPALTEN = {
  start: 'Startzeit des Zyklus',
  rec: 'Erholungswert %',
  rhr: 'Ruheherzfrequenz (Schläge pro Minute)',
  hrv: 'Herzfrequenzvariabilität (ms)',
  schlafMin: 'Schlafdauer (Min.)',
} as const;

/** CSV-Zeile zerlegen — Whoop quotet Felder mit Komma. */
function zerlege(zeile: string): string[] {
  const out: string[] = [];
  let feld = '', inAnf = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (c === '"') { if (inAnf && zeile[i + 1] === '"') { feld += '"'; i++; } else inAnf = !inAnf; }
    else if (c === ',' && !inAnf) { out.push(feld); feld = ''; }
    else feld += c;
  }
  out.push(feld);
  return out;
}

const zahl = (s: string | undefined, min: number, max: number, stellen = 0): number | undefined => {
  if (!s?.trim()) return undefined;
  const n = Number(s.replace(',', '.'));
  if (!isFinite(n) || n < min || n > max) return undefined;
  return stellen ? Math.round(n * 10 ** stellen) / 10 ** stellen : Math.round(n);
};

export async function POST(req: Request) {
  let csv: string;
  try {
    const body = await req.json();
    csv = String(body.csv ?? '');
  } catch { return NextResponse.json({ ok: false, error: 'Kein JSON mit Feld "csv".' }, { status: 400 }); }

  const zeilen = csv.split(/\r?\n/).filter(z => z.trim());
  if (zeilen.length < 2) return NextResponse.json({ ok: false, error: 'CSV ist leer.' }, { status: 400 });

  const kopf = zerlege(zeilen[0]).map(s => s.trim());
  const idx = Object.fromEntries(Object.entries(SPALTEN).map(([k, name]) => [k, kopf.indexOf(name)])) as Record<keyof typeof SPALTEN, number>;
  if (idx.start < 0 || idx.rec < 0) {
    return NextResponse.json(
      { ok: false, error: 'Das sieht nicht nach „physiologische_zyklen.csv" aus — die Spalten „Startzeit des Zyklus" und „Erholungswert %" fehlen.' },
      { status: 400 },
    );
  }

  const neu: Log = {};
  let ohneWerte = 0;
  for (const z of zeilen.slice(1)) {
    const f = zerlege(z);
    const datum = (f[idx.start] ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;

    const schlafMin = zahl(f[idx.schlafMin], 0, 24 * 60);
    const tag: Tag = {
      rec: zahl(f[idx.rec], 0, 100),
      rhr: zahl(f[idx.rhr], 20, 200),
      hrv: zahl(f[idx.hrv], 0, 300),
      sleep: schlafMin != null ? Math.round((schlafMin / 60) * 10) / 10 : undefined,
    };
    (Object.keys(tag) as (keyof Tag)[]).forEach(k => { if (tag[k] === undefined) delete tag[k]; });

    // Zeilen ohne jede Messung (Whoop legt für Lücken leere Zyklen an) überspringen.
    if (!Object.keys(tag).length) { ohneWerte++; continue; }
    // Neuere Zeile gewinnt nicht über eine frühere desselben Tages — die Datei
    // ist neueste-zuerst, der erste Treffer je Tag ist der vollständigste.
    if (!neu[datum]) neu[datum] = tag;
  }

  const tage = Object.keys(neu).sort();
  if (!tage.length) return NextResponse.json({ ok: false, error: 'Keine verwertbaren Zeilen gefunden.' }, { status: 400 });

  let ergaenzt = 0, dazu = 0;
  await updateJson<Log>('vitals', current => {
    const log: Log = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
    for (const [d, t] of Object.entries(neu)) {
      if (log[d]) { log[d] = { ...t, ...(log[d].note ? { note: log[d].note } : {}) }; ergaenzt++; }
      else { log[d] = t; dazu++; }
    }
    return log;
  });

  return NextResponse.json({
    ok: true,
    tage: tage.length, neu: dazu, aktualisiert: ergaenzt, uebersprungen: ohneWerte,
    von: tage[0], bis: tage[tage.length - 1],
  });
}
