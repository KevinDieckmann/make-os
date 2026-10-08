// ─── Das KI-Tor: die EINE Stelle, an der entschieden wird, ob Daten an das Modell gehen (05.10.) ──────────────────────
// `askText` (lib/anthropic.ts) ruft `kiTor` vor JEDEM Modellaufruf. Der Aufrufer sagt im Feld `ki`, was er schickt:
// Lauf-Art (gespraech · aufruf · hintergrund), Person, Datenkategorien, Anzahl Datensätze. Das Tor prüft
//
//   1. Hintergrund-KI aus (Instanz oder Person)        → gesperrt `hintergrund-aus`  (kein Byte verlässt den Server)
//   2. Kategorie „gesundheit“ ohne Einwilligung (b)     → gesperrt `einwilligung-gesundheit` (Systemlauf ohne Person: immer)
//   3. ein Bereich (crm, kalender, aufgaben, finanzen, brain) für ZOE nicht erlaubt → gesperrt `bereich-<x>`
//   4. Web-Suche gewünscht, aber aus                    → das Werkzeug fällt weg (der Aufruf läuft ohne)
//   5. Hintergrund-Lauf                                 → Namen der CRM-Kontakte pseudonymisiert (lib/datenschutz/pseudonym.ts)
//
// Ein Hintergrund-Lauf im selben Prozess (AsyncLocalStorage, lib/datenschutz/ki-lauf.ts) gilt immer als Hintergrund —
// auch wenn der Aufrufer „aufruf“ angibt. Ein Aufruf OHNE `ki` zählt als „aufruf“ mit Kategorie „allgemein“ (Wächter
// tests/ki-datenschutz.test.ts: jeder Aufrufer im Code gibt `ki` an).
// Die Prompt-Bauer filtern zusätzlich selbst (gatherBrain ohne Vitalwerte, Werkzeuge ohne gesperrte Bereiche) — das Tor
// ist die letzte Sicherung, nicht die einzige.

import type { KiKategorie, KiSchalter } from './ki-einstellungen';
import { istBereich } from './ki-einstellungen';
import { laufImKontext, type KiLauf } from './ki-lauf';
import type { Pseudonymisierer } from './pseudonym';

export interface KiKontext {
  /** Art des Aufrufs — Standard „aufruf“; im Hintergrund-Kontext immer „hintergrund“. */
  lauf?: KiLauf;
  /** Für wen (Speichername) — null/fehlt = Systemlauf. */
  person?: string | null;
  /** Welche Datenkategorien im Prompt stehen. */
  kategorien: KiKategorie[];
  /** Anzahl Datensätze, wenn bekannt (nur fürs Protokoll). */
  anzahl?: number;
  /** false = in diesem Hintergrund-Lauf NICHT pseudonymisieren (Begründung im Code, z. B. Recherche zu einer Person). */
  pseudonym?: boolean;
}

export type TorEntscheid =
  | { ok: true; lauf: KiLauf; person: string | null; websuche: boolean; pseudonym: boolean }
  | { ok: false; lauf: KiLauf; person: string | null; grund: string };

/** Die Entscheidung (rein). */
export function torEntscheiden(s: KiSchalter, gesundheitKi: boolean, k: { lauf: KiLauf; person: string | null; kategorien: readonly KiKategorie[]; pseudonym?: boolean }, websucheGewuenscht: boolean): TorEntscheid {
  const basis = { lauf: k.lauf, person: k.person };
  if (k.lauf === 'hintergrund' && !s.hintergrund) return { ...basis, ok: false, grund: 'hintergrund-aus' };
  if (k.kategorien.includes('gesundheit') && !gesundheitKi) return { ...basis, ok: false, grund: 'einwilligung-gesundheit' };
  for (const kat of k.kategorien) if (istBereich(kat) && !s.bereiche[kat]) return { ...basis, ok: false, grund: `bereich-${kat}` };
  return { ...basis, ok: true, websuche: websucheGewuenscht && s.websuche, pseudonym: k.lauf === 'hintergrund' && k.pseudonym !== false };
}

const PERSON = /^[a-z0-9-]{1,40}$/;

/** Das Tor (Server): Schalter und Einwilligung laden, entscheiden. */
export async function kiTor(k: KiKontext | undefined, websucheGewuenscht: boolean): Promise<TorEntscheid> {
  const lauf: KiLauf = laufImKontext() === 'hintergrund' ? 'hintergrund' : (k?.lauf ?? 'aufruf');
  const person = typeof k?.person === 'string' && PERSON.test(k.person) ? k.person : null;
  const kategorien = k?.kategorien?.length ? k.kategorien : (['allgemein'] as KiKategorie[]);
  const { kiSchalterFuer } = await import('./ki-einstellungen');
  const s = await kiSchalterFuer(person);
  let gesundheitKi = true;
  if (kategorien.includes('gesundheit')) {
    // Nur die Einwilligung (b) — ob der Weg in die EU offen ist, entscheidet danach das Anbieter-Tor (lib/ki/tor.ts, `anbieter-stufe`).
    const { gesundheitKiEinwilligung } = await import('./gesundheit-einwilligung');
    gesundheitKi = person ? await gesundheitKiEinwilligung(person) : false;
  }
  return torEntscheiden(s, gesundheitKi, { lauf, person, kategorien, pseudonym: k?.pseudonym }, websucheGewuenscht);
}

let merk: { p: Pseudonymisierer; bis: number } | null = null;
/** Für Tests. */
export function pseudonymVergessen(): void { merk = null; }

/** Der Pseudonymisierer aus der Kartei (alle Kontakte, auch eingeschränkte — ihre Namen sollen erst recht nicht hinaus). */
export async function pseudonymFuerLauf(): Promise<Pseudonymisierer> {
  const { pseudonymisierer } = await import('./pseudonym');
  if (merk && merk.bis > Date.now()) return frisch(merk.p);
  const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
  const kontakte = await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }).catch(() => []);
  const p = pseudonymisierer(kontakte.map(k => ({ id: k.id, vorname: k.vorname, nachname: k.nachname, email: k.email })));
  merk = { p, bis: Date.now() + 60_000 };
  return frisch(p);
}

/** Je Aufruf ein eigener Zähler über demselben (gemerkten) Wörterbuch. */
function frisch(basis: Pseudonymisierer): Pseudonymisierer {
  const gesehen = new Set<string>();
  const zaehle = (t: string) => { for (const m of t.matchAll(/\[K\d+(?:-mail)?\]/g)) gesehen.add(m[0].replace(/-mail\]$/, ']')); return t; };
  return {
    ersetze: t => zaehle(basis.ersetze(t)),
    zurueck: basis.zurueck,
    tiefErsetzen: w => { const r = basis.tiefErsetzen(w); zaehle(JSON.stringify(r) ?? ''); return r; },
    tiefZurueck: basis.tiefZurueck,
    ersetzt: () => gesehen.size,
  };
}

/** Ist die Web-Suche für diesen Aufruf erlaubt (Instanz UND Person)? */
export async function websucheErlaubt(k: KiKontext | undefined): Promise<boolean> {
  const person = typeof k?.person === 'string' && PERSON.test(k.person) ? k.person : null;
  const { kiSchalterFuer } = await import('./ki-einstellungen');
  return (await kiSchalterFuer(person)).websuche;
}
