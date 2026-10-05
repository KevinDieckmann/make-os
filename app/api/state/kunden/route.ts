// ─── MAKE OS — Kunden (lokal) ───────────────────────────────────────────────
// Die Mandate von KD Ventures: wer, Status, monatlicher Cashflow, nächster
// Schritt. Roadmap Phase 5 — hier beginnt der Kundenbereich.

import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetzt } from '@/lib/store/local-db';
import { karteiZugang, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { protokolliereBestand, werAus } from '@/lib/store/aenderungsprotokoll';
import { listePatchen, opsLesen, opsFehler } from '@/lib/store/patch-liste';
import { neueKennung } from '@/lib/kennung';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface Kunde {
  id: string;
  name: string;
  status: 'aktiv' | 'gespraech' | 'ruht';
  mandat?: string;
  /** €/Monat — ehrlich gepflegt, fließt später in den Score. */
  cashflow?: number;
  naechsterSchritt?: string;
  /** Freitext-Notizen — Gesprächsstände, Vereinbarungen, Kontext. */
  notizen?: string;
}
interface KundenFile { kunden: Kunde[] }

// Kein Startbestand (28.09., K1): hier standen echte Kundennamen im Code (Regel 1 „keine echten Daten im
// Repo“). Ein neuer Haushalt beginnt leer; ein bestehender Bestand wird nie angefasst.
export async function GET(req: Request) {
  // Haushalt des Inhabers (28.09., K1 #66/#67) — vorher reichte „angemeldet“.
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  leseZugriff(req, 'kontakte'); // Lese-Protokoll (05.10.) — Kundenliste
  const f = await loadJson<KundenFile>('kunden');
  return NextResponse.json({ kunden: Array.isArray(f?.kunden) ? f.kunden : [] });
}

/** Ein Kunde, geprüft — von PUT und PATCH gemeinsam benutzt. */
function sauberKunde(roh: unknown): Kunde | null {
  const k = (roh ?? {}) as Partial<Kunde>;
  const name = String(k.name ?? '').slice(0, 120);
  if (!name) return null;
  return {
    id: k.id || neueKennung('k'),
    name,
    status: (['aktiv', 'gespraech', 'ruht'] as const).includes(k.status as Kunde['status']) ? k.status as Kunde['status'] : 'gespraech',
    mandat: k.mandat ? String(k.mandat).slice(0, 300) : undefined,
    cashflow: isFinite(Number(k.cashflow)) && Number(k.cashflow) > 0 ? Math.round(Number(k.cashflow)) : undefined,
    naechsterSchritt: k.naechsterSchritt ? String(k.naechsterSchritt).slice(0, 300) : undefined,
    notizen: k.notizen ? String(k.notizen).slice(0, 4000) : undefined,
  };
}

export async function PUT(req: Request) {
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  let body: { kunden?: Kunde[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.kunden)) return NextResponse.json({ ok: false, error: 'kunden fehlt.' }, { status: 400 });
  // Mehr als 50: ablehnen, nie still kürzen (28.09., K1).
  if (body.kunden.length > 50) return NextResponse.json({ ok: false, error: `Abgelehnt: ${body.kunden.length} Kunden — höchstens 50.` }, { status: 413 });
  const sauber = body.kunden.map(sauberKunde).filter((k): k is Kunde => !!k);
  const vorher = await loadJson<KundenFile>('kunden');
  const { ok, next } = await updateGeschuetzt<KundenFile>('kunden', { kunden: sauber }, s => s.kunden?.length ?? 0, 4);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das haette ueber die Haelfte der Kunden geloescht.' }, { status: 409 });
  await protokolliereBestand('kunden', vorher, next, werAus(req));
  return NextResponse.json({ ok: true, kunden: next.kunden });
}

/** Einzelne Kunden ändern — Zwei-Fenster-Fundament (siehe lib/store/patch-liste). */
export async function PATCH(req: Request) {
  if (!(await karteiZugang(req))) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const ops = opsLesen<Kunde>(body.ops, sauberKunde, 50);
  if (!ops) return NextResponse.json({ ok: false, error: opsFehler(body.ops, 50) }, { status: Array.isArray(body.ops) ? 413 : 400 });
  const r = await listePatchen<Kunde, KundenFile & Record<string, unknown>>('kunden', 'kunden', ops, 4, undefined, { wer: werAus(req) });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler }, { status: r.fehler?.startsWith('Abgelehnt') ? 409 : 400 });
  return NextResponse.json({ ok: true, angewandt: r.angewandt, kunden: r.next?.kunden });
}
