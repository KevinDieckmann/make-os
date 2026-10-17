// ─── Steuern — Fristen, Rücklage, Umsatzsteuer, Übergabe (rein, getestet) ──
// Kevin (25.09.): eine Steuer-Seite unter Zahlen — Steuerkalender & Fristen je
// Firma und privat (mit Countdown und einer Aufgabe davor), Rücklage &
// Prognose, Belege & Umsatzsteuer, Übergabe an den Steuerberater.
//
// HINWEIS, KEINE STEUERBERATUNG. Termine werden gerechnet (lib/finanzen/chef/
// steuertermine.ts, § 108 AO), Beträge sind Schätzungen aus euren Zahlen mit
// offengelegten Annahmen (Sätze, Hebesatz, Steuerquote) — verbindlich sind
// Bescheid und Steuerberater.

import { steuertermine, werktag, type UstRhythmus } from '@/lib/finanzen/chef/steuertermine';
import type { Rechnung } from '@/lib/make-one/liquiditaet';
import { UST_REGEL, aufCent, ustAusBrutto } from '@/lib/finanzen/ust';
import type { Beleg } from '@/lib/finanzen/haushalt/typen';
import { WEG } from '@/lib/wege';
import { FINANZ_ORT_IDS, bereichVon, finanzOrtName, type Bereich, type FinanzOrt, type Gesellschaftskennung } from '@/lib/einheiten';
import type { EstGemeinsam } from '@/lib/finanzen/est-gemeinsam';

// Die eine Einheitenliste (28.09., lib/einheiten.ts): Privat · Selbstständigkeit · KD Ventures · MAKE Innovation GmbH.
// 15.10. (Kevin: „Ja, wie bei KD Ventures“): die Hauptgesellschaft (Kennung `ug`) rechnet wie KD Ventures — Kapitalgesellschaft mit
// Umsatzsteuer-Voranmeldung, Körperschaft- und Gewerbesteuer-Vorauszahlungen, Jahreserklärungen und Offenlegung (§ 108 AO, Werktag) und einer
// Schätzung aus den Ist-Monaten mit offengelegten Annahmen. Rechtsform und Sätze (KSt, Soli, Messzahl, Hebesatz) kommen, wo vorhanden, aus dem
// Steuerprofil der Finanzplanung („Welche Steuern gelten?“, `mitFinanzplanung`) — nie erfundene Beträge. Der frühere Sonderfall
// „noch nicht hinterlegt“ entfällt.
export type Einheit = FinanzOrt;
export const EINHEIT_LABEL: Record<Einheit, string> = { kdc: finanzOrtName('kdc'), kdv: finanzOrtName('kdv'), ug: finanzOrtName('ug'), privat: finanzOrtName('privat') };
/** Firmen mit Steuerlogik: die Selbstständigkeit und beide Gesellschaften (seit 15.10. auch die Hauptgesellschaft `ug`). */
export type SteuerFirma = Gesellschaftskennung;
export const STEUER_FIRMEN: readonly SteuerFirma[] = ['kdc', 'kdv', 'ug'];
/** Die Kapitalgesellschaften mit eigener Schätzung (KSt + Soli + GewSt aus den Ist-Monaten). */
export const KAPITAL_FIRMEN = ['kdv', 'ug'] as const;
export type KapitalFirma = typeof KAPITAL_FIRMEN[number];
/**
 * Der Weg zur Näherung der Ertragsteuern der Hauptgesellschaft in der Finanzplanung (Blatt Gesellschaften, Steuerkarte genau dieser
 * Gesellschaft, `steuern=ug`) — dort stehen die Sätze, mit denen auch das Steuer-Modul rechnet; verbindlich ist der Steuerberater.
 */
export const UG_STEUER_WEG = {
  text: 'Sätze in der Finanzplanung ansehen',
  href: `${WEG.finanzplanung(bereichVon('ug') === 'privat' ? 'privat' : 'business', 'gesellschaften')}&steuern=ug`,
} as const;
/** Derselbe Weg je Kapitalgesellschaft (17.10., L2 E2: auch KD Ventures rechnet mit den Sätzen der Finanzplanung). */
export const steuerWegFuer = (firma: 'ug' | 'kdv'): { text: string; href: string } => (firma === 'ug' ? UG_STEUER_WEG : {
  text: UG_STEUER_WEG.text,
  href: `${WEG.finanzplanung(bereichVon(firma) === 'privat' ? 'privat' : 'business', 'gesellschaften')}&steuern=${firma}`,
});

export interface FirmaSteuer {
  rechtsform: 'freiberuf' | 'einzel' | 'ug' | 'gmbh';
  ust: UstRhythmus;
  dauerfrist: boolean;
  /** Ist-Versteuerung (USt, wenn das Geld kommt) — sonst Soll (bei Rechnungsstellung). */
  istVersteuerung: boolean;
  /** Gewerbesteuerpflichtig (Kapitalgesellschaft immer; Freiberufler nie). */
  gewerbe: boolean;
  /**
   * Sätze aus dem Steuerprofil der Finanzplanung (15.10., `mitFinanzplanung`, nur die Hauptgesellschaft) — NIE gespeichert, beim Lesen gesetzt.
   * Anteile (0,15 · 0,055 · 0,035), Hebesatz in Prozent; ausgeschaltete Steuern stehen mit 0. Fehlt: die Vorgabe (15,825 % + 3,5 % × Hebesatz).
   */
  saetze?: { kst: number; soli: number; messzahl: number; hebesatz: number; plan: string | null };
  /** Gründungstag aus dem Gesellschafts-Register (15.10., `mitGruendung`) — NIE gespeichert: Fristen davor gibt es nicht. */
  seit?: string;
}
export interface SteuerEinstellungen {
  mitBerater: boolean;
  kdc: FirmaSteuer;
  kdv: FirmaSteuer;
  /** Die Hauptgesellschaft (15.10., wie KD Ventures). */
  ug: FirmaSteuer;
  privat: { estVorauszahlung: boolean };
  /** Vorauszahlungen je Quartal laut Bescheid (Euro). `kst` = KD Ventures (Altname), `kstUg`/`gewstUg` = Hauptgesellschaft (15.10.). */
  vorauszahlung: { est?: number; kst?: number; gewstKdc?: number; gewstKdv?: number; kstUg?: number; gewstUg?: number };
  /**
   * Durchschnittlicher ESt-Satz auf den Gewinn aus Consulting (Prozent) — bis 05.10. die Annahme für die Einkommensteuer. Seit 05.10.
   * rechnet die Einkommensteuer gemeinsam aus der Finanzplanung (lib/finanzen/est-gemeinsam.ts); das Feld bleibt nur gespeichert
   * (älterer Stand liest es weiter) und wird nicht mehr gerechnet.
   */
  steuerquote: number | null;
  /** Gewerbesteuer-Hebesatz der Gemeinde (Prozent). */
  hebesatz: number;
  /** Was auf den Steuerrücklage-Konten liegt (Euro). */
  ruecklageIst: Partial<Record<Einheit, number>>;
  /** Aufgabe so viele Tage vor der Frist. */
  vorlaufTage: number;
}

