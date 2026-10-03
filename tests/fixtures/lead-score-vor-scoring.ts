// ─── Referenz: der Lead-Score VOR dem Umbau zu Qualifizierung & Scoring (03.10., wörtlich aus a4c07f9) ─────────
// Nur für tests/scoring-standard-paritaet.test.ts: der Standard des neuen Kerns (lib/crm/scoring.ts) muss diese Rechnung
// Punkt für Punkt treffen — bei beliebigen Eingaben. Nicht im Produktivcode verwenden.
import type { Kontakt } from '@/lib/make-one/crm';
import type { Kriterien, Lead, Qual } from '@/lib/crm/typen';
import { echtesGespraech } from '@/lib/crm/pipeline';
import { hatTyp, kategorieBeginnt } from '@/lib/crm/mehrfach';

export type AltTeilId = 'fit' | 'waerme' | 'qualifizierung' | 'erreichbarkeit';
export interface AltTeil { id: AltTeilId; label: string; punkte: number; max: number; grund: string }
const WAERME_VERFALL_TAGEN = 180;

const tage = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);
const KERNFRAGEN: (keyof Kriterien)[] = ['schmerz', 'entscheider', 'budget', 'zeitpunkt', 'wirkung', 'alternative'];

/** Fit: die Antwort am Lead zuerst, sonst die Vertriebseignung aus der Liste (ja/vielleicht/nein). */
function fit(personen: Kontakt[], lead?: Lead): AltTeil {
  const q: Qual | undefined = lead?.fit;
  if (q === 'ja') return { id: 'fit', label: 'Fit', punkte: 30, max: 30, grund: 'Passt zu unserem Kundenprofil (am Lead gesetzt)' };
  if (q === 'nein') return { id: 'fit', label: 'Fit', punkte: 0, max: 30, grund: 'Kein Fit (am Lead gesetzt)' };
  const eignung = personen.map(k => k.eignung).sort((a, b) => rang(a) - rang(b))[0] ?? '';
  if (eignung === 'ja') return { id: 'fit', label: 'Fit', punkte: 30, max: 30, grund: 'Vertriebseignung „ja“ aus der Liste' };
  if (eignung === 'vielleicht') return { id: 'fit', label: 'Fit', punkte: 15, max: 30, grund: 'Vertriebseignung „vielleicht“' };
  if (eignung === 'nein') return { id: 'fit', label: 'Fit', punkte: 0, max: 30, grund: 'Vertriebseignung „nein“' };
  return { id: 'fit', label: 'Fit', punkte: 8, max: 30, grund: 'Fit noch offen' };
}
const rang = (e: string) => (e === 'ja' ? 0 : e === 'vielleicht' ? 1 : e === '' ? 2 : 3);

