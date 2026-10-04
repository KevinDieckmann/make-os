// ─── Lichtfäden · angedockte Abweichungs-Quellen (Server, nur lesen, 04.10.2026 abends) ─
// Die EINE Liste, an der weitere Abweichungen andocken (lib/lichtfaeden/abweichung.ts › `AbweichungsQuelle`). Jeder Lader
// liest mit den vorhandenen Lesefunktionen (nie schreiben, nie ein Netzaufruf) und gibt eine REINE Quelle zurück; fehlt ein
// Bestand oder wirft er, fehlt die Quelle einfach. Die Route wendet danach die Privat-Regel an (`abweichungFuerBetrachter`).
//
// Andocken (Muster: Kapazität „überlastet“, lib/kapazitaet/abweichung.ts): in lib/<bereich>/… eine reine Funktion
// `(daten) => AbweichungsQuelle` schreiben (Art `ueberlastet`, Pfad bis zum Space bzw. Ziel, Person, Wochen als von/bis,
// Stärke = Überlast 0 … 1, `verlauf: 'gleich'`, `link` = Ort zum Handeln), hier einen Lader in `LADER` eintragen, Test dazu.

import type { AbweichungsQuelle } from './abweichung';
import { dealsVerschoben } from './abweichung';

type Lader = (betrachter: string, heute: string) => Promise<AbweichungsQuelle | null>;

const LADER: readonly Lader[] = [
  // Deals, deren Entscheidung wiederholt verschoben wurde (Markttraktion).
  async () => {
    const [{ ladeCrm }, { VERSCHOBEN_GELB, OFFENE_STUFEN }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/pipeline')]);
    const crm = await ladeCrm();
    const deals = crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe))
      .map(c => ({ id: c.id, titel: c.titel, erwartetAm: c.erwartetAm, erwartetUrsprung: c.erwartetUrsprung, erwartetVerschoben: c.erwartetVerschoben }));
    return dealsVerschoben(deals, VERSCHOBEN_GELB);
  },
  // Kapazität: Wochen, in denen eine Person überlastet ist (lib/kapazitaet/abweichung.ts). Stand NUR über `kapaStandFuer` —
  // serverseitig für den Betrachter gefiltert (Erholungswerte anderer nie roh), gemerkt 60 s.
  async (betrachter, heute) => {
    const [{ kapaStandFuer }, { kapazitaetUeberlastet }] = await Promise.all([import('@/lib/kapazitaet/server'), import('@/lib/kapazitaet/abweichung')]);
    const { stand } = await kapaStandFuer(betrachter, heute);
    return kapazitaetUeberlastet(stand, betrachter);
  },
];

/** Alle angedockten Quellen für einen Betrachter (gekapselt). */
export async function abweichungsQuellen(betrachter: string, heute: string): Promise<AbweichungsQuelle[]> {
  const q = await Promise.all(LADER.map(l => l(betrachter, heute).catch(() => null)));
  return q.filter((x): x is AbweichungsQuelle => !!x);
}
