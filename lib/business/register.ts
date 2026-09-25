// ─── Business-Index — die Kennzahlen (eine Wahrheit) ────────────────────────
// Kevin 25.09.2026: „Die ganzen Kennzahlen des KSI-Scores sind Gold wert für
// den kompletten Business-Bereich.“ Entschieden: eigener Name (Business-Index),
// dieselbe Logik — Finanzielle Gesundheit 50 % · Unternehmer-DNA 30 % ·
// Markttraktion 20 % —, gerechnet NUR mit unseren eigenen Zahlen. Übernommen
// sind Struktur und Standard-Kennzahlen (Lehrbuch: Runway, DSO, Quick Ratio,
// Win Rate, NRR …), kein Code und keine Daten aus KEMARIS/POINCAP/HubSpot.
// Schwellen: FH-/MDNA-Marktanalyse und DevSpec 08.07. (Win Rate ≥ 25 %).
//
// Jede Kennzahl sagt, wie sie rechnet (formel), woher (quelle), was gut ist
// (gruen/rot) und — wenn Daten fehlen — wie man die Lücke schließt.

export type SaeuleId = 'fh' | 'ud' | 'mt';
export type Scope = 'gesamt' | 'kdc' | 'kdv';
export const SCOPES: { id: Scope; label: string }[] = [
  { id: 'gesamt', label: 'Gesamt' },
  { id: 'kdc', label: 'Consulting' },
  { id: 'kdv', label: 'KD Ventures' },
];

export const SAEULEN: { id: SaeuleId; label: string; gewicht: number; satz: string }[] = [
  { id: 'fh', label: 'Finanzielle Gesundheit', gewicht: 0.5, satz: 'Liquidität, Forderungen, Ausgaben, Kapital' },
  { id: 'ud', label: 'Unternehmer-DNA', gewicht: 0.3, satz: 'Produktivität und wie der Unternehmer arbeitet' },
  { id: 'mt', label: 'Markttraktion', gewicht: 0.2, satz: 'Vertrieb, Kunden, Wachstum' },
];

export type Einheit = 'eur' | 'prozent' | 'monate' | 'tage' | 'faktor' | 'stunden' | 'anzahl' | 'punkte';
export type Richtung = 'hoch' | 'niedrig';

export interface KennzahlDef {
  id: string;
  label: string;
  saeule: SaeuleId;
  gruppe: string;
  einheit: Einheit;
  /** hoch = mehr ist besser; niedrig = weniger ist besser */
  richtung: Richtung;
  /** Ab hier grün (inklusive) … */
  gruen: number;
  /** … ab hier rot (hoch: darunter, niedrig: darüber). */
  rot: number;
  formel: string;
  quelle: string;
  /** Wie man die Lücke schließt, wenn Daten fehlen. */
  luecke: string;
  /** Wo man die Daten pflegt. */
  pflegen?: { text: string; href: string };
  /** Nur in der Gesamtsicht (personen- oder firmenübergreifend). */
  nurGesamt?: boolean;
  /** Wert ist schon ein Score 0–100 (Traktion) — Punkte = Wert. */
  direkt?: boolean;
}

const ABSCHLUSS = { text: 'Monatsabschluss eintragen', href: '/os/business#abschluss' };
const RECHNUNGEN = { text: 'Rechnungen pflegen', href: '/os/finanzen' };

