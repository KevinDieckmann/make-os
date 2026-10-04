// ─── Finanzplanung jetzt — Handwerte: jede gerechnete Zahl ist überschreibbar (rein, client-sicher) ─────
// Kevin 04.10.: „Bau sofort in der Finanzplanung, dass ich alle Felder — auch unten die Kosten, die Einzahlungen, die
// Steuern, whatever — alles selber bearbeiten kann. Jede Zahl. Nur die Formeln sind im Hintergrund immer hart gecodet.“
//
// EINE Schicht, EINE Stelle: Ein Handwert ist ein Eintrag im Plan-Dokument `plan["<kennung>:<monat>"]` — genau dort, wo
// das Blatt seit dem 27.09. Planzellen überschreibt (Zeilen wie `ug.s.miete:3` und die Rechenzeilen `ug.ob:3`). Neu ist
// nur, dass der Rechenkern JEDEN gerechneten Wert über `hand()` (rechenkern.ts) laufen lässt: steht ein Handwert da, nimmt
// er ihn statt des gerechneten Werts, und alles Nachgelagerte (Summen, Ergebnis, Steuern im Folgejahr, Konto, frei
// verfügbar, Kennzahlen, Ziele, Business-Index-Quellen) rechnet mit dem Handwert weiter. Die Formeln selbst bleiben
// unverändert; ohne Handwerte rechnet der Kern bit-genau wie vorher (tests/finanzplan-regression.test.ts).
//
// Werte ohne Monat (Abschluss der Selbstständigkeit) nehmen Monat 0: `plan["ab.est:0"]`.
// Geschrieben wird nur über die Operationen (PATCH /api/finanzplan, Stand/409, Protokoll, Rückgängig) — kein zweiter Weg.
// Handwerte gelten für den ganzen Plan (alle Szenarien), wie die Zellen-Überschreibungen schon bisher.

export type HandOrt = 'ug' | 'kdv' | 'kdc' | 'privat' | 'gruppe' | 'abschluss';
export interface HandFeld {
  /** Name für Protokoll, Tooltip und Meldungen. */
  name: string;
  ort: HandOrt;
  /** Summenzeile: der Handwert ersetzt die Summe, die Abweichung zur Summe der Einzelzeilen wird angezeigt. */
  summe?: boolean;
  /** Bestand (Kontostand o. ä.): die Folgemonate rechnen vom Handwert aus weiter. */
  stand?: boolean;
  /** Worauf der Handwert wirkt — steht im Tooltip. */
  wirkt: string;
}

const f = (name: string, ort: HandOrt, wirkt: string, extra: Partial<HandFeld> = {}): HandFeld => ({ name, ort, wirkt, ...extra });
const ERTRAG = 'Ergebnis nach Steuern, Steuerrücklage und die Zahlung im Folgejahr';

/**
 * Alle gerechneten Werte, die man von Hand überschreiben kann — Kennung (ohne Monat) → Beschreibung. Die ersten zehn gab es schon
 * (27.09., „Rechenzeilen“); ihre Kennungen bleiben (Kern-Namen unverändert). Neue gerechnete Werte bekommen hier einen Eintrag und im
 * Kern ein `h('<kennung>', m, …)`.
 */
