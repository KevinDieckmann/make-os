// ─── MAKE OS — Bank-Buchungen ───────────────────────────────────────────────
// Was auf den Konten wirklich passiert ist. Kommt aus dem Finanz-Dashboard,
// das Kevin und Malin gebaut haben — hier liegt es als eigener Bestand, damit
// das System damit rechnen kann statt nur anzuzeigen.

// 02.11. (Buchhaltung): Business-Konten (`finanzRecht: 'business'`) sehen und ändern die Buchungen der Business-Gesellschaften — serverseitig
// gefiltert, nie eine private (Wächter tests/buchhaltung-route.test.ts). Einzelne Felder ändern = Op `teil` mit Stand (lib/finanzen/buchhaltung/teil.ts).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { privatFinanzZugang, keinFinanzZugang, planZugangVon } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetzt, updateJson } from '@/lib/store/local-db';
import { imHaushaltDesInhabers, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { FINANZ_ORT_IDS, finanzOrtAus, istBusinessGesellschaft, type FinanzOrt } from '@/lib/einheiten';
import { wirksameSicht } from '@/lib/finanzen/plan/sicht';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliere, werAusKoepfen, type Aenderung } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { bauPruefen } from '@/lib/bau/pruefen';
import { teilAnwenden, type RechnungKurz } from '@/lib/finanzen/buchhaltung/teil';
import type { BhBuchung, Zuordnen } from '@/lib/finanzen/buchhaltung/arbeitsliste';
import { belegHinweisSauber, bewirtungSauber, pruefungLesen, type BelegHinweis, type Bewirtung, type Pruefung } from '@/lib/finanzen/buchhaltung/pruefung';

import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Business-Zahlen gehören zum Haushalt des Inhabers — wie der Business-Index (26.09.).
const KEIN_HAUSHALT = { ok: false, error: 'Kein Zugang zu den Business-Zahlen — sie gehören zum Haushalt des Inhabers (Einstellungen › Konto).' };

export interface Buchung {
  id: string;
  /** YYYY-MM-DD */
  datum: string;
  /** Wer — Empfänger oder Absender. */
  wer: string;
  /** Betrag in Euro; positiv = Eingang, negativ = Ausgang. */
  betrag: number;
  kategorie: string;
  /** Verwendungszweck, gekürzt. */
  zweck?: string;
  konto?: string;
  /**
   * Wo die Buchung hingehört. Kevins Ansage: „Privat bleibt immer privat, die
   * beiden Firmen kann man auch mal zusammenfassen." Genau dafür.
   * Seit 28.09. die eine Einheitenliste (lib/einheiten.ts): privat · kdc · kdv · ug.
   */
  ort?: FinanzOrt;
  /** Die Rechnung, deren Zahlungseingang diese Buchung ist (26.09.). */
  rechnungId?: string;
  /** Lauf des Kontoauszug-Imports, der sie angelegt hat (09.10., `ka-…`) — nur für „Rückgängig“ (lib/finanzen/kontoauszug). */
  auszug?: string;
  /** Ein übernommener Beleg ist diesem Bank-Umsatz zugeordnet (09.10., `b-…`, lib/finanzen/zahlung-abgleich.ts). */
  beleg?: string;
  /** 02.11. (Buchhaltung, alle optional): Notiz, Mandat, Kategorie von Hand, Regel-Marke, „bitte zuordnen“. */
  notiz?: string;
  mandatId?: string;
  kategorieHand?: true;
  regel?: string;
  zuordnen?: Zuordnen;
  /** 02.11. (Prüfmodus, alle optional): Prüfung (bestätigt von/am stempelt nur der Server), Bewirtung, Beleg-Hinweis. */
  pruefung?: Pruefung;
  bewirtung?: Bewirtung;
  belegHinweis?: BelegHinweis;
}

interface Datei { buchungen: Buchung[] }

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Grenzen statt Kürzen (09.10., Befund des Kontoauszug-Pakets): vorher schnitt PUT still nach 5.000 Buchungen ab und PATCH nach
 * 200 Änderungen — mit Kontoauszügen wächst der Bestand, und „nie kürzen, ablehnen“ gilt auch hier. Darüber → 413 mit Satz.
 */
const BUCHUNGEN_MAX = 50_000;
const BUCHUNGEN_OPS_MAX = 200;

