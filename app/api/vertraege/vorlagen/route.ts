// ─── Unternehmen › Verträge › Vorlagen (01.11.) ──────────────────────────────────────────────────────────────────────
// GET  → { vorlagen (mit stand, ampel), arten (eigene), feste (Platzhalter + Standardfelder), geruest (Startgerüste, nur Überschriften), hinweis }
// POST { aktion, … }:
//   speichern { id?, stand?, felder } → Vorlage anlegen/ändern (unbekannter Platzhalter → 400, nie still)
//   geruest   { start }               → neue Vorlage aus einem Gerüst (Überschriften, kein Wortlaut)
//   pruefung  { id, stand, am, notiz? | loeschen: true } → Vermerk „anwaltlich geprüft am …“ (hält den Fingerabdruck der Paragraphen fest)
//   archiv    { id, stand, zurueck? }
//   art       { label }               → eigene Art anlegen
// Zugang: Haushalt des Inhabers mit vollem Haushaltszugang zum Schreiben; „nur Business“ liest nur. Der Dienstweg schreibt nie (403).

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { businessHaushaltVon } from '@/lib/zugang/konto-sicht-server';
import { istDienst } from '@/lib/zugang/dienst';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { FESTE_PLATZHALTER, STANDARD_FELDER, STARTVORLAGEN, VERTRAG_HINWEIS, VORLAGE_ARTEN, FELD_TYPEN } from '@/lib/vertraege/modell';
import { VertragFehler, eigeneArtAnlegen, vorlageAnzeige, vorlageArchiv, vorlageAusGeruest, vorlagePruefung, vorlageSpeichern, vorlagenLaden } from '@/lib/vertraege/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Vertragsvorlagen gehören zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.' };
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });

async function zugang(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return null;
  return businessHaushaltVon(req);
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const d = await vorlagenLaden(z.haushalt);
  return NextResponse.json({
    ok: true, vorlagen: d.vorlagen.map(vorlageAnzeige), arten: [...VORLAGE_ARTEN, ...(d.arten ?? [])], feste: FESTE_PLATZHALTER, standard: STANDARD_FELDER, feldTypen: FELD_TYPEN,
    geruest: STARTVORLAGEN.map(s => ({ id: s.id, titel: s.titel, art: s.art, paragraphen: s.paragraphen.length })), hinweis: VERTRAG_HINWEIS, ...(z.nurBusiness ? { nurLesen: true } : {}),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  if (istDienst(req)) return fehler('Vorlagen pflegt nur eine Person per Sitzung — nie der Dienstweg.', 403);
  if (z.nurBusiness) return fehler('Für dieses Konto nur lesen.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: string; id?: unknown; stand?: unknown; felder?: unknown; start?: unknown; am?: unknown; notiz?: unknown; loeschen?: unknown; zurueck?: unknown; label?: unknown };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  const basis = { haushalt: z.haushalt, person: z.person, wer: werAus(req) };
  const id = typeof b.id === 'string' ? b.id : '';
  try {
    switch (b.aktion) {
      case 'speichern': return NextResponse.json({ ok: true, vorlage: vorlageAnzeige(await vorlageSpeichern({ ...basis, id: b.id, stand: b.stand, felder: b.felder && typeof b.felder === 'object' ? b.felder as Record<string, unknown> : {} })) });
      case 'geruest': return NextResponse.json({ ok: true, vorlage: vorlageAnzeige(await vorlageAusGeruest({ ...basis, start: b.start })) });
      case 'pruefung': return NextResponse.json({ ok: true, vorlage: vorlageAnzeige(await vorlagePruefung({ ...basis, id, stand: b.stand, am: b.am, notiz: b.notiz, loeschen: b.loeschen === true })) });
      case 'archiv': return NextResponse.json({ ok: true, vorlage: vorlageAnzeige(await vorlageArchiv({ ...basis, id, stand: b.stand, zurueck: b.zurueck === true })) });
      case 'art': return NextResponse.json({ ok: true, art: await eigeneArtAnlegen({ haushalt: z.haushalt, label: b.label }) });
      default: return fehler('aktion: speichern, geruest, pruefung, archiv oder art.', 400);
    }
  } catch (e) {
    if (e instanceof VertragFehler) return fehler(e.message, e.status, e.extra);
    console.error('[vertraege/vorlagen]', (e as Error)?.message);
    return fehler('Vorlage nicht gespeichert — interner Fehler.', 500);
  }
}
