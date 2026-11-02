// ─── Buchhaltung — Server: Regeln, Vorschläge für Gegenbuchungen, Schreiben auf `buchungen` (02.11.) ───────────────────────────────────
// EINE Schreibstelle des Regel-Bestands `buchungs-regeln--<haushalt>` (Regeln „Empfänger/Zweck → Kategorie“ + eigene Kategorien des Haushalts —
// ohne Personen-Feld; wer was geändert hat, steht nur im Änderungsprotokoll). Buchungen werden nur über `buchungenAendern` geschrieben: frisch in
// der Sperre lesen, Stand je Zeile prüfen (409), nichts Ungeprüftes. Die Filterstelle „wer sieht welche Buchung“ ist `sichtbarFuer`.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { istBusinessGesellschaft } from '@/lib/einheiten';
import { ibanGrundform } from '@/lib/crm/zahlung';
import { ladeRegister } from '@/lib/finanzen/konten/server';
import type { KontoOrt } from '@/lib/finanzen/konten/register';
import { LEERER_REGELBESTAND, regelBestandLesen, type RegelBestand } from './regeln';
import type { BhBuchung } from './arbeitsliste';
import type { RechnungKurz } from './teil';

const HAUSHALT = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Bestand je Haushalt (ausgeschrieben, damit der Register-Wächter den Namen findet). */
export function regelnName(haushalt: string): string {
  if (!HAUSHALT.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return `buchungs-regeln--${haushalt}`;
}

export type Sicht = 'privat' | 'business';
/** Die EINE Filterstelle: die Business-Sicht bekommt nur Buchungen der Business-Gesellschaften. */
export const sichtbarFuer = (b: Pick<BhBuchung, 'ort'>, sicht: Sicht): boolean => sicht === 'privat' || istBusinessGesellschaft(b.ort);
/** Stand einer Buchung (Fingerabdruck ohne das Feld `stand`). */
export const standVon = (b: BhBuchung): string => { const { stand: _s, ...rest } = b; return fingerabdruck(rest as unknown as Record<string, unknown>); };
export const mitStand = (b: BhBuchung): BhBuchung => ({ ...b, stand: standVon(b) });

export async function regelnLaden(haushalt: string): Promise<RegelBestand> {
  return regelBestandLesen(await loadJson<unknown>(regelnName(haushalt)));
}
export const regelnStand = (b: RegelBestand): string => fingerabdruck(b as unknown as Record<string, unknown>);

class Unveraendert extends Error {}
/** Regeln ändern (Sperre): `f` liefert den neuen Bestand oder null (nichts zu schreiben). Stand veraltet → `{ konflikt }`. */
export async function regelnAendern(haushalt: string, stand: string | undefined, f: (alt: RegelBestand) => RegelBestand | null): Promise<{ ok: true; bestand: RegelBestand } | { ok: false; konflikt: RegelBestand }> {
  let konflikt: RegelBestand | null = null;
  let neu: RegelBestand | null = null;
  try {
    await updateJson<RegelBestand>(regelnName(haushalt), roh => {
      const alt = regelBestandLesen(roh ?? LEERER_REGELBESTAND);
      if (stand !== undefined && stand !== regelnStand(alt)) { konflikt = alt; throw new Unveraendert(); }
      const n = f(alt);
      if (!n) { neu = alt; throw new Unveraendert(); }
      neu = n;
      return n;
    });
  } catch (e) { if (!(e instanceof Unveraendert)) throw e; }
  if (konflikt) return { ok: false, konflikt };
  return { ok: true, bestand: neu ?? LEERER_REGELBESTAND };
}

interface Datei { buchungen: BhBuchung[] }

export async function buchungenLaden(): Promise<BhBuchung[]> {
  const f = await loadJson<Datei>('buchungen');
  return Array.isArray(f?.buchungen) ? f.buchungen : [];
}

export async function rechnungenKurz(): Promise<RechnungKurz[]> {
  const fp = await loadJson<{ rechnungen?: { id?: string; firmaId?: string; mandatId?: string }[] }>('finanzplan');
  return (fp?.rechnungen ?? []).filter(r => typeof r?.id === 'string').map(r => ({ id: r.id!, ...(r.firmaId ? { firmaId: r.firmaId } : {}), ...(r.mandatId ? { mandatId: r.mandatId } : {}) }));
}

export type AendernFehler = { status: 400 | 403 | 404 | 409 | 413; fehler: string; konflikte?: BhBuchung[] };
/**
 * Buchungen in EINER Sperre ändern. `f` bekommt den ganzen Bestand und liefert je Kennung die neue Zeile — oder einen Fehler (dann bleibt
 * ALLES, wie es war). Stände (`staende`: Kennung → Stand aus dem Browser) werden in der Sperre geprüft.
 */
export async function buchungenAendern(staende: ReadonlyMap<string, string>, f: (alle: BhBuchung[]) => Map<string, BhBuchung> | AendernFehler): Promise<{ ok: true; geaendert: BhBuchung[] } | ({ ok: false } & AendernFehler)> {
  let fehler: AendernFehler | null = null;
  let geaendert: BhBuchung[] = [];
  await updateJson<Datei>('buchungen', roh => {
    const alle = Array.isArray(roh?.buchungen) ? roh!.buchungen : [];
    const nachId = new Map(alle.map(b => [b.id, b]));
    const veraltet: BhBuchung[] = [];
    for (const [id, s] of Array.from(staende)) {
      const b = nachId.get(id);
      if (!b) { fehler = { status: 404, fehler: 'Eine Buchung gibt es nicht (mehr) — nichts gespeichert.' }; return roh ?? { buchungen: [] }; }
      if (standVon(b) !== s) veraltet.push(mitStand(b));
    }
    if (veraltet.length) { fehler = { status: 409, fehler: 'Inzwischen hat jemand diese Buchung geändert — die neue Fassung ist geladen, nichts gespeichert.', konflikte: veraltet }; return roh ?? { buchungen: [] }; }
    const r = f(alle);
    if (!(r instanceof Map)) { fehler = r; return roh ?? { buchungen: [] }; }
    if (!r.size) return roh ?? { buchungen: [] };
    geaendert = Array.from(r.values());
    return { ...(roh ?? {}), buchungen: alle.map(b => r.get(b.id) ?? b) };
  });
  if (fehler) return { ok: false, ...(fehler as AendernFehler) };
  return { ok: true, geaendert: geaendert.map(mitStand) };
}

/** IBAN eigener Konten → Ort (für Entnahme/Einlage/Verrechnung; lib/finanzen/buchhaltung/gegenkonto.ts). */
export async function eigeneOrte(haushalt: string, ohneKonto?: string): Promise<Map<string, KontoOrt>> {
  const r = await ladeRegister(haushalt);
  const m = new Map<string, KontoOrt>();
  for (const k of r.konten) if (k.id !== ohneKonto && k.iban) m.set(ibanGrundform(k.iban), k.ort);
  return m;
}
