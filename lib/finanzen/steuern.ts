// ─── Finanzplanung jetzt — Welche Steuern gelten? (rein, getestet) ───────────
// Kevin 02.10.: „Unten stehen so viele Steuern, die wir nicht brauchen.“ Jede Gesellschaft bekommt ein Steuerprofil:
// die Rechtsform bestimmt, welche Steuerzeilen überhaupt vorkommen (Kapitalgesellschaft: Körperschaftsteuer + Soli,
// Gewerbesteuer mit Hebesatz · Einzelunternehmen: Einkommensteuer mit Gewerbesteuer-Freibetrag und Anrechnung ·
// Privat: Netto-Tabelle) — alles Weitere erscheint nicht.
//
// KERN-UMBAU 02.10. (Kevin entschied am 02.10. ausdrücklich, den Rechenkern zu ändern): Der Kern rechnet die Ertragsteuern
// jetzt EINZELN (lib/finanzen/ertragsteuer.ts) und liest dafür dieses Profil über `steuerParameter()`. Jeder Wert ist
// ein editierbares Feld mit Vorgabe — leer heißt „Vorgabe“. Die Vorgabe des Hebesatzes wird aus dem früheren Gesamtsatz
// (`annahmen.steuerUG`) abgeleitet, damit bei unveränderten Eingaben dieselbe Gesamtquote herauskommt.
// Die Profile gelten je Gesellschaft (`d.steuern`) und lassen sich je Szenario überlagern (`PlanAnnahmen.steuern`,
// Auflösung mit `steuernMit`). Ein Dokument ohne `steuern` rechnet mit den Vorgaben.
// Steuern sind Näherungen — Hinweis, keine Steuerberatung.

import { finanzOrtName, type FinanzOrt } from '@/lib/einheiten';
import type { FinanzDaten } from './rechenkern';
import type { Operation } from './plan/operationen';
import {
  STEUER_VORGABE, TARIF_2026, TARIF_FELDER, aufteilen, type EstTarif, type Rechtsform, type Steuerparameter, type Zahlweise,
} from './ertragsteuer';

export type { Rechtsform, Zahlweise } from './ertragsteuer';
export type SteuerArt = 'kst' | 'soli' | 'gewst' | 'est' | 'ust' | 'exit' | 'netto' | 'ausschuettung';

export interface SteuerZeileEin { an?: boolean; satz?: number; hebesatz?: number }
/** Regeln und Eckwerte je Gesellschaft — alles optional, leer = Vorgabe. */
export interface SteuerParamEin {
  /** Verlust mindert die Folgejahre (Vorgabe: ja). */
  verlustvortrag?: boolean;
  /** Zahlung im Folgejahr oder Vorauszahlungen je Quartal (Vorgabe: Folgejahr). */
  zahlweise?: Zahlweise;
  /** Kalendermonat der Zahlung bzw. des Abschlusses (Vorgabe: `annahmen.steuerMonat`). */
  zahlMonat?: number;
  /** Gewerbesteuer-Freibetrag auf den Gewerbeertrag, Einzelunternehmen (Vorgabe 24.500 €). */
  freibetrag?: number;
  /** Faktor auf den Gewerbesteuer-Messbetrag für die Anrechnung (§ 35 EStG, Vorgabe 4,0; 0 = keine Anrechnung). */
  anrechnung?: number;
  /** Einzelunternehmen: Soli-Freigrenze auf die Einkommensteuer (Vorgabe 2026: 20.350 €). */
  soliFreigrenze?: number;
  /** Eckwerte des Einkommensteuer-Tarifs (Vorgabe 2026). */
  tarif?: Partial<EstTarif>;
  /**
   * Gemeinsame Einkommensteuer (05.10., Kevin: Selbstständigkeit und Privat „werden am Ende zusammen gerechnet und besteuert“): Gehälter in
   * die Progression einbeziehen (Vorgabe: ja). Aus = wie bis 05.10. (nur der Gewinn der Selbstständigkeit).
   */
  lohnEinbeziehen?: boolean;
  /** Einzel- oder Zusammenveranlagung (Splitting; dann zählen beide Gehälter). Vorgabe: einzeln (nur Gehalt 1). */
  veranlagung?: Veranlagung;
  /** Werbungskosten-Pauschbetrag auf den Arbeitslohn je Person (Vorgabe 2026: 1.230 €). */
  werbungskosten?: number;
}
export type Veranlagung = 'einzeln' | 'zusammen';
export const VERANLAGUNG_LABEL: Record<Veranlagung, string> = { einzeln: 'Einzelveranlagung (Gehalt 1)', zusammen: 'Zusammenveranlagung (Splitting, beide Gehälter)' };
export interface Steuerprofil {
  rechtsform?: Rechtsform;
  zeilen?: Partial<Record<SteuerArt, SteuerZeileEin>>;
  param?: SteuerParamEin;
}
/** Im Dokument als `steuern` gespeichert — je Ort höchstens ein Profil, alles optional. */
export type Steuern = Partial<Record<FinanzOrt, Steuerprofil>>;

