// ─── Das Finanzbild — alles, was der Head of Finance sieht ─────────────────
// Eine reine Funktion baut aus allen Quellen EIN Datenpaket: Business,
// Steuern, Haushalt (nur für Haushaltsmitglieder), Gesamt-Brücke und die
// Datenqualität. Alle Beträge in Euro, auf den Cent gerundet. Der Agent
// rechnet nichts selbst — er liest nur hier, und jede Zahl, die er schreibt,
// wird gegen dieses Paket geprüft (pruefung.ts).

import { computeMetrics, mitKasse, MONTHS_DE, type FinanceState, type Kasse } from '@/lib/make-one/finance-data';
import { vorschau, nurBusiness, businessFirmen, type Firma, type Rechnung, type Zahlung, type Merkposten, type Planposten } from '@/lib/make-one/liquiditaet';
import { kennzahlen as grundKennzahlen, monatsBild, type Grundlage } from '@/lib/make-one/grundlage';
import type { Haushalt } from '../haushalt/typen';
import type { Meta } from '../haushalt/speicher';
import { katNamen } from '../haushalt/einordnung';
import { kennzahlen as hhKennzahlen, schuldenbild } from '../haushalt/kennzahlen';
import { luft } from '../haushalt/fixkosten';
import { faelligeZeilen } from '../haushalt/jarvis';
import { bruecke, ENTNAHME_KATEGORIEN } from '../haushalt/gesamt';
import { vollMonate, monatVon, tageZwischen, tagPlus, monatPlus } from '../haushalt/monat';
import { steuertermine, type SteuerEinstellung, type Termin } from './steuertermine';
import { auffaelligkeiten, type Auffaelligkeit } from './auffaellig';

export type Schwere = 'hoch' | 'mittel' | 'niedrig';
export interface Hinweis { schwere: Schwere; bereich: 'business' | 'haushalt' | 'gesamt' | 'daten' | 'steuern'; text: string; quelle: string }

export interface FinanzplanStand { firmen?: Firma[]; rechnungen?: (Rechnung & { firmaId?: string })[]; zahlungen?: Zahlung[]; merkposten?: Merkposten[] }

