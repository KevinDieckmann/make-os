// ─── Privat-Index (rein, getestet) ──────────────────────────────────────────
// Kevin (25.09.): „unsere Privaten grundsätzlich an solche KPIs hängen wie im
// Business-Bereich.“ Dieselbe Logik wie der Business-Index (lib/kennzahlen/kern):
// jede Kennzahl mit Schwellen, Ampel, Formel und Quelle, fehlende als
// Messlücke — und hinter jeder die Punkte, aus denen sie besteht, mit Link in
// die Buchungen, Kategorien, Schulden oder Rechnungen.
//
//   Reserve & Liquidität 40 % — wie lange ihr ohne Einkommen durchkommt
//   Ausgaben & Budget    35 % — wofür das Geld geht und ob es im Plan bleibt
//   Vermögen & Schulden  25 % — was aufgebaut und was abgebaut wird
//
// Nur der Haushalt (einheit „privat“), nie Business. Beträge im Haushalt sind
// Cent; die Kennzahlen rechnen in Euro.

import { berechneModell, type KennzahlDefBasis, type SaeuleDef, type Messung, type Detail, type Ampel, type Schwelle, type IndexErgebnis } from '@/lib/kennzahlen/kern';
import type { Buchung, Haushalt, Kategorie, Schuld, Beleg } from '@/lib/finanzen/haushalt/typen';
import { katNamen, summen, artVon, TILGUNG, SPAREN, type KatName } from '@/lib/finanzen/haushalt/einordnung';
import { kennzahlen, schuldenbild, istWert, sollWert, inMonaten } from '@/lib/finanzen/haushalt/kennzahlen';
import { luft } from '@/lib/finanzen/haushalt/fixkosten';
import { vollMonate, monatVon, monatKurz, tageZwischen, tagPlus, datumDe } from '@/lib/finanzen/haushalt/monat';
import { WEG } from '@/lib/wege';

export type PrivatIndex = IndexErgebnis;

export const PRIVAT_SAEULEN: SaeuleDef[] = [
  { id: 'rl', label: 'Reserve & Liquidität', gewicht: 0.4, satz: 'Wie lange ihr ohne Einkommen durchkommt und was jeden Monat übrig bleibt' },
  { id: 'ab', label: 'Ausgaben & Budget', gewicht: 0.35, satz: 'Wofür das Geld geht und ob es im Plan bleibt' },
  { id: 'vs', label: 'Vermögen & Schulden', gewicht: 0.25, satz: 'Was aufgebaut und was abgebaut wird' },
];

const RUECKLAGE = { text: 'Rücklage eintragen', href: WEG.privatIndex('ruecklage') };
const BUCHUNGEN = { text: 'Buchungen öffnen', href: WEG.privat('buchungen') };
const FIXKOSTEN = { text: 'Fixkosten & Budget', href: WEG.privat('fixkosten') };
const SCHULDEN = { text: 'Schulden & Rechnungen', href: WEG.privat('schulden') };

