// ─── MAKE OS — Meilensteine (lokal, pflegbar) ───────────────────────────────
// Vorher eine feste Konstante — jetzt DIE Datenbasis: jeder Meilenstein hat
// Fälligkeit, Messlatte („woran erkennen wir fertig?") und Fortschritt.
// space='business' fließt in Brain + Business-Säule, 'privat' in die
// Gesundheits-Säule — und bleibt aus Business-Kontexten draußen (Privatsphäre).
// Seit 28.09. ist `space` das echte Feld; das Altfeld `bereich` (business | gesundheit)
// wird beim Speichern gespiegelt, damit die älteren Leser weiterlaufen.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateGeschuetztListen } from '@/lib/store/local-db';
import { listePatchen, opsLesen, opsFehler } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import type { Meilenstein } from '@/lib/planung/typen';
import { sauberMeilensteine, meilensteinSpeicherSpace } from '@/lib/planung/meilensteine';
import { mitMandatBezug, type MandatKurz } from '@/lib/planung/mandat';
import { mandateFuerBezug } from '@/lib/planung/mandat-server';
import { fortschrittAnwenden } from '@/lib/planung/meilenstein-aufgaben';
import { kettePruefen, listeNachOps, ohneToteVerweise } from '@/lib/planung/meilenstein-kette';
import { meilensteinStrukturSichern, meilensteinListenArchivieren, zieleNachziehen } from '@/lib/planung/meilenstein-aufgaben-server';
import { ladeAufgaben } from '@/lib/aufgaben/speicher';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { BEREICH_GETRENNT, ZIEL_FEHLT, meilensteinBezugPruefen } from '@/lib/planung/bezuege';
import { zieleFuerBezug } from '@/lib/planung/bezuege-server';
import { meilensteineFuerBetrachter, meilensteinVerborgen } from '@/lib/planung/eigene-ziele-sicht';
import { verborgeneZieleFuer } from '@/lib/planung/eigene-ziele-sicht-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Seit 01.10. (Ziel ↔ Meilenstein): `wartetAuf` (Kette, lib/planung/meilenstein-kette.ts) — der Schreibweg lehnt zu viele
// Vorgänger, unbekannte Vorgänger und Kreise ab (409/413) und räumt Verweise auf gelöschte Meilensteine in derselben Sperre.
// Seit 27.09. zusätzlich (additiv, alte Einträge bleiben gültig): `rang` (Priorität per Pfeil),
// `einheit` (Business-Einheit, nur Bereich Business), `abgeleitetVon`/`angepasst` (aus einem
// Jahresziel mit Termin — lib/planung/kaskade.ts). Der Typ liegt in lib/planung/typen.ts.
export type { Meilenstein };
interface MeilensteinFile { meilensteine: Meilenstein[] }
/** Höchstzahl Meilensteine — darüber wird abgelehnt, nie gekürzt (28.09.). */
const GRENZE = 500;

// Kein Startbestand (28.09., K1): hier standen echte Business- und Gesundheits-Etappen im Code (Regel 1
// „keine echten Daten im Repo“). Ein neuer Haushalt beginnt leer; ein bestehender Bestand wird nie angefasst.

// Säuberung (seit 28.09. mit echtem `space`, `bereich` gespiegelt): lib/planung/meilensteine.ts.
// Mandat an Meilensteinen (28.09.): Firma und Einheit aus dem Mandat (lib/planung/mandat.ts) — nur im Business.
const sauberListe = (roh: unknown, mandate: ReadonlyMap<string, MandatKurz> | null = null): Meilenstein[] =>
  sauberMeilensteine(roh).map(m => mitMandatBezug(m, mandate, meilensteinSpeicherSpace(m) === 'business'));

// Eigene Ziele nur geteilt (08.10., Kevin): Meilensteine aus dem Altbestand, die noch an einem NICHT geteilten eigenen Ziel der anderen
// Person hängen, gehen an diese Person nie hinaus (jede Antwort über `sichtbar`) und sind für sie nicht änderbar (403). Seit 07.10.
// entsteht kein neuer solcher Meilenstein mehr (Ziel-Bezug nur auf den geteilten Bestand, lib/planung/bezuege.ts).
const VERBORGEN = 'Dieser Meilenstein hängt an einem eigenen Ziel einer anderen Person, das sie nicht mit dir teilt.';
const sichtbar = (liste: readonly Meilenstein[] | undefined, verborgen: ReadonlySet<string>) => mitStand(meilensteineFuerBetrachter(Array.isArray(liste) ? liste : [], verborgen));

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const [f, verborgen] = await Promise.all([loadJson<MeilensteinFile>('meilensteine'), verborgeneZieleFuer(personStreng(req))]);
  // Jede Zeile trägt ihren Stand — Änderungen kommen als PATCH mit diesem Stand zurück (28.09.).
  return NextResponse.json({ meilensteine: sichtbar(f?.meilensteine, verborgen) });
}

