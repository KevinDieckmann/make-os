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
import { importieren, pipelineStand, istStammdatenFeld, VON_HAND_MAX, type Kontakt } from '@/lib/make-one/crm';
import { firmenAbgleichen } from '@/lib/crm/abgleich';
import { aendereCrm } from '@/lib/crm/speicher';
import { KONFLIKT_SPEICHER, leererKonfliktStand, SEGMENT_VERNETZEN_ID, segmentVernetzen, type KonfliktStand } from '@/lib/crm/import-konflikte';
import { localDay } from '@/lib/zeit';
import { logRun } from '@/lib/agent-log';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { importPruefen } from '@/lib/crm/import-pruefung';
import { karteiHaushalt, sperrlisteLaden, sperrlisteNachtragen, sperrPruefer } from '@/lib/crm/sperrliste';
import { kontaktAbdruck, laeufeLaden, laufAblegen, laufKurz, laufName, laufNachherSetzen, neueLaufId, rueckgaengigRechnen, LAUF_ID_OK, type ImportLauf, type LaufBestand } from '@/lib/crm/import-lauf';
import { enthaeltKennung } from '@/lib/crm/person-bestaende';
import { ladeCrm } from '@/lib/crm/speicher';
import { protokolliere, listenDiff, type Wer } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDNER = join(homedir(), 'Desktop', 'CRM Leadordner');
const STANDARD = join(ORDNER, 'CRM_MASTER_Hauptdatei.csv');

interface Bestand { kontakte: Kontakt[] }

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const st = (await loadJson<KonfliktStand>(KONFLIKT_SPEICHER)) ?? leererKonfliktStand();
  const laeufe = (await laeufeLaden(await karteiHaushalt())).map(laufKurz).reverse();
  return NextResponse.json({ ok: true, ...st, laeufe });
}

type Body = { pfad?: string; csv?: string; name?: string; vorschau?: boolean; aktion?: string; kontaktId?: string; feld?: string; wahl?: string; laufId?: string };

export async function POST(req: Request) {
  const wer = await imHaushaltDesInhabers(req);
  if (!wer) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  if (zuGross(req, 12_000_000)) return ZU_GROSS(12_000_000);
  let body: Body = {};
  try { body = await req.json(); } catch { /* ohne Body: Standarddatei */ }
  if (body.aktion === 'konflikt') return konfliktLoesen(body);
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
  await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, () => konfliktStand);

  // Beim ersten Import das Marketing-Segment „Vernetzen“ anlegen — kalte Leads gehen dorthin, nicht in den Vertrieb.
  await aendereCrm(c => (c.segmente.some(s => s.id === SEGMENT_VERNETZEN_ID) ? c : { ...c, segmente: [...c.segmente, segmentVernetzen(jetzt)] }), alsImport);

  // Firmen als eigene Stammdaten: neue anlegen, Personen verknüpfen, leere Felder füllen.
  const firmen = await firmenAbgleichen(alsImport);
  // Fingerabdrücke NACH dem Firmen-Abgleich — so, wie der Import die Kontakte hinterließ.
  const nachher = (await loadJson<Bestand>('kontakte'))?.kontakte ?? [];
  if (mitLauf) await laufNachherSetzen(haushalt, lauf.id, nachher);
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
 */
