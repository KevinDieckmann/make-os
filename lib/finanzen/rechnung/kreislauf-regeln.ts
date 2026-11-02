// ─── Kreislauf Geld — die reinen Regeln (29.10., Pakete 1 + 2; Server UND Browser, getestet in tests/kreislauf-geld-2910.test.ts) ─────────────
// Kevin 29.10.: „Fällige Rate / Monatsrechnung eines Mandats → der Morgenlauf legt den Rechnungs-ENTWURF automatisch an + Aufgabe ‚Rechnung prüfen & stellen‘
// (Stellen bleibt Klick).“ Hier steht, WELCHER Monat bzw. welche Rate fällig ist (dieselbe Regel wie der Knopf in der Mandatsakte: die nächste noch nicht
// gestellte Zahlung bzw. der erste offene Leistungsmonat) und welche Mahnstufe gerade frisch fällig wurde (Ereignis „Rechnung überfällig“). Nichts schreibt.

import type { Angebot, Mandat } from '@/lib/crm/typen';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Mahnstufe, RechnungPosition } from './typen';
import { jahresHonorarVon, mandatLaeuftIm, vertragsjahrBeginnt } from '@/lib/crm/mandat-laufzeit';
import { restMonat, zahlplanMonate } from '@/lib/crm/mandat-zusatz';
import { ratenCent } from '@/lib/crm/angebote';
import { kaufmaennisch } from '@/lib/finanzen/ust';
import { mahnVorschlaege, positionNetto, rechnungsMonate } from './regeln';
export { rechnungsMonate } from './regeln';

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

/** Was der Morgenlauf je Mandat vorbereitet (31.10., Kreislauf-Rest): Monatshonorar, Rate bzw. Zahlplan, Quartal, einmaliges Honorar, Tagessatz. */
export type VorbereitenArt = 'monat' | 'rate' | 'quartal' | 'einmalig' | 'tag';
export interface VorbereitenFaellig {
  /** Leistungsmonat (monat, tag), Zahlungsmonat (rate), erster Monat des Quartals (quartal) bzw. Monat des Beginns (einmalig) — JJJJ-MM. */
  monat: string;
  art: VorbereitenArt;
}
type MandatTeil = Pick<Mandat, 'status' | 'honorar' | 'start' | 'ende' | 'rechnungsrhythmus'> & Partial<Pick<Mandat, 'zahlplan' | 'raten' | 'mindestlaufzeitMonate' | 'geloeschtAm' | 'jahresHonorar'>>;
/** Die drei Monate eines Quartals ab seinem ersten Monat (JJJJ-MM). */
export const quartalMonate = (q: string): string[] => [q, naechsterMonat(q), naechsterMonat(naechsterMonat(q))];

/**
 * Was der Morgenlauf für ein Mandat vorbereiten DARF — in Reihenfolge, das Früheste zuerst (rein). Der Lauf nimmt davon höchstens eines
 * (je Mandat und Lauf ein Entwurf); was schon gestellt ist (`abgerechnet`), fällt weg.
 *   · nur aktive Mandate mit Honorar, nie im Papierkorb;
 *   · Raten bzw. Zahlplan: die Zahlungsmonate (`zahlplanMonate`, dieselbe Regel wie „Rate 2 von 6 schreiben“ in der Mandatsakte) bis zum laufenden Monat;
 *   · Tagessatz (31.10.): je Leistungsmonat EIN Entwurf, sobald der Monat vorbei ist (am Monatsersten des Folgemonats) — die Tage kommen aus der
 *     erfassten Zeit (der Lauf; ohne Zeit nur eine Aufgabe mit Hinweis);
 *   · einmaliges Honorar ohne Zahlplan (31.10.): EIN Entwurf im Monat des Beginns;
 *   · Monatshonorar mit Rechnung je Quartal (31.10.): je Quartal EIN Entwurf in seinem ersten Monat — die Quartale laufen im Rhythmus des Mandats
 *     (ab dem Monat des Beginns, wie der Liquiplan), ein Quartal mit schon gestelltem Monat fällt ganz weg (nie doppelt);
 *   · Monatshonorar mit monatlicher Rechnung: die Leistungsmonate, in denen das Mandat läuft (`mandatLaeuftIm`), bis zum laufenden Monat.
 * NIE ein Monat vor `abMonat` (`vorbereitenAbMonat`: der Monat NACH dem ersten Lauf) — der Altbestand bekommt keine Entwürfe für Vergangenes.
 */
