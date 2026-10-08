// ─── ZOE auf WhatsApp — Einrichtung der ZOE-Nummer aus der Umgebung (Server, 08.10.2026) ─────────────────────────────────
// Kevin 08.10. (R5): „Zweite Business-Nummer nur für ZOE.“ Roadmap Lücke 5: ZOE erreicht euch über eine eigene WhatsApp-Business-
// Nummer — 7-Uhr-Briefing, Wochenstart, Rückblick, Erinnerungen, Sicherheits-Hinweise; je Person mit Einwilligung, Vorlage „Briefing
// bereit“ außerhalb des 24-h-Fensters. Telegram wirkt online nicht (Abholer nur am Mac) und ist ein Drittland-Dienst ohne AVV.
//
// Die ZOE-Nummer gehört der INSTANZ und ist eine EIGENE Konfiguration neben der Business-Nummer (lib/whatsapp/konfig.ts) — andere
// Variablen, eigener Webhook (`/api/zoe/whatsapp/webhook`), eigene Bestände. Die Bausteine der Business-Nummer werden wiederverwendet
// (Graph-Zugriff lib/whatsapp/graph.ts, Signaturprüfung lib/whatsapp/signatur.ts, Fehlertexte lib/whatsapp/fehler.ts).
// Gesetzt NUR über `deploy/zoe-whatsapp-verbinden.sh` (fragt verdeckt, schreibt /srv/make-os/app/.env). Ohne Konfiguration ist alles
// aus: der Webhook antwortet 404, niemand kann verbinden, Hinweise laufen wie bisher (Telegram bzw. gar nicht).
//
//   WHATSAPP_ZOE_TELEFONNUMMER_ID    Telefonnummer-ID der ZOE-Nummer (Ziffern) — NIE dieselbe wie WHATSAPP_TELEFONNUMMER_ID
//   WHATSAPP_ZOE_WABA_ID             WhatsApp-Business-Konto der ZOE-Nummer (für die Vorlage „Briefing bereit“)
//   WHATSAPP_ZOE_ZUGRIFFSSCHLUESSEL  dauerhafter Zugriffsschlüssel eines System-Users
//   WHATSAPP_ZOE_APP_GEHEIMNIS       App-Geheimnis — prüft X-Hub-Signature-256 jedes Webhooks der ZOE-Nummer
//   WHATSAPP_ZOE_VERIFY_TOKEN        Zufallswert für die Verifizierung des Webhooks (GET)
//   WHATSAPP_ZOE_VORLAGE             optional: Name der genehmigten Vorlage (Vorgabe `briefing_bereit`)
//   WHATSAPP_ZOE_VORLAGE_SPRACHE     optional: Sprache der Vorlage (Vorgabe `de`)
//
// Annahme (Meta nennt es so nicht ausdrücklich für zwei Nummern): Meta schickt die Webhooks an die Rückruf-Adresse der APP. Deshalb
// gehört die ZOE-Nummer in eine EIGENE Meta-App (eigenes App-Geheimnis, eigene Rückruf-Adresse). Liegt sie doch in der App der
// Business-Nummer, kommen ihre Meldungen bei /api/whatsapp/webhook an und werden dort als fremde Telefonnummer-ID übersprungen —
// ZOE erführe nichts (UPDATES.md › 08.10. „ZOE auf WhatsApp“).

import { WA_ENV, ZUGRIFF_FORM, GEHEIMNIS_FORM, VERIFY_FORM } from '@/lib/whatsapp/konfig';
import { aussenAdresse } from '@/lib/innen';

export const ZOE_WA_ENV = {
  telefonnummerId: 'WHATSAPP_ZOE_TELEFONNUMMER_ID',
  wabaId: 'WHATSAPP_ZOE_WABA_ID',
  zugriff: 'WHATSAPP_ZOE_ZUGRIFFSSCHLUESSEL',
  appGeheimnis: 'WHATSAPP_ZOE_APP_GEHEIMNIS',
  verifyToken: 'WHATSAPP_ZOE_VERIFY_TOKEN',
  vorlage: 'WHATSAPP_ZOE_VORLAGE',
  vorlageSprache: 'WHATSAPP_ZOE_VORLAGE_SPRACHE',
} as const;

export const ZOE_WEBHOOK_PFAD = '/api/zoe/whatsapp/webhook';
/** Vorgabe der Vorlage außerhalb des 24-h-Fensters (bei Meta als UTILITY einreichen, Text in UPDATES.md). */
export const VORLAGE_VORGABE = { name: 'briefing_bereit', sprache: 'de' } as const;

export interface ZoeWaKonfig {
  telefonnummerId: string;
  wabaId: string;
  zugriff: string;
  appGeheimnis: string;
  verifyToken: string;
  vorlage: { name: string; sprache: string };
}

