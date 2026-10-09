// ─── ZOEs Werkzeuge und die KI-Schalter (05.10., DSGVO-Paket „KI, Gesundheit, Telegram“) ──────────────────────────────
// Was ein Werkzeug liest, geht als Ergebnis an das Modell. Deshalb gilt für die Werkzeug-Schicht dieselbe Regel wie
// für das KI-Tor: ein für ZOE ausgeschalteter Bereich (System › Datenschutz) wird weder angeboten (kimmi filtert die
// Werkzeug-Liste) noch ausgeführt (`fuehreAus` prüft hier — die EINE Stelle zur Wirkung). Gesundheits-Werkzeuge
// (lesen UND erfassen über ZOE) brauchen die Einwilligung (b) „An die KI geben“ — und zum Erfassen zusätzlich (a).

import type { KiKategorie, KiSchalter } from './ki-einstellungen';
import { istBereich, KI_BEREICH_LABEL } from './ki-einstellungen';

/** Werkzeug-Gruppe (lib/zoe/register.ts) → Datenkategorie. Gruppen ohne Eintrag lesen keine Bereichsdaten. */
export const GRUPPE_KATEGORIE: Record<string, KiKategorie> = {
  kontakte: 'crm', markttraktion: 'crm', crm: 'crm', kunden: 'crm',
  kalender: 'kalender', planer: 'kalender',
  aufgaben: 'aufgaben', 'aufgaben-dateien': 'aufgaben', meilensteine: 'aufgaben', fokus: 'aufgaben',
  // Haushaltsfinanzen (09.10., Funde Abdeckung klein): `finanzen-privat` — zählt am Schalter „Finanzen“ (`werkzeugSperre`) und geht im KI-Tor nur mit
  // privatem Finanzzugang an das Modell (lib/datenschutz/ki-tor.ts); der Head „Finanzen privat“ trägt die Kategorie.
  finanzen: 'finanzen', haushalt: 'finanzen-privat', business: 'finanzen',
  wissen: 'brain',
  gesundheit: 'gesundheit',
  inbox: 'postfach',
};

/**
 * Ausnahmen je Werkzeug: die Einkaufsliste steht in der Gruppe „gesundheit“, ist aber keine Gesundheitsangabe.
 * `an_head`/`head_fragen` (Gruppe „agenten“, Paket 4a): keine feste Kategorie — der Head läuft mit SEINEN aktiven Kategorien durch das
 * KI-Tor (Schalter, Einwilligung), und was `head_fragen` zurückbringt, trägt ZOE mit genau diesen Kategorien weiter
 * (lib/agenten/zoe-heads.ts `headFrageKategorien`). Ein ausgeschalteter Bereich bleibt damit auch über einen Head zu.
 * Paket 4c: die Medien-Werkzeuge des Agenten-Bereichs (lib/agenten/medien-werkzeuge.ts, nicht im ZOE-Register) — `bild_bearbeiten` schickt die
 * PIXEL eines Fotos hinaus (Kategorie `medien`, Schalter „Bilder an die KI“); suchen, erzeugen (aus Text) und Vorschläge lesen keine Bildinhalte.
 */
export const WERKZEUG_KATEGORIE: Record<string, KiKategorie | null> = {
  einkauf_setzen: null, an_head: null, head_fragen: null,
  // Routinen abhaken (09.10., Funde klein): neutral statt „Gesundheit“ — eine Business-Routine braucht keine Gesundheits-Einwilligung. Das
  // Werkzeug prüft je Routine selbst (lib/zoe/werkzeuge.ts `hakeRoutine`): Einwilligung (a) zum Schreiben (`health-log` ist Art. 9, wie in der
  // Oberfläche), Business-Routinen nur mit eingeschaltetem Bereich „Aufgaben & Ziele“, Privat-Routinen nur mit (b) „an die KI“ (ihre Namen
  // gehen an das Modell). Neutral, damit der Gesundheits-Head (Kategorie Gesundheit) das Werkzeug behält; kimmi nennt die Kategorien im Protokoll.
  hake_routine: null,
  medien_suchen: null, medien_vorschlagen: null, bild_erzeugen: null, video_starten: null, bild_bearbeiten: 'medien',
};

export const kategorieVonGruppe = (gruppe: string): KiKategorie | null => GRUPPE_KATEGORIE[gruppe] ?? null;
/** Kategorie eines Werkzeugs (Ausnahme vor Gruppe). */
export const kategorieVonWerkzeug = (name: string, gruppe: string): KiKategorie | null =>
  (name in WERKZEUG_KATEGORIE ? WERKZEUG_KATEGORIE[name] : kategorieVonGruppe(gruppe));

export const SPERRE_BEREICH = (k: KiKategorie) => `Nicht ausgeführt: Der Bereich „${istBereich(k) ? KI_BEREICH_LABEL[k] : k}“ ist für ZOE ausgeschaltet (System › Datenschutz).`;
export const SPERRE_GESUNDHEIT = 'Nicht ausgeführt: Gesundheitsdaten gehen nur mit der Einwilligung „An die KI geben“ an ZOE (System › Datenschutz › Gesundheit). Sag das der Person ruhig und ohne Druck.';
export const SPERRE_MEDIEN = 'Nicht ausgeführt: Fotos gehen nur an die KI, wenn die Person „Bilder an die KI“ einschaltet (System › Datenschutz › KI). Sag das ruhig und ohne Druck.';

/** Warum ein Werkzeug dieser Gruppe gerade nicht laufen darf — oder null (rein). */
export function werkzeugSperre(k: KiKategorie | null, s: KiSchalter, gesundheitKi: boolean): string | null {
  if (!k) return null;
  if (k === 'gesundheit') return gesundheitKi ? null : SPERRE_GESUNDHEIT;
  if (k === 'medien') return s.bilder === true ? null : SPERRE_MEDIEN;
  // Private Finanzen zählen zusätzlich am Schalter „Finanzen“ (lib/datenschutz/ki-einstellungen.ts, Paket 6a).
  if (k === 'finanzen-privat') return s.bereiche.finanzen ? null : SPERRE_BEREICH('finanzen');
  if (istBereich(k) && !s.bereiche[k]) return SPERRE_BEREICH(k);
  return null;
}

/** Server: Sperre für eine Person (Schalter + Einwilligung). Ohne Person (Systemlauf) gelten die Instanz-Schalter; Gesundheit nie. */
export async function werkzeugSperreFuer(k: KiKategorie | null, person: string | null | undefined): Promise<string | null> {
  if (!k) return null;
  const { kiSchalterFuer } = await import('./ki-einstellungen');
  const s = await kiSchalterFuer(person ?? null);
  let gesundheitKi = false;
  if (k === 'gesundheit' && person) {
    const { gesundheitStandFuer } = await import('./gesundheit-einwilligung');
    const st = await gesundheitStandFuer(person);
    // Über ZOE erfassen = verarbeiten (a) UND an die KI geben (b).
    gesundheitKi = st.ki.an && st.verarbeitungErlaubt;
  }
  return werkzeugSperre(k, s, gesundheitKi);
}
