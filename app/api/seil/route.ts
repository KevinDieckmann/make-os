// ─── MAKE OS — Seil: GET /api/seil (07.10.2026, LICHTFAEDEN.md › Seil) ───────────────────────────────────────────────────
// Stränge, die auf ihre Ziele zulaufen und sich dort zum Seil verdrillen — fertig gerechnet (Modell lib/lichtfaeden/seil.ts), der
// Browser zeichnet nur.
//   GET ?ebene=jahr|aufgaben &bereich=alle|privat|business &von=YYYY-MM-DD &bis=YYYY-MM-DD
//   → { ok, ebene, bereich, ansicht }
// Zugang: angemeldete Person im Haushalt des Inhabers; Dienstweg 403 (kein Hintergrundlauf braucht die Sicht). Bereich serverseitig:
// Konten mit `finanzRecht: 'business'` bekommen immer nur Business. Aufgaben in der Sicht der Person (fremde „nur ich“ fehlen ganz).
// Nur lesen, kein neuer Bestand, keine Personendaten in Logs; gzip ab 16 KB.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { jsonAntwort } from '@/lib/http/json-antwort';
import { localDay } from '@/lib/zeit';
import { MAX_SPANNE_TAGE } from '@/lib/lichtfaeden/anfrage';
import { seilAnsichtFuer, seilBereichFuer } from '@/lib/lichtfaeden/seil-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const gueltig = (t: string | null): t is string => !!t && TAG.test(t) && new Date(`${t}T00:00:00Z`).toISOString().slice(0, 10) === t;
const GESPERRT = { ok: false, fehler: 'Das Seil nur für eine angemeldete Person im Haushalt des Inhabers.' } as const;

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang || zugang.dienst) return NextResponse.json(GESPERRT, { status: 403 });
  const q = new URL(req.url).searchParams;
  const ebene = q.get('ebene') ?? 'jahr';
  if (ebene !== 'jahr' && ebene !== 'aufgaben') return NextResponse.json({ ok: false, fehler: 'Ebene jahr oder aufgaben.' }, { status: 400 });
  const roh = q.get('bereich') ?? 'alle';
  if (roh !== 'alle' && roh !== 'privat' && roh !== 'business') return NextResponse.json({ ok: false, fehler: 'Bereich alle, privat oder business.' }, { status: 400 });
  const heute = localDay();
  const jahr = Number(heute.slice(0, 4));
  const von = q.get('von') ?? `${jahr}-01-01`, bis = q.get('bis') ?? `${jahr + 1}-12-31`;
  if (!gueltig(von) || !gueltig(bis) || bis < von) return NextResponse.json({ ok: false, fehler: 'Zeitraum ungültig.' }, { status: 400 });
  if ((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 864e5 > MAX_SPANNE_TAGE) return NextResponse.json({ ok: false, fehler: 'Zeitraum zu lang.' }, { status: 400 });
  const bereich = await seilBereichFuer(zugang.person, roh);
  const ansicht = await seilAnsichtFuer({ person: zugang.person, ebene, bereich, von, bis, heute });
  return jsonAntwort(req, { ok: true, ebene, bereich, ansicht });
}