export function vorbereitenFaellig(m: MandatTeil, heute: string, abgerechnet: ReadonlySet<string>, abMonat: string): VorbereitenFaellig[] {
  if (m.status !== 'aktiv' || m.geloeschtAm || !(m.honorar?.betrag > 0) || !MONAT.test(abMonat)) return [];
  const jetzt = heute.slice(0, 7);
  const zp = zahlplanMonate(m);
  if (zp) return zp.filter(mo => mo >= abMonat && mo <= jetzt && !abgerechnet.has(mo)).map(monat => ({ monat, art: 'rate' as const }));
  if (!m.start) return [];
  const s = m.start.slice(0, 7);
  const ab = s > abMonat ? s : abMonat;
  const raus: VorbereitenFaellig[] = [];
  if (m.honorar.basis === 'tag') {
    // Erst wenn der Leistungsmonat vorbei ist — die Tage des Monats stehen dann fest.
    for (let mo = ab, n = 0; mo < jetzt && n < 240; n++, mo = naechsterMonat(mo)) if (mandatLaeuftIm(m, mo) && !abgerechnet.has(mo)) raus.push({ monat: mo, art: 'tag' });
    return raus;
  }
  if (m.honorar.basis === 'einmalig' || m.rechnungsrhythmus === 'einmalig') {
    return s >= abMonat && s <= jetzt && !abgerechnet.has(s) ? [{ monat: s, art: 'einmalig' }] : [];
  }
  if (m.honorar.basis !== 'monat') return [];
  // Jahreshonorar (02.11., R2-3 Fund 3): EIN Entwurf je Vertragsjahr — im Monat, in dem es beginnt (Beginn + 12·k, Mandat läuft).
  if (jahresHonorarVon(m) !== null) {
    for (let mo = ab, n = 0; mo <= jetzt && n < 240; n++, mo = naechsterMonat(mo)) if (vertragsjahrBeginnt(m, mo) && !abgerechnet.has(mo)) raus.push({ monat: mo, art: 'monat' });
    return raus;
  }
  if (m.rechnungsrhythmus === 'quartal') {
    for (let q = s, n = 0; q <= jetzt && n < 80; n++, q = quartalMonate(q).map(naechsterMonat)[2]) {
      if (q < abMonat) continue;
      const mo = quartalMonate(q);
      if (mo.some(x => abgerechnet.has(x)) || !mo.some(x => mandatLaeuftIm(m, x))) continue;
      raus.push({ monat: q, art: 'quartal' });
    }
    return raus;
  }
  if (m.rechnungsrhythmus !== 'monatlich') return [];
  for (let mo = ab, n = 0; mo <= jetzt && n < 240; n++, mo = naechsterMonat(mo)) if (mandatLaeuftIm(m, mo) && !abgerechnet.has(mo)) raus.push({ monat: mo, art: 'monat' });
  return raus;
}

/** Nur die Monate von `vorbereitenFaellig` (die Form bis 31.10.). Rein. */
export function vorbereitenMonate(m: MandatTeil, heute: string, abgerechnet: ReadonlySet<string>, abMonat: string): string[] {
  return vorbereitenFaellig(m, heute, abgerechnet, abMonat).map(f => f.monat);
}

