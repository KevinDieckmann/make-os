// ─── Finanzplanung jetzt — kleine, reine Helfer für Seite und Routen ─────────
// Client-sicher (keine Server-Importe): Beschriftungen, Zahlenformat, die
// Zeitachse (Historie Jan–Sep 26 + Plan Okt 26–Dez 28) und Zähler, die in
// mehreren Ansichten gebraucht werden. Gerechnet wird NUR im Rechenkern.

import type { Einheit, FinanzDaten, Zeile } from '@/lib/finanzen/rechenkern';
import { histIndex } from '@/lib/finanzen/rechenkern';
import { UG_KURZ, finanzOrtAusKern, finanzOrtName } from '@/lib/einheiten';
import { HAND_FELDER } from '@/lib/finanzen/handwerte';
/** Name der Gesellschaft `kdv` aus den Einstellungen (lib/einheiten.ts) — nie fest im Code. */
const KDV = finanzOrtName('kdv');

export const KAL = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'] as const;

/** Namen aus der einen Einheitenliste (lib/einheiten.ts); die Kern-Kennung `selbststaendigkeit` ist kdc. */
export const EINHEIT_LABEL: Record<Einheit, string> = { privat: finanzOrtName('privat'), selbststaendigkeit: finanzOrtName(finanzOrtAusKern('selbststaendigkeit')), ug: finanzOrtName('ug'), kdv: finanzOrtName('kdv') };
export const TYP_LABEL: Record<NonNullable<Zeile['typ']>, string> = { fix: 'Fixkosten', jahr: 'Jahreskosten-Topf', flex: 'Flexibel', sparen: 'Sparen' };
/** Gruppe je Budget-Art — das Privat-Blatt sortiert danach. */
export const TYP_GRUPPE: Record<NonNullable<Zeile['typ']>, string> = { fix: 'Fixkosten', jahr: 'Jahreskosten & Puffer', flex: 'Flexibel', sparen: 'Sparen' };
export const BUDGET_GRUPPEN = ['Fixkosten', 'Jahreskosten & Puffer', 'Flexibel', 'Sparen'] as const;

/** Sonderziele einer Buchung, die keine Planzeile sind. */
export const SONDER_ZEILEN: Record<string, string> = {
  'x.einnahme': 'Einnahme verlässlich', 'x.einmalig': 'Einnahme einmalig', 'x.kredit': 'Kredit erhalten', 'x.umbuchung': 'Umbuchung', 'x.offen': 'Noch nicht zugeordnet',
};
/** Berechnete Zeilen, die man je Zelle überschreiben kann — seit 04.10. jede gerechnete Zahl (Handwerte, lib/finanzen/handwerte.ts). */
export const RECHENZEILEN: Record<string, string> = Object.fromEntries(Object.entries(HAND_FELDER).map(([k, f]) => [k, f.name]));

// ── Aufbau (08.10. abends, Fragebogen Teil 3 Frage 10 — Kevin: „Vorschlag so übernehmen · MAKE und KD Ventures zusammen als
// ‚Gesellschaften‘ · Wochen-Check bleibt eigenes Blatt“) ──────────────────────────────────────────────────────────────────────
// Statt 19 Blättern (Business 13) stehen unter Privat 9 und unter Business 6 Blätter in EINER Pillenreihe (Ebene 2 unter dem Reiter
// „Planung“); was zusammengehört, steht als Abschnitt zum Auf- und Zuklappen auf einer Seite (zugeklappt nicht gerendert, Sprung per #anker).
// „Treiber, Annahmen & Steuern“ samt Protokoll liegt hinter dem Zahnrad (Vorbild REITER_ZEILE.zahnrad der Markttraktion).
//   Privat:   Lage · Wochen-Check · Planen (+ Ziele) · Monat (Budget · Ist-Buchungen) · Privat · Selbstständigkeit ·
//             Gesellschaften (MAKE · Töpfe · KD Ventures) · Gesamt (+ Entwicklung · Geldfluss) · Fällig & Schulden (Zu erledigen · Kalender & Verträge · Schulden)
//   Business: Lage · Planen · Monat (nur Ist-Buchungen) · Gesellschaften · Gesamt · Fällig & Schulden
// Gerechnet wird genau wie vorher; nur die Oberfläche ist neu geordnet. Alte Adressen (?u=<altes Blatt>) lösen über `blattAus` auf das neue
// Blatt + Abschnitt auf — die Kennungen der alten Blätter sind genau die Kennungen der neuen Blätter bzw. Abschnitte (eine Liste, kein Zweitweg).