export const RECHTSFORM_LABEL: Record<Rechtsform, string> = { kapital: 'GmbH / UG (Kapitalgesellschaft)', einzel: 'Einzelunternehmen / Freiberuf' };
export const ZAHLWEISE_LABEL: Record<Zahlweise, string> = { folgejahr: 'im Folgejahr (Nachzahlung)', quartal: 'Vorauszahlung je Quartal' };

/** Vorgaben (Hinweis, keine Steuerberatung): KSt 15 %, Soli 5,5 % auf die KSt, Gewerbesteuer-Messzahl 3,5 %. */
export const STEUER_STANDARD = { kst: STEUER_VORGABE.kst, soli: STEUER_VORGABE.soli, messzahl: STEUER_VORGABE.messzahl } as const;

export interface SteuerArtInfo {
  id: SteuerArt; label: string; kurz: string;
  /** Was die Zeile in der Rechnung bewirkt — ehrlich, auch wenn sie nur anzeigt. */
  wirkung: string;
  /** Satz-Eingabe: Prozent (Anteil, gespeichert als 0,15) oder keine. */
  eingabe: 'satz' | 'gewerbe' | 'keine';
}
export const STEUER_ARTEN: Record<SteuerArt, SteuerArtInfo> = {
  kst: { id: 'kst', label: 'Körperschaftsteuer', kurz: 'KSt', eingabe: 'satz', wirkung: 'auf den Gewinn des Jahres, bezahlt im Folgejahr (oder als Vorauszahlung)' },
  soli: { id: 'soli', label: 'Solidaritätszuschlag auf die KSt', kurz: 'Soli', eingabe: 'satz', wirkung: 'Zuschlag auf die Körperschaftsteuer' },
  gewst: { id: 'gewst', label: 'Gewerbesteuer', kurz: 'GewSt', eingabe: 'gewerbe', wirkung: 'Messzahl × Hebesatz auf den Gewinn' },
  est: { id: 'est', label: 'Einkommensteuer (gemeinsam mit Privat)', kurz: 'ESt', eingabe: 'keine', wirkung: 'Tarif nach § 32a EStG auf Gewinn + Gehalt abzüglich Vorsorge und Sonderausgaben — der Plan zahlt die Mehrsteuer über der Lohnsteuer' },
  ust: { id: 'ust', label: 'Umsatzsteuer (Durchlauf)', kurz: 'USt', eingabe: 'satz', wirkung: 'vereinnahmt und im Folgemonat ans Finanzamt — verändert den Gewinn nicht' },
  exit: { id: 'exit', label: 'Steuer auf den Ausstieg', kurz: 'Ausstieg', eingabe: 'satz', wirkung: 'pauschaler Satz auf die Tranchen des Ausstiegs — zusätzlich zu den laufenden Steuern' },
  netto: { id: 'netto', label: 'Lohnsteuer und Sozialabgaben', kurz: 'Netto', eingabe: 'keine', wirkung: 'Brutto → Netto aus der Netto-Tabelle' },
  ausschuettung: { id: 'ausschuettung', label: 'Steuer auf die Ausschüttung', kurz: 'Ausschüttung', eingabe: 'satz', wirkung: 'pauschal je Szenario (Kapitalertragsteuer + Soli), privat kommt brutto minus Steuer an' },
};

