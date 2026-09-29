// ─── Steuertermine, gerechnet statt erinnert ────────────────────────────────
// Der Finanzagent soll Fristen nie aus dem Gedächtnis nennen. Diese Funktion
// rechnet die üblichen Termine für eine Selbstständigkeit aus. Hinweis, keine
// Steuerberatung: ob und wie oft Voranmeldungen/Vorauszahlungen anfallen,
// steht im Bescheid bzw. hängt von der Einstellung ab (monatlich/quartalsweise,
// Dauerfristverlängerung). Fällt ein Termin auf Samstag, Sonntag oder einen
// gesetzlichen Feiertag, gilt der nächste Werktag (§ 108 Abs. 3 AO). Maßgeblich
// ist der Feiertag am Sitz des Finanzamts — also NRW (29.09., K2: vorher nur
// bundesweit; Fronleichnam und Allerheiligen fehlten). Rechnung: Kalender-Kern.

import { feiertageNRW, werktagAbOder } from '@/lib/zeit/kalender-kern';

export type UstRhythmus = 'monatlich' | 'quartal' | 'keine';
export interface SteuerEinstellung {
  ust: UstRhythmus; dauerfrist: boolean; estVorauszahlung: boolean; gewstVorauszahlung: boolean;
  /** Körperschaftsteuer-Vorauszahlungen einer UG/GmbH (gleiche Termine wie ESt, § 31 KStG). */
  kstVorauszahlung?: boolean;
}
export const STANDARD_EINSTELLUNG: SteuerEinstellung = { ust: 'quartal', dauerfrist: false, estVorauszahlung: true, gewstVorauszahlung: false };

export interface Termin { datum: string; art: 'ust' | 'ust-sv' | 'est' | 'kst' | 'gewst'; titel: string; hinweis: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (j: number, m: number, t: number) => new Date(Date.UTC(j, m - 1, t, 12));

/** Gesetzliche Feiertage NRW eines Jahres (Kalender-Kern, eine Rechnung). */
export function feiertage(j: number): Set<string> {
  return new Set(feiertageNRW(j).map(f => f.tag));
}

/** Nächster Werktag (Mo–Fr ohne Feiertag NRW), falls Wochenende oder Feiertag. */
export const werktag = (datum: string): string => werktagAbOder(datum);

/** Die Termine im Fenster [von, bis]. */
export function steuertermine(von: string, bis: string, e: SteuerEinstellung = STANDARD_EINSTELLUNG): Termin[] {
  const raus: Termin[] = [];
  const jv = Number(von.slice(0, 4)), jb = Number(bis.slice(0, 4));
  const rein = (t: Termin) => { if (t.datum >= von && t.datum <= bis) raus.push(t); };
  for (let j = jv; j <= jb + 1; j++) {
    for (let m = 1; m <= 12; m++) {
      // USt-Voranmeldung: 10. des Folgemonats (bzw. nach Quartalsende); Dauerfristverlängerung + 1 Monat
      const monatlich = e.ust === 'monatlich', quartal = e.ust === 'quartal' && m % 3 === 0;
      if (monatlich || quartal) {
        const faellig = new Date(Date.UTC(j, m + (e.dauerfrist ? 1 : 0), 10, 12));
        const zeitraum = monatlich ? `${String(m).padStart(2, '0')}/${j}` : `Q${m / 3}/${j}`;
        rein({ datum: werktag(iso(faellig)), art: 'ust', titel: `Umsatzsteuer-Voranmeldung ${zeitraum}`, hinweis: `Anmeldung und Zahlung${e.dauerfrist ? ' (mit Dauerfristverlängerung)' : ''}` });
      }
    }
    // Monatszahler mit Dauerfristverlängerung: Sondervorauszahlung (1/11 der Vorjahressumme) bis 10.02.
    if (e.ust === 'monatlich' && e.dauerfrist) rein({ datum: werktag(iso(utc(j, 2, 10))), art: 'ust-sv', titel: `Umsatzsteuer-Sondervorauszahlung ${j}`, hinweis: '1/11 der Vorjahres-Vorauszahlungen, wird mit der Dezember-Anmeldung verrechnet' });
    if (e.kstVorauszahlung) for (const m of [3, 6, 9, 12]) rein({ datum: werktag(iso(utc(j, m, 10))), art: 'kst', titel: `Körperschaftsteuer-Vorauszahlung Q${m / 3}/${j}`, hinweis: 'UG/GmbH, Höhe laut Bescheid' });
    if (e.estVorauszahlung) for (const m of [3, 6, 9, 12]) rein({ datum: werktag(iso(utc(j, m, 10))), art: 'est', titel: `Einkommensteuer-Vorauszahlung Q${m / 3}/${j}`, hinweis: 'Höhe laut letztem Bescheid' });
    if (e.gewstVorauszahlung) for (const m of [2, 5, 8, 11]) rein({ datum: werktag(iso(utc(j, m, 15))), art: 'gewst', titel: `Gewerbesteuer-Vorauszahlung ${m === 2 ? 'Q1' : m === 5 ? 'Q2' : m === 8 ? 'Q3' : 'Q4'}/${j}`, hinweis: 'nur bei Gewerbe, Höhe laut Bescheid der Gemeinde' });
  }
  return raus.sort((a, b) => a.datum.localeCompare(b.datum));
}
