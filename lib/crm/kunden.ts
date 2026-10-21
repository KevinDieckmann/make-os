// ─── CRM — Kunden & Mandate (rein, getestet) ────────────────────────────────
// In KEMARIS Operations gab es kein Kunden- oder Vertragsmodell („Kunde“ war
// nur eine Lebensphase). Hier: Mandat mit Laufzeit, Kündigungsfrist,
// Honorar und Health (DEAR von Gainsight, für Beratung übersetzt), dazu die
// Brücke in den Liquiditätsplan — als Vorschlag, den Kevin bestätigt, damit
// nichts doppelt zählt (manche Kunden-Posten sind schon von Hand drin).

import type { Mandat } from './typen';
import { zahltage, letzterZahltag, type Planposten } from '@/lib/make-one/liquiditaet';
import { geplantesEnde, leistungsmonat, mandatZahlplan, mindestEnde, monatsBrutto, monatsName, zahlungsziel } from './mandat-laufzeit';
import { mandatName } from './mandat-name';
import { zusatzLiquiditaet, anrechnungLiquiditaet, type AnrechnungKontext } from './mandat-zusatz';
import { nettoAusBrutto } from '@/lib/finanzen/ust';
import type { Leistung } from './typen';
import { PLANPOSTEN_MANDAT, PLANPOSTEN_TEIL } from './mandant-link';
import { TEAM, BEIDE, zustaendig } from './team';
import { anzahl } from '@/lib/text/zahlwort';
import { KERN_EINHEITEN, gesellschaftAusEinheit, gehoertZuPrivat, istRegisterKennung, type Gesellschaftskennung } from '@/lib/einheiten';

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

/** Was `mandatFristen` von einem Mandat braucht — auch die schlanke Form aus dem Kalender (lib/kalender/eintraege.ts). */
export type MandatFristFelder = Pick<Mandat, 'ende' | 'start' | 'mindestlaufzeitMonate' | 'verlaengerung' | 'kuendigungsfristTage'>;

/**
 * Ende der laufenden Periode und Kündigungsfrist eines Mandats — die EINE Rechnung (K6a, 29.09.; Befund 6 der
 * Kalender-Verbindungskarte: vorher rechnete der Kalender nur mit `ende`, die Mandatsseite zusätzlich aus Start +
 * Mindestlaufzeit + automatischer Verlängerung). Genutzt von `mandatLage` (Mandat, Power Hour, Heads), den Kalender-
 * Fristen und Glocke/Heute. `frist` = letzter Tag zum Kündigen/Verlängern, nur mit Kündigungsfrist (sonst null).
 */
export function mandatFristen(m: Partial<MandatFristFelder>, heute: string): { endeAm: string | null; frist: string | null } {
  let endeAm: string | null = m.ende ? m.ende.slice(0, 10) : null;
  if (!endeAm && m.start && m.mindestlaufzeitMonate) {
    endeAm = plusMonate(m.start.slice(0, 10), m.mindestlaufzeitMonate);
    // Nach der Mindestlaufzeit verlängert sich ein Auto-Vertrag monatsweise.
    while (m.verlaengerung === 'auto' && endeAm < heute) endeAm = plusMonate(endeAm, 1);
  }
  const frist = endeAm && m.kuendigungsfristTage && m.kuendigungsfristTage > 0 ? plusTage(endeAm, -m.kuendigungsfristTage) : null;
  return { endeAm, frist };
}

