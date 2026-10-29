// ─── Kreislauf Geld — die reinen Regeln (29.10., Pakete 1 + 2; Server UND Browser, getestet in tests/kreislauf-geld-2910.test.ts) ─────────────
// Kevin 29.10.: „Fällige Rate / Monatsrechnung eines Mandats → der Morgenlauf legt den Rechnungs-ENTWURF automatisch an + Aufgabe ‚Rechnung prüfen & stellen‘
// (Stellen bleibt Klick).“ Hier steht, WELCHER Monat bzw. welche Rate fällig ist (dieselbe Regel wie der Knopf in der Mandatsakte: die nächste noch nicht
// gestellte Zahlung bzw. der erste offene Leistungsmonat) und welche Mahnstufe gerade frisch fällig wurde (Ereignis „Rechnung überfällig“). Nichts schreibt.

import type { Mandat } from '@/lib/crm/typen';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Mahnstufe } from './typen';
import { mandatLaeuftIm } from '@/lib/crm/mandat-laufzeit';
import { zahlplanMonate } from '@/lib/crm/mandat-zusatz';
import { mahnVorschlaege } from './regeln';

const MONAT = /^\d{4}-\d{2}$/;
const naechsterMonat = (mo: string) => { const [j, m] = mo.split('-').map(Number); return m === 12 ? `${j + 1}-01` : `${j}-${String(m + 1).padStart(2, '0')}`; };

/**
 * Der erste Monat, den der Morgenlauf vorbereitet (Kevin 29.10.): der Monat NACH der Einführung (erster Lauf im Oktober → erster Entwurf für November) —
 * der Einführungsmonat selbst ist Altbestand (seine Rechnungen schrieb man bisher von Hand). Rein.
 */
export const vorbereitenAbMonat = (abTag: string): string => naechsterMonat(abTag.slice(0, 7));

/** Kennung der Aufgabe „Rechnung prüfen & stellen“ je Mandat und Leistungsmonat bzw. Ratenmonat (fest, idempotent). */
export const vorbereitenAufgabeId = (mandatId: string, monat: string) => `rv-${mandatId}-${monat}`.slice(0, 80);
/** Schlüssel des Merkers je Mandat und Monat (Bestand `rechnungswesen` › `kreislauf.vorbereiten.erledigt`). */
export const vorbereitenSchluessel = (mandatId: string, monat: string) => `${mandatId}|${monat}`;

/**
 * Die Monate, für die der Morgenlauf einen Entwurf vorbereiten DARF — in Reihenfolge, die früheste zuerst (rein). Der Lauf nimmt davon höchstens einen
 * (je Mandat und Lauf ein Entwurf); was schon gestellt ist (`abgerechnet`), fällt weg.
 *   · nur aktive Mandate mit Honorar, nie im Papierkorb;
 *   · Raten bzw. Zahlplan: die Zahlungsmonate (`zahlplanMonate`, dieselbe Regel wie „Rate 2 von 6 schreiben“ in der Mandatsakte) bis zum laufenden Monat;
 *   · Monatshonorar mit monatlicher Rechnung: die Leistungsmonate, in denen das Mandat läuft (`mandatLaeuftIm`), bis zum laufenden Monat;
 *   · Tagessatz (abgerechnet nach echten Tagen), Quartalsrechnung und einmaliges Honorar ohne Zahlplan: nichts — die bleiben beim Knopf in der Mandatsakte.
 * NIE ein Monat vor `abMonat` (`vorbereitenAbMonat`: der Monat NACH dem ersten Lauf) — der Altbestand bekommt keine Entwürfe für Vergangenes.
 */
export function vorbereitenMonate(m: Pick<Mandat, 'status' | 'honorar' | 'start' | 'ende' | 'rechnungsrhythmus'> & Partial<Pick<Mandat, 'zahlplan' | 'raten' | 'mindestlaufzeitMonate' | 'geloeschtAm'>>, heute: string, abgerechnet: ReadonlySet<string>, abMonat: string): string[] {
  if (m.status !== 'aktiv' || m.geloeschtAm || !(m.honorar?.betrag > 0) || !MONAT.test(abMonat)) return [];
  const jetzt = heute.slice(0, 7);
  const zp = zahlplanMonate(m);
  if (zp) return zp.filter(mo => mo >= abMonat && mo <= jetzt && !abgerechnet.has(mo));
  if (m.honorar.basis !== 'monat' || m.rechnungsrhythmus !== 'monatlich' || !m.start) return [];
  const raus: string[] = [];
  let mo = m.start.slice(0, 7) > abMonat ? m.start.slice(0, 7) : abMonat;
  for (let n = 0; mo <= jetzt && n < 240; n++, mo = naechsterMonat(mo)) if (mandatLaeuftIm(m, mo) && !abgerechnet.has(mo)) raus.push(mo);
  return raus;
}

