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
import type { Beleg } from '@/lib/finanzen/haushalt/typen';
import { WEG } from '@/lib/wege';

export type Einheit = 'kdc' | 'kdv' | 'privat';
export const EINHEIT_LABEL: Record<Einheit, string> = { kdc: 'Consulting', kdv: 'KD Ventures', privat: 'Privat' };

export interface FirmaSteuer {
  rechtsform: 'freiberuf' | 'einzel' | 'ug' | 'gmbh';
  ust: UstRhythmus;
  dauerfrist: boolean;
  /** Ist-Versteuerung (USt, wenn das Geld kommt) — sonst Soll (bei Rechnungsstellung). */
  istVersteuerung: boolean;
  /** Gewerbesteuerpflichtig (Kapitalgesellschaft immer; Freiberufler nie). */
  gewerbe: boolean;
}
export interface SteuerEinstellungen {
  mitBerater: boolean;
  kdc: FirmaSteuer;
  kdv: FirmaSteuer;
  privat: { estVorauszahlung: boolean };
  /** Vorauszahlungen je Quartal laut Bescheid (Euro). */
  vorauszahlung: { est?: number; kst?: number; gewstKdc?: number; gewstKdv?: number };
  /** Durchschnittlicher ESt-Satz auf den Gewinn aus Consulting (Prozent) — eure Annahme. */
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
  kdc: { rechtsform: 'freiberuf', ust: 'quartal', dauerfrist: false, istVersteuerung: true, gewerbe: false },
  kdv: { rechtsform: 'ug', ust: 'quartal', dauerfrist: false, istVersteuerung: false, gewerbe: true },
  privat: { estVorauszahlung: true },
  vorauszahlung: {},
  steuerquote: null,
  hebesatz: 410,
  ruecklageIst: {},
  vorlaufTage: 7,
};

export const HINWEIS = 'Hinweis, keine Steuerberatung — Termine gerechnet, Beträge geschätzt. Verbindlich sind Bescheid und Steuerberater.';

// ── Hilfen ──────────────────────────────────────────────────────────────────

const tagPlus = (t: string, n: number) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const tageBis = (von: string, bis: string) => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 86_400_000);
const letzterTag = (j: number, m: number) => new Date(Date.UTC(j, m, 0, 12)).toISOString().slice(0, 10);
const deutsch = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;
const istKapital = (f: FirmaSteuer) => f.rechtsform === 'ug' || f.rechtsform === 'gmbh';

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
    raus.push({ ...f, id, einheit, tage: tageBis(heute, f.datum), aufgabeAb: tagPlus(f.datum, -e.vorlaufTage), erledigt: !!erledigt[`f:${id}`] });
  };
  for (const firma of ['kdc', 'kdv'] as const) {
    const f = e[firma];
    const kap = istKapital(f);
    for (const t of steuertermine(von, bis, { ust: f.ust, dauerfrist: f.dauerfrist, estVorauszahlung: false, gewstVorauszahlung: f.gewerbe, kstVorauszahlung: kap })) {
      const betrag = t.art === 'kst' ? e.vorauszahlung.kst : t.art === 'gewst' ? (firma === 'kdc' ? e.vorauszahlung.gewstKdc : e.vorauszahlung.gewstKdv) : undefined;
      dazu(firma, { datum: t.datum, art: t.art, titel: t.titel, hinweis: t.hinweis, ...(betrag ? { betrag } : {}), href: t.art === 'ust' || t.art === 'ust-sv' ? WEG.steuern('ust') : WEG.steuern('ruecklage') });
    }
    for (let j = Number(heute.slice(0, 4)) - 2; j <= Number(heute.slice(0, 4)); j++) {
      const frist = erklaerungsFrist(j, e.mitBerater);
      const was = kap
        ? ['Körperschaftsteuer', 'Gewerbesteuer', 'Umsatzsteuer', 'Jahresabschluss (E-Bilanz)']
        : ['Einnahmenüberschussrechnung (EÜR)', 'Umsatzsteuer', ...(f.gewerbe ? ['Gewerbesteuer'] : [])];
      dazu(firma, { datum: frist, art: 'erklaerung', titel: `Jahreserklärungen ${j}`, hinweis: `${was.join(', ')}${e.mitBerater ? ' — Frist mit Steuerberater' : ''}`, href: WEG.steuern('uebergabe') });
      if (kap) dazu(firma, { datum: werktag(`${j + 1}-12-31`), art: 'offenlegung', titel: `Offenlegung Jahresabschluss ${j}`, hinweis: 'Unternehmensregister, 12 Monate nach Geschäftsjahresende (§ 325 HGB)', href: WEG.steuern('uebergabe') });
    }
  }
  if (e.privat.estVorauszahlung) for (const t of steuertermine(von, bis, { ust: 'keine', dauerfrist: false, estVorauszahlung: true, gewstVorauszahlung: false })) {
    dazu('privat', { datum: t.datum, art: 'est', titel: t.titel, hinweis: 'enthält die Steuer auf den Gewinn aus Consulting', ...(e.vorauszahlung.est ? { betrag: e.vorauszahlung.est } : {}), href: WEG.steuern('ruecklage') });
  }
  for (let j = Number(heute.slice(0, 4)) - 2; j <= Number(heute.slice(0, 4)); j++) {
    dazu('privat', { datum: erklaerungsFrist(j, e.mitBerater), art: 'erklaerung', titel: `Einkommensteuererklärung ${j}`, hinweis: `Kevin & Malin${e.mitBerater ? ' — Frist mit Steuerberater' : ''}`, href: WEG.steuern('uebergabe') });
  }
  return raus.sort((a, b) => a.datum.localeCompare(b.datum) || a.einheit.localeCompare(b.einheit));
}

