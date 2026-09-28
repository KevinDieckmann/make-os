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
//   GET                                    → offene Konflikte, mögliche Dubletten, ohne Besitzer
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
import { loadJson, schrumpftZuStark, updateJson } from '@/lib/store/local-db';
import { csvLesen, trennerVon } from '@/lib/make-one/csv';
import { importieren, pipelineStand, istStammdatenFeld, VON_HAND_MAX, type Kontakt } from '@/lib/make-one/crm';
import { firmenAbgleichen } from '@/lib/crm/abgleich';
import { aendereCrm } from '@/lib/crm/speicher';
import { KONFLIKT_SPEICHER, leererKonfliktStand, SEGMENT_VERNETZEN_ID, segmentVernetzen, type KonfliktStand } from '@/lib/crm/import-konflikte';
import { localDay } from '@/lib/zeit';
import { logRun } from '@/lib/agent-log';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORDNER = join(homedir(), 'Desktop', 'CRM Leadordner');
const STANDARD = join(ORDNER, 'CRM_MASTER_Hauptdatei.csv');

interface Bestand { kontakte: Kontakt[] }

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const st = (await loadJson<KonfliktStand>(KONFLIKT_SPEICHER)) ?? leererKonfliktStand();
  return NextResponse.json({ ok: true, ...st });
}

type Body = { pfad?: string; csv?: string; name?: string; vorschau?: boolean; aktion?: string; kontaktId?: string; feld?: string; wahl?: string };

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  if (zuGross(req, 12_000_000)) return ZU_GROSS(12_000_000);
  let body: Body = {};
  try { body = await req.json(); } catch { /* ohne Body: Standarddatei */ }
  if (body.aktion === 'konflikt') return konfliktLoesen(body);

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

  const zeilen = csvLesen(text, trennerVon(text));
  if (!zeilen.length) return NextResponse.json({ error: 'Keine Zeilen in der Datei.' }, { status: 400 });
  const heute = localDay();

  // Vorschau: alles rechnen auf dem aktuellen Stand, nichts schreiben. Beispiele nur Kennungen und Feldnamen.
  if (body.vorschau) {
    const vorher = (await loadJson<Bestand>('kontakte'))?.kontakte ?? [];
    const r = importieren(vorher, zeilen, heute);
    return NextResponse.json({
      ok: true, vorschau: true, zeilen: zeilen.length, neu: r.neu, aktualisiert: r.aktualisiert, unveraendert: r.unveraendert,
      konflikte: r.konflikte.length, moeglicheDubletten: r.moeglicheDubletten.length, ohneBesitzer: r.ohneBesitzer,
      abgelehnt: schrumpftZuStark(vorher.length, r.kontakte.length, 20),
      beispiele: { konflikte: r.konflikte.slice(0, 10).map(k => ({ kontaktId: k.kontaktId, feld: k.feld })), moeglicheDubletten: r.moeglicheDubletten.slice(0, 10) },
    });
  }

  // Stufe 2: Lesen, Einarbeiten und Schrumpf-Schutz in EINER Schreibsperre — vorher las der Import außerhalb,
  // und eine Änderung dazwischen (Klick in der Kartei) wurde vom Import-Stand überschrieben.
  let r: ReturnType<typeof importieren> | null = null;
  let abgelehnt = false;
  await updateJson<Bestand>('kontakte', cur => {
    const vorher = cur?.kontakte ?? [];
    r = importieren(vorher, zeilen, heute);
    if (schrumpftZuStark(vorher.length, r.kontakte.length, 20)) { abgelehnt = true; return cur ?? { kontakte: [] }; }
    return { ...(cur ?? {}), kontakte: r.kontakte };
  });
  if (abgelehnt || !r) return NextResponse.json({ error: 'Abgelehnt: der Import hätte den Bestand halbiert.' }, { status: 409 });
  r = r as ReturnType<typeof importieren>;

  // Konflikte NICHT anwenden — ablegen, damit sie in Stammdaten › Austausch einzeln entschieden werden.
  const jetzt = new Date().toISOString();
  const konfliktStand: KonfliktStand = { konflikte: r.konflikte, moeglicheDubletten: r.moeglicheDubletten, ohneBesitzer: r.ohneBesitzer, stand: jetzt, quelle };
  await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, () => konfliktStand);

  // Beim ersten Import das Marketing-Segment „Vernetzen“ anlegen — kalte Leads gehen dorthin, nicht in den Vertrieb.
  await aendereCrm(c => (c.segmente.some(s => s.id === SEGMENT_VERNETZEN_ID) ? c : { ...c, segmente: [...c.segmente, segmentVernetzen(jetzt)] }));

  // Firmen als eigene Stammdaten: neue anlegen, Personen verknüpfen, leere Felder füllen.
  const firmen = await firmenAbgleichen();
  await logRun('crm', `Import: ${r.neu} neu, ${r.aktualisiert} aktualisiert, ${r.unveraendert} unverändert, ${r.konflikte.length} Konflikte`, { quelle, zeilen: zeilen.length, moeglicheDubletten: r.moeglicheDubletten.length, ohneBesitzer: r.ohneBesitzer });
  return NextResponse.json({
    ok: true, zeilen: zeilen.length, neu: r.neu, aktualisiert: r.aktualisiert, unveraendert: r.unveraendert,
    konflikte: r.konflikte, moeglicheDubletten: r.moeglicheDubletten, ohneBesitzer: r.ohneBesitzer,
    firmen, stand: pipelineStand(r.kontakte),
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
