// ─── Sales in drei Ebenen (rein, getestet) ─────────────────────────────────
// Kevin (25.09.): „Im Sales müssen klare Ebenen eingebaut werden. Dort arbeiten
// wir über die Kontakt-/Firmen-Ebene, wo wir qualifizieren und es ein SQL-Lead
// wird. Geht es ins Closing, brauchen wir eine Deal-Ebene und Pipeline.“
//   Ebene 1  LEAD    Firma (Account) — ohne Firma die Person. Status neu →
//                    kontaktiert → im Gespräch → Qualifizierung → SQL, dazu
//                    „kein Fit“ und „ruht“. Qualifiziert wird mit sechs
//                    Kernfragen; SQL, wenn Schmerz UND Entscheider geklärt sind
//                    und Budget ODER Zeitpunkt.
//   Ebene 2  DEAL    Aus dem SQL wird mit einem Klick ein Deal (Chance) in der
//                    Pipeline: SQL → Bedarf → Diagnose → Angebot → Abschluss →
//                    gewonnen/verloren. Die Kernfragen wandern mit.
//   Ebene 3  KUNDE   Gewonnen → Mandat (Produkte & Mandate, /os/mandate; unter Deals › Kunden verlinkt).
// Seit 27.09. liegen die Ebenen auf den Reitern Firmen › Leads (1), Deals (2) und Deals › Kunden (3).
// Solange niemand den Status gesetzt hat, wird er aus den Personen abgeleitet
// (Kontaktstufe, Lebensphase, offener Deal) — so ist die Liste sofort gefüllt,
// ohne 450 Einträge von Hand.

import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename } from '@/lib/make-one/crm';
import type { CrmBestand, Chance, Firma, Kriterien, Lead, LeadStatus, Qual } from './typen';
import { OFFENE_STUFEN, gesamtwert } from './pipeline';
import { haeltBeziehung } from './team';
import { dealZuFirma } from './firmen-bezug';
import { leadScore, kanalVon, warmPlus, scoringKontext, type LeadScore, type KanalId } from './score';
import { beanVon, beanFirma, type BeanId } from './bean';
import { personenJeFirma, firmenDerPerson, personenDerFirma } from './stationen';
import { ausgenommen } from '@/lib/crm/einschraenkung';

export const LEAD_STATUS: { id: LeadStatus; label: string; weiterWenn: string; aktiv: boolean }[] = [
  { id: 'neu', label: 'Neu', weiterWenn: 'Erste Ansprache über einen zulässigen Kanal.', aktiv: false },
  { id: 'kontaktiert', label: 'Kontaktiert', weiterWenn: 'Es kam eine Antwort oder ein Gespräch zustande.', aktiv: true },
  { id: 'im_gespraech', label: 'Im Gespräch', weiterWenn: 'Ein echtes Gespräch über ein Problem — dann qualifizieren.', aktiv: true },
  { id: 'qualifizierung', label: 'Qualifizierung', weiterWenn: 'Schmerz und Entscheider geklärt, dazu Budget oder Zeitpunkt → SQL.', aktiv: true },
  { id: 'sql', label: 'SQL', weiterWenn: 'Deal in der Pipeline — ab hier Closing.', aktiv: false },
  { id: 'kunde', label: 'Kunde', weiterWenn: '', aktiv: false },
  { id: 'kein_fit', label: 'Kein Fit', weiterWenn: '', aktiv: false },
  { id: 'ruht', label: 'Ruht', weiterWenn: '', aktiv: false },
];
export const statusLabel = (s: LeadStatus) => LEAD_STATUS.find(x => x.id === s)?.label ?? s;

