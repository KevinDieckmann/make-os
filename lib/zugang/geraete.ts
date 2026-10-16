// ─── MAKE OS — Gerät merken für den zweiten Faktor (16.10.) ─────────────────
// Kevin 16.10.: der Code bei JEDER Anmeldung „nervt mega, die Software ist gerade nur für uns“. Seitdem fragt die Anmeldung je
// Gerät nur EINMAL nach dem Code: nach Passwort + Code (oder Wiederherstellungscode) mit „Dieses Gerät 90 Tage merken“ bekommt der
// Browser ein eigenes Cookie (GERAET_COOKIE, HttpOnly, SameSite=Strict) mit einem zufälligen Token (32 Byte). Danach genügt dort
// das Passwort — 90 Tage ab dem Merken (fest, ein Benutzen verlängert nicht). Ein gestohlenes Passwort reicht auf einem fremden
// Gerät weiter nicht; das Cookie allein ist keine Sitzung (die Middleware liest es nie).
//
// Am Konto liegt nur der HASH: HMAC-SHA256 mit dem Sitzungsgeheimnis über Konto-Kennung, Geräte-Kennung, Passwort-Stand
// (Fingerabdruck des Salzes), Beginn des zweiten Faktors und Token. Er steht IM zweiten Faktor (`zweiterFaktor.geraete`):
//   · zweiten Faktor neu einrichten oder ausschalten ersetzt bzw. entfernt das Objekt → alle Geräte sind weg — auch im alten
//     Stand (Rückweg), der das Feld nicht kennt und es beim Anmelden mit `{ ...zweiterFaktor, letzteStufe }` nur mitträgt;
//   · `oeffentlich()` (alt wie neu) und der Instanz-Export lassen `zweiterFaktor` ganz weg — der Hash geht nie an den Browser.
// Passwort ändern → neuer Stand → kein Hash passt mehr (die Route leert die Liste zusätzlich).
// Höchstens MAX_GERAETE je Konto (das älteste fällt bei einem neuen heraus), je Browser höchstens MAX_COOKIE_EINTRAEGE Konten
// (ein Gerät für zwei Personen). Ein falsches, fremdes oder abgelaufenes Token führt still zur Codeabfrage — nie ein Hinweis.
// Rein bis auf Zufall und Uhr; Schreibwege in geraete-server.ts (nur über `aendereKonten`).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextResponse } from 'next/server';
import { GERAET_COOKIE, cookieNurHttps, sitzungsGeheimnis } from './sitzung';

/** Wie lange ein gemerktes Gerät gilt (ab dem Merken). */
export const GERAET_TAGE = 90;
/** Höchstens so viele gemerkte Geräte je Konto — das älteste fällt bei einem neuen heraus. */
export const MAX_GERAETE = 10;
/** Höchstens so viele Konten je Browser-Cookie (geteiltes Gerät). */
export const MAX_COOKIE_EINTRAEGE = 5;

export interface GemerktesGeraet {
  /** Zufällige Kennung `g-<16 hex>` — steht im Anmeldeprotokoll, ist kein Geheimnis. */
  id: string;
  /** HMAC-SHA256 (hex) — nie in Antworten, Logs oder Protokollen. */
  hash: string;
  /** Passwort-Stand beim Merken (Fingerabdruck des Salzes, wie in der Sitzung) — anderes Passwort, Gerät ungültig. */
  stand: string;
  angelegt: string;
  zuletzt: string;
  /** Ablauf (ISO) = angelegt + GERAET_TAGE. */
  bis: string;
  /** Grob aus dem User-Agent („Safari · Mac“) — nie die IP. */
  beschreibung: string;
}
/** Was die Person über ihre Geräte sieht. */
export type GeraetOeffentlich = Pick<GemerktesGeraet, 'id' | 'beschreibung' | 'angelegt' | 'zuletzt' | 'bis'>;
/** Ein Eintrag im Cookie: Kennung + Token. */
export interface CookieEintrag { id: string; token: string }

const ID = /^g-[a-f0-9]{16}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const HASH = /^[a-f0-9]{64}$/;
const STAND = /^[a-f0-9]{12}$/;
/** Vergleichswert, wenn die Kennung unbekannt ist — dieselbe Arbeit, damit die Zeit nichts verrät. */
const BLIND = '0'.repeat(64);

// ── Gerät beschreiben ────────────────────────────────────────────────────────

