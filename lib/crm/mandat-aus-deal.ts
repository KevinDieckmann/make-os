// ─── Mandat aus einem gewonnenen Deal — die Vorbelegung (rein, client-sicher, getestet; 24.10., Branch `kern-preise`) ─────────────────────────────
// Bau-Test 24.10. (Kevin: „Das wird das Modul sein, worüber wir jetzt bald am meisten arbeiten werden“): „Mandat anlegen“ legte das Mandat sofort an — mit
// Start „heute“ und ohne Vorbelegung zum Prüfen; die weiteren Preis-Teile des Produkts standen nur als Namen unter „Leistungen“. Jetzt:
//   · EINE Stelle baut das Mandat aus Deal, angenommenem Angebot (`mandatVorbelegung`) bzw. Produkt (`mandatVorlageAusProdukt`) — die Route
//     `/api/crm/lead` aktion „mandat“ nutzt sie für die Vorschau (`vorschau: true`, schreibt nichts) UND fürs Anlegen (dieselbe Zahl, nie zwei Rechnungen).
//   · Der Start ist wählbar (`start`); die Vorgabe des Fensters ist der erste Tag des Folgemonats (`startVorschlag`). Ohne `start` wie bisher heute.
// Bisher stand der Bau inline in app/api/crm/lead/route.ts — dort unverändert in der Wirkung (Tests: tests/mandat-produkt-server.test.ts).

import type { Angebot, Chance, Firma, Leistung, Mandat } from './typen';
import { honorarAusPreis, istKombi, mandatVertragAusProdukt, mandatVorlageAusProdukt } from './produkt-karte';
import { angenommenZuDeal, mandatVorbelegung } from './angebote';
import { istBusinessGesellschaft } from '@/lib/einheiten';
import { istPrivatArbeitsMandat } from '@/lib/fulfillment/regeln';

