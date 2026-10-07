// ─── WhatsApp Business (Cloud API) — Typen und reine Regeln (client-sicher, 07.10.2026, Inbox 2 Paket 5) ────────────
// Kevin 06.10.: eigene, neue Business-Nummer direkt bei Meta (Cloud API — kein Coexistence, kein Drittanbieter, keine inoffiziellen
// Bibliotheken), Bereich MAKE Innovation; ZOE macht alles nur als Vorschlag + Klick. Belegte Fakten: research/inbox/FAKTEN_WHATSAPP_IMAP.md
// (A2–A4) und die offizielle Meta-Doku (Links in lib/whatsapp/*.ts). Was dort nicht steht, ist hier als „Annahme“ markiert.
//
// Diese Datei ist rein (kein Server-Import): das 24-h-Fenster, die Form einer Nachricht im Spiegel, Grenzen, Nummern-Form. Die
// Oberfläche (FensterUhr, VorlagenWaehler) und der Server rechnen mit DENSELBEN Funktionen.

/**
 * Kundenservice-Fenster: startet mit jeder Nachricht (oder jedem Anruf) des Nutzers und dauert 24 Stunden; danach nur genehmigte
 * Vorlagen (Faktendatei A3; https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages).
 */
export const FENSTER_MS = 24 * 3600_000;

export interface Fenster {
  /** Darf gerade frei (ohne Vorlage) geschrieben werden? */
  offen: boolean;
  /** Ende des Fensters (ISO) — null, wenn die Person noch nie geschrieben hat. */
  bis: string | null;
  /** Ganze Minuten bis zum Ende (nur wenn offen). */
  restMin: number | null;
}

/** Das 24-h-Fenster aus der letzten EINGEHENDEN Nachricht (rein, getestet). Grenze exakt: bei `jetzt === bis` ist es zu. */
export function fensterBerechnen(letzteEingehende: string | null | undefined, jetzt: number = Date.now()): Fenster {
  const t = letzteEingehende ? Date.parse(letzteEingehende) : NaN;
  if (!Number.isFinite(t)) return { offen: false, bis: null, restMin: null };
  const bis = t + FENSTER_MS;
  const offen = jetzt < bis;
  return { offen, bis: new Date(bis).toISOString(), restMin: offen ? Math.floor((bis - jetzt) / 60_000) : null };
}

/** Text für die Uhr am Gespräch (rein): „noch 3 Std. 12 Min.“ / „zu — nur Vorlagen“. */
export function fensterText(f: Fenster): string {
  if (!f.bis) return 'Noch keine Nachricht der Person — Erstkontakt nur mit Vorlage';
  if (!f.offen) return 'Fenster zu — nur genehmigte Vorlagen';
  const m = f.restMin ?? 0;
  if (m < 60) return `Fenster offen · noch ${m} Min.`;
  return `Fenster offen · noch ${Math.floor(m / 60)} Std.${m % 60 ? ` ${m % 60} Min.` : ''}`;
}

/** Bald zu (unter 2 Stunden) — die Uhr wird gelb. */
export const fensterKnapp = (f: Fenster): boolean => f.offen && (f.restMin ?? 0) < 120;

// ── Nachrichten im Spiegel ──────────────────────────────────────────────────

/** Arten (Webhook-Typen laut Meta: text, image, document, audio, location, contacts, …; „voice“ ist ein Merkmal von audio). */
export type WaArt = 'text' | 'bild' | 'dokument' | 'audio' | 'sprachnachricht' | 'video' | 'sticker' | 'ort' | 'kontakte' | 'vorlage' | 'sonstiges';
export const WA_ART_WORT: Record<WaArt, string> = {
  text: 'Text', bild: 'Bild', dokument: 'Dokument', audio: 'Audio', sprachnachricht: 'Sprachnachricht', video: 'Video', sticker: 'Sticker',
  ort: 'Standort', kontakte: 'Kontakt', vorlage: 'Vorlage', sonstiges: 'Nachricht (nicht unterstützt)',
};

/**
 * Zustellstand einer GESENDETEN Nachricht. Meta: sent · delivered · read · played (Sprachnachricht abgespielt) · failed
 * (https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status).
 * `angenommen` = die API hat die Nachricht angenommen, noch kein Status-Webhook.
 */
