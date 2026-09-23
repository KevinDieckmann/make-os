// ─── MAKE OS — Wer ist heute dran? ──────────────────────────────────────────
// Die eine Frage, die das CRM beantwortet. Reine Regel, kein Modell:
// fällige Wiedervorlagen zuerst, dann Prio A, dann B — nur, wer erreichbar
// ist und einen Aufhänger hat.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { tagesliste, kanaele, pipelineStand, type Kontakt } from '@/lib/make-one/crm';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const n = Math.max(1, Math.min(30, Number(new URL(req.url).searchParams.get('n')) || 10));
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const heute = localDay();
  const liste = tagesliste(kontakte, heute, n).map(p => ({ ...p, kanaele: kanaele(p.kontakt) }));
  return NextResponse.json({ heute, liste, stand: pipelineStand(kontakte) });
}
