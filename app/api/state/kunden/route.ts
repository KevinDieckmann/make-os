// ─── MAKE OS — Kunden (lokal) ───────────────────────────────────────────────
// Die Mandate von KD Ventures: wer, Status, monatlicher Cashflow, nächster
// Schritt. Roadmap Phase 5 — hier beginnt der Kundenbereich.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

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

export async function PUT(req: Request) {
  let body: { kunden?: Kunde[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.kunden)) return NextResponse.json({ ok: false, error: 'kunden fehlt.' }, { status: 400 });
  const sauber: Kunde[] = body.kunden.slice(0, 50).map(k => ({
    id: k.id || `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: String(k.name ?? '').slice(0, 120),
    status: (['aktiv', 'gespraech', 'ruht'] as const).includes(k.status) ? k.status : 'gespraech',
    mandat: k.mandat ? String(k.mandat).slice(0, 300) : undefined,
    cashflow: isFinite(Number(k.cashflow)) && Number(k.cashflow) > 0 ? Math.round(Number(k.cashflow)) : undefined,
    naechsterSchritt: k.naechsterSchritt ? String(k.naechsterSchritt).slice(0, 300) : undefined,
    notizen: k.notizen ? String(k.notizen).slice(0, 4000) : undefined,
  })).filter(k => k.name);
  const next = await updateJson<KundenFile>('kunden', () => ({ kunden: sauber }));
  return NextResponse.json({ ok: true, kunden: next.kunden });
}
