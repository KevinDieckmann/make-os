// ─── Löschfristen je Datenart (28.09., U2 #52, rein, getestet) ───────────────
// Art. 5 Abs. 1 lit. e DSGVO (Speicherbegrenzung): EINE Tabelle, welche Daten wie
// lange bleiben. Die Werte sind Vorschläge — unter Stammdaten › Datenschutz
// anpassbar. Gespeichert wird nur, was vom Standard abweicht (`fristenSpeichern`):
// der Standard steht im Code und wird nie in den Bestand geschrieben.
//
//   Datenart                   Standard    Wirkung (täglicher Takt-Lauf, lib/crm/loeschfristen-lauf.ts)
//   Kontakte ohne Beziehung    24 Monate   KEINE automatische Löschung — eine Aufgabe „prüfen: löschen
//                                          oder begründen“; je Person „Frist verlängern mit Grund“
//   Import-Konflikte           90 Tage     automatisch bereinigt (Protokoll „System“)
//   Import-Läufe               30 Tage     automatisch (lib/crm/import-lauf.ts, besteht seit K2)
//   Heads-Replay               90 Tage     automatisch bereinigt
//   Signale (Betreff/Titel)    12 Monate   Text der Signal-Aktivität entfernt, das Ereignis bleibt
//   Änderungsprotokoll         36 Monate   Monatsdateien geleert (Vermerk bleibt)
//   Aktivitäten-Texte bei      sofort      Art. 17 über lib/crm/person-bestaende.ts (fest, nicht einstellbar)
//     gelöschten Personen
//   — seit 29.09. (Paket D-B #73/#93) —
//   ZOE-Arbeitslisten          90 Tage     zoe-protokoll + entschiedene Vorschläge in zoe-stapel (nur, was dauerhaft
//                                          in zoe-entscheidungen steht — sonst erst nachtragen, nie still)
//   ZOE-Entscheidungen         36 Monate   Monatsdateien geleert (Vermerk bleibt) — wie das Änderungsprotokoll
//   Gespräche mit ZOE          12 Monate   Gespräche, deren letzte Nachricht älter ist, fallen weg
//   ZOE-Gedächtnis             24 Monate   Fakten, die so lange nicht erneuert wurden, fallen weg
//   Postfach-Zwischenspeicher  30 Tage     Mails (Absender, Betreff, Vorschau) und Einstufungen — das Postfach bleibt beim Anbieter
//   Kalender-Zwischenspeicher  12 Monate   vergangene Termine im Zwischenspeicher
//   Umzugs-Kopien (archiv/)    30 Tage     crm-vor-*, make-orga-*, business-vor-*, kategorien-vor-* — andere Archiv-Dateien
//                                          bleiben (dokumentiert, nie automatisch)
//   Altbestand Netzwerk        24 Monate   KEINE automatische Löschung — zählt in die Löschfrist-Aufgabe (stilllegen)
//   Grabsteine                 13 Monate   außerhalb des Datenordners; länger als jede Sicherung (lib/datenschutz/grabsteine.ts)
//   Bauplan-Bildschirmfotos    90 Tage     ab Abschluss der Karte (fertig/verworfen); nicht zugeordnete nach 7 Tagen
//   Löschprotokoll             36 Monate   abgeschlossene Einträge (laufende/unvollständige bleiben)
//   Pannen-Register            36 Monate   ab Abschluss der Panne (lib/datenschutz/pannen.ts)
//   Sicherungen                bis 12 Mon. fest — Generationen der Nachtsicherung (deploy/generationen.sh: 14 Tages-, 8 Wochen-,
//                                          12 Monatsgenerationen), Tageskopien je Bestand (letzte 14 Schreibtage); „beyond use“,
//                                          Restore wendet die Grabsteine an (Wächter: tests/datenschutz-sicherungsfrist.test.ts)
//
// Keine Rechtsberatung — die Werte einmal anwaltlich gegenlesen.

import { letzterKontaktVon, type Kontakt, type Aktivitaet } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';
import { tagVon } from '@/lib/zeit';

