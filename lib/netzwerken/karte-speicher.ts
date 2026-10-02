// ─── Netzwerken · Meine Visitenkarten — Speicher je Person (02.10., Paket B) ────
// Bestand `visitenkarten--<person>` = { karten: Visitenkarte[] } über local-db (verschlüsselt wie jeder Bestand).
// JE PERSON ein eigener Bestand: Die Route liest die Person aus der Sitzung und kann nie an den Bestand einer anderen
// heran — „nur eigene Profile bearbeitbar“ ist damit keine Prüfung, sondern der Bestandsname. Nur Server.
// Personenbezug: eigene Daten der Person (Register: bezug „haushalt“, `visitenkarten--*`).

import { loadJson } from '@/lib/store/local-db';
import { mitStand } from '@/lib/store/fingerabdruck';
import { nachRang, type KarteMitStand, type Visitenkarte } from './karte';

export interface KartenDatei { karten: Visitenkarte[] }

const PERSON_OK = /^[a-z0-9-]{1,40}$/;

export function visitenkartenName(person: string): string {
  if (!PERSON_OK.test(person)) throw new Error(`Ungültige Person: ${person}`);
  return `visitenkarten--${person}`;
}

/** Die gespeicherten Profile (leer, wenn es den Bestand noch nicht gibt). Lesefehler werfen (local-db). */
export async function ladeKarten(person: string): Promise<Visitenkarte[]> {
  const d = await loadJson<KartenDatei>(visitenkartenName(person));
  return Array.isArray(d?.karten) ? d.karten : [];
}

/** So geht die Liste an den Browser: in Reihenfolge, mit Fingerabdruck je Profil. */
export const fuerBrowser = (karten: Visitenkarte[]): KarteMitStand[] => mitStand(nachRang(karten));
