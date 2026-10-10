// ─── Fulfillment · Prozesse — Schnittstellen für die anderen Pakete (Server; STUB aus C0, gehört ab jetzt Paket C1) ──────────────────────
// FULFILLMENT_KONZEPT.md Abschnitt 11 (C1): Die Signaturen sind fest — C2/C3 und die Hub-Dateien von C0 (morgenlauf.ts, fristen-server.ts,
// auskunft.ts, stapel.ts) rufen genau diese Namen. C1 füllt die Rümpfe; neue Exporte darf C1 dazunehmen, bestehende nicht umbenennen.
// Bis dahin liefern sie „nichts“ (kein Fall, keine Vorschläge, nichts gelöscht) bzw. lehnen die Freigabe ab.

import type { PersonMerkmale } from '@/lib/crm/person-weitere';
import type { StapelArtFreigabe } from '@/lib/zoe/stapel-arten';
import type { Fall, FallKurz, FristenKontext, MorgenlaufTeil, StakeholderAuskunft } from '../typen';

/** Der Fall eines Mandats (gesäubert) — null, wenn es keinen gibt. Nur lesend (C2 Kunden-Sicht/Report, C3 Mandatskontext). */
export async function fallLesen(_mandatId: string): Promise<Fall | null> {
  return null;
}

/** Kurzform je Fall für Cockpit, Produkte & Mandate, Kunden-Sicht (Schlüssel = Mandat-Kennung). Ohne Angabe: alle Fälle. */
export async function faelleKurz(_mandatIds?: readonly string[]): Promise<Record<string, FallKurz>> {
  return {};
}

/** Morgenlauf (3.1, 5.3): Onboarding-Vorschläge (`p:onboarding:<mandat>`) und Nachsorge (+14/+45/+90) in den Stapel — nie eine Wirkung nach außen. */
export async function prozesseMorgenlauf(_h: string, _heute: string): Promise<MorgenlaufTeil> {
  return { vorschlaege: 0, info: 'kommt mit Paket C1' };
}

/** Löschfristen (8.1): Stakeholder-Haltung/-Notiz 12 Monate nach Mandatsende, verwaiste Fälle — liefert Zähler je Name (nur Zahlen). */
export async function prozesseFristen(_k: FristenKontext): Promise<Record<string, number>> {
  return {};
}

/** Art. 15: Stakeholder-Einträge, die die Person (Kontakt-Kennung) betreffen. */
export async function stakeholderAuskunft(_m: PersonMerkmale): Promise<StakeholderAuskunft[]> {
  return [];
}

/** Freigabe-Stapel, Präfix `p:` (Onboarding starten, Nachsorge) — von lib/fulfillment/stapel.ts verteilt. */
export const PROZESSE_STAPEL: StapelArtFreigabe = {
  freigeben: async () => ({ ok: false, status: 409, fehler: 'Dieser Vorschlag kommt mit Paket C1 (Prozesse) — noch nicht freigebbar.' }),
};