/** Ein Blatt (Ebene 2) — bzw. `szenarien`, die Seite hinter dem Zahnrad. */
export type Unterseite = 'lage' | 'check' | 'planen' | 'monat' | 'privat' | 'selbst' | 'gesellschaften' | 'gesamt' | 'faellig' | 'szenarien';
/** Ein Abschnitt auf einem Blatt (zum Auf- und Zuklappen). Die Kennungen sind die der früheren Blätter. */
export type AbschnittId = 'ziele' | 'budget' | 'buchungen' | 'ug' | 'toepfe' | 'kdv' | 'entwicklung' | 'geldfluss' | 'posten' | 'kalender' | 'schulden' | 'protokoll';
/** Wohin ein Sprung (geh, Entscheidung, Lücke, alte Adresse) führen kann: ein Blatt oder ein Abschnitt. Jede alte Blatt-Kennung ist eines davon. */
export type Sprung = Unterseite | AbschnittId;

export interface BlattDef { id: Unterseite; label: string; /** Nur in der Privat-Sicht — die Business-Sicht rendert es gar nicht. */ nurPrivat?: boolean }
export interface AbschnittDef { id: AbschnittId; label: string; /** Nur in der Privat-Sicht — die Business-Sicht rendert ihn gar nicht. */ nurPrivat?: boolean; /** Beim ersten Öffnen aufgeklappt. */ offen?: boolean }

/** Die Blätter in ihrer Reihenfolge (nach Nutzen). Namen der Gesellschaften kommen aus lib/einheiten.ts — nie fest im Code. */
export const BLAETTER: readonly BlattDef[] = [
  { id: 'lage', label: 'Lage' },
  { id: 'check', label: 'Wochen-Check', nurPrivat: true },
  { id: 'planen', label: 'Planen' },
  { id: 'monat', label: 'Monat' },
  { id: 'privat', label: 'Privat', nurPrivat: true },
  { id: 'selbst', label: finanzOrtName('kdc'), nurPrivat: true },
  { id: 'gesellschaften', label: 'Gesellschaften' },
  { id: 'gesamt', label: 'Gesamt' },
  { id: 'faellig', label: 'Fällig & Schulden' },
];
/** Die Seite hinter dem Zahnrad (selten gebraucht: Treiber, Annahmen, Steuern, Schwellen — und das Protokoll). */
export const ZAHNRAD: { id: 'szenarien'; label: string } = { id: 'szenarien', label: 'Treiber, Annahmen & Steuern' };

/** Die Abschnitte je Blatt, in ihrer Reihenfolge. Blätter ohne Eintrag haben keine Abschnitte. */
export const ABSCHNITTE: Readonly<Record<Unterseite, readonly AbschnittDef[]>> = {
  lage: [], check: [], privat: [], selbst: [],
  planen: [{ id: 'ziele', label: 'Ziele' }],
  monat: [{ id: 'budget', label: 'Budget', nurPrivat: true, offen: true }, { id: 'buchungen', label: 'Ist-Buchungen', offen: true }],
  gesellschaften: [{ id: 'ug', label: finanzOrtName('ug'), offen: true }, { id: 'toepfe', label: `Töpfe ${UG_KURZ}` }, { id: 'kdv', label: KDV }],
  gesamt: [{ id: 'entwicklung', label: 'Entwicklung', nurPrivat: true }, { id: 'geldfluss', label: 'Geldfluss', nurPrivat: true }],
  faellig: [{ id: 'posten', label: 'Zu erledigen', offen: true }, { id: 'kalender', label: 'Kalender & Verträge' }, { id: 'schulden', label: 'Schulden' }],
  szenarien: [{ id: 'protokoll', label: 'Protokoll' }],
};

