// ─── MAKE OS — Routinen (lokal) ─────────────────────────────────────────────
// DIE Quelle für positive Routinen — Gesundheit, Leben, Business. Der
// Routine-Planer pflegt sie, und alles andere greift darauf zu: der
// Wochenplaner (Leiste + ZOE-Vorschlag), die Tagesplanung, das
// Gesundheits-Cockpit (Häkchen), das Home-Widget „Routinen heute“ und der
// MAKE Score (Routinen-Quote). Bis 08.10. bekam ein leerer Bestand beim ersten Lesen Startroutinen — das waren die
// Routinen einer echten Person (lib/make-one/health-data.ts, entfernt; Fragebogen Teil 3: „nichts Persönliches fest
// einbauen“). Seitdem startet eine leere Instanz ohne Routinen, und der GET liest nur noch. Vorhandene Bestände bleiben,
// wie sie sind; die Demo-Instanz legt erfundene Beispiele über den PATCH an (lib/demo/saat.ts).
//
// Seit 27.09. (Malins Rückmeldung) trägt eine Routine zusätzlich `space`
// (privat/business), `owner` (Person oder „beide“), `rhythmus` + `naechstesMal`
// und `rang` — alles additiv, gesäubert in lib/planung/routinen.ts. Im selben
// Bestand liegen die `bloecke`: die Wochenvorlage je Person (wann Privat, wann
// Arbeit). GET liefert beides (jede Zeile mit `stand`); PATCH { ops } ändert
// einzelne Routinen, PATCH { bloecke: ops } einzelne Blöcke — nur die eigenen
// der angemeldeten Person (28.09.). PUT { routinen } bleibt als Vollschreiben
// (Schrumpf-Schutz in der Sperre); PUT { bloecke } ist abgeschaltet, weil er die
// Blöcke BEIDER Personen ersetzte.
//
// 08.10. (Kevin): Routinen der ANDEREN Person sieht die angemeldete Person nur als „Belegt“ — jede Antwort geht durch
// `routinenFuerBetrachter` (lib/planung/routinen.ts, EINE Filterstelle); Systemläufe ohne Person bekommen den Bestand wie
// bisher. Schreiben auf fremde Routinen → 403 (`routinenSchreibPruefen`, PUT: `routinenVollSchreiben`).
// Ebenso die Blöcke der Wochenvorlage (08.10. nachmittags): fremde nur „Belegt“ (`bloeckeFuerBetrachter` — Zeiten, Tag, art bleiben,
// Titel fällt weg); Schreiben auf fremde Blöcke war schon 403 (`nurEigene`).
//
// 09.10. (E4-Rest, Kevin: „Ja, Privates bleibt privat“): ein Konto „nur Business“ (Konto-Sicht, lib/zugang/konto-sicht.ts) bekommt Routinen
// und Blöcke des Privat-Bereichs gar nicht — weder voll noch als „Belegt“ (lib/planung/bereich-sicht.ts: Bereich über `spaceVonRoutine`
// bzw. `wirksamerSpace`, die Selbstständigkeit ist Privat), in JEDER Antwort samt 409. Schreiben auf Vorhandenes im Privat-Bereich → 404,
// Neues/Verschobenes dorthin → 403; der Altweg PUT behält die ausgeblendeten Routinen in ihrer gespeicherten Fassung.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { listePatchen, opsLesen, opsFehler, type ListenOp, type PatchErgebnis } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { sauberRoutine, sauberBlock, sichtbarFuer, routinenFuerBetrachter, bloeckeFuerBetrachter, routinenSchreibPruefen, routinenVollSchreiben, ROUTINE_FREMD } from '@/lib/planung/routinen';
import type { Block, Routine, RoutinenDatei } from '@/lib/planung/typen';
import { privatAusgeblendetFuer } from '@/lib/zugang/konto-sicht-server';
import { routinenOhnePrivat, bloeckeOhnePrivat, routineImPrivat, blockImPrivat, privatSchreibPruefen, privatBehalten, privatStatus, konflikteOhnePrivat } from '@/lib/planung/bereich-sicht';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type { Routine, Block };

