// ─── WhatsApp — Einrichtung der Instanz aus der Umgebung (Server, 07.10.2026) ──────────────────────────────────────────
// Die Business-Nummer gehört der INSTANZ (nicht einer Person): sie wird einmal auf dem Server eingetragen — mit
// `deploy/whatsapp-verbinden.sh` (fragt die Werte verdeckt ab und schreibt sie in /srv/make-os/app/.env). Nichts ist im Code verdrahtet
// (Plattform-Regel „instanz-fähig“): Nummer, Konto, Schlüssel, Bereich und wer sie sieht, kommen aus diesen Variablen.
//
//   WHATSAPP_TELEFONNUMMER_ID      Telefonnummer-ID (Phone number ID) aus dem WhatsApp Manager / App-Dashboard — Ziffern
//   WHATSAPP_WABA_ID               ID des WhatsApp-Business-Kontos (WABA) — für die Vorlagen-Liste
//   WHATSAPP_ZUGRIFFSSCHLUESSEL    dauerhafter Zugriffsschlüssel eines System-Users (whatsapp_business_messaging + _management)
//   WHATSAPP_APP_GEHEIMNIS         App-Geheimnis (App Secret) — prüft die Signatur X-Hub-Signature-256 jedes Webhooks
//   WHATSAPP_VERIFY_TOKEN          selbst erzeugter Zufallswert — Meta schickt ihn beim Einrichten des Webhooks (GET) mit
//   WHATSAPP_BEREICH               Bereich der Nummer: eine Business-Gesellschaft (Vorgabe `ug` = MAKE Innovation) oder `g-…` aus dem Register
//   WHATSAPP_PERSONEN              optional: Speichernamen mit Zugang (Komma), sonst alle Konten im Haushalt des Inhabers
//
// Schlüssel und Geheimnis verlassen den Server nie: nicht an den Browser, nicht ins Log, nicht in Antworten (Wächter in den Tests).

import { createHash } from 'node:crypto';
import { istBusinessGesellschaft, istRegisterKennung } from '@/lib/einheiten';
import { aussenAdresse } from '@/lib/innen';

export const WA_ENV = {
  telefonnummerId: 'WHATSAPP_TELEFONNUMMER_ID',
  wabaId: 'WHATSAPP_WABA_ID',
  zugriff: 'WHATSAPP_ZUGRIFFSSCHLUESSEL',
  appGeheimnis: 'WHATSAPP_APP_GEHEIMNIS',
  verifyToken: 'WHATSAPP_VERIFY_TOKEN',
  bereich: 'WHATSAPP_BEREICH',
  personen: 'WHATSAPP_PERSONEN',
} as const;

export const WEBHOOK_PFAD = '/api/whatsapp/webhook';
/** Vorgabe-Bereich: die Gesellschaft `ug` (MAKE Innovation GmbH — Name nur in lib/einheiten.ts). */
export const BEREICH_VORGABE = 'ug';

export interface WaKonfig {
  telefonnummerId: string;
  wabaId: string;
  zugriff: string;
  appGeheimnis: string;
  verifyToken: string;
  /** Bereich der Nummer (immer Business). */
  bereich: string;
  /** Speichernamen mit Zugang — null = alle Konten im Haushalt des Inhabers. */
  personen: string[] | null;
  /** Stabile Postfach-Kennung (`pf-<uuid>` aus der Telefonnummer-ID) — Gespräche `wa~<postfach>~<wa_id>`. */
  postfachId: string;
}

const ZIFFERN = /^[0-9]{5,25}$/;
/** Zugriffsschlüssel von Meta: Buchstaben/Ziffern (Form nicht dokumentiert — Annahme: 50–1024 Zeichen ohne Leerzeichen). */
export const ZUGRIFF_FORM = /^[A-Za-z0-9_.-]{50,1024}$/;
/** App-Geheimnis: 32 Hex-Zeichen (Form im App-Dashboard; Annahme, deshalb großzügig 16–128 Zeichen). */
export const GEHEIMNIS_FORM = /^[A-Za-z0-9]{16,128}$/;
export const VERIFY_FORM = /^[A-Za-z0-9_-]{24,128}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;

/** Ist dieser Bereich für die WhatsApp-Business-Nummer zulässig? Nur Business (nie Privat, nie eine Privat-Einheit). Rein. */
export const bereichZulaessig = (b: string): boolean => istBusinessGesellschaft(b) || istRegisterKennung(b);

/** Die Postfach-Kennung zu einer Telefonnummer-ID (rein, stabil): `pf-` + UUID-Form aus SHA-256. */
export function postfachIdFuer(telefonnummerId: string): string {
  const h = createHash('sha256').update(`make-os|whatsapp|${telefonnummerId}`).digest('hex');
  return `pf-${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const wert = (env: NodeJS.ProcessEnv, k: string) => (env[k] ?? '').trim();

/** Welche Pflicht-Variablen fehlen bzw. haben keine gültige Form (nur Namen — nie Werte). Rein über `env`. */
export function whatsappFehlend(env: NodeJS.ProcessEnv = process.env): string[] {
  const f: string[] = [];
  if (!ZIFFERN.test(wert(env, WA_ENV.telefonnummerId))) f.push(WA_ENV.telefonnummerId);
  if (!ZIFFERN.test(wert(env, WA_ENV.wabaId))) f.push(WA_ENV.wabaId);
  if (!ZUGRIFF_FORM.test(wert(env, WA_ENV.zugriff))) f.push(WA_ENV.zugriff);
  if (!GEHEIMNIS_FORM.test(wert(env, WA_ENV.appGeheimnis))) f.push(WA_ENV.appGeheimnis);
  if (!VERIFY_FORM.test(wert(env, WA_ENV.verifyToken))) f.push(WA_ENV.verifyToken);
  const b = wert(env, WA_ENV.bereich) || BEREICH_VORGABE;
  if (!bereichZulaessig(b)) f.push(WA_ENV.bereich);
  return f;
}

/** Die Einrichtung — null, solange etwas fehlt (dann ist WhatsApp „nicht eingerichtet“, kein Webhook nimmt etwas an). */
export function whatsappKonfig(env: NodeJS.ProcessEnv = process.env): WaKonfig | null {
  if (whatsappFehlend(env).length) return null;
  const telefonnummerId = wert(env, WA_ENV.telefonnummerId);
  const personenRoh = wert(env, WA_ENV.personen);
  const personen = personenRoh ? personenRoh.split(',').map(p => p.trim()).filter(p => PERSON.test(p)) : null;
  return {
    telefonnummerId, wabaId: wert(env, WA_ENV.wabaId), zugriff: wert(env, WA_ENV.zugriff), appGeheimnis: wert(env, WA_ENV.appGeheimnis),
    verifyToken: wert(env, WA_ENV.verifyToken), bereich: wert(env, WA_ENV.bereich) || BEREICH_VORGABE,
    personen: personen && personen.length ? personen : null, postfachId: postfachIdFuer(telefonnummerId),
  };
}

export const whatsappEingerichtet = (env: NodeJS.ProcessEnv = process.env): boolean => whatsappKonfig(env) !== null;

/** Die öffentliche HTTPS-Adresse des Webhooks (für die Anleitung) — null ohne öffentliche Adresse (lokal). */
export function webhookAdresse(): string | null {
  const a = aussenAdresse();
  if (!a) return null;
  try {
    const u = new URL(a);
    if (u.protocol !== 'https:' || u.hostname === 'localhost' || u.hostname.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return null;
    return `${u.origin}${WEBHOOK_PFAD}`;
  } catch { return null; }
}
