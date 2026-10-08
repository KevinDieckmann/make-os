// ─── MAKE OS — Routinen (lokal) ─────────────────────────────────────────────
// DIE Quelle für positive Routinen — Gesundheit, Leben, Business. Der
// Routine-Planer pflegt sie, und alles andere greift darauf zu: der
// Wochenplaner (Leiste + ZOE-Vorschlag), die Tagesplanung, das
// Gesundheits-Cockpit (Häkchen), das Home-Widget „Routinen heute“ und der
// MAKE Score (Routinen-Quote). Erststart wird aus den bisherigen
// ROUTINE_ITEMS geseedet — gleiche ids, damit Streak und Verlauf weiterlaufen.
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

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { listePatchen, opsLesen, opsFehler, type ListenOp, type PatchErgebnis } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { ROUTINE_ITEMS } from '@/lib/make-one/health-data';
import { sauberRoutine, sauberBlock, sichtbarFuer, routinenFuerBetrachter, bloeckeFuerBetrachter, routinenSchreibPruefen, routinenVollSchreiben, ROUTINE_FREMD } from '@/lib/planung/routinen';
import type { Block, Routine, RoutinenDatei } from '@/lib/planung/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type { Routine, Block };

const seed = (): Routine[] => ROUTINE_ITEMS.map(r => ({
  id: r.id,
  label: r.label,
  wann: (r.when === 'abend' ? 'abend' : 'morgen') as Routine['wann'],
  kategorie: 'gesundheit',
  dauerMin: 15,
  aktiv: true,
}));

const bloeckeVon = (f: RoutinenDatei | null | undefined): Block[] => (Array.isArray(f?.bloecke) ? f!.bloecke : []);

/**
 * Jede Antwort mit Routinen geht hier durch: für eine Person die fremden nur verdeckt („Belegt“) — der Stand je Zeile wird
 * aus der verdeckten Fassung gerechnet, verrät also nichts und passt nie auf die echte Zeile. `betrachter` null = Systemlauf.
 */
const antwort = (f: RoutinenDatei | null | undefined, betrachter: string | null) => ({
  routinen: mitStand(routinenFuerBetrachter(Array.isArray(f?.routinen) ? f!.routinen : [], betrachter)),
  bloecke: mitStand(bloeckeFuerBetrachter(bloeckeVon(f), betrachter)),
});

/**
 * GET: der ganze gemeinsame Bestand (Routinen-Planer — Besitz je Zeile sichtbar). `?sicht=ich` (Praxis-Fund 04.10.): nur die
 * Routinen der angemeldeten Person und die gemeinsamen (`sichtbarFuer`) — für alle persönlichen Zählungen (Tagesplan,
 * Ritual, Energie, Planen, Journal). Ohne Person bei `sicht=ich`: nur die gemeinsamen.
 */