/** „Safari · Mac“, „Chrome · Android“ … aus dem User-Agent. Grob genug, um das eigene Gerät zu erkennen; nie die IP. */
export function geraetBeschreibung(ua: string | null | undefined): string {
  const u = String(ua ?? '').slice(0, 512);
  const browser = /Edg(e|A|iOS)?\//.test(u) ? 'Edge'
    : /OPR\/|Opera/.test(u) ? 'Opera'
    : /Firefox\/|FxiOS\//.test(u) ? 'Firefox'
    : /Chrome\/|CriOS\/|Chromium\//.test(u) ? 'Chrome'
    : /Safari\//.test(u) ? 'Safari' : 'Browser';
  const system = /iPhone/.test(u) ? 'iPhone'
    : /iPad/.test(u) ? 'iPad'
    : /Android/.test(u) ? 'Android'
    : /Macintosh|Mac OS X/.test(u) ? 'Mac'
    : /Windows/.test(u) ? 'Windows'
    : /CrOS/.test(u) ? 'ChromeOS'
    : /Linux/.test(u) ? 'Linux' : 'unbekanntes System';
  return `${browser} · ${system}`;
}

// ── Cookie ───────────────────────────────────────────────────────────────────

/** Cookie-Wert → Einträge (nur gültige Form, ohne Doppelte, höchstens MAX_COOKIE_EINTRAEGE). Alles andere fällt still weg. */
export function cookieEintraegeLesen(roh: string | null | undefined): CookieEintrag[] {
  if (!roh || roh.length > 1000) return [];
  const aus: CookieEintrag[] = [];
  for (const teil of roh.split('~').slice(0, MAX_COOKIE_EINTRAEGE)) {
    const [id, token, ...rest] = teil.split('.');
    if (rest.length || !ID.test(id ?? '') || !TOKEN.test(token ?? '')) continue;
    if (!aus.some(e => e.id === id)) aus.push({ id, token });
  }
  return aus;
}
export const cookieEintraegeText = (e: readonly CookieEintrag[]): string => e.map(x => `${x.id}.${x.token}`).join('~');

/** Die Einträge des Geräte-Cookies einer Anfrage (ohne Cookie: leer). */
export function cookieAusAnfrage(req: Request): CookieEintrag[] {
  const teil = (req.headers.get('cookie') ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(`${GERAET_COOKIE}=`));
  if (!teil) return [];
  try { return cookieEintraegeLesen(decodeURIComponent(teil.slice(GERAET_COOKIE.length + 1))); } catch { return []; }
}

/** Geräte-Cookie in die Antwort (leer → löschen). HttpOnly, SameSite=Strict, Pfad /, secure wie die Sitzung, 90 Tage. */
export function geraetCookieSetzen(res: NextResponse, eintraege: readonly CookieEintrag[]): void {
  const basis = { httpOnly: true, sameSite: 'strict' as const, path: '/', secure: cookieNurHttps() };
  if (!eintraege.length) { res.cookies.set(GERAET_COOKIE, '', { ...basis, maxAge: 0 }); return; }
  res.cookies.set(GERAET_COOKIE, cookieEintraegeText(eintraege.slice(-MAX_COOKIE_EINTRAEGE)), { ...basis, maxAge: GERAET_TAGE * 86400 });
}

// ── Hash, Liste ──────────────────────────────────────────────────────────────

export interface HashAngaben { kontoId: string; id: string; stand: string; faktorSeit: string; token: string }
/** HMAC-SHA256 (hex) — gebunden an Konto, Gerät, Passwort-Stand und Beginn des zweiten Faktors. */
export function geraetHash(a: HashAngaben, geheimnis: string = sitzungsGeheimnis()): string {
  return createHmac('sha256', geheimnis).update(`geraet-v1|${a.kontoId}|${a.id}|${a.stand}|${a.faktorSeit}|${a.token}`).digest('hex');
}

function formOk(g: unknown): g is GemerktesGeraet {
  if (!g || typeof g !== 'object') return false;
  const x = g as Record<string, unknown>;
  return typeof x.id === 'string' && ID.test(x.id) && typeof x.hash === 'string' && HASH.test(x.hash) && typeof x.stand === 'string' && STAND.test(x.stand)
    && typeof x.bis === 'string' && Number.isFinite(Date.parse(x.bis)) && typeof x.angelegt === 'string' && typeof x.zuletzt === 'string' && typeof x.beschreibung === 'string';
}

