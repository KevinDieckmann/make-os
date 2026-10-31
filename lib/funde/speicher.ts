// ─── Funde — der EINE Bestand `kampagne-funde--<haushalt>` (nur Server) ──────────────────────────────────────────────────────
// Schreiben nur über `aendereFunde` (eine Sperre, Säuberung beim Lesen und Schreiben, Änderungsprotokoll ohne Werte). Haushalt = der Haushalt
// des Inhabers (wie die Kartei, `karteiHaushalt`). Nie kürzen: über der Grenze → `FundeFehler` 413.

import { createHash } from 'node:crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { karteiHaushalt } from '@/lib/crm/sperrliste';
import { leererBestand, leereEinstellungen, istFundBranche, JE_ABEND_MAX, JE_ABEND_VORGABE, type Fund, type FundeBestand, type FundeEinstellungen } from './typen';

export const fundeName = (h: string): string => `kampagne-funde--${h}`;
export const fundeHaushalt = (): Promise<string> => karteiHaushalt();

/** Höchstens so viele Funde gleichzeitig (übernommene/alte räumt die Frist) — darüber lehnt der Lauf ab, statt zu kürzen. */
export const FUNDE_MAX = 3000;
/** Bekannte OSM-Kennungen (verworfen/gesperrt) — älteste fallen nie still weg; über der Grenze → 413. */
export const BEKANNT_MAX = 50_000;

export class FundeFehler extends Error {
  constructor(public status: 400 | 403 | 404 | 409 | 413 | 503, text: string) { super(text); }
}

const txt = (v: unknown, n: number): string | undefined => (typeof v === 'string' && v.trim() ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : undefined);

/** Einstellungen säubern (Form, Grenzen) — Unbekanntes fällt weg, nie ein Wert erfunden. */
export function einstellungenSaeubern(roh: unknown): FundeEinstellungen {
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  const e = leereEinstellungen();
  const r = o.eigenesRisiko as Record<string, unknown> | undefined;
  if (r && r.an === true && typeof r.seit === 'string' && typeof r.von === 'string') e.eigenesRisiko = { an: true, seit: r.seit.slice(0, 40), von: r.von.slice(0, 60) };
  const a = o.absender as Record<string, unknown> | undefined;
  if (a && typeof a.person === 'string' && typeof a.postfach === 'string') e.absender = { person: a.person.slice(0, 60), postfach: a.postfach.slice(0, 80) };
  const stadt = txt(o.stadt, 80);
  if (stadt) e.stadt = stadt;
  e.gebiete = Array.isArray(o.gebiete) ? [...new Set(o.gebiete.map(x => txt(x, 80)).filter((x): x is string => !!x))].slice(0, 60) : [];
  e.gebietIndex = Number.isInteger(o.gebietIndex) && (o.gebietIndex as number) >= 0 ? o.gebietIndex as number : 0;
  const b = Array.isArray(o.branchen) ? o.branchen.filter(istFundBranche) : null;
  if (b) e.branchen = [...new Set(b)];
  const j = Number(o.jeAbend);
  e.jeAbend = Number.isInteger(j) && j >= 1 && j <= JE_ABEND_MAX ? j : JE_ABEND_VORGABE;
  const k = txt(o.kampagneId, 80), s = txt(o.segmentId, 80);
  if (k) e.kampagneId = k;
  if (s) e.segmentId = s;
  const g = txt(o.gesellschaft, 60), p = txt(o.produktId, 80);
  const arten = Array.isArray(o.arten) ? [...new Set(o.arten.filter((x): x is string => typeof x === 'string' && /^[a-z_]{2,40}$/.test(x)))].slice(0, 20) : [];
  if (arten.length) e.arten = arten;
  if (o.nurMitMail === true) e.nurMitMail = true;
  if (g) e.gesellschaft = g;
  if (p) e.produktId = p;
  return e;
}

function bestandSaeubern(roh: unknown): FundeBestand {
  const o = roh && typeof roh === 'object' ? roh as Partial<FundeBestand> : {};
  return {
    funde: Array.isArray(o.funde) ? o.funde.filter((f): f is Fund => !!f && typeof f === 'object' && typeof f.id === 'string' && typeof f.name === 'string') : [],
    einstellungen: einstellungenSaeubern(o.einstellungen),
    bekannt: Array.isArray(o.bekannt) ? o.bekannt.filter((x): x is string => typeof x === 'string') : [],
    ...(o.lauf && typeof o.lauf === 'object' ? { lauf: o.lauf } : {}),
  };
}

export async function ladeFunde(h?: string): Promise<FundeBestand> {
  const name = fundeName(h ?? await fundeHaushalt());
  const roh = await loadJson<FundeBestand>(name);
  return roh ? bestandSaeubern(roh) : leererBestand();
}

/** In EINER Sperre ändern. `fn` darf `FundeFehler` werfen (nichts gespeichert). Protokoll: nur Kennungen + Feldnamen. */
export async function aendereFunde(fn: (b: FundeBestand) => FundeBestand, o: { h?: string; wer?: Wer } = {}): Promise<FundeBestand> {
  const name = fundeName(o.h ?? await fundeHaushalt());
  let vorher: FundeBestand = leererBestand();
  const neu = await updateJson<FundeBestand>(name, cur => {
    vorher = cur ? bestandSaeubern(cur) : leererBestand();
    const n = fn(structuredClone(vorher));
    if (n.funde.length > FUNDE_MAX) throw new FundeFehler(413, `Mehr als ${FUNDE_MAX} Funde gleichzeitig — erst übernehmen oder verwerfen. Nichts gespeichert.`);
    if (n.bekannt.length > BEKANNT_MAX) throw new FundeFehler(413, 'Zu viele bekannte Einträge — bitte melden. Nichts gespeichert.');
    return { ...n, einstellungen: einstellungenSaeubern(n.einstellungen) };
  });
  if (o.wer) {
    const alt = new Map(vorher.funde.map(f => [f.id, f] as const));
    const aend = neu.funde.filter(f => alt.get(f.id)?.geaendert !== f.geaendert).map(f => ({ liste: 'funde', op: alt.has(f.id) ? 'geaendert' as const : 'neu' as const, id: f.id, felder: ['status'] }));
    const weg = vorher.funde.filter(f => !neu.funde.some(x => x.id === f.id)).map(f => ({ liste: 'funde', op: 'geloescht' as const, id: f.id }));
    if (aend.length || weg.length) await protokolliere(name, [...aend, ...weg] as never, o.wer).catch(() => { /* nur Protokoll */ });
  }
  return neu;
}

/** Fingerabdruck des öffentlichen Vorschau-Tokens (nie das Token selbst im Bestand). */
export const vorschauTokenHash = (token: string): string => createHash('sha256').update(`make-os-fund-vorschau|${token}`).digest('hex');

/** Sicht für den Browser: ohne Token-Fingerabdruck. */
export function fundSicht(f: Fund): Fund {
  if (!f.vorschau?.tokenHash) return f;
  const { tokenHash: _t, ...v } = f.vorschau;
  return { ...f, vorschau: v };
}