const ZIFFERN = /^[0-9]{5,25}$/;
const VORLAGE_NAME = /^[a-z0-9_]{1,512}$/;
const VORLAGE_SPRACHE = /^[a-z]{2,3}(_[A-Za-z]{2,4})?$/;
const wert = (env: NodeJS.ProcessEnv, k: string) => (env[k] ?? '').trim();

/** Welche Pflicht-Variablen fehlen bzw. haben keine gültige Form (nur NAMEN — nie Werte). Rein über `env`. */
export function zoeWhatsappFehlend(env: NodeJS.ProcessEnv = process.env): string[] {
  const f: string[] = [];
  if (!ZIFFERN.test(wert(env, ZOE_WA_ENV.telefonnummerId))) f.push(ZOE_WA_ENV.telefonnummerId);
  if (!ZIFFERN.test(wert(env, ZOE_WA_ENV.wabaId))) f.push(ZOE_WA_ENV.wabaId);
  if (!ZUGRIFF_FORM.test(wert(env, ZOE_WA_ENV.zugriff))) f.push(ZOE_WA_ENV.zugriff);
  if (!GEHEIMNIS_FORM.test(wert(env, ZOE_WA_ENV.appGeheimnis))) f.push(ZOE_WA_ENV.appGeheimnis);
  if (!VERIFY_FORM.test(wert(env, ZOE_WA_ENV.verifyToken))) f.push(ZOE_WA_ENV.verifyToken);
  const v = wert(env, ZOE_WA_ENV.vorlage), s = wert(env, ZOE_WA_ENV.vorlageSprache);
  if (v && !VORLAGE_NAME.test(v)) f.push(ZOE_WA_ENV.vorlage);
  if (s && !VORLAGE_SPRACHE.test(s)) f.push(ZOE_WA_ENV.vorlageSprache);
  return f;
}

/**
 * Dieselbe Nummer wie die Business-Nummer? Dann ist die ZOE-Nummer AUS (Hinweise an uns selbst dürfen nie im Business-Postfach der
 * Inbox landen, und Meta kennt je Nummer nur einen Webhook). Rein über `env`.
 */
export function zoeWhatsappKonflikt(env: NodeJS.ProcessEnv = process.env): boolean {
  const zoe = wert(env, ZOE_WA_ENV.telefonnummerId);
  return ZIFFERN.test(zoe) && zoe === wert(env, WA_ENV.telefonnummerId);
}

/** Die Einrichtung — null, solange etwas fehlt oder die Nummer der Business-Nummer gleicht. */
export function zoeWhatsappKonfig(env: NodeJS.ProcessEnv = process.env): ZoeWaKonfig | null {
  if (zoeWhatsappFehlend(env).length || zoeWhatsappKonflikt(env)) return null;
  return {
    telefonnummerId: wert(env, ZOE_WA_ENV.telefonnummerId), wabaId: wert(env, ZOE_WA_ENV.wabaId), zugriff: wert(env, ZOE_WA_ENV.zugriff),
    appGeheimnis: wert(env, ZOE_WA_ENV.appGeheimnis), verifyToken: wert(env, ZOE_WA_ENV.verifyToken),
    vorlage: { name: wert(env, ZOE_WA_ENV.vorlage) || VORLAGE_VORGABE.name, sprache: wert(env, ZOE_WA_ENV.vorlageSprache) || VORLAGE_VORGABE.sprache },
  };
}

export const zoeWhatsappEingerichtet = (env: NodeJS.ProcessEnv = process.env): boolean => zoeWhatsappKonfig(env) !== null;

/**
 * Prüfung beim Start (instrumentation.ts): gleicht die ZOE-Nummer der Business-Nummer, steht es einmal im Log (nur Namen, nie Werte) —
 * und der Head of IT zeigt es rot (lib/hoi/lage.ts `zoeWhatsappBefunde`). Liefert true bei Konflikt.
 */
export function zoeWhatsappStartPruefung(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!zoeWhatsappKonflikt(env)) return false;
  console.error(`[zoe-whatsapp] ${ZOE_WA_ENV.telefonnummerId} gleicht ${WA_ENV.telefonnummerId} — die ZOE-Nummer bleibt AUS. Bitte eine eigene Nummer eintragen (deploy/zoe-whatsapp-verbinden.sh).`);
  return true;
}

/** Die öffentliche HTTPS-Adresse des Webhooks der ZOE-Nummer (für die Anleitung) — null ohne öffentliche Adresse (lokal). */
export function zoeWebhookAdresse(): string | null {
  const a = aussenAdresse();
  if (!a) return null;
  try {
    const u = new URL(a);
    if (u.protocol !== 'https:' || u.hostname === 'localhost' || u.hostname.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return null;
    return `${u.origin}${ZOE_WEBHOOK_PFAD}`;
  } catch { return null; }
}
