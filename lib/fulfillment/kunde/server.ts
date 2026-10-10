// ─── Fulfillment · Kunde — Schnittstellen für die anderen Pakete (Server; STUB aus C0, gehört ab jetzt Paket C2) ─────────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 11 (C2): Die Signaturen sind fest — C1 (Cockpit), C3 (Analyse liest Formular-Antworten und freigegebene
// Unterlagen), die Leistungstreppe (Report) und die Hub-Dateien von C0 rufen genau diese Namen. C2 füllt die Rümpfe; neue Exporte darf C2
// dazunehmen, bestehende nicht umbenennen. Bis dahin: kein Link („aus“), keine Antworten, keine Unterlagen, kein Report-Zusatz (= Report wie heute).

import type { PersonMerkmale } from '@/lib/crm/person-weitere';
import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { FormularStand, FristenKontext, KundeAuskunft, KundeKurz, MorgenlaufTeil, ReportZusatz, Unterlage } from '../typen';

/** Kurzform je Mandat für Cockpit und Fall (Link-Stand, Formular in %, ungeprüfte Unterlagen, Puls) — Schlüssel = Mandat-Kennung. */
export async function kundeKurzFuer(mandatIds: readonly string[]): Promise<Record<string, KundeKurz>> {
  return Object.fromEntries(mandatIds.map(m => [m, { link: 'aus', formularProzent: null, ungepruefteUnterlagen: 0, pulsOffen: false } satisfies KundeKurz]));
}

/** Formular-Antworten eines Mandats (Playbook, Workbooks) — für die Analyse (C3) nur lesend. */
export async function formularAntwortenFuer(_mandatId: string): Promise<FormularStand[]> {
  return [];
}

/** Unterlagen eines Mandats — NUR „freigegeben“ (nie ungeprüfte; Abschnitt 5.4) — für die Analyse (C3). */
export async function unterlagenFuer(_mandatId: string): Promise<Unterlage[]> {
  return [];
}

/** Text einer freigegebenen Unterlage (für `fremd()` in der Analyse) — ohne Freigabe oder unbekannt: Fehler. */
export async function unterlageText(_mandatId: string, _unterlageId: string): Promise<{ ok: true; text: string; gekuerzt?: boolean } | { ok: false; fehler: string }> {
  return { ok: false, fehler: 'Unterlagen kommen mit Paket C2.' };
}

/** Zusatz zum 2-Wochen-Report (5.2) — ohne Fall null, dann bleibt der Report Byte für Byte wie heute. */
export async function reportZusatzFuer(_mandatId: string, _heute: string): Promise<ReportZusatz | null> {
  return null;
}

/** Morgenlauf: abgelaufene Links/Puls-Anfragen markieren, Puls ≤ Schwelle → Vorschlag „Gespräch anbieten“ (`k:…`) — nie eine Wirkung nach außen. */
export async function kundeMorgenlauf(_h: string, _heute: string): Promise<MorgenlaufTeil> {
  return { vorschlaege: 0, info: 'kommt mit Paket C2' };
}

/** Löschfristen (8.1): Antworten und Puls-Sätze 12 Monate, Unterlagen 90 Tage nach Mandatsende (außer Beleg) — Zähler je Name. */
export async function kundeFristen(_k: FristenKontext): Promise<Record<string, number>> {
  return {};
}

/** Art. 15: Antworten, Puls-Sätze und Unterlagen-Metadaten, die die Person nennen. */
export async function kundeAuskunft(_m: PersonMerkmale): Promise<KundeAuskunft[]> {
  return [];
}

/** Freigabe-Stapel, Präfix `k:` (Puls schlecht → Gespräch anbieten) — von lib/fulfillment/stapel.ts verteilt. */
export const KUNDE_STAPEL: StapelArtFreigabe = {
  freigeben: async () => ({ ok: false, status: 409, fehler: 'Dieser Vorschlag kommt mit Paket C2 (Kunde) — noch nicht freigebbar.' }),
};
