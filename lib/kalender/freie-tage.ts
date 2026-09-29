// ─── Kalender — „frei, aber nicht gesetzlich“ (rein, client-sicher, R-K2 #72, 29.09.) ─
// Heiligabend und Silvester sind in NRW keine Feiertage (lib/aufgaben/feiertage.ts bleibt richtig ohne sie) — frei
// sind sie trotzdem. Diese Liste steht getrennt in den Kalender-Einstellungen (`freieTage`, einstellbar) und sperrt
// die Buchungsseite und die freie-Zeit-Suche (lib/kalender/freie-zeit.ts) wie ein Feiertag. Jahresunabhängig: „MM-TT“.

export interface FreierTag { tag: string; name: string }

/** Standard: Heiligabend und Silvester. */
export const FREIE_TAGE_STANDARD: readonly FreierTag[] = [{ tag: '12-24', name: 'Heiligabend' }, { tag: '12-31', name: 'Silvester' }];
/** Höchstens so viele Einträge. */
export const FREIE_TAGE_MAX = 20;

const MMTT = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TAGE_IM_MONAT = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Liste säubern: gültige „MM-TT“ (29.02. erlaubt), Name bis 40 Zeichen, ohne Doppelte, sortiert. Kein Array → Standard. */
export function freieTageSauber(roh: unknown): FreierTag[] {
  if (!Array.isArray(roh)) return [...FREIE_TAGE_STANDARD];
  const raus = new Map<string, FreierTag>();
  for (const x of roh.slice(0, FREIE_TAGE_MAX * 2)) {
    const tag = typeof x?.tag === 'string' ? x.tag.trim() : '';
    const m = MMTT.exec(tag);
    if (!m || Number(m[2]) > TAGE_IM_MONAT[Number(m[1]) - 1]) continue;
    const name = typeof x?.name === 'string' ? x.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
    if (!raus.has(tag)) raus.set(tag, { tag, name: name || 'frei' });
  }
  return Array.from(raus.values()).sort((a, b) => a.tag.localeCompare(b.tag)).slice(0, FREIE_TAGE_MAX);
}

/** Die freien Tage in [von, bis) als Tag → Name (Berliner Tage „YYYY-MM-DD“). */
export function freieTageIm(von: string, bis: string, liste: readonly FreierTag[]): Record<string, string> {
  const raus: Record<string, string> = {};
  if (!liste.length || bis <= von) return raus;
  for (let j = Number(von.slice(0, 4)); j <= Number(bis.slice(0, 4)); j++) {
    for (const f of liste) {
      const tag = `${j}-${f.tag}`;
      // 29.02. nur in Schaltjahren
      if (f.tag === '02-29' && !(j % 4 === 0 && (j % 100 !== 0 || j % 400 === 0))) continue;
      if (tag >= von && tag < bis) raus[tag] = f.name;
    }
  }
  return raus;
}
