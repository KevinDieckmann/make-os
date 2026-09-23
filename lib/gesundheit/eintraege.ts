// ─── MAKE OS — Gesundheit: die Einträge und ihre Regeln ─────────────────────
// Kevin, 23.09.: „Gesundheit ist die Basis, deswegen bauen wir ihn zuerst."
//
// Drei Bestände, die es bis heute nicht gab, obwohl Kevin sie am 29.07. als
// seine Hebel genannt hat:
//   · das Haut-Tagebuch (Schuppenflechte: Juckreiz, Schub, Auslöser)
//   · der Streak (Cannabis-Schnitt: sauber ja/nein, Verlangen)
//   · die Routinen-Quoten je Hebel (Essen, Reha, Supplements)
//
// Alles hier ist reine Logik, damit vitest sie prüft. Kein Speicherzugriff,
// keine Zeit aus der Uhr — beides kommt von außen herein.
//
// Haltung, wörtlich aus dem Profil: Struktur und Tracking, keine ärztliche
// Beratung. Beim Streak: unterstützend, nie wertend. Ein Rückfall ist ein
// Datum, kein Urteil.

export interface HautTag {
  /** 0 = nichts, 10 = unerträglich. */
  juckreiz: number;
  schub: boolean;
  stellen?: string[];
  ausloeser?: string;
  notiz?: string;
  at: string;
}
export type HautLog = Record<string, HautTag>;

export interface StreakTag {
  sauber: boolean;
  /** 0 = kein Verlangen, 10 = kaum auszuhalten. */
  craving?: number;
  notiz?: string;
  at: string;
}
export type StreakLog = Record<string, StreakTag>;

/** Das Routinen-Log der Software: Tag → erledigte Routine-IDs. */
export type RoutinenLog = Record<string, string[]>;

const num = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v);
  return isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : undefined;
};
const txt = (v: unknown, n: number) => { const t = String(v ?? '').trim().slice(0, n); return t || undefined; };

export function saeubereHaut(e: unknown, at: string): HautTag | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  const juckreiz = num(o.juckreiz, 0, 10);
  if (juckreiz === undefined) return null;
  const stellen = Array.isArray(o.stellen) ? (o.stellen as unknown[]).map(s => String(s).trim().slice(0, 40)).filter(Boolean).slice(0, 12) : undefined;
  return {
    juckreiz,
    schub: o.schub === true || String(o.schub).toLowerCase() === 'ja' || juckreiz >= 7,
    ...(stellen?.length ? { stellen } : {}),
    ...(txt(o.ausloeser, 200) ? { ausloeser: txt(o.ausloeser, 200) } : {}),
    ...(txt(o.notiz, 600) ? { notiz: txt(o.notiz, 600) } : {}),
    at,
  };
}

export function saeubereStreak(e: unknown, at: string): StreakTag | null {
  if (!e || typeof e !== 'object') return null;
  const o = e as Record<string, unknown>;
  if (typeof o.sauber !== 'boolean') return null;
  const craving = num(o.craving, 0, 10);
  return { sauber: o.sauber, ...(craving !== undefined ? { craving } : {}), ...(txt(o.notiz, 600) ? { notiz: txt(o.notiz, 600) } : {}), at };
}

/** Die letzten n Tage als Schlüssel, heute zuerst. */
export function tageZurueck(heute: string, n: number): string[] {
  const raus: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(`${heute}T12:00:00`);
    d.setDate(d.getDate() - i);
    raus.push(d.toISOString().slice(0, 10));
  }
  return raus;
}

const mittel = (l: number[]) => (l.length ? Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10 : undefined);

export interface HautTrend {
  /** Einträge in den letzten 30 Tagen. */
  tage: number;
  heute?: number;
  juckreiz7?: number;
  juckreiz30?: number;
  schuebe30: number;
  /** Vergleich der letzten 7 mit den 7 davor. */
  richtung: 'besser' | 'schlechter' | 'gleich' | 'unbekannt';
  /** Auslöser, die in 30 Tagen genannt wurden — der häufigste zuerst. */
  ausloeser: { was: string; mal: number }[];
}

/**
 * Was die Haut über einen Monat erzählt. Für Kevin beim Hautarzt und für
 * Jarvis, der den Zusammenhang Stress → Kratzen → Schub sichtbar machen soll.
 */
