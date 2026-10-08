// ─── MAKE OS — Die Konten ───────────────────────────────────────────────────
// Statt zwei fest verdrahteter Namen: Konten, die man anlegen, einladen und
// pflegen kann. Kevin, 23.09.: „Ich baue das MAKE OS mit Agentensystem und
// das wollen wir später evtl. verkaufen."
//
// Das Wichtigste ist das Feld `speicher`. Es ist der Name, unter dem die
// persönlichen Bestände einer Person liegen (siehe speicherFuer in raum.ts).
// Kevins Konto bekommt `kevin`, Malins `malin` — und damit hängen ALLE
// vorhandenen Dateien (vitals.json, vitals--malin.json, …) ohne Umzug am
// richtigen Konto. Der Name entsteht aus dem Vornamen; ist er vergeben, wird
// eine Zahl angehängt.
//
// Rollen: der Inhaber (erstes Konto, mit dem Zugangsschlüssel angelegt) darf
// einladen. Mitglieder dürfen alles andere. Ein „Haushalt" ist die Instanz —
// wer später verkauft, zieht diese Datei je Kunde einmal hoch.
// Seit 09.10. (R9) darf die Rolle `inhaber` mehrere Konten tragen — Regeln und der Haupt-Inhaber NUR über lib/zugang/inhaber.ts.

