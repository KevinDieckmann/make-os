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
//   · Soli auf die Einkommensteuer erst über der Freigrenze (Vorgabe 2026: 20.350 € Einkommensteuer, Milderungszone 11,9 % — Formel-Prüfung
//     05.10.; vorher fiel er immer weg), Kirchensteuer wird nicht gerechnet.
//   · Gemeinsame Einkommensteuer (finanzplan-5, 05.10.): Gewinn der Selbstständigkeit + Lohneinkünfte in EINER Progression; gezahlt wird nur die
//     Mehrsteuer über der Lohnsteuer (Lohnsteuer ≈ Tarif auf den Lohn allein — sie steckt in der Netto-Tabelle). Ein Verlust mindert so auch die
//     Steuer auf den Lohn (Erstattung); der Rest wandert in den Verlustvortrag (Gewerbesteuer mit eigenem Vortrag). Splitting als Schalter.
//     Ausschüttungen bleiben pauschal (Abgeltungsteuer, lib/finanzen/szenarien.ts), Kirchensteuer wird nicht gerechnet.
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
  /** Einzelunternehmen: Soli auf die Einkommensteuer erst über dieser Freigrenze (Einkommensteuer nach Anrechnung, Vorgabe 2026 20.350 €), darüber gemildert (11,9 % des Überschusses). */
  soliFreigrenze?: number;
  verlustvortrag: boolean;
  zahlweise: Zahlweise;
  /** Kalendermonat der Zahlung (Folgejahr) bzw. des Abschlusses der Vorauszahlungen (1–12). */
  zahlMonat: number;
  /**
   * Einzelunternehmen — EINE Einkommensteuer über Privat + Selbstständigkeit (05.10., Kevin: „Das wird am Ende ja auch zusammen gerechnet
   * und besteuert“): Arbeitslohn brutto je Kalenderjahr, der mit dem Gewinn zusammen versteuert wird (Progression). Die Lohnsteuer darauf
   * steckt schon in der Netto-Tabelle; der Plan rechnet darum nur die MEHRsteuer = Tarif(Gewinn + Lohn) − Tarif(Lohn) (Differenzmethode,
   * die Lohnsteuer gilt als = Tarif auf den Lohn allein). Fehlt oder 0: wie vorher (nur der Gewinn). Der Kern trägt hier die LOHNEINKÜNFTE ein
   * (Arbeitslohn brutto − Werbungskosten-Pauschbetrag je Person, nie unter 0).
   */
  lohn?: Record<number, number>;
  /** Werbungskosten-Pauschbetrag je Gehalt (Vorgabe 2026: 1.230 €) — der Kern zieht ihn je Person ab, bevor er `lohn` füllt. */
  werbungskosten?: number;
  /** Zusammenveranlagung (Splittingtarif: 2 × Tarif der Hälfte, Soli-Freigrenze doppelt) statt Einzelveranlagung. Vorgabe: aus. */
  splitting?: boolean;
  /**
   * Gewinn vor Planbeginn im ersten Planjahr (05.10.: Abschluss Jan–Sep 2026 der Selbstständigkeit) — das Jahr beginnt mit diesem Gewinn,
   * damit die Progression über das ganze Jahr stimmt; die Steuer darauf steht ab dem ersten Planmonat in der Rücklage und wird mit dem
   * Jahr bezahlt. `korr` = Abweichung eines Handwerts auf diese Steuer (Abschluss „Einkommensteuer 2026“), 0 ohne Handwert.
   */
  vorab?: { jahr: number; gewinn: number; korr?: number; bezahlt?: number };
}

/** Steuer eines Jahres auf den bisherigen Gewinn (laufend, kumuliert) nach Abzug des Verlustvortrags. */
export interface JahresSteuer { kst: number; soli: number; gewst: number; est: number; anrechnung: number; summe: number }
const NULL_ST: JahresSteuer = { kst: 0, soli: 0, gewst: 0, est: 0, anrechnung: 0, summe: 0 };

/** Lohneinkünfte eines Jahres (vom Kern schon um den Pauschbetrag gemindert) — 0 ohne Jahr oder ohne Lohn. */
export function lohnEinkuenfte(p: Pick<Steuerparameter, 'lohn'>, jahr: number | undefined): number {
  if (jahr === undefined) return 0;
  const l = p.lohn?.[jahr];
  return typeof l === 'number' && Number.isFinite(l) ? Math.max(0, l) : 0;
}

