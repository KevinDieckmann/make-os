// ─── Öffentliche Buchungsseite — Status des Buchenden (29.09., Paket K4) ─────
// OHNE Sitzung erreichbar (middleware.ts). Das Token kommt im Körper (nie in der Adresse — die Status-Seite trägt es
// nur im Fragment #…, das der Browser nicht an den Server schickt).
// POST { token, aktion: 'ansehen' | 'bestaetigen' | 'absagen' | 'mail-bestaetigen' }
//   ansehen      → { ok, sicht } (Status, Titel, Zeit; Ort erst nach Freigabe; nie Namen anderer)
//   bestaetigen  vorläufig → angefragt → Glocke an die Person der Seite (lib/kalender/buchung-ablauf.ts; im CRM
//                entsteht erst bei der Freigabe etwas — R-K2 #79)
//   absagen      offen/bestätigt → abgesagt; bei einem festen Termin meldet die Glocke „Termin entfernen?“ (entfernt
//                wird nur von Hand — Human-in-the-Loop).
//   mail-bestaetigen (R-K2 #76) Token = das MAIL-Token aus dem Bestätigungslink (#mail=…): die E-Mail-Adresse gilt als
//                bestätigt, der Link ist verbraucht (einmalig, Ablauf MAIL_LINK_TAGE). Steht der Kontakt schon im CRM,
//                bekommt er den Nachweis „bestätigt“ nachgetragen.
// Falsches Token → 404 und zählt als Fehlgriff (Drosselung je Adresse).

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { melde } from '@/lib/meldungen/melden';
import { tagKurz, berlinerTag } from '@/lib/zeit/kalender-kern';
import { datenschutzOeffentlichLaden } from '@/lib/datenschutz/einrichtung-server';
import { slugOk, statusSicht, mailLinkGueltig, OFFEN, type Buchung, type BuchungsSeite } from '@/lib/kalender/buchung';
import { ladeBuchungBestand, aendereBuchungBestand, buchungProtokoll, tokenPasst, mailTokenPasst, TOKEN_OK } from '@/lib/kalender/buchung-speicher';
import { buchungAnfragen, mailBestaetigtNachtragen } from '@/lib/kalender/buchung-ablauf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const antwort = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...KOPF, ...extra } });
const NICHT_GEFUNDEN = { ok: false, fehler: 'Diese Buchung gibt es nicht (mehr).' };
const LINK_UNGUELTIG = { ok: false, fehler: 'Dieser Bestätigungslink ist ungültig, abgelaufen oder schon benutzt.' };

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  // Je Netz (IPv6 /64, F1 #13) — wie die Buchungsseite.
  const schluessel = `buchung-status:${adresseNetz(req)}`;
  const p = pruefe(schluessel);
  if (!p.erlaubt) return antwort({ ok: false, fehler: `Zu viele Versuche — bitte in ${Math.ceil(p.warteSek / 60)} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
  const laenge = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(laenge) && laenge > 1024) return antwort({ ok: false, fehler: 'Anfrage zu groß.' }, 413);
  const text = await req.text().catch(() => '');
  if (text.length > 1024) return antwort({ ok: false, fehler: 'Anfrage zu groß.' }, 413);
  let roh: { token?: unknown; aktion?: unknown };
  try { roh = JSON.parse(text); } catch { return antwort({ ok: false, fehler: 'Ungültige Anfrage.' }, 400); }
  const token = typeof roh?.token === 'string' ? roh.token : '';
  const aktion = roh?.aktion;
  if (!slugOk(slug) || !TOKEN_OK.test(token)) { fehlschlag(schluessel); return antwort(NICHT_GEFUNDEN, 404); }
  if (aktion !== 'ansehen' && aktion !== 'bestaetigen' && aktion !== 'absagen' && aktion !== 'mail-bestaetigen') return antwort({ ok: false, fehler: 'Unbekannte Aktion.' }, 400);

  const bestand = await ladeBuchungBestand();
  const seite = bestand.seiten.find(s => s.slug === slug);
  const jetzt = new Date();
  const jetztIso = jetzt.toISOString();

  // ── E-Mail-Adresse bestätigen (#76): eigenes Token, einmalig, mit Ablauf ──
  if (aktion === 'mail-bestaetigen') {
    const treffer = seite ? bestand.buchungen.find(b => b.seiteId === seite.id && mailTokenPasst(token, b.mailLink?.hash)) : undefined;
    if (!seite || !treffer || !mailLinkGueltig(treffer.mailLink, jetztIso)) { fehlschlag(schluessel); return antwort(LINK_UNGUELTIG, 404); }
    let danach: Buchung | null = null;
    await aendereBuchungBestand(bs => {
      const b = bs.buchungen.find(x => x.id === treffer.id);
      // In der Sperre noch einmal: derselbe Link, noch gültig (zwei Klicks gleichzeitig → nur einer zählt).
      if (!b || !mailTokenPasst(token, b.mailLink?.hash) || !mailLinkGueltig(b.mailLink, jetztIso)) return bs;
      const { mailLink: _weg, ...rest } = b;
      danach = { ...rest, emailBestaetigtAm: b.emailBestaetigtAm ?? jetztIso };
      const neu = danach;
      return { ...bs, buchungen: bs.buchungen.map(x => (x.id === b.id ? neu : x)) };
    }, jetzt);
    if (!danach) { fehlschlag(schluessel); return antwort(LINK_UNGUELTIG, 404); }
    const fertig = danach as Buchung;
    await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id: fertig.id, felder: ['oeffentlich', 'emailBestaetigtAm'] }], { art: 'system' });
    // Nachweis im CRM nachtragen (nur, wenn der Kontakt schon besteht) — ein Fehler bricht die Antwort nicht ab.
    await mailBestaetigtNachtragen(fertig.id, jetzt).catch(e => console.error('[buchung] Nachweis offen:', e instanceof Error ? e.message : e));
    return antwort({ ok: true, mail: true, sicht: statusSicht(fertig, seite, await datenschutzOeffentlichLaden()) });
  }

  const buchung = seite ? bestand.buchungen.find(b => b.seiteId === seite.id && tokenPasst(token, b.tokenHash)) : undefined;
  if (!seite || !buchung) { fehlschlag(schluessel); return antwort(NICHT_GEFUNDEN, 404); }

  if (aktion === 'ansehen') return antwort({ ok: true, sicht: statusSicht(buchung, seite, await datenschutzOeffentlichLaden()) });

  let fehler = '', status = 409, danach: Buchung | null = null, vorher: Buchung['status'] = buchung.status;
  await aendereBuchungBestand(bs => {
    const b = bs.buchungen.find(x => x.id === buchung.id);
    if (!b) { fehler = NICHT_GEFUNDEN.fehler; status = 404; return bs; }
    vorher = b.status;
    if (aktion === 'bestaetigen') {
      if (b.status === 'angefragt' || b.status === 'bestaetigt') { danach = b; return bs; } // schon bestätigt — nichts zu tun
      if (b.status !== 'vorlaeufig') { fehler = b.status === 'abgelaufen' ? 'Die Reservierung ist abgelaufen — bitte neu buchen.' : 'Diese Buchung ist nicht mehr offen.'; return bs; }
      danach = { ...b, status: 'angefragt', angefragtAm: jetztIso, statusAm: jetztIso };
    } else {
      if (b.status === 'abgesagt') { danach = b; return bs; }
      if (!OFFEN.includes(b.status) && b.status !== 'bestaetigt') { fehler = 'Diese Buchung ist nicht mehr offen.'; return bs; }
      // Ein offener Bestätigungslink verfällt mit der Absage.
      const { mailLink: _weg, ...rest } = b;
      danach = { ...rest, status: 'abgesagt', statusAm: jetztIso };
    }
    const neu = danach;
    return { ...bs, buchungen: bs.buchungen.map(x => (x.id === b.id ? neu : x)) };
  }, jetzt);
  if (!danach) return antwort({ ok: false, fehler: fehler || 'Nicht möglich.' }, status);
  const fertig = danach as Buchung;
  if (fertig.status !== vorher) {
    await buchungProtokoll([{ liste: 'buchungen', op: 'geaendert', id: fertig.id, felder: ['oeffentlich', 'status'] }], { art: 'system' });
    if (fertig.status === 'angefragt') {
      // Glocke — ein Fehler bricht die Antwort nicht ab (die Absicht wird fortgesetzt).
      await buchungAnfragen(fertig.id, (seite as BuchungsSeite).person, jetzt).catch(e => console.error('[buchung] Anfrage offen:', e instanceof Error ? e.message : e));
    } else if (fertig.status === 'abgesagt' && (vorher === 'angefragt' || vorher === 'bestaetigt')) {
      // Restpunkte 29.09.: „Termin entfernen?“ trägt den Bezug `buchung-termin` — erledigt sich, sobald der Termin gelöst ist.
      await melde(vorher === 'bestaetigt'
        ? { an: seite.person, art: 'buchung', titel: `Termin „${seite.titel}“ am ${tagKurz(fertig.start.slice(0, 10), berlinerTag(jetzt))} vom Gast abgesagt — Termin im Kalender entfernen?`, link: '/os/kalender?buchungen=1', bezug: { art: 'buchung-termin', id: fertig.id } }
        : { an: seite.person, art: 'buchung', titel: `Terminanfrage „${seite.titel}“ vom Gast zurückgezogen`, link: '/os/kalender?buchungen=1' });
    }
  }
  return antwort({ ok: true, sicht: statusSicht(fertig, seite, await datenschutzOeffentlichLaden()) });
}
