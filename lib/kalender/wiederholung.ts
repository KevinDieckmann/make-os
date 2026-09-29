// ─── Kalender — Wiederholung (rein, getestet, 27.09. / voll seit 29.09., K1) ─
// Wie Google Kalender: „Wiederholt sich nicht“, Vorlagen aus dem Starttag
// („Wöchentlich am Dienstag“, „Monatlich am 4. Dienstag“, „Jährlich am 29. September“,
// „Jeden Werktag“) und „Benutzerdefiniert“: alle n Tage/Wochen/Monate/Jahre, Wochentage,
// im Monat am Tag n, am letzten Tag oder am n-ten Wochentag, Ende nie / am Datum / nach Anzahl.
// Client- und serversicher (ohne ical.js). Den iCalendar-Text baut `rruleText`.

export type WiederholungFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type Wochentag = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
export const WOCHENTAGE: readonly Wochentag[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
/** Serie wie Google Kalender. `monatstag` -1 = letzter Tag des Monats; `wochentagImMonat.nr` -1 = der letzte. */
export interface Wiederholung {
  freq: WiederholungFreq;
  intervall?: number;
  anzahl?: number;
  bis?: string;
  tage?: Wochentag[];
  monatstag?: number;
  wochentagImMonat?: { nr: 1 | 2 | 3 | 4 | 5 | -1; tag: Wochentag };
}

const TAG_LANG: Record<Wochentag, string> = { MO: 'Montag', TU: 'Dienstag', WE: 'Mittwoch', TH: 'Donnerstag', FR: 'Freitag', SA: 'Samstag', SU: 'Sonntag' };
export const TAG_KURZ: Record<Wochentag, string> = { MO: 'Mo', TU: 'Di', WE: 'Mi', TH: 'Do', FR: 'Fr', SA: 'Sa', SU: 'So' };
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Wochentag eines Tages (YYYY-MM-DD). */
export function wochentagVon(tag: string): Wochentag {
  const d = new Date(`${tag}T12:00:00Z`).getUTCDay();
  return WOCHENTAGE[(d + 6) % 7];
}
const tageImMonat = (tag: string) => new Date(Date.UTC(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)), 0)).getUTCDate();
/** Der wievielte Wochentag im Monat (1–5) und ob es der letzte ist. */
export function wochentagNr(tag: string): { nr: 1 | 2 | 3 | 4 | 5; letzter: boolean } {
  const t = Number(tag.slice(8, 10));
  return { nr: Math.ceil(t / 7) as 1 | 2 | 3 | 4 | 5, letzter: t + 7 > tageImMonat(tag) };
}

/** RRULE-Text (ohne „RRULE:“). Ganztägige Serien enden mit UNTIL als Datum (RFC 5545: gleicher Typ wie DTSTART). */
export function rruleText(w: Wiederholung, ganztags = false): string {
  const teile = [`FREQ=${w.freq}`];
  if (w.intervall && w.intervall > 1) teile.push(`INTERVAL=${Math.min(365, Math.round(w.intervall))}`);
  if (w.freq === 'WEEKLY' && w.tage?.length) teile.push(`BYDAY=${WOCHENTAGE.filter(t => w.tage!.includes(t)).join(',')}`);
  if (w.freq === 'MONTHLY') {
    if (w.wochentagImMonat) teile.push(`BYDAY=${w.wochentagImMonat.nr}${w.wochentagImMonat.tag}`);
    else if (w.monatstag) teile.push(`BYMONTHDAY=${w.monatstag}`);
  }
  if (w.anzahl && w.anzahl > 0) teile.push(`COUNT=${Math.min(999, Math.round(w.anzahl))}`);
  else if (w.bis && TAG.test(w.bis)) teile.push(ganztags ? `UNTIL=${w.bis.replace(/-/g, '')}` : `UNTIL=${w.bis.replace(/-/g, '')}T215959Z`);
  return teile.join(';');
}

/** Eine Wiederholung von außen (Route) säubern — null = keine gültige. */
export function wiederholungSauber(v: unknown): Wiederholung | null {
  if (!v || typeof v !== 'object') return null;
  const w = v as Record<string, unknown>;
  const freq = (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).find(f => f === w.freq);
  if (!freq) return null;
  const n = (x: unknown) => Math.round(Number(x));
  const raus: Wiederholung = { freq };
  if (n(w.intervall) > 1) raus.intervall = Math.min(365, n(w.intervall));
  if (n(w.anzahl) > 0) raus.anzahl = Math.min(999, n(w.anzahl));
  else if (typeof w.bis === 'string' && TAG.test(w.bis)) raus.bis = w.bis;
  if (freq === 'WEEKLY' && Array.isArray(w.tage)) {
    const tage = WOCHENTAGE.filter(t => (w.tage as unknown[]).includes(t));
    if (tage.length) raus.tage = tage;
  }
  if (freq === 'MONTHLY') {
    const wim = w.wochentagImMonat && typeof w.wochentagImMonat === 'object' ? w.wochentagImMonat as Record<string, unknown> : null;
    const nr = wim ? n(wim.nr) : NaN;
    if (wim && [1, 2, 3, 4, 5, -1].includes(nr) && WOCHENTAGE.includes(wim.tag as Wochentag)) raus.wochentagImMonat = { nr: nr as 1 | 2 | 3 | 4 | 5 | -1, tag: wim.tag as Wochentag };
    else if (n(w.monatstag) === -1 || (n(w.monatstag) >= 1 && n(w.monatstag) <= 31)) raus.monatstag = n(w.monatstag);
  }
  return raus;
}

