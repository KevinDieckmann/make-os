// ─── Prozesse — der abgesicherte Webhook: Schlüssel, Annehmen, Frist (Server, Etappe B1, 21.10.; Entscheidung 21.10.: „Ja, abgesichert“) ─────────────────
// Reine Regeln: lib/prozesse/webhook.ts. Hier nur, was Zufall, Hash, Bestände und das Ereignis-System braucht:
//   · `webhookVerwalten` — Schlüssel anlegen/erneuern (32 Byte Zufall, genau einmal in der Antwort, gespeichert nur als SHA-256), scharf, entfernen;
//   · `webhookAnnehmen` — für die offene Route: Adresse scharf? Schlüssel (zeitkonstant)? Felder nach Schema → Eingang ablegen (fremder Text) → EIN Ereignis
//     `webhook` (nur Kennungen) über `ereignis()`. Gestartet wird nichts — das macht der Motor (Etappe C). Jede Ablehnungsart antwortet gleich (404);
//   · `webhookFristAnwenden` — Löschfristen-Lauf: Eingänge vor der Frist „ereignisse“ fallen weg.

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { EINGANG_KENNUNG, type WebhookEingang, type WebhookEintrag } from './definition';
import { annahmeLage, eingaengeFrist, eingangAblegen, koerperFiltern, webhookAnwenden, webhookKurz, type WebhookErgebnis } from './webhook';
import { webhooksAus } from './bestand';
import { prozesseHaushalt, prozesseLesen, webhooksAendern, webhooksLesen } from './werkstatt-server';
import type { ProzessRechte } from './rollen';

