// ─── Rolle „nur Business“ in der Markttraktion (13.10., Kevin: „Nur lesen + Entwürfe“) ────────────────────────────────────────────
// Ein Konto mit `finanzRecht: 'business'` (z. B. ein Vertriebspartner; EINE Konto-Sicht lib/zugang/konto-sicht.ts) darf in der
// Markttraktion Angebote und ihre Unterlagen LESEN und Angebots-ENTWÜRFE vorbereiten. Stellen (Nummer + PDF festschreiben), annehmen,
// ablehnen, neue Versionen, „gesendet“, Archiv gestellter Angebote, Gesellschaften verwalten und alles aus der Firmen-Akte (Unternehmen/
// Schild, Beschlüsse, Verträge, Steuern) bleiben Inhabern und vollen Mitgliedern. Nie Privates: Angebote, Mandate und Deals einer
// Privat-Einheit (`imBusiness`, lib/crm/treppe.ts — dieselbe Filterstelle wie Leistungstreppe und Planung).
// Die Regel steht NUR hier (rein, Server und Browser). Die Routen (/api/crm/angebot, /api/crm/dateien, /api/crm/gesellschaften,
// /api/gesellschaften?wahl=1) fragen sie nach dem Tor — die Sperre sitzt im SERVER; die Oberfläche blendet die Knöpfe nur zusätzlich aus.
// Den Haushalt bestimmt `businessHaushaltVon` (lib/zugang/konto-sicht-server.ts). Wächter: tests/partner-rolle.test.ts.

import type { Angebot } from './typen';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { istEntwurf } from './angebote';
import { imBusiness } from './treppe';

/** Antwort (403), wenn die Rolle „nur Business“ stellen, annehmen, ablehnen oder eine neue Version anlegen will. */
export const NUR_ENTWURF = 'Stellen, Annehmen und Ablehnen nur durch Inhaber oder volle Mitglieder — dein Entwurf ist gespeichert.';
/** Antwort (403) für Schreibwege, die die Rolle „nur Business“ hier nur lesen darf (Dateien ändern/löschen, Gesellschaften verwalten). */
export const NUR_LESEN = 'Dieses Konto liest hier nur — ändern, löschen und verwalten dürfen Inhaber und volle Mitglieder.';
/** Antwort (403), wenn etwas zu einer Privat-Einheit gehört (Angebot, Mandat, Deal) oder aus der Firmen-Akte kommt. */
export const NUR_BUSINESS_SICHT = 'Gehört nicht zum Business-Bereich — für dieses Konto nicht freigegeben.';

/** Aktionen am Angebot, die die Rolle „nur Business“ darf: Entwurf speichern, Entwurf in Archiv/Papierkorb und zurück, Entwurf aus dem Papierkorb löschen. */
export const ANGEBOT_ENTWURF_AKTIONEN: readonly string[] = ['speichern', 'ablage', 'loeschen'];

/** Sieht die Rolle „nur Business“ dieses Angebot? Nur Angebote einer Business-Gesellschaft. */
export const angebotFuerNurBusiness = (a: Pick<Angebot, 'gesellschaft'>): boolean => imBusiness(a);

/**
 * Darf die Rolle „nur Business“ diese Aktion am Angebot? `null` = ja, sonst der Satz für die 403.
 * `alt` = das gespeicherte Angebot (falls es eins gibt), `felder` = der Körper von „speichern“.
 */
export function angebotAktionNurBusiness(aktion: unknown, p: { alt?: Pick<Angebot, 'gesellschaft' | 'status'> | null; felder?: Record<string, unknown> | null } = {}): string | null {
  if (typeof aktion !== 'string' || !ANGEBOT_ENTWURF_AKTIONEN.includes(aktion)) return NUR_ENTWURF;
  if (p.alt && !angebotFuerNurBusiness(p.alt)) return NUR_BUSINESS_SICHT;
  if (aktion === 'speichern') {
    const g = p.felder?.gesellschaft;
    if (typeof g === 'string' && g && !imBusiness({ gesellschaft: g })) return NUR_BUSINESS_SICHT;
    return null;
  }
  // ablage/loeschen: nur Entwürfe — ein gestelltes Angebot ist eine Geschäftsunterlage der Inhaber.
  if (p.alt && !istEntwurf(p.alt)) return NUR_ENTWURF;
  return null;
}

/** Was die Dateiregel über das CRM wissen muss (Bezüge → Gesellschaft). */
export interface CrmBezugsStand {
  angebote?: readonly Pick<Angebot, 'id' | 'gesellschaft'>[];
  mandate: readonly { id: string; gesellschaft?: string | null }[];
  chancen: readonly { id: string; gesellschaft?: string | null }[];
}

/**
 * Sieht die Rolle „nur Business“ diesen Eintrag der CRM-Ablage? Nur Unterlagen an Business-Bezügen: JEDER vorhandene Bezug muss Business
 * sein (Angebot/Mandat/Deal einer Business-Gesellschaft; ein unbekannter Bezug zählt nicht). Nie die Firmen-Akte (Einträge einer eigenen
 * Gesellschaft: Register-Unterlagen, Vertrags-Dateien, Logos — das Logo eines Absenders liefert die Route eigens über `logoFuerNurBusiness`),
 * nie Rechnungen (Finanzen). Kontakte und Firmen sind Markttraktion (Business).
 */
export function dateiFuerNurBusiness(e: Pick<DateiEintrag, 'gesellschaft' | 'rechnungId' | 'rechnungsPdf' | 'angebotId' | 'mandatId' | 'dealId' | 'kontaktId' | 'firmaId' | 'projektId' | 'aufgabeId'>, crm: CrmBezugsStand): boolean {
  if (e.gesellschaft || e.rechnungId || e.rechnungsPdf || e.projektId || e.aufgabeId) return false;
  if (e.angebotId) { const a = crm.angebote?.find(x => x.id === e.angebotId); if (!a || !imBusiness(a)) return false; }
  if (e.mandatId) { const m = crm.mandate.find(x => x.id === e.mandatId); if (!m || !imBusiness(m)) return false; }
  if (e.dealId) { const c = crm.chancen.find(x => x.id === e.dealId); if (!c || !imBusiness(c)) return false; }
  return !!(e.angebotId || e.mandatId || e.dealId || e.kontaktId || e.firmaId);
}

/** Ist diese Datei das Logo eines Absenders im Business (für Angebots-Vorschau/-Ansicht)? Gesellschaften = die Absender des Haushalts. */
export function logoFuerNurBusiness(dateiId: string, gesellschaften: readonly { id: string; logoDateiId?: string }[]): boolean {
  return gesellschaften.some(g => g.logoDateiId === dateiId && imBusiness({ gesellschaft: g.id }));
}

/** Die Gesellschaften (Absender bzw. Auswahl), die die Rolle „nur Business“ sieht: nur Business-Gesellschaften (feste und `g-…`). */
export function gesellschaftenFuerNurBusiness<T extends { id: string }>(l: readonly T[]): T[] {
  return l.filter(g => imBusiness({ gesellschaft: g.id }));
}
