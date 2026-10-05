// ─── Datenschutz-Einrichtung der Instanz (05.10.) ───────────────────────────
// GET                → { verantwortlicher (gespeichert), wirksam { v, quelle, luecken }, darf (Inhaber?) }
//                      nur im Haushalt des Inhabers (sonst 403 — ein Testkunde sieht nie die Einrichtung).
// GET ?nur=angaben   → { mail, seite, verantwortlich } für den Datenschutzhinweis in der Danke-Mail (Netzwerken).
// POST { aktion: 'verantwortlicher', verantwortlicher: { name, anschrift, mail, telefon?, vertretung?, dsb? } }
// POST { aktion: 'verantwortlicher-leeren' }      → zurück auf Umgebung bzw. „fehlt“
// Empfänger und Auftragsverarbeiter (Art. 28/30, Punkt 4 des Pakets): GET liefert `empfaenger` (gespeichert oder Vorgabe-Liste).
// POST { aktion: 'empfaenger', empfaenger }        → einfügen/ersetzen (nach id; erster Schreibzugriff übernimmt die Vorgabe-Liste)
// POST { aktion: 'empfaenger-archiv', id, archiviert } → nicht (mehr) in Gebrauch bzw. zurückholen
// POST { aktion: 'empfaenger-weg', id }            → entfernen (die Oberfläche fragt vorher; Archivieren ist meist besser)
// POST { aktion: 'art14-vorlage', vorlage: { betreff, text } } / { aktion: 'art14-vorlage-leeren' } → Vorlage der Information nach Art. 14 (05.10.)
// Schreiben: NUR der Inhaber (Rolle), NUR von Hand (Dienstweg/ZOE → 403), nur aus dem aktuellen Bau (bauPruefen);
// Protokoll nur mit Feldnamen (nie Werte). Lib: lib/datenschutz/einrichtung.ts (rein) + einrichtung-server.ts.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { istDienst } from '@/lib/zugang/dienst';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { bauPruefen } from '@/lib/bau/pruefen';
import { zuGross } from '@/lib/zugang/umfang';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { EINRICHTUNG_SPEICHER, verantwortlicherPruefen, verantwortlicherWirksam, empfaengerPruefen, empfaengerSetzen, empfaengerWirksam, empfaengerArchivieren } from '@/lib/datenschutz/einrichtung';
import { einrichtungAendern, ladeEinrichtung } from '@/lib/datenschutz/einrichtung-server';
import { datenschutzAngabenAus } from '@/lib/crm/netzwerken-recht';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { art14VorlagePruefen, ART14_STANDARD, ART14_PLATZHALTER } from '@/lib/datenschutz/art14';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (fehler: string, status: number) => NextResponse.json({ ok: false, fehler }, { status });

