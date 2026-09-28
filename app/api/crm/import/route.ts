// ─── MAKE OS — Import der Masterliste ───────────────────────────────────────
// Führt Kevins Masterliste (CSV) mit dem Bestand zusammen. Idempotent: zweimal
// laufen ändert nichts. Die Pipeline (Stufe, Wiedervorlage, Aktivitäten) bleibt
// beim Abgleich unberührt.
//
// Seit 27.09. „Online gewinnt“ (Kevins Entscheidung): die Liste füllt nur
// Lücken. Von Hand gepflegte Felder, die abweichen, werden NICHT überschrieben,
// sondern als Konflikte zurückgegeben und im Speicher `crm-import-konflikte`
// abgelegt, bis jemand sie einzeln entscheidet (aktion 'konflikt').
//   POST { csv, name } | { pfad } | {}     → schreiben
//   POST { …, vorschau: true }             → alles rechnen, nichts schreiben
//   POST { aktion: 'konflikt', kontaktId, feld, wahl: 'online' | 'liste' }
//   POST { aktion: 'rueckgaengig', laufId }→ Import-Lauf zurücknehmen (K2 #25, lib/crm/import-lauf.ts)
//   GET                                    → offene Konflikte, mögliche Dubletten, ohne Besitzer, Läufe (30 Tage)
//
// K2 (28.09.): die Vorschau prüft die Datei (Spaltenzahl, Excel-„E+“, verlorene PLZ-Null, unlesbares Datum —
// lib/crm/import-pruefung.ts) und zählt, wer auf der Sperrliste steht (nicht angelegt, lib/crm/sperrliste.ts).
// Jeder schreibende Import bekommt eine Lauf-ID; der Vorher-Stand der geänderten Kontakte liegt VOR dem
// Schreiben in `crm-import-laeufe--<haushalt>` — „Import rückgängig“ je Lauf, 30 Tage.
//
// Ablaufprüfung 28.09.:
//  · (a) Konflikte werden mit den offenen früherer Listen zusammengeführt (`konflikteZusammenfuehren`), nie ersetzt.
//  · W5/(b) „Liste übernehmen“ schreibt über denselben Weg wie die Kartei: `listePatchen` mit `teil` → säubern,
//    `bezuegeSynchron` (Typ ↔ Typen[0], Position → Rolle der Hauptstation, E-Mail ↔ Adressen), `serverStempel`,
//    Art.-18-Sperre (409), Änderungsprotokoll.
//  · W7 der Lauf merkt sich die Firmen, die der Firmen-Abgleich NEU anlegte; „rückgängig“ nimmt sie mit zurück,
//    wenn sie personenlos, unverändert und verweisfrei sind.
//  · (c) „inzwischen verknüpft“ prüft CRM, Dateiablage, Head-Vorschläge, Termin-Signale und Aufgaben;
//    „rückgängig“ schreibt ins Änderungsprotokoll.
//
// Der Pfad ist auf den Leadordner beschränkt. Die Schnittstelle ist zwar
// schlüsselgeschützt, aber „lies mir beliebige Dateien" darf trotzdem keine
// Route können — Default-Deny, wie überall in dieser Software.
// { csv, name } schickt die Datei selbst (auf Hetzner gibt es keinen
// Schreibtisch), höchstens 12 MB.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { loadJson, schrumpftZuStark, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { csvLesenMitBefund, trennerVon } from '@/lib/make-one/csv';
import { importieren, pipelineStand, istStammdatenFeld, saeubereKontakt, teilAnwenden, bezuegeSynchron, serverStempel, VON_HAND_MAX, type Kontakt } from '@/lib/make-one/crm';
import { firmenAbgleichen } from '@/lib/crm/abgleich';
import { aendereCrm } from '@/lib/crm/speicher';
import { KONFLIKT_SPEICHER, leererKonfliktStand, konflikteZusammenfuehren, SEGMENT_VERNETZEN_ID, segmentVernetzen, type KonfliktStand } from '@/lib/crm/import-konflikte';
import { localDay } from '@/lib/zeit';
import { logRun } from '@/lib/agent-log';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { importPruefen } from '@/lib/crm/import-pruefung';
import { karteiHaushalt, sperrlisteLaden, sperrlisteNachtragen, sperrPruefer } from '@/lib/crm/sperrliste';
import { kontaktAbdruck, laeufeLaden, laufAblegen, laufFirmenSetzen, laufKurz, laufName, laufNachherSetzen, neueLaufId, rueckgaengigRechnen, firmenRueckgaengig, istImportLauf, LAUF_ID_OK, type ImportLauf, type LaufBestand } from '@/lib/crm/import-lauf';
import { verknuepfungsBestaende, verknuepftIn } from '@/lib/crm/person-bestaende';
import { ladeCrm } from '@/lib/crm/speicher';
import { loeschSperren, type VerweisKontext } from '@/lib/crm/crm-stand';
import { EINGESCHRAENKT_FEHLER } from '@/lib/crm/einschraenkung';
import { listePatchen } from '@/lib/store/patch-liste';
import { protokolliere, listenDiff, type Wer } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDNER = join(homedir(), 'Desktop', 'CRM Leadordner');
const STANDARD = join(ORDNER, 'CRM_MASTER_Hauptdatei.csv');

