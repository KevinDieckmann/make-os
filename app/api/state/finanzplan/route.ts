// ─── MAKE OS — Finanzplan (lokal) ───────────────────────────────────────────
// Der lebende Finanz-Organismus: die eigenen Firmen (KD Ventures, Kevin Dieckmann
// Consulting, seit 28.09. auch die MAKE Innovation GmbH) mit Konten (Geschäftskonten, Stand von Hand — Anbindung steht im Bauplan),
// die Rechnungs-Pipeline (geplant → gestellt → bezahlt) und Merkposten wie ein
// Partnerdarlehen. Das Controlling (/os/controlling) bleibt die Ist-Buchhaltung
// je Monat — hier lebt die Planung/Verwaltung davor.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { privatFinanzZugang, keinFinanzZugang } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson, updateJsonAsync, updateGeschuetztListen } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import {
  SEED, ugFirmaNachziehen, sauberFile, ueberGrenze, istGrenzFehler, bezahltAnwenden, mitFassung, fassung, fpOpsLesen, fpOpsAnwenden,
  rechnungenSchutzVoll, rechnungenMitServerFeldern, stornoAnwenden,
  type FinanzplanFile, type BezahltErgebnis, type FpErgebnis, type StornoErgebnis,
} from '@/lib/finanzen/finanzplan-bestand';
import { buchungAnlegen, gegenbuchungAnlegen } from '@/lib/finanzen/finanzplan-buchung';
import { istDienst } from '@/lib/zugang/dienst';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { kontostandAusAltweg } from '@/lib/finanzen/konten/server';

import { werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Business-Zahlen gehören zum Haushalt des Inhabers — wie der Business-Index (26.09.).
const KEIN_HAUSHALT = { ok: false, error: 'Kein Zugang zu den Business-Zahlen — sie gehören zum Haushalt des Inhabers (System → Konto).' };

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  if (!(await privatFinanzZugang(req))) return keinFinanzZugang();
  leseZugriff(req, 'finanzplan'); // Lese-Protokoll (05.10.)
  leseZugriff(req, 'rechnungen'); // der Altweg liefert die Rechnungen mit
  let f = await loadJson<FinanzplanFile>('finanzplan');
  if (!f || !Array.isArray(f.firmen) || !f.firmen.length) {
    f = await updateJson<FinanzplanFile>('finanzplan', () => SEED);
  } else if (!Array.isArray(f.produkte) || !f.produkte.length || !Array.isArray(f.uhrwerk?.agenda) || !f.uhrwerk.agenda.length) {
    // Bestand aus der Zeit vor Produkten/Uhrwerk → neue Abschnitte nachziehen.
    f = await updateJson<FinanzplanFile>('finanzplan', current => ({
      ...SEED,
      ...(current ?? {}),
      produkte: Array.isArray(current?.produkte) && current.produkte.length ? current.produkte : SEED.produkte,
      uhrwerk: current?.uhrwerk?.agenda?.length ? current.uhrwerk : SEED.uhrwerk,
      zahlungen: Array.isArray(current?.zahlungen) ? current.zahlungen : [],
    }));
  }
  // Je Eintrag die `fassung` (Fingerabdruck) — der Browser schickt sie beim Ändern zurück (#107).
  return NextResponse.json(mitFassung(sauberFile(f)));
}

