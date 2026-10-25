// ─── Produkte & Mandate · Mandat anlegen mit Lead (Firma + Ansprechperson) — die reinen Regeln (10.10.) ─────────────────
// Entscheidung 10.10.: Beim Anlegen eines Kunden/Mandats (Produkte & Mandate › „+ Mandat“, ebenso aus einer Stufe der Leistungstreppe) wird
// IMMER ein Lead zugeordnet: Firma + Ansprechperson — vorhandene per Klick wählen oder direkt neu anlegen. Danach steht alles sauber im CRM
// unter den Kunden — dieselbe Folge wie „Mandat anlegen“ aus einem gewonnenen Deal (`/api/crm/lead` aktion „mandat“): Firma → Kunde, Lead der
// Firma → Kunde, Personen → Lebensphase Kunde. Bestehende Mandate ohne Firma bekommen „Firma zuordnen“ (gleicher Dialog, nur auf Klick).
// Hier: Eingabe säubern (nie kürzen — zu lang → 413), Mandat-Entwurf, Folgen an der Firma. Der Ablauf (Firma sichern → Person anlegen →
// Mandat → Kartei) steht in lib/crm/mandat-anlegen-server.ts.

import type { Firma, Gesellschaft, Lead, Leistung, Mandat } from './typen';
import { honorarAusPreis, mandatVorlageAusProdukt } from './produkt-karte';
import { istGesellschaft, istRegisterKennung } from '@/lib/einheiten';
import { leereKriterien } from './leads';
import { istKontaktKennung } from '@/lib/kennung';
import { localDay, tagVon } from '@/lib/zeit';
import { startAus } from './mandat-aus-deal';

export type FirmaWahl = { id: string } | { name: string };
export type PersonWahl = { id: string } | { neu: Record<string, unknown> };
export interface MandatEingabe {
  firma: FirmaWahl;
  person: PersonWahl;
  gesellschaft: Gesellschaft;
  titel?: string;
  leistungId?: string;
  /** Stufe der Leistungstreppe (lib/crm/treppe-daten.ts), aus der heraus angelegt wurde. */
  stufeId?: string;
  zustaendig?: string;
  /**
   * Vertrag aus dem Dialog (19.10., P3): vom gewählten Produkt vorbelegt (`mandatVorlageAusProdukt`), änderbar — was hier steht, gewinnt über die
   * Vorlage. Fehlt es, gilt die Vorlage des Produkts (wie bisher).
   */
  vertrag?: MandatVertragEingabe;
  /**
   * Start des Mandats (25.10., Kern-Reste 1 — derselbe Vorgabe-Start wie das Fenster „Mandat anlegen“: der Dialog belegt den ersten Tag des Folgemonats vor).
   * Ohne Angabe wie bisher heute (ältere Aufrufer, Demo-Saat).
   */
  start?: string;
}
/** Die änderbaren Vertragsfelder beim Anlegen (alles optional). */
export interface MandatVertragEingabe {
  honorar?: { betrag: number; basis: Mandat['honorar']['basis'] };
  mindestlaufzeitMonate?: number | null;
  kuendigungsfristTage?: number | null;
  rechnungsrhythmus?: Mandat['rechnungsrhythmus'];
  zahlungszielTage?: number;
  leistungen?: string[];
}
export const MANDAT_GRENZEN = { firma: 160, titel: 120, leistungen: 50, leistung: 400, honorar: 10_000_000, laufzeit: 120, frist: 365, ziel: 120 } as const;
const BASEN = ['monat', 'einmalig', 'tag'] as const;
const RHYTHMEN = ['monatlich', 'quartal', 'einmalig'] as const;