export async function GET(req: Request) {
  const w = await imHaushaltDesInhabers(req);
  if (!w) return nein('Nur im Haushalt des Inhabers.', 403);
  const e = await ladeEinrichtung();
  const wirksam = verantwortlicherWirksam(e);
  if (new URL(req.url).searchParams.get('nur') === 'angaben') return NextResponse.json({ ok: true, ...datenschutzAngabenAus(wirksam.v) }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ ok: true, verantwortlicher: e.verantwortlicher ?? null, wirksam, empfaenger: empfaengerWirksam(e), art14: e.art14 ?? null, art14Wirksam: e.art14 ?? ART14_STANDARD, platzhalter: ART14_PLATZHALTER, darf: !w.dienst && (await istInhaber(w.person)) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (istDienst(req)) return nein('Nur von Hand — nie über ZOE oder Skripte.', 403);
  const w = await imHaushaltDesInhabers(req);
  if (!w) return nein('Nur im Haushalt des Inhabers.', 403);
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;
  const person = personStreng(req);
  if (!person || !(await istInhaber(person))) return nein('Nur der Inhaber ändert die Datenschutz-Einrichtung.', 403);
  if (zuGross(req, 64_000)) return nein('Anfrage zu groß.', 413);
  let b: { aktion?: string; verantwortlicher?: unknown; empfaenger?: unknown; id?: unknown; archiviert?: unknown; vorlage?: unknown };
  try { b = await jsonBegrenzt(req, 64_000); } catch (e) { return jsonZuGross(e) ?? nein('Kein JSON.', 400); }
  const jetzt = new Date().toISOString();

  if (b.aktion === 'verantwortlicher') {
    const r = verantwortlicherPruefen(b.verantwortlicher);
    if (!r.ok) return nein(r.fehler, 400);
    const neu = await einrichtungAendern(e => ({ ...e, verantwortlicher: { ...r.v, geaendert: jetzt, von: person } }));
    await protokolliere(EINRICHTUNG_SPEICHER, [{ op: 'geaendert', id: 'verantwortlicher', felder: Object.keys(r.v) }], werAus(req));
    return NextResponse.json({ ok: true, verantwortlicher: neu.verantwortlicher ?? null, wirksam: verantwortlicherWirksam(neu) });
  }
  if (b.aktion === 'verantwortlicher-leeren') {
    const neu = await einrichtungAendern(e => { const { verantwortlicher: _weg, ...rest } = e; return rest; });
    await protokolliere(EINRICHTUNG_SPEICHER, [{ op: 'geloescht', id: 'verantwortlicher' }], werAus(req));
    return NextResponse.json({ ok: true, verantwortlicher: null, wirksam: verantwortlicherWirksam(neu) });
  }
  if (b.aktion === 'empfaenger') {
    const r = empfaengerPruefen(b.empfaenger);
    if (!r.ok) return nein(r.fehler, 400);
    let neuAngelegt = false;
    const neu = await einrichtungAendern(e => {
      const liste = empfaengerWirksam(e);
      neuAngelegt = !liste.some(x => x.id === r.e.id);
      if (neuAngelegt && liste.length >= 60) return e;
      return { ...e, empfaenger: empfaengerSetzen(liste, r.e, jetzt) };
    });
    if (!neu.empfaenger?.some(x => x.id === r.e.id)) return nein('Höchstens 60 Empfänger.', 413);
    await protokolliere(EINRICHTUNG_SPEICHER, [{ liste: 'empfaenger', op: neuAngelegt ? 'neu' : 'geaendert', id: r.e.id, felder: Object.keys(r.e) }], werAus(req));
    return NextResponse.json({ ok: true, empfaenger: empfaengerWirksam(neu) });
  }
  if (b.aktion === 'empfaenger-archiv' || b.aktion === 'empfaenger-weg') {
    const id = String(b.id ?? '');
    let gefunden = false;
    const neu = await einrichtungAendern(e => {
      const liste = empfaengerWirksam(e);
      gefunden = liste.some(x => x.id === id);
      if (!gefunden) return e;
      return { ...e, empfaenger: b.aktion === 'empfaenger-weg' ? liste.filter(x => x.id !== id) : empfaengerArchivieren(liste, id, b.archiviert === true, jetzt) };
    });
    if (!gefunden) return nein('Empfänger nicht gefunden.', 404);
    await protokolliere(EINRICHTUNG_SPEICHER, [{ liste: 'empfaenger', op: b.aktion === 'empfaenger-weg' ? 'geloescht' : 'geaendert', id, ...(b.aktion === 'empfaenger-weg' ? {} : { felder: ['archiviert'] }) }], werAus(req));
    return NextResponse.json({ ok: true, empfaenger: empfaengerWirksam(neu) });
  }
  // Art. 14 (05.10., Betroffenenrechte v2): Vorlage der Information für Kontakte aus Dritt-Quellen — Platzhalter, nie versendet.
  if (b.aktion === 'art14-vorlage') {
    const r = art14VorlagePruefen(b.vorlage);
    if (!r.ok) return nein(r.fehler, 400);
    const neu = await einrichtungAendern(e => ({ ...e, art14: { ...r.v, geaendert: jetzt, von: person } }));
    await protokolliere(EINRICHTUNG_SPEICHER, [{ op: 'geaendert', id: 'art14', felder: ['betreff', 'text'] }], werAus(req));
    return NextResponse.json({ ok: true, art14: neu.art14 ?? null, art14Wirksam: neu.art14 ?? ART14_STANDARD });
  }
  if (b.aktion === 'art14-vorlage-leeren') {
    await einrichtungAendern(e => { const { art14: _weg, ...rest } = e; return rest; });
    await protokolliere(EINRICHTUNG_SPEICHER, [{ op: 'geloescht', id: 'art14' }], werAus(req));
    return NextResponse.json({ ok: true, art14: null, art14Wirksam: ART14_STANDARD });
  }
  return nein('aktion unbekannt.', 400);
}
