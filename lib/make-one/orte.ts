// ─── MAKE OS — Orte einer Aufgabe (09.10., Paket „neutral-rest“; löst organisation-data.ts ab) ──
// Die zweite Sortier-Achse neben den Themen: WO gehört eine Aufgabe hin — Privat oder eine der festen Gesellschaften.
// Die Liste kommt NUR aus lib/einheiten.ts (`FINANZ_ORTE`, Namen je Instanz über `NEXT_PUBLIC_MAKE_OS_EINHEITEN`) — keine
// zweite Firmenliste, keine Personen, Projekte oder fremden Firmen im Code (Plattform-Regel). Erkennung im Text: der volle
// Name und `ORT_STICHWORTE` (Altnamen der Instanz stehen nur in lib/einheiten.ts). Kurznamen nicht — „Selbst.“ oder „MAKE“
// träfen ganz gewöhnliche Sätze.
//
// Altbestand: eine von Hand gesetzte Zuordnung, die kein Ort mehr ist (früher eine feste Beteiligung), gilt beim LESEN als
// Business ohne eigene Gesellschaft (`ORT_BUSINESS_STANDARD`) — wie vorher: Business. Gespeichertes wird nie umgeschrieben.
//
// Client-safe: keine Server-Importe.

import { FINANZ_ORTE, ORT_STICHWORTE, type FinanzOrt } from '@/lib/einheiten';
import { altProjekt } from './alt-projekte';

export interface Ort {
  id: FinanzOrt;
  label: string;
  kurz: string;
  /** Erkennungspunkt (klein, nie als Fläche). */
  farbe: string;
  muster: RegExp;
}

/** Erkennungsfarben je Ort — Privat/Selbstständigkeit Petrol, die Beteiligungsgesellschaft Kupfer, die weitere Gesellschaft Indigo. */
const ORT_FARBE: Record<FinanzOrt, string> = { privat: '#58D9CD', kdc: '#58D9CD', kdv: '#DE9E63', ug: '#6E7EF5' };

const maske = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Ein Wort mit ≥ 3 Zeichen als Muster (kürzere würden überall treffen) — an Wortgrenzen, wenn es kurz ist. */
const wortMuster = (w: string): string | null => {
  const t = w.trim().toLocaleLowerCase('de-DE');
  if (t.length < 3) return null;
  return t.length <= 4 ? `\\b${maske(t)}\\b` : maske(t);
};

function musterFuer(o: { id: FinanzOrt; label: string; kurz: string }): RegExp {
  const woerter = o.id === 'privat' ? [...ORT_STICHWORTE.privat] : [o.label, ...ORT_STICHWORTE[o.id]];
  const teile = Array.from(new Set(woerter.map(wortMuster).filter((x): x is string => !!x)));
  return teile.length ? new RegExp(teile.join('|'), 'i') : /(?!)/;
}

/**
 * Allgemeine Business-Wörter ohne eigene Gesellschaft (eigene Module von MAKE OS) — gelten als Business-Standard. Sie stehen VOR Privat:
 * Übergabe-Aufgaben aus der Markttraktion tragen einen Link mit der Kontakt-Kennung, die „privat“ enthalten kann (so war es auch vorher).
 */
const BUSINESS_WOERTER = /markttraktion/i;

/** Reihenfolge der Erkennung wie früher: Gesellschaften vor Privat (ein „Haushalt“ in einer Firmen-Aufgabe macht sie nicht privat). */
export const ORTE: Ort[] = [...FINANZ_ORTE.filter(o => o.id !== 'privat'), ...FINANZ_ORTE.filter(o => o.id === 'privat')]
  .map(o => ({ id: o.id, label: o.label, kurz: o.kurz, farbe: ORT_FARBE[o.id], muster: musterFuer(o) }));

export const ORT: Readonly<Record<string, Ort>> = Object.fromEntries(ORTE.map(o => [o.id, o]));

/** Ohne Hinweis im Text: Business ohne eigene Gesellschaft — die Beteiligungsgesellschaft (wie bisher). */
export const ORT_BUSINESS_STANDARD: FinanzOrt = 'kdv';

/**
 * Ort einer Aufgabe: von Hand > Text > Projekt aus dem Altbestand > Business-Standard. Eine Zuordnung von Hand, die kein Ort
 * mehr ist (Altwert einer früheren festen Beteiligung), zählt als Business ohne eigene Gesellschaft — wie vorher Business.
 */
export function ortVon(
  t: { id: string; title: string; description?: string; projectId?: string },
  zuordnung: Record<string, string> = {},
): FinanzOrt {
  const hand = zuordnung[t.id];
  if (hand) return ORT[hand] ? (hand as FinanzOrt) : ORT_BUSINESS_STANDARD;
  // Der Text schlägt alles andere: „Selbständigkeit: Buchhaltung“ gehört zur Selbstständigkeit.
  const text = `${t.title} ${t.description ?? ''}`;
  for (const o of ORTE) {
    if (o.id === 'privat' && BUSINESS_WOERTER.test(text)) return ORT_BUSINESS_STANDARD;
    if (o.muster.test(text)) return o.id;
  }
  // Projekte aus dem ersten Startbestand (Altbestand, alt-projekte.ts): privat bleibt privat — neue Projekte tragen ihren Space selbst.
  if (altProjekt(t.projectId)?.privat) return 'privat';
  return ORT_BUSINESS_STANDARD;
}