const bloeckeVon = (f: RoutinenDatei | null | undefined): Block[] => (Array.isArray(f?.bloecke) ? f!.bloecke : []);

/**
 * Jede Antwort mit Routinen geht hier durch: für eine Person die fremden nur verdeckt („Belegt“) — der Stand je Zeile wird
 * aus der verdeckten Fassung gerechnet, verrät also nichts und passt nie auf die echte Zeile. `betrachter` null = Systemlauf.
 * `ohnePrivat` (Konto „nur Business“, 09.10.): der Privat-Bereich fällt VOR dem Verdecken ganz weg — auch kein „Belegt“.
 */
const antwort = (f: RoutinenDatei | null | undefined, betrachter: string | null, ohnePrivat = false) => {
  const routinen = Array.isArray(f?.routinen) ? f!.routinen : [];
  const bloecke = bloeckeVon(f);
  return {
    routinen: mitStand(routinenFuerBetrachter(ohnePrivat ? routinenOhnePrivat(routinen) : routinen, betrachter)),
    bloecke: mitStand(bloeckeFuerBetrachter(ohnePrivat ? bloeckeOhnePrivat(bloecke) : bloecke, betrachter)),
  };
};

/** Konto „nur Business“? Systemlauf ohne Person → nein. Konten unlesbar → ja (nie auf Verdacht zeigen, fail-closed). */
const ohnePrivatFuer = (person: string | null) => privatAusgeblendetFuer(person).catch(() => true);

/**
 * GET: der ganze gemeinsame Bestand (Routinen-Planer — Besitz je Zeile sichtbar). `?sicht=ich` (Praxis-Fund 04.10.): nur die
 * Routinen der angemeldeten Person und die gemeinsamen (`sichtbarFuer`) — für alle persönlichen Zählungen (Tagesplan,
 * Ritual, Energie, Planen, Journal). Ohne Person bei `sicht=ich`: nur die gemeinsamen.
 */
export async function GET(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt(); // lesen auch der Systemlauf (Takt, ZOE)
  // Leerer Bestand = keine Routinen (seit 08.10. keine Startroutinen mehr — Lesen schreibt nicht).
  const f: RoutinenDatei = (await loadJson<RoutinenDatei>('routinen')) ?? { routinen: [] };
  const ich = personStreng(req);
  const ohnePrivat = await ohnePrivatFuer(ich);
  if (new URL(req.url).searchParams.get('sicht') === 'ich') {
    return NextResponse.json(antwort({ ...f, routinen: sichtbarFuer(Array.isArray(f.routinen) ? f.routinen : [], ich ?? '') }, ich ?? '', ohnePrivat));
  }
  // Ohne Person (Takt, ZOE-Hintergrund) wie bisher der ganze Bestand; mit Person fremde nur als „Belegt“.
  return NextResponse.json(antwort(f, ich, ohnePrivat));
}

/** Höchstzahlen — darüber wird abgelehnt, nie gekürzt (28.09.). */
const MAX_ROUTINEN = 200;
const MAX_BLOECKE = 500;