export const KENNZAHLEN: KennzahlDef[] = [
  // ── Finanzielle Gesundheit · Liquidität ──
  { id: 'liquiditaet', label: 'Liquidität', saeule: 'fh', gruppe: 'Liquidität', einheit: 'monate', richtung: 'hoch', gruen: 3, rot: 1,
    formel: 'Kontostände der Geschäftskonten ÷ monatliche Kosten', quelle: 'Kontostände (Finanzplanung) + Kosten der letzten 3 Monate',
    luecke: 'Kontostände und Monatskosten fehlen', pflegen: { text: 'Kontostände pflegen', href: '/os/finanzen' } },
  { id: 'runway', label: 'Runway', saeule: 'fh', gruppe: 'Liquidität', einheit: 'monate', richtung: 'hoch', gruen: 6, rot: 3,
    formel: 'Liquidität ÷ Ø Netto-Verbrauch (Kosten − Umsatz) der letzten 3 Monate', quelle: 'Kontostände + Ist-Monate',
    luecke: 'Kontostände oder Ist-Monate fehlen', pflegen: { text: 'Kontostände pflegen', href: '/os/finanzen' } },
  { id: 'deckung13', label: '13-Wochen-Deckung', saeule: 'fh', gruppe: 'Liquidität', einheit: 'monate', richtung: 'hoch', gruen: 1, rot: 0,
    formel: 'tiefster Kassenstand der 13-Wochen-Vorschau ÷ monatliche Kosten', quelle: 'Liquiditäts-Vorschau (Rechnungen, Zahlungen, Planposten)',
    luecke: 'Kontostände fehlen', pflegen: { text: 'Liquidität öffnen', href: '/os/finanzen' } },
  { id: 'quick_ratio', label: 'Quick Ratio', saeule: 'fh', gruppe: 'Liquidität', einheit: 'faktor', richtung: 'hoch', gruen: 1, rot: 0.8,
    formel: '(Kasse + offene Forderungen) ÷ kurzfristige Verbindlichkeiten', quelle: 'Kontostände, Rechnungen, Monatsabschluss',
    luecke: 'Kurzfristige Verbindlichkeiten fehlen', pflegen: ABSCHLUSS },
  // ── Forderungen ──
  { id: 'ueberfaellig', label: 'Überfällige Forderungen', saeule: 'fh', gruppe: 'Forderungen', einheit: 'prozent', richtung: 'niedrig', gruen: 10, rot: 25,
    formel: 'überfälliger Betrag ÷ offener Betrag gestellter Rechnungen', quelle: 'Rechnungen (Finanzplanung)',
    luecke: 'Noch keine Rechnung gestellt', pflegen: RECHNUNGEN },
  { id: 'dso', label: 'DSO (Zahlungsdauer)', saeule: 'fh', gruppe: 'Forderungen', einheit: 'tage', richtung: 'niedrig', gruen: 40, rot: 55,
    formel: 'Ø Tage von Rechnungsdatum bis Zahlungseingang (12 Monate)', quelle: 'Rechnungen mit Datum und „bezahlt am“',
    luecke: 'Mindestens 2 bezahlte Rechnungen mit Rechnungsdatum und Zahlungseingang nötig', pflegen: RECHNUNGEN },
  { id: 'konzentration', label: 'Kundenkonzentration', saeule: 'fh', gruppe: 'Forderungen', einheit: 'prozent', richtung: 'niedrig', gruen: 30, rot: 50,
    formel: 'größter Kunde ÷ monatlicher Honorarumsatz (MRR)', quelle: 'aktive Mandate mit Monatshonorar',
    luecke: 'Keine aktiven Mandate mit Monatshonorar', pflegen: { text: 'Mandate pflegen', href: '/os/mandate' } },
  // ── Ausgaben ──
  { id: 'kostenquote', label: 'Kostenquote (CIR)', saeule: 'fh', gruppe: 'Ausgaben', einheit: 'prozent', richtung: 'niedrig', gruen: 85, rot: 95,
    formel: 'Kosten ÷ Umsatz der letzten 12 Monate', quelle: 'Ist-Monate (Monatsabschluss, Grundlage, Controlling)',
    luecke: 'Umsatz der letzten 12 Monate fehlt', pflegen: ABSCHLUSS },
  { id: 'fixkostenquote', label: 'Fixkostenquote', saeule: 'fh', gruppe: 'Ausgaben', einheit: 'prozent', richtung: 'niedrig', gruen: 50, rot: 70,
    formel: 'wiederkehrende Kosten je Monat ÷ Ø Umsatz je Monat', quelle: 'Planposten (wiederkehrend) bzw. Fixkosten + Ist-Umsatz',
    luecke: 'Wiederkehrende Kosten oder Umsatz fehlen', pflegen: { text: 'Planposten pflegen', href: '/os/finanzen' } },
  { id: 'plan_ist', label: 'Kosten über Plan', saeule: 'fh', gruppe: 'Ausgaben', einheit: 'prozent', richtung: 'niedrig', gruen: 5, rot: 15,
    formel: 'Ist-Kosten ÷ geplante Kosten − 1 (letzter abgeschlossener Monat; unter Plan = 0)', quelle: 'Planposten + Ist-Monat',
    luecke: 'Plan oder Ist-Kosten des letzten Monats fehlen', pflegen: ABSCHLUSS },
  // ── Kapital ──
  { id: 'kapitaldienst', label: 'Kapitaldienstfähigkeit', saeule: 'fh', gruppe: 'Kapital', einheit: 'faktor', richtung: 'hoch', gruen: 1.2, rot: 1,
    formel: '(Ergebnis + Abschreibungen, 12 Monate) ÷ Schuldendienst (Raten, 12 Monate)', quelle: 'Ist-Monate, Monatsabschluss, Kredite',
    luecke: 'Ergebnis der letzten 12 Monate fehlt', pflegen: ABSCHLUSS },
  { id: 'ek_quote', label: 'Eigenkapitalquote', saeule: 'fh', gruppe: 'Kapital', einheit: 'prozent', richtung: 'hoch', gruen: 30, rot: 10,
    formel: 'Eigenkapital ÷ Bilanzsumme', quelle: 'Monatsabschluss (BWA/Bilanz)',
    luecke: 'Eigenkapital und Bilanzsumme fehlen', pflegen: ABSCHLUSS },

  // ── Unternehmer-DNA ──
  { id: 'umsatz_kopf', label: 'Umsatz je Kopf', saeule: 'ud', gruppe: 'Produktivität', einheit: 'eur', richtung: 'hoch', gruen: 120_000, rot: 80_000,
    formel: 'Umsatz der letzten 12 Monate ÷ Köpfe (FTE)', quelle: 'Ist-Monate + FTE-Einstellung',
    luecke: 'Köpfe (FTE) oder Umsatz fehlen', pflegen: { text: 'Köpfe eintragen', href: '/os/business#einstellungen' } },
  { id: 'personalquote', label: 'Personalaufwandsquote', saeule: 'ud', gruppe: 'Produktivität', einheit: 'prozent', richtung: 'niedrig', gruen: 60, rot: 75,
    formel: 'Personalkosten ÷ Umsatz der letzten 12 Monate', quelle: 'Monatsabschluss (Personal) bzw. Planposten „Personal“',
    luecke: 'Personalkosten fehlen', pflegen: ABSCHLUSS },
  { id: 'fokuszeit', label: 'Fokuszeit', saeule: 'ud', gruppe: 'Arbeitsweise', einheit: 'stunden', richtung: 'hoch', gruen: 10, rot: 4, nurGesamt: true,
    formel: 'geplante Fokus-Blöcke je Woche (Ø 4 Wochen)', quelle: 'Kalender · Wochenplan',
    luecke: 'Noch keine Fokus-Blöcke geplant', pflegen: { text: 'Fokus-Blöcke planen', href: '/os/planung/woche' } },
  { id: 'meetinglast', label: 'Meeting-Last', saeule: 'ud', gruppe: 'Arbeitsweise', einheit: 'stunden', richtung: 'niedrig', gruen: 20, rot: 30, nurGesamt: true,
    formel: 'Termin-Stunden je Woche in Kevins und den gemeinsamen Kalendern (Ø 4 Wochen)', quelle: 'Apple Kalender (iCloud)',
    luecke: 'Kalender-Stand fehlt', pflegen: { text: 'Kalender öffnen', href: '/os/planung/woche' } },
  { id: 'delegation', label: 'Delegation an Agenten', saeule: 'ud', gruppe: 'Arbeitsweise', einheit: 'anzahl', richtung: 'hoch', gruen: 10, rot: 3, nurGesamt: true,
    formel: 'erledigte Agenten-Aufträge je Woche, die ihr angestoßen habt (ohne Routine-Takt, Ø 4 Wochen)', quelle: 'Jarvis-Aufträge',
    luecke: 'Noch keine Agenten-Aufträge', pflegen: { text: 'Agenten öffnen', href: '/os/agenten' } },
  { id: 'meilensteine', label: 'Meilenstein-Kurs', saeule: 'ud', gruppe: 'Arbeitsweise', einheit: 'prozent', richtung: 'hoch', gruen: 70, rot: 40, nurGesamt: true,
    formel: 'Ø Fortschritt offener Business-Meilensteine (überfällige zählen 0)', quelle: 'Meilensteine (Bereich Business)',
    luecke: 'Keine Business-Meilensteine', pflegen: { text: 'Meilensteine pflegen', href: '/os/planung/jahr' } },

  // ── Markttraktion ──
  { id: 'traktion', label: 'Traktions-Score', saeule: 'mt', gruppe: 'Vertrieb', einheit: 'punkte', richtung: 'hoch', gruen: 70, rot: 40, nurGesamt: true, direkt: true,
    formel: 'Sales 50 · Marketing 40 · Event 10 (geometrisches Mittel der Ampeln)', quelle: 'Markttraktion',
    luecke: 'In der Markttraktion ist noch nichts gemessen', pflegen: { text: 'Markttraktion öffnen', href: '/os/markttraktion' } },
  { id: 'run_rate', label: 'Umsatz-Kurs', saeule: 'mt', gruppe: 'Wachstum', einheit: 'prozent', richtung: 'hoch', gruen: 100, rot: 70, nurGesamt: true,
    formel: 'Ø Monatsumsatz ÷ nötiger Monatsumsatz fürs Jahresziel', quelle: 'Controlling (Ziel + Ist-Monate)',
    luecke: 'Ziel oder Ist-Monate im Controlling fehlen', pflegen: { text: 'Controlling pflegen', href: '/os/controlling' } },
  { id: 'win_rate', label: 'Win Rate', saeule: 'mt', gruppe: 'Vertrieb', einheit: 'prozent', richtung: 'hoch', gruen: 25, rot: 15,
    formel: 'gewonnen ÷ (gewonnen + verloren), ab Angebot', quelle: 'Deals (Pipeline)',
    luecke: 'Ab 10 Entscheidungen (gewonnen oder verloren) aussagekräftig', pflegen: { text: 'Deals pflegen', href: '/os/markttraktion' } },
  { id: 'pipeline', label: 'Pipeline-Deckung', saeule: 'mt', gruppe: 'Vertrieb', einheit: 'faktor', richtung: 'hoch', gruen: 3, rot: 1, nurGesamt: true,
    formel: 'gewichtete Pipeline ÷ Umsatzlücke zum Jahresziel', quelle: 'Deals + Controlling',
    luecke: 'Jahresziel im Controlling fehlt', pflegen: { text: 'Deals pflegen', href: '/os/markttraktion' } },
  { id: 'sales_cycle', label: 'Sales Cycle', saeule: 'mt', gruppe: 'Vertrieb', einheit: 'tage', richtung: 'niedrig', gruen: 60, rot: 120,
    formel: 'Ø Tage vom Anlegen eines Deals bis „gewonnen“ (12 Monate)', quelle: 'Deals mit Stufen-Verlauf',
    luecke: 'Mindestens 2 gewonnene Deals mit Verlauf nötig', pflegen: { text: 'Deals pflegen', href: '/os/markttraktion' } },
  { id: 'nrr', label: 'Net Revenue Retention', saeule: 'mt', gruppe: 'Kunden', einheit: 'prozent', richtung: 'hoch', gruen: 110, rot: 100,
    formel: '(MRR Start + Ausbau − Rückgang − Kündigung) ÷ MRR Start, Bestandskunden', quelle: 'Monats-Schnappschüsse des MRR',
    luecke: 'Sammelt den MRR-Verlauf — aussagekräftig ab 3 Monaten', pflegen: { text: 'Mandate pflegen', href: '/os/mandate' } },
  { id: 'churn', label: 'Kündigungsrate', saeule: 'mt', gruppe: 'Kunden', einheit: 'prozent', richtung: 'niedrig', gruen: 1, rot: 2.5,
    formel: 'beendete Mandate je Monat ÷ aktive Mandate (12 Monate)', quelle: 'Mandate (Start/Ende)',
    luecke: 'Keine Mandate mit Start-/Enddatum', pflegen: { text: 'Mandate pflegen', href: '/os/mandate' } },
  { id: 'cac', label: 'Kundengewinnungskosten', saeule: 'mt', gruppe: 'Kunden', einheit: 'eur', richtung: 'niedrig', gruen: 2500, rot: 5000,
    formel: '(Marketing + Vertrieb, 12 Monate) ÷ neue Kunden', quelle: 'Monatsabschluss (Marketing & Vertrieb) + Mandate',
    luecke: 'Marketing-/Vertriebskosten oder neue Kunden fehlen', pflegen: ABSCHLUSS },
];

export const KENNZAHL = Object.fromEntries(KENNZAHLEN.map(k => [k.id, k])) as Record<string, KennzahlDef>;

/** Die Kennzahlen, die in einer Sicht gelten. */
export const kennzahlenFuer = (scope: Scope) => KENNZAHLEN.filter(k => scope === 'gesamt' || !k.nurGesamt);