async function konfliktLoesen(body: Body) {
  const { kontaktId, feld, wahl } = body;
  if (!kontaktId || !feld || !istStammdatenFeld(feld) || (wahl !== 'online' && wahl !== 'liste')) {
    return NextResponse.json({ ok: false, fehler: 'kontaktId, feld und wahl (online | liste) nötig.' }, { status: 400 });
  }
  const st = (await loadJson<KonfliktStand>(KONFLIKT_SPEICHER)) ?? leererKonfliktStand();
  const k = st.konflikte.find(x => x.kontaktId === kontaktId && x.feld === feld);
  if (!k) return NextResponse.json({ ok: false, fehler: 'Konflikt nicht (mehr) offen.' }, { status: 404 });
  let gefunden = false;
  await updateJson<Bestand>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    return { ...f, kontakte: f.kontakte.map(x => {
      if (x.id !== kontaktId) return x;
      gefunden = true;
      const vonHand = Array.from(new Set([...(x.vonHand ?? []), feld])).slice(0, VON_HAND_MAX);
      const wert = wahl === 'liste' ? { [feld]: k.liste } : {};
      return { ...x, ...wert, vonHand, geaendertAm: localDay() };
    }) };
  });
  // Die Person gibt es nicht mehr (gelöscht oder zusammengeführt, bevor der Konflikt umgebogen war): der Konflikt ist
  // gegenstandslos — entfernen statt 404, sonst hinge er für immer in Stammdaten › Austausch (28.09., F2).
  const rest = await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => ({ ...(cur ?? leererKonfliktStand()), konflikte: (cur?.konflikte ?? []).filter(x => !(x.kontaktId === kontaktId && x.feld === feld)) }));
  return NextResponse.json({ ok: true, offen: rest.konflikte.length, ...(gefunden ? {} : { entfernt: true }) });
}

/**
 * Import-Lauf zurücknehmen (K2 #25): neu angelegte Kontakte fallen weg, geänderte bekommen ihren Vorher-Stand —
 * nur, wer seitdem unverändert ist (und als Neuer nicht inzwischen an einem Deal/Mandat/einer Kampagne hängt).
 * Alle anderen sind Konflikte (nichts überschrieben). Ein Lauf geht nur einmal zurück.
 */
async function rueckgaengig(body: Body, person: string) {
  const laufId = String(body.laufId ?? '');
  if (!LAUF_ID_OK.test(laufId)) return NextResponse.json({ ok: false, fehler: 'laufId fehlt oder ist ungültig.' }, { status: 400 });
  const haushalt = await karteiHaushalt();
  const lauf = (await laeufeLaden(haushalt)).find(l => l.id === laufId);
  if (!lauf) return NextResponse.json({ ok: false, fehler: 'Lauf nicht (mehr) da — Läufe bleiben 30 Tage.' }, { status: 404 });
  if (lauf.rueckgaengig) return NextResponse.json({ ok: false, fehler: 'Dieser Lauf ist schon zurückgenommen.', rueckgaengig: lauf.rueckgaengig }, { status: 409 });
  const crm = await ladeCrm();
  let ergebnis: ReturnType<typeof rueckgaengigRechnen> | null = null;
  await updateJson<Bestand>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    ergebnis = rueckgaengigRechnen(f.kontakte, lauf, id => enthaeltKennung(crm, id));
    return ergebnis.zurueck ? { ...f, kontakte: ergebnis.kontakte } : f;
  });
  const e = ergebnis as unknown as ReturnType<typeof rueckgaengigRechnen>;
  const vermerk = { am: new Date().toISOString(), von: person, zurueck: e.zurueck, konflikte: e.konflikte };
  await updateJson<LaufBestand>(laufName(haushalt), cur => ({ laeufe: (cur?.laeufe ?? []).map(l => (l.id === laufId ? { ...l, rueckgaengig: vermerk } : l)) }));
  // Konflikte/Dubletten-Hinweise zu Kontakten, die es nicht mehr gibt, fallen aus der Konfliktliste.
  const weg = new Set(lauf.neu.filter(id => !e.kontakte.some(k => k.id === id)));
  if (weg.size) await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => { const st = cur ?? leererKonfliktStand(); return { ...st, konflikte: st.konflikte.filter(k => !weg.has(k.kontaktId)), moeglicheDubletten: st.moeglicheDubletten.filter(m => !weg.has(m.kontaktId) && !(m.mitId && weg.has(m.mitId))) }; });
  await logRun('crm', `Import rückgängig: ${e.zurueck} zurückgesetzt, ${e.konflikte.length} Konflikte`, { lauf: laufId, von: person });
  return NextResponse.json({ ok: true, laufId, zurueck: e.zurueck, konflikte: e.konflikte });
}
