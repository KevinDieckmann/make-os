// ─── MAKE OS — Das erste Konto ──────────────────────────────────────────────
// Nur, solange es KEIN Konto gibt, und nur mit dem Zugangsschlüssel aus
// .env.local — der Beweis, dass hier der Besitzer der Installation sitzt.
// Das erste Konto ist der Inhaber und darf einladen.
//
// Der Speichername entsteht aus dem Vornamen. Für Kevin heißt das „kevin" —
// und damit hängen seine gewachsenen Bestände ohne Umzug am neuen Konto.

import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten, emailSauber, passwortTauglich, passwortHashen, speicherName, type Konto } from '@/lib/zugang/konten';
import { mitSitzung } from '@/lib/zugang/antwort';
import { gleich } from '@/lib/zugang/sitzung';
import { pruefe, fehlschlag, erfolg, adresse } from '@/lib/zugang/drossel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: { schluessel?: string; email?: string; name?: string; passwort?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Bremse gegen das Raten des Schlüssels (26.09.).
  const bremse = `einrichten:${adresse(req)}`;
  const warte = pruefe(bremse).warteSek;
  if (warte > 0) return NextResponse.json({ error: `Zu viele Versuche — bitte in ${warte} Sekunden erneut.` }, { status: 429, headers: { 'Retry-After': String(warte) } });
  if ((await ladeKonten()).konten.length) return NextResponse.json({ error: 'Es gibt schon ein Konto. Bitte anmelden oder eine Einladung nutzen.' }, { status: 409 });
  if (!process.env.MAKE_OS_KEY || !gleich(String(b.schluessel ?? ''), process.env.MAKE_OS_KEY)) { fehlschlag(bremse); return NextResponse.json({ error: 'Der Zugangsschlüssel stimmt nicht.' }, { status: 403 }); }
  erfolg(bremse);
  const email = emailSauber(b.email);
  const name = String(b.name ?? '').trim().slice(0, 80);
  if (!email) return NextResponse.json({ error: 'E-Mail ungültig.' }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: 'Name fehlt.' }, { status: 400 });
  if (!passwortTauglich(b.passwort)) return NextResponse.json({ error: 'Passwort: mindestens 10 Zeichen.' }, { status: 400 });

  const { hash, salz } = await passwortHashen(b.passwort);
  let konto: Konto | undefined;
  await aendereKonten(s => {
    if (s.konten.length) return s;
    konto = { id: `k-${Date.now().toString(36)}`, speicher: speicherName(name, []), email, name, rolle: 'inhaber', hash, salz, angelegt: new Date().toISOString(), teilt: { gesundheit: [] } };
    return { ...s, konten: [konto] };
  });
  if (!konto) return NextResponse.json({ error: 'Gleichzeitig eingerichtet — bitte anmelden.' }, { status: 409 });
  return mitSitzung(konto);
}
