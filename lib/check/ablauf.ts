// ─── Checks — Ablauf (24.10., Innovations-Check) ────────────────────────────────────────────────────────────────
// Die Klickstrecke steuert die Anwendung, nicht ein Sprachmodell: welche Frage als nächste kommt, entscheidet NUR diese Datei
// (so bleiben die Ergebnisse vergleichbar). Reihenfolge nach Kevins Klickrunde 24.10.: erst die 15 Kurzcheck-Fragen (Frage 1 ist
// ein Klick: die Branche), DANACH die Kontaktdaten (überspringbar — das Kurzergebnis bleibt frei sichtbar), dann die Wahl
// „Ergebnis jetzt“ oder „mehr Fragen“, in der Vertiefung die übrigen Fragen aus A bis G (Robotik nur, wo sie zur Branche passt)
// und das Branchen-Modul (H/I/J, sonst zwei offene Fragen). Rein, client- und serversicher.

import { alleFragen, kurzcheckFragen, type FrageMitAbschnitt } from './katalog';
import { robotikRelevant, profilAus } from './auswertung';
import type { CheckAntwort, CheckAntworten, CheckFrage, CheckProfil, CheckVorlage } from './typen';

/** Freitexte (Beleg, offene Fragen) höchstens so lang — darüber 413, nie still gekürzt. */
export const FREITEXT_MAX = 2000;
/** Freitext einer Option („Sonstige“) höchstens so lang. */
export const OPTIONTEXT_MAX = 120;

/**
 * Zwei offene Fragen für Branchen ohne eigenes Modul (Bauanleitung, Ablauf Regel 5). Abschnitt „X“, Kennungen stabil wie im
 * Katalog — sie zählen nicht in die Dimensionen.
 */
export const OFFENE_ZUSATZFRAGEN: readonly FrageMitAbschnitt[] = [
  { id: 'X1', text: 'Wo verlieren Sie am meisten Zeit?', typ: 'offen', punkte: false, abschnitt: 'X' },
  { id: 'X2', text: 'Was müsste in 90 Tagen passiert sein, damit Sie sagen: Es hat sich gelohnt?', typ: 'offen', punkte: false, abschnitt: 'X' },
];

export type KontaktStand = 'offen' | 'erfasst' | 'uebersprungen';
export type CheckPhase = 'kurzcheck' | 'vertiefung' | 'branche';

/** Was der Ablauf über eine Sitzung wissen muss. */
export interface AblaufStand {
  antworten: CheckAntworten;
  /** Fragen, die die Person bewusst übersprungen hat (nur Freitexte im Kurzcheck, in der Vertiefung alle). */
  uebersprungen: readonly string[];
  kontakt: KontaktStand;
  wahl?: 'ergebnis' | 'mehr';
}

export type Schritt =
  | { art: 'frage'; frageId: string; phase: CheckPhase; nummer: number; von: number }
  | { art: 'kontakt' }
  | { art: 'wahl' }
  | { art: 'ergebnis' };

/** Ist eine Antwort inhaltlich da (Klick, Freitext oder Beleg-Bewertung)? */
export const beantwortet = (a: CheckAntwort | undefined): boolean =>
  !!a && ((a.optionIds?.length ?? 0) > 0 || !!a.freitext?.trim() || Number.isInteger(a.belegScore));

const erledigt = (s: AblaufStand, id: string): boolean => beantwortet(s.antworten[id]) || s.uebersprungen.includes(id);

/** Die Branchen-Module für ein Profil (H Handwerk, I Dienstleistung, J Tech oder Start-up) — sonst der Zusatz „X“. */
export function moduleFuer(p: CheckProfil): string[] {
  const m: string[] = [];
  if (p.branche === 'handwerk') m.push('H');
  if (p.branche === 'dienstleistung') m.push('I');
  if (p.branche === 'tech' || p.startup === true) m.push('J');
  return m.length ? m : ['X'];
}

export const kurzSequenz = (v: CheckVorlage): FrageMitAbschnitt[] => kurzcheckFragen(v.katalog);

/** Vertiefung: alle übrigen Fragen aus A bis G in Katalog-Reihenfolge — F nur, wenn Robotik zur Branche passt. */
export function vertiefungSequenz(v: CheckVorlage, p: CheckProfil): FrageMitAbschnitt[] {
  const robotik = robotikRelevant(p, v.regeln);
  return alleFragen(v.katalog).filter(f => 'ABCDEFG'.includes(f.abschnitt) && !f.kurzcheck && (f.abschnitt !== 'F' || robotik));
}

export function brancheSequenz(v: CheckVorlage, p: CheckProfil): FrageMitAbschnitt[] {
  const abschnitte = moduleFuer(p);
  if (abschnitte[0] === 'X') return [...OFFENE_ZUSATZFRAGEN];
  return alleFragen(v.katalog).filter(f => abschnitte.includes(f.abschnitt));
}

/** Eine Frage der Vorlage (Katalog oder Zusatz „X“) — oder undefined. */
export function frageVon(v: CheckVorlage, id: string): FrageMitAbschnitt | undefined {
  return alleFragen(v.katalog).find(f => f.id === id) ?? OFFENE_ZUSATZFRAGEN.find(f => f.id === id);
}

export const kurzFertig = (v: CheckVorlage, s: AblaufStand): boolean => kurzSequenz(v).every(f => erledigt(s, f.id));

