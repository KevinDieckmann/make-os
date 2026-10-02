// ─── Finanzplanung jetzt — Ertragsteuern einzeln gerechnet (rein, getestet) ─────────────────
// Kevin 02.10.: „Steuern einzeln rechnen“ — Körperschaftsteuer, Solidaritätszuschlag auf die KSt und Gewerbesteuer
// (Kapitalgesellschaft) bzw. Einkommensteuer mit Gewerbesteuer-Freibetrag und Anrechnung nach § 35 EStG
// (Einzelunternehmen) statt EINER Ertragsteuer-Quote. Dieses Modul rechnet nur Steuern: es bekommt je Monat den
// Gewinn vor Steuern und liefert Aufwand (zeitanteilig im Jahr des Gewinns), Zahlung (Kasse), Rücklage und Verlustvortrag.
// Alle Sätze und Regeln kommen als `Steuerparameter` herein (Auflösung mit Vorgaben: lib/finanzen/steuern.ts) —
// nichts davon ist im Code festgelegt außer den Vorgabewerten (Kevin: „alles anpassen, damit ich selber spielen kann“).
//
// Näherungen (Hinweis, keine Steuerberatung) — jede steht auch in FINANZPLANUNG_JETZT.md › Kern-Umbau 02.10.:
//   · Bemessungsgrundlage KSt und Gewerbeertrag = Gewinn vor Steuern (keine Hinzurechnungen/Kürzungen, keine Rundung des
//     Messbetrags auf 100 €); die Gewerbesteuer mindert die KSt nicht (seit 2008 nicht abzugsfähig).
//   · Verlustvortrag einfach: ein Verlust mindert den Gewinn der Folgejahre in voller Höhe (die Mindestbesteuerung ab
//     1 Mio. € wird nicht abgebildet); ein Topf für KSt, Gewerbesteuer und Einkommensteuer.
//   · Jedes Kalenderjahr steht für sich; das erste Planjahr zählt nur ab Planbeginn (Okt 26).
//   · Soli auf die Einkommensteuer entfällt (Freigrenze), Kirchensteuer wird nicht gerechnet.
// Der Rechenkern (rechenkern.ts) ruft das über `neuerSteuerrechner` Monat für Monat auf.

export type Rechtsform = 'kapital' | 'einzel';
export type Zahlweise = 'folgejahr' | 'quartal';

/** Eckwerte des Einkommensteuer-Grundtarifs (§ 32a EStG) — alle einstellbar, Vorgabe 2026. */
export interface EstTarif {
  /** Grundfreibetrag: bis hierher 0. */
  grundfreibetrag: number;
  /** Ende der ersten und zweiten Progressionszone sowie der Zone mit dem Spitzensatz. */
  zone2Ende: number; zone3Ende: number; zone4Ende: number;
  /** Zone 1 (Grundfreibetrag bis Zone-2-Ende): (a1 · y + b1) · y mit y = (zvE − Grundfreibetrag) / 10.000. */
  a1: number; b1: number;
  /** Zone 2: (a2 · z + b2) · z + c2 mit z = (zvE − Zone-2-Ende) / 10.000. */
  a2: number; b2: number; c2: number;
  /** Zone 3 und 4: Satz · zvE − Abzug. */
  satz3: number; abzug3: number; satz4: number; abzug4: number;
}
export const TARIF_2026: EstTarif = {
  grundfreibetrag: 12348, zone2Ende: 17799, zone3Ende: 69878, zone4Ende: 277825,
  a1: 914.51, b1: 1400, a2: 173.10, b2: 2397, c2: 1034.87, satz3: 0.42, abzug3: 11135.63, satz4: 0.45, abzug4: 19470.38,
};
export const TARIF_FELDER: { k: keyof EstTarif; label: string; art: 'betrag' | 'koeff' | 'anteil' }[] = [
  { k: 'grundfreibetrag', label: 'Grundfreibetrag €', art: 'betrag' },
  { k: 'zone2Ende', label: 'Ende Zone 1 €', art: 'betrag' }, { k: 'zone3Ende', label: 'Ende Zone 2 (Beginn Spitzensatz) €', art: 'betrag' }, { k: 'zone4Ende', label: 'Beginn Reichensteuer €', art: 'betrag' },
  { k: 'a1', label: 'Zone 1 · Faktor a', art: 'koeff' }, { k: 'b1', label: 'Zone 1 · Faktor b', art: 'koeff' },
  { k: 'a2', label: 'Zone 2 · Faktor a', art: 'koeff' }, { k: 'b2', label: 'Zone 2 · Faktor b', art: 'koeff' }, { k: 'c2', label: 'Zone 2 · Summand c', art: 'koeff' },
  { k: 'satz3', label: 'Spitzensatz', art: 'anteil' }, { k: 'abzug3', label: 'Spitzensatz · Abzug €', art: 'koeff' },
  { k: 'satz4', label: 'Reichensteuer-Satz', art: 'anteil' }, { k: 'abzug4', label: 'Reichensteuer · Abzug €', art: 'koeff' },
];