export async function PUT(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  let body: { meilensteine?: unknown };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (Array.isArray(body.meilensteine) && body.meilensteine.length > GRENZE) return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${GRENZE} Meilensteine.` }, { status: 413 });
  const gesaeubert = sauberListe(body.meilensteine, await mandateFuerBezug(body.meilensteine));
  if (!gesaeubert.length) return NextResponse.json({ ok: false, error: 'meilensteine darf nicht leer sein.' }, { status: 400 });
  // Eigene Ziele nur geteilt (08.10.): verborgene Meilensteine (Altbestand) kennt dieser Browser nicht — sie bleiben, wie sie sind;
  // nennt der Körper einen davon, ist das ein Schreiben auf Fremdes → 403.
  const verborgen = await verborgeneZieleFuer(personStreng(req));
  const gespeichert = verborgen.size ? (await loadJson<MeilensteinFile>('meilensteine'))?.meilensteine : [];
  const fremd = (Array.isArray(gespeichert) ? gespeichert : []).filter(m => meilensteinVerborgen(m, verborgen));
  if (fremd.some(m => gesaeubert.some(x => x.id === m.id))) return NextResponse.json({ ok: false, error: VERBORGEN }, { status: 403 });
  // Kette (01.10.): Verweise ins Leere fallen weg (die Liste ist ja gerade DER Bestand), Kreise und zu viele Vorgänger lehnt der Weg ab.
  const sauber = ohneToteVerweise([...gesaeubert, ...fremd]).liste;
  const kette = kettePruefen(sauber, sauber.map(m => m.id));
  if (kette) return NextResponse.json({ ok: false, error: kette }, { status: kette.startsWith('Abgelehnt: höchstens') ? 413 : 409 });
  // Vorher ersetzte jeder PUT die Liste bedingungslos — ein Client mit halbem
  // Stand hätte alle Meilensteine gelöscht.
  const { ok, next, verloren } = await updateGeschuetztListen<MeilensteinFile>(
    'meilensteine', { meilensteine: sauber }, ['meilensteine'],
  );
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: `Abgelehnt: das hätte über die Hälfte von ${verloren} gelöscht.` },
      { status: 409 },
    );
  }
  // Meilenstein ↔ Aufgaben (30.09.): jeder Meilenstein hat seine Liste im Aufgaben-Bestand (idempotent).
  await meilensteinStrukturSichern(null, { person: personStreng(req) });
  return NextResponse.json({ ok: true, meilensteine: meilensteineFuerBetrachter(next.meilensteine, verborgen) });
}

/**
 * Einzelne Meilensteine ändern — Zwei-Fenster-Fundament. Mit `stand` je Änderung (28.09.):
 * veraltet → 409 mit dem aktuellen Bestand und `konflikte[]`, nichts überschrieben.
 */
export async function PATCH(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  let body: { ops?: unknown };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (Array.isArray(body.ops) && body.ops.length > 160) return NextResponse.json({ ok: false, error: 'Abgelehnt: höchstens 160 Änderungen je Aufruf.' }, { status: 413 });
  const mandate = await mandateFuerBezug(body.ops);
  const ops = opsLesen<Meilenstein>(body.ops, e => sauberListe([e], mandate)[0] ?? null, 160);
  if (!ops) return NextResponse.json({ ok: false, error: opsFehler(body.ops, 160) }, { status: Array.isArray(body.ops) ? 413 : 400 });
  // Eigene Ziele nur geteilt (08.10.): Änderungen an verborgenen Meilensteinen (Altbestand) → 403, nichts geschrieben.
  const verborgen = await verborgeneZieleFuer(personStreng(req));
  if (verborgen.size) {
    const fremd = new Set(((await loadJson<MeilensteinFile>('meilensteine'))?.meilensteine ?? []).filter(m => meilensteinVerborgen(m, verborgen)).map(m => m.id));
    if (ops.some(o => fremd.has(o.op === 'upsert' ? o.eintrag?.id ?? '' : o.id ?? ''))) return NextResponse.json({ ok: false, error: VERBORGEN }, { status: 403 });
  }
  // Fortschritt-Regel (30.09., lib/planung/meilenstein-aufgaben.ts): hat ein Meilenstein Aufgaben, gilt der errechnete
  // Wert — ein mitgeschickter Wert von Hand wird in derselben Sperre überschrieben.
  const aufgaben = await ladeAufgaben();
  // Bezüge (07.10., Seil): ein neu gesetztes Ziel muss im geteilten Bestand stehen und zum Bereich passen — nur geladen, wenn eins genannt ist.
  const zieleBezug = ops.some(o => (o.op === 'upsert' && !!o.eintrag?.zielId) || (o.op === 'teil' && !!o.felder?.zielId)) ? await zieleFuerBezug() : null;
  const r = await listePatchen<Meilenstein, MeilensteinFile & Record<string, unknown>>('meilensteine', 'meilensteine', ops, 6, undefined, {
    // Ein gelöschter Meilenstein verschwindet auch aus „wartet auf“ der anderen (01.10.) — Rückgängig legt den Verweis wieder an.
    danach: f => ({ ...f, meilensteine: ohneToteVerweise(fortschrittAnwenden(Array.isArray(f.meilensteine) ? f.meilensteine : [], aufgaben).liste).liste }),
    pruefen: (liste, o) => {
      const ids = new Set(liste.map(m => m.id));
      const neu = new Set(o.filter(x => x.op === 'upsert' && !ids.has(x.eintrag!.id)).map(x => x.eintrag!.id)).size;
      if (neu && liste.length + neu > GRENZE) return `Abgelehnt: höchstens ${GRENZE} Meilensteine.`;
      // Kette (01.10.): über der Liste NACH den Änderungen — Grenze, unbekannte Vorgänger, Kreise.
      const { nachher, beruehrt } = listeNachOps(liste, o);
      // Seil (07.10.): Privat und Business bleiben getrennt (Ziel und Vorgänger), das Ziel steht im geteilten Bestand.
      return kettePruefen(nachher, beruehrt, liste) ?? meilensteinBezugPruefen(nachher, beruehrt, new Map(liste.map(m => [m.id, m])), zieleBezug);
    },
    // `teil`-Änderungen laufen durch dieselbe Säuberung wie ganze Einträge (vorher ungeprüft).
    teil: (alt, felder) => sauberListe([{ ...alt, ...felder }])[0] ?? null,
  });
  if (!r.ok) {
    const aktuell = await loadJson<MeilensteinFile>('meilensteine');
    const status = r.fehler?.startsWith('Abgelehnt: höchstens') ? 413 : r.fehler === BEREICH_GETRENNT || r.fehler === ZIEL_FEHLT ? 400 : r.konflikte?.length || r.fehler?.startsWith('Abgelehnt') ? 409 : 400;
    return NextResponse.json({ ok: false, error: r.fehler, konflikte: r.konflikte ?? [], meilensteine: sichtbar(aktuell?.meilensteine, verborgen) }, { status });
  }
  // Meilenstein ↔ Aufgaben (30.09.): neue/geänderte bekommen ihre Liste (Space, Titel, Reihenfolge nachgezogen), gelöschte
  // archivieren ihre Liste (Aufgaben bleiben; kommt der Meilenstein zurück, wird sie wieder aktiv). Ziele ziehen nach.
  const person = personStreng(req);
  const lebend = new Set((r.next?.meilensteine ?? []).map(m => m.id));
  const upserts = ops.filter(o => o.op === 'upsert').map(o => o.eintrag!.id).filter(id => lebend.has(id));
  const weg = ops.filter(o => o.op === 'delete').map(o => o.id!).filter(id => !lebend.has(id));
  if (upserts.length) await meilensteinStrukturSichern(upserts, { person });
  if (weg.length) await meilensteinListenArchivieren(weg, { person });
  await zieleNachziehen(r.next?.meilensteine ?? []);
  return NextResponse.json({ ok: true, angewandt: r.angewandt, meilensteine: sichtbar(r.next?.meilensteine, verborgen) });
}
