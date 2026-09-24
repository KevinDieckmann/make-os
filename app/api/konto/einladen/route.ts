// POST → Einladungscode (nur Inhaber). 48 Stunden gültig, einmal einlösbar.
import { NextResponse } from 'next/server';
import { personAus } from '@/lib/jarvis/raum';
import { ladeKonten, aendereKonten, neuerEinladungscode, EINLADUNG_STUNDEN } from '@/lib/zugang/konten';
import { aussenAdresse } from '@/lib/innen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const wer = personAus(req);
  const ich = (await ladeKonten()).konten.find(k => k.speicher === wer);
  if (!ich || ich.rolle !== 'inhaber') return NextResponse.json({ error: 'Nur der Inhaber darf einladen.' }, { status: 403 });
  const code = neuerEinladungscode();
  const bis = new Date(Date.now() + EINLADUNG_STUNDEN * 3600_000).toISOString();
  await aendereKonten(s => ({ ...s, einladungen: [...s.einladungen.filter(e => Date.parse(e.bis) > Date.now()), { code, von: wer, bis }] }));
  // Die Adresse, unter der die eingeladene Person MAKE OS öffnet — nicht die,
  // unter der der Inhaber gerade surft (am Mac ist das localhost).
  return NextResponse.json({ ok: true, code, bis, stunden: EINLADUNG_STUNDEN, adresse: aussenAdresse() });
}
