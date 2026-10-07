// ─── Kalender — der Zugang des Haushalts-Kalenders (iCloud), synchron lesbar (Server, 06.10.2026) ─
// Kevin 06.10.: iCloud je Person — jede Person hinterlegt Apple-ID + App-Passwort selbst (Kalender › Einstellungen).
// Der bestehende iCloud-Stand `kalender-icloud` bleibt der HAUSHALTS-Kalender (geteilte Sicht wie bisher: der Haushalt
// sieht ihn, privat der anderen Person nur „Belegt“). Er gehört der Haupt-Person (`ICLOUD_PERSON`, sonst der Inhaber).
//
// Übergang: Solange die Haupt-Person in der Oberfläche nichts hinterlegt hat, gilt die Server-Umgebung
// (ICLOUD_APPLE_ID / ICLOUD_APP_PASSWORT, deploy/icloud-verbinden.sh) als IHRE Verbindung — genau wie bisher.
// Hinterlegt sie Zugangsdaten in der Oberfläche, gewinnen diese; „Trennen“ in der Oberfläche schaltet auch die Umgebung
// ab (gemerkt über einen Fingerabdruck der Umgebungswerte — richtet jemand die Umgebung NEU ein, gilt sie wieder).
//
// Warum ein synchroner Zwischenspeicher? `verbunden()`/`zugang()` (lib/kalender/icloud.ts) werden an ~30 Stellen
// synchron gefragt. Der Zugang aus der Oberfläche liegt aber im (verschlüsselten) Bestand und ist nur asynchron lesbar.
// `hauptZugangLaden` (lib/kalender/icloud-person.ts) liest ihn beim Start (instrumentation.ts), vor jedem Kalender-Lesen
// der Routen, im Takt und nach jedem Verbinden/Trennen — und legt ihn hier ab (am `globalThis`, damit alle Bündel eines
// Prozesses dieselbe Ablage sehen). Ohne Ablage (oder nach Änderung der Umgebung/des Datenordners) gilt die Umgebung —
// also genau das Verhalten von vorher. Nie Werte ins Log.

import { createHash } from 'node:crypto';

export interface IcloudZugang { id: string; passwort: string }
export type HauptQuelle = 'oberflaeche' | 'umgebung' | 'getrennt' | 'keine';

interface HauptAblage {
  /** Fingerabdruck von Datenordner + Umgebung zum Zeitpunkt des Ladens — passt er nicht mehr, gilt die Umgebung. */
  schluessel: string;
  zugang: IcloudZugang | null;
  quelle: HauptQuelle;
  /** Die Haupt-Person (Speichername) — oder null, wenn es (noch) keinen Inhaber gibt. */
  person: string | null;
}

const G = globalThis as unknown as { __makeOsIcloudHaupt?: HauptAblage };

/** Der Zugang aus der Server-Umgebung (deploy/icloud-verbinden.sh) — oder null. */
export function umgebungsZugang(env: Record<string, string | undefined> = process.env): IcloudZugang | null {
  const id = env.ICLOUD_APPLE_ID?.trim();
  const passwort = env.ICLOUD_APP_PASSWORT?.trim();
  return id && passwort ? { id, passwort } : null;
}

/**
 * Fingerabdruck der Umgebungswerte (SHA-256, gekürzt) — zum Wiedererkennen nach „Trennen“, ohne die Werte zu speichern.
 * Leer, wenn keine Umgebung gesetzt ist.
 */
export function umgebungsFingerabdruck(env: Record<string, string | undefined> = process.env): string {
  const z = umgebungsZugang(env);
  return z ? createHash('sha256').update(`icloud-umgebung|${z.id.toLowerCase()}|${z.passwort}`).digest('hex').slice(0, 24) : '';
}

const ablageSchluessel = (): string => `${process.env.MAKE_OS_DATEN_DIR ?? ''}|${umgebungsFingerabdruck()}`;

/** Den geladenen Haupt-Zugang ablegen (nur lib/kalender/icloud-person.ts). */
export function hauptAblegen(a: Omit<HauptAblage, 'schluessel'>): void {
  G.__makeOsIcloudHaupt = { ...a, schluessel: ablageSchluessel() };
}

/** Die Ablage vergessen (Tests; danach gilt wieder die Umgebung, bis neu geladen wird). */
export function hauptVergessen(): void { delete G.__makeOsIcloudHaupt; }

const gueltig = (): HauptAblage | null => {
  const a = G.__makeOsIcloudHaupt;
  return a && a.schluessel === ablageSchluessel() ? a : null;
};

/** Der Zugang des Haushalts-Kalenders — synchron: geladene Ablage, sonst die Umgebung (Verhalten wie vor dem 06.10.). */
export function hauptZugangSync(): IcloudZugang | null {
  const a = gueltig();
  return a ? a.zugang : umgebungsZugang();
}

/** Woher der Zugang des Haushalts-Kalenders kommt (für Status/HOI) — ohne Ablage: Umgebung oder keine. */
export function hauptQuelleSync(): { quelle: HauptQuelle; person: string | null; geladen: boolean } {
  const a = gueltig();
  if (a) return { quelle: a.quelle, person: a.person, geladen: true };
  return { quelle: umgebungsZugang() ? 'umgebung' : 'keine', person: null, geladen: false };
}