export function mandatLage(m: Mandat, heute: string, rechnungen?: RechnungKurz[]): MandatLage {
  // Zahlung: von Hand gesetzt gewinnt, sonst aus den Rechnungen gerechnet.
  if (rechnungen && m.health.zahlung === null) { const z = zahlungAusRechnungen(m, rechnungen, heute); if (z) m = { ...m, health: { ...m.health, zahlung: z.wert } }; }
  const { endeAm, frist } = mandatFristen(m, heute);
  const endeIn = endeAm ? tage(heute, endeAm) : null;
  const fristBis = frist ?? endeAm;
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
  if (health !== null && health < 60) gruende.push(`Gesundheit ${health}`);
  if (m.offen.length) gruende.push(anzahl(m.offen.length, 'offener Punkt', 'offene Punkte'));
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

// ── Mandat → Liquiditätsplan (18.10., Nachprüfung N4/N14 — EIN Zahlplan mit der Monatsrechnung) ─────────────────────────────────
// Die Zahlungen kommen aus `mandatZahlplan` (lib/crm/mandat-laufzeit.ts): angebrochene Monate (Beginn bzw. Ende mitten im Monat) je ein
// einmaliger Posten `lp-mandat-<id>~JJJJ-MM` mit dem Betrag der anteiligen Rechnung, die vollen Monate EIN Monatsposten (`planpostenId` bzw.
// `lp-mandat-<id>`) mit genau so vielen Zahltagen, wie es volle Monate sind. Vorher: ein Monatsposten von „Beginn + Zahlungsziel“ bis
// „Mindestende + Zahlungsziel“ — für 18.10.–17.04. sieben volle Zahlungen statt anteilig Oktober + fünf + anteilig April.

/** Kennung des Monatspostens eines Mandats (von Hand verknüpft oder `lp-mandat-<id>`). */
export const hauptPostenId = (m: Pick<Mandat, 'id' | 'planpostenId'>) => m.planpostenId ?? `${PLANPOSTEN_MANDAT}${m.id}`;
/** Kennung des einmaligen Postens für einen angebrochenen Monat. */
export const teilPostenId = (m: Pick<Mandat, 'id'>, monat: string) => `${PLANPOSTEN_MANDAT}${m.id}${PLANPOSTEN_TEIL}${monat}`;
/** Gehört der Posten zu diesem Mandat (Monatsposten oder Teilmonat)? */
export const postenVomMandat = (id: string, m: Pick<Mandat, 'id' | 'planpostenId'>) => id === hauptPostenId(m) || id.startsWith(`${PLANPOSTEN_MANDAT}${m.id}${PLANPOSTEN_TEIL}`);

const TITEL_MAX = 120;
const titelMit = (name: string, zusatz = '') => `${name.slice(0, TITEL_MAX - zusatz.length)}${zusatz}`;

/**
 * Die Liquiplan-Posten eines Mandats (brutto, Eingang nach Zahlungsziel) — leer, wenn keiner entsteht (Status, Honorar fehlt, Tagessatz).
 * `beendet: true` rechnet auch ein beendetes Mandat bis zu seinem Ende (ohne Ende: heute) — für „Posten beenden“ und die Lage.
 * Einmalige Honorare und Quartalsrechnungen bleiben EIN Posten wie bisher.
 */
/** Der Produkt-Katalog — für die Namen der Zusatzmodule im Titel der Posten (ohne: „Zusatzmodul“) und die Regeln der Anrechnung. */
type Katalog = readonly (Pick<Leistung, 'id' | 'name' | 'preis' | 'preise'> & Partial<Pick<Leistung, 'regeln' | 'geloeschtAm'>>)[];
/** Was die Anrechnung in der Liquidität braucht (P3b): alle Mandate und Rechnungen — ohne sie keine Anrechnung im Plan (wie bisher). */
export type AnrechnungBestand = Pick<AnrechnungKontext, 'mandate' | 'rechnungen'>;
/** Kennung des Postens der Anrechnung (der erste ohne Monat, weitere — nur bei mehreren Rechnungen mit Anrechnung — mit Monat). */
export const anrechnungPostenId = (m: Pick<Mandat, 'id'>, monat?: string) => `${PLANPOSTEN_MANDAT}${m.id}${PLANPOSTEN_TEIL}anrechnung${monat ? `${PLANPOSTEN_TEIL}${monat}` : ''}`;
export function mandatPosten(m: Mandat, heute: string, opt: { beendet?: boolean; katalog?: Katalog; anrechnung?: AnrechnungBestand } = {}): Planposten[] {
  const beendet = m.status === 'beendet';
  if (beendet ? !opt.beendet : m.status !== 'aktiv' && m.status !== 'verhandlung') return [];
  const ende = beendet ? (m.ende ?? heute) : geplantesEnde(m);
  const sicher = m.status !== 'verhandlung' && m.vertragUnterschrieben;
  // Register-Gesellschaften (`g-…`, 04.10.) führt der Liquiplan noch nicht — dann ohne Firma (wie „offen“), nie still bei kdc.
  const firma = m.gesellschaft === 'offen' || istRegisterKennung(m.gesellschaft) ? undefined : m.gesellschaft;
  const name = mandatName(m.kunde, m.titel);
  // `mandatId` (21.10., A2): die Vorschau erkennt daran (mit `leistungsmonat` je Posten), welche Zahlung eine gestellte Rechnung schon ersetzt.
  const gemeinsam = { sicher, ...(sicher ? {} : { wahrscheinlich: m.status === 'verhandlung' ? 50 : 80 }), ...(firma ? { firmaId: firma } : {}), kategorie: 'mandat', mandatId: m.id } as const;
  const basis = m.start && m.start > heute ? m.start : heute;
  // Zusatzmodule (19.10., P3): je Modul eigene Posten `lp-mandat-<id>~z-<Modul>…` nach derselben Laufzeit-Regel — ohne `zusatz` keine (bit-gleich).
  const zusatz: Planposten[] = m.zusatz?.length
    ? zusatzLiquiditaet(m, basis.slice(0, 7), ende, { katalog: opt.katalog, nettoAusBrutto }).map(z => ({
      id: `${PLANPOSTEN_MANDAT}${m.id}${PLANPOSTEN_TEIL}${z.id}`, titel: titelMit(name, ` — ${z.titel}`.slice(0, 60)), betrag: z.betrag, rhythmus: z.rhythmus, ab: z.ab, ...(z.bis ? { bis: z.bis } : {}), ...gemeinsam, leistungsmonat: z.monat, notiz: z.notiz,
    }))
    : [];
  // Anrechnung (19.10., P3b; 21.10. Kevin: der Rest wandert in die Folgemonate): dieselbe Regel wie die Monatsrechnung — je Monat höchstens bis zum
  // Betrag des Monats; je Monat ein eigener einmaliger Posten (negativ) am Zahltag dieses Monats. Ohne Bestand bzw. ohne Regel keiner (bit-gleich).
  const anrechnungRoh = opt.anrechnung && opt.katalog && m.firmaId && m.leistungId
    ? anrechnungLiquiditaet(m, basis.slice(0, 7), ende, { katalog: opt.katalog, mandate: opt.anrechnung.mandate, rechnungen: opt.anrechnung.rechnungen, nettoAusBrutto })
    : [];
  const anrechnung: Planposten[] = anrechnungRoh.map((a, i) => {
    const lm = leistungsmonat({ start: m.start, ...(ende ? { ende } : {}) }, a.monat);
    const teil = anrechnungRoh.length > 1 ? ` ${monatsName(a.monat)}` : '';
    return { id: anrechnungPostenId(m, i ? a.monat : undefined), titel: titelMit(name, ` — ${a.titel}${teil}`.slice(0, 60)), betrag: a.cent / 100, rhythmus: 'einmalig' as const, ab: plusTage(lm?.tage ? lm.von : `${a.monat}-01`, zahlungsziel(m)), ...gemeinsam, leistungsmonat: a.monat,
      notiz: `Aus dem Mandat (CRM): ${a.titel} — auf der Rechnung für ${monatsName(a.monat)} (höchstens bis zum Betrag des Monats; ein Rest folgt im nächsten Monat).` };
  });
  const haupt = hauptPosten(m, { ende, basis, name, gemeinsam });
  return zusatz.length || anrechnung.length ? [...haupt, ...zusatz, ...anrechnung].sort((x, y) => x.ab.localeCompare(y.ab)) : haupt;
}

/** Die Posten des Honorars (ohne Zusatzmodule) — genau wie bis 19.10. */
function hauptPosten(m: Mandat, o: { ende: string | null; basis: string; name: string; gemeinsam: Pick<Planposten, 'sicher' | 'wahrscheinlich' | 'firmaId' | 'kategorie' | 'mandatId'> }): Planposten[] {
  if (!(m.honorar.betrag > 0) || m.honorar.basis === 'tag') return [];
  const { ende, basis, name, gemeinsam } = o;
  const ziel = zahlungsziel(m);
  const notiz = `Aus dem Mandat (CRM). ${m.honorar.netto ? `${m.honorar.betrag} € netto${m.ustSatz ? ` + ${m.ustSatz} % USt` : ', Reverse Charge'}` : `${m.honorar.betrag} €`}.`;
  const einmalig = m.honorar.basis === 'einmalig' || m.rechnungsrhythmus === 'einmalig';
  if (einmalig || m.rechnungsrhythmus === 'quartal') {
    // Wie bisher: EIN Posten — einmalig am Beginn (bzw. heute) + Zahlungsziel; Quartal ab dem Monatsanfang (im Beginnmonat ab dem Beginn).
    if (ende && ende < basis) return [];
    const brutto = monatsBrutto(m, null);
    const monatsAnfang = `${basis.slice(0, 8)}01`;
    const rechnungsTag = m.start && m.start.slice(0, 7) === basis.slice(0, 7) && m.start > monatsAnfang ? m.start : monatsAnfang;
    const ab = plusTage(einmalig ? basis : rechnungsTag, ziel);
    return [{ id: hauptPostenId(m), titel: titelMit(name), betrag: brutto, rhythmus: einmalig ? 'einmalig' : 'quartal', ab, ...(!einmalig && ende ? { bis: plusTage(ende, ziel) } : {}), ...gemeinsam, leistungsmonat: (einmalig ? basis : rechnungsTag).slice(0, 7), notiz }];
  }
  const plan = mandatZahlplan(m, basis.slice(0, 7), ende);
  const raus: Planposten[] = plan.teile.map(t => ({
    id: teilPostenId(m, t.monat), titel: titelMit(name, ` — ${monatsName(t.monat)} anteilig`), betrag: t.betrag, rhythmus: 'einmalig' as const, ab: t.am, ...gemeinsam, leistungsmonat: t.monat,
    notiz: `Aus dem Mandat (CRM): ${monatsName(t.monat)} anteilig, ${t.lm.tage} von ${t.lm.monatsTage} Tagen — wie die Monatsrechnung.`,
  }));
  if (plan.voll) raus.push({ id: hauptPostenId(m), titel: titelMit(name), betrag: plan.voll.betrag, rhythmus: 'monatlich', ab: plan.voll.ab, ...(plan.voll.bis ? { bis: plan.voll.bis } : {}), ...gemeinsam, leistungsmonat: plan.voll.vonMonat, notiz });
  return raus.sort((x, y) => x.ab.localeCompare(y.ab));
}

/** Der (Haupt-)Posten, den ein Mandat erzeugen würde: der Monatsposten, sonst der erste Teilmonat — null, wenn keiner entsteht. */
export function planpostenAus(m: Mandat, heute: string, katalog?: Katalog): Planposten | null {
  const l = mandatPosten(m, heute, { katalog });
  return l.find(p => p.id === hauptPostenId(m)) ?? l[0] ?? null;
}

/** Warum aus einem Mandat kein Posten entsteht — der richtige Satz je Fall (N14: vorher immer „Status oder Honorar fehlt“). */
export function keinPostenGrund(m: Pick<Mandat, 'status' | 'honorar'>): string {
  if (m.status === 'angebot') return 'Noch im Angebot — der Posten entsteht, sobald das Mandat in Verhandlung oder aktiv ist.';
  if (m.status === 'pausiert') return 'Pausiert — solange kein Posten.';
  if (m.status === 'beendet') return 'Mandat beendet — kein Posten im Liquiditätsplan.';
  if (!(m.honorar.betrag > 0)) return 'Honorar fehlt — ohne Honorar kein Posten.';
  if (m.honorar.basis === 'tag') return 'Honorar je Tag — für Tagessätze entsteht kein fester Posten.';
  return 'Kein Posten.';
}

/** Anfang des Satzes, wenn die Anrechnung im Plan fehlt (P3b) — die Mandatsliste zeigt dann „Liquiplan weicht ab — Anrechnung fehlt“. */
export const ANRECHNUNG_FEHLT = 'Anrechnung fehlt';
export type LiquiLageArt = 'fehlt' | 'ok' | 'abweichend' | 'kein-posten' | 'endet' | 'beendet';
export interface MandatLiquiLage {
  lage: LiquiLageArt;
  /** Was das Mandat eintragen würde (beendet: bis zu seinem Ende). */
  soll: Planposten[];
  /** Der Monatsposten im Plan (sonst der erste Posten des Mandats). */
  vorhanden: Planposten | null;
  /** Der Satz für die Anzeige. */
  grund?: string;
  /** Letzter Zahltag: beim beendeten Mandat laut Plan, bei „endet“ laut Mandat. */
  letzteZahlung?: string;
}

const euroText = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} €`;
const tagText = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
/** Künftige Zahlungen (ab heute bis `bis`) einer Liste von Posten — Summe auf den Cent und letzter Zahltag. */
function kuenftig(l: readonly Planposten[], heute: string, bis: string): { summe: number; letzte: string | null } {
  let cent = 0; let letzte: string | null = null;
  for (const p of l) for (const d of zahltage(p, heute, bis)) { cent += Math.round(p.betrag * 100); if (!letzte || d > letzte) letzte = d; }
  return { summe: cent / 100, letzte };
}

/**
 * Wie steht das Mandat im Liquiditätsplan? EINE Rechnung für Mandatsseite und Route (rein): fehlt · ok · abweichend (Betrag, Rhythmus,
 * Teilmonat fehlt, zahlt länger oder kürzer) · kein Posten (mit Grund) · endet (beendet, der Plan zahlt noch über das Ende) · beendet (der
 * Plan endet mit dem Mandat). Verglichen werden die KÜNFTIGEN Zahlungen — Vergangenes ist Rechnung, nicht Plan.
 */
export function mandatLiquiLage(m: Mandat, posten: readonly Planposten[], heute: string, katalog?: Katalog, anrechnung?: AnrechnungBestand): MandatLiquiLage {
  const ist = posten.filter(p => postenVomMandat(p.id, m));
  const vorhanden = ist.find(p => p.id === hauptPostenId(m)) ?? ist[0] ?? null;
  const beendet = m.status === 'beendet';
  const soll = mandatPosten(m, heute, { beendet, katalog, anrechnung });
  // Beendet ohne Posten (bzw. ohne Plan): nichts einzutragen — der Satz sagt, warum.
  if (beendet ? !ist.length : !soll.length) return { lage: 'kein-posten', soll: beendet ? [] : soll, vorhanden, grund: keinPostenGrund(m) };
  if (!ist.length) return { lage: 'fehlt', soll, vorhanden: null };
  // Vergleichsfenster: bis gut ein Jahr nach der letzten geplanten Zahlung (offene Posten: ein Jahr ab heute).
  const sollLetzte = soll.reduce<string | null>((x, p) => { const l = letzterZahltag(p); return l && (!x || l > x) ? l : x; }, null);
  const offen = soll.some(p => p.rhythmus !== 'einmalig' && !p.bis);
  const fenster = plusTage(offen || !sollLetzte || sollLetzte < heute ? heute : sollLetzte, 400);
  const a = kuenftig(ist, heute, fenster), b = kuenftig(soll, heute, fenster);
  const gleich = Math.abs(a.summe - b.summe) <= 1;
  if (beendet) {
    if (!gleich && a.summe > b.summe) return { lage: 'endet', soll, vorhanden, ...(b.letzte ? { letzteZahlung: b.letzte } : {}), grund: a.letzte && (!b.letzte || a.letzte > b.letzte) ? 'Mandat beendet — der Posten im Liquiditätsplan läuft noch weiter.' : 'Mandat beendet — der Plan rechnet den letzten Monat noch voll.' };
    const letzte = ist.reduce<string | null>((x, p) => { const l = letzterZahltag(p); return l && (!x || l > x) ? l : x; }, null);
    return { lage: 'beendet', soll, vorhanden, ...(letzte ? { letzteZahlung: letzte } : {}), grund: letzte ? `Mandat beendet — ${letzte < heute ? 'die letzte Zahlung im Liquiditätsplan war am' : 'letzte Zahlung im Liquiditätsplan am'} ${tagText(letzte)}.` : 'Mandat beendet — im Liquiditätsplan kommt nichts mehr.' };
  }
  const sollHaupt = soll.find(p => p.id === hauptPostenId(m));
  const istHaupt = ist.find(p => p.id === hauptPostenId(m));
  if (sollHaupt && istHaupt && Math.abs(istHaupt.betrag - sollHaupt.betrag) > 1) return { lage: 'abweichend', soll, vorhanden, grund: `Plan ${euroText(istHaupt.betrag)}, Mandat ${euroText(sollHaupt.betrag)} je Zahlung.` };
  if (sollHaupt && istHaupt && istHaupt.rhythmus !== sollHaupt.rhythmus) return { lage: 'abweichend', soll, vorhanden, grund: `Plan ${istHaupt.rhythmus}, Mandat ${sollHaupt.rhythmus}.` };
  const fehltTeil = soll.find(t => t.id !== hauptPostenId(m) && t.ab >= heute && !ist.some(x => x.id === t.id && Math.abs(x.betrag - t.betrag) <= 1));
  if (fehltTeil) return { lage: 'abweichend', soll, vorhanden, grund: fehltTeil.id.startsWith(anrechnungPostenId(m))
    ? `${ANRECHNUNG_FEHLT} — ${fehltTeil.titel.split(' — ').pop() ?? 'Anrechnung'} (${euroText(fehltTeil.betrag)}) steht nicht im Plan, der Monat ist sonst zu hoch.`
    : fehltTeil.id.includes(`${PLANPOSTEN_TEIL}z-`)
    ? `Zusatzmodul ${fehltTeil.titel.split(' — ').pop() ?? ''} (${euroText(fehltTeil.betrag)}) fehlt im Plan.`
    : `${fehltTeil.titel.split(' — ').pop() ?? 'Ein Teilmonat'} (${euroText(fehltTeil.betrag)}) fehlt im Plan — der Plan rechnet den Monat sonst voll.` };
  if (!gleich) return { lage: 'abweichend', soll, vorhanden, grund: `Der Plan rechnet künftig ${euroText(a.summe)}, das Mandat ${euroText(b.summe)}${b.letzte ? ` bis ${tagText(b.letzte)}` : ''}.` };
  return { lage: 'ok', soll, vorhanden };
}

/**
 * Die Posten eines Mandats an seinen Zahlplan angleichen (rein): Monatsposten und Teilmonate wie `soll`, künftige Teilmonate, die nicht mehr
 * dazugehören, fallen weg (Vergangenes bleibt). Gibt es keinen vollen Monat mehr, zahlt der Monatsposten ab heute nichts mehr (`bis` davor).
 * `nurZeit` („Posten beenden“): am Monatsposten nur Beginn und Ende — Betrag, Titel, Sicherheit bleiben, wie sie im Plan stehen.
 */
export function postenAngleichen(alt: readonly Planposten[], m: Mandat, soll: readonly Planposten[], heute: string, opt: { nurZeit?: boolean } = {}): Planposten[] {
  const hauptId = hauptPostenId(m);
  const sollHaupt = soll.find(p => p.id === hauptId);
  const raus: Planposten[] = [];
  for (const x of alt) {
    if (x.id === hauptId) {
      if (sollHaupt) {
        const { bis: _b, ...ohneBis } = x;
        raus.push(opt.nurZeit ? { ...ohneBis, ab: sollHaupt.ab, ...(sollHaupt.bis ? { bis: sollHaupt.bis } : {}) } : { ...ohneBis, ...sollHaupt });
      } else {
        const stop = plusTage(x.ab < heute ? heute : x.ab, -1);
        raus.push(!x.bis || x.bis > stop ? { ...x, bis: stop } : x);
      }
      continue;
    }
    if (postenVomMandat(x.id, m)) {
      const t = soll.find(p => p.id === x.id);
      if (t) raus.push({ ...x, ...t });
      else if (x.ab < heute) raus.push(x);
      continue;
    }
    raus.push(x);
  }
  for (const p of soll) if (!alt.some(x => x.id === p.id)) raus.push(p);
  return raus;
}

// ── „Mandat beenden“ (18.10., Nachprüfung N6) ────────────────────────────────────────────────────────────────────────────────────
// Vorher schrieb die Status-Wahl „Beendet“ sofort `ende = heute` — auch mitten in der Mindestlaufzeit, ohne Rückfrage. Jetzt EIN Dialog:
// Ende-Datum (Vorgabe hier), Hinweise zu Mindestlaufzeit und Kündigungsfrist (`mandatFristen`), und im selben Schritt der Liquiditätsplan.

/**
 * Vorgabe für das Ende: das gesetzte Ende; sonst der letzte Tag der laufenden Periode (Mindestlaufzeit bzw. — bei automatischer Verlängerung —
 * der nächsten Periode, `mandatFristen` minus einen Tag); liegt der schon hinter uns, heute. `art` sagt, woher der Tag kommt.
 */
export function beendenVorgabe(m: Pick<Mandat, 'ende' | 'start' | 'mindestlaufzeitMonate' | 'verlaengerung' | 'kuendigungsfristTage'>, heute: string): { tag: string; art: 'ende' | 'laufzeit' | 'heute' } {
  if (m.ende) return { tag: m.ende.slice(0, 10), art: 'ende' };
  const { endeAm } = mandatFristen(m, heute);
  const letzter = endeAm ? plusTage(endeAm, -1) : null;
  return letzter && letzter >= heute ? { tag: letzter, art: 'laufzeit' } : { tag: heute, art: 'heute' };
}

const tagDe = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
/**
 * Was beim gewählten Ende zu wissen ist (Sätze, rein): Fehler (kein Tag, vor dem Beginn) bzw. Hinweise — vor dem Ende der Mindestlaufzeit,
 * Kündigungsfrist (bis wann gekündigt sein muss bzw. dass sie verpasst ist), Ende in der Zukunft (Rechnungen bis dahin).
 */
export function beendenHinweise(m: Pick<Mandat, 'start' | 'mindestlaufzeitMonate' | 'kuendigungsfristTage'>, ende: string, heute: string): { fehler: string | null; hinweise: string[] } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ende) || !Number.isFinite(Date.parse(`${ende}T12:00:00Z`))) return { fehler: 'Bitte ein Ende-Datum wählen.', hinweise: [] };
  if (m.start && ende < m.start.slice(0, 10)) return { fehler: `Das Ende liegt vor dem Beginn (${tagDe(m.start.slice(0, 10))}).`, hinweise: [] };
  const hinweise: string[] = [];
  const mindest = mindestEnde(m);
  if (mindest && ende < mindest) hinweise.push(`Mindestlaufzeit bis ${tagDe(mindest)} — ein früheres Ende nur, wenn der Kunde zustimmt.`);
  if (m.kuendigungsfristTage && m.kuendigungsfristTage > 0) {
    const bis = plusTage(ende, 1 - m.kuendigungsfristTage);
    hinweise.push(bis < heute
      ? `Kündigungsfrist ${m.kuendigungsfristTage} Tage: für ein Ende am ${tagDe(ende)} hätte bis ${tagDe(bis)} gekündigt sein müssen — nur im Einvernehmen.`
      : `Kündigungsfrist ${m.kuendigungsfristTage} Tage: für ein Ende am ${tagDe(ende)} spätestens am ${tagDe(bis)} kündigen.`);
  }
  if (ende > heute) hinweise.push(`Bis ${tagDe(ende)} läuft die Leistung weiter — Monatsrechnungen gehen bis dahin, der letzte Monat anteilig.`);
  return { fehler: null, hinweise };
}

// ── Kunden zu zweit (25.09.) ────────────────────────────────────────────────
// Je Mandat ist jemand zuständig (Mandat.zustaendig; ohne Eintrag die
// Sales-Verantwortung, also Kevin). Die Zeile je Person zeigt, was bei wem
// liegt: aktive Mandate, wiederkehrender Umsatz, Reviews in sieben Tagen,
// kritische Mandate (Ampel rot) und offene Punkte.

export interface KundenJePerson { person: string; aktiv: number; mrr: number; reviews: number; kritisch: number; offen: number }
export function kundenJePerson(mandate: Mandat[], heute: string, lage?: Record<string, Pick<MandatLage, 'ampel'> | undefined>): KundenJePerson[] {
  const bald = plusTage(heute, 7);
  const laufend = mandate.filter(m => m.status !== 'beendet');
  const personen = [...TEAM.map(t => t.id), ...(laufend.some(m => zustaendig(m.zustaendig, 'sales') === BEIDE) ? [BEIDE] : [])];
  return personen.map(person => {
    const l = laufend.filter(m => zustaendig(m.zustaendig, 'sales') === person);
    const aktiv = l.filter(m => m.status === 'aktiv');
    return {
      person, aktiv: aktiv.length, mrr: mrr(aktiv),
      reviews: aktiv.filter(m => m.naechstesReview && m.naechstesReview <= bald).length,
      kritisch: aktiv.filter(m => (lage?.[m.id] ?? mandatLage(m, heute)).ampel === 'rot').length,
      offen: l.reduce((a, m) => a + m.offen.length, 0),
    };
  });
}

// ── Filter nach Gesellschaft (28.09.) ────────────────────────────────────────
// Mandate unterscheiden kdc · kdv · ug (lib/einheiten.ts). Die Mandatsliste filtert
// zusätzlich zur Person nach Gesellschaft; „offen“ erscheint nur unter „Alle“.

export type GesellschaftFilter = 'alle' | Gesellschaftskennung;
/** Die Filter-Werte in fester Reihenfolge — `kurz` für schmale Bildschirme. */
export const GESELLSCHAFT_FILTER: readonly { id: GesellschaftFilter; label: string; kurz: string }[] = [
  { id: 'alle', label: 'Alle', kurz: 'Alle' },
  ...KERN_EINHEITEN.map(e => ({ id: e.id, label: e.label, kurz: e.kurz })),
];
/**
 * Die Gesellschafts-Auswahl für ein Konto (Abnahme 14.10., B17): ein Konto „nur Business“ (`finanzRecht: 'business'`) bekommt keine
 * Privat-Einheit (die Selbstständigkeit gehört zu Privat — `gehoertZuPrivat`, lib/einheiten.ts) als Auswahl. Rein.
 */
export function gesellschaftFilterFuer(nurBusiness: boolean | null | undefined): readonly { id: GesellschaftFilter; label: string; kurz: string }[] {
  return nurBusiness ? GESELLSCHAFT_FILTER.filter(g => g.id === 'alle' || !gehoertZuPrivat(g.id)) : GESELLSCHAFT_FILTER;
}
/** Passt ein Mandat (bzw. seine Gesellschaft) zum Filter? `alle` lässt alles durch. */
export const passtGesellschaft = (filter: GesellschaftFilter, gesellschaft: string | null | undefined): boolean =>
  filter === 'alle' || gesellschaft === filter;

/**
 * Steht beim Mandat die Gesellschaft noch „offen“ (oder ein unbekannter Wert)? Dann wird keine Rechnung still bei der Vorgabe angelegt —
 * erst wählen (08.10., Markttraktion Woche 2 · 3.13; der Server lehnt `quelle: 'mandat'` ebenso ab). Register-Gesellschaften sind gewählt.
 */
export const mandatGesellschaftOffen = (g: string | null | undefined): boolean => !gesellschaftAusEinheit(g) && !istRegisterKennung(g);
