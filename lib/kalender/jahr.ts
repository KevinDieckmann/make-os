// ─── Kalender — Jahr verdichten (29.09., Paket K2, rein, client-sicher) ─────
// Aus den Terminen eines Jahres nur Zähler je Tag und Kalender plus die ganztägigen Einträge — für die Jahresansicht
// (GET /api/kalender/jahr, components/os/kalender/Jahr.tsx). Mehrtägige Termine zählen auf jedem Tag (höchstens 62).

import { tagPlus } from './zeit';

export interface JahrVerdichtet {
  /** Tag → Kalendername → Anzahl Termine. */
  tage: Record<string, Record<string, number>>;
  /** Ganztägige Einträge: erster Tag, letzter Tag (inklusive), Titel, Kalender. */
  ganztags: { von: string; bis: string; titel: string; kalender: string }[];
}

/** Letzter belegter Tag (inklusive): ganztags Ende exklusiv; mit Uhrzeit bis Mitternacht zählt der Vortag. */
export function letzterTag(t: { start: string; ende: string; ganztags: boolean }): string {
  const a = t.start.slice(0, 10), e = t.ende.slice(0, 10);
  const l = t.ganztags || t.ende.slice(11, 16) === '00:00' ? tagPlus(e, -1) : e;
  return l < a ? a : l;
}

export function jahrVerdichten(termine: readonly { start: string; ende: string; ganztags: boolean; titel: string; kalender: string }[], jahr: number): JahrVerdichtet {
  const von = `${jahr}-01-01`, bis = `${jahr}-12-31`;
  const tage: JahrVerdichtet['tage'] = {};
  const ganztags: JahrVerdichtet['ganztags'] = [];
  for (const t of termine) {
    const a = t.start.slice(0, 10), l = letzterTag(t);
    if (l < von || a > bis) continue;
    let tag = a < von ? von : a;
    for (let i = 0; i < 62 && tag <= l && tag <= bis; i++, tag = tagPlus(tag, 1)) {
      const k = (tage[tag] ??= {});
      k[t.kalender] = (k[t.kalender] ?? 0) + 1;
    }
    if (t.ganztags) ganztags.push({ von: a, bis: l, titel: t.titel.slice(0, 120), kalender: t.kalender });
  }
  return { tage, ganztags };
}