interface Bestand { kontakte: Kontakt[] }

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const st = (await loadJson<KonfliktStand>(KONFLIKT_SPEICHER)) ?? leererKonfliktStand();
  // Nur Import-Läufe — Zusammenführungen der Dubletten (W4) liegen im selben Speicher, gehören aber dorthin.
  const laeufe = (await laeufeLaden(await karteiHaushalt())).filter(istImportLauf).map(laufKurz).reverse();
  return NextResponse.json({ ok: true, ...st, laeufe });
}

type Body = { pfad?: string; csv?: string; name?: string; vorschau?: boolean; aktion?: string; kontaktId?: string; feld?: string; wahl?: string; laufId?: string };

export async function POST(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  if (zuGross(req, 12_000_000)) return ZU_GROSS(12_000_000);
  let body: Body = {};
  try { body = await req.json(); } catch { /* ohne Body: Standarddatei */ }
  // Protokoll als Teil des Imports (wie der Import selbst), mit der entscheidenden Person.
  if (body.aktion === 'konflikt') return konfliktLoesen(body, { art: 'import', person: wer.person });
  if (body.aktion === 'rueckgaengig') return rueckgaengig(body, wer.person);

  let text: string;
  let quelle: string;
  if (typeof body.csv === 'string' && body.csv.trim()) {
    text = body.csv.replace(/^﻿/, '');
    quelle = `Upload: ${String(body.name ?? 'CSV').replace(/[^\w.\- ]/g, '').slice(0, 80) || 'CSV'}`;
  } else {
    const pfad = resolve(body.pfad ? join(ORDNER, body.pfad) : STANDARD);
    if (!pfad.startsWith(ORDNER + '/') && pfad !== STANDARD) {
      return NextResponse.json({ error: 'Nur Dateien aus dem CRM Leadordner.' }, { status: 400 });
    }
    try { text = await readFile(pfad, 'utf8'); }
    catch { return NextResponse.json({ error: 'Datei nicht lesbar — auf dem Server gibt es keinen Schreibtisch. Bitte die CSV-Datei über „Datei wählen“ hochladen.' }, { status: 404 }); }
    quelle = pfad.replace(homedir(), '~');
  }

  const befund = csvLesenMitBefund(text, trennerVon(text));
  const zeilen = befund.zeilen;
  if (!zeilen.length) return NextResponse.json({ error: 'Keine Zeilen in der Datei.' }, { status: 400 });
  const heute = localDay();
  const pruefung = importPruefen(befund);

  // Sperrliste (K2 #60): wer eine Werbesperre trägt, steht darauf (nachtragen, idempotent) — gesperrte Zeilen werden nicht angelegt.
  await sperrlisteNachtragen((await loadJson<Bestand>('kontakte'))?.kontakte ?? []);
  const gesperrt = sperrPruefer(await sperrlisteLaden());

  // Vorschau: alles rechnen auf dem aktuellen Stand, nichts schreiben. Beispiele nur Kennungen und Feldnamen.
  if (body.vorschau) {
    const vorher = (await loadJson<Bestand>('kontakte'))?.kontakte ?? [];
    const r = importieren(vorher, zeilen, heute, { gesperrt });
    return NextResponse.json({
      ok: true, vorschau: true, zeilen: zeilen.length, neu: r.neu, aktualisiert: r.aktualisiert, unveraendert: r.unveraendert,
      konflikte: r.konflikte.length, moeglicheDubletten: r.moeglicheDubletten.length, ohneBesitzer: r.ohneBesitzer,
      gesperrt: r.gesperrt, uebergang: r.uebergang, weitereAdressen: r.weitereAdressen, warnungen: pruefung.warnungen, pruefung: pruefung.zaehler,
      abgelehnt: schrumpftZuStark(vorher.length, r.kontakte.length, 20),
      beispiele: { konflikte: r.konflikte.slice(0, 10).map(k => ({ kontaktId: k.kontaktId, feld: k.feld })), moeglicheDubletten: r.moeglicheDubletten.slice(0, 10) },
    });
  }

  // Stufe 2: Lesen, Einarbeiten und Schrumpf-Schutz in EINER Schreibsperre — vorher las der Import außerhalb,
  // und eine Änderung dazwischen (Klick in der Kartei) wurde vom Import-Stand überschrieben.
  // K2 #25: in derselben Sperre, VOR dem Schreiben, den Lauf mit dem Vorher-Stand der geänderten Kontakte ablegen.
  let r: ReturnType<typeof importieren> | null = null;
  let abgelehnt = false;
  const haushalt = await karteiHaushalt();
  const lauf: ImportLauf = { id: neueLaufId(), am: new Date().toISOString(), person: wer.person, quelle, neu: [], vorher: [], nachher: {} };
  let mitLauf = false;
  // Änderungsprotokoll (28.09.): der Import schreibt als `import` (mit der auslösenden Person) — Kennung + Feldnamen, nie Werte.
  const alsImport: Wer = { art: 'import', person: wer.person };
  let protokollVorher: Kontakt[] = [], protokollNachher: Kontakt[] = [];
  await updateJsonAsync<Bestand>('kontakte', async cur => {
    const vorher = cur?.kontakte ?? [];
    const ergebnis = importieren(vorher, zeilen, heute, { gesperrt });
    r = ergebnis;
    if (schrumpftZuStark(vorher.length, ergebnis.kontakte.length, 20)) { abgelehnt = true; return cur ?? { kontakte: [] }; }
    const alt = new Map(vorher.map(k => [k.id, k]));
    lauf.neu = ergebnis.neuIds;
    lauf.vorher = ergebnis.kontakte.flatMap(k => { const a = alt.get(k.id); return a && kontaktAbdruck(a) !== kontaktAbdruck(k) ? [a] : []; });
    if (lauf.neu.length || lauf.vorher.length) { await laufAblegen(haushalt, lauf); mitLauf = true; }
    protokollVorher = vorher; protokollNachher = ergebnis.kontakte;
    return { ...(cur ?? {}), kontakte: ergebnis.kontakte };
  });
  if (!abgelehnt) await protokolliere('kontakte', listenDiff(protokollVorher, protokollNachher), alsImport);
  if (abgelehnt || !r) return NextResponse.json({ error: 'Abgelehnt: der Import hätte den Bestand halbiert.' }, { status: 409 });
  r = r as ReturnType<typeof importieren>;

  // Konflikte NICHT anwenden — ablegen, damit sie in Stammdaten › Austausch einzeln entschieden werden.
  const jetzt = new Date().toISOString();
  const konfliktStand: KonfliktStand = { konflikte: r.konflikte, moeglicheDubletten: r.moeglicheDubletten, ohneBesitzer: r.ohneBesitzer, stand: jetzt, quelle };
  // (a) Zusammenführen statt ersetzen: offene Konflikte früherer Listen bleiben; je Person und Feld gilt der jüngste Listenwert.
  await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => konflikteZusammenfuehren(cur, konfliktStand));

  // Beim ersten Import das Marketing-Segment „Vernetzen“ anlegen — kalte Leads gehen dorthin, nicht in den Vertrieb.
  await aendereCrm(c => (c.segmente.some(s => s.id === SEGMENT_VERNETZEN_ID) ? c : { ...c, segmente: [...c.segmente, segmentVernetzen(jetzt)] }), alsImport);

  // Firmen als eigene Stammdaten: neue anlegen, Personen verknüpfen, leere Felder füllen.
  const firmenVorher = new Set((await ladeCrm()).firmen.map(f => f.id));
  const firmen = await firmenAbgleichen(alsImport);
  // Fingerabdrücke NACH dem Firmen-Abgleich — so, wie der Import die Kontakte hinterließ.
  const nachher = (await loadJson<Bestand>('kontakte'))?.kontakte ?? [];
  if (mitLauf) {
    await laufNachherSetzen(haushalt, lauf.id, nachher);
    // W7: neu angelegte Firmen, an denen Personen dieses Laufs hängen (so zählt keine Firma mit, die jemand anders
    // zufällig gleichzeitig anlegte) — mit Fingerabdruck, damit „rückgängig“ sie nur unverändert zurücknimmt.
    const laufPersonen = new Set([...lauf.neu, ...lauf.vorher.map(v => v.id)]);
    const ihreFirmen = new Set(nachher.filter(k => laufPersonen.has(k.id)).flatMap(k => [k.firmaId, ...(k.stationen ?? []).map(st => st.firmaId)]).filter((x): x is string => !!x));
    const neueFirmen = (await ladeCrm()).firmen.filter(f => !firmenVorher.has(f.id) && ihreFirmen.has(f.id));
    await laufFirmenSetzen(haushalt, lauf.id, neueFirmen as unknown as ({ id: string } & Record<string, unknown>)[]);
  }
  await logRun('crm', `Import: ${r.neu} neu, ${r.aktualisiert} aktualisiert, ${r.unveraendert} unverändert, ${r.konflikte.length} Konflikte, ${r.gesperrt} gesperrt übersprungen`, { quelle, zeilen: zeilen.length, moeglicheDubletten: r.moeglicheDubletten.length, ohneBesitzer: r.ohneBesitzer, ...(mitLauf ? { lauf: lauf.id } : {}) });
  return NextResponse.json({
    ok: true, zeilen: zeilen.length, neu: r.neu, aktualisiert: r.aktualisiert, unveraendert: r.unveraendert,
    konflikte: r.konflikte, moeglicheDubletten: r.moeglicheDubletten, ohneBesitzer: r.ohneBesitzer, gesperrt: r.gesperrt, weitereAdressen: r.weitereAdressen,
    warnungen: pruefung.warnungen, pruefung: pruefung.zaehler, ...(mitLauf ? { laufId: lauf.id } : {}),
    firmen, stand: pipelineStand(nachher),
  });
}

