// ─── Mandate als Tabelle einfügen (09.10., rein: Server UND Browser) ───────────────────────────────────────────────────────────────
// ONBOARDING_PLAN.md › B9 c / L28: Mandate gingen nur einzeln („+ Mandat“ ohne Firmen-Kennung). Hier: mehrere auf einmal aus Excel/CSV —
// Kunde/Firma, Produkt, Honorar netto/Monat, Start, Laufzeit, Gesellschaft (+ optional Titel, Ende, Status, USt-Satz).
//
// Regeln (eine Stelle):
//   • Firma: vorhandene über `firmaPlanen` (Name ohne Rechtsform, Kennung, Papierkorb → zurück) — neue Firmen legt der Server über den EINEN Weg
//     `firmaSichern` an (lib/crm/person-anlegen-server.ts). Der Anzeigename des Mandats ist der Name der Firma.
//   • Gesellschaft ist Pflicht (nie „offen“): aus der Spalte (Name, Kurzname, Altname, Register-Gesellschaft) oder der Vorgabe für alle Zeilen.
//   • Kennung fest aus einem Fingerabdruck der Zeile (`m-tab-…`: Gesellschaft, Firma, Produkt bzw. Titel, Start) — dieselbe Zeile zweimal
//     eingefügt ist „gleich“ bzw. „geändert“ (Honorar, Laufzeit, Ende, Status, USt), nie doppelt. Ein von Hand angelegtes Mandat derselben Firma,
//     Gesellschaft und Leistung (Start gleich oder fehlt) → „übersprungen“ (nie ein zweites daneben).
//   • Leere Zellen ändern an einem vorhandenen Mandat nichts. Geschrieben wird über den CRM-Schreibweg (`aendereCrm` + `wendeCrmAn`, Säuberer,
//     Regeln, Änderungsprotokoll). Rückgängig nur für seitdem unveränderte (Stand = Fingerabdruck).

import { betragCent, datumAus, kurzHash, textGlaetten, vergleichsText } from '@/lib/finanzen/kontoauszug/text';
import { centSumme, monatAus, zahlformatVon, type Datensatz, type FeldDef, type VorschauZeile } from '@/lib/tabelle/einfuegen';
import { finanzOrtAus, finanzOrtName, istRegisterKennung, KERN_EINHEITEN } from '@/lib/einheiten';
import { firmenSchluessel } from './firmen';
import { firmaPlanen, type FirmaPlan } from './person-anlegen';
import type { ChancenArt, Firma, Gesellschaft, Leistung, Mandat, MandatStatus } from './typen';

/** Spalten einer Mandatsliste (nur Begriffe). */
export const MANDAT_FELDER: readonly FeldDef[] = [
  { id: 'kunde', label: 'Kunde / Firma', pflicht: true,
    namen: ['kunde', 'firma', 'mandant', 'auftraggeber', 'unternehmen', 'kundenname', 'kunde/firma', 'client', 'customer', 'company', 'kunde / firma'], enthaelt: ['kunde', 'mandant', 'client'], nicht: ['nr', 'nummer', 'seit'] },
  { id: 'produkt', label: 'Produkt / Leistung', namen: ['produkt', 'leistung', 'paket', 'angebot', 'service', 'product', 'produkt/leistung'], enthaelt: ['produkt', 'leistung'] },
  { id: 'titel', label: 'Titel', namen: ['titel', 'mandat', 'projekt', 'bezeichnung', 'projektname', 'title'] },
  { id: 'honorar', label: 'Honorar netto / Monat',
    namen: ['honorar', 'honorar netto', 'monatshonorar', 'retainer', 'betrag', 'betrag netto', 'honorar/monat', 'honorar netto/monat', 'honorar netto / monat', 'preis', 'mrr', 'monatlich', 'fee', 'netto'], enthaelt: ['honorar', 'retainer'] },
  { id: 'start', label: 'Start', namen: ['start', 'beginn', 'startdatum', 'ab', 'vertragsbeginn', 'start date', 'seit', 'von'], enthaelt: ['beginn', 'start'] },
  { id: 'laufzeit', label: 'Laufzeit (Monate)', namen: ['laufzeit', 'laufzeit (monate)', 'laufzeit monate', 'monate', 'dauer', 'mindestlaufzeit', 'term'], enthaelt: ['laufzeit'] },
  { id: 'ende', label: 'Ende', namen: ['ende', 'enddatum', 'bis', 'vertragsende', 'end date'], enthaelt: ['vertragsende'] },
  { id: 'gesellschaft', label: 'Gesellschaft', namen: ['gesellschaft', 'einheit', 'vertragspartner', 'rechnungssteller', 'unsere gesellschaft', 'entity'], enthaelt: ['gesellschaft'] },
  { id: 'status', label: 'Status', namen: ['status', 'stand', 'phase'] },
  { id: 'ust', label: 'USt-Satz', namen: ['ust', 'ust-satz', 'ust satz', 'mwst', 'mwst-satz', 'umsatzsteuer', 'steuersatz', 'vat'], enthaelt: ['ust', 'mwst'] },
];

