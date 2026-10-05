// ─── /api/brain/index — Stand und Aufbau des Brain-Index (27.09.) ───────────
// GET: Notizen, Abschnitte, Vektoren, letzter Lauf, Hinweis zu den Embeddings.
// POST { aktion: 'aufbauen' | 'vektoren' | 'arbeit' }: Index mit dem Vault abgleichen bzw.
// eine Portion Vektoren nachziehen bzw. (29.09.) den Such-Index der Arbeitsbestände
// (`app_chunks`, lib/brain/app-index.ts) neu bauen — Haushalt des Inhabers. Der Takt macht das
// alle 10 Minuten von selbst; hier für den Knopf auf der Wissen-Seite.

import { jsonBegrenzt, JSON_GROSS } from '@/lib/zugang/json-grenze';
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
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch { /* Standard: aufbauen */ }
  try {
    if (b.aktion === 'vektoren') return NextResponse.json({ ok: true, ...(await vektorenAuffuellen(128)), stand: indexStand() });
    if (b.aktion === 'arbeit') { const a = await import('@/lib/brain/app-index'); return NextResponse.json({ ok: true, lauf: await a.appIndexNeuBauen(), arbeit: a.appIndexStand() }); }
    const lauf = await aktualisieren(true);
    let vektoren: Awaited<ReturnType<typeof vektorenAuffuellen>> | null = null;
    if (embeddingsAktiv()) vektoren = await vektorenAuffuellen(64).catch(() => null);
    return NextResponse.json({ ok: true, lauf, vektoren, stand: indexStand() });
  } catch (e) { return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Aufbau fehlgeschlagen.' }, { status: 500 }); }
}