export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  let body: { routinen?: unknown; bloecke?: unknown };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  if (body.bloecke !== undefined) {
    return NextResponse.json({ ok: false, error: 'Blöcke bitte einzeln ändern (PATCH { bloecke: ops }) — Seite neu laden.' }, { status: 409 });
  }
  if (!Array.isArray(body.routinen)) return NextResponse.json({ ok: false, error: 'routinen fehlt.' }, { status: 400 });
  if (body.routinen.length > MAX_ROUTINEN) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_ROUTINEN} Routinen.` }, { status: 413 });
  const sauber = body.routinen.map(sauberRoutine).filter((r): r is Routine => !!r);
  const ich = personStreng(req) ?? '';
  const ohnePrivat = await ohnePrivatFuer(personStreng(req));
  // Lesen, prüfen und schreiben in EINER Sperre (28.09.) — vorher las die Route den Bestand davor
  // und schrieb ihn mit zurück: was dazwischen an Blöcken geändert wurde, war weg.
  // Fremde Routinen (08.10.): bleiben in ihrer gespeicherten Fassung — die verdeckte Fassung aus dem Browser überschreibt nie.
  // Konto „nur Business“ (09.10.): die Routinen des Privat-Bereichs kennt es nicht — sie bleiben ebenso stehen (`privatBehalten`).
  let abgelehnt = false;
  let fremd = false;
  let privatFehler: string | null = null;
  const next = await updateJson<RoutinenDatei>('routinen', cur => {
    const altListe = Array.isArray(cur?.routinen) ? cur!.routinen : [];
    const p = ohnePrivat ? privatBehalten(altListe, sauber, routineImPrivat) : { liste: sauber };
    if ('fehler' in p) { privatFehler = p.fehler; return cur as RoutinenDatei; }
    const r = routinenVollSchreiben(altListe, p.liste, ich);
    if ('fremd' in r) { fremd = true; return cur as RoutinenDatei; }
    const alt = altListe.length;
    if (alt >= 4 && r.liste.length < alt / 2) { abgelehnt = true; return cur as RoutinenDatei; }
    return { ...(cur ?? {}), routinen: r.liste };
  });
  if (privatFehler) return NextResponse.json({ ok: false, error: privatFehler }, { status: privatStatus(privatFehler) ?? 403 });
  if (fremd) return NextResponse.json({ ok: false, error: ROUTINE_FREMD }, { status: 403 });
  if (abgelehnt) return NextResponse.json({ ok: false, error: 'Abgelehnt: das hätte über die Hälfte der Routinen gelöscht.' }, { status: 409 });
  return NextResponse.json({ ok: true, ...antwort(next, ich, ohnePrivat) });
}

/**
 * Einzelne Routinen (`{ ops }`) oder Blöcke (`{ bloecke: ops }`) ändern — Zwei-Fenster-Fundament
 * mit `stand` je Änderung (veraltet → 409 mit dem aktuellen Bestand, nichts überschrieben).
 * Blöcke: nur die eigenen der angemeldeten Person — fremde anlegen, ändern oder löschen → 403.
 */
export async function PATCH(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  let body: { ops?: unknown; bloecke?: unknown };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const ich = personStreng(req);
  const ohnePrivat = await ohnePrivatFuer(ich);

  if (body.bloecke !== undefined) {
    if (!ich) return NextResponse.json({ ok: false, error: 'Blöcke gehören einer Person — ohne Anmeldung nichts zu ändern.' }, { status: 403 });
    if (Array.isArray(body.bloecke) && body.bloecke.length > MAX_BLOECKE) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_BLOECKE} Änderungen je Aufruf.` }, { status: 413 });
    const ops = opsLesen<Block>(body.bloecke, sauberBlock, MAX_BLOECKE);
    if (!ops) return NextResponse.json({ ok: false, error: Array.isArray(body.bloecke) ? opsFehler(body.bloecke, MAX_BLOECKE) : 'bloecke (Liste von Änderungen) fehlt.' }, { status: Array.isArray(body.bloecke) ? 413 : 400 });
    const r = await listePatchen<Block, RoutinenDatei & Record<string, unknown>>('routinen', 'bloecke', ops, 8, undefined, {
      // Konto „nur Business“: Blöcke des Privat-Bereichs gibt es nicht (404), neue dorthin → 403 — vor „nur eigene“ (ein fremder Privat-Block
      // existiert für dieses Konto gar nicht).
      pruefen: (liste, o) => (ohnePrivat ? privatSchreibPruefen(liste, o, blockImPrivat) : null) ?? nurEigene(liste, o, ich) ?? (wachstum(liste, o) > MAX_BLOECKE ? `Abgelehnt: höchstens ${MAX_BLOECKE} Blöcke.` : null),
    });
    return ergebnis(r, ich, 'bloecke', ohnePrivat);
  }

  if (Array.isArray(body.ops) && body.ops.length > MAX_ROUTINEN) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_ROUTINEN} Änderungen je Aufruf.` }, { status: 413 });
  const ops = opsLesen<Routine>(body.ops, sauberRoutine, MAX_ROUTINEN);
  if (!ops) return NextResponse.json({ ok: false, error: opsFehler(body.ops, MAX_ROUTINEN) }, { status: Array.isArray(body.ops) ? 413 : 400 });
  // Fremde Routinen (08.10.): weder ändern, löschen noch neu für die andere Person anlegen → 403. `teil` läuft durch denselben
  // Säuberer wie ein ganzer Eintrag (vorher legte er die Felder ungeprüft auf).
  // Konto „nur Business“ (09.10.): Routinen des Privat-Bereichs gibt es nicht (404), neue/verschobene dorthin → 403 (`teil` über denselben
  // Säuberer — eine Privat-Einheit verschiebt nach Privat).
  const r = await listePatchen<Routine, RoutinenDatei & Record<string, unknown>>('routinen', 'routinen', ops, 4, undefined, {
    pruefen: (liste, o) => (ohnePrivat ? privatSchreibPruefen(liste, o, routineImPrivat, (alt, felder) => sauberRoutine({ ...alt, ...felder })) : null)
      ?? routinenSchreibPruefen(liste, o, ich ?? '') ?? (wachstum(liste, o) > MAX_ROUTINEN ? `Abgelehnt: höchstens ${MAX_ROUTINEN} Routinen.` : null),
    teil: (alt, felder) => sauberRoutine({ ...alt, ...felder }),
  });
  return ergebnis(r, ich, 'routinen', ohnePrivat);
}

/** Länge der Liste nach den neu angelegten Einträgen. */
function wachstum<E extends { id: string }>(liste: E[], ops: ListenOp<E>[]): number {
  const ids = new Set(liste.map(e => e.id));
  const neu = new Set(ops.filter(o => o.op === 'upsert' && o.eintrag && !ids.has(o.eintrag.id)).map(o => o.eintrag!.id)).size;
  return neu ? liste.length + neu : 0;
}

const FREMD = 'Nicht erlaubt: nur die eigenen Blöcke lassen sich ändern.';

/** In der Sperre: jede Änderung betrifft nur Blöcke der Person — der neue Eintrag UND der gespeicherte. */
function nurEigene(liste: Block[], ops: ListenOp<Block>[], ich: string): string | null {
  const nachId = new Map(liste.map(b => [b.id, b]));
  for (const o of ops) {
    if (o.op === 'teil') return 'Blöcke nur ganz (upsert) oder löschen.';
    const id = o.op === 'upsert' ? o.eintrag!.id : o.id!;
    const alt = nachId.get(id);
    if (alt && alt.owner !== ich) return FREMD;
    if (o.op === 'upsert' && o.eintrag!.owner !== ich) return FREMD;
  }
  return null;
}

async function ergebnis(r: PatchErgebnis<RoutinenDatei & Record<string, unknown>>, ich: string | null, liste: 'routinen' | 'bloecke', ohnePrivat: boolean) {
  const sicht = ich ?? '';
  if (r.ok) return NextResponse.json({ ok: true, angewandt: r.angewandt, ...antwort(r.next, sicht, ohnePrivat) });
  const status = privatStatus(r.fehler) ?? (r.fehler === FREMD || r.fehler === ROUTINE_FREMD ? 403
    : r.fehler?.startsWith('Abgelehnt: höchstens') ? 413
      : r.konflikte?.length || r.fehler?.startsWith('Abgelehnt') ? 409 : 400);
  // Konflikte betreffen nur eigene/gemeinsame Zeilen (fremde scheitern vorher mit 403) — trotzdem verdeckt ausliefern; für ein Konto
  // „nur Business“ ohne Einträge des Privat-Bereichs (die scheitern vorher mit 404).
  const verdecken = (x: unknown) => (liste === 'bloecke' ? bloeckeFuerBetrachter([x as Block], sicht)[0] : routinenFuerBetrachter([x as Routine], sicht)[0]);
  const imPrivat = (x: never) => (liste === 'bloecke' ? blockImPrivat(x as Block) : routineImPrivat(x as Routine));
  const konflikte = (ohnePrivat ? konflikteOhnePrivat(r.konflikte ?? [], imPrivat) : (r.konflikte ?? [])).map(k => (k.aktuell ? { ...k, aktuell: verdecken(k.aktuell) } : k));
  return NextResponse.json({ ok: false, error: r.fehler, konflikte, ...antwort(await loadJson<RoutinenDatei>('routinen'), sicht, ohnePrivat) }, { status });
}