export const PRIVAT_KENNZAHLEN: KennzahlDefBasis[] = [
  // ── Reserve & Liquidität
  { id: 'notgroschen', label: 'Notgroschen', saeule: 'rl', gruppe: 'Reserve', gewicht: 1.5, einheit: 'monate', richtung: 'hoch', gruen: 6, rot: 3,
    formel: 'Rücklage ÷ Sockel (Fixkosten + Raten je Monat)', quelle: 'Rücklage (eingetragen) + Fixkosten der letzten 12 Monate',
    luecke: 'Rücklage ist nicht eingetragen', pflegen: RUECKLAGE },
  { id: 'luft', label: 'Luft pro Monat', saeule: 'rl', gruppe: 'Liquidität', gewicht: 1.25, einheit: 'eur', richtung: 'hoch', gruen: 500, rot: 0,
    formel: 'Ø echtes Einkommen (3 volle Monate) − Sockel', quelle: 'Buchungen (ohne Kredit, ohne Durchlauf)',
    luecke: 'Kein Einkommen in den letzten 3 vollen Monaten', pflegen: BUCHUNGEN },
  { id: 'planbar', label: 'Planbares Einkommen ÷ Sockel', saeule: 'rl', gruppe: 'Liquidität', einheit: 'faktor', richtung: 'hoch', gruen: 1.2, rot: 1,
    formel: 'Ø planbare Einnahmen (Gehalt, Entnahme …) ÷ Sockel', quelle: 'Buchungen nach Einnahme-Topf',
    luecke: 'Keine planbaren Einnahmen oder kein Sockel', pflegen: { text: 'Einnahmen zuordnen', href: WEG.privat('einnahmen') } },
  { id: 'rechnungen', label: 'Überfällige Rechnungen', saeule: 'rl', gruppe: 'Liquidität', einheit: 'anzahl', richtung: 'niedrig', gruen: 0, rot: 1,
    formel: 'Offene private Rechnungen über ihrem Fälligkeitstag', quelle: 'Rechnungen im Haushalt',
    luecke: 'Keine Rechnungen erfasst', pflegen: SCHULDEN },
  // ── Ausgaben & Budget
  { id: 'fixquote', label: 'Fixkostenquote', saeule: 'ab', gruppe: 'Ausgaben', einheit: 'prozent', richtung: 'niedrig', gruen: 50, rot: 70,
    formel: 'Sockel ÷ Ø echtes Einkommen', quelle: 'Fixkosten 12 Monate + Einkommen 3 Monate',
    luecke: 'Einkommen oder Fixkosten fehlen', pflegen: FIXKOSTEN },
  { id: 'konsumquote', label: 'Konsumquote', saeule: 'ab', gruppe: 'Ausgaben', einheit: 'prozent', richtung: 'niedrig', gruen: 30, rot: 45,
    formel: 'Variable Ausgaben ohne Sparen und Tilgung ÷ Einkommen (3 volle Monate)', quelle: 'Buchungen ohne Fixkosten-Markierung',
    luecke: 'Kein Einkommen in den letzten 3 vollen Monaten', pflegen: { text: 'Analyse öffnen', href: WEG.privat('analyse') } },
  { id: 'budget', label: 'Budget-Treue', saeule: 'ab', gruppe: 'Budget', gewicht: 1.25, einheit: 'prozent', richtung: 'hoch', gruen: 80, rot: 60,
    formel: 'Anteil der Kategorien mit Monatsbudget, die im letzten vollen Monat im Budget blieben', quelle: 'Monatsbudgets je Kategorie + Buchungen',
    luecke: 'Keine Monatsbudgets gesetzt', pflegen: FIXKOSTEN },
  { id: 'ist_soll', label: 'Ausgaben über Soll', saeule: 'ab', gruppe: 'Budget', einheit: 'prozent', richtung: 'niedrig', gruen: 5, rot: 15,
    formel: '(Ist-Ausgaben ÷ Soll − 1) im letzten vollen Monat', quelle: 'Ist gegen Soll (Posten „Ausgaben“)',
    luecke: 'Für den letzten Monat ist kein Soll gesetzt', pflegen: { text: 'Soll eintragen', href: WEG.privat('plan') } },
  { id: 'zuordnung', label: 'Nicht zugeordnet', saeule: 'ab', gruppe: 'Datenstand', einheit: 'prozent', richtung: 'niedrig', gruen: 2, rot: 10,
    formel: 'Buchungen ohne Kategorie ÷ alle Buchungen (3 volle Monate)', quelle: 'Buchungen',
    luecke: 'Keine Buchungen in den letzten 3 vollen Monaten', pflegen: { text: 'Zuordnen', href: WEG.privat('buchungen', { kat: '__offen', monat: 'alle' }) } },
  { id: 'aktualitaet', label: 'Datenstand', saeule: 'ab', gruppe: 'Datenstand', einheit: 'tage', richtung: 'niedrig', gruen: 10, rot: 40,
    formel: 'Tage seit der letzten Buchung', quelle: 'Kontoauszug-Importe',
    luecke: 'Noch keine Buchungen', pflegen: { text: 'Kontoauszug einlesen', href: WEG.privat('buchungen') } },
  // ── Vermögen & Schulden
  { id: 'sparquote', label: 'Sparquote', saeule: 'vs', gruppe: 'Vermögen', gewicht: 1.5, einheit: 'prozent', richtung: 'hoch', gruen: 15, rot: 5,
    formel: '(Einkommen − Ausgaben) ÷ Einkommen, 6 volle Monate', quelle: 'Buchungen (Sparen und Tilgung zählen als Ausgabe)',
    luecke: 'Kein Einkommen in 6 vollen Monaten', pflegen: BUCHUNGEN },
  { id: 'schuldendienst', label: 'Schuldendienstquote', saeule: 'vs', gruppe: 'Schulden', einheit: 'prozent', richtung: 'niedrig', gruen: 15, rot: 30,
    formel: 'Vereinbarte Raten ÷ Ø echtes Einkommen', quelle: 'Schulden-Liste + Einkommen 3 Monate',
    luecke: 'Kein Einkommen in den letzten 3 vollen Monaten', pflegen: SCHULDEN },
  { id: 'tilgung', label: 'Tilgungstreue', saeule: 'vs', gruppe: 'Schulden', einheit: 'prozent', richtung: 'hoch', gruen: 95, rot: 80,
    formel: 'Tatsächlich getilgt je Monat ÷ vereinbarte Rate (6 volle Monate)', quelle: 'Tilgungs-Buchungen + Schulden-Liste',
    luecke: 'Keine Rate vereinbart', pflegen: SCHULDEN },
  { id: 'schuldenfrei', label: 'Schuldenfrei in', saeule: 'vs', gruppe: 'Schulden', einheit: 'monate', richtung: 'niedrig', gruen: 36, rot: 84,
    formel: 'Restschuld ÷ Ø Tilgung je Monat', quelle: 'Schulden-Liste + Tilgungs-Buchungen',
    luecke: 'Keine Tilgung in den letzten 6 Monaten', pflegen: SCHULDEN },
];

