// ─── CRM — Import-Lauf mit „Rückgängig“ (28.09., K2 #25) ────────────────────
// Ein Import der Masterliste berührt hunderte Kontakte. Ging etwas schief
// (falsche Datei, verrutschte Spalten), gab es bisher nur die Tagessicherung.
// Jetzt bekommt jeder schreibende Import eine Lauf-ID; VOR dem Schreiben liegt
// der Vorher-Stand der betroffenen Kontakte (nur der geänderten, nie der ganze
// Bestand) im Speicher `crm-import-laeufe--<haushalt>` (local-db, verschlüsselt
// wie jeder Bestand). Nach dem Import (und dem Firmen-Abgleich) kommt je
// Kontakt der Fingerabdruck dazu, wie der Import ihn hinterließ.
//
// „Import rückgängig“ je Lauf: neu angelegte Kontakte fallen wieder weg,
// geänderte bekommen ihren Vorher-Stand — aber NUR, wenn der Kontakt seitdem
// unverändert ist (Fingerabdruck gleich) und ein neuer nicht inzwischen an
// einem Deal/Mandat/einer Kampagne hängt. Sonst: Konflikt je Kontakt, nichts
// überschrieben. Firmen, die der Abgleich anlegte, bleiben (sie tragen keine
// Personen-Kennung). Aufbewahrung 30 Tage, danach fällt der Lauf beim nächsten
// Schreiben weg. Art. 17: `personEntfernen` nimmt die Person aus jedem Lauf.

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'fs';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import type { Kontakt } from '@/lib/make-one/crm';

export const LAUF_TAGE = 30;

export interface LaufKonflikt { id: string; grund: 'seitdem geändert' | 'nicht mehr da' | 'inzwischen verknüpft' }
export interface ImportLauf {
  id: string;
  /** ISO-Zeitpunkt des Imports. */
  am: string;
  person: string;
  quelle: string;
  /** Kennungen der neu angelegten Kontakte. */
  neu: string[];
  /** Vorher-Stand der geänderten Kontakte (nur betroffene). */
  vorher: Kontakt[];
  /** Fingerabdruck je Kontakt, wie der Import ihn hinterließ (nach dem Firmen-Abgleich). */
  nachher: Record<string, string>;
  rueckgaengig?: { am: string; von: string; zurueck: number; konflikte: LaufKonflikt[] };
}
export interface LaufBestand { laeufe: ImportLauf[] }

/** Kurzform für Oberfläche und GET — ohne Personendaten. */
export interface LaufKurz { id: string; am: string; person: string; quelle: string; neu: number; geaendert: number; rueckgaengig?: ImportLauf['rueckgaengig'] }

export const laufName = (haushalt: string) => {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error('Unzulässiger Haushalt.');
  return `crm-import-laeufe--${haushalt}`;
};
export const LAUF_ID_OK = /^imp-[0-9a-z]{6,14}-[0-9a-f]{6}$/;
export const neueLaufId = (jetzt = new Date()) => `imp-${jetzt.getTime().toString(36)}-${randomBytes(3).toString('hex')}`;

// ── Rein ─────────────────────────────────────────────────────────────────────

/** Läufe älter als 30 Tage fallen weg. */
export function laeufeAufraeumen(laeufe: ImportLauf[], jetztIso: string): ImportLauf[] {
  const grenze = Date.parse(jetztIso) - LAUF_TAGE * 864e5;
  return laeufe.filter(l => Date.parse(l.am) >= grenze);
}

export const laufKurz = (l: ImportLauf): LaufKurz => ({ id: l.id, am: l.am, person: l.person, quelle: l.quelle, neu: l.neu.length, geaendert: l.vorher.length, ...(l.rueckgaengig ? { rueckgaengig: l.rueckgaengig } : {}) });

/** Fingerabdruck eines gespeicherten Kontakts (ohne `stand`). */
export const kontaktAbdruck = (k: Kontakt) => fingerabdruck(k as unknown as Record<string, unknown>);

/**
 * Rückgängig rechnen: liefert den neuen Bestand, wie viele Kontakte zurückgesetzt wurden und die Konflikte.
 * `verknuepft(id)`: hängt ein NEU angelegter Kontakt inzwischen an etwas im CRM (Deal, Mandat, Kampagne …)?
 */
