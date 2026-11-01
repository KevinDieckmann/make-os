// ─── Unternehmen › Verträge › Vorlagen › „Vorlagen importieren (Datei)“ (01.11.) ──────────────────────────────────────────
// POST { aktion: 'vorschau' | 'uebernehmen', inhalt: <Text der JSON-Datei> }
//   vorschau    → je Vorlage Titel, Art, Paragraphen, Felder, Fehler, Zustand (neu · vorhanden · doppelt · fehler) — schreibt NICHTS
//   uebernehmen → legt nur neue Vorlagen an (Titel+Art gibt es noch nicht; nie überschreiben), jede „ungeprüft“
// Zugang: nur ein Inhaber per Sitzung (Dienstweg 403). Datei höchstens 2 MB (413). Regeln in lib/vertraege/sammel.ts.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { bauPruefen } from '@/lib/bau/pruefen';
import { istDienst } from '@/lib/zugang/dienst';
import { personDerSitzung, ohnePerson } from '@/lib/zugang/tor';
import { darfSteuern, NUR_STEUERN } from '@/lib/zugang/steuern';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { SAMMEL_MAX_BYTES } from '@/lib/vertraege/sammel';
import { VertragFehler, vorlagenSammelImport } from '@/lib/vertraege/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });

export async function POST(req: Request) {
  if (istDienst(req)) return fehler('Vorlagen importieren nur Inhaber und volle Mitglieder per Sitzung — nie der Dienstweg.', 403);
  const person = personDerSitzung(req);
  if (!person) return ohnePerson();
  // Steuern (02.11., Kevin: volles Mitglied wie Inhaber): EINE Regel lib/zugang/steuern.ts.
  if (!(await darfSteuern(person))) return fehler(NUR_STEUERN, 403);
  const h = await haushaltFuer(person);
  if (!h) return fehler('Für dieses Konto nicht freigegeben.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: unknown; inhalt?: unknown };
  // JSON-Maskierung kann den Text verlängern — der Körper darf größer sein, die Datei selbst prüft `sammelLesen` (2 MB).
  try { b = await jsonBegrenzt(req, SAMMEL_MAX_BYTES * 2 + 64 * 1024); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  if (b.aktion !== 'vorschau' && b.aktion !== 'uebernehmen') return fehler('aktion: vorschau oder uebernehmen.', 400);
  if (typeof b.inhalt !== 'string' || !b.inhalt.trim()) return fehler('Datei fehlt.', 400);
  try {
    const r = await vorlagenSammelImport({ haushalt: h.haushalt, person, inhalt: b.inhalt, uebernehmen: b.aktion === 'uebernehmen', wer: werAus(req) });
    return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof VertragFehler) return fehler(e.message, e.status);
    console.error('[vertraege/vorlagen/sammel]', (e as Error)?.message);
    return fehler('Nicht übernommen — interner Fehler.', 500);
  }
}
