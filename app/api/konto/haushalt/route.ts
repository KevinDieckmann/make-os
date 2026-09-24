// ─── Wer gehört zu welchem Haushalt? (nur Inhaber) ──────────────────────────
// GET → alle Konten mit ihrem Haushalt. PUT { speicher, haushalt | null }.
// Private Finanzen sieht nur, wer hier einem Haushalt zugeordnet ist.

import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten } from '@/lib/zugang/konten';
import { personStreng, HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function istInhaber(req: Request): Promise<boolean> {
  const p = personStreng(req);
  if (!p) return false;
  return (await ladeKonten()).konten.some(k => k.speicher === p && k.rolle === 'inhaber');
}

export async function GET(req: Request) {
  if (!(await istInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  const k = (await ladeKonten()).konten.map(x => ({ speicher: x.speicher, name: x.name, rolle: x.rolle, haushalt: x.haushalt ?? null }));
  return NextResponse.json({ ok: true, konten: k });
}

export async function PUT(req: Request) {
  if (!(await istInhaber(req))) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  let b: { speicher?: unknown; haushalt?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const speicher = String(b.speicher ?? '');
  const haushalt = b.haushalt === null || b.haushalt === '' ? null : String(b.haushalt ?? '').trim().toLowerCase();
  if (haushalt !== null && !HAUSHALT_OK.test(haushalt)) return NextResponse.json({ ok: false, fehler: 'Ungültiger Haushaltsname.' }, { status: 400 });
  let gefunden = false;
  await aendereKonten(s => ({ ...s, konten: s.konten.map(k => {
    if (k.speicher !== speicher) return k;
    gefunden = true;
    const { haushalt: _alt, ...rest } = k;
    return haushalt ? { ...rest, haushalt } : rest;
  }) }));
  if (!gefunden) return NextResponse.json({ ok: false, fehler: 'Konto nicht gefunden.' }, { status: 404 });
  return NextResponse.json({ ok: true, speicher, haushalt });
}