export function rueckgaengigRechnen(kontakte: Kontakt[], lauf: ImportLauf, verknuepft: (id: string) => boolean): { kontakte: Kontakt[]; zurueck: number; konflikte: LaufKonflikt[] } {
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const konflikte: LaufKonflikt[] = [];
  const weg = new Set<string>();
  const ersetzen = new Map<string, Kontakt>();
  const unveraendert = (k: Kontakt) => !!lauf.nachher[k.id] && kontaktAbdruck(k) === lauf.nachher[k.id];
  for (const id of lauf.neu) {
    const k = nachId.get(id);
    if (!k) continue;                                     // schon weg (gelöscht/zusammengeführt) — nichts zu tun
    if (!unveraendert(k)) konflikte.push({ id, grund: 'seitdem geändert' });
    else if (verknuepft(id)) konflikte.push({ id, grund: 'inzwischen verknüpft' });
    else weg.add(id);
  }
  for (const v of lauf.vorher) {
    const k = nachId.get(v.id);
    if (!k) konflikte.push({ id: v.id, grund: 'nicht mehr da' });
    else if (!unveraendert(k)) konflikte.push({ id: v.id, grund: 'seitdem geändert' });
    else ersetzen.set(v.id, v);
  }
  const neu = kontakte.filter(k => !weg.has(k.id)).map(k => ersetzen.get(k.id) ?? k);
  return { kontakte: neu, zurueck: weg.size + ersetzen.size, konflikte };
}

/** Art. 17: die Person aus einem Lauf nehmen (Vorher-Stand, Kennung, Fingerabdruck). */
export function laufOhne(l: ImportLauf, id: string): { lauf: ImportLauf; n: number } {
  const n = (l.neu.includes(id) ? 1 : 0) + l.vorher.filter(v => v.id === id).length + (l.nachher[id] ? 1 : 0)
    + (l.rueckgaengig?.konflikte.some(x => x.id === id) ? 1 : 0);
  if (!n) return { lauf: l, n };
  const { [id]: _weg, ...nachher } = l.nachher;
  return {
    lauf: { ...l, neu: l.neu.filter(x => x !== id), vorher: l.vorher.filter(v => v.id !== id), nachher,
      ...(l.rueckgaengig ? { rueckgaengig: { ...l.rueckgaengig, konflikte: l.rueckgaengig.konflikte.filter(x => x.id !== id) } } : {}) },
    n,
  };
}

// ── Speicher ─────────────────────────────────────────────────────────────────

export async function laeufeLaden(haushalt: string, jetztIso = new Date().toISOString()): Promise<ImportLauf[]> {
  return laeufeAufraeumen((await loadJson<LaufBestand>(laufName(haushalt)))?.laeufe ?? [], jetztIso);
}

/** Lauf ablegen (vor dem Schreiben der Kartei) — räumt dabei Läufe über 30 Tage ab. */
export async function laufAblegen(haushalt: string, lauf: ImportLauf): Promise<void> {
  await updateJson<LaufBestand>(laufName(haushalt), cur => ({ laeufe: [...laeufeAufraeumen(cur?.laeufe ?? [], lauf.am), lauf] }));
}

/** Nach dem Import: Fingerabdrücke der betroffenen Kontakte, wie sie jetzt gespeichert sind. */
export async function laufNachherSetzen(haushalt: string, laufId: string, kontakte: Kontakt[]): Promise<void> {
  await updateJson<LaufBestand>(laufName(haushalt), cur => ({
    laeufe: (cur?.laeufe ?? []).map(l => {
      if (l.id !== laufId) return l;
      const ids = new Set([...l.neu, ...l.vorher.map(v => v.id)]);
      return { ...l, nachher: Object.fromEntries(kontakte.filter(k => ids.has(k.id)).map(k => [k.id, kontaktAbdruck(k)])) };
    }),
  }));
}

/** Alle Haushalte mit Import-Läufen (aus den Dateinamen, ohne Inhalte zu lesen) — für Art. 15/17. */
const LAUF_DATEI = /^crm-import-laeufe--([a-z0-9][a-z0-9-]{0,39})\.json$/;
export async function laufHaushalte(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  return namen.map(n => LAUF_DATEI.exec(n)?.[1]).filter((h): h is string => !!h).sort();
}
