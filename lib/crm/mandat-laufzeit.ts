// ─── Mandat — Laufzeit, Leistungsmonate, Zahlplan (rein, client-sicher, getestet; 18.10.) ───────────────────────────────────────
// EINE Regel für Monatsrechnung UND Liquiditätsplan (Kevin 18.10.: Teilmonat „Anteilig“; Nachprüfung 18.10., N4). Vorher rechnete der
// Liquiplan-Posten eines Mandats vom 18.10. für sechs Monate sieben volle Zahlungen (der erste und der letzte Monat zählten ganz), die
// Rechnungen dagegen den Oktober und den April anteilig. Jetzt rechnen beide hier:
//   · `leistungsmonat`  Monat ∩ [Beginn, Ende] (beide Tage eingeschlossen) — angebrochen = „anteilig“
//   · `monatsHonorar`   Monatshonorar × Tage ÷ Tage des Monats, auf den Cent kaufmännisch (lib/finanzen/ust.ts) — sonst das volle Honorar
//   · `monatsBrutto`    der Rechnungsbetrag eines Leistungsmonats (eine Position: netto + USt, kaufmännisch) — dieselbe Zahl wie die Rechnung
//   · `geplantesEnde`   Ende des Mandats; ohne Ende und ohne automatische Verlängerung der letzte Tag der Mindestlaufzeit
//   · `mandatZahlplan`  die Zahlungen: je angebrochenem Monat eine einmalige, die vollen Monate als EIN Monatsposten
// Zahltag = Beginn der Leistung im Monat (der 1., im ersten Monat der Beginn) + Zahlungsziel — wie der Liquiplan-Posten seit dem 17.10.

import type { Mandat } from './typen';
import { aufCent, bruttoAusNetto, nettoAusBrutto } from '@/lib/finanzen/ust';

const tagOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`));
const tagMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
/** Kalendertage von `a` bis `b` (b − a), über UTC-Mittag — keine Zeitumstellung im Weg. */
const tageZwischen = (a: string, b: string) => Math.round((tagMs(b) - tagMs(a)) / 864e5);
const plusTage = (d: string, n: number) => new Date(tagMs(d) + n * 864e5).toISOString().slice(0, 10);

/** Tag + n Monate, am Monatsende gekappt (31.01. + 1 → 28.02.), danach + t Tage. */
export function plusMonateGekappt(datum: string, n: number, t = 0): string {
  const [j, mo, ta] = datum.slice(0, 10).split('-').map(Number);
  const ziel = new Date(Date.UTC(j, mo - 1 + n, 1, 12));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0, 12)).getUTCDate();
  ziel.setUTCDate(Math.min(ta, letzter) + t);
  return ziel.toISOString().slice(0, 10);
}
/** „JJJJ-MM“ + n Monate. */
const monatPlus = (monat: string, n: number) => plusMonateGekappt(`${monat}-01`, n).slice(0, 7);
/** Monate von `a` bis `b` („JJJJ-MM“, b − a). */
const monateZwischen = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

/** Erster und letzter Tag eines Monats „JJJJ-MM“. */
export function monatsGrenzen(monat: string): { von: string; bis: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) return null;
  const [j, m] = monat.split('-').map(Number);
  const letzter = new Date(Date.UTC(j, m, 0)).getUTCDate();
  return { von: `${monat}-01`, bis: `${monat}-${String(letzter).padStart(2, '0')}` };
}

// ── Teilmonat (Kevin 18.10.: „Anteilig“) ─────────────────────────────────────

/**
 * Der Leistungszeitraum eines Mandats in einem Monat: Monat ∩ [Beginn, Ende], beide Tage eingeschlossen. Beginnt das Mandat mitten
 * im Monat (bzw. endet es dort), ist der Monat „anteilig“ — die Monatsrechnung (und der Liquiplan) rechnen dann nur diese Tage.
 * `tage` 0 = das Mandat läuft in diesem Monat gar nicht. null = kein gültiger Monat „JJJJ-MM“.
 */
export interface Leistungsmonat { monat: string; von: string; bis: string; tage: number; monatsTage: number; anteilig: boolean }
export function leistungsmonat(m: Partial<Pick<Mandat, 'start' | 'ende'>>, monat: string): Leistungsmonat | null {
  const g = monatsGrenzen(monat);
  if (!g) return null;
  const von = tagOk(m.start) && m.start > g.von ? m.start : g.von;
  const bis = tagOk(m.ende) && m.ende < g.bis ? m.ende : g.bis;
  const monatsTage = tageZwischen(g.von, g.bis) + 1;
  const tage = von <= bis ? tageZwischen(von, bis) + 1 : 0;
  return { monat, von, bis, tage, monatsTage, anteilig: tage > 0 && tage < monatsTage };
}

/** Läuft das Mandat in diesem Monat (mindestens einen Tag)? */
export const mandatLaeuftIm = (m: Partial<Pick<Mandat, 'start' | 'ende'>>, monat: string) => (leistungsmonat(m, monat)?.tage ?? 0) > 0;

/**
 * Honorar eines Leistungsmonats, wie es am Mandat steht (netto bzw. brutto): angebrochen und Honorar je Monat → Honorar × Tage ÷ Tage
 * des Monats, auf den Cent kaufmännisch; sonst das volle Honorar (bit-gleich wie vorher).
 */
export function monatsHonorar(m: Pick<Mandat, 'honorar'>, lm: Leistungsmonat | null | undefined): number {
  const teil = lm?.anteilig && m.honorar.basis === 'monat' ? lm : null;
  return teil ? aufCent((m.honorar.betrag * teil.tage) / teil.monatsTage) : m.honorar.betrag;
}

/** USt-Satz der Monatsrechnung: 0, 7 oder 19 — ein unbekannter Wert gilt als 19 (wie `positionAusMandat`). */
export const rechnungsSatz = (s: number) => ([0, 7, 19].includes(s) ? s : 19);

/**
 * Bruttobetrag eines Leistungsmonats — dieselbe Zahl wie die Monatsrechnung (eine Position, Steuer kaufmännisch auf den Cent):
 * netto = Honorar (bzw. aus dem Brutto-Honorar zurückgerechnet), brutto = netto + USt. Kleinunternehmer führen am Mandat 0 %.
 */
export function monatsBrutto(m: Pick<Mandat, 'honorar' | 'ustSatz'>, lm: Leistungsmonat | null | undefined): number {
  const satz = rechnungsSatz(m.ustSatz);
  const h = monatsHonorar(m, lm);
  return bruttoAusNetto(m.honorar.netto ? h : nettoAusBrutto(h, satz), satz);
}

// ── Laufzeit ─────────────────────────────────────────────────────────────────

/** Letzter Tag der Mindestlaufzeit: Beginn + n Monate − 1 Tag (am Monatsende gekappt) — 18.10. + 6 Monate → 17.04. null ohne Angaben. */
export function mindestEnde(m: Partial<Pick<Mandat, 'start' | 'mindestlaufzeitMonate'>>): string | null {
  return tagOk(m.start) && m.mindestlaufzeitMonate && m.mindestlaufzeitMonate > 0 ? plusMonateGekappt(m.start, m.mindestlaufzeitMonate, -1) : null;
}

/**
 * Das Ende der laufenden Periode eines Mandats — der LETZTE Tag (inklusiv), EINE Regel für Fenster „Mandat anlegen“, Mandat, Kalender-Fristen, „Mandat beenden“
 * (Fall) und Liquidität (25.10., Kern-Bau-Test 2: das Fenster sagte „bis 14.03.2027“, das Mandat „Ende Mo 15.3.“ — Start + Monate ohne den Tag davor): das gesetzte
 * Ende; sonst das Ende der Mindestlaufzeit (`mindestEnde`); bei automatischer Verlängerung die laufende Monatsperiode danach (liegt das Ende zurück). null ohne Angaben.
 */
export function laufzeitEnde(m: Partial<Pick<Mandat, 'start' | 'ende' | 'mindestlaufzeitMonate' | 'verlaengerung'>>, heute: string): string | null {
  if (m.ende) return m.ende.slice(0, 10);
  if (!tagOk(m.start) || !m.mindestlaufzeitMonate || m.mindestlaufzeitMonate <= 0) return null;
  let n = m.mindestlaufzeitMonate;
  let e = plusMonateGekappt(m.start, n, -1);
  while (m.verlaengerung === 'auto' && e < heute && n < 1200) e = plusMonateGekappt(m.start, ++n, -1);
  return e;
}
/** Das Ende der Laufzeit in Worten — EIN Format überall, wo das Mandatsende steht: „14.03.2027“. */
export const endeText = (tag: string): string => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}`;

/**
 * Bis wann ein Mandat geplant läuft (letzter Tag): das Ende; ohne Ende und ohne automatische Verlängerung der letzte Tag der
 * Mindestlaufzeit; sonst offen (null). Die Monatsrechnung kennt nur das Ende (ein Mandat über die Mindestlaufzeit hinaus lässt sich
 * weiter abrechnen) — der Liquiplan plant mit diesem Tag, und „Mandat beenden“ schlägt ihn als Ende vor.
 */
