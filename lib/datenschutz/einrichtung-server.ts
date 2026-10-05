// ─── Datenschutz-Einrichtung — Speicher (Server, 05.10.) ────────────────────
// Bestand `datenschutz-einrichtung` (verschlüsselt wie jeder Bestand, Register: lib/crm/speicher-register.ts).
// Schreiben NUR über `einrichtungAendern` (Sperre des Bestands) und NUR aus der Route mit Inhaber-Prüfung
// (app/api/datenschutz/einrichtung/route.ts). Die reinen Regeln liegen in ./einrichtung.ts.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { EINRICHTUNG_SPEICHER, empfaengerWirksam, verantwortlicherWirksam, type DatenschutzEinrichtung, type Empfaenger, type VerantwortlicherWirksam } from './einrichtung';

export async function ladeEinrichtung(): Promise<DatenschutzEinrichtung> {
  return (await loadJson<DatenschutzEinrichtung>(EINRICHTUNG_SPEICHER)) ?? {};
}

/** Den Bestand in seiner Sperre ändern (der Rückgabewert der Funktion wird geschrieben). */
export async function einrichtungAendern(mut: (e: DatenschutzEinrichtung) => DatenschutzEinrichtung): Promise<DatenschutzEinrichtung> {
  return updateJson<DatenschutzEinrichtung>(EINRICHTUNG_SPEICHER, cur => mut(cur ?? {}));
}

/** Der wirksame Verantwortliche (Einrichtung → Umgebung → keiner). Wirft nie — im Zweifel „fehlt“. */
export async function verantwortlicherLaden(): Promise<VerantwortlicherWirksam> {
  try { return verantwortlicherWirksam(await ladeEinrichtung()); }
  catch { return verantwortlicherWirksam(null); }
}

/** Die wirksame Empfänger-Liste (gespeichert oder Vorgabe). Wirft nie. */
export async function empfaengerLaden(): Promise<Empfaenger[]> {
  try { return empfaengerWirksam(await ladeEinrichtung()); }
  catch { return empfaengerWirksam(null); }
}
