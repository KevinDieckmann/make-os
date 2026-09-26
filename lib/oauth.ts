// ─── MAKE OS — OAuth-Fundament ──────────────────────────────────────────────
// EIN sauberer Unterbau für alle externen Anbindungen (Whoop, Microsoft 365).
// Kevin registriert die App beim Anbieter, trägt Client-ID/Secret in
// .env.local ein, klickt unter /os/verbindungen auf „Verbinden" — fertig.
// Tokens liegen NUR lokal (.data/oauth-tokens.json, gitignored) und werden
// NIE an den Client ausgeliefert — die UI sieht nur Metadaten.
// NIEMALS aus Client-Komponenten importieren (fs über local-db).

import { loadJson, updateJson } from '@/lib/store/local-db';

export interface OAuthProvider {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  envId: string;      // Name der .env-Variable für die Client-ID
  envSecret: string;  // … und fürs Secret
  /** Was Kevin beim Anbieter anlegen muss — für die Verbindungen-Seite. */
  anleitung: string;
}

export const PROVIDER: Record<string, OAuthProvider> = {
  whoop: {
    id: 'whoop',
    name: 'Whoop',
    authUrl: 'https://api.prod.whoop.com/oauth/oauth2/auth',
    tokenUrl: 'https://api.prod.whoop.com/oauth/oauth2/token',
    scope: 'read:recovery read:sleep read:cycles read:profile offline',
    envId: 'WHOOP_CLIENT_ID',
    envSecret: 'WHOOP_CLIENT_SECRET',
    anleitung: 'developer.whoop.com → App anlegen → Redirect-URL http://localhost:3001/api/oauth/callback eintragen → Client-ID + Secret in .env.local (WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET), Server neu starten.',
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft 365',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'offline_access User.Read Mail.Read Calendars.Read',
    envId: 'MS_CLIENT_ID',
    envSecret: 'MS_CLIENT_SECRET',
    anleitung: 'portal.azure.com → App-Registrierung (Konten: alle Organisationen + persönlich) → Redirect-URL (Web) http://localhost:3001/api/oauth/callback → Client-ID + Secret in .env.local (MS_CLIENT_ID / MS_CLIENT_SECRET), Server neu starten.',
  },
};

// Die Adresse, unter der der Browser nach Whoop/M365 zurückkommt — auf dem Server die öffentliche (26.09.).
export const REDIRECT_URI = `${(process.env.MAKE_OS_ADRESSE ?? '').trim().replace(/\/+$/, '') || 'http://localhost:3001'}/api/oauth/callback`;

interface TokenSatz {
  access_token: string;
  refresh_token?: string;
  /** Unix-ms, wann das Access-Token abläuft. */
  expires_at: number;
  scope?: string;
  verbunden_am: string;
}
type TokenFile = Record<string, TokenSatz>;
/** Kurzlebige state-Werte gegen CSRF (Provider ↔ zufälliger state). */
interface StateFile { states: Record<string, { provider: string; at: number }> }

export const konfiguriert = (p: OAuthProvider) => !!process.env[p.envId] && !!process.env[p.envSecret];

export async function tokenStatus(providerId: string): Promise<{ verbunden: boolean; seit?: string; laeuftAb?: number; scope?: string }> {
  const f = (await loadJson<TokenFile>('oauth-tokens')) ?? {};
  const t = f[providerId];
  if (!t?.access_token) return { verbunden: false };
  return { verbunden: true, seit: t.verbunden_am, laeuftAb: t.expires_at, scope: t.scope };
}

export async function stateMerken(state: string, provider: string): Promise<void> {
  await updateJson<StateFile>('oauth-states', current => {
    const jetzt = Date.now();
    const states = Object.fromEntries(Object.entries(current?.states ?? {}).filter(([, v]) => jetzt - v.at < 15 * 60_000));
    states[state] = { provider, at: jetzt };
    return { states };
  });
}

export async function stateEinloesen(state: string): Promise<string | null> {
  const f = await loadJson<StateFile>('oauth-states');
  const eintrag = f?.states?.[state];
  if (!eintrag || Date.now() - eintrag.at > 15 * 60_000) return null;
  await updateJson<StateFile>('oauth-states', current => {
    const states = { ...(current?.states ?? {}) };
    delete states[state];
    return { states };
  });
  return eintrag.provider;
}

export async function tokensSpeichern(providerId: string, raw: { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }): Promise<void> {
  await updateJson<TokenFile>('oauth-tokens', current => ({
    ...(current ?? {}),
    [providerId]: {
      access_token: raw.access_token,
      refresh_token: raw.refresh_token,
      expires_at: Date.now() + Math.max(60, Number(raw.expires_in) || 3600) * 1000,
      scope: raw.scope,
      verbunden_am: new Date().toISOString(),
    },
  }));
}

export async function trennen(providerId: string): Promise<void> {
  await updateJson<TokenFile>('oauth-tokens', current => {
    const f = { ...(current ?? {}) };
    delete f[providerId];
    return f;
  });
}

/** Gültiges Access-Token holen — erneuert bei Bedarf über das Refresh-Token. */
export async function gueltigesToken(providerId: string): Promise<string | null> {
  const p = PROVIDER[providerId];
  if (!p || !konfiguriert(p)) return null;
  const f = (await loadJson<TokenFile>('oauth-tokens')) ?? {};
  const t = f[providerId];
  if (!t?.access_token) return null;
  if (Date.now() < t.expires_at - 60_000) return t.access_token;
  if (!t.refresh_token) return null;

  const r = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: t.refresh_token,
      client_id: process.env[p.envId]!,
      client_secret: process.env[p.envSecret]!,
      ...(providerId === 'microsoft' ? { scope: p.scope } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) return null;
  const neu = await r.json();
  if (!neu.access_token) return null;
  await tokensSpeichern(providerId, { ...neu, refresh_token: neu.refresh_token ?? t.refresh_token });
  return neu.access_token as string;
}
