// ─── Gmail — Echtzeit per Pub/Sub-Push (Server, 03.10.2026) ──────────────────
// OPTIONAL. Ohne Pub/Sub-Einrichtung fragt der Takt alle 2 Minuten (lib/gmail/takt.ts) — nichts bricht. Mit Einrichtung ruft
// `users.watch` Google dazu auf, bei jeder Änderung eine Nachricht an ein Pub/Sub-Thema zu legen; die Push-Subscription ruft
// `POST /api/google/gmail/meldung` (ohne Sitzung, ohne Origin) — der Webhook stößt höchstens einen Abgleich an.
//
// Sicherheit (der Webhook hat keine Sitzung):
//   · Pub/Sub hängt an jeden Push ein OIDC-Token (`Authorization: Bearer <JWT>`), signiert von Google. Geprüft wird: Signatur
//     (RS256 gegen Googles öffentliche Schlüssel, `kid`), `iss` = accounts.google.com, `aud` = die konfigurierte Audience,
//     `email` = das konfigurierte Dienstkonto der Subscription (+ `email_verified`), `exp`/`iat`. Alles Konfigurierbare kommt aus
//     der Umgebung (GMAIL_PUSH_AUDIENCE, GMAIL_PUSH_DIENSTKONTO) — fehlt etwas, antwortet der Webhook IMMER 403.
//   · Fehlversuche je Netz gedrosselt (lib/zugang/drossel.ts, 429); erlaubte Anstöße je Person höchstens alle 5 Sekunden
//   · liefert NIE Daten: die Antwort ist leer; der Inhalt der Meldung (`emailAddress`, `historyId`) wählt nur die Person aus
//   · Pub/Sub braucht eine ÖFFENTLICHE HTTPS-Adresse; lokal gibt es keinen Push (Takt-Rückfall)
// Umgebung: GMAIL_PUBSUB_THEMA (`projects/<id>/topics/<name>`), GMAIL_PUSH_DIENSTKONTO (E-Mail des Dienstkontos, mit dem die
// Subscription das Token signiert), GMAIL_PUSH_AUDIENCE (optional, Standard = die Webhook-Adresse). Anleitung: GOOGLE_GMAIL_EINRICHTEN.md.
// `users.watch` läuft höchstens 7 Tage — der Takt erneuert ab 3 Tagen Restlaufzeit.

import { createPublicKey, verify } from 'node:crypto';
import { aussenAdresse } from '@/lib/innen';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { alleSpeicher } from '@/lib/zugang/konten';
import { googleAnfrage } from '@/lib/google/http';
import { ladeVerbindung } from '@/lib/google/verbindung';
import { GMAIL_API, gmailAbgleichen, gmailBereit } from './abgleich';
import { aendereGmailStand, ladeGmailStand } from './stand';

export const GMAIL_WEBHOOK_PFAD = '/api/google/gmail/meldung';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
export const WATCH_ERNEUERN_AB_MS = 3 * 24 * 3600_000;

/** Die öffentliche HTTPS-Adresse des Webhooks — null, wenn es keine gibt (lokal, ohne Zertifikat). */
export function gmailWebhookAdresse(): string | null {
  const a = aussenAdresse();
  if (!a) return null;
  try {
    const u = new URL(a);
    if (u.protocol !== 'https:') return null;
    if (u.hostname === 'localhost' || u.hostname.endsWith('.local') || u.hostname.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return null;
    return `${u.origin}${GMAIL_WEBHOOK_PFAD}`;
  } catch { return null; }
}

export interface PushKonfig { thema: string; dienstkonto: string; audience: string }
const THEMA = /^projects\/[a-z][a-z0-9-]{4,60}\/topics\/[A-Za-z][A-Za-z0-9._~%+-]{2,254}$/;

/** Die Push-Einrichtung aus der Umgebung — null, solange Thema, Dienstkonto oder öffentliche Adresse fehlen. */
export function pushKonfig(): PushKonfig | null {
  const thema = (process.env.GMAIL_PUBSUB_THEMA ?? '').trim();
  const dienstkonto = (process.env.GMAIL_PUSH_DIENSTKONTO ?? '').trim().toLowerCase();
  const adresse = gmailWebhookAdresse();
  const audience = (process.env.GMAIL_PUSH_AUDIENCE ?? '').trim() || adresse || '';
  if (!THEMA.test(thema) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dienstkonto) || !audience) return null;
  return { thema, dienstkonto, audience };
}

