// ─── Steuertermine, gerechnet statt erinnert ────────────────────────────────
// Der Finanzagent soll Fristen nie aus dem Gedächtnis nennen. Diese Funktion
// rechnet die üblichen Termine für eine Selbstständigkeit aus. Hinweis, keine
// Steuerberatung: ob und wie oft Voranmeldungen/Vorauszahlungen anfallen,
// steht im Bescheid bzw. hängt von der Einstellung ab (monatlich/quartalsweise,
// Dauerfristverlängerung). Fällt ein Termin auf Samstag, Sonntag oder einen
// bundesweiten Feiertag, gilt der nächste Werktag (§ 108 Abs. 3 AO).

export type UstRhythmus = 'monatlich' | 'quartal' | 'keine';
export interface SteuerEinstellung { ust: UstRhythmus; dauerfrist: boolean; estVorauszahlung: boolean; gewstVorauszahlung: boolean }
export const STANDARD_EINSTELLUNG: SteuerEinstellung = { ust: 'quartal', dauerfrist: false, estVorauszahlung: true, gewstVorauszahlung: false };

export interface Termin { datum: string; art: 'ust' | 'est' | 'gewst'; titel: string; hinweis: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (j: number, m: number, t: number) => new Date(Date.UTC(j, m - 1, t, 12));

/** Ostersonntag (Gauß) — für die beweglichen bundesweiten Feiertage. */
function ostern(j: number): Date {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(j, monat, tag);
}

/** Bundesweite gesetzliche Feiertage (ohne landesspezifische). */
export function feiertage(j: number): Set<string> {
  const o = ostern(j);
  const plus = (n: number) => { const x = new Date(o); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
  return new Set([`${j}-01-01`, plus(-2), plus(1), `${j}-05-01`, plus(39), plus(50), `${j}-10-03`, `${j}-12-25`, `${j}-12-26`]);
}

/** Nächster Werktag, falls Wochenende oder bundesweiter Feiertag. */
export function werktag(datum: string): string {
  const d = new Date(`${datum}T12:00:00Z`);
  for (let i = 0; i < 7; i++) {
    const tag = d.getUTCDay();
    if (tag !== 0 && tag !== 6 && !feiertage(d.getUTCFullYear()).has(iso(d))) return iso(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return iso(d);
}

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
    if (e.estVorauszahlung) for (const m of [3, 6, 9, 12]) rein({ datum: werktag(iso(utc(j, m, 10))), art: 'est', titel: `Einkommensteuer-Vorauszahlung Q${m / 3}/${j}`, hinweis: 'Höhe laut letztem Bescheid' });
    if (e.gewstVorauszahlung) for (const m of [2, 5, 8, 11]) rein({ datum: werktag(iso(utc(j, m, 15))), art: 'gewst', titel: `Gewerbesteuer-Vorauszahlung ${m === 2 ? 'Q1' : m === 5 ? 'Q2' : m === 8 ? 'Q3' : 'Q4'}/${j}`, hinweis: 'nur bei Gewerbe, Höhe laut Bescheid der Gemeinde' });
  }
  return raus.sort((a, b) => a.datum.localeCompare(b.datum));
}
