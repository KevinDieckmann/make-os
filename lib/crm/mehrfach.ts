// ─── Markttraktion · Typ, Kategorie und Labels mehrfach (rein, getestet, 28.09.) ─
// Kevins Entscheidung 28.09.: Typ und Kategorie einer Person sind Mehrfachauswahl
// (eigene Werte per „+ neu“ in der Werteliste), dazu frei vergebbare Labels.
// Lifecycle, BEAN und Kreis bleiben Einzelwahl.
//
//   Kontakt.typen / Kontakt.kategorien / Kontakt.labels   string[]
//
// Rückwärtskompatibel wie bei den E-Mail-Adressen: `typ`/`kategorie` bleiben als ERSTER
// Wert (abgeleitet, synchron) — jeder bestehende Leser liest weiter `typ`/`kategorie`.
// Altbestand ohne Liste gilt als ein Wert (`typenVon`/`kategorienVon`); geschrieben wird
// die Liste erst, wenn sie mehr trägt als das alte Feld (`mehrfachSynchron`).
// Fragen „ist die Person Netzwerk?“ nur über `hatTyp`/`hatKategorie` (enthält), nie `k.typ ===`.
// Diese Datei lädt zur Laufzeit nichts aus lib/make-one/crm.ts.

import type { Kontakt } from '@/lib/make-one/crm';

/** Obergrenze je Person und Liste — darüber wird abgelehnt (413), nie gekürzt. */
export const MEHRFACH_MAX = 100;

const wert = (v: unknown, n: number) => { const t = String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, n); return t || undefined; };
const schluessel = (t: string) => t.normalize('NFC').toLocaleLowerCase('de-DE').trim();
const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Eine Liste freier Werte prüfen: Texte, getrimmt, ohne Doppelte (Groß-/Kleinschreibung egal, der erste gewinnt).
 * Kein Array → `undefined`; ein leeres Array bleibt leer (ausdrücklich „keiner“).
 */
export function werteSaeubern(v: unknown, laenge = 80): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const gesehen = new Set<string>();
  const raus: string[] = [];
  for (const x of v) {
    const t = wert(x, laenge);
    if (!t || gesehen.has(schluessel(t))) continue;
    gesehen.add(schluessel(t));
    raus.push(t);
  }
  return raus;
}

type MitTyp = Pick<Kontakt, 'typ' | 'typen'>;
type MitKategorie = Pick<Kontakt, 'kategorie' | 'kategorien'>;

/** Liste eines Feldpaars (einzeln + mehrfach): gespeichert, sonst aus dem Einzelwert; ein abweichender Einzelwert steht vorn. */
function listeVon(einzel: string | undefined, liste: string[] | undefined): string[] {
  const e = wert(einzel, 80);
  if (!Array.isArray(liste)) return e ? [e] : [];
  if (e && !liste.some(x => schluessel(x) === schluessel(e))) return [e, ...liste];
  if (e && liste.length && schluessel(liste[0]) !== schluessel(e)) return [e, ...liste.filter(x => schluessel(x) !== schluessel(e))];
  return liste;
}

export const typenVon = (k: MitTyp): string[] => listeVon(k.typ, k.typen);
export const kategorienVon = (k: MitKategorie): string[] => listeVon(k.kategorie, k.kategorien);
export const labelsVon = (k: Pick<Kontakt, 'labels'>): string[] => (Array.isArray(k.labels) ? k.labels : []);

/** Enthält die Person diesen Typ (Groß-/Kleinschreibung egal)? Ersetzt `k.typ === '…'`. */
export const hatTyp = (k: MitTyp, t: string) => typenVon(k).some(x => schluessel(x) === schluessel(t));
/** Beginnt eine Kategorie der Person mit … (z. B. „Apple“)? */
export const kategorieBeginnt = (k: MitKategorie, anfang: string) => kategorienVon(k).some(x => x.startsWith(anfang));
export const hatKategorie = (k: MitKategorie, t: string) => kategorienVon(k).some(x => schluessel(x) === schluessel(t));
/** Enthält eine der Listen einen der gesuchten Werte (Segment-Kriterium „enthält einen von“)? */
export const enthaeltEinenVon = (werte: readonly string[], gesucht: readonly string[]) => { const s = new Set(werte.map(schluessel)); return gesucht.some(g => s.has(schluessel(g))); };

