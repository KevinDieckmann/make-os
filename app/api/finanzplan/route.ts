// ─── Finanzplanung jetzt: lesen und in Schritten ändern ──────────────────────
// GET    → das ganze Dokument des Haushalts (ETag, gepackt) — `dokument: null`,
//          solange noch kein Startbestand hochgeladen ist.
// GET ?nur=kennzahlen → nur verdichtete Zahlen des aktiven Szenarios (ZOE, Startfläche).
// PATCH  { basisStand, ops: [{ pfad, alt?, neu?, feld? }] } → Operationen mit
//          Stand-Prüfung: 409 mit dem aktuellen Dokument, wenn jemand dazwischen war.
// Zugang nur über den Haushalt der Person (haushaltVon) — Kevin und Malin sind einer.

import { NextResponse } from 'next/server';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { ladeFinanzplan, dateiStand, patchen, kennzahlenVon } from '@/lib/finanzen/plan/speicher';
import { MAX_OPS, type Operation } from '@/lib/finanzen/plan/operationen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Kein Zugang zur Finanzplanung. Der Inhaber trägt den Haushalt unter System → Konto ein.' };
const MAX_BODY = 2_000_000;

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const nur = new URL(req.url).searchParams.get('nur');
  if (nur === 'kennzahlen') {
    const d = await ladeFinanzplan(z.haushalt);
    if (!d) return NextResponse.json({ ok: true, leer: true });
    return NextResponse.json({ ok: true, leer: false, ...kennzahlenVon(d) });
  }
  const etag = etagAus('fp', await dateiStand(z.haushalt), z.haushalt, z.person);
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const d = await ladeFinanzplan(z.haushalt);
  return jsonAntwort(req, { ok: true, haushalt: z.haushalt, person: z.person, dokument: d }, etag);
}

export async function PATCH(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  if (zuGross(req, MAX_BODY)) return ZU_GROSS(MAX_BODY);
  let b: { basisStand?: unknown; ops?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(b.ops) || !b.ops.length) return NextResponse.json({ ok: false, fehler: 'Keine Änderungen.' }, { status: 400 });
  if (b.ops.length > MAX_OPS) return NextResponse.json({ ok: false, fehler: `Höchstens ${MAX_OPS} Schritte auf einmal.` }, { status: 400 });
  const e = await patchen(z.haushalt, b.basisStand, b.ops as Operation[], z.person);
  if (e.ok) return NextResponse.json(e);
  // Bei 409 kommt das aktuelle Dokument mit — groß, deshalb gepackt.
  return e.status === 409 ? jsonAntwortMitStatus(req, e, 409) : NextResponse.json(e, { status: e.status });
}

function jsonAntwortMitStatus(req: Request, daten: unknown, status: number): Response {
  const r = jsonAntwort(req, daten);
  return new Response(r.body, { status, headers: r.headers });
}