export const STANDARD_STEUERN: SteuerEinstellungen = {
  mitBerater: true,
  // 05.10. (Kevin: „Ich habe in der Selbstständigkeit einfach ein Gewerbe angemeldet“): gewerblich mit Gewerbesteuer. Mit Finanzplanung
  // kommen Rechtsform/Gewerbesteuer ohnehin aus deren Steuerprofil (`mitFinanzplanung`) — das hier ist nur die Vorgabe ohne Plan.
  kdc: { rechtsform: 'einzel', ust: 'quartal', dauerfrist: false, istVersteuerung: true, gewerbe: true },
  kdv: { rechtsform: 'ug', ust: 'quartal', dauerfrist: false, istVersteuerung: false, gewerbe: true },
  // 15.10.: die Hauptgesellschaft wie KD Ventures — Kapitalgesellschaft (GmbH), USt vierteljährlich, Soll-Versteuerung, Gewerbesteuer.
  ug: { rechtsform: 'gmbh', ust: 'quartal', dauerfrist: false, istVersteuerung: false, gewerbe: true },
  privat: { estVorauszahlung: true },
  vorauszahlung: {},
  steuerquote: null,
  hebesatz: 410,
  ruecklageIst: {},
  vorlaufTage: 7,
};

export const HINWEIS = 'Hinweis, keine Steuerberatung — Termine gerechnet, Beträge geschätzt. Verbindlich sind Bescheid und Steuerberater.';

/** Steuerprofil einer Kapitalgesellschaft aus der Finanzplanung (lib/finanzen/est-gemeinsam.ts `kapitalProfilFuer`) — nur was hier gebraucht wird. */
export interface KapitalProfilEin {
  kapital: boolean; kstAn: boolean; kst: number; soliAn: boolean; soli: number; gewstAn: boolean; messzahl: number; hebesatz: number; plan: string | null;
}

/**
 * EINE Quelle für die Selbstständigkeit (05.10.): Gibt es eine Finanzplanung, kommen Rechtsform und Gewerbesteuer der Selbstständigkeit aus
 * deren Steuerprofil („Welche Steuern gelten?“) — gewerblich = Einzelunternehmen mit Gewerbesteuer, ausgeschaltete Gewerbesteuer =
 * Freiberuf. Ohne Plan bleiben die gespeicherten Einstellungen. USt-Rhythmus, Dauerfrist und Ist-Versteuerung bleiben Steuer-Einstellungen.
 * 15.10.: ebenso die Hauptgesellschaft (`ug`) — Rechtsform (Kapitalgesellschaft bleibt GmbH/UG wie gespeichert), Gewerbesteuer an/aus und die
 * Sätze (KSt, Soli, Messzahl, Hebesatz) aus ihrem Steuerprofil. Ohne Profil (kein Plan) bleibt sie bei der gespeicherten Einstellung.
 */
export function mitFinanzplanung(e: SteuerEinstellungen, est: Pick<EstGemeinsam, 'gewerbe'> | null, ug: KapitalProfilEin | null = null, kdv: KapitalProfilEin | null = null): SteuerEinstellungen {
  if (!est && !ug && !kdv) return e;
  const x: SteuerEinstellungen = { ...e };
  if (est) x.kdc = { ...e.kdc, rechtsform: est.gewerbe ? 'einzel' : 'freiberuf', gewerbe: est.gewerbe };
  // Kapitalgesellschaft bleibt UG/GmbH wie gespeichert (sonst die Vorgabe der Gesellschaft); laut Plan keine → Einzelunternehmen.
  const kapital = (firma: KapitalFirma, k: KapitalProfilEin): FirmaSteuer => ({
    ...e[firma], rechtsform: !k.kapital ? 'einzel' : istKapital(e[firma]) ? e[firma].rechtsform : STANDARD_STEUERN[firma].rechtsform, gewerbe: k.gewstAn,
    saetze: { kst: k.kstAn ? k.kst : 0, soli: k.soliAn ? k.soli : 0, messzahl: k.messzahl, hebesatz: k.hebesatz, plan: k.plan },
  });
  if (ug) x.ug = kapital('ug', ug);
  // 17.10. (L2 E2): KD Ventures ebenso — dieselben Sätze wie in der Finanzplanung, keine zweite Rechnung mit festen 15,825 %.
  if (kdv) x.kdv = kapital('kdv', kdv);
  return x;
}

/** Gründungstage aus dem Gesellschafts-Register (15.10.): Fristen einer Gesellschaft beginnen erst mit ihr — nie für Jahre davor. */
export function mitGruendung(e: SteuerEinstellungen, seit: Partial<Record<SteuerFirma, string | undefined>>): SteuerEinstellungen {
  const tag = (t: string | undefined) => (t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined);
  if (!STEUER_FIRMEN.some(f => tag(seit[f]))) return e;
  const x: SteuerEinstellungen = { ...e };
  for (const f of STEUER_FIRMEN) { const t = tag(seit[f]); if (t) x[f] = { ...e[f], seit: t }; }
  return x;
}

/** Bereich einer Steuer-Einheit (05.10.): Privat und die Selbstständigkeit → privat, KD Ventures und MAKE → business (`bereichVon`). */
export const steuerBereich = (x: Einheit): Bereich => bereichVon(x);
/** Die Einheiten in der Reihenfolge der Steuer-Seite: erst der Privat-Bereich (Privat, Selbstständigkeit), dann Business. */
/** Ein Link auf die Steuer-Seite führt bei Privat und der Selbstständigkeit in die Privat-Sicht (dort stehen sie seit 05.10.). */
export const hrefImBereich = (href: string, x: Einheit): string => (bereichVon(x) === 'privat' && href.startsWith('/os/finanzen?s=steuern') && !href.includes('space=') ? href.replace('?s=steuern', '?s=steuern&space=privat') : href);
export const STEUER_EINHEITEN: readonly Einheit[] = [...FINANZ_ORT_IDS.filter(x => bereichVon(x) === 'privat'), ...FINANZ_ORT_IDS.filter(x => bereichVon(x) === 'business')];

// ── Hilfen ──────────────────────────────────────────────────────────────────