// ── Standard je Ort ─────────────────────────────────────────────────────────
/** Standard-Rechtsform: die MAKE Innovation GmbH und KD Ventures sind Kapitalgesellschaften, die Selbstständigkeit ein Einzelunternehmen. */
export const rechtsformStandard = (ort: FinanzOrt): Rechtsform | null => (ort === 'privat' ? null : ort === 'kdc' ? 'einzel' : 'kapital');

export const profilVon = (d: Pick<FinanzDaten, 'steuern'>, ort: FinanzOrt): Steuerprofil => d.steuern?.[ort] ?? {};
export const rechtsformVon = (d: Pick<FinanzDaten, 'steuern'>, ort: FinanzOrt): Rechtsform | null => (ort === 'privat' ? null : profilVon(d, ort).rechtsform ?? rechtsformStandard(ort));

/**
 * Welche Steuerarten zu diesem Ort und dieser Rechtsform passen — nur das, was der Plan auch rechnen oder zeigen kann.
 * Kapitalgesellschaft: KSt + Soli + Gewerbesteuer; Einzelunternehmen: Einkommensteuer + Gewerbesteuer. USt als Durchlauf gibt es bei
 * der MAKE Innovation GmbH und der Selbstständigkeit, die Steuer auf den Ausstieg bei KD Ventures, die Steuer auf die Ausschüttung bei der MAKE Innovation GmbH.
 */
export function steuerArtenFuer(ort: FinanzOrt, rf: Rechtsform | null): SteuerArt[] {
  if (ort === 'privat') return ['netto', 'ausschuettung'];
  const ertrag: SteuerArt[] = rf === 'einzel' ? ['est', 'gewst'] : ['kst', 'soli', 'gewst'];
  if (ort === 'kdv') return [...ertrag, 'exit'];
  if (ort === 'kdc') return [...ertrag, 'ust'];
  return [...ertrag, 'ust', 'ausschuettung'];
}

const eingeschaltet = (p: Steuerprofil, art: SteuerArt): boolean => p.zeilen?.[art]?.an !== false;
/** Gilt die Steuerart (angeschaltet im Profil)? Standard: ja. */
export const steuerAn = (d: Pick<FinanzDaten, 'steuern'>, ort: FinanzOrt, art: SteuerArt): boolean => eingeschaltet(profilVon(d, ort), art);

/** Zeigt ein Blatt diese Steuerart? Nur passende Arten, die nicht abgeschaltet sind. */
export function zeigeSteuer(d: Pick<FinanzDaten, 'steuern'>, ort: FinanzOrt, art: SteuerArt): boolean {
  return steuerArtenFuer(ort, rechtsformVon(d, ort)).includes(art) && steuerAn(d, ort, art);
}

// ── Schichten übereinanderlegen (Plan ← Szenario) ───────────────────────────
/** Das Profil `ueber` über `basis` legen: nur gesetzte Werte greifen, Zeilen und Tarif-Eckwerte einzeln. */
export function profilUeber(basis: Steuerprofil | undefined, ueber: Steuerprofil | undefined): Steuerprofil {
  if (!ueber) return basis ?? {};
  const b = basis ?? {};
  const out: Steuerprofil = { ...b, ...(ueber.rechtsform ? { rechtsform: ueber.rechtsform } : {}) };
  if (b.zeilen || ueber.zeilen) {
    const z: NonNullable<Steuerprofil['zeilen']> = { ...(b.zeilen ?? {}) };
    for (const [art, e] of Object.entries(ueber.zeilen ?? {}) as [SteuerArt, SteuerZeileEin][]) z[art] = { ...(z[art] ?? {}), ...e };
    out.zeilen = z;
  }
  if (b.param || ueber.param) out.param = { ...(b.param ?? {}), ...(ueber.param ?? {}), ...(b.param?.tarif || ueber.param?.tarif ? { tarif: { ...(b.param?.tarif ?? {}), ...(ueber.param?.tarif ?? {}) } } : {}) };
  return out;
}
/** Die Steuern des Dokuments mit der Überlagerung eines Szenarios — je Ort. */
export function steuernMit(basis: Steuern | undefined, ueber: Steuern | undefined): Steuern | undefined {
  if (!ueber) return basis;
  const out: Steuern = { ...(basis ?? {}) };
  for (const ort of Object.keys(ueber) as FinanzOrt[]) out[ort] = profilUeber(basis?.[ort], ueber[ort]);
  return out;
}

