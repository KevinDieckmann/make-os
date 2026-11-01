// ─── Kalender — weitere Google-Konten der EIGENEN Person (nur lesen) (30.10.2026) ───
// GET                                   → Status: eingerichtet?, höchstens n, je Konto maskierte Adresse, Bezeichnung, Zustand
//                                         (verbunden/abgelaufen), gewählte Kalender und ihr Spiegel (Name, Termine, letzter Abgleich)
// GET ?liste=<konto>                    → die wählbaren Kalender dieses Kontos (Name, Hauptkalender, gewählt)
// GET ?start=<wand>&ende=<wand>[&uid=]  → Überschneidungen mit Terminen der weiteren Konten (Hinweis beim Anlegen/Verschieben)
// POST { aktion: 'verbinden', konto? }  → Adresse der Google-Anmeldung (konto = neu verbinden)
//      { aktion: 'kalender', konto, kalender: [id…] } · { aktion: 'label', konto, label } · { aktion: 'abgleichen', konto? }
//      { aktion: 'gruppe', konto, gruppe } (leer = keine; 01.11.: Konten mit derselben Gruppe = EINE Ebene im Kalender)
//      { aktion: 'spiegeln', konto, an }  (01.11.: „Belegt“ in den eigenen Google-Hauptkalender; Vorgabe an)
//      { aktion: 'trennen', konto }     → bei Google widerrufen, Konto + Spiegel weg (die „Belegt“-Blöcke dieses Kontos ebenso)
// Nur die eigene Person (Sitzung) — Dienstweg und andere Konten 403 (lib/google/zugang.ts). Nie Tokens, nie volle Adressen.
import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { eigenePerson } from '@/lib/google/zugang';
import { GoogleApiFehler } from '@/lib/google/http';
import { zusatzStatus, zusatzStarten, zusatzSetzen, zusatzKontoTrennen, labelSauber, istZusatzKonto, ZusatzFehler, ladeZusatzKonto, ZUSATZ_KALENDER_MAX } from '@/lib/google/zusatz';
import { zusatzAbgleichen, zusatzKalenderListe, zusatzKalenderWaehlen, zusatzSpiegelEntfernen, zusatzSpiegelStatus, ueberschneidungenFuer } from '@/lib/kalender/google/zusatz';
import { cacheNeuSchreiben } from '@/lib/kalender/icloud';
import { belegtSpiegeln, belegtSpiegelStatus } from '@/lib/kalender/google/belegt-spiegel';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_SELBST = { ok: false, fehler: 'Weitere Kalender-Konten verwaltet nur die Person selbst — angemeldet, nie über den Dienstweg.' } as const;
const WAND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function fehlerAntwort(e: unknown) {
  if (e instanceof ZusatzFehler) return NextResponse.json({ ok: false, code: e.code, fehler: e.message }, { status: e.status });
  if (e instanceof GoogleApiFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status >= 500 ? 502 : e.status === 429 ? 429 : e.status === 400 ? 400 : 409 });
  return NextResponse.json({ ok: false, fehler: 'Google ist gerade nicht erreichbar.' }, { status: 502 });
}

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const start = q.get('start'), ende = q.get('ende');
  if (start || ende) {
    if (!start || !ende || !WAND.test(start) || !WAND.test(ende)) return NextResponse.json({ ok: false, fehler: 'start und ende als Wandzeit (JJJJ-MM-TTTHH:MM).' }, { status: 400 });
    const uid = q.get('uid');
    return NextResponse.json({ ok: true, ueberschneidungen: await ueberschneidungenFuer(z.person, start, ende, uid && uid.length <= 300 ? uid : undefined) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const liste = q.get('liste');
  if (liste) {
    if (!istZusatzKonto(liste)) return NextResponse.json({ ok: false, fehler: 'Unbekanntes Konto.' }, { status: 400 });
    const k = await ladeZusatzKonto(z.person, liste);
    if (!k) return NextResponse.json({ ok: false, fehler: 'Unbekanntes Konto.' }, { status: 404 });
    try {
      const l = await zusatzKalenderListe(z.person, liste);
      return NextResponse.json({ ok: true, liste: l.map(x => ({ id: x.id, name: x.name, primary: x.primary, gewaehlt: k.kalender.includes(x.id) || (x.primary && k.kalender.includes('primary')) })) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) { return fehlerAntwort(e); }
  }
  const [status, spiegel, belegt] = await Promise.all([zusatzStatus(z.person), zusatzSpiegelStatus(z.person), belegtSpiegelStatus(z.person).catch(() => ({ je: {} as Record<string, number>, offen: 0 }))]);
  return NextResponse.json({ ok: true, ...status, konten: status.konten.map(k => ({ ...k, spiegel: spiegel[k.id] ?? [], belegt: belegt.je[k.id] ?? 0 })), belegtSpiegel: { offen: belegt.offen, ...('fehler' in belegt && belegt.fehler ? { fehler: belegt.fehler } : {}) } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_SELBST);
  if (z instanceof NextResponse) return z;
  let b: { aktion?: unknown; konto?: unknown; kalender?: unknown; label?: unknown; gruppe?: unknown; an?: unknown };
  try { b = await jsonBegrenzt(req, 16_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const konto = b.konto === undefined ? undefined : istZusatzKonto(b.konto) ? b.konto : null;
  if (konto === null) return NextResponse.json({ ok: false, fehler: 'Unbekanntes Konto.' }, { status: 400 });
  const protokoll = (op: 'neu' | 'geaendert' | 'geloescht', id: string, felder?: string[]) => protokolliere('kalender', [{ liste: 'google-zusatz', op, id, ...(felder ? { felder } : {}) }], werAus(req)).catch(() => { /* nur Protokoll */ });
  try {
    if (b.aktion === 'verbinden') return NextResponse.json({ ok: true, ...(await zusatzStarten(z.person, konto ? { konto } : {})) });
    if (b.aktion === 'abgleichen') return NextResponse.json({ ok: true, ...(await zusatzAbgleichen(z.person, { ...(konto ? { konto } : {}), voll: true })) });
    if (!konto) return NextResponse.json({ ok: false, fehler: 'konto fehlt.' }, { status: 400 });
    if (!(await ladeZusatzKonto(z.person, konto))) return NextResponse.json({ ok: false, fehler: 'Unbekanntes Konto.' }, { status: 404 });
    if (b.aktion === 'label') {
      const label = labelSauber(b.label);
      if (!label) return NextResponse.json({ ok: false, fehler: 'Bezeichnung: 1–40 Zeichen.' }, { status: 400 });
      await zusatzSetzen(z.person, konto, { label });
      await protokoll('geaendert', konto, ['label']);
      await cacheNeuSchreiben().catch(() => { /* nächster Lauf */ });
      return NextResponse.json({ ok: true });
    }
    if (b.aktion === 'gruppe') {
      const roh = typeof b.gruppe === 'string' ? b.gruppe.trim() : b.gruppe === null ? '' : undefined;
      if (roh === undefined) return NextResponse.json({ ok: false, fehler: 'gruppe als Text (leer = keine Gruppe).' }, { status: 400 });
      const gruppe = roh ? labelSauber(roh) : null;
      if (roh && !gruppe) return NextResponse.json({ ok: false, fehler: 'Gruppe: 1–40 Zeichen.' }, { status: 400 });
      await zusatzSetzen(z.person, konto, { gruppe });
      await protokoll('geaendert', konto, ['gruppe']);
      await cacheNeuSchreiben().catch(() => { /* nächster Lauf */ });
      const spiegel = await belegtSpiegeln(z.person, { erzwingen: true }).catch(() => null);
      return NextResponse.json({ ok: true, ...(spiegel ? { spiegel } : {}) });
    }
    if (b.aktion === 'spiegeln') {
      if (typeof b.an !== 'boolean') return NextResponse.json({ ok: false, fehler: 'an: true | false.' }, { status: 400 });
      await zusatzSetzen(z.person, konto, { spiegeln: b.an });
      await protokoll('geaendert', konto, ['spiegeln']);
      const spiegel = await belegtSpiegeln(z.person, { erzwingen: true }).catch(() => null);
      return NextResponse.json({ ok: true, ...(spiegel ? { spiegel } : {}) });
    }
    if (b.aktion === 'kalender') {
      const ids = Array.isArray(b.kalender) ? b.kalender.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 300) : [];
      if (!ids.length) return NextResponse.json({ ok: false, fehler: 'Bitte mindestens einen Kalender wählen.' }, { status: 400 });
      if (ids.length > ZUSATZ_KALENDER_MAX) return NextResponse.json({ ok: false, fehler: `Höchstens ${ZUSATZ_KALENDER_MAX} Kalender je Konto.` }, { status: 413 });
      const gewaehlt = await zusatzKalenderWaehlen(z.person, konto, ids);
      await protokoll('geaendert', konto, ['kalender']);
      const r = await zusatzAbgleichen(z.person, { konto, voll: true });
      return NextResponse.json({ ok: true, gewaehlt: gewaehlt.length, ...r });
    }
    if (b.aktion === 'trennen') {
      const r = await zusatzKontoTrennen(z.person, konto);
      await zusatzSpiegelEntfernen(z.person, konto);
      await cacheNeuSchreiben().catch(() => { /* nächster Lauf */ });
      await protokoll('geloescht', konto);
      // Die „Belegt“-Blöcke dieses Kontos im Hauptkalender gehen mit (01.11.).
      await belegtSpiegeln(z.person, { erzwingen: true }).catch(() => { /* der Takt holt es nach */ });
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ ok: false, fehler: 'aktion = verbinden | kalender | label | gruppe | spiegeln | abgleichen | trennen' }, { status: 400 });
  } catch (e) { return fehlerAntwort(e); }
}