const tagPlus = (t: string, n: number) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const tageBis = (von: string, bis: string) => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 86_400_000);
const letzterTag = (j: number, m: number) => new Date(Date.UTC(j, m, 0, 12)).toISOString().slice(0, 10);
const deutsch = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;
const istKapital = (f: FirmaSteuer) => f.rechtsform === 'ug' || f.rechtsform === 'gmbh';
/** Anteil als Prozent mit Komma, höchstens drei Nachkommastellen (0,15825 → „15,825“). */
const prozent = (anteil: number) => (anteil * 100).toLocaleString('de-DE', { maximumFractionDigits: 3 });

/**
 * Abgabefrist der Jahreserklärungen (§ 149 AO; Corona-Übergang bis 2024).
 * Mit Steuerberater: Ende Februar des übernächsten Jahres, sonst 31.07. des Folgejahres.
 */
export function erklaerungsFrist(jahr: number, mitBerater: boolean): string {
  const OHNE: Record<number, string> = { 2022: '2023-10-02', 2023: '2024-09-02' };
  const MIT: Record<number, string> = { 2022: '2024-07-31', 2023: '2025-06-02', 2024: '2026-04-30' };
  if (!mitBerater) return OHNE[jahr] ?? werktag(`${jahr + 1}-07-31`);
  return MIT[jahr] ?? werktag(letzterTag(jahr + 2, 2));
}

// ── 1 · Fristen ─────────────────────────────────────────────────────────────

export interface Frist {
  id: string; datum: string; einheit: Einheit;
  art: 'ust' | 'ust-sv' | 'est' | 'kst' | 'gewst' | 'erklaerung' | 'offenlegung';
  titel: string; hinweis: string;
  /** Tage bis zur Frist (negativ = vorbei). */
  tage: number;
  /** Vorauszahlung laut Einstellung (Euro), wenn bekannt. */
  betrag?: number;
  /** Ab hier steht die Aufgabe in der Liste. */
  aufgabeAb: string;
  erledigt: boolean;
  href: string;
}

export function fristen(e: SteuerEinstellungen, heute: string, erledigt: Record<string, unknown> = {}, tageVor = 30, tageNach = 365): Frist[] {
  const von = tagPlus(heute, -tageVor), bis = tagPlus(heute, tageNach);
  const raus: Frist[] = [];
  const dazu = (einheit: Einheit, f: Omit<Frist, 'id' | 'einheit' | 'tage' | 'aufgabeAb' | 'erledigt'>) => {
    if (f.datum < von || f.datum > bis) return;
    const id = `${einheit}-${f.art}-${f.datum}`;
    raus.push({ ...f, href: hrefImBereich(f.href, einheit), id, einheit, tage: tageBis(heute, f.datum), aufgabeAb: tagPlus(f.datum, -e.vorlaufTage), erledigt: !!erledigt[`f:${id}`] });
  };
  for (const firma of STEUER_FIRMEN) {
    const f = e[firma];
    const kap = istKapital(f);
    for (const t of steuertermine(von, bis, { ust: f.ust, dauerfrist: f.dauerfrist, estVorauszahlung: false, gewstVorauszahlung: f.gewerbe, kstVorauszahlung: kap })) {
      // Vor der Gründung gibt es keine Vorauszahlung und keine Voranmeldung (15.10., `seit` aus dem Register).
      if (f.seit && t.datum <= f.seit) continue;
      const betrag = t.art === 'kst' ? (firma === 'ug' ? e.vorauszahlung.kstUg : e.vorauszahlung.kst) : t.art === 'gewst' ? (firma === 'kdc' ? e.vorauszahlung.gewstKdc : firma === 'ug' ? e.vorauszahlung.gewstUg : e.vorauszahlung.gewstKdv) : undefined;
      dazu(firma, { datum: t.datum, art: t.art, titel: t.titel, hinweis: t.hinweis, ...(betrag ? { betrag } : {}), href: t.art === 'ust' || t.art === 'ust-sv' ? WEG.steuern('ust') : WEG.steuern('ruecklage') });
    }
    for (let j = Number(heute.slice(0, 4)) - 2; j <= Number(heute.slice(0, 4)); j++) {
      // Jahreserklärung und Offenlegung erst ab dem Gründungsjahr (15.10.).
      if (f.seit && j < Number(f.seit.slice(0, 4))) continue;
      const frist = erklaerungsFrist(j, e.mitBerater);
      const was = kap
        ? ['Körperschaftsteuer', 'Gewerbesteuer', 'Umsatzsteuer', 'Jahresabschluss (E-Bilanz)']
        : ['Einnahmenüberschussrechnung (EÜR)', 'Umsatzsteuer', ...(f.gewerbe ? ['Gewerbesteuer'] : [])];
      dazu(firma, { datum: frist, art: 'erklaerung', titel: `Jahreserklärungen ${j}`, hinweis: `${was.join(', ')}${e.mitBerater ? ' — Frist mit Steuerberater' : ''}`, href: WEG.steuern('uebergabe') });
      if (kap) dazu(firma, { datum: werktag(`${j + 1}-12-31`), art: 'offenlegung', titel: `Offenlegung Jahresabschluss ${j}`, hinweis: 'Unternehmensregister, 12 Monate nach Geschäftsjahresende (§ 325 HGB)', href: WEG.steuern('uebergabe') });
    }
  }
  if (e.privat.estVorauszahlung) for (const t of steuertermine(von, bis, { ust: 'keine', dauerfrist: false, estVorauszahlung: true, gewstVorauszahlung: false })) {
    dazu('privat', { datum: t.datum, art: 'est', titel: t.titel, hinweis: 'gemeinsam: Gehalt und Gewinn der Selbstständigkeit', ...(e.vorauszahlung.est ? { betrag: e.vorauszahlung.est } : {}), href: WEG.steuern('ruecklage') });
  }
  for (let j = Number(heute.slice(0, 4)) - 2; j <= Number(heute.slice(0, 4)); j++) {
    dazu('privat', { datum: erklaerungsFrist(j, e.mitBerater), art: 'erklaerung', titel: `Einkommensteuererklärung ${j}`, hinweis: `Haushalt${e.mitBerater ? ' — Frist mit Steuerberater' : ''}`, href: WEG.steuern('uebergabe') });
  }
  return raus.sort((a, b) => a.datum.localeCompare(b.datum) || a.einheit.localeCompare(b.einheit));
}

// ── 2 · Umsatzsteuer ────────────────────────────────────────────────────────

