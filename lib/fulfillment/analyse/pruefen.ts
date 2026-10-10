// ─── Fulfillment · Analyse — die deterministische Prüfung des Dossiers (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.4/4.5) — rein ─────────────────
// F2 („Dossier geprüft“) geht NUR, wenn diese Prüfung bestanden ist. Sie prüft je Aussage, Personenkarte und Dossier:
//   · jede Aussage (außer Hypothesen und offenen Fragen) hat ≥ 1 Quelle mit URL oder Unterlage und Abrufdatum
//   · keine Quelle aus `GESPERRTE_DOMAINS`
//   · keine Treffer der Negativliste (Art.-9-Kategorien überall, Familie/Geburtsdatum im Personenteil), kein Name einer Personenkarte im
//     Unternehmensteil (Personen dort nur als Funktion bzw. Verweis `pp-…`)
//   · Personenkarte: Identität nicht „niedrig“, Art.-14-Uhr gesetzt und nicht überfällig, Löschtag gesetzt, sobald das Mandatsende feststeht
//   · Dossier: Interessenabwägung und F1 vorhanden (sobald es Personenkarten gibt bzw. A3/A4 im Umfang stehen)
// Befunde des Modell-Prüfers (A13) kommen dazu: Qualität darf mit Grund überstimmt werden, Datenschutz NIE. Rein und client-sicher.

import type { AbschnittId, Aussage, Dossier, PersonenKarte, Quelle } from '../typen';
import { istGesperrt } from './quellen';
import { negativTreffer, art14Stand } from './dsgvo';

export type Befund = NonNullable<Dossier['pruefung']>['befunde'][number];
/** Abschnitte, deren Einträge keine Quelle brauchen (Hypothesen sind als solche gekennzeichnet, offene Fragen sind Fragen). */
export const OHNE_QUELLE: readonly AbschnittId[] = ['hypothesen', 'fragen'];

const quelleGueltig = (q: Quelle | undefined): boolean => !!q && !!(q.url || q.unterlageId) && !!q.abgerufenAm && !(q.url && istGesperrt(q.url));

/** Ist die Aussage belegt (≥ 1 gültige Quelle)? */
export function belegt(a: Pick<Aussage, 'quellen'>, quellen: ReadonlyMap<string, Quelle>): boolean {
  return a.quellen.some(id => quelleGueltig(quellen.get(id)));
}

/** Ersetzt Namen aus Personenkarten durch ihre Funktion (Unternehmensteil nennt Personen nie beim Namen). */
export function namenErsetzen(text: string, karten: readonly Pick<PersonenKarte, 'name' | 'funktion'>[]): { text: string; ersetzt: number } {
  let t = text, ersetzt = 0;
  for (const k of karten) {
    const name = k.name.trim();
    if (name.length < 4) continue;
    const muster = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    t = t.replace(muster, () => { ersetzt++; return `[${k.funktion}]`; });
  }
  return { text: t, ersetzt };
}

/** Anteil belegter Aussagen (Kennzahl `ff_dossier_belegt`) — ohne Hypothesen/Fragen; ohne Aussagen null. */
export function belegQuote(d: Pick<Dossier, 'abschnitte' | 'quellen'>): number | null {
  const q = new Map(d.quellen.map(x => [x.id, x]));
  const alle = Object.values(d.abschnitte).filter(a => a && !OHNE_QUELLE.includes(a.id)).flatMap(a => a!.aussagen);
  return alle.length ? alle.filter(a => belegt(a, q)).length / alle.length : null;
}

/**
 * Die deterministische Prüfung (rein). `karten` = Personenkarten DIESES Mandats; `mandatsEnde` = Tag, wenn das Mandat ein Ende hat.
 * Ergebnis: Befunde `dsgvo`/`quelle` (blockieren F2) — Befunde des Modell-Prüfers verwaltet der Aufrufer (`pruefungZusammen`).
 */