/** Die eine Frage, die jedes Blatt beantwortet — steht klein unter den Pillen (02.10., Navigation verständlich). */
export const FRAGE: Record<Unterseite, string> = {
  lage: 'Wo stehen wir, was ist zu entscheiden und was ist noch offen?',
  check: 'Der Wochen-Check: fünf Punkte, beide bestätigen.',
  planen: 'Szenarien bauen: Produkte, Kosten und Annahmen — und sehen, was sich dadurch ändert. Darunter die Ziele.',
  monat: 'Wie läuft der Monat — Budget und Ist-Buchungen?',
  privat: 'Was kommt privat herein, was geht heraus, was bleibt übrig?',
  selbst: 'Umsatz, Kosten und Ergebnis der Selbstständigkeit, die gemeinsame Einkommensteuer mit Privat — und der Abschluss 2026.',
  gesellschaften: 'Umsatz, Kosten und Ergebnis je Gesellschaft — mit Steuern, Break-even, Runway und den Töpfen.',
  gesamt: 'Alles zusammen: Privat und die Gesellschaften, verbunden über Gehalt und Ausschüttung — darunter Entwicklung und Geldfluss.',
  faellig: 'Was ist offen, was ist wann fällig — und welche Schulden laufen?',
  szenarien: 'Treiber vergleichen, Annahmen eintragen, Steuern und Ampel-Schwellen einstellen — und wer was geändert hat.',
};
/** Die Frage je Blatt in der Business-Sicht, wo sie sich von der Privat-Sicht unterscheidet (04.10.). */
export const FRAGE_BUSINESS: Partial<Record<Unterseite, string>> = {
  lage: 'Wo stehen die Gesellschaften, was ist zu entscheiden und was ist noch offen?',
  monat: 'Was wurde im Business gebucht — und wohin gehört es?',
  gesamt: 'Die Gesellschaften zusammen — Gehalt und Ausschüttung als Abfluss (brutto).',
  faellig: 'Offene Posten, Fälligkeiten und Schulden der Gesellschaften.',
  szenarien: 'Treiber vergleichen, Annahmen eintragen, Steuern einstellen — und wer im Business was geändert hat.',
};

export const istUnterseite = (v: unknown): v is Unterseite => v === ZAHNRAD.id || BLAETTER.some(b => b.id === v);
export const istAbschnittId = (v: unknown): v is AbschnittId => Object.values(ABSCHNITTE).some(l => l.some(a => a.id === v));
/** Das Blatt, auf dem ein Abschnitt steht. */
export const blattVonAbschnitt = (a: AbschnittId): Unterseite => (Object.keys(ABSCHNITTE) as Unterseite[]).find(u => ABSCHNITTE[u].some(x => x.id === a)) ?? 'lage';

// ── Sichten (04.10., Kevin: „Business ist bei Business sichtbar, kein Privat“) ──
/** Blätter, die nur Privat zeigen — in der Business-Sicht gibt es sie nicht. */
export const NUR_PRIVAT_UNTERSEITEN: Unterseite[] = BLAETTER.filter(b => b.nurPrivat).map(b => b.id);
/** Abschnitte, die nur Privat zeigen — die Business-Sicht rendert sie gar nicht (nicht bloß ausgeblendet). */
export const NUR_PRIVAT_ABSCHNITTE: AbschnittId[] = Object.values(ABSCHNITTE).flatMap(l => l.filter(a => a.nurPrivat).map(a => a.id));

/** Die Blätter einer Sicht in EINER Reihe (08.10., Aufräumen Etappe 2: Finanzen hat höchstens zwei Ebenen — Reiter „Planung“ = Ebene 1, Blatt = Ebene 2). */
export function blaetterFuer(sicht: 'privat' | 'business'): { id: Unterseite; label: string }[] {
  return BLAETTER.filter(b => sicht === 'privat' || !b.nurPrivat).map(b => ({ id: b.id, label: b.label }));
}
/** Die Abschnitte eines Blatts in einer Sicht — private fallen in der Business-Sicht ganz weg. */
export function abschnitteFuer(u: Unterseite, sicht: 'privat' | 'business'): AbschnittDef[] {
  return ABSCHNITTE[u].filter(a => sicht === 'privat' || !a.nurPrivat);
}
/**
 * Wohin ein Sprung (neues oder altes Blatt, Abschnitt) in einer Sicht führt. Ein privates Blatt oder ein privater Abschnitt fällt in der
 * Business-Sicht auf die Lage zurück (wie bis 08.10.); Unbekanntes ebenso. `alt`: die Kennung ist kein Blatt — die Adresse wird umgeschrieben.
 */