export type FristArt = 'kontakte' | 'import-konflikte' | 'import-laeufe' | 'heads-replay' | 'signale' | 'aenderungsprotokoll' | 'aktivitaeten-geloeschte'
  | 'zoe-arbeitslisten' | 'zoe-entscheidungen' | 'zoe-verlauf' | 'zoe-gedaechtnis' | 'postfach-caches' | 'kalender-caches' | 'archiv-umzug' | 'netzwerk' | 'grabsteine' | 'sicherungen' | 'buchungen'
  // Netzwerken (03.10., netz-recht): Medien, Veranstaltungs-Kontakte ohne Interaktion, Gesprächs-Info, Übergabe-Protokolle.
  | 'netzwerken-karten' | 'netzwerken-sprachnotizen' | 'netzwerken-kontakte' | 'netzwerken-info' | 'uebergabe-protokolle'
  // Gmail in der Inbox (03.10., Branch gmail): der Mail-Spiegel je Person (Köpfe + Texte) — Gmail bleibt das Original.
  | 'mail-spiegel'
  // 05.10. (DSGVO-Grundlagen): Bildschirmfotos im Bauplan (können Personendaten zeigen).
  | 'bauplan-bilder'
  // 05.10. (Zusatz): das Löschprotokoll selbst und das Pannen-Register (Art. 33 Abs. 5).
  | 'loeschprotokoll' | 'pannen';
export type Einheit = 'tage' | 'monate';

export interface FristDef {
  id: FristArt; titel: string; einheit: Einheit; standard: number; min: number; max: number;
  /** automatisch bereinigt (technischer Bestand) — sonst nur eine Aufgabe (Personen) bzw. fest (Art. 17). */
  wirkung: 'automatisch' | 'aufgabe' | 'fest';
  norm: string; hinweis: string;
  /** Anzeige statt der Zahl (nur `fest`, z. B. „bis zu 12 Monate“ für Sicherungen). */
  anzeige?: string;
}

/**
 * Generationen der verschlüsselten Nachtsicherung (Server und Zweitkopie) — MUSS zu `generationen_aufraeumen … 14 8 12` in
 * deploy/sicherung.sh und deploy/sicherung-abholen.sh passen (Wächter: tests/datenschutz-sicherungsfrist.test.ts, der auch prüft,
 * dass die Grabstein-Frist länger ist als die älteste behaltene Generation).
 */
export const SICHERUNG_GENERATIONEN = { taeglich: 14, woechentlich: 8, monatlich: 12 } as const;
/** EIN Satz für Löschkonzept, Auskunft, Hinweise an Kontakte und Verzeichnis — wahrheitsgemäß zu den Generationen oben. */
export const SICHERUNG_SATZ = `Verschlüsselte Sicherungen bewahren wir bis zu ${SICHERUNG_GENERATIONEN.monatlich} Monate auf (${SICHERUNG_GENERATIONEN.taeglich} Tages-, ${SICHERUNG_GENERATIONEN.woechentlich} Wochen- und ${SICHERUNG_GENERATIONEN.monatlich} Monatsstände), danach werden sie überschrieben. Gelöschte Daten können bis dahin noch in einer Sicherung stehen, werden dort aber nicht mehr verwendet; wird eine Sicherung zurückgespielt, werden sie sofort erneut gelöscht (über Löschvermerke, die außerhalb der Sicherungen liegen).`;