/** Wärme: echtes Gespräch zuletzt, sonst Antwort/Inbound, sonst nur angesprochen. */
function waerme(personen: Kontakt[], heute: string): AltTeil {
  const akt = personen.flatMap(k => k.aktivitaeten ?? []);
  const gespraech = akt.filter(echtesGespraech).map(a => a.am.slice(0, 10)).concat(personen.map(k => k.letzterKontakt ?? '').filter(Boolean)).sort().pop();
  if (gespraech) {
    const t = tage(gespraech, heute);
    if (t <= 30) return { id: 'waerme', label: 'Wärme', punkte: 30, max: 30, grund: `Echtes Gespräch vor ${t} Tagen` };
    if (t <= 90) return { id: 'waerme', label: 'Wärme', punkte: 20, max: 30, grund: `Letztes Gespräch vor ${t} Tagen` };
    if (t <= 365) return { id: 'waerme', label: 'Wärme', punkte: 12, max: 30, grund: `Letztes Gespräch vor ${t} Tagen — wieder aufwärmen` };
  }
  // Antwort und Ansprache verfallen (28.09., K4, #93): nach WAERME_VERFALL_TAGEN zählen sie nur noch wenig — eine Antwort
  // von vor zwei Jahren ist keine Wärme mehr. Frische Signale gehen vor; verblasste treten gegen den warmen Typ an.
  const zuletzt = (l: typeof akt) => l.map(a => a.am.slice(0, 10)).sort().pop();
  const verblasst: AltTeil[] = [];
  const antwortAm = zuletzt(akt.filter(a => a.art === 'antwort' || a.ergebnis === 'rueckruf'));
  if (antwortAm) {
    const t = tage(antwortAm, heute);
    if (t <= WAERME_VERFALL_TAGEN) return { id: 'waerme', label: 'Wärme', punkte: 12, max: 30, grund: 'Hat geantwortet' };
    verblasst.push({ id: 'waerme', label: 'Wärme', punkte: 5, max: 30, grund: `Antwort liegt ${t} Tage zurück — abgekühlt` });
  }
  const ansprachen = akt.filter(a => a.von !== 'system' && (a.art === 'mail' || a.art === 'linkedin' || a.art === 'anruf'));
  const angesprochenAm = zuletzt(ansprachen);
  if (angesprochenAm) {
    const t = tage(angesprochenAm, heute);
    if (t <= WAERME_VERFALL_TAGEN) return { id: 'waerme', label: 'Wärme', punkte: 8, max: 30, grund: 'Angesprochen, noch keine Antwort' };
    verblasst.push({ id: 'waerme', label: 'Wärme', punkte: 3, max: 30, grund: `Zuletzt vor ${t} Tagen angesprochen — abgekühlt` });
  } else if (!verblasst.length && personen.some(k => k.stufe === 'angesprochen')) {
    // Nur die Stufe aus der Liste, ohne datierte Ansprache — nicht zu altern, zählt wie bisher.
    return { id: 'waerme', label: 'Wärme', punkte: 8, max: 30, grund: 'Angesprochen, noch keine Antwort' };
  }
  const warmerTyp = personen.some(k => hatTyp(k, 'Netzwerk') || hatTyp(k, 'Kunde') || kategorieBeginnt(k, 'Apple') || /apple/i.test(k.quelle ?? ''));
  if (warmerTyp) verblasst.push({ id: 'waerme', label: 'Wärme', punkte: 10, max: 30, grund: 'Bekannt aus Netzwerk oder früherer Zusammenarbeit' });
  if (verblasst.length) return verblasst.reduce((a, b) => (b.punkte > a.punkte ? b : a));
  return { id: 'waerme', label: 'Wärme', punkte: 0, max: 30, grund: 'Noch kein Kontakt' };
}

/** Nach so vielen Tagen zählen „hat geantwortet“ und „angesprochen“ nur noch abgekühlt (28.09., K4). */


/** Qualifizierung: 5 Punkte je Kernfrage „ja“; Schmerz oder Entscheider „nein“ deckelt auf 10. */
function qualifizierung(k: Kriterien): AltTeil {
  const ja = KERNFRAGEN.filter(f => k[f] === 'ja').length;
  const gedeckelt = k.schmerz === 'nein' || k.entscheider === 'nein';
  const punkte = gedeckelt ? Math.min(10, ja * 5) : ja * 5;
  const grund = gedeckelt ? `${ja} von 6 geklärt — ${k.schmerz === 'nein' ? 'kein Schmerz' : 'kein Entscheider'} deckelt` : ja ? `${ja} von 6 Kernfragen mit „ja“` : 'Noch keine Kernfrage geklärt';
  return { id: 'qualifizierung', label: 'Qualifizierung', punkte, max: 30, grund };
}

/** Erreichbarkeit: E-Mail 4 · Telefon 3 · LinkedIn 3 — über alle Personen der Firma. */
function erreichbarkeit(personen: Kontakt[]): AltTeil {
  const mail = personen.some(k => (k.email ?? '').includes('@')) ? 4 : 0;
  const tel = personen.some(k => k.telefon || k.sms) ? 3 : 0;
  const li = personen.some(k => k.linkedin) ? 3 : 0;
  const wege = [mail && 'E-Mail', tel && 'Telefon', li && 'LinkedIn'].filter(Boolean).join(', ');
  return { id: 'erreichbarkeit', label: 'Erreichbar', punkte: mail + tel + li, max: 10, grund: wege ? `Erreichbar per ${wege}` : 'Kein Weg bekannt' };
}


export function altScore(personen: Kontakt[], lead: Lead | undefined, heute: string, kriterien?: Kriterien): { punkte: number; teile: AltTeil[] } {
  const k: Kriterien = kriterien ?? lead?.kriterien ?? { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' };
  const teile = [fit(personen, lead), waerme(personen, heute), qualifizierung(k), erreichbarkeit(personen)];
  return { punkte: teile.reduce((s, t) => s + t.punkte, 0), teile };
}