/** Einkommensteuer nach Grundtarif auf das zu versteuernde Einkommen — mit den Eckwerten `t` (Vorgabe 2026). */
export function estTarif(zve: number, t: EstTarif = TARIF_2026): number {
  const x = Math.floor(Math.max(0, zve));
  if (x <= t.grundfreibetrag) return 0;
  if (x <= t.zone2Ende) { const y = (x - t.grundfreibetrag) / 10000; return Math.floor((t.a1 * y + t.b1) * y); }
  if (x <= t.zone3Ende) { const z = (x - t.zone2Ende) / 10000; return Math.floor((t.a2 * z + t.b2) * z + t.c2); }
  if (x <= t.zone4Ende) return Math.floor(t.satz3 * x - t.abzug3);
  return Math.floor(t.satz4 * x - t.abzug4);
}

/** Alles, was eine Ertragsteuer-Rechnung braucht — aufgelöst (Vorgaben eingesetzt), siehe `steuerParameter` in steuern.ts. */
export interface Steuerparameter {
  form: Rechtsform;
  /** Körperschaftsteuer (nur Kapitalgesellschaft) und Soli auf die KSt als Anteil (0,15 / 0,055). */
  kstAn: boolean; kst: number; soliAn: boolean; soli: number;
  /** Gewerbesteuer: Messzahl (0,035) × Hebesatz in Prozent (400). */
  gewstAn: boolean; messzahl: number; hebesatz: number;
  /** Einkommensteuer (nur Einzelunternehmen). */
  estAn: boolean; tarif: EstTarif;
  /** Abzüge vom Gewinn vor der Einkommensteuer je Jahr (Vorsorge, Sonderausgaben). */
  estAbzug: number;
  /** Gewerbesteuer-Freibetrag auf den Gewerbeertrag (Einzelunternehmen, 24.500 €). */
  freibetrag: number;
  /** Anrechnung der Gewerbesteuer auf die Einkommensteuer, § 35 EStG: Faktor × Messbetrag (4,0), höchstens Gewerbesteuer und Einkommensteuer; 0 = keine. */
  anrechnung: number;
  verlustvortrag: boolean;
  zahlweise: Zahlweise;
  /** Kalendermonat der Zahlung (Folgejahr) bzw. des Abschlusses der Vorauszahlungen (1–12). */
  zahlMonat: number;
}

/** Steuer eines Jahres auf den bisherigen Gewinn (laufend, kumuliert) nach Abzug des Verlustvortrags. */
export interface JahresSteuer { kst: number; soli: number; gewst: number; est: number; anrechnung: number; summe: number }
const NULL_ST: JahresSteuer = { kst: 0, soli: 0, gewst: 0, est: 0, anrechnung: 0, summe: 0 };

/** Die Steuer eines Jahres auf `gewinn` (Summe des Jahres bis jetzt) bei `vortrag` Verlustvortrag aus den Vorjahren. */
export function jahresSteuer(p: Steuerparameter, gewinn: number, vortrag = 0): JahresSteuer {
  const basis = Math.max(0, gewinn - (p.verlustvortrag ? Math.max(0, vortrag) : 0));
  if (basis <= 0) return NULL_ST;
  const heb = Math.max(0, p.hebesatz) / 100;
  if (p.form === 'kapital') {
    const kst = p.kstAn ? p.kst * basis : 0;
    const soli = p.kstAn && p.soliAn ? p.soli * kst : 0;
    const gewst = p.gewstAn ? p.messzahl * heb * basis : 0;
    return { kst, soli, gewst, est: 0, anrechnung: 0, summe: kst + soli + gewst };
  }
  const messbetrag = p.gewstAn ? p.messzahl * Math.max(0, basis - Math.max(0, p.freibetrag)) : 0;
  const gewst = messbetrag * heb;
  const est = p.estAn ? estTarif(Math.max(0, basis - Math.max(0, p.estAbzug)), p.tarif) : 0;
  const anrechnung = Math.min(Math.max(0, p.anrechnung) * messbetrag, gewst, est);
  return { kst: 0, soli: 0, gewst, est, anrechnung, summe: gewst + est - anrechnung };
}

/** Was in einem Monat steuerlich passiert. */
export interface SteuerMonat extends JahresSteuer {
  /** (kst, soli, gewst, est, anrechnung, summe = Aufwand dieses Monats je Steuerart: Zuwachs der Jahressteuer, positiv = Belastung.) */
  /** Zahlung dieses Monats (Kasse); negativ = Erstattung aus zu viel gezahlten Vorauszahlungen. */
  zahlung: number;
  /** Noch nicht gezahlte Steuer (aufgelaufen minus gezahlt), nie unter null. */
  ruecklage: number;
  /** Verlustvortrag, der zu Beginn dieses Kalenderjahres galt. */
  verlustvortrag: number;
}