// ── Aufgelöste Parameter für den Rechenkern ─────────────────────────────────
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * Alle Werte, mit denen der Kern die Ertragsteuer eines Ortes rechnet — Profil, sonst Vorgabe. Der Hebesatz der Vorgabe
 * ergibt sich aus dem früheren Gesamtsatz (`annahmen.steuerUG`), sodass die Gesamtquote gleich bleibt, solange niemand etwas einträgt.
 * Einkommensteuer: Vorsorge und Sonderausgaben der Selbstständigkeit mindern den Gewinn der Selbstständigkeit.
 */
export function steuerParameter(d: Pick<FinanzDaten, 'steuern' | 'annahmen'> & Partial<Pick<FinanzDaten, 'selbst'>>, ort: FinanzOrt): Steuerparameter {
  const p = profilVon(d, ort), z = p.zeilen ?? {}, pa = p.param ?? {};
  const vor = aufteilen(d.annahmen.steuerUG);
  const monat = num(pa.zahlMonat);
  return {
    form: rechtsformVon(d, ort) ?? 'kapital',
    kstAn: eingeschaltet(p, 'kst'), kst: num(z.kst?.satz) ?? vor.kst,
    soliAn: eingeschaltet(p, 'soli'), soli: num(z.soli?.satz) ?? vor.soli,
    gewstAn: eingeschaltet(p, 'gewst'), messzahl: num(z.gewst?.satz) ?? vor.messzahl, hebesatz: num(z.gewst?.hebesatz) ?? vor.hebesatz,
    estAn: eingeschaltet(p, 'est'), tarif: { ...TARIF_2026, ...(pa.tarif ?? {}) },
    estAbzug: ort === 'kdc' ? (d.selbst?.vorsorge ?? 0) + (d.selbst?.sonderausgaben ?? 0) : 0,
    freibetrag: num(pa.freibetrag) ?? STEUER_VORGABE.freibetrag,
    anrechnung: num(pa.anrechnung) ?? STEUER_VORGABE.anrechnung,
    soliFreigrenze: num(pa.soliFreigrenze) ?? STEUER_VORGABE.soliFreigrenze,
    werbungskosten: num(pa.werbungskosten) ?? STEUER_VORGABE.werbungskosten,
    splitting: pa.veranlagung === 'zusammen',
    verlustvortrag: pa.verlustvortrag ?? true,
    zahlweise: pa.zahlweise ?? 'folgejahr',
    zahlMonat: monat !== undefined ? Math.max(1, Math.min(12, Math.round(monat))) : Math.max(1, Math.min(12, Math.round(d.annahmen.steuerMonat))),
  };
}

/** Gemeinsame Einkommensteuer der Selbstständigkeit mit Privat (05.10.): Gehälter einbeziehen (Vorgabe ja) und Veranlagung (Vorgabe einzeln). */
export function estGemeinsam(d: Pick<FinanzDaten, 'steuern'>): { lohn: boolean; zusammen: boolean } {
  const pa = profilVon(d, 'kdc').param ?? {};
  return { lohn: pa.lohnEinbeziehen !== false, zusammen: pa.veranlagung === 'zusammen' };
}

// ── Die Felder der Karte — jedes mit Wert, Vorgabe und „gesetzt“ ───────────────
export type FeldArt = 'anteil' | 'betrag' | 'zahl' | 'monat' | 'schalter' | 'wahl';
export interface SteuerFeld {
  /** `kst.satz`, `gewst.hebesatz`, `zahlweise`, `tarif.a1` … — zugleich der Pfad unter `/steuern/<ort>`. */
  id: string;
  label: string; art: FeldArt; dezimal: number;
  gruppe: 'saetze' | 'regeln' | 'tarif';
  /** Wirksamer Wert (Profil, sonst Vorgabe). */
  wert: number | boolean | string;
  /** Wert, der gilt, wenn das Feld leer ist (Platzhalter). */
  vorgabe: number | boolean | string;
  /** Ausdrücklich eingetragen? Nur dann gibt es „zurücksetzen“. */
  gesetzt: boolean;
  optionen?: { id: string; label: string }[];
  hinweis?: string;
}

