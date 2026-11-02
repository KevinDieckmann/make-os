// ─── Buchhaltung — eine Buchung ändern (02.11., rein: Server) ─────────────────────────────────────────────────────────────────────────
// Der EINE Prüfweg für die Änderung einzelner Felder einer Business-Buchung (PATCH /api/state/buchungen, Op `teil`): Kategorie, Notiz,
// Rechnung, Mandat, Gesellschaft. Nie die ganze Liste, immer mit Stand (409 bei fremder Änderung) — die Route prüft den Stand, hier die Regeln:
//   • Kategorie von Hand → `kategorieHand` (eine Regel überschreibt sie nie mehr), Regel-Marke und „bitte zuordnen“ fallen weg,
//   • Rechnung nur der GLEICHEN Gesellschaft, und nur, wenn keine andere Buchung sie schon trägt (sonst zählte der Eingang doppelt),
//   • Gesellschaft nur eine Gesellschaft (Business-Sicht: nur Business-Gesellschaften); eine Buchung aus dem Kontoauszug folgt dem Konto (409),
//   • Business-Sicht: nie eine Buchung, die nicht zu einer Business-Gesellschaft gehört.
// Leeren = `null`. Grenzen → 413, nie gekürzt.

import { finanzOrtAus, istBusinessGesellschaft, istGesellschaft } from '@/lib/einheiten';
import { kategorieSauber, ohneSteuerzeichen, KATEGORIE_MAX } from './kategorien';
import type { BhBuchung, Zuordnen } from './arbeitsliste';
import { ANTWORT_MAX, belegHinweisSauber, bewirtungSauber, type BelegHinweis, type Bewirtung } from './pruefung';

export const NOTIZ_MAX = 1000;
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

/** Die änderbaren Felder (Eingabe). `null` leert. */
export interface TeilFelder {
  kategorie?: string;
  notiz?: string | null;
  rechnungId?: string | null;
  mandatId?: string | null;
  ort?: string;
  zuordnen?: Zuordnen | null;
  /** Prüfmodus: „Passt“ bzw. nach „Ändern“ — bestätigt (mit `kategorie`: diese, sonst der Vorschlag). Wer/wann stempelt der Server. */
  bestaetigen?: true;
  /** Antwort auf die Frage der Prüfung. */
  antwort?: string | null;
  bewirtung?: Bewirtung | null;
  belegHinweis?: BelegHinweis | null;
}
export const TEIL_FELDER = ['kategorie', 'notiz', 'rechnungId', 'mandatId', 'ort', 'zuordnen', 'bestaetigen', 'antwort', 'bewirtung', 'belegHinweis'] as const;

/** Was die Prüfung über die Rechnungen wissen muss (aus dem Finanzplan). */
export interface RechnungKurz { id: string; firmaId?: string; mandatId?: string }
/** Gesellschaft einer Rechnung — dieselbe Regel wie die offenen Posten des Kontoauszugs. */
export const rechnungOrt = (r: Pick<RechnungKurz, 'firmaId'>): string | undefined => (istGesellschaft(r.firmaId) ? r.firmaId : finanzOrtAus(r.firmaId));

export type TeilErgebnis = { ok: true; neu: BhBuchung; felder: string[] } | { ok: false; status: 400 | 403 | 409 | 413; fehler: string };

const aus = (b: BhBuchung) => (b.auszug || b.id.startsWith('bu-ka-'));

/**
 * Wendet die Felder auf die Buchung an — oder sagt, warum nicht. `alle` = der ganze Bestand (für „Rechnung schon verknüpft“),
 * `rechnungen` = die Rechnungen des Finanzplans, `sicht` = Datensicht des Kontos.
 */