/** Kompletten Stand setzen (die Seite verwaltet die Listen). */
export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  const zugang = await privatFinanzZugang(req);
  if (!zugang) return keinFinanzZugang();
  let body: Partial<FinanzplanFile>;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Erste Posten bei der UG in einem Plan ohne UG-Konto → leeres UG-Konto dazu (28.09., additiv).
  // Server-Felder der Rechnungen (Nummernlauf, PDF, Storno-Bezug, Mahnungen — 08.10.) kommen nie aus dem Browser.
  const sauber = rechnungenMitServerFeldern(sauberFile(await loadJson<FinanzplanFile>('finanzplan')), ugFirmaNachziehen(sauberFile(body)));
  if (!sauber.firmen.length) return NextResponse.json({ ok: false, error: 'firmen darf nicht leer sein.' }, { status: 400 });
  // Rechnungen ab „gestellt“ bleiben (28.09., K3) — auch das Vollschreiben löscht oder ändert sie nicht.
  const schutz = rechnungenSchutzVoll(sauberFile(await loadJson<FinanzplanFile>('finanzplan')), sauber);
  if (schutz) return NextResponse.json({ ok: false, error: schutz }, { status: 409 });
  // Zu viele Einträge: ablehnen, nie kürzen (28.09.).
  const grenze = ueberGrenze(sauber);
  if (grenze) return NextResponse.json({ ok: false, error: grenze }, { status: 413 });
  // Kontostand-Änderung stempelt automatisch das Stand-Datum.
  const vorher = await loadJson<FinanzplanFile>('finanzplan');
  const neueStaende: { id: string; kontostand: number }[] = [];
  for (const fa of sauber.firmen) {
    const alt = vorher?.firmen?.find(x => x.id === fa.id);
    if (fa.kontostand !== null && fa.kontostand !== (alt?.kontostand ?? null)) { fa.stand = localDay(); neueStaende.push({ id: fa.id, kontostand: fa.kontostand }); }
  }
  // Hier hängt Geld dran: Rechnungen, offene Zahlungen, Merkposten. Ein Client
  // mit halb geladenem Stand darf das nicht überschreiben — jede Liste wird
  // einzeln geprüft, eine schrumpfende reicht zur Ablehnung.
  const { ok, next, verloren } = await updateGeschuetztListen<FinanzplanFile>(
    'finanzplan', sauber, ['firmen', 'rechnungen', 'zahlungen', 'merkposten', 'produkte'],
  );
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: `Abgelehnt: das hätte über die Hälfte von ${verloren} gelöscht.` },
      { status: 409 },
    );
  }
  await insRegister(neueStaende, zugang.person);
  return NextResponse.json({ ok: true, ...next });
}

/**
 * Konten-Register (08.10.): ein Kontostand, der über diesen bisherigen Weg kommt (ältere Fenster, Skripte), landet zusätzlich im Register —
 * aber nur für Gesellschaften, die das Register schon führt (sonst bleibt der Finanzplan die Quelle; übernommen wird nur per Klick).
 */
async function insRegister(neu: { id: string; kontostand: number }[], person: string): Promise<void> {
  for (const n of neu) await kontostandAusAltweg({ firma: n.id, betrag: n.kontostand, datum: localDay(), person, herkunft: 'liquiditaet' });
}

/**
 * Einzelne Einträge ändern statt der ganzen Datei.
 *
 * Zwei-Fenster-Fundament: Malin pflegt Rechnungen, Kevin lässt nebenher einen
 * Beleg von ZOE buchen — vorher schrieb jeder Weg den KOMPLETTEN Finanzplan
 * zurück und überschrieb still die Arbeit des anderen. Jetzt geht nur der eine
 * geänderte Eintrag raus, und zwar in der benannten Liste.
 *
 * Format: { ops: [{ liste: 'rechnungen', op: 'upsert', eintrag: {…}, stand? }, { liste, op: 'delete', id, stand? }, … ] }
 * `stand` (oder `eintrag.fassung`) = die Fassung, die der Browser vom GET kannte (28.09., #107):
 * passt sie nicht mehr → 409 mit `konflikte[]` (aktueller Eintrag) und dem ganzen `stand`.
 * Rechnungen ab „gestellt“: löschen oder Betrag/Nummer/Datum ändern → 409, stattdessen
 * `{ aktion: 'storno', rechnungId, grund, am?, stand? }`.
 */
