// ─── Prozesse — Stellschrauben lesen und Rechte (Server; 22.10., Branch `prozesse-stellschrauben`) ──────────────────────────────────────────────────────────
// Liest die VORHANDENEN Bestände, aus denen die System-Prozesse ihre Einstellungen nehmen, und hängt je Prozess die Stellschrauben an (gebaut rein in
// ./stellschrauben-bau.ts). Nur lesen — geschrieben wird über die vorhandenen Routen (Weg je Stellschraube, ./stellschrauben.ts `anfrageFuer`).
// Jede Quelle ist für sich abgesichert: nicht lesbar → ihre Stellschrauben fehlen (nie eine erfundene Vorgabe). Kein Bestand → die Vorgabe des Bestands.
// Privat/Business: nur Business-Einstellungen (die Landkarte ist Business; Heads nur die Business-Heads des Haushalts, nie Abschnitte von Personen).
// Rechte je Weg rechnet `stellschraubenRechte` mit DENSELBEN Regeln wie die jeweilige Route (die beim Schreiben noch einmal prüft).

import { loadJson } from '@/lib/store/local-db';
import { stellschraubenBauen, type HeadKurz, type StellschraubenQuellen } from './stellschrauben-bau';
import type { StellschraubenRechte } from './stellschrauben';
import type { ProzessDef } from './typen';
import type { CrmBestand } from '@/lib/crm/typen';
import type { FulfillmentEinstellungen } from '@/lib/fulfillment/typen';
import type { ProzesseTor } from './zugang';

async function sicher<T>(f: () => Promise<T>): Promise<T | undefined> {
  try { return await f(); } catch (e) { console.error('[prozesse-stellschrauben] Quelle nicht lesbar:', e instanceof Error ? e.message.slice(0, 120) : e); return undefined; }
}

/** Die Business-Heads, deren Einstellungen der Steckbrief zeigt (Kennungen des Agenten-Katalogs). */
const BUSINESS_HEADS = ['sales', 'marketing', 'event', 'finanzen'] as const;

/**
 * Die Quellen lesen. `crm` und `fulfillment` gibt die Landkarte mit (sie liest sie ohnehin) — `undefined` = dort nicht lesbar.
 */
export async function stellschraubenQuellenLesen(h: string, schon: { crm?: CrmBestand; fulfillment?: FulfillmentEinstellungen } = {}): Promise<StellschraubenQuellen & { werteStand?: string }> {
  const crm = schon.crm;
  const [loeschfristen, mahnTage, heads, kanaele, buchungsseiten, neu] = await Promise.all([
    sicher(async () => {
      const { LOESCHFRISTEN_SPEICHER } = await import('@/lib/crm/loeschfristen');
      return (await loadJson<{ fristen?: StellschraubenQuellen['loeschfristen'] }>(LOESCHFRISTEN_SPEICHER))?.fristen ?? {};
    }),
    sicher(async () => (await import('@/lib/finanzen/rechnung/server')).mahnTageLaden()),
    sicher(async () => {
      const { einstellungBestand } = await import('@/lib/agenten/typen');
      const e = await loadJson<{ notAus?: unknown; heads?: Record<string, Record<string, unknown>> }>(einstellungBestand(h));
      const raus: Partial<Record<string, HeadKurz>> = {};
      for (const id of BUSINESS_HEADS) {
        const x = e?.heads?.[id];
        raus[id] = {
          ...(typeof x?.aktiv === 'boolean' ? { aktiv: x.aktiv } : {}), ...(typeof x?.stufe === 'string' ? { stufe: x.stufe } : {}),
          ...(typeof x?.budgetCentMonat === 'number' ? { budgetCentMonat: x.budgetCentMonat } : {}), ...(typeof x?.autonomie === 'string' ? { autonomie: x.autonomie } : {}),
          ...(e?.notAus || x?.notAus ? { notAus: true } : {}),
        };
      }
      return raus;
    }),
    sicher(async () => (await (await import('@/lib/crm/planung-server')).ladePlanung()).kanaele.length),
    sicher(async () => {
      const s = (await (await import('@/lib/kalender/buchung-speicher')).ladeBuchungBestand()).seiten;
      return { aktiv: s.filter(x => x.aktiv).length, gesamt: s.length };
    }),
    // Die neuen Stellschrauben (Teil B): hier STRENG gelesen — nicht lesbar = ihre Zeilen fehlen (die ausführenden Stellen nehmen dann die Vorgabe).
    sicher(async () => (await import('./stellschrauben-werte-server')).stellschraubenLesen(h)),
  ]);
  const sc = crm?.scoring;
  return {
    ...(crm ? { wertelisten: crm.wertelisten ?? {} } : {}),
    ...(sc ? { scoring: { marketing: sc.marketing.schwelle, sales: sc.sales.schwelle, mussMarketing: sc.marketing.muss.length, mussSales: sc.sales.muss.length, temperatur: { ...sc.temperaturAb } } } : {}),
    ...(loeschfristen ? { loeschfristen } : {}),
    ...(mahnTage ? { mahnTage } : {}),
    ...(schon.fulfillment ? { fulfillment: { pulsSchwelle: schon.fulfillment.pulsSchwelle, willkommenStunden: schon.fulfillment.willkommenStunden, nachsorgeTage: [...schon.fulfillment.nachsorgeTage] } } : {}),
    ...(heads ? { heads } : {}),
    ...(typeof kanaele === 'number' ? { kanaele } : {}),
    ...(buchungsseiten ? { buchungsseiten } : {}),
    ...(neu ? { werte: neu.werte, werteStand: (await import('./stellschrauben-werte-server')).stellschraubenStand(neu) } : {}),
  };
}

/** Die Stellschrauben an die System-Prozesse hängen (andere bleiben dieselben Objekte). */
export function mitStellschrauben(prozesse: readonly ProzessDef[], q: StellschraubenQuellen): ProzessDef[] {
  const je = stellschraubenBauen(q);
  return prozesse.map(p => (p.quelle === 'system' && je[p.id]?.length ? { ...p, stellschrauben: je[p.id] } : p));
}

/**
 * Was die Person je Weg ändern darf — dieselben Regeln wie die Routen: Dienstweg nie; neue Stellschrauben (/api/prozesse/stellschrauben) nur volle Mitglieder; Wertelisten, Löschfristen und Fulfillment-Einstellungen jede Person im
 * Haushalt des Inhabers (wie /api/crm/stammdaten, /api/crm/datenschutz, /api/fulfillment[/kunde]); Mahnstufen nur mit vollem Finanz-Zugang (wie /api/rechnung
 * `mahntage`). Die Route prüft beim Schreiben noch einmal — das hier entscheidet nur, ob ein Feld oder nur der Wert erscheint.
 */
export async function stellschraubenRechte(req: Request, z: Pick<ProzesseTor, 'dienst' | 'rechte' | 'person'>): Promise<StellschraubenRechte> {
  if (z.dienst || !z.rechte.sehen) return {};
  const finanz = await sicher(async () => {
    const [{ planZugangVon }, { haushaltDesInhabers }] = await Promise.all([import('@/lib/finanzen/haushalt/zugriff'), import('@/lib/zugang/haushalt-inhaber')]);
    const p = await planZugangVon(req);
    return !!p && p.sicht === 'privat' && p.haushalt === (await haushaltDesInhabers());
  });
  return { prozesse: z.rechte.veroeffentlichen, wertelisten: true, loeschfrist: true, 'puls-schwelle': true, fulfillment: true, mahntage: !!finanz };
}
