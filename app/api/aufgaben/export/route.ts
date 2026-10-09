// ─── Aufgaben-Export (29.09., #81) ──────────────────────────────────────────
// GET → JSON-Datei (Download) mit Spaces, Projekten, Gruppen, Listen, Aufgaben/Unteraufgaben, Serien, Abhängigkeiten,
// Kommentaren, eigenen Status, Vorlagen und der Dateiliste (Angaben, keine Inhalte) — Papierkorb und Archiv mit Marke.
// Nur eine Person im Haushalt des Inhabers mit eigener Sitzung; Sichtfilter „nur ich“ der Person (fremde „nur ich“-
// Aufgaben fehlen samt Unteraufgaben und Dateien). Rein: lib/aufgaben/export.ts (auch das Wieder-Einlesen).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { ladeAufgaben, sichtFuerKonto } from '@/lib/aufgaben/sicht';
import { spacesFuer } from '@/lib/aufgaben/speicher';
import { aufgabenDateienListe, aufgabenDateienZugang, aufgabenDateiSichtbar } from '@/lib/dateien/aufgaben-ablage';
import { exportBauen, type ExportDatei } from '@/lib/aufgaben/export';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { berlinerTag } from '@/lib/aufgaben/wiederholung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z || z.dienst) return NextResponse.json({ ...KARTEI_GESPERRT, error: 'Exportieren darf nur eine Person im Haushalt selbst.' }, { status: 403 });
  // Listen verborgener Meilensteine nur mit neutralem Namen (08.10., eigene Ziele nur geteilt) — wie jede Ausgabe des Bestands.
  // EINE Konto-Sicht (09.10., E4): ein Konto „nur Business“ exportiert nichts aus dem Privat-Bereich (Aufgaben, Projekte, Spaces, Dateien).
  const state = await sichtFuerKonto(await ladeAufgaben(), z.person);
  const dz = await aufgabenDateienZugang(z.person);
  const sichtbar = new Set(state.tasks.map(t => t.id));
  const dateien: ExportDatei[] = dz ? (await aufgabenDateienListe(dz.haushalt).catch(() => []))
    .filter(d => (!d.aufgabeId || sichtbar.has(d.aufgabeId)) && aufgabenDateiSichtbar(d, dz, new Set())).map(d => ({
    id: d.id, name: d.datei.name, typ: d.datei.typ, groesse: d.datei.groesse, projektId: d.projektId, ...(d.aufgabeId ? { aufgabeId: d.aufgabeId } : {}),
    bereich: d.bereich, ...(d.notiz ? { notiz: d.notiz } : {}), angelegt: d.hochgeladenAm,
  })) : [];
  const spaces = (await spacesFuer(state, z.person)).map(s => ({ id: s.id, label: s.label, bereich: s.bereich, art: s.art, ...(s.archiv ? { archiv: true } : {}) }));
  const jetzt = new Date();
  const datei = exportBauen(state, { spaces, dateien, von: z.person, jetzt: jetzt.toISOString() });
  // Auskunft/Umzug ist ein Ereignis: Protokoll ohne Werte.
  await protokolliere('tasks', [{ op: 'geaendert', id: 'export', felder: ['export'] }], werAus(req));
  return new NextResponse(JSON.stringify(datei, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="aufgaben-export-${berlinerTag(jetzt)}.json"`,
    },
  });
}
