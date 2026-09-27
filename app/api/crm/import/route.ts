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

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { schrumpftZuStark, updateJson } from '@/lib/store/local-db';
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
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
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

  // Stufe 2: Lesen, Einarbeiten und Schrumpf-Schutz in EINER Schreibsperre — vorher las der Import außerhalb,
  // und eine Änderung dazwischen (Klick in der Kartei) wurde vom Import-Stand überschrieben.
  let r: ReturnType<typeof importieren> | null = null;
  let abgelehnt = false;
  await updateJson<Bestand>('kontakte', cur => {
    const vorher = cur?.kontakte ?? [];
    r = importieren(vorher, zeilen, localDay());
    if (schrumpftZuStark(vorher.length, r.kontakte.length, 20)) { abgelehnt = true; return cur ?? { kontakte: [] }; }
    return { ...(cur ?? {}), kontakte: r.kontakte };
  });
  if (abgelehnt || !r) return NextResponse.json({ error: 'Abgelehnt: der Import hätte den Bestand halbiert.' }, { status: 409 });
  r = r as ReturnType<typeof importieren>;

  // Firmen als eigene Stammdaten: neue anlegen, Personen verknüpfen, leere Felder füllen.
  const firmen = await firmenAbgleichen();
  await logRun('crm', `Import: ${r.neu} neu, ${r.aktualisiert} aktualisiert, ${r.unveraendert} unverändert`, { quelle, zeilen: zeilen.length });
  return NextResponse.json({ ok: true, zeilen: zeilen.length, neu: r.neu, aktualisiert: r.aktualisiert, unveraendert: r.unveraendert, firmen, stand: pipelineStand(r.kontakte) });
}
