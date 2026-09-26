// GET → wer bin ich, wer ist sonst noch da (Namen, keine Geheimnisse).
// PUT → Name oder Passwort ändern.
import { NextResponse } from 'next/server';
import { personAus } from '@/lib/jarvis/raum';
import { ladeKonten, aendereKonten, oeffentlich, passwortTauglich, passwortHashen, passwortStimmt } from '@/lib/zugang/konten';
import { mitSitzung } from '@/lib/zugang/antwort';
import { pruefe, fehlschlag, erfolg, adresse } from '@/lib/zugang/drossel';
import { notiere, adresseGekuerzt, letzte } from '@/lib/zugang/anmeldungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const wer = personAus(req);
  const s = await ladeKonten();
  const ich = s.konten.find(k => k.speicher === wer);
  if (!ich) return NextResponse.json({ error: 'Konto nicht gefunden.' }, { status: 401 });
  return NextResponse.json({
    ich: oeffentlich(ich),
    anmeldungen: await letzte(wer, 5),
    andere: s.konten.filter(k => k.speicher !== wer).map(k => ({ speicher: k.speicher, name: k.name, rolle: k.rolle, teiltGesundheitMitMir: k.teilt.gesundheit.includes(wer) })),
  });
}

export async function PUT(req: Request) {
  const wer = personAus(req);
  let b: { name?: string; passwortAlt?: string; passwortNeu?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const s = await ladeKonten();
  const ich = s.konten.find(k => k.speicher === wer);
  if (!ich) return NextResponse.json({ error: 'Konto nicht gefunden.' }, { status: 401 });
  const name = b.name ? String(b.name).trim().slice(0, 80) : undefined;
  let neu: { hash: string; salz: string } | undefined;
  if (b.passwortNeu !== undefined) {
    // Auch hier eine Bremse: mit gestohlener Sitzung ließe sich sonst das alte Passwort online raten (26.09.).
    const bremse = `pw:${wer}`;
    const warte = pruefe(bremse).warteSek;
    if (warte > 0) return NextResponse.json({ error: `Zu viele Versuche — bitte in ${warte} Sekunden erneut.` }, { status: 429, headers: { 'Retry-After': String(warte) } });
    if (!(await passwortStimmt(String(b.passwortAlt ?? ''), ich))) { fehlschlag(bremse); return NextResponse.json({ error: 'Das alte Passwort stimmt nicht.' }, { status: 403 }); }
    erfolg(bremse);
    if (!passwortTauglich(b.passwortNeu)) return NextResponse.json({ error: 'Neues Passwort: mindestens 10 Zeichen.' }, { status: 400 });
    neu = await passwortHashen(b.passwortNeu);
  }
  await aendereKonten(st => ({ ...st, konten: st.konten.map(k => k.speicher === wer ? { ...k, ...(name && name.length >= 2 ? { name } : {}), ...(neu ?? {}) } : k) }));
  // Neues Passwort → neuer Stand: dieses Gerät bekommt sofort einen passenden Zettel, alle anderen
  // fallen binnen einer Minute raus (lib/zugang/stand-pruefung.ts).
  if (neu) {
    await notiere({ speicher: wer, art: 'passwort', ok: true, adresse: adresseGekuerzt(adresse(req)) });
    const frisch = (await ladeKonten()).konten.find(k => k.speicher === wer);
    if (frisch) return mitSitzung(frisch);
  }
  return NextResponse.json({ ok: true });
}
