// ─── MAKE OS — Zweiter Faktor einrichten (26.09.) ───────────────────────────
// POST { aktion: 'beginnen' }            → neues Geheimnis (Entwurf) + Link für die App
// POST { aktion: 'bestaetigen', code }   → Code aus der App stimmt → Faktor an, acht
//                                          Wiederherstellungscodes (genau einmal sichtbar),
//                                          alle anderen Geräte abgemeldet
// POST { aktion: 'aus', passwort }       → Faktor aus (Passwort nötig)
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten, passwortStimmt } from '@/lib/zugang/konten';
import { personAus } from '@/lib/jarvis/raum';
import { neuesGeheimnis, codePruefen, otpauthLink, neueWiederherstellungscodes, wiederherstellungHash } from '@/lib/zugang/totp';
import { mitSitzung } from '@/lib/zugang/antwort';
import { pruefe, fehlschlag, erfolg, adresse } from '@/lib/zugang/drossel';
import { notiere, adresseGekuerzt } from '@/lib/zugang/anmeldungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: { aktion?: string; code?: string; passwort?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const wer = personAus(req);
  const ich = (await ladeKonten()).konten.find(k => k.speicher === wer);
  if (!ich) return NextResponse.json({ error: 'Konto nicht gefunden.' }, { status: 401 });

  if (b.aktion === 'beginnen') {
    const geheimnis = neuesGeheimnis();
    await aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === wer ? { ...k, zweiterFaktorEntwurf: { geheimnis, seit: new Date().toISOString() } } : k) }));
    return NextResponse.json({ ok: true, geheimnis, link: otpauthLink(ich.email, geheimnis) });
  }

  if (b.aktion === 'bestaetigen') {
    const e = ich.zweiterFaktorEntwurf;
    if (!e) return NextResponse.json({ error: 'Erst „Einrichten“ drücken.' }, { status: 400 });
    const bremse = `2fa-einrichten:${wer}`;
    const warte = pruefe(bremse).warteSek;
    if (warte > 0) return NextResponse.json({ error: `Zu viele Versuche — bitte in ${warte} Sekunden erneut.` }, { status: 429 });
    const p = codePruefen(e.geheimnis, b.code);
    if (!p.ok) { fehlschlag(bremse); return NextResponse.json({ error: 'Der Code stimmt nicht — in der App den aktuellen Sechssteller ablesen.' }, { status: 400 }); }
    erfolg(bremse);
    const codes = neueWiederherstellungscodes();
    const jetzt = new Date().toISOString();
    await aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === wer ? {
      ...k, zweiterFaktorEntwurf: undefined,
      zweiterFaktor: { geheimnis: e.geheimnis, seit: jetzt, letzteStufe: p.stufe, wiederherstellung: codes.map(c => ({ hash: wiederherstellungHash(c, k.salz) })) },
      // Alle anderen Geräte raus — ab jetzt gilt der zweite Faktor überall.
      sitzungenAb: jetzt, widerrufen: [],
    } : k) }));
    await notiere({ speicher: wer, art: 'zweiter-faktor-an', ok: true, adresse: adresseGekuerzt(adresse(req)) });
    const frisch = (await ladeKonten()).konten.find(k => k.speicher === wer);
    const res = frisch ? await mitSitzung(frisch, { codes }) : NextResponse.json({ ok: true, codes });
    return res;
  }

  if (b.aktion === 'aus') {
    if (!(await passwortStimmt(String(b.passwort ?? ''), ich))) return NextResponse.json({ error: 'Das Passwort stimmt nicht.' }, { status: 403 });
    await aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === wer ? { ...k, zweiterFaktor: undefined, zweiterFaktorEntwurf: undefined } : k) }));
    await notiere({ speicher: wer, art: 'zweiter-faktor-aus', ok: true, adresse: adresseGekuerzt(adresse(req)) });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'aktion = beginnen | bestaetigen | aus' }, { status: 400 });
}