const PFAD: Record<string, string[]> = {
  'kst.satz': ['zeilen', 'kst', 'satz'], 'soli.satz': ['zeilen', 'soli', 'satz'], 'gewst.satz': ['zeilen', 'gewst', 'satz'], 'gewst.hebesatz': ['zeilen', 'gewst', 'hebesatz'],
  freibetrag: ['param', 'freibetrag'], anrechnung: ['param', 'anrechnung'], soliFreigrenze: ['param', 'soliFreigrenze'], verlustvortrag: ['param', 'verlustvortrag'], zahlweise: ['param', 'zahlweise'], zahlMonat: ['param', 'zahlMonat'],
  lohnEinbeziehen: ['param', 'lohnEinbeziehen'], veranlagung: ['param', 'veranlagung'], werbungskosten: ['param', 'werbungskosten'],
};
const pfadVon = (id: string): string[] | null => (id.startsWith('tarif.') ? ['param', 'tarif', id.slice(6)] : PFAD[id] ?? null);
const lesen = (o: unknown, pfad: string[]): unknown => pfad.reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);

function wertVon(p: Steuerparameter, id: string, pa: SteuerParamEin = {}): number | boolean | string {
  switch (id) {
    case 'lohnEinbeziehen': return pa.lohnEinbeziehen ?? true; case 'veranlagung': return pa.veranlagung ?? 'einzeln'; case 'werbungskosten': return p.werbungskosten ?? STEUER_VORGABE.werbungskosten;
    case 'kst.satz': return p.kst; case 'soli.satz': return p.soli; case 'gewst.satz': return p.messzahl; case 'gewst.hebesatz': return p.hebesatz;
    case 'freibetrag': return p.freibetrag; case 'anrechnung': return p.anrechnung; case 'soliFreigrenze': return p.soliFreigrenze ?? STEUER_VORGABE.soliFreigrenze; case 'verlustvortrag': return p.verlustvortrag; case 'zahlweise': return p.zahlweise; case 'zahlMonat': return p.zahlMonat;
    default: return id.startsWith('tarif.') ? p.tarif[id.slice(6) as keyof EstTarif] : 0;
  }
}

/**
 * Die Felder einer Gesellschaft. `d` ist das Dokument mit allen Überlagerungen (so wird gerechnet), `schicht` die Schicht, die
 * gerade bearbeitet wird (Plan: `d.steuern` ohne Szenario, Szenario: nur dessen Überlagerung), `unter` die Steuern darunter
 * (Plan: nichts → Vorgaben; Szenario: die Steuern des Plans) — davon kommt der graue Platzhalter.
 */
