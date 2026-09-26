// ─── MAKE OS — Anmelden ─────────────────────────────────────────────────────
// E-Mail + Passwort → Sitzung. Bei falschen Angaben immer dieselbe Antwort,
// egal ob die E-Mail existiert: sonst könnte man Konten erraten.
import { NextResponse } from 'next/server';
import { ladeKonten, emailSauber, passwortStimmt } from '@/lib/zugang/konten';
import { mitSitzung } from '@/lib/zugang/antwort';
import { pruefe, fehlschlag, erfolg, adresse } from '@/lib/zugang/drossel';
import { notiere, adresseGekuerzt } from '@/lib/zugang/anmeldungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: { email?: string; passwort?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const email = emailSauber(b.email);
  // Bremse gegen Raten (lib/zugang/drossel.ts): je Adresse und je Paar Adresse+E-Mail — nicht je E-Mail
  // allein, sonst könnte jemand mit Kevins Adresse dessen Anmeldung dauerhaft sperren (26.09.).
  const adr = adresse(req);
  const schluessel = [`ip:${adr}`, `paar:${adr}|${email ?? '-'}`];
  const warte = Math.max(...schluessel.map(s => pruefe(s).warteSek));
  if (warte > 0) return NextResponse.json({ error: `Zu viele Versuche — bitte in ${warte > 90 ? `${Math.ceil(warte / 60)} Minuten` : `${warte} Sekunden`} erneut.` }, { status: 429, headers: { 'Retry-After': String(warte) } });
  const konto = email ? (await ladeKonten()).konten.find(k => k.email === email) : undefined;
  // Auch ohne Treffer einmal hashen, damit die Antwortzeit nichts verrät.
  const ok = konto ? await passwortStimmt(String(b.passwort ?? ''), konto) : (await passwortStimmt('x', { hash: '00', salz: '00' }), false);
  if (!konto || !ok) {
    schluessel.forEach(s => fehlschlag(s));
    if (konto) await notiere({ speicher: konto.speicher, art: 'anmelden', ok: false, adresse: adresseGekuerzt(adr) });
    return NextResponse.json({ error: 'E-Mail oder Passwort stimmen nicht.' }, { status: 401 });
  }
  schluessel.forEach(erfolg);
  await notiere({ speicher: konto.speicher, art: 'anmelden', ok: true, adresse: adresseGekuerzt(adr) });
  return mitSitzung(konto);
}
