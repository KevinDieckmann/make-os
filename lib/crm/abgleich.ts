// ─── CRM — Firmen-Abgleich über beide Speicher (Server) ────────────────────
// Rechnet mit lib/crm/firmen.ts und schreibt dann zweimal gezielt:
// die Kartei bekommt NUR fehlende oder tote firmaId-Verweise (je Kennung, gegen den
// aktuellen Stand — gleichzeitige Änderungen anderer bleiben erhalten), das
// CRM die Firmenliste. Läuft nach jedem Import und auf Knopfdruck.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, listenDiff, type Wer } from '@/lib/store/aenderungsprotokoll';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from './speicher';
import { firmenAbgleich } from './firmen';

/** `wer` (28.09.): wer den Abgleich auslöst — der Import übergibt `{ art: 'import' }` ans Änderungsprotokoll. */
export async function firmenAbgleichen(wer?: Wer): Promise<{ neu: number; verknuepft: number; ergaenzt: number; firmen: number }> {
  const jetzt = new Date().toISOString();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const crm = await ladeCrm();
  const r = firmenAbgleich(kontakte, crm.firmen, jetzt);
  // Was der Abgleich an einer Person ändert: `firmaId` (leer ODER tot, W1 28.09.) bzw. die Hauptstation mit toter Firma.
  // Geschrieben wird nur, wenn die Person seit dem Lesen unverändert ist (gleiche firmaId, gleiche Stationen) —
  // gleichzeitige Änderungen anderer bleiben erhalten.
  const sig = (k: Pick<Kontakt, 'firmaId' | 'stationen'>) => JSON.stringify([k.firmaId ?? null, k.stationen ?? null]);
  const verweis = new Map<string, { alt: string; neu: Pick<Kontakt, 'firmaId' | 'stationen'> }>();
  r.kontakte.forEach((k, i) => { const a = kontakte[i]; if (a && a.id === k.id && sig(a) !== sig(k)) verweis.set(k.id, { alt: sig(a), neu: { firmaId: k.firmaId, stationen: k.stationen } }); });
  let vorher: Kontakt[] = [], nachher: Kontakt[] = [];
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    vorher = f.kontakte;
    nachher = f.kontakte.map(k => {
      const v = verweis.get(k.id);
      if (!v || sig(k) !== v.alt) return k;
      return { ...k, ...(v.neu.firmaId ? { firmaId: v.neu.firmaId } : {}), ...(Array.isArray(v.neu.stationen) ? { stationen: v.neu.stationen } : {}) };
    });
    return { ...f, kontakte: nachher };
  });
  await protokolliere('kontakte', listenDiff(vorher, nachher), wer);
  const neueIds = new Map(r.firmen.map(x => [x.id, x]));
  const fertig = await aendereCrm(cur => {
    const da = new Map(cur.firmen.map(x => [x.id, x]));
    // Bestehende: nur ergänzen (von-Hand-Stand gewinnt), neue: anhängen.
    const liste = cur.firmen.map(x => { const n = neueIds.get(x.id); if (!n) return x; const out = { ...n, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined && v !== '')) }; if (!x.rolleVonHand) out.rolle = n.rolle; return out; });
    for (const x of r.firmen) if (!da.has(x.id)) liste.push(x);
    return { ...cur, firmen: liste };
  }, wer);
  return { neu: r.neu, verknuepft: r.verknuepft, ergaenzt: r.ergaenzt, firmen: fertig.firmen.length };
}
