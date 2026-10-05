// POST → Einladungscode (nur Inhaber). 48 Stunden gültig, einmal einlösbar.
import { jsonBegrenzt } from '@/lib/zugang/json-grenze';
import { personDerSitzung, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten, neuerEinladungscode, speicherName, emailSauber, adresseVergeben, EINLADUNG_STUNDEN } from '@/lib/zugang/konten';
import { aussenAdresse } from '@/lib/innen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const wer = personDerSitzung(req);
  if (!wer) return ohnePerson();
  const ich = (await ladeKonten()).konten.find(k => k.speicher === wer);
  if (!ich || ich.rolle !== 'inhaber') return NextResponse.json({ error: 'Nur der Inhaber darf einladen.' }, { status: 403 });
  // Optional: für wen (Vorname) — bindet den Speichernamen an den Code (26.09.).
  // Optional (03.10.): für welche E-Mail-Adresse — sie darf in der Instanz noch nicht vorkommen (Haupt- oder weitere Adresse
  // eines Kontos, andere offene Einladung) und ist dann bis zum Ablauf für diese Einladung reserviert.
  let fuer = '';
  let adresseRoh: unknown;
  try { const b = await jsonBegrenzt(req); fuer = typeof b?.fuer === 'string' ? b.fuer.trim().slice(0, 40) : ''; adresseRoh = b?.email; } catch { /* kein Body ist in Ordnung */ }
  const email = adresseRoh === undefined || adresseRoh === null || adresseRoh === '' ? undefined : emailSauber(adresseRoh);
  if (email === null) return NextResponse.json({ error: 'E-Mail ungültig.' }, { status: 400 });
  const speicher = fuer ? speicherName(fuer, []) : undefined;
  const code = neuerEinladungscode();
  const bis = new Date(Date.now() + EINLADUNG_STUNDEN * 3600_000).toISOString();
  let vergeben = false;
  await aendereKonten(s => {
    if (email && adresseVergeben(s, email)) { vergeben = true; return s; }
    return { ...s, einladungen: [...s.einladungen.filter(e => Date.parse(e.bis) > Date.now()), { code, von: wer, bis, ...(speicher ? { speicher } : {}), ...(email ? { email } : {}) }] };
  });
  if (vergeben) return NextResponse.json({ error: 'Diese E-Mail-Adresse ist schon vergeben (Konto oder offene Einladung).' }, { status: 409 });
  // Die Adresse, unter der die eingeladene Person MAKE OS öffnet — nicht die,
  // unter der der Inhaber gerade surft (am Mac ist das localhost).
  return NextResponse.json({ ok: true, code, bis, stunden: EINLADUNG_STUNDEN, adresse: aussenAdresse(), ...(speicher ? { speicher } : {}) });
}
