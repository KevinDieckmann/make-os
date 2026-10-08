// ─── ZOE auf WhatsApp — Webhook der ZOE-Nummer prüfen und annehmen (Server, 08.10.2026) ───────────────────────────────────
// Wie bei der Business-Nummer (lib/whatsapp/webhook.ts), aber mit der EIGENEN Konfiguration und eigenen Beständen:
//   1. Körpergrenze (512 KB) — größer → 413; Drossel je Netz
//   2. Signatur `X-Hub-Signature-256` über den ROHEN Körper mit dem App-Geheimnis der ZOE-Nummer (lib/whatsapp/signatur.ts) → sonst 403
//   3. nur Meldungen für UNSERE Telefonnummer-ID (`metadata.phone_number_id`); die Form einer Nachricht liest `nachrichtAus`
//      (lib/whatsapp/spiegel.ts, rein — derselbe Leser wie die Business-Nummer)
//   4. Absender → Person (verbunden bzw. wartend auf den Code): die Nachricht kommt in den kurzlebigen EINGANG dieser Person
//      (idempotent über die WAMID — Meta wiederholt bis zu 36 h); fremde Nummern: NUR ein Zähler, nichts gespeichert, keine Antwort
//   5. schnell 200 (leer) — verarbeitet wird danach (`after` in der Route, sonst im Takt: lib/zoe-whatsapp/eingang.ts)
// Schlägt das Speichern fehl → 500 (Meta liefert erneut). Die Antwort enthält NIE Daten.

import { pruefe, fehlschlag, erfolg } from '@/lib/zugang/drossel';
import { signaturGueltig } from '@/lib/whatsapp/signatur';
import { nachrichtAus, type WebhookKoerper } from '@/lib/whatsapp/spiegel';
import { WA_GRENZEN, type WaNachricht } from '@/lib/whatsapp/typen';
import type { ZoeWaKonfig } from './konfig';
import { KANAL_GRENZEN, type EingangEintrag } from './kanal';
import { aendereKanal, aendereZoeZustand, personFuerNummer } from './speicher';

export type ZoeWebhookAntwort = { status: 200; personen: string[] } | { status: 400 | 403 | 413 | 429 | 500 };

/** Eine Nachricht → Eintrag im Eingang (rein). Nur Text und Sprachnachrichten werden gelesen; anderes nur als „sonstiges“ (ohne Inhalt). */
export function eingangAus(m: WaNachricht): EingangEintrag {
  const basis = { wamid: m.id, am: m.am, ...(m.antwortAuf ? { antwortAuf: m.antwortAuf } : {}) };
  if (m.art === 'text') return { ...basis, art: 'text', text: m.text };
  if ((m.art === 'sprachnachricht' || m.art === 'audio') && m.medium) {
    return { ...basis, art: 'sprachnachricht', medium: { mediaId: m.medium.mediaId, mime: m.medium.mime, ...(m.medium.sha256 ? { sha256: m.medium.sha256 } : {}), ...(m.medium.groesse ? { groesse: m.medium.groesse } : {}) } };
  }
  return { ...basis, art: 'sonstiges' };
}

/** Nachrichten und fehlgeschlagene Zustellungen für unsere Nummer aus dem Körper (rein). */
export function webhookLesen(koerper: WebhookKoerper, telefonnummerId: string, jetzt: string): { nachrichten: WaNachricht[]; fehlgeschlagen: number; uebersprungen: number } {
  const nachrichten: WaNachricht[] = [];
  let fehlgeschlagen = 0, uebersprungen = 0, gesehen = 0;
  if (koerper?.object !== 'whatsapp_business_account' || !Array.isArray(koerper.entry)) return { nachrichten, fehlgeschlagen, uebersprungen: 1 };
  for (const e of koerper.entry) {
    for (const c of Array.isArray(e?.changes) ? e.changes : []) {
      const w = c?.value;
      if (c?.field !== 'messages' || !w || String(w.metadata?.phone_number_id ?? '') !== telefonnummerId) { uebersprungen++; continue; }
      for (const r of Array.isArray(w.messages) ? w.messages : []) {
        if (++gesehen > WA_GRENZEN.jeWebhook) { uebersprungen++; continue; }
        const m = nachrichtAus(r, jetzt);
        if (m) nachrichten.push(m); else uebersprungen++;
      }
      for (const s of Array.isArray(w.statuses) ? w.statuses : []) if (s?.status === 'failed') fehlgeschlagen++;
    }
  }
  return { nachrichten, fehlgeschlagen, uebersprungen };
}