export async function PATCH(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  const zugang = await privatFinanzZugang(req);
  if (!zugang) return keinFinanzZugang();
  let body: { ops?: unknown; felder?: Record<string, unknown>; aktion?: unknown; rechnungId?: unknown; am?: unknown; stand?: unknown; grund?: unknown };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (body.aktion === 'bezahlt') return bezahlt(body);
  if (body.aktion === 'storno') return storno(body, req, zugang);
  if (body.aktion !== undefined) return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 });
  // Zu viele Änderungen auf einmal: ablehnen statt still nur die ersten 100 zu nehmen (28.09.).
  if (Array.isArray(body.ops) && body.ops.length > MAX_OPS) {
    return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_OPS} Änderungen je Aufruf (geschickt: ${body.ops.length}).` }, { status: 413 });
  }
  const roh = Array.isArray(body.ops) ? body.ops : (body.felder ? [] : null);
  if (!roh) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });
  // Zu zweit (24.09.): Einzelfelder außerhalb der Listen — derzeit nur das Uhrwerk.
  const uhrwerk = body.felder && typeof body.felder.uhrwerk === 'object' && body.felder.uhrwerk ? body.felder.uhrwerk : null;

  const ops = fpOpsLesen(roh as unknown[]);
  if (!ops.length && !uhrwerk) return NextResponse.json({ ok: false, error: 'Keine gültigen Änderungen.' }, { status: 400 });

  let angewandt = 0;
  let grenze: string | null = null;
  let neueStaende: { id: string; kontostand: number }[] = [];
  let abgelehnt: Extract<FpErgebnis, { ok: false }> | null = null;
  const next = await updateJson<FinanzplanFile>('finanzplan', current => {
    // Immer vom gesäuberten Bestand ausgehen — nie vom Rohzustand. Die Säuberung kürzt nichts (28.09.).
    // Stand-Prüfung, Rechnungs-Schutz und Änderung in DERSELBEN Sperre (lib/finanzen/finanzplan-bestand.ts).
    const e = fpOpsAnwenden(sauberFile(current), ops);
    if (!e.ok) { abgelehnt = e; return current ?? sauberFile(current); }
    // Erste Rechnung aus einem UG-Mandat in einem Plan ohne UG-Konto → leeres UG-Konto dazu (28.09., additiv).
    const f = ugFirmaNachziehen(e.datei);
    angewandt = e.angewandt;
    if (uhrwerk) { f.uhrwerk = sauberFile({ uhrwerk } as unknown as Partial<FinanzplanFile>).uhrwerk; angewandt++; }
    // Kontostand-Änderung stempelt das Stand-Datum, wie beim Vollschreiben.
    const alt = sauberFile(current);
    neueStaende = [];
    for (const fa of f.firmen) {
      const vorher = alt.firmen.find(x => x.id === fa.id);
      if (fa.kontostand !== null && fa.kontostand !== (vorher?.kontostand ?? null)) { fa.stand = localDay(); neueStaende.push({ id: fa.id, kontostand: fa.kontostand }); }
    }
    // Über der Grenze: ablehnen, den Bestand unverändert lassen (in der Sperre geprüft).
    grenze = ueberGrenze(f, alt);
    if (grenze) { angewandt = 0; return current ?? alt; }
    return f;
  });

  const nein = abgelehnt as Extract<FpErgebnis, { ok: false }> | null;
  if (nein) {
    const aktuell = mitFassung(sauberFile(next));
    return NextResponse.json({ ok: false, error: nein.fehler, ...(nein.konflikte ? { konflikte: nein.konflikte } : {}), ...aktuell, stand: aktuell }, { status: nein.status });
  }
  if (grenze) return NextResponse.json({ ok: false, error: grenze }, { status: istGrenzFehler(grenze) ? 413 : 400 });
  await insRegister(neueStaende, zugang.person);
  const stand = mitFassung(sauberFile(next));
  return NextResponse.json({ ok: true, angewandt, ...stand, stand });
}

/** Höchstzahl Einzeländerungen je PATCH — darüber 413 statt still abschneiden. */
const MAX_OPS = 1000;

/** Nichts schreiben: bricht updateJsonAsync ab, ohne dass der Bestand angefasst wird. */
class KeinSchreiben extends Error {}

/**
 * `PATCH { aktion: 'bezahlt', rechnungId, am?, stand? }` (28.09.): Status + `bezahltAm`
 * setzen UND die Buchung `bu-re-<id>` anlegen — in EINER Sperre über dem Finanzplan,
 * die Buchung zuerst (idempotent: gibt es sie schon, bleibt sie, wie sie ist). Schlägt
 * die Buchung fehl, bleibt die Rechnung unverändert; ein Wiederholen heilt alles.
 */
async function bezahlt(body: { rechnungId?: unknown; am?: unknown; stand?: unknown }) {
  const id = typeof body.rechnungId === 'string' ? body.rechnungId.slice(0, 40) : '';
  if (!id) return NextResponse.json({ ok: false, error: 'rechnungId fehlt.' }, { status: 400 });
  const am = typeof body.am === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.am) ? body.am : localDay();
  const stand = typeof body.stand === 'string' && body.stand ? body.stand : undefined;
  let erg: BezahltErgebnis | null = null;
  let gebucht: 'neu' | 'vorhanden' | 'verknuepft' | null = null;
  try {
    await updateJsonAsync<FinanzplanFile>('finanzplan', async current => {
      if (!current) { erg = { ok: false, status: 404, fehler: 'Noch kein Finanzplan angelegt.' }; throw new KeinSchreiben(); }
      const e = bezahltAnwenden(sauberFile(current), id, am, stand);
      erg = e;
      if (!e.ok) throw new KeinSchreiben();
      // Steht der Zahlungseingang schon aus dem Kontoauszug da, wird er verknüpft statt verdoppelt (09.10., lib/finanzen/zahlung-abgleich.ts).
      if (e.buchung) gebucht = await buchungAnlegen(e.buchung, { ...(e.rechnung.nummer ? { nummer: e.rechnung.nummer } : {}) });
      return e.schonBezahlt ? current : e.datei;
    });
  } catch (err) {
    if (!(err instanceof KeinSchreiben)) {
      console.error('[finanzplan] bezahlt fehlgeschlagen', err);
      return NextResponse.json({ ok: false, error: 'Nicht gespeichert — Rechnung und Buchung sind unverändert. Bitte noch einmal.' }, { status: 500 });
    }
  }
  const e = erg as BezahltErgebnis | null;
  if (!e) return NextResponse.json({ ok: false, error: 'Nicht gespeichert.' }, { status: 500 });
  const stand2 = mitFassung(sauberFile(await loadJson<FinanzplanFile>('finanzplan')));
  if (!e.ok) return NextResponse.json({ ok: false, error: e.fehler, ...(e.aktuell ? { aktuell: { ...e.aktuell, fassung: fassung(e.aktuell) } } : {}), ...stand2, stand: stand2 }, { status: e.status });
  return NextResponse.json({ ok: true, rechnung: e.rechnung, schonBezahlt: e.schonBezahlt, buchung: e.buchung ? { id: e.buchung.id, gebucht } : null, ...stand2, stand: stand2 });
}

/**
 * `PATCH { aktion: 'storno', rechnungId, grund, am?, stand? }` (28.09., K3): Rechnung ab „gestellt“
 * auf `storniert` setzen (Datum + Grund), der Eintrag bleibt. Gibt es schon den Zahlungseingang
 * `bu-re-<id>`, kommt in derselben Sperre die Gegenbuchung `bu-st-<id>` dazu (idempotent) — kein
 * verwaister Ist-Eingang. Schlägt die Buchung fehl, bleibt die Rechnung unverändert.
 */
async function storno(body: { rechnungId?: unknown; am?: unknown; stand?: unknown; grund?: unknown }, req: Request, zugang: { person: string; haushalt: string }) {
  const id = typeof body.rechnungId === 'string' ? body.rechnungId.slice(0, 40) : '';
  if (!id) return NextResponse.json({ ok: false, error: 'rechnungId fehlt.' }, { status: 400 });
  const am = typeof body.am === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.am) ? body.am : localDay();
  const stand = typeof body.stand === 'string' && body.stand ? body.stand : undefined;
  const grund = typeof body.grund === 'string' ? body.grund : '';
  // Rechnung mit PDF (08.10.): Storno = Stornorechnung mit eigener Nummer und eigenem PDF (lib/finanzen/rechnung/server.ts).
  // Nur von Hand — der Dienstweg storniert keine festgeschriebene Rechnung (403). Altbestand ohne PDF: wie bisher unten.
  const vorher = sauberFile(await loadJson<FinanzplanFile>('finanzplan')).rechnungen.find(r => r.id === id);
  if (vorher?.pdfDateiId && vorher.art !== 'storno') {
    if (istDienst(req)) return NextResponse.json({ ok: false, error: 'Eine Rechnung mit PDF storniert nur ein Mensch (nicht der Dienstweg).' }, { status: 403 });
    const { rechnungStornieren, RechnungFehler } = await import('@/lib/finanzen/rechnung/server');
    try {
      const e = await rechnungStornieren({ id, grund, ...(stand ? { stand } : {}), person: zugang.person, haushalt: zugang.haushalt, sicht: 'privat', wer: werAus(req) });
      const stand2 = mitFassung(sauberFile(await loadJson<FinanzplanFile>('finanzplan')));
      return NextResponse.json({ ok: true, rechnung: e.original, stornoRechnung: e.storno, schonStorniert: e.schonStorniert, gegenbuchung: e.gegenbuchung, ...stand2, stand: stand2 });
    } catch (err) {
      if (err instanceof RechnungFehler) {
        const stand2 = mitFassung(sauberFile(await loadJson<FinanzplanFile>('finanzplan')));
        return NextResponse.json({ ok: false, error: err.message, ...err.extra, ...stand2, stand: stand2 }, { status: err.status });
      }
      console.error('[finanzplan] Stornorechnung fehlgeschlagen', err);
      return NextResponse.json({ ok: false, error: 'Nicht storniert — die Rechnung ist unverändert. Bitte noch einmal.' }, { status: 500 });
    }
  }
  let erg: StornoErgebnis | null = null;
  let gegen: 'neu' | 'vorhanden' | 'keine' = 'keine';
  try {
    await updateJsonAsync<FinanzplanFile>('finanzplan', async current => {
      if (!current) { erg = { ok: false, status: 404, fehler: 'Noch kein Finanzplan angelegt.' }; throw new KeinSchreiben(); }
      const e = stornoAnwenden(sauberFile(current), id, am, grund, stand);
      erg = e;
      if (!e.ok) throw new KeinSchreiben();
      gegen = await gegenbuchungAnlegen(e.rechnung, e.rechnung.storniertAm ?? am);
      return e.schonStorniert ? current : e.datei;
    });
  } catch (err) {
    if (!(err instanceof KeinSchreiben)) {
      console.error('[finanzplan] storno fehlgeschlagen', err);
      return NextResponse.json({ ok: false, error: 'Nicht gespeichert — Rechnung und Buchungen sind unverändert. Bitte noch einmal.' }, { status: 500 });
    }
  }
  const e = erg as StornoErgebnis | null;
  if (!e) return NextResponse.json({ ok: false, error: 'Nicht gespeichert.' }, { status: 500 });
  const stand2 = mitFassung(sauberFile(await loadJson<FinanzplanFile>('finanzplan')));
  if (!e.ok) return NextResponse.json({ ok: false, error: e.fehler, ...(e.aktuell ? { aktuell: { ...e.aktuell, fassung: fassung(e.aktuell) } } : {}), ...stand2, stand: stand2 }, { status: e.status });
  return NextResponse.json({ ok: true, rechnung: e.rechnung, schonStorniert: e.schonStorniert, gegenbuchung: gegen, ...stand2, stand: stand2 });
}