/**
 * Die Steuer eines Jahres auf `gewinn` (Summe des Jahres bis jetzt) bei `vortrag` Verlustvortrag aus den Vorjahren. `jahr` (Kalenderjahr)
 * braucht nur die gemeinsame Einkommensteuer (Lohn des Jahres); `vortragGewerbe` = eigener Gewerbesteuer-Vortrag (Vorgabe: derselbe).
 */
export function jahresSteuer(p: Steuerparameter, gewinn: number, vortrag = 0, jahr?: number, vortragGewerbe = vortrag): JahresSteuer {
  const lohnEink = p.form === 'einzel' ? lohnEinkuenfte(p, jahr) : 0;
  if (p.form === 'einzel' && (lohnEink > 0 || p.splitting)) return jahresSteuerGemeinsam(p, gewinn, vortrag, vortragGewerbe, lohnEink);
  const basis = Math.max(0, gewinn - (p.verlustvortrag ? Math.max(0, vortrag) : 0));
  if (basis <= 0) return NULL_ST;
  const heb = Math.max(0, p.hebesatz) / 100;
  if (p.form === 'kapital') {
    const kst = p.kstAn ? p.kst * basis : 0;
    const soli = p.kstAn && p.soliAn ? p.soli * kst : 0;
    const gewst = p.gewstAn ? p.messzahl * heb * basis : 0;
    return { kst, soli, gewst, est: 0, anrechnung: 0, summe: kst + soli + gewst };
  }
  // Gewerbesteuer mit ihrem EIGENEN Verlustvortrag (Gegenprüfung 05.10., Fund 7): auf ein Jahr MIT Lohn kann eines ohne Lohn folgen — dann ist der
  // Einkommensteuer-Vortrag schon mit dem Lohn verrechnet, der Gewerbeertrag aber nicht. Ohne Lohn in allen Jahren sind beide Vorträge gleich.
  const basisGew = Math.max(0, gewinn - (p.verlustvortrag ? Math.max(0, vortragGewerbe) : 0));
  const messbetrag = p.gewstAn ? p.messzahl * Math.max(0, basisGew - Math.max(0, p.freibetrag)) : 0;
  const gewst = messbetrag * heb;
  const est = p.estAn ? estTarif(Math.max(0, basis - Math.max(0, p.estAbzug)), p.tarif) : 0;
  // § 35 EStG: Ermäßigungshöchstbetrag = ESt × gewerbliche / alle positiven Einkünfte — hier nur gewerbliche Einkünfte, also die ganze ESt.
  const anrechnung = Math.min(Math.max(0, p.anrechnung) * messbetrag, gewst, est);
  // Soli auf die festzusetzende Einkommensteuer (nach Anrechnung): 0 bis zur Freigrenze, dann höchstens 11,9 % des Überschusses (Milderungszone).
  const estNach = est - anrechnung, grenze = Math.max(0, p.soliFreigrenze ?? STEUER_VORGABE.soliFreigrenze);
  const soli = p.soliAn && estNach > grenze ? Math.min(p.soli * estNach, STEUER_VORGABE.soliMilderung * (estNach - grenze)) : 0;
  return { kst: 0, soli, gewst, est, anrechnung, summe: soli > 0 ? gewst + est - anrechnung + soli : gewst + est - anrechnung };
}

/**
 * Gemeinsame Einkommensteuer (05.10.): Gewinn der Selbstständigkeit + Lohneinkünfte des Jahres, EINE Progression. Weil die Lohnsteuer schon in
 * der Netto-Tabelle steckt, zählt nur die Mehrsteuer: ESt = Tarif(Gewinn + Lohn − Vortrag − Abzüge) − Tarif(Lohn − Abzüge). Ein Verlust der
 * Selbstständigkeit mindert so auch die Steuer auf den Lohn (Verlustausgleich → Erstattung, ESt negativ). Gewerbesteuer nur auf den Gewinn
 * (eigener Vortrag), Anrechnung § 35 höchstens der Ermäßigungshöchstbetrag (ESt × Gewinn / Summe der Einkünfte), die Gewerbesteuer und Faktor ×
 * Messbetrag; Soli = Soli(gesamt nach Anrechnung) − Soli(Lohn allein).
 */