import { scrypt, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { loadJson, updateJson, beschaedigt } from '@/lib/store/local-db';
import type { Wiederherstellung } from './totp';
import type { Aenderung } from '@/lib/store/aenderungsprotokoll';

export type Rolle = 'inhaber' | 'mitglied';

export interface Konto {
  id: string;
  /** Name der persönlichen Bestände — stabil, nie ändern. */
  speicher: string;
  /** Hauptadresse — alte Bilder lesen nur dieses Feld; Anzeige (Begrüßung, Visitenkarte, Team) nimmt immer sie. */
  email: string;
  /**
   * Weitere Anmelde-Adressen (03.10., höchstens `MAX_WEITERE_EMAILS`): führen ins selbe Konto, mit demselben Passwort und
   * demselben zweiten Faktor. Optional — Konten ohne das Feld bleiben gültig, ohne Umstellung.
   */
  weitereEmails?: string[];
  name: string;
  rolle: Rolle;
  hash: string;
  salz: string;
  /** scrypt-Parameter des Hashes (05.10.). Fehlt = Node-Vorgabe N=2^14 (`KDF_STANDARD`) — so lesen alte Stände jedes Konto. */
  kdf?: Kdf;
  angelegt: string;
  /**
   * Wem diese Person ihre Gesundheitsdaten zeigt (speicher-Namen). `ziele` (08.10., Kevin): wem sie ihre EIGENEN Ziele
   * (`ziele-eigen--<person>`) zeigt — optional, fehlt = niemand (lib/planung/eigene-ziele-sicht.ts).
   */
  teilt: { gesundheit: string[]; ziele?: string[] };
  /** Wer die Einladung ausgesprochen hat. */
  eingeladenVon?: string;
  /**
   * Zu welchem Haushalt die Person gehört (Haushaltsfinanzen, 24.09.). Setzt
   * nur der Inhaber. Kevin und Malin: „kevin-malin“. Ohne Eintrag: kein
   * Zugriff auf private Finanzen — auch keine Summen.
   */
  haushalt?: string;
  /**
   * Finanzrecht im Haushalt (04.10. spät): fehlt = alles (Inhaber-Haushalt, Kevin + Malin). `business` = nur die Business-Sicht der
   * Finanzplanung (Teammitglieder/Partner ohne Privatzugang): kein Zugang zu den privaten Haushaltsfinanzen, Privat wird serverseitig
   * herausgefiltert (lib/finanzen/plan/sicht.ts). Setzt nur der Inhaber (`PUT /api/konto/haushalt`).
   */
  finanzRecht?: 'business';
  /** Zettel, die vor diesem Zeitpunkt ausgestellt wurden, gelten nicht mehr („alle anderen Geräte abmelden“, 26.09.). */
  sitzungenAb?: string;
  /** Beim Abmelden widerrufene Zettel (Kennung + Ablauf, danach entfällt der Eintrag). */
  widerrufen?: { sid: string; bis: number }[];
  /** Zweiter Faktor (TOTP, 26.09.): Geheimnis (Base32), seit wann, zuletzt genutzte Zeitstufe, Wiederherstellungscodes (nur Hashes). */
  zweiterFaktor?: { geheimnis: string; seit: string; letzteStufe?: number; wiederherstellung: Wiederherstellung[] };
  /** Einrichtung begonnen, noch nicht mit einem Code bestätigt. */
  zweiterFaktorEntwurf?: { geheimnis: string; seit: string };
}

/** `speicher`: vom Inhaber festgelegter Speichername (z. B. „malin“, damit bestehende Bestände am Konto hängen). */
export interface Einladung { code: string; von: string; bis: string; speicher?: string; /** Optional (03.10.): für diese Adresse ausgesprochen — sie ist damit bis zum Ablauf reserviert. */ email?: string }
/** Namen, die nur über eine gebundene Einladung vergeben werden — nie durch den frei gewählten Vornamen. */
export const RESERVIERTE_SPEICHER = ['kevin', 'malin'];

/**
 * Einstellungen der Instanz zum Zugang (05.10., Paket „Zugang & Schlüssel härten“). Setzt nur der Inhaber
 * (`PUT /api/konto/einstellungen`). Fehlt das Feld (laufende Instanz vor 05.10.), gilt: keine 2FA-Pflicht, Leerlauf 12 h.
 */
export interface ZugangEinstellungen {
  /** Konten ohne zweiten Faktor werden beim nächsten Anmelden zur Einrichtung geführt (vorher kommen sie nirgends hin). */
  zweiFaktorPflicht?: boolean;
  /** Seit wann die Pflicht gilt (ISO) — Sitzungen von davor laufen bis zu ihrem Ende (Leerlauf, 14 Tage) weiter. */
  zweiFaktorPflichtSeit?: string;
  /** Leerlauf-Ende einer Sitzung in Stunden (1–336, Standard `LEERLAUF_STUNDEN`). */
  leerlaufStunden?: number;
  /**
   * Mac-Zulieferer an/aus (08.10., Lücke 10 — lib/zulieferer/schalter.ts). Fehlt das Feld, gilt die Vorgabe: nach der Übernahme der
   * Apple-Erinnerungen aus, mit Altbestand an, neue Instanz aus. Die Umgebung `MAKE_OS_ZULIEFERER` gewinnt. Setzt nur der Inhaber.
   */
  zulieferer?: 'an' | 'aus';
  /** Seit wann die Einstellung gilt (ISO). */
  zuliefererSeit?: string;
  /**
   * Haupt-Inhaber (09.10., R9 — mehrere Inhaber): Speichername des Inhabers, an dem hängt, was genau EINEN braucht (Altbestand
   * ohne Suffix, Systemlauf-Person, Kalender-Haupt-Person). Wird bei der ersten Ernennung eines weiteren Inhabers festgeschrieben;
   * fehlt es, gilt das älteste Inhaber-Konto. Lesen NUR über `hauptInhaber` (lib/zugang/inhaber.ts).
   */
  hauptInhaber?: string;
}
export interface KontenStand { konten: Konto[]; einladungen: Einladung[]; einstellungen?: ZugangEinstellungen }

/** Leerlauf-Ende einer Sitzung ohne Einstellung: 12 Stunden ohne Anfrage → neu anmelden (zusätzlich zur 14-Tage-Grenze). */
export const LEERLAUF_STUNDEN = 12;
export function leerlaufStunden(e: ZugangEinstellungen | undefined): number {
  const h = Number(e?.leerlaufStunden);
  return Number.isFinite(h) && h >= 1 && h <= 336 ? Math.round(h) : LEERLAUF_STUNDEN;
}
/** Muss dieses Konto erst den zweiten Faktor einrichten (Pflicht an, Faktor fehlt)? */
export function zweiFaktorOffen(e: ZugangEinstellungen | undefined, k: Pick<Konto, 'zweiterFaktor'>): boolean {
  return !!e?.zweiFaktorPflicht && !k.zweiterFaktor;
}

const STORE = 'konten';
export const EINLADUNG_STUNDEN = 48;

// ── Reine Regeln ─────────────────────────────────────────────────────────────

/** Vorname → Speichername: „Malin" → malin, „Jörg Müller" → joerg. */
export function speicherName(name: string, vergeben: string[]): string {
  const basis = name.trim().split(/\s+/)[0].toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '').slice(0, 24) || 'person';
  if (!vergeben.includes(basis)) return basis;
  for (let i = 2; i < 100; i++) if (!vergeben.includes(`${basis}${i}`)) return `${basis}${i}`;
  return `${basis}${Date.now().toString(36)}`;
}

