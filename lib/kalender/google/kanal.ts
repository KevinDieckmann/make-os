// ─── Google Kalender — Push-Kanal (events.watch) und Webhook (Server, 03.10.2026) ─
// Änderungen in Google kommen „nahezu sofort“: Google ruft `POST /api/kalender/google/meldung` auf, sobald sich der
// Kalender ändert. Der Webhook liefert KEINE Daten (Google schickt nur Kopfzeilen) — er stößt nur einen Abgleich an.
//
// Sicherheit (der Webhook hat keine Sitzung):
//   · Kanal je Person; Kennung `mk-<person>-<24 hex>`, Token 32 Zufallsbytes — im Bestand nur als SHA-256
//   · akzeptiert nur mit passender Kanal-Kennung + Token (konstante Zeit) + Ressourcen-ID; sonst 403 ohne Inhalt
//   · Fehlversuche je Netz gedrosselt (lib/zugang/drossel.ts), erlaubte Anstöße je Person höchstens alle 5 s
//   · Google verlangt eine ÖFFENTLICHE HTTPS-Adresse: ohne (lokal, sslip ohne Zertifikat) gibt es keinen Kanal — der
//     Takt gleicht dann alle 5 Min. ab (Rückfall, `kanalSicherstellen` → 'aus')
// Erneuerung: ein Kanal lebt höchstens ~7 Tage; der Takt (jede Minute) erneuert ihn ab 36 Stunden Restlaufzeit — der neue
// Kanal steht, BEVOR der alte gestoppt wird (keine Lücke).

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { aussenAdresse } from '@/lib/innen';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { googleAnfrage } from '@/lib/google/http';
import { ladeGoogleStand, aendereGoogleStand, type GoogleKalenderStand, type KanalStand } from './stand';

export const WEBHOOK_PFAD = '/api/kalender/google/meldung';
const API = 'https://www.googleapis.com/calendar/v3';
const TTL_SEK = 7 * 24 * 3600;
/** Ab so viel Restlaufzeit wird erneuert. */
export const ERNEUERN_AB_MS = 36 * 3600_000;
const ID = /^mk-([a-z0-9-]{1,40})-[a-f0-9]{24}$/;

const sha = (t: string) => createHash('sha256').update(t).digest();

