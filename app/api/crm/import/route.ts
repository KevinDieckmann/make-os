// ─── MAKE OS — Import der Masterliste ───────────────────────────────────────
// Liest Kevins CRM_MASTER_Hauptdatei.csv vom Schreibtisch und führt sie mit
// dem Bestand zusammen. Idempotent: zweimal laufen ändert nichts. Die
// Pipeline (Stufe, Wiedervorlage, Aktivitäten) bleibt beim Abgleich unberührt.
//
// Der Pfad ist auf den Leadordner beschränkt. Die Schnittstelle ist zwar
// schlüsselgeschützt, aber „lies mir beliebige Dateien" darf trotzdem keine
// Route können — Default-Deny, wie überall in dieser Software.
//
// Seit 26.09. (Malin: „Datei nicht lesbar“ online): { csv, name } schickt die
// Datei selbst — auf Hetzner gibt es keinen Schreibtisch. Höchstens 12 MB.

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { loadJson, updateGeschuetzt } from '@/lib/store/local-db';
import { csvLesen, trennerVon } from '@/lib/make-one/csv';
import { importieren, pipelineStand, type Kontakt } from '@/lib/make-one/crm';
import { firmenAbgleichen } from '@/lib/crm/abgleich';
import { localDay } from '@/lib/zeit';
import { logRun } from '@/lib/agent-log';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDNER = join(homedir(), 'Desktop', 'CRM Leadordner');
const STANDARD = join(ORDNER, 'CRM_MASTER_Hauptdatei.csv');

interface Bestand { kontakte: Kontakt[] }

export async function POST(req: Request) {
  if (zuGross(req, 12_000_000)) return ZU_GROSS(12_000_000);
  let body: { pfad?: string; csv?: string; name?: string } = {};
  try { body = await req.json(); } catch { /* ohne Body: Standarddatei */ }
  let text: string;
  let quelle: string;
  if (typeof body.csv === 'string' && body.csv.trim()) {
    text = body.csv.replace(/^\uFEFF/, '');
    quelle = `Upload: ${String(body.name ?? 'CSV').replace(/[^\w.\- ]/g, '').slice(0, 80) || 'CSV'}`;
  } else {
    const pfad = resolve(body.pfad ? join(ORDNER, body.pfad) : STANDARD);
    if (!pfad.startsWith(ORDNER + '/') && pfad !== STANDARD) {
      return NextResponse.json({ error: 'Nur Dateien aus dem CRM Leadordner.' }, { status: 400 });
    }
    try { text = await readFile(pfad, 'utf8'); }
    catch { return NextResponse.json({ error: 'Datei nicht lesbar — auf dem Server gibt es keinen Schreibtisch. Bitte die CSV-Datei über „Datei wählen“ hochladen.' }, { status: 404 }); }
    quelle = pfad.replace(homedir(), '~');
  }

  const zeilen = csvLesen(text, trennerVon(text));
  if (!zeilen.length) return NextResponse.json({ error: 'Keine Zeilen in der Datei.' }, { status: 400 });

  const vorher = (await loadJson<Bestand>('kontakte'))?.kontakte ?? [];
  const r = importieren(vorher, zeilen, localDay());
  const w = await updateGeschuetzt<Bestand>('kontakte', { kontakte: r.kontakte }, f => f.kontakte.length, 20);
  if (!w.ok) return NextResponse.json({ error: 'Abgelehnt: der Import hätte den Bestand halbiert.' }, { status: 409 });

  // Firmen als eigene Stammdaten: neue anlegen, Personen verknüpfen, leere Felder füllen.
  const firmen = await firmenAbgleichen();
  await logRun('crm', `Import: ${r.neu} neu, ${r.aktualisiert} aktualisiert, ${r.unveraendert} unverändert`, { quelle, zeilen: zeilen.length });
  return NextResponse.json({ ok: true, zeilen: zeilen.length, neu: r.neu, aktualisiert: r.aktualisiert, unveraendert: r.unveraendert, firmen, stand: pipelineStand(r.kontakte) });
}
