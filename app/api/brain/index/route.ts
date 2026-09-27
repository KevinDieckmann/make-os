// ─── /api/brain/index — Stand und Aufbau des Brain-Index (27.09.) ───────────
// GET: Notizen, Abschnitte, Vektoren, letzter Lauf, Hinweis zu den Embeddings.
// POST { aktion: 'aufbauen' | 'vektoren' }: Index mit dem Vault abgleichen bzw.
// eine Portion Vektoren nachziehen — Haushalt des Inhabers. Der Takt macht das
// alle 10 Minuten von selbst; hier für den Knopf auf der Wissen-Seite.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { aktualisieren, indexStand, indexPfad } from '@/lib/brain/index';
import { vektorenAuffuellen, embeddingsAktiv, embeddingHinweis, MODELL, modelleOrdner } from '@/lib/brain/einbettung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = () => NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG();
  try {
    const s = indexStand();
    return NextResponse.json({ ok: true, ...s, datei: indexPfad(), embeddings: { aktiv: embeddingsAktiv(), modell: MODELL, ordner: modelleOrdner(), hinweis: embeddingHinweis(), offen: Math.max(0, s.chunks - s.vektoren) } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Index nicht lesbar.' }, { status: 500 }); }
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return KEIN_ZUGANG();
  let b: { aktion?: string } = {};
  try { b = await req.json(); } catch { /* Standard: aufbauen */ }
  try {
    if (b.aktion === 'vektoren') return NextResponse.json({ ok: true, ...(await vektorenAuffuellen(128)), stand: indexStand() });
    const lauf = await aktualisieren(true);
    let vektoren: Awaited<ReturnType<typeof vektorenAuffuellen>> | null = null;
    if (embeddingsAktiv()) vektoren = await vektorenAuffuellen(64).catch(() => null);
    return NextResponse.json({ ok: true, lauf, vektoren, stand: indexStand() });
  } catch (e) { return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Aufbau fehlgeschlagen.' }, { status: 500 }); }
}
