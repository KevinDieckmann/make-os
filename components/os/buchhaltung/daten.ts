// ─── Buchhaltung im Browser — Lesen und Schreiben der Arbeitsliste (02.11.) ─────────────────────────────────────────────────────────
// EINE Stelle für die Abrufe der Buchungen-Ansicht: GET /api/state/buchungen (Sicht des Bereichs), GET/POST /api/finanzen/buchhaltung (Regeln,
// Vorschläge, Paket, Zu prüfen), PATCH `teil` mit Stand (409 → die Zeile nimmt den Serverstand, die Meldung sagt es), /api/rechnung (offene
// Rechnungen, „bezahlt“ mit `buchungId`). Die Bau-Kennung setzt die Fetch-Hülle (BauWache). Nichts wird im Browser gespeichert.

import type { BhBuchung } from '@/lib/finanzen/buchhaltung/arbeitsliste';
import type { BuchungsRegel } from '@/lib/finanzen/buchhaltung/regeln';
import type { UmbuchungVorschlag } from '@/lib/finanzen/buchhaltung/gegenkonto';
import type { RechnungFuerAbgleich } from '@/lib/finanzen/buchhaltung/zahlung-rechnung';
import type { TeilFelder } from '@/lib/finanzen/buchhaltung/teil';

export type Bereich = 'business' | 'privat';

export interface Lage {
  regeln: BuchungsRegel[]; eigene: string[]; kategorien: string[]; stand: string;
  vorschlaege: UmbuchungVorschlag[]; zuPruefen: number;
}

export interface RechnungZeile extends RechnungFuerAbgleich { titel?: string; fassung?: string }

/** Antwort eines Schreibwegs: geänderte Zeilen (mit neuem Stand) bzw. ein Satz, warum nicht. */
export type Ergebnis = { ok: true; zeilen: BhBuchung[]; anzahl: number } | { ok: false; fehler: string; zeilen: BhBuchung[] };

const json = async <T>(r: Response): Promise<T | null> => { try { return await r.json() as T; } catch { return null; } };
const sichtParam = (b: Bereich) => `sicht=${b}`;

export async function buchungenLaden(b: Bereich): Promise<BhBuchung[] | null> {
  const r = await fetch(`/api/state/buchungen?${sichtParam(b)}`, { cache: 'no-store' }).catch(() => null);
  if (!r?.ok) return null;
  const d = await json<{ buchungen?: BhBuchung[] }>(r);
  return Array.isArray(d?.buchungen) ? d!.buchungen : [];
}

export async function lageLaden(b: Bereich): Promise<Lage | null> {
  const r = await fetch(`/api/finanzen/buchhaltung?${sichtParam(b)}`, { cache: 'no-store' }).catch(() => null);
  if (!r?.ok) return null;
  const d = await json<Lage & { ok?: boolean }>(r);
  return d?.ok ? d : null;
}

export async function rechnungenLaden(b: Bereich): Promise<RechnungZeile[]> {
  const r = await fetch(`/api/rechnung?bereich=${b}`, { cache: 'no-store' }).catch(() => null);
  if (!r?.ok) return [];
  const d = await json<{ rechnungen?: RechnungZeile[] }>(r);
  return Array.isArray(d?.rechnungen) ? d!.rechnungen : [];
}

export interface MandatWahl { id: string; titel: string; firma: string; aktiv: boolean; /** Gesellschaft des Mandats (fehlt = offen). */ einheit?: string }
export async function mandateLaden(): Promise<MandatWahl[]> {
  const r = await fetch('/api/crm/mandat-wahl').catch(() => null);
  if (!r?.ok) return [];
  const d = await json<{ mandate?: MandatWahl[] }>(r);
  return Array.isArray(d?.mandate) ? d!.mandate : [];
}

/** Höchstens so viele Änderungen je Anfrage (Grenze der Route) — größere Mengen gehen nacheinander, nie gekürzt. */
export const OPS_JE_ANFRAGE = 200;

