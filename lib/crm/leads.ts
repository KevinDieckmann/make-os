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
//   Ebene 3  KUNDE   Gewonnen → Mandat (Produkte & Mandate, /os/mandate; in Sales › Kunden verlinkt).
// Solange niemand den Status gesetzt hat, wird er aus den Personen abgeleitet
// (Kontaktstufe, Lebensphase, offener Deal) — so ist die Liste sofort gefüllt,
// ohne 450 Einträge von Hand.

import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename } from '@/lib/make-one/crm';
import type { CrmBestand, Chance, Firma, Kriterien, Lead, LeadStatus, Qual } from './typen';
import { OFFENE_STUFEN, gesamtwert } from './pipeline';
import { haeltBeziehung } from './team';

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
  if (personen.length && personen.every(k => k.stufe === 'verloren' || k.stufe === 'ruht' || k.werbesperre)) return 'ruht';
  return 'neu';
}

export interface LeadZeile {
  /** firma-ID (f-…) oder kontakt-ID (c-…) — daran hängt die Qualifizierung. */
  id: string; art: 'firma' | 'person'; name: string; firmaId?: string;
  personen: { id: string; name: string; position?: string; stufe: string }[];
  status: LeadStatus; gesetzt: boolean; kriterien: Kriterien; fit?: Qual; notiz?: string; grund?: string;
  deal?: { id: string; titel: string; stufe: string; wert: number; offen: boolean };
  letzterKontakt?: string; naechsterSchritt?: { text: string; datum: string; bei: string };
  besitzer: string; branche?: string; stadt?: string; sqlAm?: string;
}

/**
 * Alle Leads: je Firma eine Zeile (mit ihren Personen), dazu Personen ohne
 * Firma einzeln. Firmen ohne Person und reine Dienstleister/Investoren fehlen
 * — sie sind kein Vertrieb.
 */
export function leads(kontakte: Kontakt[], crm: CrmBestand): LeadZeile[] {
  const offeneDeals = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const dealVon = (ids: string[], firma?: Firma): Chance | undefined =>
    (firma?.lead?.chanceId ? crm.chancen.find(c => c.id === firma.lead!.chanceId) : undefined)
    ?? offeneDeals.find(c => c.kontaktIds.some(id => ids.includes(id)) || (!!firma && c.firma === firma.name))
    ?? crm.chancen.find(c => c.kontaktIds.some(id => ids.includes(id)));
  const jeFirma = new Map<string, Kontakt[]>();
  const ohneFirma: Kontakt[] = [];
  for (const k of kontakte) { if (k.firmaId) jeFirma.set(k.firmaId, [...(jeFirma.get(k.firmaId) ?? []), k]); else ohneFirma.push(k); }
  const zeile = (id: string, art: LeadZeile['art'], name: string, personen: Kontakt[], lead: Lead | undefined, firma?: Firma): LeadZeile => {
    const ids = personen.map(k => k.id);
    const d = dealVon(ids, firma);
    const offen = !!d && OFFENE_STUFEN.includes(d.stufe);
    const letzter = personen.map(k => k.letzterKontakt).filter(Boolean).sort().pop();
    const schritt = personen.filter(k => k.naechsterSchritt).sort((a, b) => a.naechsterSchritt!.datum.localeCompare(b.naechsterSchritt!.datum))[0];
    const haupt = [...personen].sort((a, b) => (b.letzterKontakt ?? '').localeCompare(a.letzterKontakt ?? ''))[0];
    return {
      id, art, name, ...(firma ? { firmaId: firma.id, branche: firma.branche, stadt: firma.stadt } : {}),
      personen: personen.map(k => ({ id: k.id, name: anzeigename(k), position: k.position ?? k.jobtitel, stufe: k.stufe })),
      // Aus dem SQL wurde ein Deal: gewonnen → Kunde, verloren/geparkt → ruht (mit Verlustgrund) — ohne zweite Buchung.
      status: lead?.status === 'sql' && d && !offen ? (d.stufe === 'gewonnen' ? 'kunde' : 'ruht') : lead?.status ?? abgeleitet(personen, offen), gesetzt: !!lead?.status,
      kriterien: { ...leereKriterien(), ...(lead?.kriterien ?? {}), ...(!lead?.kriterien && d ? d.qualifizierung : {}) },
      ...(lead?.fit ? { fit: lead.fit } : {}), ...(lead?.notiz ? { notiz: lead.notiz } : {}), ...(lead?.grund ? { grund: lead.grund } : lead?.status === 'sql' && d && !offen && d.grund ? { grund: d.grund } : {}), ...(lead?.sqlAm ? { sqlAm: lead.sqlAm } : {}),
      ...(d ? { deal: { id: d.id, titel: d.titel, stufe: d.stufe, wert: Math.round(gesamtwert(d)), offen } } : {}),
      ...(letzter ? { letzterKontakt: letzter } : {}),
      ...(schritt ? { naechsterSchritt: { ...schritt.naechsterSchritt!, bei: anzeigename(schritt) } } : {}),
      besitzer: haupt ? haeltBeziehung(haupt) : 'kevin',
    };
  };
  const raus: LeadZeile[] = [];
  for (const f of crm.firmen) {
    const personen = (jeFirma.get(f.id) ?? []).filter(k => !k.werbesperre);
    if (!personen.length || f.rolle === 'dienstleister' || f.rolle === 'investor' || f.rolle === 'wettbewerb') continue;
    raus.push(zeile(f.id, 'firma', f.name, personen, f.lead, f));
  }
  for (const k of ohneFirma.filter(k => !k.werbesperre)) raus.push(zeile(k.id, 'person', `${anzeigename(k)}${k.firma ? ` (${k.firma})` : ''}`, [k], k.lead));
  const rang = (s: LeadStatus) => ['qualifizierung', 'im_gespraech', 'kontaktiert', 'sql', 'neu', 'kunde', 'ruht', 'kein_fit'].indexOf(s);
  return raus.sort((a, b) => rang(a.status) - rang(b.status) || (b.letzterKontakt ?? '').localeCompare(a.letzterKontakt ?? '') || a.name.localeCompare(b.name));
}