export const LOESCHFRISTEN: readonly FristDef[] = [
  { id: 'kontakte', titel: 'Kontakte ohne Beziehung und Aktivität', einheit: 'monate', standard: 24, min: 6, max: 120, wirkung: 'aufgabe', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Nie automatisch gelöscht: der Takt legt eine Aufgabe an — löschen oder mit Grund verlängern.' },
  { id: 'import-konflikte', titel: 'Import-Konflikte', einheit: 'tage', standard: 90, min: 7, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Offene Konflikte eines Imports, der älter ist, fallen weg — der nächste Import legt sie neu vor.' },
  { id: 'import-laeufe', titel: 'Import-Läufe (Rückgängig)', einheit: 'tage', standard: 30, min: 1, max: 90, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Vorher-Stände für „Import rückgängig“.' },
  { id: 'heads-replay', titel: 'Heads-Replay (Datenpakete für Evals)', einheit: 'tage', standard: 90, min: 7, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Gespeicherte Datenpakete der Heads-Läufe.' },
  { id: 'signale', titel: 'Signale (Betreff, Termintitel)', einheit: 'monate', standard: 12, min: 1, max: 60, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Der Text der Signal-Aktivität fällt weg, das Ereignis (Tag, Art) bleibt für die Kadenz.' },
  { id: 'aenderungsprotokoll', titel: 'Änderungsprotokoll', einheit: 'monate', standard: 36, min: 12, max: 120, wirkung: 'automatisch', norm: 'Art. 5 Abs. 2, Art. 32 DSGVO', hinweis: 'Monatsdateien älter als die Frist werden geleert (ohne Werte, nur Kennungen).' },
  { id: 'aktivitaeten-geloeschte', titel: 'Aktivitäten-Texte bei gelöschten Personen', einheit: 'tage', standard: 0, min: 0, max: 0, wirkung: 'fest', norm: 'Art. 17 DSGVO', hinweis: 'Sofort mit der Löschung — über alle Speicher (lib/crm/person-bestaende.ts).' },
  // 29.09. (Paket D-B #73/#93)
  { id: 'zoe-arbeitslisten', titel: 'ZOE-Protokoll und entschiedene Vorschläge', einheit: 'tage', standard: 90, min: 30, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Arbeitslisten von ZOE (Kennungen und Feldnamen). Die Entscheidung selbst bleibt in den ZOE-Entscheidungen.' },
  { id: 'zoe-entscheidungen', titel: 'ZOE-Entscheidungen (dauerhaft)', einheit: 'monate', standard: 36, min: 12, max: 120, wirkung: 'automatisch', norm: 'Art. 5 Abs. 2 DSGVO', hinweis: 'Monatsdateien älter als die Frist werden geleert (Vermerk bleibt).' },
  { id: 'zoe-verlauf', titel: 'Gespräche mit ZOE', einheit: 'monate', standard: 12, min: 1, max: 60, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Gespräche, deren letzte Nachricht älter ist, fallen weg.' },
  { id: 'zoe-gedaechtnis', titel: 'ZOE-Gedächtnis (Fakten)', einheit: 'monate', standard: 24, min: 6, max: 120, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. d, e DSGVO', hinweis: 'Fakten, die so lange nicht erneuert wurden, fallen weg.' },
  { id: 'postfach-caches', titel: 'Postfach-Zwischenspeicher', einheit: 'tage', standard: 30, min: 7, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Zwischengespeicherte Mails (Absender, Betreff, Vorschau) und Einstufungen — das Postfach selbst bleibt beim Anbieter.' },
  { id: 'kalender-caches', titel: 'Kalender-Zwischenspeicher', einheit: 'monate', standard: 12, min: 1, max: 60, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Vergangene Termine im Zwischenspeicher — der Kalender selbst bleibt beim Anbieter.' },
  { id: 'archiv-umzug', titel: 'Umzugs- und Aufräum-Kopien im Archiv', einheit: 'tage', standard: 30, min: 7, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Kopien vor Umzügen und Aufräumarbeiten (CRM vor Brain-Umzug, Kennungs-Umzug, Firmen zusammenführen, MAKE.ORGA, Business, Kategorien). Andere Archiv-Dateien bleiben — nie automatisch.' },
  { id: 'netzwerk', titel: 'Altbestand Netzwerk (vor der Kartei)', einheit: 'monate', standard: 24, min: 6, max: 120, wirkung: 'aufgabe', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Nie automatisch: Einträge ohne Kontakt seit der Frist zählen in die Löschfrist-Aufgabe. Der Altbestand wird stillgelegt (in die Kartei übernehmen oder löschen).' },
  { id: 'grabsteine', titel: 'Grabsteine gelöschter Personen', einheit: 'monate', standard: 13, min: 13, max: 120, wirkung: 'automatisch', norm: 'Art. 17, Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Fingerabdrücke außerhalb des Datenordners — länger als jede Sicherung (bis zu 12 Monate), damit ein Restore niemanden zurückholt. Die Sperrliste bleibt.' },
  // 29.09. (K4): Terminbuchungen der öffentlichen Buchungsseiten.
  { id: 'buchungen', titel: 'Terminbuchungen (Buchungsseiten)', einheit: 'tage', standard: 30, min: 7, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Nicht bestätigte, abgelehnte, abgesagte und abgelaufene Buchungen fallen nach der Frist weg, bestätigte die Frist nach dem Termin — Anfrage und Aktivität im CRM bleiben (dort gilt die Frist der Kartei).' },
  // 03.10. (netz-recht): Erfassungs-Daten von „Netzwerken“ — Medien und Info automatisch, Personen nie.
  { id: 'netzwerken-karten', titel: 'Netzwerken: Fotos der Visitenkarten', einheit: 'monate', standard: 6, min: 1, max: 36, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Das Foto war die Vorlage für die Felder in der Kartei — es fällt nach der Frist samt verschlüsselter Datei weg (ab Erfassung).' },
  { id: 'netzwerken-sprachnotizen', titel: 'Netzwerken: Sprachnotizen', einheit: 'tage', standard: 90, min: 7, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Eigene Gesprächsnotiz (Stimme, Inhalt): fällt nach der Frist samt verschlüsselter Datei weg. Eine Abschrift (KI) ersetzt sie erst, wenn sie eingeschaltet ist.' },
  { id: 'netzwerken-kontakte', titel: 'Netzwerken: Kontakte ohne weitere Interaktion', einheit: 'monate', standard: 12, min: 6, max: 60, wirkung: 'aufgabe', norm: 'Art. 5 Abs. 1 lit. e DSGVO', hinweis: 'Nie automatisch gelöscht: Personen aus Netzwerken ohne Beziehung, Deal und Aktivität seit der Frist zählen in die Löschfrist-Aufgabe (prüfen: löschen oder begründen).' },
  { id: 'netzwerken-info', titel: 'Netzwerken: Gesprächs-Info und Zielpersonen', einheit: 'monate', standard: 12, min: 3, max: 60, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Info zum Gespräch (Teilnahme) und die Personen auf der Zielliste eines Events fallen 12 Monate nach dem Event weg — Teilnahme, Termin und Kennzahlen bleiben.' },
  { id: 'uebergabe-protokolle', titel: 'Übergabe-Protokolle (Kunden-Events)', einheit: 'monate', standard: 36, min: 12, max: 120, wirkung: 'automatisch', norm: 'Art. 5 Abs. 2, Art. 15, Art. 19 DSGVO', hinweis: 'Nachweis, wann welche Personen an welchen Kunden übergeben wurden (am Event bzw. im Übergabe-Journal) — danach weg.' },
  // 03.10. (gmail): Gmail-Spiegel je Person — nur eine Kopie zum Lesen/Zuordnen/Antworten in MAKE OS; das Original bleibt bei Google.
  { id: 'mail-spiegel', titel: 'Mail-Spiegel (Gmail in der Inbox)', einheit: 'tage', standard: 180, min: 30, max: 730, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Kopie der Gmail-Nachrichten je Person (Kopf, Ausschnitt, Text) — ältere fallen im Spiegel weg, in Gmail bleiben sie (dort gilt die Aufbewahrung des Postfachs). Anhänge liegen nie im Spiegel.' },
  // 05.10. (DSGVO-Grundlagen): Bildschirmfotos im Bauplan — lib/bauplan/bilder-frist.ts.
  { id: 'bauplan-bilder', titel: 'Bauplan: Bildschirmfotos', einheit: 'tage', standard: 90, min: 7, max: 365, wirkung: 'automatisch', norm: 'Art. 5 Abs. 1 lit. c, e DSGVO', hinweis: 'Bildschirmfotos können Personendaten zeigen: an fertigen oder verworfenen Karten fallen sie nach der Frist ab Abschluss weg, nicht zugeordnete nach 7 Tagen; an offenen Karten bleiben sie.' },
  { id: 'loeschprotokoll', titel: 'Löschprotokoll (Nachweis der Löschungen)', einheit: 'monate', standard: 36, min: 12, max: 120, wirkung: 'automatisch', norm: 'Art. 5 Abs. 2, Art. 17 DSGVO', hinweis: 'Nur Protokoll-ID, Tag, Grund, wer — abgeschlossene Einträge fallen nach der Frist weg; laufende/unvollständige bleiben, bis sie fertig sind.' },
  { id: 'pannen', titel: 'Pannen-Register (Datenpannen, Art. 33 Abs. 5)', einheit: 'monate', standard: 36, min: 12, max: 120, wirkung: 'automatisch', norm: 'Art. 33 Abs. 5, Art. 5 Abs. 2 DSGVO', hinweis: 'Abgeschlossene Pannen fallen nach der Frist ab Abschluss weg (Frist anwaltlich bestätigen, datenschutz/DATENPANNEN.md); offene bleiben.' },
  // 05.10. (DSGVO-Grundlagen): vorher „14 Tage“ — falsch, die Nachtsicherung hält Generationen bis ~12 Monate (deploy/generationen.sh).
  { id: 'sicherungen', titel: 'Sicherungen (Tages-, Wochen-, Monatsgenerationen)', einheit: 'monate', standard: SICHERUNG_GENERATIONEN.monatlich, min: SICHERUNG_GENERATIONEN.monatlich, max: SICHERUNG_GENERATIONEN.monatlich, wirkung: 'fest', anzeige: `bis zu ${SICHERUNG_GENERATIONEN.monatlich} Monate`, norm: 'Art. 5 Abs. 1 lit. e, Art. 17, Art. 32 DSGVO', hinweis: SICHERUNG_SATZ },
];

export type Fristen = Record<FristArt, number>;
/** Nur die Abweichungen vom Standard (so steht es im Bestand). */
export type FristenGespeichert = Partial<Record<FristArt, number>>;

export const LOESCHFRISTEN_SPEICHER = 'crm-loeschfristen';
export interface LoeschfristenBestand {
  fristen?: FristenGespeichert;
  /** Tagesmarke des Takt-Laufs und was er getan hat (nur Zahlen). */
  lauf?: { tag: string; am: string; ueberFrist: number; bereinigt: Record<string, number> };
}

const def = (id: FristArt) => LOESCHFRISTEN.find(f => f.id === id)!;

/** Wirksame Fristen: Standard, überschrieben von den gespeicherten Abweichungen (nur gültige). */
export function fristenWirksam(gespeichert?: FristenGespeichert | null): Fristen {
  const out = {} as Fristen;
  for (const f of LOESCHFRISTEN) {
    const v = gespeichert?.[f.id];
    out[f.id] = f.wirkung !== 'fest' && typeof v === 'number' && Number.isInteger(v) && v >= f.min && v <= f.max ? v : f.standard;
  }
  return out;
}

/**
 * Eine Änderung prüfen und das zu Speichernde bilden: nur bekannte, einstellbare Arten, ganze Zahlen im Rahmen;
 * `null` = zurück auf Standard. Ein Wert gleich dem Standard wird NICHT gespeichert (Standard nie im Bestand).
 */
export function fristenSpeichern(alt: FristenGespeichert | undefined, aenderung: unknown): { ok: true; fristen: FristenGespeichert } | { ok: false; fehler: string } {
  if (!aenderung || typeof aenderung !== 'object' || Array.isArray(aenderung)) return { ok: false, fehler: 'fristen: Objekt je Datenart erwartet.' };
  const out: FristenGespeichert = { ...(alt ?? {}) };
  for (const [id, v] of Object.entries(aenderung as Record<string, unknown>)) {
    const f = LOESCHFRISTEN.find(x => x.id === id);
    if (!f) return { ok: false, fehler: `Unbekannte Datenart: ${id}.` };
    if (f.wirkung === 'fest') return { ok: false, fehler: `${f.titel}: fest (${f.norm}), nicht einstellbar.` };
    if (v === null || v === f.standard) { delete out[f.id]; continue; }
    const n = Number(v);
    if (!Number.isInteger(n) || n < f.min || n > f.max) return { ok: false, fehler: `${f.titel}: ${f.min}–${f.max} ${f.einheit === 'monate' ? 'Monate' : 'Tage'}.` };
    out[f.id] = n;
  }
  return { ok: true, fristen: out };
}

/** Anzeige „24 Monate“, „90 Tage“, „sofort“. */
export function fristText(id: FristArt, wert: number): string {
  if (def(id).anzeige) return def(id).anzeige!;
  if (def(id).wirkung === 'fest' || wert === 0) return 'sofort';
  const monate = def(id).einheit === 'monate';
  return `${wert} ${monate ? (wert === 1 ? 'Monat' : 'Monate') : (wert === 1 ? 'Tag' : 'Tage')}`;
}

// ── Grenzen ──────────────────────────────────────────────────────────────────

const TAG = /^\d{4}-\d{2}-\d{2}/;
/** `heute` minus n Monate, am Monatsende gekappt (31.03. − 1 Monat = 28./29.02.). */
export function monateZurueck(heute: string, n: number): string {
  const [j, m, t] = heute.slice(0, 10).split('-').map(Number);
  const gesamt = j * 12 + (m - 1) - n;
  const jj = Math.floor(gesamt / 12), mm = gesamt % 12;
  const letzter = new Date(Date.UTC(jj, mm + 1, 0)).getUTCDate();
  return `${String(jj).padStart(4, '0')}-${String(mm + 1).padStart(2, '0')}-${String(Math.min(t, letzter)).padStart(2, '0')}`;
}
export function tageZurueck(heute: string, n: number): string {
  const d = new Date(`${heute.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
/** Der Stichtag einer Frist: älter (kleiner) als dieser Tag ist über der Frist. */
export function stichtag(id: FristArt, wert: number, heute: string): string {
  return def(id).einheit === 'monate' ? monateZurueck(heute, wert) : tageZurueck(heute, wert);
}

// ── Kontakte über der Frist (nie automatisch löschen) ─────────────────────────

/** Tag eines Zeitpunkts (ISO mit Zone → UTC-Tag reicht für eine Frist in Monaten; Tag bleibt Tag). */
const tagAus = (v?: string) => (v && TAG.test(v) ? v.slice(0, 10) : undefined);
/** Menschliche Aktivität (nicht vom System) — nur sie zählt als „Aktivität“ für die Frist. */
const menschlich = (a: Aktivitaet) => a.von !== 'system' && a.art !== 'system' && a.art !== 'uebergabe' && a.art !== 'stufe';

/** Die jüngste Spur der Person: letzter Kontakt, jüngste menschliche Aktivität (Ereignis- vor Erfassungszeit), Import. */
export function letzteSpur(k: Kontakt, heute: string): string {
  const l = [letzterKontaktVon(k, heute), tagAus(k.importiertAm), tagAus(k.geprueftAm),
    ...(k.aktivitaeten ?? []).filter(menschlich).map(a => tagAus(a.wann) ?? tagAus(a.am))].filter((x): x is string => !!x && x <= heute);
  return l.sort().pop() ?? heute;
}

export interface UeberFrist { id: string; seit: string }

/**
 * Personen ohne Beziehung und ohne Aktivität seit der Frist. Nie darunter: Kunden/Ex-Kunden/Partner/Multiplikatoren
 * (Lebensphase oder Rolle), Personen in einem Mandat oder offenen Deal, eingeschränkte Personen (Art. 18 heißt
 * „aufbewahren“) und Personen mit gültiger Fristverlängerung. Werbesperren zählen mit — die Sperre überlebt die
 * Löschung auf der gehashten Sperrliste.
 */
export function kontakteUeberFrist(kontakte: Kontakt[], crm: Pick<CrmBestand, 'mandate' | 'chancen'> | null | undefined, heute: string, monate: number): UeberFrist[] {
  const grenze = monateZurueck(heute, monate);
  const inMandat = new Set((crm?.mandate ?? []).flatMap(m => m.kontaktIds ?? []));
  const inDeal = new Set((crm?.chancen ?? []).filter(c => c.stufe !== 'gewonnen' && c.stufe !== 'verloren').flatMap(c => c.kontaktIds ?? []));
  const BEZIEHUNG = ['kunde', 'ex_kunde', 'partner', 'multiplikator'];
  const raus: UeberFrist[] = [];
  for (const k of kontakte) {
    if (BEZIEHUNG.includes(k.lebensphase ?? '') || (k.rollen ?? []).some(r => r === 'partner' || r === 'multiplikator' || r === 'investor')) continue;
    if (inMandat.has(k.id) || inDeal.has(k.id) || k.eingeschraenkt) continue;
    if (k.loeschfristVerlaengert && k.loeschfristVerlaengert.bis >= heute) continue;
    const seit = letzteSpur(k, heute);
    if (seit < grenze) raus.push({ id: k.id, seit });
  }
  return raus.sort((a, b) => a.seit.localeCompare(b.seit));
}

/** Eine Fristverlängerung prüfen (Grund Pflicht, bis höchstens 36 Monate ab heute). */
export function verlaengerungPruefen(roh: { bis?: unknown; grund?: unknown }, heute: string): { ok: true; bis: string; grund: string } | { ok: false; fehler: string } {
  const grund = String(roh.grund ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const bis = String(roh.bis ?? '');
  if (grund.length < 3) return { ok: false, fehler: 'Frist verlängern nur mit Grund.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bis) || bis <= heute) return { ok: false, fehler: 'bis: ein Tag nach heute.' };
  const spaetestens = monateZurueck(heute, -36);
  if (bis > spaetestens) return { ok: false, fehler: `Höchstens bis ${spaetestens} (36 Monate).` };
  return { ok: true, bis, grund };
}

// ── Technische Bestände (automatisch) ────────────────────────────────────────

/** Signal-Aktivität (Mail-Betreff/Termintitel aus lib/crm/signale.ts): vom System, Bezug mail-/termin-. */
export const istSignal = (a: Pick<Aktivitaet, 'von' | 'bezug'>) => a.von === 'system' && /^(mail|termin)-/.test(a.bezug ?? '');

/** Signal-Texte älter als die Frist entfernen — das Ereignis (am, art, bezug) bleibt. Liefert die Zahl der geleerten. */
export function signalTexteBereinigen(k: Kontakt, grenze: string): { kontakt: Kontakt; n: number } {
  let n = 0;
  const aktivitaeten = (k.aktivitaeten ?? []).map(a => {
    if (!istSignal(a) || !a.text || (a.am.slice(0, 10) >= grenze)) return a;
    n++;
    const { text: _t, ...rest } = a;
    return rest;
  });
  return n ? { kontakt: { ...k, aktivitaeten }, n } : { kontakt: k, n: 0 };
}

/** Replay-Fälle älter als die Frist raus (Zeitpunkt `zeit`, ISO). */
export function replayBereinigen<F extends { zeit: string }>(faelle: F[], grenze: string): { faelle: F[]; n: number } {
  const bleiben = faelle.filter(f => (f.zeit ?? '').slice(0, 10) >= grenze);
  return { faelle: bleiben, n: faelle.length - bleiben.length };
}

/** Monatsdateien (JJJJ-MM) des Änderungsprotokolls, die ganz vor dem Stichtag liegen. */
export function protokollMonateUeberFrist(monate: string[], grenze: string): string[] {
  const grenzMonat = grenze.slice(0, 7);
  return monate.filter(m => /^\d{4}-\d{2}$/.test(m) && m < grenzMonat).sort();
}

// ── Weitere technische Bestände (29.09., Paket D-B) — rein ─────────────────────

/** Tag eines Zeitstempels (ISO), leer wenn unbrauchbar. */
const tagIso = (v: unknown) => (typeof v === 'string' && TAG.test(v) ? v.slice(0, 10) : '');

/** Einträge einer Liste, deren Tag (`feld`) vor der Grenze liegt, fallen weg; ohne Datum bleiben sie. */
export function vorGrenzeRaus<T>(liste: readonly T[] | undefined, grenze: string, tagVon: (x: T) => unknown): { liste: T[]; n: number } {
  const l = Array.isArray(liste) ? liste : [];
  const rest = l.filter(x => { const t = tagIso(tagVon(x)); return !t || t >= grenze; });
  return { liste: rest.length === l.length ? [...l] : rest, n: l.length - rest.length };
}

/** Archiv-Datei eine Umzugs-/Aufräum-Kopie? (lib/store/archiv.ts-Aufrufer: crm-vor-* — auch Brain-Umzug, Kennungs-Umzug, Firmen zusammenführen —, make-orga-*, business-vor-*, kategorien-vor-*) */
export const istUmzugsKopie = (datei: string) => /^(crm-vor-|make-orga-|business-vor-|kategorien-vor-)[a-z0-9._-]*\.json$/i.test(datei);

/** Tag einer Archiv-Datei aus dem Namen (ISO-Zeit oder Millisekunden) — null, wenn keiner drinsteht. */
export function archivTag(datei: string): string | null {
  const iso = /(\d{4}-\d{2}-\d{2})T\d{2}-\d{2}/.exec(datei);
  if (iso) return iso[1];
  const ms = /-(\d{13})\.json$/i.exec(datei);
  if (ms) { const d = new Date(Number(ms[1])); return Number.isNaN(d.getTime()) ? null : tagVon(d.toISOString()); }
  return null;
}

/** Netzwerk-Altbestand über der Frist: ohne letzten Kontakt seit der Grenze (nie automatisch löschen). */
export function netzwerkUeberFrist(kontakte: readonly { letzterKontakt?: string }[] | undefined, heute: string, monate: number): number {
  const grenze = monateZurueck(heute, monate);
  return (kontakte ?? []).filter(k => !k.letzterKontakt || k.letzterKontakt < grenze).length;
}