export type WaStatus = 'angenommen' | 'gesendet' | 'zugestellt' | 'gelesen' | 'fehlgeschlagen';
export const WA_STATUS_WORT: Record<WaStatus, string> = { angenommen: 'unterwegs', gesendet: 'gesendet', zugestellt: 'zugestellt', gelesen: 'gelesen', fehlgeschlagen: 'nicht zugestellt' };
const RANG: Record<WaStatus, number> = { angenommen: 0, gesendet: 1, zugestellt: 2, gelesen: 3, fehlgeschlagen: 4 };

/**
 * Den neuen Status übernehmen? (rein) — nie zurück (gelesen bleibt gelesen, auch wenn „zugestellt“ später eintrifft; Webhooks kommen
 * nicht zwingend in Reihenfolge — Annahme, Meta wiederholt bis zu 36 h). „fehlgeschlagen“ gewinnt nur gegen angenommen/gesendet.
 */
export function statusWeiter(alt: WaStatus | undefined, neu: WaStatus): boolean {
  if (!alt) return true;
  if (neu === 'fehlgeschlagen') return alt === 'angenommen' || alt === 'gesendet';
  if (alt === 'fehlgeschlagen') return false;
  return RANG[neu] > RANG[alt];
}

export interface WaMedium {
  /** Medien-ID von Meta (gilt laut Meta 7 Tage nach dem Webhook). */
  mediaId: string;
  mime: string;
  groesse?: number;
  /** Dateiname (nur Dokumente). */
  name?: string;
  /** Prüfsumme laut Webhook (Kodierung bei Meta nicht beschrieben — geprüft wird hex ODER base64). */
  sha256?: string;
  /** Name der verschlüsselten Datei in `<daten>/whatsapp-medien/` (lib/store/bild-ablage.ts). */
  datei?: string;
  zustand: 'offen' | 'abgelegt' | 'fehler' | 'zu-gross' | 'abgelaufen';
  versuche?: number;
  fehler?: string;
}

export interface WaNachricht {
  /** WhatsApp-Nachrichten-ID (WAMID) — die stabile Kennung, auch für die Idempotenz des Webhooks. */
  id: string;
  /** wa_id der Gegenseite (nur Ziffern, international ohne +). */
  nummer: string;
  richtung: 'ein' | 'aus';
  /** Zeitpunkt (ISO) — eingehend aus `timestamp` von Meta, ausgehend die Annahme durch die API. */
  am: string;
  art: WaArt;
  /** Text bzw. Bildunterschrift bzw. Beschreibung (Ort, Kontakt) — höchstens `WA_GRENZEN.text` Zeichen. */
  text: string;
  medium?: WaMedium;
  ort?: { lat: number; lng: number; name?: string; adresse?: string };
  /** Geteilte Kontakte (nur Name + Nummern, nichts weiter). */
  kontakte?: { name: string; telefone: string[] }[];
  /** Nur ausgehend. */
  status?: WaStatus;
  statusAm?: string;
  fehler?: { code: number; text: string };
  /** Wer gesendet hat (Speichername) — nur ausgehend; „[gelöscht]“ nach Konto-Löschung. */
  von?: string;
  vorlage?: { name: string; sprache: string };
  /** Kennung der Nachricht, auf die die Person geantwortet hat (`context.id`, falls Meta ihn liefert). */
  antwortAuf?: string;
}

export interface WaKontakt {
  nummer: string;
  /** Profilname aus WhatsApp (`contacts[].profile.name`) — von der Person selbst gewählt. */
  name?: string;
  /** Letzte EINGEHENDE Nachricht — daraus das 24-h-Fenster. */
  zuletztEingehend?: string;
  /** Gelesen bis (ISO) — gilt für alle, die das geteilte Business-Postfach sehen (Team-Postfach). */
  gelesenBis?: string;
}