export function geplantesEnde(m: Partial<Pick<Mandat, 'start' | 'ende' | 'mindestlaufzeitMonate' | 'verlaengerung'>>): string | null {
  if (tagOk(m.ende)) return m.ende;
  return m.verlaengerung === 'auto' ? null : mindestEnde(m);
}

// ── Zahlplan ─────────────────────────────────────────────────────────────────

/** Zahlungsziel eines Mandats in Tagen (ohne Angabe 14 — wie bisher). */
export const zahlungsziel = (m: Pick<Mandat, 'zahlungszielTage'>) => (m.zahlungszielTage > 0 ? m.zahlungszielTage : 14);

/** Eine einmalige Zahlung für einen angebrochenen Monat. */
export interface ZahlplanTeil { monat: string; lm: Leistungsmonat; betrag: number; am: string }
/**
 * Die vollen Monate als EIN Monatsposten: erster Zahltag `ab`, letzter Zahltag `bis` (null = offen), Betrag je Monat, Anzahl Monate.
 * `bis` = `ab` + (Anzahl − 1) Monate (gekappt) — genau der letzte Zahltag des Postens, nie einer mehr.
 */
export interface ZahlplanVoll { ab: string; bis: string | null; betrag: number; monate: number | null; vonMonat: string; bisMonat: string | null }
export interface Zahlplan { voll: ZahlplanVoll | null; teile: ZahlplanTeil[] }

/**
 * Der Zahlplan eines Mandats mit Honorar je Monat, ab dem Monat `abMonat` bis zum letzten Tag `ende` (null = offen):
 * angebrochene Monate (Beginn bzw. Ende mitten im Monat) je eine einmalige Zahlung, die vollen Monate dazwischen ein Monatsposten.
 * Zahltag = Beginn der Leistung im Monat + Zahlungsziel. Leer, wenn im Zeitraum nichts läuft.
 */
export function mandatZahlplan(m: Pick<Mandat, 'start' | 'honorar' | 'ustSatz' | 'zahlungszielTage'>, abMonat: string, ende: string | null): Zahlplan {
  const laufzeit = { start: m.start, ...(ende ? { ende } : {}) };
  const ziel = zahlungsziel(m);
  const startMonat = tagOk(m.start) && m.start.slice(0, 7) > abMonat ? m.start.slice(0, 7) : abMonat;
  const endMonat = ende ? ende.slice(0, 7) : null;
  if (endMonat && endMonat < startMonat) return { voll: null, teile: [] };
  const teil = (monat: string): ZahlplanTeil | null => {
    const lm = leistungsmonat(laufzeit, monat);
    return lm && lm.tage > 0 ? { monat, lm, betrag: monatsBrutto(m, lm), am: plusTage(lm.von, ziel) } : null;
  };
  const erster = leistungsmonat(laufzeit, startMonat);
  if (!erster || !erster.tage) return { voll: null, teile: [] };
  const teile: ZahlplanTeil[] = [];
  let vonMonat = startMonat;
  if (erster.anteilig) { teile.push(teil(startMonat)!); vonMonat = monatPlus(startMonat, 1); }
  let bisMonat = endMonat;
  let endTeil: ZahlplanTeil | null = null;
  if (endMonat && endMonat !== startMonat) {
    const letzter = leistungsmonat(laufzeit, endMonat)!;
    if (letzter.anteilig) { endTeil = teil(endMonat); bisMonat = monatPlus(endMonat, -1); }
  } else if (endMonat === startMonat) bisMonat = erster.anteilig ? monatPlus(startMonat, -1) : startMonat;
  let voll: ZahlplanVoll | null = null;
  if (!bisMonat || bisMonat >= vonMonat) {
    const ab = plusTage(`${vonMonat}-01`, ziel);
    const monate = bisMonat ? monateZwischen(vonMonat, bisMonat) + 1 : null;
    voll = { ab, bis: monate ? plusMonateGekappt(ab, monate - 1) : null, betrag: monatsBrutto(m, null), monate, vonMonat, bisMonat };
  }
  if (endTeil) teile.push(endTeil);
  return { voll, teile };
}

/** „Oktober 2026“ */
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const monatsName = (monat: string) => (/^\d{4}-\d{2}$/.test(monat) ? `${MONATE[Number(monat.slice(5)) - 1]} ${monat.slice(0, 4)}` : monat);