function sauber(b: Partial<Buchung>, _i: number): Buchung | null {
  const wer = String(b.wer ?? '').trim().slice(0, 120);
  // Auf den Cent (28.09., K3) — vorher auf ganze Euro: aus 1.190,50 € wurden 1.191 €.
  const betrag = Math.round(Number(b.betrag) * 100) / 100;
  if (!wer || !Number.isFinite(betrag)) return null;
  return {
    id: String(b.id ?? '').slice(0, 40) || neueKennung('bu'),
    datum: typeof b.datum === 'string' && DATUM.test(b.datum) ? b.datum : localDay(),
    wer,
    betrag,
    kategorie: String(b.kategorie ?? 'Sonstiges').trim().slice(0, 60) || 'Sonstiges',
    zweck: b.zweck ? String(b.zweck).slice(0, 200) : undefined,
    konto: b.konto ? String(b.konto).slice(0, 60) : undefined,
    // Ohne Angabe: privat — die Altbestände kommen alle vom Privatkonto. Bekannte Kennungen und
    // Altwerte (z. B. „Selbstständigkeit“) über die eine Liste; vorher fiel „ug“ still auf privat.
    ort: FINANZ_ORT_IDS.includes(b.ort as FinanzOrt) ? b.ort : finanzOrtAus(b.ort) ?? 'privat',
    ...(b.rechnungId ? { rechnungId: String(b.rechnungId).slice(0, 40) } : {}),
    ...(b.auszug ? { auszug: String(b.auszug).slice(0, 60) } : {}),
    ...(b.beleg ? { beleg: String(b.beleg).slice(0, 60) } : {}),
    // 02.11.: die neuen Felder bleiben erhalten (sonst fielen sie beim nächsten Upsert weg) — nur in ihrer Form.
    ...(typeof b.notiz === 'string' && b.notiz.trim() ? { notiz: b.notiz.trim().slice(0, 1000) } : {}),
    ...(typeof b.mandatId === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(b.mandatId) ? { mandatId: b.mandatId } : {}),
    ...(b.kategorieHand === true ? { kategorieHand: true as const } : {}),
    ...(typeof b.regel === 'string' && /^br-[a-z0-9-]{1,60}$/.test(b.regel) ? { regel: b.regel } : {}),
    ...(b.zuordnen === 'gesellschafter' || b.zuordnen === 'verrechnung' ? { zuordnen: b.zuordnen } : {}),
    ...feldWenn('pruefung', pruefungLesen(b.pruefung)),
    ...feldWenn('bewirtung', (r => (r.ok ? r.wert : undefined))(bewirtungSauber(b.bewirtung))),
    ...feldWenn('belegHinweis', (r => (r.ok ? r.wert : undefined))(belegHinweisSauber(b.belegHinweis))),
  };
}
const feldWenn = <K extends string, T>(k: K, v: T | undefined): Partial<Record<K, T>> => (v === undefined ? {} : ({ [k]: v } as Record<K, T>));
/** Die Prüfung gehört dem Server (bestätigt von/am): ein Upsert aus dem Browser behält die gespeicherte bzw. bringt keine mit. */
function pruefungVomServer(neu: Buchung, alt: Buchung | undefined): Buchung {
  const { pruefung: _p, ...rest } = neu;
  return alt?.pruefung ? { ...rest, pruefung: alt.pruefung } : rest;
}

type Sicht = 'privat' | 'business';
/** Zugang: Konto mit Haushalt (Sicht aus dem Konto) UND Haushalt des Inhabers — die Buchungen liegen nicht je Haushalt getrennt. */
async function zugang(req: Request): Promise<{ person: string; sicht: Sicht } | null> {
  const z = await planZugangVon(req);
  if (!z || z.haushalt !== (await haushaltDesInhabers())) return null;
  return { person: z.person, sicht: wirksameSicht(z.sicht, new URL(req.url).searchParams.get('sicht')) };
}
/** Die EINE Filterstelle: die Business-Sicht bekommt nur Buchungen der Business-Gesellschaften. */
const sichtbarFuer = (b: Pick<Buchung, 'ort'>, sicht: Sicht): boolean => sicht === 'privat' || istBusinessGesellschaft(b.ort);
const mitStandZeile = (b: Buchung) => ({ ...b, stand: fingerabdruck(b as unknown as Record<string, unknown>) });

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  const f = await loadJson<Datei>('buchungen');
  const buchungen = (Array.isArray(f?.buchungen) ? f.buchungen : []).filter(b => sichtbarFuer(b, z.sicht)).map(mitStandZeile);
  leseZugriff(req, 'konten', { anzahl: buchungen.length });
  return NextResponse.json({ buchungen, anzahl: buchungen.length, sicht: z.sicht });
}