// ── OIDC-Token prüfen ───────────────────────────────────────────────────────

interface Jwk { kid?: string; kty?: string; n?: string; e?: string; alg?: string; use?: string }
let jwksMerk: { at: number; keys: Jwk[] } | null = null;
/** Nur für Tests. */
export const _jwksZuruecksetzen = () => { jwksMerk = null; };

async function schluessel(jetzt: number, neuLaden = false): Promise<Jwk[]> {
  if (!neuLaden && jwksMerk && jetzt - jwksMerk.at < 3600_000) return jwksMerk.keys;
  try {
    const r = await fetch(JWKS_URL, { redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
    const j = await r.json() as { keys?: Jwk[] };
    const keys = Array.isArray(j.keys) ? j.keys.filter(k => k.kty === 'RSA' && k.n && k.e) : [];
    if (r.ok && keys.length) jwksMerk = { at: jetzt, keys };
  } catch { /* alter Stand bleibt */ }
  return jwksMerk?.keys ?? [];
}

const teil = (s: string): Buffer => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Ein OIDC-Token von Pub/Sub prüfen (rein bis auf das Holen der öffentlichen Schlüssel). Wirft nie: `false` bei allem Unpassenden.
 */
export async function oidcPruefen(token: string | null | undefined, konfig: Pick<PushKonfig, 'audience' | 'dienstkonto'>, jetzt = Date.now()): Promise<boolean> {
  try {
    const t = String(token ?? '').replace(/^Bearer\s+/i, '').trim();
    const teile = t.split('.');
    if (teile.length !== 3 || t.length > 4000) return false;
    const kopf = JSON.parse(teil(teile[0]).toString('utf8')) as { alg?: string; kid?: string };
    const nutz = JSON.parse(teil(teile[1]).toString('utf8')) as { iss?: string; aud?: string | string[]; email?: string; email_verified?: boolean; exp?: number; iat?: number };
    if (kopf.alg !== 'RS256' || !kopf.kid) return false;
    let jwk = (await schluessel(jetzt)).find(k => k.kid === kopf.kid);
    if (!jwk) jwk = (await schluessel(jetzt, true)).find(k => k.kid === kopf.kid);
    if (!jwk) return false;
    const key = createPublicKey({ key: { kty: 'RSA', n: jwk.n!, e: jwk.e! }, format: 'jwk' });
    const ok = verify('RSA-SHA256', Buffer.from(`${teile[0]}.${teile[1]}`), key, teil(teile[2]));
    if (!ok) return false;
    const aud = Array.isArray(nutz.aud) ? nutz.aud : [nutz.aud ?? ''];
    const sek = jetzt / 1000;
    return (nutz.iss === 'https://accounts.google.com' || nutz.iss === 'accounts.google.com')
      && aud.includes(konfig.audience)
      && (nutz.email ?? '').toLowerCase() === konfig.dienstkonto
      && nutz.email_verified !== false
      && typeof nutz.exp === 'number' && nutz.exp > sek - 60
      && (typeof nutz.iat !== 'number' || nutz.iat < sek + 300);
  } catch { return false; }
}

// ── Webhook ─────────────────────────────────────────────────────────────────

const letzterAnstoss = new Map<string, number>();
export const ANSTOSS_MS = 5_000;
/** Nur für Tests. */
export const _gmailAnstossZuruecksetzen = () => letzterAnstoss.clear();

export type PushErgebnis = { status: 200; angestossen: boolean } | { status: 400 | 403 | 429 };

/** Die Person zu einer Postfach-Adresse (nur Personen mit Gmail-Verbindung). */
export async function personZuPostfach(adresse: string): Promise<string | null> {
  const a = adresse.trim().toLowerCase();
  for (const p of await alleSpeicher().catch(() => [] as string[])) {
    const v = await ladeVerbindung(p);
    if (v && v.status === 'verbunden' && v.funktionen.includes('gmail') && v.email === a) return p;
  }
  return null;
}

/**
 * Eine Push-Meldung prüfen und — nur dann — einen Abgleich anstoßen (im Hintergrund, über `anstossen`). Gibt nie Daten zurück.
 * Ohne vollständige Einrichtung oder bei falschem Token: 403 (Fehlversuche je Netz gedrosselt).
 */
export async function pushVerarbeiten(req: { headers: { get(n: string): string | null }; text(): Promise<string> }, anstossen: (person: string) => void, jetzt = Date.now()): Promise<PushErgebnis> {
  const netz = `gpush:${adresseNetz(req as unknown as Request)}`;
  if (!pruefe(netz, jetzt).erlaubt) return { status: 429 };
  const konfig = pushKonfig();
  if (!konfig || !(await oidcPruefen(req.headers.get('authorization'), konfig, jetzt))) { fehlschlag(netz, jetzt, 10); return { status: 403 }; }
  let adresse = '';
  try {
    const roh = JSON.parse(await req.text()) as { message?: { data?: string } };
    const daten = JSON.parse(Buffer.from(String(roh.message?.data ?? ''), 'base64').toString('utf8')) as { emailAddress?: string };
    adresse = String(daten.emailAddress ?? '');
  } catch { return { status: 400 }; }
  const person = adresse ? await personZuPostfach(adresse) : null;
  if (!person) return { status: 200, angestossen: false }; // unbekanntes Postfach: bestätigen (kein Wiederholen), nichts tun
  const zuletzt = letzterAnstoss.get(person) ?? 0;
  if (jetzt - zuletzt < ANSTOSS_MS) return { status: 200, angestossen: false };
  letzterAnstoss.set(person, jetzt);
  anstossen(person);
  return { status: 200, angestossen: true };
}

/** Stößt den Abgleich an (Hintergrund). */
export const anstossenAbgleich = (person: string): void => { void gmailAbgleichen(person, { nachlauf: true }).catch(() => { /* der Fehler steht im Stand */ }); };

// ── users.watch ─────────────────────────────────────────────────────────────

export type WatchErgebnis = 'aus' | 'aktiv' | 'neu' | 'erneuert' | 'fehler';

/** Sorgt dafür, dass `users.watch` läuft (keiner → neu; bald ablaufend → erneuert). Ohne Einrichtung: 'aus' (Takt-Rückfall). */
export async function watchSicherstellen(person: string, jetzt = Date.now()): Promise<WatchErgebnis> {
  const konfig = pushKonfig();
  if (!konfig) return 'aus';
  const s = await ladeGmailStand(person);
  if (!s || !(await gmailBereit(person))) return 'aus';
  if (s.watch && s.watch.ablauf - jetzt > WATCH_ERNEUERN_AB_MS) return 'aktiv';
  try {
    const r = await googleAnfrage<{ historyId?: string; expiration?: string }>(person, 'gmail', `${GMAIL_API}/watch`, {
      method: 'POST', body: { topicName: konfig.thema, labelIds: ['INBOX', 'SENT'], labelFilterBehavior: 'INCLUDE' },
    });
    if (r.status !== 200 || !r.json.expiration) throw new Error(`watch ${r.status}`);
    const ablauf = Number(r.json.expiration);
    await aendereGmailStand(person, cur => ({ ...cur, watch: { ablauf: Number.isFinite(ablauf) && ablauf > jetzt ? ablauf : jetzt + 7 * 24 * 3600_000, angelegt: new Date(jetzt).toISOString() } }));
    return s.watch ? 'erneuert' : 'neu';
  } catch (e) {
    console.warn(`[gmail] watch: ${e instanceof Error ? e.message.slice(0, 80) : 'Fehler'}`);
    return 'fehler';
  }
}

/** `users.stop` (Fehler egal — die Überwachung läuft sonst von selbst ab). */
export async function watchStoppen(person: string): Promise<void> {
  await googleAnfrage(person, 'gmail', `${GMAIL_API}/stop`, { method: 'POST', body: {} }).catch(() => { /* läuft von selbst ab */ });
}
