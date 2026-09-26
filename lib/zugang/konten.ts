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
import { loadJson, updateJson } from '@/lib/store/local-db';

export type Rolle = 'inhaber' | 'mitglied';

export interface Konto {
  id: string;
  /** Name der persönlichen Bestände — stabil, nie ändern. */
  speicher: string;
  email: string;
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
}

/** `speicher`: vom Inhaber festgelegter Speichername (z. B. „malin“, damit bestehende Bestände am Konto hängen). */
export interface Einladung { code: string; von: string; bis: string; speicher?: string }
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
export function oeffentlich(k: Konto): Omit<Konto, 'hash' | 'salz'> {
  const { hash: _h, salz: _s, ...rest } = k;
  return rest;
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
  return s && Array.isArray(s.konten) ? { konten: s.konten, einladungen: Array.isArray(s.einladungen) ? s.einladungen : [] } : leererStand();
}

export async function aendereKonten(mut: (s: KontenStand) => KontenStand): Promise<KontenStand> {
  return updateJson<KontenStand>(STORE, current => {
    const s = current && Array.isArray(current.konten) ? { konten: current.konten, einladungen: Array.isArray(current.einladungen) ? current.einladungen : [] } : leererStand();
    return mut(s);
  });
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
