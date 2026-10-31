// ─── Kontaktformular der Website — die öffentliche Schnittstelle (31.10., Website-Anbau) ──────────────────────────────────────────────
// OHNE Sitzung erreichbar (middleware.ts `KONTAKTFORMULAR_OFFEN`: nur /anfrage und POST /api/anfrage). Handelt nie als Person.
// GET  → { ok: true, aktiv } — NUR an/aus (für den Knopf auf der Website), keine Daten, kein Name, gedrosselt; schreibt nichts.
// POST { vorname, nachname?, firma?, email, telefon?, nachricht, stempel, webseite (Honigtopf, leer) }
//        → { ok: true, text } — dieselbe Antwort, ob die Adresse neu ist, eine vorhandene Person trifft (dann „Adresse unbestätigt“) oder der
//          Anfrage-Weg ablehnt (Art. 18): der Gast erfährt nie, was die Kartei kennt. Der Eingang landet in Markttraktion › Marketing › Anfragen.
// Kommt AUS: ohne Einschalten oder ohne Verantwortlichen → 404. Keine Mail, keine Werbe-Einwilligung, kein Modellaufruf.
// Schutz: Drossel je Netz, Honigtopf + signierter Formular-Stempel (≥ 3 s, ≤ 2 h) mit DEMSELBEN Text, Körper ≤ 8 KB (413), Felder nie gekürzt (413).

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { ausfuellZeitOk } from '@/lib/kalender/buchung';
import { DANKE_TEXT, GRENZEN, NICHT_ANGENOMMEN, eingabePruefen } from '@/lib/kontaktformular/regeln';
import { eingangVerarbeiten, kontaktformularBereit, stempelZeit } from '@/lib/kontaktformular/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KOPF = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const antwort = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { ...KOPF, ...extra } });
const NICHT_DA = { ok: false, fehler: 'Das Kontaktformular gibt es hier gerade nicht.' };
/** Nachrichten je Netz und Viertelstunde frei, danach wächst die Wartezeit. */
const SENDEN_FREI = 6;

/** So viele Abfragen „an/aus“ je Netz und Viertelstunde frei (die Website fragt einmal je Seitenaufruf). */
const LESEN_FREI = 60;

export async function GET(req: Request) {
  const schluessel = `kontaktformular-lesen:${adresseNetz(req)}`;
  const p = pruefe(schluessel);
  if (!p.erlaubt) return antwort({ ok: false, fehler: 'Zu viele Abfragen.' }, 429, { 'Retry-After': String(p.warteSek) });
  fehlschlag(schluessel, Date.now(), LESEN_FREI);
  return antwort({ ok: true, aktiv: !!(await kontaktformularBereit()) });
}

export async function POST(req: Request) {
  const netz = adresseNetz(req);
  if (!(await kontaktformularBereit())) return antwort(NICHT_DA, 404);
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, GRENZEN.koerper); } catch (x) { return jsonZuGross(x) ?? antwort({ ok: false, fehler: 'Kein JSON.' }, 400); }

  const schluessel = `kontaktformular:${netz}`;
  const p = pruefe(schluessel);
  if (!p.erlaubt) return antwort({ ok: false, fehler: `Zu viele Nachrichten auf einmal — bitte in ${Math.max(1, Math.ceil(p.warteSek / 60))} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
  fehlschlag(schluessel, Date.now(), SENDEN_FREI);

  if (typeof b.webseite === 'string' && b.webseite.trim()) return antwort({ ok: false, fehler: NICHT_ANGENOMMEN }, 400);
  const geladen = stempelZeit(b.stempel);
  if (geladen === null || !ausfuellZeitOk(geladen, Date.now())) return antwort({ ok: false, fehler: NICHT_ANGENOMMEN }, 400);
  const e = eingabePruefen(b);
  if (!e.ok) return antwort({ ok: false, fehler: e.fehler }, e.status);

  // Lehnt der Anfrage-Weg ab (eingeschränkte Person …), sieht der Gast dieselbe Antwort; nur das Log weiß davon (ohne Adresse).
  // Ein technischer Fehler (Speicher) dagegen sagt es offen — sonst ginge die Nachricht still verloren.
  let r: Awaited<ReturnType<typeof eingangVerarbeiten>>;
  try { r = await eingangVerarbeiten(e.eingabe); } catch (x) {
    console.error('[kontaktformular] Eingang:', x instanceof Error ? x.message.slice(0, 120) : 'Fehler');
    return antwort({ ok: false, fehler: 'Ihre Nachricht ließ sich gerade nicht speichern. Bitte versuchen Sie es in ein paar Minuten noch einmal.' }, 503);
  }
  if (!r.ok) console.warn('[kontaktformular] Eingang nicht übernommen:', r.grund);
  return antwort({ ok: true, text: DANKE_TEXT });
}
