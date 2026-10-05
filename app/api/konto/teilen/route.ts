// PUT { gesundheit: string[] } → wem ich meine Gesundheitsdaten zeige.
// Das ersetzt Kevins Entscheidung „Malin sieht alles" vom Vormittag durch
// eine Einstellung, die jede Person selbst trifft.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten } from '@/lib/zugang/konten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const wer = personStreng(req);
  if (!wer) return ohnePerson();
  let b: { gesundheit?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const alle = (await ladeKonten()).konten.map(k => k.speicher);
  const ziel = Array.isArray(b.gesundheit) ? (b.gesundheit as unknown[]).map(String).filter(s => s !== wer && alle.includes(s)) : [];
  await aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === wer ? { ...k, teilt: { ...k.teilt, gesundheit: ziel } } : k) }));
  return NextResponse.json({ ok: true, gesundheit: ziel });
}