export const HAND_FELDER: Record<string, HandFeld> = {
  // ── MAKE Innovation GmbH (Kennung ug) — Umsatz ──
  'ug.ob': f('Ankermandat', 'ug', 'Umsatz, Ergebnis, Einzahlungen'),
  'ug.retainer': f('Retainer', 'ug', 'Umsatz, Ergebnis, Eingang Retainer (mit Verzug)'),
  'ug.astarna': f('Provision', 'ug', 'Umsatz, Ergebnis, Einzahlungen, USt'),
  'ug.events': f('Events', 'ug', 'Umsatz, Ergebnis, Einzahlungen, USt'),
  'ug.umsatz': f('Umsatz', 'ug', 'Ergebnis vor Steuern, Ertragsteuer, Kennzahlen — der Zahlungseingang steht unter „Einzahlungen“', { summe: true }),
  // ── Kosten ──
  'ug.kevin': f('Gehalt 1 brutto', 'ug', 'Personal, Ergebnis, Auszahlungen, Netto im Privat-Blatt'),
  'ug.malin': f('Gehalt 2 brutto', 'ug', 'Personal, Ergebnis, Auszahlungen, Netto im Privat-Blatt'),
  'ug.unterstuetzung': f('Unterstützung', 'ug', 'Personal, Ergebnis, Auszahlungen'),
  'ug.personal': f('Personal inkl. Arbeitgeber', 'ug', 'Kosten, Ergebnis, Auszahlungen, Mindestumsatz', { summe: true }),
  'ug.einmalig': f('Einmalige Kosten und Ereignisse', 'ug', 'Sachkosten, Ergebnis, Auszahlungen'),
  'ug.gruendung': f('Gründung', 'ug', 'Kosten, Ergebnis, Auszahlungen'),
  'ug.holding': f('Holding-Umlage', 'ug', 'Kosten, Ergebnis, Auszahlungen; die Umlage bei KD Ventures folgt der Formel'),
  'ug.laufend': f('Laufende Kosten (Mindestumsatz)', 'ug', 'Mindestumsatz, Reserve-Ziel, Kosten gesamt, Ergebnis, Auszahlungen', { summe: true }),
  'ug.kosten': f('Kosten gesamt', 'ug', 'Ergebnis vor Steuern, Ertragsteuer, Auszahlungen', { summe: true }),
  // ── Ergebnis und Steuern ──
  'ug.gewinn': f('Ergebnis vor Steuern', 'ug', 'Ertragsteuer (Aufwand, Rücklage, Zahlung im Folgejahr)', { summe: true }),
  'ug.kst': f('Körperschaftsteuer', 'ug', ERTRAG),
  'ug.soli': f('Solidaritätszuschlag', 'ug', ERTRAG),
  'ug.gewst': f('Gewerbesteuer', 'ug', ERTRAG),
  'ug.est': f('Einkommensteuer', 'ug', ERTRAG),
  'ug.anrechnung': f('Anrechnung Gewerbesteuer', 'ug', ERTRAG),
  'ug.ergebnisNach': f('Ergebnis nach Steuern', 'ug', 'Anzeige und Kacheln (Ergebnis nach Steuern)', { summe: true }),
  'ug.verlustvortrag': f('Verlustvortrag zu Jahresbeginn', 'ug', 'Ertragsteuer des laufenden Jahres'),
  'ug.steuer': f('Ertragsteuer-Zahlung', 'ug', 'Auszahlungen, Kontostand, Steuerrücklage'),
  'ug.steuerRuecklage': f('Steuerrücklage', 'ug', 'Frei verfügbar, Töpfe'),
  // ── Zahlungsfluss und Liquidität ──
  'ug.retainerEingang': f('Eingang Retainer', 'ug', 'Einzahlungen, USt, Kontostand'),
  'ug.bausteineEingang': f('Eingang aus Bausteinen', 'ug', 'Einzahlungen, USt, Kontostand'),
  'ug.kapital': f('Stammkapital und Gesellschafterdarlehen', 'ug', 'Einzahlungen, Kontostand'),
  'ug.ustEin': f('USt vereinnahmt', 'ug', 'Einzahlungen, USt offen, USt-Zahlung im Folgemonat'),
  'ug.einzahlungen': f('Einzahlungen', 'ug', 'Kontostand, frei verfügbar', { summe: true }),
  'ug.ausschuettung': f('Ausschüttung an Privat', 'ug', 'Auszahlungen, Kontostand; Privat folgt der Formel'),
  'ug.bjoern': f('Partnerdarlehen-Rate', 'ug', 'Auszahlungen, Kontostand; KD Ventures folgt der Formel'),
  'ug.darlehen': f('Darlehen zurück', 'ug', 'Auszahlungen, Kontostand'),
  'ug.ustZahlung': f('USt an Finanzamt', 'ug', 'Auszahlungen, Kontostand'),
  'ug.auszahlungen': f('Auszahlungen', 'ug', 'Kontostand, frei verfügbar', { summe: true }),
  'ug.konto': f('Kontostand', 'ug', 'Frei verfügbar und alle Folgemonate', { stand: true }),
  'ug.ustOffen': f('USt offen', 'ug', 'Frei verfügbar, USt-Zahlung im Folgemonat'),
  'ug.frei': f('Frei verfügbar', 'ug', 'Kennzahlen, Runway, Ziele, Gruppe, Business-Index', { stand: true }),
  // ── Töpfe ──
  'ug.reserveZiel': f('Reserve-Ziel', 'ug', 'Reserve und frei in den Töpfen'),
  'ug.reserve': f('Reserve', 'ug', 'Frei in den Töpfen'),
  'ug.topfFrei': f('Frei (Töpfe)', 'ug', 'Nur die Töpfe'),

  // ── KD Ventures (Kennung kdv) ──
  'kdv.umlage': f('Umlage', 'kdv', 'Einnahmen, laufendes Ergebnis (Ertragsteuer), Kontostand'),
  'kdv.bjoernEin': f('Partnerdarlehen-Rate von der Gesellschaft', 'kdv', 'Einnahmen, laufendes Ergebnis, Kontostand'),
  'kdv.exit': f('Ausstieg (Tranchen)', 'kdv', 'Einnahmen, Steuer auf den Ausstieg, Kontostand'),
  'kdv.einnahmen': f('Einnahmen', 'kdv', 'Ergebnis, Ertragsteuer, Kontostand', { summe: true }),
  'kdv.holding': f('Holdingkosten', 'kdv', 'Ausgaben, laufendes Ergebnis, Kontostand'),
  'kdv.tilgung': f('Partnerdarlehen-Tilgung', 'kdv', 'Ausgaben, laufendes Ergebnis, Kontostand, Partnerdarlehen offen'),
  'kdv.ausgaben': f('Ausgaben', 'kdv', 'Ergebnis, Ertragsteuer, Kontostand', { summe: true }),
  'kdv.ergebnis': f('Ergebnis vor Steuern', 'kdv', 'Ertragsteuer KD Ventures (der Ausstieg hat seine eigene Steuer)', { summe: true }),
  'kdv.kst': f('Körperschaftsteuer', 'kdv', ERTRAG),
  'kdv.soli': f('Solidaritätszuschlag', 'kdv', ERTRAG),
  'kdv.gewst': f('Gewerbesteuer', 'kdv', ERTRAG),
  'kdv.est': f('Einkommensteuer', 'kdv', ERTRAG),
  'kdv.anrechnung': f('Anrechnung Gewerbesteuer', 'kdv', ERTRAG),
  'kdv.exitSteuer': f('Steuer auf den Ausstieg', 'kdv', 'Kontostand, Ergebnis nach Steuern'),
  'kdv.ergebnisNach': f('Ergebnis nach Steuern', 'kdv', 'Anzeige und Kacheln', { summe: true }),
  'kdv.verlustvortrag': f('Verlustvortrag zu Jahresbeginn', 'kdv', 'Ertragsteuer des laufenden Jahres'),
  'kdv.abloesung': f('Partnerdarlehen-Ablösung', 'kdv', 'Kontostand, Partnerdarlehen offen'),
  'kdv.steuer': f('Ertragsteuer-Zahlung', 'kdv', 'Kontostand, Steuerrücklage'),
  'kdv.steuerRuecklage': f('Steuerrücklage', 'kdv', 'Frei verfügbar'),
  'kdv.konto': f('Kontostand KD Ventures', 'kdv', 'Frei verfügbar und alle Folgemonate', { stand: true }),
  'kdv.frei': f('Frei verfügbar KD Ventures', 'kdv', 'Kennzahlen, Ziele, Gruppe', { stand: true }),
  'kdv.darlehenOffen': f('Partnerdarlehen offen', 'kdv', 'Ziele (Partnerdarlehen) und alle Folgemonate', { stand: true }),

  // ── Selbstständigkeit (Kennung kdc) ──
  'kdc.umsatz': f('Umsatz', 'kdc', 'Ergebnis, Einkommen- und Gewerbesteuer, Entnahme-Anteil — der Zahlungseingang steht unter „Eingang“', { summe: true }),
  'kdc.kosten': f('Kosten gesamt', 'kdc', 'Ergebnis, Steuern, Auszahlungen', { summe: true }),
  'kdc.gewinn': f('Ergebnis vor Steuern', 'kdc', 'Einkommen- und Gewerbesteuer, Entnahme-Anteil', { summe: true }),
  'kdc.kst': f('Körperschaftsteuer', 'kdc', ERTRAG),
  'kdc.soli': f('Solidaritätszuschlag', 'kdc', ERTRAG),
  'kdc.gewst': f('Gewerbesteuer', 'kdc', ERTRAG),
  'kdc.est': f('Einkommensteuer', 'kdc', ERTRAG),
  'kdc.anrechnung': f('Anrechnung Gewerbesteuer (§ 35 EStG)', 'kdc', ERTRAG),
  'kdc.ergebnisNach': f('Ergebnis nach Steuern', 'kdc', 'Entnahme-Anteil, Kacheln', { summe: true }),
  'kdc.verlustvortrag': f('Verlustvortrag zu Jahresbeginn', 'kdc', 'Steuer des laufenden Jahres'),
  'kdc.eingang': f('Eingang aus Umsatz', 'kdc', 'Einzahlungen, USt, Kontostand'),
  'kdc.ustEin': f('USt vereinnahmt', 'kdc', 'Einzahlungen, USt offen, USt-Zahlung im Folgemonat'),
  'kdc.einzahlungen': f('Einzahlungen', 'kdc', 'Kontostand', { summe: true }),
  'kdc.steuer': f('Steuerzahlung (Einkommen- und Gewerbesteuer)', 'kdc', 'Auszahlungen, Kontostand, Steuerrücklage'),
  'kdc.entnahme': f('Entnahme an Privat', 'kdc', 'Auszahlungen, Kontostand; Privat folgt der Formel'),
  'kdc.ustZahlung': f('USt an Finanzamt', 'kdc', 'Auszahlungen, Kontostand'),
  'kdc.auszahlungen': f('Auszahlungen', 'kdc', 'Kontostand', { summe: true }),
  'kdc.konto': f('Kontostand', 'kdc', 'Frei verfügbar und alle Folgemonate', { stand: true }),
  'kdc.steuerRuecklage': f('Steuerrücklage', 'kdc', 'Frei verfügbar'),
  'kdc.ustOffen': f('USt offen', 'kdc', 'Frei verfügbar, USt-Zahlung im Folgemonat'),
  'kdc.frei': f('Frei verfügbar', 'kdc', 'Kennzahlen, Gruppe', { stand: true }),

  // ── Privat ──
  'p.kevinNetto': f('Gehalt 1 netto', 'privat', 'Verfügbar, Luft, Angespart'),
  'p.malinNetto': f('Gehalt 2 netto', 'privat', 'Verfügbar, Luft, Angespart'),
  'p.malinSelbst': f('Gehalt 2 brutto (Selbstständigkeit)', 'privat', 'Netto, Verfügbar'),
  'p.weitere': f('Weitere Einnahmen', 'privat', 'Verfügbar, Luft', { summe: true }),
  'p.bausteineEin': f('Einnahmen aus Bausteinen', 'privat', 'Verfügbar, Luft'),
  'p.ausschuettungSteuer': f('Steuer auf die Ausschüttung', 'privat', 'Ausschüttung netto, Verfügbar'),
  'p.ausschuettung': f('Ausschüttung netto', 'privat', 'Verfügbar, Luft'),
  'p.entnahme': f('Entnahme aus der Selbstständigkeit', 'privat', 'Verfügbar, Luft'),
  'p.verfuegbar': f('Verfügbar', 'privat', 'Luft, Angespart', { summe: true }),
  'p.bedarf': f('Bedarf', 'privat', 'Luft, Angespart', { summe: true }),
  'p.schulden': f('Schulden', 'privat', 'Luft, Angespart', { summe: true }),
  'p.ereignisse': f('Lebensereignisse', 'privat', 'Luft, Angespart'),
  'p.bausteineAus': f('Ausgaben aus Bausteinen', 'privat', 'Luft, Angespart'),
  'p.luft': f('Luft je Monat', 'privat', 'Angespart und alle Folgemonate', { summe: true }),
  'p.sparen': f('Sparen + Luft', 'privat', 'Nur die Anzeige'),
  'p.angespart': f('Angespart', 'privat', 'Ziele, Kennzahlen, Gruppe und alle Folgemonate', { stand: true }),

  // ── Gruppe ──
  'g.frei': f('Freies Geld Gruppe', 'gruppe', 'Ziel „Gruppe“, Kennzahl Gruppe', { summe: true, stand: true }),

  // ── Abschluss 2026 der Selbstständigkeit (ohne Monat: Monat 0) ──
  'ab.ein': f('Einnahmen 2026', 'abschluss', 'Gewinn, Steuer, frei nach Abschluss', { summe: true }),
  'ab.aus': f('Ausgaben 2026', 'abschluss', 'Gewinn, Steuer, frei nach Abschluss', { summe: true }),
  'ab.gewinn': f('Gewinn 2026', 'abschluss', 'zu versteuern, Einkommensteuer', { summe: true }),
  'ab.zve': f('zu versteuern', 'abschluss', 'Einkommensteuer 2026'),
  'ab.est': f('Einkommensteuer 2026', 'abschluss', 'frei nach Abschluss'),
  'ab.frei': f('Frei nach Abschluss', 'abschluss', 'nach Ablösung'),
  'ab.nachConsors': f('nach Ablösung', 'abschluss', 'Nur die Anzeige'),
};

