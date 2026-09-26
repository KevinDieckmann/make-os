// ─── MAKE OS — Foto zu einem Gericht ────────────────────────────────────────
// POST   { id, daten: data-URL }  → speichert das Bild, hängt es ans Gericht (altes Bild weg)
// GET    ?name=…                  → das Bild (nur Haushalt des Inhabers)
// DELETE { id }                   → Bild vom Gericht nehmen und löschen

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { sauberDatei, wendeAn, type ErnaehrungFile } from '@/lib/ernaehrung/modell';
import { gerichtBildSpeichern, gerichtBildLesen, gerichtBildLoeschen } from '@/lib/ernaehrung/bilder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN = { ok: false, error: 'Nur für den Haushalt des Inhabers.' };

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  const name = new URL(req.url).searchParams.get('name') ?? '';
  const b = await gerichtBildLesen(name);
  if (!b) return new NextResponse('Nicht gefunden.', { status: 404 });
  return new NextResponse(new Uint8Array(b.daten), { headers: { 'Content-Type': b.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  if (zuGross(req, 3_500_000)) return ZU_GROSS(3_500_000);
  let b: { id?: string; daten?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = String(b.id ?? '').slice(0, 40);
  const f = sauberDatei(await loadJson<ErnaehrungFile>('ernaehrung'));
  const g = f.gerichte.find(x => x.id === id);
  if (!g) return NextResponse.json({ ok: false, error: 'Gericht nicht gefunden.' }, { status: 404 });
  const r = await gerichtBildSpeichern(String(b.daten ?? ''));
  if ('fehler' in r) return NextResponse.json({ ok: false, error: r.fehler }, { status: 400 });
  const next = await updateJson<ErnaehrungFile>('ernaehrung', cur => wendeAn(sauberDatei(cur), [{ liste: 'gerichte', op: 'upsert', eintrag: { id, bild: r.name } }], z.person).datei);
  if (g.bild && g.bild !== r.name) await gerichtBildLoeschen(g.bild);
  return NextResponse.json({ ok: true, bild: r.name, gericht: next.gerichte.find(x => x.id === id) ?? null });
}

export async function DELETE(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  let b: { id?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = String(b.id ?? '').slice(0, 40);
  let alt = '';
  await updateJson<ErnaehrungFile>('ernaehrung', cur => {
    const f = sauberDatei(cur);
    alt = f.gerichte.find(x => x.id === id)?.bild ?? '';
    return wendeAn(f, [{ liste: 'gerichte', op: 'upsert', eintrag: { id, bild: '' } }], z.person).datei;
  });
  if (alt) await gerichtBildLoeschen(alt);
  return NextResponse.json({ ok: true });
}