/** Einen Webhook der ZOE-Nummer prüfen und annehmen. `netz` = Schlüssel der Drossel. Wirft nie. */
export async function zoeWebhookVerarbeiten(roh: Buffer, signatur: string | null, k: ZoeWaKonfig, netz: string, jetzt = new Date()): Promise<ZoeWebhookAntwort> {
  const schluessel = `zoe-wa-webhook:${netz}`;
  if (!pruefe(schluessel, jetzt.getTime()).erlaubt) return { status: 429 };
  if (roh.length > WA_GRENZEN.koerper) return { status: 413 };
  if (!signaturGueltig(roh, signatur, k.appGeheimnis)) {
    fehlschlag(schluessel, jetzt.getTime(), 10);
    await aendereZoeZustand(z => ({ ...z, webhook: { anzahl: z.webhook?.anzahl ?? 0, ...z.webhook, abgelehnt: (z.webhook?.abgelehnt ?? 0) + 1, zuletztAbgelehnt: jetzt.toISOString() } })).catch(() => {});
    return { status: 403 };
  }
  erfolg(schluessel);
  let koerper: WebhookKoerper;
  try { koerper = JSON.parse(roh.toString('utf8')) as WebhookKoerper; } catch { return { status: 400 }; }
  const iso = jetzt.toISOString();
  const { nachrichten, fehlgeschlagen } = webhookLesen(koerper, k.telefonnummerId, iso);
  const personen = new Set<string>();
  let fremd = 0, verworfen = 0;
  try {
    for (const m of nachrichten) {
      const owner = await personFuerNummer(m.nummer, jetzt.getTime());
      if (!owner) { fremd++; continue; } // fremde Nummer: nichts speichern, nicht antworten — nur zählen
      await aendereKanal(owner.person, cur => {
        // Inzwischen getrennt (oder Nummer gewechselt)? Dann wie fremd.
        if (cur.nummer !== m.nummer || (cur.status !== 'verbunden' && cur.status !== 'wartet')) { fremd++; return null; }
        if (cur.gesehen?.[m.id]) return null; // schon da (Meta wiederholt)
        const eingang = cur.eingang ?? [];
        const gesehen = { ...(cur.gesehen ?? {}), [m.id]: iso };
        if (eingang.length >= KANAL_GRENZEN.eingang) { verworfen++; return { ...cur, gesehen }; }
        personen.add(owner.person);
        return { ...cur, gesehen, eingang: [...eingang, eingangAus(m)], ...(!cur.zuletztEingehend || m.am > cur.zuletztEingehend ? { zuletztEingehend: m.am } : {}) };
      }, jetzt.getTime());
    }
    await aendereZoeZustand(z => ({
      ...z,
      webhook: { abgelehnt: z.webhook?.abgelehnt ?? 0, ...z.webhook, anzahl: (z.webhook?.anzahl ?? 0) + 1, zuletzt: iso },
      ...(fremd ? { fremd: { anzahl: (z.fremd?.anzahl ?? 0) + fremd, zuletzt: iso } } : {}),
      ...(verworfen ? { verworfen: (z.verworfen ?? 0) + verworfen } : {}),
      ...(fehlgeschlagen ? { fehlgeschlagen: [...(z.fehlgeschlagen ?? []), ...Array.from({ length: fehlgeschlagen }, () => iso)].filter(t => jetzt.getTime() - Date.parse(t) < 7 * 86_400_000) } : {}),
    }));
  } catch (e) {
    console.error(`[zoe-whatsapp] Webhook nicht gespeichert: ${e instanceof Error ? e.name : 'Fehler'}`);
    return { status: 500 };
  }
  return { status: 200, personen: [...personen] };
}