const nrText = (nr: number) => (nr === -1 ? 'letzten' : `${nr}.`);
const datumText = (tag: string) => `${Number(tag.slice(8, 10))}.${Number(tag.slice(5, 7))}.${tag.slice(0, 4)}`;

/** In Worten wie Google: „Wöchentlich am Dienstag“, „Alle 2 Wochen am Mo, Mi, 10-mal“, „Monatlich am letzten Tag“. */
export function wiederholungBeschreiben(w: Wiederholung, starttag: string): string {
  const i = w.intervall && w.intervall > 1 ? w.intervall : 1;
  let s: string;
  if (w.freq === 'DAILY') s = i > 1 ? `Alle ${i} Tage` : 'Täglich';
  else if (w.freq === 'WEEKLY') {
    const tage = w.tage?.length ? w.tage : [wochentagVon(starttag)];
    const werktage = tage.length === 5 && ['MO', 'TU', 'WE', 'TH', 'FR'].every(t => tage.includes(t as Wochentag));
    const liste = werktage ? 'Werktagen (Mo–Fr)' : tage.length === 1 ? TAG_LANG[tage[0]] : tage.map(t => TAG_KURZ[t]).join(', ');
    s = i > 1 ? `Alle ${i} Wochen am ${liste}` : werktage ? 'Jeden Werktag (Mo–Fr)' : `Wöchentlich am ${liste}`;
  } else if (w.freq === 'MONTHLY') {
    const wo = w.wochentagImMonat;
    const am = wo ? `am ${nrText(wo.nr)} ${TAG_LANG[wo.tag]}` : w.monatstag === -1 ? 'am letzten Tag' : `am ${w.monatstag ?? Number(starttag.slice(8, 10))}.`;
    s = i > 1 ? `Alle ${i} Monate ${am}` : `Monatlich ${am}`;
  } else {
    const am = `am ${Number(starttag.slice(8, 10))}. ${MONATE[Number(starttag.slice(5, 7)) - 1]}`;
    s = i > 1 ? `Alle ${i} Jahre ${am}` : `Jährlich ${am}`;
  }
  if (w.anzahl) s += `, ${w.anzahl}-mal`;
  else if (w.bis) s += `, bis ${datumText(w.bis)}`;
  return s;
}

export interface WiederholungVorlage { id: string; label: string; w: Wiederholung | null }
/** Die Auswahl „Wiederholt sich nicht ▾“ wie bei Google — aus dem Starttag. `eigen` = Benutzerdefiniert. */
export function wiederholungVorlagen(starttag: string): WiederholungVorlage[] {
  const tag = wochentagVon(starttag);
  const { nr, letzter } = wochentagNr(starttag);
  const monatstag = Number(starttag.slice(8, 10));
  const liste: (Wiederholung | null)[] = [
    null,
    { freq: 'DAILY' },
    { freq: 'WEEKLY', tage: [tag] },
    { freq: 'MONTHLY', wochentagImMonat: { nr, tag } },
    ...(letzter && nr !== 5 ? [{ freq: 'MONTHLY', wochentagImMonat: { nr: -1, tag } } as Wiederholung] : []),
    ...(nr === 5 ? [{ freq: 'MONTHLY', wochentagImMonat: { nr: -1, tag } } as Wiederholung] : []),
    { freq: 'MONTHLY', monatstag },
    ...(monatstag === tageImMonat(starttag) ? [{ freq: 'MONTHLY', monatstag: -1 } as Wiederholung] : []),
    { freq: 'YEARLY' },
    { freq: 'WEEKLY', tage: ['MO', 'TU', 'WE', 'TH', 'FR'] },
  ];
  // Der 5. Wochentag gibt es nicht in jedem Monat — dann bleibt nur „am letzten“.
  const ohne5 = liste.filter(w => !(w?.wochentagImMonat?.nr === 5));
  return [
    ...ohne5.map((w, i) => ({ id: w ? `v${i}` : 'keine', label: w ? wiederholungBeschreiben(w, starttag) : 'Wiederholt sich nicht', w })),
    { id: 'eigen', label: 'Benutzerdefiniert …', w: null },
  ];
}