/** Nur gültige Geräte: richtige Form, passender Passwort-Stand, nicht abgelaufen. */
export function geraeteBereinigen(liste: unknown, stand: string, jetzt: number): GemerktesGeraet[] {
  return (Array.isArray(liste) ? liste : []).filter(formOk).filter(g => g.stand === stand && Date.parse(g.bis) > jetzt);
}

/** Ein neues Gerät dazu: bereinigt, ohne die ersetzten (gleicher Browser), höchstens MAX_GERAETE — das älteste fällt. */
export function geraetDazu(liste: unknown, neu: GemerktesGeraet, o: { stand: string; jetzt: number; ersetzt?: readonly string[] }): GemerktesGeraet[] {
  const rest = geraeteBereinigen(liste, o.stand, o.jetzt).filter(g => g.id !== neu.id && !(o.ersetzt ?? []).includes(g.id));
  return [...rest, neu].sort((a, b) => (a.angelegt < b.angelegt ? -1 : a.angelegt > b.angelegt ? 1 : 0)).slice(-MAX_GERAETE);
}

/** Ein neues Gerät (Kennung, Token, Hash). Das Token geht NUR ins Cookie, am Konto steht der Hash. */
export function neuesGeraet(a: { kontoId: string; stand: string; faktorSeit: string; beschreibung: string; jetzt: number }, geheimnis?: string): { geraet: GemerktesGeraet; token: string } {
  const id = `g-${randomBytes(8).toString('hex')}`;
  const token = randomBytes(32).toString('base64url');
  const iso = new Date(a.jetzt).toISOString();
  const hash = geraetHash({ kontoId: a.kontoId, id, stand: a.stand, faktorSeit: a.faktorSeit, token }, geheimnis);
  return { token, geraet: { id, hash, stand: a.stand, angelegt: iso, zuletzt: iso, bis: new Date(a.jetzt + GERAET_TAGE * 864e5).toISOString(), beschreibung: a.beschreibung.slice(0, 60) } };
}

/**
 * Passt ein Eintrag des Cookies zu einem gültigen Gerät GENAU dieses Kontos? Jeder Eintrag wird gleich behandelt (HMAC + zeitkonstanter
 * Vergleich, auch bei unbekannter Kennung) — die Antwortzeit verrät nicht, ob eine Kennung bekannt ist. Kein Treffer → null (still).
 */
export function geraetFinden(
  k: { id: string; zweiterFaktor?: { seit: string; geraete?: unknown } },
  eintraege: readonly CookieEintrag[], stand: string, jetzt: number, geheimnis: string = sitzungsGeheimnis(),
): GemerktesGeraet | null {
  const zf = k.zweiterFaktor;
  if (!zf || !eintraege.length) return null;
  const liste = geraeteBereinigen(zf.geraete, stand, jetzt);
  let treffer: GemerktesGeraet | null = null;
  for (const e of eintraege) {
    const g = liste.find(x => x.id === e.id);
    const soll = Buffer.from(g?.hash ?? BLIND, 'hex');
    const ist = Buffer.from(geraetHash({ kontoId: k.id, id: e.id, stand, faktorSeit: zf.seit, token: e.token }, geheimnis), 'hex');
    const passt = soll.length === ist.length && timingSafeEqual(soll, ist);
    if (passt && g && !treffer) treffer = g;
  }
  return treffer;
}

/** Für den Browser: ohne Hash und Stand, nur nicht abgelaufene, jüngst benutzte zuerst. */
export function geraeteOeffentlich(liste: unknown, jetzt: number = Date.now()): GeraetOeffentlich[] {
  return (Array.isArray(liste) ? liste : []).filter(formOk).filter(g => Date.parse(g.bis) > jetzt)
    .map(g => ({ id: g.id, beschreibung: g.beschreibung, angelegt: g.angelegt, zuletzt: g.zuletzt, bis: g.bis }))
    .sort((a, b) => (a.zuletzt < b.zuletzt ? 1 : a.zuletzt > b.zuletzt ? -1 : 0));
}

/** Konto ohne gemerkte Geräte (Passwort geändert) — unverändert, wenn es keine gibt. */
export function ohneGeraete<K extends { zweiterFaktor?: object }>(k: K): K {
  const zf = k.zweiterFaktor as (Record<string, unknown> | undefined);
  if (!zf || !('geraete' in zf)) return k;
  const { geraete: _g, ...rest } = zf;
  return { ...k, zweiterFaktor: rest };
}