export function blattAus(v: unknown, sicht: 'privat' | 'business'): { u: Unterseite; abschnitt?: AbschnittId; alt: boolean } {
  if (istUnterseite(v)) return { u: sicht === 'business' && NUR_PRIVAT_UNTERSEITEN.includes(v) ? 'lage' : v, alt: false };
  if (istAbschnittId(v)) {
    const u = blattVonAbschnitt(v);
    if (sicht === 'business' && (NUR_PRIVAT_ABSCHNITTE.includes(v) || NUR_PRIVAT_UNTERSEITEN.includes(u))) return { u: 'lage', alt: true };
    return { u, abschnitt: v, alt: true };
  }
  return { u: 'lage', alt: false };
}
/**
 * Alte Adresse (?u=<früheres Blatt, heute ein Abschnitt>): wohin die Seite sie umschreibt (Blatt + Anker) — sonst null. Das Ziel ist immer ein
 * Blatt, nie wieder eine Abschnitts-Kennung: nach dem Umschreiben liefert dieselbe Frage null, die Seite schreibt höchstens einmal um (keine Schleife).
 */
export function alteAdresseUmschreiben(uRoh: unknown, sicht: 'privat' | 'business'): { u: Unterseite; abschnitt?: AbschnittId } | null {
  if (!istAbschnittId(uRoh)) return null;
  const z = blattAus(uRoh, sicht);
  return z.abschnitt ? { u: z.u, abschnitt: z.abschnitt } : { u: z.u };
}
/** Blatt in einer Sicht — ein privates fällt in der Business-Sicht auf „lage“ zurück; alte Kennungen lösen auf ihr neues Blatt auf. */
export const unterseiteFuer = (u: unknown, sicht: 'privat' | 'business'): Unterseite => blattAus(u, sicht).u;
/**
 * Die Adresse der Finanzplanung (04.10.; seit 08.10. Reiter „Planung“ unter Finanzen › Privat und Finanzen › Business). Alte Links auf
 * /os/finanzplan?… leiten in next.config.mjs in die Privat-Sicht weiter (dort ist alles); alle Parameter (u, monat, zeile, sz, feld, steuern …) bleiben.
 * `abschnitt` hängt den Anker an (#buchungen) — der Abschnitt klappt dann auf und kommt ins Bild.
 */
export function finanzplanAdresse(sicht: 'privat' | 'business', params?: URLSearchParams | Record<string, string | number | undefined>, abschnitt?: AbschnittId): string {
  const q = new URLSearchParams();
  q.set('s', 'finanzplanung'); q.set('space', sicht);
  const eintraege = params instanceof URLSearchParams ? Array.from(params.entries()) : Object.entries(params ?? {});
  for (const [k, v] of eintraege) if (k !== 's' && k !== 'space' && v !== undefined && v !== '') q.set(k, String(v));
  return `/os/finanzen?${q.toString()}${abschnitt ? `#${abschnitt}` : ''}`;
}

// ── Zahlen ──────────────────────────────────────────────────────────────────
const FORMATE = new Map<number, Intl.NumberFormat>();
/** Betrag in Euro ohne Zeichen: 1.234 · 1.234,50. Leer bei null/NaN. */
export function eur(v: number | null | undefined, dezimal = 0): string {
  if (v == null || Number.isNaN(v) || !Number.isFinite(v)) return '';
  if (Math.abs(v) * 10 ** dezimal < 0.5) v = 0; // „-0“ gibt es nicht (Minus vor einer Null, z. B. bei negierten Nullzeilen)
  let f = FORMATE.get(dezimal);
  if (!f) { f = new Intl.NumberFormat('de-DE', { maximumFractionDigits: dezimal, minimumFractionDigits: dezimal }); FORMATE.set(dezimal, f); }
  return f.format(v);
}
export const prozent = (v: number, dezimal = 0) => `${eur(v * 100, dezimal)} %`;

/**
 * Eingabe → Zahl. Deutsch (1.234,50) und englisch (1234.50) werden verstanden,
 * „€“ und Leerzeichen ignoriert. Leer → null; Unsinn → NaN.
 */
