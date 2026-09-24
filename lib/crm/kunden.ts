// ─── CRM — Kunden & Mandate (rein, getestet) ────────────────────────────────
// In KEMARIS Operations gab es kein Kunden- oder Vertragsmodell („Kunde“ war
// nur eine Lebensphase). Hier: Mandat mit Laufzeit, Kündigungsfrist,
// Honorar und Health (DEAR von Gainsight, für Beratung übersetzt), dazu die
// Brücke in den Liquiditätsplan — als Vorschlag, den Kevin bestätigt, damit
// nichts doppelt zählt (die OneBanking-Posten sind schon von Hand drin).

import type { Mandat } from './typen';
import type { Planposten } from '@/lib/make-one/liquiditaet';

const tage = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
function plusMonate(datum: string, n: number): string {
  const d = new Date(`${datum}T12:00:00Z`);
  const tag = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(tag, letzter));
  return d.toISOString().slice(0, 10);
}
const plusTage = (datum: string, n: number) => { const d = new Date(`${datum}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export const HEALTH_GEWICHTE = { beteiligung: 25, umsetzung: 25, wirkung: 30, zahlung: 10, stimmung: 10 } as const;
export const HEALTH_LABEL: Record<keyof typeof HEALTH_GEWICHTE, string> = { beteiligung: 'Beteiligung', umsetzung: 'Umsetzung', wirkung: 'Wirkung', zahlung: 'Zahlung', stimmung: 'Stimmung' };

export interface MandatLage {
  /** Ende der laufenden Periode (Vertragsende oder nächster Termin nach Mindestlaufzeit). */
  endeAm: string | null;
  endeIn: number | null;
  /** Letzter Tag, an dem noch gekündigt / verlängert werden kann. */
  fristBis: string | null;
  /** Tage bis zum Ende der Laufzeit — für die Power Hour. */
  kuendigungIn: number | null;
  health: number | null;
  ampel: 'gruen' | 'gelb' | 'rot' | null;
  gruende: string[];
  monatswert: number;
}

/** Rechnung, wie sie im Finanzplan steht (lib/make-one/liquiditaet.ts) — nur die Felder, die hier zählen. */
export interface RechnungKurz { kunde: string; status: string; faellig?: string; bezahltAm?: string }
const RAUSCHEN = new Set(['gmbh', 'limited', 'ltd', 'group', 'holding', 'products', 'technology', 'institute', 'for', 'the', 'und', 'and']);
const worte = (t: string) => new Set(t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !RAUSCHEN.has(w)));
/** Gehört die Rechnung zu diesem Kunden? Mindestens ein kennzeichnendes Wort gemeinsam (z. B. „acme“, „onebanking“). */
export const rechnungPasst = (m: Pick<Mandat, 'kunde'>, r: RechnungKurz) => { const a = worte(m.kunde), b = worte(r.kunde); return Array.from(a).some(w => b.has(w)); };

/** Faktor „Zahlung“ aus den Rechnungen: überfällige kosten 30, verspätet bezahlte 10 Punkte. null ohne Rechnungen. */
export function zahlungAusRechnungen(m: Pick<Mandat, 'kunde'>, rechnungen: RechnungKurz[], heute: string): { wert: number; text: string } | null {
  const l = rechnungen.filter(r => (r.status === 'gestellt' || r.status === 'bezahlt') && rechnungPasst(m, r));
  if (!l.length) return null;
  const ueber = l.filter(r => r.status === 'gestellt' && r.faellig && r.faellig < heute).length;
  const spaet = l.filter(r => r.status === 'bezahlt' && r.faellig && r.bezahltAm && r.bezahltAm > r.faellig).length;
  return { wert: Math.max(0, 100 - ueber * 30 - spaet * 10), text: `${l.length} Rechnungen · ${ueber} überfällig · ${spaet} verspätet bezahlt` };
}

export function mandatLage(m: Mandat, heute: string, rechnungen?: RechnungKurz[]): MandatLage {
  // Zahlung: von Hand gesetzt gewinnt, sonst aus den Rechnungen gerechnet.
  if (rechnungen && m.health.zahlung === null) { const z = zahlungAusRechnungen(m, rechnungen, heute); if (z) m = { ...m, health: { ...m.health, zahlung: z.wert } }; }
  let endeAm: string | null = m.ende ?? null;
  if (!endeAm && m.start && m.mindestlaufzeitMonate) {
    endeAm = plusMonate(m.start, m.mindestlaufzeitMonate);
    // Nach der Mindestlaufzeit verlängert sich ein Auto-Vertrag monatsweise.
    while (m.verlaengerung === 'auto' && endeAm < heute) endeAm = plusMonate(endeAm, 1);
  }
  const endeIn = endeAm ? tage(heute, endeAm) : null;
  const fristBis = endeAm && m.kuendigungsfristTage ? plusTage(endeAm, -m.kuendigungsfristTage) : endeAm;
  // Health: nur bewertete Faktoren zählen, anteilig neu gewichtet.
  let summe = 0, gewicht = 0;
  for (const [k, g] of Object.entries(HEALTH_GEWICHTE) as [keyof typeof HEALTH_GEWICHTE, number][]) {
    const v = m.health[k];
    if (typeof v === 'number') { summe += v * g; gewicht += g; }
  }
  const health = gewicht ? Math.round(summe / gewicht) : null;
  const gruende: string[] = [];
  let ampel: MandatLage['ampel'] = health === null ? null : health > 75 ? 'gruen' : health >= 60 ? 'gelb' : 'rot';
  if (m.status === 'aktiv' && endeIn !== null && endeIn >= 0 && endeIn <= 60 && m.verlaengerung !== 'auto') { ampel = 'rot'; gruende.push(`Laufzeit endet in ${endeIn} Tagen — Verlängerung offen`); }
  if (health !== null && health < 60) gruende.push(`Health ${health}`);
  if (m.offen.length) gruende.push(`${m.offen.length} offene Punkte`);
  if (!m.vertragUnterschrieben && m.status === 'aktiv') gruende.push('Vertrag nicht unterschrieben');
  const monatswert = m.honorar.basis === 'monat' ? m.honorar.betrag : 0;
  return { endeAm, endeIn, fristBis, kuendigungIn: endeIn, health, ampel, gruende, monatswert };
}

/** Wiederkehrender Umsatz aller aktiven Mandate (netto, je Monat). */
export function mrr(mandate: Mandat[]): number {
  return mandate.filter(m => m.status === 'aktiv' && m.honorar.basis === 'monat').reduce((a, m) => a + m.honorar.betrag, 0);
}

/** Kundenkonzentration: Anteil des größten Kunden am MRR (> 50 % ist ein Risiko). */
export function konzentration(mandate: Mandat[]): { kunde: string; anteil: number } | null {
  const je = new Map<string, number>();
  for (const m of mandate.filter(m => m.status === 'aktiv' && m.honorar.basis === 'monat')) je.set(m.kunde, (je.get(m.kunde) ?? 0) + m.honorar.betrag);
  const gesamt = Array.from(je.values()).reduce((a, b) => a + b, 0);
  if (!gesamt) return null;
  const [kunde, wert] = Array.from(je.entries()).sort((a, b) => b[1] - a[1])[0];
  return { kunde, anteil: Math.round((wert / gesamt) * 100) };
}

/** Der Liquiplan-Posten, den ein Mandat erzeugen würde (brutto, Eingang nach Zahlungsziel). */
export function planpostenAus(m: Mandat, heute: string): Planposten | null {
  if (m.status !== 'aktiv' && m.status !== 'verhandlung') return null;
  if (!(m.honorar.betrag > 0) || m.honorar.basis === 'tag') return null;
  const brutto = Math.round(m.honorar.betrag * (m.honorar.netto ? 1 + (m.ustSatz ?? 19) / 100 : 1));
  const basis = m.start && m.start > heute ? m.start : heute;
  const ab = plusTage(m.rechnungsrhythmus === 'einmalig' || m.honorar.basis === 'einmalig' ? basis : `${basis.slice(0, 8)}01`, m.zahlungszielTage || 14);
  const sicher = m.status === 'aktiv' && m.vertragUnterschrieben;
  const firma = m.gesellschaft === 'offen' ? undefined : m.gesellschaft;
  return {
    id: m.planpostenId ?? `lp-mandat-${m.id}`, titel: `${m.kunde} · ${m.titel}`.slice(0, 120), betrag: brutto,
    rhythmus: m.honorar.basis === 'einmalig' || m.rechnungsrhythmus === 'einmalig' ? 'einmalig' : m.rechnungsrhythmus === 'quartal' ? 'quartal' : 'monatlich',
    ab, ...(m.ende ? { bis: m.ende } : {}), sicher, ...(sicher ? {} : { wahrscheinlich: m.status === 'aktiv' ? 80 : 50 }),
    ...(firma ? { firmaId: firma } : {}), kategorie: 'mandat',
    notiz: `Aus dem Mandat (CRM). ${m.honorar.netto ? `${m.honorar.betrag} € netto${m.ustSatz ? ` + ${m.ustSatz} % USt` : ', Reverse Charge'}` : `${m.honorar.betrag} €`}.`,
  };
}