export interface UstRechnung { id: string; kunde: string; nummer?: string; datum?: string; brutto: number; ust: number; satz: number; angenommen: boolean }
export interface UstZeitraum {
  firma: SteuerFirma; label: string; von: string; bis: string; faellig: string | null;
  ust: number; vorsteuer: number | null; zahllast: number | null;
  rechnungen: UstRechnung[]; vorsteuerQuelle: string;
}
export interface Grundlagenteil { stand: string; kosten: { datum: string; brutto: number; netto: number }[]; ugRechnungen: { datum: string; brutto: number; netto: number }[] }

/** Der Voranmeldungszeitraum, in dem ein Tag liegt. */
export function zeitraumVon(tag: string, r: UstRhythmus): { label: string; von: string; bis: string } | null {
  if (r === 'keine') return null;
  const j = Number(tag.slice(0, 4)), m = Number(tag.slice(5, 7));
  if (r === 'monatlich') return { label: `${String(m).padStart(2, '0')}/${j}`, von: `${tag.slice(0, 7)}-01`, bis: letzterTag(j, m) };
  const q = Math.ceil(m / 3);
  return { label: `Q${q}/${j}`, von: `${j}-${String(q * 3 - 2).padStart(2, '0')}-01`, bis: letzterTag(j, q * 3) };
}

export function ustZeitraum(firma: SteuerFirma, f: FirmaSteuer, zr: { label: string; von: string; bis: string }, rechnungen: (Rechnung & { firmaId?: string })[], grund: Grundlagenteil | null, faellig: string | null): UstZeitraum {
  const eigene = rechnungen.filter(r => (r.firmaId ?? 'kdc') === firma && (r.status === 'gestellt' || r.status === 'bezahlt'));
  const liste: UstRechnung[] = [];
  for (const r of eigene) {
    const tag = f.istVersteuerung ? (r.status === 'bezahlt' ? r.bezahltAm : undefined) : r.datum;
    if (!tag || tag < zr.von || tag > zr.bis) continue;
    const satz = r.ustSatz ?? UST_REGEL;
    // Eine USt-Funktion (#79/#80): kaufmännisch je Rechnung auf den Cent; ein eingetragenes Netto gewinnt.
    const ust = r.netto != null ? aufCent(r.betrag - r.netto) : ustAusBrutto(r.betrag, satz);
    liste.push({ id: r.id, kunde: r.kunde, ...(r.nummer ? { nummer: r.nummer } : {}), ...(r.datum ? { datum: r.datum } : {}), brutto: r.betrag, ust, satz, angenommen: r.ustSatz == null && r.netto == null });
  }
  const ust = liste.reduce((s, x) => s + x.ust, 0);
  let vorsteuer: number | null = null, vorsteuerQuelle = 'keine Eingangsbelege mit Vorsteuer in MAKE OS';
  // Die Grundlage (V1-Export) kennt nur die Selbstständigkeit (`kosten`) und KD Ventures (`ugRechnungen` — im alten Vokabular hieß KD Ventures
  // „UG“); für die Hauptgesellschaft (`ug`, 15.10.) gibt es dort keine Eingangsbelege — Vorsteuer bleibt dann „unbekannt“, nie geraten.
  const posten = !grund ? null : firma === 'kdc' ? grund.kosten : firma === 'kdv' ? grund.ugRechnungen : null;
  if (grund && posten) {
    const im = posten.filter(p => p.datum >= zr.von && p.datum <= zr.bis);
    if (grund.stand >= zr.von) {
      vorsteuer = im.reduce((s, p) => s + Math.max(0, p.brutto - p.netto), 0);
      vorsteuerQuelle = grund.stand >= zr.bis ? `${im.length} Eingangsbelege (Grundlage)` : `${im.length} Eingangsbelege bis ${deutsch(grund.stand)} (Grundlage, danach fehlt noch)`;
    }
  }
  return { firma, ...zr, faellig, ust, vorsteuer, zahllast: vorsteuer == null ? ust : ust - vorsteuer, rechnungen: liste, vorsteuerQuelle };
}

// ── 3 · Rücklage & Prognose ─────────────────────────────────────────────────

export interface PrognoseZeile { id: string; einheit: Einheit; titel: string; betrag: number | null; formel: string; luecke?: string; href: string }
export interface Prognose {
  jahr: number;
  zeilen: PrognoseZeile[];
  je: Record<Einheit, { soll: number; ist: number | null; deckung: number | null }>;
  /**
   * Woher die abgezogenen Vorauszahlungen auf Einkommen- und Gewerbesteuer der Selbstständigkeit kommen (05.10. abends, Kevin: „eine
   * Quelle“): mit Finanzplanung NUR von dort (`EstJahr.vorausgezahlt` — „Vorauszahlungen schon bezahlt“ + Quartalszahlungen im Plan), sonst
   * aus den Steuer-Einstellungen (je Quartal laut Bescheid, bis heute fällig). Nie beide — kein Doppelabzug. `ungenutzt` = Beträge der
   * Steuer-Einstellungen, die wegen der Finanzplanung NICHT zählen (Hinweis in der Oberfläche).
   */
  vorauszahlung: { quelle: 'finanzplanung' | 'einstellungen' | 'keine'; est: number; gewst: number; ungenutzt?: { est?: number; gewstKdc?: number } };
}
export interface Jahresgewinn { gewinn: number; monate: number; hochgerechnet: number; quelle: string }

/** Jahresgewinn aus den Ist-Monaten dieses Jahres, auf 12 Monate hochgerechnet. */
export function jahresgewinn(ist: { monat: string; umsatz: number; kosten: number; quelle: string }[], jahr: number): Jahresgewinn | null {
  const l = ist.filter(m => m.monat.startsWith(String(jahr)));
  if (!l.length) return null;
  const g = l.reduce((s, m) => s + m.umsatz - m.kosten, 0);
  return { gewinn: g, monate: l.length, hochgerechnet: (g / l.length) * 12, quelle: `${l.length} Ist-Monate ${jahr} (${Array.from(new Set(l.flatMap(m => m.quelle.split(' + ')))).join(', ')})` };
}

/**
 * Wie viele Vorauszahlungen des Jahres bis heute fällig waren. Einkommen- und Körperschaftsteuer am 10. (März, Juni, Sept., Dez.),
 * Gewerbesteuer am 15. (Feb., Mai, Aug., Nov.) — vorher zählte auch die Gewerbesteuer ab dem 10. als bezahlt (17.10., L2 C).
 */
const VZ_EST_KST = { monate: [3, 6, 9, 12], tag: 10 } as const;
const VZ_GEWST = { monate: [2, 5, 8, 11], tag: 15 } as const;
const vzBisHeute = (heute: string, t: { monate: readonly number[]; tag: number }) =>
  t.monate.filter(m => `${heute.slice(0, 4)}-${String(m).padStart(2, '0')}-${t.tag}` <= heute).length;