export interface Eingaben {
  heute: string; // JJJJ-MM-TT, Europe/Berlin
  finance: FinanceState | null;
  plan: FinanzplanStand | null;
  planposten: Planposten[];
  grundlage: { g: Grundlage; stand: string } | null;
  steuer: SteuerEinstellung & { ruecklageQuote: number | null };
  /** Nur übergeben, wenn der Aufruf einer Person mit Haushaltszugang gehört. */
  haushalt?: (Haushalt & { meta: Meta }) | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Deutsches Format in Hinweistexten — die liest der Mensch und das Modell. */
const euro = (n: number) => `${r2(n).toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(r2(n)) ? 0 : 2, maximumFractionDigits: 2 })} €`;
const tagDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
/** Monatliche Raten aller privaten Schulden (Cent). */
const sbRate = (hh: Haushalt) => hh.schulden.filter(s => s.einheit === 'privat').reduce((a, s) => a + (Number(s.rate) || 0), 0);
const ce = (cent: number) => r2(cent / 100); // Cent → Euro

export function baueFinanzbild(e: Eingaben) {
  const hinweise: Hinweis[] = [];
  const h = (schwere: Schwere, bereich: Hinweis['bereich'], text: string, quelle: string) => hinweise.push({ schwere, bereich, text, quelle });
  const jetzt = new Date(`${e.heute}T12:00:00`);

  // ── Business: Controlling (Plan/Ist, Ziel) ───────────────────────────────
  const firmen = businessFirmen(e.plan?.firmen ?? []);
  const fin = e.finance ? mitKasse(e.finance, firmen) : null;
  const m = fin ? computeMetrics(fin, jetzt) : null;
  const kasse: Kasse & { alter_tage: number | null } = fin
    ? { ...fin.kasse, alter_tage: fin.kasse.stand ? tageZwischen(fin.kasse.stand, e.heute) : null }
    : { betrag: 0, quelle: 'keine', konten: 0, stand: null, alter_tage: null };

  // Welche Monate seit Start sind im Controlling leer? (bis zum letzten vollen Monat)
  const luecken: string[] = [];
  if (fin && Number(e.heute.slice(0, 4)) === fin.jahr) {
    const start = typeof fin.startMonat === 'number' ? fin.startMonat : 0;
    const letzterVoller = Number(e.heute.slice(5, 7)) - 2; // Index des Vormonats
    for (let i = start; i <= letzterVoller; i++) {
      const r = fin.months[i];
      if (!r || (!(r.umsatz > 0) && !(r.kosten > 0))) luecken.push(MONTHS_DE[i]);
    }
  }
  if (!fin) h('hoch', 'daten', 'Kein Controlling-Stand (Ziel, Monatszahlen) gepflegt — Run-Rate und Zielabstand sind nicht messbar.', 'finance');
  else if (luecken.length) h('mittel', 'daten', `Controlling ohne Zahlen für ${luecken.join(', ')} — Run-Rate und Runway sind dadurch verzerrt.`, 'finance.months');
  if (kasse.quelle === 'keine') h('hoch', 'daten', 'Kein Business-Kontostand hinterlegt — Runway und Liquidität starten bei 0 €.', 'finanzplan.firmen');
  else if (kasse.quelle === 'manuell') h('mittel', 'daten', 'Business-Kasse nur als manuelle Zahl, keine Kontostände je Firma.', 'finance.cash');
  else if (kasse.alter_tage != null && kasse.alter_tage > 14) h('mittel', 'daten', `Ältester Business-Kontostand ist ${kasse.alter_tage} Tage alt (${tagDe(kasse.stand!)}).`, 'finanzplan.firmen');
  // Ein Stand ohne Datum ist nicht geprüft — Runway und Liquidität hängen trotzdem daran.
  const ohneDatum = firmen.filter(f => typeof f.kontostand === 'number' && !f.stand).map(f => f.name);
  if (ohneDatum.length) h('mittel', 'daten', `Kontostand ohne Datum: ${ohneDatum.join(', ')} — unbestätigt, Runway und Liquidität rechnen damit.`, 'finanzplan.firmen');

  // ── Business: Liquidität 12 Wochen (dieselbe Kurve wie Zahlen) ──────────
  const v = e.plan ? vorschau(e.plan.firmen ?? [], e.plan.rechnungen ?? [], e.plan.zahlungen ?? [], e.plan.merkposten ?? [], e.heute, 12, false, e.planposten, 'real', undefined, true) : null;
  if (v?.engpass) h('hoch', 'business', `Liquidität: Engpass in der Woche ${v.engpass.label} (Stand ${euro(v.engpass.stand)}).`, 'Liquiditätsvorschau');

  // ── Business: Forderungen und eigene Zahlungen ──────────────────────────
  const rechnungen = nurBusiness(e.plan?.rechnungen ?? []);
  const gestellt = rechnungen.filter(r => r.status === 'gestellt');
  const ueberfaellig = gestellt.filter(r => r.faellig && r.faellig < e.heute)
    .map(r => ({ kunde: r.kunde, titel: r.titel, betrag: r2(r.betrag), faellig: r.faellig!, tage: tageZwischen(r.faellig!, e.heute) }))
    .sort((a, b) => b.tage - a.tage);
  for (const r of ueberfaellig.slice(0, 3)) h(r.tage > 30 ? 'hoch' : 'mittel', 'business', `Forderung ${r.kunde} (${euro(r.betrag)}) seit ${r.tage} Tagen überfällig.`, 'finanzplan.rechnungen');
  const zahlungen = nurBusiness(e.plan?.zahlungen ?? []).filter(z => z.status === 'offen');
  const bald = zahlungen.filter(z => z.faellig && z.faellig <= tagPlus(e.heute, 14))
    .map(z => ({ an: z.an, betrag: r2(z.betrag), faellig: z.faellig!, ueberfaellig: z.faellig! < e.heute }))
    .sort((a, b) => a.faellig.localeCompare(b.faellig));

  // ── Business: Grundlage (Malins V1-Export) und Abgleich mit Controlling ─
  let grundlage = null as null | {
    stand: string; von_monat: string; bis_monat: string; umsatz_netto_pro_monat: number; fixkosten_monat_brutto: number; unklassifiziert: number;
    monate: { monat: string; umsatz_netto: number; kosten_netto: number; entnahmen: number; ergebnis: number }[];
    groesster_kunde: { name: string; anteil_prozent: number; umsatz_netto: number; kunden_gesamt: number } | null;
    eingangsrechnungen_offen: { anzahl: number; summe_brutto: number; naechste: { lieferant: string; brutto: number; faellig: string }[] };
  };
  const abgleich: { monat: string; controlling_umsatz: number; grundlage_umsatz_netto: number; differenz: number }[] = [];
  if (e.grundlage) {
    const k = grundKennzahlen(e.grundlage.g);
    const mb = monatsBild(e.grundlage.g);
    // Kundenkonzentration über 12 Monate — Klumpenrisiko und (ab 5/6) Rentenversicherungspflicht.
    const seit = `${monatPlus(e.heute.slice(0, 7), -12)}-01`;
    const jeKunde = new Map<string, number>();
    for (const p of e.grundlage.g.umsatz) if (p.datum >= seit && p.netto > 0) jeKunde.set(p.wer || '(ohne Namen)', (jeKunde.get(p.wer || '(ohne Namen)') ?? 0) + p.netto);
    const umsatz12 = Array.from(jeKunde.values()).reduce((a, b) => a + b, 0);
    const top = Array.from(jeKunde.entries()).sort((a, b) => b[1] - a[1])[0];
    const groesster = top && umsatz12 > 0 ? { name: top[0], anteil_prozent: r2(top[1] / umsatz12 * 100), umsatz_netto: r2(top[1]), kunden_gesamt: jeKunde.size } : null;
    if (groesster && groesster.anteil_prozent >= 83.3) h('mittel', 'steuern', `${groesster.name} bringt ${groesster.anteil_prozent.toLocaleString('de-DE')} % des Umsatzes der letzten 12 Monate — ab 5/6 von einem Auftraggeber kann Rentenversicherungspflicht entstehen (Hinweis, keine Steuerberatung).`, 'grundlage.umsatz');
    else if (groesster && groesster.anteil_prozent >= 50) h('niedrig', 'business', `Klumpenrisiko: ${groesster.name} bringt ${groesster.anteil_prozent.toLocaleString('de-DE')} % des Umsatzes der letzten 12 Monate.`, 'grundlage.umsatz');
    // Offene Eingangsrechnungen (UG) — was muss raus?
    const ugOffen = e.grundlage.g.ugRechnungen.filter(r => !/bezahlt|paid/i.test(r.status));
    for (const r of ugOffen.filter(x => x.faellig && x.faellig < e.heute).slice(0, 2)) h('mittel', 'business', `Eingangsrechnung ${r.lieferant} (${euro(r.brutto)}) war am ${tagDe(r.faellig)} fällig.`, 'grundlage.ugRechnungen');
    grundlage = {
      stand: e.grundlage.stand, von_monat: k.vonMonat, bis_monat: k.bisMonat,
      umsatz_netto_pro_monat: r2(k.umsatzProMonat), fixkosten_monat_brutto: r2(k.fixkostenMonatBrutto), unklassifiziert: k.offeneLuecken,
      monate: mb.slice(-6).map(z => ({ monat: z.monat, umsatz_netto: z.umsatzNetto, kosten_netto: z.kostenNetto, entnahmen: z.entnahmen, ergebnis: z.ergebnis })),
      groesster_kunde: groesster,
      eingangsrechnungen_offen: {
        anzahl: ugOffen.length, summe_brutto: r2(ugOffen.reduce((a, r) => a + r.brutto, 0)),
        naechste: ugOffen.filter(r => r.faellig).sort((a, b) => a.faellig.localeCompare(b.faellig)).slice(0, 5).map(r => ({ lieferant: r.lieferant, brutto: r2(r.brutto), faellig: r.faellig })),
      },
    };
    const alter = tageZwischen(e.grundlage.stand.slice(0, 10), e.heute);
    if (alter > 35) h('mittel', 'daten', `Business-Grundlage (V1-Export) ist ${alter} Tage alt — neuen Export aus dem Finanz-Dashboard laden.`, 'grundlage');
    if (k.offeneLuecken > 0) h('niedrig', 'daten', `${k.offeneLuecken} Posten in der Grundlage sind nicht klassifiziert.`, 'grundlage.offen');
    // Controlling-Monate gegen Grundlage (netto) — nur wo beide Zahlen haben.
    if (fin) for (const z of mb) {
      if (Number(z.monat.slice(0, 4)) !== fin.jahr) continue;
      const c = fin.months[Number(z.monat.slice(5, 7)) - 1]?.umsatz ?? 0;
      if (c > 0 && z.umsatzNetto > 0 && Math.abs(c - z.umsatzNetto) > Math.max(100, z.umsatzNetto * 0.05)) {
        abgleich.push({ monat: z.monat, controlling_umsatz: r2(c), grundlage_umsatz_netto: z.umsatzNetto, differenz: r2(c - z.umsatzNetto) });
      }
      if (c === 0 && z.umsatzNetto > 0 && luecken.includes(MONTHS_DE[Number(z.monat.slice(5, 7)) - 1])) {
        h('mittel', 'daten', `Im Controlling fehlt ${MONTHS_DE[Number(z.monat.slice(5, 7)) - 1]} — die Grundlage hat dort ${euro(z.umsatzNetto)} Umsatz netto.`, 'finance.months ↔ grundlage');
      }
    }
    if (abgleich.length) h('mittel', 'daten', `Controlling und Grundlage weichen beim Umsatz ab (${abgleich.map(a => a.monat).join(', ')}) — brutto/netto oder ein Tippfehler?`, 'finance.months ↔ grundlage');
  } else h('niedrig', 'daten', 'Keine Business-Grundlage (V1-Export) geladen.', 'grundlage');

  // ── Steuern: Fristen nie aus dem Gedächtnis ─────────────────────────────
  const termine: Termin[] = steuertermine(e.heute, tagPlus(e.heute, 60), e.steuer);
  for (const t of termine.filter(t => tageZwischen(e.heute, t.datum) <= 14)) h(tageZwischen(e.heute, t.datum) <= 5 ? 'hoch' : 'mittel', 'steuern', `${t.titel} am ${tagDe(t.datum)}.`, 'Steuerkalender');

  // ── Haushalt (nur mit Zugang) ───────────────────────────────────────────
  let haushalt = null as null | Record<string, unknown>;
  let gesamt = null as null | Record<string, unknown>;
  let entnahmen = null as null | { monat: string; business_grundlage: number; haushalt_eingang: number; differenz: number }[];
  let auff: Auffaelligkeit[] = [];
  if (e.haushalt) {
    const hh = e.haushalt;
    const katName = katNamen(hh.stamm);
    const privat = hh.buchungen.filter(b => b.einheit === 'privat');
    const schulden = hh.schulden.filter(s => s.einheit === 'privat');
    const drei = vollMonate(3, 0, e.heute);
    const k = hhKennzahlen(privat, drei, katName);
    const vor = hhKennzahlen(privat, vollMonate(3, 3, e.heute), katName);
    const l = luft(privat, schulden, katName, e.heute);
    const sb = schuldenbild(privat, schulden, drei, katName);
    const letzte = privat.map(b => b.datum).sort().pop() ?? null;
    const importAlter = letzte ? tageZwischen(letzte, e.heute) : null;
    const offen = privat.filter(b => !b.kategorie_id && !b.ist_umbuchung).length;
    auff = auffaelligkeiten(hh, e.heute);
    haushalt = {
      zeitraum: `${drei[drei.length - 1]} bis ${drei[0]}`,
      einnahmen_pro_monat: ce(k.einProMonat), ausgaben_pro_monat: ce(k.ausProMonat),
      fixkosten_pro_monat: ce(k.fixProMonat), variabel_pro_monat: ce(k.varProMonat), saldo_pro_monat: ce(k.saldoProMonat),
      sparquote_prozent: r2(k.sparquote), sparquote_vorzeitraum_prozent: vor.anzahl ? r2(vor.sparquote) : null,
      fixkostenquote_prozent: r2(k.fixquote), schuldendienstquote_prozent: k.einProMonat > 0 ? r2(sbRate(hh) / k.einProMonat * 100) : null,
      sockel_pro_monat: ce(l.sockel.gesamt), luft_pro_monat: ce(l.luft),
      schulden_rest: ce(sb.rest), schulden_rate_monat: ce(sb.rate), tilgung_pro_monat: ce(sb.proMonat), schulden_frei_in_monaten: sb.restMonate,
      faellig: faelligeZeilen(hh, e.heute),
      letzte_buchung: letzte, tage_seit_letzter_buchung: importAlter, ohne_kategorie: offen,
      steuerquote_annahme_prozent: hh.meta.steuerquote,
    };
    if (importAlter == null) h('hoch', 'daten', 'Im Haushalt sind noch keine Buchungen — Kontoauszug importieren.', 'haushalt');
    else if (importAlter > 35) h('hoch', 'daten', `Letzte Haushaltsbuchung vor ${importAlter} Tagen — Kontoauszug importieren, sonst ist jede Haushaltszahl alt.`, 'haushalt.buchungen');
    if (offen > 10) h('mittel', 'daten', `${offen} Haushaltsbuchungen ohne Kategorie — Auswertungen sind unscharf.`, 'haushalt.buchungen');
    if (k.anzahl && k.sparquote < 0) h('hoch', 'haushalt', `Haushalt gibt mehr aus als reinkommt (Sparquote ${r2(k.sparquote).toLocaleString('de-DE')} %).`, 'haushalt.kennzahlen');
    if (l.luft < 0) h('hoch', 'haushalt', `Der Sockel (${euro(ce(l.sockel.gesamt))}) ist höher als die Einnahmen im Schnitt (${euro(ce(l.einnahmenSchnitt))}).`, 'haushalt.fixkosten');
    for (const a of auff.filter(x => x.schwere !== 'niedrig').slice(0, 4)) h(a.schwere, 'haushalt', a.text, `Auffälligkeit: ${a.regel}`);

    // Gesamt: Brücke (Mindestumsatz) aus Haushalt + Grundlage
    const gk = e.grundlage ? grundKennzahlen(e.grundlage.g) : null;
    const b = bruecke(hh, gk && gk.monate > 0 ? { umsatzProMonat: gk.umsatzProMonat, fixkostenMonatBrutto: gk.fixkostenMonatBrutto, bisMonat: gk.bisMonat, monate: gk.monate } : null, hh.meta.steuerquote, e.heute);
    gesamt = {
      sockel_privat: ce(b.sockel), planbares_einkommen_ohne_entnahme: ce(b.planbarOhneEntnahme), entnahme_ist_pro_monat: ce(b.entnahmeIst),
      noetige_entnahme_pro_monat: ce(b.noetigeEntnahme), steuerquote_prozent: b.steuerquote,
      noetiger_gewinn_pro_monat: b.noetigerGewinn != null ? ce(b.noetigerGewinn) : null,
      betrieb_fixkosten_pro_monat: b.betriebsFix != null ? ce(b.betriebsFix) : null,
      mindest_umsatz_pro_monat: b.mindestUmsatz != null ? ce(b.mindestUmsatz) : null,
      umsatz_ist_pro_monat: b.umsatzIst != null ? ce(b.umsatzIst) : null,
      deckung_prozent: b.deckung != null ? r2(b.deckung) : null, fehlt: b.fehlt,
    };
    if (b.deckung != null && b.deckung < 100) h('hoch', 'gesamt', `Umsatz deckt den Mindestumsatz nur zu ${r2(b.deckung).toLocaleString('de-DE')} % — der Haushalt lebt von Substanz oder Krediten.`, 'Brücke');
    if (b.fehlt.length) h('niedrig', 'daten', `Brücke unvollständig: ${b.fehlt.join(', ')} fehlt.`, 'Brücke');

    // Entnahmen: Business-Seite (Grundlage) gegen Eingang im Haushalt, je Monat
    if (e.grundlage) {
      const mb = monatsBild(e.grundlage.g);
      const hhEntnahme = new Map<string, number>();
      for (const x of privat) if (x.betrag > 0 && ENTNAHME_KATEGORIEN.includes(katName(x.kategorie_id))) hhEntnahme.set(monatVon(x.datum), (hhEntnahme.get(monatVon(x.datum)) ?? 0) + x.betrag);
      const bis = mb[mb.length - 1]?.monat;
      entnahmen = mb.filter(z => bis && z.monat > monatPlus(bis, -6))
        .map(z => ({ monat: z.monat, business_grundlage: z.entnahmen, haushalt_eingang: ce(hhEntnahme.get(z.monat) ?? 0), differenz: r2(z.entnahmen - ce(hhEntnahme.get(z.monat) ?? 0)) }))
        .filter(z => z.business_grundlage > 0 || z.haushalt_eingang > 0);
      const schief = entnahmen.filter(z => Math.abs(z.differenz) > 50);
      if (schief.length) h('niedrig', 'daten', `Entnahmen passen nicht zusammen (${schief.map(z => z.monat).join(', ')}): Business-Seite und Haushaltseingang weichen ab — Zeitversatz, anderes Konto oder falsche Kategorie?`, 'grundlage.entnahmen ↔ haushalt');
    }
  }

  const rang: Record<Schwere, number> = { hoch: 0, mittel: 1, niedrig: 2 };
  hinweise.sort((a, b) => rang[a.schwere] - rang[b.schwere]);

  return {
    stichtag: e.heute,
    umfang: e.haushalt ? 'business+haushalt' as const : 'business' as const,
    business: {
      ziel: fin ? { jahr: fin.jahr, umsatz: fin.zielUmsatz, gewinn: fin.zielGewinn } : null,
      controlling: m ? {
        ist_umsatz: r2(m.istUmsatz), ist_kosten: r2(m.istKosten), ist_gewinn: r2(m.istGewinn),
        fortschritt_prozent: r2(m.fortschritt * 100), run_rate_aktuell: r2(m.runRateAktuell), run_rate_noetig: r2(m.runRateNoetig),
        rest_monate: m.restMonate, aktive_monate: m.aktiveMonate, avg_burn: r2(m.avgBurn),
        runway_monate: m.runwayMonate != null ? r2(m.runwayMonate) : null, leere_monate: luecken,
      } : null,
      kasse: { ...kasse, betrag: r2(kasse.betrag) },
      liquiditaet_12_wochen: v ? {
        start: r2(v.start), tiefpunkt: r2(v.tiefpunkt.stand), tiefpunkt_woche: v.tiefpunkt.label,
        engpass_woche: v.engpass?.label ?? null, eingaenge: r2(v.summeEin), ausgaenge: r2(v.summeAus), davon_unsicher: r2(v.unsicher),
      } : null,
      forderungen: { offen_summe: r2(gestellt.reduce((s, r) => s + r.betrag, 0)), anzahl: gestellt.length, ueberfaellig },
      zahlungen: { offen_summe: r2(zahlungen.reduce((s, z) => s + z.betrag, 0)), anzahl: zahlungen.length, naechste_14_tage: bald },
      grundlage,
      abgleich_controlling_grundlage: abgleich,
    },
    steuern: { einstellung: e.steuer, termine_60_tage: termine },
    haushalt,
    gesamt,
    entnahmen_abgleich: entnahmen,
    auffaelligkeiten: auff,
    hinweise,
  };
}

export type Finanzbild = ReturnType<typeof baueFinanzbild>;
