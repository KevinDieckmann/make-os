// POST → Einladungscode (nur Inhaber). 48 Stunden gültig, einmal einlösbar.
import { NextResponse } from 'next/server';
import { personAus } from '@/lib/jarvis/raum';
import { ladeKonten, aendereKonten, neuerEinladungscode, speicherName, EINLADUNG_STUNDEN } from '@/lib/zugang/konten';
import { aussenAdresse } from '@/lib/innen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const wer = personAus(req);
  const ich = (await ladeKonten()).konten.find(k => k.speicher === wer);
  if (!ich || ich.rolle !== 'inhaber') return NextResponse.json({ error: 'Nur der Inhaber darf einladen.' }, { status: 403 });
  // Optional: für wen (Vorname) — bindet den Speichernamen an den Code (26.09.).
  let fuer = '';
  try { const b = await req.json(); fuer = typeof b?.fuer === 'string' ? b.fuer.trim().slice(0, 40) : ''; } catch { /* kein Body ist in Ordnung */ }
  const speicher = fuer ? speicherName(fuer, []) : undefined;
  const code = neuerEinladungscode();
  const bis = new Date(Date.now() + EINLADUNG_STUNDEN * 3600_000).toISOString();
  await aendereKonten(s => ({ ...s, einladungen: [...s.einladungen.filter(e => Date.parse(e.bis) > Date.now()), { code, von: wer, bis, ...(speicher ? { speicher } : {}) }] }));
  // Die Adresse, unter der die eingeladene Person MAKE OS öffnet — nicht die,
  // unter der der Inhaber gerade surft (am Mac ist das localhost).
  return NextResponse.json({ ok: true, code, bis, stunden: EINLADUNG_STUNDEN, adresse: aussenAdresse(), ...(speicher ? { speicher } : {}) });
}
