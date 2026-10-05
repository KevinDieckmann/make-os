// ─── Information nach Art. 14 DSGVO — Vorlage, Platzhalter, Frist (05.10., Paket „Betroffenenrechte v2“, rein, getestet) ──
// Kontakte, deren Daten NICHT bei ihnen selbst erhoben wurden (Recherche, Liste/Import, Empfehlung — `Kontakt.fremddaten`), müssen
// spätestens nach einem Monat informiert werden (Art. 14 Abs. 3 lit. a), bei einer Mitteilung an sie spätestens dann (lit. b).
// Der Weg in MAKE OS: Vorlage (Einrichtung, sonst `ART14_STANDARD`) → Entwurf mit den Werten der Person → die Person des Haushalts
// öffnet ihn im Mail-Programm und schickt ihn selbst (Einzelklick, NIE automatisch) → „ist raus“ setzt `art14InformiertAm` (Server).
// Die Uhr (`art14Frist`) zählt ab der Aufnahme (`importiertAm`); die Selbstprüfung meldet „bald fällig“ ab Tag 25 und „überfällig“ nach
// einem Monat. Hinweis, keine Rechtsberatung — den Text einmal anwaltlich gegenlesen.

import type { Kontakt } from '@/lib/make-one/crm';
import { HERKUNFT } from '@/lib/make-one/crm';

/** Platzhalter der Vorlage — die Oberfläche zeigt sie zum Einfügen. */
export const ART14_PLATZHALTER = {
  anrede: 'Anrede mit Namen („Sehr geehrte/r …“ bzw. „Hallo …“)',
  name: 'Vor- und Nachname',
  herkunft: 'Woher die Daten stammen',
  verantwortlicher: 'Name, Anschrift und Mail des Verantwortlichen',
  kontakt: 'Kontakt für Datenschutzfragen (Datenschutzbeauftragter, sonst Kontakt-Mail)',
  datenschutzseite: 'Adresse des Datenschutzhinweises',
  empfaenger: 'Empfänger (Dienstleister) mit Drittland',
  frist: 'Speicherdauer der Kontaktdaten',
} as const;
export type Art14Platzhalter = keyof typeof ART14_PLATZHALTER;

export const ART14_STANDARD: { betreff: string; text: string } = {
  betreff: 'Information zum Datenschutz: Ihre Kontaktdaten bei uns',
  text: [
    '{{anrede}}',
    '',
    'wir haben Ihre geschäftlichen Kontaktdaten ({{name}}, Firma, Funktion und dienstliche Erreichbarkeit) nicht bei Ihnen selbst erhoben, sondern aus folgender Quelle: {{herkunft}}. Deshalb informieren wir Sie nach Art. 14 DSGVO:',
    '',
    'Verantwortlich: {{verantwortlicher}}. Kontakt für Datenschutzfragen: {{kontakt}}.',
    'Zweck und Rechtsgrundlage: Pflege geschäftlicher Kontakte und Anbahnung einer möglichen Zusammenarbeit auf Grundlage unseres berechtigten Interesses (Art. 6 Abs. 1 lit. f DSGVO). Werbung per E-Mail senden wir nur mit Ihrer Einwilligung.',
    'Empfänger: technische Dienstleister, die in unserem Auftrag arbeiten — {{empfaenger}}.',
    'Speicherdauer: {{frist}}.',
    'Automatisierte Entscheidungen: keine. Eine Punktewertung hilft uns nur bei der Reihenfolge, entschieden wird immer von Menschen.',
    '',
    'Ihre Rechte: Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch gegen die Verarbeitung (Art. 15–18, 20, 21 DSGVO) sowie Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO). Wenn Sie nicht mehr von uns hören möchten, genügt eine kurze Antwort auf diese Mail.',
    'Mehr: {{datenschutzseite}}',
  ].join('\n'),
};

export const ART14_GRENZEN = { betreff: 160, text: 6000 } as const;