/**
 * Rücklage & Prognose. Seit 05.10. kommen Einkommensteuer (gemeinsam: Gehalt + Selbstständigkeit) und Gewerbesteuer der Selbstständigkeit
 * aus der Finanzplanung (`est`, lib/finanzen/est-gemeinsam.ts — EINE Rechenquelle); `gewinn.kdc` wird nicht mehr gerechnet (bleibt für
 * die Anzeige). Ohne Finanzplanung für das Jahr: ehrlich „fehlt“, kein Schätzwert.
 */
export function prognose(e: SteuerEinstellungen, heute: string, gewinn: Partial<Record<SteuerFirma, Jahresgewinn | null>>, ustOffen: Partial<Record<SteuerFirma, number>>, est: EstGemeinsam | null = null): Prognose {
  const jahr = Number(heute.slice(0, 4));
  const z: PrognoseZeile[] = [];
  const gezahlt = (n: number | undefined, t: { monate: readonly number[]; tag: number }) => (n ?? 0) * vzBisHeute(heute, t);
  const R = WEG.steuern('ruecklage');
  // Umsatzsteuer: laufender Zeitraum, noch nicht angemeldet.
  for (const f of STEUER_FIRMEN) if (ustOffen[f] != null) z.push({ id: `ust-${f}`, einheit: f, titel: 'Umsatzsteuer laufender Zeitraum', betrag: Math.max(0, ustOffen[f]!), formel: 'USt aus Rechnungen − bekannte Vorsteuer', href: WEG.steuern('ust') });
  // Einkommensteuer gemeinsam (privat) und Gewerbesteuer der Selbstständigkeit — aus der Finanzplanung (05.10., EINE Rechenquelle).
  const PLAN = WEG.finanzplanung('privat', 'selbst');
  const zahl = (n: number) => Math.round(n).toLocaleString('de-DE');
  const titelEst = `Einkommensteuer ${jahr} gemeinsam (Gehalt + Selbstständigkeit)`;
  let vorauszahlung: Prognose['vorauszahlung'];
  if (!est) {
    z.push({ id: 'est', einheit: 'privat', titel: titelEst, betrag: null, formel: 'Finanzplanung › Selbstständigkeit › Einkommensteuer gemeinsam', luecke: `Die Finanzplanung rechnet ${jahr} nicht (kein Plan oder Jahr außerhalb des Plans) — keine Schätzung`, href: PLAN });
    if (e.kdc.gewerbe) z.push({ id: 'gewst-kdc', einheit: 'kdc', titel: `Gewerbesteuer ${jahr}`, betrag: null, formel: '(Gewinn − Freibetrag) × Messzahl × Hebesatz, aus der Finanzplanung', luecke: `Die Finanzplanung rechnet ${jahr} nicht — keine Schätzung`, href: PLAN });
    // Ohne Finanzplanung bleibt die Steuer-Einstellung die Quelle der Vorauszahlungen (hier nur benannt — ohne Plan gibt es keinen Betrag).
    const vEst = gezahlt(e.vorauszahlung.est, VZ_EST_KST), vGew = gezahlt(e.vorauszahlung.gewstKdc, VZ_GEWST);
    vorauszahlung = { quelle: vEst || vGew ? 'einstellungen' : 'keine', est: vEst, gewst: vGew };
  } else {
    // Mehrsteuer über der Lohnsteuer (die steckt in der Netto-Tabelle) nach Anrechnung § 35, mit Soli und Handwert-Korrekturen der Finanzplanung
    // (`summe` = Steuer des Jahres wie in Rücklage und Zahlung, ohne die Gewerbesteuer) — minus die Vorauszahlungen.
    // EINE Quelle (05.10. abends, Kevin): mit Finanzplanung zählen NUR deren Vorauszahlungen (`est.vorausgezahlt` — Einkommen- und
    // Gewerbesteuer zusammen, wie Rücklage und Abschlusszahlung dort), zuerst auf die Einkommensteuer, der Rest auf die Gewerbesteuer.
    // Die Beträge der Steuer-Einstellungen zählen dann nicht (sonst Doppelabzug) — sie stehen nur noch als Hinweis da.
    const estSoll = est.summe - est.gewst;
    const vzPlan = Math.max(0, Number.isFinite(est.vorausgezahlt) ? est.vorausgezahlt : 0);
    const vzEst = Math.min(Math.max(0, estSoll), vzPlan);
    const vzGew = est.gewerbe ? Math.min(Math.max(0, est.gewst), vzPlan - vzEst) : 0;
    const ungenutztEst = gezahlt(e.vorauszahlung.est, VZ_EST_KST), ungenutztGew = gezahlt(e.vorauszahlung.gewstKdc, VZ_GEWST);
    vorauszahlung = { quelle: 'finanzplanung', est: vzEst, gewst: vzGew, ...(ungenutztEst || ungenutztGew ? { ungenutzt: { ...(ungenutztEst ? { est: ungenutztEst } : {}), ...(ungenutztGew ? { gewstKdc: ungenutztGew } : {}) } } : {}) };
    const quelleText = 'Vorauszahlungen laut Finanzplanung (Selbstständigkeit › „Vorauszahlungen schon bezahlt“ + Quartalszahlungen im Plan)';
    z.push({ id: 'est', einheit: 'privat', titel: titelEst, betrag: Math.max(0, estSoll - vzEst),
      formel: `zvE ${zahl(est.zve)} € (Gewinn ${zahl(est.gewinn)} € + Lohneinkünfte ${zahl(est.lohn)} €${est.splitting ? ', Splitting' : ''}) → Mehrsteuer ${zahl(est.est)} €${est.anrechnung ? ` − ${zahl(est.anrechnung)} € Anrechnung § 35` : ''}${est.soli ? ` + ${zahl(est.soli)} € Soli` : ''}${est.korr ? ` ${est.korr > 0 ? '+' : '−'} ${zahl(Math.abs(est.korr))} € von Hand` : ''} − ${zahl(vzEst)} € ${quelleText} · Finanzplanung${est.plan ? ` „${est.plan}“` : ''}`, href: PLAN });
    if (est.gewerbe) {
      z.push({ id: 'gewst-kdc', einheit: 'kdc', titel: `Gewerbesteuer ${jahr}`, betrag: Math.max(0, est.gewst - vzGew),
        formel: `(${zahl(est.gewinn)} € Gewinn − ${zahl(est.freibetrag)} € Freibetrag) × Messzahl × ${zahl(est.hebesatz)} % Hebesatz = ${zahl(est.gewst)} € − ${zahl(vzGew)} € ${vzGew ? 'Rest der ' : ''}${quelleText} (bis zum ${est.anrechnungFaktor}-fachen Messbetrag auf die Einkommensteuer angerechnet)`, href: PLAN });
    }
  }
  // Kapitalgesellschaften (KD Ventures, seit 15.10. auch die Hauptgesellschaft): Körperschaftsteuer + Soli, Gewerbesteuer — EINE Rechnung je Firma.
  for (const firma of KAPITAL_FIRMEN) {
    const f = e[firma];
    // KD Ventures behält ihre Kennung `kst` (älterer Stand, Tests, Links) — die Hauptgesellschaft heißt `kst-ug`.
    const id = firma === 'kdv' ? 'kst' : `kst-${firma}`;
    const titel = `Körperschaft- und Gewerbesteuer ${jahr}`;
    // Nur als Kapitalgesellschaft (Rechtsform aus der Finanzplanung; seit 17.10., L2 E2, für beide Gesellschaften).
    if (!istKapital(f)) {
      z.push({ id, einheit: firma, titel, betrag: null, formel: 'Körperschaftsteuer nur für Kapitalgesellschaften', luecke: `Rechtsform ${EINHEIT_LABEL[firma]} laut Finanzplanung: keine Kapitalgesellschaft — dort unter „Welche Steuern gelten?“ prüfen`, href: steuerWegFuer(firma).href });
      continue;
    }
    const gv = gewinn[firma] ?? null;
    const s = f.saetze;
    const kstSatz = s ? s.kst * (1 + s.soli) : 0.15825;
    const gewSatz = !f.gewerbe ? 0 : s ? s.messzahl * s.hebesatz / 100 : 0.035 * e.hebesatz / 100;
    const formel = s
      ? `Gewinn × (${prozent(kstSatz)} % KSt+Soli${f.gewerbe ? ` + ${prozent(gewSatz)} % GewSt (Messzahl ${prozent(s.messzahl)} % × Hebesatz ${zahl(s.hebesatz)} %)` : ''}) — Sätze aus der Finanzplanung${s.plan ? ` „${s.plan}“` : ''}`
      : `Gewinn × (15,825 % KSt+Soli${f.gewerbe ? ` + ${prozent(gewSatz)} % GewSt` : ''})`;
    if (!gv) { z.push({ id, einheit: firma, titel, betrag: null, formel, luecke: `Ist-Monate ${EINHEIT_LABEL[firma]} fehlen`, href: WEG.abschluss(firma) }); continue; }
    const kst = Math.max(0, gv.hochgerechnet) * kstSatz;
    const gew = Math.max(0, gv.hochgerechnet) * gewSatz;
    const vz = firma === 'ug'
      ? gezahlt(e.vorauszahlung.kstUg, VZ_EST_KST) + gezahlt(e.vorauszahlung.gewstUg, VZ_GEWST)
      : gezahlt(e.vorauszahlung.kst, VZ_EST_KST) + gezahlt(e.vorauszahlung.gewstKdv, VZ_GEWST);
    z.push({ id, einheit: firma, titel, betrag: Math.max(0, kst + gew - vz), formel: `${zahl(gv.hochgerechnet)} € ${formel} − ${zahl(vz)} € Vorauszahlungen`, href: R });
  }
  for (const zl of z) zl.href = hrefImBereich(zl.href, zl.einheit);
  const je = Object.fromEntries(FINANZ_ORT_IDS.map(x => {
    const soll = z.filter(y => y.einheit === x).reduce((s, y) => s + (y.betrag ?? 0), 0);
    const ist = e.ruecklageIst[x] ?? null;
    return [x, { soll, ist, deckung: ist != null && soll > 0 ? ist / soll : ist != null ? 1 : null }];
  })) as Prognose['je'];
  return { jahr, zeilen: z, je, vorauszahlung };
}

