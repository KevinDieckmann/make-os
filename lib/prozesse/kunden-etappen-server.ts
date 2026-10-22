// ─── Prozesse × Fulfillment — Etappen eines Mandats aus den Läufen (Server, 22.10.; Regeln: lib/prozesse/kunden-etappen.ts) ──────────────────────────────
// Liest NUR (Bestände `prozess-laeufe--<h>` und `prozesse--<h>`), schreibt nie: die scharfen Läufe mit Fall = dieses Mandat und die Version, auf der sie laufen.
// Aufgerufen von der Kunden-Sicht (lib/fulfillment/kunde/server.ts `sichtFuer`), nur wenn das Mandat KEINEN Fall des Fulfillments hat. Wirft nie (null).

import type { KundenEtappen } from './kunden-etappen';

export async function kundenEtappenFuer(mandatId: string): Promise<KundenEtappen | null> {
  try {
    const [{ laeufeLesen }, { prozesseLesen }, { kundenEtappen }] = await Promise.all([import('./lauf-server'), import('./werkstatt-server'), import('./kunden-etappen')]);
    const [d, p] = await Promise.all([laeufeLesen(), prozesseLesen()]);
    const paare = d.laeufe
      .filter(l => l.fall.art === 'mandat' && l.fall.id === mandatId && l.modus === 'scharf' && l.status !== 'abgebrochen')
      .map(l => ({ lauf: l, def: p.prozesse.find(x => x.id === l.prozessId)?.versionen.find(v => v.nr === l.version)?.definition }))
      .filter((x): x is { lauf: typeof x.lauf; def: NonNullable<typeof x.def> } => !!x.def);
    return paare.length ? kundenEtappen(paare) : null;
  } catch {
    return null;
  }
}
