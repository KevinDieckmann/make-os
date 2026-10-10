// ─── Fulfillment — Import der Bausteine und Abläufe (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 2.6, 2.7) ────────────────────────────────
// POST { aktion: 'vorschau', datei, inhalt }                          → Vorschau (schreibt NICHTS) + `vorschauId` (Datei + Stand des Bestands)
//      { aktion: 'uebernehmen', datei, inhalt, vorschauId, wahl }     → übernehmen; hat sich der Bestand seit der Vorschau geändert → 409
//      { aktion: 'rueckgaengig', laufId }                             → nur, was seit dem Import unverändert ist (30 Tage)
// `inhalt` = der Text der JSON-Datei (≤ 4 MB, sonst 413 — nie gekürzt). Formate: Bausteine (`vorlagen: […]`) oder Abläufe (je Ablauf `stufen`,
// `uebergaenge`); Regeln und Abbildung in lib/fulfillment/prozesse/import.ts. Nie übernommen: Quellenverzeichnis, Links, Instanzwerte (Preise).
// Nur per Sitzung (Dienstweg 403), Bau-Kennung.

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';
import { fulfillmentAendern, fulfillmentLesen, eintragStand } from '@/lib/fulfillment/speicher';
import { importVorschau, importAnwenden, importRueckgaengig, dateiFingerabdruck, IMPORT_GRENZEN, type ImportWahl } from '@/lib/fulfillment/prozesse/import';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { zuGross } from '@/lib/zugang/umfang';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GRENZE = IMPORT_GRENZEN.bytes + 256 * 1024;
const ZU_GROSS = () => NextResponse.json({ ok: false, fehler: `Die Datei ist größer als ${IMPORT_GRENZEN.bytes / 1024 / 1024} MB — bitte teilen. Nichts übernommen.` }, { status: 413 });
const vorschauIdVon = (text: string, bestandStand: string) => `fv-${dateiFingerabdruck(text)}-${bestandStand.replace(/[^A-Za-z0-9]/g, '').slice(0, 16)}`;

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  if (zuGross(req, GRENZE)) return ZU_GROSS();
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, GRENZE); } catch (e) { return jsonZuGross(e) ? ZU_GROSS() : NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const wer = werAus(req);
  if (b.aktion === 'rueckgaengig') {
    const jetzt = new Date().toISOString();
    let bericht: { entfernt: number; zurueck: number; geblieben: number } | undefined;
    const r = await fulfillmentAendern('vorlagen', d => { const x = importRueckgaengig(d, b.laufId, jetzt); if (x.ok) bericht = x.bericht; return x; }, wer, z.haushalt);
    return r.ok ? NextResponse.json({ ok: true, bericht }) : NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
  }
  const text = typeof b.inhalt === 'string' ? b.inhalt : '';
  const datei = (typeof b.datei === 'string' ? b.datei : 'import.json').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 120) || 'import.json';
  if (!text) return NextResponse.json({ ok: false, fehler: 'Die Datei ist leer.' }, { status: 400 });
  if (Buffer.byteLength(text, 'utf8') > IMPORT_GRENZEN.bytes) return ZU_GROSS();
  let roh: unknown;
  try { roh = JSON.parse(text); } catch { return NextResponse.json({ ok: false, fehler: 'Die Datei ist kein gültiges JSON.' }, { status: 400 }); }
  if (b.aktion === 'vorschau') {
    const d = await fulfillmentLesen('vorlagen', z.haushalt);
    return NextResponse.json({ ok: true, vorschau: importVorschau(roh, d, datei), vorschauId: vorschauIdVon(text, eintragStand(d)) });
  }
  if (b.aktion === 'uebernehmen') {
    const jetzt = new Date();
    const laufId = neueKennung('fi');
    const wahl = (b.wahl && typeof b.wahl === 'object' ? b.wahl : {}) as ImportWahl;
    const r = await fulfillmentAendern('vorlagen', d => {
      // Stand prüfen IN der Sperre: hat sich der Bestand seit der Vorschau geändert, ist die Vorschau veraltet.
      if (b.vorschauId !== vorschauIdVon(text, eintragStand(d))) return { ok: false, status: 409, fehler: 'Seit der Vorschau hat sich die Bibliothek geändert — bitte die Vorschau neu laden. Nichts übernommen.' };
      return importAnwenden(d, roh, wahl, { person: z.person, jetzt: jetzt.toISOString(), heute: localDay(jetzt), datei, laufId }, () => neueKennung('fk'));
    }, wer, z.haushalt);
    if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
    const lauf = r.datei.importLaeufe.find(l => l.id === laufId);
    return NextResponse.json({ ok: true, laufId: lauf ? laufId : null, neu: lauf?.neu.length ?? 0, geaendert: lauf?.geaendert.length ?? 0 });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion: vorschau, uebernehmen oder rueckgaengig.' }, { status: 400 });
}
