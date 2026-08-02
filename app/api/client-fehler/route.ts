// ─── MAKE OS — Fehler aus dem Browser ───────────────────────────────────────
// Browser-Fehler sieht sonst nur, wer gerade davorsitzt. Diese Route schreibt
// sie mit, damit sie nachvollziehbar und behebbar sind.
//
// GET  → die letzten Meldungen lesen
// POST → eine Meldung anhängen (vom Fehler-Melder im /os-Layout)
// DELETE → Liste leeren, wenn alles behoben ist

import { NextResponse } from 'next/server';
import { loadJson, updateJson, saveJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Meldung {
  at: string;
  art: 'fehler' | 'versprechen' | 'react';
  text: string;
  quelle?: string;
  seite?: string;
  anzahl: number;
}
interface Datei { meldungen: Meldung[] }

const MAX = 60;

export async function GET() {
  const f = await loadJson<Datei>('client-fehler');
  const meldungen = Array.isArray(f?.meldungen) ? f.meldungen : [];
  return NextResponse.json({ meldungen, anzahl: meldungen.length });
}

export async function POST(req: Request) {
  let body: Partial<Meldung>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const text = String(body.text ?? '').trim().slice(0, 600);
  if (!text) return NextResponse.json({ ok: false }, { status: 400 });

  const art: Meldung['art'] = body.art === 'versprechen' || body.art === 'react' ? body.art : 'fehler';
  const quelle = body.quelle ? String(body.quelle).slice(0, 200) : undefined;
  const seite = body.seite ? String(body.seite).slice(0, 120) : undefined;

  await updateJson<Datei>('client-fehler', current => {
    const liste = Array.isArray(current?.meldungen) ? [...current.meldungen] : [];
    // Derselbe Fehler mehrfach? Zähler hoch statt die Liste zumüllen.
    const gleich = liste.find(m => m.text === text && m.seite === seite);
    if (gleich) {
      gleich.anzahl++;
      gleich.at = new Date().toISOString();
    } else {
      liste.unshift({ at: new Date().toISOString(), art, text, quelle, seite, anzahl: 1 });
    }
    return { meldungen: liste.slice(0, MAX) };
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await saveJson<Datei>('client-fehler', { meldungen: [] });
  return NextResponse.json({ ok: true });
}
