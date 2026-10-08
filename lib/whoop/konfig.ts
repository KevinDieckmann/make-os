// ─── WHOOP — Konfiguration, Adressen, Scopes (rein, 08.10.2026) ─────────────────────────────────────────────────────────
// Kevin 08.10.: „Whoop-Schnittstelle, damit wir immer die aktuellen Daten haben.“ — je Person eine EIGENE Verbindung zu ihrem WHOOP-
// Konto (WHOOP API v2). Fakten mit Quelle: research/whoop/FAKTEN_WHOOP.md; Doku: https://developer.whoop.com/docs/developing/oauth ·
// https://developer.whoop.com/api · https://developer.whoop.com/docs/developing/webhooks
//
// Umgebung (Server-.env, nie im Repo; gesetzt über deploy/whoop-verbinden.sh):
//   WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET   App im WHOOP Developer Dashboard (das Secret signiert auch die Webhooks)
//   WHOOP_RUECKRUF_URL                     sonst `MAKE_OS_ADRESSE` + /api/whoop/rueckruf — nie ein fester localhost
// Fehlt etwas, ist WHOOP sichtbar aus („noch nicht eingerichtet“) — nichts bricht.

/** Autorisierung und Token (belegt, FAKTEN 2). */
export const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
export const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
/** Basis der API v2 (belegt, FAKTEN 4). */
export const WHOOP_API = 'https://api.prod.whoop.com/developer';
/** Hierhin dürfen WHOOP-Zugangsdaten gehen — sonst nirgends. */
export const WHOOP_HOSTS: readonly string[] = ['api.prod.whoop.com'];
export const whoopHost = (u: string): boolean => { try { const x = new URL(u); return x.protocol === 'https:' && WHOOP_HOSTS.includes(x.hostname); } catch { return false; } };

/**
 * Scopes (belegt, FAKTEN 3) — minimal: `offline` (Refresh-Token), Recovery, Zyklen (Strain), Workouts, Schlaf, Profil (nur `user_id` für die
 * Zuordnung der Webhooks + Adresse maskiert). Bewusst NICHT `read:body_measurement` (Größe/Gewicht braucht MAKE OS nicht).
 */
export const WHOOP_SCOPES: readonly string[] = ['offline', 'read:recovery', 'read:cycles', 'read:workout', 'read:sleep', 'read:profile'];
/** Ohne diese Scopes kein sinnvoller Abgleich (Workouts fehlen z. B. bei der Übernahme des alten Tokens — dann nur Hinweis). */
export const WHOOP_PFLICHT_SCOPES: readonly string[] = ['read:recovery', 'read:sleep'];

export const WHOOP_RUECKRUF_PFAD = '/api/whoop/rueckruf';
export const WHOOP_WEBHOOK_PFAD = '/api/whoop/webhook';

export interface WhoopKonfig { clientId: string; clientSecret: string; rueckrufUrl: string }

const adresseAus = (env: NodeJS.ProcessEnv): string | null => {
  const a = (env.MAKE_OS_ADRESSE ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+$/.test(a) ? a : null;
};

/** Was fehlt, damit WHOOP läuft — nur NAMEN der Variablen (nie Werte). */
export function whoopFehlt(env: NodeJS.ProcessEnv = process.env): string[] {
  const f: string[] = [];
  if (!env.WHOOP_CLIENT_ID?.trim()) f.push('WHOOP_CLIENT_ID');
  if (!env.WHOOP_CLIENT_SECRET?.trim()) f.push('WHOOP_CLIENT_SECRET');
  if (!(env.WHOOP_RUECKRUF_URL ?? '').trim() && !adresseAus(env)) f.push('WHOOP_RUECKRUF_URL oder MAKE_OS_ADRESSE');
  return f;
}

/** Die Konfiguration aus der Umgebung — null, solange etwas fehlt. */
export function whoopKonfig(env: NodeJS.ProcessEnv = process.env): WhoopKonfig | null {
  if (whoopFehlt(env).length) return null;
  const rueckrufUrl = (env.WHOOP_RUECKRUF_URL ?? '').trim() || `${adresseAus(env)}${WHOOP_RUECKRUF_PFAD}`;
  return { clientId: env.WHOOP_CLIENT_ID!.trim(), clientSecret: env.WHOOP_CLIENT_SECRET!.trim(), rueckrufUrl };
}
export const whoopKonfiguriert = (env: NodeJS.ProcessEnv = process.env): boolean => whoopKonfig(env) !== null;

/** Die öffentliche Webhook-Adresse (für die Anleitung/den Status) — nur mit HTTPS-Adresse der Instanz, sonst null. */
export function whoopWebhookAdresse(env: NodeJS.ProcessEnv = process.env): string | null {
  const a = adresseAus(env);
  return a && a.startsWith('https://') ? `${a}${WHOOP_WEBHOOK_PFAD}` : null;
}

/** Speichernamen je Person — ausdrücklich mit Suffix für JEDE Person (kein Sonderfall für das Erstkonto). */
export const PERSON_OK = /^[a-z0-9-]{1,40}$/;
export const verbindungName = (person: string): string => `whoop-verbindung--${person}`;
export const standName = (person: string): string => `whoop-stand--${person}`;
export const ZUSTAND_NAME = 'whoop-oauth-zustand';