const STATUS: Record<string, MandatStatus> = {
  aktiv: 'aktiv', active: 'aktiv', laeuft: 'aktiv', laufend: 'aktiv', ja: 'aktiv',
  pausiert: 'pausiert', pause: 'pausiert', ruht: 'pausiert', paused: 'pausiert',
  beendet: 'beendet', ended: 'beendet', gekuendigt: 'beendet', abgeschlossen: 'beendet', ende: 'beendet',
  verhandlung: 'verhandlung', 'in verhandlung': 'verhandlung', angebot: 'angebot',
};
/** Produkt-Typ → Art des Mandats. */
const ART_AUS_TYP: Record<Leistung['typ'], ChancenArt> = { diagnose: 'projekt', workshop: 'workshop', retainer: 'retainer', sprint: 'projekt', vermittlung: 'vermittlung', software: 'software' };

export interface GesellschaftKurz { id: string; name?: string; status?: string }

/** Gesellschaft aus einem Text: feste (Name, Kurzname, Altname, Kennung) oder Register (`g-…` bzw. Name). „privat“/„offen“/Unbekanntes → null. */
export function gesellschaftAus(text: string, register: readonly GesellschaftKurz[]): Gesellschaft | null {
  const t = text.trim();
  if (!t) return null;
  if (istRegisterKennung(t)) return register.some(g => g.id === t) ? t : null;
  const ort = finanzOrtAus(t);
  if (ort && ort !== 'privat') return ort;
  const n = vergleichsText(t);
  const fest = KERN_EINHEITEN.find(e => vergleichsText(e.label) === n || vergleichsText(e.kurz) === n);
  if (fest) return fest.id;
  const r = register.find(g => istRegisterKennung(g.id) && g.name && vergleichsText(g.name) === n && g.status !== 'aufgeloest');
  return r ? (r.id as Gesellschaft) : null;
}

export interface MandatEingabe {
  quelle: string;
  kunde: string;
  /** Produkt aus dem Katalog (Name passt) — sonst nur Titel. */
  leistung?: Pick<Leistung, 'id' | 'name' | 'typ'>;
  titel: string;
  gesellschaft: Gesellschaft;
  /** Nur, was in der Zeile steht (leere Zellen fehlen hier und ändern nichts). */
  honorar?: number;
  start?: string;
  ende?: string;
  laufzeit?: number;
  status?: MandatStatus;
  ustSatz?: number;
}
export interface MandatFehler { quelle: string; schluessel: string; text: string }

/** Laufzeit-Text → Monate: „12“, „12 Monate“, „24 M“, „2 Jahre“, „1 J.“ (1–120). */
export function laufzeitAus(t: string): number | null {
  const s = vergleichsText(t).replace(',', '.');
  const m = /^(\d{1,3}(?:\.\d+)?)\s*(monate?|mon\.?|m\.?|jahre?|j\.?)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] && /^j/.test(m[2]) ? 12 : 1);
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
}