export interface PrivatBestand {
  heute: string;
  haushalt: Pick<Haushalt, 'stamm' | 'buchungen' | 'schulden' | 'belege' | 'planwerte'>;
  /** Notgroschen/Rücklage in Cent, mit Stand. */
  ruecklage: { betrag: number; stand: string } | null;
  schwellen?: Record<string, Schwelle>;
}

// ── Hilfen ──────────────────────────────────────────────────────────────────

const e = (cent: number) => cent / 100;
const euro = (cent: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(cent / 100));
const zahl = (n: number, s = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: s, minimumFractionDigits: 0 });
const pz = (n: number) => `${zahl(n, 1)} %`;
const grenzen = (b: PrivatBestand, id: string) => b.schwellen?.[id] ?? (() => { const k = PRIVAT_KENNZAHLEN.find(x => x.id === id)!; return { gruen: k.gruen, rot: k.rot }; })();
function ampelVon(w: number, g: Schwelle): Ampel {
  const hoch = g.gruen >= g.rot;
  return hoch ? (w >= g.gruen ? 'gruen' : w < g.rot ? 'rot' : 'gelb') : (w <= g.gruen ? 'gruen' : w > g.rot ? 'rot' : 'gelb');
}

interface Sicht {
  b: PrivatBestand; katName: KatName;
  buchungen: Buchung[]; schulden: Schuld[]; belege: Beleg[];
  drei: string[]; sechs: string[]; letzter: string;
}
function sicht(b: PrivatBestand): Sicht {
  const h = b.haushalt;
  return {
    b, katName: katNamen(h.stamm),
    buchungen: h.buchungen.filter(x => x.einheit === 'privat'),
    schulden: h.schulden.filter(x => x.einheit === 'privat'),
    belege: h.belege.filter(x => x.einheit === 'privat'),
    drei: vollMonate(3, 0, b.heute), sechs: vollMonate(6, 0, b.heute), letzter: vollMonate(1, 0, b.heute)[0],
  };
}
/** Link in die Buchungen, gefiltert auf Monat und Kategorie. */
const buchungenWeg = (monat?: string, kat?: string) => WEG.privat('buchungen', { monat: monat ?? 'alle', kat });

