// ─── MAKE OS — Das erste Konto ──────────────────────────────────────────────
// Nur, solange es KEIN Konto gibt, und nur mit dem Einrichtungs-Code (seit 05.10.: Einmal-Code aus
// `node scripts/einrichtung-token.mjs`, lib/zugang/einrichtung.mjs) — der Beweis, dass hier der Besitzer der
// Installation sitzt. Der Generalschlüssel MAKE_OS_KEY gilt dafür nicht mehr (er landete sonst im Browser).
// Das erste Konto ist der Inhaber und darf einladen; der Code ist danach verbraucht (Datei gelöscht).
//
// Der Speichername entsteht aus dem Vornamen. Für Kevin heißt das „kevin" —
// und damit hängen seine gewachsenen Bestände ohne Umzug am neuen Konto.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten, emailSauber, passwortTauglich, passwortHashen, speicherName, type Konto } from '@/lib/zugang/konten';
import { mitSitzung } from '@/lib/zugang/antwort';
import { einrichtungsCodePruefen, einrichtungsCodeVerbrauchen } from '@/lib/zugang/einrichtungs-code';
import { pruefe, fehlschlag, erfolg, adresse } from '@/lib/zugang/drossel';
import { neueKennung } from '@/lib/kennung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: { code?: string; schluessel?: string; email?: string; name?: string; passwort?: string };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Bremse gegen das Raten des Schlüssels (26.09.).
  const bremse = `einrichten:${adresse(req)}`;
  const warte = pruefe(bremse).warteSek;
  if (warte > 0) return NextResponse.json({ error: `Zu viele Versuche — bitte in ${warte} Sekunden erneut.` }, { status: 429, headers: { 'Retry-After': String(warte) } });
  if ((await ladeKonten()).konten.length) return NextResponse.json({ error: 'Es gibt schon ein Konto. Bitte anmelden oder eine Einladung nutzen.' }, { status: 409 });
  // `schluessel` = Feldname der alten Anmeldeseite (ein offener Tab vor dem Upload schickt den Code darunter).
  const pruefung = await einrichtungsCodePruefen(b.code || b.schluessel);
  if (pruefung !== 'ok') {
    fehlschlag(bremse);
    const text = pruefung === 'falsch' ? 'Der Einrichtungs-Code stimmt nicht.'
      : 'Es gibt keinen gültigen Einrichtungs-Code. Im Terminal erzeugen: node scripts/einrichtung-token.mjs (am Server: docker compose exec app node scripts/einrichtung-token.mjs).';
    return NextResponse.json({ error: text }, { status: 403 });
  }
  erfolg(bremse);
  const email = emailSauber(b.email);
  const name = String(b.name ?? '').trim().slice(0, 80);
  if (!email) return NextResponse.json({ error: 'E-Mail ungültig.' }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: 'Name fehlt.' }, { status: 400 });
  if (!passwortTauglich(b.passwort)) return NextResponse.json({ error: 'Passwort: mindestens 10 Zeichen.' }, { status: 400 });

  const { hash, salz, kdf } = await passwortHashen(b.passwort);
  let konto: Konto | undefined;
  await aendereKonten(s => {
    if (s.konten.length) return s;
    const jetzt = new Date().toISOString();
    konto = { id: neueKennung('k'), speicher: speicherName(name, []), email, name, rolle: 'inhaber', hash, salz, kdf, angelegt: jetzt, teilt: { gesundheit: [] } };
    // Neue Instanz (05.10.): 2FA-Pflicht von Anfang an — der Inhaber richtet den zweiten Faktor gleich mit ein.
    // Und ohne Mac-Zulieferer (08.10., Lücke 10): eine neue Instanz führt alles auf dem Server (lib/zulieferer/schalter.ts).
    return { ...s, konten: [konto], einstellungen: { ...s.einstellungen, zweiFaktorPflicht: true, zweiFaktorPflichtSeit: jetzt, zulieferer: 'aus', zuliefererSeit: jetzt } };
  });
  if (!konto) return NextResponse.json({ error: 'Gleichzeitig eingerichtet — bitte anmelden.' }, { status: 409 });
  await einrichtungsCodeVerbrauchen();
  return mitSitzung(konto, { zweiterFaktorEinrichten: true });
}