export function pruefeDossier(d: Dossier, karten: readonly PersonenKarte[], heute: string, o: { mandatsEnde?: string | null } = {}): Befund[] {
  const raus: Befund[] = [];
  const quellen = new Map(d.quellen.map(q => [q.id, q]));
  for (const q of d.quellen) if (q.url && istGesperrt(q.url)) raus.push({ art: 'quelle', text: `Quelle von einer gesperrten Domain (${q.domain ?? 'gesperrt'}) — entfernen.`, bezug: q.id });
  for (const a of Object.values(d.abschnitte)) {
    if (!a) continue;
    for (const x of a.aussagen) {
      if (!OHNE_QUELLE.includes(a.id) && !belegt(x, quellen)) raus.push({ art: 'quelle', text: `Aussage ohne gültige Quelle und Datum im Abschnitt „${a.id}“.`, bezug: x.id });
      const n = negativTreffer(x.text, 'unternehmen', !!x.personRef);
      if (n) raus.push({ art: 'dsgvo', text: `Negativliste (${n}) im Abschnitt „${a.id}“ — Aussage entfernen.`, bezug: x.id });
      if (namenErsetzen(x.text, karten).ersetzt) raus.push({ art: 'dsgvo', text: `Name einer Person im Unternehmensteil (Abschnitt „${a.id}“) — nur die Funktion nennen.`, bezug: x.id });
    }
  }
  if (karten.length) {
    if (!d.interessenabwaegung) raus.push({ art: 'dsgvo', text: 'Interessenabwägung fehlt (Pflicht vor jeder Personenrecherche).' });
    if (!d.f1) raus.push({ art: 'dsgvo', text: 'F1 fehlt: Umfang und Personenfunktionen sind nicht festgehalten.' });
  }
  for (const k of karten) {
    const bezug = k.id;
    if (k.identitaet === 'niedrig') raus.push({ art: 'dsgvo', text: `Personenkarte „${k.funktion}“: Zuordnung unsicher — Karte verwerfen.`, bezug });
    if (d.f1 && !d.f1.funktionen.some(f => f.toLowerCase() === k.funktion.toLowerCase())) raus.push({ art: 'dsgvo', text: `Personenkarte „${k.funktion}“: Funktion steht nicht in F1.`, bezug });
    const st = art14Stand(k, heute);
    if (!k.art14.faelligAm) raus.push({ art: 'dsgvo', text: `Personenkarte „${k.funktion}“: Art.-14-Plan fehlt.`, bezug });
    else if (st.stufe === 'ueberfaellig') raus.push({ art: 'dsgvo', text: `Personenkarte „${k.funktion}“: Art.-14-Hinweis überfällig (fällig am ${st.faelligAm}).`, bezug });
    if (o.mandatsEnde && !k.loeschAm) raus.push({ art: 'dsgvo', text: `Personenkarte „${k.funktion}“: Löschtag fehlt.`, bezug });
    const teile = [...k.werdegang, ...k.themen, ...k.auftritte, ...k.aufhaenger];
    const kq = new Map(k.quellen.map(q => [q.id, q]));
    for (const x of teile) {
      const n = negativTreffer(x.text, 'person');
      if (n) raus.push({ art: 'dsgvo', text: `Personenkarte „${k.funktion}“: Negativliste (${n}) — Angabe entfernen.`, bezug: x.id });
      if (!belegt(x, kq)) raus.push({ art: 'quelle', text: `Personenkarte „${k.funktion}“: Angabe ohne Quelle.`, bezug: x.id });
    }
    for (const q of k.quellen) if (q.url && istGesperrt(q.url)) raus.push({ art: 'dsgvo', text: `Personenkarte „${k.funktion}“: Quelle von einer gesperrten Plattform.`, bezug: q.id });
  }
  return raus;
}

/**
 * Prüfbericht zusammensetzen (rein): die neue deterministische Prüfung + die Befunde des Modell-Prüfers (A13) aus dem letzten Bericht, deren Bezug
 * noch existiert (bzw. ohne Bezug). Überstimmungen der Qualitäts-Befunde bleiben, solange der Text gleich ist. Bestanden = kein Datenschutz-
 * oder Quellen-Befund und jeder Qualitäts-Befund überstimmt.
 */
export function pruefungZusammen(neu: readonly Befund[], alt: Dossier['pruefung'], modell: readonly Befund[], gibt: (bezug: string) => boolean, am: string): NonNullable<Dossier['pruefung']> {
  const ueberstimmt = new Map((alt?.befunde ?? []).filter(b => b.ueberstimmt && b.art === 'qualitaet').map(b => [`${b.text}|${b.bezug ?? ''}`, b.ueberstimmt!]));
  const vomModell = modell.filter(b => !b.bezug || gibt(b.bezug)).map(b => {
    const u = b.art === 'qualitaet' ? ueberstimmt.get(`${b.text}|${b.bezug ?? ''}`) : undefined;
    return { art: b.art, text: b.text, ...(b.bezug ? { bezug: b.bezug } : {}), ...(u ? { ueberstimmt: u } : {}) };
  });
  const befunde = [...neu, ...vomModell];
  return { am, bestanden: pruefungBestanden(befunde), befunde };
}

export const pruefungBestanden = (befunde: readonly Befund[]): boolean => befunde.every(b => b.art === 'qualitaet' && !!b.ueberstimmt);
