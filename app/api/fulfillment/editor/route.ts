// ─── Fulfillment — Prozess-Editor im Miro-Stil (17.10.; DESIGN_STANDARD.md › Prozess-Visualisierung › Editor) ─────────────────────────────
// GET   ?v=<Paket-Vorlage> → die Vorlage mit dem Stand der GANZEN Vorlage (`stand`), die Bibliothek in Kürze (Kennung, Titel, Art), ob die Person bearbeiten
//        darf, wie viele laufende Fälle die Vorlage nutzen (nur die Zahl). Lesen schreibt nie; keine Personendaten (Lese-Protokoll nicht nötig).
// PATCH { vorlageId, stand, ops } → Editor-Ops (lib/fulfillment/prozesse/editor.ts `editorAnwenden`), alles oder nichts. Veralteter Stand → 409 mit
//        `konflikte` und der AKTUELLEN Fassung (`vorlage`, `stand`); 400/404 Unsinn/unbekannt, 409 Regel (Kreis, andere Phase), 413 Grenze.
// POST  { aktion: 'neu', titel, phase?, anfrageId } → „Neuer Ablauf“: leere Paket-Vorlage mit Start und einer Phase (idempotent über anfrageId).
// Tor: `vorlagenZugang` (Fulfillment-Tor; schreiben nur volle Mitglieder — Rolle „nur Business“ 403; nur per Sitzung, Dienstweg 403; Bau-Kennung).
// Wirkung auf Fälle: keine — neue Fälle nehmen die neue Fassung, laufende zeigen „Vorlage geändert — übernehmen?“ (POST /api/fulfillment/fall).

import { NextResponse } from 'next/server';
import { vorlagenZugang, darfVorlagenBearbeiten } from '@/lib/fulfillment/zugang';
import { fulfillmentAendern, fulfillmentLesen, eintragStand } from '@/lib/fulfillment/speicher';
import { editorAnwenden, neuerAblauf, type EditorKontext } from '@/lib/fulfillment/prozesse/editor';
import { KENNUNG } from '@/lib/fulfillment/grenzen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { einmalig } from '@/lib/store/anfragen';
import { neueKennung } from '@/lib/kennung';
import type { ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Was der Editor von einer Vorlage braucht: die Vorlage und ihr Stand (Fingerabdruck der ganzen Vorlage). */
const ansicht = (v: ProzessVorlage) => ({ vorlage: v, stand: eintragStand(v) });
const kontext = (person: string): EditorKontext => ({ person, jetzt: new Date().toISOString(), standVon: eintragStand, neueId: p => neueKennung(p) });
const paket = (d: VorlagenDatei, id: unknown) => d.prozesse.find(p => p.id === id && p.art === 'paket');

export async function GET(req: Request) {
  const z = await vorlagenZugang(req);
  if (z instanceof Response) return z;
  const id = new URL(req.url).searchParams.get('v') ?? '';
  if (!KENNUNG.vorlage.test(id)) return NextResponse.json({ ok: false, fehler: 'Welche Vorlage? (?v=)' }, { status: 400 });
  const [d, faelle] = await Promise.all([fulfillmentLesen('vorlagen', z.haushalt), fulfillmentLesen('faelle', z.haushalt)]);
  const v = paket(d, id);
  if (!v) return NextResponse.json({ ok: false, fehler: 'Diesen Ablauf gibt es nicht (mehr).' }, { status: 404 });
  return NextResponse.json({
    ok: true, ...ansicht(v),
    bausteine: d.bausteine.map(b => ({ id: b.id, titel: b.titel, art: b.art })),
    darfBearbeiten: await darfVorlagenBearbeiten(z.person),
    // Auch Fälle, an denen der Ablauf als Zusatzmodul hängt (17.10. spät) — sie zeigen „geändert“ ebenso.
    laufend: Object.values(faelle.faelle).filter(f => (f.vorlageId === v.id || !!f.zusaetze?.some(z => z.vorlageId === v.id)) && f.status !== 'abgeschlossen').length,
  });
}

export async function PATCH(req: Request) {
  const z = await vorlagenZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 512 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const r = await fulfillmentAendern('vorlagen', d => editorAnwenden(d, b, kontext(z.person)), werAus(req), z.haushalt);
  if (!r.ok) {
    // Veralteter Stand: die aktuelle Fassung gleich mit (der Editor zeigt sie und verwirft seinen Verlauf).
    const aktuell = r.status === 409 && r.konflikte?.length ? paket(await fulfillmentLesen('vorlagen', z.haushalt), b.vorlageId) : undefined;
    return NextResponse.json({ ok: false, fehler: r.fehler, ...(r.konflikte ? { konflikte: r.konflikte } : {}), ...(aktuell ? ansicht(aktuell) : {}) }, { status: r.status });
  }
  const v = paket(r.datei, b.vorlageId);
  return NextResponse.json({ ok: true, geaendert: r.geaendert, ...(v ? ansicht(v) : {}) });
}

export async function POST(req: Request) {
  const z = await vorlagenZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion !== 'neu') return NextResponse.json({ ok: false, fehler: 'aktion: neu.' }, { status: 400 });
  const wer = werAus(req);
  const a = await einmalig<Record<string, unknown>>('fulfillment-ablauf-neu', b.anfrageId, async () => {
    const r = await fulfillmentAendern('vorlagen', d => neuerAblauf(d, b, kontext(z.person)), wer, z.haushalt);
    if (!r.ok) return { status: r.status, body: { ok: false, fehler: r.fehler } };
    const v = paket(r.datei, r.geaendert[0]);
    return { status: 200, body: { ok: true, vorlageId: r.geaendert[0], ...(v ? ansicht(v) : {}) } };
  }, undefined, { wer: z.person });
  return NextResponse.json(a.body, { status: a.status });
}