/** Welche Rate (1-basiert) ist ein Ratenmonat — für den Titel der Aufgabe; null ohne Raten. Rein. */
export function rateNummer(m: Pick<Mandat, 'honorar' | 'start' | 'ende'> & Partial<Pick<Mandat, 'zahlplan' | 'raten' | 'mindestlaufzeitMonate'>>, monat: string): { nr: number; von: number } | null {
  if (!m.raten) return null;
  const zp = zahlplanMonate(m);
  const i = zp ? zp.indexOf(monat) : -1;
  return i < 0 ? null : { nr: i + 1, von: m.raten.anzahl };
}

/** Gibt es zu Mandat und Monat schon einen Entwurf oder eine Rechnung (nicht storniert, nicht aus einem Angebot)? Dann bereitet der Lauf nichts vor. Rein. */
export function rechnungFuerMonat(rechnungen: readonly Partial<Pick<Rechnung, 'mandatId' | 'leistungVon' | 'status' | 'art' | 'angebotId'>>[], mandatId: string, monat: string): boolean {
  return rechnungen.some(r => r.mandatId === mandatId && !r.angebotId && r.art !== 'storno' && r.status !== 'storniert' && typeof r.leistungVon === 'string' && r.leistungVon.slice(0, 7) === monat);
}

// ── Rechnung überfällig (Ereignis, einmal je Mahnstufe) ─────────────────────────────────────────────────────────────────────────────

/** So lange nach dem Fälligwerden einer Mahnstufe gilt sie als „frisch“ — ältere melden sich nicht mehr (Altbestand: keine Flut beim Einführen). */
export const UEBERFAELLIG_FENSTER_TAGE = 7;
const tage = (von: string, bis: string) => Math.round((Date.UTC(+bis.slice(0, 4), +bis.slice(5, 7) - 1, +bis.slice(8, 10)) - Date.UTC(+von.slice(0, 4), +von.slice(5, 7) - 1, +von.slice(8, 10))) / 864e5);

/**
 * Die Mahnstufen, die gerade frisch fällig wurden (rein): dieselbe Regel wie die Mahnvorschläge (`mahnVorschlaege`) — dazu seit höchstens
 * `UEBERFAELLIG_FENSTER_TAGE` Tagen fällig (gerechnet ab Fälligkeit + Tage der Stufe bzw., ab Stufe 2, ab der vorigen Mahnung + Abstand der Stufen,
 * das Spätere zählt). Das Ereignis trägt die Kennung je Rechnung und Stufe — es meldet sich je Stufe einmal.
 */
export function ueberfaelligFrisch(rechnungen: readonly Rechnung[], heute: string, stufenTage: readonly [number, number, number]): { r: Rechnung; stufe: Mahnstufe }[] {
  const raus: { r: Rechnung; stufe: Mahnstufe }[] = [];
  for (const v of mahnVorschlaege(rechnungen as Rechnung[], heute, stufenTage)) {
    const r = rechnungen.find(x => x.id === v.rechnungId);
    if (!r?.faellig) continue;
    let seit = v.tageUeberfaellig - stufenTage[v.stufe - 1];
    if (v.stufe > 1) {
      const letzte = (r.mahnungen ?? []).filter(x => x.stufe === v.stufe - 1).map(x => x.am).sort().pop();
      if (letzte) seit = Math.min(seit, tage(letzte, heute) - (stufenTage[v.stufe - 1] - stufenTage[v.stufe - 2]));
    }
    if (seit >= 0 && seit < UEBERFAELLIG_FENSTER_TAGE) raus.push({ r, stufe: v.stufe });
  }
  return raus;
}

// ── Mahnaufgaben schließen (bezahlt / storniert) ─────────────────────────────────────────────────────────────────────────────────────

/** Gehört die Aufgabe zu den Mahnaufgaben dieser Rechnung (`mahn-<rechnung>-<stufe>`, lib/finanzen/rechnung/regeln.ts `mahnAufgabeId`)? Rein. */
export const istMahnAufgabeVon = (aufgabeId: string, rechnungId: string) => [1, 2, 3].some(s => aufgabeId === `mahn-${rechnungId}-${s}`.slice(0, 80));

// ── Liquidität: Mandate, die im Liquiplan fehlen (29.10., P2c) ──────────────────────────────────────────────────────────────────────

/**
 * Wie viele Business-Mandate fehlen im Liquiditätsplan (Lage „fehlt“ aus GET /api/crm/liquiplan — dieselbe Rechnung wie die Mandatsliste)? Die Liquidität ist
 * Business — Mandate der Selbstständigkeit (Privat) zählen hier nicht. Rein.
 */
export function mandateNichtImLiquiplan(l: readonly { lage?: string; gesellschaft?: string | null }[], bereichVon: (g: string | null | undefined) => 'privat' | 'business'): number {
  return l.filter(m => m.lage === 'fehlt' && bereichVon(m.gesellschaft) === 'business').length;
}
