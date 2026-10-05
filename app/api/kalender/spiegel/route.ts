// ─── Kalender — Spiegel von Modul-Terminen (29.09., Paket K5) ────────────────
// GET  ?art=event&id=<Event>                 → { lage: da|fehlt|schein|keiner|ohne-icloud, uid?, grund? }
// POST { art: 'event', id }                  → Termin zum Make.One-Event anlegen (Kalender „Gemeinsam“, echte UID,
//                                              Bezug eventId) — ersetzt POST /api/apple-calendar/create (Schein-Kennung).
// POST { art: 'event', id, aktion: 'loeschen' } → Termin eines ABGESAGTEN Events löschen (nur auf Klick — der Takt
//                                              meldet Absagen nur in die Glocke, Upload U1 B3).
// POST { art: 'date'|'gespraech', id }       → Date (id = Date-Kennung) bzw. Paar-Gespräch (id = Datum) in den
//                                              gemeinsamen Kalender — die UID landet in der Familie.
// Nachziehen (Datum/Absage) passiert nach jeder Änderung im Modul durch eine Person (lib/kalender/spiegel-server.ts).
// Nur Haushalt des Inhabers; Familie nur, wenn es DESSEN Familie ist. Nie Teilnehmer, nie Einladungen.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { KalenderFehler } from '@/lib/kalender/icloud';
import { eventSpiegelLage, eventSpiegelAnlegen, eventSpiegelLoeschen, familieSpiegelAnlegen } from '@/lib/kalender/spiegel-server';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { istDienst } from '@/lib/zugang/dienst';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

function fehler(e: unknown) {
  if (e instanceof KalenderFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
  return NextResponse.json({ ok: false, fehler: 'iCloud nicht erreichbar.' }, { status: 502 });
}

export async function GET(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const q = new URL(req.url).searchParams;
  const id = q.get('id') ?? '';
  if (q.get('art') !== 'event' || !KENNUNG.test(id)) return NextResponse.json({ ok: false, fehler: 'art=event&id=… nötig.' }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...(await eventSpiegelLage(id)) }, { headers: { 'Cache-Control': 'no-store' } }); } catch (e) { return fehler(e); }
}

export async function POST(req: Request) {
  const z = await kalenderZugang(req);
  if (!z) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { art?: string; id?: string; aktion?: string };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const id = typeof b.id === 'string' ? b.id : '';
  if (!KENNUNG.test(id)) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
  try {
    // S1: Löschen eines Spiegel-Termins nur von Hand — nie über ZOE oder Skripte (Dienstweg → 403).
    if (b.art === 'event' && b.aktion === 'loeschen') {
      if (istDienst(req)) return NextResponse.json({ ok: false, fehler: 'Löschen nur von Hand — nie über ZOE oder Skripte.' }, { status: 403 });
      return NextResponse.json({ ok: true, ...(await eventSpiegelLoeschen(id, werAus(req))) });
    }
    if (b.art === 'event') return NextResponse.json({ ok: true, ...(await eventSpiegelAnlegen(id, z.person, werAus(req))) });
    if (b.art === 'date' || b.art === 'gespraech') {
      const h = await haushaltVon(req);
      if (!h || h.haushalt !== await haushaltDesInhabers()) return NextResponse.json({ ok: false, fehler: 'Nur für die Familie des Inhabers (sein Kalender).' }, { status: 403 });
      return NextResponse.json({ ok: true, ...(await familieSpiegelAnlegen(h.haushalt, b.art, id, z.person, werAus(req))) });
    }
    return NextResponse.json({ ok: false, fehler: 'Unbekannte Art.' }, { status: 400 });
  } catch (e) { return fehler(e); }
}