// ── 2 · Umsatzsteuer ────────────────────────────────────────────────────────

export interface UstRechnung { id: string; kunde: string; nummer?: string; datum?: string; brutto: number; ust: number; satz: number; angenommen: boolean }
export interface UstZeitraum {
  firma: 'kdc' | 'kdv'; label: string; von: string; bis: string; faellig: string | null;
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

export function ustZeitraum(firma: 'kdc' | 'kdv', f: FirmaSteuer, zr: { label: string; von: string; bis: string }, rechnungen: (Rechnung & { firmaId?: string })[], grund: Grundlagenteil | null, faellig: string | null): UstZeitraum {
  const eigene = rechnungen.filter(r => (r.firmaId ?? 'kdc') === firma && (r.status === 'gestellt' || r.status === 'bezahlt'));
  const liste: UstRechnung[] = [];
  for (const r of eigene) {
    const tag = f.istVersteuerung ? (r.status === 'bezahlt' ? r.bezahltAm : undefined) : r.datum;
    if (!tag || tag < zr.von || tag > zr.bis) continue;
    const satz = r.ustSatz ?? 19;
    const netto = r.netto ?? r.betrag / (1 + satz / 100);
    liste.push({ id: r.id, kunde: r.kunde, ...(r.nummer ? { nummer: r.nummer } : {}), ...(r.datum ? { datum: r.datum } : {}), brutto: r.betrag, ust: r.betrag - netto, satz, angenommen: r.ustSatz == null && r.netto == null });
  }
  const ust = liste.reduce((s, x) => s + x.ust, 0);
  let vorsteuer: number | null = null, vorsteuerQuelle = 'keine Eingangsbelege mit Vorsteuer in MAKE OS';
  if (grund) {
    const posten = firma === 'kdc' ? grund.kosten : grund.ugRechnungen;
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
}
export interface Jahresgewinn { gewinn: number; monate: number; hochgerechnet: number; quelle: string }

/** Jahresgewinn aus den Ist-Monaten dieses Jahres, auf 12 Monate hochgerechnet. */
export function jahresgewinn(ist: { monat: string; umsatz: number; kosten: number; quelle: string }[], jahr: number): Jahresgewinn | null {
  const l = ist.filter(m => m.monat.startsWith(String(jahr)));
  if (!l.length) return null;
  const g = l.reduce((s, m) => s + m.umsatz - m.kosten, 0);
  return { gewinn: g, monate: l.length, hochgerechnet: (g / l.length) * 12, quelle: `${l.length} Ist-Monate ${jahr} (${Array.from(new Set(l.flatMap(m => m.quelle.split(' + ')))).join(', ')})` };
}

/** Vorauszahlungen dieses Jahres, die bis heute fällig waren. */
const vzBisHeute = (heute: string, monate: number[]) => monate.filter(m => `${heute.slice(0, 4)}-${String(m).padStart(2, '0')}-10` <= heute).length;

export function prognose(e: SteuerEinstellungen, heute: string, gewinn: { kdc: Jahresgewinn | null; kdv: Jahresgewinn | null }, ustOffen: Partial<Record<'kdc' | 'kdv', number>>): Prognose {
  const jahr = Number(heute.slice(0, 4));
  const z: PrognoseZeile[] = [];
  const e4 = (n?: number) => (n ?? 0) * 4;
  const gezahlt = (n: number | undefined, monate: number[]) => (n ?? 0) * vzBisHeute(heute, monate);
  const R = WEG.steuern('ruecklage');
  // Umsatzsteuer: laufender Zeitraum, noch nicht angemeldet.
  for (const f of ['kdc', 'kdv'] as const) if (ustOffen[f] != null) z.push({ id: `ust-${f}`, einheit: f, titel: 'Umsatzsteuer laufender Zeitraum', betrag: Math.max(0, ustOffen[f]!), formel: 'USt aus Rechnungen − bekannte Vorsteuer', href: WEG.steuern('ust') });
  // Einkommensteuer auf den Consulting-Gewinn (privat).
  const gk = gewinn.kdc;
  if (!gk) z.push({ id: 'est', einheit: 'privat', titel: `Einkommensteuer ${jahr} (Anteil Consulting)`, betrag: null, formel: 'Gewinn × Steuerquote − Vorauszahlungen', luecke: 'Ist-Monate Consulting fehlen', href: WEG.abschluss('kdc') });
  else if (e.steuerquote == null) z.push({ id: 'est', einheit: 'privat', titel: `Einkommensteuer ${jahr} (Anteil Consulting)`, betrag: null, formel: 'Gewinn × Steuerquote − Vorauszahlungen', luecke: 'Steuerquote fehlt (Einstellungen unten)', href: `${R}` });
  else {
    const steuer = Math.max(0, gk.hochgerechnet) * e.steuerquote / 100;
    const offen = steuer - gezahlt(e.vorauszahlung.est, [3, 6, 9, 12]);
    z.push({ id: 'est', einheit: 'privat', titel: `Einkommensteuer ${jahr} (Anteil Consulting)`, betrag: Math.max(0, offen), formel: `${Math.round(gk.hochgerechnet).toLocaleString('de-DE')} € Gewinn (hochgerechnet) × ${e.steuerquote} % = ${Math.round(steuer).toLocaleString('de-DE')} € − ${Math.round(gezahlt(e.vorauszahlung.est, [3, 6, 9, 12])).toLocaleString('de-DE')} € gezahlte Vorauszahlungen${e.vorauszahlung.est ? ` (Jahr: ${Math.round(e4(e.vorauszahlung.est)).toLocaleString('de-DE')} €)` : ''}`, href: R });
  }
  if (e.kdc.gewerbe && gk) {
    const gew = Math.max(0, gk.hochgerechnet - 24_500) * 0.035 * e.hebesatz / 100;
    z.push({ id: 'gewst-kdc', einheit: 'kdc', titel: `Gewerbesteuer ${jahr}`, betrag: Math.max(0, gew - gezahlt(e.vorauszahlung.gewstKdc, [2, 5, 8, 11])), formel: `(Gewinn − 24.500 € Freibetrag) × 3,5 % × ${e.hebesatz} % Hebesatz − Vorauszahlungen (wird größtenteils auf die ESt angerechnet)`, href: R });
  }
  // KD Ventures: Körperschaftsteuer + Soli, Gewerbesteuer.
  const gv = gewinn.kdv;
  if (!gv) z.push({ id: 'kst', einheit: 'kdv', titel: `Körperschaft- und Gewerbesteuer ${jahr}`, betrag: null, formel: 'Gewinn × (15,825 % + 3,5 % × Hebesatz)', luecke: 'Ist-Monate KD Ventures fehlen', href: WEG.abschluss('kdv') });
  else {
    const kst = Math.max(0, gv.hochgerechnet) * 0.15825;
    const gew = e.kdv.gewerbe ? Math.max(0, gv.hochgerechnet) * 0.035 * e.hebesatz / 100 : 0;
    const vz = gezahlt(e.vorauszahlung.kst, [3, 6, 9, 12]) + gezahlt(e.vorauszahlung.gewstKdv, [2, 5, 8, 11]);
    z.push({ id: 'kst', einheit: 'kdv', titel: `Körperschaft- und Gewerbesteuer ${jahr}`, betrag: Math.max(0, kst + gew - vz), formel: `${Math.round(gv.hochgerechnet).toLocaleString('de-DE')} € Gewinn × (15,825 % KSt+Soli${e.kdv.gewerbe ? ` + ${(3.5 * e.hebesatz / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} % GewSt` : ''}) − ${Math.round(vz).toLocaleString('de-DE')} € Vorauszahlungen`, href: R });
  }
  const je = Object.fromEntries((['kdc', 'kdv', 'privat'] as Einheit[]).map(x => {
    const soll = z.filter(y => y.einheit === x).reduce((s, y) => s + (y.betrag ?? 0), 0);
    const ist = e.ruecklageIst[x] ?? null;
    return [x, { soll, ist, deckung: ist != null && soll > 0 ? ist / soll : ist != null ? 1 : null }];
  })) as Prognose['je'];
  return { jahr, zeilen: z, je };
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
      unter: `${b.einheit === 'ug' ? 'KD Ventures' : 'Consulting'}${b.faellig_am ? ` · ${b.faellig_am < heute ? 'überfällig seit' : 'fällig'} ${deutsch(b.faellig_am)}` : ''}${b.verursacher ? ` · ${b.verursacher}` : ''}`,
      ...(b.betrag ? { wert: `${(b.betrag / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €` } : {}),
      href: WEG.steuern('ust'), art: b.art === 'beleg' ? 'beleg' : 'eingangsrechnung', ...(b.faellig_am ? { faellig: b.faellig_am } : {}), belegId: b.id, stand: b.stand,
    });
  }
  return raus.sort((a, b) => (a.faellig ?? '9').localeCompare(b.faellig ?? '9'));
}

