// ─── Monatsabschluss der Privat-Einheiten (05.10. abends, Kevin: „Privat › Selbstständigkeit bekommt den Monatsabschluss“) ──────
// GET  → { firmen: [{ id, label }], abschluesse } — nur die Einheiten, die zu Privat gehören (lib/einheiten.ts `PRIVAT_GESELLSCHAFTEN`,
//        unsere Instanz: die Selbstständigkeit), auch die vor dem 05.10. im Business-Cockpit eingetragenen.
// POST { aktion: 'abschluss', firma, monat, umsatz?, kosten?, personal?, … }   (dieselben Felder wie /api/business)
//      { aktion: 'abschluss_weg', firma, monat }
//      { aktion: 'tabelle_vorschau' | 'tabelle_uebernehmen' | 'tabelle_zurueck', … } — Einfügen aus Excel/BWA (09.10.), derselbe Weg wie im
//        Business-Index (lib/business/abschluss-tabelle-server.ts), hier nur Privat-Einheiten; nur von Hand (Dienstweg 403), Bau-Kennung.
// EIN Bestand mit dem Business-Index (`business-abschluesse`, lib/business/speicher.ts) — getrennt wird serverseitig über den Bereich der
// Firma: hier nur Privat-Einheiten (eine Business-Gesellschaft → 400), im Business-Index nur Business-Gesellschaften (kdc → 400).
// Zugang: private Finanzen in einem gemeinsamen Bestand → `privatFinanzZugang` (Haushaltsmitglied ohne finanzRecht „business“, Haushalt
// des Inhabers) — Konten „nur Business“ bekommen 403.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { privatFinanzZugang, keinFinanzZugang } from '@/lib/zugang/tor';
import { abschlussFirmen, ladeAbschluesse, loescheAbschluss, speichereAbschluss } from '@/lib/business/speicher';
import { KERN_EINHEITEN, istGesellschaft, bereichVon } from '@/lib/einheiten';
import { abschlussLaeufe, abschlussTabelleAktion } from '@/lib/business/abschluss-tabelle-server';
import { istDienst } from '@/lib/zugang/dienst';
import { bauPruefen } from '@/lib/bau/pruefen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const firmenListe = () => KERN_EINHEITEN.filter(e => abschlussFirmen('privat').includes(e.id)).map(e => ({ id: e.id, label: e.label }));

export async function GET(req: Request) {
  if (!(await privatFinanzZugang(req))) return keinFinanzZugang();
  return NextResponse.json({ ok: true, firmen: firmenListe(), abschluesse: (await ladeAbschluesse('privat')).slice(0, 36), abschlussLaeufe: await abschlussLaeufe('privat') }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await privatFinanzZugang(req);
  if (!z) return keinFinanzZugang();
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion === 'abschluss') {
    const r = await speichereAbschluss(b, z.person, 'privat');
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  if (typeof b.aktion === 'string' && b.aktion.startsWith('tabelle_')) {
    if (istDienst(req)) return NextResponse.json({ ok: false, fehler: 'Einfügen aus Excel/BWA geht nur von Hand, nicht über den Dienstweg.' }, { status: 403 });
    const alterBau = bauPruefen(req);
    if (alterBau) return alterBau;
    const r = await abschlussTabelleAktion('privat', b, z.person);
    if (r) return NextResponse.json(r.body, { status: r.status });
  }
  if (b.aktion === 'abschluss_weg') {
    if (!istGesellschaft(b.firma) || !/^\d{4}-\d{2}$/.test(String(b.monat))) return NextResponse.json({ ok: false, fehler: 'Firma und Monat nötig.' }, { status: 400 });
    if (bereichVon(b.firma) !== 'privat') return NextResponse.json({ ok: false, fehler: 'Diese Gesellschaft gehört zum Business — ihr Monatsabschluss steht im Business-Cockpit.' }, { status: 400 });
    await loescheAbschluss(String(b.firma), String(b.monat), 'privat');
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