/** Felder einzelner Buchungen ändern — je Buchung mit ihrem Stand. Mehr als 200 → mehrere Anfragen nacheinander (jede alles oder nichts). */
export async function teilSchicken(b: Bereich, ops: { id: string; stand?: string; felder: TeilFelder }[]): Promise<Ergebnis> {
  const alle: BhBuchung[] = [];
  for (let i = 0; i < ops.length; i += OPS_JE_ANFRAGE) {
    const stueck = ops.slice(i, i + OPS_JE_ANFRAGE).map(o => ({ op: 'teil', id: o.id, ...(o.stand ? { stand: o.stand } : {}), felder: o.felder }));
    const r = await fetch(`/api/state/buchungen?${sichtParam(b)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: stueck }) }).catch(() => null);
    if (!r) return { ok: false, fehler: 'Nicht gespeichert — keine Verbindung. Bitte noch einmal.', zeilen: alle };
    const d = await json<{ ok?: boolean; error?: string; zeilen?: BhBuchung[]; konflikte?: { id: string; aktuell?: BhBuchung }[] }>(r);
    if (r.status === 409 && d?.konflikte) {
      const aktuell = d.konflikte.map(k => k.aktuell).filter((x): x is BhBuchung => !!x);
      return { ok: false, fehler: `${d.error ?? 'Inzwischen hat jemand diese Buchung geändert.'} Die aktuelle Fassung steht jetzt da — bitte noch einmal prüfen.`, zeilen: [...alle, ...aktuell] };
    }
    if (!r.ok || !d?.ok) return { ok: false, fehler: d?.error ?? `Nicht gespeichert (${r.status}).`, zeilen: alle };
    alle.push(...(d.zeilen ?? []));
  }
  return { ok: true, zeilen: alle, anzahl: alle.length };
}

/** Eine Aktion der Buchhaltung (Regeln, rückwirkend, Paket). */
export async function aktion<T = Record<string, unknown>>(b: Bereich, body: Record<string, unknown>): Promise<{ ok: true; d: T } | { ok: false; fehler: string; d: T | null; status: number }> {
  const r = await fetch(`/api/finanzen/buchhaltung?${sichtParam(b)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  if (!r) return { ok: false, fehler: 'Keine Verbindung — nichts gespeichert.', d: null, status: 0 };
  const d = await json<T & { ok?: boolean; error?: string }>(r);
  if (!r.ok || !d?.ok) return { ok: false, fehler: d?.error ?? `Nicht gespeichert (${r.status}).`, d, status: r.status };
  return { ok: true, d };
}

/** Rechnung als bezahlt vermerken und GENAU diese Buchung verknüpfen (der EINE Weg, lib/finanzen/rechnung/bezahlt-server.ts). */
export async function bezahltVermerken(rechnungId: string, buchung: BhBuchung): Promise<{ ok: boolean; fehler?: string }> {
  const r = await fetch('/api/rechnung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'bezahlt', id: rechnungId, am: buchung.datum, buchungId: buchung.id }) }).catch(() => null);
  if (!r) return { ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' };
  const d = await json<{ ok?: boolean; error?: string }>(r);
  return r.ok && d?.ok ? { ok: true } : { ok: false, fehler: d?.error ?? `Nicht gespeichert (${r.status}).` };
}

/** Die Adresse des Exports (CSV) — Gesellschaften und Zeitraum aus dem Filter, Sicht des Bereichs. */
export function exportAdresse(b: Bereich, f: { orte: readonly string[]; von?: string; bis?: string }): string {
  const q = new URLSearchParams({ sicht: b });
  if (f.orte.length) q.set('orte', f.orte.join(','));
  if (f.von) q.set('von', f.von);
  if (f.bis) q.set('bis', f.bis);
  return `/api/finanzen/buchhaltung/export?${q.toString()}`;
}