/** Datum oder Monat („01/2026“ → 2026-01-01). */
const tagAus = (t: string): string | null => datumAus(t) ?? (monatAus(t) ? `${monatAus(t)}-01` : null);

/** Datensätze → Mandats-Eingaben. `vorgabe` = Gesellschaft für Zeilen ohne eigene Angabe (aus der Oberfläche, nie „offen“). */
export function mandatEingaben(ds: readonly Datensatz[], ctx: { leistungen: readonly Leistung[]; register: readonly GesellschaftKurz[]; vorgabe?: string | null }): { eingaben: MandatEingabe[]; fehler: MandatFehler[]; hinweise: string[] } {
  const format = zahlformatVon(ds, ['honorar']);
  const eingaben: MandatEingabe[] = [], fehler: MandatFehler[] = [], hinweise: string[] = [];
  const vorgabe = ctx.vorgabe ? gesellschaftAus(ctx.vorgabe, ctx.register) : null;
  const ohneKatalog = new Set<string>();
  const eins = (d: Datensatz, f: string) => (d.werte[f] ?? []).join(' ').trim();
  for (const [i, d] of ds.entries()) {
    const schluessel = `z${i}`;
    const fehlt = (text: string) => fehler.push({ quelle: d.quelle, schluessel, text });
    const kunde = textGlaetten(eins(d, 'kunde'));
    if (!kunde) { fehlt('Kunde bzw. Firma fehlt.'); continue; }
    if (kunde.length > 160) { fehlt('Kunde länger als 160 Zeichen.'); continue; }
    const gText = eins(d, 'gesellschaft');
    const gesellschaft = gText ? gesellschaftAus(gText, ctx.register) : vorgabe;
    if (!gesellschaft) { fehlt(gText ? `Gesellschaft „${gText.slice(0, 40)}“ unbekannt — bitte eine eigene Gesellschaft (nie „offen“).` : 'Gesellschaft fehlt — Spalte zuordnen oder oben eine für alle Zeilen wählen.'); continue; }
    const pText = textGlaetten(eins(d, 'produkt'));
    const leistung = pText ? ctx.leistungen.find(l => vergleichsText(l.name) === vergleichsText(pText) && !l.geloeschtAm) : undefined;
    if (pText && !leistung) ohneKatalog.add(pText);
    const titel = textGlaetten(eins(d, 'titel')) || leistung?.name || pText || 'Mandat';
    if (titel.length > 200) { fehlt('Titel länger als 200 Zeichen.'); continue; }
    const e: MandatEingabe = { quelle: d.quelle, kunde, titel, gesellschaft, ...(leistung ? { leistung: { id: leistung.id, name: leistung.name, typ: leistung.typ } } : {}) };
    const h = centSumme(d.werte.honorar, format);
    if ('fehler' in h) { fehlt(`„${h.fehler.slice(0, 30)}“ ist kein Honorar.`); continue; }
    if (h.cent !== null) { if (h.cent < 0) { fehlt('Honorar ist negativ.'); continue; } e.honorar = h.cent / 100; }
    for (const [f, label] of [['start', 'Start'], ['ende', 'Ende']] as const) {
      const t = eins(d, f);
      if (!t) continue;
      const x = tagAus(t);
      if (!x) { fehlt(`„${t.slice(0, 20)}“ ist kein Datum (${label}).`); break; }
      e[f] = x;
    }
    if (fehler.some(x => x.schluessel === schluessel)) continue;
    if (e.start && e.ende && e.ende < e.start) { fehlt('Ende liegt vor dem Start.'); continue; }
    const lz = eins(d, 'laufzeit');
    if (lz) { const n = laufzeitAus(lz); if (n === null) { fehlt(`„${lz.slice(0, 20)}“ ist keine Laufzeit in Monaten (1–120).`); continue; } e.laufzeit = n; }
    const st = eins(d, 'status');
    if (st) { const s = STATUS[vergleichsText(st)]; if (!s) { fehlt(`Status „${st.slice(0, 20)}“ unbekannt (aktiv, pausiert, beendet, Verhandlung, Angebot).`); continue; } e.status = s; }
    const u = eins(d, 'ust');
    if (u) { const c = betragCent(u.replace('%', ''), 'komma'); const n = c === null ? NaN : c / 100; if (![0, 7, 19].includes(n)) { fehlt(`USt-Satz „${u.slice(0, 10)}“ — erlaubt sind 19, 7 oder 0.`); continue; } e.ustSatz = n; }
    eingaben.push(e);
  }
  if (ohneKatalog.size) hinweise.push(`${ohneKatalog.size} Produkt${ohneKatalog.size === 1 ? '' : 'e'} nicht im Katalog (${Array.from(ohneKatalog).slice(0, 3).map(p => `„${p}“`).join(', ')}${ohneKatalog.size > 3 ? ' …' : ''}) — als Titel übernommen, ohne Verknüpfung.`);
  return { eingaben, fehler, hinweise };
}

