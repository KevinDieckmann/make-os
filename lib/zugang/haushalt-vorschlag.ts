// ─── Name des Haushalts: Vorschlag aus den Beständen, die schon im Datenordner liegen (Generalprobe Neustart, 09.10.2026) ──────────────
// Befund: nach dem Neustart-Umzug liegen Bestände je Haushalt (`crm-dateien--<h>`, `aufgaben-dateien--<h>`, `crm-sperrliste--<h>` …) unter dem
// ALTEN Haushaltsnamen. Das erste Konto hat noch keinen Haushalt — die Oberfläche (Konto › Haushaltsfinanzen) setzte bisher fest „haushalt“,
// einen Namen eintippen ging nicht. Dann fand die neue Instanz die CRM-Dateien, die Aufgaben-Dateien und die Sperrliste nicht.
// Jetzt: solange der Inhaber keinen Haushalt hat, nennt GET /api/konto/haushalt die Haushaltsnamen, die als Dateinamen im Datenordner
// stehen (nur Namen, die dort ohnehin im Klartext stehen — kein Inhalt wird gelesen), und die Karte bietet ein Feld zum Eintippen.
// Rein bis auf `haushaltVorschlaegeLesen` (liest nur das Verzeichnis).

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner } from '@/lib/store/local-db';

/** Gültiger Haushaltsname (wie lib/finanzen/haushalt/zugriff.ts `HAUSHALT_OK`). */
const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Bestände, die je HAUSHALT heißen (`<basis>--<haushalt>`) und mit dem Neustart-Umzug mitkommen bzw. von Anfang an je Haushalt liegen.
 * Bewusst nicht: Protokolle (`aenderungsprotokoll--<h>--<monat>` schreibt die App schon vor der Zuordnung unter einem Ersatznamen),
 * Bestände je PERSON (`visitenkarten--<person>`, `onboarding--<person>` …).
 */
export const HAUSHALT_BESTAENDE = ['crm-dateien', 'aufgaben-dateien', 'crm-sperrliste', 'kennung-alias', 'uebergabe-journal',
  'netzwerken-erfassungen', 'planung-einheiten', 'crm-import-laeufe', 'gesellschaften', 'familie', 'finanzen-plan', 'team', 'kapazitaet'] as const;

/** Ersatznamen, die nie als Vorschlag taugen (die App schreibt darunter, bevor ein Haushalt gesetzt ist). */
const ERSATZ = new Set(['haupt', 'haushalt', 'ohne-haushalt']);

/**
 * Vorschläge aus Dateinamen (rein): je Haushaltsname die Zahl der Bestände, meistgenannte zuerst, bei Gleichstand alphabetisch.
 * `ordnerDateien` = Einträge des Datenordners, `dateienOrdner` = Unterordner von `<daten>/dateien` (je Haushalt einer).
 */
export function haushaltVorschlaege(ordnerDateien: readonly string[], dateienOrdner: readonly string[] = []): string[] {
  const zahl = new Map<string, number>();
  const zaehle = (h: string) => { if (NAME.test(h) && !ERSATZ.has(h)) zahl.set(h, (zahl.get(h) ?? 0) + 1); };
  for (const datei of ordnerDateien) {
    const m = /^([a-z0-9-]+?)--([a-z0-9-]+)\.json$/.exec(datei);
    if (m && (HAUSHALT_BESTAENDE as readonly string[]).includes(m[1])) zaehle(m[2]);
  }
  for (const h of dateienOrdner) zaehle(h);
  return [...zahl.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([h]) => h).slice(0, 5);
}

/** Vorschläge aus dem Datenordner (liest nur Verzeichnisnamen, nie Inhalte). Fehler → leere Liste. */
export async function haushaltVorschlaegeLesen(): Promise<string[]> {
  const ordner = datenOrdner();
  const [dateien, unter] = await Promise.all([
    fs.readdir(ordner).catch(() => [] as string[]),
    fs.readdir(path.join(ordner, 'dateien'), { withFileTypes: true }).then(l => l.filter(d => d.isDirectory()).map(d => d.name)).catch(() => [] as string[]),
  ]);
  return haushaltVorschlaege(dateien, unter);
}
