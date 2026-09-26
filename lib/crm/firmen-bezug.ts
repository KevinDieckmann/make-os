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
