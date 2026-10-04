// ─── MAKE OS — Kapazität → Strahl: Überlast als Abweichung (rein, 04.10.2026) ─
// Kevin (04.10.): „Ausschlagen nur, wenn etwas schiefgelaufen ist.“ Eine Woche, in der eine Person mehr verplant hat, als
// belastbar da ist (Stufe `ueber`, lib/kapazitaet/modell.ts `stufeVon`), ist so ein Fall — der Strahl schlägt dort aus.
// Andock-Stelle: lib/lichtfaeden/abweichung.ts › `AbweichungsQuelle`; geladen in lib/lichtfaeden/abweichung-quellen-server.ts.
//
//   Art       `ueberlastet`, `verlauf: 'gleich'` (die Woche gilt in voller Stärke, danach klingt sie aus)
//   Stärke    Überlast = (Bedarf − belastbar) ÷ belastbar, gedeckelt auf 1 (ohne belastbare Zeit: 1)
//   Ort       der Meilenstein bzw. das Ziel, an dem die Person in der Woche arbeitet (ausdrücklich zugeordnet vor „ganzes Team“,
//             früherer Termin zuerst) — über den Pfad seines Strangs im Strahl. Ohne Zuordnung bzw. ohne sichtbaren Strang am
//             Space-Strang Business (die Kapazität rechnet nur Business-Posten).
//   Person    Konto → Speichername; Team-Person ohne Konto → BEIDE (gehört dem Haushalt).
//   Link      die Kapazität, auf die Person gesprungen (`WEG.kapazitaet(person)`) — dort wird umgeplant.
// Privat-Regel: Die Quelle bekommt den Stand NUR über `kapaStandFuer` (serverseitig gefiltert — Erholungswerte anderer Personen
// nie roh) und ordnet nur an Strängen zu, die der Betrachter sehen darf (nie an „Belegt“ oder privaten Strängen einer anderen
// Person). Titel = Name der Person (+ Posten) — beides steht für den Haushalt ohnehin in der Kapazität.

import { WEG } from '@/lib/wege';
import { BEIDE, GESAMT, knotenId, type Strang } from '@/lib/lichtfaeden/modell';
import type { Abweichung, AbweichungsQuelle } from '@/lib/lichtfaeden/abweichung';
import { lastJeWoche } from './last';
import type { KapaStand, Machbarkeit } from './typen';

const KONTO = 'konto-';
const SPACE_PFAD = [GESAMT, knotenId.space('business')] as const;

/** Speichername einer Kapa-Kennung (`konto-<speicher>`) — Team-Personen ohne Konto gehören dem Haushalt (BEIDE). */
export const personVonKapaId = (id: string): string => (id.startsWith(KONTO) && id.length > KONTO.length ? id.slice(KONTO.length) : BEIDE);

/** Überlast einer Woche 0 … 1 (0 = nicht überlastet). */
export function ueberlast(kapa: number, bedarf: number): number {
  if (!(bedarf > 0)) return 0;
  if (!(kapa > 0)) return 1;
  const u = (bedarf - kapa) / kapa;
  return u > 0 ? Math.min(1, Math.round(u * 1000) / 1000) : 0;
}

/** Der Posten, an dem die Person in der Woche (Montag) arbeitet: offen, mit Rest, Termin ab der Woche; zugeordnet vor Team. */
export function postenDerWoche(posten: readonly Machbarkeit[], person: string, woche: string): Machbarkeit | null {
  const offen = posten.filter(p => p.status !== 'erledigt' && (p.rest ?? 0) > 0 && !!p.termin && p.termin >= woche);
  const rang = (p: Machbarkeit) => (p.personen.includes(person) ? 0 : p.personen.length ? 2 : 1);
  const passend = offen.filter(p => rang(p) < 2).sort((a, b) => rang(a) - rang(b) || a.termin!.localeCompare(b.termin!) || a.id.localeCompare(b.id));
  return passend[0] ?? null;
}

/** Pfad im Strahl bis zum Knoten des Postens — nur an Strängen, die der Betrachter sehen darf; sonst null. */
function pfadZumPosten(p: Machbarkeit, straenge: readonly Strang[], betrachter: string): { pfad: string[]; strang?: string } | null {
  const knoten = p.art === 'ziel' ? knotenId.ziel(p.id) : knotenId.meilenstein(p.id);
  const sichtbar = (s: Strang) => s.quelle !== 'belegt' && (!s.privat || s.person === BEIDE || s.person === betrachter);
  const s = straenge.find(x => sichtbar(x) && x.pfad.includes(knoten));
  if (!s) return null;
  const pfad = s.pfad.slice(0, s.pfad.indexOf(knoten) + 1);
  // Am Strang des Postens selbst (Blatt-Ebene) — sonst nur am Knoten.
  return { pfad, ...(s.pfad[s.pfad.length - 1] === knoten ? { strang: s.id } : {}) };
}

/**
 * Die Quelle „überlastet“ aus einem (schon für den Betrachter gefilterten) Kapazitäts-Stand. Je Person und überlasteter Woche
 * im Fenster eine Abweichung.
 */
export function kapazitaetUeberlastet(stand: Pick<KapaStand, 'team' | 'personen' | 'posten'> | null | undefined, betrachter: string): AbweichungsQuelle {
  return k => {
    if (!stand) return [];
    const aus: Abweichung[] = [];
    for (const p of stand.personen) {
      if (p.ohneKapa) continue;
      for (const w of lastJeWoche(stand, { von: k.von, bis: k.bis }, p.id)) {
        if (w.stufe !== 'ueber') continue;
        const staerke = ueberlast(w.kapa, w.bedarf);
        if (!(staerke > 0)) continue;
        const posten = postenDerWoche(stand.posten, p.id, w.woche);
        const ort = posten ? pfadZumPosten(posten, k.straenge, betrachter) : null;
        aus.push({
          id: `ueberlastet:${p.id}:${w.woche}`, art: 'ueberlastet', pfad: ort ? ort.pfad : [...SPACE_PFAD], person: personVonKapaId(p.id),
          von: w.woche, bis: w.bis, staerke, verlauf: 'gleich', titel: `Kapazität ${p.name}${posten && ort ? ` · ${posten.titel}` : ''}`,
          ...(ort?.strang ? { strang: ort.strang } : {}), link: WEG.kapazitaet(p.id),
        });
      }
    }
    return aus;
  };
}
