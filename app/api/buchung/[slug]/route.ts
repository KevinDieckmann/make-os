// ─── Öffentliche Buchungsseite — freie Plätze und Buchen (29.09., Paket K4) ──
// OHNE Sitzung erreichbar (middleware.ts: nur /buchen/<slug>(/status) und /api/buchung/<slug>(/status)).
// GET  → { ok, seite (Titel, Dauer, Fragen, Hinweise — nie Person, Kalender, Ort), plaetze: [{ start, ende }], stempel }
// POST { start, name, email, firma?, anliegen?, einwilligung: true, stempel, webseite (Honigtopf, leer) }
//      → 201 { ok, status: 'vorlaeufig', reserviertBis, token, statusPfad } — der Platz ist 30 Min. reserviert, bis
//        der Buchende auf der Status-Seite bestätigt (Double-Opt-in-Ersatz, MAKE OS verschickt keine Mail).
// Schutz: Drosselung je Adresse (lib/zugang/drossel.ts; jeder Buchungsversuch und jeder Fehlgriff zählt), Honigtopf,
// signierter Formular-Stempel (zu schnell → Maschine), Längen- und Größengrenzen (400/413), eine offene Anfrage je
// E-Mail und Seite, Platz-Prüfung in EINER Sperre (keine Doppelbuchung), unbekannte Adresse → 404.

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresse } from '@/lib/zugang/drossel';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { tagPlus } from '@/lib/kalender/zeit';
import { verfuegbarkeitFuer } from '@/lib/kalender/verfuegbarkeit';
import { belegungenAus, feiertageAus } from '@/lib/kalender/freie-zeit';
import { plaetzeFuerSeite, oeffentlich, eingabePruefen, ausfuellZeitOk, reservieren, slugOk, type BuchungsSeite, type Reservierung } from '@/lib/kalender/buchung';
import { ladeBuchungBestand, aendereBuchungBestand, buchungProtokoll, formularStempel, stempelZeit, neuesToken, tokenHash } from '@/lib/kalender/buchung-speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Größter Körper einer Buchung (Byte) — darüber 413. */
const MAX_BYTES = 8 * 1024;
const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const antwort = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...KOPF, ...extra } });
const NICHT_GEFUNDEN = { ok: false, fehler: 'Diese Buchungsseite gibt es nicht.' };

async function seiteZu(slug: string): Promise<BuchungsSeite | null> {
  if (!slugOk(slug)) return null;
  const b = await ladeBuchungBestand();
  return b.seiten.find(s => s.slug === slug && s.aktiv) ?? null;
}

function gedrosselt(schluessel: string) {
  const p = pruefe(schluessel);
  return p.erlaubt ? null : antwort({ ok: false, fehler: `Zu viele Versuche — bitte in ${Math.ceil(p.warteSek / 60)} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const schluessel = `buchung:${adresse(req)}`;
  const zu = gedrosselt(schluessel); if (zu) return zu;
  const seite = await seiteZu(slug);
  if (!seite) { fehlschlag(schluessel); return antwort(NICHT_GEFUNDEN, 404); }
  const jetzt = new Date();
  const heute = localDay(jetzt);
  // Verfügbarkeit der Person (K1: beschäftigt, Abwesend, Feiertage) — die Fenster der Seite bestimmen die buchbaren Zeiten.
  const [v, bestand] = await Promise.all([verfuegbarkeitFuer(seite.person, heute, tagPlus(heute, seite.tageVoraus + 1)), ladeBuchungBestand(jetzt)]);
  const plaetze = plaetzeFuerSeite(seite, belegungenAus(v), bestand, jetzt, feiertageAus(v), heute).map(p => ({ start: p.start, ende: p.ende }));
  return antwort({ ok: true, seite: oeffentlich(seite), plaetze, stempel: formularStempel(slug, jetzt.getTime()) });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const schluessel = `buchung:${adresse(req)}`;
  const zu = gedrosselt(schluessel); if (zu) return zu;
  // Jeder Buchungsversuch zählt (auch ein erfolgreicher): höchstens wenige je Viertelstunde und Adresse.
  fehlschlag(schluessel);
  const laenge = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(laenge) && laenge > MAX_BYTES) return antwort({ ok: false, fehler: 'Anfrage zu groß.' }, 413);
  const text = await req.text().catch(() => '');
  if (text.length > MAX_BYTES) return antwort({ ok: false, fehler: 'Anfrage zu groß.' }, 413);
  const seite = await seiteZu(slug);
  if (!seite) return antwort(NICHT_GEFUNDEN, 404);
  let roh: Record<string, unknown>;
  try { const j = JSON.parse(text); if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error(); roh = j; } catch { return antwort({ ok: false, fehler: 'Ungültige Anfrage.' }, 400); }

  const jetzt = new Date();
  const geladen = stempelZeit(slug, roh.stempel);
  if (geladen === null) return antwort({ ok: false, fehler: 'Bitte die Seite neu laden.' }, 400);
  if (!ausfuellZeitOk(geladen, jetzt.getTime())) return antwort({ ok: false, fehler: 'Buchung nicht angenommen — bitte die Seite neu laden und in Ruhe ausfüllen.' }, 400);
  const e = eingabePruefen(roh, seite);
  if (!e.ok) return antwort({ ok: false, fehler: e.fehler }, e.status);

  const heute = localDay(jetzt);
  // K1 liest den frischen Stand (ein eben am iPhone eingetragener Termin blockiert); Buchungen prüft `reservieren` in der Sperre.
  const v = await verfuegbarkeitFuer(seite.person, heute, tagPlus(heute, seite.tageVoraus + 1));
  const feiertage = feiertageAus(v);
  const token = neuesToken();
  const id = neueKennung('bu');
  let r: Reservierung | { ok: false; status: number; fehler: string } = { ok: false, status: 409, fehler: 'Nicht reserviert.' };
  await aendereBuchungBestand(bs => {
    const x = reservieren(bs, seite.id, e.e, belegungenAus(v), feiertage, { id, tokenHash: tokenHash(token), jetzt, heute });
    r = x;
    return x.ok ? x.bestand : bs;
  }, jetzt);
  const erg = r as Reservierung | { ok: false; status: number; fehler: string };
  if (!erg.ok) return antwort({ ok: false, fehler: erg.fehler }, erg.status);
  await buchungProtokoll([{ liste: 'buchungen', op: 'neu', id, felder: ['oeffentlich', 'status'] }], { art: 'system' });
  return antwort({ ok: true, status: 'vorlaeufig', reserviertBis: erg.buchung.reserviertBis, token, statusPfad: `/buchen/${slug}/status` }, 201);
}
