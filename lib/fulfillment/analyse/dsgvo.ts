// ─── Fulfillment · Analyse — Datenschutz der Personenrecherche (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.4/4.5, FAKTEN_TRANSFORMATION §8) — rein ──────
// Entscheidung 10.10. (22:30): MAKE ist für die berufliche Personenrecherche EIGENER Verantwortlicher (berechtigtes Interesse, Art. 6 Abs. 1 lit. f),
// Interessenabwägung je Dossier dokumentiert, Art.-14-Hinweis durch MAKE, Löschfrist Mandatsende + 90 Tage (einstellbar). Hier stehen:
//   · die Negativliste als Muster (je Treffer die KATEGORIE — nie der Wortlaut) für Ausgabe-Säuberung und deterministische Prüfung,
//   · die Muster-Texte für Interessenabwägung (LIA) und Art.-14-Hinweis (mit Platzhaltern; je Dossier bearbeitbar),
//   · die Art.-14-Uhr je Personenkarte und der Löschtag.
// Hinweis, keine Rechtsberatung — der Anwalt liest LIA- und Art.-14-Muster einmal gegen (Konzept Abschnitt 13). Rein und client-sicher.

import type { PersonenKarte } from '../typen';
import { einMonatNach, ART14_WARN_TAGE } from '@/lib/datenschutz/art14';
import { tagPlus } from '@/lib/zeit/kalender-kern';

export const RECHT_HINWEIS = 'Hinweis, keine Rechtsberatung — Interessenabwägung und Art.-14-Text liest der Anwalt einmal gegen.';

/** Woran ein Satz im Unternehmensteil eine Person erkennt (dann gelten auch die Personen-Muster — sonst wäre „Anbieter im Gesundheitswesen“ ein Fund). */
export const PERSON_BEZUG = /\b(?:geschäftsführ\w*|gründer\w*|gründerin|inhaber\w*|vorstand\w*|gesellschafter(?!vertrag|versammlung|liste)\w*|ceo|cfo|cto|coo|leiter\w*|herrn?|frau)\b/i;

/**
 * Negativliste als Muster (FT §8.4): Kategorie → Muster und wo es gilt. Im Personenteil gelten alle; im Unternehmensteil `immer` stets,
 * `mitPerson` nur in Sätzen mit Personenbezug (Funktion, Anrede, Verweis auf eine Karte), `nie` gar nicht (z. B. ein Datum der Gründung).
 * Ein Treffer liefert nur die KATEGORIE — nie den Wortlaut (er wird nicht gespeichert, nicht protokolliert).
 */
export const NEGATIV_MUSTER: readonly { kategorie: string; muster: RegExp; unternehmen: 'immer' | 'mitPerson' | 'nie' }[] = [
  { kategorie: 'Geburtsdatum', muster: /\b\d{1,2}\.\s?\d{1,2}\.\s?(?:19|20)\d{2}\b/, unternehmen: 'nie' },
  { kategorie: 'Geburtsdatum', muster: /\b(?:geb(?:oren|\.)\s*(?:am\s*|im\s*|in\s*)?\d|jahrgang\s*(?:19|20)\d{2}|\d{2}\s+jahre\s+alt)/i, unternehmen: 'mitPerson' },
  { kategorie: 'Wohnort', muster: /\b(?:wohnhaft|wohnt\s+in|wohnort|privatadresse|privatanschrift)\b/i, unternehmen: 'immer' },
  { kategorie: 'Familie', muster: /\b(?:verheiratet|ehefrau|ehemann|ehepartner\w*|lebensgefährt\w*|kinder|tochter|sohn|vater\s+von|mutter\s+von|familie)\b/i, unternehmen: 'mitPerson' },
  { kategorie: 'Gesundheit', muster: /\b(?:krank\w*|erkrank\w*|diagnose\w*|gesundheit\w*|behinder\w*|therapie\w*|klinik\w*|burn-?out|depression\w*|krebs)\b/i, unternehmen: 'mitPerson' },
  { kategorie: 'Religion', muster: /\b(?:religion\w*|konfession\w*|katholisch\w*|evangelisch\w*|muslim\w*|jüdisch\w*|kirchenmitglied\w*)\b/i, unternehmen: 'mitPerson' },
  { kategorie: 'Politische Meinung', muster: /\b(?:parteimitglied\w*|mitglied\s+der\s+partei|partei\w*|politisch\w*)\b/i, unternehmen: 'mitPerson' },
  { kategorie: 'Gewerkschaft', muster: /\bgewerkschaft\w*/i, unternehmen: 'mitPerson' },
  { kategorie: 'Sexuelle Orientierung', muster: /\b(?:homosexuell\w*|heterosexuell\w*|bisexuell\w*|queer|sexuelle\s+orientierung)\b/i, unternehmen: 'mitPerson' },
  { kategorie: 'Ethnische Herkunft', muster: /\b(?:ethnisch\w*|migrationshintergrund|abstammung)\b/i, unternehmen: 'mitPerson' },
  { kategorie: 'Vermögen einer Person', muster: /\b(?:privatvermögen|vermögen\s+von|immobilienbesitz|private[nr]?\s+schulden|privatinsolvenz|schuldnerverzeichnis|verbraucherinsolvenz)\b/i, unternehmen: 'immer' },
  { kategorie: 'Transparenzregister', muster: /transparenzregister/i, unternehmen: 'immer' },
];