export function steuerFelder(d: Pick<FinanzDaten, 'steuern' | 'annahmen'> & Partial<Pick<FinanzDaten, 'selbst'>>, ort: FinanzOrt, schicht: Steuern | undefined, unter: Steuern | undefined): SteuerFeld[] {
  const rf = rechtsformVon(d, ort);
  if (!rf) return [];
  const jetzt = steuerParameter(d, ort), grund = steuerParameter({ ...d, steuern: unter }, ort);
  const feld = (id: string, label: string, art: FeldArt, dezimal: number, gruppe: SteuerFeld['gruppe'], extra: Partial<SteuerFeld> = {}): SteuerFeld => {
    const pf = pfadVon(id)!;
    return { id, label, art, dezimal, gruppe, wert: wertVon(jetzt, id, profilVon(d, ort).param), vorgabe: wertVon(grund, id, profilVon({ steuern: unter }, ort).param), gesetzt: lesen(schicht?.[ort], pf) !== undefined, ...extra };
  };
  const out: SteuerFeld[] = [];
  if (rf === 'kapital') {
    out.push(feld('kst.satz', 'Körperschaftsteuer-Satz', 'anteil', 2, 'saetze'), feld('soli.satz', 'Soli auf die KSt', 'anteil', 2, 'saetze'));
  } else {
    out.push(feld('freibetrag', 'Gewerbesteuer-Freibetrag €', 'betrag', 0, 'saetze', { hinweis: 'auf den Gewerbeertrag, nur Einzelunternehmen' }), feld('anrechnung', 'Anrechnung auf die Einkommensteuer (Faktor)', 'zahl', 1, 'saetze', { hinweis: '§ 35 EStG, Faktor × Messbetrag; 0 = keine Anrechnung' }),
      feld('soliFreigrenze', 'Soli: Freigrenze der Einkommensteuer €', 'betrag', 0, 'saetze', { hinweis: 'darüber Soli 5,5 %, gemildert (11,9 % des Überschusses)' }));
  }
  out.push(feld('gewst.satz', 'Gewerbesteuer-Messzahl', 'anteil', 2, 'saetze'), feld('gewst.hebesatz', 'Hebesatz der Gemeinde in %', 'zahl', 1, 'saetze', { hinweis: 'leer = aus dem bisherigen Gesamtsatz abgeleitet' }));
  out.push(
    feld('verlustvortrag', 'Verlust mindert die Folgejahre', 'schalter', 0, 'regeln'),
    feld('zahlweise', 'Zahlweise', 'wahl', 0, 'regeln', { optionen: (Object.keys(ZAHLWEISE_LABEL) as Zahlweise[]).map(id => ({ id, label: ZAHLWEISE_LABEL[id] })) }),
    feld('zahlMonat', 'Zahlung (Abschluss) im Kalendermonat', 'monat', 0, 'regeln', { hinweis: 'Vorauszahlungen laufen im März, Juni, September und Dezember' }),
  );
  if (rf === 'einzel' && ort === 'kdc') out.push(
    feld('lohnEinbeziehen', 'Gehälter in die Einkommensteuer einbeziehen (Progression)', 'schalter', 0, 'regeln', { hinweis: 'gemeinsam mit Privat; der Plan zahlt nur die Mehrsteuer über der Lohnsteuer' }),
    feld('veranlagung', 'Veranlagung', 'wahl', 0, 'regeln', { optionen: (Object.keys(VERANLAGUNG_LABEL) as Veranlagung[]).map(id => ({ id, label: VERANLAGUNG_LABEL[id] })) }),
    feld('werbungskosten', 'Werbungskosten-Pauschbetrag je Gehalt €', 'betrag', 0, 'regeln', { hinweis: 'wird vom Arbeitslohn abgezogen (2026: 1.230 €)' }),
  );
  if (rf === 'einzel') for (const t of TARIF_FELDER) out.push(feld(`tarif.${t.k}`, t.label, t.art === 'anteil' ? 'anteil' : 'betrag', t.art === 'anteil' ? 2 : t.art === 'koeff' ? 2 : 0, 'tarif'));
  return out;
}

// ── Zeilen für die Karte „Welche Steuern gelten?“ ───────────────────────────
export interface SteuerZeile {
  art: SteuerArt; info: SteuerArtInfo; an: boolean;
  /** Schalter bedienbar? */
  schaltbar: boolean;
  /** Anteil (0,15) oder Messzahl; leer, wenn die Zeile keinen Satz hat. */
  satz?: number;
  hebesatz?: number;
  /** Woher der Satz kommt: das Profil, die Annahmen des Plans, das Szenario. */
  quelle: 'profil' | 'annahmen' | 'szenario';
  hinweis?: string;
}