/** Feste Kennung je Zeile: dieselbe Gesellschaft, Firma, Leistung bzw. Titel und derselbe Start = dasselbe Mandat. */
export function mandatKennung(e: Pick<MandatEingabe, 'gesellschaft' | 'kunde' | 'leistung' | 'titel' | 'start'>): string {
  return `m-tab-${kurzHash([e.gesellschaft, firmenSchluessel(e.kunde) || vergleichsText(e.kunde), e.leistung?.id ?? vergleichsText(e.titel), e.start ?? ''].join('|'))}`;
}

/** Die Felder, die eine erneute Einfügung an einem vorhandenen Mandat ändert (nur, was in der Zeile steht). */
export function mandatTeil(e: MandatEingabe): Partial<Mandat> {
  return {
    ...(e.honorar !== undefined ? { honorar: { betrag: e.honorar, basis: 'monat', netto: true } } : {}),
    ...(e.laufzeit !== undefined ? { mindestlaufzeitMonate: e.laufzeit } : {}),
    ...(e.ende ? { ende: e.ende } : {}),
    ...(e.status ? { status: e.status } : {}),
    ...(e.ustSatz !== undefined ? { ustSatz: e.ustSatz } : {}),
  };
}

/** Das neue Mandat (Firma kommt beim Schreiben dazu). Vorgaben wie „+ Mandat“: monatlich, 14 Tage Zahlungsziel, Verlängerung offen. */
export function neuesMandat(id: string, e: MandatEingabe, firma: { id: string; name: string }, quelle: string): Record<string, unknown> {
  return {
    id, kunde: firma.name, firmaId: firma.id, titel: e.titel, kontaktIds: [], art: e.leistung ? ART_AUS_TYP[e.leistung.typ] ?? 'retainer' : 'retainer',
    ...(e.leistung ? { leistungId: e.leistung.id } : {}),
    gesellschaft: e.gesellschaft, status: e.status ?? 'aktiv', vertragUnterschrieben: false, verlaengerung: 'offen',
    ...(e.start ? { start: e.start } : {}), ...(e.ende ? { ende: e.ende } : {}), ...(e.laufzeit !== undefined ? { mindestlaufzeitMonate: e.laufzeit } : {}),
    honorar: { betrag: e.honorar ?? 0, basis: 'monat', netto: true }, ustSatz: e.ustSatz ?? 19,
    rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], quelle,
  };
}

export interface MandatPlanZeile {
  schluessel: string;
  quelle: string;
  status: 'neu' | 'geaendert' | 'gleich' | 'uebersprungen';
  id: string;
  eingabe: MandatEingabe;
  firma: FirmaPlan;
  aenderungen: { feld: string; alt?: string; neu?: string }[];
  text?: string;
}

const euro = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const tagText = (t?: string) => (t ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : undefined);
const STATUS_NAME: Record<MandatStatus, string> = { aktiv: 'aktiv', pausiert: 'pausiert', beendet: 'beendet', verhandlung: 'Verhandlung', angebot: 'Angebot' };

