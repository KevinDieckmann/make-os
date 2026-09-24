// ─── Haushaltsfinanzen: lesen und einzeln ändern ────────────────────────────
// GET   → der ganze Haushalt der anfragenden Person (Stamm, Buchungen,
//         Schulden, Belege, Planwerte, Meta). Ohne Haushalt am Konto: 403.
// PATCH { teil, ops } → Einzeländerungen mit Stand-Prüfung (409 bei Konflikt).
//
// Massenänderungen (Import, Regel rückwirkend, Fixkosten je Empfänger)
// laufen über /api/haushalt/aktion — mit Vorschau.

import { NextResponse } from 'next/server';
import { haushaltVon, KEIN_ZUGANG } from '@/lib/finanzen/haushalt/zugriff';
import { ladeHaushalt, patchen, type Op } from '@/lib/finanzen/haushalt/speicher';
import { belegAufgabenAbgleichen } from '@/lib/finanzen/haushalt/aufgaben';
import { faelligeZeilen } from '@/lib/finanzen/haushalt/jarvis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEILE = ['buchungen', 'schulden', 'belege', 'plan', 'konten', 'kategorien', 'regeln'] as const;

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  // Nur fragen, ob es einen Zugang gibt — ohne die Daten zu laden.
  const nur = new URL(req.url).searchParams.get('nur');
  if (nur === 'zugang') return NextResponse.json({ ok: true, haushalt: z.haushalt });
  // Für die Heute-Seite: nur, was ansteht — Raten, Rechnungen, fehlender Kontoauszug.
  if (nur === 'signale') {
    const h = await ladeHaushalt(z.haushalt);
    return NextResponse.json({ ok: true, punkte: h.buchungen.length ? faelligeZeilen(h) : [], leer: !h.buchungen.length });
  }
  const h = await ladeHaushalt(z.haushalt);
  return NextResponse.json({ ok: true, haushalt: z.haushalt, person: z.person, ...h });
}

export async function PATCH(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: { teil?: unknown; ops?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const teil = TEILE.find(t => t === b.teil);
  if (!teil) return NextResponse.json({ ok: false, fehler: 'Unbekannter Teil.' }, { status: 400 });
  if (!Array.isArray(b.ops) || !b.ops.length) return NextResponse.json({ ok: false, fehler: 'Keine Änderungen.' }, { status: 400 });
  const ops = (b.ops as Op[]).slice(0, 200).filter(o => o && (o.op === 'upsert' || o.op === 'delete'));
  // Wer anlegt, steht dabei — nicht, was der Browser behauptet.
  if (teil === 'buchungen') for (const o of ops) if (o.op === 'upsert' && o.eintrag && !o.eintrag.id) o.eintrag.erfasst_von = z.person;
  const e = await patchen(z.haushalt, teil, ops);
  if (e.ok && teil === 'belege') await belegAufgabenAbgleichen(z.haushalt).catch(() => null);
  return NextResponse.json(e, { status: e.ok ? 200 : e.status });
}