/** SHA-256 (hex) eines Schlüssels. */
export const schluesselHash = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
/** Neue Adresse (`pw-<24 hex>`, 96 Bit) und neuer Schlüssel (32 Byte base64url) samt Fingerabdruck. */
export function webhookNeu(): { kennung: string; schluessel: string; hash: string } {
  const schluessel = randomBytes(32).toString('base64url');
  return { kennung: `pw-${randomBytes(12).toString('hex')}`, schluessel, hash: schluesselHash(schluessel) };
}
/** Schlüssel gegen den gespeicherten Fingerabdruck — zeitkonstant. */
export function schluesselPasst(schluessel: string, hash: string): boolean {
  const a = Buffer.from(schluesselHash(schluessel), 'hex'), b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook verwalten (Werkstatt-Route): Schlüssel, scharf, entfernen — nur volle Mitglieder. Die Antwort trägt den Schlüssel genau einmal. */
export async function webhookVerwalten(person: string, rechte: ProzessRechte, eingabe: Record<string, unknown>, h?: string): Promise<WebhookErgebnis> {
  const haushalt = h ?? await prozesseHaushalt();
  const prozess = (await prozesseLesen(haushalt)).prozesse.find(p => p.id === eingabe.id) ?? null;
  const neu = eingabe.aktion === 'webhook-schluessel' ? webhookNeu() : undefined;
  const jetzt = new Date().toISOString();
  const r = await webhooksAendern<{ eintrag: WebhookEintrag | null; geheim?: { adresse: string; schluessel: string } }>(
    d => webhookAnwenden(d, eingabe, { person, jetzt, rechte, prozess, ...(neu ? { neu } : {}) }),
    { art: 'person', person }, haushalt,
  );
  // Die Sperre gibt das Ergebnis der reinen Regel unverändert zurück (bei „nein“ samt Status und Satz).
  return r as unknown as WebhookErgebnis;
}

/** Wie die Webhooks eines Haushalts ohne Geheimnisse aussehen (je Prozess). */
export async function webhooksKurz(h?: string) {
  return (await webhooksLesen(h)).webhooks.map(webhookKurz);
}

/** Stichtag der Frist „ereignisse“ (ISO) — ältere Eingänge fallen weg (dieselbe Frist wie die Ereignisse, die auf sie zeigen). */
async function fristAb(jetzt: Date): Promise<string> {
  const { LOESCHFRISTEN_SPEICHER, fristenWirksam, stichtag } = await import('@/lib/crm/loeschfristen');
  const b = await loadJson<{ fristen?: Record<string, number> }>(LOESCHFRISTEN_SPEICHER).catch(() => null);
  const f = fristenWirksam(b?.fristen ?? null);
  return `${stichtag('ereignisse', f.ereignisse, localDay(jetzt))}T00:00:00.000Z`;
}

export type AnnahmeErgebnis = { status: 202; eingang: string } | { status: 400; fehler: string[] } | { status: 404 } | { status: 503 };

/**
 * Einen Aufruf von außen annehmen (offene Route): unbekannt, nicht scharf, ohne bzw. mit falschem Schlüssel → 404 (eine Antwort für alles; die Route
 * zählt Fehlversuche je Netz); Felder nach Schema (400 nennt nur Feld-Kennungen); Eingang ablegen (über der Grenze 503 — nie gekürzt); dann EIN Ereignis.
 */
export async function webhookAnnehmen(kennung: string, schluessel: string | null, koerper: unknown, jetzt = new Date()): Promise<AnnahmeErgebnis> {
  const h = await prozesseHaushalt();
  const prozesse = (await prozesseLesen(h)).prozesse;
  const lage = annahmeLage(await webhooksLesen(h), kennung, prozesse);
  if (!lage || !schluessel || !schluesselPasst(schluessel, lage.webhook.schluesselHash)) return { status: 404 };
  const f = koerperFiltern(lage.ausloeser.felder, koerper);
  if (!f.ok) return { status: 400, fehler: f.fehler };
  const id = neueKennung('we');
  if (!EINGANG_KENNUNG.test(id)) return { status: 503 };
  const am = jetzt.toISOString();
  const eingang: WebhookEingang = { id, prozessId: lage.prozess.id, version: lage.version, am, felder: f.felder, fremd: true };
  const ab = await fristAb(jetzt);
  let voll = false;
  const r = await webhooksAendern<object>(d => {
    // In der Sperre noch einmal: scharf, derselbe Schlüssel (zwischen Lesen und Schreiben erneuert/abgeschaltet → nichts).
    const jetztLage = annahmeLage(d, kennung, prozesse);
    if (!jetztLage || jetztLage.webhook.schluesselHash !== lage.webhook.schluesselHash) return { ok: false };
    const x = eingangAblegen(d, eingang, ab);
    if (!x.ok) { voll = true; return { ok: false }; }
    return { ok: true, datei: x.datei };
  }, { art: 'system' }, h);
  if (voll) return { status: 503 };
  if (!r.ok) return { status: 404 };
  const { ereignis } = await import('@/lib/ereignisse/server');
  const { ereignisKennung } = await import('@/lib/ereignisse/typen');
  await ereignis({ id: ereignisKennung('webhook', lage.prozess.id, id), art: 'webhook', quelle: 'webhook', bezug: { prozessId: lage.prozess.id, eingangId: id }, bereich: 'business' }, { jetzt });
  return { status: 202, eingang: id };
}

/** Ein Eingang für einen Prompt (Motor, Etappe C): nur gekapselt als fremder Text — nie eine Anweisung. */
export async function eingangFuerPrompt(e: Pick<WebhookEingang, 'felder'>): Promise<string> {
  const { fremd } = await import('@/lib/anthropic');
  return fremd('webhook', JSON.stringify(e.felder));
}

/** Löschfristen-Lauf: Eingänge vor der Frist „ereignisse“ entfernen. Liefert die Zahl der entfernten. */
export async function webhookFristAnwenden(name: string, jetzt = new Date()): Promise<number> {
  if ((await loadJson<unknown>(name)) === null) return 0;
  const ab = await fristAb(jetzt);
  let n = 0;
  await updateJson<unknown>(name, cur => { const r = eingaengeFrist(webhooksAus(cur), ab); n = r.n; return n ? r.datei : cur; });
  return n;
}