/** Die Zeilen eines Ortes — in der Reihenfolge, wie sie die Karte zeigt. `ausschuettungSatz` kommt aus dem Arbeitsplan (sonst die Vorgabe). */
export function steuerZeilen(d: Pick<FinanzDaten, 'steuern' | 'annahmen'> & Partial<Pick<FinanzDaten, 'selbst'>>, ort: FinanzOrt, ausschuettungSatz: number): SteuerZeile[] {
  const rf = rechtsformVon(d, ort), p = profilVon(d, ort), a = d.annahmen;
  const sp = steuerParameter(d, ort);
  return steuerArtenFuer(ort, rf).map((art): SteuerZeile => {
    const info = STEUER_ARTEN[art], an = eingeschaltet(p, art);
    switch (art) {
      case 'kst': return { art, info, an, schaltbar: true, satz: sp.kst, quelle: 'profil' };
      case 'soli': return { art, info, an, schaltbar: true, satz: sp.soli, quelle: 'profil' };
      case 'gewst': return { art, info, an, schaltbar: true, satz: sp.messzahl, hebesatz: sp.hebesatz, quelle: 'profil' };
      case 'est': return { art, info, an, schaltbar: true, quelle: 'profil', hinweis: ort === 'kdc' ? 'Vorsorge und Sonderausgaben stehen im Abschluss 2026 der Selbstständigkeit' : undefined };
      case 'ust': return { art, info, an, schaltbar: true, satz: a.ust, quelle: 'annahmen', hinweis: 'Schalter nur für die Anzeige — Durchlauf, ändert den Gewinn nicht. Kleinunternehmer: Satz 0' };
      case 'exit': return { art, info, an, schaltbar: true, satz: a.exitSteuer, quelle: 'annahmen', hinweis: 'Aus = Satz 0; der alte Satz bleibt gemerkt' };
      case 'ausschuettung': return { art, info, an: true, schaltbar: false, satz: ausschuettungSatz, quelle: 'szenario', hinweis: 'gilt je Szenario (Planen › Szenarien bauen); ohne Ausschüttung steht die Zeile nicht im Blatt' };
      case 'netto': return { art, info, an: true, schaltbar: false, quelle: 'annahmen', hinweis: 'Netto-Tabelle unten' };
    }
  });
}

// ── Änderungen als Operationen ──────────────────────────────────────────────
/** Wo gespeichert wird: im Plan (alle Szenarien) oder nur in einem Szenario (Überlagerung). */
export type SteuerBereich = { art: 'plan' } | { art: 'szenario'; id: string };
const basisPfad = (b: SteuerBereich, ort: FinanzOrt): string => (b.art === 'plan' ? `/steuern/${ort}` : `/planszenarien/id=${b.id}/annahmen/steuern/${ort}`);

export type SteuerAenderung =
  | { art: 'rechtsform'; wert: Rechtsform }
  | { art: 'an'; steuer: SteuerArt; wert: boolean }
  /** Ein Feld der Liste `steuerFelder` setzen; `wert: null` = leeren (Vorgabe gilt wieder). */
  | { art: 'feld'; id: string; wert: number | boolean | string | null };

/**
 * Operationen für eine Änderung am Steuerprofil. `schicht` = die bearbeitete Schicht (für `alt`). Alles geht über den
 * vorhandenen Schreibweg (Stand/409, Protokoll, Rückgängig). Pauschale Sätze, die in den Annahmen liegen (Steuer auf den Ausstieg):
 * „gilt nicht“ = Satz 0, der bisherige Satz bleibt im Profil gemerkt und kommt beim Einschalten zurück.
 */
export function steuerOps(d: Pick<FinanzDaten, 'steuern' | 'annahmen'>, ort: FinanzOrt, a: SteuerAenderung, bereich: SteuerBereich = { art: 'plan' }, schicht: Steuern | undefined = d.steuern): Operation[] {
  const p = schicht?.[ort] ?? {};
  const bp = basisPfad(bereich, ort);
  switch (a.art) {
    case 'rechtsform': return [{ pfad: `${bp}/rechtsform`, alt: p.rechtsform, neu: a.wert, feld: `Rechtsform ${finanzOrtName(ort)}` }];
    case 'feld': {
      const pf = pfadVon(a.id);
      if (!pf) return [];
      const alt = lesen(p, pf);
      const feld = `${finanzOrtName(ort)} · ${a.id}${bereich.art === 'szenario' ? ' (Szenario)' : ''}`;
      return [{ pfad: `${bp}/${pf.join('/')}`, alt, ...(a.wert === null ? {} : { neu: a.wert }), feld }];
    }
    case 'an': {
      const ops: Operation[] = [{ pfad: `${bp}/zeilen/${a.steuer}/an`, alt: p.zeilen?.[a.steuer]?.an, neu: a.wert, feld: `${STEUER_ARTEN[a.steuer].label} ${a.wert ? 'gilt' : 'gilt nicht'}` }];
      // Steuer auf den Ausstieg liegt in den Annahmen des Plans: aus = Satz 0, der alte Satz bleibt im Profil gemerkt.
      if (a.steuer === 'exit' && bereich.art === 'plan') {
        const jetzt = d.annahmen.exitSteuer;
        if (!a.wert) { if (jetzt > 0) ops.push({ pfad: `${bp}/zeilen/exit/satz`, alt: p.zeilen?.exit?.satz, neu: jetzt }, { pfad: '/annahmen/exitSteuer', alt: jetzt, neu: 0 }); }
        else { const gemerkt = p.zeilen?.exit?.satz; if (gemerkt !== undefined && jetzt === 0) ops.push({ pfad: '/annahmen/exitSteuer', alt: jetzt, neu: gemerkt }); }
      }
      return ops;
    }
  }
}

