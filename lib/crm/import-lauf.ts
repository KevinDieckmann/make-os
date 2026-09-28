// ─── CRM — Import-Lauf mit „Rückgängig“ (28.09., K2 #25) ────────────────────
// Ein Import der Masterliste berührt hunderte Kontakte. Ging etwas schief
// (falsche Datei, verrutschte Spalten), gab es bisher nur die Tagessicherung.
// Jetzt bekommt jeder schreibende Import eine Lauf-ID; VOR dem Schreiben liegt
// der Vorher-Stand der betroffenen Kontakte (nur der geänderten, nie der ganze
// Bestand) im Speicher `crm-import-laeufe--<haushalt>` (local-db, verschlüsselt
// wie jeder Bestand). Nach dem Import (und dem Firmen-Abgleich) kommt je
// Kontakt der Fingerabdruck dazu, wie der Import ihn hinterließ.
//
// Ablaufprüfung 28.09.:
//  · W7: die Firmen, die der Firmen-Abgleich dabei NEU anlegte, stehen mit Fingerabdruck im Lauf
//    (`firmenNeu`) — „rückgängig“ nimmt sie mit zurück, wenn sie personenlos, unverändert und
//    verweisfrei sind (sonst Konflikt, die Firma bleibt).
//  · (c) „inzwischen verknüpft“ prüft nicht nur den CRM-Bestand, sondern auch Dateiablage,
//    Head-Vorschläge, Termin-Signale und Aufgaben (die Route reicht alle Bestände herein).
//  · W4: derselbe Speicher hält auch Zusammenführungs-Läufe der Dubletten (`art: 'zusammenfuehren'`,
//    lib/crm/zusammenfuehren-lauf.ts) — der Import-Weg lässt sie in Ruhe, Art. 17 räumt sie mit.
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
/** Ein Eintrag eines anderen Bestands, wie er VOR einem Lauf war, und sein Fingerabdruck danach (null = danach nicht da). */
export interface Schnappschuss { speicher: string; id: string; vorher: Record<string, unknown> | null; nachher: string | null }
/** Zusammenführen zweier Personen (W4): behalten, weg und die umgebogenen Verweise der anderen Bestände. */
export interface ZusammenLauf { behalten: string; weg: string; verweise: Schnappschuss[] }
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
  rueckgaengig?: { am: string; von: string; zurueck: number; konflikte: LaufKonflikt[]; firmen?: number };
  /** Fehlt = Import (Altbestand). `zusammenfuehren` = Dubletten-Lauf (W4) — nur über /api/crm/dubletten zurück. */
  art?: 'import' | 'zusammenfuehren';
  /** W7: vom Firmen-Abgleich dieses Imports NEU angelegte Firmen → Fingerabdruck danach. */
  firmenNeu?: Record<string, string>;
  zusammen?: ZusammenLauf;
  /** Art. 17 hat Personendaten aus dem Lauf genommen — er kann nicht mehr zurück. */
  verfallen?: boolean;
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

/** Läufe älter als 30 Tage fallen weg — `tage` aus der Löschfristen-Tabelle (lib/crm/loeschfristen.ts, U2), sonst 30. */
export function laeufeAufraeumen(laeufe: ImportLauf[], jetztIso: string, tage = LAUF_TAGE): ImportLauf[] {
  const grenze = Date.parse(jetztIso) - tage * 864e5;
  return laeufe.filter(l => Date.parse(l.am) >= grenze);
}

export const laufKurz = (l: ImportLauf): LaufKurz => ({ id: l.id, am: l.am, person: l.person, quelle: l.quelle, neu: l.neu.length, geaendert: l.vorher.length, ...(l.rueckgaengig ? { rueckgaengig: l.rueckgaengig } : {}) });
/** Ein Import-Lauf (kein Dubletten-Lauf). */
export const istImportLauf = (l: ImportLauf) => (l.art ?? 'import') === 'import';

/** Fingerabdruck eines gespeicherten Kontakts (ohne `stand`). */
export const kontaktAbdruck = (k: Kontakt) => fingerabdruck(k as unknown as Record<string, unknown>);