/** Kategorie des ersten Treffers der Negativliste — oder null. `ort` = Personenteil (alle Muster) oder Unternehmensteil (siehe oben). */
export function negativTreffer(text: string, ort: 'person' | 'unternehmen', mitPerson = false): string | null {
  const t = String(text ?? '');
  const person = ort === 'person' || mitPerson || PERSON_BEZUG.test(t);
  for (const n of NEGATIV_MUSTER) {
    const gilt = ort === 'person' || n.unternehmen === 'immer' || (n.unternehmen === 'mitPerson' && person);
    if (gilt && n.muster.test(t)) return n.kategorie;
  }
  return null;
}

/** Muster der Interessenabwägung (FT §8.2) — je Dossier bearbeitbar; Pflicht für F1. */
export const LIA_MUSTER = {
  zweck: 'Vorbereitung der Vertriebsdiagnose und der Gespräche mit den Entscheidungsträgern des Mandanten im Rahmen des beauftragten Mandats.',
  erforderlichkeit: 'Nur Funktionen mit Entscheidungsgewalt, die der Mandant bestätigt hat; nur der berufliche Teil aus öffentlichen Quellen; kein milderes Mittel, weil die Gespräche ohne diese Vorbereitung nicht gezielt geführt werden können. Besser liefert der Mandant Hintergrund selbst — die Recherche beschränkt sich auf das Nötige.',
  abwaegung: 'Berufliche Rolle in einem Unternehmen, das Beratung beauftragt hat; Betroffene erwarten vernünftigerweise eine berufliche Informationseinholung. Keine besonderen Kategorien (Art. 9), keine privaten Angaben, keine automatisierte Entscheidung.',
  schutz: 'Datensparsamkeit (Positiv-/Negativliste), getrennter Personenteil mit Zugriff nur für Inhaber und Mitglieder mit vollem Zugang, Löschung 90 Tage nach Mandatsende, Art.-14-Hinweis spätestens beim ersten Kontakt bzw. binnen eines Monats, Prüfung vor Freigabe (F2).',
} as const;
export type LiaFeld = keyof typeof LIA_MUSTER;
export const LIA_FELDER: readonly LiaFeld[] = ['zweck', 'erforderlichkeit', 'abwaegung', 'schutz'];
export const LIA_MAX = 2000;

/** Muster des Art.-14-Hinweises (Vorbild lib/datenschutz/art14.ts `ART14_STANDARD`) — Platzhalter {{verantwortlicher}}, {{herkunft}}, {{funktion}}, {{frist}}. */
export const ART14_MUSTER = [
  'Information nach Art. 14 DSGVO',
  '',
  'Im Rahmen eines Beratungsmandats für Ihr Unternehmen haben wir berufliche Angaben zu Ihrer Funktion ({{funktion}}) aus öffentlichen Quellen zusammengetragen: {{herkunft}}.',
  'Verantwortlich: {{verantwortlicher}}.',
  'Zweck und Rechtsgrundlage: Vorbereitung der Vertriebsdiagnose und unserer Gespräche mit Ihnen; berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO). Wir verarbeiten nur berufliche Angaben, keine privaten.',
  'Speicherdauer: {{frist}}.',
  'Ihre Rechte: Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch (Art. 15–18, 21 DSGVO) sowie Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO). Eine kurze Nachricht an uns genügt.',
].join('\n');

/** Den Art.-14-Hinweis füllen (rein). Fehlende Werte bleiben als sichtbare Lücke „[…]“ stehen. */
export function art14Text(werte: { verantwortlicher?: string | null; herkunft?: string; funktion?: string; frist?: string }): string {
  const w: Record<string, string | undefined | null> = werte;
  return ART14_MUSTER.replace(/\{\{(verantwortlicher|herkunft|funktion|frist)\}\}/g, (_, k: string) => (w[k] && String(w[k]).trim()) || `[${k} fehlt]`);
}

/** Herkunft einer Karte für den Hinweis: die Domains ihrer Quellen (ohne Pfade). */
export const herkunftVon = (k: Pick<PersonenKarte, 'quellen'>): string =>
  [...new Set(k.quellen.map(q => q.domain ?? (q.unterlageId ? 'abgelegte Unterlagen' : null)).filter((x): x is string => !!x))].join(', ') || 'öffentliche Quellen';

export type Art14Stufe = 'gegeben' | 'offen' | 'bald' | 'ueberfaellig';
/** Die Art.-14-Uhr einer Karte (rein): fällig einen Monat nach Erfassung (bzw. erster Mitteilung), „bald“ ab Tag 25. */
export function art14Stand(k: Pick<PersonenKarte, 'art14' | 'erfasstAm'>, heute: string): { stufe: Art14Stufe; faelligAm: string; tage: number } {
  const seit = k.erfasstAm.slice(0, 10);
  const faelligAm = k.art14.faelligAm || einMonatNach(seit);
  const tage = Math.max(0, Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${seit}T12:00:00Z`)) / 86_400_000));
  if (k.art14.gegebenAm) return { stufe: 'gegeben', faelligAm, tage };
  return { stufe: heute > faelligAm ? 'ueberfaellig' : tage >= ART14_WARN_TAGE ? 'bald' : 'offen', faelligAm, tage };
}
export const art14FaelligAm = (erfasstAm: string): string => einMonatNach(erfasstAm.slice(0, 10));

/** Löschtag des Personenteils: Mandatsende + Frist (Tage); ohne Mandatsende null (läuft noch). */
export const loeschAmFuer = (mandatsEnde: string | null, tage: number): string | null => (mandatsEnde ? tagPlus(mandatsEnde.slice(0, 10), tage) : null);
