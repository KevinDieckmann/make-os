// ─── MAKE OS — Zweiter Faktor einrichten (26.09.) ───────────────────────────
// POST { aktion: 'beginnen' }            → neues Geheimnis (Entwurf) + Link für die App
// POST { aktion: 'bestaetigen', code }   → Code aus der App stimmt → Faktor an, acht
//                                          Wiederherstellungscodes (genau einmal sichtbar),
//                                          alle anderen Geräte abgemeldet
// POST { aktion: 'aus', passwort, code } → Faktor aus — Passwort UND Code (bzw. Wiederherstellungscode) über `erneutPruefen` (18.10.,
//                                          Gesamtprüfung L3 B4: vorher nur das Passwort, ohne Bremse; mit „Gerät merken“ reichte so
//                                          das Passwort für die ganze Übernahme). Danach alle anderen Geräte abgemeldet.
// Gemerkte Geräte (16.10.) stehen IM Faktor (`zweiterFaktor.geraete`): neu einrichten und ausschalten nehmen sie mit — danach
// fragt jedes Gerät wieder nach dem Code.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten } from '@/lib/zugang/konten';
import { erneutPruefen } from '@/lib/zugang/erneut';
import { istDienst } from '@/lib/zugang/dienst';
import { neuesGeheimnis, codePruefen, otpauthLink, neueWiederherstellungscodes, wiederherstellungHash } from '@/lib/zugang/totp';
import { mitSitzung } from '@/lib/zugang/antwort';
import { pruefe, fehlschlag, erfolg, adresse } from '@/lib/zugang/drossel';
import { notiere, adresseGekuerzt } from '@/lib/zugang/anmeldungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let b: { aktion?: string; code?: string; passwort?: string };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const wer = personStreng(req);
  if (!wer) return ohnePerson();
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
      // Alle anderen Geräte raus — ab jetzt gilt der zweite Faktor überall. Neues Objekt = keine gemerkten Geräte mehr.
      sitzungenAb: jetzt, widerrufen: [],
    } : k) }));
    await notiere({ speicher: wer, art: 'zweiter-faktor-an', ok: true, adresse: adresseGekuerzt(adresse(req)) });
    const frisch = (await ladeKonten()).konten.find(k => k.speicher === wer);
    const res = frisch ? await mitSitzung(frisch, { codes }) : NextResponse.json({ ok: true, codes });
    return res;
  }

  if (b.aktion === 'aus') {
    // Nur die Person der Sitzung — nie der Dienstweg (auch nicht „im Auftrag“).
    if (istDienst(req)) return NextResponse.json({ error: 'Nur für die angemeldete Person selbst.' }, { status: 403 });
    const e = await erneutPruefen(req, ich, { passwort: b.passwort, code: b.code }, 'zweiter-faktor-aus');
    if (!e.ok) return NextResponse.json({ error: e.fehler, ...(e.zweiterFaktor ? { zweiterFaktor: true } : {}) }, { status: e.status, ...(e.warteSek ? { headers: { 'Retry-After': String(e.warteSek) } } : {}) });
    const jetzt = new Date().toISOString();
    // Alle anderen Geräte raus (wie beim Einschalten) — wer ohne Faktor weiter angemeldet sein will, meldet sich neu an; dieses Gerät bleibt drin.
    await aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === wer ? { ...k, zweiterFaktor: undefined, zweiterFaktorEntwurf: undefined, sitzungenAb: jetzt, widerrufen: [] } : k) }));
    await notiere({ speicher: wer, art: 'zweiter-faktor-aus', ok: true, adresse: adresseGekuerzt(adresse(req)) });
    const frisch = (await ladeKonten()).konten.find(k => k.speicher === wer);
    return frisch ? mitSitzung(frisch) : NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'aktion = beginnen | bestaetigen | aus' }, { status: 400 });
}
