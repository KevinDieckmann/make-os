// ─── Art. 18 an EINER Stelle: die Kartei für die Verarbeitung (29.09., Paket D-B #72) ─
// Bis 29.09. galt die Einschränkung (Art. 18) an 27 Aufrufstellen von `ausgenommen()` — ein neuer Leser (Kampagne,
// Head, Export) konnte sie vergessen. Ab jetzt liest, wer VERARBEITET (Ansprache, Power Hour, Pakete an ein Modell,
// Exporte, ZOE), die Kartei nur hierüber: eingeschränkte Personen sind dann gar nicht erst da.
// Wer die GANZE Kartei braucht (sie verwaltet, schützt, auskunftet oder selbst mit Kennzeichnung filtert), steht mit
// Grund in `KONTAKTE_LESER_ERLAUBT` — der Wächtertest `tests/datenschutz-register.test.ts` wird rot bei jeder anderen
// Stelle mit `loadJson('kontakte')`.

import { loadJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { istEingeschraenkt } from './einschraenkung';

/** Nur Personen, deren Verarbeitung nicht eingeschränkt ist (Art. 18). Rein. */
export const nurVerarbeitbar = <K extends Pick<Kontakt, 'eingeschraenkt'>>(kontakte: readonly K[]): K[] => kontakte.filter(k => !istEingeschraenkt(k));

/**
 * Die Kartei für die Verarbeitung — eingeschränkte Personen fehlen. `mitEingeschraenkten` nur für Auskunft (Art. 15)
 * und ausdrückliche Exporte „mit eingeschränkten“ (dann markiert, nie still).
 */
export async function kontakteFuerVerarbeitung(opt: { mitEingeschraenkten?: boolean } = {}): Promise<Kontakt[]> {
  const alle = (await loadJson<{ kontakte?: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  return opt.mitEingeschraenkten ? alle : nurVerarbeitbar(alle);
}

/**
 * Stellen, die die Kartei direkt lesen dürfen — mit Grund. Neue Leser: `kontakteFuerVerarbeitung()` nehmen, nicht hier
 * eintragen (außer sie verwalten die Kartei selbst).
 */
export const KONTAKTE_LESER_ERLAUBT: Readonly<Record<string, string>> = {
  'lib/crm/verarbeitung.ts': 'Die eine Lesefunktion mit Pflicht-Filter.',
  // Verwalten, schützen, auskunften — brauchen jede Person, auch eingeschränkte (aufbewahren heißt: da sein).
  'app/api/state/kontakte/route.ts': 'Die Kartei-Route selbst (Anzeige mit Kennzeichnung, Bearbeiten gesperrt → 409).',
  'app/api/crm/bestand/route.ts': 'Bestand für die Oberfläche — eingeschränkte Personen erscheinen gekennzeichnet („eingeschränkter Kontakt“).',
  'app/api/crm/datenschutz/route.ts': 'Auskunft (Art. 15) und Löschung (Art. 17) — muss jede Person sehen; eingeschränkte werden aufbewahrt (409).',
  'app/api/crm/dubletten/route.ts': 'Dubletten-Prüfung — eingeschränkte Personen werden erkannt und nicht zusammengeführt (409).',
  'app/api/crm/import/route.ts': 'Import — Abgleich gegen die ganze Kartei (sonst entstünde eine eingeschränkte Person doppelt).',
  'app/api/crm/umzug/route.ts': 'Umzugs-Kopie des ganzen Bestands ins Archiv (Frist 30 Tage).',
  'app/api/crm/stammdaten/route.ts': 'Stammdaten › Datenschutz: Löschfristen, Verbindungsprüfung, Qualität — mit Kennzeichnung.',
  'app/api/state/aenderungen/route.ts': 'Fingerabdrücke im Änderungsprotokoll auflösen — nur Kennungen.',
  'lib/crm/loeschfristen-lauf.ts': 'Löschfristen — eingeschränkte Personen werden ausdrücklich nicht angefasst.',
  'lib/crm/person-bestaende.ts': 'Art. 15/17 über alle Speicher.',
  'lib/datenschutz/grabsteine.ts': 'Grabsteine nach einem Restore anwenden — jede Person der Kartei prüfen.',
  'lib/crm/verbindungen-laden.ts': 'Verbindungsprüfung — eingeschränkte Person in laufender Kampagne ist ein Befund.',
  'lib/crm/abgleich.ts': 'Firmen-Abgleich (Stammdaten-Pflege), keine Ansprache.',
  'lib/crm/speicher.ts': 'CRM-Schreibweg (aendereCrm) — Deal-Regeln prüfen Personen, auch eingeschränkte (Sperre).',
  'lib/crm/deal-anlegen.ts': 'Deal anlegen — lehnt eingeschränkte Personen selbst ab (Art. 18).',
  'lib/crm/lead-heben.ts': 'Lead → SQL — prüft die Einschränkung selbst.',
  'lib/crm/angebot-server.ts': 'Angebote — sperrt eingeschränkte Empfänger selbst (Art. 18).',
  'lib/crm/absichten-crm.ts': 'Absichtsprotokoll (Paket D-C) — prüft nach einem Abbruch nur, ob Import/Zusammenführung gewirkt hat (Kennungen, Fingerabdrücke).',
  'lib/crm/kennungen-umzug.ts': 'Kennungs-Umzug (Paket D-C #35) — stellt die Kennung JEDER Person um, auch eingeschränkter (keine Verarbeitung zur Ansprache).',
  'lib/zoe/crm-sicht.ts': 'ZOE-Sicht — blendet eingeschränkte Personen selbst aus (nur „n ausgeblendet“).',
  'lib/brain/app-index.ts': 'Such-Index — liest nur die Kennungen eingeschränkter Personen, um ihren Bezug auszuschließen.',
  'lib/brain/app-material.ts': 'App → Brain — liest nur die Kennungen eingeschränkter Personen, um sie auszublenden.',
  'lib/dateien/ablage.ts': 'Dateiablage — Einwilligungs-Belege sind nicht löschbar (auch bei eingeschränkten Personen).',
  'lib/dateien/aufgaben-ablage.ts': 'Aufgaben-Ablage — Einwilligungs-Belege sind nicht löschbar.',
  'app/api/aufgaben/crm/route.ts': 'CRM-Verweise einer Aufgabe — zeigt eingeschränkte Personen nur als solche.',
  'lib/business/speicher.ts': 'Business-Index — zählt nur (keine Ansprache, keine Inhalte).',
  // Filtern selbst mit `ausgenommen()` / eigener Art.-18-Regel (lib/crm/einschraenkung.ts, Liste oben dort).
  'app/api/crm/kampagnen/route.ts': 'Kampagnen — nimmt eingeschränkte Personen selbst raus und meldet sie in laufenden Kampagnen.',
  'app/api/crm/followup/route.ts': 'Follow-ups — Power Hour ohne eingeschränkte, Anzeige bestehender Follow-ups mit Kennzeichnung.',
  'app/api/crm/lead/route.ts': 'Qualifizierung — eingeschränkte raus (lib/crm/leads.ts).',
  'app/api/crm/suche/route.ts': 'Suche — zeigt eingeschränkte Personen mit Kennzeichnung (Auffinden ist keine Verarbeitung zur Ansprache).',
  'app/api/crm/netzwerk/route.ts': 'Vernetzen-Runde — eingeschränkte raus (lib/crm/netzwerk.ts).',
  'app/api/crm/marketing/route.ts': 'Marketing — Segmente/Newsletter nehmen eingeschränkte selbst raus (lib/crm/segmente.ts).',
  'app/api/crm/anfrage/route.ts': 'Eingehende Anfragen — auch einer eingeschränkten Person muss eine Anfrage zugeordnet werden können.',
  'app/api/crm/traktion/route.ts': 'Traktions-Index — nur Zahlen über den Bestand.',
  'app/api/heads/[head]/route.ts': 'Heads — Pakete ohne eingeschränkte Personen (lib/heads/*), Anzeige „eingeschränkter Kontakt“.',
  'app/api/heads/eval/route.ts': 'Heads-Bewertung gespeicherter Läufe — nur Zahlen, kein Modellaufruf mit Personen.',
  'lib/heads/lauf.ts': 'Heads-Lauf — Pakete ohne eingeschränkte Personen (ausgenommen), automatische Schritte prüfen die Sperre.',
};