/**
 * Einen Konflikt entscheiden. „online“ behält den Wert der Kartei, „liste“ übernimmt den Listenwert.
 * In beiden Fällen gilt das Feld danach als von Hand entschieden (`vonHand`) — der nächste Import
 * fragt bei einer erneuten Abweichung wieder, statt still zu überschreiben.
 *
 * Seit 28.09. (W5/b) über denselben Weg wie die Kartei: `listePatchen` mit `teil` in der Sperre, säubern,
 * `bezuegeSynchron` (Typ → Typen[0], Position → Rolle der Hauptstation, E-Mail → Adressen), `serverStempel`,
 * Art. 18 (eingeschränkt → 409, der Konflikt bleibt offen), Änderungsprotokoll mit der entscheidenden Person.
 */
async function konfliktLoesen(body: Body, wer: Wer) {
  const { kontaktId, feld, wahl } = body;
  if (!kontaktId || !feld || !istStammdatenFeld(feld) || (wahl !== 'online' && wahl !== 'liste')) {
    return NextResponse.json({ ok: false, fehler: 'kontaktId, feld und wahl (online | liste) nötig.' }, { status: 400 });
  }
  const st = (await loadJson<KonfliktStand>(KONFLIKT_SPEICHER)) ?? leererKonfliktStand();
  const k = st.konflikte.find(x => x.kontaktId === kontaktId && x.feld === feld);
  if (!k) return NextResponse.json({ ok: false, fehler: 'Konflikt nicht (mehr) offen.' }, { status: 404 });
  const heute = localDay();
  const firmenNamen = new Map((await ladeCrm()).firmen.map(f => [f.id, f.name]));
  const felder: Record<string, unknown> = wahl === 'liste' ? { [feld]: k.liste ?? null } : {};
  const r = await listePatchen<Kontakt, Bestand & Record<string, unknown>>('kontakte', 'kontakte', [{ op: 'teil', id: kontaktId, felder }], 20, undefined, {
    wer,
    // Art. 18: an einer eingeschränkten Person wird nichts geändert — auch kein Import-Konflikt entschieden.
    pruefen: liste => (liste.find(x => x.id === kontaktId)?.eingeschraenkt ? EINGESCHRAENKT_FEHLER : null),
    teil: (alt, f) => saeubereKontakt(teilAnwenden(alt, f)),
    vereinen: (neu, alt) => {
      const v = serverStempel(bezuegeSynchron(neu, alt, heute, id => firmenNamen.get(id)), alt, heute);
      return { ...v, vonHand: Array.from(new Set([...(v.vonHand ?? []), feld])).slice(0, VON_HAND_MAX) };
    },
  });
  if (!r.ok && r.fehler === EINGESCHRAENKT_FEHLER) return NextResponse.json({ ok: false, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true }, { status: 409 });
  // Die Person gibt es nicht mehr (gelöscht oder zusammengeführt, bevor der Konflikt umgebogen war): der Konflikt ist
  // gegenstandslos — entfernen statt 404, sonst hinge er für immer in Stammdaten › Austausch (28.09., F2).
  const gefunden = r.ok;
  if (!r.ok && !r.konflikte?.some(x => x.grund === 'unbekannt')) return NextResponse.json({ ok: false, fehler: r.fehler ?? 'Nicht gespeichert.' }, { status: 409 });
  const rest = await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => ({ ...(cur ?? leererKonfliktStand()), konflikte: (cur?.konflikte ?? []).filter(x => !(x.kontaktId === kontaktId && x.feld === feld)) }));
  return NextResponse.json({ ok: true, offen: rest.konflikte.length, ...(gefunden ? {} : { entfernt: true }) });
}

