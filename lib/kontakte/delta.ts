// ─── Abgleich überträgt nur Änderungen (Datenschicht Stufe 2, 27.09.) ───────
// Der Browser fragt alle 20 Sekunden. Unverändert: 304 (seit 25.09.). Verändert:
// bisher 750 KB für 453 Kontakte — auch wenn nur ein Feld anders war. Jetzt merkt
// sich der Server je ausgelieferten Stand (ETag) die Fingerabdrücke aller Zeilen;
// kennt er den Stand, den der Browser hat, schickt er nur die geänderten Zeilen
// und die Kennungen der gelöschten. Rein und getestet; das Gedächtnis (letzte 20
// Stände) hält die Route.

export interface Delta<T> { geaendert: T[]; geloescht: string[] }

/** Was sich gegenüber dem alten Stand (Kennung → Fingerabdruck) geändert hat. */
export function deltaAus<T extends { id: string; stand: string }>(alt: Map<string, string>, neu: T[]): Delta<T> {
  const geaendert = neu.filter(e => alt.get(e.id) !== e.stand);
  const jetzt = new Set(neu.map(e => e.id));
  const geloescht = Array.from(alt.keys()).filter(id => !jetzt.has(id));
  return { geaendert, geloescht };
}

/** Fingerabdrücke eines Stands — das, was sich der Server je ETag merkt. */
export function staende<T extends { id: string; stand: string }>(liste: T[]): Map<string, string> {
  return new Map(liste.map(e => [e.id, e.stand]));
}

/** Im Browser: Delta auf die gehaltene Liste anwenden (Reihenfolge bleibt, Neues hinten). */
export function deltaAnwenden<T extends { id: string }>(liste: T[], delta: Delta<T>): T[] {
  const weg = new Set(delta.geloescht);
  const neu = new Map(delta.geaendert.map(e => [e.id, e]));
  const raus = liste.filter(e => !weg.has(e.id)).map(e => neu.get(e.id) ?? e);
  const da = new Set(raus.map(e => e.id));
  for (const e of delta.geaendert) if (!da.has(e.id)) raus.push(e);
  return raus;
}

/** Gedächtnis der letzten Stände, begrenzt. */
export class StandGedaechtnis {
  private readonly ablage = new Map<string, Map<string, string>>();
  constructor(private readonly max = 20) {}
  merke(etag: string, s: Map<string, string>): void {
    if (this.ablage.has(etag)) this.ablage.delete(etag);
    this.ablage.set(etag, s);
    while (this.ablage.size > this.max) { const erster = this.ablage.keys().next().value as string; this.ablage.delete(erster); }
  }
  hole(etag: string | null): Map<string, string> | null { return etag ? this.ablage.get(etag) ?? null : null; }
}