export function parseBetrag(eingabe: string): number | null {
  // Formel-Prüfung 05.10.: „%“ wird wie „€“ ignoriert (Prozentfelder rechnen selbst um); englische Tausender „1,234.50“ sind 1.234,50
  // (vorher 1,2345 — ein Komma vor einem Punkt ist immer ein Tausender-Trenner).
  let s = String(eingabe ?? '').trim().replace(/\s|€|%/g, '');
  if (s === '') return null;
  if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s) || /^-?\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.replace(/,/g, '');
  else if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = Number(s);
  return Number.isNaN(v) ? NaN : v;
}

// ── Zeitachse ───────────────────────────────────────────────────────────────
/** Historie + Plan als eine Achse: Index 0 = Jan 26, 8 = Sep 26, 9 = Okt 26 (Plan-Monat 1). */
export const achse = (d: Pick<FinanzDaten, 'historie' | 'monate'>): string[] => [...d.historie, ...d.monate];
export const heuteIndex = (d: Pick<FinanzDaten, 'einstellungen'>): number => histIndex(d.einstellungen.heute);
/** Der letzte volle Monat — der laufende bleibt bei Durchschnitten draußen. */
export const letzterVoller = (d: Pick<FinanzDaten, 'einstellungen'>): number => Math.max(0, heuteIndex(d) - 1);
/** Tage im Monat eines Achsen-Index (Jan 26 = 0). */
export function tageIm(idx: number): number { const j = 2026 + Math.floor(idx / 12), mo = (idx % 12) + 1; return new Date(j, mo, 0).getDate(); }
/** Plan-Monat (≥ 1) zu einem Achsen-Index; Monate vor dem Plan nehmen den ersten Planmonat als Maßstab. */
export const planMonatAus = (idx: number, d: Pick<FinanzDaten, 'historie'>): number => Math.max(1, idx - d.historie.length + 1);
/** Achsen-Label eines Plan-Monats (1 = Okt 26). */
export const monatLabel = (d: Pick<FinanzDaten, 'monate'>, m: number): string => d.monate[Math.min(Math.max(1, m), d.monate.length) - 1] ?? '';
/** „27.09.“ aus JJJJ-MM-TT. */
export const tagKurz = (datum: string): string => (datum && datum.length >= 10 ? `${datum.slice(8, 10)}.${datum.slice(5, 7)}.` : '');
export const datumLang = (datum: string): string => (datum && datum.length >= 10 ? `${datum.slice(8, 10)}.${datum.slice(5, 7)}.${datum.slice(0, 4)}` : '');
export const plusTage = (datum: string, n: number): string => new Date(new Date(`${datum}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

// ── Zeilen und Zähler ───────────────────────────────────────────────────────
export const alleZeilen = (d: Pick<FinanzDaten, 'sachkosten' | 'privatEinnahmen' | 'privatBudget' | 'privatSchulden'>): Zeile[] => [...d.sachkosten, ...d.privatEinnahmen, ...d.privatBudget, ...d.privatSchulden];
export function zeileName(d: Pick<FinanzDaten, 'sachkosten' | 'privatEinnahmen' | 'privatBudget' | 'privatSchulden'>, id: string): string {
  const z = alleZeilen(d).find(x => x.id === id);
  return z?.name ?? SONDER_ZEILEN[id] ?? RECHENZEILEN[id] ?? id;
}
export const offeneBuchungen = (d: Pick<FinanzDaten, 'buchungen'>): number => d.buchungen.filter(b => b.z === 'x.offen').length;
export const OFFENE_STATUS = ['erledigt', 'bezahlt'];
export const postenOffen = (p: { status: string }) => !OFFENE_STATUS.includes(p.status);
/** Posten, die binnen 7 Tagen fällig sind oder überfällig — Zähler für den Bereich Verpflichtungen. */
export function faelligeZahl(d: Pick<FinanzDaten, 'posten' | 'einstellungen'>): number {
  const in7 = plusTage(d.einstellungen.heute, 7);
  return d.posten.filter(p => p.art !== 'konto' && postenOffen(p) && p.faellig && p.faellig <= in7).length;
}
/** Kennung für neue Einträge — kurz, lesbar, praktisch eindeutig. */
export { neueKennung } from '@/lib/kennung';

/** Person aus alten Einträgen („Kevin“, „Malin“, „beide“) auf Speichernamen bringen. */
export const personKennung = (wer: string | null | undefined): string => String(wer ?? '').trim().toLowerCase();
