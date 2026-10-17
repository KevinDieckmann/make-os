// ─── MAKE OS — Abmelden (26.09.: widerruft den Zettel) ──────────────────────
// POST {}            → dieser Zettel wird widerrufen, Cookie gelöscht.
// POST { alle: true } → alle anderen Geräte raus: Zettel, die vor jetzt ausgestellt
//                       wurden, gelten nicht mehr; dieses Gerät bekommt einen neuen. Seit 18.10.
//                       (Gesamtprüfung L3 B3) vergisst das auch ALLE gemerkten Geräte — sonst
//                       meldete sich ein verlorener Laptop mit dem Passwort weiter ohne Code an.
import { jsonBegrenzt } from '@/lib/zugang/json-grenze';
import { ohneSitzung, mitSitzung } from '@/lib/zugang/antwort';
import { SITZUNG_COOKIE, sitzungPruefen, sitzungsGeheimnis } from '@/lib/zugang/sitzung';
import { ladeKonten, aendereKonten } from '@/lib/zugang/konten';
import { notiere, adresseGekuerzt } from '@/lib/zugang/anmeldungen';
import { adresse } from '@/lib/zugang/drossel';
import { geraeteVergessen } from '@/lib/zugang/geraete-server';
import { cookieAusAnfrage, geraetCookieSetzen } from '@/lib/zugang/geraete';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cookieWert(req: Request): string | undefined {
  const m = (req.headers.get('cookie') ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(`${SITZUNG_COOKIE}=`));
  return m ? decodeURIComponent(m.slice(SITZUNG_COOKIE.length + 1)) : undefined;
}

export async function POST(req: Request) {
  let body: { alle?: boolean } = {};
  try { body = await jsonBegrenzt(req); } catch { /* ohne Body: nur dieses Gerät */ }
  const s = await sitzungPruefen(sitzungsGeheimnis(), cookieWert(req));
  if (!s) return ohneSitzung();
  const jetzt = Date.now();
  if (body.alle === true) {
    await aendereKonten(st => ({ ...st, konten: st.konten.map(k => k.speicher === s.speicher ? { ...k, sitzungenAb: new Date(jetzt).toISOString(), widerrufen: [] } : k) }));
    await notiere({ speicher: s.speicher, art: 'alle-abgemeldet', ok: true, adresse: adresseGekuerzt(adresse(req)) });
    // Gemerkte Geräte (auch dieses) fragen beim nächsten Anmelden wieder nach dem Code — Protokoll wie „alle vergessen“ (nur die Art).
    const weg = await geraeteVergessen(s.speicher, 'alle');
    if (weg.length) await notiere({ speicher: s.speicher, art: 'geraete-vergessen', ok: true, adresse: adresseGekuerzt(adresse(req)) });
    const frisch = (await ladeKonten()).konten.find(k => k.speicher === s.speicher);
    const res = frisch ? await mitSitzung(frisch, { geraeteVergessen: weg.length }) : ohneSitzung();
    // Einträge dieses Kontos verschwinden auch aus dem Geräte-Cookie dieses Browsers (andere Konten im selben Browser bleiben).
    const imBrowser = cookieAusAnfrage(req);
    if (imBrowser.some(e => weg.includes(e.id))) geraetCookieSetzen(res, imBrowser.filter(e => !weg.includes(e.id)));
    return res;
  }
  await aendereKonten(st => ({ ...st, konten: st.konten.map(k => k.speicher === s.speicher
    ? { ...k, widerrufen: [...(k.widerrufen ?? []).filter(w => w.bis > jetzt), { sid: s.sid, bis: s.ablauf }].slice(-50) } : k) }));
  await notiere({ speicher: s.speicher, art: 'abmelden', ok: true, adresse: adresseGekuerzt(adresse(req)) });
  return ohneSitzung();
}