// ── Prüfen (Säuberer) ───────────────────────────────────────────────────────
const ARTEN = Object.keys(STEUER_ARTEN) as SteuerArt[];
const ORTE: FinanzOrt[] = ['privat', 'kdc', 'kdv', 'ug'];
const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const TARIF_SCHLUESSEL = new Set<string>(TARIF_FELDER.map(f => f.k));

/** `steuern` aus rohen Daten bereinigen — unbekannte Schlüssel fallen weg, Werte werden begrenzt; leer → undefined. */
export function pruefeSteuern(roh: unknown): Steuern | undefined {
  if (!istObjekt(roh)) return undefined;
  const out: Steuern = {};
  for (const ort of ORTE) {
    const r = roh[ort]; if (!istObjekt(r)) continue;
    const p: Steuerprofil = {};
    if (r.rechtsform === 'kapital' || r.rechtsform === 'einzel') p.rechtsform = r.rechtsform;
    if (istObjekt(r.zeilen)) {
      const zeilen: NonNullable<Steuerprofil['zeilen']> = {};
      for (const art of ARTEN) {
        const z = r.zeilen[art]; if (!istObjekt(z)) continue;
        const e: SteuerZeileEin = {};
        if (typeof z.an === 'boolean') e.an = z.an;
        const s = num(z.satz); if (s !== undefined) e.satz = Math.max(0, Math.min(1, s));
        const h = num(z.hebesatz); if (h !== undefined) e.hebesatz = Math.max(0, Math.min(2000, h));
        if (Object.keys(e).length) zeilen[art] = e;
      }
      if (Object.keys(zeilen).length) p.zeilen = zeilen;
    }
    if (istObjekt(r.param)) {
      const q = r.param, pa: SteuerParamEin = {};
      if (typeof q.verlustvortrag === 'boolean') pa.verlustvortrag = q.verlustvortrag;
      if (q.zahlweise === 'folgejahr' || q.zahlweise === 'quartal') pa.zahlweise = q.zahlweise;
      const m = num(q.zahlMonat); if (m !== undefined) pa.zahlMonat = Math.max(1, Math.min(12, Math.round(m)));
      const f = num(q.freibetrag); if (f !== undefined) pa.freibetrag = Math.max(0, Math.min(1e9, f));
      const an = num(q.anrechnung); if (an !== undefined) pa.anrechnung = Math.max(0, Math.min(20, an));
      const sf = num(q.soliFreigrenze); if (sf !== undefined) pa.soliFreigrenze = Math.max(0, Math.min(1e9, sf));
      if (typeof q.lohnEinbeziehen === 'boolean') pa.lohnEinbeziehen = q.lohnEinbeziehen;
      if (q.veranlagung === 'einzeln' || q.veranlagung === 'zusammen') pa.veranlagung = q.veranlagung;
      const wk = num(q.werbungskosten); if (wk !== undefined) pa.werbungskosten = Math.max(0, Math.min(1e6, wk));
      if (istObjekt(q.tarif)) {
        const t: Partial<EstTarif> = {};
        for (const [k, v] of Object.entries(q.tarif)) { const x = num(v); if (x !== undefined && TARIF_SCHLUESSEL.has(k)) t[k as keyof EstTarif] = Math.max(0, Math.min(1e8, x)); }
        if (Object.keys(t).length) pa.tarif = t;
      }
      if (Object.keys(pa).length) p.param = pa;
    }
    if (Object.keys(p).length) out[ort] = p;
  }
  return Object.keys(out).length ? out : undefined;
}