/** Tage aus der erfassten Zeit (31.10.): Stunden ÷ Stunden je Tag, auf Vierteltage gerundet; 0 = nichts erfasst. Rein. */
export const STUNDEN_JE_TAG_VORGABE = 8;
export function tageAusZeit(sek: number, stundenJeTag = STUNDEN_JE_TAG_VORGABE): number {
  if (!(sek > 0) || !(stundenJeTag > 0)) return 0;
  return Math.round((sek / 3600 / stundenJeTag) * 4) / 4;
}

// ── Einmalposten eines gemischten Angebots (31.10.) ─────────────────────────────────────────────────────────────────────────────────

/** Eine Zahlung der Einmalposten: ganz (ohne Zahlplan), Rate i von n, Anzahlung bzw. Rest. */
export interface EinmalZahlung { nr: number; von: number; monat: string; art: 'ganz' | 'rate' | 'anzahlung' | 'rest'; prozent?: number }

/**
 * Wann die Einmalposten eines gemischten Angebots (einmalige + laufende Posten; das Mandat rechnet die laufenden monatlich ab) fällig sind — nach der
 * Zahlungsweise des Angebots, gerechnet ab dem Beginn des Mandats (rein):
 *   · Raten: die erste im Monat des Beginns, dann alle `abstandMonate` Monate (dieselbe Regel wie die Raten eines Mandats);
 *   · Anzahlung: im Monat des Beginns, der Rest im Monat des Endes (ohne Ende im Folgemonat — `restMonat`, wie der Zahlplan eines Mandats);
 *   · ohne Zahlungsweise bzw. eigener Satz: EINE Zahlung im Monat des Beginns.
 */
export function einmalZahlungen(a: Pick<Angebot, 'zahlweise'>, m: Partial<Pick<Mandat, 'start' | 'ende' | 'mindestlaufzeitMonate'>>): EinmalZahlung[] {
  const start = m.start;
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  const s = start.slice(0, 7);
  const z = a.zahlweise;
  if (z?.art === 'raten' && z.anzahl >= 2) {
    const raus: EinmalZahlung[] = [];
    let mo = s;
    for (let i = 0; i < z.anzahl; i++) {
      raus.push({ nr: i + 1, von: z.anzahl, monat: mo, art: 'rate' });
      for (let k = 0; k < Math.max(1, z.abstandMonate); k++) mo = naechsterMonat(mo);
    }
    return raus;
  }
  if (z?.art === 'anzahlung' && z.prozent > 0 && z.prozent < 100) {
    const r = restMonat(m, {});
    if (r && r !== s) return [{ nr: 1, von: 2, monat: s, art: 'anzahlung', prozent: z.prozent }, { nr: 2, von: 2, monat: r, art: 'rest', prozent: 100 - z.prozent }];
  }
  return [{ nr: 1, von: 1, monat: s, art: 'ganz' }];
}

/** Wie die Zahlung im Titel heißt („Rate 2 von 3“, „Anzahlung 30 %“, „Restzahlung 70 %“) — leer bei einer einzigen Zahlung. Rein. */
export function einmalZahlungText(z: EinmalZahlung): string {
  return z.art === 'rate' ? `Rate ${z.nr} von ${z.von}` : z.art === 'anzahlung' ? `Anzahlung ${z.prozent} %` : z.art === 'rest' ? `Restzahlung ${z.prozent} %` : '';
}

/**
 * Die Positionen einer Zahlung der Einmalposten (rein): ganz = unverändert; sonst je Position ihr Anteil (netto, mit Rabatt gerechnet) als eine
 * pauschale Position „<Titel> — Rate i von n“ — gleich große Raten auf den Cent, der Rundungsrest auf der letzten (`ratenCent`, wie das Angebot);
 * Anzahlung kaufmännisch gerundet, der Rest ist die Differenz. Die Summe aller Zahlungen ist genau die Summe der Einmalposten.
 */
