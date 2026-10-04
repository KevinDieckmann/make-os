// ─── MAKE OS — Inbox-Status: wem gehört welcher Eintrag? (rein, DSGVO-Prüfung 04.10.) ─────────────────────────────
// Der Bestand `inbox-status` ist EINE Karte für alle (Kennung der Mail → Status). Vorher las und schrieb jede angemeldete
// Person die ganze Karte — auch ein Testkunde aus einem anderen Haushalt, und ein PUT überschrieb die Triage aller.
// Jetzt gilt je Postfach (Plattform-Regel „Trennung serverseitig“):
//   · `gmail-…`  gehört der Person, in deren EIGENEM Gmail-Spiegel die Nachricht bzw. der Thread steht (lib/gmail/stand.ts);
//   · alles andere (Apple-Mail, Microsoft 365) sind die Postfächer des Inhabers (`nurInhaber` in /api/apple-mail und
//     /api/microsoft) — nur der Inhaber sieht und ändert ihren Status.
// Fremde Einträge bleiben beim Schreiben unverändert stehen; die Antwort enthält sie nie.

export type InboxStatusEintrag = { status: string; at: string; bis?: string };
export type InboxStatusMap = Record<string, InboxStatusEintrag>;

export const GMAIL_PRAEFIX = 'gmail-';

export interface InboxEigentum {
  /** Ist die Person der Inhaber (Apple-Mail/M365)? */
  inhaber: boolean;
  /** Schlüssel `gmail-<Thread>` und `gmail-<Nachricht>` aus dem eigenen Gmail-Spiegel. */
  gmail: ReadonlySet<string>;
}

/** Die Gmail-Schlüssel der eigenen Köpfe (Thread und Nachricht — die Oberfläche nimmt den Thread). */
export function gmailSchluessel(koepfe: Record<string, { id?: string; threadId?: string }> | null | undefined): Set<string> {
  const s = new Set<string>();
  for (const k of Object.values(koepfe ?? {})) {
    if (k?.threadId) s.add(`${GMAIL_PRAEFIX}${k.threadId}`);
    if (k?.id) s.add(`${GMAIL_PRAEFIX}${k.id}`);
  }
  return s;
}

/** Gehört dieser Schlüssel zur Sicht der Person? */
export function inboxSchluesselErlaubt(id: string, e: InboxEigentum): boolean {
  return id.startsWith(GMAIL_PRAEFIX) ? e.gmail.has(id) : e.inhaber;
}

/** Nur die Einträge der eigenen Postfächer. */
export function inboxStatusFuer(map: InboxStatusMap | null | undefined, e: InboxEigentum): InboxStatusMap {
  const raus: InboxStatusMap = {};
  for (const [k, v] of Object.entries(map ?? {})) if (inboxSchluesselErlaubt(k, e)) raus[k] = v;
  return raus;
}

/** Ganze Karte ersetzen (PUT) — aber nur den eigenen Teil; fremde Einträge bleiben, fremde Schlüssel im Körper fallen weg. */
export function inboxStatusErsetzen(alt: InboxStatusMap | null | undefined, neu: InboxStatusMap, e: InboxEigentum): InboxStatusMap {
  const raus: InboxStatusMap = {};
  for (const [k, v] of Object.entries(alt ?? {})) if (!inboxSchluesselErlaubt(k, e)) raus[k] = v;
  for (const [k, v] of Object.entries(neu)) if (inboxSchluesselErlaubt(k, e) && v && typeof v === 'object') raus[k] = v;
  return raus;
}
