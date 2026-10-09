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
// Seit 08.10. (Aufräumen Etappe 3) liegen die Ebenen unter Qualifizierung & Scoring › Leads (1), Deals (2) und Produkte & Mandate (3).
// Solange niemand den Status gesetzt hat, wird er aus den Personen abgeleitet
// (Kontaktstufe, Lebensphase, offener Deal) — so ist die Liste sofort gefüllt,
// ohne 450 Einträge von Hand.

import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename } from '@/lib/make-one/crm';
import type { CrmBestand, Chance, Firma, Kriterien, Lead, LeadStatus, Qual, Quelle } from './typen';
import type { MarketingQuelle } from './scoring';
import { OFFENE_STUFEN, gesamtwert } from './pipeline';
import { haeltBeziehung, verantwortlich } from './team';
import { dealZuFirma, mandatZuFirma } from './firmen-bezug';
import { leadScore, kanalVon, warmPlus, scoringKontext, type LeadScore, type KanalId } from './score';
import { beanVon, beanFirma, type BeanId } from './bean';
import { personenJeFirma, firmenDerPerson, personenDerFirma } from './stationen';
import { ausgenommen } from '@/lib/crm/einschraenkung';

export const LEAD_STATUS: { id: LeadStatus; label: string; weiterWenn: string; aktiv: boolean }[] = [
  { id: 'neu', label: 'Neu', weiterWenn: 'Erste Ansprache über einen zulässigen Kanal.', aktiv: false },
  { id: 'kontaktiert', label: 'Kontaktiert', weiterWenn: 'Es kam eine Antwort oder ein Gespräch zustande.', aktiv: true },
  { id: 'im_gespraech', label: 'Im Gespräch', weiterWenn: 'Ein echtes Gespräch über ein Problem — dann qualifizieren.', aktiv: true },
  // Woche 1 · 2.6 (08.10.): die SQL-Regel steht in den Scoring-Einstellungen (Muss-Kriterien + Sales-Schwelle) — nie fest im Text.
  { id: 'qualifizierung', label: 'Qualifizierung', weiterWenn: 'Muss-Kriterien und Sales-Schwelle der Scoring-Einstellungen erreicht → SQL.', aktiv: true },
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

// ── Kalt oder nicht (08.10., Markttraktion Sofort-Paket 1.1/1.2) — EINE Regel für Leads-Liste, Runde, ZOE ──────────────
// Kevin 27.09.: kalte Leads leben im Marketing-Segment „Vernetzen“, bis sie warm werden. Aber: ein frisch angelegter Kontakt hat beim
// Standard-Scoring nur 1–5 Punkte und galt damit sofort als kalt — man legte an und fand den Lead nicht wieder (auch Visitenkarten vom
// Netzwerken, Status „kontaktiert“). Deshalb zählen nie als kalt: SQL, Kunde, ein Deal, ein von Hand GESETZTER aktiver Status
// (kontaktiert, im Gespräch, Qualifizierung) und ein Lead, dessen Person in den letzten 14 Tagen angelegt wurde.

/** So lange gilt eine neu angelegte Person als „frisch“ (nie kalt). */
export const FRISCH_TAGE = 14;
/**
 * Wurde diese Person in den letzten `FRISCH_TAGE` Tagen angelegt? `importiertAm` ist der Tag der Anlage (Kartei, Anfrage, Netzwerken,
 * Make.One-Abend, Visitenkarte) — ABER auch der Tag eines Listen-Imports. Die Liste legt Personen ohne jede Aktivität an (`ausZeile`), jeder
 * Anlege-Weg von Hand dagegen mit einem Vermerk („Von Hand angelegt“, „Per Visitenkarte …“, die Anfrage selbst). So bleiben frisch importierte
 * Listen kalt (sonst stünden nach einem Import Hunderte Personen 14 Tage lang „In Arbeit“), von Hand Angelegtes ist sichtbar.
 */
export function frischAngelegt(k: Pick<Kontakt, 'importiertAm' | 'aktivitaeten'>, heute: string): boolean {
  const tag = (k.importiertAm ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || !(k.aktivitaeten ?? []).length) return false;
  const tage = Math.round((Date.parse(`${heute.slice(0, 10)}T12:00:00Z`) - Date.parse(`${tag}T12:00:00Z`)) / 864e5);
  return tage >= 0 && tage <= FRISCH_TAGE;
}
/** Ein von Hand gesetzter aktiver Status (kontaktiert, im Gespräch, Qualifizierung) — wer ihn setzt, arbeitet daran. */
export const aktivGesetzt = (z: Pick<LeadZeile, 'status' | 'gesetzt'>): boolean => z.gesetzt && !!LEAD_STATUS.find(s => s.id === z.status)?.aktiv;
/** Kalt im Sinne der Listen: niedrige Temperatur UND nichts davon, was ihn trotzdem sichtbar hält (siehe oben). */
export function istKalt(z: Pick<LeadZeile, 'score' | 'status' | 'deal' | 'gesetzt' | 'frisch'>): boolean {
  if (z.score.temperatur !== 'kalt') return false;
  if (z.status === 'sql' || z.status === 'kunde' || !!z.deal) return false;
  return !aktivGesetzt(z) && !z.frisch;
}
/**
 * „In Arbeit“ (Standardfilter der Leads-Liste): nicht kalt und ein aktiver Status — oder „Neu“ (08.10.: ein neuer Lead ist Arbeit, kein
 * eigener Reiter, in dem er verschwindet). Kalte „Neu“ (Liste/Import) bleiben im Filter „Kalt“ bzw. im Segment „Vernetzen“.
 */
export const inArbeit = (z: Pick<LeadZeile, 'score' | 'status' | 'deal' | 'gesetzt' | 'frisch'>): boolean =>
  !istKalt(z) && (z.status === 'neu' || !!LEAD_STATUS.find(s => s.id === z.status)?.aktiv);

/**
 * Abgeleiteter Status aus den Personen, solange niemand ihn gesetzt hat. `kundeAktiv` (1.11, 09.10.): ein aktives Mandat (Firma oder Person)
 * bzw. die Firmenrolle „Kunde“ — dann ist der Lead „Kunde“ (vorher blieb er „neu“, während BEAN schon B zeigte).
 */
export function abgeleitet(personen: Kontakt[], offenerDeal: boolean, kundeAktiv = false): LeadStatus {
  if (kundeAktiv || personen.some(k => k.lebensphase === 'kunde' || k.stufe === 'gewonnen')) return 'kunde';
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
  /** „Geprüft“ in der Runde (Server-Stempel, 2.1) — Ruhe bis zur Wiedervorlage. */
  geprueftAm?: string;
  /** Deal direkt angelegt, ohne SQL-Kriterien (2.3): wann, und was bis zum SQL fehlte. */
  direkt?: { am: string; offen: string[] };
  /** Die im Gespräch gewählten Stufen je Kriterium (Scoring-Einstellungen, 03.10.). */
  stufen?: Lead['stufen'];
  /** Geparkt bis (Status „ruht“) und die feste Art des Grundes (kein Fit / geparkt) — für Runde und Auswertung. */
  wiedervorlage?: string; grundArt?: string;
  /** Besitzer wurde nie gesetzt — in der Runde per Klick übernehmen. */
  ohneBesitzer: boolean;
  /**
   * Frisch angelegt (08.10., Markttraktion Sofort-Paket 1.1): eine Person dieses Leads wurde in den letzten `FRISCH_TAGE` Tagen
   * angelegt (`frischAngelegt`) — so ein Lead zählt nie als kalt. Fehlt bei älteren Leads und bei von Hand gebauten Zeilen.
   */
  frisch?: true;
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
    // 1.11: aktives Mandat (an der Firma oder einer der Personen) bzw. Firmenrolle „Kunde“ → „Kunde“ — gilt für den abgeleiteten Status
    // und für ein gesetztes „Neu“ (daran hat niemand gearbeitet); ein bewusst gesetzter anderer Status (z. B. Qualifizierung für einen
    // Folgeauftrag) bleibt.
    const kundeAktiv = (!!firma && firma.rolle === 'kunde') || crm.mandate.some(m => m.status === 'aktiv' && ((!!firma && mandatZuFirma(m, firma)) || m.kontaktIds.some(id => ids.includes(id))));
    const gesetztNeu = lead?.status === 'neu';
    return {
      id, art, name, ...(firma ? { firmaId: firma.id, branche: firma.branche, stadt: firma.stadt } : {}),
      personen: personen.map(k => ({ id: k.id, name: anzeigename(k), position: k.position ?? k.jobtitel, stufe: k.stufe })), ...(haupt ? { hauptKontaktId: haupt.id } : {}),
      // Aus dem SQL wurde ein Deal: gewonnen → Kunde, verloren/geparkt → ruht (mit Verlustgrund) — ohne zweite Buchung. Ebenso ein
      // direkt angelegter Deal (2.3): der Lead blieb vor dem SQL stehen, sein Deal ist jetzt entschieden.
      status: (lead?.status === 'sql' || (!!lead?.direktAm && lead.chanceId === d?.id)) && d && !offen ? (d.stufe === 'gewonnen' ? 'kunde' : 'ruht') : gesetztNeu && kundeAktiv ? 'kunde' : lead?.status ?? abgeleitet(personen, offen, kundeAktiv), gesetzt: !!lead?.status,
      kriterien,
      score: leadScore(personen, lead, heute, kriterien, skx), kanal: kanalVon(haupt ?? personen[0] ?? {}),
      ...(lead?.antworten ? { antworten: lead.antworten } : {}), ...(lead?.qualifiziertAm ? { qualifiziertAm: lead.qualifiziertAm } : {}),
      ...(lead?.geprueftAm ? { geprueftAm: lead.geprueftAm } : {}), ...(lead?.direktAm ? { direkt: { am: lead.direktAm, offen: lead.direktOffen ?? [] } } : {}),
      ...(lead?.stufen ? { stufen: lead.stufen } : {}), ...(lead?.wiedervorlage ? { wiedervorlage: lead.wiedervorlage } : {}), ...(lead?.grundArt ? { grundArt: lead.grundArt } : {}),
      ohneBesitzer: personen.every(k => !k.besitzer),
      ...(personen.some(k => frischAngelegt(k, heute)) ? { frisch: true as const } : {}),
      bean: firma ? beanFirma(firma, crm, personen).bean : beanVon(personen[0] ?? { id, firmaId: undefined }, crm).bean,
      ...(lead?.fit ? { fit: lead.fit } : {}), ...(lead?.notiz ? { notiz: lead.notiz } : {}), ...(lead?.grund ? { grund: lead.grund } : (lead?.status === 'sql' || lead?.direktAm) && d && !offen && d.grund ? { grund: d.grund } : {}), ...(lead?.sqlAm ? { sqlAm: lead.sqlAm } : {}),
      ...(d ? { deal: { id: d.id, titel: d.titel, stufe: d.stufe, wert: Math.round(gesamtwert(d)), offen } } : {}),
      ...(letzter ? { letzterKontakt: letzter } : {}),
      ...(schritt ? { naechsterSchritt: { ...schritt.naechsterSchritt!, bei: anzeigename(schritt) } } : {}),
      // Ohne Person die Sales-Verantwortung des Teams — kein fester Name (Plattform-Regel, 08.10.).
      besitzer: haupt ? haeltBeziehung(haupt) : verantwortlich('sales'),
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
  /** `ziel.filter`: der Filter der Leads-Liste, den der Sprung mitgibt (1.4) — dieselbe Regel wie die Zahl. */
  stufen: { id: string; label: string; anzahl: number; wert?: number; ebene: 1 | 2 | 3; ziel: { s: string; a?: string; filter?: LeadFilter } }[];
  /** Umwandlung: aus „im Gespräch“ wird SQL, aus SQL wird gewonnen (nur, wo es schon Fälle gibt). */
  gespraechZuSql: number | null; sqlZuGewonnen: number | null;
}

/** Ein Filter der Leads-Liste: „In Arbeit“ (`inArbeit`, mit „Neu“), „Kalt“ (`istKalt`) oder ein Status — dann ohne die kalten. */
export type LeadFilter = 'aktiv' | 'kalt' | LeadStatus;
/**
 * Passt die Zeile zum Filter? EINE Zählregel (08.10., Woche 1 · 1.4) für die Pillen der Leads-Liste UND den Trichter darüber — vorher
 * zählte der Trichter die kalten mit, die Liste dahinter nicht. „Ruht“ umfasst „Kein Fit“.
 */
export const passtLeadFilter = (z: LeadZeile, f: LeadFilter): boolean =>
  f === 'kalt' ? !nichtKalt(z) : f === 'aktiv' ? inArbeit(z) : nichtKalt(z) && (f === 'ruht' ? z.status === 'ruht' || z.status === 'kein_fit' : z.status === f);

/** Der Trichter über alle drei Ebenen — für die Leiste über den Leads. Ebene 1 zählt wie die Liste dahinter (`passtLeadFilter`). */
export function trichter(zeilen: LeadZeile[], crm: CrmBestand): Trichter {
  const n = (s: LeadStatus) => zeilen.filter(z => passtLeadFilter(z, s)).length;
  const offen = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const gewonnen = crm.chancen.filter(c => c.stufe === 'gewonnen');
  const verloren = crm.chancen.filter(c => c.stufe === 'verloren');
  const sqlJe = zeilen.filter(z => z.status === 'sql' || z.status === 'kunde' || z.sqlAm).length;
  const warenImGespraech = sqlJe + n('im_gespraech') + n('qualifizierung');
  return {
    stufen: [
      { id: 'kontaktiert', label: 'Kontaktiert', anzahl: n('kontaktiert'), ebene: 1, ziel: { s: 'qualifizierung', a: 'leads', filter: 'kontaktiert' } },
      { id: 'im_gespraech', label: 'Im Gespräch', anzahl: n('im_gespraech'), ebene: 1, ziel: { s: 'qualifizierung', a: 'leads', filter: 'im_gespraech' } },
      { id: 'qualifizierung', label: 'Qualifizierung', anzahl: n('qualifizierung'), ebene: 1, ziel: { s: 'qualifizierung', a: 'leads', filter: 'qualifizierung' } },
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
 * Offene MUSS-Fragen (08.10., Woche 1 · 2.1): Fragen der Muss-Kriterien aus den Scoring-Einstellungen, die keine eigene Antwort haben —
 * nur in Muss-Kriterien, die noch nicht erfüllt sind. Nur sie halten einen Lead als „offen“ in der Runde (vorher jede der zwölf
 * Standardfragen — die Runde leerte sich nie). Ohne Scoring-Ergebnis (von Hand gebaute Zeile): die alte SQL-Regel (Schmerz, Entscheider,
 * Budget oder Zeitpunkt), „unklar“ = offen.
 */
export function offeneMussFragen(z: Pick<LeadZeile, 'kriterien' | 'score'>): number {
  const s = z.score.scoring?.sales;
  if (!s) { const k = z.kriterien; return (k.schmerz === 'unklar' ? 1 : 0) + (k.entscheider === 'unklar' ? 1 : 0) + (k.budget === 'unklar' && k.zeitpunkt === 'unklar' ? 1 : 0); }
  const nachId = new Map(s.teile.flatMap(t => t.kriterien).map(k => [k.id, k]));
  const offen = new Set<string>();
  for (const m of s.muss.filter(x => !x.ok)) for (const id of m.kriterien ?? []) { const k = nachId.get(id); if (k && k.quelle === 'frage' && k.offen && k.herkunft !== 'lead' && k.herkunft !== 'alt') offen.add(id); }
  return offen.size;
}
/**
 * Braucht dieser Lead noch Qualifizierung? (08.10., Woche 1 · 2.1 — konservativ: nichts verschwindet, was niemand angesehen hat)
 *  · geparkt und die Wiedervorlage ist erreicht → zurück in die Runde (03.10.)
 *  · nur offene Status ohne offenen Deal
 *  · „Geprüft“ (Server-Stempel `geprueftAm`) gibt Ruhe bis zur Wiedervorlage (`QUALI_WIEDERVORLAGE_TAGE`) — eine bewusste Entscheidung
 *    einer Person, auch wenn noch Muss-Fragen offen sind
 *  · sonst hält ihn eine offene MUSS-Frage in der Runde (nicht mehr jede Frage)
 *  · sonst: nie qualifiziert oder länger als die Wiedervorlage her
 * SQL-bereite Leads ohne Entscheidung bleiben unabhängig davon in der Runde (`sqlEntscheidungOffen`).
 */
export function brauchtQualifizierung(z: Pick<LeadZeile, 'status' | 'kriterien' | 'qualifiziertAm' | 'deal' | 'score'> & { wiedervorlage?: string; geprueftAm?: string }, heute: string): boolean {
  if (z.status === 'ruht' && z.wiedervorlage && z.wiedervorlage <= heute) return !z.deal?.offen;
  if (!['neu', 'kontaktiert', 'im_gespraech', 'qualifizierung'].includes(z.status)) return false;
  if (z.deal?.offen) return false;
  if (z.geprueftAm && tageZw(z.geprueftAm, heute) <= QUALI_WIEDERVORLAGE_TAGE) return false;
  if (offeneMussFragen(z) > 0) return true;
  return !z.qualifiziertAm || tageZw(z.qualifiziertAm, heute) > QUALI_WIEDERVORLAGE_TAGE;
}
/** Bis wann ein geprüfter Lead Ruhe hat (Tag) — für Texte in der Runde. Ohne Prüfung null. */
export const ruheBis = (z: Pick<LeadZeile, 'geprueftAm'>): string | null => {
  if (!z.geprueftAm) return null;
  const d = new Date(`${z.geprueftAm}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + QUALI_WIEDERVORLAGE_TAGE);
  return d.toISOString().slice(0, 10);
};
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
    .filter(z => f.auchKalt || !istKalt(z) || sqlEntscheidungOffen(z))
    .filter(z => !f.kanal || z.kanal === f.kanal)
    .filter(z => !f.bean || z.bean === f.bean)
    .sort((a, b) => Number(sqlEntscheidungOffen(b)) - Number(sqlEntscheidungOffen(a)) || b.score.punkte - a.score.punkte || (b.letzterKontakt ?? '').localeCompare(a.letzterKontakt ?? '') || a.name.localeCompare(b.name));
}
/**
 * Wie viele Leads in der Runde ANDEREN gehören (1.10, 09.10.): die Runde startet mit „Meine“ — Leads, die jemand anders angelegt hat bzw.
 * hält, fehlten dort ohne Hinweis. Nur für einen Personen-Filter (nicht „alle“/„ohne“); dieselben übrigen Filter wie die Runde.
 */
export function leadsAnderer(zeilen: LeadZeile[], f: RundenFilter): number {
  if (f.wer === 'alle' || f.wer === 'ohne') return 0;
  return zuQualifizieren(zeilen, { ...f, wer: 'alle' }).filter(z => !z.ohneBesitzer && z.besitzer !== f.wer && z.besitzer !== 'beide').length;
}
/** Warum „Parken“ und „Raus — Kein Fit“ nicht gehen (M8): der Lead ist schon SQL/Kunde oder hat einen offenen Deal — dann wird der Deal in der Deal-Akte geparkt oder verloren. Eine Regel für Server UND Oberfläche. */
export const AUSSCHEIDEN_GESPERRT = 'Dieser Lead ist schon SQL oder hat einen offenen Deal — der Deal wird in der Deal-Akte geparkt oder verloren.';
export const ausscheidenGesperrt = (z: Pick<LeadZeile, 'deal' | 'status'>): string | null => (z.deal?.offen || z.status === 'sql' || z.status === 'kunde' ? AUSSCHEIDEN_GESPERRT : null);
/** Leads-Liste ohne die kalten (Kevin 27.09.: kalte leben nur im Marketing-Segment „Vernetzen“, bis sie warm werden) — Regel `istKalt`. */
export const nichtKalt = (z: Pick<LeadZeile, 'score' | 'status' | 'deal'> & Partial<Pick<LeadZeile, 'gesetzt' | 'frisch'>>) => !istKalt({ gesetzt: false, ...z });
/**
 * Wie viele Leads die Runde gerade nur deshalb nicht zeigt, weil sie kalt sind (08.10.) — für den Hinweis „n kalte ausgeblendet — zeigen“,
 * damit eine leere Runde nie „alle qualifiziert“ behauptet, wenn bloß kalte fehlen. Mit `auchKalt` immer 0.
 */
export function kalteAusgeblendet(zeilen: LeadZeile[], f: RundenFilter): number {
  if (f.auchKalt) return 0;
  return zuQualifizieren(zeilen, { ...f, auchKalt: true }).length - zuQualifizieren(zeilen, f).length;
}
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

// ── Deal-Quelle aus der Herkunft (08.10., Woche 1 · 2.5) ─────────────────────────────────────────────
// Vorher war die Quelle fest vorbelegt (Gesprächsmodus „Empfehlung“, ZOE „Bestand“, Leads-Weg leer) — „Deals aus Marketing“ und der
// Marketing-Trichter rechneten damit falsch. Jetzt: zuerst die Marketing-Herkunft des Leads (`marketingHerkunft`, die EINE Stelle in
// lib/crm/scoring.ts), sonst der Herkunftskanal (`kanalVon`). „Netzwerk“ (persönlich bekannt) zählt als Bestand; unbekannt bleibt leer.
const QUELLE_AUS_MARKETING: Record<MarketingQuelle, Quelle> = { kampagne: 'kampagne', anfrage: 'inbound', inhalt: 'content', newsletter: 'content', event: 'event' };
const MARKETING_RANG: readonly MarketingQuelle[] = ['kampagne', 'anfrage', 'inhalt', 'newsletter', 'event'];
const QUELLE_AUS_KANAL: Partial<Record<KanalId, Quelle>> = { empfehlung: 'empfehlung', event: 'event', content: 'content', outreach: 'outreach', bestand: 'bestand', inbound: 'inbound', kampagne: 'kampagne', netzwerk: 'bestand' };
export function quelleAusLead(z: Pick<LeadZeile, 'score' | 'kanal'>): Quelle | undefined {
  const mk = new Set((z.score.scoring?.marketingHerkunft ?? []).map(g => g.quelle));
  const erste = MARKETING_RANG.find(q => mk.has(q));
  return erste ? QUELLE_AUS_MARKETING[erste] : QUELLE_AUS_KANAL[z.kanal];
}

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