export function hautTrend(log: HautLog, heute: string): HautTrend {
  const t30 = tageZurueck(heute, 30);
  const t7 = t30.slice(0, 7);
  const t7davor = t30.slice(7, 14);
  const w = (tage: string[]) => tage.map(d => log[d]?.juckreiz).filter((x): x is number => typeof x === 'number');
  const j7 = mittel(w(t7)), jDavor = mittel(w(t7davor));
  let richtung: HautTrend['richtung'] = 'unbekannt';
  if (j7 !== undefined && jDavor !== undefined) richtung = j7 < jDavor - 0.4 ? 'besser' : j7 > jDavor + 0.4 ? 'schlechter' : 'gleich';
  const zaehl = new Map<string, number>();
  for (const d of t30) { const a = log[d]?.ausloeser?.toLowerCase().trim(); if (a) zaehl.set(a, (zaehl.get(a) ?? 0) + 1); }
  return {
    tage: t30.filter(d => log[d]).length,
    heute: log[heute]?.juckreiz,
    juckreiz7: j7,
    juckreiz30: mittel(w(t30)),
    schuebe30: t30.filter(d => log[d]?.schub).length,
    richtung,
    ausloeser: Array.from(zaehl.entries()).map(([was, mal]) => ({ was, mal })).sort((a, b) => b.mal - a.mal).slice(0, 5),
  };
}

export interface StreakStand {
  /** Tage seit dem letzten Rückfall — nur, wenn es in den letzten 3 Tagen einen Eintrag gab. */
  sauberTage: number;
  letzterRueckfall?: string;
  /** false, wenn seit über 3 Tagen nichts eingetragen wurde: dann wissen wir es nicht. */
  aktuell: boolean;
  craving7?: number;
  eintraege30: number;
}

/**
 * Der Streak zählt Tage seit dem letzten Rückfall — nicht Tage mit Eintrag.
 * Wer einen Abend vergisst zu antworten, verliert nicht seinen Zähler. Aber
 * wer drei Tage nichts sagt, bekommt keinen Zähler mehr angezeigt, sondern
 * eine Frage. Das ist der Unterschied zwischen Unterstützung und Kontrolle.
 */
export function streakStand(log: StreakLog, heute: string): StreakStand {
  const tage = Object.keys(log).filter(d => d <= heute).sort();
  const eintraege30 = tageZurueck(heute, 30).filter(d => log[d]).length;
  if (!tage.length) return { sauberTage: 0, aktuell: false, eintraege30: 0 };
  const letzterEintrag = tage[tage.length - 1];
  const aktuell = tageZurueck(heute, 3).includes(letzterEintrag);
  const rueckfaelle = tage.filter(d => log[d].sauber === false);
  const letzterRueckfall = rueckfaelle[rueckfaelle.length - 1];
  const start = letzterRueckfall ?? tage[0];
  const von = new Date(`${start}T12:00:00`), bis = new Date(`${heute}T12:00:00`);
  const diff = Math.round((bis.getTime() - von.getTime()) / 864e5);
  const sauberTage = letzterRueckfall ? Math.max(0, diff) : diff + 1;
  const c7 = tageZurueck(heute, 7).map(d => log[d]?.craving).filter((x): x is number => typeof x === 'number');
  return { sauberTage: aktuell ? sauberTage : 0, ...(letzterRueckfall ? { letzterRueckfall } : {}), aktuell, craving7: mittel(c7), eintraege30 };
}

/** Anteil der Tage in den letzten n, an denen ALLE genannten Routinen abgehakt waren. */
export function routineQuote(log: RoutinenLog, ids: string[], heute: string, n = 7): { quote: number; tage: number } {
  const t = tageZurueck(heute, n);
  const voll = t.filter(d => ids.every(id => (log[d] ?? []).includes(id))).length;
  return { quote: t.length ? voll / t.length : 0, tage: t.filter(d => (log[d] ?? []).length).length };
}

/** Routine-ID aus einem Zuruf: „Reha", „Supplements genommen", „gelesen" → id. */
export function routineAusZuruf(zuruf: string, routinen: { id: string; label: string }[]): string | undefined {
  const z = zuruf.toLowerCase().trim();
  if (!z) return undefined;
  const direkt = routinen.find(r => r.id === z);
  if (direkt) return direkt.id;
  const w = z.split(/\s+/)[0].replace(/[^a-zäöüß]/g, '');
  return routinen.find(r => r.label.toLowerCase().includes(z))?.id
    ?? routinen.find(r => r.id.startsWith(w) || r.label.toLowerCase().startsWith(w))?.id;
}
