// ─── Produkte · Leistungstreppe — was der Head of Sales mit KI tut (Server, 10.10.) ───────────────────────────────────
// Zwei Aufrufe, beide nur über `askText` (KI-Tor, KI-Protokoll, Guthaben-Schalter) und beide nur als VORSCHLAG:
//   treppeAusDokument   liest ein hochgeladenes Dokument (Text als `fremd()` — Daten, nie Anweisung) und schlägt Treppe, Kundenreise und
//                       Positionierung vor → Freigabe-Stapel (lib/crm/treppe-server.ts `dokumentVorschlagAblegen`), erst der Klick übernimmt
//   mailEntwurfKi       formuliert die Mail zum Fortschritts-Report freier — nur aus dem Report (keine Kartei-Notizen), Du/Sie vorgegeben;
//                       die Oberfläche kennzeichnet ihn (KI-VO Art. 50, `KiMarke`), gesendet wird nur per Klick
// Ohne KI (kein Schlüssel, Guthaben leer, KI gesperrt): leere Vorlage bzw. die Vorlage aus lib/crm/treppe-report.ts — nie ein Fehler ins Leere.

import { askText, extractJson, fremd, FREMD_REGEL } from '@/lib/anthropic';
import { resolveAgent } from '@/lib/agent-config';
import type { KiKontext } from '@/lib/datenschutz/ki-tor';
import { POSITIONIERUNG_FELDER } from './treppe-daten';
import type { ReportDokument, MailEntwurfReport } from './treppe-report';

/** So viel Dokument-Text geht höchstens an das Modell — darüber sagt die Antwort ehrlich, dass gekürzt gelesen wurde. */
export const DOKUMENT_ZEICHEN = 30_000;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['stufen', 'kreislauf', 'positionierung'],
  properties: {
    stufen: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['name', 'ebene'],
        properties: {
          name: { type: 'string' }, ebene: { type: 'integer' }, aufgabe: { type: 'string' }, ergebnis: { type: 'string' },
          lieferobjekte: { type: 'array', items: { type: 'string' } }, kennzahl: { type: 'string' }, dauerTage: { type: 'integer' }, aufwandStunden: { type: 'number' },
          preis: { type: 'object', additionalProperties: false, required: ['art'], properties: { art: { type: 'string', enum: ['kostenlos', 'fest', 'monat', 'jahr'] }, betrag: { type: 'number' } } },
          regeln: { type: 'object', additionalProperties: false, properties: { mindestlaufzeitMonate: { type: 'integer' }, anrechnung: { type: 'string' }, bonus: { type: 'string' }, maxGleichzeitig: { type: 'integer' } } },
        },
      },
    },
    kreislauf: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' }, messgroesse: { type: 'string' }, stufeIndex: { type: 'integer' } } } },
    positionierung: { type: 'object', additionalProperties: false, properties: Object.fromEntries(POSITIONIERUNG_FELDER.map(f => [f, { type: 'string' }])) },
  },
} as const;

const SYSTEM_DOKUMENT = [
  FREMD_REGEL,
  'Du bist der Head of Sales in MAKE OS. Du liest ein Dokument zum Leistungsangebot (Positionierung, Playbook, Angebotsübersicht) und bildest daraus eine Leistungstreppe ab.',
  'Leistungstreppe = Stufen in Ebenen (ebene 1 = Einstieg; mehrere Stufen auf derselben Ebene = Alternativen, z. B. zwei Pakete nebeneinander). Je Stufe: Name, Aufgabe (was sie leistet und warum sie VOR der nächsten kommt), Ergebnis, Lieferobjekte, Kennzahl beim Kunden, Dauer in Tagen, Aufwand in Stunden (bei Monatspaketen je Monat), Preis (art: kostenlos | fest | monat | jahr, betrag netto in Euro), Regeln (Mindestlaufzeit in Monaten, Anrechnung, Bonus, höchstens N gleichzeitig).',
  'Kundenreise = Stationen eines Kreislaufs in Reihenfolge, je mit Messgröße; stufeIndex = Stelle der passenden Stufe in deiner Stufenliste (0-basiert), wenn es eine gibt.',
  'Positionierung = Claim, Zielgruppe, Problem, Versprechen, Story — kurz und in den Worten des Dokuments.',
  'Übernimm NUR, was im Dokument steht. Erfinde keine Preise, Zahlen, Dauern oder Regeln — fehlt etwas, lass das Feld weg. Keine Namen von Personen. Antworte nur mit dem JSON.',
].join('\n');

