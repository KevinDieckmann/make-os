// ─── Aufgaben-Export (29.09., #81) ──────────────────────────────────────────
// GET → JSON-Datei (Download) mit Spaces, Projekten, Gruppen, Listen, Aufgaben/Unteraufgaben, Serien, Abhängigkeiten,
// Kommentaren, eigenen Status, Vorlagen und der Dateiliste (Angaben, keine Inhalte) — Papierkorb und Archiv mit Marke.
// Nur eine Person im Haushalt des Inhabers mit eigener Sitzung; Sichtfilter „nur ich“ der Person (fremde „nur ich“-
// Aufgaben fehlen samt Unteraufgaben und Dateien). Rein: lib/aufgaben/export.ts (auch das Wieder-Einlesen).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { ladeAufgaben, sichtFuer } from '@/lib/aufgaben/sicht';
import { spacesFuer } from '@/lib/aufgaben/speicher';
import { aufgabenDateienListe } from '@/lib/dateien/aufgaben-ablage';
import { exportBauen, type ExportDatei } from '@/lib/aufgaben/export';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { berlinerTag } from '@/lib/aufgaben/wiederholung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z || z.dienst) return NextResponse.json({ ...KARTEI_GESPERRT, error: 'Exportieren darf nur eine Person im Haushalt selbst.' }, { status: 403 });
  const state = sichtFuer(await ladeAufgaben(), z.person);
  const haushalt = (await haushaltFuer(z.person))?.haushalt;
  const dateien: ExportDatei[] = haushalt ? (await aufgabenDateienListe(haushalt).catch(() => [])).map(d => ({
    id: d.id, name: d.datei.name, typ: d.datei.typ, groesse: d.datei.groesse, projektId: d.projektId, ...(d.aufgabeId ? { aufgabeId: d.aufgabeId } : {}),
    bereich: d.bereich, ...(d.notiz ? { notiz: d.notiz } : {}), angelegt: d.hochgeladenAm,
  })) : [];
  const spaces = (await spacesFuer(state)).map(s => ({ id: s.id, label: s.label, bereich: s.bereich, art: s.art, ...(s.archiv ? { archiv: true } : {}) }));
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