export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  if (!(await privatFinanzZugang(req))) return keinFinanzZugang();
  let body: Partial<Datei>;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.buchungen)) return NextResponse.json({ ok: false, error: 'buchungen fehlt.' }, { status: 400 });
  if (body.buchungen.length > BUCHUNGEN_MAX) {
    return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${BUCHUNGEN_MAX.toLocaleString('de-DE')} Buchungen (jetzt ${body.buchungen.length.toLocaleString('de-DE')}). Gekürzt wird nie — nichts gespeichert.` }, { status: 413 });
  }

  const buchungen = body.buchungen.map(sauber).filter((x): x is Buchung => !!x)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  const { ok, next } = await updateGeschuetzt<Datei>('buchungen', { buchungen }, d => d.buchungen?.length ?? 0);
  if (!ok) return NextResponse.json({ ok: false, error: 'Abgelehnt: das hätte über die Hälfte der Buchungen gelöscht.' }, { status: 409 });
  return NextResponse.json({ ok: true, anzahl: next.buchungen.length });
}

/**
 * Einzelne Buchungen ändern statt der ganzen Liste.
 *
 * Das Zwei-Fenster-Fundament für die Finanzen: Malin führt die Buchhaltung,
 * Kevin bucht nebenher Belege über ZOE — vorher schrieb jeder Weg ALLE
 * Buchungen zurück, und wer zuletzt speicherte, löschte still die Erfassung
 * des anderen. Jetzt geht nur noch raus, was ein Fenster selbst geändert hat.
 */
export async function PATCH(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_HAUSHALT, { status: 403 });
  const bau = bauPruefen(req);
  if (bau) return bau;
  let body: { ops?: unknown };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const roh = Array.isArray(body.ops) ? body.ops : null;
  if (!roh) return NextResponse.json({ ok: false, error: 'Feld "ops" (Liste) fehlt.' }, { status: 400 });
  if (roh.length > BUCHUNGEN_OPS_MAX) {
    return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${BUCHUNGEN_OPS_MAX} Änderungen je Aufruf (jetzt ${roh.length}). Gekürzt wird nie — nichts gespeichert.` }, { status: 413 });
  }

  interface Op { op: 'upsert' | 'delete' | 'teil'; buchung?: Buchung; id?: string; stand?: string; felder?: unknown }
  const ops: Op[] = [];
  const liste = roh as Record<string, unknown>[];
  for (let i = 0; i < liste.length; i++) {
    const o = liste[i];
    if (o?.op === 'delete' && typeof o.id === 'string') ops.push({ op: 'delete', id: o.id });
    else if (o?.op === 'teil') {
      // Einzelne Felder (02.11.): nur mit Stand — sonst überschriebe ein altes Fenster still die Arbeit des anderen.
      if (typeof o.id !== 'string' || typeof o.stand !== 'string') return NextResponse.json({ ok: false, error: 'Änderung ohne Kennung oder Stand — bitte neu laden. Nichts gespeichert.' }, { status: 400 });
      ops.push({ op: 'teil', id: o.id, stand: o.stand, felder: o.felder });
    } else if (o?.op === 'upsert' && o.buchung) {
      const s = sauber(o.buchung as Partial<Buchung>, i);
      if (s) ops.push({ op: 'upsert', buchung: s });
    }
  }
  if (!ops.length) return NextResponse.json({ ok: false, error: 'Keine gültigen Änderungen.' }, { status: 400 });

  // Sicherung gegen Massenlöschung: auch über Einzel-Änderungen darf nicht die
  // halbe Buchhaltung verschwinden.
  const vorher = await loadJson<Datei>('buchungen');
  const bestand = Array.isArray(vorher?.buchungen) ? vorher.buchungen.length : 0;
  const loeschungen = ops.filter(o => o.op === 'delete').length;
  if (bestand >= 10 && loeschungen > bestand / 2) {
    return NextResponse.json({ ok: false, error: 'Abgelehnt: das hätte über die Hälfte der Buchungen gelöscht.' }, { status: 409 });
  }
  // Rechnungen (nur Kennung, Gesellschaft, Mandat) für „nur Rechnungen derselben Gesellschaft“.
  const rechnungen: RechnungKurz[] = ops.some(o => o.op === 'teil')
    ? ((await loadJson<{ rechnungen?: RechnungKurz[] }>('finanzplan'))?.rechnungen ?? []).filter(r => r && typeof r.id === 'string').map(r => ({ id: r.id, firmaId: r.firmaId, mandatId: r.mandatId }))
    : [];

  const jetzt = new Date().toISOString();
  let angewandt = 0;
  let fehler: { status: number; body: Record<string, unknown> } | null = null;
  const protokoll: Aenderung[] = [];
  const geaendert: Buchung[] = [];
  const next = await updateJson<Datei>('buchungen', current => {
    const liste = Array.isArray(current?.buchungen) ? current!.buchungen : [];
    const nachId = new Map(liste.map(b => [b.id, b]));
    const konflikte: { id: string; aktuell: unknown }[] = [];
    for (const o of ops) {
      if (fehler) break;
      if (o.op === 'delete') {
        const alt = nachId.get(o.id!);
        if (alt && !sichtbarFuer(alt, z.sicht)) { fehler = { status: 403, body: { ok: false, error: 'Nicht erlaubt: aus dem Business-Bereich nur Buchungen der Business-Gesellschaften — nichts gespeichert.' } }; break; }
        if (nachId.delete(o.id!)) { angewandt++; protokoll.push({ liste: 'buchungen', op: 'geloescht', id: o.id! }); }
      } else if (o.op === 'upsert') {
        const alt = nachId.get(o.buchung!.id);
        if ((alt && !sichtbarFuer(alt, z.sicht)) || !sichtbarFuer(o.buchung!, z.sicht)) { fehler = { status: 403, body: { ok: false, error: 'Nicht erlaubt: aus dem Business-Bereich nur Buchungen der Business-Gesellschaften — nichts gespeichert.' } }; break; }
        nachId.set(o.buchung!.id, pruefungVomServer(o.buchung!, alt)); angewandt++;
        protokoll.push({ liste: 'buchungen', op: alt ? 'geaendert' : 'neu', id: o.buchung!.id });
      } else {
        const alt = nachId.get(o.id!);
        if (!alt || !sichtbarFuer(alt, z.sicht)) { fehler = { status: 404, body: { ok: false, error: 'Die Buchung gibt es nicht (mehr) — bitte neu laden. Nichts gespeichert.' } }; break; }
        if (fingerabdruck(alt as unknown as Record<string, unknown>) !== o.stand) { konflikte.push({ id: alt.id, aktuell: mitStandZeile(alt) }); continue; }
        const r = teilAnwenden(alt as BhBuchung, o.felder, { alle: Array.from(nachId.values()) as BhBuchung[], rechnungen, sicht: z.sicht, wer: z.person, jetzt });
        if (!r.ok) { fehler = { status: r.status, body: { ok: false, error: r.fehler, id: alt.id } }; break; }
        const neu = sauber(r.neu as Partial<Buchung>, 0)!;
        nachId.set(alt.id, neu); angewandt++; geaendert.push(neu);
        protokoll.push({ liste: 'buchungen', op: 'geaendert', id: alt.id, felder: r.felder });
      }
    }
    if (!fehler && konflikte.length) fehler = { status: 409, body: { ok: false, error: 'Inzwischen hat jemand diese Buchung geändert — die aktuelle Fassung ist geladen. Nichts gespeichert.', konflikte } };
    // Alles oder nichts: bei einem Fehler bleibt der Bestand unverändert (updateJson schreibt dann nicht).
    if (fehler) return current ?? { buchungen: [] };
    return { buchungen: Array.from(nachId.values()).sort((a, b) => b.datum.localeCompare(a.datum)) };
  });
  if (fehler) { const f = fehler as { status: number; body: Record<string, unknown> }; return NextResponse.json(f.body, { status: f.status }); }
  await protokolliere('buchungen', protokoll, werAusKoepfen(req.headers));
  return NextResponse.json({ ok: true, angewandt, anzahl: next.buchungen.length, zeilen: geaendert.map(mitStandZeile) });
}
