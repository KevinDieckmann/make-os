// ─── MAKE OS — Journal (lokal, dein Datenweg) ───────────────────────────────
// Ein Eintrag pro Tag: Text + Tages-Check (Stimmung/Energie/Stress) und allgemeine Merkmale.
// So entstehen über Zeit echte Daten, um den Weg immer wieder anzupassen.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { personStreng, ohnePerson } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { bauPruefen } from '@/lib/bau/pruefen';
import { journalZusammenfuehren } from '@/lib/gesundheit/zusammenfuehren';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/zoe/raum';

import { localDay } from '@/lib/zeit';
import { gesundheitSchreibSperre } from '@/lib/datenschutz/gesundheit-einwilligung';
import { checkEingangSaeubern, checkAnwenden } from '@/lib/gesundheit/tages-check';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface JournalEntry {
  text?: string;
  /** Die drei Abendfragen (seit 23.09.): was lief gut, wofür dankbar, wo hart zu dir. */
  gut?: string;
  dankbar?: string;
  hart?: string;
  mood?: number;   // 1–5
  energy?: number; // 1–5
  stress?: number; // 1–5
  /** Bewertung des Tages 1–5 (Abend-Ritual). */
  tagesnote?: number;
  // Ältere Einträge tragen noch zwei feste Merkmale des früheren Tages-Checks (Werte „schub“/„schmerz“). Nichts schreibt sie
  // mehr; sie bleiben in den Daten (PUT schreibt den Bestand unverändert zurück) und die Oberfläche zeigt sie allgemein an.
  flags?: string[];// allgemeine Merkmale, z.B. bewegt, gutgeschlafen, sauber (Zähler laut Körper-Profil)
  /** Tages-Check „wie im WHOOP-Journal“ (09.10.): Frage → ja/nein (Katalog lib/gesundheit/tages-check.ts; welche Fragen, stellt jede
   *  Person selbst ein). Die Auswertung „an Tagen mit … war dein Schlaf …“ liest NUR die eigenen Tage. */
  check?: Record<string, boolean>;
  at?: string;
}
export type Journal = Record<string, JournalEntry>;

/** Textfelder des PATCH mit Höchstlänge (darüber 413). */
const TEXT_FELDER = { gut: 800, dankbar: 800, hart: 800, text: 20_000 } as const;
/** Zahlenfelder 1–5 des PATCH (`tagesnote` = Bewertung des Tages im Abend-Ritual). */
const ZAHL_FELDER = ['mood', 'energy', 'stress', 'tagesnote'] as const;

export async function GET(req: Request) {
  // Das Journal ist der persönlichste Bestand überhaupt — je Person getrennt.
  // Lesen dürfen sich beide gegenseitig (?fuer=, Kevins Entscheidung 23.09.).
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  const journal = (await loadJson<Journal>(speicherFuer('journal', person))) ?? {};
  return NextResponse.json({ journal });
}

/**
 * PUT = Altweg (die Online-Version vor dem 09.10. und alte Tabs schicken das ganze Journal). Prüf-Fund 11.10.: so überschrieb ein alter Tab
 * die `check`-Antworten des Tages-Checks und Felder, die per PATCH dazukamen. Darum (1) fremde Bau-Kennung → 409 „neu laden“ (`bauPruefen`),
 * (2) tagesweise ZUSAMMENFÜHREN (`journalZusammenfuehren`): geschickte Felder gewinnen, `check` wird vereint, nicht genannte Tage bleiben.
 * Die Oberflächen schreiben nur noch per PATCH (Ritual seit 11.10.).
 */
export async function PUT(req: Request) {
  // Art. 9 (05.10.): erfasst wird nur mit Einwilligung (a) der Person (Bestand: wie bisher, bis sie erklärt).
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let body: unknown;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!personStreng(req)) return ohnePerson();
  { const alt = bauPruefen(req); if (alt) return alt; }
  const j = body as Journal;
  if (!j || typeof j !== 'object' || Array.isArray(j)) {
    return NextResponse.json({ ok: false, error: 'Ungültiges Journal.' }, { status: 400 });
  }
  await updateJson<Journal>(speicherFuer('journal', personAus(req)), bisher => journalZusammenfuehren(bisher ?? {}, j as Record<string, unknown>));
  return NextResponse.json({ ok: true });
}

/** PATCH { datum?, eintrag } → einen Tag zusammenführen. Für die drei Fragen
 *  auf der Gesundheitsseite: ein Feld, ein Aufruf — der Schrumpf-Wächter des
 *  PUT ist hier überflüssig, weil nie ein ganzer Bestand geschickt wird.
 *  09.10.: `eintrag.check` = Antworten des Tages-Checks ({ frage: true | false | null }, null entfernt) — unbekannte Frage → 400,
 *  zusammengeführt mit den Antworten, die schon am Tag stehen. */
export async function PATCH(req: Request) {
  // Art. 9 (05.10.): erfasst wird nur mit Einwilligung (a) der Person (Bestand: wie bisher, bis sie erklärt).
  { const sperre = await gesundheitSchreibSperre(personAus(req)); if (sperre) return sperre; }
  let b: { datum?: string; eintrag?: Partial<JournalEntry> };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!personStreng(req)) return ohnePerson();
  const datum = b?.datum && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : localDay();
  const e = (b?.eintrag && typeof b.eintrag === 'object' && !Array.isArray(b.eintrag) ? b.eintrag : {}) as Record<string, unknown>;
  // Felder setzen (Text getrimmt, Zahlen 1–5) oder mit `null`/'' leeren (Prüf-Fund 11.10.: das Ritual schreibt jetzt hierüber und muss den
  // Abendtext auch leeren können). Zu langer Text → 413, nie still gekürzt.
  const neu: Partial<JournalEntry> = {};
  const weg: (keyof JournalEntry)[] = [];
  for (const [f, max] of Object.entries(TEXT_FELDER) as [keyof typeof TEXT_FELDER, number][]) {
    if (!(f in e)) continue;
    const v = e[f];
    if (v === null || (typeof v === 'string' && !v.trim())) { weg.push(f); continue; }
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const s = String(v).trim();
    if (s.length > max) return NextResponse.json({ ok: false, error: `${f}: höchstens ${max} Zeichen (${s.length}). Nichts gespeichert.` }, { status: 413 });
    neu[f] = s;
  }
  for (const f of ZAHL_FELDER) {
    if (!(f in e)) continue;
    const v = e[f];
    if (v === null) { weg.push(f); continue; }
    const n = Number(v);
    if (isFinite(n) && n >= 1 && n <= 5) neu[f] = Math.round(n);
  }
  let check: Record<string, boolean | null> | null = null;
  if (e.check !== undefined) {
    const c = checkEingangSaeubern(e.check);
    if (!c.ok) return NextResponse.json({ ok: false, error: c.fehler }, { status: 400 });
    check = c.werte;
  }
  if (!Object.keys(neu).length && !weg.length && !check) return NextResponse.json({ ok: false, error: 'Nichts zum Eintragen.' }, { status: 400 });
  const log = await updateJson<Journal>(speicherFuer('journal', personAus(req)), current => {
    const j = current ?? {};
    const tag: JournalEntry = { ...(j[datum] ?? {}), ...neu, at: new Date().toISOString() };
    for (const f of weg) delete tag[f];
    if (check) { const c = checkAnwenden(tag.check, check); if (c) tag.check = c; else delete tag.check; }
    return { ...j, [datum]: tag };
  });
  return NextResponse.json({ ok: true, datum, eintrag: log[datum] });
}