export function emailSauber(e: unknown): string | null {
  const s = String(e ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 160 ? s : null;
}

/** Wie viele weitere Anmelde-Adressen ein Konto neben der Hauptadresse haben darf. */
export const MAX_WEITERE_EMAILS = 3;

/** Alle Adressen eines Kontos, Hauptadresse zuerst — klein, ohne Doppelte. */
export function alleAdressen(k: Pick<Konto, 'email' | 'weitereEmails'>): string[] {
  const roh = [k.email, ...(Array.isArray(k.weitereEmails) ? k.weitereEmails : [])];
  const aus: string[] = [];
  for (const a of roh) { const s = typeof a === 'string' ? a.trim().toLowerCase() : ''; if (s && !aus.includes(s)) aus.push(s); }
  return aus;
}

/** Das Konto, das diese Adresse als Haupt- ODER weitere Anmelde-Adresse trägt (Groß-/Kleinschreibung egal). Die einzige Stelle für „Adresse → Konto“. */
export function kontoMitAdresse<K extends Pick<Konto, 'email' | 'weitereEmails'>>(konten: readonly K[], email: unknown): K | undefined {
  const e = emailSauber(email);
  return e ? konten.find(k => alleAdressen(k).includes(e)) : undefined;
}

/** Ist die Adresse in dieser Instanz schon vergeben — an ein Konto (Haupt oder weitere) oder an eine offene Einladung? `ausser` = Speicher, dessen eigene Adressen nicht zählen. */
export function adresseVergeben(stand: KontenStand, email: string, ausser?: string, jetzt: number = Date.now()): boolean {
  const e = email.trim().toLowerCase();
  if (stand.konten.some(k => k.speicher !== ausser && alleAdressen(k).includes(e))) return true;
  return stand.einladungen.some(i => !!i.email && i.email.trim().toLowerCase() === e && Date.parse(i.bis) > jetzt);
}

/** Maskiert für Protokolle und Meldungen: k***@makeinnovation.de. */
export function adresseMaskiert(email: string): string {
  const [lokal, domain] = String(email).split('@');
  return domain ? `${(lokal ?? '').slice(0, 1)}***@${domain}` : '***';
}

/** Mindestens 10 Zeichen. Keine Zusammensetzungsregeln — Länge schlägt Sonderzeichen. */
export function passwortTauglich(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 10 && p.length <= 200;
}

const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Einladungscode XXXX-XXXX (40 Bit). Seit 05.10. kryptografischer Zufall (`crypto.randomInt`). */
export function neuerEinladungscode(ziehe: (n: number) => number = n => randomInt(n)): string {
  let c = '';
  for (let i = 0; i < 8; i++) c += CODE_ZEICHEN[ziehe(CODE_ZEICHEN.length)];
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export function leererStand(): KontenStand { return { konten: [], einladungen: [] }; }

/** Was der Browser über ein Konto wissen darf — nie Hash oder Salz. */
export function oeffentlich(k: Konto): Omit<Konto, 'hash' | 'salz' | 'kdf' | 'widerrufen' | 'zweiterFaktor' | 'zweiterFaktorEntwurf'> & { zweiterFaktorAn: boolean } {
  const { hash: _h, salz: _s, kdf: _k, widerrufen: _w, zweiterFaktor: _z, zweiterFaktorEntwurf: _e, ...rest } = k;
  return { ...rest, zweiterFaktorAn: !!k.zweiterFaktor };
}

// ── Passwort ─────────────────────────────────────────────────────────────────
// scrypt (05.10.): N=2^17, r=8, p=1 (OWASP-Empfehlung, 128 MiB je Hash, ~0,3 s) statt der Node-Vorgabe N=2^14. Die
// Parameter stehen am Konto (`kdf`); alte Hashes ohne Feld bleiben gültig und werden beim nächsten erfolgreichen
// Anmelden neu gehasht — mit DEMSELBEN Salz, damit der Sitzungs-Stand (Fingerabdruck des Salzes) gleich bleibt und
// kein anderes Gerät rausfliegt.
// Rückweg: der alte Online-Stand kennt `kdf` nicht und rechnet immer mit N=2^14 — ein neu gehashtes Konto käme dort
// nicht mehr hinein. Deshalb gilt N=2^17 erst mit MAKE_OS_KDF=stark: neue Instanzen von Anfang an (env.server.beispiel),
// die laufende, sobald der Rückweg zu ist (zusammen mit MAKE_OS_FORMAT=v2, UPDATES.md). Vorher schreibt MAKE OS weiter
// N=2^14 (mit `kdf` am Konto, das der alte Stand still übergeht).

export interface Kdf { n: number; r: number; p: number }
export const KDF_STANDARD: Kdf = { n: 16384, r: 8, p: 1 };
export const KDF_STARK: Kdf = { n: 131072, r: 8, p: 1 };

/** Welche Parameter neue Hashes bekommen (siehe oben: stark nur ohne Rückweg-Bedarf). */
export function kdfFuerNeu(env: Record<string, string | undefined> = process.env): Kdf {
  return (env.MAKE_OS_KDF ?? '').trim().toLowerCase() === 'stark' ? KDF_STARK : KDF_STANDARD;
}
/** Parameter eines Kontos (ohne Feld: Node-Vorgabe) — nur bekannte, sinnvolle Werte; alles andere gilt als Vorgabe. */
export function kdfVon(k: Pick<Konto, 'kdf'>): Kdf {
  const d = k.kdf;
  const ok = !!d && [d.n, d.r, d.p].every(Number.isInteger) && d.n >= 16384 && d.n <= 1048576 && (d.n & (d.n - 1)) === 0 && d.r >= 1 && d.r <= 16 && d.p >= 1 && d.p <= 4;
  return ok ? { n: d!.n, r: d!.r, p: d!.p } : KDF_STANDARD;
}
/** Sollte dieser Hash beim nächsten erfolgreichen Anmelden neu gerechnet werden? */
export const kdfVeraltet = (k: Pick<Konto, 'kdf'>, ziel: Kdf = kdfFuerNeu()): boolean => kdfVon(k).n < ziel.n;

// Höchstens zwei starke Hashes gleichzeitig (je 128 MiB) — der Server hat 1280 MB für die App.
const PARALLEL = 2;
let laufend = 0;
const warten: (() => void)[] = [];
async function mitPlatz<T>(f: () => Promise<T>): Promise<T> {
  if (laufend >= PARALLEL) await new Promise<void>(r => warten.push(r));
  laufend++;
  try { return await f(); } finally { laufend--; warten.shift()?.(); }
}

function scryptHex(passwort: string, salz: string, kdf: Kdf): Promise<string> {
  const maxmem = 128 * kdf.n * kdf.r + 32 * 1024 * 1024;
  return mitPlatz(() => new Promise((res, rej) => scrypt(passwort, salz, 64, { N: kdf.n, r: kdf.r, p: kdf.p, maxmem }, (e, k) => (e ? rej(e) : res(k.toString('hex'))))));
}

export async function passwortHashen(passwort: string, kdf: Kdf = kdfFuerNeu(), salz = randomBytes(16).toString('hex')): Promise<{ hash: string; salz: string; kdf: Kdf }> {
  return { hash: await scryptHex(passwort, salz, kdf), salz, kdf };
}

export async function passwortStimmt(passwort: string, konto: Pick<Konto, 'hash' | 'salz' | 'kdf'>): Promise<boolean> {
  const h = Buffer.from(await scryptHex(passwort, konto.salz, kdfVon(konto)), 'hex');
  const s = Buffer.from(konto.hash, 'hex');
  return h.length === s.length && timingSafeEqual(h, s);
}

/**
 * Nach einem erfolgreichen Anmelden: veralteten Hash mit DEMSELBEN Salz und den aktuellen Parametern neu rechnen und
 * speichern (nur wenn sich Hash/Salz inzwischen nicht geändert haben). Wirft nie — das Anmelden ist dann schon geschehen.
 */
export async function passwortNachziehen(passwort: string, konto: Pick<Konto, 'speicher' | 'hash' | 'salz' | 'kdf'>): Promise<boolean> {
  try {
    const ziel = kdfFuerNeu();
    if (!kdfVeraltet(konto, ziel)) return false;
    const neu = await passwortHashen(passwort, ziel, konto.salz);
    let gesetzt = false;
    await aendereKonten(s => ({ ...s, konten: s.konten.map(k => {
      if (k.speicher !== konto.speicher || k.hash !== konto.hash || k.salz !== konto.salz) return k;
      gesetzt = true;
      return { ...k, hash: neu.hash, kdf: neu.kdf };
    }) }));
    return gesetzt;
  } catch (e) {
    console.error('[konten] Passwort-Hash nicht nachgezogen:', e instanceof Error ? e.message : e);
    return false;
  }
}

// ── Speicher ─────────────────────────────────────────────────────────────────

export async function ladeKonten(): Promise<KontenStand> {
  const s = await loadJson<KontenStand>(STORE);
  if (!s || !Array.isArray(s.konten)) {
    // Fail-closed (26.09.): ist die Datei beschädigt (beiseitegelegt als .corrupt-*), gibt es KEINEN leeren
    // Stand — sonst stünde das Erstkonto wieder offen. Erst die Sicherung zurückholen.
    if (await beschaedigt(STORE)) throw new Error('Kontenbestand beschädigt — Sicherung zurückspielen (konten.json.corrupt-*).');
    return leererStand();
  }
  return { konten: s.konten, einladungen: Array.isArray(s.einladungen) ? s.einladungen : [], ...(einstellungenAus(s) ? { einstellungen: einstellungenAus(s) } : {}) };
}

function einstellungenAus(s: Partial<KontenStand> | null | undefined): ZugangEinstellungen | undefined {
  const e = s?.einstellungen;
  return e && typeof e === 'object' && !Array.isArray(e) ? e : undefined;
}

/**
 * Konto-Änderungen fürs Änderungsprotokoll (05.10.): NUR Kennungen und Feldnamen, nie Werte — neu, gelöscht, Rolle,
 * Haushalt, Finanzrecht, zweiter Faktor an/aus; Instanz-Einstellungen unter der Kennung `instanz`. Rein.
 */
export const KONTO_FELDER = ['rolle', 'haushalt', 'finanzRecht'] as const;
export function kontoAenderungen(alt: KontenStand | null, neu: KontenStand): Aenderung[] {
  const vorher = new Map((alt?.konten ?? []).map(k => [k.id, k]));
  const nachher = new Map(neu.konten.map(k => [k.id, k]));
  const raus: Aenderung[] = [];
  for (const [id, n] of Array.from(nachher)) {
    const a = vorher.get(id);
    if (!a) { raus.push({ op: 'neu', id }); continue; }
    const felder: string[] = KONTO_FELDER.filter(f => (a[f] ?? null) !== (n[f] ?? null));
    if (!!a.zweiterFaktor !== !!n.zweiterFaktor) felder.push('zweiterFaktor');
    if (felder.length) raus.push({ op: 'geaendert', id, felder });
  }
  for (const id of Array.from(vorher.keys())) if (!nachher.has(id)) raus.push({ op: 'geloescht', id });
  const ea = alt?.einstellungen ?? {}, en = neu.einstellungen ?? {};
  const efelder = (['zweiFaktorPflicht', 'leerlaufStunden', 'zulieferer', 'hauptInhaber'] as const).filter(f => (ea[f] ?? null) !== (en[f] ?? null));
  if (efelder.length) raus.push({ op: 'geaendert', id: 'instanz', felder: [...efelder] });
  return raus;
}

export async function aendereKonten(mut: (s: KontenStand) => KontenStand): Promise<KontenStand> {
  let vorher: KontenStand | null = null;
  const ergebnis = await updateJson<KontenStand>(STORE, current => {
    const e = einstellungenAus(current);
    const s: KontenStand = current && Array.isArray(current.konten) ? { konten: current.konten, einladungen: Array.isArray(current.einladungen) ? current.einladungen : [], ...(e ? { einstellungen: e } : {}) } : leererStand();
    vorher = s;
    const neu = mut(s);
    // Wer nur Konten/Einladungen schreibt (z. B. `{ konten, einladungen }` ohne Spread), verliert die Einstellungen nicht.
    const behalten = 'einstellungen' in neu ? neu.einstellungen : s.einstellungen;
    const { einstellungen: _weg, ...rest } = neu;
    return behalten ? { ...rest, einstellungen: behalten } : rest;
  });
  // Änderungsprotokoll (05.10.): wer wann welches Konto angelegt, gelöscht oder an Rolle/Haushalt/Finanzrecht/2FA geändert
  // hat — nur Kennungen. Dynamisch geladen (das Protokoll liest selbst Konten). Wirft nie.
  const aenderungen = kontoAenderungen(vorher, ergebnis);
  if (aenderungen.length) await import('@/lib/store/aenderungsprotokoll').then(m => m.protokolliere('konten', aenderungen)).catch(() => {});
  return ergebnis;
}

/** Konto zu einer Anmelde-Adresse (Haupt- oder weitere). */
export async function kontoZuEmail(email: unknown): Promise<Konto | undefined> {
  return kontoMitAdresse((await ladeKonten()).konten, email);
}

export async function kontoFuerSpeicher(speicher: string): Promise<Konto | undefined> {
  return (await ladeKonten()).konten.find(k => k.speicher === speicher);
}

/** Alle Speichernamen — für Läufe, die jede Person bedienen (Gesundheits-Takt). */
export async function alleSpeicher(): Promise<string[]> {
  return (await ladeKonten()).konten.map(k => k.speicher);
}

/** Anzeigename je Speicher — mit Rückfall auf den Namen selbst. */
export async function namenVon(): Promise<Record<string, string>> {
  const r: Record<string, string> = {};
  for (const k of (await ladeKonten()).konten) r[k.speicher] = k.name.split(/\s+/)[0];
  return r;
}
