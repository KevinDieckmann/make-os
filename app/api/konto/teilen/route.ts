// PUT { gesundheit?: string[], ziele?: string[] } → wem ich meine Gesundheitsdaten bzw. meine EIGENEN Ziele zeige.
// Das ersetzt Kevins Entscheidung „Malin sieht alles" vom Vormittag durch
// eine Einstellung, die jede Person selbst trifft. Eigene Ziele (08.10., Kevin): Vorgabe „nicht geteilt“ — schalten nur
// sie selbst (lib/planung/eigene-ziele-sicht.ts). Nur die mitgeschickten Listen ändern sich; die andere bleibt, wie sie ist.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten } from '@/lib/zugang/konten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const wer = personStreng(req);
  if (!wer) return ohnePerson();
  let b: { gesundheit?: unknown; ziele?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.gesundheit === undefined && b.ziele === undefined) return NextResponse.json({ error: 'gesundheit oder ziele (Liste) nötig.' }, { status: 400 });
  const alle = (await ladeKonten()).konten.map(k => k.speicher);
  const liste = (v: unknown) => (Array.isArray(v) ? Array.from(new Set((v as unknown[]).map(String).filter(s => s !== wer && alle.includes(s)))) : []);
  const gesundheit = b.gesundheit !== undefined ? liste(b.gesundheit) : undefined;
  const ziele = b.ziele !== undefined ? liste(b.ziele) : undefined;
  const s = await aendereKonten(st => ({ ...st, konten: st.konten.map(k => (k.speicher === wer ? { ...k, teilt: { ...k.teilt, ...(gesundheit ? { gesundheit } : {}), ...(ziele ? { ziele } : {}) } } : k)) }));
  const ich = s.konten.find(k => k.speicher === wer);
  return NextResponse.json({ ok: true, gesundheit: ich?.teilt.gesundheit ?? [], ziele: ich?.teilt.ziele ?? [] });
}