export const KRITERIEN: { id: keyof Kriterien; label: string; frage: string }[] = [
  { id: 'schmerz', label: 'Schmerz', frage: 'Welches Problem kostet sie heute Geld, Zeit oder Nerven — konkret?' },
  { id: 'entscheider', label: 'Entscheider', frage: 'Wer entscheidet und zahlt — und sprechen wir mit ihr oder ihm?' },
  { id: 'budget', label: 'Budget', frage: 'Gibt es einen Rahmen, oder ist der Schmerz groß genug, einen zu schaffen?' },
  { id: 'zeitpunkt', label: 'Zeitpunkt', frage: 'Bis wann muss es gelöst sein — und warum dann?' },
  { id: 'wirkung', label: 'Wirkung', frage: 'Woran merken sie in sechs Monaten, dass es sich gelohnt hat?' },
  { id: 'alternative', label: 'Alternative', frage: 'Was tun sie, wenn sie nichts tun — oder mit wem sprechen sie noch?' },
];
export const leereKriterien = (): Kriterien => ({ schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' });

/** SQL, wenn Schmerz UND Entscheider „ja“ sind und Budget ODER Zeitpunkt „ja“. */
export function sqlBereit(k: Kriterien): boolean {
  return k.schmerz === 'ja' && k.entscheider === 'ja' && (k.budget === 'ja' || k.zeitpunkt === 'ja');
}
export const geklaert = (k: Kriterien) => Object.values(k).filter(w => w === 'ja').length;
/** Was bis zum SQL fehlt — in der Reihenfolge, in der man fragt. */
export function fehltBisSql(k: Kriterien): string[] {
  const f: string[] = [];
  if (k.schmerz !== 'ja') f.push('Schmerz');
  if (k.entscheider !== 'ja') f.push('Entscheider');
  if (k.budget !== 'ja' && k.zeitpunkt !== 'ja') f.push('Budget oder Zeitpunkt');
  return f;
}

/** Abgeleiteter Status aus den Personen, solange niemand ihn gesetzt hat. */
export function abgeleitet(personen: Kontakt[], offenerDeal: boolean): LeadStatus {
  if (personen.some(k => k.lebensphase === 'kunde' || k.stufe === 'gewonnen')) return 'kunde';
  if (offenerDeal || personen.some(k => k.stufe === 'angebot')) return 'sql';
  if (personen.some(k => k.stufe === 'gespraech' || k.stufe === 'termin')) return 'im_gespraech';
  if (personen.some(k => k.stufe === 'angesprochen')) return 'kontaktiert';
  if (personen.length && personen.every(k => k.stufe === 'verloren' || k.stufe === 'ruht' || ausgenommen(k))) return 'ruht';
  return 'neu';
}

export interface LeadZeile {
  /** firma-ID (f-…) oder kontakt-ID (c-…) — daran hängt die Qualifizierung. */
  id: string; art: 'firma' | 'person'; name: string; firmaId?: string;
  personen: { id: string; name: string; position?: string; stufe: string }[];
  /** Hauptansprechpartner (Kennung) — am Lead gewählt oder die zuletzt kontaktierte Person. */
  hauptKontaktId?: string;
  status: LeadStatus; gesetzt: boolean; kriterien: Kriterien; fit?: Qual; notiz?: string; grund?: string;
  deal?: { id: string; titel: string; stufe: string; wert: number; offen: boolean };
  letzterKontakt?: string; naechsterSchritt?: { text: string; datum: string; bei: string };
  besitzer: string; branche?: string; stadt?: string; sqlAm?: string;
  /** Lead-Score (27.09.): Punkte, Temperatur, vier Teile — und der Herkunftskanal. */
  score: LeadScore; kanal: KanalId;
  /** Freitext je Frage und wann zuletzt qualifiziert wurde (Qualifizierungsrunde). */
  antworten?: Lead['antworten']; qualifiziertAm?: string;
  /** Die im Gespräch gewählten Stufen je Kriterium (Scoring-Einstellungen, 03.10.). */
  stufen?: Lead['stufen'];
  /** Geparkt bis (Status „ruht“) und die feste Art des Grundes (kein Fit / geparkt) — für Runde und Auswertung. */
  wiedervorlage?: string; grundArt?: string;
  /** Besitzer wurde nie gesetzt — in der Runde per Klick übernehmen. */
  ohneBesitzer: boolean;
  /**
   * BEAN-Kundengruppe (28.09., H4, lib/crm/bean.ts): der Firma bzw. der Person — von Hand oder abgeleitet
   * aus Mandaten und Deals. Die Oberfläche rechnet sie mit der Dateiablage nach (`beanFuerLead`).
   */
  bean: BeanId;
}

/**
 * Alle Leads: je Firma eine Zeile (mit ihren Personen), dazu Personen ohne
 * Firma einzeln. Firmen ohne Person und reine Dienstleister/Investoren fehlen
 * — sie sind kein Vertrieb.
 *
 * `heute` ist Pflicht (28.09., K3 · #75): der Berliner Tag des Aufrufers (`localDay()`),
 * nie ein UTC-Tag aus `toISOString()` — der liegt nachts bis 2 Uhr einen Tag daneben.
 */
export function leads(kontakte: Kontakt[], crm: CrmBestand, heute: string): LeadZeile[] {
  // Die Scoring-Einstellungen und Teilnahmen/Events (Signale) — EINMAL für alle Leads (score.ts `scoringKontext`).
  const skx = scoringKontext(crm);
  const offeneDeals = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const dealVon = (ids: string[], firma?: Firma): Chance | undefined =>
    (firma?.lead?.chanceId ? crm.chancen.find(c => c.id === firma.lead!.chanceId) : undefined)
    ?? offeneDeals.find(c => c.kontaktIds.some(id => ids.includes(id)) || (!!firma && dealZuFirma(c, firma)))
    ?? crm.chancen.find(c => c.kontaktIds.some(id => ids.includes(id)));
  // Personen einer Firma nur über die Stationen (28.09.): wer in zwei Firmen aktiv ist, zählt bei beiden.
  const jeFirma = personenJeFirma(kontakte, { nurAktiv: true });
  const ohneFirma = kontakte.filter(k => !firmenDerPerson(k).length);
  const zeile = (id: string, art: LeadZeile['art'], name: string, personen: Kontakt[], lead: Lead | undefined, firma?: Firma): LeadZeile => {
    const ids = personen.map(k => k.id);
    const d = dealVon(ids, firma);
    const offen = !!d && OFFENE_STUFEN.includes(d.stufe);
    const letzter = personen.map(k => k.letzterKontakt).filter(Boolean).sort().pop();
    const schritt = personen.filter(k => k.naechsterSchritt).sort((a, b) => a.naechsterSchritt!.datum.localeCompare(b.naechsterSchritt!.datum))[0];
    // Hauptansprechpartner: der am Lead gewählte (wenn er noch dort aktiv ist), sonst die zuletzt kontaktierte Person.
    const haupt = personen.find(k => !!lead?.hauptKontaktId && k.id === lead.hauptKontaktId) ?? [...personen].sort((a, b) => (b.letzterKontakt ?? '').localeCompare(a.letzterKontakt ?? ''))[0];
    const kriterien: Kriterien = { ...leereKriterien(), ...(lead?.kriterien ?? {}), ...(!lead?.kriterien && d ? d.qualifizierung : {}) };
    return {
      id, art, name, ...(firma ? { firmaId: firma.id, branche: firma.branche, stadt: firma.stadt } : {}),
      personen: personen.map(k => ({ id: k.id, name: anzeigename(k), position: k.position ?? k.jobtitel, stufe: k.stufe })), ...(haupt ? { hauptKontaktId: haupt.id } : {}),
      // Aus dem SQL wurde ein Deal: gewonnen → Kunde, verloren/geparkt → ruht (mit Verlustgrund) — ohne zweite Buchung.
      status: lead?.status === 'sql' && d && !offen ? (d.stufe === 'gewonnen' ? 'kunde' : 'ruht') : lead?.status ?? abgeleitet(personen, offen), gesetzt: !!lead?.status,
      kriterien,
      score: leadScore(personen, lead, heute, kriterien, skx), kanal: kanalVon(haupt ?? personen[0] ?? {}),
      ...(lead?.antworten ? { antworten: lead.antworten } : {}), ...(lead?.qualifiziertAm ? { qualifiziertAm: lead.qualifiziertAm } : {}),
      ...(lead?.stufen ? { stufen: lead.stufen } : {}), ...(lead?.wiedervorlage ? { wiedervorlage: lead.wiedervorlage } : {}), ...(lead?.grundArt ? { grundArt: lead.grundArt } : {}),
      ohneBesitzer: personen.every(k => !k.besitzer),
      bean: firma ? beanFirma(firma, crm, personen).bean : beanVon(personen[0] ?? { id, firmaId: undefined }, crm).bean,
      ...(lead?.fit ? { fit: lead.fit } : {}), ...(lead?.notiz ? { notiz: lead.notiz } : {}), ...(lead?.grund ? { grund: lead.grund } : lead?.status === 'sql' && d && !offen && d.grund ? { grund: d.grund } : {}), ...(lead?.sqlAm ? { sqlAm: lead.sqlAm } : {}),
      ...(d ? { deal: { id: d.id, titel: d.titel, stufe: d.stufe, wert: Math.round(gesamtwert(d)), offen } } : {}),
      ...(letzter ? { letzterKontakt: letzter } : {}),
      ...(schritt ? { naechsterSchritt: { ...schritt.naechsterSchritt!, bei: anzeigename(schritt) } } : {}),
      besitzer: haupt ? haeltBeziehung(haupt) : 'kevin',
    };
  };
  const raus: LeadZeile[] = [];
  for (const f of crm.firmen) {
    const personen = (jeFirma.get(f.id) ?? []).filter(k => !ausgenommen(k));
    if (!personen.length || f.rolle === 'dienstleister' || f.rolle === 'investor' || f.rolle === 'wettbewerb') continue;
    raus.push(zeile(f.id, 'firma', f.name, personen, f.lead, f));
  }
  for (const k of ohneFirma.filter(k => !ausgenommen(k))) raus.push(zeile(k.id, 'person', `${anzeigename(k)}${k.firma ? ` (${k.firma})` : ''}`, [k], k.lead));
  const rang = (s: LeadStatus) => ['qualifizierung', 'im_gespraech', 'kontaktiert', 'sql', 'neu', 'kunde', 'ruht', 'kein_fit'].indexOf(s);
  return raus.sort((a, b) => rang(a.status) - rang(b.status) || (b.letzterKontakt ?? '').localeCompare(a.letzterKontakt ?? '') || a.name.localeCompare(b.name));
}

export interface Trichter {
  stufen: { id: string; label: string; anzahl: number; wert?: number; ebene: 1 | 2 | 3; ziel: { s: string; a?: string } }[];
  /** Umwandlung: aus „im Gespräch“ wird SQL, aus SQL wird gewonnen (nur, wo es schon Fälle gibt). */
  gespraechZuSql: number | null; sqlZuGewonnen: number | null;
}

/** Der Trichter über alle drei Ebenen — für die Leiste über den Leads (Firmen › Leads). */
export function trichter(zeilen: LeadZeile[], crm: CrmBestand): Trichter {
  const n = (s: LeadStatus) => zeilen.filter(z => z.status === s).length;
  const offen = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const gewonnen = crm.chancen.filter(c => c.stufe === 'gewonnen');
  const verloren = crm.chancen.filter(c => c.stufe === 'verloren');
  const sqlJe = zeilen.filter(z => z.status === 'sql' || z.status === 'kunde' || z.sqlAm).length;
  const warenImGespraech = sqlJe + n('im_gespraech') + n('qualifizierung');
  return {
    stufen: [
      { id: 'kontaktiert', label: 'Kontaktiert', anzahl: n('kontaktiert'), ebene: 1, ziel: { s: 'firmen', a: 'leads' } },
      { id: 'im_gespraech', label: 'Im Gespräch', anzahl: n('im_gespraech'), ebene: 1, ziel: { s: 'firmen', a: 'leads' } },
      { id: 'qualifizierung', label: 'Qualifizierung', anzahl: n('qualifizierung'), ebene: 1, ziel: { s: 'firmen', a: 'leads' } },
      { id: 'deals', label: 'Deals offen', anzahl: offen.length, wert: Math.round(offen.reduce((a, c) => a + gesamtwert(c), 0)), ebene: 2, ziel: { s: 'deals' } },
      { id: 'gewonnen', label: 'Gewonnen', anzahl: gewonnen.length, ebene: 2, ziel: { s: 'deals', a: 'auswertung' } },
      { id: 'kunden', label: 'Kunden', anzahl: crm.mandate.filter(m => m.status === 'aktiv').length, ebene: 3, ziel: { s: 'deals', a: 'kunden' } },
    ],
    gespraechZuSql: warenImGespraech >= 3 ? Math.round((sqlJe / warenImGespraech) * 100) : null,
    sqlZuGewonnen: gewonnen.length + verloren.length >= 3 ? Math.round((gewonnen.length / (gewonnen.length + verloren.length)) * 100) : null,
  };
}

// ── Qualifizierungsrunde (27.09.) ─────────────────────────────────────────────
export const QUALI_WIEDERVORLAGE_TAGE = 60;
export interface RundenFilter {
  /** Team-Kürzel der Person, deren Leads dran sind; „ohne“ = Leads ohne Besitzer; „alle“ = jede. */
  wer: string | 'ohne' | 'alle';
  /** Auch kalte Leads zeigen (Standard: nur lau und wärmer). */
  auchKalt?: boolean;
  kanal?: KanalId;
  /** Nur diese BEAN-Gruppe (28.09., H4) — die Filter-Pille „Neu“ in der Runde. */
  bean?: BeanId;
  heute: string;
}
const tageZw = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);
/**
 * Offene Fragen an diesem Lead: die Sales-Fragen der Scoring-Einstellungen, die noch keine eigene Antwort haben
 * (Fragen mit Messung, z. B. „Fit“ aus der Liste, zählen nicht — die sind abgeleitet). Beim Standard sind das genau die
 * sechs Kernfragen mit „unklar“. Ohne Scoring-Ergebnis (von Hand gebaute Zeile) gilt die alte Rechnung.
 */
export function offeneFragen(z: Pick<LeadZeile, 'kriterien' | 'score'>): number {
  const s = z.score.scoring?.sales;
  if (!s) return (Object.values(z.kriterien) as Qual[]).filter(w => w === 'unklar').length;
  return s.teile.flatMap(t => t.kriterien).filter(k => k.quelle === 'frage' && k.offen && k.herkunft === 'ohne').length;
}
/**
 * Braucht dieser Lead noch Qualifizierung? Offener Status, offene Fragen oder länger nicht angefasst — oder er war geparkt und
 * seine Wiedervorlage ist erreicht (03.10.: dann kommt er aus „ruht“ zurück in die Runde).
 */
export function brauchtQualifizierung(z: Pick<LeadZeile, 'status' | 'kriterien' | 'qualifiziertAm' | 'deal' | 'score'> & { wiedervorlage?: string }, heute: string): boolean {
  if (z.status === 'ruht' && z.wiedervorlage && z.wiedervorlage <= heute) return !z.deal?.offen;
  if (!['neu', 'kontaktiert', 'im_gespraech', 'qualifizierung'].includes(z.status)) return false;
  if (z.deal?.offen) return false;
  if (offeneFragen(z) > 0) return true;
  return !z.qualifiziertAm || tageZw(z.qualifiziertAm, heute) > QUALI_WIEDERVORLAGE_TAGE;
}
/**
 * SQL-bereit, aber noch ohne Entscheidung (Praxis-Prüfung M3): kein Deal, der Status steht noch vor „SQL“. Wer das Ergebnis eines Gesprächs
 * verlässt, ohne „Deal anlegen“, „Parken“ oder „Raus“ zu wählen, hat den Lead sonst aus der Runde verloren (frisch geprüft = nicht mehr dran).
 * Diese Leads bleiben in der Runde — als eigene Gruppe oben — bis jemand entscheidet.
 */
export function sqlEntscheidungOffen(z: Pick<LeadZeile, 'status' | 'kriterien' | 'score' | 'deal'>): boolean {
  return !z.deal && ['neu', 'kontaktiert', 'im_gespraech', 'qualifizierung'].includes(z.status) && salesBereit(z);
}
/**
 * Die Leads für die Qualifizierungsrunde — zuerst „SQL bereit — Entscheidung offen“ (ohne Temperaturfilter: da wartet eine Entscheidung),
 * dann die übrigen: eigene zuerst, warm vor kalt, dann die zuletzt angefassten.
 */
export function zuQualifizieren(zeilen: LeadZeile[], f: RundenFilter): LeadZeile[] {
  return zeilen
    .filter(z => brauchtQualifizierung(z, f.heute) || sqlEntscheidungOffen(z))
    .filter(z => (f.wer === 'alle' ? true : f.wer === 'ohne' ? z.ohneBesitzer : !z.ohneBesitzer && (z.besitzer === f.wer || z.besitzer === 'beide')))
    .filter(z => f.auchKalt || z.score.temperatur !== 'kalt' || sqlEntscheidungOffen(z))
    .filter(z => !f.kanal || z.kanal === f.kanal)
    .filter(z => !f.bean || z.bean === f.bean)
    .sort((a, b) => Number(sqlEntscheidungOffen(b)) - Number(sqlEntscheidungOffen(a)) || b.score.punkte - a.score.punkte || (b.letzterKontakt ?? '').localeCompare(a.letzterKontakt ?? '') || a.name.localeCompare(b.name));
}
/** Warum „Parken“ und „Raus — Kein Fit“ nicht gehen (M8): der Lead ist schon SQL/Kunde oder hat einen offenen Deal — dann wird der Deal in der Deal-Akte geparkt oder verloren. Eine Regel für Server UND Oberfläche. */
export const AUSSCHEIDEN_GESPERRT = 'Dieser Lead ist schon SQL oder hat einen offenen Deal — der Deal wird in der Deal-Akte geparkt oder verloren.';
export const ausscheidenGesperrt = (z: Pick<LeadZeile, 'deal' | 'status'>): string | null => (z.deal?.offen || z.status === 'sql' || z.status === 'kunde' ? AUSSCHEIDEN_GESPERRT : null);
/** Leads-Liste ohne die kalten (Kevin 27.09.: kalte leben nur im Marketing-Segment „Vernetzen“, bis sie warm werden). */
export const nichtKalt = (z: Pick<LeadZeile, 'score' | 'status' | 'deal'>) => z.score.temperatur !== 'kalt' || z.status === 'sql' || z.status === 'kunde' || !!z.deal;
/**
 * SQL-bereit nach den Scoring-Einstellungen (Sales-Schwelle und Muss-Kriterien erreicht) — die eine Rechnung für Leads-Liste,
 * Runde, Heads, ZOE und den SQL-Weg. Ohne Scoring-Ergebnis (von Hand gebaute Zeile): die alte Regel `sqlBereit`.
 */
export const salesBereit = (z: Pick<LeadZeile, 'kriterien' | 'score'>): boolean => z.score.scoring?.sales.erreicht ?? sqlBereit(z.kriterien);
/** Was bis zum SQL fehlt (Muss-Kriterien, dann Punkte) — wie `fehltBisSql`, aber nach den Einstellungen. */
export const fehltBisSqlZeile = (z: Pick<LeadZeile, 'kriterien' | 'score'>): string[] => z.score.scoring?.sales.fehlt ?? fehltBisSql(z.kriterien);
/** Marketing-Schwelle (MQL) erreicht — Signale und Interaktionen reichen. */
export const mqlErreicht = (z: Pick<LeadZeile, 'score'>): boolean => z.score.scoring?.marketing.erreicht ?? false;
/** Die Stufe, in der der Lead steht: Lead → MQL → SQL-bereit (nur Anzeige, nichts davon wird gespeichert). */
export type QualiStand = 'lead' | 'mql' | 'sql_bereit' | 'sql';
export function qualiStand(z: Pick<LeadZeile, 'kriterien' | 'score' | 'status'>): QualiStand {
  if (z.status === 'sql' || z.status === 'kunde') return 'sql';
  if (salesBereit(z)) return 'sql_bereit';
  return mqlErreicht(z) ? 'mql' : 'lead';
}
export { warmPlus };

/**
 * Die Lead-Zeile zu EINER Person (Akte, Seitenfenster): dieselbe Rechnung wie die Leads-Liste, nur für ihre Firma bzw. sie selbst —
 * so zeigen Akte, Runde und Leads-Liste immer denselben Score (eine Rechnung). Mit Firma der Lead der Firma, sonst der der Person.
 */
export function leadZeileFuer(k: Kontakt, kontakte: readonly Kontakt[], crm: CrmBestand, heute: string): LeadZeile | undefined {
  const firma = k.firmaId ? crm.firmen.find(f => f.id === k.firmaId) : undefined;
  if (!firma) return leads([k], { ...crm, firmen: [] }, heute).find(z => z.id === k.id);
  const personen = personenDerFirma(kontakte as Kontakt[], firma.id);
  return leads(personen.length ? personen : [k], { ...crm, firmen: [firma] }, heute).find(z => z.id === firma.id);
}
