// ─── Öffentliche Buchungsseite — freie Plätze und Buchen (29.09., Paket K4) ──
// OHNE Sitzung erreichbar (middleware.ts: nur /buchen/<slug>(/status) und /api/buchung/<slug>(/status)).
// GET  → { ok, seite (Titel, Dauer, Fragen, Hinweise — nie Person, Kalender, Ort), plaetze: [{ start, ende }], stempel,
//          hinweis? } — `hinweis` statt Plätzen, wenn gerade nichts buchbar ist (R-K2 #73: Stand älter als 30 Min.,
//          letzter Abgleich mit Fehler, iCloud nicht verbunden; #79: Seite ohne Verantwortlichen).
// POST { start, name, email, firma?, anliegen?, einwilligung: true, stempel, webseite (Honigtopf, leer) }
//      → 201 { ok, status: 'vorlaeufig', reserviertBis, token, statusPfad } — der Platz ist 30 Min. reserviert, bis
//        der Buchende auf der Status-Seite bestätigt. Vorher ein ERZWUNGENER iCloud-Abgleich (#73; höchstens einer je
//        ZWANG_ABSTAND_MS für die ganze Seite, dazwischen der gewöhnliche mit ctag) — scheitert er: 503, nichts reserviert.
// Schutz: Drosselung je Adresse (lib/zugang/drossel.ts; jeder Buchungsversuch und jeder Fehlgriff zählt), Honigtopf,
// signierter Formular-Stempel (zu schnell → Maschine), Längen- und Größengrenzen (400/413), eine offene Anfrage je
// E-Mail und Seite, Platz-Prüfung in EINER Sperre (keine Doppelbuchung), unbekannte Adresse → 404.
// F1 (Prüfer 1 #13): Drosselung je Netz (IPv6 auf /64 gekürzt, `adresseNetz`); auch erfolgreiche GETs zählen (eigenes,
// großzügigeres Budget `LESEN_FREI`); höchstens GRENZEN.neueJeStunde neue Buchungen je Seite und Stunde (429); der
// erzwungene Abgleich vor dem Reservieren holt nur den Zielkalender neu (`nur`) — die übrigen über ihren ctag.
// Gesperrt sind Feiertage NRW und die „freien Tage“ aus den Kalender-Einstellungen (#72, z. B. 24.12./31.12.).
// S1 (29.09.): Honigtopf und Zeit-Fehler antworten mit DEMSELBEN Text (`NICHT_ANGENOMMEN`); höchstens
// GRENZEN.vorlaeufigJeSeite vorläufige Reservierungen je Seite gleichzeitig (429, in `reservieren`); der Hinweis nennt
// die wirksamen Löschfristen, die Fassung trägt sie mit (`hinweisFristenLaden`, `hinweisFassung`).

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { tagPlus } from '@/lib/kalender/zeit';
import { abgleichen, abgleichAlter, ladeStand, verbunden } from '@/lib/kalender/icloud';
import { googleKalenderNamen, kalenderQuelleDa } from '@/lib/kalender/google/namen';
import { ladeGoogleStand } from '@/lib/kalender/google/stand';
import { googleAbgleichen, googleAlter } from '@/lib/kalender/google/abgleich';
import { verfuegbarkeitFuer } from '@/lib/kalender/verfuegbarkeit';
import { belegungenAus, sperrTageAus } from '@/lib/kalender/freie-zeit';
import { ladeEinstellungen } from '@/lib/kalender/einstellungen';
import { plaetzeFuerSeite, oeffentlich, eingabePruefen, ausfuellZeitOk, reservieren, slugOk, standBuchbar, hinweisFassung, verantwortlichFuerSeite, NICHT_BUCHBAR, NICHT_ANGENOMMEN, type BuchungsSeite, type DatenschutzOeffentlich, type Reservierung } from '@/lib/kalender/buchung';
import { datenschutzOeffentlichLaden } from '@/lib/datenschutz/einrichtung-server';
import { ladeBuchungBestand, aendereBuchungBestand, buchungProtokoll, formularStempel, stempelZeit, neuesToken, tokenHash, hinweisFristenLaden } from '@/lib/kalender/buchung-speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Größter Körper einer Buchung (Byte) — darüber 413. */
const MAX_BYTES = 8 * 1024;
/** Mindestabstand zweier erzwungener Abgleiche aus dieser Route (Schutz des einen vCPU und vor Apples Drosselung). */
const ZWANG_ABSTAND_MS = 10_000;
const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const antwort = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...KOPF, ...extra } });
const NICHT_GEFUNDEN = { ok: false, fehler: 'Diese Buchungsseite gibt es nicht.' };
/** So viele Aufrufe (GET) je Netz und Viertelstunde frei, danach wächst die Wartezeit (F1 #13). */
const LESEN_FREI = 40;

