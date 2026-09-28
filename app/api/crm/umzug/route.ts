// ─── CRM — Übernahme aus dem Brain ──────────────────────────────────────────
// POST { daten: BrainDaten, verknuepfung?: { mandatId: planpostenId } }
// Archiviert CRM und Kartei zuerst (.data/archiv), übernimmt dann Kunden
// (Ansprechpartner in die Kartei), Mandate und Leistungen — wiederholbar,
// ohne eigene Änderungen zu überschreiben. Nur mit Dienstschlüssel oder
// angemeldet (Middleware); Daten kommen aus dem Aufruf, nie aus dem Repo.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { archivSchreiben, archivZeit } from '@/lib/store/archiv';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/zoe/raum';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm, leererBestand } from '@/lib/crm/speicher';
import { ausBrain, type BrainDaten } from '@/lib/crm/umzug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { daten?: BrainDaten; verknuepfung?: Record<string, string> };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!b.daten || typeof b.daten !== 'object') return NextResponse.json({ ok: false, fehler: 'daten fehlt.' }, { status: 400 });
  const person = personAus(req);
  const jetzt = new Date().toISOString();
  // Verschlüsselt wie die Bestände (28.09., F2 — lib/store/archiv.ts), nie mehr Klartext neben den Hüllen.
  const archiv = await archivSchreiben(`crm-vor-brain-umzug-${archivZeit(jetzt)}.json`, { crm: await ladeCrm(), kontakte: await loadJson('kontakte') });

  const heute = localDay();
  // 1. Kartei: Ansprechpartner anlegen oder ergänzen.
  let kartei: ReturnType<typeof ausBrain> | null = null;
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    kartei = ausBrain({ kunden: b.daten!.kunden }, leererBestand(), f.kontakte, heute, jetzt, person);
    return { ...f, kontakte: kartei.kontakte };
  });
  // 2. CRM: Leistungen und Mandate — gegen die fertige Kartei, damit jedes Mandat seine Ansprechpartner kennt.
  let crm: ReturnType<typeof ausBrain> | null = null;
  const fertig = await aendereCrm(cur => {
    crm = ausBrain(b.daten!, cur, (kartei as ReturnType<typeof ausBrain> | null)?.kontakte ?? [], heute, jetzt, person, b.verknuepfung ?? {});
    return crm.bestand;
  });
  const e = crm as ReturnType<typeof ausBrain> | null;
  const k = kartei as ReturnType<typeof ausBrain> | null;
  return NextResponse.json({
    ok: true, archiv,
    neu: { mandate: e?.neu.mandate ?? 0, leistungen: e?.neu.leistungen ?? 0, kontakte: k?.neu.kontakte ?? 0 },
    vorhanden: { mandate: e?.vorhanden.mandate ?? 0, leistungen: e?.vorhanden.leistungen ?? 0, kontakte: k?.vorhanden.kontakte ?? 0 },
    mandateMitKontakt: fertig.mandate.filter(m => m.kontaktIds.length).length, mandate: fertig.mandate.length,
  });
}
