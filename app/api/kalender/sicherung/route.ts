// ─── Kalender — Sicherung ansehen und zurückspielen (29.09., R-K1 #K5) ──
// GET                                          → { stand } (letzte Tagessicherungen: Kalender, Datei, Zeitpunkt, Anzahl)
// POST { aktion: 'probelauf', kalender, datei? }        → { ergebnis } — zählt nur (fehlt / gesperrt / geändert / gleich / neu)
// POST { aktion: 'wiederherstellen', kalender, datei?, bestaetigt: true }
//                                              → legt NUR fehlende Termine ohne Gäste neu an (nie überschreiben,
//                                                Teilnehmer-Sperre); ohne `bestaetigt: true` → 409 mit dem Probelauf.
// Nur für den Haushalt des Inhabers und nur von Hand: der Dienstweg (ZOE, Takt, Skripte) bekommt 403. Build-Kennung wie
// jede Schreibaktion im Kalender (F1 #10, `bauPruefen`).
// Die tägliche Sicherung selbst läuft im Takt (lib/kalender/sicherung-server.ts). Regeln: lib/kalender/sicherung.ts.

import { NextResponse } from 'next/server';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { istDienst } from '@/lib/zugang/dienst';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { ladeSicherungStand, kalenderWiederherstellen } from '@/lib/kalender/sicherung-server';
import { KalenderFehler } from '@/lib/kalender/icloud';
import { text } from '@/lib/kalender/eingabe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  let s: Awaited<ReturnType<typeof ladeSicherungStand>>;
  try { s = await ladeSicherungStand(); } catch { return NextResponse.json({ ok: false, fehler: 'Stand der Kalender-Sicherung nicht lesbar (Head of IT prüfen).' }, { status: 500 }); }
  return NextResponse.json({ ok: true, stand: { letzterTag: s.letzterTag ?? null, letzter: s.letzter ?? null, dateien: s.dateien, ...(s.fehler?.length ? { fehler: s.fehler } : {}) } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  if (istDienst(req)) return NextResponse.json({ ok: false, fehler: 'Zurückspielen nur von Hand — nie über ZOE oder Skripte.' }, { status: 403 });
  // F1 #10: ein Fenster mit altem Bau (vor einem Update) spielt nichts zurück — erst neu laden (409 `neuLaden`).
  const alt = bauPruefen(req); if (alt) return alt;
  let b: Record<string, unknown>;
  try { const x = await req.json(); b = x && typeof x === 'object' ? x as Record<string, unknown> : {}; } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const kalender = text(b.kalender, 100);
  const datei = text(b.datei, 160);
  if (!kalender) return NextResponse.json({ ok: false, fehler: 'kalender fehlt.' }, { status: 400 });
  if (b.aktion !== 'probelauf' && b.aktion !== 'wiederherstellen') return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
  try {
    const wer = werAus(req);
    if (b.aktion === 'probelauf' || b.bestaetigt !== true) {
      const ergebnis = await kalenderWiederherstellen(kalender, { ...(datei ? { datei } : {}), wer });
      // Wiederherstellen ohne Bestätigung: nichts schreiben, den Probelauf zur Rückfrage zurückgeben.
      return NextResponse.json({ ok: b.aktion === 'probelauf', ergebnis, ...(b.aktion === 'wiederherstellen' ? { fehler: `Erst bestätigen: ${ergebnis.plan.fehlt} Termine würden neu angelegt.` } : {}) }, { status: b.aktion === 'probelauf' ? 200 : 409 });
    }
    const ergebnis = await kalenderWiederherstellen(kalender, { ...(datei ? { datei } : {}), bestaetigt: true, wer });
    return NextResponse.json({ ok: true, ergebnis });
  } catch (e) {
    if (e instanceof KalenderFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
    return NextResponse.json({ ok: false, fehler: 'Sicherung nicht lesbar.' }, { status: 500 });
  }
}