/** Die öffentliche HTTPS-Adresse des Webhooks — null, wenn es keine gibt (lokal, ohne Zertifikat). */
export function webhookAdresse(): string | null {
  const a = aussenAdresse();
  if (!a) return null;
  try {
    const u = new URL(a);
    if (u.protocol !== 'https:') return null;
    if (u.hostname === 'localhost' || u.hostname.endsWith('.local') || u.hostname.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return null;
    return `${u.origin}${WEBHOOK_PFAD}`;
  } catch { return null; }
}

/** Die Person aus einer Kanal-Kennung — null bei jeder fremden Form. */
export const personAusKanalId = (id: string | null | undefined): string | null => ID.exec(id ?? '')?.[1] ?? null;

/** Passt ein Aufruf zum Kanal? Kennung, Ressourcen-ID und Token (SHA-256, konstante Zeit). Rein. */
export function meldungPasst(k: Pick<KanalStand, 'id' | 'tokenHash' | 'resourceId'> | undefined, kopf: { kanal?: string | null; token?: string | null; ressource?: string | null }): boolean {
  if (!k || !kopf.kanal || !kopf.token || !kopf.ressource) return false;
  const a = sha(kopf.token), b = Buffer.from(k.tokenHash, 'hex');
  const tokenOk = a.length === b.length && timingSafeEqual(a, b);
  // Beides immer vergleichen (kein früher Abbruch, der etwas verriete).
  const idOk = k.id === kopf.kanal, resOk = k.resourceId === kopf.ressource;
  return tokenOk && idOk && resOk;
}

async function kanalAnlegen(person: string, stand: GoogleKalenderStand, adresse: string, jetzt: number): Promise<KanalStand> {
  const id = `mk-${person}-${randomBytes(12).toString('hex')}`;
  const token = randomBytes(32).toString('hex');
  const r = await googleAnfrage<{ resourceId?: string; expiration?: string }>(person, 'kalender', `${API}/calendars/${encodeURIComponent(stand.kalenderId)}/events/watch`, {
    method: 'POST', body: { id, type: 'web_hook', address: adresse, token, params: { ttl: String(TTL_SEK) } },
  });
  if (r.status !== 200 || !r.json.resourceId) throw new Error(`Push-Kanal nicht angelegt (${r.status}).`);
  const ablauf = Number(r.json.expiration);
  return { id, tokenHash: sha(token).toString('hex'), resourceId: r.json.resourceId, ablauf: Number.isFinite(ablauf) && ablauf > jetzt ? ablauf : jetzt + TTL_SEK * 1000, adresse, angelegt: new Date(jetzt).toISOString() };
}

/** Einen Kanal bei Google stoppen (Fehler egal — er läuft sonst von selbst ab). */
export async function kanalStoppenFuer(person: string, stand: Pick<GoogleKalenderStand, 'kanal'>): Promise<void> {
  const k = stand.kanal;
  if (!k) return;
  await googleAnfrage(person, 'kalender', `${API}/channels/stop`, { method: 'POST', body: { id: k.id, resourceId: k.resourceId } }).catch(() => { /* läuft von selbst ab */ });
}

export type KanalErgebnis = 'aus' | 'aktiv' | 'neu' | 'erneuert' | 'fehler';

/**
 * Sorgt dafür, dass ein Kanal läuft: keiner → neu; bald ablaufend → neuer Kanal, dann den alten stoppen; sonst nichts.
 * Ohne öffentliche HTTPS-Adresse: 'aus' (Rückfall: Abfrage alle 5 Min.). Ein Fehler stört nie den Abgleich.
 */
export async function kanalSicherstellen(person: string, jetzt = Date.now()): Promise<KanalErgebnis> {
  const adresse = webhookAdresse();
  const stand = await ladeGoogleStand(person);
  if (!stand) return 'aus';
  if (!adresse) return 'aus';
  const alt = stand.kanal;
  if (alt && alt.adresse === adresse && alt.ablauf - jetzt > ERNEUERN_AB_MS) return 'aktiv';
  try {
    const neu = await kanalAnlegen(person, stand, adresse, jetzt);
    await aendereGoogleStand(person, cur => ({ ...cur, kanal: neu }));
    if (alt) await kanalStoppenFuer(person, { kanal: alt });
    return alt ? 'erneuert' : 'neu';
  } catch (e) {
    console.warn(`[kalender-google] Push-Kanal: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
    return 'fehler';
  }
}

// ── Webhook ─────────────────────────────────────────────────────────────────

const letzterAnstoss = new Map<string, number>();
/** Mindestabstand zwischen zwei angestoßenen Abgleichen je Person (Schutz vor Meldungs-Fluten). */
export const ANSTOSS_MS = 5_000;

export interface MeldungsKopf { get(n: string): string | null }
export type MeldungsErgebnis = { status: 200; angestossen: boolean } | { status: 403 | 429 };

/**
 * Eine Meldung von Google prüfen und — nur dann — einen Abgleich anstoßen (im Hintergrund, über `anstossen`). Gibt nie
 * Daten zurück. `sync` (die erste Meldung nach dem Anlegen des Kanals) stößt nichts an.
 */
export async function meldungVerarbeiten(req: { headers: MeldungsKopf }, anstossen: (person: string) => void, jetzt = Date.now()): Promise<MeldungsErgebnis> {
  const netz = `gkanal:${adresseNetz(req as unknown as Request)}`;
  if (!pruefe(netz, jetzt).erlaubt) return { status: 429 };
  const kopf = { kanal: req.headers.get('x-goog-channel-id'), token: req.headers.get('x-goog-channel-token'), ressource: req.headers.get('x-goog-resource-id') };
  const person = personAusKanalId(kopf.kanal);
  const stand = person ? await ladeGoogleStand(person).catch(() => null) : null;
  if (!person || !meldungPasst(stand?.kanal, kopf)) { fehlschlag(netz, jetzt, 10); return { status: 403 }; }
  const zustand = req.headers.get('x-goog-resource-state');
  if (zustand === 'sync') return { status: 200, angestossen: false };
  const zuletzt = letzterAnstoss.get(person) ?? 0;
  if (jetzt - zuletzt < ANSTOSS_MS) return { status: 200, angestossen: false };
  letzterAnstoss.set(person, jetzt);
  anstossen(person);
  return { status: 200, angestossen: true };
}

/** Nur für Tests. */
export const _anstossZuruecksetzen = () => letzterAnstoss.clear();
