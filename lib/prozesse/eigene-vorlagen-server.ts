// ─── Prozesse — eigene Vorlagen: der Bestand (Server, 22.10.) ──────────────────────────────────────────────────────────────────────────────────────────
// Bestand `prozess-vorlagen--<haushalt>` (Haushalt des Inhabers, nur Business): Struktur und Texte eigener Prozesse als Vorlagen — ohne Personen und Fall-Daten
// (lib/prozesse/kopie.ts `ohnePersonen`); wer gespeichert hat: Speichername. Eigener Bestand (nicht im Werkstatt-Bestand), damit ein älterer Stand nichts
// davon verliert. Gelesen nur über `eigeneVorlagenLesen` (Säuberer, schreibt nie), geschrieben nur über `eigeneVorlagenAendern` (EINE Sperre, alles oder nichts,
// unverändert = kein Schreiben, Änderungsprotokoll ohne Werte).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { eigeneVorlagenAus, type EigeneVorlagenDatei } from './kopie';
import { prozesseOhnePerson } from './werkstatt-server';

/** Der Bestand der eigenen Vorlagen je Haushalt. */
export const eigeneVorlagenBestand = (h: string): string => `prozess-vorlagen--${h}`;

export async function eigeneVorlagenLesen(h: string): Promise<EigeneVorlagenDatei> {
  return eigeneVorlagenAus(await loadJson<unknown>(eigeneVorlagenBestand(h)));
}

type Mut<R> = (d: EigeneVorlagenDatei) => ({ ok: true; datei: EigeneVorlagenDatei } & R) | { ok: false; status: number; fehler: string };
/** Eine Änderung in EINER Sperre — geschrieben nur bei `ok` und wenn sich etwas geändert hat; protokolliert ohne Werte. */
export async function eigeneVorlagenAendern<R extends object>(h: string, mut: Mut<R>, wer: Wer): Promise<ReturnType<Mut<R>>> {
  const name = eigeneVorlagenBestand(h);
  let ergebnis = { ok: false, status: 400, fehler: 'Nichts gespeichert.' } as ReturnType<Mut<R>>;
  let vorher: unknown = null;
  let geschrieben = false;
  const nachher = await updateJson<unknown>(name, cur => {
    const d = eigeneVorlagenAus(cur);
    vorher = d;
    const r = mut(d);
    ergebnis = r;
    if (!r.ok || JSON.stringify(r.datei) === JSON.stringify(d)) return cur;
    geschrieben = true;
    return r.datei;
  });
  if (geschrieben) await protokolliereBestand(name, vorher, nachher, wer);
  return ergebnis;
}

/** Konto löschen: der Speichername (wer gespeichert hat) → „[gelöscht]“; die Vorlagen bleiben. */
export async function vorlagenKontoLoeschen(h: string, speicher: string): Promise<number> {
  const name = eigeneVorlagenBestand(h);
  if ((await loadJson<unknown>(name)) === null) return 0;
  let n = 0;
  await updateJson<unknown>(name, cur => {
    const r = prozesseOhnePerson(cur, speicher);
    // `angelegtVon` steht in den Personen-Feldern der Werkstatt; die Zettel einer Vorlage tragen keinen Verfasser.
    n = r.n;
    return r.wert;
  });
  if (n) await protokolliere(name, [{ op: 'geaendert', id: 'konto', felder: ['angelegtVon'] }], { art: 'system' });
  return n;
}