/**
 * Import-Lauf zurücknehmen (K2 #25): neu angelegte Kontakte fallen weg, geänderte bekommen ihren Vorher-Stand —
 * nur, wer seitdem unverändert ist (und als Neuer nicht inzwischen verknüpft ist: CRM, Dateiablage, Head-Vorschläge,
 * Termin-Signale, Aufgaben — 28.09., c). Alle anderen sind Konflikte (nichts überschrieben). Danach (W7) die vom
 * Firmen-Abgleich neu angelegten Firmen, wenn sie personenlos, unverändert und verweisfrei sind. Ein Lauf geht nur
 * einmal zurück; alles steht im Änderungsprotokoll (wer = die zurücknehmende Person).
 */
async function rueckgaengig(body: Body, person: string) {
  const laufId = String(body.laufId ?? '');
  if (!LAUF_ID_OK.test(laufId)) return NextResponse.json({ ok: false, fehler: 'laufId fehlt oder ist ungültig.' }, { status: 400 });
  const haushalt = await karteiHaushalt();
  const lauf = (await laeufeLaden(haushalt)).find(l => l.id === laufId);
  if (!lauf || !istImportLauf(lauf)) return NextResponse.json({ ok: false, fehler: 'Lauf nicht (mehr) da — Läufe bleiben 30 Tage.' }, { status: 404 });
  if (lauf.rueckgaengig) return NextResponse.json({ ok: false, fehler: 'Dieser Lauf ist schon zurückgenommen.', rueckgaengig: lauf.rueckgaengig }, { status: 409 });
  if (lauf.verfallen) return NextResponse.json({ ok: false, fehler: 'Dieser Lauf kann nicht mehr zurück — eine betroffene Person wurde inzwischen gelöscht (Art. 17).' }, { status: 409 });
  const wer: Wer = { art: 'person', person };
  const bestaende = await verknuepfungsBestaende();
  let ergebnis: ReturnType<typeof rueckgaengigRechnen> | null = null;
  let kVorher: Kontakt[] = [], kNachher: Kontakt[] = [];
  await updateJson<Bestand>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    ergebnis = rueckgaengigRechnen(f.kontakte, lauf, id => verknuepftIn(bestaende, id) !== null);
    kVorher = f.kontakte; kNachher = ergebnis.kontakte;
    return ergebnis.zurueck ? { ...f, kontakte: ergebnis.kontakte } : f;
  });
  const e = ergebnis as unknown as ReturnType<typeof rueckgaengigRechnen>;
  if (e.zurueck) await protokolliere('kontakte', listenDiff(kVorher, kNachher), wer);

  // W7: neue Firmen des Laufs — nur personenlos (auch keine beendete Station), unverändert und ohne jeden Verweis.
  let firmenZurueck = 0;
  const firmenKonflikte: ReturnType<typeof firmenRueckgaengig>['konflikte'] = [];
  if (Object.keys(lauf.firmenNeu ?? {}).length) {
    const kontakte = (await loadJson<Bestand>('kontakte'))?.kontakte ?? [];
    const rechnungen = (await loadJson<{ rechnungen?: VerweisKontext['rechnungen'] }>('finanzplan'))?.rechnungen ?? [];
    const frisch = await verknuepfungsBestaende();
    const hatVerweis = (crm: typeof frisch.crm) => (id: string) =>
      loeschSperren(crm, [{ liste: 'firmen', op: 'delete', id }], { kontakte, rechnungen }).length > 0
      || kontakte.some(k => k.firmaId === id || (k.stationen ?? []).some(st => st.firmaId === id))
      || verknuepftIn({ ...frisch, crm }, id, { liste: 'firmen', id }) !== null;
    const vorab = firmenRueckgaengig(frisch.crm.firmen as unknown as ({ id: string } & Record<string, unknown>)[], lauf, hatVerweis(frisch.crm));
    firmenKonflikte.push(...vorab.konflikte);
    if (vorab.weg.length) {
      // In der Sperre noch einmal prüfen — dazwischen kann jemand eine Firma angefasst haben.
      await aendereCrm(c => {
        const r = firmenRueckgaengig(c.firmen as unknown as ({ id: string } & Record<string, unknown>)[], { firmenNeu: Object.fromEntries(vorab.weg.map(id => [id, lauf.firmenNeu![id]])) }, hatVerweis(c));
        firmenZurueck = r.weg.length;
        for (const k of r.konflikte) if (!firmenKonflikte.some(x => x.id === k.id)) firmenKonflikte.push(k);
        const weg = new Set(r.weg);
        return weg.size ? { ...c, firmen: c.firmen.filter(f => !weg.has(f.id)) } : c;
      }, wer);
    }
  }
  const konflikte = [...e.konflikte, ...firmenKonflikte];
  const vermerk = { am: new Date().toISOString(), von: person, zurueck: e.zurueck, konflikte, ...(firmenZurueck ? { firmen: firmenZurueck } : {}) };
  await updateJson<LaufBestand>(laufName(haushalt), cur => ({ laeufe: (cur?.laeufe ?? []).map(l => (l.id === laufId ? { ...l, rueckgaengig: vermerk } : l)) }));
  // Konflikte/Dubletten-Hinweise zu Kontakten, die es nicht mehr gibt, fallen aus der Konfliktliste.
  const weg = new Set(lauf.neu.filter(id => !e.kontakte.some(k => k.id === id)));
  if (weg.size) await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => { const st = cur ?? leererKonfliktStand(); return { ...st, konflikte: st.konflikte.filter(k => !weg.has(k.kontaktId)), moeglicheDubletten: st.moeglicheDubletten.filter(m => !weg.has(m.kontaktId) && !(m.mitId && weg.has(m.mitId))) }; });
  await logRun('crm', `Import rückgängig: ${e.zurueck} zurückgesetzt, ${firmenZurueck} Firmen entfernt, ${konflikte.length} Konflikte`, { lauf: laufId, von: person });
  return NextResponse.json({ ok: true, laufId, zurueck: e.zurueck, firmen: firmenZurueck, konflikte });
}
