// ─── Kreislauf sehen — die Tageszahlen lesen (30.10., Paket 5; nur Server, schreibt nie) ─────────────────────────────────────────────────────────
// Trägt die vorhandenen Bestände zusammen (Rechnungswesen-Merker, Aufgaben in der Systemsicht, Ereignisse, Läufe des Motors, Weiche der Überführung) und
// rechnet über lib/prozesse/kreislauf-heute.ts. Nur Business: Mandate über die Gesellschaft (`bereichVon`), Aufgaben über ihren Bereich, Ereignisse über
// `bereich`, Läufe ohne verborgene Mandate (Privat-Arbeits-Einheit nur mit Privat-Recht — und auch dann zählt hier nur Business). Jeder Teil für sich
// abgesichert: scheitert er, fehlt seine Zahl (nie eine erfundene Null). Aufgerufen über GET /api/prozesse/laeufe?kreislauf=1 (Tor `werkstattZugang`).

import { localDay } from '@/lib/zeit';
import { kreislaufHeute, type KreislaufHeuteArt, type KreislaufHeuteZeile } from './kreislauf-heute';

async function sicher<T>(f: () => Promise<T>, leer: T): Promise<T> {
  try { return await f(); } catch { return leer; }
}

/** Welche Zeilen ein überführter Teil ersetzt: die Mahnaufgaben (Teil „Mahnaufgaben“ von „Rechnung & Zahlung“). */
const ERSETZBAR: readonly { art: KreislaufHeuteArt; sp: string }[] = [{ art: 'mahn-neu', sp: 'sp-rechnung' }];

export async function kreislaufHeuteLesen(o: { haushalt: string; privat: boolean; jetzt?: Date }): Promise<KreislaufHeuteZeile[]> {
  const jetzt = o.jetzt ?? new Date();
  const heute = localDay(jetzt);
  const [{ kreislaufLaden }, { ladeCrm }, { bereichVon }, { ladeAufgabenSicht }, { ereignisseLaden }, { laeufeLesen }, { verborgeneMandate }] = await Promise.all([
    import('@/lib/finanzen/rechnung/kreislauf'), import('@/lib/crm/speicher'), import('@/lib/einheiten'), import('@/lib/aufgaben/sicht'),
    import('@/lib/ereignisse/server'), import('./lauf-server'), import('@/lib/fulfillment/zugang'),
  ]);
  const [k, crm, tasks, ereignisse, laeufe, verborgen] = await Promise.all([
    sicher(() => kreislaufLaden(), {}),
    sicher(() => ladeCrm(), null),
    sicher(async () => (await ladeAufgabenSicht(null)).tasks, []),
    sicher(async () => (await ereignisseLaden()).eintraege, []),
    sicher(async () => (await laeufeLesen(o.haushalt)).laeufe, []),
    sicher(() => verborgeneMandate(o.privat), new Set<string>()),
  ]);
  const gesellschaft = new Map((crm?.mandate ?? []).map(m => [m.id, m.gesellschaft]));
  // Überführt und scharf: der Werkstatt-Prozess tut die Arbeit — die Zahl bleibt (dieselben Kennungen), dazu „ersetzt durch“.
  const ersetzt: Partial<Record<KreislaufHeuteArt, { prozessId: string; titel: string }>> = {};
  await sicher(async () => {
    const [{ wegFuer }, { prozesseLesen }] = await Promise.all([import('./ueberfuehrung-server'), import('./werkstatt-server')]);
    const eintraege = (await prozesseLesen(o.haushalt)).prozesse;
    for (const { art, sp } of ERSETZBAR) {
      const w = await wegFuer(sp, o.haushalt);
      const e = w.weg === 'neu' && w.prozessId ? eintraege.find(x => x.id === w.prozessId) : undefined;
      if (e) ersetzt[art] = { prozessId: e.id, titel: e.versionen.at(-1)?.definition.titel ?? e.entwurf.titel };
    }
  }, undefined);
  return kreislaufHeute({
    heute, mandatAuto: k.mandatAuto ?? {}, mandatBusiness: id => gesellschaft.has(id) && bereichVon(gesellschaft.get(id)) === 'business',
    tasks, ereignisse, laeufe, verborgen, ersetzt,
  });
}