export function einmalTeilPositionen(pos: readonly RechnungPosition[], z: EinmalZahlung): RechnungPosition[] {
  if (z.art === 'ganz') return pos.map(p => ({ ...p }));
  const was = einmalZahlungText(z);
  // 02.11. (R2-3 Fund 10): wie im PDF (`zahlweiseText`) auf die SUMME gerechnet — Rate i der Summe (Rest auf der letzten Rate) bzw. Anzahlung/Rest der Summe;
  // auf die Positionen anteilig verteilt, der Rundungsrest auf der letzten Position. Vorher je Position gerundet: die Raten wichen um Cent vom Angebot ab.
  const netto = pos.map(p => positionNetto(p));
  const summe = netto.reduce((a, x) => a + x, 0);
  const ziel = z.art === 'rate' ? ratenCent(summe, z.von)[z.nr - 1] : z.art === 'anzahlung' ? kaufmaennisch((summe * (z.prozent ?? 0)) / 100) : summe - kaufmaennisch((summe * (100 - (z.prozent ?? 0))) / 100);
  let vergeben = 0;
  return pos.map((p, i) => {
    const cent = i === pos.length - 1 ? ziel - vergeben : summe ? kaufmaennisch((ziel * netto[i]) / summe) : 0;
    vergeben += cent;
    const { rabattProzent: _r, ...ohne } = p;
    return { ...ohne, titel: `${p.titel} — ${was}`.slice(0, 200), menge: 1, einheit: 'pauschal', einzelpreisCent: Math.max(0, cent) };
  });
}

/** Schlüssel des Merkers einer Zahlung der Einmalposten (je Mandat, Angebot und Zahlung — fest, idempotent). */
export const einmalSchluessel = (mandatId: string, angebotId: string, nr: number) => vorbereitenSchluessel(mandatId, `e:${angebotId}:${nr}`);
/** Kennung der Aufgabe „Rechnung prüfen & stellen“ einer Zahlung der Einmalposten (kurz genug: Angebots-Kennung nur als Fingerabdruck). */
export const einmalAufgabeId = (mandatId: string, angebotId: string, nr: number) => `rve-${mandatId}-${fnv(angebotId)}-${nr}`.slice(0, 80);
const fnv = (t: string) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };


/** Welche Rate (1-basiert) ist ein Ratenmonat — für den Titel der Aufgabe; null ohne Raten. Rein. */
export function rateNummer(m: Pick<Mandat, 'honorar' | 'start' | 'ende'> & Partial<Pick<Mandat, 'zahlplan' | 'raten' | 'mindestlaufzeitMonate'>>, monat: string): { nr: number; von: number } | null {
  if (!m.raten) return null;
  const zp = zahlplanMonate(m);
  const i = zp ? zp.indexOf(monat) : -1;
  return i < 0 ? null : { nr: i + 1, von: m.raten.anzahl };
}

/** Gibt es zu Mandat und Monat schon einen Entwurf oder eine Rechnung (nicht storniert, nicht aus einem Angebot)? Dann bereitet der Lauf nichts vor. Rein. */
export function rechnungFuerMonat(rechnungen: readonly Partial<Pick<Rechnung, 'mandatId' | 'leistungVon' | 'leistungBis' | 'status' | 'art' | 'angebotId'>>[], mandatId: string, monat: string): boolean {
  // 31.10.: eine Rechnung über mehrere Monate (Quartal) deckt jeden ihrer Monate.
  return rechnungen.some(r => r.mandatId === mandatId && !r.angebotId && r.art !== 'storno' && r.status !== 'storniert' && rechnungsMonate(r).includes(monat));
}
/** Gibt es zum Mandat überhaupt eine Rechnung bzw. einen Entwurf (nicht storniert, nicht aus einem Angebot)? Für das einmalige Honorar. Rein. */
export function rechnungFuerMandat(rechnungen: readonly Partial<Pick<Rechnung, 'mandatId' | 'status' | 'art' | 'angebotId'>>[], mandatId: string): boolean {
  return rechnungen.some(r => r.mandatId === mandatId && !r.angebotId && r.art !== 'storno' && r.status !== 'storniert');
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
