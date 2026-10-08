// ─── Google Vertex: Zugriffstoken aus dem Dienstkonto (09.10.2026, Paket 6a) — Server ─────────────────────────────────────
// Kevin 08.10. (Antwort 24): „Google über Vertex mit Dienstkonto“. Ein eigener, schlanker Weg ohne Google-Bibliothek (R4 der Recherche):
// JWT (RS256) mit dem privaten Schlüssel des Dienstkontos signieren, bei https://oauth2.googleapis.com/token gegen ein Zugriffstoken
// tauschen (OAuth 2.0 für Dienstkonten, „JWT Bearer“, RFC 7523), bis kurz vor Ablauf im Speicher dieses Prozesses merken.
// Der Schlüssel verlässt den Prozess nie; das Token geht nur an die Hosts des Zugangs (lib/ki/adapter/http.ts).
// Dieser Weg ist ein ANDERER als die Google-Verbindung je Person (lib/google/verbindung.ts — Kalender, Gmail): kein Personenkonto,
// sondern das Projekt der Instanz.

import { createSign } from 'node:crypto';
import type { AnbieterId } from '../anbieter';
import type { Dienstkonto } from '../konfig';
import { kiJson, KiAnbieterFehler } from './http';

export const VERTEX_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const merk = new Map<string, { token: string; bis: number }>();
/** Für Tests. */
export const _tokenVergessen = (): void => { merk.clear(); };

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Das signierte JWT (rein bis auf die Signatur) — `jetzt` in Sekunden. */
export function dienstkontoJwt(konto: Dienstkonto, jetzt: number = Math.floor(Date.now() / 1000)): string {
  const kopf = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const inhalt = b64url(JSON.stringify({ iss: konto.client_email, scope: VERTEX_SCOPE, aud: konto.token_uri, iat: jetzt, exp: jetzt + 3600 }));
  const s = createSign('RSA-SHA256');
  s.update(`${kopf}.${inhalt}`);
  return `${kopf}.${inhalt}.${b64url(s.sign(konto.private_key))}`;
}

/** Ein gültiges Zugriffstoken (gemerkt bis 2 Minuten vor Ablauf). */
export async function vertexToken(id: AnbieterId, konto: Dienstkonto): Promise<string> {
  const m = merk.get(konto.client_email);
  if (m && m.bis > Date.now()) return m.token;
  let jwt: string;
  try { jwt = dienstkontoJwt(konto); } catch { throw new KiAnbieterFehler('Dienstkonto-Schlüssel lässt sich nicht verwenden', 0, 'anbieter'); }
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt });
  const r = await kiJson<{ access_token?: string; expires_in?: number }>(id, konto.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString(), timeoutMs: 20_000 });
  if (!r.access_token) throw new KiAnbieterFehler('Google gab kein Zugriffstoken zurück', 0, 'antwort');
  merk.set(konto.client_email, { token: r.access_token, bis: Date.now() + Math.max(60, (r.expires_in ?? 3600) - 120) * 1000 });
  return r.access_token;
}
