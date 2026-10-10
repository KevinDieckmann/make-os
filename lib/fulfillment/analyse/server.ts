// ─── Fulfillment · Analyse — Schnittstellen für die anderen Pakete (Server; STUB aus C0, gehört ab jetzt Paket C3) ───────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 11 (C3): Die Signaturen sind fest — C1 (Cockpit) und die Hub-Dateien von C0 (morgenlauf.ts, fristen-server.ts,
// auskunft.ts, stapel.ts) rufen genau diese Namen. C3 füllt die Rümpfe; neue Exporte darf C3 dazunehmen, bestehende nicht umbenennen.
// Der Morgenlauf startet NIE einen Analyse-Lauf (jeder Lauf nur nach Klick auf genau diesen Lauf) — er legt höchstens Hinweise in den Stapel.

import type { PersonMerkmale } from '@/lib/crm/person-weitere';
import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { DossierKurz, FristenKontext, MorgenlaufTeil, PersonenAuskunft } from '../typen';

/** Kurzform je Mandat für das Cockpit (Dossier da, F1/F2, Läufe, Kosten, Art.-14-Fristen bald) — Schlüssel = Mandat-Kennung. */
export async function dossierKurzFuer(mandatIds: readonly string[]): Promise<Record<string, DossierKurz>> {
  return Object.fromEntries(mandatIds.map(m => [m, { vorhanden: false, f1: false, f2: false, laeufe: {}, kostenCent: 0, art14Bald: 0 } satisfies DossierKurz]));
}

/** Morgenlauf: Art.-14-Uhr der Personenkarten, verwaiste Läufe (Pacht abgelaufen → abgebrochen), Hinweise (`a:…`) — startet nie einen Lauf. */
export async function analyseMorgenlauf(_h: string, _heute: string): Promise<MorgenlaufTeil> {
  return { vorschlaege: 0, info: 'kommt mit Paket C3' };
}

/** Löschfristen (8.1): Personenkarten 90 Tage nach Mandatsende (einstellbar), Lauf-Entwürfe 90 Tage — Zähler je Name, Vermerk nur als Anzahl. */
export async function personenFristen(_k: FristenKontext): Promise<Record<string, number>> {
  return {};
}

/** Art. 15: berufliche Personenkarten, die die Person nennen (Name oder Kontakt-Kennung). */
export async function personenAuskunft(_m: PersonMerkmale): Promise<PersonenAuskunft[]> {
  return [];
}

/** Freigabe-Stapel, Präfix `a:` (Art.-14-Hinweis, Analyse-Hinweise) — von lib/fulfillment/stapel.ts verteilt. */
export const ANALYSE_STAPEL: StapelArtFreigabe = {
  freigeben: async () => ({ ok: false, status: 409, fehler: 'Dieser Vorschlag kommt mit Paket C3 (Analyse) — noch nicht freigebbar.' }),
};