// ── 4 · Belege ──────────────────────────────────────────────────────────────

export interface BelegPunkt { id: string; titel: string; unter: string; wert?: string; href: string; art: 'pflichtangabe' | 'beleg' | 'eingangsrechnung'; faellig?: string; belegId?: string; stand?: number }

export function belegPunkte(rechnungen: (Rechnung & { firmaId?: string })[], belege: Beleg[], heute: string): BelegPunkt[] {
  const raus: BelegPunkt[] = [];
  // Nur, was noch in eine offene Anmeldung oder die nächste Jahreserklärung fällt: die letzten 13 Monate (ohne Datum: immer).
  const grenze = tagPlus(heute, -400);
  for (const r of rechnungen.filter(x => (x.status === 'gestellt' || x.status === 'bezahlt') && (!x.datum || x.datum >= grenze))) {
    const fehlt = [!r.nummer && 'Rechnungsnummer', !r.datum && 'Rechnungsdatum', r.ustSatz == null && r.netto == null && 'USt-Satz', !r.leistungVon && 'Leistungszeitraum'].filter(Boolean) as string[];
    if (fehlt.length) raus.push({ id: `r-${r.id}`, titel: `${r.kunde}${r.nummer ? ` · ${r.nummer}` : ''}`, unter: `fehlt: ${fehlt.join(', ')}`, wert: `${Math.round(r.betrag).toLocaleString('de-DE')} €`, href: WEG.rechnung(r.id), art: 'pflichtangabe' });
  }
  for (const b of belege.filter(x => x.einheit !== 'privat' && !x.erledigt)) {
    raus.push({
      id: `b-${b.id}`, titel: b.art === 'beleg' ? `Beleg fehlt: ${b.bezeichnung}` : `${b.empfaenger || b.bezeichnung}`,
      unter: `${EINHEIT_LABEL[b.einheit] ?? b.einheit}${b.faellig_am ? ` · ${b.faellig_am < heute ? 'überfällig seit' : 'fällig'} ${deutsch(b.faellig_am)}` : ''}${b.verursacher ? ` · ${b.verursacher}` : ''}`,
      ...(b.betrag ? { wert: `${(b.betrag / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €` } : {}),
      href: WEG.steuern('ust'), art: b.art === 'beleg' ? 'beleg' : 'eingangsrechnung', ...(b.faellig_am ? { faellig: b.faellig_am } : {}), belegId: b.id, stand: b.stand,
    });
  }
  return raus.sort((a, b) => (a.faellig ?? '9').localeCompare(b.faellig ?? '9'));
}

// ── 5 · Übergabe an den Steuerberater ───────────────────────────────────────

