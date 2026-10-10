// ─── Fulfillment — Bestände lesen und schreiben (Server, C0, 10.10.; FULFILLMENT_KONZEPT.md 8.1/8.4) ───────────────────────────────
// Fünf Bestände je Haushalt (Haushalt des Inhabers — dieselbe Grenze wie Markttraktion und Leistungstreppe), alle Bereich Business:
//   vorlagen  `fulfillment--<h>`            Vorlagen, Bibliothek, Rituale, Zuordnung, Agent-Zusätze, Einstellungen, Import-Läufe, Marken
//   faelle    `fulfillment-faelle--<h>`     je Mandat der Fall
//   kunde     `fulfillment-kunde--<h>`      Kunden-Links (nur Hash), Formular-Antworten, Puls, Unterlagen-Metadaten
//   dossiers  `fulfillment-dossiers--<h>`   je Mandat das Dossier (ohne Personenteil)
//   personen  `fulfillment-personen--<h>`   berufliche Personenkarten (eigene Löschfrist)
// Geschrieben wird JEDER Bestand nur über `fulfillmentAendern(art, mut, wer)`: EINE Sperre (`updateJson`), alles oder nichts, Grenzen (413),
// Änderungsprotokoll ohne Werte (`protokolliereBestand`), unverändert = kein Schreiben. Gelesen nur über `fulfillmentLesen` (Säuberer, nie
// schreibend — ein fehlender Bestand ist `leer…()`). Der Stand eines Eintrags (für 409) ist `eintragStand` (Fingerabdruck).
// Register: lib/crm/speicher-register.ts (fünf Einträge inkl. Datei-Ordner, `IN_BUSINESS`).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliere, protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { SAEUBERER, LEER } from './lesen';
import { grenzenPruefen } from './grenzen';
import { speichernameTilgen } from './regeln';
import type { AnwendenErgebnis, FulfillmentArt, FulfillmentDateien } from './typen';

/** Basisname je Art — der Haushalt hängt mit `--` an. */
export const FULFILLMENT_BESTAENDE: Readonly<Record<FulfillmentArt, string>> = {
  vorlagen: 'fulfillment',
  faelle: 'fulfillment-faelle',
  kunde: 'fulfillment-kunde',
  dossiers: 'fulfillment-dossiers',
  personen: 'fulfillment-personen',
};
export const FULFILLMENT_ARTEN = Object.keys(FULFILLMENT_BESTAENDE) as FulfillmentArt[];
/** Datei-Ordner der Unterlagen (verschlüsselt über lib/store/bild-ablage.ts, `BILD_ORDNER`). */
export const UNTERLAGEN_ORDNER = 'fulfillment-unterlagen' as const;

/** Bestandsname einer Art für einen Haushalt (ohne gültigen Haushalt: der Inhaber-Bestand — wie Treppe und Planung). */
export const fulfillmentSpeicherFuer = (art: FulfillmentArt, h: string | null | undefined): string =>
  `${FULFILLMENT_BESTAENDE[art]}--${h && HAUSHALT_OK.test(h) ? h : 'inhaber'}`;

/** Der Haushalt, in dem Fulfillment liegt (der des Inhabers). */
export async function fulfillmentHaushalt(): Promise<string> {
  const h = await haushaltDesInhabers();
  return h && HAUSHALT_OK.test(h) ? h : 'inhaber';
}

/** Einen Bestand lesen und säubern — schreibt nie. */
export async function fulfillmentLesen<A extends FulfillmentArt>(art: A, h?: string): Promise<FulfillmentDateien[A]> {
  const name = fulfillmentSpeicherFuer(art, h ?? await fulfillmentHaushalt());
  return SAEUBERER[art](await loadJson<unknown>(name)) as FulfillmentDateien[A];
}

/** Stand eines Eintrags (Fingerabdruck) — der Browser schickt ihn zurück; passt er nicht mehr, 409. Nie gespeichert. */
export const eintragStand = (x: object): string => fingerabdruck(x as Record<string, unknown>);

/**
 * Eine Änderung in EINER Sperre: `mut` bekommt die gesäuberte Datei und liefert ein Ergebnis (rein, z. B. `<bestand>Anwenden(datei, ops, kontext)`).
 * Nur bei `ok` wird geschrieben — nach der Grenzen-Prüfung (413, nie gekürzt) und nur, wenn sich etwas geändert hat; protokolliert ohne Werte.
 */
export async function fulfillmentAendern<A extends FulfillmentArt>(
  art: A,
  mut: (d: FulfillmentDateien[A]) => AnwendenErgebnis<FulfillmentDateien[A]>,
  wer?: Wer,
  h?: string,
): Promise<AnwendenErgebnis<FulfillmentDateien[A]>> {
  const name = fulfillmentSpeicherFuer(art, h ?? await fulfillmentHaushalt());
  let ergebnis: AnwendenErgebnis<FulfillmentDateien[A]> = { ok: false, status: 400, fehler: 'Nichts geändert.' };
  let vorher: unknown = null;
  let geschrieben = false;
  const nachher = await updateJson<unknown>(name, cur => {
    const d = SAEUBERER[art](cur) as FulfillmentDateien[A];
    vorher = d;
    const r = mut(d);
    if (r.ok) {
      const grenze = grenzenPruefen(art, r.datei);
      if (grenze) { ergebnis = { ok: false, status: 413, fehler: grenze }; return cur; }
      if (JSON.stringify(r.datei) === JSON.stringify(d)) { ergebnis = r; return cur; }
      geschrieben = true;
    }
    ergebnis = r;
    return r.ok ? r.datei : cur;
  });
  if (geschrieben) await protokolliereBestand(name, vorher, nachher, wer);
  return ergebnis;
}

/** Die leere Datei einer Art (für Antworten ohne Bestand). */
export const fulfillmentLeer = <A extends FulfillmentArt>(art: A): FulfillmentDateien[A] => LEER[art]() as FulfillmentDateien[A];

/**
 * Konto löschen (lib/datenschutz/konto-daten.ts): in allen Fulfillment-Beständen des Haushalts bleibt jeder Eintrag (Geschäftsunterlagen),
 * der Speichername der Person wird „[gelöscht]“ (`speichernameTilgen`). Nur vorhandene Bestände; liefert die Zahl der Ersetzungen.
 */
export async function fulfillmentKontoLoeschen(h: string, speicher: string): Promise<number> {
  let summe = 0;
  for (const art of FULFILLMENT_ARTEN) {
    const name = fulfillmentSpeicherFuer(art, h);
    if ((await loadJson<unknown>(name)) === null) continue;
    let n = 0;
    await updateJson<unknown>(name, cur => { const r = speichernameTilgen(cur, speicher); n = r.n; return r.wert; });
    if (n) await protokolliere(name, [{ op: 'geaendert', id: 'konto', felder: ['geaendertVon', 'von'] }], { art: 'system' });
    summe += n;
  }
  return summe;
}
