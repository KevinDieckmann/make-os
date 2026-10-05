// ─── Finanzplanung — Darlehen zwischen den Einheiten (rein, client-sicher, getestet) ─────────────────────────────
// Kevin 05.10.: „Es gibt kein Gesellschafterdarlehen, außer ungefähr 1.500 € privat in der KD Ventures. Die gebe ich Privat/Selbstständigkeit
// rein.“ — Darlehen sauber: Geber und Nehmer wählbar, die Rückzahlung kommt beim Geber an. Gerechnet wird im Kern (`darlehenFluesse`,
// lib/finanzen/rechenkern.ts); hier liegen Beschriftungen, das Anlegen und der Säuberer für den Schreibweg und den Import.
// Keine Beträge oder Namen im Code — die Darlehen trägt der Haushalt ein.

import type { Darlehen, DarlehenOrt } from './rechenkern';
import { finanzOrtName } from '@/lib/einheiten';

export const DARLEHEN_ORTE: DarlehenOrt[] = ['privat', 'kdc', 'ug', 'kdv', 'extern'];
/** Namen aus der einen Einheitenliste (lib/einheiten.ts); `extern` = außerhalb des Plans (Bank, Dritte). */
export const darlehenOrtName = (o: DarlehenOrt): string => (o === 'extern' ? 'außerhalb des Plans' : finanzOrtName(o));
/** Seiten, die zum Business gehören (seit 05.10. nur die Gesellschaften). */
export const DARLEHEN_BUSINESS: DarlehenOrt[] = ['ug', 'kdv'];
export const istDarlehenOrt = (v: unknown): v is DarlehenOrt => typeof v === 'string' && (DARLEHEN_ORTE as string[]).includes(v);

const fin = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const text = (v: unknown, n: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : undefined);

/**
 * Ein Darlehen aus rohen Daten — null, wenn unbrauchbar (Geber = Nehmer, unbekannte Seite, keine Kennung). Monate auf ganze Zahlen gerundet,
 * aber NIE geklemmt (Gegenprüfung 05.10., Fund 9): ein Monat außerhalb des Plans bleibt stehen, damit Schreibweg und Import ihn mit klarer Meldung
 * ablehnen (`darlehenMonatFehler`) — vorher wurde eine Rückzahlung nach Planende still auf den letzten Planmonat gezogen. Rückzahlung vor bzw. in
 * der Auszahlung → offen (0). `N` bleibt als Parameter für Aufrufer, die die Planlänge kennen (wird hier nicht mehr zum Klemmen benutzt).
 */
export function pruefeEinDarlehen(roh: unknown, _N = 60): Darlehen | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null;
  const r = roh as Record<string, unknown>;
  if (typeof r.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/i.test(r.id)) return null;
  if (!istDarlehenOrt(r.geber) || !istDarlehenOrt(r.nehmer) || r.geber === r.nehmer) return null;
  const betrag = Math.max(0, Math.round((fin(r.betrag) ?? 0) * 100) / 100);
  const aus = Math.round(fin(r.aus) ?? 0);
  let zurueck = Math.round(fin(r.zurueck) ?? 0);
  if (zurueck > 0 && zurueck <= aus) zurueck = 0;   // Rückzahlung vor der Auszahlung gibt es nicht → offen
  const d: Darlehen = { id: r.id, name: text(r.name, 120) ?? 'Darlehen', geber: r.geber, nehmer: r.nehmer, betrag, aus, zurueck };
  const notiz = text(r.notiz, 600); if (notiz) d.notiz = notiz;
  return d;
}
/** Monate eines Darlehens außerhalb des Plans (Monat 0 … N) → Meldung, sonst null. Schreibweg und Import antworten damit 400. */
export function darlehenMonatFehler(l: Pick<Darlehen, 'name' | 'aus' | 'zurueck'>, N: number): string | null {
  const name = l.name ? `„${l.name}“` : 'Ein Darlehen';
  if (l.aus < 0 || l.aus > N) return `${name}: Auszahlung im Monat ${l.aus} liegt außerhalb des Plans (0 = vor Planbeginn, 1 … ${N}).`;
  if (l.zurueck < 0 || l.zurueck > N) return `${name}: Rückzahlung im Monat ${l.zurueck} liegt außerhalb des Plans (0 = offen, 1 … ${N}). Liegt sie später, „offen“ wählen.`;
  return null;
}
/** Die Liste säubern — doppelte Kennungen fallen weg, leer → undefined (der Schlüssel entfällt, ältere Stände sehen nichts Neues). */
export function pruefeDarlehen(roh: unknown, N = 60): Darlehen[] | undefined {
  if (!Array.isArray(roh)) return undefined;
  const out: Darlehen[] = [];
  for (const x of roh) { const d = pruefeEinDarlehen(x, N); if (d && !out.some(o => o.id === d.id)) out.push(d); }
  return out.length ? out : undefined;
}
/** Neues Darlehen (Vorgabe: Privat → KD Ventures, schon vor Planbeginn ausgezahlt, Rückzahlung offen — Betrag trägt der Haushalt ein). */
export function neuesDarlehen(id: string, teil: Partial<Darlehen> = {}): Darlehen {
  return { id, name: teil.name ?? 'Darlehen', geber: teil.geber ?? 'privat', nehmer: teil.nehmer ?? 'kdv', betrag: teil.betrag ?? 0, aus: teil.aus ?? 0, zurueck: teil.zurueck ?? 0, ...(teil.notiz ? { notiz: teil.notiz } : {}) };
}
/**
 * Ein Darlehen, wie die Business-Sicht es sieht (05.10.): private Seiten (Privat, Selbstständigkeit) heißen „außerhalb des Plans“ — die
 * Gesellschaft sieht ihre Forderung bzw. Verbindlichkeit, nie die private Seite. Ohne Business-Seite: null (fällt ganz weg).
 */
/** Neutraler Name eines Darlehens mit privater Seite in der Business-Sicht (Gegenprüfung 05.10., Fund 10 — der frei gewählte Name ist privat). */
export const DARLEHEN_NAME_PRIVAT = 'Darlehen (privat)';
export function darlehenFuerBusiness(l: Darlehen): Darlehen | null {
  const g = DARLEHEN_BUSINESS.includes(l.geber), n = DARLEHEN_BUSINESS.includes(l.nehmer);
  if (!g && !n) return null;
  const { notiz: _notiz, ...rest } = l;
  // Eine private Seite (Privat, Selbstständigkeit): Name und Notiz bleiben in Privat. „außerhalb des Plans“ (Bank, Altdarlehen) ist nicht privat.
  const privatSeite = !darlehenBusinessAenderbar(l);
  return { ...rest, ...(privatSeite ? { name: DARLEHEN_NAME_PRIVAT } : {}), geber: g ? l.geber : 'extern', nehmer: n ? l.nehmer : 'extern', ...(!privatSeite && l.notiz ? { notiz: l.notiz } : {}) };
}
/** Darf die Business-Sicht dieses Darlehen ändern? Nur, wenn beide Seiten Gesellschaften oder „außerhalb“ sind — nie mit privater Seite. */
export const darlehenBusinessAenderbar = (l: Pick<Darlehen, 'geber' | 'nehmer'>): boolean =>
  [l.geber, l.nehmer].every(o => DARLEHEN_BUSINESS.includes(o) || o === 'extern') && [l.geber, l.nehmer].some(o => DARLEHEN_BUSINESS.includes(o));