/**
 * Ein Feldpaar synchron halten: `neuListe` weicht von der gespeicherten ab → die Liste ist die Wahrheit,
 * der Einzelwert = erster Eintrag. Sonst hat ein alter Schreiber (Import, Einzelwahl) den Einzelwert
 * geändert → er ersetzt den ersten Eintrag (so wie früher das Feld ersetzt wurde); geleert → der erste
 * fällt weg. Eine Liste mit genau dem Einzelwert wird nur geschrieben, wenn schon eine gespeichert war.
 */
function paarSynchron(neuEinzel: string | undefined, neuListe: string[] | undefined, altEinzel: string | undefined, altListe: string[] | undefined): { einzel?: string; liste?: string[] } {
  const explizit = neuListe !== undefined && !gleich(neuListe, altListe);
  const einzelGeaendert = (wert(neuEinzel, 80) ?? '') !== (wert(altEinzel, 80) ?? '');
  if (!explizit && !einzelGeaendert) return { einzel: neuEinzel, liste: neuListe ?? altListe };
  let liste: string[];
  if (explizit) liste = neuListe ?? [];
  else {
    const basis = listeVon(altEinzel, altListe);
    const e = wert(neuEinzel, 80);
    const rest = basis.slice(1).filter(x => !e || schluessel(x) !== schluessel(e));
    liste = e ? [e, ...rest] : rest;
  }
  const einzel = liste[0];
  const schreiben = explizit || altListe !== undefined || liste.length > 1;
  return { ...(einzel ? { einzel } : {}), ...(schreiben ? { liste } : {}) };
}

/** Typen, Kategorien (mit `typ`/`kategorie`) und Labels synchron halten — jeder Schreibweg der Kartei. */
export function mehrfachSynchron<K extends Kontakt>(neu: K, alt: Kontakt | undefined): K {
  const out = { ...neu } as unknown as Record<string, unknown>;
  const t = paarSynchron(neu.typ, neu.typen, alt?.typ, alt?.typen);
  if (t.einzel) out.typ = t.einzel; else delete out.typ;
  if (t.liste) out.typen = t.liste; else delete out.typen;
  const k = paarSynchron(neu.kategorie, neu.kategorien, alt?.kategorie, alt?.kategorien);
  if (k.einzel) out.kategorie = k.einzel; else delete out.kategorie;
  if (k.liste) out.kategorien = k.liste; else delete out.kategorien;
  // Labels haben kein Altfeld: fehlt die Liste (älteres Fenster), bleibt die gespeicherte.
  if (neu.labels === undefined && alt?.labels) out.labels = alt.labels;
  return out as unknown as K;
}

/** Zwei Einträge derselben Person (Dubletten): Vereinigung ohne Doppelte, `a` zuerst (sein erster Wert bleibt der erste). */
export function mehrfachVereinen(a: Kontakt, b: Kontakt): Pick<Kontakt, 'typ' | 'typen' | 'kategorie' | 'kategorien' | 'labels'> {
  const ver = (x: string[], y: string[]) => werteSaeubern([...x, ...y]) ?? [];
  const typen = ver(typenVon(a), typenVon(b)), kategorien = ver(kategorienVon(a), kategorienVon(b)), labels = ver(labelsVon(a), labelsVon(b));
  return {
    ...(typen[0] ? { typ: typen[0] } : {}), ...(typen.length > 1 || a.typen || b.typen ? { typen } : {}),
    ...(kategorien[0] ? { kategorie: kategorien[0] } : {}), ...(kategorien.length > 1 || a.kategorien || b.kategorien ? { kategorien } : {}),
    ...(labels.length || a.labels || b.labels ? { labels } : {}),
  };
}

/** Die Felder für `kontaktTeil` zu neuen Typen/Kategorien: die Liste plus der erste Wert (wie der Server rechnet). */
export function typenFelder(typen: string[]): Pick<Kontakt, 'typen' | 'typ'> {
  const l = werteSaeubern(typen, 40) ?? [];
  return { typen: l, typ: l[0] };
}
export function kategorienFelder(kategorien: string[]): Pick<Kontakt, 'kategorien' | 'kategorie'> {
  const l = werteSaeubern(kategorien, 80) ?? [];
  return { kategorien: l, kategorie: l[0] };
}