/** Ist das eine gerechnete Größe (und keine Planzeile)? */
export const istHandFeld = (id: string): boolean => Object.prototype.hasOwnProperty.call(HAND_FELDER, id);

/** Zellen-Schlüssel eines Handwerts — wie jede Planzelle `<kennung>:<monat>` (Monat 0 = ohne Monat). */
export const handSchluessel = (id: string, m: number): string => `${id}:${m}`;

/** Gerechnete Werte, die von Hand überschrieben sind, mit ihrem Formelwert: Schlüssel `<kennung>:<monat>` → Formelwert. */
export type Formeln = Record<string, number>;

/** Abweichung des Handwerts vom Formelwert (Handwert − Formel) — null, wenn die Zelle nicht von Hand ist. */
export function abweichung(plan: Record<string, number>, formel: Formeln, schluessel: string): number | null {
  if (!(schluessel in plan) || !(schluessel in formel)) return null;
  return plan[schluessel] - formel[schluessel];
}

/** Alle Handwerte gerechneter Größen im Plan (ohne Planzeilen-Überschreibungen) — für „alle zurücksetzen“ und den Bericht. */
export function handwerteImPlan(plan: Record<string, number>): string[] {
  return Object.keys(plan).filter(k => { const i = k.lastIndexOf(':'); return i > 0 && istHandFeld(k.slice(0, i)); });
}

/** Höchstzahl der Zellen im Plan (Planzeilen + Handwerte) — darüber lehnt der Schreibweg ab (413), gekürzt wird nie. */
export const GRENZE_PLAN_ZELLEN = 20_000;
/** Ein Zellen-Schlüssel: Kennung (ohne Doppelpunkt/Leerzeichen) + „:“ + Monat (0 = ohne Monat). */
export const ZELLE_MUSTER = /^[^:\s]{1,160}:(\d{1,3})$/;
