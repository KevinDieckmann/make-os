// ─── CRM — Dubletten ────────────────────────────────────────────────────────
// GET  → Paare mit gleichem Namen und zweitem gemeinsamen Merkmal + die Zusammenführungen der
//        letzten 30 Tage, die noch zurück können (`zusammenfuehrungen`)
// GET  ?behalten=…&weg=… → Vorschau: was vom weggefallenen Eintrag wandert (Deals, Aktivitäten,
//        Follow-ups, Dateien, Einwilligungen, Kampagnen — nur Anzahlen) und ob es geht (`grund`)
// POST { behalten, weg } → zusammenführen (Verlauf, Einwilligungen, Sperre, private
//      Notiz nur paarweise — lib/crm/dubletten.ts) und ALLE Verweise umbiegen: CRM,
//      Dateiablage, Import-Konflikte, Heads, Termine, Aufgaben (lib/crm/person-bestaende.ts,
//      28.09.). Bewusste Handlung, einzeln.
// POST { aktion: 'rueckgaengig', laufId } → Zusammenführung zurücknehmen (28.09., Ablaufprüfung W4)
//
// Ablaufprüfung 28.09.:
//  · W4: VOR dem Schreiben liegt ein Zusammenführungs-Lauf im Speicher der Import-Läufe (`art: 'zusammenfuehren'`,
//    lib/crm/zusammenfuehren-lauf.ts): beide Einträge vorher + je umgebogenem Eintrag (CRM, Dateiablage, Aufgaben)
//    Vorher-Stand und Fingerabdruck danach. Rückgängig nur, solange nichts davon seitdem geändert wurde — sonst 409
//    mit Grund, nichts angefasst.
//  · (h) Ablehnen statt still kürzen (private Notizen), Ergebnis durch `saeubereKontakt`/`kontaktZuGross` — zu groß 409.
//  · Paket D-C (29.09., #17/#33): Absicht VOR dem Kartei-Schreiben (lib/crm/absichten-crm.ts) — bricht der Lauf danach ab,
//    biegt die Wiederaufnahme die Verweise um; ein abgelehnter/nicht gefundener Fall verwirft die Absicht.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { anzeigename, fuerPerson, saeubereKontakt, kontaktZuGross, type Kontakt } from '@/lib/make-one/crm';
import { dubletten, zusammenfuehren, zusammenfuehrenPruefen, wasWandert } from '@/lib/crm/dubletten';
import { personUmbiegen, umbiegenSchnappschuesse, schnappschussListe, schnappschuesseZurueck, dateienDerPerson } from '@/lib/crm/person-bestaende';
import { karteiHaushalt } from '@/lib/crm/sperrliste';
import { laeufeLaden, laufAblegen, laufName, neueLaufId, LAUF_ID_OK, type LaufBestand } from '@/lib/crm/import-lauf';
import { zusammenLauf, rueckgaengigGruende } from '@/lib/crm/zusammenfuehren-lauf';
import { ladeCrm } from '@/lib/crm/speicher';
import { protokolliere, listenDiff, type Wer } from '@/lib/store/aenderungsprotokoll';
import { absichtBeginnen, absichtAbschliessen, absichtenLaden, istOffen, mitVorgang } from '@/lib/store/absichten';
import { ZUSAMMEN_SCHRITTE, zusammenfuehrenFortsetzen } from '@/lib/crm/absichten-crm';

