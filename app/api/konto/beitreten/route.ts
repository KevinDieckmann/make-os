// ─── MAKE OS — Mit Einladung beitreten ──────────────────────────────────────
// Code + E-Mail + Name + Passwort → Konto als Mitglied. Der Speichername kommt
// aus dem Vornamen: Malin wird „malin" — und findet ihre bestehenden Bestände.
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten, emailSauber, passwortTauglich, passwortHashen, speicherName, RESERVIERTE_SPEICHER, type Konto } from '@/lib/zugang/konten';
import { mitSitzung } from '@/lib/zugang/antwort';
import { pruefe, fehlschlag, erfolg, adresse } from '@/lib/zugang/drossel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: { code?: string; email?: string; name?: string; passwort?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const code = String(b.code ?? '').trim().toUpperCase();
  const email = emailSauber(b.email);
  const name = String(b.name ?? '').trim().slice(0, 80);
  if (!email) return NextResponse.json({ error: 'E-Mail ungültig.' }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: 'Name fehlt.' }, { status: 400 });
  if (!passwortTauglich(b.passwort)) return NextResponse.json({ error: 'Passwort: mindestens 10 Zeichen.' }, { status: 400 });

  // Bremse gegen das Raten von Einladungscodes (je Adresse).
  const ip = `code:${adresse(req)}`;
  const warte = pruefe(ip).warteSek;
  if (warte > 0) return NextResponse.json({ error: `Zu viele Versuche — bitte in ${warte > 90 ? `${Math.ceil(warte / 60)} Minuten` : `${warte} Sekunden`} erneut.` }, { status: 429, headers: { 'Retry-After': String(warte) } });
  const s0 = await ladeKonten();
  const einladung = s0.einladungen.find(e => e.code === code && Date.parse(e.bis) > Date.now());
  if (!einladung) { fehlschlag(ip); return NextResponse.json({ error: 'Einladungscode unbekannt oder abgelaufen.' }, { status: 403 }); }
  erfolg(ip);
  if (s0.konten.some(k => k.email === email)) return NextResponse.json({ error: 'Diese E-Mail hat schon ein Konto — bitte anmelden.' }, { status: 409 });

  const { hash, salz } = await passwortHashen(b.passwort);
  let konto: Konto | undefined;
  await aendereKonten(s => {
    if (!s.einladungen.some(e => e.code === code)) return s;
    // Der Speichername kommt aus der Einladung (vom Inhaber gebunden) — sonst aus dem Vornamen,
    // aber nie ein reservierter Name: „Malin“ als Vorname übernimmt nicht Malins Bestände (26.09.).
    const vergeben = s.konten.map(k => k.speicher);
    const gebunden = einladung.speicher && !vergeben.includes(einladung.speicher) ? einladung.speicher : undefined;
    konto = { id: `k-${Date.now().toString(36)}`, speicher: gebunden ?? speicherName(name, [...vergeben, ...RESERVIERTE_SPEICHER]), email, name, rolle: 'mitglied', hash, salz, angelegt: new Date().toISOString(), teilt: { gesundheit: [] }, eingeladenVon: einladung.von };
    return { konten: [...s.konten, konto], einladungen: s.einladungen.filter(e => e.code !== code) };
  });
  if (!konto) return NextResponse.json({ error: 'Der Code wurde gerade eingelöst.' }, { status: 409 });
  return mitSitzung(konto);
}