/** Vertragsfelder aus dem Netz (P3): Unsinn → 400, zu viel/zu lang → 413 (nie gekürzt). Fehlt das Objekt: keine Angaben. */
export function vertragEingabeAus(v: unknown): { ok: true; vertrag?: MandatVertragEingabe } | { ok: false; status: 400 | 413; fehler: string } {
  if (v === undefined || v === null) return { ok: true };
  if (typeof v !== 'object' || Array.isArray(v)) return { ok: false, status: 400, fehler: 'vertrag: ein Objekt.' };
  const o = v as Record<string, unknown>;
  const raus: MandatVertragEingabe = {};
  const ganz = (x: unknown, max: number, name: string, min = 0): number | string => (typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max ? x : `${name}: ganze Zahl von ${min} bis ${max}.`);
  if (o.honorar !== undefined) {
    const h = o.honorar && typeof o.honorar === 'object' ? o.honorar as Record<string, unknown> : null;
    if (!h || typeof h.betrag !== 'number' || !Number.isFinite(h.betrag) || h.betrag < 0 || h.betrag > MANDAT_GRENZEN.honorar || !(BASEN as readonly unknown[]).includes(h.basis)) return { ok: false, status: 400, fehler: 'Honorar: Betrag (Euro, ab 0) und Basis je Monat, einmalig oder je Tag.' };
    raus.honorar = { betrag: Math.round(h.betrag * 100) / 100, basis: h.basis as Mandat['honorar']['basis'] };
  }
  for (const [k, max, name, min] of [['mindestlaufzeitMonate', MANDAT_GRENZEN.laufzeit, 'Mindestlaufzeit (Monate)', 1], ['kuendigungsfristTage', MANDAT_GRENZEN.frist, 'Kündigungsfrist (Tage)', 0]] as const) {
    if (o[k] === undefined) continue;
    if (o[k] === null) { raus[k] = null; continue; }
    const n = ganz(o[k], max, name, min);
    if (typeof n === 'string') return { ok: false, status: 400, fehler: n };
    raus[k] = n;
  }
  if (o.zahlungszielTage !== undefined) {
    const n = ganz(o.zahlungszielTage, MANDAT_GRENZEN.ziel, 'Zahlungsziel (Tage)');
    if (typeof n === 'string') return { ok: false, status: 400, fehler: n };
    raus.zahlungszielTage = n;
  }
  if (o.rechnungsrhythmus !== undefined) {
    if (!(RHYTHMEN as readonly unknown[]).includes(o.rechnungsrhythmus)) return { ok: false, status: 400, fehler: 'Rechnungsrhythmus: monatlich, quartal oder einmalig.' };
    raus.rechnungsrhythmus = o.rechnungsrhythmus as Mandat['rechnungsrhythmus'];
  }
  if (o.leistungen !== undefined) {
    if (!Array.isArray(o.leistungen) || o.leistungen.some(x => typeof x !== 'string')) return { ok: false, status: 400, fehler: 'Leistungen: eine Liste von Texten.' };
    const l = (o.leistungen as string[]).map(x => x.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (l.length > MANDAT_GRENZEN.leistungen) return { ok: false, status: 413, fehler: `Höchstens ${MANDAT_GRENZEN.leistungen} Leistungen — nichts gespeichert.` };
    if (l.some(x => x.length > MANDAT_GRENZEN.leistung)) return { ok: false, status: 413, fehler: `Eine Leistung ist länger als ${MANDAT_GRENZEN.leistung} Zeichen — nichts gespeichert.` };
    raus.leistungen = l;
  }
  return { ok: true, vertrag: raus };
}
const FIRMA_ID = /^f-[a-z0-9-]{2,63}$/;
const LEISTUNG_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const STUFE_ID = /^ts-[a-z0-9-]{4,60}$/;
const text = (v: unknown) => (typeof v === 'string' ? v.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim() : '');

/** Firma-Wahl aus dem Netz: vorhandene Kennung oder ein Name (neu bzw. per Name gefunden — nie doppelt). */
export function firmaWahlAus(v: unknown): { ok: true; wahl: FirmaWahl } | { ok: false; status: 400 | 413; fehler: string } {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : {};
  if (typeof o.id === 'string') return FIRMA_ID.test(o.id) ? { ok: true, wahl: { id: o.id } } : { ok: false, status: 400, fehler: 'Ungültige Firmen-Kennung.' };
  const name = text(o.name);
  if (!name) return { ok: false, status: 400, fehler: 'Bitte eine Firma wählen oder neu anlegen — ein Mandat hängt immer an einer Firma.' };
  if (name.length > MANDAT_GRENZEN.firma) return { ok: false, status: 413, fehler: `Der Firmenname ist zu lang (höchstens ${MANDAT_GRENZEN.firma} Zeichen) — nichts gespeichert.` };
  return { ok: true, wahl: { name } };
}

/** Personen-Wahl aus dem Netz: vorhandene Kennung oder die Angaben einer neuen Person (geprüft im EINEN Weg „Person anlegen“). */
export function personWahlAus(v: unknown): { ok: true; wahl: PersonWahl } | { ok: false; status: 400; fehler: string } {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : {};
  if (typeof o.id === 'string') return istKontaktKennung(o.id) ? { ok: true, wahl: { id: o.id } } : { ok: false, status: 400, fehler: 'Ungültige Personen-Kennung.' };
  if (o.neu && typeof o.neu === 'object') return { ok: true, wahl: { neu: o.neu as Record<string, unknown> } };
  return { ok: false, status: 400, fehler: 'Bitte eine Ansprechperson wählen oder neu anlegen.' };
}

/** Die ganze Eingabe von „+ Mandat“. `heute` nur für die Prüfung des Starts (höchstens zwei Jahre von heute). */
export function mandatEingabeAus(roh: unknown, heute: string = localDay()): { ok: true; e: MandatEingabe } | { ok: false; status: 400 | 413; fehler: string } {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  const f = firmaWahlAus(o.firma);
  if (!f.ok) return f;
  const p = personWahlAus(o.person);
  if (!p.ok) return p;
  const g = text(o.gesellschaft) || 'offen';
  if (g !== 'offen' && !istGesellschaft(g) && !istRegisterKennung(g)) return { ok: false, status: 400, fehler: 'Unbekannte Gesellschaft.' };
  const titel = text(o.titel);
  if (titel.length > MANDAT_GRENZEN.titel) return { ok: false, status: 413, fehler: `Der Titel ist zu lang (höchstens ${MANDAT_GRENZEN.titel} Zeichen) — nichts gespeichert.` };
  const leistungId = text(o.leistungId), stufeId = text(o.stufeId);
  if (leistungId && !LEISTUNG_ID.test(leistungId)) return { ok: false, status: 400, fehler: 'Ungültige Produkt-Kennung.' };
  if (stufeId && !STUFE_ID.test(stufeId)) return { ok: false, status: 400, fehler: 'Ungültige Stufe.' };
  const v = vertragEingabeAus(o.vertrag);
  if (!v.ok) return v;
  const start = o.start === undefined || o.start === null || o.start === '' ? undefined : startAus(o.start, heute);
  if (start === null) return { ok: false, status: 400, fehler: 'Start: ein Tag JJJJ-MM-TT (höchstens zwei Jahre von heute).' };
  return { ok: true, e: { firma: f.wahl, person: p.wahl, gesellschaft: g as Gesellschaft, ...(titel ? { titel } : {}), ...(leistungId ? { leistungId } : {}), ...(stufeId ? { stufeId } : {}), ...(text(o.zustaendig) ? { zustaendig: text(o.zustaendig) } : {}), ...(v.vertrag && Object.keys(v.vertrag).length ? { vertrag: v.vertrag } : {}), ...(start ? { start } : {}) } };
}

/**
 * Monatshonorar + Rechnungsrhythmus aus einem Preis (Produkt bzw. Deal-Wert) — seit 19.10. in lib/crm/produkt-karte.ts (EINE Stelle mit der
 * Produkt-Karte), hier weiter exportiert. „je Jahr“ → ÷ 12 auf den Cent, „einmalig“ bleibt einmalig, sonst monatlich.
 */
export { honorarAusPreis };

/** Das Produkt für `mandatEntwurf`: das ganze Produkt aus dem Katalog — mindestens Kennung, Name und Preis (Betrag, Basis). */
export type EntwurfLeistung = Pick<Leistung, 'id' | 'name'> & { preis: Pick<Leistung['preis'], 'betrag'> & Partial<Leistung['preis']> } & Partial<Omit<Leistung, 'id' | 'name' | 'preis'>>;

/**
 * Das neue Mandat (wie aus einem gewonnenen Deal: aktiv ab heute, Vertrag und Kickoff als offene Punkte) — mit Firma, Ansprechperson, ggf. Produkt.
 * Seit 19.10. aus der Vorlage des Produkts (`mandatVorlageAusProdukt`): Art, Honorar, Vertrag (Mindestlaufzeit, Kündigung, Verlängerung, Rhythmus,
 * Zahlungsziel, USt), Leistungen und Hinweise. Die Gesellschaft der Eingabe gilt; steht sie auf „offen“, kommt sie vom Produkt. Ohne Karten-Felder
 * am Produkt genau wie bisher.
 */
export function mandatEntwurf(o: { id: string; firma: Pick<Firma, 'id' | 'name'>; kontaktIds: string[]; gesellschaft: Gesellschaft; titel?: string; leistung?: EntwurfLeistung | null; zustaendig?: string; vertrag?: MandatVertragEingabe; start?: string; jetzt: string; person: string }): Mandat {
  // Ältere Aufrufer reichen nur Kennung, Name und Preis — ohne Karten-Felder nimmt die Vorlage genau den bisherigen Weg (Honorar aus dem Preis).
  const v0 = o.leistung ? mandatVorlageAusProdukt(o.leistung as Leistung) : null;
  // Was im Dialog geändert wurde (P3), gewinnt über die Vorlage; ein einmaliges Honorar ohne eigenen Rhythmus wird einmalig abgerechnet.
  const w = o.vertrag;
  const v = v0 && w ? {
    ...v0,
    ...(w.honorar ? { honorar: { betrag: w.honorar.betrag, basis: w.honorar.basis, netto: true }, rechnungsrhythmus: w.rechnungsrhythmus ?? (w.honorar.basis === 'einmalig' ? 'einmalig' as const : v0.rechnungsrhythmus === 'einmalig' ? 'monatlich' as const : v0.rechnungsrhythmus) } : {}),
    ...(w.rechnungsrhythmus ? { rechnungsrhythmus: w.rechnungsrhythmus } : {}),
    ...(w.mindestlaufzeitMonate !== undefined ? { mindestlaufzeitMonate: w.mindestlaufzeitMonate ?? undefined } : {}),
    ...(w.kuendigungsfristTage !== undefined ? { kuendigungsfristTage: w.kuendigungsfristTage ?? undefined } : {}),
    ...(w.zahlungszielTage !== undefined ? { zahlungszielTage: w.zahlungszielTage } : {}),
    ...(w.leistungen ? { leistungen: w.leistungen } : {}),
  } : v0;
  const h = v ?? honorarAusPreis(undefined);
  return {
    id: o.id, kunde: o.firma.name, firmaId: o.firma.id, kontaktIds: o.kontaktIds, titel: o.titel || o.leistung?.name || 'Mandat', art: v?.art ?? 'retainer',
    ...(o.leistung ? { leistungId: o.leistung.id } : {}), gesellschaft: o.gesellschaft !== 'offen' ? o.gesellschaft : v?.gesellschaft ?? 'offen', status: 'aktiv', vertragUnterschrieben: false, start: o.start ?? tagVon(o.jetzt),
    ...(v?.mindestlaufzeitMonate ? { mindestlaufzeitMonate: v.mindestlaufzeitMonate } : {}), ...(v?.kuendigungsfristTage != null ? { kuendigungsfristTage: v.kuendigungsfristTage } : {}),
    verlaengerung: v?.verlaengerung ?? 'offen',
    honorar: h.honorar, ustSatz: v?.ustSatz ?? 19,
    rechnungsrhythmus: h.rechnungsrhythmus, zahlungszielTage: v?.zahlungszielTage ?? 14, ziele: [],
    health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: v?.leistungen ?? [], offen: ['Vertrag unterschreiben lassen', 'Kickoff-Termin festlegen', ...(v?.hinweise ?? [])],
    ...(v?.zusatz?.length ? { zusatz: v.zusatz } : {}),
    // Zahlplan (21.10., B2): nur, solange das Honorar einmalig bleibt (im Dialog auf „je Monat“ umgestellt: keiner).
    ...(v?.zahlplan && h.honorar.basis === 'einmalig' ? { zahlplan: v.zahlplan } : {}),
    // Geplante Tage (21.10., B4): nur, solange das Honorar je Tag bleibt.
    ...(v?.tageJeMonat && h.honorar.basis === 'tag' ? { tageJeMonat: v.tageJeMonat } : {}),
    quelle: 'Von Hand angelegt (Produkte & Mandate)', ...(o.zustaendig ? { zustaendig: o.zustaendig } : {}), geaendert: o.jetzt, geaendertVon: o.person,
  };
}

/**
 * Welche Folge hat „Firma zuordnen“ an einem BESTEHENDEN Mandat (Prüf-Fund 11.10.)? Nur ein aktives Mandat macht die Firma und die Person zu
 * Kunden; ein beendetes oder pausiertes höchstens zu Ex-Kunden (BEAN, Lifecycle und Kanal-Ampel lesen das); Angebot/Verhandlung: keine. Rein.
 */
export function zuordnenFolge(status: Mandat['status']): 'kunde' | 'ex_kunde' | null {
  if (status === 'aktiv') return 'kunde';
  if (status === 'beendet' || status === 'pausiert') return 'ex_kunde';
  return null;
}

/** Ex-Kunde an der Firma: Rolle „Ex-Kunde“ — nur, wenn sie nicht von Hand gesetzt ist und die Firma nicht schon (aus einem anderen Mandat) Kunde ist. */
export function firmaWirdExKunde(f: Firma): Firma {
  if (f.rolleVonHand || f.rolle === 'kunde') return f;
  return { ...f, rolle: 'ex_kunde' as Firma['rolle'] };
}

/**
 * Die Folge an der Firma (wie aus einem gewonnenen Deal): Rolle „Kunde“ (außer von Hand gesetzt) und der Lead der Firma auf „Kunde“ — ein
 * vorhandener Lead behält Kriterien, Antworten und Notizen; ohne Lead entsteht einer mit Status „Kunde“.
 */
export function firmaWirdKunde(f: Firma): Firma {
  const lead: Lead = f.lead ? { ...f.lead, status: 'kunde' } : { status: 'kunde', kriterien: leereKriterien() };
  return { ...f, ...(f.rolleVonHand ? {} : { rolle: 'kunde' as Firma['rolle'] }), lead };
}
