// ─── Planen — Übernahme der alten Wochenplan-Blöcke in den Kalender (29.09., K5) ─
// GET                                  → Vorschau je Person (zukünftige Blöcke, davon mit Apple-Kopie, vergangene = Archiv,
//                                        schon übernommen, übersprungen, fünf Beispiele) + `unterbrochen`, `zuruecknehmbar`
//                                        — nichts wird geschrieben.
// POST { aktion: 'ausfuehren' }        → Übernahme (idempotent, Absichtsprotokoll, Archivkopie vorher) — nur auf Klick.
// POST { aktion: 'erneut' }            → übersprungene Blöcke freigeben und noch einmal (U1 M1) — nur auf Klick.
// POST { aktion: 'zuruecknehmen', bestaetigt? } → Probelauf bzw. mit `bestaetigt: true` die Termine der Übernahme löschen
//                                        und den Stand zurücksetzen (U1 H1, Rückweg zur alten Version) — nur von Hand,
//                                        nie über den Dienstweg.
// Was und wie: lib/planung/wochenplan-uebernahme(-server).ts. Nur der Haushalt des Inhabers; Build-Kennung wie jede
// schreibende Route.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { uebernahmeVorschau, uebernahmeAusfuehren, uebernahmeErneut, uebernahmeZuruecknehmen } from '@/lib/planung/wochenplan-uebernahme-server';
import { karteiHaushalt } from '@/lib/crm/sperrliste';
import { KalenderFehler } from '@/lib/kalender/icloud';
import { istDienst } from '@/lib/zugang/dienst';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  return NextResponse.json({ ok: true, ...(await uebernahmeVorschau(new Date(), await karteiHaushalt())) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await kalenderZugang(req);
  if (!z) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: string; bestaetigt?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion === 'zuruecknehmen') {
    if (istDienst(req)) return NextResponse.json({ ok: false, fehler: 'Zurücknehmen nur von Hand — nie über ZOE oder Skripte.' }, { status: 403 });
    try {
      const r = await uebernahmeZuruecknehmen(await karteiHaushalt(), { art: 'person', person: z.person }, b.bestaetigt === true);
      return NextResponse.json(r, { status: r.ok || r.probelauf ? 200 : 409 });
    } catch (e) { return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message.slice(0, 300) : 'Zurücknehmen gescheitert.' }, { status: 502 }); }
  }
  if (b.aktion !== 'ausfuehren' && b.aktion !== 'erneut') return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
  try {
    const r = b.aktion === 'erneut' ? await uebernahmeErneut(await karteiHaushalt(), z.person) : await uebernahmeAusfuehren(await karteiHaushalt(), z.person);
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  } catch (e) {
    // Die Absicht bleibt offen — der Takt/Start setzt fort; hier nur der Grund.
    const status = e instanceof KalenderFehler ? e.status : 502;
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message.slice(0, 300) : 'Übernahme unterbrochen.', weiter: 'Die Übernahme wird automatisch fortgesetzt.' }, { status });
  }
}
