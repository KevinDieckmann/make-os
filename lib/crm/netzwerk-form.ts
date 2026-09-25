// ─── LinkedIn-Netzwerk — Form und Säubern (ohne Abhängigkeiten) ─────────────
// Steht getrennt von lib/crm/netzwerk.ts, weil die Kontakt-Datei
// (lib/make-one/crm.ts) das Säubern braucht und netzwerk.ts seinerseits die
// Kontakt-Datei — so entsteht kein Import-Kreis.

export type NetzStatus = 'angefragt' | 'vernetzt' | 'abgelehnt' | 'zurueckgezogen';
export const NETZ_STATUS: readonly NetzStatus[] = ['angefragt', 'vernetzt', 'abgelehnt', 'zurueckgezogen'];

/** Stand je LinkedIn-Profil (kevin, malin) an der Person. */
export interface NetzStand {
  status: NetzStatus;
  angefragtAm?: string;
  vernetztAm?: string;
  /** Die Nachricht nach der Annahme ist raus. */
  geschriebenAm?: string;
  kampagneId?: string;
  quelle?: 'hand' | 'export';
}

export type VorlageId = 'erlaubnis' | 'mehrwert' | 'ankuendigung' | 'eigen';
export const VORLAGE_IDS: readonly VorlageId[] = ['erlaubnis', 'mehrwert', 'ankuendigung', 'eigen'];
/** Einstellung einer Vernetzen-Kampagne — modular je Kampagne (Kevin 25.09.). */
export interface VernetzenEinstellung {
  vorlage: VorlageId;
  /** Worum es geht — setzt {thema} in die Texte ein. */
  thema: string;
  /** Text zur Vernetzungsanfrage (leer = ohne Notiz; ohne Premium höchstens 200 Zeichen). */
  notiz: { sie: string; du: string };
  /** Die Nachricht nach der Annahme. */
  nachricht: { sie: string; du: string };
  /** Nach so vielen Tagen ohne Reaktion nachfassen. */
  folgeTage: number;
  /** Neue Anfragen je Profil und Tag. */
  proTag: number;
}

/** Einstellung säubern: Texte begrenzt, Tage und Portion in vernünftigen Grenzen. */
export function vernetzenSaeubern(v: unknown): VernetzenEinstellung | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const text = (x: unknown, n: number) => String(x ?? '').replace(/\u0000/g, '').slice(0, n);
  const paar = (x: unknown, n: number) => { const p = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>; return { sie: text(p.sie, n), du: text(p.du, n) }; };
  const zahl = (x: unknown, min: number, max: number, std: number) => { const z = Math.round(Number(x)); return Number.isFinite(z) ? Math.max(min, Math.min(max, z)) : std; };
  return {
    vorlage: VORLAGE_IDS.includes(o.vorlage as VorlageId) ? (o.vorlage as VorlageId) : 'erlaubnis',
    thema: text(o.thema, 160), notiz: paar(o.notiz, 300), nachricht: paar(o.nachricht, 1500),
    folgeTage: zahl(o.folgeTage, 1, 60, 7), proTag: zahl(o.proTag, 1, 40, 15),
  };
}

/** Stand säubern (für den Speicher): nur bekannte Profile, Status und Tage. */
export function netzwerkSaeubern(v: unknown): Record<string, NetzStand> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const raus: Record<string, NetzStand> = {};
  const tagOk = (x: unknown) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : undefined);
  for (const [p, s] of Object.entries(v as Record<string, Record<string, unknown>>)) {
    if (!/^[a-z0-9-]{1,40}$/.test(p) || !s || !NETZ_STATUS.includes(s.status as NetzStatus)) continue;
    raus[p] = {
      status: s.status as NetzStatus,
      ...(tagOk(s.angefragtAm) ? { angefragtAm: tagOk(s.angefragtAm) } : {}), ...(tagOk(s.vernetztAm) ? { vernetztAm: tagOk(s.vernetztAm) } : {}),
      ...(tagOk(s.geschriebenAm) ? { geschriebenAm: tagOk(s.geschriebenAm) } : {}),
      ...(/^kp-[a-z0-9-]{1,60}$/.test(String(s.kampagneId ?? '')) ? { kampagneId: String(s.kampagneId) } : {}),
      ...(s.quelle === 'export' || s.quelle === 'hand' ? { quelle: s.quelle } : {}),
    };
  }
  return Object.keys(raus).length ? raus : undefined;
}

const zuletzt = (s: NetzStand) => [s.angefragtAm, s.vernetztAm, s.geschriebenAm].filter(Boolean).sort().pop() ?? '';
const RANG: Record<NetzStatus, number> = { angefragt: 0, abgelehnt: 1, zurueckgezogen: 1, vernetzt: 2 };

/**
 * Zwei Stände zusammenführen (Kevin und Malin gleichzeitig, Oberfläche mit
 * älterem Stand): je Profil gewinnt der weitere Schritt — das jüngste Datum,
 * bei Gleichstand der weitere Status. Ein älterer Stand wischt so nie ein
 * „vernetzt“ oder „geschrieben“ weg.
 */
export function netzwerkVereinen(neu?: Record<string, NetzStand>, alt?: Record<string, NetzStand>): Record<string, NetzStand> | undefined {
  if (!neu) return alt;
  if (!alt) return neu;
  const raus: Record<string, NetzStand> = {};
  for (const p of Array.from(new Set([...Object.keys(alt), ...Object.keys(neu)]))) {
    const a = alt[p], n = neu[p];
    if (!a || !n) { raus[p] = (a ?? n)!; continue; }
    const za = zuletzt(a), zn = zuletzt(n);
    raus[p] = zn > za ? n : za > zn ? a : RANG[n.status] >= RANG[a.status] ? n : a;
  }
  return raus;
}