/** Die Zusammenführung fand nicht statt (abgelehnt oder Kontakt weg) — die Absicht verfällt. */
class NichtZusammengefuehrt extends Error {}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EINGESCHRAENKT = 'Die Verarbeitung einer der beiden Personen ist eingeschränkt (Art. 18) — erst aufheben (mit Grund), dann zusammenführen.';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const k = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const url = new URL(req.url);
  const behalten = url.searchParams.get('behalten'), weg = url.searchParams.get('weg');
  if (behalten || weg) {
    const a = k.find(x => x.id === behalten), b = k.find(x => x.id === weg);
    if (!a || !b || a.id === b.id) return NextResponse.json({ ok: false, fehler: 'Kontakt nicht gefunden.' }, { status: 404 });
    const grund = a.eingeschraenkt || b.eingeschraenkt ? EINGESCHRAENKT : zusammenfuehrenPruefen(a, b);
    return NextResponse.json({ ok: true, wandert: wasWandert(await ladeCrm(), b, await dateienDerPerson(b.id)), ...(grund ? { grund } : {}) });
  }
  const laeufe = (await laeufeLaden(await karteiHaushalt())).filter(l => l.art === 'zusammenfuehren' && !l.rueckgaengig && !l.verfallen && l.zusammen);
  return NextResponse.json({
    ok: true,
    paare: dubletten(k).map(([a, b]) => ({ a: { id: a.id, name: anzeigename(a), email: a.email, firma: a.firma, verlauf: a.aktivitaeten?.length ?? 0 }, b: { id: b.id, name: anzeigename(b), email: b.email, firma: b.firma, verlauf: b.aktivitaeten?.length ?? 0 } })),
    // Nur, was die Oberfläche für „Rückgängig“ braucht — Namen aus dem Vorher-Stand.
    zusammenfuehrungen: laeufe.reverse().map(l => ({ id: l.id, am: l.am, person: l.person, behalten: l.zusammen!.behalten, name: l.vorher[0] ? anzeigename(l.vorher[0]) : '', weg: l.vorher[1] ? anzeigename(l.vorher[1]) : '' })),
  });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  // Regel 5 (28.09., K1): Zusammenführen nur mit ausdrücklicher Person — sie entscheidet über private Notizen und
  // steht im Verlauf. Kein Rückfall auf „kevin“ für einen Dienstaufruf ohne Person.
  const person = personStreng(req);
  if (!person) return NextResponse.json({ ok: false, fehler: 'Zusammenführen nur mit angemeldeter Person.' }, { status: 401 });
  let body: { behalten?: string; weg?: string; aktion?: string; laufId?: string };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const wer: Wer = { art: 'person', person };
  if (body.aktion === 'rueckgaengig') return rueckgaengig(String(body.laufId ?? ''), person, wer);
  if (body.aktion !== undefined) return NextResponse.json({ ok: false, fehler: 'aktion ist rueckgaengig.' }, { status: 400 });
  if (!body.behalten || !body.weg || body.behalten === body.weg) return NextResponse.json({ ok: false, fehler: 'behalten und weg nötig.' }, { status: 400 });
  const behalten = body.behalten, weg = body.weg;

  // Was das Umbiegen ändern wird (CRM, Dateiablage, Aufgaben) — vorher gerechnet, für „Rückgängig“.
  const verweise = await umbiegenSchnappschuesse(weg, behalten);
  const haushalt = await karteiHaushalt();
  const laufId = neueLaufId();
  let ergebnis: Kontakt | null = null;
  let abgelehnt: { status: number; fehler: string } | null = null;
  let vorher: Kontakt[] = [], nachher: Kontakt[] = [];
  // Absichtsprotokoll (29.09., Paket D-C #17/#33): VOR dem Kartei-Schreiben. Bricht der Lauf danach ab, biegt die
  // Wiederaufnahme die Verweise um (lib/crm/absichten-crm.ts) — nie zeigen Deals/Ablage/Aufgaben auf die gelöschte Kennung.
  // Eine offene Absicht desselben Paars (abgebrochener Versuch) wird erst fertiggestellt bzw. verworfen.
  const schluessel = `${weg}>${behalten}`;
  const alt = (await absichtenLaden(haushalt)).find(a => a.art === 'zusammenfuehren' && a.schluessel === schluessel && istOffen(a));
  if (alt) await zusammenfuehrenFortsetzen(haushalt, alt);
  const { absicht } = await absichtBeginnen(haushalt, { art: 'zusammenfuehren', schluessel, schritte: ZUSAMMEN_SCHRITTE, daten: { behalten, weg, laufId }, person });
  const karteiSchritt = async () => updateJsonAsync<{ kontakte: Kontakt[] }>('kontakte', async cur => {
    const f = cur ?? { kontakte: [] };
    const a = f.kontakte.find(x => x.id === behalten), b = f.kontakte.find(x => x.id === weg);
    if (!a || !b) return f;
    // Art. 18 (U2): eine eingeschränkte Person wird nicht bearbeitet — auch nicht zusammengeführt.
    if (a.eingeschraenkt || b.eingeschraenkt) { abgelehnt = { status: 409, fehler: EINGESCHRAENKT }; return f; }
    const grund = zusammenfuehrenPruefen(a, b);
    if (grund) { abgelehnt = { status: 409, fehler: grund }; return f; }
    // Nie still kürzen (h): zu viele Aktivitäten/Einwilligungen/Adressen zusammen → 409, sonst säubern wie jeder Kartei-Weg.
    const roh = zusammenfuehren(a, b, person, new Date().toISOString());
    const zuGross = kontaktZuGross(roh);
    if (zuGross) { abgelehnt = { status: 409, fehler: `Nicht zusammengeführt: ${zuGross}` }; return f; }
    // Säubern wie jeder Kartei-Weg; besteht schon der behaltene Eintrag die Säuberung nicht (Altbestand mit alter
    // Kennung), bleibt es beim ungesäuberten Ergebnis wie bisher — abgelehnt wird nur, was erst die Zusammenführung kaputt macht.
    const sauber = saeubereKontakt(roh) ?? (saeubereKontakt(a) ? null : roh);
    if (!sauber) { abgelehnt = { status: 409, fehler: 'Nicht zusammengeführt: das Ergebnis wäre kein gültiger Eintrag.' }; return f; }
    ergebnis = sauber;
    // W4: der Lauf liegt VOR dem Schreiben — geht danach etwas schief, bleibt nur ein Lauf ohne Wirkung.
    await laufAblegen(haushalt, zusammenLauf({ id: laufId, am: new Date().toISOString(), person, a, b, ergebnis: sauber, verweise }));
    vorher = f.kontakte;
    nachher = f.kontakte.filter(x => x.id !== b.id).map(x => (x.id === a.id ? sauber : x));
    return { ...f, kontakte: nachher };
  });
  let umgebogen: Awaited<ReturnType<typeof personUmbiegen>> | undefined;
  try {
    await mitVorgang(haushalt, absicht, async v => {
      await v.schritt('kartei', async () => {
        await karteiSchritt();
        if (abgelehnt || !ergebnis) throw new NichtZusammengefuehrt();
      });
      await protokolliere('kontakte', listenDiff(vorher, nachher), wer);
      umgebogen = await v.schritt('verweise', () => personUmbiegen(weg, behalten));
    });
  } catch (e) {
    if (!(e instanceof NichtZusammengefuehrt)) throw e; // Absicht bleibt offen — die Wiederaufnahme biegt die Verweise um
    await absichtAbschliessen(haushalt, absicht.id, 'verworfen');
    const nein = abgelehnt as { status: number; fehler: string } | null;
    if (nein) return NextResponse.json({ ok: false, fehler: nein.fehler }, { status: nein.status });
    return NextResponse.json({ ok: false, fehler: 'Kontakt nicht gefunden.' }, { status: 404 });
  }
  await absichtAbschliessen(haushalt, absicht.id, 'fertig', ['laufId']);
  return NextResponse.json({ ok: true, kontakt: fuerPerson(ergebnis as unknown as Kontakt, person), speicher: umgebogen?.speicher ?? {}, laufId });
}

