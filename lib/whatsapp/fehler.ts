// ─── WhatsApp — Fehlercodes von Meta in klare deutsche Sätze (rein, client-sicher, 07.10.2026) ──────────────────────────
// Codes und Titel laut Meta: https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes
// (abgerufen 07.10.2026). Was hier steht, ist unsere Übersetzung + was die Person tun kann; nie Text von Meta ungeprüft an die
// Oberfläche (der kann Kennungen enthalten). `erneuern` = der Zugriffsschlüssel taugt nicht mehr → Glocke „Verbindung erneuern“.

export type WaFehlerArt = 'fenster' | 'vorlage' | 'parameter' | 'nummer' | 'empfaenger' | 'limit' | 'token' | 'gesperrt' | 'medien' | 'netz' | 'unbekannt';

export interface WaFehlerText {
  art: WaFehlerArt;
  text: string;
  /** HTTP-Status für unsere Antwort. */
  status: number;
  /** Der Zugriffsschlüssel ist ungültig/abgelaufen bzw. hat keine Rechte → „Verbindung erneuern“. */
  erneuern: boolean;
}

const T = (art: WaFehlerArt, status: number, text: string, erneuern = false): WaFehlerText => ({ art, status, text, erneuern });

export const FENSTER_ZU = T('fenster', 409, 'Das 24-Stunden-Fenster ist zu: Die Person hat seit über 24 Stunden nicht geschrieben. Frei schreiben geht erst wieder nach ihrer nächsten Nachricht — jetzt bitte eine genehmigte Vorlage wählen.');
const VORLAGE = T('vorlage', 409, 'Die Vorlage ist nicht genehmigt, pausiert, gesperrt oder in dieser Sprache nicht vorhanden — bitte im WhatsApp Manager bei Meta prüfen und eine genehmigte Vorlage wählen.');
const PARAMETER = T('parameter', 400, 'Die Angaben passen nicht zur Vorlage (Anzahl oder Form der Platzhalter) — bitte die Felder prüfen.');
const NUMMER = T('nummer', 409, 'Die Business-Nummer ist (noch) nicht auf der WhatsApp Business Platform registriert — die Registrierung bei Meta abschließen und die Verbindung prüfen.');
const EMPFAENGER = T('empfaenger', 409, 'Die Nachricht ließ sich nicht zustellen — vermutlich nutzt die Nummer WhatsApp nicht (mehr) oder hat die Nachricht nicht angenommen.');
const LIMIT = T('limit', 429, 'Limit erreicht: Meta nimmt gerade keine weiteren Nachrichten an (Durchsatz, zu viele an dieselbe Person oder Tageslimit für neue Gespräche). Bitte später noch einmal.');
export const TOKEN = T('token', 502, 'Die Verbindung zu Meta ist abgelaufen oder hat keine Rechte mehr — bitte „Verbindung erneuern“: neuen dauerhaften Zugriffsschlüssel mit dem Skript whatsapp-verbinden.sh eintragen.', true);
const GESPERRT = T('gesperrt', 409, 'Das WhatsApp-Business-Konto ist bei Meta eingeschränkt oder gesperrt — bitte im Meta Business Manager nachsehen.');
const MEDIEN = T('medien', 502, 'Die Datei ließ sich bei Meta nicht laden — bitte später noch einmal.');

/** Code (und optional Untercode) von Meta → unser Satz (rein, getestet). */
export function metaFehler(code: number | undefined | null, _sub?: number | null): WaFehlerText {
  const c = Number(code);
  if (!Number.isFinite(c)) return T('unbekannt', 502, 'Meta hat die Anfrage abgelehnt (ohne Fehlercode) — bitte später noch einmal.');
  if (c === 131047) return FENSTER_ZU; // „More than 24 hours have passed since the recipient last replied.“
  if ([132001, 132015, 132016, 132007].includes(c)) return VORLAGE; // nicht vorhanden/nicht genehmigt · pausiert · deaktiviert · Richtlinie
  if ([132000, 132012, 132005, 131008, 131009].includes(c)) return PARAMETER;
  if (c === 133010 || c === 133000) return NUMMER;
  // Registrierung: höchstens 10 Versuche je Nummer in 72 Stunden (https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration).
  if (c === 133016) return T('limit', 429, 'Zu viele Registrierungs-Versuche: Meta erlaubt höchstens 10 je Nummer in 72 Stunden — bitte später noch einmal.'); // „Phone number not registered on the WhatsApp Business Platform.“
  if (c === 131026 || c === 131051) return c === 131051 ? T('parameter', 400, 'Diese Art Nachricht unterstützt WhatsApp nicht.') : EMPFAENGER;
  if ([4, 80007, 130429, 131056, 131048, 131049].includes(c)) return LIMIT;
  if (c === 190 || c === 0 || c === 3 || c === 10 || c === 131005 || (c >= 200 && c <= 299)) return TOKEN;
  if (c === 368 || c === 131031) return GESPERRT;
  if (c === 131052 || c === 131053) return MEDIEN;
  return T('unbekannt', 502, `Meta hat die Anfrage abgelehnt (Code ${c}) — bitte später noch einmal; bleibt es, im WhatsApp Manager nachsehen.`);
}

/** Kein Netz zu Meta (Zeitüberschreitung, DNS). */
export const NETZ = T('netz', 503, 'Meta ist gerade nicht erreichbar — bitte gleich noch einmal.');
