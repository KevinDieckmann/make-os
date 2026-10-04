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

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadJson, updateJson, beschaedigt } from '@/lib/store/local-db';
import type { Wiederherstellung } from './totp';

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
  angelegt: string;
  /** Wem diese Person ihre Gesundheitsdaten zeigt (speicher-Namen). */
  teilt: { gesundheit: string[] };
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

export interface KontenStand { konten: Konto[]; einladungen: Einladung[] }

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
export function neuerEinladungscode(zufall: () => number = Math.random): string {
  let c = '';
  for (let i = 0; i < 8; i++) c += CODE_ZEICHEN[Math.floor(zufall() * CODE_ZEICHEN.length)];
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export function leererStand(): KontenStand { return { konten: [], einladungen: [] }; }

/** Was der Browser über ein Konto wissen darf — nie Hash oder Salz. */
export function oeffentlich(k: Konto): Omit<Konto, 'hash' | 'salz' | 'widerrufen' | 'zweiterFaktor' | 'zweiterFaktorEntwurf'> & { zweiterFaktorAn: boolean } {
  const { hash: _h, salz: _s, widerrufen: _w, zweiterFaktor: _z, zweiterFaktorEntwurf: _e, ...rest } = k;
  return { ...rest, zweiterFaktorAn: !!k.zweiterFaktor };
}

// ── Passwort ─────────────────────────────────────────────────────────────────

function scryptHex(passwort: string, salz: string): Promise<string> {
  return new Promise((res, rej) => scrypt(passwort, salz, 64, (e, k) => (e ? rej(e) : res(k.toString('hex')))));
}

export async function passwortHashen(passwort: string): Promise<{ hash: string; salz: string }> {
  const salz = randomBytes(16).toString('hex');
  return { hash: await scryptHex(passwort, salz), salz };
}

export async function passwortStimmt(passwort: string, konto: Pick<Konto, 'hash' | 'salz'>): Promise<boolean> {
  const h = Buffer.from(await scryptHex(passwort, konto.salz), 'hex');
  const s = Buffer.from(konto.hash, 'hex');
  return h.length === s.length && timingSafeEqual(h, s);
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
  return { konten: s.konten, einladungen: Array.isArray(s.einladungen) ? s.einladungen : [] };
}

export async function aendereKonten(mut: (s: KontenStand) => KontenStand): Promise<KontenStand> {
  return updateJson<KontenStand>(STORE, current => {
    const s = current && Array.isArray(current.konten) ? { konten: current.konten, einladungen: Array.isArray(current.einladungen) ? current.einladungen : [] } : leererStand();
    return mut(s);
  });
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
