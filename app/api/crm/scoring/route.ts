// ─── Markttraktion · Qualifizierung & Scoring — die Einstellungen (03.10.) ──────────────────────
// GET    → { einstellungen, stand, standard, bisherig, messungen, verlauf, zurueckMoeglich, grenzen }
// PATCH  { aktion: 'speichern', einstellungen, stand }   → eigene Fassung (geprüft; nichts wird still gekürzt: 400/413 mit Pfad je Fehler)
//        { aktion: 'standard' | 'bisherig' | 'zurueck', stand } → auf Standard zurück · bisherige Rechnung (bis 03.10.) wählen · letzte Änderung zurücknehmen
//          ('vorschlag' gilt weiter als Alias von 'standard': der Vorschlag IST seit 03.10. der Standard)
// Jede Änderung braucht den Stand (Fingerabdruck der gelesenen Einstellungen) — veraltet: 409 mit dem aktuellen Stand.
// Lesen: Haushalt des Inhabers (auch Dienstweg mit Person). Schreiben: nur eine angemeldete Person des Haushalts (Dienstweg → 403).
// Wirkung: Leads, Akte, Lifecycle (MQL), Segmente, Heads und ZOE rechnen sofort mit den neuen Werten (crm.scoring, ladeCrm).
// Speicher: Bestand `crm-scoring` (lib/crm/scoring-server.ts).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { speicherStand } from '@/lib/store/local-db';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { personAus } from '@/lib/zoe/raum';
import { MESSUNGEN, MESSUNG_IDS, SCORING_GRENZEN, standardScoring, bisherigeRechnung } from '@/lib/crm/scoring';
import { scoringDateiLaden, scoringSchreiben, scoringStand, type ScoringAuftrag } from '@/lib/crm/scoring-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = () => NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
const MAX_BYTES = 400_000;

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG();
  const etag = etagAus('sc1', await speicherStand(['crm-scoring']));
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const d = await scoringDateiLaden();
  return jsonAntwort(req, {
    ok: true, einstellungen: d.einstellungen, stand: scoringStand(d.einstellungen),
    standard: standardScoring(), bisherig: bisherigeRechnung(),
    messungen: MESSUNG_IDS.map(id => ({ id, label: MESSUNGEN[id].label, hinweis: MESSUNGEN[id].hinweis, stufen: MESSUNGEN[id].stufen })),
    verlauf: d.verlauf.slice(0, 10), zurueckMoeglich: d.vorherige.length > 0, grenzen: SCORING_GRENZEN,
  }, etag);
}

export async function PATCH(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return KEIN_ZUGANG();
  if (zugang.dienst) return NextResponse.json({ ok: false, fehler: 'Die Scoring-Einstellungen ändert nur eine angemeldete Person von Hand.' }, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  const laenge = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(laenge) && laenge > MAX_BYTES) return NextResponse.json({ ok: false, fehler: 'Die Einstellungen sind zu groß.' }, { status: 413 });
  let b: { aktion?: string; einstellungen?: unknown; stand?: unknown };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const auftrag: ScoringAuftrag | null = b.aktion === 'speichern' ? { art: 'eigen', roh: b.einstellungen } : b.aktion === 'standard' || b.aktion === 'vorschlag' ? { art: 'standard' } : b.aktion === 'bisherig' ? { art: 'bisherig' } : b.aktion === 'zurueck' ? { art: 'zurueck' } : null;
  if (!auftrag) return NextResponse.json({ ok: false, fehler: 'aktion: speichern, standard, bisherig oder zurueck.' }, { status: 400 });
  const r = await scoringSchreiben(auftrag, b.stand, zugang.person ?? personAus(req), werAus(req));
  if (r.ok) return NextResponse.json({ ok: true, einstellungen: r.einstellungen, stand: r.stand, zurueckMoeglich: (await scoringDateiLaden()).vorherige.length > 0 });
  if (r.art === 'konflikt') return NextResponse.json({ ok: false, fehler: 'Die Einstellungen wurden inzwischen geändert — neu geladen, bitte noch einmal.', konflikt: true, einstellungen: r.einstellungen, stand: r.stand }, { status: 409 });
  if (r.art === 'fehler') return NextResponse.json({ ok: false, fehler: r.fehler.map(f => f.text).join(' · '), felder: r.fehler }, { status: r.status });
  return NextResponse.json({ ok: false, fehler: r.text }, { status: 409 });
}