/**
 * Zusammenführung zurücknehmen (W4): nur, solange weder der behaltene Eintrag noch einer der umgebogenen Einträge
 * seitdem geändert wurde (sonst 409 mit Grund, nichts angefasst). Erst die Kartei (beide Einträge wie vorher), dann
 * die Verweise (CRM, Dateiablage, Aufgaben) je Speicher in einer Sperre mit erneuter Prüfung.
 */
async function rueckgaengig(laufId: string, person: string, wer: Wer) {
  if (!LAUF_ID_OK.test(laufId)) return NextResponse.json({ ok: false, fehler: 'laufId fehlt oder ist ungültig.' }, { status: 400 });
  const haushalt = await karteiHaushalt();
  const lauf = (await laeufeLaden(haushalt)).find(l => l.id === laufId && l.art === 'zusammenfuehren');
  if (!lauf?.zusammen) return NextResponse.json({ ok: false, fehler: 'Zusammenführung nicht (mehr) da — sie bleibt 30 Tage.' }, { status: 404 });
  if (lauf.rueckgaengig) return NextResponse.json({ ok: false, fehler: 'Diese Zusammenführung ist schon zurückgenommen.' }, { status: 409 });
  const z = lauf.zusammen;
  const crm = await ladeCrm();
  const listen = new Map<string, Awaited<ReturnType<typeof schnappschussListe>>>();
  for (const s of Array.from(new Set(z.verweise.map(v => v.speicher)))) listen.set(s, await schnappschussListe(s, crm));
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const gruende = rueckgaengigGruende(lauf, kontakte, s => listen.get(s) ?? null);
  if (gruende.length) return NextResponse.json({ ok: false, fehler: `Nicht zurückgenommen: ${gruende.join(' ')}`, gruende }, { status: 409 });

  // Kartei zuerst — in der Sperre noch einmal prüfen.
  let gruendeJetzt: string[] = [];
  let kVorher: Kontakt[] = [], kNachher: Kontakt[] = [];
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    gruendeJetzt = rueckgaengigGruende({ ...lauf, zusammen: { ...z, verweise: [] } }, f.kontakte, () => []);
    if (gruendeJetzt.length) return f;
    const [a, b] = lauf.vorher;
    kVorher = f.kontakte;
    kNachher = [...f.kontakte.map(x => (x.id === a.id ? a : x)), b];
    return { ...f, kontakte: kNachher };
  });
  if (gruendeJetzt.length) return NextResponse.json({ ok: false, fehler: `Nicht zurückgenommen: ${gruendeJetzt.join(' ')}`, gruende: gruendeJetzt }, { status: 409 });
  await protokolliere('kontakte', listenDiff(kVorher, kNachher), wer);
  const r = await schnappschuesseZurueck(z.verweise, wer);
  const vermerk = { am: new Date().toISOString(), von: person, zurueck: 2 + r.zurueck, konflikte: [] };
  await updateJson<LaufBestand>(laufName(haushalt), cur => ({ laeufe: (cur?.laeufe ?? []).map(l => (l.id === laufId ? { ...l, rueckgaengig: vermerk } : l)) }));
  return NextResponse.json({
    ok: true, laufId, zurueck: r.zurueck,
    ...(r.konflikte.length ? { teilweise: r.konflikte, hinweis: `Beide Einträge sind wieder da. Nicht zurückgebogen (inzwischen geändert): ${r.konflikte.join(', ')} — dort zeigen Verweise weiter auf den behaltenen Eintrag.` } : {}),
  });
}