export function teilAnwenden(alt: BhBuchung, roh: unknown, ctx: { alle: readonly BhBuchung[]; rechnungen: readonly RechnungKurz[]; sicht: 'privat' | 'business'; wer?: string; jetzt?: string }): TeilErgebnis {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return { ok: false, status: 400, fehler: 'Feld „felder“ fehlt — nichts gespeichert.' };
  const f = roh as Record<string, unknown>;
  const fremd = Object.keys(f).filter(k => !(TEIL_FELDER as readonly string[]).includes(k));
  if (fremd.length) return { ok: false, status: 400, fehler: `Diese Felder lassen sich hier nicht ändern: ${fremd.join(', ')} — nichts gespeichert.` };
  if (ctx.sicht === 'business' && !istBusinessGesellschaft(alt.ort)) return { ok: false, status: 403, fehler: 'Nicht erlaubt: diese Buchung gehört nicht zu einer Business-Gesellschaft — nichts gespeichert.' };
  const neu: BhBuchung = { ...alt };
  const geaendert: string[] = [];

  if ('kategorie' in f) {
    if (typeof f.kategorie === 'string' && f.kategorie.trim().length > KATEGORIE_MAX) return { ok: false, status: 413, fehler: `Die Kategorie ist zu lang (höchstens ${KATEGORIE_MAX} Zeichen) — gekürzt wird nie, nichts gespeichert.` };
    const k = kategorieSauber(f.kategorie);
    if (!k) return { ok: false, status: 400, fehler: 'Bitte eine Kategorie wählen — nichts gespeichert.' };
    neu.kategorie = k; neu.kategorieHand = true; delete neu.regel;
    if (!('zuordnen' in f)) delete neu.zuordnen;
    geaendert.push('kategorie');
  }
  if ('notiz' in f) {
    if (f.notiz === null || f.notiz === '') delete neu.notiz;
    else if (typeof f.notiz !== 'string') return { ok: false, status: 400, fehler: 'Die Notiz muss Text sein — nichts gespeichert.' };
    else {
      const t = ohneSteuerzeichen(f.notiz.normalize('NFC').replace(/\r?\n/g, ' ')).trim();
      if (t.length > NOTIZ_MAX) return { ok: false, status: 413, fehler: `Die Notiz ist zu lang (höchstens ${NOTIZ_MAX} Zeichen) — gekürzt wird nie, nichts gespeichert.` };
      if (t) neu.notiz = t; else delete neu.notiz;
    }
    geaendert.push('notiz');
  }
  if ('ort' in f && f.ort !== alt.ort) {
    if (!istGesellschaft(f.ort)) return { ok: false, status: 400, fehler: 'Bitte eine Gesellschaft wählen — nichts gespeichert.' };
    if (ctx.sicht === 'business' && !istBusinessGesellschaft(f.ort)) return { ok: false, status: 403, fehler: 'Nicht erlaubt: aus dem Business-Bereich nur in eine Business-Gesellschaft — nichts gespeichert.' };
    if (aus(alt)) return { ok: false, status: 409, fehler: 'Die Buchung kommt aus dem Kontoauszug — die Gesellschaft folgt dem Konto. Falls das Konto falsch zugeordnet ist: unter Konten umstellen. Nichts gespeichert.' };
    neu.ort = f.ort;
    geaendert.push('ort');
  }
  if ('zuordnen' in f) {
    if (f.zuordnen === null) delete neu.zuordnen;
    else if (f.zuordnen === 'gesellschafter' || f.zuordnen === 'verrechnung') neu.zuordnen = f.zuordnen;
    else return { ok: false, status: 400, fehler: 'Unbekannte Markierung — nichts gespeichert.' };
    geaendert.push('zuordnen');
  }
  if ('mandatId' in f) {
    if (f.mandatId === null || f.mandatId === '') delete neu.mandatId;
    else if (typeof f.mandatId !== 'string' || !KENNUNG.test(f.mandatId)) return { ok: false, status: 400, fehler: 'Ungültiges Mandat — nichts gespeichert.' };
    else neu.mandatId = f.mandatId;
    geaendert.push('mandatId');
  }
  if ('rechnungId' in f) {
    if (f.rechnungId === null || f.rechnungId === '') delete neu.rechnungId;
    else {
      if (typeof f.rechnungId !== 'string' || !KENNUNG.test(f.rechnungId)) return { ok: false, status: 400, fehler: 'Ungültige Rechnung — nichts gespeichert.' };
      const r = ctx.rechnungen.find(x => x.id === f.rechnungId);
      if (!r) return { ok: false, status: 409, fehler: 'Die Rechnung gibt es nicht (mehr) — nichts gespeichert.' };
      if (rechnungOrt(r) !== neu.ort) return { ok: false, status: 409, fehler: 'Die Rechnung gehört zu einer anderen Gesellschaft — nur Rechnungen derselben Gesellschaft. Nichts gespeichert.' };
      const schon = ctx.alle.find(x => x.id !== alt.id && x.rechnungId === r.id);
      if (schon) return { ok: false, status: 409, fehler: `Die Rechnung ist schon mit der Buchung vom ${schon.datum.split('-').reverse().join('.')} verknüpft — sonst zählt der Eingang doppelt. Nichts gespeichert.` };
      neu.rechnungId = r.id;
      if (!neu.mandatId && r.mandatId && KENNUNG.test(r.mandatId)) neu.mandatId = r.mandatId;
    }
    geaendert.push('rechnungId');
  }
  // Wechselt die Gesellschaft, darf keine Rechnung einer anderen Gesellschaft hängen bleiben.
  if (neu.rechnungId && neu.ort !== alt.ort) {
    const r = ctx.rechnungen.find(x => x.id === neu.rechnungId);
    if (r && rechnungOrt(r) !== neu.ort) return { ok: false, status: 409, fehler: 'Die verknüpfte Rechnung gehört zur bisherigen Gesellschaft — erst die Rechnung lösen, dann umstellen. Nichts gespeichert.' };
  }
  if ('bewirtung' in f) {
    const w = bewirtungSauber(f.bewirtung);
    if (!w.ok) return w;
    if (w.wert) neu.bewirtung = w.wert; else delete neu.bewirtung;
    geaendert.push('bewirtung');
  }
  if ('belegHinweis' in f) {
    const w = belegHinweisSauber(f.belegHinweis);
    if (!w.ok) return w;
    if (w.wert) neu.belegHinweis = w.wert; else delete neu.belegHinweis;
    geaendert.push('belegHinweis');
  }
  if ('antwort' in f) {
    if (!neu.pruefung) return { ok: false, status: 409, fehler: 'Zu dieser Buchung gibt es keine Frage — nichts gespeichert.' };
    if (f.antwort === null || f.antwort === '') { const { antwort: _a, ...p } = neu.pruefung; neu.pruefung = p; }
    else if (typeof f.antwort !== 'string') return { ok: false, status: 400, fehler: 'Die Antwort muss Text sein — nichts gespeichert.' };
    else {
      const t = ohneSteuerzeichen(f.antwort.normalize('NFC').replace(/\r?\n/g, ' ')).trim();
      if (t.length > ANTWORT_MAX) return { ok: false, status: 413, fehler: `Die Antwort ist zu lang (höchstens ${ANTWORT_MAX} Zeichen) — gekürzt wird nie, nichts gespeichert.` };
      neu.pruefung = { ...neu.pruefung, ...(t ? { antwort: t } : {}) };
    }
    geaendert.push('antwort');
  }
  if ('bestaetigen' in f) {
    if (f.bestaetigen !== true) return { ok: false, status: 400, fehler: '„bestaetigen“ ist nur „true“ — nichts gespeichert.' };
    if (!ctx.wer || !ctx.jetzt) return { ok: false, status: 403, fehler: 'Bestätigen nur mit einer Person — nichts gespeichert.' };
    // „Passt“ ohne eigene Kategorie: der Vorschlag wird die Kategorie (von Hand gesetzt — keine Regel überschreibt sie mehr).
    if (!('kategorie' in f)) {
      const k = kategorieSauber(neu.pruefung?.vorschlag ?? neu.kategorie);
      if (!k) return { ok: false, status: 400, fehler: 'Bitte eine Kategorie wählen — nichts gespeichert.' };
      neu.kategorie = k; neu.kategorieHand = true; delete neu.regel;
      if (!('zuordnen' in f)) delete neu.zuordnen;
    }
    const { vorschlag: _v, ...rest } = neu.pruefung ?? { status: 'offen' as const };
    neu.pruefung = { ...rest, status: 'bestaetigt', geprueftVon: ctx.wer, geprueftAm: ctx.jetzt };
    geaendert.push('bestaetigt');
  }
  if (!geaendert.length) return { ok: false, status: 400, fehler: 'Keine Änderung — nichts gespeichert.' };
  return { ok: true, neu, felder: geaendert };
}
