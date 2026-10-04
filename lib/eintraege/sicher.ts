// ─── MAKE OS — „Sicher statt endgültig“: Papierkorb mit Frist für jede Liste (rein, 04.10.) ─────────────
// Kevin 04.10.: „Für die Usability können wir auch immer Tasks, Produkte etc. einfach löschen … dann kommt da Löschen
// oder Archivieren.“ EINE Regel für alle Listen, die den Baustein `ZeileAktionen` (components/os/ui) nutzen:
//   · Archivieren = ausblenden, jederzeit zurückholbar (je Bestand: Aufgaben `archiviertAm`, Produkte Status „eingestellt“).
//   · Löschen = in den Papierkorb (`geloeschtAm`), 30 Tage wiederherstellbar, dazu einige Sekunden „Rückgängig“.
//   · Endgültig erst nach Ablauf (Morgenlauf) oder als eigener Schritt aus dem Papierkorb — nie mit dem ersten Klick.
// Der Aufgaben-Papierkorb (lib/aufgaben/papierkorb.ts, mit Ketten für Projekte/Unteraufgaben) nimmt Frist und Marke von hier.
// Tests: tests/zeile-aktionen.test.ts.

/** So lange liegt ein gelöschter Eintrag im Papierkorb, bevor der Morgenlauf ihn endgültig entfernt. */
export const PAPIERKORB_TAGE = 30;
const TAG_MS = 86_400_000;
/** ISO-Zeitpunkt (wie ihn `toISOString` schreibt) — die einzige Form, die eine Papierkorb-Marke haben darf. */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export interface Loeschbar { geloeschtAm?: string }

export const imPapierkorb = (x: Loeschbar | undefined | null): boolean => !!x?.geloeschtAm;

/** Eine gültige Marke von außen (Browser, Altbestand) — sonst `undefined` (fällt beim Säubern weg). */
export function papierkorbMarke(v: unknown): string | undefined {
  return typeof v === 'string' && ISO.test(v) && Number.isFinite(Date.parse(v)) ? v : undefined;
}

/** In den Papierkorb (Marke = jetzt). Liegt er schon drin, bleibt die alte Marke — die Frist läuft nie neu an. */
export function inPapierkorb<T extends Loeschbar>(x: T, jetzt: string): T {
  return x.geloeschtAm ? x : { ...x, geloeschtAm: jetzt };
}

/** Aus dem Papierkorb holen (Marke weg, sonst unverändert). */
export function ausPapierkorb<T extends Loeschbar>(x: T): T {
  if (!x.geloeschtAm) return x;
  const n = { ...x };
  delete n.geloeschtAm;
  return n;
}

/** Ab welchem Tag (JJJJ-MM-TT) der Eintrag endgültig gehen darf. */
export function papierkorbBis(geloeschtAm: string, tage = PAPIERKORB_TAGE): string {
  return new Date(Date.parse(geloeschtAm) + tage * TAG_MS).toISOString().slice(0, 10);
}

/** Liegt länger als die Frist im Papierkorb? */
export function papierkorbAbgelaufen(x: Loeschbar, jetzt: string, tage = PAPIERKORB_TAGE): boolean {
  return !!x.geloeschtAm && Date.parse(x.geloeschtAm) < Date.parse(jetzt) - tage * TAG_MS;
}

/** Die Liste so, wie alle Leser sie sehen: ohne Papierkorb. */
export function ohnePapierkorb<T extends Loeschbar>(liste: readonly T[]): T[] {
  return liste.filter(x => !x.geloeschtAm);
}

/**
 * Der Server setzt die Marke (04.10.): eine neue Marke bekommt die Server-Zeit, eine bestehende bleibt, wie sie war —
 * der Browser kann die Frist so weder verkürzen noch verlängern. Fehlt die Marke im neuen Stand, ist der Eintrag zurück.
 */
export function markeVomServer<T extends Loeschbar>(alt: Loeschbar | undefined, neu: T, jetzt: string): T {
  if (!neu.geloeschtAm) return neu;
  const am = alt?.geloeschtAm ?? jetzt;
  return neu.geloeschtAm === am ? neu : { ...neu, geloeschtAm: am };
}