/** Der erste Tag des Folgemonats (Vorgabe des Starts im Fenster „Mandat anlegen“). */
export function startVorschlag(heute: string): string {
  const [j, m] = heute.slice(0, 7).split('-').map(Number);
  return m === 12 ? `${j + 1}-01-01` : `${j}-${String(m + 1).padStart(2, '0')}-01`;
}
const TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Ein Start aus dem Netz: Tag JJJJ-MM-TT (Kalendertag), höchstens zwei Jahre vor bzw. nach heute — sonst null (die Route antwortet 400). */
export function startAus(v: unknown, heute: string): string | null {
  if (typeof v !== 'string' || !TAG.test(v)) return null;
  const ms = Date.parse(`${v}T12:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== v) return null;
  const abstand = Math.abs(ms - Date.parse(`${heute}T12:00:00Z`)) / 864e5;
  return abstand <= 731 ? v : null;
}

export interface MandatAusDealKontext {
  leistungen: readonly Leistung[];
  angebote?: readonly Angebot[];
  firmen: readonly Pick<Firma, 'id' | 'name'>[];
  /** Neue Kennung des Mandats (`m-…`). */
  id: string;
  jetzt: string;
  heute: string;
  person: string;
  /** Gewählter Start (sonst heute — wie bisher). */
  start?: string;
}
export interface MandatAusDeal { mandat: Mandat; quelle: 'angebot' | 'produkt' | 'deal'; angebot?: Pick<Angebot, 'id' | 'nummer'> }

/**
 * Das Mandat aus einem gewonnenen Deal (rein): Kunde = Firma (sonst „Privatkunde“, nie der Deal-Titel), Honorar aus dem Deal-Wert, dann
 *   · angenommenes Angebot → `mandatVorbelegung` (Honorar, Laufzeit, Produkt, Gesellschaft, USt, Zahlungsziel, Leistungen; bei einer Kombination jeder
 *     weitere Preis-Teil als Zusatzmodul mit dem vereinbarten Preis); das angenommene Angebot IST die Unterschrift;
 *   · sonst das Produkt → Vertrag + Vorlage (der Deal-Wert gewinnt; ohne Wert das Honorar des Produkts; die übrigen Preis-Teile einer Kombination als
 *     Zusatzmodule, inklusive Module, offene Punkte).
 */
export function mandatAusDeal(c: Chance, ctx: MandatAusDealKontext): MandatAusDeal {
  const kunde = (c.firmaId ? ctx.firmen.find(f => f.id === c.firmaId)?.name : undefined) ?? c.firma ?? 'Privatkunde';
  const m: Mandat = {
    id: ctx.id, kunde, ...(c.firmaId ? { firmaId: c.firmaId } : {}), kontaktIds: c.kontaktIds, titel: c.titel, art: c.art, chanceId: c.id, gesellschaft: c.gesellschaft, status: 'aktiv',
    // Das Produkt reist mit (26.09.) — sonst sieht die Produkt-Auswertung das Mandat nie.
    ...(c.leistungId ? { leistungId: c.leistungId } : {}),
    vertragUnterschrieben: false, start: ctx.start ?? ctx.heute, verlaengerung: 'offen',
    // Prüf-Fund 11.10.: EINE Umrechnung mit „+ Mandat“ (je Jahr → ÷ 12 auf den Cent).
    ...honorarAusPreis(c.wert),
    ustSatz: 19, zahlungszielTage: 14, ziele: [],
    health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: ['Vertrag unterschreiben lassen', 'Kickoff-Termin festlegen'],
    quelle: `aus Deal „${c.titel}“`, zustaendig: c.besitzer, geaendert: ctx.jetzt, geaendertVon: ctx.person,
  };
  const angebot = angenommenZuDeal(ctx.angebote as Angebot[] | undefined, c.id);
  const produkt = c.leistungId ? ctx.leistungen.find(l => l.id === c.leistungId) : undefined;
  if (!angebot && produkt) {
    Object.assign(m, mandatVertragAusProdukt(produkt, m.honorar.basis));
    // P3 (19.10.): die Vorlage des Produkts auch hier — der Deal-Wert ist vereinbart (er gewinnt); ohne Wert das Honorar des Produkts.
    const v = mandatVorlageAusProdukt(produkt);
    // Kombination (24.10.): die übrigen Preis-Teile werden Zusatzmodule — passt die Basis des Deal-Werts nicht zum Hauptpreis (z. B. nur der Festpreis als
    // Wert), gilt der Hauptpreis des Produkts als Honorar; sonst stünde ein Teil zweimal im Mandat.
    const basisPasst = !istKombi(produkt) || m.honorar.basis === v.honorar.basis;
    if ((!(m.honorar.betrag > 0) || !basisPasst) && v.honorar.betrag > 0) Object.assign(m, { honorar: v.honorar, rechnungsrhythmus: v.rechnungsrhythmus }, mandatVertragAusProdukt(produkt, v.honorar.basis));
    if (!m.leistungen.length && v.leistungen.length) m.leistungen = v.leistungen;
    if (v.hinweise.length) m.offen = [...m.offen, ...v.hinweise];
    if (m.gesellschaft === 'offen' && v.gesellschaft) m.gesellschaft = v.gesellschaft;
    if (v.zusatz?.length) m.zusatz = v.zusatz;
    // Zahlplan (21.10., B2): nur bei einmaligem Honorar (der Deal-Wert gewinnt — seine Basis entscheidet).
    if (v.zahlplan && m.honorar.basis === 'einmalig') m.zahlplan = v.zahlplan;
    if (v.tageJeMonat && m.honorar.basis === 'tag') m.tageJeMonat = v.tageJeMonat;
  }
  if (angebot) {
    const { offen: vOffen, ...v } = mandatVorbelegung(angebot, ctx.leistungen);
    Object.assign(m, v, { quelle: `aus Angebot ${angebot.nummer ?? ''} (Deal „${c.titel}“)`.replace('  ', ' ') });
    if (!v.titel) m.titel = c.titel;
    // Das angenommene Angebot IST die Unterschrift (17.10., Gesamtprüfung L1 B3). Den Kick-off führt bei Business-Mandaten der Fall — kein zweiter offener Punkt;
    // seit 25.10. ebenso bei Mandaten der Privat-Arbeits-Einheit (sie bekommen Fulfillment, `istPrivatArbeitsMandat`).
    m.vertragUnterschrieben = true;
    const fallFuehrtKickoff = istBusinessGesellschaft(m.gesellschaft) || istPrivatArbeitsMandat(m.gesellschaft);
    m.offen = [...m.offen.filter(x => x !== 'Vertrag unterschreiben lassen' && !(fallFuehrtKickoff && x === 'Kickoff-Termin festlegen')), ...(vOffen ?? [])];
  }
  return { mandat: m, quelle: angebot ? 'angebot' : produkt ? 'produkt' : 'deal', ...(angebot ? { angebot: { id: angebot.id, ...(angebot.nummer ? { nummer: angebot.nummer } : {}) } } : {}) };
}