/** Der nächste Schritt — DIE Regel des Ablaufs. */
export function naechsterSchritt(v: CheckVorlage, s: AblaufStand): Schritt {
  const kurz = kurzSequenz(v);
  const offenKurz = kurz.findIndex(f => !erledigt(s, f.id));
  if (offenKurz >= 0) return { art: 'frage', frageId: kurz[offenKurz].id, phase: 'kurzcheck', nummer: offenKurz + 1, von: kurz.length };
  if (s.kontakt === 'offen') return { art: 'kontakt' };
  if (!s.wahl) return { art: 'wahl' };
  if (s.wahl === 'mehr') {
    const p = profilAus(v.katalog, s.antworten);
    const rest = [...vertiefungSequenz(v, p).map(f => ({ f, phase: 'vertiefung' as const })), ...brancheSequenz(v, p).map(f => ({ f, phase: 'branche' as const }))];
    const i = rest.findIndex(x => !erledigt(s, x.f.id));
    if (i >= 0) return { art: 'frage', frageId: rest[i].f.id, phase: rest[i].phase, nummer: i + 1, von: rest.length };
  }
  return { art: 'ergebnis' };
}

/** Phase einer Frage in dieser Sitzung — oder null, wenn sie hier (noch) nicht dran sein darf. */
export function phaseVon(v: CheckVorlage, s: AblaufStand, id: string): CheckPhase | null {
  if (kurzSequenz(v).some(f => f.id === id)) return 'kurzcheck';
  // Vertiefung und Branchen-Modul erst nach dem Kurzcheck, nach der Kontakt-Frage und mit der Wahl „mehr“.
  if (!kurzFertig(v, s) || s.kontakt === 'offen' || s.wahl !== 'mehr') return null;
  const p = profilAus(v.katalog, s.antworten);
  if (vertiefungSequenz(v, p).some(f => f.id === id)) return 'vertiefung';
  if (brancheSequenz(v, p).some(f => f.id === id)) return 'branche';
  return null;
}

/** Darf diese Frage übersprungen werden? Im Kurzcheck nur Freitexte (Beleg), danach alles (alles dort ist freiwillig). */
export const ueberspringbar = (f: Pick<CheckFrage, 'typ'>, phase: CheckPhase): boolean => phase !== 'kurzcheck' || f.typ === 'beleg' || f.typ === 'offen';

export interface Eingabe { optionIds?: unknown; freitext?: unknown; zusatz?: unknown; optionText?: unknown }
export type Geprueft = { ok: true; antwort: CheckAntwort } | { ok: false; fehler: string; status: 400 | 413 };

/** Prüft eine Antwort gegen die Frage — nur Kennungen aus dem Katalog, Freitexte nie gekürzt. */
export function antwortPruefen(f: FrageMitAbschnitt, e: Eingabe): Geprueft {
  const nein = (fehler: string, status: 400 | 413 = 400): Geprueft => ({ ok: false, fehler, status });
  if (f.typ === 'einfach' || f.typ === 'mehrfach') {
    const ids = Array.isArray(e.optionIds) ? e.optionIds : [];
    if (!ids.every((x): x is string => typeof x === 'string')) return nein('Ungültige Auswahl.');
    const opts = f.optionen ?? [];
    if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !opts.some(o => o.id === id))) return nein('Bitte eine der Antworten wählen.');
    if (f.typ === 'einfach' && ids.length !== 1) return nein('Bitte genau eine Antwort wählen.');
    if (f.typ === 'mehrfach' && ids.length > 1 && ids.some(id => opts.find(o => o.id === id)?.exklusiv)) return nein('„Noch für keine Aufgabe“ passt nicht zu anderen Antworten.');
    const a: CheckAntwort = { optionIds: ids };
    const gewaehlt = opts.find(o => o.id === ids[0]);
    if (gewaehlt?.freitext && typeof e.optionText === 'string' && e.optionText.trim()) {
      const t = e.optionText.trim();
      if (t.length > OPTIONTEXT_MAX) return nein(`Bitte höchstens ${OPTIONTEXT_MAX} Zeichen.`, 413);
      a.optionText = t;
    }
    if (f.zusatz) {
      if (e.zusatz !== undefined && typeof e.zusatz !== 'boolean') return nein('Bitte Ja oder Nein wählen.');
      if (typeof e.zusatz === 'boolean') a.zusatz = e.zusatz;
    }
    return { ok: true, antwort: a };
  }
  const t = typeof e.freitext === 'string' ? e.freitext.trim() : '';
  if (!t) return nein('Bitte ein paar Worte schreiben — oder die Frage überspringen.');
  if (t.length > FREITEXT_MAX) return nein(`Das ist zu lang — bitte höchstens ${FREITEXT_MAX} Zeichen.`, 413);
  return { ok: true, antwort: { freitext: t } };
}

/** Fortschritt für die Anzeige: Kurzcheck „n von 15“ und gesamt in Prozent (alle Fragen dieser Sitzung). */
export function fortschritt(v: CheckVorlage, s: AblaufStand): { kurz: number; kurzVon: number; prozent: number } {
  const kurz = kurzSequenz(v);
  const p = profilAus(v.katalog, s.antworten);
  const alle = [...kurz, ...vertiefungSequenz(v, p), ...brancheSequenz(v, p)];
  const fertig = alle.filter(f => erledigt(s, f.id)).length;
  return { kurz: kurz.filter(f => erledigt(s, f.id)).length, kurzVon: kurz.length, prozent: alle.length ? Math.round((fertig / alle.length) * 100) : 0 };
}
