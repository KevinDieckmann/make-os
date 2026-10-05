// ─── /api/datenschutz/nachweise — Nachweise nach Art. 5 Abs. 2 / Art. 32 (05.10., Paket „Verschlüsselung lückenlos“) ─
// GET  ?tage=30&bereich=gesundheit  → Lese-Protokoll (neueste zuerst, höchstens 500), Stand der Protokoll-Kette,
//                                      Verschlüsselung (Schreibformat, Schlüssel-Quelle, Brain-Index, Bilder) und die
//                                      Bereitschaft für das Format v2 — nur Metadaten, nie Inhalte.
// POST { aktion: 'kette-pruefen' }   → Protokolle versiegeln und die Kette jetzt prüfen (sonst nächtlich in der Durchsicht).
// Nur der Inhaber selbst (Sitzung) — nicht der Dienstweg, nicht andere Konten des Haushalts: das Lese-Protokoll zeigt,
// wer was gelesen hat, und ist damit selbst schutzwürdig.

import { NextResponse } from 'next/server';
import { istDienst } from '@/lib/zugang/dienst';
import { istInhaber, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { werAus, monatBerlin } from '@/lib/store/aenderungsprotokoll';
import { leseprotokollMonat, monatMinus, istLeseBereich, LESE_BEREICHE, LESE_AUFBEWAHRUNG_MONATE, type LeseEintrag } from '@/lib/store/leseprotokoll';
import { letztePruefung, kettePruefenUndMerken } from '@/lib/store/protokoll-kette';
import { formatModus, formatModusUnbekannt, schluesselQuelle } from '@/lib/store/huelle.mjs';
import { datenSchluessel, loadJson } from '@/lib/store/local-db';
import { bilderZaehlen } from '@/lib/store/bild-ablage';
import { brainIndexLage } from '@/lib/hoi/innen';
import { pepperGesetzt } from '@/lib/datenschutz/pepper';
import { DURCHSICHT_SPEICHER, type DurchsichtErgebnis } from '@/lib/store/durchsicht';
import { v2Bereitschaft } from '@/lib/datenschutz/nachweise';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_INHABER = { ok: false, fehler: 'Nur für den Inhaber.' };
const MAX = 500;

async function inhaber(req: Request): Promise<boolean> {
  if (istDienst(req)) return false;
  const w = werAus(req);
  return w.art === 'person' && (await istInhaber(w.person));
}

export async function GET(req: Request) {
  if (!(await inhaber(req))) return NextResponse.json(NUR_INHABER, { status: 403 });
  const q = new URL(req.url).searchParams;
  const tage = Math.max(1, Math.min(366, Number(q.get('tage')) || 30));
  const bereich = q.get('bereich');
  const nurFremde = q.get('fremde') === '1';
  const haushalt = await haushaltDesInhabers();
  const ab = Date.now() - tage * 86_400_000;
  // Monate von heute rückwärts, bis der Zeitraum abgedeckt ist (höchstens die Aufbewahrung).
  const jetzt = monatBerlin();
  const monate: string[] = [];
  for (let i = 0; i <= LESE_AUFBEWAHRUNG_MONATE; i++) {
    const m = monatMinus(jetzt, i);
    monate.push(m);
    if (Date.parse(`${m}-01T00:00:00Z`) < ab) break;
  }
  const alle: LeseEintrag[] = [];
  if (haushalt) for (const m of monate) alle.push(...(await leseprotokollMonat(haushalt, m).catch(() => [])));
  const gefiltert = alle
    .filter(e => Date.parse(e.at) >= ab && (!istLeseBereich(bereich) || e.bereich === bereich) && (!nurFremde || (!!e.betroffen && e.betroffen !== e.person)))
    .sort((a, b) => b.at.localeCompare(a.at));
  const zaehlung: Record<string, number> = {};
  for (const e of gefiltert) zaehlung[e.bereich] = (zaehlung[e.bereich] ?? 0) + 1;
  const [kette, brainIndex, bilder, durchsicht] = await Promise.all([
    letztePruefung(), brainIndexLage(), bilderZaehlen(),
    loadJson<{ letzter?: DurchsichtErgebnis }>(DURCHSICHT_SPEICHER).then(d => d?.letzter ?? null).catch(() => null),
  ]);
  const verschluesselung = {
    modus: formatModus(), unbekannt: formatModusUnbekannt(), schluesselQuelle: schluesselQuelle(), verschluesselt: datenSchluessel() !== null, pepper: pepperGesetzt(),
  };
  return NextResponse.json({
    ok: true,
    bereiche: LESE_BEREICHE,
    lesen: { tage, eintraege: gefiltert.slice(0, MAX), gesamt: gefiltert.length, gekuerzt: gefiltert.length > MAX, zaehlung, aufbewahrungMonate: LESE_AUFBEWAHRUNG_MONATE },
    kette,
    verschluesselung,
    brainIndex,
    bilder,
    v2: v2Bereitschaft({ ...verschluesselung, brainIndexKlartext: !!brainIndex?.klartextAufPlatte || !!brainIndex?.altDateiDa, bilderKlartext: bilder.klartext, alteHuellen: durchsicht?.alteHuellen ?? null, klartextBestaende: durchsicht?.klartext ?? null }),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!(await inhaber(req))) return NextResponse.json(NUR_INHABER, { status: 403 });
  let b: { aktion?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.aktion !== 'kette-pruefen') return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
  const kette = await kettePruefenUndMerken();
  return NextResponse.json({ ok: true, kette });
}