/** Vorlage aus der Einrichtung prüfen (Inhaber, Server und Formular). */
export function art14VorlagePruefen(roh: unknown): { ok: true; v: { betreff: string; text: string } } | { ok: false; fehler: string } {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, fehler: 'Vorlage: Objekt erwartet.' };
  const r = roh as Record<string, unknown>;
  const betreff = String(r.betreff ?? '').replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();
  const text = String(r.text ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F]/g, ' ').trim();
  if (betreff.length < 3 || betreff.length > ART14_GRENZEN.betreff) return { ok: false, fehler: `Betreff: 3–${ART14_GRENZEN.betreff} Zeichen.` };
  if (text.length < 40 || text.length > ART14_GRENZEN.text) return { ok: false, fehler: `Text: 40–${ART14_GRENZEN.text} Zeichen.` };
  // Ohne Verantwortlichen und Quelle ist es keine Information nach Art. 14 (Abs. 1 lit. a, Abs. 2 lit. f).
  if (!text.includes('{{verantwortlicher}}')) return { ok: false, fehler: 'Der Text braucht den Platzhalter {{verantwortlicher}} (Art. 14 Abs. 1 lit. a).' };
  if (!text.includes('{{herkunft}}')) return { ok: false, fehler: 'Der Text braucht den Platzhalter {{herkunft}} (Art. 14 Abs. 2 lit. f).' };
  const unbekannt = Array.from(text.matchAll(/\{\{\s*([a-z]+)\s*\}\}/gi)).map(m => m[1]).filter(n => !(n in ART14_PLATZHALTER));
  if (unbekannt.length) return { ok: false, fehler: `Unbekannte Platzhalter: ${Array.from(new Set(unbekannt)).map(n => `{{${n}}}`).join(', ')}.` };
  return { ok: true, v: { betreff, text } };
}

/** Platzhalter füllen — unbekannte bzw. leere bleiben nie als `{{…}}` stehen. */
export function art14Fuellen(vorlage: { betreff: string; text: string }, werte: Partial<Record<Art14Platzhalter, string>>): { betreff: string; text: string } {
  const f = (t: string) => t.replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (_m, n: string) => (werte as Record<string, string | undefined>)[n]?.trim() || '—');
  return { betreff: f(vorlage.betreff), text: f(vorlage.text) };
}

/** Herkunft der Daten als Satz für Art. 14 Abs. 2 lit. f. */
export function herkunftSatz(k: Pick<Kontakt, 'herkunft' | 'quelle' | 'vorgestelltDurch'>): string {
  const h = HERKUNFT.find(x => x.id === k.herkunft)?.label;
  const teile = [h, k.quelle?.trim(), k.herkunft === 'empfehlung' && k.vorgestelltDurch ? 'Empfehlung aus unserem Netzwerk' : undefined].filter((x): x is string => !!x);
  return teile.length ? Array.from(new Set(teile)).join(' · ') : 'öffentlich zugängliche Quellen bzw. Unterlagen aus unserem Geschäftsverkehr';
}

/** Anrede mit Namen — Sie/Du wie am Kontakt. */
export function anredeSatz(k: Pick<Kontakt, 'vorname' | 'nachname' | 'anrede'>): string {
  const v = (k.vorname ?? '').trim(), n = (k.nachname ?? '').trim();
  if (k.anrede === 'Du') return `Hallo ${v || n || ''},`.replace(' ,', ',');
  return n || v ? `Guten Tag ${[v, n].filter(Boolean).join(' ')},` : 'Guten Tag,';
}

const TAG_MS = 86_400_000;
/** Ein Monat nach dem Tag (Monatsende gekappt) — JJJJ-MM-TT. */
export function einMonatNach(tag: string): string {
  const [j, m, t] = tag.slice(0, 10).split('-').map(Number);
  const g = j * 12 + (m - 1) + 1, jj = Math.floor(g / 12), mm = g % 12;
  const letzter = new Date(Date.UTC(jj, mm + 1, 0)).getUTCDate();
  return `${jj}-${String(mm + 1).padStart(2, '0')}-${String(Math.min(t, letzter)).padStart(2, '0')}`;
}

/** Ab diesem Tag gilt die Information als „bald fällig“ (Selbstprüfung, Glocke). */
export const ART14_WARN_TAGE = 25;

export type Art14Stand = { pflicht: false } | { pflicht: true; informiertAm: string } | { pflicht: true; informiertAm?: undefined; seit: string; bis: string; tage: number; stufe: 'offen' | 'bald' | 'ueberfaellig' };

/** Die Art.-14-Uhr einer Person (rein). Pflicht = Daten nicht bei der Person erhoben (`fremddaten` oder Herkunft Recherche/Empfehlung). */
export function art14Frist(k: Pick<Kontakt, 'fremddaten' | 'herkunft' | 'art14InformiertAm' | 'importiertAm'>, heute: string): Art14Stand {
  const fremd = !!k.fremddaten || !!HERKUNFT.find(x => x.id === k.herkunft)?.fremd;
  if (!fremd) return { pflicht: false };
  if (k.art14InformiertAm) return { pflicht: true, informiertAm: k.art14InformiertAm };
  const seit = (k.importiertAm || heute).slice(0, 10);
  const bis = einMonatNach(seit);
  const tage = Math.max(0, Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${seit}T12:00:00Z`)) / TAG_MS));
  return { pflicht: true, seit, bis, tage, stufe: heute > bis ? 'ueberfaellig' : tage >= ART14_WARN_TAGE ? 'bald' : 'offen' };
}
