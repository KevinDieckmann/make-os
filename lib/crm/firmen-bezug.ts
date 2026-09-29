// ─── CRM — Firma per Kennung statt per Name (rein, getestet, 27.09.) ────────
// Chancen und Mandate zeigten bis 26.09. nur über den Firmennamen auf eine
// Firma (`c.firma === f.name`). Wurde eine Firma umbenannt oder gab es zwei
// Schreibweisen, riss die Verbindung. Jetzt trägt jeder Deal und jedes Mandat
// eine `firmaId`; der Name bleibt Anzeige. Alte Einträge bekommen die Kennung
// beim Laden nachgetragen (eindeutiger Namenstreffer, sonst bleibt es leer).

import type { Chance, CrmBestand, Firma, Mandat } from './typen';

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Firma zu einem Namen — nur bei genau einem Treffer (Groß-/Kleinschreibung egal). */
export function firmaNachName(firmen: Firma[], name: string | undefined): Firma | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const treffer = firmen.filter(f => norm(f.name) === n);
  return treffer.length === 1 ? treffer[0] : undefined;
}

/** Die Firma eines Deals: per Kennung, sonst per eindeutigem Namen. */
export function firmaVonDeal(c: Pick<Chance, 'firmaId' | 'firma'>, firmen: Firma[]): Firma | undefined {
  return (c.firmaId ? firmen.find(f => f.id === c.firmaId) : undefined) ?? firmaNachName(firmen, c.firma);
}

/** Die Firma eines Mandats: per Kennung, sonst per eindeutigem Kundennamen. */
export function firmaVonMandat(m: Pick<Mandat, 'firmaId' | 'kunde'>, firmen: Firma[]): Firma | undefined {
  return (m.firmaId ? firmen.find(f => f.id === m.firmaId) : undefined) ?? firmaNachName(firmen, m.kunde);
}

/** Gehört der Deal zu dieser Firma? Kennung zuerst, der Name nur als Rückfall für alte Einträge. */
export function dealZuFirma(c: Pick<Chance, 'firmaId' | 'firma'>, f: Pick<Firma, 'id' | 'name'>): boolean {
  if (c.firmaId) return c.firmaId === f.id;
  return norm(c.firma) === norm(f.name) && !!norm(f.name);
}
export function mandatZuFirma(m: Pick<Mandat, 'firmaId' | 'kunde'>, f: Pick<Firma, 'id' | 'name'>): boolean {
  if (m.firmaId) return m.firmaId === f.id;
  return norm(m.kunde) === norm(f.name) && !!norm(f.name);
}

/**
 * Alte Einträge nachziehen: wo die Kennung fehlt, aber der Name eindeutig zu
 * einer Firma passt, wird sie eingetragen. Gibt denselben Bestand zurück, wenn
 * nichts zu tun war (kein unnötiges Schreiben).
 */
export function firmaIdsErgaenzen<B extends Pick<CrmBestand, 'firmen' | 'chancen' | 'mandate'>>(b: B): { bestand: B; ergaenzt: number } {
  let ergaenzt = 0;
  const chancen = b.chancen.map(c => {
    if (c.firmaId || !c.firma) return c;
    const f = firmaNachName(b.firmen, c.firma);
    if (!f) return c;
    ergaenzt++;
    return { ...c, firmaId: f.id };
  });
  const mandate = b.mandate.map(m => {
    if (m.firmaId) return m;
    const f = firmaNachName(b.firmen, m.kunde);
    if (!f) return m;
    ergaenzt++;
    return { ...m, firmaId: f.id };
  });
  return ergaenzt ? { bestand: { ...b, chancen, mandate }, ergaenzt } : { bestand: b, ergaenzt: 0 };
}

/** Anzeigename der Firma eines Deals — die Kennung gewinnt (nach Umbenennung stimmt der Name wieder). */
export function firmenName(c: Pick<Chance, 'firmaId' | 'firma'>, firmen: Firma[]): string | undefined {
  return firmaVonDeal(c, firmen)?.name ?? c.firma;
}

/**
 * Firmen-Kennungen nach einer Änderung nachziehen (29.09., Sichtprüfung F1) — IN der Sperre, vor dem Schreiben:
 *  · Anzeigename (Mandat `kunde`, Deal `firma`) geändert, Kennung aber nicht mitgeändert → die Kennung passt nur noch,
 *    wenn ihre Firma genau so heißt; sonst neu auflösen (eindeutiger Treffer) bzw. entfernen, wenn es keinen gibt.
 *    Eine ausdrücklich mitgeschickte neue Kennung gewinnt immer.
 *  · danach fehlende Kennungen ergänzen (`firmaIdsErgaenzen`) — dieselbe Regel wie `ladeCrm`. So ist der
 *    gespeicherte Stand gleich dem gelesenen; sonst wich der Fingerabdruck ab und die nächste Änderung bekam 409.
 * Gibt denselben Bestand zurück, wenn nichts zu tun war.
 */
export function firmaIdsNachziehen<B extends Pick<CrmBestand, 'firmen' | 'chancen' | 'mandate'>>(vorher: Pick<CrmBestand, 'chancen' | 'mandate'>, nachher: B): B {
  const altC = new Map((vorher.chancen ?? []).map(c => [c.id, c]));
  const altM = new Map((vorher.mandate ?? []).map(m => [m.id, m]));
  const firmen = nachher.firmen ?? [];
  const neuAufloesen = <T extends { firmaId?: string }>(e: T, name: string | undefined): T => {
    const jetzt = e.firmaId ? firmen.find(f => f.id === e.firmaId) : undefined;
    if (jetzt && norm(jetzt.name) === norm(name) && norm(name)) return e;
    const f = firmaNachName(firmen, name);
    if (f) return f.id === e.firmaId ? e : { ...e, firmaId: f.id };
    if (!e.firmaId) return e;
    const { firmaId: _weg, ...rest } = e;
    return rest as T;
  };
  let geaendert = false;
  const chancen = (nachher.chancen ?? []).map(c => {
    const a = altC.get(c.id);
    if (!a || norm(a.firma) === norm(c.firma) || a.firmaId !== c.firmaId) return c;
    const n = neuAufloesen(c, c.firma);
    if (n !== c) geaendert = true;
    return n;
  });
  const mandate = (nachher.mandate ?? []).map(m => {
    const a = altM.get(m.id);
    if (!a || norm(a.kunde) === norm(m.kunde) || a.firmaId !== m.firmaId) return m;
    const n = neuAufloesen(m, m.kunde);
    if (n !== m) geaendert = true;
    return n;
  });
  return firmaIdsErgaenzen(geaendert ? { ...nachher, chancen, mandate } : nachher).bestand;
}