export type KiErgebnis<T> = { ok: true; wert: T; gekuerzt: boolean; anbieter?: string } | { ok: false; grund: 'ki' | 'leer'; text: string };

/** Den Dokument-Text lesen lassen → Rohvorschlag (gesäubert wird beim Ablegen). */
export async function treppeAusDokument(textRoh: string, ki: KiKontext): Promise<KiErgebnis<unknown>> {
  const text = textRoh.replace(/\u0000/g, '').trim();
  if (!text) return { ok: false, grund: 'leer', text: 'Im Dokument steht kein lesbarer Text.' };
  const gekuerzt = text.length > DOKUMENT_ZEICHEN;
  const agent = await resolveAgent('head-sales');
  const r = await askText({
    system: SYSTEM_DOKUMENT, user: `Bilde die Leistungstreppe aus diesem Dokument ab${gekuerzt ? ' (nur der Anfang des Dokuments ist dabei)' : ''}.\n\n${fremd('dokument', text.slice(0, DOKUMENT_ZEICHEN))}`,
    schema: SCHEMA as unknown as Record<string, unknown>, maxTokens: 8000, timeoutMs: 120_000, zweck: 'produkte-treppe-dokument', model: agent.model, effort: 'medium', ki,
  });
  if (!r.ok) return { ok: false, grund: 'ki', text: (await import('@/lib/anthropic')).modellFehlerText(r) };
  const j = extractJson<unknown>(r.text);
  if (!j) return { ok: false, grund: 'ki', text: 'Die Antwort des Modells war nicht lesbar — bitte noch einmal versuchen oder die leere Vorlage nehmen.' };
  return { ok: true, wert: j, gekuerzt, ...(r.anbieter ? { anbieter: r.anbieter } : {}) };
}

/** Die Mail zum Report freier formulieren — nur aus dem Report, Anrede vorgegeben, kein Versand. */
export async function mailEntwurfKi(e: { doc: ReportDokument; anrede: 'Du' | 'Sie'; vorname?: string; nachname?: string; absender?: string; vorlage: MailEntwurfReport }, ki: KiKontext): Promise<KiErgebnis<MailEntwurfReport>> {
  const agent = await resolveAgent('head-sales');
  const system = [
    FREMD_REGEL,
    'Du bist der Head of Sales in MAKE OS und formulierst eine kurze, persönliche Mail an einen Kunden: ein Update zum Stand des laufenden Projekts. Der ausführliche Bericht hängt als PDF an.',
    `Anrede: ${e.anrede === 'Du' ? 'per Du, locker und direkt' : 'per Sie, freundlich und klar'}. Höchstens 120 Wörter, kein Marketing, keine Superlative, keine Platzhalter in eckigen Klammern.`,
    'Nutze NUR die Punkte aus dem Bericht — erfinde keine Ergebnisse, Zahlen oder Termine. Antworte nur als JSON: {"betreff": "…", "text": "…"}.',
  ].join('\n');
  const r = await askText({
    system, user: `Name der Person: ${[e.vorname, e.nachname].filter(Boolean).join(' ') || 'unbekannt'}. Absender: ${e.absender ?? 'ohne Namen'}.\n\n${fremd('report', JSON.stringify({ kunde: e.doc.kunde, paket: e.doc.paket, stand: e.doc.stand, erreicht: e.doc.erreicht, naechste: e.doc.naechste }))}`,
    maxTokens: 1500, timeoutMs: 60_000, zweck: 'produkte-report-mail', model: agent.model, effort: 'low', ki,
  });
  if (!r.ok) return { ok: false, grund: 'ki', text: (await import('@/lib/anthropic')).modellFehlerText(r) };
  const j = extractJson<{ betreff?: unknown; text?: unknown }>(r.text);
  const betreff = typeof j?.betreff === 'string' ? j.betreff.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  const text = typeof j?.text === 'string' ? j.text.replace(/\r\n?/g, '\n').trim().slice(0, 4000) : '';
  if (!betreff || !text) return { ok: false, grund: 'ki', text: 'Der Entwurf war nicht lesbar — die Vorlage gilt weiter.' };
  return { ok: true, wert: { betreff, text }, gekuerzt: false, ...(r.anbieter ? { anbieter: r.anbieter } : {}) };
}