/** Vergleich eines vorhandenen Mandats mit der Zeile — nur die Felder, die die Zeile trägt. */
function unterschiede(m: Mandat, e: MandatEingabe): MandatPlanZeile['aenderungen'] {
  const a: MandatPlanZeile['aenderungen'] = [];
  if (e.honorar !== undefined && (Math.round(m.honorar.betrag * 100) !== Math.round(e.honorar * 100) || m.honorar.basis !== 'monat')) a.push({ feld: 'Honorar / Monat', alt: m.honorar.basis === 'monat' ? euro(m.honorar.betrag) : `${euro(m.honorar.betrag)} (${m.honorar.basis})`, neu: euro(e.honorar) });
  if (e.laufzeit !== undefined && m.mindestlaufzeitMonate !== e.laufzeit) a.push({ feld: 'Laufzeit', ...(m.mindestlaufzeitMonate ? { alt: `${m.mindestlaufzeitMonate} Monate` } : {}), neu: `${e.laufzeit} Monate` });
  if (e.ende && m.ende !== e.ende) a.push({ feld: 'Ende', ...(m.ende ? { alt: tagText(m.ende) } : {}), neu: tagText(e.ende) });
  if (e.status && m.status !== e.status) a.push({ feld: 'Status', alt: STATUS_NAME[m.status], neu: STATUS_NAME[e.status] });
  if (e.ustSatz !== undefined && m.ustSatz !== e.ustSatz) a.push({ feld: 'USt-Satz', alt: `${m.ustSatz} %`, neu: `${e.ustSatz} %` });
  return a;
}

/**
 * Plan: je Zeile neu · geändert · gleich · übersprungen, mit der Firma (vorhanden · neu · aus dem Papierkorb zurück). `firmen`/`mandate` MIT
 * Papierkorb (die Sicht ohne Papierkorb rechnet der Plan selbst). Dieselbe Zeile zweimal → Fehler.
 */
export function mandatPlan(eingaben: readonly MandatEingabe[], crm: { firmen: readonly Firma[]; mandate: readonly Mandat[] }, heute: string, jetzt: string): { zeilen: MandatPlanZeile[]; doppelt: MandatFehler[] } {
  const sicht = crm.firmen.filter(f => !f.geloeschtAm);
  const zeilen: MandatPlanZeile[] = [], doppelt: MandatFehler[] = [];
  const gesehen = new Set<string>();
  for (const [n, e] of eingaben.entries()) {
    const id = mandatKennung(e);
    if (gesehen.has(id)) { doppelt.push({ quelle: e.quelle, schluessel: `d${n}`, text: `${e.kunde} · ${e.titel} steht zweimal in der Liste — bitte nur einmal einfügen.` }); continue; }
    gesehen.add(id);
    const firma = firmaPlanen(sicht, crm.firmen, e.kunde, {}, heute, jetzt)!;
    const basis = { schluessel: id, quelle: e.quelle, id, eingabe: e, firma };
    const da = crm.mandate.find(m => m.id === id);
    if (da?.geloeschtAm) { zeilen.push({ ...basis, status: 'uebersprungen', aenderungen: [], text: 'liegt im Papierkorb — erst dort wiederherstellen' }); continue; }
    if (da) {
      const a = unterschiede(da, e);
      zeilen.push({ ...basis, status: a.length ? 'geaendert' : 'gleich', aenderungen: a, ...(a.length ? {} : { text: 'steht schon so' }) });
      continue;
    }
    // Von Hand angelegt: gleiche Firma, Gesellschaft und Leistung (bzw. Titel), Start gleich oder offen — nie ein zweites daneben.
    const firmaKey = firmenSchluessel(firma.firma.name);
    const hand = crm.mandate.find(m => !m.geloeschtAm && m.gesellschaft === e.gesellschaft
      && (m.firmaId ? m.firmaId === firma.firma.id : firmenSchluessel(m.kunde) === firmaKey)
      && (e.leistung ? m.leistungId === e.leistung.id : vergleichsText(m.titel) === vergleichsText(e.titel))
      && (!m.start || !e.start || m.start === e.start));
    if (hand) { zeilen.push({ ...basis, status: 'uebersprungen', aenderungen: [], text: `gibt es schon („${hand.titel}“${hand.start ? ` ab ${tagText(hand.start)}` : ''}) — übersprungen` }); continue; }
    zeilen.push({
      ...basis, status: 'neu',
      aenderungen: [
        { feld: 'Gesellschaft', neu: istRegisterKennung(e.gesellschaft) ? 'Register-Gesellschaft' : finanzOrtName(e.gesellschaft as 'kdc' | 'kdv' | 'ug') },
        { feld: 'Honorar / Monat', neu: euro(e.honorar ?? 0) },
        ...(e.start ? [{ feld: 'Start', neu: tagText(e.start) }] : []),
        ...(e.laufzeit !== undefined ? [{ feld: 'Laufzeit', neu: `${e.laufzeit} Monate` }] : []),
        ...(e.ende ? [{ feld: 'Ende', neu: tagText(e.ende) }] : []),
        { feld: 'Status', neu: STATUS_NAME[e.status ?? 'aktiv'] },
      ],
      ...(e.honorar === undefined ? { text: 'Honorar fehlt — 0 € eingetragen' } : {}),
    });
  }
  return { zeilen, doppelt };
}