/** Grenzen — nie still überschritten (Datenschicht-Regel „ablehnen statt abschneiden“). */
export const WA_GRENZEN = {
  /** Text einer Nachricht (Zeichen). Eigene Grenze (Meta nennt in der Sende-Doku keine Länge — Annahme: 4096). */
  text: 4096,
  /** Rohkörper eines Webhooks (Byte). Eigene Grenze — Meta bündelt höchstens wenige Änderungen je Aufruf (Annahme). */
  koerper: 512 * 1024,
  /** Medien, die MAKE OS ablegt (Byte) — wie Mail-Anhänge (25 MB); Meta erlaubt bis 100 MB für Dokumente, größere bleiben in WhatsApp. */
  medium: 25 * 1024 * 1024,
  /** Ausschnitt in der Liste (Zeichen). */
  ausschnitt: 300,
  /** Parameter einer Vorlage. */
  parameter: 10,
  parameterLaenge: 1000,
  /** Einträge (entry × change × Nachricht) je Webhook, die verarbeitet werden. */
  jeWebhook: 500,
  /** Medien-Downloads je Lauf. */
  medienJeLauf: 5,
  /** Versuche je Medium. */
  medienVersuche: 3,
} as const;

/** wa_id: nur Ziffern (Ländervorwahl ohne +). */
export const WA_NUMMER = /^[0-9]{6,20}$/;
/** WAMID: Meta-Kennung (Base64-ähnlich, mit „wamid.“-Vorsatz). Eigene, großzügige Form. */
export const WA_ID = /^[A-Za-z0-9._=+/:-]{8,200}$/;
export const nummerAnzeige = (n: string): string => (WA_NUMMER.test(n) ? `+${n}` : n);

/** Was der Browser über eine Vorlage erfährt (lib/whatsapp/vorlagen.ts). */
export interface Vorlage {
  name: string;
  sprache: string;
  /** APPROVED · PENDING · REJECTED · PAUSED · DISABLED … (Meta). Senden nur mit APPROVED. */
  status: string;
  /** MARKETING · UTILITY · AUTHENTICATION (Meta). */
  kategorie: string;
  /** Text des Rumpfs mit Platzhaltern ({{1}}, {{2}} … bzw. benannt). */
  text: string;
  /** Platzhalter des Rumpfs in Reihenfolge (z. B. ["1","2"] oder ["vorname"]). */
  parameter: string[];
  kopf?: string;
  fuss?: string;
}

/** Platzhalter einer Vorlage (rein): {{1}}, {{2}} bzw. {{name}} — in der Reihenfolge des ersten Auftretens, ohne Doppelte. */
export function platzhalter(text: string): string[] {
  const raus: string[] = [];
  for (const m of text.matchAll(/\{\{\s*([A-Za-z0-9_]{1,40})\s*\}\}/g)) if (!raus.includes(m[1])) raus.push(m[1]);
  return raus;
}

/** Vorschau einer Vorlage mit den Werten (rein) — so steht die gesendete Vorlage im Verlauf. */
export function vorlageFuellen(text: string, werte: readonly string[]): string {
  const p = platzhalter(text);
  return text.replace(/\{\{\s*([A-Za-z0-9_]{1,40})\s*\}\}/g, (_g, k: string) => { const i = p.indexOf(k); return i >= 0 && werte[i] !== undefined ? werte[i] : `{{${k}}}`; });
}

/** Status der Verbindung für die Karte unter Verbindungen (GET /api/whatsapp/status) — nie Schlüssel, nie Geheimnisse. */
export interface WhatsappStatus {
  ok: true;
  eingerichtet: boolean;
  /** Fehlende Umgebungsvariablen (nur Namen). */
  fehlend: string[];
  /** Darf die angemeldete Person das Business-Postfach sehen? */
  zugang: boolean;
  webhookAdresse: string | null;
  bereich?: string;
  bereichName?: string;
  nummer?: string;
  anzeigename?: string;
  /** GREEN · YELLOW · RED · UNKNOWN (Meta `quality_rating`). */
  qualitaet?: string;
  /** Meta `throughput.level` (z. B. STANDARD). */
  durchsatz?: string;
  telefonAt?: string;
  webhook?: { zuletzt?: string; anzahl: number; abgelehnt: number; zuletztAbgelehnt?: string };
  /** `ok` · `token` (Zugriffsschlüssel ungültig → erneuern) · `fehler` (Meta nicht erreichbar/abgelehnt) · `ungeprueft`. */
  verbindung: 'ok' | 'token' | 'fehler' | 'ungeprueft';
  fehler?: string;
  gespraeche?: number;
  medienOffen?: number;
  /** Aus MAKE OS registriert (Zeitpunkt, Speicherort) — nur Anzeige. */
  registriert?: { am: string; speicherort: 'DE' | 'ohne' };
  /** Darf diese Person registrieren (Inhaber)? */
  inhaber?: boolean;
}
