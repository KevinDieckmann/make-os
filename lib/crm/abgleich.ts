// ─── CRM — Firmen-Abgleich über beide Speicher (Server) ────────────────────
// Rechnet mit lib/crm/firmen.ts und schreibt dann zweimal gezielt:
// die Kartei bekommt NUR die fehlenden firmaId-Verweise (je Kennung, gegen den
// aktuellen Stand — gleichzeitige Änderungen anderer bleiben erhalten), das
// CRM die Firmenliste. Läuft nach jedem Import und auf Knopfdruck.

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from './speicher';
import { firmenAbgleich } from './firmen';

export async function firmenAbgleichen(): Promise<{ neu: number; verknuepft: number; ergaenzt: number; firmen: number }> {
  const jetzt = new Date().toISOString();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const r = firmenAbgleich(kontakte, crm.firmen, jetzt);
  const verweis = new Map(r.kontakte.filter(k => k.firmaId).map(k => [k.id, k.firmaId!]));
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    return { ...f, kontakte: f.kontakte.map(k => (!k.firmaId && verweis.has(k.id) ? { ...k, firmaId: verweis.get(k.id)! } : k)) };
  });
  const neueIds = new Map(r.firmen.map(x => [x.id, x]));
  const fertig = await aendereCrm(cur => {
    const da = new Map(cur.firmen.map(x => [x.id, x]));
    // Bestehende: nur ergänzen (von-Hand-Stand gewinnt), neue: anhängen.
    const liste = cur.firmen.map(x => { const n = neueIds.get(x.id); if (!n) return x; const out = { ...n, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined && v !== '')) }; if (!x.rolleVonHand) out.rolle = n.rolle; return out; });
    for (const x of r.firmen) if (!da.has(x.id)) liste.push(x);
    return { ...cur, firmen: liste };
  });
  return { neu: r.neu, verknuepft: r.verknuepft, ergaenzt: r.ergaenzt, firmen: fertig.firmen.length };
}
