// ─── Bausteine bestellen — die öffentliche Schnittstelle (31.10.) ───────────────────────────────────────────────────────────────────
// OHNE Sitzung erreichbar (middleware.ts `bausteinOffen`: nur GET/HEAD/POST /api/bestellung und GET/HEAD /api/baustein/laden). Handelt nie als Person.
// Das Formular steht auf der statischen Website (Caddy leitet /api/bestellung und /api/baustein/* an die App).
// GET  ?id=<baustein> → { ok, aktiv, titel, preis (netto, Cent), ust (Satz), brutto (Cent), stempel, bedingungen: { fassung, zeilen }, hinweis: { zeilen, link } }
//        — bei `aktiv: false` sind `stempel` und `bedingungen` null. Unbekannt → 404. Die Gesellschaft der Rechnung geht NIE nach außen (nur ihre Firmierung
//        aus dem Register im Hinweis). Schreibt nichts.
// POST { id, vorname, nachname, firma, strasse, plz, ort, land?, ustid?, email, telefon?, unternehmer: true, bedingungen: true, bedingungenFassung, stempel,
//        webseite (Honigtopf, leer) } → { ok: true, text } — immer dieselbe Antwort (bekannt, gesperrt, eingeschränkt …); die Bestellung ist dann FEST
//        gespeichert, Anfrage/Entwurf/Bestätigung laufen NACH der Antwort (lib/bausteine/server.ts). 400/404/409 (Fassung)/413/429/503.
// Kommt AUS: ohne Einschalten, Gesellschaft, Website-Absender oder Verantwortlichen → aktiv false bzw. POST 404.

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { ausfuellZeitOk } from '@/lib/kalender/buchung';
import { BAUSTEIN_ID_OK, BESTELL_TEXT, FASSUNG_ALT, GRENZEN, NICHT_ANGENOMMEN, NICHT_DA_TEXT, betraege, eingabePruefen } from '@/lib/bausteine/regeln';
import { BausteinFehler, KatalogKaputt, bausteineBereit, bausteineLage, bausteinVon, bestellStempel, bestellungAnnehmen, eingangVorbereiten, katalogLaden, stempelZeit } from '@/lib/bausteine/server';
import { nachDerAntwort } from '@/lib/oeffentlich/website-post';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const antwort = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...KOPF, ...extra } });
const UNBEKANNT = { ok: false, fehler: 'Diesen Baustein gibt es nicht.' };
const KAPUTT = { ok: false, fehler: 'Die Bausteine sind gerade nicht verfügbar — bitte später noch einmal.' };
/** Lesen je Netz und Viertelstunde frei (jede Baustein-Seite fragt einmal). */
const LESEN_FREI = 120;
/** Bestellungen je Netz und Viertelstunde frei, danach wächst die Wartezeit. */
const BESTELLEN_FREI = 6;

function gedrosselt(schluessel: string) {
  const p = pruefe(schluessel);
  return p.erlaubt ? null : antwort({ ok: false, fehler: `Zu viele Versuche auf einmal — bitte in ${Math.max(1, Math.ceil(p.warteSek / 60))} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
}

async function bausteinLaden(id: unknown) {
  if (typeof id !== 'string' || !BAUSTEIN_ID_OK.test(id)) return { b: null };
  try { return { b: await bausteinVon(id) }; } catch (x) { if (x instanceof KatalogKaputt) return { b: null, kaputt: true }; throw x; }
}

export async function GET(req: Request) {
  const netz = adresseNetz(req);
  const g = gedrosselt(`bestellung-lesen:${netz}`); if (g) return g;
  fehlschlag(`bestellung-lesen:${netz}`, Date.now(), LESEN_FREI);
  const { b, kaputt } = await bausteinLaden(new URL(req.url).searchParams.get('id'));
  if (kaputt) return antwort(KAPUTT, 503);
  if (!b) return antwort(UNBEKANNT, 404);
  const l = await bausteineLage();
  const bt = betraege(b.preis, l.ustSatz);
  const aktiv = l.e.aktiv && !l.gruende.length && !!l.lage;
  if (!aktiv) return antwort({ ok: true, aktiv: false, titel: b.titel, preis: bt.netto, ust: bt.satz, brutto: bt.brutto, stempel: null, bedingungen: null, hinweis: { zeilen: [], link: null }, text: NICHT_DA_TEXT });
  return antwort({ ok: true, aktiv: true, titel: b.titel, preis: bt.netto, ust: bt.satz, brutto: bt.brutto, stempel: bestellStempel(), bedingungen: l.bedingungen, hinweis: l.hinweis });
}

export async function POST(req: Request) {
  const netz = adresseNetz(req);
  const g = gedrosselt(`bestellung:${netz}`); if (g) return g;
  let body: Record<string, unknown>;
  try { body = await jsonBegrenzt(req, GRENZEN.koerper); } catch (x) { return jsonZuGross(x) ?? antwort({ ok: false, fehler: 'Kein JSON.' }, 400); }
  fehlschlag(`bestellung:${netz}`, Date.now(), BESTELLEN_FREI);
  const { b, kaputt } = await bausteinLaden(body.id);
  if (kaputt) return antwort(KAPUTT, 503);
  if (!b) return antwort(UNBEKANNT, 404);
  const l = await bausteineBereit();
  if (!l) return antwort({ ok: false, fehler: NICHT_DA_TEXT }, 404);
  if (typeof body.webseite === 'string' && body.webseite.trim()) return antwort({ ok: false, fehler: NICHT_ANGENOMMEN }, 400);
  const geladen = stempelZeit(body.stempel);
  if (geladen === null || !ausfuellZeitOk(geladen, Date.now())) return antwort({ ok: false, fehler: NICHT_ANGENOMMEN }, 400);
  if (body.unternehmer !== true) return antwort({ ok: false, fehler: 'Bitte bestätigen Sie, dass Sie als Unternehmer bestellen — wir liefern nur an Unternehmen.' }, 400);
  if (body.bedingungen !== true) return antwort({ ok: false, fehler: 'Bitte bestätigen Sie die Bestellbedingungen.' }, 400);
  if (body.bedingungenFassung !== l.bedingungen.fassung) return antwort({ ok: false, fehler: FASSUNG_ALT }, 409);
  const e = eingabePruefen(body);
  if (!e.ok) return antwort({ ok: false, fehler: e.fehler }, e.status);
  // Festhalten VOR der Antwort: ein Speicherfehler sagt es offen (503) — nie geht eine Bestellung still verloren.
  let id: string;
  try {
    const katalog = await katalogLaden();
    id = (await bestellungAnnehmen({ baustein: b, katalog, besteller: e.besteller, fassung: l.bedingungen.fassung, ustSatz: l.ustSatz })).id;
  } catch (x) {
    if (x instanceof BausteinFehler) return antwort({ ok: false, fehler: x.message }, x.status);
    console.error('[bausteine] Bestellung:', x instanceof Error ? x.message.slice(0, 120) : 'Fehler');
    return antwort({ ok: false, fehler: 'Ihre Bestellung ließ sich gerade nicht speichern. Bitte versuchen Sie es in ein paar Minuten noch einmal.' }, 503);
  }
  nachDerAntwort(() => eingangVorbereiten(id, l.lage), 'bausteine');
  return antwort({ ok: true, text: BESTELL_TEXT });
}