export interface Trichter {
  stufen: { id: string; label: string; anzahl: number; wert?: number; ebene: 1 | 2 | 3; ziel: { s: string; a?: string } }[];
  /** Umwandlung: aus „im Gespräch“ wird SQL, aus SQL wird gewonnen (nur, wo es schon Fälle gibt). */
  gespraechZuSql: number | null; sqlZuGewonnen: number | null;
}

/** Der Trichter über alle drei Ebenen — für die Leiste oben im Sales. */
export function trichter(zeilen: LeadZeile[], crm: CrmBestand): Trichter {
  const n = (s: LeadStatus) => zeilen.filter(z => z.status === s).length;
  const offen = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const gewonnen = crm.chancen.filter(c => c.stufe === 'gewonnen');
  const verloren = crm.chancen.filter(c => c.stufe === 'verloren');
  const sqlJe = zeilen.filter(z => z.status === 'sql' || z.status === 'kunde' || z.sqlAm).length;
  const warenImGespraech = sqlJe + n('im_gespraech') + n('qualifizierung');
  return {
    stufen: [
      { id: 'kontaktiert', label: 'Kontaktiert', anzahl: n('kontaktiert'), ebene: 1, ziel: { s: 'sales', a: 'leads' } },
      { id: 'im_gespraech', label: 'Im Gespräch', anzahl: n('im_gespraech'), ebene: 1, ziel: { s: 'sales', a: 'leads' } },
      { id: 'qualifizierung', label: 'Qualifizierung', anzahl: n('qualifizierung'), ebene: 1, ziel: { s: 'sales', a: 'leads' } },
      { id: 'deals', label: 'Deals offen', anzahl: offen.length, wert: Math.round(offen.reduce((a, c) => a + gesamtwert(c), 0)), ebene: 2, ziel: { s: 'sales', a: 'pipeline' } },
      { id: 'gewonnen', label: 'Gewonnen', anzahl: gewonnen.length, ebene: 2, ziel: { s: 'sales', a: 'pipeline' } },
      { id: 'kunden', label: 'Kunden', anzahl: crm.mandate.filter(m => m.status === 'aktiv').length, ebene: 3, ziel: { s: 'sales', a: 'kunden' } },
    ],
    gespraechZuSql: warenImGespraech >= 3 ? Math.round((sqlJe / warenImGespraech) * 100) : null,
    sqlZuGewonnen: gewonnen.length + verloren.length >= 3 ? Math.round((gewonnen.length / (gewonnen.length + verloren.length)) * 100) : null,
  };
}

/** Der Deal, der aus einem SQL entsteht — Kernfragen, Personen und Firma wandern mit. */
export function dealAusLead(z: LeadZeile, e: { id: string; titel: string; art: Chance['art']; betrag: number; basis: 'monat' | 'einmalig'; schritt: { text: string; datum: string }; erwartetAm?: string; besitzer: string; jetzt: string; kontaktIds?: string[] }): Chance {
  const firmaName = z.art === 'firma' ? z.name : undefined;
  return {
    id: e.id, titel: e.titel.trim() || z.name, kontaktIds: (e.kontaktIds?.length ? e.kontaktIds : z.personen.map(p => p.id)).slice(0, 20),
    ...(firmaName ? { firma: firmaName } : {}), art: e.art, wert: { betrag: Math.max(0, e.betrag), basis: e.basis },
    stufe: 'qualifiziert', historie: [{ stufe: 'qualifiziert', am: e.jetzt, von: '' }],
    naechsterSchritt: e.schritt, qualifizierung: z.kriterien, ...(e.erwartetAm ? { erwartetAm: e.erwartetAm } : {}),
    gesellschaft: 'offen', besitzer: e.besitzer, angelegt: e.jetzt, geaendert: e.jetzt, letzteAktivitaet: e.jetzt.slice(0, 10),
  };
}