/**
 * Ein Steuerrechner für EINE Gesellschaft: Monat für Monat mit dem Gewinn vor Steuern füttern (m = Plan-Monat ab 1,
 * `jahr(m)`/`kal(m)` = Kalenderjahr bzw. -monat dazu). Zahlung hängt nur an Gewinnen bis zum Vormonat des Zahlmonats, Rücklage
 * und Aufwand an den Gewinnen bis einschließlich dieses Monats — darum reicht ein Durchlauf im Rechenkern.
 */
export function neuerSteuerrechner(p: Steuerparameter, jahr: (m: number) => number, kal: (m: number) => number): (m: number, gewinn: number) => SteuerMonat {
  let aktJahr = Number.NaN, ytd = 0, vortrag = 0, letzteSteuer: JahresSteuer = NULL_ST;
  // Je abgeschlossenem Jahr: die endgültige Steuer und die darauf schon gezahlten Vorauszahlungen.
  const fertig = new Map<number, { steuer: number; vorausgezahlt: number }>();
  let gezahltGesamt = 0, aufgelaufenFertig = 0;
  let vorjahrVortragNachher = 0;
  return (m, gewinn) => {
    const j = jahr(m), mo = kal(m);
    if (j !== aktJahr) {
      if (!Number.isNaN(aktJahr)) {
        // Jahreswechsel: das Jahr abschließen, Verlustvortrag fortschreiben.
        const s = jahresSteuer(p, ytd, vortrag).summe;
        fertig.set(aktJahr, { steuer: s, vorausgezahlt: fertig.get(aktJahr)?.vorausgezahlt ?? 0 });
        aufgelaufenFertig += s;
        vorjahrVortragNachher = p.verlustvortrag ? Math.max(0, vortrag - ytd) : 0;
      }
      aktJahr = j; ytd = 0; vortrag = vorjahrVortragNachher; letzteSteuer = NULL_ST;
    }
    const vorher = letzteSteuer;
    ytd += gewinn;
    const jetzt = jahresSteuer(p, ytd, vortrag);
    letzteSteuer = jetzt;

    // Zahlung
    let zahlung = 0;
    const vj = fertig.get(j - 1);
    if (p.zahlweise === 'quartal') {
      if (mo % 3 === 0 && vj) { const q = vj.steuer / 4; zahlung += q; const f = fertig.get(j) ?? { steuer: 0, vorausgezahlt: 0 }; fertig.set(j, { ...f, vorausgezahlt: f.vorausgezahlt + q }); }
      if (mo === p.zahlMonat && vj) {
        // Abschluss des Vorjahres: Steuer abzüglich der Vorauszahlungen (kann eine Erstattung sein).
        zahlung += vj.steuer - vj.vorausgezahlt;
      }
    } else if (mo === p.zahlMonat && vj) zahlung += vj.steuer;
    gezahltGesamt += zahlung;

    const ruecklage = Math.max(0, aufgelaufenFertig + jetzt.summe - gezahltGesamt);
    return {
      kst: jetzt.kst - vorher.kst, soli: jetzt.soli - vorher.soli, gewst: jetzt.gewst - vorher.gewst, est: jetzt.est - vorher.est,
      anrechnung: jetzt.anrechnung - vorher.anrechnung, summe: jetzt.summe - vorher.summe,
      zahlung, ruecklage, verlustvortrag: vortrag,
    };
  };
}

/** Vorgaben der Sätze — aus dem früheren Gesamtsatz so abgeleitet, dass bei unveränderten Eingaben dieselbe Gesamtquote herauskommt. */
export const STEUER_VORGABE = { kst: 0.15, soli: 0.055, messzahl: 0.035, freibetrag: 24500, anrechnung: 4 } as const;

/**
 * Aufteilung eines Gesamtsatzes (Anteil am Gewinn, z. B. 0,3) in KSt + Soli + Gewerbesteuer-Hebesatz: KSt, Soli und Messzahl in
 * der Vorgabe, der Hebesatz ist der Rest. Reicht der Gesamtsatz nicht einmal für KSt + Soli, schrumpft die KSt und der Hebesatz ist 0 —
 * die Summe ergibt immer genau den Gesamtsatz.
 */
export function aufteilen(gesamt: number): { kst: number; soli: number; messzahl: number; hebesatz: number } {
  const g = Math.max(0, Number.isFinite(gesamt) ? gesamt : 0);
  const { kst, soli, messzahl } = STEUER_VORGABE;
  const grund = kst * (1 + soli);
  if (g >= grund) return { kst, soli, messzahl, hebesatz: ((g - grund) / messzahl) * 100 };
  return { kst: g / (1 + soli), soli, messzahl, hebesatz: 0 };
}
/** Gesamtquote einer Kapitalgesellschaft aus den Sätzen (zur Anzeige und für Tests). */
export const gesamtquote = (p: Pick<Steuerparameter, 'kstAn' | 'kst' | 'soliAn' | 'soli' | 'gewstAn' | 'messzahl' | 'hebesatz'>): number =>
  (p.kstAn ? p.kst * (1 + (p.soliAn ? p.soli : 0)) : 0) + (p.gewstAn ? p.messzahl * (p.hebesatz / 100) : 0);