// ── 5 · Übergabe an den Steuerberater ───────────────────────────────────────

export type PunktStatus = 'ok' | 'offen' | 'hand';
export interface UebergabePunkt { key: string; titel: string; unter: string; status: PunktStatus; abgehakt: { am: string; von: string } | null; href?: string }

export function uebergabeMonat(monat: string, x: {
  rechnungen: (Rechnung & { firmaId?: string })[]; belege: Beleg[]; abschluesse: { firma: string; monat: string }[]; buchungsMonate: string[];
  abgehakt: Record<string, { am: string; von: string }>;
}): UebergabePunkt[] {
  const ende = letzterTag(Number(monat.slice(0, 4)), Number(monat.slice(5, 7)));
  const imMonat = x.rechnungen.filter(r => (r.status === 'gestellt' || r.status === 'bezahlt') && r.datum?.startsWith(monat));
  const unvollstaendig = imMonat.filter(r => !r.nummer || (r.ustSatz == null && r.netto == null));
  const belegeOffen = x.belege.filter(b => b.einheit !== 'privat' && !b.erledigt && b.art === 'beleg' && (!b.faellig_am || b.faellig_am <= ende));
  const abschluss = ['kdc', 'kdv'].filter(f => x.abschluesse.some(a => a.firma === f && a.monat === monat));
  const k = (id: string) => `m:${monat}:${id}`;
  const p = (id: string, titel: string, unter: string, abgeleitet: PunktStatus, href?: string): UebergabePunkt => {
    const h = x.abgehakt[k(id)] ?? null;
    return { key: k(id), titel, unter, status: h ? 'ok' : abgeleitet, abgehakt: h, ...(href ? { href } : {}) };
  };
  return [
    p('konto', 'Kontoauszüge der Geschäftskonten vollständig', x.buchungsMonate.includes(monat) ? 'Buchungen für den Monat sind da' : 'keine Geschäftsbuchungen in MAKE OS — im Bankzugang des Steuerberaters prüfen und abhaken', x.buchungsMonate.includes(monat) ? 'ok' : 'hand', '/os/finanzen/buchungen'),
    p('rechnungen', 'Ausgangsrechnungen vollständig', imMonat.length ? (unvollstaendig.length ? `${unvollstaendig.length} von ${imMonat.length} ohne Nummer oder USt-Satz` : `${imMonat.length} Rechnungen mit Nummer und USt-Satz`) : 'keine Rechnung mit Datum in diesem Monat', unvollstaendig.length ? 'offen' : 'ok', unvollstaendig[0] ? WEG.rechnung(unvollstaendig[0].id) : WEG.rechnungen()),
    p('belege', 'Eingangsbelege vollständig', belegeOffen.length ? `${belegeOffen.length} Beleg${belegeOffen.length === 1 ? '' : 'e'} fehlen noch` : 'kein fehlender Beleg bis Monatsende', belegeOffen.length ? 'offen' : 'ok', WEG.steuern('ust')),
    p('abschluss', 'Monatsabschluss eingetragen', abschluss.length === 2 ? 'Consulting und KD Ventures' : abschluss.length ? `nur ${abschluss[0] === 'kdc' ? 'Consulting' : 'KD Ventures'}` : 'noch keiner', abschluss.length === 2 ? 'ok' : 'offen', WEG.abschluss()),
    p('abgleich', 'Offene Posten abgeglichen', 'Forderungen und Verbindlichkeiten mit dem Konto verglichen', 'hand', WEG.rechnungen()),
    p('uebergeben', 'An den Steuerberater übergeben', 'Belege hochgeladen bzw. Freigabe erteilt', 'hand'),
  ];
}