const firmaSatz = (p: FirmaPlan) => (p.art === 'vorhanden' ? `Firma „${p.firma.name}“ vorhanden` : p.art === 'neu' ? `Firma „${p.firma.name}“ wird angelegt` : `Firma „${p.firma.name}“ wird aus dem Papierkorb zurückgeholt`);

/** Vorschau in der gemeinsamen Form. */
export function mandatVorschauZeilen(plan: readonly MandatPlanZeile[], fehler: readonly MandatFehler[]): VorschauZeile[] {
  return [
    ...plan.map(z => ({
      schluessel: z.schluessel, quelle: z.quelle, status: z.status,
      titel: `${z.firma.firma.name} · ${z.eingabe.titel}`,
      text: [z.status === 'neu' ? firmaSatz(z.firma) : '', z.text ?? ''].filter(Boolean).join(' · ') || undefined,
      aenderungen: z.aenderungen,
    })),
    ...fehler.map(f => ({ schluessel: f.schluessel, quelle: f.quelle, titel: f.quelle, status: 'fehler' as const, text: f.text })),
  ];
}

// ── Lauf-Protokoll (nur Kennungen und Fingerabdrücke) ────────────────────────────────────────────────────────────────────────────

export interface MandatLauf {
  /** `mt-<uuid>` */
  id: string;
  /** ISO-Zeitpunkt. */
  am: string;
  status: 'laeuft' | 'uebernommen' | 'zurueckgenommen' | 'teilweise' | 'fehlgeschlagen';
  /** Angelegte bzw. geänderte Mandate: Kennung, Stand danach (Fingerabdruck), bei geänderten die alten Werte der geänderten Felder. */
  mandate: { id: string; neu: boolean; stand?: string; alt?: Record<string, unknown> }[];
  /** Vom Lauf neu angelegte Firmen (nur diese nimmt „Rückgängig“ wieder weg — unverändert und ohne Verweise). */
  firmen: { id: string; stand?: string }[];
  zurueck?: { am: string; mandate: number; firmen: number; konflikte: number };
}

/** Die alten Werte der Felder, die die Zeile an einem vorhandenen Mandat ändert (für Rückgängig; '' = Feld fehlte — der Säuberer lässt es weg). */
export function altWerte(m: Mandat, e: MandatEingabe): Record<string, unknown> {
  const t = mandatTeil(e);
  return Object.fromEntries(Object.keys(t).map(k => [k, (m as unknown as Record<string, unknown>)[k] ?? '']));
}