/**
 * Rückgängig rechnen: liefert den neuen Bestand, wie viele Kontakte zurückgesetzt wurden und die Konflikte.
 * `verknuepft(id)`: hängt ein NEU angelegter Kontakt inzwischen an etwas im CRM (Deal, Mandat, Kampagne …)?
 */
export function rueckgaengigRechnen(kontakte: Kontakt[], lauf: ImportLauf, verknuepft: (id: string) => boolean): { kontakte: Kontakt[]; zurueck: number; konflikte: LaufKonflikt[] } {
  if (!istImportLauf(lauf) || lauf.verfallen) return { kontakte, zurueck: 0, konflikte: [] };
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

/** Firmen-Fingerabdruck (ohne `stand`) — derselbe wie für Kontakte. */
export const firmaAbdruck = (f: { id: string } & Record<string, unknown>) => fingerabdruck(f);

/**
 * W7: welche der im Lauf NEU angelegten Firmen dürfen mit zurück? Nur, wer noch da ist, seitdem unverändert,
 * ohne Personen (auch keine beendete Station) und ohne jeden anderen Verweis (Deal, Mandat, Rechnung,
 * Tochterfirma, Lead, Kampagne, Dateiablage …). `verweise(id)` prüft alles außer der Firma selbst.
 */
export function firmenRueckgaengig(firmen: ({ id: string } & Record<string, unknown>)[], lauf: Pick<ImportLauf, 'firmenNeu'>, verweise: (id: string) => boolean): { weg: string[]; konflikte: LaufKonflikt[] } {
  const weg: string[] = [];
  const konflikte: LaufKonflikt[] = [];
  const nachId = new Map(firmen.map(f => [f.id, f]));
  for (const [id, abdruck] of Object.entries(lauf.firmenNeu ?? {})) {
    const f = nachId.get(id);
    if (!f) continue;
    if (firmaAbdruck(f) !== abdruck) konflikte.push({ id, grund: 'seitdem geändert' });
    else if (verweise(id)) konflikte.push({ id, grund: 'inzwischen verknüpft' });
    else weg.push(id);
  }
  return { weg, konflikte };
}

/** Art. 17: die Person aus einem Lauf nehmen (Vorher-Stand, Kennung, Fingerabdruck). */
export function laufOhne(l: ImportLauf, id: string): { lauf: ImportLauf; n: number } {
  // Dubletten-Lauf (W4): Schnappschüsse fremder Einträge tragen die Kennung auch im Innern — betrifft er die Person,
  // fällt der ganze Inhalt weg (der Lauf kann danach nicht mehr zurück, `verfallen`).
  if (l.art === 'zusammenfuehren') {
    const betrifft = l.vorher.some(v => v.id === id) || !!l.nachher[id] || (!!l.zusammen && (l.zusammen.behalten === id || l.zusammen.weg === id || JSON.stringify(l.zusammen.verweise).includes(`"${id}"`)));
    if (!betrifft) return { lauf: l, n: 0 };
    return { lauf: { ...l, vorher: [], nachher: {}, neu: [], zusammen: { behalten: '', weg: '', verweise: [] }, verfallen: true }, n: 1 };
  }
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

/** W7: die vom Firmen-Abgleich neu angelegten Firmen mit ihrem Fingerabdruck nachtragen. */
export async function laufFirmenSetzen(haushalt: string, laufId: string, firmen: ({ id: string } & Record<string, unknown>)[]): Promise<void> {
  if (!firmen.length) return;
  await updateJson<LaufBestand>(laufName(haushalt), cur => ({
    laeufe: (cur?.laeufe ?? []).map(l => (l.id === laufId ? { ...l, firmenNeu: Object.fromEntries(firmen.map(f => [f.id, firmaAbdruck(f)])) } : l)),
  }));
}

/** Alle Haushalte mit Import-Läufen (aus den Dateinamen, ohne Inhalte zu lesen) — für Art. 15/17. */
const LAUF_DATEI = /^crm-import-laeufe--([a-z0-9][a-z0-9-]{0,39})\.json$/;
export async function laufHaushalte(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  return namen.map(n => LAUF_DATEI.exec(n)?.[1]).filter((h): h is string => !!h).sort();
}