function jahresSteuerGemeinsam(p: Steuerparameter, gewinn: number, vortrag: number, vortragGewerbe: number, lohnEink: number): JahresSteuer {
  const v = p.verlustvortrag ? Math.max(0, vortrag) : 0, vg = p.verlustvortrag ? Math.max(0, vortragGewerbe) : 0;
  const heb = Math.max(0, p.hebesatz) / 100;
  const messbetrag = p.gewstAn ? p.messzahl * Math.max(0, Math.max(0, gewinn - vg) - Math.max(0, p.freibetrag)) : 0;
  const gewst = messbetrag * heb;
  const tarif = (x: number): number => (p.splitting ? 2 * estTarif(x / 2, p.tarif) : estTarif(x, p.tarif));
  const abzug = Math.max(0, p.estAbzug);
  const estGesamt = p.estAn ? tarif(Math.max(0, gewinn - v + lohnEink - abzug)) : 0;
  const estLohn = p.estAn ? tarif(Math.max(0, lohnEink - abzug)) : 0;
  const est = estGesamt - estLohn;
  // § 35 EStG (Gegenprüfung 05.10., Fund 8): höchstens der Ermäßigungshöchstbetrag = tarifliche ESt × positive gewerbliche Einkünfte / Summe der
  // positiven Einkünfte (Gewinn + Lohneinkünfte, vor Verlustabzug), dazu höchstens die tatsächliche Gewerbesteuer und Faktor × Messbetrag.
  // Vorher: höchstens die Mehrsteuer — zu hoch, sobald Vorsorge/Sonderausgaben den Lohn steuerfrei machen.
  const gPos = Math.max(0, gewinn), lPos = Math.max(0, lohnEink);
  const hoechstbetrag = gPos > 0 ? estGesamt * gPos / (gPos + lPos) : 0;
  const anrechnung = Math.min(Math.max(0, p.anrechnung) * messbetrag, gewst, hoechstbetrag);
  const grenze = Math.max(0, p.soliFreigrenze ?? STEUER_VORGABE.soliFreigrenze) * (p.splitting ? 2 : 1);
  const soliVon = (x: number): number => (p.soliAn && x > grenze ? Math.min(p.soli * x, STEUER_VORGABE.soliMilderung * (x - grenze)) : 0);
  const soli = soliVon(estGesamt - anrechnung) - soliVon(estLohn);
  return { kst: 0, soli, gewst, est, anrechnung, summe: gewst + est - anrechnung + soli };
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
 * Handwerte (04.10., Kevin: „jede Zahl bearbeitbar, nur die Formeln bleiben fest“): Der Rechenkern reicht je Monat eine Funktion
 * herein, die zu einem gerechneten Wert den Handwert liefert (oder den gerechneten zurück). Überschreibbar sind der Aufwand je
 * Steuerart, die Zahlung und der Verlustvortrag des laufenden Jahres. Ein geänderter Aufwand zählt in die Jahressteuer (Rücklage und
 * Zahlung im Folgejahr), eine geänderte Zahlung in das Gezahlte (Rücklage). Ohne Handwert rechnet der Rechner bit-genau wie vorher.
 */
export type SteuerHandFeld = 'kst' | 'soli' | 'gewst' | 'est' | 'anrechnung' | 'steuer' | 'verlustvortrag';
export type SteuerHand = (feld: SteuerHandFeld, gerechnet: number) => number;

/**
 * Ein Kalenderjahr, wie der Steuerrechner es abschließt (Gegenprüfung 05.10., Fund 12): Gewinn des Jahres (das erste Planjahr inkl. `vorab`),
 * Verlustvorträge zu Beginn (Einkommen-/Gewerbesteuer, mit Handwert), die Jahressteuer nach Formel (`js`), die Summe der Handwert-Abweichungen
 * (`korr`, inkl. `vorab.korr`), die Steuer des Jahres (`steuer` = js.summe + korr — genau das, was Rücklage und Zahlung tragen) und das darauf
 * schon Vorausgezahlte. Das laufende (letzte) Jahr steht mit dem Stand nach dem letzten Monat darin.
 */
export interface SteuerJahr { jahr: number; gewinn: number; vorab: number; vortrag: number; vortragGewerbe: number; js: JahresSteuer; korr: number; steuer: number; vorausgezahlt: number }
export type Steuerrechner = ((m: number, gewinn: number, hand?: SteuerHand) => SteuerMonat) & { jahre: () => SteuerJahr[] };

/**
 * Ein Steuerrechner für EINE Gesellschaft: Monat für Monat mit dem Gewinn vor Steuern füttern (m = Plan-Monat ab 1,
 * `jahr(m)`/`kal(m)` = Kalenderjahr bzw. -monat dazu). Zahlung hängt nur an Gewinnen bis zum Vormonat des Zahlmonats, Rücklage
 * und Aufwand an den Gewinnen bis einschließlich dieses Monats — darum reicht ein Durchlauf im Rechenkern.
 * `hand` (optional): Handwerte dieses Monats (siehe `SteuerHand`).
 */
export function neuerSteuerrechner(p: Steuerparameter, jahr: (m: number) => number, kal: (m: number) => number): Steuerrechner {
  let aktJahr = Number.NaN, ytd = 0, vortrag = 0, letzteSteuer: JahresSteuer = NULL_ST;
  /** Gewerbesteuer-Verlustvortrag (05.10.): getrennt, weil ein Verlust bei der gemeinsamen Einkommensteuer auch den Lohn mindert, beim Gewerbeertrag nicht. Ohne Lohn = `vortrag`. */
  let vortragGew = 0, vorjahrVortragGewNachher = 0;
  /** Summe der Handwert-Abweichungen beim Aufwand im laufenden Jahr — geht in die Jahressteuer (Rücklage, Zahlung im Folgejahr). */
  let korrJahr = 0;
  /** Davon schon mit den Vorauszahlungen je Quartal bezahlt (04.10. Nachtrag, Kevin: „Vorauszahlungen wandern mit“). */
  let korrVoraus = 0;
  // Je abgeschlossenem Jahr: die endgültige Steuer und die darauf schon gezahlten Vorauszahlungen.
  const fertig = new Map<number, { steuer: number; vorausgezahlt: number }>();
  let gezahltGesamt = 0, aufgelaufenFertig = 0;
  let vorjahrVortragNachher = 0;
  /** Abgeschlossene Jahre (für `jahre()`) und der Gewinn vor Planbeginn des laufenden Jahres. */
  const abgeschlossen: SteuerJahr[] = [];
  let vorabJahr = 0;
  const jahrJetzt = (): SteuerJahr => {
    const js = jahresSteuer(p, ytd, vortrag, aktJahr, vortragGew);
    return { jahr: aktJahr, gewinn: ytd, vorab: vorabJahr, vortrag, vortragGewerbe: vortragGew, js, korr: korrJahr, steuer: js.summe + korrJahr, vorausgezahlt: fertig.get(aktJahr)?.vorausgezahlt ?? 0 };
  };
  const rechner = (m: number, gewinn: number, hand?: SteuerHand): SteuerMonat => {
    const j = jahr(m), mo = kal(m);
    if (j !== aktJahr) {
      if (!Number.isNaN(aktJahr)) {
        abgeschlossen.push(jahrJetzt());
        // Jahreswechsel: das Jahr abschließen (mit den Handwerten des Jahres), Verlustvortrag fortschreiben.
        let s = jahresSteuer(p, ytd, vortrag, aktJahr, vortragGew).summe;
        if (korrJahr !== 0) s += korrJahr;
        fertig.set(aktJahr, { steuer: s, vorausgezahlt: fertig.get(aktJahr)?.vorausgezahlt ?? 0 });
        aufgelaufenFertig += s;
        // Gemeinsame Einkommensteuer: ein Verlust wird erst mit dem Lohn des Jahres verrechnet, nur der Rest wandert ins Folgejahr (ohne Lohn wie vorher).
        vorjahrVortragNachher = p.verlustvortrag ? Math.max(0, vortrag - (ytd + (p.form === 'einzel' ? lohnEinkuenfte(p, aktJahr) : 0))) : 0;
        vorjahrVortragGewNachher = p.verlustvortrag ? Math.max(0, vortragGew - ytd) : 0;
      }
      aktJahr = j; ytd = 0; vortrag = vorjahrVortragNachher; vortragGew = vorjahrVortragGewNachher; letzteSteuer = NULL_ST; korrJahr = 0; korrVoraus = 0; vorabJahr = 0;
      // Gewinn vor Planbeginn (Abschluss Jan–Sep): das Jahr beginnt damit — Progression über das ganze Jahr, die Steuer darauf steht sofort in
      // der Rücklage (über `jetzt.summe`), der Aufwand der Planmonate ist nur der Zuwachs.
      if (p.vorab && p.vorab.jahr === j && Number.isFinite(p.vorab.gewinn)) {
        ytd = p.vorab.gewinn; vorabJahr = p.vorab.gewinn;
        letzteSteuer = jahresSteuer(p, ytd, vortrag, j, vortragGew);
        if (p.vorab.korr && Number.isFinite(p.vorab.korr)) korrJahr = p.vorab.korr;
        // Vor Planbeginn schon bezahlte Vorauszahlungen dieses Jahres: mindern Rücklage und Abschlusszahlung (gezahlt, aber nicht aus dem Plan-Konto).
        const b = p.vorab.bezahlt;
        if (b && Number.isFinite(b) && b > 0) { gezahltGesamt += b; const f = fertig.get(j) ?? { steuer: 0, vorausgezahlt: 0 }; fertig.set(j, { ...f, vorausgezahlt: f.vorausgezahlt + b }); }
      }
    }
    // Verlustvortrag von Hand: gilt ab diesem Monat für das laufende Jahr (die Steuer des Jahres wird damit neu bemessen).
    if (hand) { const v = hand('verlustvortrag', vortrag); if (v !== vortrag && Number.isFinite(v)) { vortrag = Math.max(0, v); vortragGew = vortrag; } }
    const vorher = letzteSteuer;
    ytd += gewinn;
    const jetzt = jahresSteuer(p, ytd, vortrag, j, vortragGew);
    letzteSteuer = jetzt;

    // Zahlung
    let zahlung = 0;
    const vj = fertig.get(j - 1);
    // Vorauszahlung je Quartal = ein Viertel der Vorjahressteuer; ein Steuer-Aufwand von Hand im laufenden Jahr wandert mit der nächsten
    // Vorauszahlung mit (Nachholung `nach`, nie unter null — der Rest kommt mit dem Abschluss). Ohne Handwert genau wie vorher.
    const nach = p.zahlweise === 'quartal' && mo % 3 === 0 ? korrJahr - korrVoraus : 0;
    if (p.zahlweise === 'quartal') {
      if (mo % 3 === 0 && (vj || nach !== 0)) {
        let q = vj ? vj.steuer / 4 : 0;
        if (nach !== 0) { q = Math.max(0, q + nach); korrVoraus = korrJahr; }
        zahlung += q; const f = fertig.get(j) ?? { steuer: 0, vorausgezahlt: 0 }; fertig.set(j, { ...f, vorausgezahlt: f.vorausgezahlt + q });
      }
      if (mo === p.zahlMonat && vj) {
        // Abschluss des Vorjahres: Steuer abzüglich der Vorauszahlungen (kann eine Erstattung sein).
        zahlung += vj.steuer - vj.vorausgezahlt;
      }
    } else if (mo === p.zahlMonat && vj) zahlung += vj.steuer - vj.vorausgezahlt;   // vorausgezahlt: nur vor Planbeginn Bezahltes (`vorab.bezahlt`), sonst 0
    if (hand) {
      const formel = zahlung;
      zahlung = hand('steuer', zahlung);
      // Eine Quartals-Zahlung von Hand zählt als Vorauszahlung des laufenden Jahres — der Abschluss im Folgejahr rechnet damit.
      if (zahlung !== formel && p.zahlweise === 'quartal' && mo % 3 === 0) { const f = fertig.get(j) ?? { steuer: 0, vorausgezahlt: 0 }; fertig.set(j, { ...f, vorausgezahlt: f.vorausgezahlt + (zahlung - formel) }); }
    }
    gezahltGesamt += zahlung;

    let kst = jetzt.kst - vorher.kst, soli = jetzt.soli - vorher.soli, gewst = jetzt.gewst - vorher.gewst, est = jetzt.est - vorher.est;
    let anrechnung = jetzt.anrechnung - vorher.anrechnung, summe = jetzt.summe - vorher.summe;
    if (hand) {
      // Aufwand je Steuerart von Hand: die Abweichung geht in die Summe dieses Monats und in die Jahressteuer.
      const k = hand('kst', kst), s = hand('soli', soli), g = hand('gewst', gewst), e = hand('est', est), a = hand('anrechnung', anrechnung);
      const delta = (k - kst) + (s - soli) + (g - gewst) + (e - est) - (a - anrechnung);
      kst = k; soli = s; gewst = g; est = e; anrechnung = a;
      if (delta !== 0) { summe += delta; korrJahr += delta; }
    }
    const ruecklage = Math.max(0, aufgelaufenFertig + jetzt.summe + korrJahr - gezahltGesamt);
    return { kst, soli, gewst, est, anrechnung, summe, zahlung, ruecklage, verlustvortrag: vortrag };
  };
  // Die Jahre so, wie Rücklage und Zahlung sie tragen — EINE Rechnung für Blatt und Jahresübersicht (keine zweite Formel daneben).
  return Object.assign(rechner, { jahre: (): SteuerJahr[] => (Number.isNaN(aktJahr) ? [...abgeschlossen] : [...abgeschlossen, jahrJetzt()]) });
}

/** Vorgaben der Sätze — aus dem früheren Gesamtsatz so abgeleitet, dass bei unveränderten Eingaben dieselbe Gesamtquote herauskommt. */
export const STEUER_VORGABE = { kst: 0.15, soli: 0.055, messzahl: 0.035, freibetrag: 24500, anrechnung: 4, soliFreigrenze: 20350, soliMilderung: 0.119, werbungskosten: 1230 } as const;

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
