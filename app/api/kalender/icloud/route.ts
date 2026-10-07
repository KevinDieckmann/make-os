// ─── Kalender — iCloud je Person: Status, Verbinden, Trennen (06.10.2026) ────
// GET                                              → Stand der EIGENEN Verbindung (`icloudStatus`): verbunden als k•••@…,
//                                                    Haushalts-Kalender oder eigener, Quelle (Oberfläche/Server-Einrichtung),
//                                                    letzter Abgleich, „App-Passwort ungültig“, eigene Kalender (zeigen/aus)
// POST { aktion: 'verbinden', appleId, passwort }  → Anmeldung bei iCloud prüfen, dann speichern + abgleichen (auch „erneuern“)
//      { aktion: 'trennen' }                       → Zugang und Spiegel dieser Person weg
//      { aktion: 'abgleichen' }                    → jetzt abgleichen
//      { aktion: 'kalender', kennung, zeigen }     → einen Kalender des eigenen Kontos zeigen/ausblenden
//      { aktion: 'blockkalender', kennung }        → (07.10.) Zielkalender für Blöcke aus Planen/ZOE im eigenen Konto
// Nur die eigene Person (Sitzung, Haushalt des Inhabers) — Dienstweg und andere Konten 403 (`eigenePerson`). Die Antwort
// trägt nie das Passwort und nie die volle Apple-ID; das Protokoll nur Feldnamen. Fehlversuche beim Verbinden gedrosselt
// (Apple sperrt Konten nach wiederholt falschen Anmeldungen). Logik: lib/kalender/icloud-person.ts.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { eigenePerson } from '@/lib/google/zugang';
import { icloudStatus, icloudVerbinden, icloudTrennen, kalenderZeigen, blockKalenderSetzen, personAbgleichen, hauptPerson, IcloudEingabeFehler } from '@/lib/kalender/icloud-person';
import { abgleichen, KalenderFehler, KalenderUeberlastet } from '@/lib/kalender/icloud';
import { pruefe, fehlschlag, erfolg } from '@/lib/zugang/drossel';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_SELBST = { ok: false as const, fehler: 'Die iCloud-Verbindung verwaltet nur die Person selbst — angemeldet, nie über den Dienstweg.' };
/** Fehlversuche beim Verbinden je Person: nach 3 falschen Anmeldungen erst nach einer Pause wieder (Apple sperrt sonst). */
const VERSUCHE = 3;

function fehlerAntwort(e: unknown) {
  if (e instanceof IcloudEingabeFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: 400 });
  // 401 von Apple nie als 401 weitergeben (das hieße für den Browser „abgemeldet“) — 400 mit Kennzeichen.
  if (e instanceof KalenderFehler && e.status === 401) return NextResponse.json({ ok: false, anmeldung: true, fehler: 'Apple hat die Anmeldung abgelehnt — stimmen Apple-ID und App-Passwort? Ein App-Passwort wird ungültig, sobald das Apple-Passwort geändert oder es bei Apple widerrufen wird; dann unter appleid.apple.com ein neues anlegen.' }, { status: 400 });
  if (e instanceof KalenderUeberlastet) return NextResponse.json({ ok: false, fehler: e.message }, { status: 503 });
  if (e instanceof KalenderFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status >= 500 ? 502 : e.status === 403 ? 409 : e.status });
  return NextResponse.json({ ok: false, fehler: 'iCloud ist gerade nicht erreichbar.' }, { status: 502 });
}

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  return NextResponse.json({ ok: true, ...(await icloudStatus(z.person)) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let b: { aktion?: unknown; appleId?: unknown; passwort?: unknown; kennung?: unknown; zeigen?: unknown };
  try { b = await jsonBegrenzt(req, 4096); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const person = z.person;
  const wer = werAus(req);
  try {
    if (b.aktion === 'verbinden') {
      const bremse = `icloud-verbinden:${person}`;
      const p = pruefe(bremse);
      if (!p.erlaubt) return NextResponse.json({ ok: false, fehler: `Zu viele Versuche — bitte in ${Math.ceil(p.warteSek / 60)} Min. noch einmal (Apple sperrt sonst das Konto).` }, { status: 429, headers: { 'Retry-After': String(p.warteSek) } });
      let r: Awaited<ReturnType<typeof icloudVerbinden>>;
      try { r = await icloudVerbinden(person, b.appleId, b.passwort); }
      catch (e) { if (e instanceof KalenderFehler && e.status === 401) fehlschlag(bremse, Date.now(), VERSUCHE); throw e; }
      erfolg(bremse);
      await protokolliere('kalender', [{ liste: 'icloud', op: 'neu', id: 'verbindung', felder: [r.haupt ? 'haushalt' : 'eigene'] }], wer).catch(() => { /* nur Protokoll */ });
      return NextResponse.json({ ok: true, ...(r.fehler ? { hinweis: `Verbunden — der erste Abgleich klappte noch nicht: ${r.fehler}` } : {}), ...(await icloudStatus(person)) });
    }
    if (b.aktion === 'trennen') {
      const r = await icloudTrennen(person);
      if (r.war) await protokolliere('kalender', [{ liste: 'icloud', op: 'geloescht', id: 'verbindung', felder: [r.haupt ? 'haushalt' : 'eigene'] }], wer).catch(() => { /* nur Protokoll */ });
      return NextResponse.json({ ok: true, war: r.war, ...(await icloudStatus(person)) });
    }
    if (b.aktion === 'abgleichen') {
      if ((await hauptPerson()) === person) await abgleichen({ erzwingen: true });
      else if (!(await personAbgleichen(person, { erzwingen: true }))) return NextResponse.json({ ok: false, fehler: 'iCloud ist für dich nicht verbunden.' }, { status: 409 });
      return NextResponse.json({ ok: true, ...(await icloudStatus(person)) });
    }
    if (b.aktion === 'kalender') {
      if (typeof b.kennung !== 'string' || typeof b.zeigen !== 'boolean') return NextResponse.json({ ok: false, fehler: 'kennung und zeigen fehlen.' }, { status: 400 });
      if (!(await kalenderZeigen(person, b.kennung, b.zeigen))) return NextResponse.json({ ok: false, fehler: 'Diesen Kalender gibt es in deiner iCloud-Verbindung nicht.' }, { status: 409 });
      await protokolliere('kalender', [{ liste: 'icloud', op: 'geaendert', id: 'kalender', felder: [b.zeigen ? 'gezeigt' : 'ausgeblendet'] }], wer).catch(() => { /* nur Protokoll */ });
      return NextResponse.json({ ok: true, ...(await icloudStatus(person)) });
    }
    if (b.aktion === 'blockkalender') {
      if (typeof b.kennung !== 'string') return NextResponse.json({ ok: false, fehler: 'kennung fehlt.' }, { status: 400 });
      if (!(await blockKalenderSetzen(person, b.kennung))) return NextResponse.json({ ok: false, fehler: 'In diesen Kalender kann MAKE OS nicht schreiben (nicht in deiner Verbindung oder nur lesbar).' }, { status: 409 });
      await protokolliere('kalender', [{ liste: 'icloud', op: 'geaendert', id: 'kalender', felder: ['blockKalender'] }], wer).catch(() => { /* nur Protokoll */ });
      return NextResponse.json({ ok: true, ...(await icloudStatus(person)) });
    }
    return NextResponse.json({ ok: false, fehler: 'aktion = verbinden | trennen | abgleichen | kalender | blockkalender' }, { status: 400 });
  } catch (e) { return fehlerAntwort(e); }
}
