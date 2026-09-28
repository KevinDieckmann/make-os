// ─── Markttraktion · Mutter- und Tochterfirmen (rein, getestet, 28.09.) ───────
// Kevins Entscheidung 28.09. (#7): Eine Firma kann eine Mutter haben (`Firma.mutterId`).
// Die Firmenkarte zeigt Mutter und Töchter, Umsatz und Deals lassen sich für die
// ganze Gruppe zusammenfassen, BEAN der Gruppe als Anzeige.
//
// Regeln: eine Mutter zeigt auf eine bestehende Firma, nie auf sich selbst, und die
// Kette bildet keinen Kreis. Die Säuberung (lib/crm/speicher.ts) prüft Form und
// Selbstbezug, `mutterPruefen` den Kreis und die tote Mutter gegen die ganze Liste —
// ein Verstoß wird abgelehnt (nur diese Änderung, der Rest gilt). Die
// Verbindungsprüfung meldet Altlasten (`firma-mutter-tot`, `firma-mutter-zyklus`).

import type { Firma } from './typen';

type MitMutter = Pick<Firma, 'id' | 'mutterId'>;

/** Die Kette der Mütter (nächste zuerst). Bricht an einem Kreis oder einer toten Kennung ab. */
export function muetter(firmen: readonly MitMutter[], id: string): string[] {
  const nachId = new Map(firmen.map(f => [f.id, f]));
  const raus: string[] = [];
  const gesehen = new Set([id]);
  let m = nachId.get(id)?.mutterId;
  while (m && nachId.has(m) && !gesehen.has(m)) { raus.push(m); gesehen.add(m); m = nachId.get(m)?.mutterId; }
  return raus;
}

/** Liegt diese Firma auf einem Kreis (sie ist ihre eigene Vorfahrin)? */
export function imKreis(firmen: readonly MitMutter[], id: string): boolean {
  const nachId = new Map(firmen.map(f => [f.id, f]));
  const gesehen = new Set<string>();
  let m = nachId.get(id)?.mutterId;
  while (m && !gesehen.has(m)) {
    if (m === id) return true;
    gesehen.add(m);
    m = nachId.get(m)?.mutterId;
  }
  return false;
}

/** Alle Firmen auf einem Kreis. */
export function kreisFirmen(firmen: readonly MitMutter[]): string[] {
  return firmen.filter(f => imKreis(firmen, f.id)).map(f => f.id);
}

/** Die direkten Töchter. */
export function toechter<F extends MitMutter>(firmen: readonly F[], id: string): F[] {
  return firmen.filter(f => f.mutterId === id && f.id !== id);
}

/**
 * Die ganze Gruppe: die oberste Mutter und alle ihre Nachfahren (Kennungen, die Firma selbst immer dabei).
 * Ohne Mutter und Töchter nur die Firma selbst.
 */
export function firmenGruppe(firmen: readonly MitMutter[], id: string): string[] {
  const kette = muetter(firmen, id);
  const wurzel = kette.length ? kette[kette.length - 1] : id;
  const raus = new Set<string>([wurzel, id]);
  const offen = [wurzel];
  while (offen.length) {
    const x = offen.pop()!;
    for (const t of firmen) if (t.mutterId === x && !raus.has(t.id)) { raus.add(t.id); offen.push(t.id); }
  }
  return Array.from(raus);
}

/** Gehört die Firma zu einer Gruppe (hat Mutter oder Töchter)? */
export const inGruppe = (firmen: readonly MitMutter[], id: string) => firmenGruppe(firmen, id).length > 1;

/**
 * Nach einer Änderung: jede Firma, deren `mutterId` sich geändert hat und jetzt auf eine fehlende Firma
 * zeigt oder einen Kreis schließt, bekommt ihre alte Mutter zurück — mit Fehlertext. Nie wird eine
 * Firma gelöscht oder eine unveränderte angefasst.
 */
export function mutterPruefen<F extends MitMutter & { name?: string }>(vorher: readonly F[], nachher: F[]): { firmen: F[]; fehler: string[] } {
  const alt = new Map(vorher.map(f => [f.id, f.mutterId]));
  const fehler: string[] = [];
  let liste = nachher;
  const ids = new Set(liste.map(f => f.id));
  const zurueck = (f: F, grund: string) => {
    fehler.push(`„${f.name ?? f.id}“: ${grund} — Mutterfirma nicht geändert.`);
    liste = liste.map(x => (x.id === f.id ? (alt.get(f.id) ? { ...x, mutterId: alt.get(f.id) } : (({ mutterId: _m, ...r }) => r as F)(x)) : x));
  };
  for (const f of nachher) {
    if (!f.mutterId || f.mutterId === alt.get(f.id)) continue;
    if (!ids.has(f.mutterId)) zurueck(f, 'die gewählte Mutterfirma gibt es nicht');
    else if (f.mutterId === f.id) zurueck(f, 'eine Firma kann nicht ihre eigene Mutter sein');
  }
  // Kreise: so lange die jüngste Änderung auf einem Kreis zurücknehmen, bis keiner mehr da ist.
  for (let runde = 0; runde < nachher.length; runde++) {
    const kreis = liste.find(f => f.mutterId && f.mutterId !== alt.get(f.id) && imKreis(liste, f.id));
    if (!kreis) break;
    zurueck(kreis, 'die Mutterfirma würde einen Kreis bilden (die Firma wäre ihre eigene Mutter)');
  }
  return { firmen: liste, fehler };
}