async function seiteZu(slug: string): Promise<BuchungsSeite | null> {
  if (!slugOk(slug)) return null;
  const b = await ladeBuchungBestand();
  return b.seiten.find(s => s.slug === slug && s.aktiv) ?? null;
}

function gedrosselt(schluessel: string) {
  const p = pruefe(schluessel);
  return p.erlaubt ? null : antwort({ ok: false, fehler: `Zu viele Versuche — bitte in ${Math.ceil(p.warteSek / 60)} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
}

let letzterZwang = 0;
/**
 * Vor dem Reservieren frisch mit iCloud abgleichen (#73). false = iCloud nicht erreichbar. F1 #13: neu geholt wird nur
 * der Zielkalender (`nur`); alle übrigen kommen über ihren ctag (geändert → neu geholt). Kennt der Stand den Kalender
 * nicht (noch nie abgeglichen), einmal alles.
 */
async function frischAbgleichen(seite: BuchungsSeite): Promise<boolean> {
  const jetzt = Date.now();
  const zwingen = jetzt - letzterZwang >= ZWANG_ABSTAND_MS;
  if (zwingen) letzterZwang = jetzt;
  try {
    // Wie icloud.ts `kalenderNachName` (Name ohne Groß/Klein, getrimmt).
    const kal = zwingen ? (await ladeStand()).kalender?.find(k => k.name.trim().toLowerCase() === seite.zielKalender.trim().toLowerCase()) : undefined;
    // Google (03.10.): die Google-Kalender gehören zum Stand — auch sie vor dem Reservieren frisch lesen (Fehler → nicht buchbar).
    if (zwingen) for (const p of Object.keys(await googleKalenderNamen())) await googleAbgleichen(p);
    if (verbunden()) await abgleichen(!zwingen ? {} : kal && kal.quelle !== 'google' ? { nur: kal.id } : { erzwingen: true });
    return true;
  } catch { return false; }
}

/** Ist gerade etwas buchbar? (Verantwortlicher — an der Seite oder in der Einrichtung —, iCloud verbunden, Stand frisch und ohne Fehler) */
async function buchbar(seite: BuchungsSeite, jetzt: Date, ds: DatenschutzOeffentlich): Promise<boolean> {
  if (verantwortlichFuerSeite(seite, ds).length < 5) return false;
  // Jede verbundene Quelle muss frisch und fehlerfrei sein: iCloud (wenn verbunden) und jeder Google-Kalender (03.10.).
  const quellen: { a: ReturnType<typeof abgleichAlter> | null }[] = [];
  if (verbunden()) quellen.push({ a: abgleichAlter(await ladeStand(), jetzt.getTime()) });
  for (const p of Object.keys(await googleKalenderNamen())) quellen.push({ a: googleAlter(await ladeGoogleStand(p), jetzt.getTime()) });
  if (!quellen.length) return false;
  return quellen.every(q => standBuchbar(q.a, true).ok);
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const netz = adresseNetz(req);
  const schluessel = `buchung:${netz}`, lesen = `buchung-lesen:${netz}`;
  const zu = gedrosselt(schluessel) ?? gedrosselt(lesen); if (zu) return zu;
  // Auch erfolgreiche Aufrufe zählen (F1 #13) — jeder GET rechnet Plätze aus dem Kalender.
  fehlschlag(lesen, Date.now(), LESEN_FREI);
  const seite = await seiteZu(slug);
  if (!seite) { fehlschlag(schluessel); return antwort(NICHT_GEFUNDEN, 404); }
  const jetzt = new Date();
  const heute = localDay(jetzt);
  const bis = tagPlus(heute, seite.tageVoraus + 1);
  // Verfügbarkeit der Person (K1: beschäftigt, Abwesend, Feiertage) — die Fenster der Seite bestimmen die buchbaren Zeiten.
  // `verfuegbarkeitFuer` erneuert einen Stand, der älter als 2 Min. ist; danach entscheidet `standBuchbar`.
  const [v, bestand, einst, fristen, ds] = await Promise.all([verfuegbarkeitFuer(seite.person, heute, bis), ladeBuchungBestand(jetzt), ladeEinstellungen(), hinweisFristenLaden(), datenschutzOeffentlichLaden()]);
  const stempel = formularStempel(slug, jetzt.getTime());
  if (!(await buchbar(seite, jetzt, ds))) return antwort({ ok: true, seite: oeffentlich(seite, fristen, ds), plaetze: [], stempel, hinweis: NICHT_BUCHBAR });
  const plaetze = plaetzeFuerSeite(seite, belegungenAus(v), bestand, jetzt, sperrTageAus(v, einst.freieTage, heute, bis), heute).map(p => ({ start: p.start, ende: p.ende }));
  return antwort({ ok: true, seite: oeffentlich(seite, fristen, ds), plaetze, stempel });
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const schluessel = `buchung:${adresseNetz(req)}`;
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
  if (!ausfuellZeitOk(geladen, jetzt.getTime())) return antwort({ ok: false, fehler: NICHT_ANGENOMMEN }, 400);
  const e = eingabePruefen(roh, seite);
  if (!e.ok) return antwort({ ok: false, fehler: e.fehler }, e.status);

  // #73: nie auf einem alten Stand reservieren — erst frisch abgleichen; scheitert das oder ist der Stand nicht frisch → 503.
  if (!(await kalenderQuelleDa()) || !(await frischAbgleichen(seite)) || !(await buchbar(seite, jetzt, await datenschutzOeffentlichLaden()))) return antwort({ ok: false, fehler: NICHT_BUCHBAR }, 503, { 'Retry-After': '600' });

  const heute = localDay(jetzt);
  const bis = tagPlus(heute, seite.tageVoraus + 1);
  // K1 liest den eben abgeglichenen Stand (ein am iPhone eingetragener Termin blockiert); Buchungen prüft `reservieren` in der Sperre.
  const [v, einst, fristen] = await Promise.all([verfuegbarkeitFuer(seite.person, heute, bis), ladeEinstellungen(), hinweisFristenLaden()]);
  const feiertage = sperrTageAus(v, einst.freieTage, heute, bis);
  const token = neuesToken();
  const id = neueKennung('bu');
  let r: Reservierung | { ok: false; status: number; fehler: string } = { ok: false, status: 409, fehler: 'Nicht reserviert.' };
  await aendereBuchungBestand(bs => {
    const x = reservieren(bs, seite.id, e.e, belegungenAus(v), feiertage, { id, tokenHash: tokenHash(token), jetzt, heute, fassung: hinweisFassung(fristen) });
    r = x;
    return x.ok ? x.bestand : bs;
  }, jetzt);
  const erg = r as Reservierung | { ok: false; status: number; fehler: string };
  if (!erg.ok) return antwort({ ok: false, fehler: erg.fehler }, erg.status);
  await buchungProtokoll([{ liste: 'buchungen', op: 'neu', id, felder: ['oeffentlich', 'status'] }], { art: 'system' });
  return antwort({ ok: true, status: 'vorlaeufig', reserviertBis: erg.buchung.reserviertBis, token, statusPfad: `/buchen/${slug}/status` }, 201);
}