export type PunktStatus = 'ok' | 'offen' | 'hand';
export interface UebergabePunkt { key: string; titel: string; unter: string; status: PunktStatus; abgehakt: { am: string; von: string } | null; href?: string; /** Jahres-Punkte: zu welcher Einheit (05.10., für die Bereichs-Sicht). */ einheit?: Einheit }

export function uebergabeMonat(monat: string, x: {
  rechnungen: (Rechnung & { firmaId?: string })[]; belege: Beleg[]; abschluesse: { firma: string; monat: string }[]; buchungsMonate: string[];
  abgehakt: Record<string, { am: string; von: string }>;
}): UebergabePunkt[] {
  const ende = letzterTag(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)));
  const imMonat = x.rechnungen.filter(r => (r.status === 'gestellt' || r.status === 'bezahlt') && r.datum?.startsWith(monat));
  const unvollstaendig = imMonat.filter(r => !r.nummer || (r.ustSatz == null && r.netto == null));
  const belegeOffen = x.belege.filter(b => b.einheit !== 'privat' && !b.erledigt && b.art === 'beleg' && (!b.faellig_am || b.faellig_am <= ende));
  // Monatsabschluss (Business-Index) gibt es seit 05.10. nur für die Business-Gesellschaften — die Selbstständigkeit gehört zu Privat.
  const pflicht = STEUER_FIRMEN.filter(f => bereichVon(f) === 'business');
  const abschluss = pflicht.filter(f => x.abschluesse.some(a => a.firma === f && a.monat === monat));
  const k = (id: string) => `m:${monat}:${id}`;
  const p = (id: string, titel: string, unter: string, abgeleitet: PunktStatus, href?: string): UebergabePunkt => {
    const h = x.abgehakt[k(id)] ?? null;
    return { key: k(id), titel, unter, status: h ? 'ok' : abgeleitet, abgehakt: h, ...(href ? { href } : {}) };
  };
  return [
    p('konto', 'Kontoauszüge der Geschäftskonten vollständig', x.buchungsMonate.includes(monat) ? 'Buchungen für den Monat sind da' : 'keine Geschäftsbuchungen in MAKE OS — im Bankzugang des Steuerberaters prüfen und abhaken', x.buchungsMonate.includes(monat) ? 'ok' : 'hand', WEG.buchungen()),
    p('rechnungen', 'Ausgangsrechnungen vollständig', imMonat.length ? (unvollstaendig.length ? `${unvollstaendig.length} von ${imMonat.length} ohne Nummer oder USt-Satz` : `${imMonat.length} Rechnungen mit Nummer und USt-Satz`) : 'keine Rechnung mit Datum in diesem Monat', unvollstaendig.length ? 'offen' : 'ok', unvollstaendig[0] ? WEG.rechnung(unvollstaendig[0].id) : WEG.rechnungen()),
    p('belege', 'Eingangsbelege vollständig', belegeOffen.length ? `${belegeOffen.length} Beleg${belegeOffen.length === 1 ? '' : 'e'} fehlen noch` : 'kein fehlender Beleg bis Monatsende', belegeOffen.length ? 'offen' : 'ok', WEG.steuern('ust')),
    p('abschluss', 'Monatsabschluss eingetragen', abschluss.length === pflicht.length && pflicht.length ? pflicht.map(f => EINHEIT_LABEL[f]).join(' und ') : abschluss.length ? `nur ${abschluss.map(f => EINHEIT_LABEL[f]).join(', ')}` : 'noch keiner', abschluss.length === pflicht.length ? 'ok' : 'offen', WEG.abschluss()),
    p('abgleich', 'Offene Posten abgeglichen', 'Forderungen und Verbindlichkeiten mit dem Konto verglichen', 'hand', WEG.rechnungen()),
    p('uebergeben', 'An den Steuerberater übergeben', 'Belege hochgeladen bzw. Freigabe erteilt', 'hand'),
  ];
}

export const JAHRES_PUNKTE: { id: string; titel: string; unter: string; einheit: Einheit }[] = [
  { id: 'anlagen', titel: 'Anlagenverzeichnis und Anschaffungen', unter: 'Rechnungen über 800 € netto, Leasing', einheit: 'kdc' },
  { id: 'darlehen', titel: 'Darlehen und Zinsbescheinigungen', unter: 'Business-Kredite, Jahreskontoauszüge', einheit: 'kdc' },
  { id: 'entnahmen', titel: 'Privatentnahmen und -einlagen', unter: 'Summe je Monat, Abgleich mit dem Privatkonto', einheit: 'kdc' },
  { id: 'kfz', titel: 'Fahrzeug: Fahrtenbuch oder 1-%-Regel', unter: 'Kosten, Kilometer, Nutzung', einheit: 'kdc' },
  { id: 'jahresabschluss', titel: `${EINHEIT_LABEL.kdv}: Unterlagen Jahresabschluss`, unter: 'Saldenlisten, Verträge, Gesellschafterbeschlüsse', einheit: 'kdv' },
  // 15.10.: die Hauptgesellschaft wie KD Ventures.
  { id: 'jahresabschluss-ug', titel: `${EINHEIT_LABEL.ug}: Unterlagen Jahresabschluss`, unter: 'Saldenlisten, Verträge, Gesellschafterbeschlüsse', einheit: 'ug' },
  { id: 'versicherungen', titel: 'Versicherungen und Vorsorge', unter: 'Kranken-, Pflege-, Renten-, Haftpflichtbeiträge', einheit: 'privat' },
  { id: 'sonderausgaben', titel: 'Spenden, Handwerker, Haushaltsnahes', unter: 'Belege und Rechnungen mit Arbeitslohn-Anteil', einheit: 'privat' },
  { id: 'bescheide', titel: 'Steuerbescheide und Vorauszahlungen', unter: 'letzte Bescheide, geänderte Vorauszahlungen', einheit: 'privat' },
];

/** Jahres-Punkte; `seit` (Gründungstage, 15.10.) lässt Punkte einer Gesellschaft weg, die es im Jahr noch nicht gab. */
export function uebergabeJahr(jahr: number, abgehakt: Record<string, { am: string; von: string }>, seit: Partial<Record<Einheit, string | undefined>> = {}): UebergabePunkt[] {
  return JAHRES_PUNKTE.filter(p => !(seit[p.einheit] && Number(seit[p.einheit]!.slice(0, 4)) > jahr)).map(p => {
    const key = `j:${jahr}:${p.id}`;
    const h = abgehakt[key] ?? null;
    return { key, titel: p.titel, unter: `${EINHEIT_LABEL[p.einheit]} · ${p.unter}`, status: h ? 'ok' : 'hand', abgehakt: h, einheit: p.einheit };
  });
}


