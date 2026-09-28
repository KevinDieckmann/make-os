// ─── CRM — Betroffenenrechte ────────────────────────────────────────────────
// GET  ?id=…  → Auskunft nach Art. 15: alles, was wir über die Person haben
//              (Kartei, Firma, alle CRM-Listen, Dateiablage nur als Metadaten,
//              Import-Konflikte, Head-Vorschläge, Termine, Aufgaben) als JSON-Datei —
//              seit U2 mit den Einwilligungs-Nachweisen vollständig (Zeitpunkt, wer,
//              Wortlaut, Beleg, Widerruf, was fehlt), Einschränkung, „geprüft“, Löschfrist.
// GET  ?loeschfristen=1 → die Löschfristen-Tabelle (Standard, wirksam, gespeichert) + letzter Lauf
// POST { id, grund } → Löschen nach Art. 17: Person raus aus ALLEN Speichern
//              (lib/crm/person-bestaende.ts, 28.09.). Ins Löschprotokoll kommt nur Kennung,
//              Datum und Grund — keine Personendaten. Eine Werbesperre ist
//              meist die bessere Wahl (Art. 21): dann bleibt „nicht anschreiben“
//              erhalten. Deshalb fragt die Oberfläche das vorher ab. Eine eingeschränkte
//              Person (Art. 18) wird aufbewahrt — erst aufheben, dann löschen (409).
// POST { aktion: 'einschraenken', id, grund, antragId? }        → Art. 18 setzen (U2 #51)
// POST { aktion: 'einschraenkung-aufheben', id, grund }          → nur mit Grund
// POST { aktion: 'frist-verlaengern', id, bis, grund }           → Löschfrist der Person verlängern (U2 #52)
// POST { aktion: 'fristen', fristen: { <art>: Zahl | null } }    → Löschfristen anpassen (Standard nie gespeichert)
// Alle Schreibwege nur mit ausdrücklicher Person (Regel 5) — sie steht im Vermerk.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { stationenVon } from '@/lib/crm/stationen';
import { ladeCrm } from '@/lib/crm/speicher';
import { fuerPerson } from '@/lib/make-one/crm';
import { zahlungMaskiert } from '@/lib/crm/zahlung';
import { personAufzaehlen, personEntfernen } from '@/lib/crm/person-bestaende';
import { nachweisAuskunft } from '@/lib/crm/einwilligung';
import { einschraenkungSetzen, einschraenkungAufheben } from '@/lib/crm/einschraenkung';
import { LOESCHFRISTEN, LOESCHFRISTEN_SPEICHER, fristenWirksam, fristenSpeichern, verlaengerungPruefen, type LoeschfristenBestand } from '@/lib/crm/loeschfristen';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Bestand = { kontakte: Kontakt[] };

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const url = new URL(req.url);
  if (url.searchParams.has('loeschfristen')) {
    const b = (await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER)) ?? {};
    return NextResponse.json({ ok: true, tabelle: LOESCHFRISTEN, wirksam: fristenWirksam(b.fristen), gespeichert: b.fristen ?? {}, lauf: b.lauf ?? null });
  }
  const id = url.searchParams.get('id') ?? '';
  const k = ((await loadJson<Bestand>('kontakte'))?.kontakte ?? []).find(x => x.id === id);
  if (!k) return NextResponse.json({ ok: false, fehler: 'Nicht gefunden.' }, { status: 404 });
  const crm = await ladeCrm();
  const auskunft = {
    erstellt: new Date().toISOString(), verantwortlich: 'Kevin Dieckmann (KD Ventures / Kevin Dieckmann Consulting)',
    // Private Notizen sieht nur, wer sie schrieb — auch in der Auskunft (26.09.).
    // IBAN (Entscheidung 28.09., H4): Die Auskunft nach Art. 15 enthält die volle IBAN, wenn sie zur Person
    // gehört (Kontakt.zahlung — nur bei Personen ohne Firma). Die IBAN einer Firma ist kein Datum der Person:
    // sie steht hier nur maskiert, wie überall sonst im Browser.
    person: fuerPerson(k, personStreng(req) ?? '', { ibanVoll: true }), firma: (() => { const f = k.firmaId ? crm.firmen.find(x => x.id === k.firmaId) : undefined; return f ? { ...f, ...(f.zahlung ? { zahlung: zahlungMaskiert(f.zahlung) } : {}) } : null; })(),
    // Stationen (28.09.): alle Firmen, in denen die Person stand oder steht — nur Kennung, Name und die Station selbst.
    stationen: stationenVon(k).map(st => ({ ...st, firma: crm.firmen.find(x => x.id === st.firmaId)?.name ?? null })),
    // U2 (28.09.): Einwilligungen mit vollem Nachweis (Art. 7 Abs. 1) — auch widerrufene, mit dem, was am Nachweis fehlt.
    einwilligungsNachweise: nachweisAuskunft(k.einwilligungen),
    einschraenkung: k.eingeschraenkt ?? null,
    werbesperre: k.werbesperre ?? null,
    geprueft: k.geprueftAm ? { am: k.geprueftAm, von: k.geprueftVon ?? null } : null,
    hinweisBeiErhebung: k.hinweisBeiErhebung ?? null,
    loeschfristVerlaengert: k.loeschfristVerlaengert ?? null,
    // Alle Speicher aus einer Stelle (28.09., lib/crm/person-bestaende.ts): CRM-Listen, Dateiablage (nur Metadaten),
    // Import-Konflikte, Head-Vorschläge, kommender Termin, eindeutig zugeordnete Aufgaben.
    ...(await personAufzaehlen(id)),
  };
  return new Response(JSON.stringify(auskunft, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="Auskunft-Art15-${id}-${localDay()}.json"` } });
}

type Body = { aktion?: string; id?: string; grund?: string; antragId?: string; bis?: string; fristen?: unknown };

/** Eine Person in der Kartei ändern — in der Sperre, mit Protokoll (nur Feldnamen). */
async function kontaktAendern(req: Request, id: string, felder: string[], f: (k: Kontakt) => Kontakt | { fehler: string; status: number }): Promise<NextResponse> {
  let raus: { status: number; body: Record<string, unknown> } = { status: 404, body: { ok: false, fehler: 'Nicht gefunden.' } };
  let geaendert = false;
  await updateJson<Bestand>('kontakte', cur => {
    const b = cur ?? { kontakte: [] };
    const i = b.kontakte.findIndex(k => k.id === id);
    if (i < 0) return b;
    const r = f(b.kontakte[i]);
    if ('fehler' in r) { raus = { status: r.status, body: { ok: false, fehler: r.fehler } }; return b; }
    raus = { status: 200, body: { ok: true } };
    if (r === b.kontakte[i]) return b;
    geaendert = true;
    const kontakte = [...b.kontakte]; kontakte[i] = r;
    return { ...b, kontakte };
  });
  if (geaendert) await protokolliere('kontakte', [{ op: 'geaendert', id, felder }], werAus(req));
  return NextResponse.json(raus.body, { status: raus.status });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  // Regel 5 (28.09., K1): Löschprotokoll und Vermerke nennen, WER — nur mit ausdrücklicher Person, nie „kevin“ als Rückfall.
  const von = personStreng(req);
  if (!von) return NextResponse.json({ ok: false, fehler: 'Nur mit angemeldeter Person.' }, { status: 401 });
  let b: Body;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const heute = localDay();
  const jetzt = new Date().toISOString();
  const id = String(b.id ?? '');
  const grund = String(b.grund ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);

  if (b.aktion === 'fristen') {
    let fehler: string | null = null;
    await updateJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER, cur => {
      const r = fristenSpeichern(cur?.fristen, b.fristen);
      if (!r.ok) { fehler = r.fehler; return cur ?? {}; }
      const { fristen: _alt, ...rest } = cur ?? {};
      return Object.keys(r.fristen).length ? { ...rest, fristen: r.fristen } : rest;
    });
    if (fehler) return NextResponse.json({ ok: false, fehler }, { status: 400 });
    const neu = (await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER)) ?? {};
    return NextResponse.json({ ok: true, wirksam: fristenWirksam(neu.fristen), gespeichert: neu.fristen ?? {} });
  }

  if (!id || id.length > 80) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });

  if (b.aktion === 'einschraenken') {
    if (grund.length < 3) return NextResponse.json({ ok: false, fehler: 'Einschränken nur mit Grund.' }, { status: 400 });
    const antragId = typeof b.antragId === 'string' && b.antragId ? b.antragId : undefined;
    if (antragId) {
      const a = (await ladeCrm()).antraege.find(x => x.id === antragId);
      if (!a || a.art !== 'einschraenkung') return NextResponse.json({ ok: false, fehler: 'Antrag unbekannt oder keine Einschränkung.' }, { status: 400 });
    }
    return kontaktAendern(req, id, ['eingeschraenkt', 'aktivitaeten'], k => (k.eingeschraenkt ? k : einschraenkungSetzen(k, { grund, von, antragId }, heute, jetzt)));
  }
  if (b.aktion === 'einschraenkung-aufheben') {
    if (grund.length < 3) return NextResponse.json({ ok: false, fehler: 'Aufheben nur mit Grund.' }, { status: 400 });
    return kontaktAendern(req, id, ['eingeschraenkt', 'aktivitaeten'], k => {
      if (!k.eingeschraenkt) return k;
      return einschraenkungAufheben(k, { grund, von }, heute, jetzt) ?? { fehler: 'Aufheben nur mit Grund.', status: 400 };
    });
  }
  if (b.aktion === 'frist-verlaengern') {
    const v = verlaengerungPruefen({ bis: b.bis, grund: b.grund }, heute);
    if (!v.ok) return NextResponse.json({ ok: false, fehler: v.fehler }, { status: 400 });
    return kontaktAendern(req, id, ['loeschfristVerlaengert', 'aktivitaeten'], k => ({
      ...k, loeschfristVerlaengert: { bis: v.bis, grund: v.grund, von, am: heute },
      aktivitaeten: [...(k.aktivitaeten ?? []), { am: jetzt, art: 'system' as const, von, text: `Löschfrist verlängert bis ${v.bis} — ${v.grund}` }],
    }));
  }
  if (b.aktion !== undefined) return NextResponse.json({ ok: false, fehler: 'aktion unbekannt.' }, { status: 400 });

  // Art. 17 — eine eingeschränkte Person (Art. 18) wird aufbewahrt: erst aufheben.
  const vorher = ((await loadJson<Bestand>('kontakte'))?.kontakte ?? []).find(k => k.id === id);
  if (vorher?.eingeschraenkt) return NextResponse.json({ ok: false, fehler: 'Die Verarbeitung ist eingeschränkt (Art. 18) — die Person wird aufbewahrt. Erst die Einschränkung mit Grund aufheben.' }, { status: 409 });
  // Aus ALLEN Speichern — eine Stelle kennt sie (lib/crm/person-bestaende.ts, 28.09.). Idempotent: ein zweiter Lauf
  // (etwa nach einem Abbruch) räumt Reste auf, auch wenn die Kartei die Person schon nicht mehr kennt.
  const bericht = await personEntfernen(id);
  if (!Object.keys(bericht.speicher).length) return NextResponse.json({ ok: false, fehler: 'Nicht gefunden.' }, { status: 404 });
  await updateJson<{ eintraege: { id: string; datum: string; grund: string; von: string }[] }>('crm-loeschprotokoll', cur => ({ eintraege: [...(cur?.eintraege ?? []), { id, datum: heute, grund: (grund || 'Art. 17 DSGVO').slice(0, 200), von }] }));
  return NextResponse.json({ ok: true, speicher: bericht.speicher, aufgabenPruefen: bericht.aufgabenPruefen });
}
