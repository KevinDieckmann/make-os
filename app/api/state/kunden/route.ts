// ─── MAKE OS — Kunden (lokal) ───────────────────────────────────────────────
// Die Mandate von KD Ventures: wer, Status, monatlicher Cashflow, nächster
// Schritt. Roadmap Phase 5 — hier beginnt der Kundenbereich.

import { NextResponse } from 'next/server';
import { loadJson, updateJson, updateGeschuetzt } from '@/lib/store/local-db';
import { listePatchen, opsLesen } from '@/lib/store/patch-liste';

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

// Startbestand aus Kevins Diktat — er pflegt weiter.
const SEED: Kunde[] = [
  { id: 'onebanking', name: 'OneBanking', status: 'aktiv', mandat: 'Beratung/Umsetzung — Rechnung offen (02.08)', naechsterSchritt: 'Rechnung stellen · Upselling Vertriebsassistenz vorbereiten' },
  { id: 'gregor', name: 'Gregor', status: 'gespraech', mandat: 'Anbahnung', naechsterSchritt: 'Mandat konkretisieren' },
];

export async function GET() {
  const f = await loadJson<KundenFile>('kunden');
  if (!f || !Array.isArray(f.kunden) || !f.kunden.length) {
    const next = await updateJson<KundenFile>('kunden', () => ({ kunden: SEED }));
    return NextResponse.json({ kunden: next.kunden });
  }
  return NextResponse.json({ kunden: f.kunden });
}

/** Ein Kunde, geprüft — von PUT und PATCH gemeinsam benutzt. */
function sauberKunde(roh: unknown): Kunde | null {
  const k = (roh ?? {}) as Partial<Kunde>;
  const name = String(k.name ?? '').slice(0, 120);
  if (!name) return null;
  return {
    id: k.id || `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    status: (['aktiv', 'gespraech', 'ruht'] as const).includes(k.status as Kunde['status']) ? k.status as Kunde['status'] : 'gespraech',
    mandat: k.mandat ? String(k.mandat).slice(0, 300) : undefined,
    cashflow: isFinite(Number(k.cashflow)) && Number(k.cashflow) > 0 ? Math.round(Number(k.cashflow)) : undefined,
    naechsterSchritt: k.naechsterSchritt ? String(k.naechsterSchritt).slice(0, 300) : undefined,
    notizen: k.notizen ? String(k.notizen).slice(0, 4000) : undefined,
  };
}

export async function PUT(req: Request) {
  let body: { kunden?: Kunde[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.kunden)) return NextResponse.json({ ok: false, error: 'kunden fehlt.' }, { status: 400 });
  const sauber = body.kunden.slice(0, 50).map(sauberKunde).filter((k): k is Kunde => !!k);
  const { ok, next } = await updateGeschuetzt<KundenFile>('kunden', { kunden: sauber }, s => s.kunden?.length ?? 0, 4);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das haette ueber die Haelfte der Kunden geloescht.' }, { status: 409 });
  return NextResponse.json({ ok: true, kunden: next.kunden });
}

/** Einzelne Kunden ändern — Zwei-Fenster-Fundament (siehe lib/store/patch-liste). */
export async function PATCH(req: Request) {
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const ops = opsLesen<Kunde>(body.ops, sauberKunde, 50);
  if (!ops) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });
  const r = await listePatchen<Kunde, KundenFile & Record<string, unknown>>('kunden', 'kunden', ops, 4);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler }, { status: r.fehler?.startsWith('Abgelehnt') ? 409 : 400 });
  return NextResponse.json({ ok: true, angewandt: r.angewandt, kunden: r.next?.kunden });
}