// ── 6 · Bereichs-Sicht (05.10.) ─────────────────────────────────────────────
// Kevin: „Selbstständigkeit raus aus Business“ — die Steuer-Seite gibt es unter Privat (alles: Privat, Selbstständigkeit und die
// Gesellschaften — Privat sieht Business) und unter Business (nur die Business-Gesellschaften). Der Server filtert, BEVOR die Antwort
// hinausgeht (GET /api/steuern?space=business); was die Business-Sicht nicht trägt, wird nicht nur versteckt.

/** Was eine Bereichs-Sicht von der Steuer-Seite braucht (Teilmenge von `steuernStand`). */
export interface SteuerSichtTeile {
  einstellungen: SteuerEinstellungen; fristen: Frist[]; ust: UstZeitraum[]; prognose: Prognose;
  gewinn: Partial<Record<SteuerFirma, Jahresgewinn | null>>; uebergabe: { monat: string; punkte: UebergabePunkt[]; jahr: number; jahresPunkte: UebergabePunkt[] };
}

/**
 * Die Business-Sicht: Fristen, Umsatzsteuer, Prognose-Zeilen, Rücklage-Werte, Gewinne und Jahres-Punkte nur der Business-Gesellschaften;
 * Einstellungen ohne Privates (Steuerquote, ESt- und Selbstständigkeits-Vorauszahlungen, Rücklage Privat/Selbstständigkeit; die Firmen-
 * Einstellungen der Selbstständigkeit und Privat stehen auf der Vorgabe). Belege und Monats-Übergabe filtert der Aufrufer an der Quelle.
 */
export function steuernNurBusiness<T extends SteuerSichtTeile>(st: T): T {
  const biz = (x: string) => bereichVon(x) === 'business';
  const je = Object.fromEntries(Object.entries(st.prognose.je).map(([k, v]) => [k, biz(k) ? v : { soll: 0, ist: null, deckung: null }])) as Prognose['je'];
  const e = st.einstellungen;
  const vz = Object.fromEntries(Object.entries(e.vorauszahlung).filter(([k]) => (k === 'kst' || k === 'gewstKdv' ? biz('kdv') : k === 'kstUg' || k === 'gewstUg' ? biz('ug') : false))) as SteuerEinstellungen['vorauszahlung'];
  const ruecklageIst = Object.fromEntries(Object.entries(e.ruecklageIst).filter(([k]) => biz(k))) as SteuerEinstellungen['ruecklageIst'];
  // Einstellungen der Privat-Einheiten (Selbstständigkeit, Privat) gehen gar nicht hinaus (17.10., Abnahme 3 · B9) — vorher stand dort die Vorgabe
  // (Einzelunternehmen, Ist-Versteuerung, ESt-Vorauszahlung), die wie private Steuermerkmale aussah. Die Business-Ansicht liest sie nie.
  const einstellungen = { ...e, kdc: { ...STANDARD_STEUERN.kdc }, privat: { ...STANDARD_STEUERN.privat }, steuerquote: null, vorauszahlung: vz, ruecklageIst } as Partial<SteuerEinstellungen>;
  if (!biz('kdc')) delete einstellungen.kdc; // die Ansicht liest die Selbstständigkeit nur unter Privat
  delete einstellungen.privat;
  return {
    ...st,
    einstellungen: einstellungen as SteuerEinstellungen,
    fristen: st.fristen.filter(f => biz(f.einheit)),
    ust: st.ust.filter(u => biz(u.firma)),
    // Vorauszahlungen (05.10. abends): die Einkommensteuer ist privat — in der Business-Sicht nie; die Gewerbesteuer der Selbstständigkeit nur,
    // wenn diese Instanz sie im Business führt.
    prognose: { ...st.prognose, zeilen: st.prognose.zeilen.filter(z => biz(z.einheit)), je, vorauszahlung: biz('kdc') ? { quelle: st.prognose.vorauszahlung.quelle, est: 0, gewst: st.prognose.vorauszahlung.gewst } : { quelle: 'keine', est: 0, gewst: 0 } },
    gewinn: Object.fromEntries(Object.entries(st.gewinn).filter(([k]) => biz(k))),
    uebergabe: { ...st.uebergabe, jahresPunkte: st.uebergabe.jahresPunkte.filter(p => !p.einheit || biz(p.einheit)) },
  };
}


/**
 * Darf die Business-Sicht diese Änderung schreiben? (05.10.) Nein für Privat und die Privat-Einheiten (Selbstständigkeit): deren
 * Firmen-Einstellungen, Steuerquote, ESt-/Selbstständigkeits-Vorauszahlungen, Rücklage, Beleg-Erledigung und Frist-/Jahres-Punkte.
 * Liefert null (erlaubt) oder den Grund.
 */
export function businessSchreibenErlaubt(roh: Record<string, unknown>): string | null {
  const privatE = (x: string) => bereichVon(x) === 'privat';
  const e = (roh.einstellungen ?? null) as Record<string, unknown> | null;
  if (e) {
    for (const k of Object.keys(e)) {
      if (k === 'privat' || k === 'steuerquote' || ((k === 'kdc' || k === 'kdv' || k === 'ug') && privatE(k))) return 'Diese Einstellung gehört zu Privat.';
    }
    const vz = (e.vorauszahlung ?? {}) as Record<string, unknown>;
    if ('est' in vz || ('gewstKdc' in vz && privatE('kdc')) || (('gewstKdv' in vz || 'kst' in vz) && privatE('kdv')) || (('gewstUg' in vz || 'kstUg' in vz) && privatE('ug'))) return 'Diese Vorauszahlung gehört zu Privat.';
    const rl = (e.ruecklageIst ?? {}) as Record<string, unknown>;
    if (Object.keys(rl).some(privatE)) return 'Diese Rücklage gehört zu Privat.';
  }
  if (roh.belegErledigt) return 'Belege erledigen geht in der Privat-Sicht der Steuern.';
  const ab = roh.abhaken as { key?: unknown } | undefined;
  if (ab && typeof ab.key === 'string') {
    // f:<einheit>-… (Frist) · j:<jahr>:<punkt> (Jahres-Punkt mit Einheit) · m:<monat>:… (Monats-Übergabe, Business)
    if (ab.key.startsWith('f:') && privatE(ab.key.slice(2).split('-')[0])) return 'Diese Frist gehört zu Privat.';
    if (ab.key.startsWith('j:')) {
      const punkt = JAHRES_PUNKTE.find(p => p.id === ab.key!.toString().split(':')[2]);
      if (!punkt || privatE(punkt.einheit)) return 'Dieser Punkt gehört zu Privat.';
    }
  }
  return null;
}