export const JAHRES_PUNKTE: { id: string; titel: string; unter: string; einheit: Einheit }[] = [
  { id: 'anlagen', titel: 'Anlagenverzeichnis und Anschaffungen', unter: 'Rechnungen über 800 € netto, Leasing', einheit: 'kdc' },
  { id: 'darlehen', titel: 'Darlehen und Zinsbescheinigungen', unter: 'Business-Kredite, Jahreskontoauszüge', einheit: 'kdc' },
  { id: 'entnahmen', titel: 'Privatentnahmen und -einlagen', unter: 'Summe je Monat, Abgleich mit dem Privatkonto', einheit: 'kdc' },
  { id: 'kfz', titel: 'Fahrzeug: Fahrtenbuch oder 1-%-Regel', unter: 'Kosten, Kilometer, Nutzung', einheit: 'kdc' },
  { id: 'jahresabschluss', titel: 'KD Ventures: Unterlagen Jahresabschluss', unter: 'Saldenlisten, Verträge, Gesellschafterbeschlüsse', einheit: 'kdv' },
  { id: 'versicherungen', titel: 'Versicherungen und Vorsorge', unter: 'Kranken-, Pflege-, Renten-, Haftpflichtbeiträge', einheit: 'privat' },
  { id: 'sonderausgaben', titel: 'Spenden, Handwerker, Haushaltsnahes', unter: 'Belege und Rechnungen mit Arbeitslohn-Anteil', einheit: 'privat' },
  { id: 'bescheide', titel: 'Steuerbescheide und Vorauszahlungen', unter: 'letzte Bescheide, geänderte Vorauszahlungen', einheit: 'privat' },
];

export function uebergabeJahr(jahr: number, abgehakt: Record<string, { am: string; von: string }>): UebergabePunkt[] {
  return JAHRES_PUNKTE.map(p => {
    const key = `j:${jahr}:${p.id}`;
    const h = abgehakt[key] ?? null;
    return { key, titel: p.titel, unter: `${EINHEIT_LABEL[p.einheit]} · ${p.unter}`, status: h ? 'ok' : 'hand', abgehakt: h };
  });
}