function monatsDetails(s: Sicht, monate: string[]): Detail[] {
  return monate.map(m => {
    const x = summen(inMonaten(s.buchungen, [m]), s.katName);
    return { titel: monatKurz(m), wert: `${x.saldo >= 0 ? '+' : ''}${euro(x.saldo)}`, unter: `Einkommen ${euro(x.ein)} · Ausgaben ${euro(x.aus)}`, href: buchungenWeg(m), ampel: x.saldo < 0 ? 'rot' as Ampel : 'gruen' as Ampel };
  });
}

/** Ausgaben je Kategorie in einem Monat (Cent). */
function ausgabenJeKategorie(s: Sicht, monat: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of s.buchungen) if (monatVon(x.datum) === monat && x.betrag < 0 && !x.ist_umbuchung && x.kategorie_id) m.set(x.kategorie_id, (m.get(x.kategorie_id) ?? 0) + Math.abs(x.betrag));
  return m;
}

// ── Die Kennzahlen ──────────────────────────────────────────────────────────

export const PRIVAT_MESSEN: Record<string, (s: Sicht) => Messung> = {
  notgroschen(s) {
    const l = luft(s.buchungen, s.schulden, s.katName, s.b.heute);
    const r = s.b.ruecklage;
    const sockelD: Detail = { titel: 'Sockel je Monat', wert: euro(l.sockel.gesamt), unter: `Fixkosten ${euro(l.sockel.ausBuchungen)} + Raten ${euro(l.sockel.raten)}`, href: WEG.privat('fixkosten') };
    if (!r) return { luecke: 'Rücklage ist nicht eingetragen', details: [{ titel: 'Rücklage eintragen', unter: 'Tagesgeld, Notgroschen — was sofort verfügbar ist', href: WEG.privatIndex('ruecklage') }, sockelD] };
    if (l.sockel.gesamt <= 0) return { luecke: 'Sockel fehlt — Fixkosten markieren', details: [{ titel: 'Fixkosten markieren', href: WEG.privat('fixkosten') }] };
    const w = r.betrag / l.sockel.gesamt;
    const alt = tageZwischen(r.stand.slice(0, 10), s.b.heute);
    return { wert: w, anzeige: `${zahl(w)} Monate`, quelle: `${euro(r.betrag)} Rücklage ÷ ${euro(l.sockel.gesamt)} Sockel je Monat`,
      details: [
        { titel: 'Rücklage', wert: euro(r.betrag), unter: `Stand ${datumDe(r.stand)}${alt > 60 ? ` — ${alt} Tage alt, bitte aktualisieren` : ''}`, href: WEG.privatIndex('ruecklage'), ...(alt > 60 ? { ampel: 'gelb' as Ampel } : {}) },
        sockelD,
        ...l.sockel.posten.slice(0, 2).map(p => ({ titel: p.name, wert: `${euro(p.proMonat)}/Monat`, unter: 'größter Fixkosten-Posten', href: WEG.privat('buchungen', { monat: 'alle', q: p.name.slice(0, 40) }) })),
      ] };
  },
  luft(s) {
    const l = luft(s.buchungen, s.schulden, s.katName, s.b.heute);
    if (l.einnahmenSchnitt <= 0) return { luecke: 'Kein Einkommen in den letzten 3 vollen Monaten', details: [{ titel: 'Kontoauszug einlesen', href: WEG.privat('buchungen') }] };
    return { wert: e(l.luft), anzeige: `${l.luft >= 0 ? '+' : ''}${euro(l.luft)}`, quelle: `Ø ${euro(l.einnahmenSchnitt)} Einkommen − ${euro(l.sockel.gesamt)} Sockel`,
      details: [
        { titel: 'Ø Einkommen (3 Monate)', wert: euro(l.einnahmenSchnitt), href: WEG.privat('einnahmen') },
        { titel: 'Sockel', wert: euro(l.sockel.gesamt), unter: `${l.sockel.posten.length} Fixkosten-Posten + Raten`, href: WEG.privat('fixkosten') },
        ...monatsDetails(s, s.drei.slice(0, 1)),
      ] };
  },
  planbar(s) {
    const l = luft(s.buchungen, s.schulden, s.katName, s.b.heute);
    const k = kennzahlen(s.buchungen, s.drei, s.katName);
    if (l.sockel.gesamt <= 0) return { luecke: 'Sockel fehlt — Fixkosten markieren', details: [{ titel: 'Fixkosten markieren', href: WEG.privat('fixkosten') }] };
    const planbar = k.einPlanbar / (k.monate || 1);
    const w = planbar / l.sockel.gesamt;
    return { wert: w, anzeige: `${zahl(w, 2)}×`, quelle: `Ø ${euro(planbar)} planbar ÷ ${euro(l.sockel.gesamt)} Sockel`,
      details: [
        { titel: 'Planbar je Monat', wert: euro(planbar), unter: 'Gehalt, Entnahme, feste Zahlungen', href: WEG.privat('einnahmen'), ampel: ampelVon(w, grenzen(s.b, 'planbar')) },
        { titel: 'Einmalig je Monat', wert: euro(k.einEinmalig / (k.monate || 1)), unter: 'nicht planbar', href: WEG.privat('einnahmen') },
        ...(k.einOffen > 0 ? [{ titel: 'Noch nicht eingeordnet', wert: euro(k.einOffen / (k.monate || 1)), unter: 'Einnahmen ohne Topf — zuordnen', href: WEG.privat('einnahmen'), ampel: 'gelb' as Ampel }] : []),
      ] };
  },
  rechnungen(s) {
    const r = s.belege.filter(x => x.art === 'rechnung');
    if (!r.length) return { luecke: 'Keine Rechnungen erfasst', details: [{ titel: 'Rechnung erfassen', href: WEG.privat('schulden') }] };
    const offen = r.filter(x => !x.erledigt);
    const ueber = offen.filter(x => x.faellig_am && x.faellig_am < s.b.heute).sort((a, c) => a.faellig_am!.localeCompare(c.faellig_am!));
    const bald = offen.filter(x => x.faellig_am && x.faellig_am >= s.b.heute && x.faellig_am <= tagPlus(s.b.heute, 14));
    return { wert: ueber.length, anzeige: ueber.length ? `${ueber.length} überfällig` : 'keine', quelle: `${offen.length} offene Rechnungen, davon ${ueber.length} über der Frist`,
      details: [
        ...ueber.map(x => ({ titel: x.empfaenger || x.bezeichnung, wert: x.betrag ? euro(x.betrag) : 'ohne Betrag', unter: `fällig war ${datumDe(x.faellig_am)}${x.verursacher ? ` · ${x.verursacher}` : ''}`, href: WEG.privat('schulden'), ampel: 'rot' as Ampel })),
        ...bald.map(x => ({ titel: x.empfaenger || x.bezeichnung, wert: x.betrag ? euro(x.betrag) : 'ohne Betrag', unter: `fällig ${datumDe(x.faellig_am)}`, href: WEG.privat('schulden'), ampel: 'gelb' as Ampel })),
      ] };
  },
  fixquote(s) {
    const l = luft(s.buchungen, s.schulden, s.katName, s.b.heute);
    if (l.einnahmenSchnitt <= 0 || l.sockel.gesamt <= 0) return { luecke: 'Einkommen oder Fixkosten fehlen', details: [{ titel: 'Fixkosten markieren', href: WEG.privat('fixkosten') }] };
    const w = (l.sockel.gesamt / l.einnahmenSchnitt) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${euro(l.sockel.gesamt)} Sockel ÷ ${euro(l.einnahmenSchnitt)} Ø Einkommen`,
      details: l.sockel.posten.slice(0, 3).map(p => ({ titel: p.name, wert: `${euro(p.proMonat)}/Monat`, unter: `${p.turnus === 'monatlich' ? 'monatlich' : p.turnus === 'quartal' ? 'je Quartal' : 'jährlich'} · ${pz((p.proMonat / l.einnahmenSchnitt) * 100)} vom Einkommen`, href: WEG.privat('buchungen', { monat: 'alle', q: p.name.slice(0, 40) }) }))
        .concat(l.sockel.raten > 0 ? [{ titel: 'Kreditraten', wert: `${euro(l.sockel.raten)}/Monat`, unter: 'aus der Schulden-Liste', href: WEG.privat('schulden') }] : []) };
  },
  konsumquote(s) {
    // Konsum = variable Ausgaben ohne Sparen und Tilgung (die bauen Vermögen auf bzw. Schulden ab).
    const k = kennzahlen(s.buchungen, s.drei, s.katName);
    if (k.ein <= 0) return { luecke: 'Kein Einkommen in den letzten 3 vollen Monaten' };
    const konsum = (x: Buchung) => x.betrag < 0 && !x.ist_umbuchung && !x.ist_fixkosten && ![...TILGUNG, ...SPAREN].includes(s.katName(x.kategorie_id)) && artVon(s.katName(x.kategorie_id)) !== 'durchlauf';
    const summe = inMonaten(s.buchungen, s.drei).filter(konsum).reduce((a, x) => a + Math.abs(x.betrag), 0);
    const w = (summe / k.ein) * 100;
    // Die größten Konsum-Kategorien im letzten vollen Monat — Link in genau diese Buchungen.
    const je = new Map<string, number>();
    for (const x of inMonaten(s.buchungen, [s.letzter]).filter(konsum)) { const id = x.kategorie_id ?? '__offen'; je.set(id, (je.get(id) ?? 0) + Math.abs(x.betrag)); }
    return { wert: w, anzeige: pz(w), quelle: `${euro(summe / k.monate)} Konsum ÷ ${euro(k.einProMonat)} Einkommen je Monat (3 Monate, ohne Sparen und Tilgung)`,
      details: Array.from(je.entries()).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([id, v]) => ({ titel: id === '__offen' ? 'Noch nicht zugeordnet' : s.katName(id) || 'Unbekannt', wert: euro(v), unter: `${monatKurz(s.letzter)} · variabel`, href: buchungenWeg(s.letzter, id) })) };
  },
  budget(s) {
    const kats = s.b.haushalt.stamm.kategorien.filter((k: Kategorie) => k.typ === 'ausgabe' && (k.monatsbudget ?? 0) > 0);
    if (!kats.length) return { luecke: 'Keine Monatsbudgets gesetzt', details: [{ titel: 'Budgets setzen', unter: 'je Kategorie unter Fixkosten & Budget', href: WEG.privat('fixkosten') }] };
    const ist = ausgabenJeKategorie(s, s.letzter);
    const reihe = kats.map(k => ({ k, ist: ist.get(k.id) ?? 0, quote: (ist.get(k.id) ?? 0) / (k.monatsbudget as number) }));
    const drin = reihe.filter(x => x.quote <= 1).length;
    const w = (drin / reihe.length) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${drin} von ${reihe.length} Budgets im ${monatKurz(s.letzter)} eingehalten`,
      details: reihe.sort((a, c) => c.quote - a.quote).slice(0, 4).map(x => ({ titel: x.k.name, wert: `${euro(x.ist)} / ${euro(x.k.monatsbudget as number)}`, unter: x.quote > 1 ? `${pz((x.quote - 1) * 100)} über Budget` : `${pz(x.quote * 100)} genutzt`, href: buchungenWeg(s.letzter, x.k.id), ampel: x.quote > 1 ? 'rot' as Ampel : x.quote > 0.9 ? 'gelb' as Ampel : 'gruen' as Ampel })) };
  },
  ist_soll(s) {
    const soll = sollWert('Ausgaben', s.b.haushalt.planwerte, s.letzter);
    if (soll == null || soll <= 0) return { luecke: `Für ${monatKurz(s.letzter)} ist kein Soll gesetzt`, details: [{ titel: 'Soll eintragen', href: WEG.privat('plan') }] };
    const ist = istWert('Ausgaben', s.buchungen, s.letzter, s.katName);
    const w = Math.max(0, (ist / soll - 1) * 100);
    return { wert: w, anzeige: w ? `+${pz(w)}` : 'im Plan', quelle: `${monatKurz(s.letzter)}: ${euro(ist)} Ist ÷ ${euro(soll)} Soll`,
      details: [
        { titel: `Ist ${monatKurz(s.letzter)}`, wert: euro(ist), unter: 'Ausgaben ohne Sparen und Tilgung', href: buchungenWeg(s.letzter), ampel: ampelVon(w, grenzen(s.b, 'ist_soll')) },
        { titel: `Soll ${monatKurz(s.letzter)}`, wert: euro(soll), href: WEG.privat('plan') },
      ] };
  },
  zuordnung(s) {
    const l = inMonaten(s.buchungen, s.drei).filter(x => !x.ist_umbuchung);
    if (!l.length) return { luecke: 'Keine Buchungen in den letzten 3 vollen Monaten' };
    const offen = s.buchungen.filter(x => !x.kategorie_id && !x.ist_umbuchung);
    const offen3 = l.filter(x => !x.kategorie_id).length;
    const w = (offen3 / l.length) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${offen3} von ${l.length} Buchungen ohne Kategorie (3 Monate)`,
      details: [{ titel: 'Ohne Kategorie', wert: `${offen.length}`, unter: 'alle Monate — jetzt zuordnen', href: buchungenWeg('alle', '__offen'), ampel: offen.length ? 'gelb' : 'gruen' }] };
  },
  aktualitaet(s) {
    const juengste = s.buchungen.reduce((m, x) => (x.datum > m ? x.datum : m), '');
    if (!juengste) return { luecke: 'Noch keine Buchungen', details: [{ titel: 'Kontoauszug einlesen', href: WEG.privat('buchungen') }] };
    const w = tageZwischen(juengste, s.b.heute);
    const konten = s.b.haushalt.stamm.konten.filter(k => k.einheit === 'privat' && k.aktiv);
    return { wert: w, anzeige: `${w} Tage`, quelle: `letzte Buchung vom ${datumDe(juengste)}`,
      details: konten.map(k => {
        const l = s.buchungen.filter(x => x.konto_id === k.id).reduce((m, x) => (x.datum > m ? x.datum : m), '');
        const t = l ? tageZwischen(l, s.b.heute) : null;
        return { titel: k.name, wert: t == null ? 'keine' : `${t} Tage`, unter: l ? `letzte Buchung ${datumDe(l)}` : 'noch nichts eingelesen', href: WEG.privat('buchungen'), ampel: t == null ? 'grau' as Ampel : ampelVon(t, grenzen(s.b, 'aktualitaet')) };
      }) };
  },
  sparquote(s) {
    const k = kennzahlen(s.buchungen, s.sechs, s.katName);
    if (k.ein <= 0) return { luecke: 'Kein Einkommen in 6 vollen Monaten' };
    return { wert: k.sparquote, anzeige: pz(k.sparquote), quelle: `Ø ${euro(k.saldoProMonat)} übrig von ${euro(k.einProMonat)} je Monat (6 Monate)`,
      details: monatsDetails(s, s.sechs.slice(0, 3)) };
  },
  schuldendienst(s) {
    const l = luft(s.buchungen, s.schulden, s.katName, s.b.heute);
    const rate = s.schulden.reduce((a, x) => a + (Number(x.rate) || 0), 0);
    if (!s.schulden.length) return { wert: 0, anzeige: 'keine Schulden', quelle: 'keine privaten Schulden erfasst', details: [{ titel: 'Schulden-Liste', href: WEG.privat('schulden'), ampel: 'gruen' }] };
    if (l.einnahmenSchnitt <= 0) return { luecke: 'Kein Einkommen in den letzten 3 vollen Monaten' };
    const w = (rate / l.einnahmenSchnitt) * 100;
    return { wert: w, anzeige: pz(w), quelle: `${euro(rate)} Raten ÷ ${euro(l.einnahmenSchnitt)} Ø Einkommen`,
      details: s.schulden.slice().sort((a, c) => (c.rate ?? 0) - (a.rate ?? 0)).slice(0, 4).map(x => ({ titel: x.bezeichnung, wert: x.rate ? `${euro(x.rate)}/Monat` : 'ohne Rate', unter: `Rest ${euro(x.restbetrag ?? 0)}${x.glaeubiger ? ` · ${x.glaeubiger}` : ''}`, href: WEG.privat('schulden'), ...(x.rate ? {} : { ampel: 'gelb' as Ampel }) })) };
  },
  tilgung(s) {
    const sb = schuldenbild(s.buchungen, s.schulden, s.sechs, s.katName);
    if (!s.schulden.length) return { wert: 100, anzeige: 'keine Schulden', quelle: 'keine privaten Schulden erfasst' };
    if (sb.rate <= 0) return { luecke: 'Keine Rate vereinbart', details: [{ titel: 'Raten eintragen', href: WEG.privat('schulden') }] };
    const w = (sb.proMonat / sb.rate) * 100;
    return { wert: w, anzeige: pz(w), quelle: `Ø ${euro(sb.proMonat)} getilgt ÷ ${euro(sb.rate)} vereinbarte Rate (6 Monate)`,
      details: [
        { titel: 'Getilgt je Monat', wert: euro(sb.proMonat), unter: 'Kategorien „Tilgung“ und „Kredit & Raten“', href: buchungenWeg('alle', s.b.haushalt.stamm.kategorien.find(k => TILGUNG.includes(k.name))?.id) },
        { titel: 'Vereinbarte Rate', wert: euro(sb.rate), href: WEG.privat('schulden') },
      ] };
  },
  schuldenfrei(s) {
    const sb = schuldenbild(s.buchungen, s.schulden, s.sechs, s.katName);
    if (!s.schulden.length || sb.rest <= 0) return { wert: 0, anzeige: 'schuldenfrei', quelle: 'keine Restschuld', details: [{ titel: 'Schulden-Liste', href: WEG.privat('schulden'), ampel: 'gruen' }] };
    if (sb.restMonate == null) return { luecke: 'Keine Tilgung in den letzten 6 Monaten', details: [{ titel: 'Restschuld', wert: euro(sb.rest), href: WEG.privat('schulden'), ampel: 'rot' }] };
    const frei = monatKurz(vollMonate(1, -(sb.restMonate + 1), s.b.heute)[0]);
    return { wert: sb.restMonate, anzeige: `${sb.restMonate} Monate`, quelle: `${euro(sb.rest)} Rest ÷ Ø ${euro(sb.proMonat)} Tilgung je Monat — etwa ${frei}`,
      details: s.schulden.slice().sort((a, c) => (c.restbetrag ?? 0) - (a.restbetrag ?? 0)).slice(0, 4).map(x => ({ titel: x.bezeichnung, wert: euro(x.restbetrag ?? 0), unter: `${x.endet_am ? `endet ${datumDe(x.endet_am)}` : 'ohne Enddatum'}${x.startbetrag ? ` · ${pz((1 - (x.restbetrag ?? 0) / x.startbetrag) * 100)} abgebaut` : ''}`, href: WEG.privat('schulden') })) };
  },
};

export function berechnePrivat(b: PrivatBestand): PrivatIndex {
  const s = sicht(b);
  return berechneModell({ saeulen: PRIVAT_SAEULEN, kennzahlen: PRIVAT_KENNZAHLEN, messen: PRIVAT_MESSEN, bestand: s, schwellen: b.schwellen, stand: b.heute, scope: 'privat' });
}

/** Sind die Buchungen frisch genug für den Wachstums-Score? (wie score.ts: 45 Tage) */
export function privatFrisch(b: Pick<PrivatBestand, 'haushalt' | 'heute'>): boolean {
  const j = b.haushalt.buchungen.filter(x => x.einheit === 'privat').reduce((m, x) => (x.datum > m ? x.datum : m), '');
  return !!j && tageZwischen(j, b.heute) <= 45;
}
