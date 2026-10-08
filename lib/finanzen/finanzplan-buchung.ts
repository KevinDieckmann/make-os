// ─── Finanzplan → Buchungen: Zahlungseingang und Gegenbuchung (nur Server) ───
// Bis 08.10. lagen beide Helfer in app/api/state/finanzplan/route.ts. Seit „Rechnungen schreiben mit PDF“ storniert auch
// lib/finanzen/rechnung/server.ts (Stornorechnung) — EIN Weg für beide, damit Kennungen und Form gleich bleiben:
// Eingang `bu-re-<id>`, Gegenbuchung `bu-st-<id>`, beide idempotent. Aufgerufen in der Sperre des Finanzplans (innen nur `buchungen`).

import { updateJson } from '@/lib/store/local-db';
import { buchungsId, stornoBuchungFuer, stornoBuchungsId, type RechnungsBuchung } from './finanzplan-bestand';

/** Zum Zahlungseingang `bu-re-<id>` die Gegenbuchung `bu-st-<id>` anlegen, wenn es den Eingang gibt und die Gegenbuchung noch nicht. */
export async function gegenbuchungAnlegen(r: Parameters<typeof stornoBuchungFuer>[1], am: string): Promise<'neu' | 'vorhanden' | 'keine'> {
  let ergebnis: 'neu' | 'vorhanden' | 'keine' = 'keine';
  await updateJson<{ buchungen: RechnungsBuchung[] }>('buchungen', cur => {
    const liste = Array.isArray(cur?.buchungen) ? cur!.buchungen : [];
    const eingang = liste.find(x => x.id === buchungsId(r.id));
    if (!eingang) return cur ?? { buchungen: liste };
    if (liste.some(x => x.id === stornoBuchungsId(r.id))) { ergebnis = 'vorhanden'; return cur ?? { buchungen: liste }; }
    ergebnis = 'neu';
    return { ...(cur ?? {}), buchungen: [...liste, stornoBuchungFuer(eingang, r, am)].sort((x, y) => y.datum.localeCompare(x.datum)) };
  });
  return ergebnis;
}

/** Die Buchung zur Rechnung anlegen, wenn es sie noch nicht gibt (Kennung `bu-re-<id>`). */
export async function buchungAnlegen(b: RechnungsBuchung): Promise<'neu' | 'vorhanden'> {
  let ergebnis: 'neu' | 'vorhanden' = 'vorhanden';
  await updateJson<{ buchungen: RechnungsBuchung[] }>('buchungen', cur => {
    const liste = Array.isArray(cur?.buchungen) ? cur!.buchungen : [];
    if (liste.some(x => x.id === b.id)) return cur ?? { buchungen: liste };
    ergebnis = 'neu';
    return { ...(cur ?? {}), buchungen: [...liste, b].sort((x, y) => y.datum.localeCompare(x.datum)) };
  });
  return ergebnis;
}