export async function GET(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt(); // lesen auch der Systemlauf (Takt, ZOE)
  let f = await loadJson<RoutinenDatei>('routinen');
  if (!f || !Array.isArray(f.routinen) || !f.routinen.length) {
    f = await updateJson<RoutinenDatei>('routinen', cur => ({ ...(cur ?? {}), routinen: seed() }));
  }
  const ich = personStreng(req);
  if (new URL(req.url).searchParams.get('sicht') === 'ich') {
    return NextResponse.json(antwort({ ...f, routinen: sichtbarFuer(f.routinen ?? [], ich ?? '') }, ich ?? ''));
  }
  // Ohne Person (Takt, ZOE-Hintergrund) wie bisher der ganze Bestand; mit Person fremde nur als „Belegt“.
  return NextResponse.json(antwort(f, ich));
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
  // Lesen, prüfen und schreiben in EINER Sperre (28.09.) — vorher las die Route den Bestand davor
  // und schrieb ihn mit zurück: was dazwischen an Blöcken geändert wurde, war weg.
  // Fremde Routinen (08.10.): bleiben in ihrer gespeicherten Fassung — die verdeckte Fassung aus dem Browser überschreibt nie.
  let abgelehnt = false;
  let fremd = false;
  const next = await updateJson<RoutinenDatei>('routinen', cur => {
    const altListe = Array.isArray(cur?.routinen) ? cur!.routinen : [];
    const r = routinenVollSchreiben(altListe, sauber, ich);
    if ('fremd' in r) { fremd = true; return cur as RoutinenDatei; }
    const alt = altListe.length;
    if (alt >= 4 && r.liste.length < alt / 2) { abgelehnt = true; return cur as RoutinenDatei; }
    return { ...(cur ?? {}), routinen: r.liste };
  });
  if (fremd) return NextResponse.json({ ok: false, error: ROUTINE_FREMD }, { status: 403 });
  if (abgelehnt) return NextResponse.json({ ok: false, error: 'Abgelehnt: das hätte über die Hälfte der Routinen gelöscht.' }, { status: 409 });
  return NextResponse.json({ ok: true, ...antwort(next, ich) });
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

  if (body.bloecke !== undefined) {
    if (!ich) return NextResponse.json({ ok: false, error: 'Blöcke gehören einer Person — ohne Anmeldung nichts zu ändern.' }, { status: 403 });
    if (Array.isArray(body.bloecke) && body.bloecke.length > MAX_BLOECKE) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_BLOECKE} Änderungen je Aufruf.` }, { status: 413 });
    const ops = opsLesen<Block>(body.bloecke, sauberBlock, MAX_BLOECKE);
    if (!ops) return NextResponse.json({ ok: false, error: Array.isArray(body.bloecke) ? opsFehler(body.bloecke, MAX_BLOECKE) : 'bloecke (Liste von Änderungen) fehlt.' }, { status: Array.isArray(body.bloecke) ? 413 : 400 });
    const r = await listePatchen<Block, RoutinenDatei & Record<string, unknown>>('routinen', 'bloecke', ops, 8, undefined, {
      pruefen: (liste, o) => nurEigene(liste, o, ich) ?? (wachstum(liste, o) > MAX_BLOECKE ? `Abgelehnt: höchstens ${MAX_BLOECKE} Blöcke.` : null),
    });
    return ergebnis(r, ich, 'bloecke');
  }

  if (Array.isArray(body.ops) && body.ops.length > MAX_ROUTINEN) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${MAX_ROUTINEN} Änderungen je Aufruf.` }, { status: 413 });
  const ops = opsLesen<Routine>(body.ops, sauberRoutine, MAX_ROUTINEN);
  if (!ops) return NextResponse.json({ ok: false, error: opsFehler(body.ops, MAX_ROUTINEN) }, { status: Array.isArray(body.ops) ? 413 : 400 });
  // Fremde Routinen (08.10.): weder ändern, löschen noch neu für die andere Person anlegen → 403. `teil` läuft durch denselben
  // Säuberer wie ein ganzer Eintrag (vorher legte er die Felder ungeprüft auf).
  const r = await listePatchen<Routine, RoutinenDatei & Record<string, unknown>>('routinen', 'routinen', ops, 4, undefined, {
    pruefen: (liste, o) => routinenSchreibPruefen(liste, o, ich ?? '') ?? (wachstum(liste, o) > MAX_ROUTINEN ? `Abgelehnt: höchstens ${MAX_ROUTINEN} Routinen.` : null),
    teil: (alt, felder) => sauberRoutine({ ...alt, ...felder }),
  });
  return ergebnis(r, ich, 'routinen');
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

async function ergebnis(r: PatchErgebnis<RoutinenDatei & Record<string, unknown>>, ich: string | null, liste: 'routinen' | 'bloecke') {
  const sicht = ich ?? '';
  if (r.ok) return NextResponse.json({ ok: true, angewandt: r.angewandt, ...antwort(r.next, sicht) });
  const status = r.fehler === FREMD || r.fehler === ROUTINE_FREMD ? 403
    : r.fehler?.startsWith('Abgelehnt: höchstens') ? 413
      : r.konflikte?.length || r.fehler?.startsWith('Abgelehnt') ? 409 : 400;
  // Konflikte betreffen nur eigene/gemeinsame Zeilen (fremde scheitern vorher mit 403) — trotzdem verdeckt ausliefern.
  const verdecken = (x: unknown) => (liste === 'bloecke' ? bloeckeFuerBetrachter([x as Block], sicht)[0] : routinenFuerBetrachter([x as Routine], sicht)[0]);
  const konflikte = (r.konflikte ?? []).map(k => (k.aktuell ? { ...k, aktuell: verdecken(k.aktuell) } : k));
  return NextResponse.json({ ok: false, error: r.fehler, konflikte, ...antwort(await loadJson<RoutinenDatei>('routinen'), sicht) }, { status });
}
