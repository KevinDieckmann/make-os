// ─── MAKE OS — Finanz-Grundlage (Bestand) ───────────────────────────────────
// Der Export aus Malins Finanz-Dashboard liegt hier im Original. MAKE OS
// rechnet damit, verändert ihn aber nie — gepflegt wird im Dashboard.
//
// Beim nächsten Stand: den Export erneut als PUT schicken. Der alte Stand
// wird ersetzt, die Ableitung rechnet sich neu. Ein Export mit deutlich
// weniger Positionen als der gespeicherte wird abgelehnt (409) — ein halb
// geladenes Dashboard soll die Grundlage nicht auslöschen.

import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetzt } from '@/lib/store/local-db';
import { lesen, kennzahlen, monatsBild, kostenNachKategorie, type MalinExport } from '@/lib/make-one/grundlage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Datei { roh: MalinExport; stand: string; geladen: string }

const positionen = (d: Datei | null) =>
  (d?.roh?.s?.invOut?.length ?? 0) + (d?.roh?.p?.bank?.length ?? 0) + (d?.roh?.p?.sch?.length ?? 0);

export async function GET() {
  const d = await loadJson<Datei>('grundlage');
  if (!d?.roh) {
    return NextResponse.json({ vorhanden: false, hinweis: 'Noch kein Export aus Malins Finanz-Dashboard geladen.' });
  }
  const g = lesen(d.roh, d.stand);
  // 24.09.: Privates bleibt draußen. Das Privatkonto (p.bank) und die privaten
  // Schulden (p.sch) aus Malins altem Export gehören in die Haushaltsfinanzen —
  // diese Route liest jedes Konto, auch ohne Haushalt.
  const { privat: _p, schulden: _s, ...business } = g;
  const { schuldenRest: _r, schuldenRateMonat: _m, ...kz } = kennzahlen(g);
  return NextResponse.json({
    vorhanden: true,
    stand: d.stand,
    geladen: d.geladen,
    grundlage: { ...business, privat: [], schulden: [] },
    kennzahlen: { ...kz, schuldenRest: 0, schuldenRateMonat: 0 },
    monate: monatsBild(g),
    kategorien: kostenNachKategorie(g),
  });
}

export async function PUT(req: Request) {
  let body: { roh?: MalinExport; stand?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const roh = body.roh;
  if (!roh || typeof roh !== 'object' || (!roh.s?.invOut && !roh.p?.bank)) {
    return NextResponse.json({ ok: false, error: 'Das sieht nicht nach einem Export aus dem Finanz-Dashboard aus (s.invOut/p.bank fehlen).' }, { status: 400 });
  }
  const stand = /^\d{4}-\d{2}-\d{2}$/.test(String(body.stand)) ? String(body.stand) : new Date().toISOString().slice(0, 10);
  const neu: Datei = { roh, stand, geladen: new Date().toISOString() };

  const { ok, next } = await updateGeschuetzt<Datei>('grundlage', neu, positionen);
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Abgelehnt: der neue Export hat weniger als die Hälfte der bisherigen Positionen.' }, { status: 409 });
  }
  const g = lesen(next.roh, next.stand);
  return NextResponse.json({ ok: true, stand: next.stand, kennzahlen: kennzahlen(g) });
}
