// ─── Agenten-Bereich: „Aus dem Brain übernehmen“ (09.10.; Auftrag: „Pack bitte schon die vorgefertigten Bots bei ZOE ein … da hatten wir ja
// schon welche. Und das Sales Brain kannst du auch direkt dem Head of Sales zur Verfügung stellen.“) ──────────────────────────────────────
// GET  `?nur=ordner` → nur die Ordner des Brains (Agenten-Sicht) für Wähler.
//      `?ordner=<Pfad relativ zum Brain>` (optional) → Vorschau: Agenten-Notizen des Ordners (Agenten-Sicht, nie `privat`), je Datei Ziel-Head,
//      Auftrag, Modellstufe, Mitarbeiter, Wissen — mit Aktion und Grund; dazu die Ordner des Brains für die Wähler. Schreibt nichts.
// POST { aktion: 'vorschau', ordner?, ziele: { [datei]: { headId | null, als? } } } → dieselbe Vorschau mit in der Vorschau gewählten Heads.
//      { aktion: 'uebernehmen', ordner?, auswahl: UebernahmeWahl[], staende, wissenStaende: { [headId]: stand } } → schreibt über die vorhandenen Wege
//      (Einstellungen je Head mit Stand → 409, Werkstatt); die Inhalte liest der Server neu aus dem Vault — der Browser schickt nur die Auswahl.
//      { aktion: 'ordner', ordner: string | null } → den Agenten-Ordner der Instanz festhalten (null = automatisch über `_Agenten_Index`).
// Nur ein Inhaber mit eigener Sitzung (`eigenePerson`: Dienstweg 403, Haushalt des Inhabers; dann `istInhaber`, sonst 403). Logik:
// lib/agenten/brain-agenten.ts (rein) + brain-agenten-server.ts. Body ≤ 64 KB (`jsonBegrenzt`), Bau-Kennung beim Schreiben.
import { NextResponse } from 'next/server';
import { eigenePerson, istInhaber } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { AGENTEN_NUR_SELBST } from '@/lib/agenten/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string) => NextResponse.json({ ok: false, fehler, error: fehler }, { status });
const NUR_INHABER = 'Aus dem Brain übernimmt nur ein Inhaber der Instanz.';

async function zugang(req: Request, schreibend: boolean): Promise<{ person: string } | NextResponse> {
  const z = await eigenePerson(req, schreibend, AGENTEN_NUR_SELBST);
  if (z instanceof NextResponse) return z;
  if (!(await istInhaber(z.person))) return nein(403, NUR_INHABER);
  return z;
}

export async function GET(req: Request) {
  const z = await zugang(req, false);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const ordner = q.get('ordner');
  try {
    const { brainVorschau, brainOrdnerListe } = await import('@/lib/agenten/brain-agenten-server');
    // `?nur=ordner`: nur die Ordner des Brains (Agenten-Sicht) — für den Wissens-Wähler eines Business-Heads.
    if (q.get('nur') === 'ordner') return NextResponse.json({ ok: true, ordnerListe: await brainOrdnerListe(z.person) }, { headers: { 'Cache-Control': 'no-store' } });
    const r = await brainVorschau(z.person, ordner);
    return r.ok ? NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } }) : nein(r.status, r.fehler);
  } catch (e) {
    return nein(500, `Das Brain ist gerade nicht lesbar (${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}).`);
  }
}

export async function POST(req: Request) {
  const z = await zugang(req, true);
  if (z instanceof NextResponse) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 64_000); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein gültiges JSON.'); }
  if (!b || typeof b !== 'object') return nein(400, 'Anfrage fehlt.');
  const s = await import('@/lib/agenten/brain-agenten-server');
  try {
    if (b.aktion === 'vorschau') {
      const r = await s.brainVorschau(z.person, typeof b.ordner === 'string' && b.ordner ? b.ordner : null, b.ziele);
      return r.ok ? NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } }) : nein(r.status, r.fehler);
    }
    if (b.aktion === 'uebernehmen') {
      const r = await s.brainUebernehmen(z.person, b);
      return r.ok ? NextResponse.json(r) : nein(r.status, r.fehler);
    }
    if (b.aktion === 'ordner') {
      const r = await s.brainOrdnerSetzen(z.person, b.ordner);
      return r.ok ? NextResponse.json(r) : nein(r.status, r.fehler);
    }
  } catch (e) {
    return nein(500, `Nicht übernommen (${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}).`);
  }
  return nein(400, 'Unbekannte Aktion — „vorschau“, „uebernehmen“ oder „ordner“.');
}
